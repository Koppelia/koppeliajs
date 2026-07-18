import { describe, it, expect } from 'vitest';
import { defineKoppeliaConfig } from './index.js';

describe('defineKoppeliaConfig', () => {
	it('sets appDir to gameassets on an empty config', () => {
		const config = defineKoppeliaConfig();
		expect(config.kit?.appDir).toBe('gameassets');
	});

	it('preserves non-kit top-level config keys', () => {
		const preprocess = { name: 'x' };
		const config = defineKoppeliaConfig({ preprocess } as never);
		expect((config as { preprocess: unknown }).preprocess).toBe(preprocess);
	});

	it('merges existing kit options alongside appDir', () => {
		const adapter = { name: 'adapter-node' };
		const config = defineKoppeliaConfig({ kit: { adapter } } as never);
		expect(config.kit?.appDir).toBe('gameassets');
		expect((config.kit as { adapter: unknown }).adapter).toBe(adapter);
	});

	it('lets an explicit kit.appDir override the default', () => {
		const config = defineKoppeliaConfig({ kit: { appDir: 'custom' } } as never);
		expect(config.kit?.appDir).toBe('custom');
	});

	it('does not mutate the caller-provided config object', () => {
		const input = { kit: {} } as never;
		const out = defineKoppeliaConfig(input);
		expect(out).not.toBe(input);
		expect((input as { kit: { appDir?: string } }).kit.appDir).toBeUndefined();
	});
});
