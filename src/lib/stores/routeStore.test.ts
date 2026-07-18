import { describe, it, expect, beforeEach } from 'vitest';
import { get, type Writable } from 'svelte/store';
import { page } from '$app/stores';
import { routeType, updateRoute } from './routeStore.js';

// In the test env `$app/stores` is aliased to a writable mock (see vitest.config).
const writablePage = page as unknown as Writable<{ url: URL }>;

function setPath(pathname: string) {
	writablePage.set({ url: new URL(`http://localhost${pathname}`) });
}

beforeEach(() => {
	routeType.set('');
	setPath('/');
});

describe('updateRoute', () => {
	it('detects a controller route', () => {
		setPath('/game/controller/home');
		updateRoute();
		expect(get(routeType)).toBe('controller');
	});

	it('detects a monitor route', () => {
		setPath('/game/monitor/game');
		updateRoute();
		expect(get(routeType)).toBe('monitor');
	});

	it('falls back to empty string for an unrelated route', () => {
		setPath('/some/other/path');
		updateRoute();
		expect(get(routeType)).toBe('');
	});

	it('matches "controller" anywhere in the path', () => {
		setPath('/x/controller-ish/y');
		updateRoute();
		expect(get(routeType)).toBe('controller');
	});

	it('routeType defaults to empty string', () => {
		expect(get(routeType)).toBe('');
	});
});
