import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { AudioManager, audioManager } from './audioManager.js';

// AudioInstance keeps its HTMLAudioElement private; tests read it through a cast
// to assert the volume mapping, which is real clamp logic worth covering.
function audioEl(instance: unknown) {
	return (instance as { audio: { volume: number; loop: boolean } }).audio;
}

describe('AudioManager playback', () => {
	it('creates and plays a player on first play', () => {
		const m = new AudioManager();
		m.play('beep');
		expect(m.isPlaying('beep')).toBe(true);
		expect(m.getPlayerInstance('beep')?.getId()).toBe('beep');
	});

	it('reuses the same player instance for the same id', () => {
		const m = new AudioManager();
		m.play('beep');
		const first = m.getPlayerInstance('beep');
		m.play('beep');
		expect(m.getPlayerInstance('beep')).toBe(first);
	});

	it('pause and stop mark the player as not playing', () => {
		const m = new AudioManager();
		m.play('beep');
		m.pause('beep');
		expect(m.isPlaying('beep')).toBe(false);

		m.play('beep');
		m.stop('beep');
		expect(m.isPlaying('beep')).toBe(false);
	});

	it('isPlaying is false for an unknown id', () => {
		const m = new AudioManager();
		expect(m.isPlaying('ghost')).toBe(false);
	});

	it('stopAll and pauseAll act on every player', () => {
		const m = new AudioManager();
		m.play('a');
		m.play('b');
		m.stopAll();
		expect(m.isPlaying('a')).toBe(false);
		expect(m.isPlaying('b')).toBe(false);
	});

	it('exposes the mocked duration', () => {
		const m = new AudioManager();
		m.play('a');
		expect(m.getPlayerInstance('a')?.getDuration()).toBe(123);
	});

	it('play with a url uses that url as the audio source', () => {
		const m = new AudioManager();
		m.play('u', false, 'http://x/a.mp3');
		expect((m.getPlayerInstance('u') as unknown as { audio: { src: string } }).audio.src).toBe(
			'http://x/a.mp3'
		);
	});

	it('pauseAll pauses every player', () => {
		const m = new AudioManager();
		m.play('a');
		m.play('b');
		m.pauseAll();
		expect(m.isPlaying('a')).toBe(false);
		expect(m.isPlaying('b')).toBe(false);
	});
});

describe('AudioManager volume', () => {
	it('maps a 0-100 volume onto the 0-1 audio element range', () => {
		const m = new AudioManager();
		m.play('a');
		m.setVolume('a', 50);
		expect(audioEl(m.getPlayerInstance('a')).volume).toBeCloseTo(0.5);
	});

	it('clamps out-of-range volumes', () => {
		const m = new AudioManager();
		m.play('a');
		m.setVolume('a', 150);
		expect(audioEl(m.getPlayerInstance('a')).volume).toBe(1);
		m.setVolume('a', -20);
		expect(audioEl(m.getPlayerInstance('a')).volume).toBe(0);
	});

	it('setVolume on an unknown id is a no-op', () => {
		const m = new AudioManager();
		expect(() => m.setVolume('ghost', 10)).not.toThrow();
	});
});

describe('audioManager store', () => {
	it('exports a writable holding an AudioManager', () => {
		expect(get(audioManager)).toBeInstanceOf(AudioManager);
	});
});
