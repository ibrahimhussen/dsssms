/**
 * age.util.ts — unit tests
 *
 * Tests the ageInYears() and meetsMinimumAdmissionAge() functions
 * covering boundary cases, birthday-exact precision, and leap years.
 */
import { describe, it, expect } from 'vitest';
import { ageInYears, meetsMinimumAdmissionAge, MINIMUM_ADMISSION_AGE } from '../age.util';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Create a Date exactly N years before referenceDate, with optional day offset. */
function yearsAgo(years: number, ref: Date, dayOffset = 0): Date {
  const d = new Date(ref);
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

const REF = new Date('2026-06-15'); // fixed reference date for deterministic tests

// ── ageInYears ────────────────────────────────────────────────────────────────

describe('ageInYears', () => {
  it('returns 16 on the exact 16th birthday', () => {
    const dob = yearsAgo(16, REF);
    expect(ageInYears(dob, REF)).toBe(16);
  });

  it('returns 15 one day before the 16th birthday', () => {
    const dob = yearsAgo(16, REF, +1); // born 1 day after "16 years ago" → birthday is tomorrow
    expect(ageInYears(dob, REF)).toBe(15);
  });

  it('returns 16 one day after the 16th birthday', () => {
    const dob = yearsAgo(16, REF, -1); // birthday was yesterday
    expect(ageInYears(dob, REF)).toBe(16);
  });

  it('returns 14 for a 14-year-old', () => {
    const dob = yearsAgo(14, REF);
    expect(ageInYears(dob, REF)).toBe(14);
  });

  it('returns 20 for a 20-year-old', () => {
    const dob = yearsAgo(20, REF);
    expect(ageInYears(dob, REF)).toBe(20);
  });

  it('handles leap-year birthday (Feb 29) — treats birthday as Feb 28 in non-leap year', () => {
    // Born Feb 29 2000 (leap year). Reference date Feb 28 2016 (non-leap, their 16th year)
    const dob = new Date('2000-02-29');
    const refFeb28NonLeap = new Date('2016-02-28');
    // Their exact birthday in 2016 doesn't exist; Feb 28 is still one day before they'd turn 16
    expect(ageInYears(dob, refFeb28NonLeap)).toBe(15);
  });

  it('handles leap-year birthday (Feb 29) — turns 16 on Feb 29 in next leap year', () => {
    const dob = new Date('2000-02-29');
    const refFeb29Leap = new Date('2016-02-29');
    expect(ageInYears(dob, refFeb29Leap)).toBe(16);
  });

  it('handles leap-year birthday (Feb 29) — already turned 16 on Mar 1 of non-leap year', () => {
    const dob = new Date('2000-02-29');
    const refMar1NonLeap = new Date('2017-03-01'); // 2017 is not a leap year
    expect(ageInYears(dob, refMar1NonLeap)).toBe(17);
  });

  it('defaults to today when referenceDate is omitted', () => {
    const today = new Date();
    const dob16YearsAgo = yearsAgo(16, today);
    // ageInYears(dob) should equal ageInYears(dob, today)
    expect(ageInYears(dob16YearsAgo)).toBe(ageInYears(dob16YearsAgo, today));
  });
});

// ── meetsMinimumAdmissionAge ──────────────────────────────────────────────────

describe('meetsMinimumAdmissionAge', () => {
  it(`returns true when student is exactly ${MINIMUM_ADMISSION_AGE} today`, () => {
    const dob = yearsAgo(MINIMUM_ADMISSION_AGE, REF);
    expect(meetsMinimumAdmissionAge(dob, REF)).toBe(true);
  });

  it('returns true when student is older than minimum', () => {
    const dob = yearsAgo(MINIMUM_ADMISSION_AGE + 2, REF);
    expect(meetsMinimumAdmissionAge(dob, REF)).toBe(true);
  });

  it('returns false one day before minimum birthday', () => {
    const dob = yearsAgo(MINIMUM_ADMISSION_AGE, REF, +1);
    expect(meetsMinimumAdmissionAge(dob, REF)).toBe(false);
  });

  it('returns false for a 15-year-old', () => {
    const dob = yearsAgo(15, REF);
    expect(meetsMinimumAdmissionAge(dob, REF)).toBe(false);
  });

  it('returns false for a 14-year-old', () => {
    const dob = yearsAgo(14, REF);
    expect(meetsMinimumAdmissionAge(dob, REF)).toBe(false);
  });

  it('MINIMUM_ADMISSION_AGE constant is 16', () => {
    expect(MINIMUM_ADMISSION_AGE).toBe(16);
  });
});
