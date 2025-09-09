import { Console } from "./console.js";
import { Message, PeerType } from "./message.js";
import type { MediaResponseData } from "./console.js";

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

    constructor(console: Console, playId: string, playRawObj: { [key: string]: any }) {
        this._console = console;
        this._playId = playId;
        if (playRawObj.name !== undefined) {
            this._playName = playRawObj.name;
        }
        if (playRawObj.game_id !== undefined) {
            this._playGameId = playRawObj.game_id;
        }
        if (playRawObj.file_name  !== undefined) {
            this._playFileName = playRawObj.file_name;
        }
    }

    public getPlayMediaPath(mediaName: string): string {
        return `media/game/${this._playGameId}/play/${this._playId}/${mediaName}`;
    }

    public getMediaLink(mediaName: string): string {
        let mediaPath = this.getPlayMediaPath(mediaName);
        return this._console.getMediaUrl(mediaPath);
    }

    public async getMediaContent(mediaName: string): Promise<MediaResponseData> {
        let mediaPath = this.getPlayMediaPath(mediaName);
        return await this._console.getMedia(mediaPath);
    }

    public async getMediaData(): Promise<{ [key: string]: any }> {
        return await this.getMediaContent(this._playFileName);
    }

    /**
     * Get the data of the play
     */
    public get data(): string {
        return this._playFileName;
    }

    /**
     * Get the id of the play
     */
    public get id(): string {
        return this._playId;
    }

    /**
     * Get the name of the play
     */
    public get name(): string {
        return this._playName;
    }

    /**
     * Get the image base64
     */
    public get image(): string {
        return this._playImagebase64;
    }

    public get isRefreshed() {
        return this._refreshed;
    }

}