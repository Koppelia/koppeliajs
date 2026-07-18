import { describe, it, expect } from 'vitest';
import { Game } from './game.js';

// Game is currently an empty placeholder; this pins that contract so a future
// implementation has to update the test deliberately.
describe('Game (placeholder)', () => {
	it('constructs and its methods are no-ops for now', () => {
		const g = new Game();
		expect(g).toBeInstanceOf(Game);
		expect(g.getGameId()).toBeUndefined();
		expect(g.getGameFile()).toBeUndefined();
	});
});
