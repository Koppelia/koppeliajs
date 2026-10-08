import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParticipantRegistry, residentKey } from './participants.js';
import { logger } from './logger.js';
import { makeMockConsole, asConsole } from '../../test/mockConsole.js';

const A = 'AA:BB:CC:DD:EE:01';
const B = 'AA:BB:CC:DD:EE:02';

function bound(address: string, residentId?: string) {
	return {
		address,
		resident: residentId ? { id: residentId } : null,
		isAssociatedToResident: residentId !== undefined
	};
}

let registry: ParticipantRegistry;

beforeEach(() => {
	registry = new ParticipantRegistry(asConsole(makeMockConsole()));
});

describe('who is on a controller', () => {
	it('keys on the address, never on a name', () => {
		// A name is a label an animator can retype mid-game. The quiz keyed on it
		// and a rename minted a brand-new player at zero, losing the resident the
		// points she had just won.
		registry.track(bound(A, 'res-1'));

		expect(registry.keyFor(A)).toBe(residentKey(A, 'res-1'));
		expect(registry.residentFor(A)).toBe('res-1');
	});

	it('keeps the resident id, which games kept dropping', () => {
		registry.track(bound(A, 'res-1'));

		expect(registry.residentFor(A)).toBe('res-1');
	});

	it('treats an unbound controller as nobody', () => {
		registry.track(bound(A));

		expect(registry.residentFor(A)).toBeUndefined();
		expect(registry.keyFor(A)).toBe(`${A}#b1`);
	});

	it('gives an unknown controller a usable key rather than throwing', () => {
		expect(registry.keyFor('AA:BB:CC:DD:EE:09')).toBe('AA:BB:CC:DD:EE:09#b1');
	});
});

describe('a controller changing hands', () => {
	it('mints a new key so two people never share a row', () => {
		registry.track(bound(A, 'res-1'));
		const first = registry.keyFor(A);

		registry.track(bound(A, 'res-2'));

		expect(registry.keyFor(A)).not.toBe(first);
		expect(registry.keyFor(A)).toBe(residentKey(A, 'res-2'));
		expect(registry.residentFor(A)).toBe('res-2');
	});

	it('tells the game, so it can freeze what it was counting', () => {
		const seen: unknown[] = [];
		registry.track(bound(A, 'res-1'));
		registry.onRebind((e) => seen.push(e));

		registry.track(bound(A, 'res-2'));

		expect(seen).toEqual([
			{
				address: A,
				previousKey: residentKey(A, 'res-1'),
				previousResidentId: 'res-1',
				residentId: 'res-2',
				key: residentKey(A, 'res-2'),
				resumed: false
			}
		]);
	});

	it('stays quiet when the same resident is re-announced', () => {
		// An animator retyping a name that resolves to the same person has not
		// changed who is playing.
		const seen: unknown[] = [];
		registry.track(bound(A, 'res-1'));
		registry.onRebind((e) => seen.push(e));

		registry.track(bound(A, 'res-1'));
		registry.track(bound(A, 'res-1'));

		expect(seen).toHaveLength(0);
		expect(registry.keyFor(A)).toBe(residentKey(A, 'res-1'));
	});

	it('counts an unbinding as a change too', () => {
		// Renamed to something matching nobody: the game must stop crediting the
		// resident who was there.
		registry.track(bound(A, 'res-1'));

		const hers = registry.keyFor(A);
		registry.track(bound(A));

		expect(registry.keyFor(A)).not.toBe(hers);
		expect(registry.keyFor(A)).toMatch(/#b\d+$/);
		expect(registry.residentFor(A)).toBeUndefined();
	});

	it('keeps controllers independent', () => {
		registry.track(bound(A, 'res-1'));
		registry.track(bound(B, 'res-2'));

		registry.track(bound(A, 'res-3'));

		expect(registry.keyFor(A)).toBe(residentKey(A, 'res-3'));
		expect(registry.keyFor(B)).toBe(residentKey(B, 'res-2'));
	});

	it('does not let one broken listener stop the others', () => {
		const seen: string[] = [];
		registry.track(bound(A, 'res-1'));
		registry.onRebind(() => {
			throw new Error('boom');
		});
		registry.onRebind(() => seen.push('ran'));

		registry.track(bound(A, 'res-2'));

		expect(seen).toEqual(['ran']);
	});
});

describe('building the rows', () => {
	it('answers "who" so the game only has to answer "what"', () => {
		registry.track(bound(A, 'res-1'));

		const rows = registry.build([{ address: A, score: 8, results: { correct: 8 } }]);

		expect(rows).toEqual([
			{
				participantKey: residentKey(A, 'res-1'),
				deviceId: A,
				residentId: 'res-1',
				score: 8,
				outcome: undefined,
				results: { correct: 8 }
			}
		]);
	});

	it('leaves the resident out rather than inventing one', () => {
		registry.track(bound(A));

		expect(registry.build([{ address: A, score: 1 }])[0].residentId).toBeUndefined();
	});

	it('says so loudly when asked about a controller it was never told about', () => {
		// The silent version of this is the whole bug: an untracked address gets
		// binding 1 and no resident, and the NEXT hand-over files the new resident
		// into the same row. Two games shipped it independently.
		const errors: unknown[] = [];
		const spy = vi.spyOn(logger, 'error').mockImplementation((m) => errors.push(m));

		registry.build([{ address: A, score: 3 }]);

		expect(errors).toHaveLength(1);
		expect(String(errors[0])).toContain(A);
		spy.mockRestore();
	});

	it('stays quiet about a controller it knows', () => {
		const errors: unknown[] = [];
		const spy = vi.spyOn(logger, 'error').mockImplementation((m) => errors.push(m));

		registry.track(bound(A, 'res-1'));
		registry.build([{ address: A, score: 3 }]);

		expect(errors).toHaveLength(0);
		spy.mockRestore();
	});

	it('files the two halves of a rebind under different keys', () => {
		registry.track(bound(A, 'res-1'));
		const before = registry.build([{ address: A, score: 5 }]);
		registry.track(bound(A, 'res-2'));
		const after = registry.build([{ address: A, score: 2 }]);

		expect(before[0].participantKey).not.toBe(after[0].participantKey);
		expect(before[0].residentId).toBe('res-1');
		expect(after[0].residentId).toBe('res-2');
	});
});

describe('the key does not carry the resident id', () => {
	it('is stable for her, distinct from others, and does not contain her id', () => {
		const id = '627891de-4ecc-495a-ad18-0b5d3d331aea';
		expect(residentKey(A, id)).toBe(residentKey(A, id));
		expect(residentKey(A, id)).not.toBe(residentKey(A, 'another'));
		expect(residentKey(A, id)).not.toContain(id);
		expect(residentKey(A, id).startsWith(`${A}#r`)).toBe(true);
	});
});

describe('one person, one row — the split that used to halve her averages', () => {
	it('gives her back HER key when the controller returns to her', () => {
		// Renamed away from her and back: until 1.10 that was three keys (#b1,
		// #b2, #b3) and her afternoon became two rows — a streak of six recorded
		// as 3 + 3 read as 3 on her sheet.
		const seen: { key: string; resumed: boolean }[] = [];
		registry.track(bound(A, 'res-1'));
		const hers = registry.keyFor(A);
		registry.onRebind((e) => seen.push({ key: e.key, resumed: e.resumed }));

		registry.track(bound(A));
		registry.track(bound(A, 'res-1'));

		expect(registry.keyFor(A)).toBe(hers);
		expect(seen.at(-1)).toEqual({ key: hers, resumed: true });
	});

	it('still keeps two people apart, both ways round', () => {
		registry.track(bound(A, 'res-1'));
		registry.track(bound(A, 'res-2'));
		registry.track(bound(A, 'res-1'));

		expect(registry.keyFor(A)).toBe(residentKey(A, 'res-1'));
		registry.track(bound(A, 'res-2'));
		expect(registry.keyFor(A)).toBe(residentKey(A, 'res-2'));
	});

	it('survives a page reload, which rebuilds the registry from scratch', () => {
		// The monitor reloading mid-game used to restart every counter at #b1 —
		// so a resident on her second binding came back under somebody else's
		// key, and her next cumulative report overwrote THEIR row.
		registry.track(bound(A, 'res-1'));
		registry.track(bound(A, 'res-2'));
		const before = registry.keyFor(A);

		const reloaded = new ParticipantRegistry(asConsole(makeMockConsole()));
		reloaded.track(bound(A, 'res-2'));

		expect(reloaded.keyFor(A)).toBe(before);
	});

	it('gives two separate stints of nobody two rows', () => {
		// No person to return to — and two unknown players must not share a line.
		registry.track(bound(A));
		const first = registry.keyFor(A);
		registry.track(bound(A, 'res-1'));
		registry.track(bound(A));

		expect(registry.keyFor(A)).not.toBe(first);
	});

	it('gives the same resident on two controllers two rows', () => {
		// Two controllers are two participants in the game; merging them would
		// let one controller's cumulative report overwrite the other's.
		registry.track(bound(A, 'res-1'));
		registry.track(bound(B, 'res-1'));

		expect(registry.keyFor(A)).not.toBe(registry.keyFor(B));
	});
});
