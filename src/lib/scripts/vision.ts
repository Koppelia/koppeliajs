import { Console } from "./console.js";
import { Message, MessageType, PeerType } from "./message.js";

/**
 * The console's camera, through the console: `Koppelia.instance.vision`.
 *
 * The camera software (Concerto) is optional on a console — the animator installs it
 * from Animato's console settings (« Logiciel de Vision »); a game declares in its
 * package.json whether it needs it (`"vision": "required" | "optional"`). A game asks
 * {@link Vision.status} first and tells the animator what is missing itself
 * (« Vérifiez que la caméra est bien branchée »), then starts a detection module and
 * gets its results in a callback. The console stops everything the game started when
 * the game closes; the camera is on only while something uses it.
 *
 * Modules: `"pose"` — the player's skeleton ({@link PoseData}), ~30 a second.
 * Recordings: takes of what the camera sees ({@link Vision.startRecording}).
 */

export const VisionRequest = {
    getStatus: "getVisionStatus",
    startModule: "startVisionModule",
    setModuleOptions: "setVisionModuleOptions",
    stopModule: "stopVisionModule",
    openPreview: "openVisionPreview",
    closePreview: "closeVisionPreview",
    startRecording: "startVisionRecording",
    stopRecording: "stopVisionRecording",
    getRecordings: "getVisionRecordings",
    statusNotification: "visionStatusNotification",
    data: "visionData",
} as const;

const REQUEST_TIMEOUT_MS = 5000;
/** Starting a module loads its model: a few seconds the first time. */
const START_TIMEOUT_MS = 20000;

export type VisionCameraState = "ok" | "absent" | "error" | "unknown";

export interface VisionStatus {
    /** The camera software is on this console. */
    installed: boolean;
    /** …and running. */
    running: boolean;
    /** `ok` a camera is plugged; `absent` none is; `error` it is plugged but fails (see `error`). */
    camera: { state: VisionCameraState; error?: string | null };
    /** The detection modules it offers ("pose"). */
    modules: string[];
    /** A take is recording ({@link Vision.startRecording}). */
    recording: boolean;
}

/**
 * Why a vision request failed: `NOT_INSTALLED`, `NOT_RUNNING`, `NO_CAMERA`,
 * `UNKNOWN_MODULE`, `BAD_OPTIONS`, `RECORDING` (a take already recording, or none to
 * stop), `TIMEOUT`, or `CONCERTO` (anything else).
 */
export class VisionError extends Error {
    constructor(
        message: string,
        public readonly code: string,
    ) {
        super(message);
        this.name = "VisionError";
    }
}

/** One skeleton ("pose" module): 17 COCO keypoints in the camera's pixels. */
export interface PoseData {
    /** The camera frame it was computed on. */
    frame: number;
    /** When that frame was read, console clock (ms since the epoch). */
    unixMs: number;
    inferMs: number;
    /** 17 × (x, y, score), flattened; null when nobody is seen. */
    keypoints: number[] | null;
    /** The body's direction, degrees (0 facing the camera), null when unknown. */
    yaw: number | null;
    /** The parts the tools need, seen or not (face, shoulders, hands, knees). */
    parts: Record<string, boolean>;
    /** Every part needed is seen. */
    ready: boolean;
}

/** A running module: change its options, stop it. */
export interface VisionModuleHandle {
    setOptions(options: Record<string, unknown>): void;
    stop(): void;
}

const UNKNOWN_STATUS: VisionStatus = {
    installed: false,
    running: false,
    camera: { state: "unknown" },
    modules: [],
    recording: false,
};

export class Vision {
    constructor(private readonly _console: Console) {}

    /**
     * Is the camera software installed and running, is a camera plugged. A console too old
     * to know vision answers « not installed ».
     */
    async status(): Promise<VisionStatus> {
        try {
            const response = await this._ask(VisionRequest.getStatus, {}, REQUEST_TIMEOUT_MS);
            return parseStatus(response.getParam("status", null));
        } catch {
            return { ...UNKNOWN_STATUS };
        }
    }

    /** The status each time it changes (Concerto started or stopped, the camera plugged or unplugged). */
    onStatus(callback: (status: VisionStatus) => void): string {
        return this._console.onRequest((request, params) => {
            if (request === VisionRequest.statusNotification) callback(parseStatus(params.status));
        });
    }

    unsubscribe(subscriptionId: string): void {
        this._console.unsubscribeCallback(subscriptionId);
    }

    /**
     * Starts a detection module; `onData` gets each of its results.
     * @throws {VisionError} the software or the camera is missing, the module is unknown…
     */
    async start<T = unknown>(
        module: string,
        options: Record<string, unknown>,
        onData: (data: T) => void,
    ): Promise<VisionModuleHandle> {
        const subscription = this._console.onRequest((request, params) => {
            if (request === VisionRequest.data && params.module === module) onData(params.data as T);
        });
        try {
            await this._ask(VisionRequest.startModule, { module, options }, START_TIMEOUT_MS);
        } catch (error) {
            this._console.unsubscribeCallback(subscription);
            throw error;
        }
        let stopped = false;
        return {
            setOptions: (next) => {
                if (!stopped) this._tell(VisionRequest.setModuleOptions, { module, options: next });
            },
            stop: () => {
                if (stopped) return;
                stopped = true;
                this._console.unsubscribeCallback(subscription);
                this._tell(VisionRequest.stopModule, { module });
            },
        };
    }

    /** The skeleton: {@link start} for `"pose"`. `minHeightShare` skips people that small (a poster). */
    startPose(onPose: (pose: PoseData) => void, options: { minHeightShare?: number } = {}): Promise<VisionModuleHandle> {
        return this.start<PoseData>("pose", options, onPose);
    }

    /**
     * The live picture's address, for an `<img src>` on the TV (on the console only). It stops
     * with {@link closePreview}, or when the game closes; ask again after the software restarted.
     */
    async openPreview(): Promise<string> {
        const response = await this._ask(VisionRequest.openPreview, {}, REQUEST_TIMEOUT_MS);
        return String(response.getParam("url", ""));
    }

    closePreview(): void {
        this._tell(VisionRequest.closePreview, {});
    }

    /**
     * Records a take of what the camera sees — the video, each frame's time, the skeleton —
     * kept on the console (`label` names it). One at a time; it stops with
     * {@link stopRecording}, or when the game closes. Nothing from the controllers goes in
     * it: a controller's own recording (module "imurec") is kept apart, on the same clock.
     */
    async startRecording(label: Record<string, unknown>): Promise<Record<string, unknown>> {
        return (await this._ask(VisionRequest.startRecording, { label }, START_TIMEOUT_MS)).getParam("take", {});
    }

    /** Ends the take; returns its summary (frames, duration, measured fps). */
    async stopRecording(): Promise<Record<string, unknown>> {
        return (await this._ask(VisionRequest.stopRecording, {}, REQUEST_TIMEOUT_MS)).getParam("take", {});
    }

    /** The takes kept on the console, newest first. */
    async getRecordings(): Promise<Record<string, unknown>[]> {
        return (await this._ask(VisionRequest.getRecordings, {}, REQUEST_TIMEOUT_MS)).getParam("takes", []);
    }

    private _request(exec: string, params: Record<string, unknown>): Message {
        const request = new Message();
        request.setRequest(exec);
        for (const key in params) request.addParam(key, params[key]);
        request.setDestination(PeerType.MASTER, "");
        return request;
    }

    private _tell(exec: string, params: Record<string, unknown>): void {
        this._console.sendMessage(this._request(exec, params));
    }

    private _ask(exec: string, params: Record<string, unknown>, timeoutMs: number): Promise<Message> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new VisionError(`${exec}: no answer`, "TIMEOUT"));
            }, timeoutMs);
            this._console.sendMessage(this._request(exec, params), (response: Message) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (response.getType() === MessageType.ERROR) {
                    reject(new VisionError(String(response.getParam("error") ?? exec), String(response.getParam("code") ?? "CONCERTO")));
                } else {
                    resolve(response);
                }
            });
        });
    }
}

function parseStatus(raw: unknown): VisionStatus {
    if (!raw || typeof raw !== "object") return { ...UNKNOWN_STATUS };
    const s = raw as Partial<VisionStatus>;
    const camera = s.camera && typeof s.camera === "object" ? s.camera : { state: "unknown" as const };
    return {
        installed: Boolean(s.installed),
        running: Boolean(s.running),
        camera: { state: (camera.state ?? "unknown") as VisionCameraState, error: camera.error ?? null },
        modules: Array.isArray(s.modules) ? s.modules.map(String) : [],
        recording: Boolean(s.recording),
    };
}
