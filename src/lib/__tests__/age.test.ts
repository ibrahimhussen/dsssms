/**
 * src/lib/age.ts — unit tests
 *
 * Tests ageInYears(), meetsMinimumAdmissionAge(), and parseDateString().
 * Also tests the BulkImportModal CSV row validator indirectly through the
 * age library it imports, covering the same boundary cases.
 */
import { describe, it, expect } from 'vitest';
import {
  ageInYears,
  meetsMinimumAdmissionAge,
  parseDateString,
  MINIMUM_ADMISSION_AGE,
} from '../age';

// ── helpers ───────────────────────────────────────────────────────────────────

const REF = new Date('2026-06-15');

function yearsAgo(years: number, ref: Date, dayOffset = 0): Date {
  const d = new Date(ref);
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

// ── parseDateString ───────────────────────────────────────────────────────────

describe('parseDateString', () => {
  it('parses a valid YYYY-MM-DD string', () => {
    const d = parseDateString('2008-03-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2008);
    expect(d!.getMonth()).toBe(2); // March = 2
    expect(d!.getDate()).toBe(15);
  });

  it('returns null for wrong format (DD/MM/YYYY)', () => {
    expect(parseDateString('15/03/2008')).toBeNull();
  });

  it('returns null for wrong format (MM-DD-YYYY)', () => {
    expect(parseDateString('03-15-2008')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseDateString('')).toBeNull();
  });

  it('returns null for a non-date string', () => {
    expect(parseDateString('not-a-date')).toBeNull();
  });

  it('returns null for an impossible date (month 13)', () => {
    // YYYY-13-01 matches the regex but is an invalid calendar date
    expect(parseDateString('2008-13-01')).toBeNull();
  });

  it('handles leap-year Feb 29', () => {
    const d = parseDateString('2000-02-29');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(29);
  });

  it('returns null for Feb 29 in a non-leap year', () => {
    // 2001 is not a leap year; JS rolls over to Mar 1 — we should detect this
    const d = parseDateString('2001-02-29');
    // new Date('2001-02-29T00:00:00') → Mar 1 2001; getDate() !== 29
    expect(d).toBeNull();
  });
});

// ── ageInYears ────────────────────────────────────────────────────────────────

describe('ageInYears', () => {
  it('returns 16 on the exact 16th birthday', () => {
    expect(ageInYears(yearsAgo(16, REF), REF)).toBe(16);
  });

  it('returns 15 one day before the 16th birthday', () => {
    expect(ageInYears(yearsAgo(16, REF, +1), REF)).toBe(15);
  });

  it('returns 16 one day after the 16th birthday', () => {
    expect(ageInYears(yearsAgo(16, REF, -1), REF)).toBe(16);
  });

  it('correctly handles leap-year birthday Feb 29 in non-leap reference year', () => {
    const dob = new Date('2000-02-29');
    // 2016 is leap: Feb 29 → exactly turns 16
    expect(ageInYears(dob, new Date('2016-02-29'))).toBe(16);
    // Feb 28 2016 → still 15 (birthday is tomorrow)
    expect(ageInYears(dob, new Date('2016-02-28'))).toBe(15);
    // 2017 is non-leap: Mar 1 → already 17
    expect(ageInYears(dob, new Date('2017-03-01'))).toBe(17);
  });

  it('defaults referenceDate to today without throwing', () => {
    const recentDob = new Date();
    recentDob.setFullYear(recentDob.getFullYear() - 20);
    expect(() => ageInYears(recentDob)).not.toThrow();
  });
});

// ── meetsMinimumAdmissionAge ──────────────────────────────────────────────────

describe('meetsMinimumAdmissionAge', () => {
  it('passes exactly on the 16th birthday', () => {
    expect(meetsMinimumAdmissionAge(yearsAgo(16, REF), REF)).toBe(true);
  });

  it('passes at 17', () => {
    expect(meetsMinimumAdmissionAge(yearsAgo(17, REF), REF)).toBe(true);
  });

  it('fails at 15 years 364 days (one day before 16th birthday)', () => {
    expect(meetsMinimumAdmissionAge(yearsAgo(16, REF, +1), REF)).toBe(false);
  });

  it('fails at 15', () => {
    expect(meetsMinimumAdmissionAge(yearsAgo(15, REF), REF)).toBe(false);
  });

  it('fails at 14', () => {
    expect(meetsMinimumAdmissionAge(yearsAgo(14, REF), REF)).toBe(false);
  });

  it('MINIMUM_ADMISSION_AGE is 16', () => {
    expect(MINIMUM_ADMISSION_AGE).toBe(16);
  });
});

// ── bulk-import age check (replicated from BulkImportModal.validateRows logic) ──
// Tests the exact same conditions applied in the CSV import validator.

describe('bulk import age check logic (parseDateString + meetsMinimumAdmissionAge)', () => {
  function csvAgeCheck(raw: string): 'pass' | 'invalid-format' | 'future' | 'underage' {
    if (!raw || raw.trim() === '') return 'invalid-format';
    const dob = parseDateString(raw.trim());
    if (!dob) return 'invalid-format';
    if (dob > new Date()) return 'future';
    if (!meetsMinimumAdmissionAge(dob)) return 'underage';
    return 'pass';
  }

  it('passes a valid 16-year-old DOB', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 16);
    expect(csvAgeCheck(d.toISOString().slice(0, 10))).toBe('pass');
  });

  it('passes a 20-year-old DOB', () => {
    expect(csvAgeCheck('2005-01-01')).toBe('pass');
  });

  it('returns underage for a 15-year-old', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 15);
    expect(csvAgeCheck(d.toISOString().slice(0, 10))).toBe('underage');
  });

  it('returns future for a tomorrow DOB', () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    expect(csvAgeCheck(d.toISOString().slice(0, 10))).toBe('future');
  });

  it('returns invalid-format for DD/MM/YYYY', () => {
    expect(csvAgeCheck('15/03/2005')).toBe('invalid-format');
  });

  it('returns invalid-format for empty string', () => {
    expect(csvAgeCheck('')).toBe('invalid-format');
  });

  it('returns invalid-format for garbage string', () => {
    expect(csvAgeCheck('abc-xyz')).toBe('invalid-format');
  });

  it('passes a leap-year birthday (2000-02-29) for a 26-year-old', () => {
    expect(csvAgeCheck('2000-02-29')).toBe('pass');
  });

  it('returns invalid-format for Feb 29 in non-leap year (2001-02-29)', () => {
    expect(csvAgeCheck('2001-02-29')).toBe('invalid-format');
  });
});
