import { Console } from "./console.js";
import { Message, PeerType } from "./message.js";
import { get, type Writable, writable } from "svelte/store";

export type Options = { [key: string]: any };
export type OptionChangedCallback = (value: any) => void;

/**
 * Manages game configuration options, allowing retrieval from the server and local modifications.
 */
export class Option {
    private _options: Options;
    private _console: Console;
    private _callbacks: { [key: string]: OptionChangedCallback };

    /**
     * Initializes the game options manager.
     * @param console The Console instance used for network communication.
     */
    constructor(console: Console) {
        this._options = {};
        this._console = console;
        this._callbacks = {};
        this._initEvents();
    }

    /**
     * Retrieves the current dictionary of options.
     */
    public get options(): Options {
        return this._options;
    }

    /**
     * Fetches all current game options from the server and populates the local cache.
     * @returns A promise that resolves when the options have been successfully received and processed.
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
     * Requests the master peer to create or update a game option.
     * @param name The unique identifier of the option.
     * @param value The value to assign to the option.
     * @param type Optional type definition for the option (e.g., string, number).
     * @param config Optional additional configuration metadata for the option.
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
    }

    /**
     * Registers a callback to be executed whenever a specific option is updated.
     * @param name The name of the option to observe.
     * @param callback The function to trigger upon modification.
     */
    public onOptionChanged(name: string, callback: OptionChangedCallback) {
        this._callbacks[name] = callback;
    }

    /**
     * Initializes core events: fetching options on readiness and listening for option change notifications.
     */
    private _initEvents() {
        this._console.onReady(() => {
            this.updateFromServer();
        });

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
     * Internal handler to process incoming options from the server and trigger associated callbacks.
     * @param from The origin peer sending the option.
     * @param receivedOption The name/key of the option received.
     * @param valueOption The payload containing the option's new value.
     * @param runCallbacks If true, executes any registered callbacks for this option.
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
