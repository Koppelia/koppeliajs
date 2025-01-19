import { Console } from "./console.js";
import { Message } from "./message.js";
import { get, writable, type Writable } from "svelte/store";


export type AnyState = { [key: string]: string }

export class State {
    private _globalState: Writable<AnyState>;
    private _console: Console
    private _access: boolean = true;

    constructor(console: Console, defaultState: AnyState = {}) {
        this._access = false;
        this._globalState = writable(defaultState);
        this._console = console;

        this._initEvents();
        this._access = true;
    }

    public get state(): Writable<AnyState> {
        return this._globalState;
    }

    /**
     * Update the state from the server
     */
    public updateFromServer() {
        let req = new Message();
        req.setRequest("getState");
        this._console.sendMessage(req, (response: Message) => {
            let state = response.getParam('state', {});
            this._onReceiveState(response.header.from, state);
        });
    }

    /**
     * Force change the state with a new one
     * @param newState 
     */
    public setState(newState: AnyState) {
        this._globalState.set(newState);
    }

    /**
     * Marge a new update to the last one
     * @param stateUpdate 
     */
    public updateState(stateUpdate: AnyState) {
        let tempState = get(this._globalState);
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
        // Get the state when the console is ready
        this._console.onReady(() => {
            this.updateFromServer();
        });

        // update the state when receive a change from console
        this._console.onStateChange((from, state) => {
            this._onReceiveState(from, state);
        });

        // Send a change state request when detect a state change
        this._globalState.subscribe((newState: AnyState) => {
            if (this._access) {
                this._console.onReady(() => {

                    console.log("change state new state", newState)
                    let req = new Message();
                    req.setRequest("changeState");
                    req.addParam("state", newState);
                    this._console.sendMessage(req);

                });
            }

        });

    }

    /**
     * callback when a new state 
     */
    private _onReceiveState(from: string, receivedState: AnyState) {
        this._access = false;
        this._globalState.set(receivedState);
        this._access = true;
    }
}