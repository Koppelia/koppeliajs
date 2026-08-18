import { logger } from "./logger.js";
import { Message, type AnyRequest } from "./message.js";

export type Callback = (response: Message) => void

type OnGoingRequest = {
    requestId: string,
    callback?: Callback
};

const DEFAULT_WS_TIMEOUT = 20000;

// How many frames may wait for the socket to open. Enough to cover a reconnect
// (1 s) at any rate a game realistically writes at, small enough that a server
// that never returns cannot grow the tab's memory.
const MAX_PENDING_FRAMES = 100;

// `WebSocket.OPEN` is not readable everywhere the SDK runs — under vitest the global
// is a test double with no static members, and comparing against `undefined` made the
// guard below inert (its first version passed every test while protecting nothing).
// The numeric value is fixed by the WHATWG spec and is what the instance reports.
const WS_OPEN = 1;

export class KoppeliaWebsocket {
    socket?: WebSocket = undefined;
    onGoingRequests: OnGoingRequest[];
    timeout: number
    receiveCallbacks: Callback[]
    websocketUrl: string = "";
    openCallback?: () => void;
    /** Frames written while the socket was not OPEN, flushed when it opens. */
    pendingFrames: string[] = [];
    /** Their callbacks, registered only once the frame actually leaves. */
    pendingCallbacks: OnGoingRequest[] = [];

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
        const serializedMessage = JSON.stringify(data.toObject());

        // A WebSocket only accepts send() while OPEN. Calling it during CONNECTING —
        // or after a drop, before the 1 s reconnect fires — throws InvalidStateError,
        // an unhandled DOMException that surfaces in the game's console and kills the
        // caller's promise chain. Games hit this on their very first frame: a state
        // subscription fires synchronously at mount, milliseconds before the socket
        // finishes connecting, so the opening report of every session was a crash.
        // Queued only on POSITIVE evidence that the socket is not open. A runtime that
        // does not expose `readyState` must fall through and send: assuming "not open"
        // from an absence would silently stop all traffic instead of one frame.
        const readyState = this.socket.readyState;
        if (readyState !== undefined && readyState !== WS_OPEN) {
            this._queueFrame(serializedMessage);
            // The request is NOT registered here: its timeout would run down while the
            // frame is still queued, and the callback would be gone by the time the
            // answer came back. It is registered when the frame actually leaves.
            this.pendingCallbacks.push({ requestId: data.getRequestId(), callback });
            return;
        }

        this._addNewRequest(data.getRequestId(), callback);
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
                return;
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
            this._flushPendingFrames();
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
     * Holds a frame until the socket opens.
     *
     * Bounded: a console whose server never comes back would otherwise grow this
     * without limit for as long as the page stays up. The OLDEST is dropped, because
     * the newest frame carries the most recent state — which is what these mostly are.
     */
    private _queueFrame(frame: string): void {
        if (this.pendingFrames.length >= MAX_PENDING_FRAMES) {
            this.pendingFrames.shift();
            this.pendingCallbacks.shift();
            logger.log("KoppeliaWebsocket: pending frame buffer full, dropped the oldest");
        }
        this.pendingFrames.push(frame);
    }

    /**
     * Sends everything written while the socket was down, oldest first.
     *
     * The buffer is emptied BEFORE sending: a send that throws must not leave frames
     * behind to be replayed on the next open, which would grow the buffer on every
     * reconnect of a server that keeps refusing.
     */
    private _flushPendingFrames(): void {
        const frames = this.pendingFrames;
        const callbacks = this.pendingCallbacks;
        this.pendingFrames = [];
        this.pendingCallbacks = [];
        if (frames.length === 0) return;

        logger.log(`KoppeliaWebsocket: flushing ${frames.length} pending frame(s)`);
        frames.forEach((frame, index) => {
            const pending = callbacks[index];
            try {
                this.socket!.send(frame);
            } catch (e) {
                logger.log("KoppeliaWebsocket: could not flush a pending frame", e);
                return;
            }
            if (pending) {
                this._addNewRequest(pending.requestId, pending.callback);
                window.setTimeout(() => this._deleteRequest(pending.requestId), this.timeout);
            }
        });
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