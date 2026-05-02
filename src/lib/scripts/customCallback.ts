import type { Console } from "./console.js";
import { logger } from "./logger.js";
import { Message, MessageType, PeerType } from "./message.js";

/**
 * Manages the registration and network-wide execution of custom callbacks.
 * Allows different nodes in the system to broadcast and react to custom function calls.
 */
export class CustomCallbacks {
    private _console: Console;
    private _customCallbacks: {
        [key: string]: (args: { [key: string]: any }) => void;
    };

    constructor(console: Console) {
        this._console = console;
        this._console.onReady(() => {
        });
        this._customCallbacks = {};

        this._console.onDataExchange((from: string, data: any) => {
            if (
                data.customCallbackName != undefined &&
                data.customCallbackArgs != undefined
            ) {
                if (
                    Object.hasOwn(
                        this._customCallbacks,
                        data.customCallbackName,
                    )
                ) {
                    this._customCallbacks[data.customCallbackName](
                        data.customCallbackArgs,
                    );
                }
            }
        });
    }

    /**
     * Broadcasts a request across the network to execute a registered custom callback.
     * @param name The registered name of the custom callback to trigger.
     * @param args A dictionary of arguments to pass to the callback function.
     */
    public runCustomCallback(name: string, args: { [key: string]: any }) {
        let customCallbackRequest = new Message();
        customCallbackRequest.setType(MessageType.DATA_EXCHANGE);
        customCallbackRequest.addData("customCallbackName", name);
        customCallbackRequest.addData("customCallbackArgs", args);
        customCallbackRequest.setDestination(PeerType.BROADCAST, "");
        this._console.sendMessage(customCallbackRequest);
    }

    /**
     * Registers a local function to be executed when a specific custom callback request is received.
     * @param name The identifier name for this callback.
     * @param callback The function to execute when triggered by the network.
     */
    public registerCustomCallback(
        name: string,
        callback: (args: { [key: string]: any }) => void,
    ) {
        this._customCallbacks[name] = callback;
    }

    /**
     * Removes a previously registered custom callback from the local listener registry.
     * @param name The identifier name of the callback to remove.
     */
    public unregisterCustomCallback(name: string) {
        if (Object.hasOwn(this._customCallbacks, name)) {
            delete this._customCallbacks[name];
        }
    }
}
