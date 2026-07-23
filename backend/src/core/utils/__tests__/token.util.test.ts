import { describe, expect, it } from 'vitest';
import { durationToFutureDate, hashToken } from '../token.util';

describe('durationToFutureDate', () => {
  it('parses minutes correctly', () => {
    const before = Date.now();
    const result = durationToFutureDate('15m');
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 15 * 60 * 1000);
  });

  it('parses days correctly', () => {
    const before = Date.now();
    const result = durationToFutureDate('7d');
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 7 * 24 * 60 * 60 * 1000);
  });

  it('parses hours and seconds correctly', () => {
    const hourResult = durationToFutureDate('2h');
    const secResult = durationToFutureDate('30s');
    const now = Date.now();

    expect(hourResult.getTime() - now).toBeGreaterThan(1.9 * 60 * 60 * 1000);
    expect(secResult.getTime() - now).toBeGreaterThan(25 * 1000);
    expect(secResult.getTime() - now).toBeLessThan(35 * 1000);
  });

  it('falls back to treating a bare number as raw seconds', () => {
    const result = durationToFutureDate('60');
    const now = Date.now();
    expect(result.getTime() - now).toBeGreaterThan(55 * 1000);
    expect(result.getTime() - now).toBeLessThan(65 * 1000);
  });

  it('throws on a genuinely invalid duration string', () => {
    expect(() => durationToFutureDate('not-a-duration')).toThrow();
  });
});

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('same-token')).toBe(hashToken('same-token'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  it('never returns the plaintext token', () => {
    expect(hashToken('my-secret-refresh-token')).not.toContain('my-secret-refresh-token');
  });
});
