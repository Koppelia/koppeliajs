import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { gameState } from './stateStore.js';

describe('gameState store', () => {
	it('is a writable that starts empty and accepts updates', () => {
		expect(get(gameState)).toEqual({});
		gameState.set({ a: 1 });
		expect(get(gameState)).toEqual({ a: 1 });
	});
});
