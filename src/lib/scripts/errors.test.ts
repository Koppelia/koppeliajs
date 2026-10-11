import { describe, it, expect } from 'vitest';
import { DeviceError, MicLimitError } from './errors.js';

describe('DeviceError', () => {
	it('is an Error with the correct name and a default message', () => {
		const err = new DeviceError();
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('DeviceError');
		expect(err.message).toBe('Device command failed');
	});

	it('accepts a custom message', () => {
		expect(new DeviceError('timeout').message).toBe('timeout');
	});
});

describe('MicLimitError', () => {
	it('is a DeviceError with the correct name', () => {
		const err = new MicLimitError();
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(DeviceError);
		expect(err.name).toBe('MicLimitError');
	});

	it('never hard-codes a number when the console gave none', () => {
		const err = new MicLimitError();
		expect(err.limit).toBeUndefined();
		expect(err.message).not.toMatch(/\d/);
	});

	it('words its default message from the console limit', () => {
		const err = new MicLimitError(undefined, 2);
		expect(err.limit).toBe(2);
		expect(err.message).toBe('Maximum of 2 mic modules can be active simultaneously');
	});

	it('keeps a custom message and the limit', () => {
		const err = new MicLimitError('boom', 3);
		expect(err.message).toBe('boom');
		expect(err.limit).toBe(3);
	});

	it('is catchable as an Error', () => {
		try {
			throw new MicLimitError('x');
		} catch (e) {
			expect(e).toBeInstanceOf(MicLimitError);
			expect((e as Error).name).toBe('MicLimitError');
		}
	});
});
