import { Console } from "./console.js";
import { Message } from "./message.js";
import { get, writable, type Writable } from "svelte/store";


export type AnyState = { [key: string]: any }

export class State {
    private _globalState: Writable<AnyState>;
    private _console: Console
    private _access: boolean = true;
    private _previousStateValue: AnyState = {}
    private _forceState: boolean;

    constructor(console: Console, defaultState: AnyState = {}) {
        this._access = false;
        this._globalState = writable(defaultState);
        this._console = console;
        this._forceState = false; // force the state without update

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
            this._onReceiveState(response.header.from, state, false);
        });
    }

    /**
     * Force change the state with a new one
     * @param newState 
     */
    public setState(newState: AnyState, force: boolean = false) {
        this._forceState = force; // if force to true -> force the state to be sent entirely instead of sending an update
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
        this._console.onStateChange((from, state, update) => {
            this._onReceiveState(from, state, update);
        });

        // Send a change state request when detect a state change
        this._globalState.subscribe((newState: AnyState) => {
            if (this._access) {
                let update: { [key: string]: any } = {};
                for (let entry in newState) {
                    if (!Object.hasOwn(this._previousStateValue, entry)) {
                        update[entry] = newState[entry];
                    }
                    else if (Array.isArray(newState[entry])) {
                        if(JSON.stringify(this._previousStateValue[entry]) != JSON.stringify(newState[entry])) {
                            update[entry] = newState[entry];
                        }
                    }
                    else if (this._previousStateValue[entry] != newState[entry]) {
                        update[entry] = newState[entry];
                    }
                }
                console.log("change state NewState=", newState, "; update=", update, " currentState=", this._previousStateValue);
                this._previousStateValue = structuredClone(newState);
                this._console.onReady(() => {


                    let req = new Message();
                    req.setRequest("changeState");
                    req.addParam("state", update);

                    req.addParam("update", !this._forceState);
                    this._forceState = false;
                    this._console.sendMessage(req);

                });
            }
        });

    }

    /**
     * callback when a new state 
     */
    private _onReceiveState(from: string, receivedState: AnyState, update: boolean) {
        this._access = false;
        if (update) {
            let state = get(this._globalState);
            for (let entry in receivedState) {
                state[entry] = receivedState[entry];
                this._previousStateValue[entry] = structuredClone(receivedState[entry]);
            }
            this._globalState.set(state);
        } else {
            this._globalState.set(receivedState);
        }
        this._access = true;
    }
}