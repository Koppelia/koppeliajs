import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import bodyParser from 'body-parser';

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


export class KoppeliaServerApi {

    path: string;

    constructor(path: string) {
        this.path = path;
    }

    run() {
        this.serveApi();
        app.listen(2227);
    }
   
    getContentType(file: string) {
        let contentType = "";
        let ext = path.extname(file).substring(1);
        console.log(ext);
        switch (ext) {
            case 'html':
                contentType = "text/html";
                break
            case 'css':
                contentType = "text/css";
                break;
            case 'js':
                contentType = "text/javascript; charset=utf-8";
                break;
            case 'png':
            case 'jpeg':
            case 'bmp':
            case 'gif':
            case 'webp':
            case 'jpg':
                contentType = "image/" + ext;
                break;
            case 'mp3':
            case 'midi':
            case 'mpeg':
            case 'webm':
            case 'ogg':
            case 'wav':
                contentType = "audio/" + ext;
                break;
            case 'pdf':
            case 'xml':
            case "json":
                contentType = "application/" + ext;
        }
        console.log(file + "; " + contentType);
        return contentType;

    }

    serveApi() {

        // Get the game ID
        app.get('/game/api/gameid', (req, res) => {
            res.json({
                gameId: process.env.GAME_ID,
            });
        });

        // Get a play data
        app.get('/game/api/playdata/:playid/:playfile', (req, res) => {
            // get the game folder
            // get the plays folder by play id
            let error = "";
            let gameId = process.env.GAME_ID;
            let playId = req.params.playid;
            let playFile = req.params.playfile;


            let playsPath = "/koppelia/games/" + gameId + "/plays";
            if (!fs.existsSync(playsPath)) {
                fs.mkdirSync(playsPath, { recursive: true });
            }

            // check if the play exist:
            let playPath = playsPath + "/" + playId;
            if (fs.existsSync(playPath)) {
                // the play exist and it is downloaded
                // find the play file requested :
                let filePath = playPath + "/" + playFile;
                if (fs.existsSync(playPath)) {
                    res.setHeader("Content-Type", this.getContentType(filePath));
                    res.writeHead(200);
                    fs.readFile(filePath, (err, data) => {
                        res.end(data);
                    });
                    return
                } else {
                    error = "Cannot found the file " + playFile + " in the play with id " + playId;
                }

            } else {
                error = "The play is not downloaded (play not found)";
            }

        });

    }


}