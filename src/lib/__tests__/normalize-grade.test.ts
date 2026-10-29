/**
 * normalizeClassName — regression tests.
 *
 * Root cause fixed: classrooms stored with inconsistent className casing
 * ("grade 11", "GRADE 10") caused the frontend filter (c.className === grade)
 * to fail when the Grade dropdown showed a normalized fallback value ("Grade 11").
 *
 * Fix: classroom service normalizes className in the DTO response so all
 * consumers receive "Grade N" format. The frontend has a mirror utility
 * for any additional client-side normalization needs.
 */
import { describe, it, expect } from 'vitest';
import { normalizeClassName } from '../normalize-grade';

describe('normalizeClassName', () => {
  // ── Regression cases from the actual DB ──────────────────────────────────

  it('[REGRESSION] "grade 11" (lowercase) → "Grade 11"', () =>
    expect(normalizeClassName('grade 11')).toBe('Grade 11'));

  it('[REGRESSION] "GRADE 10" (uppercase) → "Grade 10"', () =>
    expect(normalizeClassName('GRADE 10')).toBe('Grade 10'));

  it('[REGRESSION] "grade 12" (lowercase) → "Grade 12"', () =>
    expect(normalizeClassName('grade 12')).toBe('Grade 12'));

  // ── Already-normalized cases ─────────────────────────────────────────────

  it('"Grade 9" stays "Grade 9"', () =>
    expect(normalizeClassName('Grade 9')).toBe('Grade 9'));

  it('"Grade 11" stays "Grade 11"', () =>
    expect(normalizeClassName('Grade 11')).toBe('Grade 11'));

  // ── Other valid formats ───────────────────────────────────────────────────

  it('"Grade9" (no space) → "Grade 9"', () =>
    expect(normalizeClassName('Grade9')).toBe('Grade 9'));

  it('"GRADE11" (no space) → "Grade 11"', () =>
    expect(normalizeClassName('GRADE11')).toBe('Grade 11'));

  it('"9" (number only) → "Grade 9"', () =>
    expect(normalizeClassName('9')).toBe('Grade 9'));

  it('"11" (number only) → "Grade 11"', () =>
    expect(normalizeClassName('11')).toBe('Grade 11'));

  // ── Non-grade class names ─────────────────────────────────────────────────

  it('non-numeric name returned as-is', () =>
    expect(normalizeClassName('Pre-Primary')).toBe('Pre-Primary'));

  it('empty string returned as-is', () =>
    expect(normalizeClassName('')).toBe(''));

  // ── Consistency with FALLBACK_GRADE_OPTIONS ───────────────────────────────

  it('[REGRESSION] FALLBACK_GRADE_OPTIONS values are already normalized — no mismatch', () => {
    // Fallback options used when classroomsData is not yet loaded
    const fallback = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    // User selects from fallback, grade is stored, classrooms load, filter runs
    // After fix: classroom DTO returns "Grade 11" matching the fallback value
    fallback.forEach(g => expect(normalizeClassName(g)).toBe(g));
  });

  it('all DB className values normalize to "Grade N" title-case format', () => {
    const dbValues = ['Grade 9', 'GRADE 10', 'grade 11', 'grade 12'];
    const normalized = dbValues.map(normalizeClassName);
    expect(normalized).toEqual(['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']);
    normalized.forEach(n => expect(n).toMatch(/^Grade \d+$/));
  });

  it('normalized value matches GradeSubjectConfig className (title case)', () => {
    // GradeSubjectConfig stores "Grade 11" — classroom DTO must match
    const gscClassName = 'Grade 11';
    const clsClassName = 'grade 11'; // raw DB value
    expect(normalizeClassName(clsClassName)).toBe(gscClassName);
  });
});
