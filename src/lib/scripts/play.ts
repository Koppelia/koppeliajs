import { Console } from "./console.js";
import { Message, PeerType } from "./message.js";
import type { MediaResponseData } from "./console.js";

/**
 * Represents a "Play" (a specific game session or scenario instance).
 * Manages the play's metadata, thumbnail, and the dynamic loading of its core content from the network.
 */
export class Play {
    private _playCreationDate: string = "";
    private _playCreatorId: string = "";
    private _playGameId: string = "";

    private _playIsPrivate: string = "";

    private _playImagebase64: string = "";
    private _playMedias: string[] = [];
    private _playName: string = "";
    private _playId: string = "";
    private _playFileName: string = "";
    private _console: Console;
    private _refreshed: boolean = true;
    private _playContent: { [key: string]: any } = {};
    private _playContentLoaded: boolean = false;

    /**
     * Initializes a new Play instance.
     * @param console The Console instance used for network and media requests.
     * @param playId The unique identifier for this play.
     * @param playRawObj A raw dictionary containing the play's basic metadata.
     */
    constructor(
        console: Console,
        playId: string,
        playRawObj: { [key: string]: any },
    ) {
        this._console = console;
        this._playId = playId;
        if (playRawObj.name !== undefined) {
            this._playName = playRawObj.name;
        }
        if (playRawObj.game_id !== undefined) {
            this._playGameId = playRawObj.game_id;
        }
        if (playRawObj.file_name !== undefined) {
            this._playFileName = playRawObj.file_name;
        }
        if (playRawObj.thumbnail !== undefined) {
            this._playImagebase64 = playRawObj.thumbnail;
        }
        this._playContentLoaded = false;
    }

    /**
     * Constructs the relative path for a media file associated with this play.
     * @param mediaName The name of the media file.
     * @returns The relative media path string.
     */
    public getPlayMediaPath(mediaName: string): string {
        return `media/game/${this._playGameId}/play/${this._playId}/${mediaName}`;
    }

    /**
     * Generates the fully qualified URL to access a specific play media file.
     * @param mediaName The name of the media file.
     * @returns The full URL string.
     */
    public getMediaLink(mediaName: string): string {
        let mediaPath = this.getPlayMediaPath(mediaName);
        return this._console.getMediaUrl(mediaPath);
    }

    /**
     * Asynchronously fetches the raw binary or parsed content of a specific media file.
     * @param mediaName The name of the media file to fetch.
     * @returns A promise resolving to the parsed media data (Blob, JSON, Text, etc.).
     */
    public async getMediaContent(
        mediaName: string,
    ): Promise<MediaResponseData> {
        let mediaPath = this.getPlayMediaPath(mediaName);
        return await this._console.getMedia(mediaPath);
    }

    /**
     * Asynchronously fetches the core data payload of the play using its registered file name.
     * @returns A promise resolving to the play's main data object.
     */
    public async getMediaData(): Promise<{ [key: string]: any }> {
        return await this.getMediaContent(this._playFileName);
    }

    /**
     * Downloads and caches the main content of the play into memory, marking it as loaded.
     */
    public async updatePlayContent(): Promise<void> {
        this._playContent = await this.getMediaData();
        this._playContentLoaded = true;
    }

    /**
     * Gets the loaded content dictionary of the play.
     */
    public get playContent(): { [key: string]: any } {
        return this._playContent;
    }

    /**
     * Checks if the play's main content has been fully loaded into memory.
     * @returns True if the content is loaded, false otherwise.
     */
    public isPlayContentLoaded(): boolean {
        return this._playContentLoaded;
    }

    /**
     * Retrieves the file name serving as the main data entry point for the play.
     */
    public get data(): string {
        return this._playFileName;
    }

    /**
     * Retrieves the unique identifier of the play.
     */
    public get id(): string {
        return this._playId;
    }

    /**
     * Retrieves the name of the play.
     */
    public get name(): string {
        return this._playName;
    }

    /**
     * Retrieves the Base64 encoded thumbnail image of the play.
     */
    public get image(): string {
        return this._playImagebase64;
    }

    /**
     * Checks if the play data is currently in a refreshed state.
     */
    public get isRefreshed() {
        return this._refreshed;
    }
}