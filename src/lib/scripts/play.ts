import { Console } from "./console.js";
import { Message, PeerType } from "./message.js";

export class Play {
    private _playCreationDate: string = "";
    private _playCreatorId: string = "";
    private _playFileName: string = "";
    private _playGameId: string = "";

    private _playIsPrivate: string = "";

    private _playImagebase64: string = "";
    private _playMedias: string[] = [];
    private _playName: string = "";
    private _playId: string = "";
    private _playData: { [key: string]: any } = {};
    private _base64Medias: { [key: string]: any } = {};
    private _console: Console;
    private _refreshed: boolean = true;

    constructor(console: Console, playId: string, playRawObj: { [key: string]: any }) {
        this._console = console;
        this._playId = playId;
        if (playRawObj._play_data_json !== undefined) {
            this._playData = playRawObj._play_data_json;
            this._refreshed = true;
        };
        if (playRawObj._play_medias_raw !== undefined) {
            this._base64Medias = playRawObj._play_medias_raw;
        }
        if (playRawObj.playName !== undefined) {
            this._playName = playRawObj.playName;
        }
        if (playRawObj.playMedias !== undefined) {
            this._playMedias = playRawObj.playMedias;
        }
        if (playRawObj._play_image_raw !== undefined) {
            this._playImagebase64 = playRawObj._play_image_raw;
        }
    }

    public async refresh(): Promise<void> {
        return new Promise((resolve, reject) => {
            let getPlaysRequest = new Message()
            getPlaysRequest.setRequest("getPlayRaw");
            getPlaysRequest.addParam("playId", this.id);
            getPlaysRequest.setDestination(PeerType.MASTER, "");
            this._console.sendMessage(getPlaysRequest, (response: Message) => {
                let playRawObj: { [key: string]: any } = response.getParam("play", {});
                if (playRawObj._play_data_json !== undefined) {
                    this._playData = playRawObj._play_data_json;
                    this._refreshed = true;
                };
                if (playRawObj._play_medias_raw !== undefined) {
                    this._base64Medias = playRawObj._play_medias_raw;
                }
                if (playRawObj._play_image_raw !== undefined) {
                    this._playImagebase64 = playRawObj._play_image_raw;
                }
                resolve();
            });
        });
    }

    /**
     * Get the list of all media files of the play
     */
    public get mediasList(): string[] {
        return Object.keys(this._base64Medias);
    }

    /**
     * Get the media file by using its name. This function returns a base64 file
     * @param mediaName 
     * @returns 
     */
    public getMedia(mediaName: string): string | undefined {
        if (this._base64Medias[mediaName] !== undefined) {
            return this._base64Medias[mediaName];
        } else {
            return undefined;
        }
    }

    /**
     * Get the data of the play
     */
    public get data(): { [key: string]: any } {
        return this._playData;
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