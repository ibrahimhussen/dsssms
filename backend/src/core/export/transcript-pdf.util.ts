import PDFDocument from 'pdfkit';
import type { TranscriptDto } from '../../modules/academic-reports/dto/academic-report.dto';

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 portrait, points
const CONTENT_BOTTOM = 760;

function semesterLabel(semester: string): string {
  return semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2';
}

function generateStudentCopyRef(admissionNumber: string): string {
  const year = new Date().getFullYear();
  const adm  = admissionNumber.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const tail = String(Date.now()).slice(-5);
  return `DSS-TR-${year}-${adm}${tail}`;
}

/** Renders a full academic transcript — every graded semester, subject-by-subject — as a PDF, paginating as needed. */
export function buildTranscriptPdf(
  schoolName: string,
  transcript: TranscriptDto,
  opts: { isStudentCopy?: boolean } = {}
): Promise<Buffer> {
  const isStudentCopy = opts.isStudentCopy ?? false;
  const copyRef = isStudentCopy ? generateStudentCopyRef(transcript.admissionNumber) : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Helper: draw watermark on current page ──────────────────────────────
    function drawWatermark() {
      if (!isStudentCopy) return;
      doc.save();
      doc.opacity(0.07);
      doc.fontSize(38).font('Helvetica-Bold').fillColor('#8b0000');
      // Centre of A4 portrait: ~297, ~421
      doc.text('NOT AN OFFICIAL TRANSCRIPT', PAGE_MARGIN, 260, {
        width: PAGE_WIDTH - PAGE_MARGIN * 2,
        align: 'center',
        lineBreak: false,
      });
      doc.restore();
      doc.opacity(1);
      doc.fillColor('#000').font('Helvetica').fontSize(10);
    }

    function ensureSpace(nextBlockHeight: number) {
      if (doc.y + nextBlockHeight > CONTENT_BOTTOM) {
        doc.addPage();
        drawWatermark();
      }
    }

    // Draw watermark on first page
    drawWatermark();

    // --- Header ---
    // ── Student-copy banner (shown at top when isStudentCopy) ──────────────
    if (isStudentCopy) {
      doc.save();
      doc.rect(PAGE_MARGIN, doc.y, PAGE_WIDTH - PAGE_MARGIN * 2, 20).fill('#8b0000');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
      doc.text('NOT AN OFFICIAL TRANSCRIPT — STUDENT COPY', PAGE_MARGIN, doc.y - 18, {
        width: PAGE_WIDTH - PAGE_MARGIN * 2,
        align: 'center',
        lineBreak: false,
      });
      doc.restore();
      doc.fillColor('#000').font('Helvetica').fontSize(10);
      doc.y += 6;
    }

    doc.fontSize(18).text(schoolName, { align: 'center' });
    doc.fontSize(12).fillColor('#555').text(
      isStudentCopy ? 'Student Copy — Academic Transcript' : 'Official Academic Transcript',
      { align: 'center' }
    );
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

    // ── Student-copy footer notice ──────────────────────────────────────────
    if (isStudentCopy) {
      doc.save();
      doc.rect(PAGE_MARGIN, 808, PAGE_WIDTH - PAGE_MARGIN * 2, 28).fill('#fff5f5').stroke('#c0392b');
      doc.fillColor('#8b0000').font('Helvetica-Bold').fontSize(7);
      doc.text(`Ref: ${copyRef}   |   STUDENT COPY — NOT OFFICIAL`, PAGE_MARGIN + 4, 811, {
        width: PAGE_WIDTH - PAGE_MARGIN * 2 - 8,
        align: 'left',
        lineBreak: false,
      });
      doc.font('Helvetica').fontSize(6.5).fillColor('#7b1a1a');
      doc.text(
        'This document was generated by the student from the DSSSMS student portal and is not an official transcript. ' +
        'Official transcripts must be issued or verified by Dinsho Secondary School.',
        PAGE_MARGIN + 4, 820,
        { width: PAGE_WIDTH - PAGE_MARGIN * 2 - 8, lineBreak: false }
      );
      doc.restore();
    }

    doc.end();
  });
}
