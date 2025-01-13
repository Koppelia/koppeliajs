
import { Console } from './console.js';

/**
 * This class reprensts a device
 */

type Color = {
    r: number,
    g: number,
    b: number
};

export class Device {
    private _address: string
    private _color: Color
    private _name: string

    constructor(console: Console, address = "") {
        this._address = address;
        this._color = { r: 0, g: 0, b: 0 };
        this._name = "";
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

    }

    onData() {

    }

    enableImu() {

    }

    toObject(): { [key: string]: any } {
        return {
            "address": this._address,
            "color": this._color,
            "name": this._name
        }

    }

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