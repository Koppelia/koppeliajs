import { vi } from 'vitest';

// Mock of SvelteKit's `$app/navigation`. `goto` is a spy so tests can assert
// server-driven stage transitions call it with the expected path.
export const goto = vi.fn();
