import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { State } from './state.js';
import { Message } from './message.js';
import { makeMockConsole, asConsole } from '../../test/mockConsole.js';

describe('State outgoing broadcast', () => {
	it('broadcasts a minimal diff on updateState once the previous value is primed', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), { a: 1 });

		s.updateState({ b: 2 }); // primes _previousStateValue
		s.updateState({ b: 3 }); // only b changed

		const last = mock.sentWithExec('changeState').at(-1)!;
		expect(last.getParam('state')).toEqual({ b: 3 });
		expect(last.getParam('update')).toBe(true);
	});

	it('does not broadcast at all when nothing actually changed', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		s.updateState({ a: 1, b: 2 }); // prime → one broadcast
		const before = mock.sentWithExec('changeState').length;
		s.updateState({ a: 1, b: 2 }); // identical → empty diff → no broadcast
		expect(mock.sentWithExec('changeState').length).toBe(before);
	});

	it('diffs object values by value: an unchanged object is not re-broadcast', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		s.updateState({ config: { v: 1 }, n: 0 }); // prime
		const before = mock.sentWithExec('changeState').length;
		s.updateState({ n: 1 }); // config object untouched
		const last = mock.sentWithExec('changeState').at(-1)!;
		expect(mock.sentWithExec('changeState').length).toBe(before + 1);
		expect(last.getParam('state')).toEqual({ n: 1 }); // config NOT included
	});

	it('detects array changes by value, not reference', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		s.updateState({ list: [1, 2] }); // prime
		s.updateState({ list: [1, 2, 3] });

		const last = mock.sentWithExec('changeState').at(-1)!;
		expect(last.getParam('state')).toEqual({ list: [1, 2, 3] });
	});

	it('setState with force broadcasts the full state with update=false', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		s.setState({ x: 1, y: 2 }, true);

		const last = mock.sentWithExec('changeState').at(-1)!;
		expect(last.getParam('state')).toEqual({ x: 1, y: 2 });
		expect(last.getParam('update')).toBe(false);
	});
});

describe('State inbound receive', () => {
	it('merges a partial update into the store', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), { a: 1 });
		mock.trigger.stateChange('master', { a: 2, c: 3 }, true);
		expect(get(s.state)).toMatchObject({ a: 2, c: 3 });
	});

	it('replaces the whole store on a non-update receive', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), { a: 1, b: 2 });
		mock.trigger.stateChange('master', { only: 1 }, false);
		expect(get(s.state)).toEqual({ only: 1 });
	});

	it('suppresses the echo: received keys are not re-broadcast', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), { a: 1 });
		const before = mock.sentWithExec('changeState').length;
		mock.trigger.stateChange('master', { a: 2, c: 3 }, true);
		expect(mock.sentWithExec('changeState').length).toBe(before);
	});
});

describe('State echo-suppression edge cases', () => {
	// This was the echo bug (see pictionary refactor cd52c9d): a subscriber
	// reacting to an inbound update by mutating state used to be swallowed. The fix
	// (value diff + empty-update guard, no blanket mute) now broadcasts it.
	it('broadcasts a reaction made during receive (echo-bug fix)', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		let reacted = false;
		s.state.subscribe((st) => {
			const state = st as Record<string, unknown>;
			if (state.incoming && !reacted) {
				reacted = true;
				s.updateState({ reaction: 'x' });
			}
		});

		mock.trigger.stateChange('master', { incoming: true }, true);

		// applied locally...
		expect(get(s.state)).toMatchObject({ incoming: true, reaction: 'x' });
		// ...AND sent on the wire now.
		const reactionBroadcasts = mock
			.sentWithExec('changeState')
			.filter((m) => 'reaction' in ((m.getParam('state') as object) ?? {}));
		expect(reactionBroadcasts).toHaveLength(1);
	});

	it('a reaction broadcast carries only the reaction keys, not the received echo', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		let reacted = false;
		s.state.subscribe((st) => {
			const state = st as Record<string, unknown>;
			if (state.incoming && !reacted) {
				reacted = true;
				s.updateState({ reaction: 'x' });
			}
		});

		mock.trigger.stateChange('master', { incoming: true }, true);

		const reactionMsg = mock
			.sentWithExec('changeState')
			.find((m) => 'reaction' in ((m.getParam('state') as object) ?? {}))!;
		expect(reactionMsg.getParam('state')).toEqual({ reaction: 'x' });
		expect('incoming' in (reactionMsg.getParam('state') as object)).toBe(false);
	});

	it('does not broadcast anything for a pure echo (no reaction) — loop-safe', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), { a: 1 });
		const before = mock.sentWithExec('changeState').length;
		mock.trigger.stateChange('master', { a: 2, obj: { k: 1 } }, true);
		expect(mock.sentWithExec('changeState').length).toBe(before);
	});

	it('restores broadcasting after a receive completes', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		mock.trigger.stateChange('master', { incoming: true }, true);

		const before = mock.sentWithExec('changeState').length;
		s.updateState({ post: 1 });
		expect(mock.sentWithExec('changeState').length).toBe(before + 1);
	});
});

describe('State.updateFromServer', () => {
	it('requests the state and applies the server response', () => {
		const mock = makeMockConsole();
		const s = new State(asConsole(mock), {});
		// The constructor already fired getState via onReady; answer it.
		expect(mock.sentWithExec('getState').length).toBeGreaterThan(0);

		const response = new Message();
		response.addParam('state', { hydrated: 1 });
		mock.respondLast(response);

		expect(get(s.state)).toMatchObject({ hydrated: 1 });
	});
});
