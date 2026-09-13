import type { SubjectGradeBreakdown } from '../types/grade';

const SEM: Record<string, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

const CAT: Record<string, string> = {
  QUIZ: 'Quiz', ASSIGNMENT: 'Assignment', TEST: 'Test',
  MID_EXAM: 'Mid Exam', FINAL_EXAM: 'Final Exam', OTHER: 'Other',
};

const CAT_COLOR: Record<string, string> = {
  QUIZ:       '#0284c7',
  ASSIGNMENT: '#7c3aed',
  TEST:       '#d97706',
  MID_EXAM:   '#ea580c',
  FINAL_EXAM: '#166534',
  OTHER:      '#64748b',
};

export interface ReportCardHtmlParams {
  schoolName:      string;
  schoolZone:      string | null;
  schoolWereda:    string | null;
  schoolRegion:    string | null;
  schoolLogo:      string | null;
  studentName:     string;
  admissionNumber: string;
  classroomLabel:  string;
  semester:        string;
  academicYear:    string;
  averageMark:     number;
  rank:            number | null;
  subjects:        SubjectGradeBreakdown[];
  isNonOfficial:   boolean;
}

export function buildReportCardHtml(p: ReportCardHtmlParams): string {
  const semLabel = SEM[p.semester] ?? p.semester;
  const pass     = p.averageMark >= 50;

  const ref = p.isNonOfficial
    ? `DSS-RC-${new Date().getFullYear()}-${p.admissionNumber.replace(/\D/g,'').slice(-4)}${String(Date.now()).slice(-5)}`
    : null;

  const metaLine = [
    p.schoolRegion  ? `REGION: ${p.schoolRegion}`  : null,
    p.schoolZone    ? `ZONE: ${p.schoolZone}`       : null,
    p.schoolWereda  ? `WEREDA: ${p.schoolWereda}`   : null,
  ].filter(Boolean).join('   |   ');

  const logoHtml = p.schoolLogo
    ? `<img src="${p.schoolLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;padding:4px;">`
    : `<span style="font-size:6pt;font-weight:800;color:rgba(255,255,255,0.8);text-align:center;line-height:1.4;">School<br>Logo</span>`;

  const subjectRows = p.subjects.map((s, i) => {
    const pct = s.totalMaxMarks > 0
      ? Math.round((s.totalScore / s.totalMaxMarks) * 1000) / 10
      : 0;
    const pctColor = pct >= 50 ? '#0a5c2e' : '#8b0000';
    const compRows = s.components.map((c) => {
      const cPct = c.isReleased && c.score !== null && c.maxMarks > 0
        ? (Math.round((c.score / c.maxMarks) * 1000) / 10).toFixed(1) + '%'
        : '—';
      const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CAT_COLOR[c.category] ?? '#888'};margin-right:4px;vertical-align:middle;"></span>`;
      return `<tr style="border-top:1px solid #e2e8f0;background:${i%2===0?'#f8faff':'#fff'};">
        <td style="padding:3px 6px 3px 20px;font-size:6.5pt;color:#555;">${dot}${c.name} <span style="color:#aaa;font-size:6pt;">(${CAT[c.category]??c.category})</span></td>
        <td style="padding:3px 6px;text-align:right;font-size:6.5pt;color:#555;font-family:monospace;">${c.isReleased && c.score !== null ? c.score : '—'}</td>
        <td style="padding:3px 6px;text-align:right;font-size:6.5pt;color:#888;font-family:monospace;">${c.maxMarks}</td>
        <td style="padding:3px 6px;text-align:right;font-size:6.5pt;font-family:monospace;">${cPct}</td>
      </tr>`;
    }).join('');

    return `<tr style="background:${i%2===0?'#f0f6ff':'#fff'};">
      <td style="padding:5px 8px;font-weight:700;font-size:8pt;color:#111;">${s.subject.subjectName}</td>
      <td style="padding:5px 8px;text-align:right;font-family:monospace;font-size:8pt;">${s.totalScore.toFixed(1)}</td>
      <td style="padding:5px 8px;text-align:right;font-family:monospace;font-size:8pt;color:#555;">${s.totalMaxMarks}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:900;font-size:8.5pt;color:${pctColor};">${pct.toFixed(1)}%</td>
    </tr>
    ${compRows}`;
  }).join('');

  const watermarkHtml = p.isNonOfficial ? `
<div style="position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
  font-size:36pt;font-weight:900;color:rgba(180,0,0,0.07);white-space:nowrap;
  pointer-events:none;z-index:9999;letter-spacing:2px;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;">
  NOT AN OFFICIAL DOCUMENT
</div>` : '';

  const noticeHtml = p.isNonOfficial && ref ? `
<div style="border:1.5px solid #c0392b;background:#fff5f5;margin-top:6px;padding:4px 10px;
  display:flex;justify-content:space-between;align-items:center;gap:8px;">
  <span style="background:#c0392b;color:#fff;font-size:6.5pt;font-weight:900;padding:2px 8px;border-radius:2px;white-space:nowrap;">
    NOT AN OFFICIAL DOCUMENT — COPY
  </span>
  <span style="font-size:6pt;color:#7b1a1a;font-style:italic;flex:1;">
    This document was generated from the DSSSMS portal and is not an official report card. Official documents must be issued by Dinsho Secondary School.
  </span>
  <span style="font-size:6pt;color:#7b1a1a;font-weight:700;white-space:nowrap;">Ref: ${ref}</span>
</div>` : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Report Card — ${p.studentName}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Arial,sans-serif;font-size:8pt;color:#111;background:#fff;
  padding:8mm 8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #c8d8f0;padding:4px 8px;font-size:8pt}
@media print{
  body{padding:5mm 6mm;font-size:7.5pt}
  @page{size:A4 portrait;margin:5mm 6mm}
}
</style></head><body>
${watermarkHtml}

<!-- Header -->
<div style="background:linear-gradient(135deg,#0d47a1 0%,#1565c0 40%,#1976d2 100%);
  display:grid;grid-template-columns:90px 1fr;min-height:110px;border-radius:4px 4px 0 0;">
  <div style="display:flex;align-items:center;justify-content:center;padding:10px 8px;">
    <div style="width:70px;height:70px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.9);
      overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);">
      ${logoHtml}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;color:#fff;padding:8px 4px;">
    <div style="font-size:11pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">OROMIA EDUCATION BUREAU</div>
    ${metaLine ? `<div style="font-size:7pt;font-weight:500;margin-top:3px;opacity:0.9;">${metaLine}</div>` : ''}
    <div style="font-size:9.5pt;font-weight:800;margin-top:4px;text-transform:uppercase;">${p.schoolName}</div>
    <div style="background:rgba(0,0,0,0.3);border:1.5px solid rgba(255,255,255,0.6);border-radius:3px;
      margin-top:6px;padding:3px 16px;font-size:9pt;font-weight:900;letter-spacing:2px;text-transform:uppercase;">
      STUDENT REPORT CARD
    </div>
    <div style="font-size:7pt;margin-top:4px;opacity:0.85;">${semLabel} &nbsp;·&nbsp; ${p.academicYear}</div>
  </div>
</div>

<!-- Student info -->
<div style="border:1.5px solid #b8cfe8;background:#f0f6ff;padding:5px 10px;margin:4px 0;
  display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;">
  <div style="display:flex;align-items:baseline;gap:4px;font-size:7.5pt;">
    <span style="font-weight:700;color:#0d3875;white-space:nowrap;min-width:90px;">Student Name</span>
    <span style="border-bottom:1px solid #666;flex:1;font-weight:600;">${p.studentName}</span>
  </div>
  <div style="display:flex;align-items:baseline;gap:4px;font-size:7.5pt;">
    <span style="font-weight:700;color:#0d3875;white-space:nowrap;min-width:90px;">Admission No.</span>
    <span style="border-bottom:1px solid #666;flex:1;font-weight:600;font-family:monospace;">${p.admissionNumber}</span>
  </div>
  <div style="display:flex;align-items:baseline;gap:4px;font-size:7.5pt;">
    <span style="font-weight:700;color:#0d3875;white-space:nowrap;min-width:90px;">Classroom</span>
    <span style="border-bottom:1px solid #666;flex:1;font-weight:600;">${p.classroomLabel}</span>
  </div>
  <div style="display:flex;align-items:baseline;gap:4px;font-size:7.5pt;">
    <span style="font-weight:700;color:#0d3875;white-space:nowrap;min-width:90px;">Period</span>
    <span style="border-bottom:1px solid #666;flex:1;font-weight:600;">${semLabel}, ${p.academicYear}</span>
  </div>
</div>

<!-- Section label -->
<div style="background:#1565c0;color:#fff;font-weight:800;font-size:7.5pt;
  padding:2px 8px;margin-top:5px;text-transform:uppercase;letter-spacing:0.5px;">
  Subject Results
</div>

<!-- Table -->
<table style="margin-top:0;">
  <thead>
    <tr style="background:#1565c0;color:#fff;">
      <th style="text-align:left;padding:5px 8px;font-size:8pt;">Subject</th>
      <th style="text-align:right;padding:5px 8px;font-size:8pt;">Score</th>
      <th style="text-align:right;padding:5px 8px;font-size:8pt;">Max</th>
      <th style="text-align:right;padding:5px 8px;font-size:8pt;">%</th>
    </tr>
  </thead>
  <tbody>
    ${subjectRows || `<tr><td colspan="4" style="text-align:center;font-style:italic;color:#888;padding:8px;">No subject results available for this period.</td></tr>`}
  </tbody>
  <!-- Summary -->
  <tfoot>
    <tr style="background:#dce8f8;border-top:2px solid #1565c0;">
      <td style="padding:6px 8px;font-weight:800;font-size:8.5pt;color:#0d3875;">OVERALL AVERAGE</td>
      <td colspan="2" style="padding:6px 8px;text-align:center;">
        ${p.rank !== null ? `<span style="font-weight:700;font-size:8pt;color:#0d3875;">Rank #${p.rank}</span>` : ''}
      </td>
      <td style="padding:6px 8px;text-align:right;font-weight:900;font-size:12pt;color:${pass?'#0a5c2e':'#8b0000'};">
        ${p.averageMark.toFixed(1)}%
      </td>
    </tr>
    <tr style="background:${pass?'#e8f5e9':'#ffebee'};">
      <td colspan="4" style="padding:5px 8px;text-align:center;font-weight:900;font-size:13pt;
        color:${pass?'#0a5c2e':'#8b0000'};letter-spacing:2px;">
        ${pass ? 'PASS' : 'FAIL'}
      </td>
    </tr>
  </tfoot>
</table>

<!-- Signatures -->
<div style="border:1.5px solid #b8cfe8;background:#f0f6ff;margin-top:8px;padding:5px 10px;
  display:grid;grid-template-columns:1fr 1fr;gap:4px 30px;">
  <div>
    <div style="font-weight:700;font-size:7.5pt;color:#0d3875;margin-bottom:12px;">Class Teacher's Name</div>
    <div style="border-top:1.5px solid #666;padding-top:1px;font-size:6.5pt;color:#555;margin-bottom:8px;">Signature</div>
    <div style="border-top:1.5px solid #666;padding-top:1px;font-size:6.5pt;color:#555;">Date</div>
  </div>
  <div>
    <div style="font-weight:700;font-size:7.5pt;color:#0d3875;margin-bottom:12px;">Director's Name</div>
    <div style="border-top:1.5px solid #666;padding-top:1px;font-size:6.5pt;color:#555;margin-bottom:8px;">Signature</div>
    <div style="border-top:1.5px solid #666;padding-top:1px;font-size:6.5pt;color:#555;">Date: ${new Date().toLocaleDateString('en-GB')}</div>
  </div>
</div>

${noticeHtml}

</body></html>`;
}
