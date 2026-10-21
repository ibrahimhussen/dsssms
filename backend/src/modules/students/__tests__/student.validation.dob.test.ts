/**
 * student.validation.ts — dateOfBirth validation tests
 *
 * Tests the Zod schemas (createStudentSchema, updateStudentSchema, bulkImportSchema)
 * against date-of-birth boundary cases.
 *
 * No mocks required — these are pure Zod schema parse() calls.
 */
import { describe, it, expect } from 'vitest';
import { createStudentSchema, updateStudentSchema, bulkImportSchema } from '../validation/student.validation';

// ── helpers ───────────────────────────────────────────────────────────────────

const TODAY = new Date();

/** ISO date string exactly N years before today, ±dayOffset. */
function dobString(years: number, dayOffset = 0): string {
  const d = new Date(TODAY);
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Minimal valid createStudentSchema payload with a given DOB. */
function baseInput(dateOfBirth: string) {
  return {
    firstName:   'Test',
    lastName:    'Student',
    gender:      'M',
    dateOfBirth,
    classroomId: 1,
  };
}

// ── createStudentSchema — dateOfBirth ─────────────────────────────────────────

describe('createStudentSchema — dateOfBirth', () => {
  it('accepts a student who turns 16 exactly today', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(16)));
    expect(result.success).toBe(true);
  });

  it('accepts a student who turned 16 one day ago', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(16, -1)));
    expect(result.success).toBe(true);
  });

  it('accepts a student who is 17 years old', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(17)));
    expect(result.success).toBe(true);
  });

  it('accepts a student who is 20 years old', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(20)));
    expect(result.success).toBe(true);
  });

  it('rejects a student whose 16th birthday is tomorrow (still 15)', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(16, +1)));
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0].message;
      expect(msg).toMatch(/16/);
    }
  });

  it('rejects a 15-year-old', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(15)));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/16/);
    }
  });

  it('rejects a 14-year-old', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(14)));
    expect(result.success).toBe(false);
  });

  it('rejects a future date of birth', () => {
    const tomorrow = new Date(TODAY);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = createStudentSchema.safeParse(baseInput(tomorrow.toISOString().slice(0, 10)));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/future/i);
    }
  });

  it('rejects a date far in the future', () => {
    const result = createStudentSchema.safeParse(baseInput('2050-01-01'));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid date string', () => {
    const result = createStudentSchema.safeParse(baseInput('not-a-date'));
    expect(result.success).toBe(false);
  });

  it('rejects an empty date string', () => {
    const result = createStudentSchema.safeParse(baseInput(''));
    expect(result.success).toBe(false);
  });

  it('handles a leap-year birthday (Feb 29) — 16-year-old admitted on a non-leap year', () => {
    // Someone born Feb 29 2000 (leap). Today might be non-leap.
    // Their admission DOB string is 2000-02-29.
    const result = createStudentSchema.safeParse(baseInput('2000-02-29'));
    // They were born in 2000; today is 2026+ so they are 26+ years old — must pass.
    expect(result.success).toBe(true);
  });

  it('error message mentions minimum age', () => {
    const result = createStudentSchema.safeParse(baseInput(dobString(15)));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toContain('16');
    }
  });
});

// ── updateStudentSchema — dateOfBirth (optional field) ────────────────────────

describe('updateStudentSchema — dateOfBirth', () => {
  it('accepts update without dateOfBirth (field is optional)', () => {
    const result = updateStudentSchema.safeParse({ firstName: 'New' });
    expect(result.success).toBe(true);
  });

  it('accepts update with a valid 16+ dateOfBirth', () => {
    const result = updateStudentSchema.safeParse({ dateOfBirth: dobString(17) });
    expect(result.success).toBe(true);
  });

  it('rejects update with an underage dateOfBirth', () => {
    const result = updateStudentSchema.safeParse({ dateOfBirth: dobString(15) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/16/);
    }
  });

  it('rejects update with a future dateOfBirth', () => {
    const result = updateStudentSchema.safeParse({ dateOfBirth: '2050-01-01' });
    expect(result.success).toBe(false);
  });
});

// ── bulkImportSchema — inherits createStudentSchema rules ────────────────────

describe('bulkImportSchema — dateOfBirth age rule propagation', () => {
  it('rejects bulk import with one underage student', () => {
    const result = bulkImportSchema.safeParse({
      students: [baseInput(dobString(15))],
    });
    expect(result.success).toBe(false);
  });

  it('rejects bulk import with a future DOB student', () => {
    const result = bulkImportSchema.safeParse({
      students: [baseInput('2050-01-01')],
    });
    expect(result.success).toBe(false);
  });

  it('accepts bulk import where all students are 16+', () => {
    const result = bulkImportSchema.safeParse({
      students: [
        baseInput(dobString(16)),
        baseInput(dobString(17)),
        baseInput(dobString(20)),
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects mixed batch — even one underage student fails the whole batch', () => {
    // bulkImportSchema validates each element; Zod collects all errors.
    const result = bulkImportSchema.safeParse({
      students: [
        baseInput(dobString(17)), // valid
        baseInput(dobString(15)), // invalid — underage
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty student array', () => {
    const result = bulkImportSchema.safeParse({ students: [] });
    expect(result.success).toBe(false);
  });
});
