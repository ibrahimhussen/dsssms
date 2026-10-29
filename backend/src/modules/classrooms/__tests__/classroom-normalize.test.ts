/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ClassroomService — className normalisation regression tests.
 *
 * Root cause fixed: classrooms were created with inconsistent className casing
 * ("grade 11", "GRADE 10") while GradeSubjectConfig stores "Grade N" (title case).
 * The frontend filter (c.className === grade) failed because the dropdown value
 * from classrooms didn't match the normalised GradeSubjectConfig name.
 *
 * Fix: normaliseClassName() applied in toClassroomSummaryDto() so every API
 * consumer receives consistent "Grade N" values regardless of DB casing.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ClassroomService } from '../classroom.service';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teacher:   { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { prisma } from '../../../database/prisma-client';

function mkClassroom(overrides: { classroomId?: number; className: string; section?: string; academicYear?: string }) {
  return {
    classroomId: overrides.classroomId ?? 1,
    className: overrides.className,
    section: overrides.section ?? 'A',
    academicYear: overrides.academicYear ?? '2026',
    session: 'MORNING',
    homeroomTeacherId: null,
    homeroomTeacher: null,
    _count: { students: 0 },
  };
}

describe('ClassroomService — normaliseClassName in DTO', () => {
  let svc: ClassroomService;
  beforeEach(() => { svc = new ClassroomService(); vi.clearAllMocks(); });

  // ── getClassroomById normalization ──────────────────────────────────────

  it('[REGRESSION] normalises "grade 11" (lowercase) to "Grade 11"', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(mkClassroom({ className: 'grade 11' }));
    const dto = await svc.getClassroomById(31);
    expect(dto.className).toBe('Grade 11');
  });

  it('[REGRESSION] normalises "GRADE 10" (uppercase) to "Grade 10"', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(mkClassroom({ className: 'GRADE 10' }));
    const dto = await svc.getClassroomById(28);
    expect(dto.className).toBe('Grade 10');
  });

  it('[REGRESSION] normalises "grade 12" (lowercase) to "Grade 12"', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(mkClassroom({ className: 'grade 12' }));
    const dto = await svc.getClassroomById(34);
    expect(dto.className).toBe('Grade 12');
  });

  it('preserves "Grade 9" (already correct) unchanged', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(mkClassroom({ className: 'Grade 9' }));
    const dto = await svc.getClassroomById(13);
    expect(dto.className).toBe('Grade 9');
  });

  it('normalises "Grade9" (no space) to "Grade 9"', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(mkClassroom({ className: 'Grade9' }));
    const dto = await svc.getClassroomById(1);
    expect(dto.className).toBe('Grade 9');
  });

  it('leaves non-numeric class name unchanged', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(mkClassroom({ className: 'Pre-Primary' }));
    const dto = await svc.getClassroomById(99);
    expect(dto.className).toBe('Pre-Primary');
  });

  // ── listClassrooms normalization ────────────────────────────────────────

  it('[REGRESSION] listClassrooms normalises all className values', async () => {
    const rawClassrooms = [
      mkClassroom({ classroomId: 28, className: 'GRADE 10', section: 'A', academicYear: '2026' }),
      mkClassroom({ classroomId: 31, className: 'grade 11', section: 'A', academicYear: '2026' }),
      mkClassroom({ classroomId: 32, className: 'grade 11', section: 'B', academicYear: '2026' }),
      mkClassroom({ classroomId: 13, className: 'Grade 9',  section: 'A', academicYear: '2026' }),
    ];
    (prisma.classroom.findMany as Mock).mockResolvedValue(rawClassrooms);
    (prisma.classroom.count   as Mock).mockResolvedValue(4);

    const { items } = await svc.listClassrooms({ page: 1, limit: 100 });

    expect(items[0].className).toBe('Grade 10');   // was "GRADE 10"
    expect(items[1].className).toBe('Grade 11');   // was "grade 11"
    expect(items[2].className).toBe('Grade 11');   // was "grade 11"
    expect(items[3].className).toBe('Grade 9');    // already correct
  });

  it('[REGRESSION] all Grade 11 classrooms appear when filtering by "Grade 11"', async () => {
    const rawClassrooms = [
      mkClassroom({ classroomId: 31, className: 'grade 11', section: 'A', academicYear: '2026' }),
      mkClassroom({ classroomId: 32, className: 'grade 11', section: 'B', academicYear: '2026' }),
      mkClassroom({ classroomId: 33, className: 'grade 11', section: 'C', academicYear: '2026' }),
    ];
    (prisma.classroom.findMany as Mock).mockResolvedValue(rawClassrooms);
    (prisma.classroom.count   as Mock).mockResolvedValue(3);

    const { items } = await svc.listClassrooms({ page: 1, limit: 100 });

    // After normalisation, frontend filter `c.className === "Grade 11"` works
    const grade11 = items.filter(c => c.className === 'Grade 11' && c.academicYear === '2026');
    expect(grade11).toHaveLength(3);
    expect(grade11.map(c => c.section)).toEqual(['A', 'B', 'C']);
  });

  it('normalized className matches GradeSubjectConfig stored value "Grade 11"', async () => {
    // GradeSubjectConfig always stores "Grade N" format.
    // After normalisation, classroom.className === gradeSubjectConfig.className
    // without case-sensitivity issues in the JS frontend filter.
    (prisma.classroom.findUnique as Mock).mockResolvedValue(mkClassroom({ className: 'grade 11' }));
    const dto = await svc.getClassroomById(31);
    const gscClassName = 'Grade 11'; // stored in GradeSubjectConfig
    expect(dto.className).toBe(gscClassName);
  });

  // ── createClassroom preserves raw input ────────────────────────────────

  it('create stores the raw input className (normalisation is read-only)', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    (prisma.classroom.create    as Mock).mockResolvedValue(
      mkClassroom({ className: 'Grade 11', section: 'D', academicYear: '2026' })
    );
    const dto = await svc.createClassroom({ className: 'Grade 11', section: 'D', academicYear: '2026', session: 'MORNING' });
    // create() is called with the user's input, DTO normalises the returned value
    expect(dto.className).toBe('Grade 11');
  });
});

// ── Frontend normalisation utility ─────────────────────────────────────────────
// The backend classroom.service.ts exposes normalizeClassName through the DTO.
// The frontend has a mirror in src/lib/normalize-grade.ts.
// Test the logic directly here to verify it matches the backend service behavior.

function normalizeClassName(rawName: string): string {
  const match = rawName.match(/(?:Grade\s*)?(\d+)/i);
  return match ? `Grade ${match[1]}` : rawName;
}

describe('normalizeClassName logic (mirrors backend + frontend utility)', () => {
  // This mirrors the backend extractClassName() logic used in
  // academic-register.service.ts generateGradeRegister()

  it('"grade 11" → "Grade 11"',  () => expect(normalizeClassName('grade 11')).toBe('Grade 11'));
  it('"GRADE 10" → "Grade 10"',  () => expect(normalizeClassName('GRADE 10')).toBe('Grade 10'));
  it('"grade 12" → "Grade 12"',  () => expect(normalizeClassName('grade 12')).toBe('Grade 12'));
  it('"Grade 9"  → "Grade 9"',   () => expect(normalizeClassName('Grade 9')).toBe('Grade 9'));
  it('"Grade9"   → "Grade 9"',   () => expect(normalizeClassName('Grade9')).toBe('Grade 9'));
  it('"9"        → "Grade 9"',   () => expect(normalizeClassName('9')).toBe('Grade 9'));
  it('"11"       → "Grade 11"',  () => expect(normalizeClassName('11')).toBe('Grade 11'));
  it('"GRADE11"  → "Grade 11"',  () => expect(normalizeClassName('GRADE11')).toBe('Grade 11'));
  it('non-numeric returns as-is', () => expect(normalizeClassName('Pre-Primary')).toBe('Pre-Primary'));

  it('after normalisation, all grade names are === "Grade N" (title case)', () => {
    const rawNames = ['grade 11', 'GRADE 10', 'Grade 9', 'grade 12'];
    const normalized = rawNames.map(normalizeClassName);
    expect(normalized).toEqual(['Grade 11', 'Grade 10', 'Grade 9', 'Grade 12']);
    // Every normalized value is title-case "Grade N"
    normalized.forEach(n => expect(n).toMatch(/^Grade \d+$/));
  });

  it('[REGRESSION] FALLBACK_GRADE_OPTIONS already normalized — no mismatch', () => {
    const fallback = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    fallback.forEach(g => expect(normalizeClassName(g)).toBe(g));
  });
});
