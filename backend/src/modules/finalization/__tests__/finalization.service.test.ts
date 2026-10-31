/**
 * Finalization Service Tests - Phase 3.2
 * Tests: state transitions, authorization, classroom finalization prerequisites, correction.
 * DATABASE SAFETY: all Prisma calls mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { FinalizationService } from "../finalization.service";
import { ForbiddenError, BadRequestError, NotFoundError } from "../../../core/errors/app-error";

vi.mock("../../../database/prisma-client", () => ({
  prisma: {
    classroom:             { findUnique: vi.fn() },
    teacher:               { findUnique: vi.fn() },
    teacherSubject:        { findUnique: vi.fn(), findMany: vi.fn() },
    gradeSubjectConfig:    { findMany: vi.fn() },
    student:               { findMany: vi.fn() },
    subjectFinalization:   { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    classroomFinalization: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    gradeComponent:        { findMany: vi.fn() },
  },
}));
vi.mock("../../../config/env", () => ({ env:{NODE_ENV:"test"}, isProduction:false, isDevelopment:false, isTest:true }));
vi.mock("../../../core/audit/audit-recorder", () => ({ recordAudit: vi.fn() }));
vi.mock("../../notifications/notification.service", () => ({ createAutoNotification: vi.fn(), notifyStudentParents: vi.fn() }));

import { prisma } from "../../../database/prisma-client";
import { FinalizationStatus } from "@prisma/client";

const TEACHER    = { userId: 10, role: "TEACHER"       as const, username: "teacher1" };
const VICE_DIR   = { userId: 20, role: "VICE_DIRECTOR" as const, username: "vicedir1" };
const DIRECTOR   = { userId: 30, role: "DIRECTOR"      as const, username: "director1" };
const ADMIN      = { userId: 40, role: "ADMIN"          as const, username: "admin1" };
const STUDENT_U  = { userId: 99, role: "STUDENT"        as const, username: "student1" };
const PARENT_U   = { userId: 98, role: "PARENT"         as const, username: "parent1" };

const CLASSROOM = { classroomId: 1, className: "Grade 9", section:"A", academicYear:"2026/27", homeroomTeacherId: null };
const TS = { id: 1, teacherId: 5, subjectId: 1, classroomId: 1 };
const TEACHER_PROFILE = { teacherId: 5, userId: 10, firstName:"Abel", lastName:"Bekele" };

const BASE_FIN = { id: 100, teacherSubjectId: 1, semester:"SEMESTER_1" as const, academicYear:"2026/27",
  reviewedBy:null, reviewedAt:null, finalizedBy:null, finalizedAt:null,
  correctionReason:null, lastCorrectionAt:null, createdAt:new Date(), updatedAt:new Date() };

const INCLUDE_DATA = {
  ...BASE_FIN,
  teacherSubject: { ...TS, subject:{subjectId:1,subjectCode:"ENG",subjectName:"English"},
    teacher:{teacherId:5,firstName:"Abel",lastName:"Bekele"}, classroom:CLASSROOM },
  reviewedByUser:null, finalizedByUser:null,
};

function mkFin(status: FinalizationStatus) {
  return { ...INCLUDE_DATA, status };
}

describe("FinalizationService — state transitions", () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it("DRAFT → UNDER_REVIEW: teacher submits for review", async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER_PROFILE);
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
    (prisma.subjectFinalization.upsert as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    const dto = await svc.submitForReview(TEACHER, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" });
    expect(dto.status).toBe(FinalizationStatus.UNDER_REVIEW);
  });

  it("UNDER_REVIEW → APPROVED: vice director approves", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.APPROVED));
    const dto = await svc.reviewSubject(VICE_DIR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27", approved:true });
    expect(dto.status).toBe(FinalizationStatus.APPROVED);
  });

  it("UNDER_REVIEW → DRAFT: vice director rejects", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.DRAFT));
    const dto = await svc.reviewSubject(VICE_DIR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27", approved:false });
    expect(dto.status).toBe(FinalizationStatus.DRAFT);
  });

  it("APPROVED → FINALIZED: director finalizes subject", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.APPROVED));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.FINALIZED));
    const dto = await svc.finalizeSubject(DIRECTOR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" });
    expect(dto.status).toBe(FinalizationStatus.FINALIZED);
  });

  it("FINALIZED → UNDER_REVIEW via correction (privileged override)", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue({ ...mkFin(FinalizationStatus.FINALIZED), id:100 });
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    const dto = await svc.correctSubjectFinalization(DIRECTOR, 100, { correctionReason:"Score entry error" });
    expect(dto.status).toBe(FinalizationStatus.UNDER_REVIEW);
  });

  it("Cannot finalize subject that is not in APPROVED status (DRAFT → FINALIZED invalid)", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.DRAFT));
    await expect(
      svc.finalizeSubject(DIRECTOR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("Cannot finalize subject that is UNDER_REVIEW (must be APPROVED first)", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    await expect(
      svc.finalizeSubject(DIRECTOR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("Cannot review a DRAFT subject (must be UNDER_REVIEW first)", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.DRAFT));
    await expect(
      svc.reviewSubject(VICE_DIR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27", approved:true })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("Cannot review a FINALIZED subject", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.FINALIZED));
    await expect(
      svc.reviewSubject(VICE_DIR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27", approved:true })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("Cannot correct a non-FINALIZED subject", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue({ ...mkFin(FinalizationStatus.DRAFT), id:100 });
    await expect(
      svc.correctSubjectFinalization(DIRECTOR, 100, { correctionReason:"error" })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("FinalizationService — authorization", () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it("only TEACHER can submit for review", async () => {
    await expect(
      svc.submitForReview(VICE_DIR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("STUDENT cannot submit for review", async () => {
    await expect(
      svc.submitForReview(STUDENT_U, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("PARENT cannot submit for review", async () => {
    await expect(
      svc.submitForReview(PARENT_U, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("TEACHER cannot review subjects", async () => {
    await expect(
      svc.reviewSubject(TEACHER, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27", approved:true })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("TEACHER cannot finalize subjects", async () => {
    await expect(
      svc.finalizeSubject(TEACHER, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("TEACHER cannot finalize classroom", async () => {
    await expect(
      svc.finalizeClassroom(TEACHER, { classroomId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("VICE_DIRECTOR can review subjects", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.APPROVED));
    await expect(
      svc.reviewSubject(VICE_DIR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27", approved:true })
    ).resolves.toBeDefined();
  });

  it("DIRECTOR can finalize subjects", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.APPROVED));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.FINALIZED));
    await expect(
      svc.finalizeSubject(DIRECTOR, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).resolves.toBeDefined();
  });

  it("ADMIN can finalize subjects", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.APPROVED));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.FINALIZED));
    await expect(
      svc.finalizeSubject(ADMIN, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).resolves.toBeDefined();
  });

  it("teacher can only submit for their own subject (not another teacher's)", async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER_PROFILE);
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue({ ...TS, teacherId: 999 }); // different teacher
    await expect(
      svc.submitForReview(TEACHER, { teacherSubjectId:1, semester:"SEMESTER_1", academicYear:"2026/27" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("FinalizationService — classroom finalization prerequisites", () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  const INPUT = { classroomId:1, semester:"SEMESTER_1" as const, academicYear:"2026/27" };
  const CFG_SUBJECTS = [
    { subjectId:1, sortOrder:0, subject:{subjectId:1,subjectCode:"ENG",subjectName:"English"} },
    { subjectId:2, sortOrder:1, subject:{subjectId:2,subjectCode:"MATH",subjectName:"Mathematics"} },
  ];

  it("cannot finalize classroom when a required subject has no teacher assigned", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CFG_SUBJECTS);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id:10, subjectId:1, subject:{subjectName:"English"} }, // English assigned
      // Math not assigned
    ]);

    await expect(svc.finalizeClassroom(DIRECTOR, INPUT)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("cannot finalize classroom when a required subject is not yet FINALIZED", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CFG_SUBJECTS);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id:10, subjectId:1, subject:{subjectName:"English"} },
      { id:11, subjectId:2, subject:{subjectName:"Mathematics"} },
    ]);
    // English finalized, Math only APPROVED
    (prisma.subjectFinalization.findUnique as Mock)
      .mockResolvedValueOnce({ status: FinalizationStatus.FINALIZED })
      .mockResolvedValueOnce({ status: FinalizationStatus.APPROVED });

    await expect(svc.finalizeClassroom(DIRECTOR, INPUT)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("cannot finalize classroom when a required subject has no finalization record at all", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CFG_SUBJECTS);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id:10, subjectId:1, subject:{subjectName:"English"} },
      { id:11, subjectId:2, subject:{subjectName:"Mathematics"} },
    ]);
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(null); // no record
    await expect(svc.finalizeClassroom(DIRECTOR, INPUT)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("cannot finalize when no GradeSubjectConfig exists for this grade/year", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);
    await expect(svc.finalizeClassroom(DIRECTOR, INPUT)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("cannot finalize a non-existent classroom", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.finalizeClassroom(DIRECTOR, INPUT)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("succeeds when all required subjects are FINALIZED", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CFG_SUBJECTS);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id:10, subjectId:1, subject:{subjectName:"English"} },
      { id:11, subjectId:2, subject:{subjectName:"Mathematics"} },
    ]);
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue({ status: FinalizationStatus.FINALIZED });
    const clsFin = { id:200, classroomId:1, semester:"SEMESTER_1", academicYear:"2026/27",
      status:FinalizationStatus.FINALIZED, finalizedBy:30, finalizedAt:new Date(),
      correctionReason:null, lastCorrectionAt:null, createdAt:new Date(), updatedAt:new Date(),
      classroom:CLASSROOM, finalizedByUser:null };
    (prisma.classroomFinalization.upsert as Mock).mockResolvedValue(clsFin);
    (prisma.student.findMany as Mock).mockResolvedValue([]);

    const dto = await svc.finalizeClassroom(DIRECTOR, INPUT);
    expect(dto.status).toBe(FinalizationStatus.FINALIZED);
  });

  it("TEACHER cannot finalize classroom (authorization check)", async () => {
    await expect(svc.finalizeClassroom(TEACHER, INPUT)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── Regression tests — bug fixes for review/correction workflow ─────────────
// These tests pin the specific behaviours that were broken and then fixed:
//   1. Rejection now stores correctionReason so the teacher sees the reason.
//   2. Approve sets reviewedBy/reviewedAt, never sets correctionReason.
//   3. Classroom finalization rejects when any subject is APPROVED (not FINALIZED).
// ─────────────────────────────────────────────────────────────────────────────

describe("FinalizationService — regression: rejection stores correctionReason", () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it("stores correctionReason and lastCorrectionAt when rejecting WITH reviewNotes", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.DRAFT));

    await svc.reviewSubject(VICE_DIR, {
      teacherSubjectId: 1,
      semester: "SEMESTER_1",
      academicYear: "2026/27",
      approved: false,
      reviewNotes: "Quiz 1 marks appear incorrectly entered for 3 students",
    });

    const updateCall = (prisma.subjectFinalization.update as Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe(FinalizationStatus.DRAFT);
    expect(updateCall.data.correctionReason).toBe("Quiz 1 marks appear incorrectly entered for 3 students");
    expect(updateCall.data.lastCorrectionAt).toBeInstanceOf(Date);
    // reviewedBy/At must be null on rejection
    expect(updateCall.data.reviewedBy).toBeNull();
    expect(updateCall.data.reviewedAt).toBeNull();
  });

  it("does NOT store correctionReason when rejecting WITHOUT reviewNotes", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.DRAFT));

    await svc.reviewSubject(VICE_DIR, {
      teacherSubjectId: 1,
      semester: "SEMESTER_1",
      academicYear: "2026/27",
      approved: false,
      // no reviewNotes
    });

    const updateCall = (prisma.subjectFinalization.update as Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe(FinalizationStatus.DRAFT);
    expect(updateCall.data).not.toHaveProperty("correctionReason");
    expect(updateCall.data).not.toHaveProperty("lastCorrectionAt");
  });

  it("does NOT store correctionReason when approving", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.APPROVED));

    await svc.reviewSubject(VICE_DIR, {
      teacherSubjectId: 1,
      semester: "SEMESTER_1",
      academicYear: "2026/27",
      approved: true,
      reviewNotes: "Looks good", // notes provided but approval should not store as correctionReason
    });

    const updateCall = (prisma.subjectFinalization.update as Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe(FinalizationStatus.APPROVED);
    expect(updateCall.data.reviewedBy).toBe(VICE_DIR.userId);
    expect(updateCall.data.reviewedAt).toBeInstanceOf(Date);
    // correctionReason must never be set on approval
    expect(updateCall.data).not.toHaveProperty("correctionReason");
    expect(updateCall.data).not.toHaveProperty("lastCorrectionAt");
  });

  it("ADMIN can also reject with correctionReason stored", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.DRAFT));

    await svc.reviewSubject(ADMIN, {
      teacherSubjectId: 1,
      semester: "SEMESTER_1",
      academicYear: "2026/27",
      approved: false,
      reviewNotes: "Administrative correction needed",
    });

    const updateCall = (prisma.subjectFinalization.update as Mock).mock.calls[0][0];
    expect(updateCall.data.correctionReason).toBe("Administrative correction needed");
    expect(updateCall.data.lastCorrectionAt).toBeInstanceOf(Date);
  });
});

describe("FinalizationService — regression: classroom finalization requires FINALIZED (not APPROVED)", () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  const INPUT = { classroomId: 1, semester: "SEMESTER_1" as const, academicYear: "2026/27" };
  const CFG_SUBJECTS = [
    { subjectId: 1, sortOrder: 0, subject: { subjectId: 1, subjectCode: "ENG", subjectName: "English" } },
    { subjectId: 2, sortOrder: 1, subject: { subjectId: 2, subjectCode: "MATH", subjectName: "Mathematics" } },
  ];

  it("rejects classroom finalization when one subject is APPROVED but not FINALIZED", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CFG_SUBJECTS);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 10, subjectId: 1, subject: { subjectName: "English" } },
      { id: 11, subjectId: 2, subject: { subjectName: "Mathematics" } },
    ]);
    // English FINALIZED, Math only APPROVED — must block
    (prisma.subjectFinalization.findUnique as Mock)
      .mockResolvedValueOnce({ status: FinalizationStatus.FINALIZED })
      .mockResolvedValueOnce({ status: FinalizationStatus.APPROVED });

    await expect(svc.finalizeClassroom(DIRECTOR, INPUT)).rejects.toBeInstanceOf(BadRequestError);
    // classroomFinalization.upsert must never be called when validation fails
    expect((prisma.classroomFinalization.upsert as Mock)).not.toHaveBeenCalled();
  });

  it("succeeds when ALL subjects are FINALIZED (APPROVED-only is not enough)", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CFG_SUBJECTS);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 10, subjectId: 1, subject: { subjectName: "English" } },
      { id: 11, subjectId: 2, subject: { subjectName: "Mathematics" } },
    ]);
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue({ status: FinalizationStatus.FINALIZED });
    const clsFin = {
      id: 200, classroomId: 1, semester: "SEMESTER_1", academicYear: "2026/27",
      status: FinalizationStatus.FINALIZED, finalizedBy: 30, finalizedAt: new Date(),
      correctionReason: null, lastCorrectionAt: null, createdAt: new Date(), updatedAt: new Date(),
      classroom: CLASSROOM, finalizedByUser: null,
    };
    (prisma.classroomFinalization.upsert as Mock).mockResolvedValue(clsFin);
    (prisma.student.findMany as Mock).mockResolvedValue([]);

    const dto = await svc.finalizeClassroom(DIRECTOR, INPUT);
    expect(dto.status).toBe(FinalizationStatus.FINALIZED);
  });
});

describe("FinalizationService — regression: correctSubjectFinalization stores correctionReason", () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it("stores the correction reason and reopens to UNDER_REVIEW", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue({ ...mkFin(FinalizationStatus.FINALIZED), id: 100 });
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkFin(FinalizationStatus.UNDER_REVIEW));

    await svc.correctSubjectFinalization(DIRECTOR, 100, { correctionReason: "Score entry error in row 5" });

    const updateCall = (prisma.subjectFinalization.update as Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe(FinalizationStatus.UNDER_REVIEW);
    expect(updateCall.data.correctionReason).toBe("Score entry error in row 5");
    expect(updateCall.data.lastCorrectionAt).toBeInstanceOf(Date);
  });

  it("TEACHER cannot correct a finalized subject", async () => {
    await expect(
      svc.correctSubjectFinalization(TEACHER, 100, { correctionReason: "error" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cannot correct a subject that is only APPROVED (must be FINALIZED)", async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue({ ...mkFin(FinalizationStatus.APPROVED), id: 100 });
    await expect(
      svc.correctSubjectFinalization(DIRECTOR, 100, { correctionReason: "error" })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
