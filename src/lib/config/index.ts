import type { Config } from '@sveltejs/kit';

/**
 * Wraps a SvelteKit config and injects paths.base = '/game', required for
 * Traefik's PathPrefix(/game) routing to correctly resolve /_app/ assets.
 */
export function defineKoppeliaConfig(config: Config = {}): Config {
	const { kit, ...rest } = config;
	return {
		...rest,
		kit: {
			paths: { base: '/game' },
			...kit
		}
	};
}
