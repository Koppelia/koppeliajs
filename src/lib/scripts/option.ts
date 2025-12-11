import { Console } from "./console.js";
import { Message, PeerType } from "./message.js";
import { get, type Writable, writable } from "svelte/store";

export type Options = { [key: string]: any };
export type OptionChangedCallback = (value: any) => void;

export class Option {
    private _options: Options;
    private _console: Console;
    private _callbacks: { [key: string]: OptionChangedCallback };

    constructor(console: Console) {
        this._options = {};
        this._console = console;
        this._callbacks = {};
        this._initEvents();
    }

    public get options(): Options {
        return this._options;
    }

    /**
     * Update the game options from the server
     */
    public async updateFromServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            let req = new Message();
            req.setRequest("getGameOptions");
            this._console.sendMessage(req, (response: Message) => {
                let options = response.getParam("gameOptions", {});
                for (const optionName in options) {
                    this._onReceiveState(
                        response.header.from,
                        optionName,
                        options[optionName],
                    );
                }

                resolve();
            });
        });
    }

    /**
     * Set a new or edit a game option
     * @param name Name fo the option
     * @param value Value of the option
     */
    public setOption(
        name: string,
        value: any,
        type: string | null = null,
        config: { [key: string]: any } = {},
    ) {
        let setOptionRequest = new Message();
        setOptionRequest.setRequest("setGameOption");
        setOptionRequest.setDestination(PeerType.MASTER, "");
        setOptionRequest.addParam("name", name);
        setOptionRequest.addParam("value", value);
        setOptionRequest.addParam("type", type);
        setOptionRequest.addParam("config", config);
        this._console.sendMessage(setOptionRequest);

        // this._options[name] = value;
    }

    /**
     * Set a callback when an option has changed
     * @param name
     * @param callback
     */
    public onOptionChanged(name: string, callback: OptionChangedCallback) {
        this._callbacks[name] = callback;
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
        this._console.onRequest((request, params, from) => {
            if (request == "gameOptionNotification") {
                let value: { [key: string]: any } = {};
                let name = "";
                if (Object.hasOwn(params, "value")) {
                    value = params["value"];
                }
                if (Object.hasOwn(params, "name")) {
                    name = params["name"];
                }
                this._onReceiveState(from, name, value, true);
            }
        });
    }

    /**
     * callback when a new option is received
     */
    private _onReceiveState(
        from: string,
        receivedOption: string,
        valueOption: { [key: string]: any },
        runCallbacks = false,
    ) {
        this._options[receivedOption] = valueOption["value"];
        if (runCallbacks) {
            for (const callKey in this._callbacks) {
                if (callKey == receivedOption) {
                    this._callbacks[callKey](valueOption);
                }
            }
        }
    }
}
