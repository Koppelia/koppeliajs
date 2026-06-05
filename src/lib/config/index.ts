import type { Config } from '@sveltejs/kit';

/**
 * Wraps a SvelteKit config with Koppelia defaults.
 * Sets appDir to 'gameassets' so Traefik can route game assets with an explicit
 * PathPrefix(/gameassets) rule instead of the ambiguous default /_app path.
 */
export function defineKoppeliaConfig(config: Config = {}): Config {
	const { kit, ...rest } = config;
	return {
		...rest,
		kit: {
			appDir: 'gameassets',
			...kit
		}
	};
}
