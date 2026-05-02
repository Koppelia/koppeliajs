import { get, type Writable } from "svelte/store";
import { routeType } from "../stores/routeStore.js";
import { type AnyRequestCallback, Console } from "./console.js";
import { type AnyState, State } from "./state.js";
import { Message, PeerType } from "./message.js";
import { Stage } from "./stage.js";
import { Device } from "./device.js";
import { Play } from "./play.js";
import { PUBLIC_GAME_ID } from "$env/static/public";
import { Resident } from "./resident.js";
import { Option, type OptionChangedCallback } from "./option.js";
import { logger, setDebugMode } from "./logger.js";
import { CustomCallbacks } from "./customCallback.js";
import { Song } from "./song.js";

/**
 * The main Koppelia framework entry point.
 * Implements a Singleton pattern to provide global access to the console, state, stages,
 * devices, and game synchronization features across the Svelte application.
 */
export class Koppelia {
    private _console: Console;
    private _state: State;
    private _stage: Stage;
    private static _instance: Koppelia;
    private _option: Option;
    private _callbacks: CustomCallbacks;

    private constructor() {
        this._console = new Console();
        this._callbacks = new CustomCallbacks(this._console);
        this._console.onReady(() => {
            let type = get(routeType);
            if (type == "controller") {
                logger.log("identify controller");
                this._console.identify(PeerType.CONTROLLER);
            } else if (type == "monitor") {
                logger.log("identify monitor");
                this._console.identify(PeerType.MONITOR);
            } else {
                logger.log("Cannot identifiy type ", type);
            }
        });

        this._state = new State(this._console, {});
        this._stage = new Stage(this._console);
        this._option = new Option(this._console);
    }

    /**
     * Retrieves the singleton instance of the Koppelia class.
     * Instantiates it if it does not yet exist.
     */
    public static get instance(): Koppelia {
        if (!Koppelia._instance) {
            Koppelia._instance = new Koppelia();
        }
        return Koppelia._instance;
    }

    /**
     * Retrieves the global Svelte writable store representing the synchronized game state.
     */
    public get state(): Writable<AnyState> {
        return this._state.state;
    }

    /**
     * Merges a partial update into the current global state and broadcasts the change.
     * @param stateUpdate A dictionary containing the keys/values to update.
     */
    public updateState(stateUpdate: AnyState) {
        this._state.updateState(stateUpdate);
    }

    /**
     * Completely overwrites the global state with a new state object.
     * @param newState The new state object to apply.
     */
    public setState(newState: AnyState) {
        this._state.setState(newState);
    }

    /**
     * Checks if the underlying WebSocket console connection is fully established.
     */
    public get ready(): boolean {
        return this._console.ready;
    }

    /**
     * Enables or disables debug mode for extended console logging.
     * @param enable True to enable debug logs, false to disable.
     */
    public setDebugMode(enable: boolean) {
        setDebugMode(enable);
    }

    /**
     * Registers a callback to execute when the console connection is fully ready.
     * @param callback The function to execute.
     */
    public onReady(callback: () => void) {
        this._console.onReady(callback);
    }

    /**
     * Initializes the default state and the routing stages of the game.
     * Specifically executes for "monitor" peers to ensure the primary game view sets the rules.
     * @param defaultState The initial state structure.
     * @param stages An array of valid stage names for application routing.
     */
    public init(defaultState: AnyState, stages: string[]) {
        this._console.onReady(() => {
            let type = get(routeType);
            if (type == "monitor") {
                this._state.setState(defaultState, true);
                this._stage.initStages(stages);
            }
        });
    }

    /**
     * Requests a transition to a specific stage (view) across the network.
     * Note: All active console event listeners will be destroyed before transition.
     * @param stageName The target stage to navigate to.
     */
    public goto(stageName: string) {
        this._stage.goto(stageName);
    }

    /**
     * Normalizes a media URL to ensure cross-client compatibility.
     * @param mediaUrl The raw media URL.
     * @returns The corrected URL.
     */
    public fixMediaUrl(mediaUrl: string): string {
        return this._console.fixMediaUrl(mediaUrl);
    }

    /**
     * Constructs the full URL for a given relative media path.
     * @param path The relative media path.
     * @returns The full URL string.
     */
    public getMediaLink(path: string): string {
        return this._console.getMediaUrl(path);
    }

    /**
     * Asynchronously fetches the list of available connected devices from the master peer.
     * @returns A promise resolving to an array of instantiated Device objects.
     */
    public async getDevices(): Promise<Device[]> {
        return new Promise((resolve, reject) => {
            let getDevicesRequest = new Message();
            getDevicesRequest.setRequest("getDevices");
            getDevicesRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                getDevicesRequest,
                (response: Message) => {
                    let devices_raw: any = response.getParam("devices", []);
                    let devices: Device[] = [];
                    for (let device_raw of devices_raw) {
                        let device = new Device(this._console);
                        device.fromObject(device_raw);
                        devices.push(device);
                    }
                    resolve(devices);
                },
            );
        });
    }

    /**
     * Retrieves the unique identifier of the currently loaded game.
     * @returns The game ID string provided by public environment variables.
     */
    public getGameId(): string {
        return PUBLIC_GAME_ID;
    }

    /**
     * Asynchronously fetches a paginated list of Play sessions.
     * Note: This only fetches metadata. Specific Play content must be downloaded via Play methods.
     * @param count Maximum number of plays to retrieve (default: 10).
     * @param index The starting offset index (default: 0).
     * @param orderBy Sorting criteria, e.g., "date" or "name" (default: "date").
     * @returns A promise resolving to an array of Play instances.
     */
    public async getPlays(
        count: number = 10,
        index: number = 0,
        orderBy: string = "date",
    ): Promise<Play[]> {
        return new Promise((resolve, reject) => {
            let getPlaysRequest = new Message();
            getPlaysRequest.setRequest("getPlaysList");
            getPlaysRequest.addParam("gameId", this.getGameId());
            getPlaysRequest.addParam("count", count);
            getPlaysRequest.addParam("index", index);
            getPlaysRequest.addParam("orderBy", orderBy);
            getPlaysRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(getPlaysRequest, (response: Message) => {
                let playsRawList: { [key: string]: any } = response.getParam(
                    "plays",
                    {},
                );
                let plays: Play[] = [];
                for (let playId in playsRawList) {
                    plays.push(
                        new Play(this._console, playId, playsRawList[playId]),
                    );
                }
                resolve(plays);
            });
        });
    }

    /**
     * Asynchronously fetches the list of registered residents/players.
     * @returns A promise resolving to an array of Resident instances.
     */
    public async getResidents(): Promise<Resident[]> {
        return new Promise((resolve, reject) => {
            let getResidentsRequest = new Message();
            getResidentsRequest.setRequest("getResidentsList");
            getResidentsRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                getResidentsRequest,
                (response: Message) => {
                    let ResidentRawList: { [key: string]: any } = response
                        .getParam("residents", {});
                    let residents: Resident[] = [];
                    for (let residentId in ResidentRawList) {
                        let resident = new Resident();
                        resident.fromObject(ResidentRawList[residentId]);
                        residents.push(resident);
                    }
                    resolve(residents);
                },
            );
        });
    }

    /**
     * Asynchronously fetches a specific song by its unique ID.
     * @param songId The ID of the song to retrieve.
     * @returns A promise resolving to the corresponding Song instance.
     */
    public async getSongById(songId: string): Promise<Song> {
        return new Promise((resolve, reject) => {
            let getSongRequest = new Message();
            getSongRequest.setRequest("getSong");
            getSongRequest.addParam("songId", songId);
            getSongRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                getSongRequest,
                (response: Message) => {
                    let rawSong: { [key: string]: any } = response
                        .getParam("song", {});
                    let song: Song = new Song();
                    song.fromObject(rawSong);
                    resolve(song);
                },
            );
        });
    }

    /**
     * Asynchronously fetches a dictionary of all songs associated with the currently active play.
     * @returns A promise resolving to a map of song IDs to Song instances.
     */
    public getCurrentPlaySongs(): Promise<{ [key: string]: Song }> {
        return new Promise((resolve, reject) => {
            let getSongRequest = new Message();
            getSongRequest.setRequest("getCurrentPlaySongs");
            getSongRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                getSongRequest,
                (response: Message) => {
                    let rawSongs: { [key: string]: any }[] = response
                        .getParam("songs", []);
                    let songs: { [key: string]: Song } = {};
                    for (let songObj of rawSongs) {
                        let song = new Song();
                        song.fromObject(songObj);
                        songs[song.id] = song;
                    }
                    resolve(songs);
                },
            );
        });
    }

    /**
     * Asynchronously retrieves the currently active Play instance set on the server.
     * @returns A promise resolving to the active Play.
     */
    public async getCurrentPlay(): Promise<Play> {
        return new Promise((resolve, reject) => {
            let getCuurentPlayRequest = new Message();
            getCuurentPlayRequest.setRequest("getCurrentPlay");
            getCuurentPlayRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                getCuurentPlayRequest,
                (response: Message) => {
                    let playData = response.getParam("play", {});
                    let playId = response.getParam("playId", "");
                    let play = new Play(this._console, playId, playData);
                    resolve(play);
                },
            );
        });
    }

    /**
     * Enables a live difficulty cursor, allowing difficulty changes during gameplay.
     * @param callback Function to execute when the difficulty changes.
     */
    public async enableDifficultyCursor(
        callback: (difficulty: number) => void,
    ) {
    }

    /**
     * Registers a new growable element on the network and listens for state changes.
     * @param id The unique identifier for the growable element.
     * @param onGrowChange Callback triggered when the 'grown' state of the element changes.
     */
    public async registerNewGrowableElement(
        id: string,
        onGrowChange: (grown: boolean) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (get(routeType) == "controller") {
                let addGrowableElRequest = new Message();
                addGrowableElRequest.setRequest("addGrowableElement");
                addGrowableElRequest.addParam("id", id);
                addGrowableElRequest.setDestination(PeerType.MASTER, "");

                this._console.sendMessage(
                    addGrowableElRequest,
                    (response: Message) => {
                    },
                );
            }

            this._console.onRequest(
                (req: string, params: { [key: string]: any }) => {
                    if (req == "gowableElementNotification") {
                        if (params.id !== undefined && params.id == id) {
                            let grown = false;
                            if (params.grown != undefined) grown = params.grown;
                            onGrowChange(grown);
                        }
                    }
                },
            );
            resolve();
        });
    }

    /**
     * Updates the 'grown' state of a registered growable element across the network.
     * @param id The unique identifier of the element.
     * @param grown True if the element is in a grown state, false otherwise.
     */
    public async updateGrowableElement(
        id: string,
        grown: boolean,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let addGrowableElRequest = new Message();
            addGrowableElRequest.setRequest("updateGrowableElement");
            addGrowableElRequest.addParam("id", id);
            addGrowableElRequest.addParam("grown", grown);
            addGrowableElRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                addGrowableElRequest,
                (response: Message) => {
                    resolve();
                },
            );
        });
    }

    /**
     * Registers a new resizable text element with a default font size (Monitor only).
     * @param id The unique identifier for the text element.
     * @param defaultSize The default font size.
     */
    public async registerNewResizableText(
        id: string,
        defaultSize: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (get(routeType) == "monitor") {
                let addGrowableElRequest = new Message();
                addGrowableElRequest.setRequest("addResizableText");
                addGrowableElRequest.addParam("id", id);
                addGrowableElRequest.addParam("defaultSize", defaultSize);
                addGrowableElRequest.setDestination(PeerType.MASTER, "");

                this._console.sendMessage(
                    addGrowableElRequest,
                    (response: Message) => {
                    },
                );
            }

            resolve();
        });
    }

    /**
     * Subscribes to size change notifications for a specific resizable text element.
     * @param id The unique identifier of the text element.
     * @param onTextResized Callback executed with the new font size.
     * @returns The unique subscription ID used for unsubscribing.
     */
    public onResizableTextChanged(
        id: string,
        onTextResized: (newSize: number) => void,
    ): string {
        return this._console.onRequest(
            (req: string, params: { [key: string]: any }) => {
                if (req == "resizableTextNotification") {
                    if (
                        params.id !== undefined && params.id == id &&
                        params.fontSize != undefined
                    ) {
                        let fontSize = params.fontSize;
                        onTextResized(fontSize);
                    }
                }
            },
        );
    }

    /**
     * Unsubscribes a previously registered resizable text listener.
     * @param callbackId The subscription ID returned by onResizableTextChanged.
     */
    public unsubResizableText(callbackId: string) {
        this._console.unsubscribeCallback(callbackId);
    }

    /**
     * Retrieves the list of all registered resizable text elements from the master.
     * @returns A promise resolving to an array of resizable element data objects.
     */
    public async getResizableTexts(): Promise<{ [key: string]: any }[]> {
        return new Promise((resolve, reject) => {
            let addGrowableElRequest = new Message();
            addGrowableElRequest.setRequest("getResizableTexts");
            addGrowableElRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                addGrowableElRequest,
                (response: Message) => {
                    let resizables = response.getParam("resizableTexts", []);
                    resolve(resizables);
                },
            );
        });
    }

    /**
     * Writes configuration data to the master peer, optionally binding it to the current play.
     * @param config_id The unique identifier for this configuration data.
     * @param config_value The dictionary containing the configuration payload.
     * @param current_play Whether to bind this configuration to the active play session (default: true).
     */
    public async writeGameConfig(
        config_id: string,
        config_value: { [key: string]: any },
        current_play: boolean = true,
    ) {
        let setGameConfigRequest = new Message();

        setGameConfigRequest.setRequest("setGameData");
        setGameConfigRequest.addParam(
            "playId",
            current_play ? "current" : null,
        );
        setGameConfigRequest.addParam("content", config_value);
        setGameConfigRequest.addParam("dataId", config_id);
        setGameConfigRequest.setDestination(PeerType.MASTER, "");

        this._console.sendMessage(
            setGameConfigRequest,
        );
    }

    /**
     * Retrieves persistent configuration data from the master peer.
     * @param config_id The unique identifier of the configuration data to fetch.
     * @param current_play True to fetch data bound specifically to the active play, false otherwise.
     * @returns A promise resolving to the configuration dictionary.
     */
    public async getGameConfig(
        config_id: string,
        current_play: boolean,
    ): Promise<{ [key: string]: any }> {
        return new Promise((resolve, reject) => {
            let getGameConfigRequest = new Message();
            getGameConfigRequest.setRequest("getGameData");
            getGameConfigRequest.addParam(
                "playId",
                current_play ? "current" : null,
            );
            getGameConfigRequest.addParam("dataId", config_id);
            getGameConfigRequest.setDestination(PeerType.MASTER, "");

            this._console.sendMessage(
                getGameConfigRequest,
                (response: Message) => {
                    let gameConfigContent = response.getParam("gameData", {});
                    resolve(gameConfigContent.content || {});
                },
            );
        });
    }

    /**
     * Broadcasts a Text-to-Speech synthesis request to the Maestro peer.
     * @param sentence The text string to be spoken out loud.
     */
    public say(sentence: string) {
        let sayRequest = new Message();
        sayRequest.setRequest("sayRequest");
        sayRequest.addParam("sentence", sentence);
        sayRequest.setDestination(PeerType.MAESTRO, "");

        this._console.sendMessage(sayRequest);
    }

    /**
     * Assigns a basic value to a registered game option via the option manager.
     * @param name The unique name of the option.
     * @param value The value to set.
     */
    public setOption(name: string, value: any) {
        this._option.setOption(name, value, null, {});
    }

    /**
     * Creates or updates an interactive slider option.
     * @param name The unique identifier for the slider.
     * @param label The display label for the UI.
     * @param value The current numeric value.
     * @param min The minimum allowed value.
     * @param max The maximum allowed value.
     * @param step The increment step size.
     */
    public createSliderOtption(
        name: string,
        label: string,
        value: number,
        min: number,
        max: number,
        step: number,
    ) {
        this._option.setOption(name, value, "slider", {
            "min": min,
            "max": max,
            "step": step,
            "label": label,
        });
    }

    /**
     * Creates or updates an interactive toggle switch option.
     * @param name The unique identifier for the switch.
     * @param label The display label for the UI.
     * @param value The current boolean state.
     */
    public createSwitchOption(name: string, label: string, value: boolean) {
        this._option.setOption(name, value, "switch", {
            "label": label,
        });
    }

    /**
     * Creates or updates a multiple-choice selection option.
     * @param name The unique identifier for the option.
     * @param label The display label for the UI.
     * @param value The currently selected choice.
     * @param choices An array of available string choices.
     */
    public createChoicesOption(
        name: string,
        label: string,
        value: string,
        choices: string[],
    ) {
        this._option.setOption(name, value, "choices", {
            "choices": choices,
            "label": label,
        });
    }

    /**
     * Registers a callback listener to trigger whenever a specific option's value changes.
     * @param name The name of the option to observe.
     * @param callback The function to execute on change.
     */
    public onOptionChanged(name: string, callback: OptionChangedCallback) {
        this._option.onOptionChanged(name, callback);
    }

    /**
     * Executes a broadcasted network request to trigger a registered custom callback.
     * @param callbackName The unique registered name of the custom callback.
     * @param args Dictionary of arguments to pass to the callback.
     */
    public run(callbackName: string, args: { [key: string]: any }) {
        this._callbacks.runCustomCallback(callbackName, args);
    }

    /**
     * Registers a local function to listen for network execution of a custom callback.
     * @param callbackName The identifier for this callback.
     * @param callback The local function to execute.
     */
    public on(
        callbackName: string,
        callback: (args: { [key: string]: any }) => void,
    ) {
        this._callbacks.registerCustomCallback(callbackName, callback);
    }

    /**
     * Unregisters a locally listening custom callback.
     * @param callbackName The identifier of the callback to remove.
     */
    public unsub(callbackName: string) {
        this._callbacks.unregisterCustomCallback(callbackName);
    }
}
