import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KoppeliaWebsocket } from './koppeliaWebsocket.js';
import { Message } from './message.js';
import { MockWebSocket } from '../../test/setup.js';

beforeEach(() => MockWebSocket.reset());

const lastSocket = () => MockWebSocket.instances.at(-1)!;

describe('KoppeliaWebsocket.send', () => {
	it('generates a request id, serializes and transmits the message', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const msg = new Message();
		msg.setRequest('ping');
		ws.send(msg);

		expect(msg.getRequestId()).not.toBe('');
		const sent = lastSocket().lastSentObject;
		expect(sent.request.exec).toBe('ping');
		expect(sent.header.id).toBe(msg.getRequestId());
	});
});

describe('KoppeliaWebsocket response routing', () => {
	it('routes a response to the matching request callback', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const cb = vi.fn();
		const msg = new Message();
		ws.send(msg, cb);

		lastSocket().emitMessage({ header: { id: msg.getRequestId(), type: 'response' } });
		expect(cb).toHaveBeenCalledOnce();
		expect(cb.mock.calls[0][0].getRequestId()).toBe(msg.getRequestId());
	});

	it('broadcasts an unmatched message to global receive callbacks', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const global = vi.fn();
		ws.onReceive(global);

		lastSocket().emitMessage({ header: { id: '', type: 'request' }, request: { exec: 'x' } });
		expect(global).toHaveBeenCalledOnce();
	});

	it('prefers the request callback and skips the global one on a match', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const global = vi.fn();
		const reqCb = vi.fn();
		ws.onReceive(global);
		const msg = new Message();
		ws.send(msg, reqCb);

		lastSocket().emitMessage({ header: { id: msg.getRequestId(), type: 'response' } });
		expect(reqCb).toHaveBeenCalledOnce();
		expect(global).not.toHaveBeenCalled();
	});

	it('consumes the ongoing request so a repeat response falls through to global', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const global = vi.fn();
		const reqCb = vi.fn();
		ws.onReceive(global);
		const msg = new Message();
		ws.send(msg, reqCb);
		const id = msg.getRequestId();

		lastSocket().emitMessage({ header: { id, type: 'response' } });
		lastSocket().emitMessage({ header: { id, type: 'response' } });
		expect(reqCb).toHaveBeenCalledOnce();
		expect(global).toHaveBeenCalledOnce();
	});
});

describe('KoppeliaWebsocket.onOpen', () => {
	it('fires the open callback when the socket opens', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const opened = vi.fn();
		ws.onOpen(opened);
		lastSocket().emitOpen();
		expect(opened).toHaveBeenCalledOnce();
	});
});

describe('KoppeliaWebsocket resilience', () => {
	it('reconnects a second after the socket closes', () => {
		vi.useFakeTimers();
		try {
			new KoppeliaWebsocket('ws://x');
			const before = MockWebSocket.instances.length;
			lastSocket().onclose?.({ reason: 'bye', code: 1006 });
			vi.advanceTimersByTime(1000);
			expect(MockWebSocket.instances.length).toBe(before + 1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('send is a no-op when the socket is not instantiated', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		ws.socket = undefined;
		expect(() => ws.send(new Message())).not.toThrow();
	});
});
