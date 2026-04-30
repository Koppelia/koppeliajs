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
 * This class defines the Koppelia console to send and receive requests.
 */
export class Console {
    consoleHostname: string = "";
    consoleSocket: KoppeliaWebsocket;

    // Event handlers stored as dictionaries (Record) for ID-based subscription management
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

        // Initialize dictionaries
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
     * Generates a unique random ID for callback registration.
     */
    private _generateId(): string {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    /**
     * Unsubscribes a previously registered callback using its ID.
     * @param id The identifier returned by the "on..." functions.
     * @returns true if the ID was found and deleted, false otherwise.
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
     * Sends a message to the console. Set header.to to dispatch the message.
     * @param message The message to send.
     * @param callback The callback triggered when the websocket receives a response.
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
     * Identifies the page (controller or monitor) to the console.
     * @param peer The peer type to identify as.
     */
    identify(peer: PeerType) {
        let req = new Message();
        req.setIdentification(peer);
        this.consoleSocket.send(req);
    }

    getConnectedDevices() {
    }

    /**
     * Sends data to a specific peer.
     * @param receiver The peer type receiving the data.
     * @param data The data payload.
     */
    sendDataTo(receiver: PeerType, data: MessageData) {
        let req = new Message();
        req.setData(data);
        req.setDestination(receiver);
    }

    /**
     * Adds a callback to be executed when a new state is received from the console.
     * @param callback Function to execute on state change.
     * @returns The subscription ID.
     */
    onStateChange(callback: ChangeStateCallback): string {
        const id = this._generateId();
        this._changeStateHandlers[id] = callback;
        return id;
    }

    /**
     * Adds a callback to be executed when the current stage changes.
     * @param callback Function to execute on stage change.
     * @returns The subscription ID.
     */
    onStageChange(callback: ChangeStageCallback): string {
        const id = this._generateId();
        this._changeStageHandlers[id] = callback;
        return id;
    }

    /**
     * Adds a callback to be executed when the console is ready.
     * If the console is already ready, the function is called immediately.
     * @param callback Function to execute.
     * @returns The subscription ID.
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
     * Adds a callback to listen for device events.
     * @param callback Function to execute on device event.
     * @returns The subscription ID.
     */
    onDeviceEvent(callback: DeviceEventCallback): string {
        const id = this._generateId();
        this._deviceEventHandlers[id] = callback;
        return id;
    }

    /**
     * Adds a callback to listen for data exchanges.
     * @param callback Function to execute on data exchange.
     * @returns The subscription ID.
     */
    onDataExchange(callback: DataExchangeCallback): string {
        const id = this._generateId();
        this._dataExchangeHandlers[id] = callback;
        return id;
    }

    /**
     * Adds a callback to listen for generic requests.
     * @param callback Function to execute on request.
     * @returns The subscription ID.
     */
    onRequest(callback: AnyRequestCallback): string {
        const id = this._generateId();
        this._anyRequestHandlers[id] = callback;
        return id;
    }

    /**
     * Gets the current readiness state of the console connection.
     */
    public get ready(): boolean {
        return this._ready;
    }

    public getMediaUrl(path: string): string {
        if (!path.startsWith("/")) path = "/" + path;
        return this._mediaApiUrl + path;
    }

    /**
     * Normalizes the media URL to ensure it works for both the controller and the monitor.
     * Sometimes, a link retrieved from one client is saved as a game state, but fails
     * when accessed by the other client. Wrapping all media URLs with this function is best practice.
     * @param mediaUrl The original media URL.
     * @returns The corrected URL string.
     */
    public fixMediaUrl(mediaUrl: string): string {
        let url = new URL(mediaUrl);
        let fixedurl = new URL(this._mediaApiUrl);
        fixedurl.pathname = url.pathname;
        fixedurl.search = url.search;
        return fixedurl.toString();
    }

    public async getMedia(path: string): Promise<MediaResponseData> {
        const response = await fetch(this.getMediaUrl(path));

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("Content-Type") || "";

        if (contentType.includes("application/json")) {
            return await response.json(); // Returns an Object
        } else if (contentType.startsWith("text/")) {
            return await response.text(); // Returns a String
        } else if (
            contentType.startsWith("image/") ||
            contentType.includes("application/octet-stream")
        ) {
            return await response.blob(); // Returns a Blob (images, downloads, etc.)
        } else {
            return await response.arrayBuffer(); // Returns a Generic binary buffer
        }
    }

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

    private _processReceivedData(request: Message) {
        logger.log("Received new data from console", request);
        if (request.header.type === undefined) {
            return;
        }

        let type = request.header.type;

        /* Handle specific requests */
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
        } /* Handle data exchange */
        else if (type == MessageType.DATA_EXCHANGE) {
            this._execDataExchangeHandlers(request.header.from, request.data);
        } /* Handle device event */
        else if (type == MessageType.DEVICE_EVENT) {
            this._execDeviceEventHandlers(
                request.header.device,
                request.header.from_addr,
                request.event,
            );
        } /* Handle device data */
        else if (type == MessageType.DEVICE_DATA) {
            this._execDeviceDataHandlers(
                request.header.from_addr,
                request.data,
            );
        }
    }

    // Handler execution methods iterating over dictionary values
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
     * Clears all registered event handlers.
     */
    public destroyEvents() {
        // Reset dictionaries to empty objects
        this._deviceEventHandlers = {};
        this._deviceDataHandlers = {};
        this._anyRequestHandlers = {};

        logger.log("Destroyed event handlers");
    }
}