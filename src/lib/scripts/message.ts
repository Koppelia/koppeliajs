import { v4 as uuidv4 } from "uuid";

export type AnyRequest = { [key: string]: any };

export enum PeerType {
    MAESTRO = "maestro",
    MONITOR = "monitor",
    MASTER = "master",
    CONTROLLER = "controller",
    DEVICE = "device",
    SPECTAKLE = "spectakle",
    KOPPELIA = "koppelia",
    NONE = "none",
    BROADCAST = "broadcast",
}

export enum MessageType {
    EMPTY = "empty",
    REQUEST = "request",
    STREAM_RESPONSE = "stream_response",
    RESPONSE = "response",
    DATA_EXCHANGE = "data_exchange",
    DEVICE_EVENT = "device_event",
    DEVICE_DATA = "device_data",
    IDENTIFICATION = "identification",
    MODULE_ENABLE = "module_enable",
    ERROR = "error",
    CLOSE = "close",
}

type MessageHeader = {
    id: string;
    type: string;
    from: string;
    to: string;
    from_addr: string;
    to_addr: string;
    device: string;
};

export type MessageData = { [key: string]: string };

type MessageEvent = string;

type DirectRequest = {
    exec: string;
    params: { [key: string]: any };
};

/**
 * Defines the core Koppelia protocol message structure used for all network communications.
 */
export class Message {
    header: MessageHeader;
    data: MessageData;
    request: DirectRequest;
    event: MessageEvent;

    constructor() {
        this.header = {
            id: "",
            type: MessageType.EMPTY,
            from: PeerType.NONE,
            to: PeerType.NONE,
            from_addr: "",
            to_addr: "",
            device: "",
        };
        this.data = {};
        this.request = {
            exec: "",
            params: {},
        };
        this.event = "";
    }

    /**
     * Parses a raw JSON request received from the network into the Message object.
     * @param data The raw data object to parse.
     */
    parse(data: AnyRequest) {
        if (data.header !== undefined) {
            for (let key in data.header) {
                if (key in this.header) {
                    this.header[key as keyof MessageHeader] = data.header[key];
                }
            }
        }
        if (data.data !== undefined) {
            this.data = data.data;
        }
        if (data.event !== undefined && typeof data.event === "string") {
            this.event = data.event;
        }
        if (data.request !== undefined) {
            if (data.request.exec !== undefined) {
                this.request.exec = data.request.exec;
            }
            if (data.request.params !== undefined) {
                this.request.params = data.request.params;
            }
        }
    }

    /**
     * Serializes the Message object into a plain JavaScript object for network transmission.
     * @returns The serialized message object.
     */
    toObject(): AnyRequest {
        return {
            header: this.header,
            request: this.request,
            data: this.data,
            event: this.event,
        };
    }

    /**
     * Sets the routing source information for the message.
     * @param type The peer type initiating the message.
     * @param address The specific address of the source (defaults to empty string).
     */
    setSource(type: PeerType, address: string = "") {
        this.header.from = type;
        this.header.from_addr = address;
    }

    /**
     * Sets the routing destination information for the message.
     * @param type The intended peer type receiver.
     * @param address The specific address of the destination (defaults to empty string).
     */
    setDestination(type: PeerType, address: string = "") {
        this.header.to = type;
        this.header.to_addr = address;
    }

    /**
     * Retrieves the event name of the message.
     * @returns The event string.
     */
    getEvent(): MessageEvent {
        return this.event;
    }

    /**
     * Sets the primary type of the message.
     * @param type The MessageType to assign.
     */
    setType(type: MessageType) {
        this.header.type = type;
    }

    /**
     * Configures the message as an event request.
     * @param event The name of the event.
     */
    setEvent(event: MessageEvent) {
        this.header.type = MessageType.REQUEST;
        this.event = event;
    }

    /**
     * Adds a parameter to the request payload.
     * @param key The parameter key.
     * @param value The parameter value.
     */
    addParam(key: string, value: any) {
        this.request.params[key] = value;
    }

    /**
     * Adds a key-value pair to the message data payload.
     * @param key The data key.
     * @param value The data value.
     */
    addData(key: string, value: any) {
        this.data[key] = value;
    }

    /**
     * Overwrites the entire data payload of the message.
     * @param data The new MessageData object.
     */
    setData(data: MessageData) {
        this.data = data;
    }

    /**
     * Configures the message as a direct request and sets its execution target name.
     * @param execName The name of the action/command to execute.
     */
    setRequest(execName: string) {
        this.header.type = MessageType.REQUEST;
        this.request.exec = execName;
    }

    /**
     * Retrieves a specific parameter from the request payload.
     * @param paramName The key of the parameter to fetch.
     * @param def The default value to return if the parameter is not found (defaults to null).
     * @returns The parameter value, or the default value.
     */
    getParam(paramName: string, def: any = null): any {
        if (paramName in this.request.params) {
            return this.request.params[paramName];
        } else {
            return def;
        }
    }

    /**
     * Configures the message as an identification broadcast.
     * @param peerToIdentify The peer type identifying itself.
     */
    setIdentification(peerToIdentify: PeerType) {
        this.header.type = MessageType.IDENTIFICATION;
        this.header.from = peerToIdentify;
    }

    /**
     * Generates and assigns a unique UUID for the message header.
     */
    generateRequestId() {
        this.header.id = uuidv4();
    }

    /**
     * Retrieves the unique identifier of the message.
     * @returns The generated UUID string.
     */
    getRequestId(): string {
        return this.header.id;
    }
    
}