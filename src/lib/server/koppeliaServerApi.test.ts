import { describe, it, expect } from 'vitest';
import { KoppeliaServerApi } from './koppeliaServerApi.js';

const api = new KoppeliaServerApi('/tmp/games');

describe('KoppeliaServerApi.getContentType', () => {
	it('maps text-based extensions', () => {
		expect(api.getContentType('index.html')).toBe('text/html');
		expect(api.getContentType('style.css')).toBe('text/css');
		expect(api.getContentType('app.js')).toBe('text/javascript; charset=utf-8');
	});

	it('maps image extensions to image/<ext>', () => {
		expect(api.getContentType('a.png')).toBe('image/png');
		expect(api.getContentType('a.jpg')).toBe('image/jpg');
		expect(api.getContentType('a.webp')).toBe('image/webp');
	});

	it('maps audio extensions to audio/<ext>', () => {
		expect(api.getContentType('a.mp3')).toBe('audio/mp3');
		expect(api.getContentType('a.ogg')).toBe('audio/ogg');
	});

	it('maps application extensions', () => {
		expect(api.getContentType('a.json')).toBe('application/json');
		expect(api.getContentType('a.pdf')).toBe('application/pdf');
		expect(api.getContentType('a.xml')).toBe('application/xml');
	});

	it('returns empty string for unknown or missing extensions', () => {
		expect(api.getContentType('a.xyz')).toBe('');
		expect(api.getContentType('noext')).toBe('');
	});
});
