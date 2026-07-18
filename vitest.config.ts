import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Standalone vitest config (no SvelteKit plugin): the SvelteKit virtual modules
// `$app/stores` and `$app/navigation` are aliased to local mocks so the scripts
// under test resolve without a running SvelteKit app.
export default defineConfig({
	resolve: {
		alias: {
			'$app/stores': r('./src/test/mocks/app-stores.ts'),
			'$app/navigation': r('./src/test/mocks/app-navigation.ts'),
			$lib: r('./src/lib')
		}
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: [r('./src/test/setup.ts')],
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
