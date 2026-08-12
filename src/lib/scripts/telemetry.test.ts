import { describe, it, expect, beforeEach } from 'vitest';
import { Koppelia } from './koppelia.js';
import { PeerType } from './message.js';
import { routeType } from '../stores/routeStore.js';
import { MockWebSocket } from '../../test/setup.js';
import { serializeParticipant } from './telemetry.js';

const socketOf = () => MockWebSocket.instances.at(-1)!;
const lastSent = () => socketOf().lastSentObject;
const sentExecs = () => socketOf().sent.map((s) => JSON.parse(s).request.exec);

beforeEach(() => {
	MockWebSocket.reset();
	routeType.set('');
	(Koppelia as unknown as { _instance: Koppelia | undefined })._instance = undefined;
});

describe('reportResults', () => {
	it('sends the participants to the console', () => {
		Koppelia.instance.reportResults([
			{ participantKey: 'AA:BB:CC:DD:EE:01', score: 8 },
			{ participantKey: 'AA:BB:CC:DD:EE:02', score: 5 }
		]);

		const sent = lastSent();
		expect(sent.request.exec).toBe('reportResults');
		expect(sent.header.to).toBe(PeerType.MASTER);
		expect(sent.request.params.participants).toHaveLength(2);
	});

	it('sends nothing at all when there is nobody to report', () => {
		// A game with no players yet must not open an empty session's worth of
		// traffic on every round tick.
		Koppelia.instance.reportResults([]);

		expect(sentExecs()).not.toContain('reportResults');
	});

	it('never sends a session id — the console owns that', () => {
		// The game cannot know it, and letting it guess would let two games
		// write into each other's session.
		Koppelia.instance.reportResults([{ participantKey: 'p1', score: 1 }]);

		expect(JSON.stringify(lastSent())).not.toContain('session_id');
	});

	it('keeps each participant distinct, so a repeat call is one row each', () => {
		// The console upserts on the participant key: the same key twice must be
		// the same player, and two keys must never collapse into one.
		Koppelia.instance.reportResults([
			{ participantKey: 'p1', score: 1 },
			{ participantKey: 'p2', score: 2 }
		]);

		const keys = lastSent().request.params.participants.map(
			(p: { participant_key: string }) => p.participant_key
		);
		expect(new Set(keys).size).toBe(2);
	});
});

describe('serializeParticipant', () => {
	it('uses the snake_case names the database column is called', () => {
		const wire = serializeParticipant({
			participantKey: 'p1',
			residentId: 'res-9',
			deviceId: 'AA:BB:CC:DD:EE:01',
			score: 8,
			outcome: 'won',
			results: { correct: 8, total: 10 }
		});

		expect(wire).toEqual({
			participant_key: 'p1',
			resident_id: 'res-9',
			device_id: 'AA:BB:CC:DD:EE:01',
			score: 8,
			outcome: 'won',
			results: { correct: 8, total: 10 }
		});
	});

	it('drops what the game did not say instead of sending nulls', () => {
		// A missing resident_id means "this game does not know"; an explicit null
		// would overwrite one the console had already resolved from the peer table.
		const wire = serializeParticipant({ participantKey: 'p1' });

		expect(wire).toEqual({ participant_key: 'p1' });
	});

	it('sends dates as ISO strings, not Date objects', () => {
		const wire = serializeParticipant({
			participantKey: 'p1',
			joinedAt: new Date('2026-08-12T14:00:00Z'),
			leftAt: new Date('2026-08-12T14:30:00Z')
		});

		expect(wire.joined_at).toBe('2026-08-12T14:00:00.000Z');
		expect(wire.left_at).toBe('2026-08-12T14:30:00.000Z');
	});

	it('keeps a zero score, which is not the same as not playing', () => {
		// A player who scores nothing still produces a row: participant_count is
		// derived from these rows, so dropping them would undercount the session.
		const wire = serializeParticipant({ participantKey: 'p1', score: 0 });

		expect(wire.score).toBe(0);
	});
});

describe('reportSession', () => {
	it('sends the collective payload to the console', () => {
		Koppelia.instance.reportSession({ difficulty: 'hard', rounds: 12 });

		const sent = lastSent();
		expect(sent.request.exec).toBe('reportSession');
		expect(sent.header.to).toBe(PeerType.MASTER);
		expect(sent.request.params.payload).toEqual({ difficulty: 'hard', rounds: 12 });
	});

	it('carries no participant_count — the console derives it from the results', () => {
		// Two sources for one number is one too many, and the game's would be the
		// one that can silently disagree with the rows actually written.
		Koppelia.instance.reportSession({ difficulty: 'hard' });

		expect(JSON.stringify(lastSent())).not.toContain('participant_count');
	});

	it('is independent of reportResults', () => {
		Koppelia.instance.reportSession({ theme: 'animals' });
		Koppelia.instance.reportResults([{ participantKey: 'p1', score: 3 }]);

		expect(sentExecs()).toContain('reportSession');
		expect(sentExecs()).toContain('reportResults');
	});
});

describe('startNewSession', () => {
	it('asks the console to close this activity and open the next', () => {
		Koppelia.instance.startNewSession();

		const sent = lastSent();
		expect(sent.request.exec).toBe('startNewSession');
		expect(sent.header.to).toBe(PeerType.MASTER);
	});

	it('carries no session id — the console owns that', () => {
		// A game that could name a session could close somebody else's.
		Koppelia.instance.startNewSession();

		expect(JSON.stringify(lastSent())).not.toContain('session_id');
	});

	it('is independent of the reporting calls', () => {
		Koppelia.instance.reportResults([{ participantKey: 'p1', score: 3 }]);
		Koppelia.instance.startNewSession();
		Koppelia.instance.reportResults([{ participantKey: 'p1', score: 1 }]);

		expect(sentExecs()).toEqual(['reportResults', 'startNewSession', 'reportResults']);
	});
});
