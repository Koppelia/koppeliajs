import { describe, it, expect } from 'vitest';
import { Message, MessageType, PeerType } from './message.js';

describe('Message construction defaults', () => {
	it('starts empty with NONE routing and EMPTY type', () => {
		const m = new Message();
		expect(m.header.type).toBe(MessageType.EMPTY);
		expect(m.header.from).toBe(PeerType.NONE);
		expect(m.header.to).toBe(PeerType.NONE);
		expect(m.header.id).toBe('');
		expect(m.data).toEqual({});
		expect(m.request).toEqual({ exec: '', params: {} });
		expect(m.event).toBe('');
	});
});

describe('Message routing', () => {
	it('setSource sets from + from_addr', () => {
		const m = new Message();
		m.setSource(PeerType.MONITOR, 'aa:bb');
		expect(m.header.from).toBe(PeerType.MONITOR);
		expect(m.header.from_addr).toBe('aa:bb');
	});

	it('setSource defaults the address to an empty string', () => {
		const m = new Message();
		m.setSource(PeerType.CONTROLLER);
		expect(m.header.from_addr).toBe('');
	});

	it('setDestination sets to + to_addr', () => {
		const m = new Message();
		m.setDestination(PeerType.DEVICE, 'dev-1');
		expect(m.header.to).toBe(PeerType.DEVICE);
		expect(m.header.to_addr).toBe('dev-1');
	});
});

describe('Message type / event', () => {
	it('setType / getType roundtrip', () => {
		const m = new Message();
		m.setType(MessageType.DATA_EXCHANGE);
		expect(m.getType()).toBe(MessageType.DATA_EXCHANGE);
	});

	it('setEvent marks the message as a REQUEST and stores the event', () => {
		const m = new Message();
		m.setEvent('jump');
		expect(m.header.type).toBe(MessageType.REQUEST);
		expect(m.getEvent()).toBe('jump');
	});

	it('setIdentification sets IDENTIFICATION type and the identifying peer as source', () => {
		const m = new Message();
		m.setIdentification(PeerType.MAESTRO);
		expect(m.header.type).toBe(MessageType.IDENTIFICATION);
		expect(m.header.from).toBe(PeerType.MAESTRO);
	});
});

describe('Message request params', () => {
	it('setRequest marks REQUEST and sets the exec name', () => {
		const m = new Message();
		m.setRequest('getDevices');
		expect(m.header.type).toBe(MessageType.REQUEST);
		expect(m.request.exec).toBe('getDevices');
	});

	it('addParam / getParam roundtrip', () => {
		const m = new Message();
		m.addParam('count', 10);
		m.addParam('flag', false);
		expect(m.getParam('count')).toBe(10);
		expect(m.getParam('flag')).toBe(false);
	});

	it('getParam returns the provided default when the key is absent', () => {
		const m = new Message();
		expect(m.getParam('missing')).toBeNull();
		expect(m.getParam('missing', 42)).toBe(42);
	});

	it('getParam distinguishes a stored falsy value from the default', () => {
		const m = new Message();
		m.addParam('zero', 0);
		expect(m.getParam('zero', 99)).toBe(0);
	});
});

describe('Message data', () => {
	it('addData adds one key without wiping existing data', () => {
		const m = new Message();
		m.addData('a', '1');
		m.addData('b', '2');
		expect(m.data).toEqual({ a: '1', b: '2' });
	});

	it('setData replaces the whole data payload', () => {
		const m = new Message();
		m.addData('a', '1');
		m.setData({ x: 'y' });
		expect(m.data).toEqual({ x: 'y' });
	});
});

describe('Message id', () => {
	it('generateRequestId produces a non-empty unique id', () => {
		const a = new Message();
		const b = new Message();
		a.generateRequestId();
		b.generateRequestId();
		expect(a.getRequestId()).not.toBe('');
		expect(a.getRequestId()).not.toBe(b.getRequestId());
	});
});

describe('Message.parse', () => {
	it('copies only known header keys and ignores unknown ones', () => {
		const m = new Message();
		m.parse({ header: { type: MessageType.RESPONSE, from: PeerType.MASTER, bogus: 'nope' } });
		expect(m.header.type).toBe(MessageType.RESPONSE);
		expect(m.header.from).toBe(PeerType.MASTER);
		expect((m.header as Record<string, unknown>).bogus).toBeUndefined();
	});

	it('copies the data payload', () => {
		const m = new Message();
		m.parse({ data: { k: 'v' } });
		expect(m.data).toEqual({ k: 'v' });
	});

	it('only accepts a string event', () => {
		const m = new Message();
		m.parse({ event: 'hello' });
		expect(m.event).toBe('hello');

		const m2 = new Message();
		m2.parse({ event: 123 as unknown as string });
		expect(m2.event).toBe('');
	});

	it('copies request.exec and request.params when present', () => {
		const m = new Message();
		m.parse({ request: { exec: 'foo', params: { a: 1 } } });
		expect(m.request.exec).toBe('foo');
		expect(m.request.params).toEqual({ a: 1 });
	});

	it('tolerates a partial request (exec only)', () => {
		const m = new Message();
		m.parse({ request: { exec: 'foo' } });
		expect(m.request.exec).toBe('foo');
		expect(m.request.params).toEqual({});
	});

	it('is a no-op on an empty object', () => {
		const m = new Message();
		m.parse({});
		expect(m.header.type).toBe(MessageType.EMPTY);
	});
});

describe('Message.toObject', () => {
	it('serializes header, request, data and event', () => {
		const m = new Message();
		m.setRequest('ping');
		m.addParam('n', 1);
		m.addData('d', 'x');
		m.setSource(PeerType.CONTROLLER);
		const obj = m.toObject();
		expect(obj.header.from).toBe(PeerType.CONTROLLER);
		expect(obj.request).toEqual({ exec: 'ping', params: { n: 1 } });
		expect(obj.data).toEqual({ d: 'x' });
		expect(obj.event).toBe('');
	});

	it('round-trips through parse back into an equivalent message', () => {
		const original = new Message();
		original.setRequest('act');
		original.addParam('p', 'q');
		original.setDestination(PeerType.MASTER, 'addr');
		original.generateRequestId();

		const copy = new Message();
		copy.parse(original.toObject());
		expect(copy.request.exec).toBe('act');
		expect(copy.getParam('p')).toBe('q');
		expect(copy.header.to).toBe(PeerType.MASTER);
		expect(copy.getRequestId()).toBe(original.getRequestId());
	});
});
