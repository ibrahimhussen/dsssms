/**
 * Academic year validation regression tests.
 *
 * Root cause fixed: academic-register, finalization, and conduct validation
 * schemas previously rejected plain "YYYY" academic years (e.g. "2026") with
 * a 422 Validation failed error. DB classrooms are created with both "2026"
 * and "2026/27" format years, so the regex must accept both.
 *
 * These tests verify the updated regex:  ^\d{4}(\/\d{2,4})?$
 */
import { describe, it, expect } from 'vitest';
import {
  classroomRegisterSchema,
  gradeRegisterSchema,
  exportRegisterSchema,
} from '../validation/academic-register.validation';
import {
  submitForReviewSchema,
  finalizeClassroomSchema,
} from '../../finalization/validation/finalization.validation';

// ── academic-register schemas ─────────────────────────────────────────────────

describe('classroomRegisterSchema — academicYear', () => {
  const base = { classroomId: 1, viewMode: 'SEMESTER_1' as const };

  it('accepts plain "YYYY" format (e.g. "2026")', () => {
    const result = classroomRegisterSchema.safeParse({ ...base, academicYear: '2026' });
    expect(result.success).toBe(true);
  });

  it('accepts "YYYY/YY" format (e.g. "2026/27")', () => {
    const result = classroomRegisterSchema.safeParse({ ...base, academicYear: '2026/27' });
    expect(result.success).toBe(true);
  });

  it('accepts "YYYY/YYYY" four-digit suffix format (e.g. "2026/2027")', () => {
    const result = classroomRegisterSchema.safeParse({ ...base, academicYear: '2026/2027' });
    expect(result.success).toBe(true);
  });

  it('rejects "YYYY/Y" single-digit suffix', () => {
    const result = classroomRegisterSchema.safeParse({ ...base, academicYear: '2026/7' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = classroomRegisterSchema.safeParse({ ...base, academicYear: '' });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric year', () => {
    const result = classroomRegisterSchema.safeParse({ ...base, academicYear: 'current' });
    expect(result.success).toBe(false);
  });

  it('rejects partial year "26"', () => {
    const result = classroomRegisterSchema.safeParse({ ...base, academicYear: '26' });
    expect(result.success).toBe(false);
  });
});

describe('gradeRegisterSchema — academicYear', () => {
  const base = { grade: 'Grade 9', viewMode: 'SEMESTER_1' as const };

  it('accepts "2026"', () => {
    expect(gradeRegisterSchema.safeParse({ ...base, academicYear: '2026' }).success).toBe(true);
  });

  it('accepts "2026/27"', () => {
    expect(gradeRegisterSchema.safeParse({ ...base, academicYear: '2026/27' }).success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(gradeRegisterSchema.safeParse({ ...base, academicYear: '' }).success).toBe(false);
  });
});

describe('exportRegisterSchema — academicYear', () => {
  const base = { classroomId: 1, viewMode: 'SEMESTER_1' as const, format: 'csv' as const };

  it('accepts "2026"', () => {
    expect(exportRegisterSchema.safeParse({ ...base, academicYear: '2026' }).success).toBe(true);
  });

  it('accepts "2026/27"', () => {
    expect(exportRegisterSchema.safeParse({ ...base, academicYear: '2026/27' }).success).toBe(true);
  });
});

// ── finalization schemas ──────────────────────────────────────────────────────

describe('submitForReviewSchema — academicYear', () => {
  const base = { teacherSubjectId: 1, semester: 'SEMESTER_1' as const };

  it('accepts "2026"', () => {
    expect(submitForReviewSchema.safeParse({ ...base, academicYear: '2026' }).success).toBe(true);
  });

  it('accepts "2026/27"', () => {
    expect(submitForReviewSchema.safeParse({ ...base, academicYear: '2026/27' }).success).toBe(true);
  });

  it('rejects missing academicYear', () => {
    expect(submitForReviewSchema.safeParse({ ...base }).success).toBe(false);
  });
});

describe('finalizeClassroomSchema — academicYear', () => {
  const base = { classroomId: 1, semester: 'SEMESTER_1' as const };

  it('accepts "2026"', () => {
    expect(finalizeClassroomSchema.safeParse({ ...base, academicYear: '2026' }).success).toBe(true);
  });

  it('accepts "2026/27"', () => {
    expect(finalizeClassroomSchema.safeParse({ ...base, academicYear: '2026/27' }).success).toBe(true);
  });
});
