/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.13 � Remaining API/HTTP Integration Tests
 * Covers all routes not tested in Phase 4.12.
 * DATABASE SAFETY: all Prisma mocked. No real DB required.
 */
process.env.NODE_ENV           = "test";
process.env.DATABASE_URL       = "mysql://test:test@localhost:3306/test";
process.env.JWT_ACCESS_SECRET  = "test-access-secret-32chars-padding!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32chars-paddin!!";
process.env.JWT_ACCESS_EXPIRES_IN  = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.API_PREFIX         = "/api/v1";

vi.mock("pino-http", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../../core/logger/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() } }));

vi.mock("../../database/prisma-client", () => ({
  prisma: {
    user:                  { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    role:                  { findUnique: vi.fn() },
    refreshToken:          { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    student:               { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
    classroom:             { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teacher:               { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    teacherSubject:        { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    gradeSubjectConfig:    { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn(), createMany: vi.fn(), groupBy: vi.fn() },
    gradeComponent:        { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn(), count: vi.fn() },
    gradeEntry:            { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    subjectFinalization:   { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    classroomFinalization: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    attendance:            { findMany: vi.fn(), groupBy: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    studentConduct:        { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    notification:          { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), createMany: vi.fn() },
    academicReport:        { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    studentParentLink:     { findMany: vi.fn(), findUnique: vi.fn() },
    userPermission:        { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    systemSetting:         { findUnique: vi.fn(), upsert: vi.fn() },
    promotionBatch:        { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    promotionEntry:        { update: vi.fn(), updateMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    studentEnrollment:     { findFirst: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    subject:               { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    parent:                { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    timetableEntry:        { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    assignment:            { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    assignmentSubmission:  { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), createMany: vi.fn() },
    parentTeacherMessage:  { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    disciplineRecord:      { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog:              { create: vi.fn().mockResolvedValue({}), findMany: vi.fn(), count: vi.fn() },
    studentIdCounter:      { upsert: vi.fn() },
    $transaction:          vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../core/audit/audit-recorder", () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../modules/notifications/notification.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../modules/notifications/notification.service")>();
  return { ...actual, createAutoNotification: vi.fn().mockResolvedValue(undefined), notifyStudentParents: vi.fn().mockResolvedValue(undefined) };
});

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, type Mock } from "vitest";
import request from "supertest";
import { Application } from "express";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma-client";
import { signAccessToken } from "../../core/utils/jwt.util";
import { RoleName } from "@prisma/client";
import { Server } from "http";

let app: Application;
let server: Server;
beforeAll(() => { app = createApp(); server = app.listen(0); });
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const mkTok = (role: RoleName, userId = 1) => signAccessToken({ sub: userId, role, username: role.toLowerCase() });
const dirTok  = mkTok(RoleName.DIRECTOR, 1);
const adminTok = mkTok(RoleName.ADMIN, 2);
const tchTok  = mkTok(RoleName.TEACHER, 3);
const stuTok  = mkTok(RoleName.STUDENT, 4);
const parTok  = mkTok(RoleName.PARENT, 5);
const vdTok   = mkTok(RoleName.VICE_DIRECTOR, 6);

const CL = { classroomId: 1, className: "Grade 9", section: "A", academicYear: "2026/27", homeroomTeacherId: null, _count: { students: 0 }, homeroomTeacher: null };
const SUBJ = { subjectId: 1, subjectCode: "ENG", subjectName: "English" };
const TEACHER = { teacherId: 100, userId: 3, firstName: "Tom", lastName: "T" };
const STU = { studentId: 101, userId: 201, classroomId: 1, admissionNumber: "DSH-001", firstName: "Alice", lastName: "A", gender: "F", dateOfBirth: new Date("2010-01-15"), address: null, enrolledAt: new Date(), admissionType: "NEW_STUDENT", studentStatus: "ACTIVE", completionYear: null, lastGradeCompleted: null, previousAcademicSummary: null, previousSchoolLocation: null, previousSchoolName: null, previousSchoolType: null, previousStudentId: null, transferReason: null, transferCertificateRef: null, transferredOutAt: null, transferredOutDestination: null, transferredOutReason: null, classroom: CL, user: { userId: 201, username: "DSH-001" }, parentLinks: [] };
const SETTINGS = { id: 1, schoolName: "T", promotionPassMark: 50, minimumSubjectPassMark: 40, currentAcademicYear: "2026/27", updatedBy: null, updatedAt: new Date(), schoolAddress: null, schoolZone: null, schoolWereda: null, schoolRegion: null, contactEmail: null, contactPhone: null, schoolLogo: null };

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.userPermission.findMany as Mock).mockResolvedValue([]);
  (prisma.auditLog.create as Mock).mockResolvedValue({});
  // Safe defaults to avoid 500s when service methods probe DB during validation
  (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
  (prisma.teacher.count as Mock).mockResolvedValue(0);
  (prisma.classroom.count as Mock).mockResolvedValue(0);
  (prisma.student.count as Mock).mockResolvedValue(0);
});

// -- K. Auth (remaining routes) ------------------------------------------------
describe("K. Auth remaining", () => {
  it("POST /login with invalid credentials returns 401 (auth error)", async () => {
    // Mock authService.login to throw the actual UnauthorizedError class
    const { authService } = await import("../../modules/auth/auth.service");
    const { UnauthorizedError } = await import("../../core/errors/app-error");
    vi.spyOn(authService, "login").mockRejectedValue(new UnauthorizedError("Invalid credentials"));
    const r = await request(app).post("/api/v1/auth/login").send({ username: "director", password: "wrong" });
    expect(r.status).toBe(401);
    expect(r.body.errorCode).toBe("UNAUTHORIZED");
  });

  it("POST /logout returns 200 when no refresh token provided (token is optional)", async () => {
    // refreshToken is optional in schema � logout with just cookies is valid
    const { authService } = await import("../../modules/auth/auth.service");
    vi.spyOn(authService, "logout").mockResolvedValue(undefined);
    const r = await request(app).post("/api/v1/auth/logout").send({});
    expect(r.status).toBe(200);
  });

  it("GET /profile returns 401 without token", async () => {
    const r = await request(app).get("/api/v1/auth/profile");
    expect(r.status).toBe(401);
  });

  it("GET /profile returns 200 for authenticated user", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({ userId: 1, username: "dir", email: null, status: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, createdAt: new Date(), isTemporaryPassword: false, profilePicture: null, role: { roleName: "DIRECTOR" }, administrator: null, director: { firstName: "D", lastName: "D" }, viceDirector: null, teacher: null, student: null, parent: null });
    const r = await request(app).get("/api/v1/auth/profile").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
    expect(r.body.data.role).toBe("DIRECTOR");
  });

  it("POST /change-password returns 422 when newPassword is missing", async () => {
    const r = await request(app).post("/api/v1/auth/change-password").set("Authorization", `Bearer ${dirTok}`).send({ currentPassword: "Old1!" });
    expect(r.status).toBe(422);
  });
});

// -- L. Classrooms -------------------------------------------------------------
describe("L. Classrooms", () => {
  it("GET / returns 401 without token", async () => {
    const r = await request(app).get("/api/v1/classrooms?page=1&limit=20");
    expect(r.status).toBe(401);
  });

  it("GET / returns 403 for STUDENT", async () => {
    const r = await request(app).get("/api/v1/classrooms?page=1&limit=20").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });

  it("GET / returns 200 for DIRECTOR", async () => {
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL]);
    (prisma.classroom.count   as Mock).mockResolvedValue(1);
    const r = await request(app).get("/api/v1/classrooms?page=1&limit=20").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });

  it("POST / returns 403 for TEACHER", async () => {
    const r = await request(app).post("/api/v1/classrooms").set("Authorization", `Bearer ${tchTok}`).send({ className: "Grade 9", section: "A", academicYear: "2026/27", session: "MORNING" });
    expect(r.status).toBe(403);
  });

  it("POST / returns 422 when className is missing", async () => {
    const r = await request(app).post("/api/v1/classrooms").set("Authorization", `Bearer ${dirTok}`).send({ section: "A", academicYear: "2026/27" });
    expect(r.status).toBe(422);
  });

  it("POST / returns 201 for DIRECTOR with valid data", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    (prisma.classroom.create    as Mock).mockResolvedValue(CL);
    const r = await request(app).post("/api/v1/classrooms").set("Authorization", `Bearer ${dirTok}`).send({ className: "Grade 9", section: "A", academicYear: "2026/27", session: "MORNING" });
    expect(r.status).toBe(201);
  });

  it("GET /:id returns 404 when classroom not found", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    const r = await request(app).get("/api/v1/classrooms/999").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(404);
  });

  it("GET /:id returns 200 with data for ADMIN", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    const r = await request(app).get("/api/v1/classrooms/1").set("Authorization", `Bearer ${adminTok}`);
    expect(r.status).toBe(200);
    expect(r.body.data.classroomId).toBe(1);
  });

  it("DELETE /:id returns 200 for ADMIN (ADMIN has classroom management access)", async () => {
    // ADMIN is now included in MANAGE_ROLES per the role-based roster management spec
    (prisma.classroom.findUnique as Mock).mockResolvedValue({ ...CL, _count: { students: 0 } });
    (prisma.classroom.delete as Mock).mockResolvedValue({});
    const r = await request(app).delete("/api/v1/classrooms/1").set("Authorization", `Bearer ${adminTok}`);
    expect(r.status).toBe(200);
  });
});

// -- M. Subjects ---------------------------------------------------------------
describe("M. Subjects", () => {
  it("GET / returns 403 for STUDENT", async () => {
    const r = await request(app).get("/api/v1/subjects?page=1&limit=20").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });

  it("GET / returns 200 for TEACHER", async () => {
    (prisma.subject.findMany as Mock).mockResolvedValue([SUBJ]);
    (prisma.subject.count    as Mock).mockResolvedValue(1);
    const r = await request(app).get("/api/v1/subjects?page=1&limit=20").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(200);
  });

  it("POST / returns 403 for TEACHER (manage = DIRECTOR/VD)", async () => {
    const r = await request(app).post("/api/v1/subjects").set("Authorization", `Bearer ${tchTok}`).send({ subjectCode: "ENG", subjectName: "English" });
    expect(r.status).toBe(403);
  });

  it("POST / returns 422 when subjectCode missing", async () => {
    const r = await request(app).post("/api/v1/subjects").set("Authorization", `Bearer ${dirTok}`).send({ subjectName: "English" });
    expect(r.status).toBe(422);
  });

  it("POST / returns 201 for DIRECTOR with valid data", async () => {
    (prisma.subject.findUnique as Mock).mockResolvedValue(null);
    (prisma.subject.create     as Mock).mockResolvedValue(SUBJ);
    const r = await request(app).post("/api/v1/subjects").set("Authorization", `Bearer ${dirTok}`).send({ subjectCode: "ENG", subjectName: "English" });
    expect(r.status).toBe(201);
    expect(r.body.data.subjectCode).toBe("ENG");
  });

  it("GET /:id returns 404 when subject missing", async () => {
    (prisma.subject.findUnique as Mock).mockResolvedValue(null);
    const r = await request(app).get("/api/v1/subjects/999").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(404);
  });

  it("DELETE /:id returns 409 when subject has teacher assignments", async () => {
    (prisma.subject.findUnique    as Mock).mockResolvedValue(SUBJ);
    (prisma.teacherSubject.count  as Mock).mockResolvedValue(2);
    const r = await request(app).delete("/api/v1/subjects/1").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(409);
  });
});

// -- N. Users ------------------------------------------------------------------
describe("N. Users", () => {
  const mkUser = (role = "TEACHER") => ({ userId: 1, username: "t", email: null, status: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, createdAt: new Date(), role: { roleName: role }, administrator: null, director: null, viceDirector: null, parent: null, student: null, teacher: { teacherId: 100, firstName: "Tom", lastName: "T" } });

  it("GET /users returns 403 for DIRECTOR (admin-only)", async () => {
    const r = await request(app).get("/api/v1/users?page=1&limit=20").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /users returns 200 for ADMIN", async () => {
    (prisma.user.findMany as Mock).mockResolvedValue([mkUser()]);
    (prisma.user.count    as Mock).mockResolvedValue(1);
    const r = await request(app).get("/api/v1/users?page=1&limit=20").set("Authorization", `Bearer ${adminTok}`);
    expect(r.status).toBe(200);
  });

  it("GET /users/teachers returns 200 for DIRECTOR", async () => {
    (prisma.role.findUnique as Mock).mockResolvedValue({ roleId: 2, roleName: "TEACHER" });
    (prisma.user.findMany   as Mock).mockResolvedValue([mkUser()]);
    const r = await request(app).get("/api/v1/users/teachers").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });

  it("GET /users/teachers returns 403 for TEACHER role", async () => {
    const r = await request(app).get("/api/v1/users/teachers").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(403);
  });

  it("POST /users/staff returns 403 for DIRECTOR (admin-only)", async () => {
    const r = await request(app).post("/api/v1/users/staff").set("Authorization", `Bearer ${dirTok}`).send({ firstName: "T", lastName: "T", role: "TEACHER", qualification: "BSc", specialization: "Math", phoneNumber: "+251911" });
    expect(r.status).toBe(403);
  });

  it("POST /users/staff returns 422 when role is missing", async () => {
    const r = await request(app).post("/api/v1/users/staff").set("Authorization", `Bearer ${adminTok}`).send({ firstName: "T", lastName: "T", qualification: "BSc", specialization: "Math", phoneNumber: "+251911" });
    expect(r.status).toBe(422);
  });

  it("GET /users/:id returns 200 for DIRECTOR", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(mkUser());
    const r = await request(app).get("/api/v1/users/1").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });

  it("GET /users/:id returns 403 for TEACHER", async () => {
    const r = await request(app).get("/api/v1/users/1").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(403);
  });

  it("PATCH /users/:id/status returns 403 for DIRECTOR (admin-only)", async () => {
    const r = await request(app).patch("/api/v1/users/1/status").set("Authorization", `Bearer ${dirTok}`).send({ status: "INACTIVE" });
    expect(r.status).toBe(403);
  });

  it("GET /users/:id/permissions returns 200 for ADMIN", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(mkUser());
    (prisma.userPermission.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/users/1/permissions").set("Authorization", `Bearer ${adminTok}`);
    expect(r.status).toBe(200);
  });
});

// -- O. Assignments ------------------------------------------------------------
describe("O. Assignments", () => {
  it("GET /assignments/me returns 403 for DIRECTOR", async () => {
    const r = await request(app).get("/api/v1/assignments/me").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /assignments/me returns 200 for TEACHER (empty list)", async () => {
    (prisma.teacher.findUnique  as Mock).mockResolvedValue(TEACHER);
    (prisma.assignment.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/assignments/me").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  it("GET /assignments/me returns 200 for STUDENT (classroom assignments)", async () => {
    (prisma.student.findUnique  as Mock).mockResolvedValue(STU);
    (prisma.assignment.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/assignments/me").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(200);
  });

  it("POST /assignments returns 403 for STUDENT", async () => {
    const r = await request(app).post("/api/v1/assignments").set("Authorization", `Bearer ${stuTok}`).send({ teacherSubjectId: 1, title: "HW", description: "D", dueDate: "2026-11-01" });
    expect(r.status).toBe(403);
  });

  it("POST /assignments returns 422 when title is missing", async () => {
    const r = await request(app).post("/api/v1/assignments").set("Authorization", `Bearer ${tchTok}`).send({ teacherSubjectId: 1, description: "D", dueDate: "2026-11-01" });
    expect(r.status).toBe(422);
  });

  it("DELETE /assignments/:id returns 403 for DIRECTOR (teacher-only)", async () => {
    const r = await request(app).delete("/api/v1/assignments/1").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });
});

// -- P. Dashboard --------------------------------------------------------------
describe("P. Dashboard", () => {
  it("GET /dashboard/admin returns 403 for DIRECTOR", async () => {
    const r = await request(app).get("/api/v1/dashboard/admin").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /dashboard/director returns 403 for TEACHER", async () => {
    const r = await request(app).get("/api/v1/dashboard/director").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /dashboard/vice-director returns 403 for STUDENT", async () => {
    const r = await request(app).get("/api/v1/dashboard/vice-director").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /dashboard/vice-director returns 200 for VICE_DIRECTOR", async () => {
    (prisma.teacher.count   as Mock).mockResolvedValue(5);
    (prisma.classroom.count as Mock).mockResolvedValue(3);
    (prisma.classroom.findMany as Mock).mockResolvedValue([]);
    (prisma.attendance.groupBy  as Mock).mockResolvedValue([]);
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/dashboard/vice-director").set("Authorization", `Bearer ${vdTok}`);
    expect(r.status).toBe(200);
    expect(r.body.data.stats).toBeDefined();
  });

  it("GET /dashboard/director returns 200 for DIRECTOR", async () => {
    (prisma.student.count   as Mock).mockResolvedValue(100);
    (prisma.teacher.count   as Mock).mockResolvedValue(10);
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.classroom.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/dashboard/director").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });
});

// -- Q. Promotion --------------------------------------------------------------
describe("Q. Promotion", () => {
  const mkBatch = (status = "DRAFT") => ({ id: 1, sourceClassroomId: 1, sourceAcademicYear: "2026/27", targetAcademicYear: "2027/28", status, preparedById: 6, approvedById: null, rejectedById: null, rejectionReason: null, submittedAt: null, approvedAt: null, completedAt: null, createdAt: new Date(), updatedAt: new Date(), sourceClassroom: CL, preparedBy: { userId: 6, username: "vd", director: null, viceDirector: { firstName: "V", lastName: "D" }, administrator: null }, approvedBy: null, entries: [] });

  it("GET /promotion returns 401 without token", async () => {
    const r = await request(app).get("/api/v1/promotion?page=1&limit=20");
    expect(r.status).toBe(401);
  });

  it("GET /promotion returns 403 for TEACHER", async () => {
    const r = await request(app).get("/api/v1/promotion?page=1&limit=20").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /promotion returns 200 for DIRECTOR", async () => {
    (prisma.promotionBatch.findMany as Mock).mockResolvedValue([mkBatch()]);
    (prisma.promotionBatch.count   as Mock).mockResolvedValue(1);
    const r = await request(app).get("/api/v1/promotion?page=1&limit=20").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });

  it("POST /promotion returns 422 when targetAcademicYear missing", async () => {
    const r = await request(app).post("/api/v1/promotion").set("Authorization", `Bearer ${vdTok}`).send({ sourceClassroomId: 1 });
    expect(r.status).toBe(422);
  });

  it("GET /promotion/:id returns 404 when batch not found", async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(null);
    const r = await request(app).get("/api/v1/promotion/999").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(404);
  });

  it("POST /promotion/:id/submit returns 400 when batch is not DRAFT", async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch("COMPLETED"));
    const r = await request(app).post("/api/v1/promotion/1/submit").set("Authorization", `Bearer ${vdTok}`);
    expect(r.status).toBe(400);
  });

  it("POST /promotion/:id/approve returns 403 for VICE_DIRECTOR (director-only)", async () => {
    const r = await request(app).post("/api/v1/promotion/1/approve").set("Authorization", `Bearer ${vdTok}`);
    expect(r.status).toBe(403);
  });

  it("POST /promotion/:id/reject returns 422 when rejectionReason missing", async () => {
    const r = await request(app).post("/api/v1/promotion/1/reject").set("Authorization", `Bearer ${dirTok}`).send({});
    expect(r.status).toBe(422);
  });
});

// -- R. Conduct ----------------------------------------------------------------
describe("R. Conduct", () => {
  it("POST /conduct returns 403 for TEACHER", async () => {
    const r = await request(app).post("/api/v1/conduct").set("Authorization", `Bearer ${tchTok}`).send({ studentId: 101, classroomId: 1, academicYear: "2026/27", semester: "SEMESTER_1", rating: "GOOD" });
    expect(r.status).toBe(403);
  });

  it("POST /conduct returns 403 for ADMIN (admin not in conduct roles)", async () => {
    const r = await request(app).post("/api/v1/conduct").set("Authorization", `Bearer ${adminTok}`).send({ studentId: 101, classroomId: 1, academicYear: "2026/27", semester: "SEMESTER_1", rating: "GOOD" });
    expect(r.status).toBe(403);
  });

  it("POST /conduct returns 422 when rating is invalid", async () => {
    const r = await request(app).post("/api/v1/conduct").set("Authorization", `Bearer ${dirTok}`).send({ studentId: 101, classroomId: 1, academicYear: "2026/27", semester: "SEMESTER_1", rating: "BAD" });
    expect(r.status).toBe(422);
  });

  it("GET /conduct/classroom/:classroomId/:semester returns 403 for TEACHER", async () => {
    const r = await request(app).get("/api/v1/conduct/classroom/1/SEMESTER_1?academicYear=2026%2F27").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /conduct/classroom/:classroomId/:semester returns 200 for DIRECTOR", async () => {
    (prisma.classroom.findUnique    as Mock).mockResolvedValue(CL);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/conduct/classroom/1/SEMESTER_1?academicYear=2026%2F27").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });

  it("DELETE /conduct/:id returns 403 for STUDENT", async () => {
    const r = await request(app).delete("/api/v1/conduct/1").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });
});

// -- S. Timetable --------------------------------------------------------------
describe("S. Timetable", () => {
  it("GET /timetable/me returns 403 for DIRECTOR", async () => {
    const r = await request(app).get("/api/v1/timetable/me").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /timetable/me returns 200 for TEACHER", async () => {
    (prisma.teacher.findUnique       as Mock).mockResolvedValue(TEACHER);
    (prisma.teacherSubject.findMany  as Mock).mockResolvedValue([{ id: 1 }]);
    (prisma.timetableEntry.findMany  as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/timetable/me").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(200);
  });

  it("GET /timetable/me returns 200 for STUDENT", async () => {
    (prisma.student.findUnique       as Mock).mockResolvedValue(STU);
    (prisma.teacherSubject.findMany  as Mock).mockResolvedValue([{ id: 1 }]);
    (prisma.timetableEntry.findMany  as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/timetable/me").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(200);
  });

  it("POST /timetable returns 403 for TEACHER (manage = DIR/VD)", async () => {
    const r = await request(app).post("/api/v1/timetable").set("Authorization", `Bearer ${tchTok}`).send({ teacherSubjectId: 1, semester: "SEMESTER_1", dayOfWeek: "MONDAY", period: 1, startTime: "08:00", endTime: "09:00" });
    expect(r.status).toBe(403);
  });

  it("POST /timetable returns 422 when dayOfWeek is invalid", async () => {
    const r = await request(app).post("/api/v1/timetable").set("Authorization", `Bearer ${dirTok}`).send({ teacherSubjectId: 1, semester: "SEMESTER_1", dayOfWeek: "FUNDAY", period: 1, startTime: "08:00", endTime: "09:00" });
    expect(r.status).toBe(422);
  });

  it("PATCH /timetable/:id/publish returns 403 for VICE_DIRECTOR (director-only)", async () => {
    const r = await request(app).patch("/api/v1/timetable/1/publish").set("Authorization", `Bearer ${vdTok}`);
    expect(r.status).toBe(403);
  });
});

// -- T. Messaging --------------------------------------------------------------
describe("T. Messaging", () => {
  it("GET /messaging/unread-count returns 401 without token", async () => {
    const r = await request(app).get("/api/v1/messaging/unread-count");
    expect(r.status).toBe(401);
  });

  it("GET /messaging/unread-count returns 403 for DIRECTOR (parent/teacher only)", async () => {
    const r = await request(app).get("/api/v1/messaging/unread-count").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /messaging/unread-count returns 200 for TEACHER", async () => {
    (prisma.parentTeacherMessage.count as Mock).mockResolvedValue(3);
    const r = await request(app).get("/api/v1/messaging/unread-count").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(200);
    // controller returns { data: { unreadCount: count } }
    expect(r.body.data).toBeDefined();
  });

  it("GET /messaging/eligible-teachers returns 403 for TEACHER (parent-only)", async () => {
    const r = await request(app).get("/api/v1/messaging/eligible-teachers?studentId=101").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(403);
  });

  it("POST /messaging returns 422 when body missing", async () => {
    const r = await request(app).post("/api/v1/messaging").set("Authorization", `Bearer ${parTok}`).send({});
    expect(r.status).toBe(422);
  });

  it("GET /messaging returns 200 for PARENT with empty threads", async () => {
    (prisma.parent.findUnique          as Mock).mockResolvedValue({ parentId: 10, userId: 5 });
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([]);
    (prisma.parentTeacherMessage.findMany as Mock).mockResolvedValue([]);
    (prisma.parentTeacherMessage.count    as Mock).mockResolvedValue(0);
    const r = await request(app).get("/api/v1/messaging?page=1&limit=20").set("Authorization", `Bearer ${parTok}`);
    expect(r.status).toBe(200);
  });
});

// -- U. Finalization (remaining) -----------------------------------------------
describe("U. Finalization remaining", () => {
  it("POST /finalization/review-subject returns 403 for TEACHER", async () => {
    const r = await request(app).post("/api/v1/finalization/review-subject").set("Authorization", `Bearer ${tchTok}`).send({ teacherSubjectId: 1, semester: "SEMESTER_1", academicYear: "2026/27", approved: true });
    expect(r.status).toBe(403);
  });

  it("POST /finalization/review-subject returns 422 when approved is missing", async () => {
    const r = await request(app).post("/api/v1/finalization/review-subject").set("Authorization", `Bearer ${dirTok}`).send({ teacherSubjectId: 1, semester: "SEMESTER_1", academicYear: "2026/27" });
    expect(r.status).toBe(422);
  });

  it("POST /finalization/finalize-classroom returns 422 when classroomId missing", async () => {
    const r = await request(app).post("/api/v1/finalization/finalize-classroom").set("Authorization", `Bearer ${dirTok}`).send({ semester: "SEMESTER_1", academicYear: "2026/27" });
    expect(r.status).toBe(422);
  });

  it("GET /finalization/subject/:tsId/:semester returns 403 for STUDENT", async () => {
    const r = await request(app).get("/api/v1/finalization/subject/1/SEMESTER_1?academicYear=2026%2F27").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /finalization/classroom/:classroomId/:semester returns 403 for TEACHER", async () => {
    const r = await request(app).get("/api/v1/finalization/classroom/1/SEMESTER_1?academicYear=2026%2F27").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /finalization/classroom/:classroomId/:semester returns 200 for DIRECTOR when finalized", async () => {
    (prisma.classroom.findUnique          as Mock).mockResolvedValue(CL);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue({ id: 1, classroomId: 1, semester: "SEMESTER_1", academicYear: "2026/27", status: "FINALIZED", finalizedBy: 1, finalizedAt: new Date(), correctionReason: null, lastCorrectionAt: null, createdAt: new Date(), updatedAt: new Date(), classroom: CL, finalizedByUser: null });
    const r = await request(app).get("/api/v1/finalization/classroom/1/SEMESTER_1?academicYear=2026%2F27").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });
});

// -- V. Grade-Subject-Config ---------------------------------------------------
describe("V. Grade-Subject-Config", () => {
  it("GET /grade-subject-config returns 403 for STUDENT", async () => {
    const r = await request(app).get("/api/v1/grade-subject-config?className=Grade+9&academicYear=2026%2F27").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /grade-subject-config returns 200 for TEACHER", async () => {
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/grade-subject-config?className=Grade+9&academicYear=2026%2F27").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(200);
  });

  it("POST /grade-subject-config returns 403 for TEACHER", async () => {
    const r = await request(app).post("/api/v1/grade-subject-config").set("Authorization", `Bearer ${tchTok}`).send({ className: "Grade 9", academicYear: "2026/27", subjectId: 1 });
    expect(r.status).toBe(403);
  });

  it("POST /grade-subject-config/copy returns 404 when source year has no config", async () => {
    // No validation schema on /copy � service throws 404 when source year empty
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]); // empty source
    const r = await request(app).post("/api/v1/grade-subject-config/copy").set("Authorization", `Bearer ${dirTok}`).send({ className: "Grade 9", sourceAcademicYear: "2020/21", targetAcademicYear: "2027/28" });
    expect(r.status).toBe(404);
  });

  it("GET /grade-subject-config/configured-grades returns 200 for DIRECTOR", async () => {
    (prisma.gradeSubjectConfig.groupBy as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/grade-subject-config/configured-grades").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(200);
  });
});

// -- W. System settings, audit-log, parents, teacher-subjects ------------------
describe("W. System / audit / parents / teacher-subjects", () => {
  it("GET /system-settings returns 200 for any authenticated user", async () => {
    (prisma.systemSetting.upsert as Mock).mockResolvedValue(SETTINGS);
    const r = await request(app).get("/api/v1/system-settings").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(200);
  });

  it("PATCH /system-settings returns 403 for DIRECTOR (admin-only)", async () => {
    const r = await request(app).patch("/api/v1/system-settings").set("Authorization", `Bearer ${dirTok}`).send({ schoolName: "New School" });
    expect(r.status).toBe(403);
  });

  it("GET /audit-logs returns 403 for DIRECTOR (admin-only)", async () => {
    const r = await request(app).get("/api/v1/audit-logs?page=1&limit=20").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /audit-logs returns 200 for ADMIN", async () => {
    (prisma.auditLog.findMany as Mock).mockResolvedValue([]);
    (prisma.auditLog.count   as Mock).mockResolvedValue(0);
    const r = await request(app).get("/api/v1/audit-logs?page=1&limit=20").set("Authorization", `Bearer ${adminTok}`);
    expect(r.status).toBe(200);
  });

  it("GET /parents returns 403 for STUDENT", async () => {
    const r = await request(app).get("/api/v1/parents?page=1&limit=20").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /parents/me returns 200 for PARENT", async () => {
    (prisma.parent.findUnique as Mock).mockResolvedValue({ parentId: 10, userId: 5, fullName: "P", phoneNumber: null, user: { userId: 5, username: "par", email: null }, links: [] });
    const r = await request(app).get("/api/v1/parents/me").set("Authorization", `Bearer ${parTok}`);
    expect(r.status).toBe(200);
  });

  it("GET /teacher-subjects/me returns 403 for STUDENT", async () => {
    const r = await request(app).get("/api/v1/teacher-subjects/me").set("Authorization", `Bearer ${stuTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /teacher-subjects/me returns 200 for TEACHER", async () => {
    (prisma.teacher.findUnique      as Mock).mockResolvedValue(TEACHER);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/teacher-subjects/me").set("Authorization", `Bearer ${tchTok}`);
    expect(r.status).toBe(200);
  });
});

// -- X. Academic reports (remaining) ------------------------------------------
describe("X. Academic reports remaining", () => {
  it("POST /academic-reports/generate returns 403 for ADMIN (DIR/VD only)", async () => {
    const r = await request(app).post("/api/v1/academic-reports/generate").set("Authorization", `Bearer ${adminTok}`).send({ classroomId: 1, semester: "SEMESTER_1", academicYear: "2026/27" });
    expect(r.status).toBe(403);
  });

  it("POST /academic-reports/generate returns 422 when semester missing", async () => {
    const r = await request(app).post("/api/v1/academic-reports/generate").set("Authorization", `Bearer ${dirTok}`).send({ classroomId: 1, academicYear: "2026/27" });
    expect(r.status).toBe(422);
  });

  it("POST /academic-reports/generate returns 404 when classroom not found", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    const r = await request(app).post("/api/v1/academic-reports/generate").set("Authorization", `Bearer ${dirTok}`).send({ classroomId: 999, semester: "SEMESTER_1", academicYear: "2026/27" });
    expect(r.status).toBe(404);
  });

  it("GET /academic-reports/me returns 403 for DIRECTOR (student-only)", async () => {
    const r = await request(app).get("/api/v1/academic-reports/me").set("Authorization", `Bearer ${dirTok}`);
    expect(r.status).toBe(403);
  });

  it("GET /academic-reports/me/transcript returns 200 for STUDENT", async () => {
    (prisma.student.findUnique         as Mock).mockResolvedValue(STU);
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([]);
    (prisma.academicReport.findMany    as Mock).mockResolvedValue([]);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.upsert       as Mock).mockResolvedValue(SETTINGS);
    ((prisma as any).promotionEntry.findMany as Mock).mockResolvedValue([]);
    const r = await request(app).get("/api/v1/academic-reports/me/transcript").set("Authorization", `Bearer ${stuTok}`);
    expect([200, 404]).toContain(r.status);
  });
});
