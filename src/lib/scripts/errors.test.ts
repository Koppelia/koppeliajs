import { describe, it, expect } from 'vitest';
import { MicLimitError } from './errors.js';

describe('MicLimitError', () => {
	it('is an Error with the correct name', () => {
		const err = new MicLimitError();
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('MicLimitError');
	});

	it('uses the default message when none is given', () => {
		expect(new MicLimitError().message).toBe(
			'Maximum of 5 mic modules can be active simultaneously'
		);
	});

	it('accepts a custom message', () => {
		expect(new MicLimitError('boom').message).toBe('boom');
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
