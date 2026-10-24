import { Message, MessageType } from "./message.js";
import type { Callback } from "./koppeliaWebsocket.js";

/** How often the gap is measured again once known: the consoles drift by seconds a day, not more. */
export const CLOCK_SYNC_INTERVAL_MS = 60_000;
/** The samples kept; the one with the shortest round trip wins (the least delayed by the WiFi). */
const SAMPLES_KEPT = 5;

type Send = (message: Message, callback: Callback) => void;

interface Sample {
    offsetMs: number;
    roundTripMs: number;
}

/**
 * The console's clock, seen from this peer.
 *
 * The consoles have no NTP client, so their clock drifts away from the tablets' (104 s ahead
 * on a console in October 2026). Any time written in the state by one peer and read by the
 * other — a countdown started on the TV and shown on the tablet — must be counted on the
 * console's clock: {@link now} is `Date.now()` corrected by the measured gap. On the TV (the
 * console itself) the gap is about 0.
 *
 * A console without `getConsoleTime` (before KOPPELIA_0.34) answers an error: the gap stays
 * 0, which is the old behaviour.
 */
export class ConsoleClock {
    private _samples: Sample[] = [];
    private _offsetMs = 0;
    private _supported = true;

    constructor(
        private readonly _send: Send,
        private readonly _localNow: () => number = () => Date.now(),
    ) {}

    /** Milliseconds since the epoch, on the console's clock. */
    public now(): number {
        return this._localNow() + this._offsetMs;
    }

    /** The console's clock minus this peer's, in milliseconds. */
    public get offsetMs(): number {
        return this._offsetMs;
    }

    /** Asks the console for its time once; the reply refines the gap. */
    public sync(): void {
        if (!this._supported) return;
        const request = new Message();
        request.setRequest("getConsoleTime");
        const sentAt = this._localNow();
        this._send(request, (reply: Message) => {
            if (reply.getType() === MessageType.ERROR) {
                this._supported = false;
                return;
            }
            const consoleTime = Number(reply.getParam("time"));
            if (!Number.isFinite(consoleTime)) return;
            const receivedAt = this._localNow();
            const roundTripMs = receivedAt - sentAt;
            // The console read its clock about halfway through the round trip.
            this._addSample({ offsetMs: consoleTime + roundTripMs / 2 - receivedAt, roundTripMs });
        });
    }

    private _addSample(sample: Sample): void {
        this._samples = [...this._samples, sample].slice(-SAMPLES_KEPT);
        const best = this._samples.reduce((a, b) => (b.roundTripMs < a.roundTripMs ? b : a));
        this._offsetMs = Math.round(best.offsetMs);
    }
}
