import { describe, it, expect, vi, afterEach } from 'vitest';
import { Song } from './song.js';

const raw = {
	id: 's1',
	name: 'La Mer',
	album: 'Classics',
	artist: 'Trenet',
	length: 210,
	year: 1946,
	style: 'chanson',
	country: 'FR',
	song_file: 'track.mp3',
	lyrics_file: 'lyrics.txt',
	cover_file: 'cover.jpg',
	backing_track_file: 'backing.mp3',
	lyrics_track_file: 'voice.mp3'
};

describe('Song metadata', () => {
	it('hydrates metadata from a raw object', () => {
		const s = new Song();
		s.fromObject(raw);
		expect(s.id).toBe('s1');
		expect(s.name).toBe('La Mer');
		expect(s.album).toBe('Classics');
		expect(s.artist).toBe('Trenet');
		expect(s.year).toBe(1946);
		expect(s.length).toBe(210);
		expect(s.style).toBe('chanson');
		expect(s.country).toBe('FR');
	});
});

describe('Song media URLs', () => {
	it('resolves each media file under the song folder', () => {
		const s = new Song();
		s.fromObject(raw);
		const base = 'http://localhost:8000/media/song/s1';
		expect(s.songUrl).toBe(`${base}/track.mp3`);
		expect(s.coverUrl).toBe(`${base}/cover.jpg`);
		expect(s.lyricsUrl).toBe(`${base}/lyrics.txt`);
		expect(s.songBackingUrl).toBe(`${base}/backing.mp3`);
		expect(s.songLyricsUrl).toBe(`${base}/voice.mp3`);
	});

	it('getMediaUrl builds an arbitrary path under the song folder', () => {
		const s = new Song();
		s.fromObject(raw);
		expect(s.getMediaUrl('extra.bin')).toBe('http://localhost:8000/media/song/s1/extra.bin');
		expect(s.getSongsFolderPath()).toBe('/media/song/s1');
	});
});

describe('Song.getLyrics', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('fetches the lyrics file and returns its text', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ text: async () => 'la la la' }))
		);
		const s = new Song();
		s.fromObject(raw);
		await expect(s.getLyrics()).resolves.toBe('la la la');
		expect(fetch).toHaveBeenCalledWith('http://localhost:8000/media/song/s1/lyrics.txt');
	});
});
