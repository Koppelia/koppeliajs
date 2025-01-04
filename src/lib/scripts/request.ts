
export type AnyRequest = { [key: string]: any };


export enum PeerType {
    MONITOR = "monitor",
    MASTER = "master",
    CONTROLLER = "controller",
    DEVICE = "device",
    SPECTAKLE = "spectakle",
    KOPPELIA = "koppelia",
    NONE = "none",
};

export enum RequestType {
    EMPTY = "empty",
    REQUEST = "request",
    DATA_EXCHANGE = "data_exchange",
    DEVICE_EVENT = "device_event",
    DEVICE_DATA = "device_data",
    IDENTIFICATION = "identification",
    MODULE_ENABLE = "module_enable",
}

type RequestHeader = {
    id: string,
    type: string,
    from: string,
    to: string,
    from_addr: string,
    to_addr: string,
    device: string,
};

export type RequestData = { [key: string]: string }

type RequestEvent = string;

type DirectRequest = {
    exec: string,
    params: { [key: string]: any },
}

/**
 * The koppelia protocol
 */
export class Request {
    header: RequestHeader;
    data: RequestData;
    request: DirectRequest;
    event: RequestEvent;

    constructor() {
        this.header = {
            id: "",
            type: RequestType.EMPTY,
            from: PeerType.NONE,
            to: PeerType.NONE,
            from_addr: "",
            to_addr: "",
            device: "",
        };
        this.data = {};
        this.request = {
            exec: "",
            params: {}
        };
        this.event = "";
    }

    /**
     * Parse a json request received from the network
     * @param data 
     */
    parse(data: AnyRequest) {
        if (data.header !== undefined) {
            for (let key in data.header) {
                if (key in this.header) {
                    this.header[key as keyof RequestHeader] = data.header[key];
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
     * Convert the request to json, to be sent on the network
     * @returns 
     */
    toObject(): AnyRequest {
        return {
            header: this.header,
            request: this.request,
            data: this.data,
            event: this.event
        };
    }

    /**
     * Set the source device, type and address (if there is address)
     * @param type 
     * @param address 
     */
    setSource(type: PeerType, address: string = "") {
        this.header.from = type;
        this.header.from_addr = address;
    }

    /**
     * Set the destination device, type and address
     * @param type 
     * @param address 
     */
    setDestination(type: PeerType, address: string = "") {
        this.header.to = type;
        this.header.to_addr = address;
    }

    /**
     * Get event name of the request, if it is an event
     * @returns 
     */
    getEvent(): RequestEvent {
        return this.event;
    }

    /**
     * Set the type of the request
     * @param type 
     */
    setType(type: RequestType) {
        this.header.type = type;
    }

    /**
     * Set an event to the request
     * @param event 
     */
    setEvent(event: RequestEvent) {
        this.header.type = RequestType.REQUEST;
        this.event = event;
    }

    /**
     * Add a param if the request is request type
     * @param key 
     * @param value 
     */
    addParam(key: string, value: any) {
        this.request.params[key] = value;
    }

    /**
     * Add data to the request
     * @param key 
     * @param value 
     */
    addData(key: string, value: string) {
        this.data[key] = value;
    }

    /**
     * 
     * @param data 
     */
    setData(data: RequestData) {
        this.data = data;
    }

    setRequest(execName: string) {
        this.header.type = RequestType.REQUEST;
        this.request.exec = execName;
    }

    setIdentification(peerToIdentify: PeerType) {
        this.header.type = RequestType.IDENTIFICATION;
        this.header.from = peerToIdentify;
    }

    generateRequestId() {
        this.header.id = crypto.randomUUID();;
    }

    getRequestId(): string {
        return this.header.id;
    }

}