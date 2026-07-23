import { describe, expect, it } from 'vitest';
import { isPasswordCompliant } from '../password.util';
import { computeLetterGrade } from '../grading.util';

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

describe('computeLetterGrade', () => {
  it.each([
    [95, 'A+'],
    [90, 'A+'],
    [85, 'A'],
    [80, 'A'],
    [77, 'B+'],
    [70, 'B'],
    [67, 'C+'],
    [60, 'C'],
    [55, 'D'],
    [50, 'D'],
    [49, 'F'],
    [0, 'F'],
  ])('maps a score of %i to %s', (score, expected) => {
    expect(computeLetterGrade(score)).toBe(expected);
  });
});
