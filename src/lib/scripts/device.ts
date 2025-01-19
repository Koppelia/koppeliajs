
import { Console } from './console.js';
import { Message, MessageType, PeerType } from './message.js';

/**
 * This class reprensts a device
 */

type Color = {
    r: number,
    g: number,
    b: number
};

type Vibration = {
    v: number, // time on (vibrating time)
    toff: number, // time off
    c: number // number of cycles on/off
}

export class Device {
    private _address: string
    private _color: Color
    private _name: string
    private _console: Console
    private _attachedEvents: string[]

    constructor(console: Console, address = "") {
        this._address = address;
        this._color = { r: 0, g: 0, b: 0 };
        this._name = "";
        this._console = console
        this._attachedEvents = []
    }

    public set color(color: Color) {
        this._color = color;
        // TODO : send a request to change the color

    }

    public get color(): Color {
        return this._color;
    }

    ping() {

    }

    onEvent(eventName: string, callback: () => void) {
        this._attachEvent(eventName);
        this._console.onDeviceEvent(callback);

    }

    onZPosition(callback: (z: number) => void) {
        this._enableModule("zPos");
        this._attachEvent("zPosition");

    }

    onVerticalDetector(callback: (vertical: boolean) => void) {
        this._enableModule("vDetct");
        this._attachEvent("verticalDetector");
    }

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

    private _enableModule(moduleNmae: string) {
        let request = new Message();
        request.addParam("module", moduleNmae);
        request.setDestination(PeerType.DEVICE, this._address);
        request.setRequest("enableModule");
        this._console.sendMessage(request);
    }

    setColor(color: Color) {
        this._color = color;
        let request = new Message();
        request.addParam("color", color);
        request.setDestination(PeerType.DEVICE, this._address);
        request.setRequest("setColor");
        this._console.sendMessage(request);
    }

    /**
     * Vibrate the device (use the motor vibrator)
     * @param time 
     * @param blink 
     * @param blinkOff 
     * @param blinkCount 
     */
    vibrate(time: number, blink: boolean = false, blinkOff: number = 0, blinkCount: number = 0) {
        let vibration: Vibration = {
            v: time,
            toff: 0,
            c: 1
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
    
    /**
     * Convert this device object to a json object
     * @returns 
     */
    toObject(): { [key: string]: any } {
        return {
            "address": this._address,
            "color": this._color,
            "name": this._name
        }

    }

    /**
     * set the device object from a json object
     * @param object 
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
    }
}