import { Console } from "./console.js";
import { Message, MessageType, PeerType } from "./message.js";
import { Resident } from "./resident.js";

type Color = {
    r: number;
    g: number;
    b: number;
    lon?: number;
    loff?: number;
};

type Vibration = {
    v: number; // time on (vibrating time)
    toff: number; // time off
    c: number; // number of cycles on/off
};

/**
 * Represents a physical or logical device connected to the console.
 * Handles device-specific commands like LEDs, vibrations, and hardware module subscriptions.
 */
export class Device {
    private _address: string;
    private _color: Color;
    private _name: string;
    private _console: Console;
    private _attachedEvents: string[];
    private _resident?: Resident;
    private _callbackIds: string[];
    private _eventsIds: string[];
    private isAttachedToResident: boolean;

    constructor(console: Console, address = "") {
        this._address = address;
        this._color = { r: 0, g: 0, b: 0 };
        this._name = "";
        this._console = console;
        this._attachedEvents = [];
        this._callbackIds = [];
        this._eventsIds = [];
        this.isAttachedToResident = false;
    }

    public get color(): Color {
        return this._color;
    }

    public get name(): string {
        return this._name;
    }

    /**
     * Subscribes to a specific hardware event for this device.
     * @param eventName The name of the event to listen to.
     * @param callback Function to execute when the event is triggered.
     */
    onEvent(eventName: string, callback: () => void): string {
        this._attachEvent(eventName);
        let consoleEvent = (
            device: string,
            from_addr: string,
            event: string,
        ) => {
            if (event == eventName && from_addr == this._address) {
                callback();
            }
        };
        return this._console.onDeviceEvent(consoleEvent);
    }

    /**
     * Enables the cursor module and listens for coordinate updates.
     * @param callback Function to execute with the incoming (x, y) coordinates.
     */
    onCursor(callback: (x: number, y: number) => void): string {
        this._enableModule("cursor");
        this._attachEvent("cursor");
        let callbackId = this._console.onRequest(
            (request, params, form, address) => {
                if (request == "cursor" && address == this._address) {
                    callback(params.x, params.y);
                }
            },
        );
        this._callbackIds.push(callbackId);
        return callbackId;
    }

    /**
     * Enables the biking module and listens for speed updates.
     * @param callback Function to execute with the incoming speed data.
     */
    onBiking(callback: (speed: number) => void): string {
        this._enableModule("biking");
        this._attachEvent("biking");
        let callbackId = this._console.onRequest(
            (request, params, form, address) => {
                if (request == "biking" && address == this._address) {
                    callback(params.speed);
                }
            },
        );
        this._callbackIds.push(callbackId);
        return callbackId;
    }

    /**
     * Enables the vertical detector module and listens for orientation updates.
     * @param callback Function to execute with the boolean vertical state.
     */
    onVerticalDetector(callback: (vertical: boolean) => void): string {
        this._enableModule("vDetct");
        this._attachEvent("verticalDetector");
        let callbackId = this._console.onRequest(
            (request, params, form, address) => {
                if (request == "verticalDetector" && address == this._address) {
                    callback(params.value);
                }
            },
        );
        this._callbackIds.push(callbackId);
        return callbackId;
    }

    /**
     * Sends a request to the device to attach a specific event listener on the hardware side.
     * @param event The event name to attach.
     */
    private _attachEvent(event: string) {
        if (!(event in this._attachedEvents)) {
            let request = new Message();
            request.addParam("event", event);
            request.setDestination(PeerType.DEVICE, this._address);
            request.setRequest("attachEvent");
            this._console.sendMessage(request);
            this._attachedEvents.push(event);
        }
    }

    /**
     * Sends a request to the device to enable a specific hardware module.
     * @param moduleName The name of the module to enable (Note: retains original code spelling).
     */
    private _enableModule(moduleName: string) {
        let request = new Message();
        request.addParam("module", moduleName);
        request.setDestination(PeerType.DEVICE, this._address);
        request.setRequest("enableModule");
        this._console.sendMessage(request);
    }

    /**
     * Changes the current LED color of the device.
     * @param color The RGB color configuration to apply.
     */
    setColor(color: Color) {
        this._color = color;
        let request = new Message();
        request.addParam("color", color);
        request.setDestination(PeerType.DEVICE, this._address);
        request.setRequest("setColor");
        this._console.sendMessage(request);
    }

    /**
     * Sends a predefined sequence of colors to the device.
     * @param sequence Array of color sequence identifiers or configurations.
     * @param reset Whether to interrupt the current sequence before starting the new one.
     */
    setColorSequence(sequence: string[], reset: boolean = false) {
        let request = new Message();
        request.setDestination(PeerType.DEVICE, this._address);
        request.setRequest("setColorSequence");
        request.addParam("sequence", sequence);
        request.addParam("reset", reset);
        this._console.sendMessage(request);
    }

    /**
     * Triggers the device's vibration motor.
     * @param time Total vibration time in milliseconds.
     * @param blink Enables pulsating/intermittent vibration.
     * @param blinkOff The duration of the pause between pulses in milliseconds.
     * @param blinkCount The number of pulsing cycles to execute.
     */
    vibrate(
        time: number,
        blink: boolean = false,
        blinkOff: number = 0,
        blinkCount: number = 0,
    ) {
        let vibration: Vibration = {
            v: time,
            toff: 0,
            c: 1,
        };
        if (blink) {
            vibration.toff = blinkOff;
            vibration.c = blinkCount;
        }

        let request = new Message();
        request.addParam("vibration", vibration);
        request.setDestination(PeerType.DEVICE, this._address);
        request.setRequest("vibrate");
        this._console.sendMessage(request);
    }

    public clearCallback(callbackId: string) {
        if (this._callbackIds.includes(callbackId)) {
            this._console.unsubscribeCallback(callbackId);
        }
    }

    public clearAllCallbacks() {
        for (let callbackId of this._callbackIds) {
            this.clearCallback(callbackId);
        }
    }

    public clearEvent(eventId: string) {
        if (this._eventsIds.includes(eventId)) {
            this._console.unsubscribeCallback(eventId);
        }
    }

    public clearAllEvents() {
        for (let eventId of this._eventsIds) {
            this.clearCallback(eventId);
        }
    }

    /**
     * Serializes the Device object into a generic dictionary.
     * @returns A plain object representing the device's current state.
     */
    toObject(): { [key: string]: any } {
        return {
            "address": this._address,
            "color": this._color,
            "name": this._name,
        };
    }

    /**
     * Hydrates the Device instance using properties from a provided object.
     * @param object The plain object containing device properties.
     */
    fromObject(object: { [key: string]: any }) {
        if (object.address !== undefined) {
            this._address = object.address;
        }
        if (object.color !== undefined) {
            this._color = object.color;
        }
        if (object.name !== undefined) {
            this._name = object.name;
        }
        if (object.resident !== undefined) {
            this.isAttachedToResident = true;
            this._resident = new Resident();
            this._resident.fromObject(object.resident);
        }
    }

    public get resident(): Resident | undefined {
        return this._resident;
    }

    public get isAssociatedToResident(): boolean {
        return this.isAttachedToResident;
    }
}
