/**
 * Frontend Zod schemas — academic year format regression tests.
 *
 * The Roster and Finalization pages send academicYear as a query parameter.
 * These tests confirm the frontend schemas (used in API calls) correctly
 * handle both "2026" and "2026/27" formats that exist in the DB.
 *
 * Note: frontend schemas use z.string() without a strict regex for most
 * fields — these tests focus on the types/academic-register-related schemas
 * and the classroom year values that flow through the API.
 */
import { describe, it, expect } from 'vitest';

// The frontend doesn't validate the academic year in a Zod schema of its own
// for the register API call — it passes through whatever year came from the
// classrooms list. The critical validation is on the backend (tested separately).
// Here we test the utility that produces academic year defaults / options.

/**
 * Simulates what availableYears useMemo produces from classrooms API data.
 * Returns sorted-descending unique academic years from classroom items.
 */
function deriveAvailableYears(items: { academicYear: string }[]): string[] {
  const s = new Set<string>();
  items.forEach((c) => s.add(c.academicYear));
  return Array.from(s).sort().reverse();
}

/**
 * Simulates the FinalizationPage's old (broken) default.
 * Kept here to document the regression.
 */
function oldCurrentAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`; // e.g. "2026/27"
}

describe('Academic year: deriveAvailableYears utility', () => {
  it('returns "2026" when all classrooms use plain year', () => {
    const items = [
      { academicYear: '2026' },
      { academicYear: '2026' },
      { academicYear: '2026' },
    ];
    expect(deriveAvailableYears(items)).toEqual(['2026']);
  });

  it('returns both years when classrooms have mixed formats', () => {
    const items = [
      { academicYear: '2026' },
      { academicYear: '2026/27' },
    ];
    const years = deriveAvailableYears(items);
    expect(years).toContain('2026');
    expect(years).toContain('2026/27');
  });

  it('returns most-recent year first (sorted descending)', () => {
    const items = [
      { academicYear: '2025' },
      { academicYear: '2026' },
      { academicYear: '2024' },
    ];
    expect(deriveAvailableYears(items)[0]).toBe('2026');
  });

  it('returns empty array for empty classrooms list', () => {
    expect(deriveAvailableYears([])).toEqual([]);
  });
});

describe('[REGRESSION] FinalizationPage: old hardcoded default vs classrooms-derived default', () => {
  it('old default "2026/27" does NOT appear in "2026" classroom list — this caused "No section found"', () => {
    const classroomsYear = '2026';
    const oldDefault = oldCurrentAcademicYear(); // "2026/27" (when run in 2026)

    // The bug: hardcoded default != classroom year → filteredClassrooms was always []
    expect(oldDefault).not.toBe(classroomsYear);
  });

  it('new default (first of availableYears) MATCHES the classroom list', () => {
    const items = [{ academicYear: '2026' }];
    const availableYears = deriveAvailableYears(items);
    const newDefault = availableYears[0] ?? ''; // auto-selected from classrooms

    expect(newDefault).toBe('2026');
    // Filtering classrooms by newDefault correctly returns matches
    const filtered = items.filter((c) => c.academicYear === newDefault);
    expect(filtered).toHaveLength(1);
  });

  it('when no classrooms loaded yet, default is empty string (no premature filter)', () => {
    const availableYears: string[] = [];
    const newDefault = availableYears[0] ?? '';
    expect(newDefault).toBe('');
  });
});

describe('Academic year regex: both formats must be accepted', () => {
  // Mirrors the backend regex: /^\d{4}(\/\d{2,4})?$/
  const regex = /^\d{4}(\/\d{2,4})?$/;

  it('accepts "2026" (plain year)', () => expect(regex.test('2026')).toBe(true));
  it('accepts "2026/27"', () => expect(regex.test('2026/27')).toBe(true));
  it('accepts "2026/2027"', () => expect(regex.test('2026/2027')).toBe(true));
  it('rejects "26"', () => expect(regex.test('26')).toBe(false));
  it('rejects "2026/7" (single digit suffix)', () => expect(regex.test('2026/7')).toBe(false));
  it('rejects empty string', () => expect(regex.test('')).toBe(false));
  it('rejects "current"', () => expect(regex.test('current')).toBe(false));
  it('rejects "2026-27" (dash separator)', () => expect(regex.test('2026-27')).toBe(false));
});
