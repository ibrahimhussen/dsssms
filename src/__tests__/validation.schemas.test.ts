/**
 * Zod validation schema tests — frontend form validation
 */
import { describe, it, expect } from 'vitest';
import { loginFormSchema }        from '../lib/validation/auth';
import { createStaffFormSchema }  from '../lib/validation/user';
import { newAdmissionFormSchema, transferAdmissionFormSchema, transferOutFormSchema } from '../lib/validation/student';
import { createSubjectFormSchema } from '../lib/validation/subject';
import { createClassroomFormSchema } from '../lib/validation/classroom';

// ── A. Auth login schema ──────────────────────────────────────────────────────

describe('A. loginFormSchema', () => {
  it('accepts valid credentials', () => {
    const r = loginFormSchema.safeParse({ username: 'director', password: 'Pass1!' });
    expect(r.success).toBe(true);
  });

  it('rejects empty username', () => {
    const r = loginFormSchema.safeParse({ username: '', password: 'Pass1!' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('username');
  });

  it('rejects empty password', () => {
    const r = loginFormSchema.safeParse({ username: 'director', password: '' });
    expect(r.success).toBe(false);
  });

  it('trims whitespace from username', () => {
    const r = loginFormSchema.safeParse({ username: '  director  ', password: 'Pass1!' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.username).toBe('director');
  });
});

// ── B. Create staff schema ────────────────────────────────────────────────────

describe('B. createStaffFormSchema', () => {
  const VALID = { role: 'TEACHER' as const, firstName: 'Tom', lastName: 'T' };

  it('accepts minimal valid input', () => {
    expect(createStaffFormSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts valid DIRECTOR role', () => {
    expect(createStaffFormSchema.safeParse({ ...VALID, role: 'DIRECTOR' }).success).toBe(true);
  });

  it('rejects STUDENT and PARENT roles', () => {
    expect(createStaffFormSchema.safeParse({ ...VALID, role: 'STUDENT' }).success).toBe(false);
    expect(createStaffFormSchema.safeParse({ ...VALID, role: 'PARENT' }).success).toBe(false);
  });

  it('rejects missing firstName', () => {
    const r = createStaffFormSchema.safeParse({ ...VALID, firstName: '' });
    expect(r.success).toBe(false);
  });

  it('accepts valid email', () => {
    const r = createStaffFormSchema.safeParse({ ...VALID, email: 'tom@school.et' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email format', () => {
    const r = createStaffFormSchema.safeParse({ ...VALID, email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('accepts empty string as email (optional)', () => {
    const r = createStaffFormSchema.safeParse({ ...VALID, email: '' });
    expect(r.success).toBe(true);
  });
});

// ── C. New admission schema ───────────────────────────────────────────────────

describe('C. newAdmissionFormSchema', () => {
  const BASE = {
    firstName: 'Alice', lastName: 'Bekele',
    gender: 'F' as const, dateOfBirth: '2010-01-15', classroomId: 1,
  };

  it('accepts valid minimal input', () => {
    expect(newAdmissionFormSchema.safeParse(BASE).success).toBe(true);
  });

  it('rejects missing firstName', () => {
    expect(newAdmissionFormSchema.safeParse({ ...BASE, firstName: '' }).success).toBe(false);
  });

  it('rejects invalid gender', () => {
    expect(newAdmissionFormSchema.safeParse({ ...BASE, gender: 'X' }).success).toBe(false);
  });

  it('rejects missing dateOfBirth', () => {
    expect(newAdmissionFormSchema.safeParse({ ...BASE, dateOfBirth: '' }).success).toBe(false);
  });

  it('rejects classroomId of 0', () => {
    expect(newAdmissionFormSchema.safeParse({ ...BASE, classroomId: 0 }).success).toBe(false);
  });

  it('addGuardian=true requires guardianFullName', () => {
    const r = newAdmissionFormSchema.safeParse({ ...BASE, addGuardian: true });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('guardianFullName');
  });

  it('addGuardian=true requires guardianRelationship', () => {
    const r = newAdmissionFormSchema.safeParse({
      ...BASE, addGuardian: true, guardianFullName: 'Papa P',
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('guardianRelationship');
  });

  it('addGuardian=true succeeds when all guardian fields provided', () => {
    const r = newAdmissionFormSchema.safeParse({
      ...BASE, addGuardian: true, guardianFullName: 'Papa P', guardianRelationship: 'FATHER',
    });
    expect(r.success).toBe(true);
  });

  it('addGuardian=false skips guardian validation', () => {
    expect(newAdmissionFormSchema.safeParse({ ...BASE, addGuardian: false }).success).toBe(true);
  });
});

// ── D. Transfer admission schema ──────────────────────────────────────────────

describe('D. transferAdmissionFormSchema', () => {
  const BASE = {
    firstName: 'Bob', lastName: 'T', gender: 'M' as const,
    dateOfBirth: '2010-01-01', classroomId: 1,
    previousSchoolName: 'City School', lastGradeCompleted: 'Grade 8',
  };

  it('accepts valid transfer admission', () => {
    expect(transferAdmissionFormSchema.safeParse(BASE).success).toBe(true);
  });

  it('rejects missing previousSchoolName', () => {
    expect(transferAdmissionFormSchema.safeParse({ ...BASE, previousSchoolName: '' }).success).toBe(false);
  });

  it('rejects missing lastGradeCompleted', () => {
    expect(transferAdmissionFormSchema.safeParse({ ...BASE, lastGradeCompleted: '' }).success).toBe(false);
  });
});

// ── E. Transfer-out schema ────────────────────────────────────────────────────

describe('E. transferOutFormSchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(transferOutFormSchema.safeParse({}).success).toBe(true);
  });

  it('accepts with destination and reason', () => {
    const r = transferOutFormSchema.safeParse({
      transferredOutDestination: 'City School', transferredOutReason: 'Family moved',
    });
    expect(r.success).toBe(true);
  });
});

// ── F. Subject schema ─────────────────────────────────────────────────────────

describe('F. createSubjectFormSchema', () => {
  it('accepts valid subject', () => {
    expect(createSubjectFormSchema.safeParse({ subjectCode: 'ENG9', subjectName: 'English' }).success).toBe(true);
  });

  it('rejects empty subjectCode', () => {
    expect(createSubjectFormSchema.safeParse({ subjectCode: '', subjectName: 'English' }).success).toBe(false);
  });

  it('rejects empty subjectName', () => {
    expect(createSubjectFormSchema.safeParse({ subjectCode: 'ENG9', subjectName: '' }).success).toBe(false);
  });

  it('trims whitespace from code', () => {
    const r = createSubjectFormSchema.safeParse({ subjectCode: '  ENG  ', subjectName: 'English' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.subjectCode).toBe('ENG');
  });
});

// ── G. Classroom schema ───────────────────────────────────────────────────────

describe('G. createClassroomFormSchema', () => {
  const VALID = { className: 'Grade 9', section: 'A', academicYear: '2026/27' };

  it('accepts valid classroom', () => {
    expect(createClassroomFormSchema.safeParse(VALID).success).toBe(true);
  });

  it('defaults session to MORNING', () => {
    const r = createClassroomFormSchema.safeParse(VALID);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.session).toBe('MORNING');
  });

  it('accepts AFTERNOON session', () => {
    expect(createClassroomFormSchema.safeParse({ ...VALID, session: 'AFTERNOON' }).success).toBe(true);
  });

  it('rejects invalid session value', () => {
    expect(createClassroomFormSchema.safeParse({ ...VALID, session: 'EVENING' }).success).toBe(false);
  });

  it('rejects empty className', () => {
    expect(createClassroomFormSchema.safeParse({ ...VALID, className: '' }).success).toBe(false);
  });

  it('rejects invalid academicYear format', () => {
    expect(createClassroomFormSchema.safeParse({ ...VALID, academicYear: 'invalid' }).success).toBe(false);
    expect(createClassroomFormSchema.safeParse({ ...VALID, academicYear: '2026' }).success).toBe(true);
    expect(createClassroomFormSchema.safeParse({ ...VALID, academicYear: '2026/27' }).success).toBe(true);
  });

  it('accepts valid academicYear formats', () => {
    expect(createClassroomFormSchema.safeParse({ ...VALID, academicYear: '2025/26' }).success).toBe(true);
    expect(createClassroomFormSchema.safeParse({ ...VALID, academicYear: '2026' }).success).toBe(true);
  });
});
