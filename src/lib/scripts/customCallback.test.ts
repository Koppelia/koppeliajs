import { describe, it, expect, vi } from 'vitest';
import { CustomCallbacks } from './customCallback.js';
import { MessageType, PeerType } from './message.js';
import { makeMockConsole, asConsole } from '../../test/mockConsole.js';

describe('CustomCallbacks.runCustomCallback', () => {
	it('broadcasts a DATA_EXCHANGE message carrying the name and args', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		cb.runCustomCallback('gameAction', { type: 'start_round' });

		const msg = mock.lastMessage()!;
		expect(msg.getType()).toBe(MessageType.DATA_EXCHANGE);
		expect(msg.header.to).toBe(PeerType.BROADCAST);
		expect(msg.data.customCallbackName).toBe('gameAction');
		expect(msg.data.customCallbackArgs).toEqual({ type: 'start_round' });
	});
});

describe('CustomCallbacks registration + dispatch', () => {
	it('invokes a registered listener when the matching data arrives', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		const spy = vi.fn();
		cb.registerCustomCallback('act', spy);

		mock.trigger.dataExchange('controller', {
			customCallbackName: 'act',
			customCallbackArgs: { n: 1 }
		});
		expect(spy).toHaveBeenCalledWith({ n: 1 });
	});

	it('invokes every listener registered under the same name', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		const a = vi.fn();
		const b = vi.fn();
		cb.registerCustomCallback('act', a);
		cb.registerCustomCallback('act', b);

		mock.trigger.dataExchange('x', { customCallbackName: 'act', customCallbackArgs: {} });
		expect(a).toHaveBeenCalledOnce();
		expect(b).toHaveBeenCalledOnce();
	});

	it('does not invoke listeners registered under a different name', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		const spy = vi.fn();
		cb.registerCustomCallback('other', spy);

		mock.trigger.dataExchange('x', { customCallbackName: 'act', customCallbackArgs: {} });
		expect(spy).not.toHaveBeenCalled();
	});

	it('ignores data-exchange payloads missing the callback fields', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		const spy = vi.fn();
		cb.registerCustomCallback('act', spy);

		mock.trigger.dataExchange('x', { somethingElse: true });
		expect(spy).not.toHaveBeenCalled();
	});

	it('keeps running the other listeners when one throws', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		const boom = vi.fn(() => {
			throw new Error('boom');
		});
		const ok = vi.fn();
		cb.registerCustomCallback('act', boom);
		cb.registerCustomCallback('act', ok);

		expect(() =>
			mock.trigger.dataExchange('x', { customCallbackName: 'act', customCallbackArgs: {} })
		).not.toThrow();
		expect(ok).toHaveBeenCalledOnce();
	});
});

describe('CustomCallbacks unregistration', () => {
	it('unregisterCustomCallback removes all listeners for a name', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		const spy = vi.fn();
		cb.registerCustomCallback('act', spy);
		cb.registerCustomCallback('act', vi.fn());
		cb.unregisterCustomCallback('act');

		mock.trigger.dataExchange('x', { customCallbackName: 'act', customCallbackArgs: {} });
		expect(spy).not.toHaveBeenCalled();
	});

	it('unregisterById removes only the targeted listener', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		const keep = vi.fn();
		const drop = vi.fn();
		cb.registerCustomCallback('act', keep);
		const dropId = cb.registerCustomCallback('act', drop);

		expect(cb.unregisterById(dropId)).toBe(true);
		mock.trigger.dataExchange('x', { customCallbackName: 'act', customCallbackArgs: {} });
		expect(keep).toHaveBeenCalledOnce();
		expect(drop).not.toHaveBeenCalled();
	});

	it('unregisterById returns false for an unknown id', () => {
		const mock = makeMockConsole();
		const cb = new CustomCallbacks(asConsole(mock));
		expect(cb.unregisterById('nope')).toBe(false);
	});
});
