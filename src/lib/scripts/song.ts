import { Koppelia } from "./koppelia.js";

/**
 * Represents a Song entity, managing its metadata (artist, album, year)
 * and providing access to its associated media files (audio tracks, cover, lyrics).
 */
export class Song {
    private _id: string = "";
    private _name: string = "";
    private _album: string = "";
    private _artist: string = "";
    private _country: string = "";
    private _style: string = "";
    private _year: number = 0;
    private _length: number = 0;

    private _coverImage: string = "";
    private _songFile: string = "";
    private _songBackingFile: string = "";
    private _songLyricsFile: string = "";
    private _lyricsFile: string = "";
    koppelia = Koppelia.instance;

    public constructor() {
    }

    public get id(): string {
        return this._id;
    }

    public get name(): string {
        return this._name;
    }

    public get album(): string {
        return this._album;
    }

    public get artist(): string {
        return this._artist;
    }

    public get country(): string {
        return this._country;
    }

    public get style(): string {
        return this._style;
    }

    public get year(): number {
        return this._year;
    }

    public get length(): number {
        return this._length;
    }

    /**
     * Retrieves the base media folder path for this specific song.
     * @returns The relative path to the song's media directory.
     */
    public getSongsFolderPath(): string {
        return "/media/song/" + this._id;
    }

    /**
     * Constructs the full URL for a specific media file within the song's folder.
     * @param mediaName The file name of the media asset.
     * @returns The fully qualified URL to access the media.
     */
    public getMediaUrl(mediaName: string) {
        let koppelia = Koppelia.instance;
        let path = this.getSongsFolderPath() + "/" + mediaName;
        return koppelia.getMediaLink(path);
    }

    /**
     * Gets the URL for the main audio track.
     */
    public get songUrl(): string {
        return this.getMediaUrl(this._songFile);
    }

    /**
     * Gets the URL for the album cover image.
     */
    public get coverUrl(): string {
        return this.getMediaUrl(this._coverImage);
    }

    /**
     * Gets the URL for the lyrics file.
     */
    public get lyricsUrl(): string {
        return this.getMediaUrl(this._lyricsFile);
    }

    /**
     * Gets the URL for the backing track (instrumental).
     */
    public get songBackingUrl(): string {
        return this.getMediaUrl(this._songBackingFile);
    }

    /**
     * Gets the URL for the vocal/lyrics audio track.
     */
    public get songLyricsUrl(): string {
        return this.getMediaUrl(this._songLyricsFile);
    }

    /**
     * Asynchronously fetches and reads the lyrics file content as plain text.
     * @returns A promise resolving to the text content of the lyrics.
     */
    public async getLyrics(): Promise<string> {
        return (await fetch(this.lyricsUrl)).text();
    }

    /**
     * Hydrates the Song instance using properties from a provided raw JSON object.
     * @param object A dictionary containing the song's metadata and file names.
     */
    public fromObject(object: { [key: string]: any }) {
        this._name = object["name"];
        this._id = object["id"];
        // _is_downloaded: bool

        this._name = object["name"];
        this._album = object["album"];
        this._artist = object["artist"];
        this._length = object["length"];
        this._year = object["year"];
        this._style = object["style"];
        this._country = object["country"];

        this._songFile = object["song_file"];
        this._lyricsFile = object["lyrics_file"];
        this._coverImage = object["cover_file"];
        this._songBackingFile = object["backing_track_file"];
        this._songLyricsFile = object["lyrics_track_file"];
    }
}
