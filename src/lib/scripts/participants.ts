import type { Console } from "./console.js";
import type { Device } from "./device.js";
import { logger } from "./logger.js";
import type { ParticipantResult } from "./telemetry.js";

/**
 * Who is playing on which controller, and what to call them in telemetry.
 *
 * Both pilot games wrote this themselves and got it wrong in the same two ways,
 * which is why it lives here now:
 *
 * 1. **Keying on the name.** A name is a label an animator can retype at any
 *    moment; the quiz used it as its player key, so a rename mid-game minted a
 *    brand-new player at zero and the resident lost the points she had won.
 * 2. **Losing the resident.** `device.resident.id` was read for the picture and
 *    thrown away on the same line, so no score could ever reach a person.
 *
 * The address is the identity. The resident on it can change — a resident leaves
 * and another sits down — so the key carries a BINDING number that counts up
 * when that happens. The first resident's row freezes with what she earned; the
 * second starts her own. Anything else merges two people into one line.
 */

export type Participant = {
	address: string;
	residentId?: string;
	/** Counts up each time this controller changes hands. */
	binding: number;
};

/** What a game supplies: its own numbers, against an address. */
export type ParticipantEntry = {
	address: string;
	score?: number;
	outcome?: ParticipantResult["outcome"];
	results?: { [key: string]: any };
};

export type RebindListener = (event: {
	address: string;
	/** The key that just froze. A game should stop adding to whatever it holds under it. */
	previousKey: string;
	previousResidentId?: string;
	residentId?: string;
}) => void;

export class ParticipantRegistry {
	private _console: Console;
	private _known: Record<string, Participant> = {};
	private _listeners: RebindListener[] = [];

	constructor(console: Console) {
		this._console = console;
		this._console.onRequest((request, params) => {
			if (
				(request === "deviceResidentNotification" ||
					request === "deviceConnectionNotification") &&
				params?.device?.address !== undefined
			) {
				this.track(params.device as Device);
			}
		});
	}

	/**
	 * Note who is on this controller, and say so if it changed hands.
	 *
	 * Call it for every device a game already knows about — the registry only
	 * hears about the ones that connect or are re-bound after it was created.
	 */
	public track(device: {
		address: string;
		resident?: { id?: string } | null;
		isAssociatedToResident?: boolean;
	}): Participant {
		const address = device.address;
		const residentId =
			device.isAssociatedToResident === false
				? undefined
				: (device.resident?.id ?? undefined);

		const known = this._known[address];
		if (known === undefined) {
			this._known[address] = { address, residentId, binding: 1 };
			return this._known[address];
		}
		if (known.residentId === residentId) return known;

		const previousKey = this.keyFor(address);
		const previousResidentId = known.residentId;
		known.residentId = residentId;
		known.binding += 1;
		logger.log(
			`[participants] ${address} changed hands, now binding ${known.binding}`,
		);
		for (const listener of this._listeners) {
			try {
				listener({ address, previousKey, previousResidentId, residentId });
			} catch (e) {
				logger.error(`[participants] rebind listener failed: ${e}`);
			}
		}
		return known;
	}

	/**
	 * Fires when a controller changes hands, so a game can freeze what it was
	 * counting for the previous resident and start again for the next one.
	 *
	 * Without this a game cannot know: re-associating a controller is a rename on
	 * the console, and until `KOPPELIA_0.19.2` nothing went out when it happened.
	 */
	public onRebind(listener: RebindListener): void {
		this._listeners.push(listener);
	}

	/** The telemetry key for this controller as it stands. */
	public keyFor(address: string): string {
		const known = this._known[address];
		return `${address}#b${known?.binding ?? 1}`;
	}

	public residentFor(address: string): string | undefined {
		return this._known[address]?.residentId;
	}

	/**
	 * Turn a game's own numbers into rows the console can file.
	 *
	 * The game says what happened; the registry says who it happened to. Which is
	 * the split that was missing: every game was answering both questions, and
	 * getting the second one wrong.
	 */
	public build(entries: ParticipantEntry[]): ParticipantResult[] {
		return entries.map((entry) => ({
			participantKey: this.keyFor(entry.address),
			deviceId: entry.address,
			residentId: this.residentFor(entry.address),
			score: entry.score,
			outcome: entry.outcome,
			results: entry.results,
		}));
	}
}
