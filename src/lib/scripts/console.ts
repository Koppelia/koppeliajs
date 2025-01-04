import { KoppeliaWebsocket, type Callback } from './koppeliaWebsocket.js';
import { Request, type RequestData, PeerType, RequestType } from './request.js'
import type { AnyState } from './state.js';
import { page } from '$app/stores';
import { get } from 'svelte/store';

const PORT = 2225;

export type ChangeStateCallback = (from: string, state: AnyState) => void
export type DataExchangeCallback = (from: string, data: any) => void
export type DeviceEventCallback = (device: string, from_addr: string, event: string) => void
export type DeviceDataCallback = (device: string, from_addr: string, event: string) => void


/**
 * This class define the koppelia console, send and receive requests
 */
export class Console {
    consoleHostname: string = "";
    consoleSocket: KoppeliaWebsocket;
    private _changeStateHandlers: any[];
    private _deviceEventHandlers: any[];
    private _deviceDataHandlers: any[];
    private _dataExchangeHandlers: any[];
    private _ready: boolean = false;
    private _onReadyCallback: (() => void)[];


    constructor() {
        this.consoleHostname = get(page).url.hostname;
        let consoleUrl = "ws://" + this.consoleHostname + ":" + PORT;
        this.consoleSocket = new KoppeliaWebsocket(consoleUrl);
        this._ready = false;

        this._changeStateHandlers = [];
        this._deviceEventHandlers = [];
        this._deviceDataHandlers = [];
        this._dataExchangeHandlers = [];
        this._onReadyCallback = []

        this._initEvents();
    }

    /**
     * Sdnd a message to the console, set header.to to dispatch the message
     * @param request 
     * @param callback the callback is called when websocket receives a response
     */
    sendRequest(request: Request, callback?: Callback) {
        this.consoleSocket.send(request, callback)
    }

    /**
     * Identify the page (controller or monitor) to the console
     * @param peer 
     */
    identify(peer: PeerType) {
        let req = new Request()
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
    sendDataTo(receiver: PeerType, data: RequestData) {
        let req = new Request();
        req.setData(data);
        req.setDestination(receiver);
    }

    onStateChange(callback: ChangeStateCallback) {
        this._changeStateHandlers.push(callback);
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

    /**
     * Get if the connection with the console is ready
     */
    public get ready(): boolean {
        return this._ready;
    }

    private _initEvents() {
        this.consoleSocket.onOpen(() => {
            this._ready = true;
            for(let callback of this._onReadyCallback) {
                callback();
            }
        });

        this.consoleSocket.onReceive((data) => {
            this._processReceivedData(data);
        });
    }

    private _processReceivedData(data: any) {
        console.log("Receive new data from console", data);
        let res = new Request();
        res.parse(data);
        if(res.header.type === undefined)
            return;
        
        let type = res.header.type;
        /* Handle specific requests */
        if(type == RequestType.REQUEST) {
            switch(res.request.exec) {
                case "changeState":
                    this._execChangeStateHandlers(res.header.from, res.request.params.state)
                    break;
            }
        }

        /* Handle data exchange */
        else if (type == RequestType.DATA_EXCHANGE) {
           this._execDataExchangeHandlers(data.header.from, data.data);
        } 
        
        /* Handle device event */
        else if (type == RequestType.DEVICE_EVENT) {
           this._execDeviceEventHandlers(data.header.device, data.header.from_addr, data.event);
        } 
        
        /* Handle device data */
        else if (type == RequestType.DEVICE_DATA) {
           this._execDeviceDataHandlers(data.header.from_addr, data.data);
        }

    }

    private _execDeviceDataHandlers (from_addr: string, data: any) {
        for(let handler of this._deviceDataHandlers) {
            handler(from_addr, data);
        }
    }

    private _execDeviceEventHandlers (device: string, from_addr: string, event: string) {
        for(let handler of this._deviceEventHandlers) {
            handler(device, from_addr, event);
        }
    }

    private _execChangeStateHandlers (from: string, state: AnyState) {
        for(let handler of this._changeStateHandlers) {
            handler(from, state);
        }
    }

    private _execDataExchangeHandlers (from: string, data: any) {
        for(let handler of this._dataExchangeHandlers) {
            handler(from, data);
        }
    }

}