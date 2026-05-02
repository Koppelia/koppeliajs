import { logger } from "./logger.js";
import { Message, type AnyRequest } from "./message.js";

export type Callback = (response: Message) => void

type OnGoingRequest = {
    requestId: string,
    callback?: Callback
};

const DEFAULT_WS_TIMEOUT = 20000;

export class KoppeliaWebsocket {
    socket?: WebSocket = undefined;
    onGoingRequests: OnGoingRequest[];
    timeout: number
    receiveCallbacks: Callback[]
    websocketUrl: string = "";
    openCallback?: () => void;

    /* ------ PUBLIC ------ */

    /**
     * Initializes the Koppelia WebSocket client.
     * @param websocketUrl The URL of the WebSocket server to connect to.
     * @param timeout The maximum time in milliseconds to wait for a response before timing out a request. Defaults to 20000ms.
     */
    public constructor(websocketUrl: string, timeout: number = DEFAULT_WS_TIMEOUT) {
        if (!import.meta.env.SSR) {
            this._connectWebsocket(websocketUrl);
            logger.log("Open new Koppelia websocket connection successfully with url ", websocketUrl);
            this._setupEvents();
        }
        else logger.log("Koppelia websocket not accessible during server rendering");

        this.onGoingRequests = [];
        this.timeout = timeout;
        this.receiveCallbacks = [];
        this.websocketUrl = websocketUrl;
    }

    /**
     * Sends a new message request through the WebSocket.
     * Automatically generates a request ID, registers the request as ongoing, and sets a timeout.
     * @param data The message payload to send.
     * @param callback Optional callback to be executed when a response to this specific request is received.
     */
    public send(data: Message, callback?: Callback) {
        if (this.socket === undefined) {
            logger.log("KoppeliaWebsocket::send(): Koppelia websocket client was not instantiated")
            return;
        }
        
        data.generateRequestId();
        this._addNewRequest(data.getRequestId(), callback);
        
        const serializedMessage = JSON.stringify(data.toObject());
        logger.log("sending message", serializedMessage);
        this.socket.send(serializedMessage);
        
        window.setTimeout(() => this._deleteRequest(data.getRequestId()), this.timeout);;
    }

    /**
     * Registers a global callback to be triggered whenever a message is received.
     * @param callback The function to execute upon receiving a message.
     */
    public onReceive(callback: Callback) {
        this.receiveCallbacks.push(callback);
    }

    /**
     * Registers a callback to be triggered when the WebSocket connection successfully opens.
     * @param callback The function to execute upon connection.
     */
    public onOpen(callback: () => void) {
        this.openCallback = callback;
    }

    /* ------ PRIVATE ------ */

    /**
     * Establishes the WebSocket connection.
     * @param websockerUrl The URL of the WebSocket server.
     */
    private _connectWebsocket(websockerUrl: string): void {
        this.socket = new WebSocket(websockerUrl);
    }

    /**
     * Handles incoming WebSocket responses.
     * Checks if the message corresponds to an ongoing request. If so, triggers its specific callback.
     * Otherwise, broadcasts the message to all global receive callbacks.
     * @param data The raw data payload received from the WebSocket.
     */
    private _handleWebsocketResponse(data: any): void {
        if (data === undefined) {
            return
        }
        
        let message = new Message()
        message.parse(data)
        
        if (message.getRequestId() !== undefined) {
            let onGoing = this._getOnGoingRequest(message.getRequestId());
            if (onGoing) {
                if (onGoing.callback)
                    onGoing.callback!(message);
                
                this._deleteRequest(message.getRequestId());
                return
            }
        }

        for (let callback of this.receiveCallbacks) {
            callback!(message);
        }
    }

    /**
     * Initializes all WebSocket event listeners (open, message, close).
     * Handles automatic reconnection on connection close or error.
     */
    private _setupEvents(): void {
        if (this.socket === undefined) {
            logger.log("KoppeliaWebsocket::_setupEvents(): Koppelia websocket client was not instantiated")
            return;
        }

        this.socket.addEventListener('open', (e) => {
            if (this.openCallback)
                this.openCallback();
        });

        this.socket.addEventListener('message', (e: MessageEvent) => {
            let data = JSON.parse(e.data);
            this._handleWebsocketResponse(data);
        });

        this.socket.onclose = (event: CloseEvent) => {
            logger.log(`Connection closed ${event.reason}, code=${event.code}, retry connection ...`)
            setTimeout(() => { this._connectWebsocket(this.websocketUrl); this._setupEvents(); }, 1000);
        };
    }

    /**
     * Retrieves the index of an ongoing request in the internal list.
     * @param requestId The unique identifier of the request.
     * @returns The array index of the request, or -1 if not found.
     */
    private _getRequestIndex(requestId: string): number {
        return this.onGoingRequests.findIndex((element) => {
            if (!element) {
                return false; 
            }
            return element.requestId === requestId;
        });
    }

    /**
     * Removes a request from the ongoing requests list.
     * Used both when a request is successfully resolved or when it times out.
     * @param requestId The unique identifier of the request to remove.
     */
    private _deleteRequest(requestId: string): void {
        this.onGoingRequests = this.onGoingRequests.filter((element: OnGoingRequest) => element.requestId !== requestId);
    }

    /**
     * Retrieves an ongoing request object by its ID.
     * @param requestId The unique identifier of the request.
     * @returns The ongoing request object, or undefined if not found.
     */
    private _getOnGoingRequest(requestId: string): OnGoingRequest | undefined {
        let requestIndex = this._getRequestIndex(requestId);
        if (requestIndex < 0)
            return undefined
        return this.onGoingRequests[requestIndex];
    }

    /**
     * Registers a new request in the ongoing requests list.
     * @param requestId The unique identifier generated for the request.
     * @param callback Optional callback to trigger when the response arrives.
     */
    private _addNewRequest(requestId: string, callback?: Callback) {
        this.onGoingRequests.push({ requestId: requestId, callback: callback });
    }
}