import { Prisma, Semester } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { NotFoundError } from '../../core/errors/app-error';
import { assertCanAccessStudentRecords } from '../../core/authorization/student-access';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { studentService } from '../students/student.service';
import { gradeService } from '../grades/grade.service';
import { GenerateClassroomReportsInput } from './validation/academic-report.validation';
import { AcademicReportDto, TranscriptDto, TranscriptPeriodDto } from './dto/academic-report.dto';

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
   * classroom for a given semester/academic year. For each subject, a
   * student's mark is normalized to a percentage of that subject's grading
   * scheme (sum of entered scores / sum of the scheme's max marks) so a
   * partially-built scheme (e.g. missing the Final Exam component) still
   * averages fairly against subjects with a complete /100 scheme. A subject
   * with no grading scheme defined yet for this semester is skipped for
   * that student. Students with no gradable subjects at all are skipped
   * entirely and reported back separately so the caller knows grading
   * isn't complete.
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
    const teacherSubjects = await prisma.teacherSubject.findMany({ where: { classroomId: input.classroomId } });

    const components = await prisma.gradeComponent.findMany({
      where: {
        teacherSubjectId: { in: teacherSubjects.map((ts) => ts.id) },
        semester: input.semester,
        academicYear: input.academicYear,
      },
      include: { entries: true },
    });

    const componentsByTeacherSubject = new Map<number, typeof components>();
    for (const c of components) {
      const list = componentsByTeacherSubject.get(c.teacherSubjectId) ?? [];
      list.push(c);
      componentsByTeacherSubject.set(c.teacherSubjectId, list);
    }

    const averages: { studentId: number; average: number }[] = [];
    const skippedStudentIds: number[] = [];

    for (const student of students) {
      const subjectPercentages: number[] = [];

      for (const ts of teacherSubjects) {
        const comps = componentsByTeacherSubject.get(ts.id) ?? [];
        const totalMaxMarks = comps.reduce((sum, c) => sum + Number(c.maxMarks), 0);
        if (totalMaxMarks === 0) continue;

        const totalScore = comps.reduce((sum, c) => {
          const entry = c.entries.find((e) => e.studentId === student.studentId);
          return sum + (entry ? Number(entry.score) : 0);
        }, 0);

        subjectPercentages.push((totalScore / totalMaxMarks) * 100);
      }

      if (subjectPercentages.length === 0) {
        skippedStudentIds.push(student.studentId);
        continue;
      }

      const total = subjectPercentages.reduce((sum, v) => sum + v, 0);
      averages.push({ studentId: student.studentId, average: Math.round((total / subjectPercentages.length) * 100) / 100 });
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

  /**
   * The full, cumulative multi-year academic record — every semester the
   * student has a generated report for, each broken down subject-by-subject,
   * plus a cumulative average across all of them. Distinct from a single
   * semester's report card: this is the "whole school career" document.
   */
  async getStudentTranscript(actor: AuthenticatedUser, studentId: number): Promise<TranscriptDto> {
    await assertCanAccessStudentRecords(actor, studentId);

    const [student, reports] = await Promise.all([
      studentService.getStudentById(studentId),
      this.listStudentReports(actor, studentId),
    ]);

    // Chronological order (oldest first) reads naturally as a school career.
    const orderedReports = [...reports].sort(
      (a, b) => a.academicYear.localeCompare(b.academicYear) || a.semester.localeCompare(b.semester)
    );

    const periods: TranscriptPeriodDto[] = [];
    for (const report of orderedReports) {
      const subjectBreakdown = await gradeService.getStudentGrades(actor, studentId, {
        semester: report.semester,
        academicYear: report.academicYear,
      });

      periods.push({
        semester: report.semester,
        academicYear: report.academicYear,
        subjects: subjectBreakdown.map((s) => ({
          subjectName: s.subject.subjectName,
          totalScore: s.totalScore,
          totalMaxMarks: s.totalMaxMarks,
          percentage: s.totalMaxMarks > 0 ? Math.round((s.totalScore / s.totalMaxMarks) * 1000) / 10 : 0,
        })),
        periodAverage: report.averageMark,
        rank: report.rank,
      });
    }

    const cumulativeAverage =
      periods.length === 0
        ? null
        : Math.round((periods.reduce((sum, p) => sum + p.periodAverage, 0) / periods.length) * 10) / 10;

    return {
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth.toISOString(),
      classroomLabel: `${student.classroom.className} ${student.classroom.section}`,
      enrolledAt: student.enrolledAt.toISOString(),
      periods,
      cumulativeAverage,
      generatedDate: new Date().toISOString(),
    };
  }
}

export const academicReportService = new AcademicReportService();
