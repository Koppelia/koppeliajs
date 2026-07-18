import { describe, it, expect, vi } from 'vitest';
import { Option } from './option.js';
import { Message, PeerType } from './message.js';
import { makeMockConsole, asConsole } from '../../test/mockConsole.js';

describe('Option.setOption', () => {
	it('sends a setGameOption request to the master with all fields', () => {
		const mock = makeMockConsole();
		const opt = new Option(asConsole(mock));
		opt.setOption('speed', 5, 'slider', { min: 0, max: 10 });

		const msg = mock.sentWithExec('setGameOption').at(-1)!;
		expect(msg.header.to).toBe(PeerType.MASTER);
		expect(msg.getParam('name')).toBe('speed');
		expect(msg.getParam('value')).toBe(5);
		expect(msg.getParam('type')).toBe('slider');
		expect(msg.getParam('config')).toEqual({ min: 0, max: 10 });
	});
});

describe('Option.updateFromServer', () => {
	it('populates the options cache from the server response', async () => {
		const mock = makeMockConsole();
		const opt = new Option(asConsole(mock));
		// The constructor already fired getGameOptions via onReady; drive its answer.
		const promise = opt.updateFromServer();

		const response = new Message();
		response.addParam('gameOptions', { volume: { value: 7 }, hard: { value: true } });
		mock.respondLast(response);

		await promise;
		expect(opt.options).toEqual({ volume: 7, hard: true });
	});
});

describe('Option change notifications', () => {
	it('updates the cache and fires the registered callback on notification', () => {
		const mock = makeMockConsole();
		const opt = new Option(asConsole(mock));
		const cb = vi.fn();
		opt.onOptionChanged('volume', cb);

		mock.trigger.request('gameOptionNotification', { name: 'volume', value: { value: 9 } });

		expect(opt.options.volume).toBe(9);
		expect(cb).toHaveBeenCalledWith({ value: 9 });
	});

	it('ignores notifications for options without a registered callback', () => {
		const mock = makeMockConsole();
		const opt = new Option(asConsole(mock));
		const cb = vi.fn();
		opt.onOptionChanged('volume', cb);

		mock.trigger.request('gameOptionNotification', { name: 'brightness', value: { value: 3 } });

		expect(opt.options.brightness).toBe(3); // cache still updated
		expect(cb).not.toHaveBeenCalled(); // but no callback for a different name
	});

	it('does not react to unrelated requests', () => {
		const mock = makeMockConsole();
		const opt = new Option(asConsole(mock));
		mock.trigger.request('somethingElse', { name: 'volume', value: { value: 1 } });
		expect(opt.options.volume).toBeUndefined();
	});

	it('tolerates a notification missing the value field', () => {
		const mock = makeMockConsole();
		const opt = new Option(asConsole(mock));
		const cb = vi.fn();
		opt.onOptionChanged('vol', cb);
		mock.trigger.request('gameOptionNotification', { name: 'vol' });
		expect(cb).toHaveBeenCalledWith({});
	});
});
