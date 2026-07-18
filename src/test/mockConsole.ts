import { vi } from 'vitest';
import type { Console } from '../lib/scripts/console.js';
import type { Message } from '../lib/scripts/message.js';

type Callback = (response: Message) => void;

/**
 * A lightweight stand-in for {@link Console}. It records every message passed to
 * sendMessage and captures the handlers registered by the class under test, so a
 * test can simulate inbound network events (`trigger.*`) and answer outbound
 * requests (`respondLast`). Cast the returned object with `asConsole()` when a
 * constructor expects a real Console.
 *
 * `ready` defaults to true so onReady() callbacks fire immediately, matching an
 * already-connected console; set it to false before constructing to defer them.
 */
export function makeMockConsole(options: { ready?: boolean } = {}) {
	let ready = options.ready ?? true;

	const handlers = {
		ready: [] as (() => void)[],
		stateChange: [] as ((from: string, state: unknown, update: boolean) => void)[],
		stageChange: [] as ((from: string, stage: string) => void)[],
		dataExchange: [] as ((from: string, data: unknown) => void)[],
		request: [] as ((
			request: string,
			params: Record<string, unknown>,
			from: string,
			address: string
		) => void)[],
		deviceEvent: [] as ((device: string, from_addr: string, event: string) => void)[]
	};

	const idMap = new Map<string, { list: unknown[]; cb: unknown }>();
	let idc = 0;
	const register = (list: unknown[], cb: unknown): string => {
		const id = `mock-id-${idc++}`;
		list.push(cb);
		idMap.set(id, { list, cb });
		return id;
	};

	const sent: { message: Message; callback?: Callback }[] = [];
	let mediaResponse: unknown = {};

	const mock = {
		sendMessage: vi.fn((message: Message, callback?: Callback) => {
			sent.push({ message, callback });
		}),
		onReady: vi.fn((cb: () => void) => {
			if (ready) cb();
			else handlers.ready.push(cb);
			return register([], cb);
		}),
		onStateChange: vi.fn((cb: (typeof handlers.stateChange)[number]) =>
			register(handlers.stateChange, cb)
		),
		onStageChange: vi.fn((cb: (typeof handlers.stageChange)[number]) =>
			register(handlers.stageChange, cb)
		),
		onDataExchange: vi.fn((cb: (typeof handlers.dataExchange)[number]) =>
			register(handlers.dataExchange, cb)
		),
		onRequest: vi.fn((cb: (typeof handlers.request)[number]) => register(handlers.request, cb)),
		onDeviceEvent: vi.fn((cb: (typeof handlers.deviceEvent)[number]) =>
			register(handlers.deviceEvent, cb)
		),
		unsubscribeCallback: vi.fn((id: string): boolean => {
			const entry = idMap.get(id);
			if (!entry) return false;
			const i = entry.list.indexOf(entry.cb);
			if (i >= 0) entry.list.splice(i, 1);
			idMap.delete(id);
			return true;
		}),
		getMediaUrl: vi.fn((path: string) => `http://console:8000${path.startsWith('/') ? '' : '/'}${path}`),
		getMedia: vi.fn(async (_path: string): Promise<unknown> => mediaResponse),

		// --- test-only surface (not part of Console) ---
		sent,
		setMediaResponse(value: unknown) {
			mediaResponse = value;
		},
		setReady(value: boolean) {
			ready = value;
			if (value) {
				const pending = handlers.ready.splice(0);
				for (const cb of pending) cb();
			}
		},
		trigger: {
			ready: () => handlers.ready.splice(0).forEach((cb) => cb()),
			stateChange: (from: string, state: unknown, update: boolean) =>
				handlers.stateChange.forEach((cb) => cb(from, state, update)),
			stageChange: (from: string, stage: string) =>
				handlers.stageChange.forEach((cb) => cb(from, stage)),
			dataExchange: (from: string, data: unknown) =>
				handlers.dataExchange.forEach((cb) => cb(from, data)),
			request: (request: string, params: Record<string, unknown>, from = 'master', address = '') =>
				handlers.request.forEach((cb) => cb(request, params, from, address)),
			deviceEvent: (device: string, from_addr: string, event: string) =>
				handlers.deviceEvent.forEach((cb) => cb(device, from_addr, event))
		},
		/** Invoke the callback of the most recently sent request with a response. */
		respondLast(response: Message) {
			sent[sent.length - 1]?.callback?.(response);
		},
		/** All sent messages whose request.exec matches. */
		sentWithExec(exec: string) {
			return sent.filter((s) => s.message.request.exec === exec).map((s) => s.message);
		},
		lastMessage() {
			return sent[sent.length - 1]?.message;
		}
	};

	return mock;
}

export type MockConsole = ReturnType<typeof makeMockConsole>;

/** Cast a mock to the Console type for constructors that require the real one. */
export function asConsole(mock: MockConsole): Console {
	return mock as unknown as Console;
}
