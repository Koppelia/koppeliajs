import { describe, it, expect } from 'vitest';
import { Play } from './play.js';
import { makeMockConsole, asConsole } from '../../test/mockConsole.js';

const raw = {
	name: 'My Play',
	game_id: 'game42',
	file_name: 'data.json',
	thumbnail: 'base64thumb'
};

describe('Play metadata', () => {
	it('reads name, id, image and data file from the raw object', () => {
		const p = new Play(asConsole(makeMockConsole()), 'play7', raw);
		expect(p.id).toBe('play7');
		expect(p.name).toBe('My Play');
		expect(p.image).toBe('base64thumb');
		expect(p.data).toBe('data.json');
	});

	it('tolerates a raw object missing optional fields', () => {
		const p = new Play(asConsole(makeMockConsole()), 'play7', {});
		expect(p.name).toBe('');
		expect(p.image).toBe('');
		expect(p.data).toBe('');
	});

	it('starts not loaded with empty content', () => {
		const p = new Play(asConsole(makeMockConsole()), 'play7', raw);
		expect(p.isPlayContentLoaded()).toBe(false);
		expect(p.playContent).toEqual({});
		expect(p.isRefreshed).toBe(true);
	});
});

describe('Play media paths', () => {
	it('builds a media path scoped to game and play', () => {
		const p = new Play(asConsole(makeMockConsole()), 'play7', raw);
		expect(p.getPlayMediaPath('img.png')).toBe('media/game/game42/play/play7/img.png');
	});

	it('resolves a full media link through the console', () => {
		const mock = makeMockConsole();
		const p = new Play(asConsole(mock), 'play7', raw);
		const link = p.getMediaLink('img.png');
		expect(link).toBe('http://console:8000/media/game/game42/play/play7/img.png');
		expect(mock.getMediaUrl).toHaveBeenCalledWith('media/game/game42/play/play7/img.png');
	});
});

describe('Play media content', () => {
	it('getMediaContent fetches the file through the console media API', async () => {
		const mock = makeMockConsole();
		mock.setMediaResponse({ hello: 'world' });
		const p = new Play(asConsole(mock), 'play7', raw);
		await expect(p.getMediaContent('x.json')).resolves.toEqual({ hello: 'world' });
		expect(mock.getMedia).toHaveBeenCalledWith('media/game/game42/play/play7/x.json');
	});

	it('updatePlayContent loads the main data file and flips the loaded flag', async () => {
		const mock = makeMockConsole();
		mock.setMediaResponse({ level: 1 });
		const p = new Play(asConsole(mock), 'play7', raw);
		await p.updatePlayContent();
		expect(p.isPlayContentLoaded()).toBe(true);
		expect(p.playContent).toEqual({ level: 1 });
	});
});
