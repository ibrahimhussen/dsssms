import type { TranscriptPeriod } from '../types/academic-report';

// ── helpers ────────────────────────────────────────────────────────────────

export function calcAge(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function avNum(a?: number, b?: number): number | null {
  const vals = [a, b].filter((v): v is number => v !== undefined);
  if (!vals.length) return null;
  return Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) / 10;
}

export function fmt(v: number | null | undefined): string {
  return v == null ? '' : v.toFixed(1);
}

export function gradeNum(className: string): number {
  const m = className.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export function ordinalSup(n: number): string {
  const sfx = [11, 12].includes(n) ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}<sup>${sfx}</sup>`;
}

export function remarkFor(s2?: TranscriptPeriod, s1?: TranscriptPeriod): string {
  const p = s2 ?? s1;
  if (!p) return '';
  if (p.promotionDecision === 'GRADUATED') return 'Graduated';
  if (p.promotionDecision === 'REPEATED') return `Repeated ${p.className}`;
  if (p.promotionDecision === 'PROMOTED') {
    const m = p.className.match(/\d+/);
    return m ? `Promoted to Grade ${Number(m[0]) + 1}` : 'Promoted';
  }
  return '';
}

export function subjectsForGroups(
  groups: { year: string; grade: string; s1?: TranscriptPeriod; s2?: TranscriptPeriod }[]
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const { s1, s2 } of groups) {
    for (const sub of [...(s1?.subjects ?? []), ...(s2?.subjects ?? [])]) {
      if (!seen.has(sub.subjectName)) { seen.add(sub.subjectName); names.push(sub.subjectName); }
    }
  }
  return names;
}

function generateStudentCopyRef(admissionNumber: string): string {
  const year = new Date().getFullYear();
  const adm = admissionNumber.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const tail = String(Date.now()).slice(-5);
  return `DSS-TR-${year}-${adm}${tail}`;
}

// ── params type ────────────────────────────────────────────────────────────

export interface TranscriptPrintParams {
  schoolName:        string;
  schoolZone:        string | null;
  schoolWereda:      string | null;
  schoolRegion:      string | null;
  schoolLogo:        string | null;
  studentName:       string;
  admissionNumber:   string;
  gender:            string;
  dob:               string;
  enrolledAt:        string;
  dateOfLeavingAt:   string | null;
  cumulativeAverage: number | null;
  generatedDate:     string;
  profilePicture:    string | null;
  yearGroups:        { year: string; grade: string; s1?: TranscriptPeriod; s2?: TranscriptPeriod }[];
  allSubjectNames:   string[];
  isStudentCopy:     boolean;
}

// ── main builder ───────────────────────────────────────────────────────────

export function buildPrintForExport(p: TranscriptPrintParams): string {
  const logoHtml = p.schoolLogo
    ? `<img src="${p.schoolLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;padding:4px;">`
    : `<span style="font-size:6pt;font-weight:800;color:rgba(255,255,255,0.8);text-align:center;line-height:1.3;">School<br>Logo</span>`;

  const photoHtml = p.profilePicture
    ? `<div class="photo-inner"><img src="${p.profilePicture}" alt="Photo"></div>`
    : `<div class="photo-inner"><div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:8pt;font-weight:700;color:rgba(255,255,255,0.7);">PHOTO</div></div>`;

  const groups   = p.yearGroups;
  const subjects = p.allSubjectNames;

  const yearRow  = groups.map(({ year }) => `<th colspan="3" class="yr">${year} E.C</th>`).join('');
  const gradeRow = groups.map(({ grade }) => `<th colspan="3" class="gr">${ordinalSup(gradeNum(grade))}</th>`).join('');
  const semRow   = groups.map(() => `<th class="sem">I</th><th class="sem">II</th><th class="sem av">Av</th>`).join('');

  const subjectRows = subjects.map((name, ri) => {
    const cells = groups.map(({ s1, s2 }) => {
      const r1  = s1?.subjects.find((s) => s.subjectName === name);
      const r2  = s2?.subjects.find((s) => s.subjectName === name);
      const v1  = r1 ? fmt(r1.percentage) : '';
      const v2  = r2 ? fmt(r2.percentage) : '';
      const vav = (r1 || r2) ? fmt(avNum(r1?.percentage, r2?.percentage)) : '';
      return `<td class="d">${v1}</td><td class="d">${v2}</td><td class="d av">${vav}</td>`;
    }).join('');
    return `<tr class="${ri % 2 === 1 ? 'alt' : ''}"><td class="no">${ri + 1}</td><td class="subj">${name}</td>${cells}</tr>`;
  }).join('');

  const avgRow = groups.map(({ s1, s2 }) => {
    const a1 = s1?.periodAverage ?? null;
    const a2 = s2?.periodAverage ?? null;
    return `<td class="sum">${fmt(a1)}</td><td class="sum">${fmt(a2)}</td><td class="sum av bold">${fmt(avNum(a1 ?? undefined, a2 ?? undefined))}</td>`;
  }).join('');

  const rankRow = groups.map(({ s1, s2 }) =>
    `<td class="sum">${s1?.rank ?? ''}</td><td class="sum">${s2?.rank ?? ''}</td><td class="sum av">-</td>`
  ).join('');

  const statusRow = groups.map(({ s1, s2 }) => {
    const status = (s2 ?? s1)?.academicStatus ?? '-';
    const col = status === 'PASS' ? '#0a5c2e' : status === 'FAIL' ? '#8b0000' : '#7a5c00';
    return `<td colspan="3" class="sum" style="font-weight:900;color:${col}">${status}</td>`;
  }).join('');

  const remarkRow = groups.map(({ s1, s2 }) =>
    `<td colspan="3" class="sum" style="font-style:italic;font-size:6pt">${remarkFor(s2, s1) || '-'}</td>`
  ).join('');

  const academicTable = subjects.length === 0 ? '' : `
<table>
  <thead>
    <tr><th rowspan="3" class="no-h">#</th><th rowspan="3" class="subj-h">Subject</th>${yearRow}</tr>
    <tr>${gradeRow}</tr>
    <tr>${semRow}</tr>
  </thead>
  <tbody>
    ${subjectRows}
    <tr class="tot-row"><td class="no-h" colspan="2">AVERAGE</td>${avgRow}</tr>
    <tr class="tot-row"><td class="no-h" colspan="2">RANK</td>${rankRow}</tr>
    <tr class="tot-row"><td class="no-h" colspan="2">STATUS</td>${statusRow}</tr>
    <tr class="tot-row"><td class="no-h" colspan="2">REMARK</td>${remarkRow}</tr>
  </tbody>
</table>`;

  const printDate = new Date(p.generatedDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const ref = p.isStudentCopy ? generateStudentCopyRef(p.admissionNumber) : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Student Transcript - ${p.studentName}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Arial,sans-serif;font-size:7.5pt;color:#111;background:#fff;padding:5mm 5mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hdr{background:linear-gradient(135deg,#0d47a1 0%,#1565c0 40%,#1976d2 100%);display:grid;grid-template-columns:110px 1fr 115px;min-height:135px;border-radius:4px 4px 0 0}
.logo-cell{display:flex;align-items:center;justify-content:center;padding:12px 8px}
.logo-circle{width:82px;height:82px;border-radius:50%;border:3px solid rgba(255,255,255,0.9);overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1)}
.center-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;padding:8px 4px}
.bureau{font-size:13pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px}
.zw{font-size:8pt;font-weight:500;margin-top:4px;opacity:0.95}
.sname{font-size:10.5pt;font-weight:800;margin-top:5px;text-transform:uppercase}
.title-pill{background:rgba(0,0,0,0.3);border:1.5px solid rgba(255,255,255,0.6);border-radius:3px;margin-top:7px;padding:4px 18px;font-size:11pt;font-weight:900;letter-spacing:2px;text-transform:uppercase}
.photo-cell{display:flex;align-items:center;justify-content:center;padding:6px;border-left:2px solid rgba(255,255,255,0.35)}
.photo-inner{width:90px;aspect-ratio:4/5;overflow:hidden;border:1.5px solid rgba(255,255,255,0.7);background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center}
.photo-cell img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.info-box{border:1.5px solid #b8cfe8;background:#f0f6ff;padding:5px 10px;margin:4px 0;display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}
.irow{display:flex;align-items:baseline;gap:4px;font-size:7.5pt}
.ilbl{font-weight:700;color:#0d3875;white-space:nowrap;min-width:72px}
.ival{border-bottom:1px solid #666;flex:1;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:0}
th,td{border:1px solid #888;text-align:center;padding:2px 2px;font-size:7pt}
.no-h{background:#1565c0;color:#fff;font-weight:800;width:20px}
.subj-h{background:#1565c0;color:#fff;font-weight:800;text-align:left;padding-left:5px;width:85px}
.yr{background:#1565c0;color:#fff;font-weight:800;font-size:8pt}
.gr{background:#1e5fa0;color:#fff;font-weight:800}
.sem{background:#dce8f8;color:#0d3875;font-weight:700}
.av{background:#c8dcf4;font-weight:700;color:#0d3875}
.no{color:#777;font-size:6.5pt}
.subj{text-align:left;padding-left:5px;font-weight:600;background:#f7f9ff}
.d{color:#111}
.alt td{background:#f5f8ff}
.sum{background:#e8f0fb;font-weight:700}
.bold{font-weight:900}
.tot-row .no-h{background:#0d47a1}
.tot-row td{background:#dce8f8;font-weight:700;border-top:1.5px solid #1565c0}
.tot-row .no-h,.tot-row .subj-h{background:#0d47a1;color:#fff;text-align:left;padding-left:5px}
.footer{border:1.5px solid #b8cfe8;background:#f0f6ff;margin-top:5px;padding:5px 10px;display:grid;grid-template-columns:1fr 1fr;gap:4px 30px}
.flbl{font-weight:700;font-size:7.5pt;color:#0d3875;margin-bottom:10px}
.fline{border-top:1.5px solid #666;padding-top:1px;font-size:6.5pt;color:#555;margin-bottom:6px}
@media print{body{padding:3mm 4mm;font-size:7pt}@page{size:A4 landscape;margin:3mm 4mm}table{font-size:6.5pt}}
body.student-copy::after{content:'NOT AN OFFICIAL TRANSCRIPT';position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:38pt;font-weight:900;color:rgba(180,0,0,0.08);white-space:nowrap;pointer-events:none;z-index:9999;letter-spacing:2px;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.student-notice{border:1.5px solid #c0392b;background:#fff5f5;margin-top:5px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.student-notice-badge{background:#c0392b;color:#fff;font-size:7pt;font-weight:900;padding:2px 8px;border-radius:2px;white-space:nowrap;letter-spacing:0.5px}
.student-notice-text{font-size:6.5pt;color:#7b1a1a;font-style:italic;flex:1}
.student-notice-ref{font-size:6.5pt;color:#7b1a1a;font-weight:700;white-space:nowrap}
</style></head><body${p.isStudentCopy ? ' class="student-copy"' : ''}>
<div class="hdr">
  <div class="logo-cell"><div class="logo-circle">${logoHtml}</div></div>
  <div class="center-cell">
    <div class="bureau">OROMIA EDUCATION BUREAU</div>
    <div class="zw">REGION: ${p.schoolRegion ?? 'OROMIA'}</div>
    <div class="zw">ZONE: ${p.schoolZone ?? 'BAALE'}</div>
    <div class="zw">WEREDA: ${p.schoolWereda ?? 'DINSHO'}</div>
    <div class="sname">${p.schoolName}</div>
    <div class="title-pill">STUDENT TRANSCRIPT</div>
  </div>
  <div class="photo-cell">${photoHtml}</div>
</div>
<div class="info-box">
  <div class="irow"><span class="ilbl">Full Name</span><span class="ival">${p.studentName}</span></div>
  <div class="irow"><span class="ilbl">Date of Leaving</span><span class="ival">${p.dateOfLeavingAt ? fmtDate(p.dateOfLeavingAt) : ''}</span></div>
  <div class="irow"><span class="ilbl">Sex</span><span class="ival">${p.gender}</span></div>
  <div class="irow"><span class="ilbl">File Number</span><span class="ival"></span></div>
  <div class="irow"><span class="ilbl">Age</span><span class="ival">${calcAge(p.dob)}</span></div>
  <div class="irow"><span class="ilbl">Student ID / ADM. NO.</span><span class="ival">${p.admissionNumber}</span></div>
  <div class="irow"><span class="ilbl">Date of Admission</span><span class="ival">${fmtDate(p.enrolledAt)}</span></div>
  <div></div>
</div>
${academicTable}
<div class="footer">
  <div>
    <div class="flbl">Teacher's Name</div>
    <div class="fline">Signature</div>
    <div class="fline">Date</div>
  </div>
  <div>
    <div class="flbl">V/Director's Name</div>
    <div class="fline">Signature</div>
    <div class="fline">Date: ${printDate}</div>
  </div>
</div>
${p.isStudentCopy ? `<div class="student-notice"><div class="student-notice-badge">NOT AN OFFICIAL TRANSCRIPT - STUDENT COPY</div><div class="student-notice-text">This document was generated from the DSSSMS portal and is not an official transcript. Official transcripts must be issued or verified by Dinsho Secondary School.</div><div class="student-notice-ref">Ref: ${ref}</div></div>` : ''}
</body></html>`;
}
