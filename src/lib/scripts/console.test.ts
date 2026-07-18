import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Console } from './console.js';
import { Message } from './message.js';
import { routeType } from '../stores/routeStore.js';
import { MockWebSocket } from '../../test/setup.js';

beforeEach(() => {
	MockWebSocket.reset();
	routeType.set('');
});

const socketOf = () => MockWebSocket.instances.at(-1)!;

describe('Console media URLs', () => {
	it('getMediaUrl prefixes the API base and ensures a leading slash', () => {
		const c = new Console();
		expect(c.getMediaUrl('/media/a')).toBe('http://localhost:8000/media/a');
		expect(c.getMediaUrl('media/a')).toBe('http://localhost:8000/media/a');
	});

	it('fixMediaUrl rebases a foreign URL onto the console host, keeping path and query', () => {
		const c = new Console();
		expect(c.fixMediaUrl('http://other:9999/media/a?x=1')).toBe(
			'http://localhost:8000/media/a?x=1'
		);
	});
});

describe('Console readiness', () => {
	it('defers onReady until the socket opens, then fires', () => {
		const c = new Console();
		const cb = vi.fn();
		c.onReady(cb);
		expect(cb).not.toHaveBeenCalled();
		socketOf().emitOpen();
		expect(cb).toHaveBeenCalledOnce();
		expect(c.ready).toBe(true);
	});

	it('fires onReady immediately once already ready', () => {
		const c = new Console();
		socketOf().emitOpen();
		const cb = vi.fn();
		c.onReady(cb);
		expect(cb).toHaveBeenCalledOnce();
	});
});

describe('Console inbound routing', () => {
	it('routes changeState with the update flag', () => {
		const c = new Console();
		const cb = vi.fn();
		c.onStateChange(cb);
		socketOf().emitMessage({
			header: { type: 'request', from: 'master' },
			request: { exec: 'changeState', params: { state: { a: 1 }, update: true } }
		});
		expect(cb).toHaveBeenCalledWith('master', { a: 1 }, true);
	});

	it('routes changeStage', () => {
		const c = new Console();
		const cb = vi.fn();
		c.onStageChange(cb);
		socketOf().emitMessage({
			header: { type: 'request', from: 'master' },
			request: { exec: 'changeStage', params: { stage: 'game' } }
		});
		expect(cb).toHaveBeenCalledWith('master', 'game');
	});

	it('routes unknown requests to generic request handlers with source + address', () => {
		const c = new Console();
		const cb = vi.fn();
		c.onRequest(cb);
		socketOf().emitMessage({
			header: { type: 'request', from: 'master', from_addr: 'addr' },
			request: { exec: 'custom', params: { p: 1 } }
		});
		expect(cb).toHaveBeenCalledWith('custom', { p: 1 }, 'master', 'addr');
	});

	it('routes DATA_EXCHANGE messages', () => {
		const c = new Console();
		const cb = vi.fn();
		c.onDataExchange(cb);
		socketOf().emitMessage({
			header: { type: 'data_exchange', from: 'controller' },
			data: { x: 1 }
		});
		expect(cb).toHaveBeenCalledWith('controller', { x: 1 });
	});

	it('routes DEVICE_EVENT messages', () => {
		const c = new Console();
		const cb = vi.fn();
		c.onDeviceEvent(cb);
		socketOf().emitMessage({
			header: { type: 'device_event', device: 'dev', from_addr: 'aa' },
			event: 'press'
		});
		expect(cb).toHaveBeenCalledWith('dev', 'aa', 'press');
	});
});

describe('Console.unsubscribeCallback', () => {
	it('removes a handler so it stops receiving', () => {
		const c = new Console();
		const cb = vi.fn();
		const id = c.onStateChange(cb);
		expect(c.unsubscribeCallback(id)).toBe(true);
		socketOf().emitMessage({
			header: { type: 'request', from: 'm' },
			request: { exec: 'changeState', params: { state: {}, update: false } }
		});
		expect(cb).not.toHaveBeenCalled();
	});

	it('returns false for an unknown id', () => {
		const c = new Console();
		expect(c.unsubscribeCallback('nope')).toBe(false);
	});
});

describe('Console.sendMessage', () => {
	it('stamps the source peer from the current routeType', () => {
		routeType.set('monitor');
		const c = new Console();
		c.sendMessage(new Message());
		expect(socketOf().lastSentObject.header.from).toBe('monitor');
	});

	it('stamps NONE when the routeType is unset', () => {
		routeType.set('');
		const c = new Console();
		c.sendMessage(new Message());
		expect(socketOf().lastSentObject.header.from).toBe('none');
	});
});
