import { Console } from "./console.js";
import { Message } from "./message.js";
import { goto } from "$app/navigation";
import { routeType } from "../stores/routeStore.js";
import { get } from "svelte/store";


export class Stage {
    private _currentStage: string = "home";
    private _stages: string[] = ["home"];
    private _console: Console


    constructor(console: Console) {
        this._console = console;
        this._initEvents();
    }

    public updateFromServer() {

    }

    public initStages(stages: string[]) {
        let req = new Message();
        req.setRequest("initStages");
        req.addParam("stages", stages);
        this._console.sendMessage(req);
    }

    public goto(stage: string) {
        let req = new Message();
        req.setRequest("changeStage");
        req.addParam("stage", stage);
        this._console.sendMessage(req);
    }

    private _initEvents() {
        // update the state when receive a change from console
        this._console.onStageChange((from, stage) => {
            this._onReceiveStage(from, stage);
        });
    }

    private _onReceiveStage(from: string, receivedStage: string) {
        // Destroy all events before changing stage
        this._console.destroyEvents();
        
        let path = "/game/" + get(routeType) + "/" + receivedStage;
        goto(path);
    }
}