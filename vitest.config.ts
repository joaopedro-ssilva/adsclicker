import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The suite checks the strict ranking rule; the running game is lenient during the test phase.
    env: { RANK_FLAGGED_PLAYERS: 'false' },
  },
});
