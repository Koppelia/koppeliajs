import { Console } from "./console.js";
import { logger } from "./logger.js";
import { Message } from "./message.js";
import { get, writable, type Writable } from "svelte/store";

export type AnyState = { [key: string]: any }

/**
 * Manages the synchronized global state of the application.
 * Uses a Svelte writable store locally and syncs changes automatically with the server via the Console.
 */
export class State {
    private _globalState: Writable<AnyState>;
    private _console: Console
    private _access: boolean = true;
    private _previousStateValue: AnyState = {}
    private _forceState: boolean;

    /**
     * Initializes the state manager.
     * @param console The Console instance used for network communication.
     * @param defaultState The initial state to populate the Svelte store with.
     */
    constructor(console: Console, defaultState: AnyState = {}) {
        this._access = false;
        this._globalState = writable(defaultState);
        this._console = console;
        this._forceState = false; 

        this._initEvents();
        this._access = true;
    }

    /**
     * Retrieves the Svelte writable store containing the global state.
     * @returns The Svelte writable store.
     */
    public get state(): Writable<AnyState> {
        return this._globalState;
    }

    /**
     * Requests the latest state from the server and updates the local store upon receiving the response.
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
     * Completely overwrites the current state with a new state object.
     * @param newState The new state object to apply.
     * @param force If true, forces the entire state payload to be broadcasted instead of just the computed diffs.
     */
    public setState(newState: AnyState, force: boolean = false) {
        this._forceState = force; 
        this._globalState.set(newState);
    }

    /**
     * Merges a partial update into the current global state.
     * @param stateUpdate A dictionary containing only the keys/values to update.
     */
    public updateState(stateUpdate: AnyState) {
        let tempState = get(this._globalState);
        for (let key in stateUpdate) {
            tempState[key] = stateUpdate[key];
        }
        this.setState(tempState);
    }

    /**
     * Initializes core events: fetching state on readiness, listening for incoming state changes, 
     * and subscribing to the local Svelte store to broadcast outgoing changes.
     */
    private _initEvents() {
        this._console.onReady(() => {
            this.updateFromServer();
        });

        this._console.onStateChange((from, state, update) => {
            this._onReceiveState(from, state, update);
        });

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
                
                logger.log("change state NewState=", newState, "; update=", update, " currentState=", this._previousStateValue);
                this._previousStateValue = structuredClone(newState);
                
                this._console.onReady(() => {
                    let req = new Message();
                    req.setRequest("changeState");
                    req.addParam("state", this._forceState ? newState : update);
                    req.addParam("update", !this._forceState);
                    
                    this._forceState = false;
                    this._console.sendMessage(req);
                });
            }
        });
    }

    /**
     * Internal handler executed when a new state is received from the network.
     * Temporarily blocks local store subscriptions to prevent echo-broadcasting the received state.
     * @param from The origin peer of the state.
     * @param receivedState The state object payload.
     * @param update Flag indicating if the payload is a partial update (true) or a full overwrite (false).
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