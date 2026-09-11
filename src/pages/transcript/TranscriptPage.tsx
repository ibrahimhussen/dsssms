import { useMemo, useState } from 'react';
import { MdSchool, MdPrint } from 'react-icons/md';
import { useMyTranscript, useStudentTranscript } from '../../hooks/useAcademicReports';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { academicReportsApi } from '../../lib/academic-reports-api';
import { authApi } from '../../lib/auth-api';
import { systemSettingsApi } from '../../lib/system-settings-api';
import { studentsApi } from '../../lib/students-api';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
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
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function avNum(a?: number, b?: number): number | null {
  const vals = [a, b].filter((v): v is number => v !== undefined);
  if (!vals.length) return null;
  return Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) / 10;
}

function fmt(v: number | null | undefined): string {
  return v == null ? '' : v.toFixed(1);
}

function gradeNum(className: string): number {
  const m = className.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function ordinalSup(n: number): string {
  const sfx = [11,12].includes(n) ? 'th' : n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';
  return `${n}<sup>${sfx}</sup>`;
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

// Subject names per grade-group (no forced union across groups)
function subjectsForGroups(
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

// ── print HTML builder ────────────────────────────────────────────────────────

function buildPrint(p: {
  schoolName: string;
  schoolZone: string | null;
  schoolWereda: string | null;
  schoolRegion: string | null;
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

  const logoHtml = p.schoolLogo
    ? `<img src="${p.schoolLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;padding:4px;">`
    : `<span style="font-size:6pt;font-weight:800;color:rgba(255,255,255,0.8);text-align:center;line-height:1.3;">School<br>Logo</span>`;

  const photoHtml = p.profilePicture
    ? `<div class="photo-inner"><img src="${p.profilePicture}" alt="Photo"></div>`
    : `<div class="photo-inner"><div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:8pt;font-weight:700;color:rgba(255,255,255,0.7);">PHOTO</div></div>`;

  // ── ONE unified table — ALL grades (9, 10, 11, 12) side-by-side ──────────
  const groups   = p.yearGroups;
  const subjects = p.allSubjectNames;

  const yearRow = groups.map(({ year }) => `<th colspan="3" class="yr">${year} E.C</th>`).join('');
  const gradeRow = groups.map(({ grade }) => `<th colspan="3" class="gr">${ordinalSup(gradeNum(grade))}</th>`).join('');
  const semRow = groups.map(() => `<th class="sem">I</th><th class="sem">II</th><th class="sem av">Av</th>`).join('');

  const subjectRows = subjects.map((name, ri) => {
    const cells = groups.map(({ s1, s2 }) => {
      const r1 = s1?.subjects.find((s) => s.subjectName === name);
      const r2 = s2?.subjects.find((s) => s.subjectName === name);
      // blank cell (not '0') when this subject was not taken in this grade
      const v1  = r1 ? fmt(r1.percentage)  : '';
      const v2  = r2 ? fmt(r2.percentage)  : '';
      const vav = (r1 || r2) ? fmt(avNum(r1?.percentage, r2?.percentage)) : '';
      return `<td class="d">${v1}</td><td class="d">${v2}</td><td class="d av">${vav}</td>`;
    }).join('');
    return `<tr class="${ri%2===1?'alt':''}"><td class="no">${ri+1}</td><td class="subj">${name}</td>${cells}</tr>`;
  }).join('');

  const avgRow = groups.map(({ s1, s2 }) => {
    const a1 = s1?.periodAverage ?? null;
    const a2 = s2?.periodAverage ?? null;
    return `<td class="sum">${fmt(a1)}</td><td class="sum">${fmt(a2)}</td><td class="sum av bold">${fmt(avNum(a1??undefined, a2??undefined))}</td>`;
  }).join('');

  const rankRow = groups.map(({ s1, s2 }) =>
    `<td class="sum">${s1?.rank ?? ''}</td><td class="sum">${s2?.rank ?? ''}</td><td class="sum av">—</td>`
  ).join('');

  const statusRow = groups.map(({ s1, s2 }) => {
    const status = (s2 ?? s1)?.academicStatus ?? '—';
    const col = status === 'PASS' ? '#0a5c2e' : status === 'FAIL' ? '#8b0000' : '#7a5c00';
    return `<td colspan="3" class="sum" style="font-weight:900;color:${col}">${status}</td>`;
  }).join('');

  const remarkRow = groups.map(({ s1, s2 }) =>
    `<td colspan="3" class="sum" style="font-style:italic;font-size:6pt">${remarkFor(s2,s1)||'—'}</td>`
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

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Student Transcript — ${p.studentName}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Arial,sans-serif;font-size:7.5pt;color:#111;background:#fff;
  padding:5mm 5mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ── Header ── */
.hdr{background:linear-gradient(135deg,#0d47a1 0%,#1565c0 40%,#1976d2 100%);
  display:grid;grid-template-columns:110px 1fr 115px;min-height:135px;
  border-radius:4px 4px 0 0}
.logo-cell{display:flex;align-items:center;justify-content:center;padding:12px 8px}
.logo-circle{width:82px;height:82px;border-radius:50%;border:3px solid rgba(255,255,255,0.9);
  overflow:hidden;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,0.1)}
.center-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;color:#fff;padding:8px 4px}
.bureau{font-size:13pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px}
.zw{font-size:8pt;font-weight:500;margin-top:4px;opacity:0.95}
.sname{font-size:10.5pt;font-weight:800;margin-top:5px;text-transform:uppercase}
.title-pill{background:rgba(0,0,0,0.3);border:1.5px solid rgba(255,255,255,0.6);
  border-radius:3px;margin-top:7px;padding:4px 18px;
  font-size:11pt;font-weight:900;letter-spacing:2px;text-transform:uppercase}
.photo-cell{display:flex;align-items:center;justify-content:center;padding:6px;border-left:2px solid rgba(255,255,255,0.35)}
.photo-inner{width:90px;aspect-ratio:4/5;overflow:hidden;border:1.5px solid rgba(255,255,255,0.7);background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center}
.photo-cell img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}

/* ── Student info ── */
.info-box{border:1.5px solid #b8cfe8;background:#f0f6ff;padding:5px 10px;margin:4px 0;
  display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}
.irow{display:flex;align-items:baseline;gap:4px;font-size:7.5pt}
.ilbl{font-weight:700;color:#0d3875;white-space:nowrap;min-width:72px}
.ival{border-bottom:1px solid #666;flex:1;font-weight:600}

/* ── Section label ── */
.section-label{background:#1565c0;color:#fff;font-weight:800;font-size:8pt;
  padding:2px 8px;margin-top:5px;text-transform:uppercase;letter-spacing:0.5px}

/* ── Table ── */
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

/* ── Footer ── */
.footer{border:1.5px solid #b8cfe8;background:#f0f6ff;margin-top:5px;padding:5px 10px;
  display:grid;grid-template-columns:1fr 1fr;gap:4px 30px}
.flbl{font-weight:700;font-size:7.5pt;color:#0d3875;margin-bottom:10px}
.fline{border-top:1.5px solid #666;padding-top:1px;font-size:6.5pt;color:#555;margin-bottom:6px}

@media print{
  body{padding:3mm 4mm;font-size:7pt}
  @page{size:A4 landscape;margin:3mm 4mm}
  table{font-size:6.5pt}
}
</style></head><body>

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

</body></html>`;
}

// ── page ─────────────────────────────────────────────────────────────────────

export function TranscriptPage() {
  const { user } = useAuth();
  const isOversight = user?.role === 'ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'VICE_DIRECTOR';

  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [isDownloading, setIsDownloading]   = useState(false);

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['students', 'search', searchQuery],
    queryFn:  () => studentsApi.list({ search: searchQuery, limit: 10 }),
    enabled:  isOversight && searchQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const { data: myTranscript,      isLoading: myLoading }      = useMyTranscript();
  const { data: studentTranscript, isLoading: studentLoading } = useStudentTranscript(
    isOversight ? (selectedStudentId ?? undefined) : undefined
  );

  const transcript = isOversight ? studentTranscript : myTranscript;
  const isLoading  = isOversight ? studentLoading    : myLoading;

  const { data: profile }   = useQuery({ queryKey: ['auth', 'profile'],    queryFn: () => authApi.getProfile(),         staleTime: 60_000, enabled: Boolean(transcript) });
  const { data: settings }  = useQuery({ queryKey: ['system-settings'],    queryFn: () => systemSettingsApi.get(),      staleTime: 60_000 });

  async function handleDownload() {
    if (!transcript) return;
    setIsDownloading(true);
    try { await academicReportsApi.downloadTranscriptPdf(transcript.studentId, transcript.admissionNumber); }
    finally { setIsDownloading(false); }
  }

  // Group periods by academic year
  const yearGroups = useMemo(() => {
    if (!transcript) return [];
    const map = new Map<string, { grade: string; s1?: TranscriptPeriod; s2?: TranscriptPeriod }>();
    for (const period of transcript.periods) {
      const entry = map.get(period.academicYear) ?? { grade: period.className };
      if (period.semester === 'SEMESTER_1') entry.s1 = period; else entry.s2 = period;
      entry.grade = period.className;
      map.set(period.academicYear, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, { grade, s1, s2 }]) => ({ year, grade, s1, s2 }));
  }, [transcript]);

  // ALL grades side-by-side in one table — unified subject union across all grades
  // Subjects not available for a grade show as blank/—
  const allSubjectNames = useMemo(() => subjectsForGroups(yearGroups), [yearGroups]);

  function handlePrint() {
    if (!transcript) return;
    const html = buildPrint({
      schoolName:        transcript.schoolName,
      schoolZone:        settings?.schoolZone    ?? null,
      schoolWereda:      settings?.schoolWereda  ?? null,
      schoolRegion:      settings?.schoolRegion  ?? null,
      schoolLogo:        settings?.schoolLogo    ?? null,
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

  // Oversight: student search
  if (isOversight && !selectedStudentId) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink-900">Student Transcripts</h1>
        <p className="mt-0.5 text-sm text-slate-500">Search for a student to view their official Grade 9–12 transcript.</p>
        <LedgerRule />
        <div className="mb-4">
          <TextField
            label="Search by name or admission number"
            className="w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. Chaltu or DSH-2026-00002"
          />
        </div>
        {searchLoading && (
          <div className="flex items-center gap-2 py-4 text-slate-400">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
            <span className="text-sm">Searching…</span>
          </div>
        )}
        {searchResults && searchResults.items.length === 0 && searchQuery.length >= 2 && (
          <EmptyState title="No students found" description="Try a different name or admission number." />
        )}
        {searchResults && searchResults.items.length > 0 && (
          <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {searchResults.items.map((s) => (
              <button key={s.studentId} type="button"
                className="flex items-center justify-between px-5 py-3 hover:bg-paper-100 text-left transition-colors"
                onClick={() => setSelectedStudentId(s.studentId)}>
                <div>
                  <p className="font-semibold text-ink-900">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-slate-500 font-mono">{s.admissionNumber}</p>
                </div>
                <span className="text-xs text-pine-700 font-semibold">View Transcript →</span>
              </button>
            ))}
          </div>
        )}
        {!searchQuery && <EmptyState title="Search for a student" description="Enter at least 2 characters to search." />}
      </div>
    );
  }

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
            Your transcript will appear here once the school has generated and released at least one semester report.
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
          <p className="mt-0.5 text-sm text-slate-500">Official academic record · Click Print for the formatted A4 landscape document.</p>
        </div>
        <div className="flex gap-2">
          {isOversight && (
            <Button variant="ghost" onClick={() => { setSelectedStudentId(null); setSearchQuery(''); }}>
              ← Back to search
            </Button>
          )}
          <Button onClick={handlePrint}>
            <MdPrint className="h-4 w-4" /> Print Transcript
          </Button>
          <Button variant="ghost" onClick={() => void handleDownload()} isLoading={isDownloading}>
            Download PDF
          </Button>
        </div>
      </div>
      <LedgerRule />

      <div className="overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm">

        {/* Header */}
        <div className="grid bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600"
          style={{gridTemplateColumns:'130px 1fr auto', minHeight:'155px'}}>
          {/* Logo — left */}
          <div className="flex items-center justify-center p-3">
            <div className="flex items-center justify-center overflow-hidden rounded-full border-[3px] border-white/90 bg-white/15"
              style={{width:'clamp(90px, 9vw, 112px)', height:'clamp(90px, 9vw, 112px)'}}>
              {settings?.schoolLogo
                ? <img src={settings.schoolLogo} alt="Logo" className="h-full w-full object-contain p-[5px]" />
                : <span className="text-center text-[0.6rem] font-bold leading-tight text-white/80 px-2">School<br/>Logo</span>}
            </div>
          </div>
          {/* School info — center */}
          <div className="flex flex-col items-center justify-center py-4 text-center text-white">
            <p className="text-[1rem] font-black uppercase tracking-wide">OROMIA EDUCATION BUREAU</p>
            <p className="mt-1.5 text-[0.75rem] font-medium">REGION: {settings?.schoolRegion ?? 'OROMIA'}</p>
            <p className="mt-0.5 text-[0.75rem] font-medium">ZONE: {settings?.schoolZone ?? 'BAALE'}</p>
            <p className="mt-0.5 text-[0.75rem] font-medium">WEREDA: {settings?.schoolWereda ?? 'DINSHO'}</p>
            <p className="mt-2 text-[0.9375rem] font-extrabold uppercase">{transcript.schoolName}</p>
            <div className="mt-3 rounded-sm border border-white/60 bg-black/30 px-5 py-1.5">
              <p className="text-[0.9375rem] font-black uppercase tracking-[2px]">STUDENT TRANSCRIPT</p>
            </div>
          </div>
          {/* Photo — right: strict 3:4 portrait, screen-only */}
          <div className="flex items-center justify-center border-l-2 border-white/30 px-3 py-3 print:hidden">
            <div className="relative overflow-hidden rounded border-2 border-white/70 bg-white/10"
              style={{width:'clamp(90px, 10vw, 138px)', aspectRatio:'3/4'}}>
              {profile?.profilePicture
                ? <img src={profile.profilePicture} alt="Student photo"
                    className="absolute inset-0 h-full w-full object-cover object-center" />
                : <div className="flex h-full w-full items-center justify-center">
                    <span className="text-[0.75rem] font-bold text-white/70 tracking-wide">PHOTO</span>
                  </div>}
            </div>
          </div>
          {/* Photo for print — separate cell shown only when printing */}
          <div className="hidden print:block overflow-hidden border-l-2 border-white/30 w-[115px]">
            {profile?.profilePicture
              ? <img src={profile.profilePicture} alt="Photo" className="h-full w-full object-cover block" />
              : <div className="flex h-full items-center justify-center">
                  <span className="text-sm font-bold text-white/70">PHOTO</span>
                </div>}
          </div>
        </div>

        {/* Student info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 border border-blue-100 bg-blue-50 px-5 py-3 text-[0.8125rem]">
          {[
            { label: 'Full Name',         value: transcript.studentName,           span: false },
            { label: 'Date of Leaving',   value: transcript.dateOfLeavingAt ? fmtDate(transcript.dateOfLeavingAt) : '', span: false },
            { label: 'Sex',               value: transcript.gender === 'M' ? 'Male' : 'Female', span: false },
            { label: 'File Number',       value: '',                               span: false },
            { label: 'Age',               value: String(calcAge(transcript.dateOfBirth)), span: false },
            { label: 'Student ID / ADM. NO.', value: transcript.admissionNumber,  span: false },
            { label: 'Date of Admission', value: fmtDate(transcript.enrolledAt),  span: false },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className="shrink-0 font-bold text-blue-900 min-w-[130px]">{label}</span>
              <span className="text-slate-600">:</span>
              <span className="flex-1 border-b border-slate-400 pb-0.5 font-semibold text-ink-900">{value}</span>
            </div>
          ))}
        </div>

        {/* Academic table — ALL grades side-by-side: Grade 9 | Grade 10 | Grade 11 | Grade 12 */}
        {yearGroups.length > 0 && (
          <div className="overflow-x-auto px-4 pt-3 pb-1">
            {allSubjectNames.length > 0
              ? <GradeTable groups={yearGroups} subjects={allSubjectNames} />
              : <p className="py-3 text-sm italic text-slate-400">No released academic results yet.</p>
            }
          </div>
        )}

        {/* Footer */}
        <div className="grid grid-cols-2 gap-x-8 border border-blue-100 bg-blue-50 px-5 py-3 mt-3 mx-4 mb-4 rounded-lg text-[0.8125rem]">
          {[
            { label: "Teacher's Name", sig: 'Signature', date: 'Date' },
            { label: "V/Director's Name", sig: 'Signature', date: 'Date' },
          ].map(({ label, sig, date }) => (
            <div key={label}>
              <p className="font-bold text-blue-900 mb-3">{label}</p>
              <div className="border-t border-slate-400 pt-1 text-[0.75rem] text-slate-500 mb-2">{sig}</div>
              <div className="border-t border-slate-400 pt-1 text-[0.75rem] text-slate-500">{date}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Screen grade table sub-component ─────────────────────────────────────────

function GradeTable({
  groups,
  subjects,
}: {
  groups: { year: string; grade: string; s1?: TranscriptPeriod; s2?: TranscriptPeriod }[];
  subjects: string[];
}) {
  return (
    <table className="w-full min-w-[500px] border-collapse border border-slate-600 text-[0.7rem]">
      <thead>
        <tr>
          <th rowSpan={3} className="border border-blue-700 bg-blue-700 px-1 py-1 text-white w-7">#</th>
          <th rowSpan={3} className="border border-blue-700 bg-blue-700 px-2 py-1 text-left text-white min-w-[90px]">Subject</th>
          {groups.map(({ year }) => (
            <th key={year} colSpan={3} className="border border-blue-700 bg-blue-600 px-1 py-1 text-center font-bold text-white">
              {year} E.C
            </th>
          ))}
        </tr>
        <tr>
          {groups.map(({ year, grade }) => {
            const n = gradeNum(grade);
            const sfx = [11,12].includes(n)?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';
            return (
              <th key={year} colSpan={3} className="border border-blue-600 bg-blue-500 px-1 py-1 text-center font-bold text-white">
                {n}<sup className="text-[0.5rem]">{sfx}</sup>
              </th>
            );
          })}
        </tr>
        <tr>
          {groups.flatMap(({ year }) =>
            (['I','II','Av'] as const).map((lbl) => (
              <th key={`${year}-${lbl}`} className={`border border-slate-400 px-1 py-1 text-center font-semibold
                ${lbl === 'Av' ? 'bg-blue-100 text-blue-900' : 'bg-blue-50 text-slate-700'}`}>
                {lbl}
              </th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {subjects.map((name, ri) => (
          <tr key={name} className={ri % 2 === 1 ? 'bg-slate-50/60' : ''}>
            <td className="border border-slate-300 px-1 py-0.5 text-center text-slate-400">{ri + 1}</td>
            <td className="border border-slate-300 px-2 py-0.5 font-medium text-ink-900 whitespace-nowrap bg-slate-50">{name}</td>
            {groups.flatMap(({ year, s1, s2 }) => {
              const r1 = s1?.subjects.find((s) => s.subjectName === name);
              const r2 = s2?.subjects.find((s) => s.subjectName === name);
              // blank when this grade didn't have this subject — never show '0' for missing
              const v1  = r1 ? fmt(r1.percentage)  : '';
              const v2  = r2 ? fmt(r2.percentage)  : '';
              const vav = (r1 || r2) ? fmt(avNum(r1?.percentage, r2?.percentage)) : '';
              return [
                <td key={`${year}-i`}  className="border border-slate-300 px-1 py-0.5 text-center">{v1}</td>,
                <td key={`${year}-ii`} className="border border-slate-300 px-1 py-0.5 text-center">{v2}</td>,
                <td key={`${year}-av`} className="border border-slate-300 bg-blue-50 px-1 py-0.5 text-center font-semibold text-blue-900">{vav}</td>,
              ];
            })}
          </tr>
        ))}
        {/* Summary row */}
        {(['Total/Average','Rank','Status'] as const).map((rowLabel) => (
          <tr key={rowLabel} className="border-t-2 border-blue-400 bg-blue-50 font-bold">
            <td className="border border-blue-400 px-1 py-1 bg-blue-600 text-white" />
            <td className="border border-blue-400 px-2 py-1 bg-blue-600 text-white text-[0.65rem] uppercase">{rowLabel}</td>
            {groups.flatMap(({ year, s1, s2 }) => {
              if (rowLabel === 'Total/Average') {
                const ann = avNum(s1?.periodAverage, s2?.periodAverage);
                return [
                  <td key={`${year}-s1`} className="border border-blue-300 px-1 py-1 text-center">{fmt(s1?.periodAverage ?? null)}</td>,
                  <td key={`${year}-s2`} className="border border-blue-300 px-1 py-1 text-center">{fmt(s2?.periodAverage ?? null)}</td>,
                  <td key={`${year}-av`} className="border border-blue-300 bg-blue-100 px-1 py-1 text-center font-bold text-blue-900">{fmt(ann)}</td>,
                ];
              }
              if (rowLabel === 'Rank') {
                return [
                  <td key={`${year}-r1`} className="border border-blue-300 px-1 py-1 text-center">{s1?.rank ?? '—'}</td>,
                  <td key={`${year}-r2`} className="border border-blue-300 px-1 py-1 text-center">{s2?.rank ?? '—'}</td>,
                  <td key={`${year}-ra`} className="border border-blue-300 bg-blue-100 px-1 py-1 text-center">—</td>,
                ];
              }
              // Status
              const status = ((s2 ?? s1)?.academicStatus) ?? '—';
              const cls = status === 'PASS' ? 'text-pine-700' : status === 'FAIL' ? 'text-danger-600' : 'text-amber-700';
              return [
                <td key={`${year}-st`} colSpan={3} className={`border border-blue-300 px-1 py-1 text-center font-black text-[0.75rem] ${cls}`}>{status}</td>,
              ];
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
