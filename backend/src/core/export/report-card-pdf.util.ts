import PDFDocument from 'pdfkit';
import type { SubjectGradeBreakdownDto } from '../../modules/grades/dto/grade.dto';

export interface ReportCardPdfData {
  schoolName: string;
  studentName: string;
  admissionNumber: string;
  classroomLabel: string;
  semester: string;
  academicYear: string;
  averageMark: number;
  rank: number | null;
  subjects: SubjectGradeBreakdownDto[];
}

/** Renders a one-page report card as a PDF and resolves with the finished buffer. */
export function buildReportCardPdf(data: ReportCardPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(data.schoolName, { align: 'center' });
    doc.fontSize(12).fillColor('#555').text('Student Report Card', { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('#000');

    const infoY = doc.y;
    doc.fontSize(10);
    doc.text(`Student: ${data.studentName}`, 50, infoY);
    doc.text(`Admission #: ${data.admissionNumber}`, 300, infoY);
    doc.text(`Classroom: ${data.classroomLabel}`, 50, infoY + 16);
    doc.text(`Period: ${data.semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2'} — ${data.academicYear}`, 300, infoY + 16);
    doc.moveDown(3);

    const tableTop = doc.y;
    const colX = { subject: 50, score: 350, max: 420, pct: 490 };

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Subject', colX.subject, tableTop);
    doc.text('Score', colX.score, tableTop);
    doc.text('Max', colX.max, tableTop);
    doc.text('%', colX.pct, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke();

    let rowY = tableTop + 20;
    doc.font('Helvetica');
    for (const subject of data.subjects) {
      const pct = subject.totalMaxMarks > 0 ? Math.round((subject.totalScore / subject.totalMaxMarks) * 1000) / 10 : 0;
      doc.text(subject.subject.subjectName, colX.subject, rowY);
      doc.text(subject.totalScore.toString(), colX.score, rowY);
      doc.text(subject.totalMaxMarks.toString(), colX.max, rowY);
      doc.text(`${pct}%`, colX.pct, rowY);
      rowY += 18;
    }

    doc.moveTo(50, rowY + 4).lineTo(545, rowY + 4).stroke();
    rowY += 16;

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Overall average: ${data.averageMark}%`, 50, rowY);
    if (data.rank !== null) {
      doc.text(`Class rank: #${data.rank}`, 300, rowY);
    }
    rowY += 20;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Result: ${data.averageMark >= 50 ? 'PASS' : 'FAIL'}`, 50, rowY);

    doc.fontSize(8).fillColor('#888').text(`Generated on ${new Date().toLocaleDateString()}`, 50, 780);

    doc.end();
  });
}
