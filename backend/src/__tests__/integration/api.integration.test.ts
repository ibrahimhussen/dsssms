/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.12 — API/HTTP Integration Tests
 *
 * Tests the real route → middleware → controller → service HTTP flow
 * using supertest against the real Express app (createApp()).
 *
 * ALL Prisma and external dependencies are mocked — no real DB required.
 * JWT tokens are signed with the test secrets set in process.env below.
 *
 * Modules covered:
 *  A. Health check
 *  B. Authentication (login validation, /me auth, token format)
 *  C. Students (RBAC, list, get, validation)
 *  D. Grades (RBAC, component creation, student grades)
 *  E. Academic Register (RBAC, validation, success path)
 *  F. Finalization (RBAC, validation)
 *  G. Attendance (RBAC, validation, success path)
 *  H. Notifications (auth, /me inbox, mark-read, delete)
 *  I. Academic Reports (RBAC, list, get)
 *  J. Error handling and response envelope
 */

// ── Set env BEFORE any module loads ──────────────────────────────────────────
process.env.NODE_ENV           = 'test';
process.env.DATABASE_URL       = 'mysql://test:test@localhost:3306/test';
process.env.JWT_ACCESS_SECRET  = 'test-access-secret-32chars-padding!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-paddin!!';
process.env.JWT_ACCESS_EXPIRES_IN  = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.API_PREFIX         = '/api/v1';

// ── Mock pino-http before app loads (prevents real logger init errors) ────────
vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../core/logger/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() },
}));

// ── Mock Prisma ───────────────────────────────────────────────────────────────
vi.mock('../../database/prisma-client', () => ({
  prisma: {
    user:                  { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    role:                  { findUnique: vi.fn() },
    refreshToken:          { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    student:               { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
    studentEnrollment:     { findMany: vi.fn(), count: vi.fn() },
    classroom:             { findUnique: vi.fn(), findMany: vi.fn() },
    teacher:               { findUnique: vi.fn(), findMany: vi.fn() },
    teacherSubject:        { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    gradeSubjectConfig:    { findMany: vi.fn() },
    gradeComponent:        { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn(), count: vi.fn() },
    gradeEntry:            { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    subjectFinalization:   { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    classroomFinalization: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    attendance:            { findMany: vi.fn(), groupBy: vi.fn(), upsert: vi.fn() },
    studentConduct:        { findMany: vi.fn() },
    notification:          {
      findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(),
      create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(),
    },
    academicReport:        { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    studentParentLink:     { findMany: vi.fn(), findUnique: vi.fn() },
    // authorizeWithPermissions queries this — must return [] for roles that don't have permission
    userPermission:        { findMany: vi.fn().mockResolvedValue([]) },
    systemSetting:         { findUnique: vi.fn(), upsert: vi.fn() },
    promotionBatch:        { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    auditLog:              { create: vi.fn().mockResolvedValue({}) },
    $transaction:          vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));
// Only mock the standalone helper functions — NOT the NotificationService class.
// The controller uses notificationService (class instance) directly.
vi.mock('../../modules/notifications/notification.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/notifications/notification.service')>();
  return {
    ...actual,
    createAutoNotification: vi.fn().mockResolvedValue(undefined),
    notifyStudentParents:   vi.fn().mockResolvedValue(undefined),
  };
});

// ── Imports ───────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, type Mock } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../app';
import { prisma } from '../../database/prisma-client';
import { signAccessToken } from '../../core/utils/jwt.util';
import { RoleName } from '@prisma/client';
import { Server } from 'http';

// ── App + server ──────────────────────────────────────────────────────────────
let app: Application;
let server: Server;

beforeAll(() => {
  app    = createApp();
  server = app.listen(0);
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// ── Token helpers ─────────────────────────────────────────────────────────────
const mkToken = (role: RoleName, userId = 1) =>
  signAccessToken({ sub: userId, role, username: role.toLowerCase() });

const dirToken  = mkToken(RoleName.DIRECTOR, 1);
const adminToken = mkToken(RoleName.ADMIN, 2);
const tchToken  = mkToken(RoleName.TEACHER, 3);
const stuToken  = mkToken(RoleName.STUDENT, 4);
const parToken  = mkToken(RoleName.PARENT, 5);
const vdToken   = mkToken(RoleName.VICE_DIRECTOR, 6);

// ── Shared fixtures ───────────────────────────────────────────────────────────
const CL9A = { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27', homeroomTeacherId: null };
const SETTINGS = { id: 1, promotionPassMark: 50, minimumSubjectPassMark: 40, schoolName: 'Test',
  currentAcademicYear: '2026/27', updatedBy: null, updatedAt: new Date() };
const STU = {
  studentId: 101, userId: 201, classroomId: 1, admissionNumber: 'DSH-001',
  firstName: 'Alice', lastName: 'A', gender: 'F', dateOfBirth: new Date('2010-01-15'),
  address: null, enrolledAt: new Date(), admissionType: 'NEW_STUDENT', studentStatus: 'ACTIVE',
  completionYear: null, lastGradeCompleted: null, previousAcademicSummary: null,
  previousSchoolLocation: null, previousSchoolName: null, previousSchoolType: null,
  previousStudentId: null, transferReason: null, transferCertificateRef: null,
  transferredOutAt: null, transferredOutDestination: null, transferredOutReason: null,
  classroom: CL9A, user: { userId: 201, username: 'DSH-001' }, parentLinks: [],
};
const TEACHER = { teacherId: 100, userId: 3, firstName: 'Tom', lastName: 'T' };

beforeEach(() => {
  vi.clearAllMocks();
  // Restore critical defaults cleared by clearAllMocks
  // authorizeWithPermissions always needs this to return [] (no temp permissions for forbidden roles)
  (prisma.userPermission.findMany as Mock).mockResolvedValue([]);
  // auditLog.create must always succeed
  (prisma.auditLog.create as Mock).mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════════════════
// A. Health check
// ═══════════════════════════════════════════════════════════════════════════════

describe('A. Health check', () => {
  it('GET /health → 200, success:true, data.status:ok', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data.status).toBe('ok');
    expect(typeof r.body.data.timestamp).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. Authentication
// ═══════════════════════════════════════════════════════════════════════════════

describe('B. Authentication', () => {
  describe('POST /api/v1/auth/login — validation', () => {
    it('returns 422 when password is missing', async () => {
      const r = await request(app).post('/api/v1/auth/login').send({ username: 'dir' });
      expect(r.status).toBe(422);
      expect(r.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when username is missing', async () => {
      const r = await request(app).post('/api/v1/auth/login').send({ password: 'Pass1!' });
      expect(r.status).toBe(422);
    });

    it('returns 422 when body is empty', async () => {
      const r = await request(app).post('/api/v1/auth/login').send({});
      expect(r.status).toBe(422);
    });
  });

  describe('GET /api/v1/auth/me — token validation', () => {
    it('returns 401 without Authorization header', async () => {
      const r = await request(app).get('/api/v1/auth/me');
      expect(r.status).toBe(401);
      expect(r.body.errorCode).toBe('UNAUTHORIZED');
    });

    it('returns 401 with malformed token', async () => {
      const r = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.jwt');
      expect(r.status).toBe(401);
    });

    it('returns 401 with non-Bearer scheme', async () => {
      const r = await request(app).get('/api/v1/auth/me').set('Authorization', `Basic ${dirToken}`);
      expect(r.status).toBe(401);
    });

    it('returns 200 with valid token', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue({
        userId: 1, username: 'director', email: null, status: 'ACTIVE',
        failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, createdAt: new Date(),
        role: { roleName: 'DIRECTOR' },
        administrator: null, director: { firstName: 'Dave', lastName: 'D' },
        viceDirector: null, teacher: null, student: null, parent: null,
        profilePicture: null, isTemporaryPassword: false,
      });
      const r = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. Students
// ═══════════════════════════════════════════════════════════════════════════════

describe('C. Students', () => {
  describe('GET /api/v1/students — list', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).get('/api/v1/students?page=1&limit=20');
      expect(r.status).toBe(401);
    });

    it('returns 403 for STUDENT role', async () => {
      // STUDENT is not in READ_ROLES; userPermission returns [] so no fallback
      const r = await request(app)
        .get('/api/v1/students?page=1&limit=20')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 403 for PARENT role', async () => {
      const r = await request(app)
        .get('/api/v1/students?page=1&limit=20')
        .set('Authorization', `Bearer ${parToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 200 for DIRECTOR', async () => {
      (prisma.student.findMany as Mock).mockResolvedValue([STU]);
      (prisma.student.count   as Mock).mockResolvedValue(1);
      const r = await request(app)
        .get('/api/v1/students?page=1&limit=20')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      // controller sends data: items (array directly), with pagination separate
      expect(Array.isArray(r.body.data)).toBe(true);
    });

    it('returns 200 for TEACHER (via authorizeWithPermissions)', async () => {
      (prisma.teacher.findUnique  as Mock).mockResolvedValue(TEACHER);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ classroomId: 1 }]);
      (prisma.student.findMany    as Mock).mockResolvedValue([STU]);
      (prisma.student.count       as Mock).mockResolvedValue(1);
      const r = await request(app)
        .get('/api/v1/students?page=1&limit=20')
        .set('Authorization', `Bearer ${tchToken}`);
      expect(r.status).toBe(200);
    });

    it('returns 422 when page param is non-numeric', async () => {
      const r = await request(app)
        .get('/api/v1/students?page=abc&limit=20')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(422);
    });
  });

  describe('GET /api/v1/students/:id', () => {
    it('returns 404 when student does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);
      const r = await request(app)
        .get('/api/v1/students/9999')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(404);
      expect(r.body.errorCode).toBe('NOT_FOUND');
    });

    it('returns 200 with correct data when student exists', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      const r = await request(app)
        .get('/api/v1/students/101')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.studentId).toBe(101);
      expect(r.body.data.admissionNumber).toBe('DSH-001');
    });

    it('returns 422 for non-numeric :id', async () => {
      const r = await request(app)
        .get('/api/v1/students/not-a-number')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(422);
    });
  });

  describe('GET /api/v1/students/me', () => {
    it('returns 403 for DIRECTOR role', async () => {
      const r = await request(app)
        .get('/api/v1/students/me')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 200 for STUDENT role (own profile)', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      const r = await request(app)
        .get('/api/v1/students/me')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. Grades
// ═══════════════════════════════════════════════════════════════════════════════

describe('D. Grades', () => {
  describe('POST /api/v1/grades/components', () => {
    it('returns 403 for DIRECTOR (teacher-only endpoint)', async () => {
      const r = await request(app)
        .post('/api/v1/grades/components')
        .set('Authorization', `Bearer ${dirToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name: 'Q1', maxMarks: 10 });
      expect(r.status).toBe(403);
    });

    it('returns 422 when maxMarks is missing', async () => {
      const r = await request(app)
        .post('/api/v1/grades/components')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name: 'Q1' });
      expect(r.status).toBe(422);
    });

    it('returns 422 when category is invalid enum value', async () => {
      const r = await request(app)
        .post('/api/v1/grades/components')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'NOT_VALID', name: 'Q1', maxMarks: 10 });
      expect(r.status).toBe(422);
    });

    it('returns 403 when teacher has no teacher profile', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
      const r = await request(app)
        .post('/api/v1/grades/components')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name: 'Q1', maxMarks: 10 });
      expect(r.status).toBe(403);
    });
  });

  describe('GET /api/v1/grades/components', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).get('/api/v1/grades/components?teacherSubjectId=1&semester=SEMESTER_1&academicYear=2026%2F27');
      expect(r.status).toBe(401);
    });

    it('returns 403 for STUDENT role', async () => {
      const r = await request(app)
        .get('/api/v1/grades/components?teacherSubjectId=1&semester=SEMESTER_1&academicYear=2026%2F27')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 200 for DIRECTOR with valid query params', async () => {
      (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
      const r = await request(app)
        .get('/api/v1/grades/components?teacherSubjectId=1&semester=SEMESTER_1&academicYear=2026%2F27')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.components).toBeDefined();
    });

    it('returns 422 when teacherSubjectId is missing', async () => {
      const r = await request(app)
        .get('/api/v1/grades/components?semester=SEMESTER_1&academicYear=2026%2F27')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(422);
    });
  });

  describe('GET /api/v1/grades/me', () => {
    it('returns 403 for TEACHER role (student-only endpoint)', async () => {
      const r = await request(app)
        .get('/api/v1/grades/me')
        .set('Authorization', `Bearer ${tchToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 200 for STUDENT role', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
      const r = await request(app)
        .get('/api/v1/grades/me')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. Academic Register
// ═══════════════════════════════════════════════════════════════════════════════

describe('E. Academic Register', () => {
  describe('GET /api/v1/academic-register — classroom register', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).get('/api/v1/academic-register?classroomId=1&academicYear=2026%2F27&viewMode=SEMESTER_1');
      expect(r.status).toBe(401);
    });

    it('returns 403 for STUDENT role', async () => {
      const r = await request(app)
        .get('/api/v1/academic-register?classroomId=1&academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 403 for PARENT role', async () => {
      const r = await request(app)
        .get('/api/v1/academic-register?classroomId=1&academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${parToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 422 when classroomId is missing', async () => {
      const r = await request(app)
        .get('/api/v1/academic-register?academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(422);
    });

    it('returns 422 when viewMode is invalid', async () => {
      const r = await request(app)
        .get('/api/v1/academic-register?classroomId=1&academicYear=2026%2F27&viewMode=BAD')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(422);
    });

    it('returns 404 when classroom does not exist', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
      const r = await request(app)
        .get('/api/v1/academic-register?classroomId=999&academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(404);
    });

    it('returns 200 with full register structure for DIRECTOR', async () => {
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]); // no historical records → fall back to student.classroomId
      (prisma.studentEnrollment.count as Mock).mockResolvedValue(0);
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([
        { subjectId: 1, sortOrder: 0, subject: { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' } },
      ]);
      (prisma.student.findMany as Mock).mockResolvedValue([STU]);
      (prisma.student.count   as Mock).mockResolvedValue(1);
      (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
      (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
      (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
      (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
      (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
      (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
      (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
      (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
      const r = await request(app)
        .get('/api/v1/academic-register?classroomId=1&academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.metadata).toBeDefined();
      expect(r.body.data.subjects).toBeDefined();
      expect(Array.isArray(r.body.data.students)).toBe(true);
    });
  });

  describe('GET /api/v1/academic-register/grade — grade-wide register', () => {
    it('returns 403 for TEACHER role', async () => {
      const r = await request(app)
        .get('/api/v1/academic-register/grade?grade=Grade+9&academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${tchToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 403 for STUDENT role', async () => {
      const r = await request(app)
        .get('/api/v1/academic-register/grade?grade=Grade+9&academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 422 when grade param is missing', async () => {
      const r = await request(app)
        .get('/api/v1/academic-register/grade?academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(422);
    });

    it('returns 404 when no classrooms exist for the grade', async () => {
      (prisma.classroom.findMany as Mock).mockResolvedValue([]);
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);
      (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
      const r = await request(app)
        .get('/api/v1/academic-register/grade?grade=Grade+99&academicYear=2026%2F27&viewMode=SEMESTER_1')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. Finalization
// ═══════════════════════════════════════════════════════════════════════════════

describe('F. Finalization', () => {
  describe('POST /api/v1/finalization/submit-for-review', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).post('/api/v1/finalization/submit-for-review')
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27' });
      expect(r.status).toBe(401);
    });

    it('returns 403 for STUDENT role (teacher-only)', async () => {
      const r = await request(app)
        .post('/api/v1/finalization/submit-for-review')
        .set('Authorization', `Bearer ${stuToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27' });
      expect(r.status).toBe(403);
    });

    it('returns 403 for DIRECTOR role (teacher-only)', async () => {
      const r = await request(app)
        .post('/api/v1/finalization/submit-for-review')
        .set('Authorization', `Bearer ${dirToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27' });
      expect(r.status).toBe(403);
    });

    it('returns 422 when teacherSubjectId is missing', async () => {
      const r = await request(app)
        .post('/api/v1/finalization/submit-for-review')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ semester: 'SEMESTER_1', academicYear: '2026/27' });
      expect(r.status).toBe(422);
    });

    it('returns 422 when semester is invalid', async () => {
      const r = await request(app)
        .post('/api/v1/finalization/submit-for-review')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ teacherSubjectId: 1, semester: 'TERM_1', academicYear: '2026/27' });
      expect(r.status).toBe(422);
    });
  });

  describe('POST /api/v1/finalization/finalize-subject', () => {
    it('returns 403 for TEACHER role (oversight-only)', async () => {
      const r = await request(app)
        .post('/api/v1/finalization/finalize-subject')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27' });
      expect(r.status).toBe(403);
    });

    it('returns 403 for PARENT role', async () => {
      const r = await request(app)
        .post('/api/v1/finalization/finalize-subject')
        .set('Authorization', `Bearer ${parToken}`)
        .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27' });
      expect(r.status).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// G. Attendance
// ═══════════════════════════════════════════════════════════════════════════════

describe('G. Attendance', () => {
  describe('POST /api/v1/attendance — bulk mark', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).post('/api/v1/attendance');
      expect(r.status).toBe(401);
    });

    it('returns 403 for DIRECTOR role (teacher-only)', async () => {
      const r = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${dirToken}`)
        .send({ classroomId: 1, period: 0, attendanceDate: '2026-09-10',
          records: [{ studentId: 101, status: 'PRESENT' }] });
      expect(r.status).toBe(403);
    });

    it('returns 403 for STUDENT role', async () => {
      const r = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${stuToken}`)
        .send({ classroomId: 1, period: 0, attendanceDate: '2026-09-10',
          records: [{ studentId: 101, status: 'PRESENT' }] });
      expect(r.status).toBe(403);
    });

    it('returns 422 when records array is empty', async () => {
      const r = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ classroomId: 1, period: 0, attendanceDate: '2026-09-10', records: [] });
      expect(r.status).toBe(422);
    });

    it('returns 422 when attendanceDate is in the future', async () => {
      const r = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ classroomId: 1, period: 0, attendanceDate: '2099-01-01',
          records: [{ studentId: 101, status: 'PRESENT' }] });
      expect(r.status).toBe(422);
    });

    it('returns 422 when status is invalid enum', async () => {
      const r = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${tchToken}`)
        .send({ classroomId: 1, period: 0, attendanceDate: '2026-09-10',
          records: [{ studentId: 101, status: 'SLEEPING' }] });
      expect(r.status).toBe(422);
    });
  });

  describe('GET /api/v1/attendance — classroom attendance', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).get('/api/v1/attendance?classroomId=1&period=0&attendanceDate=2026-09-10');
      expect(r.status).toBe(401);
    });

    it('returns 403 for PARENT role', async () => {
      const r = await request(app)
        .get('/api/v1/attendance?classroomId=1&period=0&attendanceDate=2026-09-10')
        .set('Authorization', `Bearer ${parToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 200 for DIRECTOR with valid query', async () => {
      (prisma.attendance.findMany as Mock).mockResolvedValue([]);
      const r = await request(app)
        .get('/api/v1/attendance?classroomId=1&period=0&attendanceDate=2026-09-10')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.data)).toBe(true);
    });

    it('returns 422 when attendanceDate is missing', async () => {
      const r = await request(app)
        .get('/api/v1/attendance?classroomId=1&period=0')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(422);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// H. Notifications
// ═══════════════════════════════════════════════════════════════════════════════

describe('H. Notifications', () => {
  describe('GET /api/v1/notifications/me — inbox', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).get('/api/v1/notifications/me?page=1&limit=20');
      expect(r.status).toBe(401);
    });

    it('returns 200 for any authenticated user', async () => {
      (prisma.notification.findMany as Mock).mockResolvedValue([]);
      // count is called twice: totalItems + unreadCount
      (prisma.notification.count as Mock).mockResolvedValue(0);
      const r = await request(app)
        .get('/api/v1/notifications/me?page=1&limit=20')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.items).toBeDefined();
      expect(r.body.data.unreadCount).toBeDefined();
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('returns 200 with count for any authenticated user', async () => {
      (prisma.notification.count as Mock).mockResolvedValue(5);
      const r = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.unreadCount).toBe(5);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).patch('/api/v1/notifications/1/read');
      expect(r.status).toBe(401);
    });

    it('returns 404 when notification does not exist', async () => {
      (prisma.notification.findUnique as Mock).mockResolvedValue(null);
      const r = await request(app)
        .patch('/api/v1/notifications/9999/read')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(404);
    });

    it('returns 403 when notification belongs to a different user', async () => {
      // recipientUserId=99, but our director token has userId=1
      (prisma.notification.findUnique as Mock).mockResolvedValue({
        notificationId: 1, recipientUserId: 99,
        title: 'T', message: 'M', sentDate: new Date(),
        status: 'UNREAD', category: 'ANNOUNCEMENT',
        relatedEntity: null, relatedEntityId: null, deduplicationKey: null,
        senderUser: null, student: null, senderUserId: null, studentId: null,
      });
      const r = await request(app)
        .patch('/api/v1/notifications/1/read')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/notifications/:id', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).delete('/api/v1/notifications/1');
      expect(r.status).toBe(401);
    });

    it('returns 404 when notification does not exist', async () => {
      (prisma.notification.findUnique as Mock).mockResolvedValue(null);
      const r = await request(app)
        .delete('/api/v1/notifications/9999')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// I. Academic Reports
// ═══════════════════════════════════════════════════════════════════════════════

describe('I. Academic Reports', () => {
  describe('GET /api/v1/academic-reports/student/:studentId', () => {
    it('returns 401 without token', async () => {
      const r = await request(app).get('/api/v1/academic-reports/student/101?semester=SEMESTER_1&academicYear=2026%2F27');
      expect(r.status).toBe(401);
    });

    it('returns 403 for TEACHER role (not in TRANSCRIPT_ROLES)', async () => {
      const r = await request(app)
        .get('/api/v1/academic-reports/student/101?semester=SEMESTER_1&academicYear=2026%2F27')
        .set('Authorization', `Bearer ${tchToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 404 when report does not exist for the student', async () => {
      (prisma.studentParentLink.findMany as Mock).mockResolvedValue([]);
      (prisma.academicReport.findUnique as Mock).mockResolvedValue(null);
      const r = await request(app)
        .get('/api/v1/academic-reports/student/101?semester=SEMESTER_1&academicYear=2026%2F27')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(404);
    });

    it('returns 200 when report exists', async () => {
      (prisma.studentParentLink.findMany as Mock).mockResolvedValue([]);
      (prisma.academicReport.findUnique as Mock).mockResolvedValue({
        reportId: 1, studentId: 101,
        semester: 'SEMESTER_1', academicYear: '2026/27',
        averageMark: { toNumber: () => 75, valueOf: () => 75 },
        rank: 1, generatedDate: new Date(),
        student: { studentId: 101, firstName: 'Alice', lastName: 'A' },
      });
      const r = await request(app)
        .get('/api/v1/academic-reports/student/101?semester=SEMESTER_1&academicYear=2026%2F27')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(200);
      expect(r.body.data.averageMark).toBe(75);
    });
  });

  describe('GET /api/v1/academic-reports/me — student own reports', () => {
    it('returns 403 for DIRECTOR role', async () => {
      const r = await request(app)
        .get('/api/v1/academic-reports/me')
        .set('Authorization', `Bearer ${dirToken}`);
      expect(r.status).toBe(403);
    });

    it('returns 200 for STUDENT role', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
      const r = await request(app)
        .get('/api/v1/academic-reports/me')
        .set('Authorization', `Bearer ${stuToken}`);
      expect(r.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J. Error handling and response envelope
// ═══════════════════════════════════════════════════════════════════════════════

describe('J. Error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const r = await request(app).get('/api/v1/does-not-exist-anywhere');
    expect(r.status).toBe(404);
    expect(r.body.success).toBe(false);
    expect(r.body.errorCode).toBe('NOT_FOUND');
  });

  it('error response always has success:false, message, errorCode', async () => {
    const r = await request(app).get('/api/v1/students/1').set('Authorization', 'Bearer bad');
    expect(r.body.success).toBe(false);
    expect(typeof r.body.message).toBe('string');
    expect(typeof r.body.errorCode).toBe('string');
  });

  it('success response always has success:true, message, data', async () => {
    const r = await request(app).get('/health');
    expect(r.body.success).toBe(true);
    expect(typeof r.body.message).toBe('string');
    expect(r.body.data).toBeDefined();
  });

  it('RBAC: STUDENT cannot access grade-wide register', async () => {
    const r = await request(app)
      .get('/api/v1/academic-register/grade?grade=Grade+9&academicYear=2026%2F27&viewMode=SEMESTER_1')
      .set('Authorization', `Bearer ${stuToken}`);
    expect(r.status).toBe(403);
  });

  it('RBAC: PARENT cannot access student list', async () => {
    const r = await request(app)
      .get('/api/v1/students?page=1&limit=20')
      .set('Authorization', `Bearer ${parToken}`);
    expect(r.status).toBe(403);
  });

  it('RBAC: TEACHER cannot finalize subjects (oversight-only)', async () => {
    const r = await request(app)
      .post('/api/v1/finalization/finalize-subject')
      .set('Authorization', `Bearer ${tchToken}`)
      .send({ teacherSubjectId: 1, semester: 'SEMESTER_1', academicYear: '2026/27' });
    expect(r.status).toBe(403);
  });

  it('data isolation: notification mark-read rejects wrong owner', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue({
      notificationId: 5, recipientUserId: 999, // belongs to user 999
      title: 'T', message: 'M', sentDate: new Date(),
      status: 'UNREAD', category: 'ANNOUNCEMENT',
      relatedEntity: null, relatedEntityId: null,
      deduplicationKey: null, senderUser: null, student: null,
      senderUserId: null, studentId: null,
    });
    // dir userId=1 — notification recipientUserId=999 → should get 403
    const r = await request(app)
      .patch('/api/v1/notifications/5/read')
      .set('Authorization', `Bearer ${dirToken}`);
    expect(r.status).toBe(403);
  });
});
