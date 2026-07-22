import { Prisma, Semester } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { NotFoundError } from '../../core/errors/app-error';
import { assertCanAccessStudentRecords } from '../../core/authorization/student-access';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { GenerateClassroomReportsInput } from './validation/academic-report.validation';
import { AcademicReportDto } from './dto/academic-report.dto';

type ReportWithStudent = Prisma.AcademicReportGetPayload<{ include: { student: true } }>;

function toAcademicReportDto(report: ReportWithStudent): AcademicReportDto {
  return {
    reportId: report.reportId,
    studentId: report.studentId,
    studentName: `${report.student.firstName} ${report.student.lastName}`,
    semester: report.semester,
    academicYear: report.academicYear,
    averageMark: Number(report.averageMark),
    rank: report.rank,
    generatedDate: report.generatedDate.toISOString(),
  };
}

export class AcademicReportService {
  /**
   * Regenerates the average mark and class rank for every student in a
   * classroom for a given semester/academic year. Students with no grade
   * records for that period are skipped (nothing meaningful to average) and
   * reported back separately so the caller knows grading isn't complete.
   *
   * Uses standard competition ranking (1, 2, 2, 4 — ties share a rank and
   * the next rank accounts for the tie).
   */
  async generateClassroomReports(
    input: GenerateClassroomReportsInput
  ): Promise<{ generated: AcademicReportDto[]; skippedStudentIds: number[] }> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId: input.classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const students = await prisma.student.findMany({ where: { classroomId: input.classroomId } });

    const averages: { studentId: number; average: number }[] = [];
    const skippedStudentIds: number[] = [];

    for (const student of students) {
      const grades = await prisma.grade.findMany({
        where: { studentId: student.studentId, semester: input.semester, academicYear: input.academicYear },
        select: { score: true },
      });

      if (grades.length === 0) {
        skippedStudentIds.push(student.studentId);
        continue;
      }

      const total = grades.reduce((sum, g) => sum + Number(g.score), 0);
      averages.push({ studentId: student.studentId, average: Math.round((total / grades.length) * 100) / 100 });
    }

    // Standard competition ranking: sort descending, ties share a rank,
    // the next distinct value's rank equals its 1-based position overall.
    const sorted = [...averages].sort((a, b) => b.average - a.average);
    const rankByStudentId = new Map<number, number>();
    sorted.forEach((entry, index) => {
      if (index > 0 && sorted[index - 1].average === entry.average) {
        rankByStudentId.set(entry.studentId, rankByStudentId.get(sorted[index - 1].studentId)!);
      } else {
        rankByStudentId.set(entry.studentId, index + 1);
      }
    });

    const upserted = await prisma.$transaction(
      averages.map((entry) =>
        prisma.academicReport.upsert({
          where: {
            studentId_semester_academicYear: {
              studentId: entry.studentId,
              semester: input.semester,
              academicYear: input.academicYear,
            },
          },
          create: {
            studentId: entry.studentId,
            semester: input.semester,
            academicYear: input.academicYear,
            averageMark: entry.average,
            rank: rankByStudentId.get(entry.studentId),
          },
          update: {
            averageMark: entry.average,
            rank: rankByStudentId.get(entry.studentId),
            generatedDate: new Date(),
          },
          include: { student: true },
        })
      )
    );

    const generated = upserted
      .map(toAcademicReportDto)
      .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));

    return { generated, skippedStudentIds };
  }

  async getStudentReport(
    actor: AuthenticatedUser,
    studentId: number,
    semester: Semester,
    academicYear: string
  ): Promise<AcademicReportDto> {
    await assertCanAccessStudentRecords(actor, studentId);

    const report = await prisma.academicReport.findUnique({
      where: { studentId_semester_academicYear: { studentId, semester, academicYear } },
      include: { student: true },
    });

    if (!report) {
      throw new NotFoundError('Academic report for this student/semester/year (it may not have been generated yet)');
    }

    return toAcademicReportDto(report);
  }

  async listStudentReports(actor: AuthenticatedUser, studentId: number): Promise<AcademicReportDto[]> {
    await assertCanAccessStudentRecords(actor, studentId);

    const reports = await prisma.academicReport.findMany({
      where: { studentId },
      include: { student: true },
      orderBy: [{ academicYear: 'desc' }, { semester: 'asc' }],
    });

    return reports.map(toAcademicReportDto);
  }
}

export const academicReportService = new AcademicReportService();
