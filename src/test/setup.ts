/**
 * Frontend test setup — runs before every test file.
 *
 * - Extends Vitest's expect with @testing-library/jest-dom matchers
 * - Cleans up after each test to prevent state leakage
 *
 * DATABASE SAFETY: Frontend tests never connect to any database.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatically unmount React trees after each test
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
