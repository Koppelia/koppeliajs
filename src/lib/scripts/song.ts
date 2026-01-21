import { Koppelia } from "./koppelia.js";

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

    public getSongsFolderPath(): string {
        return "/media/song/" + this._id;
    }

    public getMediaUrl(mediaName: string) {
        let koppelia = Koppelia.instance;
        let path = this.getSongsFolderPath() + "/" + mediaName;
        return koppelia.getMediaLink(path);
    }

    public get songUrl(): string {
        return this.getMediaUrl(this._songFile);
    }

    public get coverUrl(): string {
        return this.getMediaUrl(this._coverImage);
    }

    public get lyricsUrl(): string {
        return this.getMediaUrl(this._lyricsFile);
    }

    public get songBackingUrl(): string {
        return this.getMediaUrl(this._songBackingFile);
    }

    public get songLyricsUrl(): string {
        return this.getMediaUrl(this._songLyricsFile);
    }

    public async getLyrics(): Promise<string> {
        return (await fetch(this.lyricsUrl)).text();
    }

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
