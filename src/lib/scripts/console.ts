import { type Callback, KoppeliaWebsocket } from "./koppeliaWebsocket.js";
import { Message, type MessageData, MessageType, PeerType } from "./message.js";
import type { AnyState } from "./state.js";
import { page } from "$app/stores";
import { get } from "svelte/store";
import { routeType } from "../stores/routeStore.js";
import { logger } from "./logger.js";

const PORT = 2225;
const API_PORT = 8000;

export type ChangeStateCallback = (
    from: string,
    state: AnyState,
    update: boolean,
) => void;
export type ChangeStageCallback = (from: string, stage: string) => void;
export type DataExchangeCallback = (from: string, data: any) => void;
export type DeviceEventCallback = (
    device: string,
    from_addr: string,
    event: string,
) => void;
export type DeviceDataCallback = (
    device: string,
    from_addr: string,
    event: string,
) => void;
export type AnyRequestCallback = (
    request: string,
    params: { [key: string]: any },
    from: string,
    address: string,
) => void;

export type MediaResponseData = string | Blob | ArrayBuffer | any;

/**
 * Handles the Koppelia console connection, facilitating the sending and receiving of requests
 * and managing event subscriptions for state changes, device data, and custom logic.
 */
export class Console {
    consoleHostname: string = "";
    consoleSocket: KoppeliaWebsocket;

    private _changeStateHandlers: Record<string, ChangeStateCallback>;
    private _changeStageHandlers: Record<string, ChangeStageCallback>;
    private _deviceEventHandlers: Record<string, any>;
    private _deviceDataHandlers: Record<string, any>;
    private _dataExchangeHandlers: Record<string, any>;
    private _anyRequestHandlers: Record<string, AnyRequestCallback>;
    private _onReadyCallback: Record<string, () => void>;

    private _ready: boolean = false;
    private _mediaApiUrl: string;

    constructor() {
        this.consoleHostname = "";
        if (!import.meta.env.SSR) {
            this.consoleHostname = window.location.hostname;
        }
        let consoleUrl = "ws://" + this.consoleHostname + ":" + PORT;
        this.consoleSocket = new KoppeliaWebsocket(consoleUrl);
        this._mediaApiUrl = "http://" + this.consoleHostname + ":" + API_PORT;
        this._ready = false;

        this._changeStateHandlers = {};
        this._changeStageHandlers = {};
        this._deviceEventHandlers = {};
        this._deviceDataHandlers = {};
        this._dataExchangeHandlers = {};
        this._onReadyCallback = {};
        this._anyRequestHandlers = {};

        this._initEvents();
    }

    /**
     * Generates a unique random ID used for registering and tracking callbacks.
     * @returns A randomly generated string ID.
     */
    private _generateId(): string {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    /**
     * Unsubscribes a previously registered callback using its unique ID.
     * @param id The subscription identifier returned by any "on..." listener function.
     * @returns True if the ID was found and successfully removed, false otherwise.
     */
    unsubscribeCallback(id: string): boolean {
        let deleted = false;
        if (id in this._changeStateHandlers) {
            delete this._changeStateHandlers[id];
            deleted = true;
        }
        if (id in this._changeStageHandlers) {
            delete this._changeStageHandlers[id];
            deleted = true;
        }
        if (id in this._deviceEventHandlers) {
            delete this._deviceEventHandlers[id];
            deleted = true;
        }
        if (id in this._deviceDataHandlers) {
            delete this._deviceDataHandlers[id];
            deleted = true;
        }
        if (id in this._dataExchangeHandlers) {
            delete this._dataExchangeHandlers[id];
            deleted = true;
        }
        if (id in this._anyRequestHandlers) {
            delete this._anyRequestHandlers[id];
            deleted = true;
        }
        if (id in this._onReadyCallback) {
            delete this._onReadyCallback[id];
            deleted = true;
        }
        return deleted;
    }

    /**
     * Dispatches a message through the console socket. 
     * The routing source is automatically appended based on the current application state.
     * @param message The message payload to send.
     * @param callback Optional callback triggered when the WebSocket receives a specific response.
     */
    sendMessage(message: Message, callback?: Callback) {
        let route = PeerType.NONE;
        if (get(routeType) == "monitor") {
            route = PeerType.MONITOR;
        } else if (get(routeType) == "controller") {
            route = PeerType.CONTROLLER;
        }

        message.setSource(route, "");
        this.consoleSocket.send(message, callback);
    }

    /**
     * Identifies the current client application (controller or monitor) to the console.
     * @param peer The peer type to identify as.
     */
    identify(peer: PeerType) {
        let req = new Message();
        req.setIdentification(peer);
        this.consoleSocket.send(req);
    }

    /**
     * Retrieves the list of connected devices.
     * @todo Implementation pending.
     */
    getConnectedDevices() {
    }

    /**
     * Transmits data payload directly to a specific peer type.
     * @param receiver The target peer intended to receive the data.
     * @param data The data payload to transmit.
     */
    sendDataTo(receiver: PeerType, data: MessageData) {
        let req = new Message();
        req.setData(data);
        req.setDestination(receiver);
    }

    /**
     * Registers a callback to execute whenever a new state is received from the console.
     * @param callback The function to execute on state change.
     * @returns The unique subscription ID used for unsubscribing.
     */
    onStateChange(callback: ChangeStateCallback): string {
        const id = this._generateId();
        this._changeStateHandlers[id] = callback;
        return id;
    }

    /**
     * Registers a callback to execute whenever the current application stage changes.
     * @param callback The function to execute on stage change.
     * @returns The unique subscription ID used for unsubscribing.
     */
    onStageChange(callback: ChangeStageCallback): string {
        const id = this._generateId();
        this._changeStageHandlers[id] = callback;
        return id;
    }

    /**
     * Registers a callback to execute when the console connection is fully established and ready.
     * If the console is already ready at the time of calling, the callback is executed immediately.
     * @param callback The function to execute upon readiness.
     * @returns The unique subscription ID used for unsubscribing.
     */
    onReady(callback: () => void): string {
        const id = this._generateId();
        if (!this._ready) {
            this._onReadyCallback[id] = callback;
        } else {
            callback();
        }
        return id;
    }

    /**
     * Registers a callback to listen for specific device events.
     * @param callback The function to execute when a device event occurs.
     * @returns The unique subscription ID used for unsubscribing.
     */
    onDeviceEvent(callback: DeviceEventCallback): string {
        const id = this._generateId();
        this._deviceEventHandlers[id] = callback;
        return id;
    }

    /**
     * Registers a callback to listen for raw data exchanges between peers.
     * @param callback The function to execute upon receiving exchanged data.
     * @returns The unique subscription ID used for unsubscribing.
     */
    onDataExchange(callback: DataExchangeCallback): string {
        const id = this._generateId();
        this._dataExchangeHandlers[id] = callback;
        return id;
    }

    /**
     * Registers a generic callback to intercept and handle custom or unrecognized requests.
     * @param callback The function to execute for generic requests.
     * @returns The unique subscription ID used for unsubscribing.
     */
    onRequest(callback: AnyRequestCallback): string {
        const id = this._generateId();
        this._anyRequestHandlers[id] = callback;
        return id;
    }

    /**
     * Gets the current readiness state of the console WebSocket connection.
     */
    public get ready(): boolean {
        return this._ready;
    }

    /**
     * Constructs the full URL for a media asset based on the API port and hostname.
     * @param path The relative path to the media asset.
     * @returns The fully qualified URL string.
     */
    public getMediaUrl(path: string): string {
        if (!path.startsWith("/")) path = "/" + path;
        return this._mediaApiUrl + path;
    }

    /**
     * Normalizes a media URL to ensure cross-client compatibility.
     * Corrects edge cases where media links cached in game states by one client (e.g., controller)
     * fail when accessed by another (e.g., monitor).
     * @param mediaUrl The raw URL string to fix.
     * @returns The corrected and standardized URL string.
     */
    public fixMediaUrl(mediaUrl: string): string {
        let url = new URL(mediaUrl);
        let fixedurl = new URL(this._mediaApiUrl);
        fixedurl.pathname = url.pathname;
        fixedurl.search = url.search;
        return fixedurl.toString();
    }

    /**
     * Fetches a media asset from the API and automatically parses it based on its Content-Type.
     * @param path The relative path to the media asset.
     * @returns A promise resolving to the parsed data (JSON, Text, Blob, or ArrayBuffer).
     * @throws Will throw an error if the HTTP request fails.
     */
    public async getMedia(path: string): Promise<MediaResponseData> {
        const response = await fetch(this.getMediaUrl(path));

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("Content-Type") || "";

        if (contentType.includes("application/json")) {
            return await response.json(); 
        } else if (contentType.startsWith("text/")) {
            return await response.text(); 
        } else if (
            contentType.startsWith("image/") ||
            contentType.includes("application/octet-stream")
        ) {
            return await response.blob(); 
        } else {
            return await response.arrayBuffer(); 
        }
    }

    /**
     * Initializes core WebSocket event listeners and maps them to the internal handlers.
     */
    private _initEvents() {
        this.consoleSocket.onOpen(() => {
            this._ready = true;
            for (let callback of Object.values(this._onReadyCallback)) {
                callback();
            }
        });

        this.consoleSocket.onReceive((request: Message) => {
            this._processReceivedData(request);
        });
    }

    /**
     * Core router for incoming WebSocket data. Decodes the message type and 
     * dispatches it to the corresponding internal execution loops.
     * @param request The parsed Message object received from the socket.
     */
    private _processReceivedData(request: Message) {
        logger.log("Received new data from console", request);
        if (request.header.type === undefined) {
            return;
        }

        let type = request.header.type;

        if (type == MessageType.REQUEST) {
            switch (request.request.exec) {
                case "changeState":
                    let update = request.getParam("update", false);
                    this._execChangeStateHandlers(
                        request.header.from,
                        request.request.params.state,
                        update,
                    );
                    break;
                case "changeStage":
                    this._execChangeStageHandlers(
                        request.header.from,
                        request.request.params.stage,
                    );
                    break;
                default:
                    this._execAnyRequestHandlers(
                        request.request.exec,
                        request.request.params,
                        request.header.from,
                        request.header.from_addr,
                    );
                    break;
            }
        } 
        else if (type == MessageType.DATA_EXCHANGE) {
            this._execDataExchangeHandlers(request.header.from, request.data);
        } 
        else if (type == MessageType.DEVICE_EVENT) {
            this._execDeviceEventHandlers(
                request.header.device,
                request.header.from_addr,
                request.event,
            );
        } 
        else if (type == MessageType.DEVICE_DATA) {
            this._execDeviceDataHandlers(
                request.header.from_addr,
                request.data,
            );
        }
    }

    // --- Dictionary execution methods below ---

    private _execDeviceDataHandlers(from_addr: string, data: any) {
        for (let handler of Object.values(this._deviceDataHandlers)) {
            handler(from_addr, data);
        }
    }

    private _execDeviceEventHandlers(
        device: string,
        from_addr: string,
        event: string,
    ) {
        for (let handler of Object.values(this._deviceEventHandlers)) {
            handler(device, from_addr, event);
        }
    }

    private _execChangeStateHandlers(
        from: string,
        state: AnyState,
        update: boolean,
    ) {
        for (let handler of Object.values(this._changeStateHandlers)) {
            handler(from, state, update);
        }
    }

    private _execChangeStageHandlers(from: string, stage: string) {
        for (let handler of Object.values(this._changeStageHandlers)) {
            handler(from, stage);
        }
    }

    private _execDataExchangeHandlers(from: string, data: any) {
        for (let handler of Object.values(this._dataExchangeHandlers)) {
            handler(from, data);
        }
    }

    private _execAnyRequestHandlers(
        request: string,
        params: { [key: string]: any },
        from: string,
        address: string,
    ) {
        for (let handler of Object.values(this._anyRequestHandlers)) {
            handler(request, params, from, address);
        }
    }

    /**
     * Hard-resets the application by clearing all registered event handlers.
     */
    public destroyEvents() {
        this._deviceEventHandlers = {};
        this._deviceDataHandlers = {};
        this._anyRequestHandlers = {};

        logger.log("Destroyed event handlers");
    }
}