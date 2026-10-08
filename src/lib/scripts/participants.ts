import type { Console } from './console.js';
import type { Device } from './device.js';
import { logger } from './logger.js';
import type { ParticipantResult } from './telemetry.js';

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
 * and another sits down — so the key names WHO is on it: `<address>#r<residentId>`.
 * The first resident's row freezes with what she earned; the second starts her
 * own. Anything else merges two people into one line.
 *
 * Until 1.10 the key carried a binding COUNTER instead (`#b1`, `#b2`, …). That
 * kept two people apart, but it also split ONE person: a controller renamed
 * away from her and back — or a monitor reload, which restarted every counter —
 * gave her a second key in the same session, so one afternoon was recorded as
 * two rows. A sum survives that; an average is halved and a record is hidden,
 * and nothing downstream can put it back. Deriving the key from the resident
 * makes her return to HER row, after a rebind or a reload alike.
 *
 * A controller bound to nobody still counts its stints (`#b1`, `#b2`): there is
 * no person to return to, and two unknown players must not share a line.
 */

export type Participant = {
	address: string;
	residentId?: string;
	/** Counts up each time this controller changes hands. Descriptive only — the key no longer uses it for a resident. */
	binding: number;
	/** Which stint of "nobody" this is, for the key of an unbound controller. */
	anonymous: number;
};

/** What a game supplies: its own numbers, against an address. */
export type ParticipantEntry = {
	address: string;
	score?: number;
	outcome?: ParticipantResult['outcome'];
	results?: { [key: string]: any };
};

export type RebindListener = (event: {
	address: string;
	/** The key that just froze. A game should stop adding to whatever it holds under it. */
	previousKey: string;
	previousResidentId?: string;
	residentId?: string;
	/** The key from now on. */
	key: string;
	/**
	 * This resident already played on this controller earlier in the launch, and
	 * `key` is HER earlier key. A game that keeps its tallies under the key picks
	 * up where she left off; one that zeroes a counter on every rebind must not
	 * report that zero under this key, or it overwrites what she had earned.
	 */
	resumed: boolean;
}) => void;

export class ParticipantRegistry {
	private _console: Console;
	private _known: Record<string, Participant> = {};
	/** Every resident each controller has carried during this launch. */
	private _held: Record<string, Set<string>> = {};
	private _listeners: RebindListener[] = [];

	constructor(console: Console) {
		this._console = console;
		this._console.onRequest((request, params) => {
			if (
				(request === 'deviceResidentNotification' || request === 'deviceConnectionNotification') &&
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
			device.isAssociatedToResident === false ? undefined : (device.resident?.id ?? undefined);

		const known = this._known[address];
		if (known === undefined) {
			this._known[address] = { address, residentId, binding: 1, anonymous: 1 };
			if (residentId !== undefined) this.heldBy(address).add(residentId);
			return this._known[address];
		}
		if (known.residentId === residentId) return known;

		const previousKey = this.keyFor(address);
		const previousResidentId = known.residentId;
		known.residentId = residentId;
		known.binding += 1;
		let resumed = false;
		if (residentId === undefined) {
			// A new stint of nobody: there is no person to return to.
			known.anonymous += 1;
		} else {
			resumed = this.heldBy(address).has(residentId);
			this.heldBy(address).add(residentId);
		}
		const key = this.keyFor(address);
		logger.log(
			`[participants] ${address} changed hands, now ${key}${resumed ? ' (back to her row)' : ''}`
		);
		for (const listener of this._listeners) {
			try {
				listener({ address, previousKey, previousResidentId, residentId, key, resumed });
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

	/**
	 * The telemetry key for this controller as it stands.
	 *
	 * Derived from who is on it, not counted: the same resident on the same
	 * controller gets the same key for the whole launch — after a rebind away
	 * and back, and after a page reload that rebuilt this registry from scratch.
	 */
	public keyFor(address: string): string {
		const known = this._known[address];
		if (known?.residentId !== undefined) return `${address}#r${known.residentId}`;
		return `${address}#b${known?.anonymous ?? 1}`;
	}

	private heldBy(address: string): Set<string> {
		return (this._held[address] ??= new Set());
	}

	public residentFor(address: string): string | undefined {
		return this._known[address]?.residentId;
	}

	/** Whether this controller has been seen at all — including bound to nobody,
	 *  which `residentFor` cannot distinguish from "never seen". */
	public knows(address: string): boolean {
		return this._known[address] !== undefined;
	}

	/**
	 * Turn a game's own numbers into rows the console can file.
	 *
	 * The game says what happened; the registry says who it happened to. Which is
	 * the split that was missing: every game was answering both questions, and
	 * getting the second one wrong.
	 */
	public build(entries: ParticipantEntry[]): ParticipantResult[] {
		return entries.map((entry) => {
			// An address the registry has never met is a real warning, not noise.
			// It means the seeding never happened, and the row about to be filed
			// carries no resident AND a binding that cannot count up — so the next
			// time that controller changes hands, the new resident writes into
			// this row instead of opening her own. Loud here, because the damage
			// only becomes visible weeks later on somebody's sheet.
			if (this._known[entry.address] === undefined) {
				logger.error(
					`[participants] ${entry.address} was never tracked — its key cannot follow a rebind. ` +
						`Call participants.track(device) for the controllers the game already knows about.`
				);
			}
			return {
				participantKey: this.keyFor(entry.address),
				deviceId: entry.address,
				residentId: this.residentFor(entry.address),
				score: entry.score,
				outcome: entry.outcome,
				results: entry.results
			};
		});
	}
}
