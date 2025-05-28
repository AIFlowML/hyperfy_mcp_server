import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60000,
    include: ['tests/**/*.{test,spec}.{js,ts}', 'tests/**/test_*.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    pool: 'forks',
    setupFiles: ['./tests/setup-websocket.ts']
  },
  resolve: {
    alias: {
      // Handle .js imports in TypeScript files
      '^(\\.{1,2}/.*)\\.js$': '$1'
    }
  }
}); 