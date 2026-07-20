import crypto from 'node:crypto';

/**
 * Refresh tokens are stored hashed (SHA-256) in the database, never in
 * plaintext — mirrors the treatment we give passwords, so a leaked database
 * dump cannot be used to impersonate active sessions.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const DURATION_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parses simple JWT-style duration strings ("15m", "7d", "1h") into a future
 * Date. Falls back to treating the value as raw seconds if no unit suffix
 * is present, matching jsonwebtoken's own expiresIn semantics.
 */
export function durationToFutureDate(duration: string): Date {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());

  if (!match) {
    const seconds = Number(duration);
    if (Number.isNaN(seconds)) {
      throw new Error(`Invalid duration string: ${duration}`);
    }
    return new Date(Date.now() + seconds * 1000);
  }

  const [, amountStr, unit] = match;
  const amount = Number(amountStr);
  return new Date(Date.now() + amount * DURATION_UNIT_MS[unit]);
}
