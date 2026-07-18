import { describe, it, expect } from 'vitest';
import { valueToEnum } from './utils.js';
import { PeerType, MessageType } from './message.js';

describe('valueToEnum', () => {
	it('maps a string value back to its enum member', () => {
		expect(valueToEnum(PeerType, 'monitor')).toBe(PeerType.MONITOR);
		expect(valueToEnum(PeerType, 'controller')).toBe(PeerType.CONTROLLER);
		expect(valueToEnum(MessageType, 'data_exchange')).toBe(MessageType.DATA_EXCHANGE);
	});

	it('returns undefined for a value not present in the enum', () => {
		expect(valueToEnum(PeerType, 'nope')).toBeUndefined();
		expect(valueToEnum(PeerType, '')).toBeUndefined();
	});

	it('works with a numeric enum', () => {
		enum Nums {
			A = 1,
			B = 2
		}
		expect(valueToEnum(Nums, 2)).toBe(Nums.B);
		expect(valueToEnum(Nums, 3)).toBeUndefined();
	});

	it('returns the first matching member when values collide', () => {
		const dup = { X: 'same', Y: 'same' } as const;
		// Object.entries order is insertion order → first key wins.
		expect(valueToEnum(dup, 'same')).toBe('same');
	});
});
