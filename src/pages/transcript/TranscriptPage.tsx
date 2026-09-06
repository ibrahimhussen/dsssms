import { useMemo, useState } from 'react';
import { MdSchool, MdPrint } from 'react-icons/md';
import { useMyTranscript } from '../../hooks/useAcademicReports';
import { useQuery } from '@tanstack/react-query';
import { academicReportsApi } from '../../lib/academic-reports-api';
import { authApi } from '../../lib/auth-api';
import { systemSettingsApi } from '../../lib/system-settings-api';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import type { TranscriptPeriod } from '../../types/academic-report';

// ── helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

function avNum(a?: number, b?: number): number | null {
  const vals = [a, b].filter((v): v is number => v !== undefined);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) / 10;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '';
  return v.toFixed(1);
}

function remarkFor(s2?: TranscriptPeriod, s1?: TranscriptPeriod): string {
  const p = s2 ?? s1;
  if (!p) return '';
  if (p.promotionDecision === 'GRADUATED') return 'Graduated';
  if (p.promotionDecision === 'REPEATED')  return `Repeated ${p.className}`;
  if (p.promotionDecision === 'PROMOTED') {
    const m = p.className.match(/\d+/);
    return m ? `Promoted to Grade ${Number(m[0]) + 1}` : 'Promoted';
  }
  return '';
}

// Ordinal suffix: 9 → "9th", 10 → "10th", 11 → "11th", 12 → "12th"
function gradeOrdinal(className: string): string {
  const m = className.match(/\d+/);
  if (!m) return className;
  const n = Number(m[0]);
  const sfx = n === 11 ? 'th' : n === 12 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}<sup>${sfx}</sup>`;
}

// ── print builder ─────────────────────────────────────────────────────────────

function buildPrint(params: {
  schoolName: string;
  schoolZone: string | null;
  schoolWereda: string | null;
  schoolLogo: string | null;
  studentName: string;
  admissionNumber: string;
  gender: string;
  dob: string;
  enrolledAt: string;
  dateOfLeavingAt: string | null;
  cumulativeAverage: number | null;
  generatedDate: string;
  profilePicture: string | null;
  yearGroups: { year: string; grade: string; s1?: TranscriptPeriod; s2?: TranscriptPeriod }[];
  allSubjectNames: string[];
}): string {
  const {
    schoolName, studentName, gender, dob, enrolledAt,
    dateOfLeavingAt, cumulativeAverage, generatedDate,
    profilePicture, yearGroups, allSubjectNames,
  } = params;

  const logoHtml = params.schoolLogo
    ? `<img src="${params.schoolLogo}" alt="School Logo" style="width:56px;height:56px;object-fit:contain;border-radius:4px;">`
    : `<div style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(255,255,255,0.5);background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:5.5pt;font-weight:800;color:rgba(255,255,255,0.8);text-align:center;padding:4px;line-height:1.3;">SCHOOL<br>SEAL</div>`;

  const photoHtml = profilePicture
    ? `<img src="${profilePicture}" alt="Photo" style="width:100%;height:100%;object-fit:cover;">`
    : `<span style="color:#555;font-size:10pt;font-weight:bold;">Photo</span>`;

  // Year header cells (each spans 3)
  const yearCells = yearGroups
    .map(({ year }) => `<th colspan="3" class="yr">${year}&nbsp;E.C</th>`)
    .join('');

  // Grade header cells (each spans 3)
  const gradeCells = yearGroups
    .map(({ grade }) => {
      const m = grade.match(/\d+/);
      const n = m ? Number(m[0]) : 0;
      const sfx = [11,12].includes(n) ? 'th' : n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';
      return `<th colspan="3" class="gr">${n}<sup>${sfx}</sup></th>`;
    })
    .join('');

  // Semester sub-headers
  const semCells = yearGroups
    .map(() => `<th class="sem">I</th><th class="sem">II</th><th class="sem av">Av</th>`)
    .join('');

  // Subject rows
  const subjectRows = allSubjectNames.map((name, ri) => {
    const cells = yearGroups.map(({ s1, s2 }) => {
      const r1 = s1?.subjects.find((s) => s.subjectName === name);
      const r2 = s2?.subjects.find((s) => s.subjectName === name);
      const ann = avNum(r1?.percentage, r2?.percentage);
      return `<td class="d">${fmt(r1?.percentage)}</td><td class="d">${fmt(r2?.percentage)}</td><td class="d av">${fmt(ann)}</td>`;
    }).join('');
    return `<tr class="${ri%2===1?'alt':''}"><td class="subj">${name}</td>${cells}<td class="rmk"></td></tr>`;
  }).join('');

  // Summary rows — each stat spans all 3 sub-columns per grade for compactness
  const totalCells = yearGroups.map(({ s1, s2 }) => {
    const tot1 = s1 ? s1.totalObtained.toFixed(1) : '';
    const tot2 = s2 ? s2.totalObtained.toFixed(1) : '';
    const ann  = avNum(
      s1 ? (s1.totalObtained / Math.max(s1.totalMaxMarks, 1)) * 100 : undefined,
      s2 ? (s2.totalObtained / Math.max(s2.totalMaxMarks, 1)) * 100 : undefined,
    );
    return `<td class="d sum">${tot1}</td><td class="d sum">${tot2}</td><td class="d av sum">${fmt(ann)}</td>`;
  }).join('');

  const avgCells = yearGroups.map(({ s1, s2 }) => {
    const a1 = s1?.periodAverage ?? null;
    const a2 = s2?.periodAverage ?? null;
    return `<td class="d sum">${fmt(a1)}</td><td class="d sum">${fmt(a2)}</td><td class="d av sum bold">${fmt(avNum(a1 ?? undefined, a2 ?? undefined))}</td>`;
  }).join('');

  // Rank row — last Remark cell shows promotion outcome
  const lastGroup = yearGroups[yearGroups.length - 1];
  const finalRemark = lastGroup ? remarkFor(lastGroup.s2, lastGroup.s1) : '';
  const rankCells = yearGroups.map(({ s1, s2 }) => {
    return `<td class="d sum">${s1?.rank ?? ''}</td><td class="d sum">${s2?.rank ?? ''}</td><td class="d av sum"></td>`;
  }).join('');

  // Failed subjects row — one merged cell per grade (spans 3)
  const failedCells = yearGroups.map(({ s1, s2 }) => {
    const p = s2 ?? s1;
    // Use backend-provided failed subjects if available; otherwise derive from subjects below 50%
    const failed = p?.subjects
      .filter((s) => s.percentage != null && s.percentage < 50)
      .map((s) => s.subjectName)
      .join(', ') || '—';
    return `<td colspan="3" class="d sum" style="text-align:left;padding-left:4px;font-size:6.5pt">${failed}</td>`;
  }).join('');

  // Academic status row — one merged cell per grade (spans 3)
  const statusCells = yearGroups.map(({ s1, s2 }) => {
    const status = (s2 ?? s1)?.academicStatus ?? '—';
    const color = status === 'PASS' ? '#065f46' : status === 'FAIL' ? '#991b1b' : '#92400e';
    return `<td colspan="3" class="d sum" style="font-weight:800;color:${color}">${status}</td>`;
  }).join('');

  // Remark row — one merged cell per grade (spans 3)
  const remarkRowCells = yearGroups.map(({ s1, s2 }) => {
    const r = remarkFor(s2, s1);
    return `<td colspan="3" class="d sum" style="font-style:italic;font-size:6.5pt">${r || '—'}</td>`;
  }).join('');

  const comment = cumulativeAverage !== null
    ? `He/She has completed studies at ${schoolName}. Cumulative Average: ${cumulativeAverage}%.`
    : 'He/She has _______________________________________________';

  const printDate = new Date(generatedDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Student Transcript — ${studentName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;font-size:8pt;color:#111;background:#fff;
    padding:6mm 8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}

  /* ── Header ── */
  .header{
    background:#1a8fd1;
    border:2px solid #0e5fa0;
    padding:14px 16px 12px;
    display:grid;
    grid-template-columns:72px 1fr 90px;
    gap:12px;
    align-items:center;
    margin-bottom:0;
  }
  .seal-box{
    width:68px;height:68px;border-radius:50%;
    border:2.5px solid #fff;
    background:rgba(255,255,255,0.2);
    display:flex;align-items:center;justify-content:center;
    font-size:5.5pt;font-weight:800;color:#fff;text-align:center;
    line-height:1.3;padding:4px;
  }
  .school-center{text-align:center;color:#fff}
  .school-center .line1{font-size:10pt;font-weight:800;letter-spacing:0.5px;text-decoration:underline}
  .school-center .line2{font-size:8pt;font-weight:600;margin-top:1px}
  .school-center .line3{font-size:8.5pt;font-weight:800;margin-top:2px;text-decoration:underline}
  .school-center .line4{font-size:8pt;margin-top:1px}
  .school-center .title{font-size:13pt;font-weight:900;text-decoration:underline;margin-top:8px;letter-spacing:0.5px}
  .photo-box{
    width:88px;height:108px;
    border:2.5px solid #fff;
    background:#e8f4ff;
    display:flex;align-items:center;justify-content:center;
    overflow:hidden;
  }

  /* ── Red separator ── */
  .red-bar{height:4px;background:#cc0000;margin-bottom:8px}

  /* ── Student info ── */
  .info{margin-bottom:8px;font-size:8.5pt}
  .info-row{display:flex;align-items:baseline;gap:4px;margin-bottom:3px}
  .lbl{font-weight:700;white-space:nowrap}
  .val{border-bottom:1.5px solid #333;min-width:160px;padding-bottom:1px;font-weight:600;
    text-transform:uppercase;letter-spacing:0.3px}
  .val.short{min-width:50px}
  .val.mono{font-family:monospace}

  /* ── Table ── */
  table{width:100%;border-collapse:collapse;border:2px solid #222;font-size:7.5pt;margin-top:2px}
  th,td{border:1px solid #555;text-align:center;padding:2px 3px}
  .subj{text-align:left!important;font-weight:600;padding-left:6px;white-space:nowrap;
    background:#f8f8f8}
  .yr{background:#1a8fd1;color:#fff;font-weight:800;font-size:8.5pt;border-color:#0e5fa0}
  .gr{background:#0e5fa0;color:#fff;font-weight:800;font-size:8pt;border-color:#0a3d7a}
  .sem{background:#d0e8f8;color:#0e3a6e;font-weight:700;font-size:7.5pt}
  .av{background:#b8daf5;font-weight:800;color:#082a52}
  .hdr-subj{background:#0e3a6e;color:#fff;font-weight:800;font-size:7.5pt;
    text-align:left!important;padding-left:6px;text-transform:uppercase}
  .hdr-sem{background:#0e3a6e;color:#fff;font-weight:700;font-size:7.5pt;
    text-transform:uppercase}
  .d{color:#1a1a1a}
  .sum{background:#f0f7ff;font-weight:700}
  .alt td{background:#fafcff}
  .rmk{min-width:60px;text-align:center}
  .hdr-rmk{background:#0e3a6e;color:#fff;font-weight:700;font-size:7.5pt;
    text-transform:uppercase;min-width:60px}

  /* ── Footer ── */
  .footer{margin-top:10px;font-size:8pt}
  .comment-row{display:flex;align-items:flex-end;gap:6px;margin-bottom:5px}
  .note{font-size:7pt;font-style:italic;color:#444;margin-bottom:8px}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 20px}
  .sig-lbl{font-weight:700;margin-bottom:14px}
  .sig-line{border-top:1.5px solid #333;padding-top:2px;font-size:7pt;color:#555}

  @media print{
    body{font-size:6.5pt;padding:3mm 4mm}
    @page{size:A4 landscape;margin:3mm 4mm}
    table{font-size:6.5pt}
    .school-center .title{font-size:10pt}
    .school-center .line1{font-size:8pt}
    .school-center .line3{font-size:7.5pt}
    .info{font-size:7.5pt;margin-bottom:4px}
    .footer{margin-top:6px}
  }
</style>
</head>
<body>

<div class="header">
  <div class="seal-box">${logoHtml}</div>
  <div class="school-center">
    <div class="line1">OROMIA EDUCATION BUREAU</div>
    <div class="line2">ZONE: ${params.schoolZone ?? '_______________'}</div>
    <div class="line2">WEREDA: ${params.schoolWereda ?? '_______________'}</div>
    <div class="line3">${schoolName.toUpperCase()}</div>
    <div class="title">STUDENT TRANSCRIPT</div>
  </div>
  <div class="photo-box">${photoHtml}</div>
</div>
<div class="red-bar"></div>

<div class="info">
  <div class="info-row">
    <span class="lbl">Name</span>
    <span class="val" style="min-width:300px">${studentName.toUpperCase()}</span>
  </div>
  <div class="info-row" style="gap:20px">
    <span class="lbl">Sex</span><span class="val short">${gender}</span>
    <span class="lbl" style="margin-left:16px">Age</span><span class="val short">${calcAge(dob)}</span>
  </div>
  <div class="info-row" style="gap:20px">
    <span class="lbl">Date of Admission</span><span class="val mono short">${fmtDate(enrolledAt)}</span>
    <span class="lbl" style="margin-left:16px">Date of Leaving</span>
    <span class="val mono short">${dateOfLeavingAt ? fmtDate(dateOfLeavingAt) : ''}</span>
    <span class="lbl" style="margin-left:16px">File No.</span>
    <span class="val short mono">${params.admissionNumber}</span>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th rowspan="3" class="hdr-subj">Subjects</th>
      ${yearCells}
      <th rowspan="3" class="hdr-rmk">Remark</th>
    </tr>
    <tr>${gradeCells}</tr>
    <tr>${semCells}</tr>
  </thead>
  <tbody>
    ${subjectRows}
    <tr><td class="subj sum">Total</td>${totalCells}<td class="rmk"></td></tr>
    <tr><td class="subj sum">Average</td>${avgCells}<td class="rmk"></td></tr>
    <tr><td class="subj sum">Rank</td>${rankCells}<td class="rmk" style="font-style:italic;font-size:7pt">${finalRemark}</td></tr>
    <tr><td class="subj sum" style="font-size:6.5pt">Failed Subj.</td>${failedCells}<td class="rmk"></td></tr>
    <tr><td class="subj sum">Status</td>${statusCells}<td class="rmk"></td></tr>
    <tr><td class="subj sum">Remark</td>${remarkRowCells}<td class="rmk"></td></tr>
  </tbody>
</table>

<div class="footer">
  <div class="comment-row">
    <span class="lbl">COMMENT: HE/SHE HAS</span>
    <span style="flex:1;border-bottom:1.5px solid #333;padding-bottom:1px;min-height:16px">${comment}</span>
  </div>
  <div class="note">Note:- Erasures, Alternation, Deletion, or Absence of the School Seal Invalidate this transcript</div>
  <div class="sig-grid">
    <div><div class="sig-lbl">Record officer</div><div class="sig-line">Signature</div></div>
    <div><div class="sig-lbl">DIRECTOR</div><div class="sig-line">Signature &amp; Stamp</div></div>
    <div><div class="sig-lbl">SAGNATURE</div><div class="sig-line">Date: ${printDate}</div></div>
  </div>
</div>

</body></html>`;
}

// ── page ─────────────────────────────────────────────────────────────────────

export function TranscriptPage() {
  const { data: transcript, isLoading } = useMyTranscript();
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn:  () => authApi.getProfile(),
    staleTime: 60_000,
    enabled:  Boolean(transcript),
  });

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn:  () => systemSettingsApi.get(),
    staleTime: 60_000,
  });

  async function handleDownload() {
    if (!transcript) return;
    setIsDownloading(true);
    try {
      await academicReportsApi.downloadTranscriptPdf(transcript.studentId, transcript.admissionNumber);
    } finally { setIsDownloading(false); }
  }

  const yearGroups = useMemo(() => {
    if (!transcript) return [];
    const map = new Map<string, { grade: string; s1?: TranscriptPeriod; s2?: TranscriptPeriod }>();
    for (const p of transcript.periods) {
      const entry = map.get(p.academicYear) ?? { grade: p.className };
      if (p.semester === 'SEMESTER_1') entry.s1 = p; else entry.s2 = p;
      entry.grade = p.className;
      map.set(p.academicYear, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, { grade, s1, s2 }]) => ({ year, grade, s1, s2 }));
  }, [transcript]);

  const allSubjectNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const { s1, s2 } of yearGroups) {
      for (const sub of [...(s1?.subjects ?? []), ...(s2?.subjects ?? [])]) {
        if (!seen.has(sub.subjectName)) { seen.add(sub.subjectName); names.push(sub.subjectName); }
      }
    }
    return names;
  }, [yearGroups]);

  function handlePrint() {
    if (!transcript) return;
    const html = buildPrint({
      schoolName:        transcript.schoolName,
      schoolZone:        settings?.schoolZone ?? null,
      schoolWereda:      settings?.schoolWereda ?? null,
      schoolLogo:        settings?.schoolLogo ?? null,
      studentName:       transcript.studentName,
      admissionNumber:   transcript.admissionNumber,
      gender:            transcript.gender === 'M' ? 'M' : 'F',
      dob:               transcript.dateOfBirth,
      enrolledAt:        transcript.enrolledAt,
      dateOfLeavingAt:   transcript.dateOfLeavingAt,
      cumulativeAverage: transcript.cumulativeAverage,
      generatedDate:     transcript.generatedDate,
      profilePicture:    profile?.profilePicture ?? null,
      yearGroups,
      allSubjectNames,
    });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 700);
  }

  const hasPeriods = transcript && transcript.periods.length > 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-ink-900">Transcript</h1>
        <LedgerRule />
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading transcript…</span>
        </div>
      </div>
    );
  }

  if (!hasPeriods) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-ink-900">Transcript</h1>
        <p className="mt-0.5 text-sm text-slate-500">Your official academic record.</p>
        <LedgerRule />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pine-50">
            <MdSchool className="h-7 w-7 text-pine-700" />
          </div>
          <p className="text-base font-semibold text-ink-900">No academic reports yet</p>
          <p className="mt-1.5 max-w-[380px] text-sm text-slate-500">
            Your transcript will appear here once the school has generated and released at
            least one semester report.
          </p>
        </div>
      </div>
    );
  }

  // ── Screen preview ────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Transcript</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Official academic record · Click Print for the formatted transcript.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint}>
            <MdPrint className="h-4 w-4" /> Print Transcript
          </Button>
          <Button variant="ghost" onClick={() => void handleDownload()} isLoading={isDownloading}>
            Download PDF
          </Button>
        </div>
      </div>
      <LedgerRule />

      {/* Preview — mirrors the print form */}
      <div className="overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm">

        {/* Blue header */}
        <div className="grid grid-cols-[64px_1fr_84px] items-center gap-3 bg-sky-500 px-5 py-4">
          {/* Seal */}
          {/* Seal / Logo */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/60 bg-white/20">
            {settings?.schoolLogo ? (
              <img src={settings.schoolLogo} alt="School Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-center text-[0.55rem] font-bold leading-tight text-white/80 px-1">SCHOOL<br/>SEAL</span>
            )}
          </div>
          {/* School info */}
          <div className="text-center text-white">
            <p className="text-[0.75rem] font-bold underline tracking-wide">OROMIA EDUCATION BUREAU</p>
            <p className="text-[0.7rem] font-semibold">
              ZONE: {settings?.schoolZone ?? '_______________'}
            </p>
            <p className="text-[0.7rem] font-semibold">
              WEREDA: {settings?.schoolWereda ?? '_______________'}
            </p>
            <p className="text-[0.8125rem] font-extrabold underline uppercase">{transcript.schoolName}</p>
            <p className="mt-1.5 text-[1rem] font-black underline tracking-widest">STUDENT TRANSCRIPT</p>
          </div>
          {/* Photo */}
          <div className="flex h-[108px] w-[88px] shrink-0 items-center justify-center border-2 border-white/70 bg-white/20 overflow-hidden">
            {profile?.profilePicture
              ? <img src={profile.profilePicture} alt="Photo" className="h-full w-full object-cover" />
              : <span className="text-xs font-bold text-white/80">Photo</span>}
          </div>
        </div>

        {/* Red separator */}
        <div className="h-1 bg-red-600" />

        {/* Student info */}
        <div className="px-5 py-3 text-[0.8125rem]">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="font-bold">Name</span>
            <span className="flex-1 border-b border-slate-500 pb-0.5 font-semibold uppercase tracking-wide">
              {transcript.studentName}
            </span>
          </div>
          <div className="mb-1.5 flex items-baseline gap-4">
            <span className="font-bold">Sex</span>
            <span className="w-12 border-b border-slate-500 pb-0.5">{transcript.gender === 'M' ? 'M' : 'F'}</span>
            <span className="ml-4 font-bold">Age</span>
            <span className="w-10 border-b border-slate-500 pb-0.5">{calcAge(transcript.dateOfBirth)}</span>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="font-bold">Date of Admission</span>
            <span className="w-24 border-b border-slate-500 pb-0.5 font-mono">{fmtDate(transcript.enrolledAt)}</span>
            <span className="ml-4 font-bold">Date of Leaving</span>
            <span className="w-28 border-b border-slate-500 pb-0.5 font-mono">
              {transcript.dateOfLeavingAt ? fmtDate(transcript.dateOfLeavingAt) : ''}
            </span>
            <span className="ml-4 font-bold">File No.</span>
            <span className="w-20 border-b border-slate-500 pb-0.5 font-mono text-ink-900">{transcript.admissionNumber}</span>
          </div>
        </div>

        {/* Academic table */}
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[700px] border-collapse border-2 border-slate-700 text-[0.75rem]">
            <thead>
              <tr>
                <th rowSpan={3} className="border border-slate-600 bg-slate-800 px-2 py-1.5 text-left text-[0.65rem] font-bold uppercase text-white w-28">
                  Subjects
                </th>
                {yearGroups.map(({ year }) => (
                  <th key={year} colSpan={3} className="border border-sky-700 bg-sky-500 px-2 py-1.5 text-center font-extrabold text-white">
                    {year} E.C
                  </th>
                ))}
                <th rowSpan={3} className="border border-slate-600 bg-slate-800 px-1.5 py-1.5 text-center text-[0.65rem] font-bold uppercase text-white w-16">
                  Remark
                </th>
              </tr>
              <tr>
                {yearGroups.map(({ year, grade }) => {
                  const m = grade.match(/\d+/);
                  const n = m ? Number(m[0]) : 0;
                  const sfx = [11,12].includes(n)?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';
                  return (
                    <th key={year} colSpan={3} className="border border-sky-800 bg-sky-700 px-2 py-1 text-center font-bold text-white">
                      {n}<sup className="text-[0.55rem]">{sfx}</sup>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {yearGroups.flatMap(({ year }) =>
                  (['I','II','Av'] as const).map((lbl) => (
                    <th key={`${year}-${lbl}`}
                      className={`border border-slate-400 px-1.5 py-1 text-center font-semibold text-[0.7rem]
                        ${lbl === 'Av' ? 'bg-sky-100 text-sky-900' : 'bg-sky-50 text-slate-700'}`}>
                      {lbl}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {allSubjectNames.map((name, ri) => (
                <tr key={name} className={ri % 2 === 1 ? 'bg-slate-50/60' : ''}>
                  <td className="border border-slate-300 px-2 py-1 font-medium text-ink-900 whitespace-nowrap bg-slate-50">
                    {name}
                  </td>
                  {yearGroups.flatMap(({ year, s1, s2 }) => {
                    const r1 = s1?.subjects.find((s) => s.subjectName === name);
                    const r2 = s2?.subjects.find((s) => s.subjectName === name);
                    const ann = avNum(r1?.percentage, r2?.percentage);
                    return [
                      <td key={`${year}-i`}  className="border border-slate-300 px-1.5 py-1 text-center">{fmt(r1?.percentage)}</td>,
                      <td key={`${year}-ii`} className="border border-slate-300 px-1.5 py-1 text-center">{fmt(r2?.percentage)}</td>,
                      <td key={`${year}-av`} className="border border-slate-300 bg-sky-50 px-1.5 py-1 text-center font-semibold text-sky-900">{fmt(ann)}</td>,
                    ];
                  })}
                  <td className="border border-slate-300 px-1.5 py-1" />
                </tr>
              ))}

              {/* Total */}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-500">
                <td className="border border-slate-400 px-2 py-1.5 bg-slate-200 font-bold">Total</td>
                {yearGroups.flatMap(({ year, s1, s2 }) => {
                  const ann = avNum(
                    s1 ? (s1.totalObtained / Math.max(s1.totalMaxMarks,1))*100 : undefined,
                    s2 ? (s2.totalObtained / Math.max(s2.totalMaxMarks,1))*100 : undefined,
                  );
                  return [
                    <td key={`${year}-t1`} className="border border-slate-400 px-1.5 py-1.5 text-center">{fmt(s1?.totalObtained ?? null)}</td>,
                    <td key={`${year}-t2`} className="border border-slate-400 px-1.5 py-1.5 text-center">{fmt(s2?.totalObtained ?? null)}</td>,
                    <td key={`${year}-ta`} className="border border-slate-400 bg-sky-100 px-1.5 py-1.5 text-center font-bold text-sky-900">{fmt(ann)}</td>,
                  ];
                })}
                <td className="border border-slate-400 px-1.5 py-1.5" />
              </tr>

              {/* Average */}
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-400 px-2 py-1.5 bg-slate-200 font-bold">Average</td>
                {yearGroups.flatMap(({ year, s1, s2 }) => {
                  const ann = avNum(s1?.periodAverage, s2?.periodAverage);
                  return [
                    <td key={`${year}-a1`} className="border border-slate-400 px-1.5 py-1.5 text-center">{fmt(s1?.periodAverage ?? null)}</td>,
                    <td key={`${year}-a2`} className="border border-slate-400 px-1.5 py-1.5 text-center">{fmt(s2?.periodAverage ?? null)}</td>,
                    <td key={`${year}-aa`} className="border border-slate-400 bg-sky-100 px-1.5 py-1.5 text-center font-bold text-sky-900">{fmt(ann)}</td>,
                  ];
                })}
                <td className="border border-slate-400 px-1.5 py-1.5" />
              </tr>

              {/* Rank + Remark */}
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-400 px-2 py-1.5 bg-slate-200 font-bold">Rank</td>
                {yearGroups.flatMap(({ year, s1, s2 }) => [
                  <td key={`${year}-r1`} className="border border-slate-400 px-1.5 py-1.5 text-center">{s1?.rank ?? ''}</td>,
                  <td key={`${year}-r2`} className="border border-slate-400 px-1.5 py-1.5 text-center">{s2?.rank ?? ''}</td>,
                  <td key={`${year}-ra`} className="border border-slate-400 bg-sky-50 px-1.5 py-1.5 text-center" />,
                ])}
                {/* Remark — one cell for the whole row */}
                <td className="border border-slate-400 bg-amber-50 px-1.5 py-1.5 text-center text-[0.7rem] font-semibold italic text-amber-800">
                  {remarkFor(
                    yearGroups[yearGroups.length - 1]?.s2,
                    yearGroups[yearGroups.length - 1]?.s1,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-4 text-[0.8125rem]">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="shrink-0 font-extrabold uppercase">Comment: He/She has</span>
            <span className="flex-1 border-b border-slate-400 pb-0.5 text-ink-700">
              {transcript.cumulativeAverage !== null
                ? `completed studies at ${transcript.schoolName}. Cumulative Average: ${transcript.cumulativeAverage}%.`
                : ''}
            </span>
          </div>
          <p className="mb-4 text-[0.7rem] italic text-slate-400">
            Note:- Erasures, Alternation, Deletion, or Absence of the School Seal Invalidate this transcript
          </p>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'Record Officer', sub: 'Signature' },
              { label: 'DIRECTOR',       sub: 'Signature & Stamp' },
              { label: 'SAGNATURE',      sub: `Date: ${new Date(transcript.generatedDate).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'})}` },
            ].map(({ label, sub }) => (
              <div key={label}>
                <p className="font-bold text-ink-900">{label}</p>
                <div className="mt-5 border-t border-slate-500 pt-1 text-[0.75rem] text-slate-500">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
