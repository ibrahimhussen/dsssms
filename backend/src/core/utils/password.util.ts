import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

/**
 * Hashes a plaintext password using bcrypt with the configured cost factor.
 * Never store or log plaintext passwords anywhere in the system.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, env.BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash in constant time.
 */
export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Enforces the proposal's security requirement: minimum length, alphanumeric,
 * and special characters (see 3.6 "Password complexity rules").
 */
export function isPasswordCompliant(plainPassword: string): boolean {
  return PASSWORD_POLICY_REGEX.test(plainPassword);
}
