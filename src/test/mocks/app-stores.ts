import { writable } from 'svelte/store';

// Mock of SvelteKit's `$app/stores`. Tests import `page` from here (via the
// `$app/stores` alias) and call `page.set({ url: new URL(...) })` to drive
// route-dependent logic such as updateRoute().
export const page = writable<{ url: URL }>({ url: new URL('http://localhost/') });
