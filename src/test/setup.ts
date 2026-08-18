import { vi } from 'vitest';

// --- Minimal WebSocket stub -------------------------------------------------
// Console/KoppeliaWebsocket create a real WebSocket in their constructors. In
// jsdom there is none, so we provide a benign stub that records what it is asked
// to send and lets a test drive 'open'/'message'/'close' by hand.
export class MockWebSocket {
	static instances: MockWebSocket[] = [];
	/**
	 * Whether a new socket starts already OPEN.
	 *
	 * A real one never does — it starts CONNECTING, which is the window games were
	 * crashing in. But most tests here are about routing, not about the handshake, and
	 * making all of them drive a handshake would be ceremony that tests nothing. The
	 * suite that DOES care about the window turns this off.
	 */
	static autoOpen = true;

	static reset() {
		MockWebSocket.instances = [];
		MockWebSocket.autoOpen = true;
	}

	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 3;

	url: string;
	readyState: number = MockWebSocket.CONNECTING;
	sent: string[] = [];
	onclose: ((ev: { reason?: string; code?: number }) => void) | null = null;
	private _listeners: Record<string, ((ev: unknown) => void)[]> = {};

	constructor(url: string) {
		this.url = url;
		if (MockWebSocket.autoOpen) this.readyState = MockWebSocket.OPEN;
		MockWebSocket.instances.push(this);
	}

	addEventListener(type: string, cb: (ev: unknown) => void) {
		(this._listeners[type] ||= []).push(cb);
	}

	send(data: string) {
		if (this.readyState !== MockWebSocket.OPEN) {
			// What a real WebSocket does, and the whole reason the guard exists.
			throw new DOMException(
				'An attempt was made to use an object that is not, or is no longer, usable',
				'InvalidStateError'
			);
		}
		this.sent.push(data);
	}

	/** Complete the handshake: flip to OPEN and fire 'open', like a real socket. */
	open() {
		this.readyState = MockWebSocket.OPEN;
		(this._listeners['open'] || []).forEach((cb) => cb({}));
	}

	close() {}

	// --- test helpers ---
	emitOpen() {
		for (const cb of this._listeners['open'] ?? []) cb({});
	}
	emitMessage(data: unknown) {
		for (const cb of this._listeners['message'] ?? []) cb({ data: JSON.stringify(data) });
	}
	get lastSentObject() {
		return this.sent.length ? JSON.parse(this.sent[this.sent.length - 1]) : undefined;
	}
}

// --- Minimal HTMLAudioElement stub -----------------------------------------
export class MockAudio {
	src: string;
	loop = false;
	volume = 1;
	paused = true;
	currentTime = 0;
	duration = 123;

	constructor(src: string) {
		this.src = src;
	}
	play() {
		this.paused = false;
		return Promise.resolve();
	}
	pause() {
		this.paused = true;
	}
}

vi.stubGlobal('WebSocket', MockWebSocket);
vi.stubGlobal('Audio', MockAudio);
