import type { Console } from "./console.js";
import { logger } from "./logger.js";
import { Message, MessageType, PeerType } from "./message.js";

/**
 * Manages the registration and network-wide execution of custom callbacks.
 * Supports multiple listeners for the same callback name.
 */
export class CustomCallbacks {
    private _console: Console;
    
    /**
     * Internal storage for callbacks.
     * _registry: Map<uniqueId, { name: string, func: Function }>
     */
    private _registry: Map<string, { name: string, func: (args: { [key: string]: any }) => void }>;
    
    /**
     * Quick lookup to find all unique IDs associated with a specific callback name.
     * _nameToIds: Map<callbackName, Set<uniqueId>>
     */
    private _nameToIds: Map<string, Set<string>>;

    constructor(console: Console) {
        this._console = console;
        this._registry = new Map();
        this._nameToIds = new Map();

        this._console.onDataExchange((from: string, data: any) => {
            if (
                data.customCallbackName != undefined &&
                data.customCallbackArgs != undefined
            ) {
                this._executeLocalCallbacks(data.customCallbackName, data.customCallbackArgs);
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
     * @returns A unique ID for this specific registration.
     */
    public registerCustomCallback(
        name: string,
        callback: (args: { [key: string]: any }) => void,
    ): string {
        const id = Math.random().toString(36).substring(2, 15);
        
        // Register the function in the main registry
        this._registry.set(id, { name, func: callback });

        // Add the ID to the name-based lookup table
        if (!this._nameToIds.has(name)) {
            this._nameToIds.set(name, new Set());
        }
        this._nameToIds.get(name)!.add(id);

        return id;
    }

    /**
     * Removes all listeners registered under a specific callback name.
     * @param name The identifier name of the callbacks to remove.
     */
    public unregisterCustomCallback(name: string) {
        const ids = this._nameToIds.get(name);
        if (ids) {
            for (const id of ids) {
                this._registry.delete(id);
            }
            this._nameToIds.delete(name);
        }
    }

    /**
     * Removes a specific listener using its unique registration ID.
     * @param id The unique identifier returned by registerCustomCallback.
     * @returns True if the callback was found and removed, false otherwise.
     */
    public unregisterById(id: string): boolean {
        const entry = this._registry.get(id);
        if (entry) {
            const { name } = entry;
            
            // Remove from the main registry
            this._registry.delete(id);
            
            // Remove from the name-based lookup table
            const ids = this._nameToIds.get(name);
            if (ids) {
                ids.delete(id);
                if (ids.size === 0) {
                    this._nameToIds.delete(name);
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Internal method to trigger all local functions associated with a callback name.
     * @param name The callback name received from the network.
     * @param args The arguments received from the network.
     */
    private _executeLocalCallbacks(name: string, args: { [key: string]: any }) {
        const ids = this._nameToIds.get(name);
        if (ids) {
            for (const id of ids) {
                const entry = this._registry.get(id);
                if (entry) {
                    try {
                        entry.func(args);
                    } catch (error) {
                        logger.log(`Error executing custom callback "${name}" (ID: ${id}):`, error);
                    }
                }
            }
        }
    }
}