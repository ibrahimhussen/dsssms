import PDFDocument from 'pdfkit';
import type { TranscriptDto } from '../../modules/academic-reports/dto/academic-report.dto';

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 portrait, points
const CONTENT_BOTTOM = 760;

function semesterLabel(semester: string): string {
  return semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2';
}

/** Renders a full academic transcript — every graded semester, subject-by-subject — as a PDF, paginating as needed. */
export function buildTranscriptPdf(schoolName: string, transcript: TranscriptDto): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    function ensureSpace(nextBlockHeight: number) {
      if (doc.y + nextBlockHeight > CONTENT_BOTTOM) {
        doc.addPage();
      }
    }

    // --- Header ---
    doc.fontSize(18).text(schoolName, { align: 'center' });
    doc.fontSize(12).fillColor('#555').text('Official Academic Transcript', { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('#000');

    const infoY = doc.y;
    doc.fontSize(10);
    doc.text(`Student: ${transcript.studentName}`, PAGE_MARGIN, infoY);
    doc.text(`Admission #: ${transcript.admissionNumber}`, 320, infoY);
    doc.text(`Gender: ${transcript.gender === 'M' ? 'Male' : 'Female'}`, PAGE_MARGIN, infoY + 16);
    doc.text(`Date of birth: ${new Date(transcript.dateOfBirth).toLocaleDateString()}`, 320, infoY + 16);
    doc.text(`Current classroom: ${transcript.classroomLabel}`, PAGE_MARGIN, infoY + 32);
    doc.text(`Enrolled: ${new Date(transcript.enrolledAt).toLocaleDateString()}`, 320, infoY + 32);
    doc.y = infoY + 54;

    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_WIDTH - PAGE_MARGIN, doc.y).stroke();
    doc.moveDown(1);

    if (transcript.periods.length === 0) {
      doc.fontSize(11).text('No academic reports have been generated for this student yet.');
    }

    // --- One block per graded semester ---
    for (const period of transcript.periods) {
      const blockHeight = 40 + period.subjects.length * 16 + 30;
      ensureSpace(blockHeight);

      doc.fontSize(13).font('Helvetica-Bold');
      doc.text(`${semesterLabel(period.semester)} — ${period.academicYear}`, PAGE_MARGIN, doc.y);
      doc.font('Helvetica').fontSize(10);

      const tableTop = doc.y + 6;
      const colX = { subject: PAGE_MARGIN, score: 320, max: 390, pct: 460 };

      doc.font('Helvetica-Bold');
      doc.text('Subject', colX.subject, tableTop);
      doc.text('Score', colX.score, tableTop);
      doc.text('Max', colX.max, tableTop);
      doc.text('%', colX.pct, tableTop);
      doc.moveTo(PAGE_MARGIN, tableTop + 14).lineTo(PAGE_WIDTH - PAGE_MARGIN, tableTop + 14).stroke();

      let rowY = tableTop + 20;
      doc.font('Helvetica');
      for (const subject of period.subjects) {
        doc.text(subject.subjectName, colX.subject, rowY);
        doc.text(subject.totalScore.toString(), colX.score, rowY);
        doc.text(subject.totalMaxMarks.toString(), colX.max, rowY);
        doc.text(`${subject.percentage}%`, colX.pct, rowY);
        rowY += 16;
      }

      doc.font('Helvetica-Bold');
      doc.text(`Semester average: ${period.periodAverage}%`, PAGE_MARGIN, rowY + 6);
      if (period.rank !== null) {
        doc.text(`Rank: #${period.rank}`, 320, rowY + 6);
      }
      doc.font('Helvetica');
      doc.y = rowY + 28;
    }

    // --- Cumulative summary ---
    if (transcript.cumulativeAverage !== null) {
      ensureSpace(50);
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_WIDTH - PAGE_MARGIN, doc.y).stroke();
      doc.moveDown(0.75);
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Cumulative average across ${transcript.periods.length} semester(s): ${transcript.cumulativeAverage}%`);
      doc.font('Helvetica');
    }

    doc.fontSize(8).fillColor('#888').text(`Generated on ${new Date(transcript.generatedDate).toLocaleDateString()}`, PAGE_MARGIN, 800, {
      lineBreak: false,
    });

    doc.end();
  });
}
