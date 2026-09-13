import PDFDocument from 'pdfkit';
import type { SubjectGradeBreakdownDto } from '../../modules/grades/dto/grade.dto';

export interface ReportCardPdfData {
  schoolName:    string;
  schoolZone:    string | null;
  schoolWereda:  string | null;
  schoolRegion:  string | null;
  schoolLogo:    string | null;
  studentName:   string;
  admissionNumber: string;
  classroomLabel:  string;
  semester:      string;
  academicYear:  string;
  averageMark:   number;
  rank:          number | null;
  subjects:      SubjectGradeBreakdownDto[];
}

/** Renders a one-page A4 portrait report card as a PDF and resolves with the finished buffer. */
export function buildReportCardPdf(data: ReportCardPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W        = 595.28;
    const MARGIN   = 40;
    const CONTENT  = W - MARGIN * 2;
    const HDR_H    = 110;
    const BLUE_D   = '#0d47a1';
    const BLUE_M   = '#1565c0';
    const BLUE_L   = '#dce8f8';
    const BLUE_BG  = '#f0f6ff';

    // ── Header gradient ───────────────────────────────────────────────────────
    doc.rect(0, 0, W, HDR_H).fill(BLUE_M);

    // School name & bureau
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13)
       .text('OROMIA EDUCATION BUREAU', MARGIN, 16, { width: CONTENT, align: 'center' });

    const metaLine = [
      data.schoolRegion  ? `REGION: ${data.schoolRegion}`  : null,
      data.schoolZone    ? `ZONE: ${data.schoolZone}`       : null,
      data.schoolWereda  ? `WEREDA: ${data.schoolWereda}`   : null,
    ].filter(Boolean).join('   |   ');
    if (metaLine) {
      doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.9)')
         .text(metaLine, MARGIN, 33, { width: CONTENT, align: 'center' });
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#fff')
       .text(data.schoolName.toUpperCase(), MARGIN, 47, { width: CONTENT, align: 'center' });

    // STUDENT REPORT CARD pill
    const pillW = 200, pillH = 22, pillX = (W - pillW) / 2, pillY = 66;
    doc.roundedRect(pillX, pillY, pillW, pillH, 3)
       .fillOpacity(0.3).fill('#000').fillOpacity(1);
    doc.rect(pillX, pillY, pillW, pillH).strokeOpacity(0.6).stroke('#fff').strokeOpacity(1);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#fff')
       .text('STUDENT REPORT CARD', pillX, pillY + 6, { width: pillW, align: 'center' });

    // Period badge (top-right of header)
    const semLabel = data.semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2';
    doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.85)')
       .text(`${semLabel} · ${data.academicYear}`, W - MARGIN - 130, 8, { width: 130, align: 'right' });

    // ── Student info box ──────────────────────────────────────────────────────
    const INFO_Y = HDR_H + 10;
    const INFO_H = 54;
    doc.rect(MARGIN, INFO_Y, CONTENT, INFO_H).fill(BLUE_BG);
    doc.rect(MARGIN, INFO_Y, CONTENT, INFO_H).strokeOpacity(0.6).stroke(BLUE_L).strokeOpacity(1);

    const col1 = MARGIN + 10;
    const col2 = MARGIN + CONTENT / 2 + 10;
    const lbl = (text: string, x: number, y: number) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE_D).text(text, x, y);
    };
    const val = (text: string, x: number, y: number, w: number) => {
      doc.font('Helvetica').fontSize(9).fillColor('#111').text(text, x, y, { width: w, ellipsis: true });
    };

    lbl('Student Name',      col1, INFO_Y + 8);
    val(data.studentName,    col1 + 85, INFO_Y + 8, 175);
    lbl('Admission No.',     col2, INFO_Y + 8);
    val(data.admissionNumber, col2 + 75, INFO_Y + 8, 150);

    lbl('Classroom',         col1, INFO_Y + 26);
    val(data.classroomLabel, col1 + 85, INFO_Y + 26, 175);
    lbl('Academic Period',   col2, INFO_Y + 26);
    val(`${semLabel}, ${data.academicYear}`, col2 + 75, INFO_Y + 26, 150);

    // ── Section label ─────────────────────────────────────────────────────────
    const SEC_Y = INFO_Y + INFO_H + 12;
    doc.rect(MARGIN, SEC_Y, CONTENT, 18).fill(BLUE_M);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff')
       .text('SUBJECT RESULTS', MARGIN + 8, SEC_Y + 5);

    // ── Table header ──────────────────────────────────────────────────────────
    const TH_Y  = SEC_Y + 18;
    const TH_H  = 18;
    const COL   = { subject: MARGIN, score: MARGIN + CONTENT - 150, max: MARGIN + CONTENT - 100, pct: MARGIN + CONTENT - 48 };
    doc.rect(MARGIN, TH_Y, CONTENT, TH_H).fill(BLUE_L);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE_D)
       .text('#',         MARGIN + 6,      TH_Y + 5)
       .text('Subject',   MARGIN + 24,     TH_Y + 5)
       .text('Score',     COL.score,       TH_Y + 5, { width: 48, align: 'right' })
       .text('Max',       COL.max,         TH_Y + 5, { width: 48, align: 'right' })
       .text('%',         COL.pct,         TH_Y + 5, { width: 40, align: 'right' });

    // ── Table rows ────────────────────────────────────────────────────────────
    let rowY = TH_Y + TH_H;
    const ROW_H = 18;

    data.subjects.forEach((subject, idx) => {
      const pct = subject.totalMaxMarks > 0
        ? Math.round((subject.totalScore / subject.totalMaxMarks) * 1000) / 10
        : 0;
      const isAlt = idx % 2 === 1;
      if (isAlt) doc.rect(MARGIN, rowY, CONTENT, ROW_H).fill('#f5f8ff');

      doc.font('Helvetica').fontSize(8).fillColor('#777')
         .text(String(idx + 1), MARGIN + 6, rowY + 5);
      doc.font('Helvetica').fontSize(8.5).fillColor('#111')
         .text(subject.subject.subjectName, MARGIN + 24, rowY + 5, { width: COL.score - MARGIN - 30, ellipsis: true });
      doc.font('Helvetica').fontSize(8.5).fillColor('#111')
         .text(subject.totalScore.toFixed(1),    COL.score, rowY + 5, { width: 48, align: 'right' })
         .text(subject.totalMaxMarks.toString(),  COL.max,   rowY + 5, { width: 48, align: 'right' });

      // Colour-code percentage
      const pctColor = pct >= 50 ? '#0a5c2e' : '#8b0000';
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(pctColor)
         .text(`${pct.toFixed(1)}%`, COL.pct, rowY + 5, { width: 40, align: 'right' });

      // Row bottom border
      doc.moveTo(MARGIN, rowY + ROW_H).lineTo(MARGIN + CONTENT, rowY + ROW_H)
         .strokeOpacity(0.3).stroke(BLUE_D).strokeOpacity(1);

      rowY += ROW_H;
    });

    if (data.subjects.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#888')
         .text('No subject results available for this period.', MARGIN + 10, rowY + 6);
      rowY += ROW_H;
    }

    // ── Summary footer ────────────────────────────────────────────────────────
    const SUM_Y = rowY + 10;
    doc.rect(MARGIN, SUM_Y, CONTENT, 46).fill(BLUE_BG);
    doc.rect(MARGIN, SUM_Y, CONTENT, 46).strokeOpacity(0.6).stroke(BLUE_L).strokeOpacity(1);

    // Average
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE_D)
       .text('OVERALL AVERAGE', MARGIN + 10, SUM_Y + 8);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE_D)
       .text(`${data.averageMark.toFixed(1)}%`, MARGIN + 10, SUM_Y + 18);

    // Rank
    if (data.rank !== null) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE_D)
         .text('CLASS RANK', MARGIN + 130, SUM_Y + 8);
      doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE_D)
         .text(`#${data.rank}`, MARGIN + 130, SUM_Y + 18);
    }

    // Result badge
    const pass     = data.averageMark >= 50;
    const badgeClr = pass ? '#0a5c2e' : '#8b0000';
    const badgeBg  = pass ? '#e8f5e9' : '#ffebee';
    const badgeX   = MARGIN + CONTENT - 90;
    doc.rect(badgeX, SUM_Y + 10, 80, 26).fill(badgeBg);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(badgeClr)
       .text(pass ? 'PASS' : 'FAIL', badgeX, SUM_Y + 17, { width: 80, align: 'center' });

    // ── Signature lines ───────────────────────────────────────────────────────
    const SIG_Y = SUM_Y + 66;
    doc.rect(MARGIN, SIG_Y, CONTENT, 56).fill(BLUE_BG);
    doc.rect(MARGIN, SIG_Y, CONTENT, 56).strokeOpacity(0.6).stroke(BLUE_L).strokeOpacity(1);

    const sigCols = [MARGIN + 20, MARGIN + CONTENT / 2 + 20];
    const sigLabels = ["Class Teacher's Name", "Director's Name"];
    sigCols.forEach((sx, i) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE_D)
         .text(sigLabels[i], sx, SIG_Y + 8, { width: 180 });
      // Signature line
      doc.moveTo(sx, SIG_Y + 32).lineTo(sx + 170, SIG_Y + 32)
         .strokeOpacity(0.5).stroke('#666').strokeOpacity(1);
      doc.font('Helvetica').fontSize(7).fillColor('#888')
         .text('Signature', sx, SIG_Y + 34, { width: 170 });
      // Date line
      doc.moveTo(sx, SIG_Y + 48).lineTo(sx + 170, SIG_Y + 48)
         .strokeOpacity(0.5).stroke('#666').strokeOpacity(1);
      doc.font('Helvetica').fontSize(7).fillColor('#888')
         .text('Date', sx, SIG_Y + 50, { width: 170 });
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(7).fillColor('#aaa')
       .text(
         `Generated on ${new Date().toLocaleDateString('en-GB')} · ${data.schoolName}`,
         MARGIN, 800, { width: CONTENT, align: 'center' }
       );

    doc.end();
  });
}
