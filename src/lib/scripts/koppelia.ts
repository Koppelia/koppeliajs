import { get, type Writable } from "svelte/store";
import { routeType } from "../stores/routeStore.js";
import { Console } from "./console.js";
import { State, type AnyState } from "./state.js";
import { PeerType } from "./request.js";
import { Stage } from "./stage.js";


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



}