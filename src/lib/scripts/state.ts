import { Console } from "./console.js";
import { Request } from "./request.js";
import { get, writable, type Writable } from "svelte/store";


export type AnyState = { [key: string]: string }

export class State {
    private globalState: Writable<AnyState> = writable({});
    private console: Console
    private _access: boolean = true;

    constructor(console: Console, defaultState: AnyState = {}) {
        this.globalState.set(defaultState);
        this.console = console;

        this._initEvents();
    }

    public get state(): Writable<AnyState> {
        return this.globalState;
    }

    /**
     * Update the state from the server
     */
    public updateFromServer() {
        let req = new Request();
        req.setRequest("getState");
        this.console.sendRequest(req, (response) => {
            // TODO: to implement
        });
    }

    /**
     * Force change the state with a new one
     * @param newState 
     */
    public setState(newState: AnyState) {
        this.globalState.set(newState);

        let req = new Request();
        req.setRequest("changeState");
        req.addParam("state", newState);
        this.console.sendRequest(req);

    }

    /**
     * Marge a new update to the last one
     * @param stateUpdate 
     */
    public updateState(stateUpdate: AnyState) {
        let tempState = get(this.globalState);
        for (let key in stateUpdate) {
            tempState[key] = stateUpdate[key];
        }
        this.setState(tempState);
    }

    /**
     * Init all events
     * @param from 
     * @param any 
     */
    private _initEvents() {
        this.console.onStateChange((from, state) => {
            this._onReceiveState(from, state);
        });

        this.globalState.subscribe((newState: AnyState) => {
            this.console.onReady(() => {
                if (this._access) {
                    console.log("change state new state", newState)
                    let req = new Request();
                    req.setRequest("changeState");
                    req.addParam("state", newState);
                    this.console.sendRequest(req);
                }
            });

        });

    }

    /**
     * callback when a new state 
     */
    private _onReceiveState(from: string, receivedState: AnyState) {
        this._access = false;
        this.globalState.set(receivedState);
        this._access = true;
    }
}