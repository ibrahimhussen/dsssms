import { describe, expect, it } from 'vitest';
import { isPasswordCompliant } from '../password.util';

describe('isPasswordCompliant', () => {
  it('accepts a password with upper, lower, digit, special char, and 8+ length', () => {
    expect(isPasswordCompliant('Abcdef1!')).toBe(true);
  });

  it('rejects a password missing an uppercase letter', () => {
    expect(isPasswordCompliant('abcdef1!')).toBe(false);
  });

  it('rejects a password missing a lowercase letter', () => {
    expect(isPasswordCompliant('ABCDEF1!')).toBe(false);
  });

  it('rejects a password missing a digit', () => {
    expect(isPasswordCompliant('Abcdefg!')).toBe(false);
  });

  it('rejects a password missing a special character', () => {
    expect(isPasswordCompliant('Abcdefg1')).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(isPasswordCompliant('Ab1!')).toBe(false);
  });
});
