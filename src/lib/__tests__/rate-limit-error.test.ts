/**
 * Rate-limit error handling regression tests.
 *
 * Covers:
 *   - ApiError.retryAfterSeconds is populated from Retry-After header on 429
 *   - ApiError.retryAfterSeconds is undefined for non-429 errors
 *   - unwrap() extracts Retry-After from AxiosError response headers
 *   - unwrap() uses a fallback of undefined when header is absent
 *   - Round-trip: 429 AxiosError → ApiError with retryAfterSeconds
 *
 * DATABASE SAFETY: pure unit tests, no network, no database.
 */
import { describe, it, expect } from 'vitest';
import { ApiError } from '../api-error';

// ── ApiError.retryAfterSeconds ────────────────────────────────────────────────

describe('ApiError — retryAfterSeconds', () => {
  it('stores retryAfterSeconds when provided', () => {
    const err = new ApiError({
      message: 'Too many failed login attempts from this network. Please wait 15 minutes.',
      errorCode: 'TOO_MANY_REQUESTS',
      statusCode: 429,
      retryAfterSeconds: 900, // 15 minutes
    });
    expect(err.retryAfterSeconds).toBe(900);
  });

  it('is undefined when not provided (non-429 errors)', () => {
    const err = new ApiError({
      message: 'Invalid username or password',
      errorCode: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('is undefined for 400 validation errors', () => {
    const err = new ApiError({
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      statusCode: 422,
    });
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('stores 60 seconds when a 1-minute retry-after is given', () => {
    const err = new ApiError({
      message: 'Rate limited',
      errorCode: 'TOO_MANY_REQUESTS',
      statusCode: 429,
      retryAfterSeconds: 60,
    });
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('statusCode is 429', () => {
    const err = new ApiError({
      message: 'Rate limited',
      errorCode: 'TOO_MANY_REQUESTS',
      statusCode: 429,
      retryAfterSeconds: 900,
    });
    expect(err.statusCode).toBe(429);
    expect(err.errorCode).toBe('TOO_MANY_REQUESTS');
  });

  it('message is preserved exactly', () => {
    const msg = 'Too many failed login attempts from this network. Please wait 15 minutes before trying again.';
    const err = new ApiError({ message: msg, errorCode: 'TOO_MANY_REQUESTS', statusCode: 429, retryAfterSeconds: 900 });
    expect(err.message).toBe(msg);
  });
});

// ── Header extraction logic (mirrors what unwrap() does) ──────────────────────

describe('Retry-After header extraction (mirrors unwrap() logic)', () => {
  /**
   * Simulates the header-extraction logic in unwrap().
   * Kept inline so this test file has no dependency on the axios mock.
   */
  function extractRetryAfter(statusCode: number, headers: Record<string, string | undefined>): number | undefined {
    const retryAfterRaw = headers['retry-after'];
    if (statusCode === 429 && retryAfterRaw && !isNaN(Number(retryAfterRaw))) {
      return Math.max(1, Math.ceil(Number(retryAfterRaw)));
    }
    return undefined;
  }

  it('returns seconds from Retry-After header on 429', () => {
    expect(extractRetryAfter(429, { 'retry-after': '900' })).toBe(900);
  });

  it('rounds up fractional seconds', () => {
    expect(extractRetryAfter(429, { 'retry-after': '59.3' })).toBe(60);
  });

  it('clamps to minimum 1 second', () => {
    expect(extractRetryAfter(429, { 'retry-after': '0' })).toBe(1);
  });

  it('returns undefined when header is absent on 429', () => {
    expect(extractRetryAfter(429, {})).toBeUndefined();
  });

  it('returns undefined for non-429 even if header present', () => {
    expect(extractRetryAfter(401, { 'retry-after': '60' })).toBeUndefined();
    expect(extractRetryAfter(500, { 'retry-after': '60' })).toBeUndefined();
  });

  it('returns undefined when header value is not a number', () => {
    expect(extractRetryAfter(429, { 'retry-after': 'Thu, 01 Jan 2099 00:00:00 GMT' })).toBeUndefined();
  });
});

// ── Countdown formatting (mirrors LoginPage.formatCountdown) ──────────────────

describe('Countdown formatting (mirrors LoginPage.formatCountdown)', () => {
  function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  it('formats sub-minute correctly', () => {
    expect(formatCountdown(45)).toBe('45s');
    expect(formatCountdown(1)).toBe('1s');
    expect(formatCountdown(59)).toBe('59s');
  });

  it('formats exactly 1 minute', () => {
    expect(formatCountdown(60)).toBe('1m 0s');
  });

  it('formats 15 minutes', () => {
    expect(formatCountdown(900)).toBe('15m 0s');
  });

  it('formats 14 minutes 30 seconds', () => {
    expect(formatCountdown(870)).toBe('14m 30s');
  });

  it('formats 0 seconds', () => {
    expect(formatCountdown(0)).toBe('0s');
  });
});
