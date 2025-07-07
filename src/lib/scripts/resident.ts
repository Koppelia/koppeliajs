import { Koppelia } from "./koppelia.js";

export class Resident {
    private _name: string = "";
    private _id: string = "";
    private _image: string = "";
    private _residenceId: string = "";

    public constructor() {

    }

     public get id(): string {
        return this._id;
    }

    public get name(): string {
        return this._name;
    }

    public get imageUrl(): string {
        let koppelia = Koppelia.instance;
        let path = "/media/residence/" + this._residenceId + "/resident/" + this._id + "/"+ this._image
        return koppelia.getMediaLink(path);
    }

    public fromObject(object: {[key: string]: string}) {
        this._name = object["resident_name"];
        this._id = object["resident_id"];
        this._image = object["resident_image"];
        this._residenceId = object["resident_residence_id"];
    }

}