import { Koppelia } from "./koppelia.js";

/**
 * Represents a Resident entity within the Koppelia ecosystem.
 * Handles the resident's personal details and dynamic media URLs.
 */
export class Resident {
    private _name: string = "";
    private _id: string = "";
    private _image: string = "";
    private _residenceId: string = "";

    public constructor() {
    }

    /**
     * Gets the unique identifier of the resident.
     */
    public get id(): string {
        return this._id;
    }

    /**
     * Gets the full name of the resident.
     */
    public get name(): string {
        return this._name;
    }

    /**
     * Constructs and retrieves the full URL to the resident's profile image.
     * Uses the Koppelia singleton to resolve the correct media path.
     * @returns The full URL string for the image.
     */
    public get imageUrl(): string {
        let koppelia = Koppelia.instance;
        let path = "/media/residence/" + this._residenceId + "/resident/" +
            this._id + "/" + this._image;
        return koppelia.getMediaLink(path);
    }

    /**
     * Hydrates the Resident instance using properties from a provided raw object.
     * @param object A dictionary containing the resident's properties.
     */
    public fromObject(object: { [key: string]: string }) {
        this._name = object["name"];
        this._id = object["id"];
        this._image = object["image"];
        this._residenceId = object["residence_id"];
    }
    
}