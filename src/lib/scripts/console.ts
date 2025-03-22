import { KoppeliaWebsocket, type Callback } from './koppeliaWebsocket.js';
import { Message, type MessageData, PeerType, MessageType } from './message.js'
import type { AnyState } from './state.js';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { routeType } from '../stores/routeStore.js';

const PORT = 2225;

export type ChangeStateCallback = (from: string, state: AnyState, update:boolean) => void
export type ChangeStageCallback = (from: string, stage: string) => void
export type DataExchangeCallback = (from: string, data: any) => void
export type DeviceEventCallback = (device: string, from_addr: string, event: string) => void
export type DeviceDataCallback = (device: string, from_addr: string, event: string) => void
export type AnyRequestCallback = (request: string, params: { [key: string]: any }, from: string, address: string) => void


/**
 * This class define the koppelia console, send and receive requests
 */
export class Console {
    consoleHostname: string = "";
    consoleSocket: KoppeliaWebsocket;
    private _changeStateHandlers: ChangeStateCallback[];
    private _changeStageHandlers: ChangeStageCallback[];
    private _deviceEventHandlers: any[];
    private _deviceDataHandlers: any[];
    private _dataExchangeHandlers: any[];
    private _anyRequestHandlers: AnyRequestCallback[];
    private _ready: boolean = false;
    private _onReadyCallback: (() => void)[];


    constructor() {
        this.consoleHostname = "";
        if (!import.meta.env.SSR) {
           this.consoleHostname = window.location.hostname;
        }
        let consoleUrl = "ws://" + this.consoleHostname + ":" + PORT;
        this.consoleSocket = new KoppeliaWebsocket(consoleUrl);
        this._ready = false;

        this._changeStateHandlers = [];
        this._changeStageHandlers = [];
        this._deviceEventHandlers = [];
        this._deviceDataHandlers = [];
        this._dataExchangeHandlers = [];
        this._onReadyCallback = []
        this._anyRequestHandlers = []

        this._initEvents();
    }

    /**
     * Sdnd a message to the console, set header.to to dispatch the message
     * @param message 
     * @param callback the callback is called when websocket receives a response
     */
    sendMessage(message: Message, callback?: Callback) {
        let route = PeerType.NONE;
        if (get(routeType) == "monitor")
            route = PeerType.MONITOR
        else if (get(routeType) == "controller")
            route = PeerType.CONTROLLER;

        message.setSource(route, "")
        this.consoleSocket.send(message, callback)
    }

    /**
     * Identify the page (controller or monitor) to the console
     * @param peer 
     */
    identify(peer: PeerType) {
        let req = new Message()
        req.setIdentification(peer);
        this.consoleSocket.send(req);
    }

    getConnectedDevices() {

    }

    /**
     * Send data to a peer
     * @param receiver 
     * @param data 
     */
    sendDataTo(receiver: PeerType, data: MessageData) {
        let req = new Message();
        req.setData(data);
        req.setDestination(receiver);
    }

    /**
     * Add a callback that will be executed when receive a new state from console
     * @param callback 
     */
    onStateChange(callback: ChangeStateCallback) {
        this._changeStateHandlers.push(callback);
    }

    /**
     * Add a callback that will be executed when the current stage has changed
     * @param callback 
     */
    onStageChange(callback: ChangeStageCallback) {
        this._changeStageHandlers.push(callback)
    }

    /**
     * Add a callback that be called when console is ready, if thec onsole is already ready
     * Calls directly the function
     * @param callback 
     */
    onReady(callback: () => void) {
        if (!this._ready)
            this._onReadyCallback.push(callback);
        else
            callback();
    }

    onDeviceEvent(callback: DeviceEventCallback) {
        this._deviceEventHandlers.push(callback);
    }

    onRequest(callback: AnyRequestCallback) {
        this._anyRequestHandlers.push(callback);
    }

    /**
     * Get if the connection with the console is ready
     */
    public get ready(): boolean {
        return this._ready;
    }

    private _initEvents() {
        this.consoleSocket.onOpen(() => {
            this._ready = true;
            for (let callback of this._onReadyCallback) {
                callback();
            }
        });

        this.consoleSocket.onReceive((request: Message) => {
            this._processReceivedData(request);
        });
    }

    private _processReceivedData(request: Message) {
        console.log("Receive new data from console", request);
        if (request.header.type === undefined)
            return;

        let type = request.header.type;
        /* Handle specific requests */
        if (type == MessageType.REQUEST) {
            switch (request.request.exec) {
                case "changeState":
                    let update = request.getParam("update", false);
                    this._execChangeStateHandlers(request.header.from, request.request.params.state, update);
                    break;
                case "changeStage":
                    this._execChangeStageHandlers(request.header.from, request.request.params.stage);
                    break;
                default:
                    this._execAnyRequestHandlers(request.request.exec, request.request.params, request.header.from, request.header.from_addr);
                    break;
            }
        }

        /* Handle data exchange */
        else if (type == MessageType.DATA_EXCHANGE) {
            this._execDataExchangeHandlers(request.header.from, request.data);
        }

        /* Handle device event */
        else if (type == MessageType.DEVICE_EVENT) {
            this._execDeviceEventHandlers(request.header.device, request.header.from_addr, request.event);
        }

        /* Handle device data */
        else if (type == MessageType.DEVICE_DATA) {
            this._execDeviceDataHandlers(request.header.from_addr, request.data);
        }

    }

    private _execDeviceDataHandlers(from_addr: string, data: any) {
        for (let handler of this._deviceDataHandlers) {
            handler(from_addr, data);
        }
    }

    private _execDeviceEventHandlers(device: string, from_addr: string, event: string) {
        for (let handler of this._deviceEventHandlers) {
            handler(device, from_addr, event);
        }
    }

    private _execChangeStateHandlers(from: string, state: AnyState, update: boolean) {
        for (let handler of this._changeStateHandlers) {
            handler(from, state, update);
        }
    }

    private _execChangeStageHandlers(from: string, stage: string) {
        for (let handler of this._changeStageHandlers) {
            handler(from, stage);
        }
    }

    private _execDataExchangeHandlers(from: string, data: any) {
        for (let handler of this._dataExchangeHandlers) {
            handler(from, data);
        }
    }

    private _execAnyRequestHandlers(request: string, params: { [key: string]: any }, from: string, address: string) {
        for (let handler of this._anyRequestHandlers) {
            handler(request, params, from, address);
        }
    }

}