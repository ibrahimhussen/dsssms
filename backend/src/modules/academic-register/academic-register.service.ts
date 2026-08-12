import { ConductRating, Prisma, RoleName, Semester } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors/app-error';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { computeCompetitionRanks } from '../academic-reports/ranking';
import {
  AcademicRegister,
  AcademicRegisterMetadata,
  AcademicRegisterQuery,
  AcademicRegisterStudent,
  AcademicStatus,
  AcademicRegisterSummary,
  SubjectResult,
} from './dto/academic-register.dto';

const REGISTER_ROLES: RoleName[] = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.ADMIN];

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

function extractGrade(className: string): string {
  // Extract grade from class name like "Grade 11" or "11"
  const match = className.match(/(?:Grade\s*)?(\d+)/i);
  return match ? match[1] : className;
}

async function assertCanAccessClassroom(actor: AuthenticatedUser, classroomId: number) {
  if (!REGISTER_ROLES.includes(actor.role)) {
    throw new ForbiddenError('You do not have permission to access academic registers');
  }

  const classroom = await prisma.classroom.findUnique({
    where: { classroomId },
  });
  if (!classroom) throw new NotFoundError('Classroom');

  // TODO: Implement Vice Director oversight area restrictions
  // For now, all VICE_DIRECTOR, DIRECTOR, and ADMIN have full access
  return classroom;
}

async function assertCanAccessGrade(actor: AuthenticatedUser, grade: string, academicYear: string) {
  if (!REGISTER_ROLES.includes(actor.role)) {
    throw new ForbiddenError('You do not have permission to access academic registers');
  }

  // Verify grade exists
  const classroom = await prisma.classroom.findFirst({
    where: {
      className: { contains: grade },
      academicYear,
    },
  });

  if (!classroom) {
    throw new NotFoundError(`No classrooms found for grade ${grade} in academic year ${academicYear}`);
  }

  // TODO: Implement Vice Director oversight area restrictions
  return classroom;
}

async function getSystemSettings() {
  const settings = await prisma.systemSetting.findUnique({
    where: { id: 1 },
  });

  if (!settings) {
    throw new BadRequestError('System settings not configured');
  }

  return {
    promotionPassMark: Number(settings.promotionPassMark),
    minimumSubjectPassMark: Number(settings.minimumSubjectPassMark),
  };
}

async function getStudentEnrollmentForYear(studentId: number, academicYear: string) {
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: {
      studentId_academicYear: { studentId, academicYear },
    },
    include: { classroom: true },
  });

  return enrollment;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AcademicRegisterService {
  /**
   * Generate Academic Register for a specific classroom and academic period.
   * Only uses finalized subject results as source of truth.
   */
  async generateClassroomRegister(
    actor: AuthenticatedUser,
    query: AcademicRegisterQuery
  ): Promise<AcademicRegister> {
    if (!query.classroomId) {
      throw new BadRequestError('Classroom ID is required for classroom register');
    }

    await assertCanAccessClassroom(actor, query.classroomId);

    const classroom = await prisma.classroom.findUnique({
      where: { classroomId: query.classroomId },
    });

    if (!classroom) throw new NotFoundError('Classroom');

    // Check if classroom is finalized for this period
    const classroomFinalization = await prisma.classroomFinalization.findUnique({
      where: {
        classroomId_semester_academicYear: {
          classroomId: query.classroomId,
          semester: query.semester,
          academicYear: query.academicYear,
        },
      },
    });

    const isFinalized = classroomFinalization?.status === 'FINALIZED';

    // Get all finalized subjects for this classroom
    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classroomId: query.classroomId },
      include: { subject: true },
    });

    const subjectFinalizations = await prisma.subjectFinalization.findMany({
      where: {
        teacherSubjectId: { in: teacherSubjects.map((ts) => ts.id) },
        semester: query.semester,
        academicYear: query.academicYear,
        status: 'FINALIZED',
      },
    });

    const finalizedSubjectIds = new Set(subjectFinalizations.map((sf) => sf.teacherSubjectId));

    // Get students in this classroom
    const students = await prisma.student.findMany({
      where: { classroomId: query.classroomId },
      orderBy: { lastName: 'asc' },
    });

    // Get academic settings
    const settings = await getSystemSettings();

    // Process each student
    const registerStudents: AcademicRegisterStudent[] = [];
    const eligibleStudents: { studentId: number; average: number }[] = [];
    let incompleteCount = 0;

    for (const student of students) {
      const age = calculateAge(student.dateOfBirth);

      // Get subject results for this student
      const subjectResults: SubjectResult[] = [];
      let totalObtained = 0;
      let totalPossible = 0;
      let hasIncompleteSubject = false;

      for (const ts of teacherSubjects) {
        const isFinalized = finalizedSubjectIds.has(ts.id);

        // Get final result for this subject
        const gradeComponents = await prisma.gradeComponent.findMany({
          where: {
            teacherSubjectId: ts.id,
            semester: query.semester,
            academicYear: query.academicYear,
          },
          include: {
            entries: {
              where: { studentId: student.studentId },
            },
          },
        });

        if (gradeComponents.length === 0) {
          hasIncompleteSubject = true;
          subjectResults.push({
            subjectId: ts.subject.subjectId,
            subjectName: ts.subject.subjectName,
            finalResult: null,
            isComplete: false,
          });
          continue;
        }

        const totalMaxMarks = gradeComponents.reduce((sum, gc) => sum + Number(gc.maxMarks), 0);
        const totalScore = gradeComponents.reduce((sum, gc) => {
          const entry = gc.entries.find((e) => e.studentId === student.studentId);
          return sum + (entry ? Number(entry.score) : 0);
        }, 0);

        // Calculate final result as percentage (normalized to /100)
        const finalResult = totalMaxMarks > 0 ? Math.round((totalScore / totalMaxMarks) * 10000) / 100 : null;

        if (finalResult === null || !isFinalized) {
          hasIncompleteSubject = true;
        }

        if (finalResult !== null) {
          totalObtained += finalResult;
          totalPossible += 100;
        }

        subjectResults.push({
          subjectId: ts.subject.subjectId,
          subjectName: ts.subject.subjectName,
          finalResult,
          isComplete: finalResult !== null && isFinalized,
        });
      }

      // Get conduct rating
      const conduct = await prisma.studentConduct.findUnique({
        where: {
          studentId_classroomId_academicYear_semester: {
            studentId: student.studentId,
            classroomId: query.classroomId,
            academicYear: query.academicYear,
            semester: query.semester,
          },
        },
      });

      // Determine academic status
      let academicStatus: AcademicStatus;
      let average: number | null = null;

      if (hasIncompleteSubject || !isFinalized) {
        academicStatus = isFinalized ? AcademicStatus.INCOMPLETE : AcademicStatus.PENDING;
      } else {
        // Calculate average
        average = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) / 100 : null;

        // Check pass/fail criteria
        const passesAverage = average !== null && average >= settings.promotionPassMark;
        const passesAllSubjects = subjectResults.every(
          (sr) => sr.finalResult === null || sr.finalResult >= settings.minimumSubjectPassMark
        );

        academicStatus = passesAverage && passesAllSubjects ? AcademicStatus.PASS : AcademicStatus.FAIL;
      }

      if (hasIncompleteSubject) {
        incompleteCount++;
      } else if (average !== null) {
        eligibleStudents.push({ studentId: student.studentId, average });
      }

      registerStudents.push({
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        age,
        subjectResults,
        totalObtained: totalPossible > 0 ? totalObtained : null,
        totalPossible: totalPossible > 0 ? totalPossible : null,
        average,
        sectionRank: null, // Will be calculated below
        gradeRank: null,   // Will be calculated below
        conduct: conduct?.rating ?? null,
        academicStatus,
      });
    }

    // Calculate section rankings
    const sectionRanks = computeCompetitionRanks(eligibleStudents);
    for (const student of registerStudents) {
      if (student.academicStatus === AcademicStatus.PASS || student.academicStatus === AcademicStatus.FAIL) {
        student.sectionRank = sectionRanks.get(student.studentId) ?? null;
      }
    }

    // Calculate grade rankings (need all students in same grade)
    const grade = extractGrade(classroom.className);
    const allClassroomsInGrade = await prisma.classroom.findMany({
      where: {
        className: { contains: grade },
        academicYear: query.academicYear,
      },
    });

    const allClassroomIds = allClassroomsInGrade.map((c) => c.classroomId);
    const allStudentsInGrade = await prisma.student.findMany({
      where: { classroomId: { in: allClassroomIds } },
    });

    // Get all eligible students in grade for grade ranking
    const gradeEligibleStudents: { studentId: number; average: number }[] = [];

    for (const classroom of allClassroomsInGrade) {
      const classTeacherSubjects = await prisma.teacherSubject.findMany({
        where: { classroomId: classroom.classroomId },
      });

      const classSubjectFinalizations = await prisma.subjectFinalization.findMany({
        where: {
          teacherSubjectId: { in: classTeacherSubjects.map((ts) => ts.id) },
          semester: query.semester,
          academicYear: query.academicYear,
          status: 'FINALIZED',
        },
      });

      const finalizedSubjectIds = new Set(classSubjectFinalizations.map((sf) => sf.teacherSubjectId));

      for (const student of allStudentsInGrade.filter((s) => s.classroomId === classroom.classroomId)) {
        let totalObtained = 0;
        let totalPossible = 0;
        let hasIncomplete = false;

        for (const ts of classTeacherSubjects) {
          if (!finalizedSubjectIds.has(ts.id)) {
            hasIncomplete = true;
            continue;
          }

          const gradeComponents = await prisma.gradeComponent.findMany({
            where: {
              teacherSubjectId: ts.id,
              semester: query.semester,
              academicYear: query.academicYear,
            },
            include: {
              entries: {
                where: { studentId: student.studentId },
              },
            },
          });

          if (gradeComponents.length === 0) {
            hasIncomplete = true;
            continue;
          }

          const totalMaxMarks = gradeComponents.reduce((sum, gc) => sum + Number(gc.maxMarks), 0);
          const totalScore = gradeComponents.reduce((sum, gc) => {
            const entry = gc.entries.find((e) => e.studentId === student.studentId);
            return sum + (entry ? Number(entry.score) : 0);
          }, 0);

          const finalResult = totalMaxMarks > 0 ? Math.round((totalScore / totalMaxMarks) * 10000) / 100 : null;

          if (finalResult !== null) {
            totalObtained += finalResult;
            totalPossible += 100;
          } else {
            hasIncomplete = true;
          }
        }

        if (!hasIncomplete && totalPossible > 0) {
          const average = Math.round((totalObtained / totalPossible) * 100) / 100;
          gradeEligibleStudents.push({ studentId: student.studentId, average });
        }
      }
    }

    const gradeRanks = computeCompetitionRanks(gradeEligibleStudents);
    for (const student of registerStudents) {
      if (student.academicStatus === AcademicStatus.PASS || student.academicStatus === AcademicStatus.FAIL) {
        student.gradeRank = gradeRanks.get(student.studentId) ?? null;
      }
    }

    const metadata: AcademicRegisterMetadata = {
      classroomId: classroom.classroomId,
      classroomLabel: `${classroom.className} ${classroom.section}`,
      academicYear: query.academicYear,
      semester: query.semester,
      grade,
      section: classroom.section,
      totalStudents: students.length,
      eligibleStudents: eligibleStudents.length,
      incompleteStudents: incompleteCount,
      finalizedAt: classroomFinalization?.finalizedAt?.toISOString() ?? null,
      generatedAt: new Date().toISOString(),
    };

    return {
      metadata,
      students: registerStudents,
    };
  }

  /**
   * Generate grade-wide summary across all sections in a grade.
   */
  async generateGradeSummary(
    actor: AuthenticatedUser,
    grade: string,
    academicYear: string,
    semester: Semester
  ): Promise<AcademicRegisterSummary> {
    await assertCanAccessGrade(actor, grade, academicYear);

    const classrooms = await prisma.classroom.findMany({
      where: {
        className: { contains: grade },
        academicYear,
      },
    });

    if (classrooms.length === 0) {
      throw new NotFoundError(`No classrooms found for grade ${grade} in ${academicYear}`);
    }

    const sections = [];

    let totalStudents = 0;
    let totalAverageSum = 0;
    let totalPassCount = 0;

    for (const classroom of classrooms) {
      const students = await prisma.student.findMany({
        where: { classroomId: classroom.classroomId },
      });

      totalStudents += students.length;

      // Calculate section average and pass rate
      let sectionAverageSum = 0;
      let sectionPassCount = 0;
      let eligibleCount = 0;

      for (const student of students) {
        // Get similar calculations as in classroom register
        const teacherSubjects = await prisma.teacherSubject.findMany({
          where: { classroomId: classroom.classroomId },
        });

        const subjectFinalizations = await prisma.subjectFinalization.findMany({
          where: {
            teacherSubjectId: { in: teacherSubjects.map((ts) => ts.id) },
            semester,
            academicYear,
            status: 'FINALIZED',
          },
        });

        const finalizedSubjectIds = new Set(subjectFinalizations.map((sf) => sf.teacherSubjectId));

        let totalObtained = 0;
        let totalPossible = 0;
        let hasIncomplete = false;

        for (const ts of teacherSubjects) {
          if (!finalizedSubjectIds.has(ts.id)) {
            hasIncomplete = true;
            continue;
          }

          const gradeComponents = await prisma.gradeComponent.findMany({
            where: {
              teacherSubjectId: ts.id,
              semester,
              academicYear,
            },
            include: {
              entries: {
                where: { studentId: student.studentId },
              },
            },
          });

          if (gradeComponents.length === 0) {
            hasIncomplete = true;
            continue;
          }

          const totalMaxMarks = gradeComponents.reduce((sum, gc) => sum + Number(gc.maxMarks), 0);
          const totalScore = gradeComponents.reduce((sum, gc) => {
            const entry = gc.entries.find((e) => e.studentId === student.studentId);
            return sum + (entry ? Number(entry.score) : 0);
          }, 0);

          const finalResult = totalMaxMarks > 0 ? Math.round((totalScore / totalMaxMarks) * 10000) / 100 : null;

          if (finalResult !== null) {
            totalObtained += finalResult;
            totalPossible += 100;
          } else {
            hasIncomplete = true;
          }
        }

        if (!hasIncomplete && totalPossible > 0) {
          const average = Math.round((totalObtained / totalPossible) * 100) / 100;
          const settings = await getSystemSettings();
          const passesAverage = average >= settings.promotionPassMark;
          const passesAllSubjects = true; // Simplified for summary

          sectionAverageSum += average;
          if (passesAverage && passesAllSubjects) {
            sectionPassCount++;
          }
          eligibleCount++;
        }
      }

      const sectionAverage = eligibleCount > 0 ? sectionAverageSum / eligibleCount : 0;
      const passRate = eligibleCount > 0 ? (sectionPassCount / eligibleCount) * 100 : 0;

      totalAverageSum += sectionAverage;
      totalPassCount += sectionPassCount;

      sections.push({
        section: classroom.section,
        classroomId: classroom.classroomId,
        studentCount: students.length,
        averageScore: Math.round(sectionAverage * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
      });
    }

    const overallAverage = sections.length > 0 ? totalAverageSum / sections.length : 0;
    const overallPassRate = totalStudents > 0 ? (totalPassCount / totalStudents) * 100 : 0;

    return {
      grade,
      academicYear,
      semester,
      totalSections: sections.length,
      totalStudents,
      averageGradeAverage: Math.round(overallAverage * 100) / 100,
      passRate: Math.round(overallPassRate * 100) / 100,
      sections,
    };
  }

  /**
   * Generate academic register for historical academic year.
   * Uses historical enrollment and subject configuration.
   */
  async generateHistoricalRegister(
    actor: AuthenticatedUser,
    studentId: number,
    academicYear: string,
    semester: Semester
  ): Promise<AcademicRegister> {
    // Verify user can access this student's records
    if (actor.role === RoleName.STUDENT) {
      const student = await prisma.student.findUnique({
        where: { studentId },
      });
      if (!student || student.userId !== actor.userId) {
        throw new ForbiddenError('You can only view your own academic records');
      }
    }

    // Get historical enrollment
    const enrollment = await getStudentEnrollmentForYear(studentId, academicYear);

    if (!enrollment) {
      throw new NotFoundError(`No enrollment found for student in ${academicYear}`);
    }

    // Generate register using historical classroom
    const query: AcademicRegisterQuery = {
      classroomId: enrollment.classroomId,
      academicYear,
      semester,
    };

    return this.generateClassroomRegister(actor, query);
  }
}

export const academicRegisterService = new AcademicRegisterService();