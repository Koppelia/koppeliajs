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

export class Koppelia {
    private _console: Console;
    private _state: State;
    private _stage: Stage;
    private static _instance: Koppelia;
    private _option: Option;
    private _callbacks: CustomCallbacks;

    constructor() {
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

    public static get instance(): Koppelia {
        if (!Koppelia._instance) {
            Koppelia._instance = new Koppelia();
        }
        return Koppelia._instance;
    }

    public get state(): Writable<AnyState> {
        return this._state.state;
    }

    public updateState(stateUpdate: AnyState) {
        this._state.updateState(stateUpdate);
    }

    public setState(newState: AnyState) {
        this._state.setState(newState);
    }

    public get ready(): boolean {
        return this._console.ready;
    }

    public setDebugMode(enable: boolean) {
        setDebugMode(enable);
    }

    /**
     * Add a callback that will be called when the connection to the console is entirely ready
     *
     * @param callback
     */
    public onReady(callback: () => void) {
        this._console.onReady(callback);
    }

    /**
     * Init the default state of the game and the list of all stages
     *
     * @param defaultState Default state that be initialized
     * @param stages List of all stages
     */
    public init(defaultState: AnyState, stages: string[]) {
        this._console.onReady(() => {
            let type = get(routeType);
            if (type == "monitor") {
                this._state.setState(defaultState, true); // set the state
                this._stage.initStages(stages); // init the list of stages
            }
        });
    }

    /**
     * Go to a stage, the stage must be in the stage list
     * Before changing the staging all callbacks will be destroyed
     * If the stage list is empty the console will return an error
     * @param stageName
     */
    public goto(stageName: string) {
        this._stage.goto(stageName);
    }

    public fixMediaUrl(mediaUrl: string): string {
        return this._console.fixMediaUrl(mediaUrl);
    }

    public getMediaLink(path: string): string {
        return this._console.getMediaUrl(path);
    }

    /**
     * Get the list of devices in a callback
     * @param callback
     */
    public async getDevices(): Promise<Device[]> {
        return new Promise((resolve, reject) => {
            // create the message to request the devices
            let getDevicesRequest = new Message();
            getDevicesRequest.setRequest("getDevices");
            getDevicesRequest.setDestination(PeerType.MASTER, "");

            // send the message to the console
            this._console.sendMessage(
                getDevicesRequest,
                (response: Message) => {
                    // convert the response to al list of device objects
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
     * Get the game ID of the current game
     * @returns the game id as a string
     */
    public getGameId(): string {
        return PUBLIC_GAME_ID;
    }

    /**
     * Get the list of plays, the plays returned by this function doesn't include the raw
     * You have to call a function in from the play object to download all the raw files
     * @param count limit of plays to get
     * @param index index from which to start fetching the plays
     * @param orderBy order by date or name
     * @returns the List of plays an array of objects of type Play,
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
     * Get the current play that has been set
     * @returns the current play
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
     * This function enables the difficulty cursor, to change the difficulty live when playing from Koppeli'App
     * @param callback : callback to call when difficulty changes
     */
    public async enableDifficultyCursor(
        callback: (difficulty: number) => void,
    ) {
    }

    /**
     * @param id
     * @param onGrowChange
     */
    public async registerNewGrowableElement(
        id: string,
        onGrowChange: (grown: boolean) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // create the message to request the devices
            if (get(routeType) == "controller") {
                let addGrowableElRequest = new Message();
                addGrowableElRequest.setRequest("addGrowableElement");
                addGrowableElRequest.addParam("id", id);
                addGrowableElRequest.setDestination(PeerType.MASTER, "");

                // send the message to the console (only the controller sends the )
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
     * @param id
     * @param grown
     */
    public async updateGrowableElement(
        id: string,
        grown: boolean,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // create the message to request the devices
            let addGrowableElRequest = new Message();
            addGrowableElRequest.setRequest("updateGrowableElement");
            addGrowableElRequest.addParam("id", id);
            addGrowableElRequest.addParam("grown", grown);
            addGrowableElRequest.setDestination(PeerType.MASTER, "");

            // send the message to the console
            this._console.sendMessage(
                addGrowableElRequest,
                (response: Message) => {
                    resolve();
                },
            );
        });
    }

    /**
     * Add a new resizable text element and define the callback that will be executed when receive and a resizable
     * text update notification form koppelia application
     */
    public async registerNewResizableText(
        id: string,
        defaultSize: number,
        onTextResized: (newSize: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (get(routeType) == "monitor") {
                let addGrowableElRequest = new Message();
                addGrowableElRequest.setRequest("addResizableText");
                addGrowableElRequest.addParam("id", id);
                addGrowableElRequest.addParam("defaultSize", defaultSize);
                addGrowableElRequest.setDestination(PeerType.MASTER, "");

                // send the message to the console (only the controller sends the )
                this._console.sendMessage(
                    addGrowableElRequest,
                    (response: Message) => {
                    },
                );
            }

            this._console.onRequest(
                (req: string, params: { [key: string]: any }) => {
                    if (req == "resizableTextNotification") {
                        if (params.id !== undefined && params.id == id) {
                            let fontSize = defaultSize;
                            if (params.fontSize != undefined) {
                                fontSize = params.fontSize;
                            }
                            onTextResized(fontSize);
                        }
                    }
                },
            );

            resolve();
        });
    }

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
     * @param sentence
     */
    public say(sentence: string) {
        // create the message to request the devices
        let sayRequest = new Message();
        sayRequest.setRequest("sayRequest");
        sayRequest.addParam("sentence", sentence);
        sayRequest.setDestination(PeerType.MAESTRO, "");

        // send the message to the console
        this._console.sendMessage(sayRequest);
    }

    /**
     * Set a new or edit a game option
     * @param name Name fo the option
     * @param value Value of the option
     */
    public setOption(name: string, value: any) {
        this._option.setOption(name, value, null, {});
    }

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

    public createSwitchOption(name: string, label: string, value: boolean) {
        this._option.setOption(name, value, "switch", {
            "label": label,
        });
    }

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

    public onOptionChanged(name: string, callback: OptionChangedCallback) {
        this._option.onOptionChanged(name, callback);
    }

    public run(callbackName: string, args: { [key: string]: any }) {
        this._callbacks.runCustomCallback(callbackName, args);
    }

    public on(
        callbackName: string,
        callback: (args: { [key: string]: any }) => void,
    ) {
        this._callbacks.registerCustomCallback(callbackName, callback);
    }

    public unsub(callbackName: string) {
        this._callbacks.unregisterCustomCallback(callbackName);
    }
}
