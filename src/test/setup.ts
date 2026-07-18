import { vi } from 'vitest';

// --- Minimal WebSocket stub -------------------------------------------------
// Console/KoppeliaWebsocket create a real WebSocket in their constructors. In
// jsdom there is none, so we provide a benign stub that records what it is asked
// to send and lets a test drive 'open'/'message'/'close' by hand.
export class MockWebSocket {
	static instances: MockWebSocket[] = [];
	static reset() {
		MockWebSocket.instances = [];
	}

	url: string;
	sent: string[] = [];
	onclose: ((ev: { reason?: string; code?: number }) => void) | null = null;
	private _listeners: Record<string, ((ev: unknown) => void)[]> = {};

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	addEventListener(type: string, cb: (ev: unknown) => void) {
		(this._listeners[type] ||= []).push(cb);
	}

	send(data: string) {
		this.sent.push(data);
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
