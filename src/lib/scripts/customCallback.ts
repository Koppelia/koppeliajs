import type { Console } from "./console.js";
import { logger } from "./logger.js";
import { Message, MessageType, PeerType } from "./message.js";

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
                data.custumCallbackName != undefined &&
                data.customCallbackArgs != undefined
            ) {
                
                if (
                    Object.hasOwn(
                        this._customCallbacks,
                        data.custumCallbackName,
                    )
                ) {
                    this._customCallbacks[data.custumCallbackName](
                        data.customCallbackArgs,
                    );
                }
            }
        });
    }

    public runCustomCallback(name: string, args: { [key: string]: any }) {
        let customCallbackRequest = new Message();
        customCallbackRequest.setType(MessageType.DATA_EXCHANGE);
        customCallbackRequest.addData("custumCallbackName", name);
        customCallbackRequest.addData("customCallbackArgs", args);
        customCallbackRequest.setDestination(PeerType.BROADCAST, "");
        this._console.sendMessage(customCallbackRequest);
    }

    public registerCustomCallback(
        name: string,
        callback: (args: { [key: string]: any }) => void,
    ) {
        this._customCallbacks[name] = callback;
    }

    public unregisterCustomCallback(name: string) {
        if (Object.hasOwn(this._customCallbacks, name)) {
            delete this._customCallbacks[name];
        }
    }
}
