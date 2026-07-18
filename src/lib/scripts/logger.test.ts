import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setDebugMode } from './logger.js';

let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	setDebugMode(false);
});

describe('logger with debug disabled', () => {
	it('suppresses log and warn but still emits errors', () => {
		setDebugMode(false);
		logger.log('a');
		logger.warn('b');
		logger.error('c');
		expect(logSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe('logger with debug enabled', () => {
	it('emits log and warn with the library prefix', () => {
		setDebugMode(true);
		logger.log('hello');
		logger.warn('careful');
		expect(logSpy).toHaveBeenCalledWith('[MaSuperLib]', 'hello');
		expect(warnSpy).toHaveBeenCalledWith('[MaSuperLib]', 'careful');
	});
});
