import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include:     ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude:     ['node_modules/**', 'dist/**', 'src/__tests__/realdb/**'],
    globals:     false,  // explicit imports keep tests readable
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/**/*.d.ts',
        'src/**/__mocks__/**',
        'src/server.ts',           // entry point — not testable in isolation
        'prisma/**',
      ],
      thresholds: {
        lines:      50,
        functions:  50,
        branches:   40,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
