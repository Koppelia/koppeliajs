import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KoppeliaWebsocket } from './koppeliaWebsocket.js';
import { Message } from './message.js';
import { MockWebSocket } from '../../test/setup.js';

beforeEach(() => MockWebSocket.reset());

const lastSocket = () => MockWebSocket.instances.at(-1)!;

/** A connected client. Tests about routing are not tests about the handshake. */
const connected = (url = 'ws://x') => {
	const ws = new KoppeliaWebsocket(url);
	if (lastSocket().readyState !== MockWebSocket.OPEN) lastSocket().open();
	return ws;
};

describe('KoppeliaWebsocket.send', () => {
	it('generates a request id, serializes and transmits the message', () => {
		const ws = connected();
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
		const ws = connected();
		const cb = vi.fn();
		const msg = new Message();
		ws.send(msg, cb);

		lastSocket().emitMessage({ header: { id: msg.getRequestId(), type: 'response' } });
		expect(cb).toHaveBeenCalledOnce();
		expect(cb.mock.calls[0][0].getRequestId()).toBe(msg.getRequestId());
	});

	it('broadcasts an unmatched message to global receive callbacks', () => {
		const ws = connected();
		const global = vi.fn();
		ws.onReceive(global);

		lastSocket().emitMessage({ header: { id: '', type: 'request' }, request: { exec: 'x' } });
		expect(global).toHaveBeenCalledOnce();
	});

	it('prefers the request callback and skips the global one on a match', () => {
		const ws = connected();
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
		const ws = connected();
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
		const ws = connected();
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
		const ws = connected();
		ws.socket = undefined;
		expect(() => ws.send(new Message())).not.toThrow();
	});
});

describe('KoppeliaWebsocket.send before the socket is open', () => {
	// The only suite that drives a real handshake: everything here is ABOUT the window
	// between `new WebSocket()` and 'open'.
	beforeEach(() => {
		MockWebSocket.autoOpen = false;
	});

	it('does not throw when the socket is still connecting', () => {
		// The crash this whole guard exists for: a game's state subscription fires
		// synchronously at mount, milliseconds before the handshake completes, and the
		// raw send() threw an unhandled InvalidStateError into the game's console.
		const ws = new KoppeliaWebsocket('ws://x');
		const msg = new Message();
		msg.setRequest('reportSession');

		expect(() => ws.send(msg)).not.toThrow();
	});

	it('sends what was written while connecting, once it opens', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const msg = new Message();
		msg.setRequest('reportSession');
		ws.send(msg);

		expect(lastSocket().sent).toHaveLength(0);
		lastSocket().open();

		expect(lastSocket().sent).toHaveLength(1);
		expect(lastSocket().lastSentObject.request.exec).toBe('reportSession');
	});

	it('keeps the order they were written in', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		for (const exec of ['first', 'second', 'third']) {
			const msg = new Message();
			msg.setRequest(exec);
			ws.send(msg);
		}
		lastSocket().open();

		const order = lastSocket().sent.map((raw) => JSON.parse(raw).request.exec);
		expect(order).toEqual(['first', 'second', 'third']);
	});

	it('still routes the response to a callback registered before the socket opened', () => {
		// The callback's timeout must start when the frame LEAVES, not when it was
		// written: a request queued through a reconnect would otherwise have expired
		// before its answer came back.
		const ws = new KoppeliaWebsocket('ws://x');
		const cb = vi.fn();
		const msg = new Message();
		ws.send(msg, cb);
		lastSocket().open();

		lastSocket().emitMessage({ header: { id: msg.getRequestId(), type: 'response' } });
		expect(cb).toHaveBeenCalledOnce();
	});

	it('drops the oldest rather than growing without limit', () => {
		// A console whose server never comes back would otherwise grow this for as long
		// as the page stays up.
		const ws = new KoppeliaWebsocket('ws://x');
		for (let i = 0; i < 150; i++) {
			const msg = new Message();
			msg.setRequest(`exec-${i}`);
			ws.send(msg);
		}
		lastSocket().open();

		const sent = lastSocket().sent.map((raw) => JSON.parse(raw).request.exec);
		expect(sent).toHaveLength(100);
		expect(sent[0]).toBe('exec-50');
		expect(sent.at(-1)).toBe('exec-149');
	});

	it('empties the buffer even when a flush fails, so it cannot grow on every reconnect', () => {
		const ws = new KoppeliaWebsocket('ws://x');
		const msg = new Message();
		ws.send(msg);

		const socket = lastSocket();
		socket.readyState = MockWebSocket.OPEN;
		const failing = vi.spyOn(socket, 'send').mockImplementation(() => {
			throw new Error('gone again');
		});
		expect(() => socket.open()).not.toThrow();
		failing.mockRestore();

		// Nothing is replayed on the next open: the frame is gone, not accumulated.
		socket.open();
		expect(socket.sent).toHaveLength(0);
	});
});
