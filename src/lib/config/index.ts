import type { Config } from '@sveltejs/kit';

/**
 * Wraps a SvelteKit config with Koppelia defaults.
 * Centralizes adapter-node and preprocess setup across all games.
 */
export function defineKoppeliaConfig(config: Config = {}): Config {
	const { kit, ...rest } = config;
	return {
		...rest,
		kit: {
			...kit
		}
	};
}
