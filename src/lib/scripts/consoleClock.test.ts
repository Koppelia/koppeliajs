import { describe, expect, it } from 'vitest';
import { ConsoleClock } from './consoleClock.js';
import { Message, MessageType } from './message.js';

/** A console whose clock is `aheadMs` ahead, answering after `delays` ms each time. */
function harness(aheadMs: number) {
	let local = 1_000_000;
	const pending: { reply: (m: Message) => void }[] = [];
	const clock = new ConsoleClock((_request, callback) => pending.push({ reply: callback }), () => local);
	const answer = (outMs: number, backMs: number, type = MessageType.RESPONSE, error = '') => {
		const { reply } = pending.shift()!;
		local += outMs;
		const message = new Message();
		message.header.type = type;
		if (error) message.addParam('error', error);
		else message.addParam('time', local + aheadMs);
		local += backMs;
		reply(message);
	};
	return { clock, answer, now: () => local };
}

describe('ConsoleClock', () => {
	it('is the local clock until the console answered', () => {
		const { clock, now } = harness(104_000);
		expect(clock.now()).toBe(now());
	});

	it('counts on the console clock once measured', () => {
		const { clock, answer, now } = harness(104_000);
		clock.sync();
		answer(20, 20);
		expect(clock.now()).toBe(now() + 104_000);
	});

	it('keeps the sample with the shortest round trip', () => {
		const { clock, answer, now } = harness(104_000);
		clock.sync();
		answer(10, 10); // symmetric: exact
		clock.sync();
		answer(400, 10); // a slow way out skews the estimate by 195 ms; ignored
		expect(clock.now()).toBe(now() + 104_000);
	});

	it('stays on the local clock with a console that has no getConsoleTime', () => {
		const { clock, answer, now } = harness(104_000);
		clock.sync();
		answer(10, 10, MessageType.ERROR, 'Unsupported message: type=request, action=getConsoleTime');
		clock.sync(); // not even asked again
		expect(clock.now()).toBe(now());
		expect(clock.offsetMs).toBe(0);
	});

	it('keeps asking after another error (the console failing once)', () => {
		const { clock, answer, now } = harness(104_000);
		clock.sync();
		answer(10, 10, MessageType.ERROR, 'boom');
		expect(clock.offsetMs).toBe(0);
		clock.sync();
		answer(10, 10);
		expect(clock.now()).toBe(now() + 104_000);
	});
});
