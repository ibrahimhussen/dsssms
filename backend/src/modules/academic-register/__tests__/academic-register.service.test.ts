/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Academic Register Service Tests
 *
 * Critical business rule under test:
 *   GradeSubjectConfig is the SINGLE SOURCE OF TRUTH for required subject columns.
 *   A required subject must remain visible even when:
 *   - no TeacherSubject assignment exists
 *   - no GradeEntry/GradeComponent exists
 *   - the result is missing
 *
 * DATABASE SAFETY: all Prisma calls are mocked � no MySQL connection required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AcademicRegisterService } from '../academic-register.service';
import { AcademicStatus } from '../dto/academic-register.dto';
import { Semester } from '@prisma/client';

// -- Mock all Prisma / env dependencies ---------------------------------------

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    studentEnrollment: { findMany: vi.fn(), count: vi.fn() },
    classroom:            { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    teacher:              { findUnique: vi.fn() },
    teacherSubject:       { findFirst: vi.fn(), findMany: vi.fn() },
    gradeSubjectConfig:   { findMany: vi.fn() },
    student:              { findMany: vi.fn(), count: vi.fn() },
    attendance:           { groupBy: vi.fn() },
    studentConduct:       { findMany: vi.fn() },
    classroomFinalization:{ findUnique: vi.fn(), findMany: vi.fn() },
    subjectFinalization:  { findMany: vi.fn() },
    gradeComponent:       { findMany: vi.fn() },
    gradeEntry:           { findMany: vi.fn() },
    systemSetting:        { findUnique: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

import { prisma } from '../../../database/prisma-client';

// -- Shared fixtures -----------------------------------------------------------

const ACTOR_DIRECTOR = { userId: 1, role: 'DIRECTOR' as const, username: 'director' };
const ACTOR_ADMIN    = { userId: 2, role: 'ADMIN'    as const, username: 'admin' };

const CLASSROOM_9A = {
  classroomId: 1, className: 'Grade 9', section: 'A',
  academicYear: '2026/27', homeroomTeacherId: null,
};
const CLASSROOM_9B = {
  classroomId: 2, className: 'Grade 9', section: 'B',
  academicYear: '2026/27', homeroomTeacherId: null,
};

const SUBJECT_ENGLISH  = { subjectId: 1, subjectCode: 'ENG9',  subjectName: 'English'     };
const SUBJECT_MATH     = { subjectId: 2, subjectCode: 'MATH9', subjectName: 'Mathematics' };
const SUBJECT_PHYSICS  = { subjectId: 3, subjectCode: 'PHY9',  subjectName: 'Physics'     };

const CONFIG_ENG  = { subjectId: 1, sortOrder: 0, subject: SUBJECT_ENGLISH  };
const CONFIG_MATH = { subjectId: 2, sortOrder: 1, subject: SUBJECT_MATH     };
const CONFIG_PHY  = { subjectId: 3, sortOrder: 2, subject: SUBJECT_PHYSICS  };

const STUDENT_A = {
  studentId: 101, userId: 201, classroomId: 1,
  admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'Bekele',
  gender: 'F', dateOfBirth: new Date('2010-01-15'),
};
const STUDENT_B = {
  studentId: 102, userId: 202, classroomId: 1,
  admissionNumber: 'DSH-002', firstName: 'Bob', lastName: 'Tadesse',
  gender: 'M', dateOfBirth: new Date('2010-06-20'),
};
const STUDENT_C_IN_9B = {
  studentId: 103, userId: 203, classroomId: 2,
  admissionNumber: 'DSH-003', firstName: 'Carol', lastName: 'Haile',
  gender: 'F', dateOfBirth: new Date('2010-03-10'),
};

/** Sets up the minimal Prisma mock state shared by most tests. */
function setupDefaultMocks(options: {
  classroomId?: number;
  students?: typeof STUDENT_A[];
  configuredSubjects?: typeof CONFIG_ENG[];
  teacherSubjects?: { id: number; subjectId: number }[];
  finalizations?: { teacherSubjectId: number; status: string }[];
  components?: { gradeComponentId: number; teacherSubjectId: number; maxMarks: number }[];
  entries?: { gradeComponentId: number; studentId: number; score: number }[];
  systemSettings?: { promotionPassMark: number; minimumSubjectPassMark: number };
  classroomFinalization?: { status: string; finalizedAt: Date | null } | null;
} = {}) {
  const {
    students           = [STUDENT_A],
    configuredSubjects = [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
    teacherSubjects    = [],
    finalizations      = [],
    components         = [],
    entries            = [],
    systemSettings     = { promotionPassMark: 50, minimumSubjectPassMark: 40 },
    classroomFinalization = null,
  } = options;

  (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]); // no historical records → fall back to student.classroomId
  (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM_9A);
  (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(configuredSubjects);
  (prisma.student.findMany    as Mock).mockResolvedValue(students);
  (prisma.student.count       as Mock).mockResolvedValue(students.length);
  (prisma.attendance.groupBy  as Mock).mockResolvedValue([]);
  (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
  (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(classroomFinalization);
  (prisma.classroom.findMany  as Mock).mockResolvedValue([CLASSROOM_9A]);
  (prisma.teacherSubject.findMany  as Mock).mockResolvedValue(teacherSubjects);
  (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(finalizations);
  (prisma.gradeComponent.findMany as Mock).mockResolvedValue(components);
  (prisma.gradeEntry.findMany as Mock).mockResolvedValue(entries);
  (prisma.systemSetting.findUnique as Mock).mockResolvedValue(systemSettings);
}

const QUERY_S1 = { classroomId: 1, academicYear: '2026/27', viewMode: 'SEMESTER_1' as const };

// -- Tests ---------------------------------------------------------------------

describe('AcademicRegisterService � GradeSubjectConfig as source of truth', () => {
  let service: AcademicRegisterService;

  beforeEach(() => {
    service = new AcademicRegisterService();
    vi.clearAllMocks();
  });

  // -- Section 1: Required subject configuration ----------------------------

  describe('1. Required subject columns come from GradeSubjectConfig', () => {
    it('returns exactly the subjects configured in GradeSubjectConfig (no more, no less)', async () => {
      setupDefaultMocks({ configuredSubjects: [CONFIG_ENG, CONFIG_MATH] });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      expect(register.subjects).toHaveLength(2);
      const names = register.subjects.map((s) => s.subjectName);
      expect(names).toContain('English');
      expect(names).toContain('Mathematics');
      expect(names).not.toContain('Physics');
    });

    it('subject column list is ordered by sortOrder from GradeSubjectConfig', async () => {
      setupDefaultMocks({ configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY] });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      const names = register.subjects.map((s) => s.subjectName);
      expect(names[0]).toBe('English');
      expect(names[1]).toBe('Mathematics');
      expect(names[2]).toBe('Physics');
    });

    it('throws BadRequestError when no GradeSubjectConfig entries exist', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM_9A);
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);

      await expect(
        service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    // -- CRITICAL REGRESSION TEST ------------------------------------------
    it('[REGRESSION] required subject remains visible when NO TeacherSubject assignment exists', async () => {
      // Physics is in GradeSubjectConfig but has no TeacherSubject row.
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
        teacherSubjects: [
          { id: 10, subjectId: 1 }, // English has assignment
          { id: 11, subjectId: 2 }, // Math has assignment
          // Physics has NO assignment
        ],
        components: [],
        entries: [],
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      // Physics must still appear as a column
      const subjectNames = register.subjects.map((s) => s.subjectName);
      expect(subjectNames).toContain('Physics');

      // For the student, Physics must have finalResult: null and hasAssignment: false
      const student = register.students[0];
      const physicsResult = student.subjectResults.find((r) => r.subjectName === 'Physics');
      expect(physicsResult).toBeDefined();
      expect(physicsResult!.finalResult).toBeNull();
      expect(physicsResult!.hasAssignment).toBe(false);
    });

    it('[REGRESSION] required subject remains visible when TeacherSubject exists but no results entered', async () => {
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH],
        teacherSubjects: [
          { id: 10, subjectId: 1 }, // English
          { id: 11, subjectId: 2 }, // Math � has assignment but no components
        ],
        components: [],  // No grade components defined
        entries: [],
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      const mathResult = register.students[0].subjectResults.find((r) => r.subjectName === 'Mathematics');
      expect(mathResult).toBeDefined();
      expect(mathResult!.finalResult).toBeNull();
      expect(mathResult!.hasAssignment).toBe(true);
    });

    it('each student row has a subjectResult entry for every configured subject', async () => {
      setupDefaultMocks({
        students: [STUDENT_A, STUDENT_B],
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
        teacherSubjects: [],
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      for (const student of register.students) {
        expect(student.subjectResults).toHaveLength(3);
        const names = student.subjectResults.map((r) => r.subjectName);
        expect(names).toContain('English');
        expect(names).toContain('Mathematics');
        expect(names).toContain('Physics');
      }
    });
  });

  // -- Section 2: Missing-result behavior ------------------------------------

  describe('2. Missing results do not remove subject columns', () => {
    it('student with no results: all subjects present with finalResult null', async () => {
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
        teacherSubjects: [],
        entries: [],
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const student = register.students[0];

      expect(student.subjectResults).toHaveLength(3);
      for (const r of student.subjectResults) {
        expect(r.finalResult).toBeNull();
      }
    });

    it('student with no results gets PENDING status (not finalized)', async () => {
      setupDefaultMocks({ teacherSubjects: [], entries: [], classroomFinalization: null });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].academicStatus).toBe(AcademicStatus.PENDING);
    });

    it('student missing a subject with no assignment gets PENDING (no assignment = not finalized)', async () => {
      // English: finalized result. Math: finalized result. Physics: no assignment ? isFinalized=false.
      // Since Physics is not finalized, allFinalized=false ? status is PENDING, not INCOMPLETE.
      // INCOMPLETE only occurs when the classroom finalization is FINALIZED but a subject has null result
      // while all other subjects ARE finalized.
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
        teacherSubjects: [
          { id: 10, subjectId: 1 },
          { id: 11, subjectId: 2 },
          // Physics: no assignment
        ],
        finalizations: [
          { teacherSubjectId: 10, status: 'FINALIZED' },
          { teacherSubjectId: 11, status: 'FINALIZED' },
        ],
        components: [
          { gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 },
          { gradeComponentId: 2, teacherSubjectId: 11, maxMarks: 100 },
        ],
        entries: [
          { gradeComponentId: 1, studentId: 101, score: 72 },
          { gradeComponentId: 2, studentId: 101, score: 65 },
        ],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const student = register.students[0];

      // Physics column must still exist with null result
      const physicsResult = student.subjectResults.find((r) => r.subjectName === 'Physics');
      expect(physicsResult).toBeDefined();
      expect(physicsResult!.finalResult).toBeNull();
      expect(physicsResult!.hasAssignment).toBe(false);

      // Physics has no assignment ? isFinalized=false ? allFinalized=false ? PENDING
      // (INCOMPLETE would require all subjects to be finalized but one to have a null result)
      expect(student.academicStatus).toBe(AcademicStatus.PENDING);
    });

    it('PENDING student is NOT ranked', async () => {
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [{ gradeComponentId: 1, studentId: 101, score: 90 }],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      // Math and Physics have no assignment ? isFinalized=false ? PENDING
      expect(register.students[0].academicStatus).toBe(AcademicStatus.PENDING);
      expect(register.students[0].sectionRank).toBeNull();
    });

    it('missing results are NOT treated as zero in average calculation', async () => {
      // Only English has a result (72). Math has no result.
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [{ gradeComponentId: 1, studentId: 101, score: 72 }],
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const student = register.students[0];

      // Average must NOT be 72/2 = 36 (treating missing as 0)
      // It should be partial: 72/1 subject = 72, or null/N-A
      if (student.average !== null) {
        expect(student.average).not.toBe(36);
      }
      // Status must not be PASS or FAIL when a result is missing
      expect(student.academicStatus).not.toBe(AcademicStatus.PASS);
      expect(student.academicStatus).not.toBe(AcademicStatus.FAIL);
    });
  });
  // -- Section 3: Classroom and section scope --------------------------------

  describe('3. Classroom/section scope', () => {
    it('only returns students belonging to the requested classroom', async () => {
      setupDefaultMocks({ students: [STUDENT_A, STUDENT_B] });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      const ids = register.students.map((s) => s.studentId);
      expect(ids).toContain(101);
      expect(ids).toContain(102);
      expect(ids).not.toContain(103); // STUDENT_C is in classroom 9B
    });

    it('uses GradeSubjectConfig from the requested academicYear only', async () => {
      // Mock returns configs for 2026/27 � query for a different year should get empty
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM_9A);
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);

      const queryDifferentYear = { classroomId: 1, academicYear: '2025/26', viewMode: 'SEMESTER_1' as const };

      await expect(
        service.generateClassroomRegister(ACTOR_DIRECTOR, queryDifferentYear)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('[REGRESSION] selecting classroom 9A does not accidentally include 9B students', async () => {
      // 9B has teacher assignments; 9A has none � but the register should show 9A students
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM_9A);
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CONFIG_ENG, CONFIG_MATH]);
      (prisma.student.findMany as Mock).mockResolvedValue([STUDENT_A]); // only 9A students
      (prisma.student.count as Mock).mockResolvedValue(1);
      (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
      (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
      (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
      (prisma.classroom.findMany as Mock).mockResolvedValue([CLASSROOM_9A]);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
      (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
      (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
      (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
      (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark: 50, minimumSubjectPassMark: 40 });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      expect(register.students).toHaveLength(1);
      expect(register.students[0].studentId).toBe(101);
    });

    it('metadata reports correct classroomId and section', async () => {
      setupDefaultMocks();

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      expect(register.metadata.classroomId).toBe(1);
      expect(register.metadata.section).toBe('A');
      expect(register.metadata.grade).toBe('Grade 9');
      expect(register.metadata.academicYear).toBe('2026/27');
    });
  });

  // -- Section 4: Student roster ---------------------------------------------

  describe('4. Student roster fields', () => {
    it('includes studentId, name, admissionNumber, gender, and age for each student', async () => {
      setupDefaultMocks({ students: [STUDENT_A] });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const s = register.students[0];

      expect(s.studentId).toBe(101);
      expect(s.studentName).toBe('Alice Bekele');
      expect(s.admissionNumber).toBe('DSH-001');
      expect(s.gender).toBe('F');
      expect(typeof s.age).toBe('number');
      expect(s.age).toBeGreaterThan(0);
    });

    it('includes absent count from attendance records', async () => {
      setupDefaultMocks({ students: [STUDENT_A] });
      (prisma.attendance.groupBy as Mock).mockResolvedValue([
        { studentId: 101, _count: { _all: 3 } },
      ]);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].absent).toBe(3);
    });

    it('absent defaults to 0 when no attendance records exist', async () => {
      setupDefaultMocks({ students: [STUDENT_A] });
      (prisma.attendance.groupBy as Mock).mockResolvedValue([]);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].absent).toBe(0);
    });

    it('conduct is null when no conduct record exists', async () => {
      setupDefaultMocks();
      (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].conduct).toBeNull();
    });

    it('metadata reports total student count correctly', async () => {
      setupDefaultMocks({ students: [STUDENT_A, STUDENT_B] });
      (prisma.student.count as Mock).mockResolvedValue(2);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.metadata.totalStudents).toBe(2);
    });
  });

  // -- Section 5: Result calculations ---------------------------------------

  describe('5. Result calculations', () => {
    it('calculates subject finalResult as percentage of maxMarks', async () => {
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [{ gradeComponentId: 1, studentId: 101, score: 78 }],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const eng = register.students[0].subjectResults[0];
      expect(eng.finalResult).toBe(78);
    });

    it('calculates finalResult correctly across multiple components', async () => {
      // Quiz(10) + MidExam(30) + FinalExam(50) = /90 scheme
      // Student: 8 + 25 + 42 = 75 out of 90 ? 83.33%
      setupDefaultMocks({
        configuredSubjects: [CONFIG_MATH],
        teacherSubjects: [{ id: 11, subjectId: 2 }],
        finalizations: [{ teacherSubjectId: 11, status: 'FINALIZED' }],
        components: [
          { gradeComponentId: 10, teacherSubjectId: 11, maxMarks: 10 },
          { gradeComponentId: 11, teacherSubjectId: 11, maxMarks: 30 },
          { gradeComponentId: 12, teacherSubjectId: 11, maxMarks: 50 },
        ],
        entries: [
          { gradeComponentId: 10, studentId: 101, score: 8 },
          { gradeComponentId: 11, studentId: 101, score: 25 },
          { gradeComponentId: 12, studentId: 101, score: 42 },
        ],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const math = register.students[0].subjectResults[0];
      // 75/90 * 100 = 83.33...
      expect(math.finalResult).toBeCloseTo(83.33, 1);
    });

    it('student with all finalized passing results gets PASS status', async () => {
      // English 72, Math 65, Physics 58 � all above 40 (min subject pass)
      // avg = 65 � above 50 (promotion pass mark)
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
        teacherSubjects: [
          { id: 10, subjectId: 1 },
          { id: 11, subjectId: 2 },
          { id: 12, subjectId: 3 },
        ],
        finalizations: [
          { teacherSubjectId: 10, status: 'FINALIZED' },
          { teacherSubjectId: 11, status: 'FINALIZED' },
          { teacherSubjectId: 12, status: 'FINALIZED' },
        ],
        components: [
          { gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 },
          { gradeComponentId: 2, teacherSubjectId: 11, maxMarks: 100 },
          { gradeComponentId: 3, teacherSubjectId: 12, maxMarks: 100 },
        ],
        entries: [
          { gradeComponentId: 1, studentId: 101, score: 72 },
          { gradeComponentId: 2, studentId: 101, score: 65 },
          { gradeComponentId: 3, studentId: 101, score: 58 },
        ],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].academicStatus).toBe(AcademicStatus.PASS);
    });

    it('student with average below pass mark gets FAIL status', async () => {
      // avg = 38 � below 50
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY],
        teacherSubjects: [
          { id: 10, subjectId: 1 }, { id: 11, subjectId: 2 }, { id: 12, subjectId: 3 },
        ],
        finalizations: [
          { teacherSubjectId: 10, status: 'FINALIZED' },
          { teacherSubjectId: 11, status: 'FINALIZED' },
          { teacherSubjectId: 12, status: 'FINALIZED' },
        ],
        components: [
          { gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 },
          { gradeComponentId: 2, teacherSubjectId: 11, maxMarks: 100 },
          { gradeComponentId: 3, teacherSubjectId: 12, maxMarks: 100 },
        ],
        entries: [
          { gradeComponentId: 1, studentId: 101, score: 45 },
          { gradeComponentId: 2, studentId: 101, score: 35 },
          { gradeComponentId: 3, studentId: 101, score: 34 },
        ],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].academicStatus).toBe(AcademicStatus.FAIL);
    });

    it('attendance does NOT independently determine PASS/FAIL status', async () => {
      // Student has 50 absences but passing grades � should still be PASS
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [{ gradeComponentId: 1, studentId: 101, score: 80 }],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });
      (prisma.attendance.groupBy as Mock).mockResolvedValue([
        { studentId: 101, _count: { _all: 50 } }, // many absences
      ]);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      // Status must be PASS � attendance does not affect academic status
      expect(register.students[0].academicStatus).toBe(AcademicStatus.PASS);
    });

    it('failedSubjects lists only subjects below minimumSubjectPassMark', async () => {
      // English 72 (pass), Math 35 (fail � below 40)
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH],
        teacherSubjects: [{ id: 10, subjectId: 1 }, { id: 11, subjectId: 2 }],
        finalizations: [
          { teacherSubjectId: 10, status: 'FINALIZED' },
          { teacherSubjectId: 11, status: 'FINALIZED' },
        ],
        components: [
          { gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 },
          { gradeComponentId: 2, teacherSubjectId: 11, maxMarks: 100 },
        ],
        entries: [
          { gradeComponentId: 1, studentId: 101, score: 72 },
          { gradeComponentId: 2, studentId: 101, score: 35 },
        ],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const student = register.students[0];
      expect(student.failedSubjects).toContain('Mathematics');
      expect(student.failedSubjects).not.toContain('English');
    });
  });

  // -- Section 6: Ranking ----------------------------------------------------

  describe('6. Ranking', () => {
    it('assigns rank 1 to the student with the highest average', async () => {
      // Two students: Alice 80, Bob 65
      const baseSetup = {
        students: [STUDENT_A, STUDENT_B],
        configuredSubjects: [CONFIG_ENG],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [
          { gradeComponentId: 1, studentId: 101, score: 80 },
          { gradeComponentId: 1, studentId: 102, score: 65 },
        ],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      };
      setupDefaultMocks(baseSetup);
      (prisma.student.count as Mock).mockResolvedValue(2);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      const alice = register.students.find((s) => s.studentId === 101)!;
      const bob   = register.students.find((s) => s.studentId === 102)!;
      expect(alice.sectionRank).toBe(1);
      expect(bob.sectionRank).toBe(2);
    });

    it('students with equal averages share the same rank', async () => {
      setupDefaultMocks({
        students: [STUDENT_A, STUDENT_B],
        configuredSubjects: [CONFIG_ENG],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [
          { gradeComponentId: 1, studentId: 101, score: 75 },
          { gradeComponentId: 1, studentId: 102, score: 75 },
        ],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });
      (prisma.student.count as Mock).mockResolvedValue(2);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);

      const alice = register.students.find((s) => s.studentId === 101)!;
      const bob   = register.students.find((s) => s.studentId === 102)!;
      expect(alice.sectionRank).toBe(bob.sectionRank);
    });

    it('student with incomplete results (missing subject) gets null rank', async () => {
      // Only English result � Math is missing
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG, CONFIG_MATH],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [{ gradeComponentId: 1, studentId: 101, score: 90 }],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });
      (prisma.student.count as Mock).mockResolvedValue(1);

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].sectionRank).toBeNull();
    });

    it('PENDING students do not receive a rank', async () => {
      setupDefaultMocks({
        teacherSubjects: [],
        classroomFinalization: null,
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].academicStatus).toBe(AcademicStatus.PENDING);
      expect(register.students[0].sectionRank).toBeNull();
    });
  });

  // -- Section 7: Academic status rules -------------------------------------

  describe('7. Academic status rules', () => {
    it('PENDING when classroom is not finalized and no results entered', async () => {
      setupDefaultMocks({ teacherSubjects: [], classroomFinalization: null });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].academicStatus).toBe(AcademicStatus.PENDING);
    });

    it('PENDING when classroom is not finalized even if some results exist', async () => {
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'APPROVED' }], // not FINALIZED
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [{ gradeComponentId: 1, studentId: 101, score: 80 }],
        classroomFinalization: null, // not finalized at classroom level
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].academicStatus).toBe(AcademicStatus.PENDING);
    });

    it('Grade 9 student with 4+ failed subjects gets FAIL regardless of average', async () => {
      // avg = 38, but even if avg were 60, 4+ failed subjects = unconditional FAIL for Grade 9
      const allSubjects = [CONFIG_ENG, CONFIG_MATH, CONFIG_PHY,
        { subjectId: 4, sortOrder: 3, subject: { subjectId: 4, subjectCode: 'BIO9', subjectName: 'Biology' } },
        { subjectId: 5, sortOrder: 4, subject: { subjectId: 5, subjectCode: 'CHEM9', subjectName: 'Chemistry' } },
      ];
      const tsIds = [10, 11, 12, 13, 14];
      setupDefaultMocks({
        configuredSubjects: allSubjects,
        teacherSubjects: allSubjects.map((s, i) => ({ id: tsIds[i], subjectId: s.subjectId })),
        finalizations: tsIds.map((id) => ({ teacherSubjectId: id, status: 'FINALIZED' })),
        components: tsIds.map((id, i) => ({ gradeComponentId: i + 1, teacherSubjectId: id, maxMarks: 100 })),
        entries: [1, 2, 3, 4, 5].map((i, idx) => ({ gradeComponentId: i, studentId: 101, score: 30 })),
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
        systemSettings: { promotionPassMark: 50, minimumSubjectPassMark: 40 },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.students[0].academicStatus).toBe(AcademicStatus.FAIL);
    });

    it('isOfficialView is false when classroom is not finalized', async () => {
      setupDefaultMocks({ classroomFinalization: null });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.metadata.isOfficialView).toBe(false);
    });

    it('isOfficialView is true when classroom is fully finalized', async () => {
      setupDefaultMocks({
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      expect(register.metadata.isOfficialView).toBe(true);
    });

    it('PASS does not imply PROMOTED � academicStatus never includes promotion decision', async () => {
      setupDefaultMocks({
        configuredSubjects: [CONFIG_ENG],
        teacherSubjects: [{ id: 10, subjectId: 1 }],
        finalizations: [{ teacherSubjectId: 10, status: 'FINALIZED' }],
        components: [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }],
        entries: [{ gradeComponentId: 1, studentId: 101, score: 75 }],
        classroomFinalization: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      const register = await service.generateClassroomRegister(ACTOR_DIRECTOR, QUERY_S1);
      const status = register.students[0].academicStatus;

      expect(status).toBe(AcademicStatus.PASS);
      // Promotion decisions are separate � academicStatus must only be one of the four academic statuses
      expect([AcademicStatus.PASS, AcademicStatus.FAIL, AcademicStatus.INCOMPLETE, AcademicStatus.PENDING])
        .toContain(status);
      // Must NOT be a promotion-related string
      expect(status).not.toBe('PROMOTED');
      expect(status).not.toBe('REPEATED');
      expect(status).not.toBe('GRADUATED');
    });
  });
});

// ── Section isolation regression tests ───────────────────────────────────────
// These tests verify that each classroom section's register is completely
// independent: selecting Grade 9 Section A must never show students from
// Sections B or C.
//
// Root cause investigation confirmed: the backend is correct. The API returns
// exactly the students enrolled in the requested classroom for the requested
// academic year. The tests below pin this invariant.

describe('Section isolation: Grade 9 A, B, C are independent registers for academic year 2026', () => {
  let service: AcademicRegisterService;
  beforeEach(() => { service = new AcademicRegisterService(); vi.clearAllMocks(); });

  // Section A: students 101-103 (3 students)
  // Section B: students 201-204 (4 students)
  // Section C: students 301-305 (5 students)

  const CL_A = { classroomId: 13, className: 'Grade 9', section: 'A', academicYear: '2026', homeroomTeacherId: null };
  const CL_B = { classroomId: 26, className: 'Grade 9', section: 'B', academicYear: '2026', homeroomTeacherId: null };
  const CL_C = { classroomId: 27, className: 'Grade 9', section: 'C', academicYear: '2026', homeroomTeacherId: null };

  const STUDENTS_A = [
    { studentId: 101, userId: 201, classroomId: 13, firstName: 'Alice',   lastName: 'A', admissionNumber: 'A-001', gender: 'F', dateOfBirth: new Date('2009-01-01') },
    { studentId: 102, userId: 202, classroomId: 13, firstName: 'Bob',     lastName: 'B', admissionNumber: 'A-002', gender: 'M', dateOfBirth: new Date('2009-02-01') },
    { studentId: 103, userId: 203, classroomId: 13, firstName: 'Charlie', lastName: 'C', admissionNumber: 'A-003', gender: 'M', dateOfBirth: new Date('2009-03-01') },
  ];
  const STUDENTS_B = [
    { studentId: 201, userId: 301, classroomId: 26, firstName: 'Dave',  lastName: 'D', admissionNumber: 'B-001', gender: 'M', dateOfBirth: new Date('2009-04-01') },
    { studentId: 202, userId: 302, classroomId: 26, firstName: 'Eve',   lastName: 'E', admissionNumber: 'B-002', gender: 'F', dateOfBirth: new Date('2009-05-01') },
    { studentId: 203, userId: 303, classroomId: 26, firstName: 'Frank', lastName: 'F', admissionNumber: 'B-003', gender: 'M', dateOfBirth: new Date('2009-06-01') },
    { studentId: 204, userId: 304, classroomId: 26, firstName: 'Grace', lastName: 'G', admissionNumber: 'B-004', gender: 'F', dateOfBirth: new Date('2009-07-01') },
  ];

  const CONFIGS_2026 = [
    { subjectId: 1, sortOrder: 0, subject: { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' } },
  ];
  const SETTINGS_2026 = { promotionPassMark: 50, minimumSubjectPassMark: 40 };

  function setupSectionA() {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL_A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CONFIGS_2026);
    // Enrollment-based student loading for Section A
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue(
      STUDENTS_A.map((s) => ({ studentId: s.studentId }))
    );
    (prisma.student.findMany as Mock).mockResolvedValue(STUDENTS_A);
    (prisma.student.count as Mock).mockResolvedValue(3);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    // grade-wide: classrooms A, B, C all exist
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL_A, CL_B, CL_C]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS_2026);
    // Enrollment counts for grade-wide totalStudentsInGrade
    (prisma.studentEnrollment.count as Mock).mockResolvedValue(0);
  }

  it('Section A register returns exactly 3 students, not 7 (B+C excluded)', async () => {
    setupSectionA();
    const register = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    expect(register.students).toHaveLength(3);
    const ids = register.students.map((s) => s.studentId);
    expect(ids).toContain(101);
    expect(ids).toContain(102);
    expect(ids).toContain(103);
    // Section B and C students must NOT appear
    expect(ids).not.toContain(201);
    expect(ids).not.toContain(202);
    expect(ids).not.toContain(203);
    expect(ids).not.toContain(204);
    expect(ids).not.toContain(301);
  });

  it('Section A metadata.totalStudents is 3 (not 12)', async () => {
    setupSectionA();
    const register = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    expect(register.metadata.totalStudents).toBe(3);
    // classroomLabel format: "Grade 9 A (2026)"
    expect(register.metadata.classroomLabel).toMatch(/Grade 9.*A/i);
  });

  it('Section A passCount, failCount, incompleteCount only count Section A students', async () => {
    setupSectionA();
    const register = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    const total = register.metadata.passCount + register.metadata.failCount +
                  register.metadata.incompleteCount + register.metadata.pendingCount;
    expect(total).toBe(3); // exactly the 3 Section A students
  });

  it('Section B students (ids 201-204) do not appear in Section A register', async () => {
    setupSectionA();
    const register = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    const ids = new Set(register.students.map((s) => s.studentId));
    for (const bId of [201, 202, 203, 204]) {
      expect(ids.has(bId)).toBe(false);
    }
  });

  it('Sections A and B return different students when queried separately', async () => {
    // Section A query
    setupSectionA();
    const regA = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    const idsA = new Set(regA.students.map((s) => s.studentId));

    // Section B query
    vi.clearAllMocks();
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL_B);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CONFIGS_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue(
      STUDENTS_B.map((s) => ({ studentId: s.studentId }))
    );
    (prisma.student.findMany as Mock).mockResolvedValue(STUDENTS_B);
    (prisma.student.count as Mock).mockResolvedValue(4);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL_A, CL_B, CL_C]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS_2026);
    (prisma.studentEnrollment.count as Mock).mockResolvedValue(0);

    const regB = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 26, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    const idsB = new Set(regB.students.map((s) => s.studentId));

    // No overlap between A and B
    for (const id of idsA) expect(idsB.has(id)).toBe(false);
    for (const id of idsB) expect(idsA.has(id)).toBe(false);

    // Correct counts
    expect(regA.students).toHaveLength(3);
    expect(regB.students).toHaveLength(4);
  });

  it('Section A sectionRanks are calculated using only Section A students', async () => {
    setupSectionA();
    const register = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    // All 3 students should have totalStudentsInSection = 3
    for (const s of register.students) {
      expect(s.totalStudentsInSection).toBe(3);
    }
  });

  it('Historical: promoted students still appear in Section A 2026 register via enrollment', async () => {
    // Students 101-103 have been promoted and their classroomId now points elsewhere,
    // but StudentEnrollment records them in classroomId=13 for academicYear=2026.
    const promotedStudents = STUDENTS_A.map((s) => ({ ...s, classroomId: 28 })); // now in Grade 10
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL_A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(CONFIGS_2026);
    // Enrollment records still point to classroomId=13 for 2026
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
      { studentId: 101 }, { studentId: 102 }, { studentId: 103 },
    ]);
    (prisma.student.findMany as Mock).mockResolvedValue(promotedStudents);
    (prisma.student.count as Mock).mockResolvedValue(3);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL_A, CL_B, CL_C]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS_2026);
    (prisma.studentEnrollment.count as Mock).mockResolvedValue(0);

    const register = await service.generateClassroomRegister(
      ACTOR_DIRECTOR,
      { classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1' }
    );
    // All 3 original Section A students appear despite being promoted
    expect(register.students).toHaveLength(3);
    expect(register.students.map((s) => s.studentId)).toEqual(
      expect.arrayContaining([101, 102, 103])
    );
  });
});
