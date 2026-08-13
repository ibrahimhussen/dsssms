import { ConductRating, Prisma, RoleName, Semester } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { computeCompetitionRanks } from '../academic-reports/ranking';
import {
  AcademicRegister,
  AcademicRegisterGradeSummary,
  AcademicRegisterMetadata,
  AcademicRegisterQuery,
  AcademicRegisterStudent,
  AcademicStatus,
  RegisterViewMode,
  SubjectResult,
} from './dto/academic-register.dto';

// ── Constants ─────────────────────────────────────────────────────────────────

const OVERSIGHT_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

/**
 * Semester weights for Full-Year calculation.
 * Configurable here — default is equal weighting (50/50).
 * Future: move to SystemSetting.
 */
const SEMESTER_WEIGHTS = {
  [Semester.SEMESTER_1]: 0.5,
  [Semester.SEMESTER_2]: 0.5,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

function extractClassName(rawName: string): string {
  // Normalise "Grade 11" → "Grade 11", "11" → "Grade 11", "Grade11" → "Grade 11"
  const match = rawName.match(/(?:Grade\s*)?(\d+)/i);
  return match ? `Grade ${match[1]}` : rawName;
}

async function getSystemSettings() {
  const s = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  return {
    promotionPassMark: s ? Number(s.promotionPassMark) : 50,
    minimumSubjectPassMark: s ? Number(s.minimumSubjectPassMark) : 40,
  };
}

/**
 * Determines whether the actor can access the register for this classroom.
 * Returns true = full access, 'homeroom' = homeroom teacher read-only view.
 */
async function assertCanAccessClassroomRegister(
  actor: AuthenticatedUser,
  classroom: { classroomId: number; homeroomTeacherId: number | null }
): Promise<void> {
  if (OVERSIGHT_ROLES.includes(actor.role)) return;

  if (actor.role === RoleName.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: actor.userId } });
    if (!teacher) throw new ForbiddenError('No teacher profile found');

    // Is this teacher the homeroom teacher?
    if (classroom.homeroomTeacherId === teacher.teacherId) return;

    // Is this teacher assigned to any subject in this classroom?
    const assignment = await prisma.teacherSubject.findFirst({
      where: { teacherId: teacher.teacherId, classroomId: classroom.classroomId },
    });
    if (!assignment) {
      throw new ForbiddenError('You are not assigned to this classroom');
    }
    return;
  }

  throw new ForbiddenError('You do not have permission to access academic registers');
}

// ── Per-semester subject result computation ───────────────────────────────────

interface SubjectRawResult {
  subjectId: number;
  finalResult: number | null;   // normalized /100 or null if no data
  isFinalized: boolean;
  hasAssignment: boolean;
}

/**
 * Loads all subject results for a list of students in a classroom for one
 * semester. Uses bulk queries — no per-student loops.
 *
 * Returns: Map<studentId, Map<subjectId, SubjectRawResult>>
 */
async function loadSemesterResults(
  classroomId: number,
  semester: Semester,
  academicYear: string,
  configuredSubjectIds: number[],
  studentIds: number[]
): Promise<Map<number, Map<number, SubjectRawResult>>> {
  // 1. Get all TeacherSubject assignments for this classroom
  const teacherSubjects = await prisma.teacherSubject.findMany({
    where: { classroomId },
    select: { id: true, subjectId: true },
  });
  const tsMap = new Map(teacherSubjects.map((ts) => [ts.subjectId, ts.id]));

  // 2. Get finalization status for each TeacherSubject
  const finalizations = await prisma.subjectFinalization.findMany({
    where: {
      teacherSubjectId: { in: teacherSubjects.map((ts) => ts.id) },
      semester,
      academicYear,
    },
    select: { teacherSubjectId: true, status: true },
  });
  const finalizationMap = new Map(finalizations.map((f) => [f.teacherSubjectId, f.status]));

  // 3. Bulk-load all GradeComponent + GradeEntry for all teacherSubjectIds
  const teacherSubjectIds = teacherSubjects.map((ts) => ts.id);

  const components = await prisma.gradeComponent.findMany({
    where: { teacherSubjectId: { in: teacherSubjectIds }, semester, academicYear },
    select: { gradeComponentId: true, teacherSubjectId: true, maxMarks: true },
  });

  const entries = await prisma.gradeEntry.findMany({
    where: {
      gradeComponentId: { in: components.map((c) => c.gradeComponentId) },
      studentId: { in: studentIds },
    },
    select: { gradeComponentId: true, studentId: true, score: true },
  });

  // Build lookups
  // componentsByTs: tsId -> [{ gradeComponentId, maxMarks }]
  const componentsByTs = new Map<number, { gradeComponentId: number; maxMarks: number }[]>();
  for (const c of components) {
    const list = componentsByTs.get(c.teacherSubjectId) ?? [];
    list.push({ gradeComponentId: c.gradeComponentId, maxMarks: Number(c.maxMarks) });
    componentsByTs.set(c.teacherSubjectId, list);
  }

  // scoreMap: gradeComponentId -> studentId -> score
  const scoreMap = new Map<number, Map<number, number>>();
  for (const e of entries) {
    let m = scoreMap.get(e.gradeComponentId);
    if (!m) { m = new Map(); scoreMap.set(e.gradeComponentId, m); }
    m.set(e.studentId, Number(e.score));
  }

  // 4. Build result map for each student × each configuredSubject
  const result = new Map<number, Map<number, SubjectRawResult>>();

  for (const studentId of studentIds) {
    const studentResults = new Map<number, SubjectRawResult>();

    for (const subjectId of configuredSubjectIds) {
      const tsId = tsMap.get(subjectId);
      const hasAssignment = tsId !== undefined;
      const isFinalized = hasAssignment ? finalizationMap.get(tsId!) === 'FINALIZED' : false;

      if (!hasAssignment || !tsId) {
        studentResults.set(subjectId, { subjectId, finalResult: null, isFinalized: false, hasAssignment: false });
        continue;
      }

      const comps = componentsByTs.get(tsId) ?? [];
      if (comps.length === 0) {
        studentResults.set(subjectId, { subjectId, finalResult: null, isFinalized, hasAssignment: true });
        continue;
      }

      const totalMaxMarks = comps.reduce((s, c) => s + c.maxMarks, 0);
      const totalScore = comps.reduce((s, c) => {
        const studentScores = scoreMap.get(c.gradeComponentId);
        return s + (studentScores?.get(studentId) ?? 0);
      }, 0);

      const finalResult = totalMaxMarks > 0
        ? Math.round((totalScore / totalMaxMarks) * 10000) / 100
        : null;

      studentResults.set(subjectId, { subjectId, finalResult, isFinalized, hasAssignment: true });
    }

    result.set(studentId, studentResults);
  }

  return result;
}

// ── Academic status determination ─────────────────────────────────────────────

function determineAcademicStatus(
  subjectResults: SubjectRawResult[],
  settings: { promotionPassMark: number; minimumSubjectPassMark: number },
  allFinalized: boolean
): AcademicStatus {
  const hasAnyData = subjectResults.some((r) => r.finalResult !== null);

  if (!hasAnyData) return AcademicStatus.PENDING;

  const hasIncomplete = subjectResults.some((r) => r.finalResult === null);

  if (hasIncomplete) {
    return allFinalized ? AcademicStatus.INCOMPLETE : AcademicStatus.PENDING;
  }

  if (!allFinalized) return AcademicStatus.PENDING;

  // All subjects have results and are finalized — determine pass/fail
  const avg = subjectResults.reduce((s, r) => s + r.finalResult!, 0) / subjectResults.length;
  const failsAverage = avg < settings.promotionPassMark;
  const failsSubject = subjectResults.some((r) => r.finalResult! < settings.minimumSubjectPassMark);

  return failsAverage || failsSubject ? AcademicStatus.FAIL : AcademicStatus.PASS;
}

// ── Main service ──────────────────────────────────────────────────────────────

export class AcademicRegisterService {
  /**
   * Generates the Academic Register for one classroom in one of the
   * three view modes (SEMESTER_1, SEMESTER_2, FULL_YEAR).
   */
  async generateClassroomRegister(
    actor: AuthenticatedUser,
    query: AcademicRegisterQuery
  ): Promise<AcademicRegister> {
    if (!query.classroomId) throw new BadRequestError('classroomId is required');

    const classroom = await prisma.classroom.findUnique({ where: { classroomId: query.classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    await assertCanAccessClassroomRegister(actor, classroom);

    const settings = await getSystemSettings();

    // ── Configured subjects (authoritative list) ──────────────────────────────
    const configuredSubjects = await prisma.gradeSubjectConfig.findMany({
      where: { className: classroom.className, academicYear: query.academicYear },
      include: { subject: true },
      orderBy: [{ sortOrder: 'asc' }, { subject: { subjectName: 'asc' } }],
    });

    if (configuredSubjects.length === 0) {
      throw new BadRequestError(
        `No subjects have been configured for ${classroom.className} in ${query.academicYear}. ` +
        `Please configure grade subjects before generating the register.`
      );
    }

    const configuredSubjectIds = configuredSubjects.map((cs) => cs.subjectId);
    const subjectColumnList = configuredSubjects.map((cs) => ({
      subjectId: cs.subjectId,
      subjectName: cs.subject.subjectName,
      sortOrder: cs.sortOrder,
    }));

    // ── Students ──────────────────────────────────────────────────────────────
    const students = await prisma.student.findMany({
      where: { classroomId: query.classroomId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const studentIds = students.map((s) => s.studentId);

    // ── Conduct records ───────────────────────────────────────────────────────
    // For Full-Year, pull both semesters and take the better/latest rating
    const conductSemesters =
      query.viewMode === 'FULL_YEAR'
        ? [Semester.SEMESTER_1, Semester.SEMESTER_2]
        : [query.viewMode as Semester];

    const conductRecords = await prisma.studentConduct.findMany({
      where: {
        studentId: { in: studentIds },
        classroomId: query.classroomId,
        academicYear: query.academicYear,
        semester: { in: conductSemesters },
      },
      select: { studentId: true, rating: true, semester: true },
    });

    // For Full-Year: SEMESTER_2 conduct takes precedence; fall back to S1
    const conductMap = new Map<number, ConductRating>();
    for (const c of conductRecords) {
      if (query.viewMode === 'FULL_YEAR') {
        if (!conductMap.has(c.studentId) || c.semester === Semester.SEMESTER_2) {
          conductMap.set(c.studentId, c.rating);
        }
      } else {
        conductMap.set(c.studentId, c.rating);
      }
    }

    // ── Classroom finalization state ──────────────────────────────────────────
    let isOfficialView = false;
    let finalizedAt: string | null = null;

    if (query.viewMode === 'FULL_YEAR') {
      const [f1, f2] = await Promise.all([
        prisma.classroomFinalization.findUnique({
          where: { classroomId_semester_academicYear: { classroomId: query.classroomId, semester: Semester.SEMESTER_1, academicYear: query.academicYear } },
        }),
        prisma.classroomFinalization.findUnique({
          where: { classroomId_semester_academicYear: { classroomId: query.classroomId, semester: Semester.SEMESTER_2, academicYear: query.academicYear } },
        }),
      ]);
      isOfficialView = f1?.status === 'FINALIZED' && f2?.status === 'FINALIZED';
      if (f2?.finalizedAt) finalizedAt = f2.finalizedAt.toISOString();
    } else {
      const semester = query.viewMode as Semester;
      const f = await prisma.classroomFinalization.findUnique({
        where: { classroomId_semester_academicYear: { classroomId: query.classroomId, semester, academicYear: query.academicYear } },
      });
      isOfficialView = f?.status === 'FINALIZED';
      if (f?.finalizedAt) finalizedAt = f.finalizedAt.toISOString();
    }

    // ── Load subject results by mode ──────────────────────────────────────────
    let resultsBySemester: Map<Semester, Map<number, Map<number, SubjectRawResult>>>;

    if (query.viewMode === 'FULL_YEAR') {
      const [s1Results, s2Results] = await Promise.all([
        loadSemesterResults(query.classroomId!, Semester.SEMESTER_1, query.academicYear, configuredSubjectIds, studentIds),
        loadSemesterResults(query.classroomId!, Semester.SEMESTER_2, query.academicYear, configuredSubjectIds, studentIds),
      ]);
      resultsBySemester = new Map([
        [Semester.SEMESTER_1, s1Results],
        [Semester.SEMESTER_2, s2Results],
      ]);
    } else {
      const semester = query.viewMode as Semester;
      const semResults = await loadSemesterResults(query.classroomId!, semester, query.academicYear, configuredSubjectIds, studentIds);
      resultsBySemester = new Map([[semester, semResults]]);
    }

    // ── Build per-student rows ────────────────────────────────────────────────
    const registerStudents: AcademicRegisterStudent[] = [];
    const rankableStudents: { studentId: number; average: number }[] = [];

    for (const student of students) {
      const age = calculateAge(student.dateOfBirth);
      const conduct = conductMap.get(student.studentId) ?? null;

      let subjectResults: SubjectResult[];
      let allFinalized: boolean;

      if (query.viewMode === 'FULL_YEAR') {
        // Full-Year: combine S1 and S2 with equal weights
        const s1 = resultsBySemester.get(Semester.SEMESTER_1)!.get(student.studentId)!;
        const s2 = resultsBySemester.get(Semester.SEMESTER_2)!.get(student.studentId)!;

        subjectResults = configuredSubjectIds.map((subjectId) => {
          const r1 = s1.get(subjectId)!;
          const r2 = s2.get(subjectId)!;
          const hasAssignment = r1.hasAssignment || r2.hasAssignment;
          const isFinalized = r1.isFinalized && r2.isFinalized;

          let finalResult: number | null = null;
          if (r1.finalResult !== null && r2.finalResult !== null) {
            finalResult = Math.round(
              (r1.finalResult * SEMESTER_WEIGHTS[Semester.SEMESTER_1] +
               r2.finalResult * SEMESTER_WEIGHTS[Semester.SEMESTER_2]) * 100
            ) / 100;
          }

          const subjectConfig = configuredSubjects.find((cs) => cs.subjectId === subjectId)!;
          return {
            subjectId,
            subjectName: subjectConfig.subject.subjectName,
            finalResult,
            isFinalized,
            hasAssignment,
          };
        });
        allFinalized = subjectResults.every((r) => r.isFinalized);
      } else {
        const semester = query.viewMode as Semester;
        const semStudentResults = resultsBySemester.get(semester)!.get(student.studentId)!;

        subjectResults = configuredSubjectIds.map((subjectId) => {
          const r = semStudentResults.get(subjectId)!;
          const subjectConfig = configuredSubjects.find((cs) => cs.subjectId === subjectId)!;
          return {
            subjectId,
            subjectName: subjectConfig.subject.subjectName,
            finalResult: r.finalResult,
            isFinalized: r.isFinalized,
            hasAssignment: r.hasAssignment,
          };
        });
        allFinalized = subjectResults.every((r) => r.isFinalized);
      }

      const academicStatus = determineAcademicStatus(
        subjectResults.map((r) => ({
          subjectId: r.subjectId,
          finalResult: r.finalResult,
          isFinalized: r.isFinalized,
          hasAssignment: r.hasAssignment,
        })),
        settings,
        allFinalized
      );

      // Calculate total/average only for students with complete, finalized results
      let totalObtained: number | null = null;
      let totalPossible: number | null = null;
      let average: number | null = null;

      const completedResults = subjectResults.filter((r) => r.finalResult !== null);
      const allComplete = completedResults.length === configuredSubjectIds.length;

      if (allComplete) {
        totalObtained = Math.round(completedResults.reduce((s, r) => s + r.finalResult!, 0) * 100) / 100;
        totalPossible = configuredSubjectIds.length * 100;
        average = Math.round((totalObtained / configuredSubjectIds.length) * 100) / 100;
      } else if (completedResults.length > 0) {
        // Partial — show what we have but don't use for ranking
        totalObtained = Math.round(completedResults.reduce((s, r) => s + r.finalResult!, 0) * 100) / 100;
        totalPossible = completedResults.length * 100;
        average = Math.round((totalObtained / completedResults.length) * 100) / 100;
      }

      // Only rank students with complete finalized results
      if (
        allComplete &&
        (academicStatus === AcademicStatus.PASS || academicStatus === AcademicStatus.FAIL) &&
        average !== null
      ) {
        rankableStudents.push({ studentId: student.studentId, average });
      }

      registerStudents.push({
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        age,
        subjectResults,
        totalObtained,
        totalPossible,
        average,
        sectionRank: null,      // filled below
        gradeRank: null,        // filled below
        totalStudentsInSection: students.length,
        totalStudentsInGrade: 0, // filled below
        conduct,
        academicStatus,
        hasUnfinalizedSubjects: subjectResults.some((r) => !r.isFinalized),
      });
    }

    // ── Section ranks ─────────────────────────────────────────────────────────
    const sectionRanks = computeCompetitionRanks(rankableStudents);
    for (const student of registerStudents) {
      student.sectionRank = sectionRanks.get(student.studentId) ?? null;
    }

    // ── Grade ranks (across all sections) ────────────────────────────────────
    const gradeRankable = await this.buildGradeRankableStudents(
      classroom.className,
      query.academicYear,
      query.viewMode,
      configuredSubjectIds,
      settings
    );
    const gradeRanks = computeCompetitionRanks(gradeRankable);
    const totalStudentsInGrade = await prisma.student.count({
      where: {
        classroom: { className: classroom.className, academicYear: query.academicYear },
      },
    });

    for (const student of registerStudents) {
      student.gradeRank = gradeRanks.get(student.studentId) ?? null;
      student.totalStudentsInGrade = totalStudentsInGrade;
    }

    // ── Metadata ──────────────────────────────────────────────────────────────
    const passCount = registerStudents.filter((s) => s.academicStatus === AcademicStatus.PASS).length;
    const failCount = registerStudents.filter((s) => s.academicStatus === AcademicStatus.FAIL).length;
    const incompleteCount = registerStudents.filter((s) => s.academicStatus === AcademicStatus.INCOMPLETE).length;
    const pendingCount = registerStudents.filter((s) => s.academicStatus === AcademicStatus.PENDING).length;

    const averageEligible = registerStudents.filter((s) => s.average !== null);
    const classAverage =
      averageEligible.length > 0
        ? Math.round((averageEligible.reduce((s, r) => s + r.average!, 0) / averageEligible.length) * 100) / 100
        : null;

    const metadata: AcademicRegisterMetadata = {
      classroomId: classroom.classroomId,
      classroomLabel: `${classroom.className} ${classroom.section}`,
      academicYear: query.academicYear,
      viewMode: query.viewMode,
      grade: classroom.className,
      section: classroom.section,
      totalStudents: students.length,
      passCount,
      failCount,
      incompleteCount,
      pendingCount,
      classAverage,
      isOfficialView,
      finalizedAt,
      generatedAt: new Date().toISOString(),
    };

    return { metadata, subjects: subjectColumnList, students: registerStudents };
  }

  /**
   * Grade-wide summary: one row per section with aggregate stats.
   * Also supports Full-Year view.
   */
  async generateGradeRegister(
    actor: AuthenticatedUser,
    grade: string,
    academicYear: string,
    viewMode: RegisterViewMode
  ): Promise<AcademicRegisterGradeSummary> {
    if (!OVERSIGHT_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only Directors, Vice Directors and Administrators can view grade-wide registers');
    }

    const normalizedGrade = extractClassName(grade);
    const classrooms = await prisma.classroom.findMany({
      where: { className: normalizedGrade, academicYear },
      orderBy: { section: 'asc' },
    });

    if (classrooms.length === 0) {
      throw new NotFoundError(`No classrooms found for ${normalizedGrade} in ${academicYear}`);
    }

    const settings = await getSystemSettings();
    const configuredSubjectIds = (
      await prisma.gradeSubjectConfig.findMany({
        where: { className: normalizedGrade, academicYear },
        select: { subjectId: true },
      })
    ).map((cs) => cs.subjectId);

    const sections: AcademicRegisterGradeSummary['sections'] = [];
    let totalStudents = 0;
    let overallAverageSum = 0;
    let overallAverageCount = 0;
    let totalPass = 0;

    for (const classroom of classrooms) {
      const students = await prisma.student.findMany({ where: { classroomId: classroom.classroomId } });
      totalStudents += students.length;

      const register = await this.generateClassroomRegister(actor, {
        classroomId: classroom.classroomId,
        academicYear,
        viewMode,
      });

      const passCount = register.students.filter((s) => s.academicStatus === AcademicStatus.PASS).length;
      const failCount = register.students.filter((s) => s.academicStatus === AcademicStatus.FAIL).length;
      const eligible = register.students.filter((s) => s.average !== null);
      const sectionAverage =
        eligible.length > 0
          ? Math.round((eligible.reduce((s, r) => s + r.average!, 0) / eligible.length) * 100) / 100
          : null;

      if (sectionAverage !== null) {
        overallAverageSum += sectionAverage;
        overallAverageCount++;
      }
      totalPass += passCount;

      sections.push({
        section: classroom.section,
        classroomId: classroom.classroomId,
        studentCount: students.length,
        passCount,
        failCount,
        sectionAverage,
      });
    }

    return {
      grade: normalizedGrade,
      academicYear,
      viewMode,
      totalSections: classrooms.length,
      totalStudents,
      overallAverage: overallAverageCount > 0 ? Math.round((overallAverageSum / overallAverageCount) * 100) / 100 : null,
      overallPassRate: totalStudents > 0 ? Math.round((totalPass / totalStudents) * 10000) / 100 : null,
      sections,
    };
  }

  /**
   * Builds the full set of rankable students across all sections of a grade
   * for grade-wide ranking. Used internally by generateClassroomRegister.
   * Returns only students with complete, finalized results.
   */
  private async buildGradeRankableStudents(
    className: string,
    academicYear: string,
    viewMode: RegisterViewMode,
    configuredSubjectIds: number[],
    settings: { promotionPassMark: number; minimumSubjectPassMark: number }
  ): Promise<{ studentId: number; average: number }[]> {
    if (configuredSubjectIds.length === 0) return [];

    const classrooms = await prisma.classroom.findMany({
      where: { className, academicYear },
      select: { classroomId: true },
    });

    const rankable: { studentId: number; average: number }[] = [];

    for (const classroom of classrooms) {
      const students = await prisma.student.findMany({
        where: { classroomId: classroom.classroomId },
        select: { studentId: true },
      });
      const studentIds = students.map((s) => s.studentId);

      if (viewMode === 'FULL_YEAR') {
        const [s1, s2] = await Promise.all([
          loadSemesterResults(classroom.classroomId, Semester.SEMESTER_1, academicYear, configuredSubjectIds, studentIds),
          loadSemesterResults(classroom.classroomId, Semester.SEMESTER_2, academicYear, configuredSubjectIds, studentIds),
        ]);

        for (const studentId of studentIds) {
          const sr1 = s1.get(studentId)!;
          const sr2 = s2.get(studentId)!;
          let allComplete = true;
          let totalObtained = 0;

          for (const subjectId of configuredSubjectIds) {
            const r1 = sr1.get(subjectId)!;
            const r2 = sr2.get(subjectId)!;
            if (r1.finalResult === null || r2.finalResult === null || !r1.isFinalized || !r2.isFinalized) {
              allComplete = false;
              break;
            }
            totalObtained += r1.finalResult * SEMESTER_WEIGHTS[Semester.SEMESTER_1] +
                             r2.finalResult * SEMESTER_WEIGHTS[Semester.SEMESTER_2];
          }

          if (allComplete) {
            rankable.push({
              studentId,
              average: Math.round((totalObtained / configuredSubjectIds.length) * 100) / 100,
            });
          }
        }
      } else {
        const semester = viewMode as Semester;
        const semResults = await loadSemesterResults(classroom.classroomId, semester, academicYear, configuredSubjectIds, studentIds);

        for (const studentId of studentIds) {
          const studentResults = semResults.get(studentId)!;
          let allComplete = true;
          let totalObtained = 0;

          for (const subjectId of configuredSubjectIds) {
            const r = studentResults.get(subjectId)!;
            if (r.finalResult === null || !r.isFinalized) { allComplete = false; break; }
            totalObtained += r.finalResult;
          }

          if (allComplete) {
            rankable.push({
              studentId,
              average: Math.round((totalObtained / configuredSubjectIds.length) * 100) / 100,
            });
          }
        }
      }
    }

    return rankable;
  }

  /**
   * Returns the full dataset for a classroom register without pagination.
   * Used exclusively by the export service.
   */
  async getFullRegisterForExport(
    actor: AuthenticatedUser,
    classroomId: number,
    academicYear: string,
    viewMode: RegisterViewMode
  ): Promise<AcademicRegister> {
    return this.generateClassroomRegister(actor, { classroomId, academicYear, viewMode });
  }
}

export const academicRegisterService = new AcademicRegisterService();
