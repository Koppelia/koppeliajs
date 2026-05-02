import { Console } from "./console.js";
import { Message } from "./message.js";
import { goto } from "$app/navigation";
import { routeType } from "../stores/routeStore.js";
import { get } from "svelte/store";

/**
 * Manages application routing and views (stages) based on commands from the server.
 * Ensures the local view is synchronized with the network's current stage.
 */
export class Stage {
    private _currentStage: string = "home";
    private _stages: string[] = ["home"];
    private _console: Console

    /**
     * Initializes the stage manager.
     * @param console The Console instance used for network communication.
     */
    constructor(console: Console) {
        this._console = console;
        this._initEvents();
    }

    /**
     * Updates the local stage from the server.
     * @todo Implementation pending.
     */
    public updateFromServer() {

    }

    /**
     * Registers a list of available stages with the server.
     * @param stages An array of stage names.
     */
    public initStages(stages: string[]) {
        let req = new Message();
        req.setRequest("initStages");
        req.addParam("stages", stages);
        this._console.sendMessage(req);
    }

    /**
     * Requests a stage transition via the server.
     * @param stage The name of the target stage to navigate to.
     */
    public goto(stage: string) {
        let req = new Message();
        req.setRequest("changeStage");
        req.addParam("stage", stage);
        this._console.sendMessage(req);
    }

    /**
     * Initializes listeners for incoming stage change commands from the console.
     */
    private _initEvents() {
        this._console.onStageChange((from, stage) => {
            this._onReceiveStage(from, stage);
        });
    }

    /**
     * Handles the reception of a stage change command.
     * Clears all network events to prevent memory leaks, then triggers SvelteKit routing.
     * @param from The origin peer that requested the stage change.
     * @param receivedStage The name of the stage to load.
     */
    private _onReceiveStage(from: string, receivedStage: string) {
        this._console.destroyEvents();
        
        let path = "/game/" + get(routeType) + "/" + receivedStage;
        goto(path);
    }
}