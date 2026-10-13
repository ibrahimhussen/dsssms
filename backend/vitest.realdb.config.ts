/**
 * Vitest config for real-DB integration tests.
 *
 * Runs ONLY the realdb test suite against dsssms_db.
 * No Prisma mocks — every DB call is real.
 * Tests are isolated via transaction rollback, not a separate test database.
 *
 * Usage:
 *   $env:DATABASE_URL = "mysql://dsssms_user:mudasir@localhost:3306/dsssms_db"
 *   npx vitest run --config vitest.realdb.config.ts
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include:     ['src/__tests__/realdb/**/*.test.ts'],
    exclude:     ['node_modules/**', 'dist/**'],
    globals:     false,
    testTimeout: 30000,
    hookTimeout: 15000,
    // Run all real-DB tests serially in one process to prevent race conditions
    // on shared DB state (Vitest 4 syntax — poolOptions removed).
    singleThread: true,
    sequence: { concurrent: false },
  },
});
