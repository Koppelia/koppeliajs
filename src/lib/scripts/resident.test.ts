import { describe, it, expect } from 'vitest';
import { Resident } from './resident.js';

describe('Resident', () => {
	it('hydrates fields from a raw object', () => {
		const r = new Resident();
		r.fromObject({ name: 'Alice', id: 'r1', image: 'a.png', residence_id: 'res1' });
		expect(r.id).toBe('r1');
		expect(r.name).toBe('Alice');
	});

	it('builds the image URL from residence, id and image via the console media API', () => {
		const r = new Resident();
		r.fromObject({ name: 'Alice', id: 'r1', image: 'a.png', residence_id: 'res1' });
		// Koppelia singleton resolves media through the console (jsdom host = localhost:8000).
		expect(r.imageUrl).toBe('http://localhost:8000/media/residence/res1/resident/r1/a.png');
	});
});
