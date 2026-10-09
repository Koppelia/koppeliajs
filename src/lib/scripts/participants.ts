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
 * and another sits down — so the key names WHO is on it: `<address>#r<fingerprint of residentId>`.
 * The first resident's row freezes with what she earned; the second starts her
 * own. Anything else merges two people into one line.
 *
 * The resident appears in the key as a FINGERPRINT, not as her id. The row
 * already carries `resident_id`, and the database detaches it (`ON DELETE SET
 * NULL`) when a resident is removed; an id copied into the key would survive
 * that and quietly re-attach her care data to her. A fingerprint keeps the key
 * stable without being the id.
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
	/**
	 * The key these numbers were counted under, when the game kept it — e.g.
	 * tallies stored per `keyFor(address)`. Pass it whenever a row may be about
	 * somebody who no longer holds the controller: the row then goes to the
	 * person who EARNED it. Without it, the row is filed under whoever holds
	 * the controller at the moment of sending.
	 */
	participantKey?: string;
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
	/**
	 * Who each key ever minted belongs to (`null` = nobody). A key outlives the
	 * hand that held the controller: a game re-sending a previous player's
	 * cumulative row must still file it under HER, not under whoever holds the
	 * controller when the report goes out.
	 */
	private _keyOwner: Record<string, string | null> = {};
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
			this._keyOwner[this.keyFor(address)] = residentId ?? null;
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
		this._keyOwner[key] = residentId ?? null;
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
		if (known?.residentId !== undefined) return residentKey(address, known.residentId);
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
			// The key the numbers were counted under wins, and so does its owner:
			// re-sending a previous player's row must not hand it to the person
			// holding the controller now. A key this registry never minted is
			// passed through with no resident claimed rather than a guessed one.
			const participantKey = entry.participantKey ?? this.keyFor(entry.address);
			const owner =
				entry.participantKey !== undefined
					? this._keyOwner[entry.participantKey]
					: (this.residentFor(entry.address) ?? null);
			return {
				participantKey,
				deviceId: entry.address,
				// `null`, not undefined, for nobody: the console must not fill the
				// gap with whoever holds the controller when the row arrives.
				residentId: owner === undefined ? null : owner,
				score: entry.score,
				outcome: entry.outcome,
				results: entry.results
			};
		});
	}
}

/**
 * `<address>#r<fingerprint>` — the same resident on the same controller always
 * gets the same key, and the key does not contain her id.
 *
 * cyrb53, synchronous on purpose: `crypto.subtle` is async and absent outside a
 * secure context, and a console tablet on plain HTTP over the LAN is exactly
 * that. Not a security boundary — a stable pseudonym, 53 bits, so two residents
 * of one controller in one launch cannot realistically collide.
 */
export function residentKey(address: string, residentId: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < residentId.length; i++) {
		const ch = residentId.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	const fingerprint = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
	return `${address}#r${fingerprint}`;
}
