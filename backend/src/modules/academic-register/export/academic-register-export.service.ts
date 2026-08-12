import { buildExcelWorkbook, ExcelColumn } from '../../../core/export/excel-export.util';
import { AcademicRegister, SubjectResult } from '../dto/academic-register.dto';
import { ConductRating } from '@prisma/client';

export class AcademicRegisterExportService {
  /**
   * Export Academic Register to Excel format
   */
  async exportToExcel(register: AcademicRegister): Promise<Buffer> {
    const columns: ExcelColumn[] = [
      { header: '#', key: 'rowNumber', width: 8 },
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Age', key: 'age', width: 8 },
    ];

    // Add subject columns dynamically
    const subjectColumns = new Map<string, number>();
    let subjectIndex = 0;

    for (const student of register.students) {
      for (const subjectResult of student.subjectResults) {
        if (!subjectColumns.has(subjectResult.subjectName)) {
          subjectColumns.set(subjectResult.subjectName, subjectIndex++);
          columns.push({
            header: subjectResult.subjectName,
            key: `subject_${subjectResult.subjectName}`,
            width: 15,
          });
        }
      }
    }

    // Add calculated columns
    columns.push(
      { header: 'Total Obtained', key: 'totalObtained', width: 15 },
      { header: 'Total Possible', key: 'totalPossible', width: 15 },
      { header: 'Average', key: 'average', width: 12 },
      { header: 'Section Rank', key: 'sectionRank', width: 15 },
      { header: 'Grade Rank', key: 'gradeRank', width: 12 },
      { header: 'Conduct', key: 'conduct', width: 15 },
      { header: 'Academic Status', key: 'academicStatus', width: 18 }
    );

    // Build rows
    const rows = register.students.map((student, index) => {
      const row: Record<string, unknown> = {
        rowNumber: index + 1,
        studentId: student.studentId,
        studentName: student.studentName,
        gender: student.gender,
        age: student.age,
      };

      // Add subject results
      for (const subjectResult of student.subjectResults) {
        const key = `subject_${subjectResult.subjectName}`;
        row[key] = subjectResult.finalResult !== null ? `${subjectResult.finalResult}/100` : '—';
      }

      // Add calculated fields
      row.totalObtained = student.totalObtained !== null ? student.totalObtained : '—';
      row.totalPossible = student.totalPossible !== null ? student.totalPossible : '—';
      row.average = student.average !== null ? `${student.average}/100` : '—';
      row.sectionRank = student.sectionRank !== null ? `${student.sectionRank}/${register.metadata.eligibleStudents}` : '—';
      row.gradeRank = student.gradeRank !== null ? student.gradeRank : '—';
      row.conduct = student.conduct || '—';
      row.academicStatus = student.academicStatus;

      return row;
    });

    // Add metadata row at the top
    const metadataRow: Record<string, unknown> = {
      rowNumber: 'METADATA',
      studentId: `Class: ${register.metadata.classroomLabel}`,
      studentName: `Academic Year: ${register.metadata.academicYear}`,
      gender: `Semester: ${register.metadata.semester}`,
      age: `Generated: ${register.metadata.generatedAt}`,
    };

    const allRows = [metadataRow, ...rows];

    return buildExcelWorkbook({
      sheetName: 'Academic Register',
      columns,
      rows: allRows,
    });
  }

  /**
   * Export Academic Register to CSV format (simplified version)
   */
  async exportToCSV(register: AcademicRegister): Promise<string> {
    const headers = [
      '#',
      'Student ID',
      'Student Name',
      'Gender',
      'Age',
    ];

    // Add subject headers dynamically
    const subjectNames = new Set<string>();
    for (const student of register.students) {
      for (const subjectResult of student.subjectResults) {
        subjectNames.add(subjectResult.subjectName);
      }
    }

    const sortedSubjects = Array.from(subjectNames).sort();
    headers.push(...sortedSubjects);

    // Add calculated field headers
    headers.push(
      'Total Obtained',
      'Total Possible',
      'Average',
      'Section Rank',
      'Grade Rank',
      'Conduct',
      'Academic Status'
    );

    // Build CSV rows
    const rows = register.students.map((student, index) => {
      const row = [
        index + 1,
        student.studentId,
        student.studentName,
        student.gender,
        student.age,
      ];

      // Add subject results
      for (const subjectName of sortedSubjects) {
        const subjectResult = student.subjectResults.find(
          (sr) => sr.subjectName === subjectName
        );
        row.push(subjectResult && subjectResult.finalResult !== null ? `${subjectResult.finalResult}/100` : '—');
      }

      // Add calculated fields
      row.push(
        student.totalObtained !== null ? student.totalObtained : '—',
        student.totalPossible !== null ? student.totalPossible : '—',
        student.average !== null ? `${student.average}/100` : '—',
        student.sectionRank !== null ? `${student.sectionRank}/${register.metadata.eligibleStudents}` : '—',
        student.gradeRank !== null ? student.gradeRank : '—',
        student.conduct || '—',
        student.academicStatus
      );

      return row.join(',');
    });

    // Add metadata as first row
    const metadataRow = [
      'METADATA',
      `Class: ${register.metadata.classroomLabel}`,
      `Academic Year: ${register.metadata.academicYear}`,
      `Semester: ${register.metadata.semester}`,
      `Generated: ${register.metadata.generatedAt}`,
      ...Array(sortedSubjects.length + 7).fill(''), // Fill remaining columns
    ];

    // Combine all rows
    const allRows = [metadataRow.join(','), headers.join(','), ...rows];

    return allRows.join('\n');
  }

  /**
   * Get conduct rating label
   */
  private getConductLabel(rating: ConductRating | null): string {
    if (!rating) return 'Not Assigned';
    return rating.replace(/_/g, ' ');
  }
}

export const academicRegisterExportService = new AcademicRegisterExportService();