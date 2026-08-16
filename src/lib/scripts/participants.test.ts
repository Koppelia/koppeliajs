import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParticipantRegistry } from './participants.js';
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

		expect(registry.keyFor(A)).toBe(`${A}#b1`);
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
		expect(registry.keyFor(A)).toBe(`${A}#b2`);
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
				previousKey: `${A}#b1`,
				previousResidentId: 'res-1',
				residentId: 'res-2'
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
		expect(registry.keyFor(A)).toBe(`${A}#b1`);
	});

	it('counts an unbinding as a change too', () => {
		// Renamed to something matching nobody: the game must stop crediting the
		// resident who was there.
		registry.track(bound(A, 'res-1'));

		registry.track(bound(A));

		expect(registry.keyFor(A)).toBe(`${A}#b2`);
		expect(registry.residentFor(A)).toBeUndefined();
	});

	it('keeps controllers independent', () => {
		registry.track(bound(A, 'res-1'));
		registry.track(bound(B, 'res-2'));

		registry.track(bound(A, 'res-3'));

		expect(registry.keyFor(A)).toBe(`${A}#b2`);
		expect(registry.keyFor(B)).toBe(`${B}#b1`);
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
				participantKey: `${A}#b1`,
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
