import { get, type Writable } from "svelte/store";
import { routeType } from "../stores/routeStore.js";
import { Console } from "./console.js";
import { State, type AnyState } from "./state.js";
import { Message, PeerType } from "./message.js";
import { Stage } from "./stage.js";
import { Device } from "./device.js"
import { Play } from "./play.js"
import { PUBLIC_GAME_ID } from '$env/static/public';


export class Koppelia {
    private _console: Console
    private _state: State
    private _stage: Stage
    private static _instance: Koppelia;

    constructor() {
        this._console = new Console()
        this._console.onReady(() => {
            let type = get(routeType);
            if (type == "controller") {
                console.log("identify controller");
                this._console.identify(PeerType.CONTROLLER);
            }
            else if (type == "monitor") {
                console.log("identify monitor");
                this._console.identify(PeerType.MONITOR);
            }
            else
                console.log("Cannot identifiy type ", type);
        });

        this._state = new State(this._console, {
            hey: "coucou"
        });
        this._stage = new Stage(this._console);
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
            if (type == "controller") {
                this._state.setState(defaultState); // set the state
                this._stage.initStages(stages); // init the list of stages
            }
        });

    }

    /**
     * Go to a stage, the stage must be in the stage list
     * If the stage list is empty the console will return an error
     * @param stageName 
     */
    public goto(stageName: string) {
        this._stage.goto(stageName);
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
            this._console.sendMessage(getDevicesRequest, (response: Message) => {
                // convert the response to al list of device objects
                let devices_raw: any = response.getParam("devices", []);
                let devices: Device[] = [];
                for (let device_raw of devices_raw) {
                    let device = new Device(this._console);
                    device.fromObject(device_raw);
                    devices.push(device);
                }
                resolve(devices);
            });
        });
    }

    /**
     * Get the game ID of the current game
     * @returns the game id as a string
     */
    public getGameId(): string {
        return PUBLIC_GAME_ID
    }

    /**
     * Get the list of plays
     * @param count limit of plays to get
     * @param index index from which to start fetching the plays
     * @param orderBy order by date or name
     * @returns the List of plays an array of objects of type Play
     */
    public async getPlays(count: number = 10, index: number = 0, orderBy: string = "date"): Promise<Play[]> {
        return new Promise((resolve, reject) => {
            let getPlaysRequest = new Message()
            getPlaysRequest.setRequest("getPlaysList");
            getPlaysRequest.addParam("gameId", this.getGameId());
            getPlaysRequest.addParam("count", count);
            getPlaysRequest.addParam("index", index);
            getPlaysRequest.addParam("orderBy", orderBy);
            getPlaysRequest.setDestination(PeerType.MASTER, "");
            this._console.sendMessage(getPlaysRequest, (response: Message) => {
                let playsRawList: { [key: string]: any } = response.getParam("plays", {});
                let plays: Play[] = [];
                for (let playId in playsRawList) {
                    plays.push(new Play(this._console, playId, playsRawList[playId]))
                }
                resolve(plays);
            });
        });

    }

}