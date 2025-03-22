import { Message, type AnyRequest } from "./message.js";

export type Callback = (response: Message) => void

type OnGoingRequest = {
    requestId: string,
    callback?: Callback
};

const DEFAULT_WS_TIMEOUT = 4000;


export class KoppeliaWebsocket {
    socket?: WebSocket = undefined;
    onGoingRequests: OnGoingRequest[];
    timeout: number
    receiveCallbacks: Callback[]
    websocketUrl: string = "";
    openCallback?: () => void;

    /* ------ PUBLIC ------ */

    /**
     * Constructor of the Koppelia websocket class
     * @param websocketUrl 
     * @param timeout 
     */
    public constructor(websocketUrl: string, timeout: number = DEFAULT_WS_TIMEOUT) {
        if (!import.meta.env.SSR) {
            this._connectWebsocket(websocketUrl);
            console.log("Open new Koppelia websocket connection successfully with url ", websocketUrl);
            this._setupEvents();
        }

        else console.log("Koppelia websocket not accessible during server rendering");

        this.onGoingRequests = [];
        this.timeout = timeout;
        this.receiveCallbacks = [];
        this.websocketUrl = websocketUrl;

    }

    /**
     * Send a new request: Add a request Id to the request and add it to the ongoing requests
     * Add an interval to timeout when there is no response after a certain amount of time
     * @param data 
     * @param callback 
     */
    public send(data: Message, callback?: Callback) {
        if (this.socket === undefined) {
            console.log("KoppeliaWebsocket::send(): Koppelia websocket client was not instancieated")
            return;
        }
        // Create a request id
        data.generateRequestId();
        this._addNewRequest(data.getRequestId(), callback);
        // Send the request
        const serializedMessage = JSON.stringify(data.toObject());
        console.log("sending message", serializedMessage);
        console.log(this.socket);
        this.socket.send(serializedMessage);
        // set a timeout
        window.setTimeout(() => this._deleteRequest(data.getRequestId()), this.timeout);;
    }

    /**
     * Add a receive callback
     * @param callback 
     */
    public onReceive(callback: Callback) {
        this.receiveCallbacks.push(callback);
    }

    /**
     * Define a callback for the websocket open event 
     * @param callback 
     */
    public onOpen(callback: () => void) {
        this.openCallback = callback;
    }

    /* ------ PRIVATE ------ */

    private _connectWebsocket(websockerUrl: string): void {
        this.socket = new WebSocket(websockerUrl);
    }

    /**
     * Handle a websocket response
     * - Execute a callback of a reception if a request was send before (by checking ongoing request)
     * - Execute a callbacj for a genral reception response
     * @param data 
     * @returns 
     */
    private _handleWebsocketResponse(data: any): void {
        if (data === undefined) {
            return
        }
        let message = new Message()
        message.parse(data)
        if (message.getRequestId() !== undefined) {
            // There is a request id, check if it's a response
            let onGoing = this._getOnGoingRequest(message.getRequestId());
            if (onGoing) {
                // check if the callback exists
                if (onGoing.callback)
                    onGoing.callback!(message);
                // otherwise do not execute callback and delete the request from ongoing
                this._deleteRequest(message.getRequestId());
                return
            }
        }

        for (let callback of this.receiveCallbacks) {
            callback!(message);
        }
    }

    /**
     * Init all websocker events
     */
    private _setupEvents(): void {
        if (this.socket === undefined) {
            console.log("KoppeliaWebsocket::_setupEvents(): Koppelia websocket client was not instancieated")
            return;
        }

        // handle web socker opening
        this.socket.addEventListener('open', (e) => {
            if (this.openCallback)
                this.openCallback();
        });

        // handle web socket reception
        this.socket.addEventListener('message', (e: MessageEvent) => {
            let data = JSON.parse(e.data);
            this._handleWebsocketResponse(data);

        });

        // handle connection close (if an error occure)
        this.socket.onclose = (event: CloseEvent) => {
            console.log(`Connection closed ${event.reason}, code=${event.code}, retry onnection ...`)
            setTimeout(() => { this._connectWebsocket(this.websocketUrl); this._setupEvents(); }, 1000);
        };

    }

    /**
     * Timeout the request if there is no response
     * To timout the response, the function simply delete the id from on going request list
     * @param requestId Id of the request
     */

    private _getRequestIndex(requestId: string): number {
        return this.onGoingRequests.findIndex((element) => {
            if (!element) {
                return false; // Skip empty slots
            }
            return element.requestId === requestId;
        });
    }

    /**
     * Delete the request from the list of onGoing Requests
     * @param requestId 
     */
    private _deleteRequest(requestId: string): void {
        this.onGoingRequests = this.onGoingRequests.filter((element: OnGoingRequest) => element.requestId !== requestId);
    }

    /**
     * get the Ongoing the request and get theh callback
     * @param requestId 
     * @returns 
     */
    private _getOnGoingRequest(requestId: string): OnGoingRequest | undefined {
        let requestIndex = this._getRequestIndex(requestId);
        if (requestIndex < 0)
            return undefined
        return this.onGoingRequests[requestIndex];
    }

    /**
     * Add a new request to ongoing requests
     * @param requestId 
     * @param callback 
     */
    private _addNewRequest(requestId: string, callback?: Callback) {
        this.onGoingRequests.push({ requestId: requestId, callback: callback });
    }
}