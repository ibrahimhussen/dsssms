import { useState } from 'react';
import { MdSchool, MdCalendarToday, MdBadge } from 'react-icons/md';
import { useMyTranscript } from '../../hooks/useAcademicReports';
import { academicReportsApi } from '../../lib/academic-reports-api';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';

// ── helpers ──────────────────────────────────────────────────────────────────

const SEMESTER_LABELS: Record<string, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

function passColor(pct: number) {
  if (pct >= 75) return 'text-pine-700';
  if (pct >= 50) return 'text-amber-700';
  return 'text-danger-600';
}

// ── page ─────────────────────────────────────────────────────────────────────

export function TranscriptPage() {
  const { data: transcript, isLoading } = useMyTranscript();
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!transcript) return;
    setIsDownloading(true);
    try {
      await academicReportsApi.downloadTranscriptPdf(transcript.studentId, transcript.admissionNumber);
    } finally {
      setIsDownloading(false);
    }
  }

  const hasPeriods = transcript && transcript.periods.length > 0;

  return (
    <div className="max-w-3xl">

      {/* ── Page header ── */}
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Transcript</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Your full academic record, semester by semester.
          </p>
        </div>
        {hasPeriods && (
          <Button onClick={() => void handleDownload()} isLoading={isDownloading}>
            Download PDF
          </Button>
        )}
      </div>
      <LedgerRule />

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading transcript…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !hasPeriods && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pine-50">
            <MdSchool className="h-7 w-7 text-pine-700" />
          </div>
          <p className="text-[1rem] font-semibold text-ink-900">No academic reports yet</p>
          <p className="mt-1.5 max-w-[360px] text-sm text-slate-500">
            Your transcript will appear here once reports have been generated for at least one
            semester by the school.
          </p>
        </div>
      )}

      {/* ── Transcript content ── */}
      {!isLoading && hasPeriods && (
        <>
          {/* Student identity card */}
          <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Green accent bar */}
            <div className="h-1.5 bg-pine-700" />
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Identity fields */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <MdSchool className="h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-wide text-slate-400">Student</p>
                      <p className="font-semibold text-ink-900">{transcript.studentName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MdBadge className="h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-wide text-slate-400">Admission #</p>
                      <p className="font-mono font-semibold text-ink-900">{transcript.admissionNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MdSchool className="h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-wide text-slate-400">Classroom</p>
                      <p className="font-semibold text-ink-900">{transcript.classroomLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MdCalendarToday className="h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-wide text-slate-400">Enrolled</p>
                      <p className="font-semibold text-ink-900">
                        {new Date(transcript.enrolledAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cumulative average */}
                {transcript.cumulativeAverage !== null && (
                  <div className="shrink-0 rounded-xl border border-pine-200 bg-pine-50 px-5 py-3 text-center">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-pine-600">
                      Cumulative Average
                    </p>
                    <p className="mt-0.5 text-3xl font-bold text-pine-900">
                      {transcript.cumulativeAverage}
                      <span className="text-lg font-normal text-pine-600">%</span>
                    </p>
                    <p className="text-[0.6875rem] text-pine-600">
                      across {transcript.periods.length} semester{transcript.periods.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Semester sections — newest first */}
          <div className="flex flex-col gap-5">
            {[...transcript.periods].reverse().map((period) => (
              <div
                key={`${period.academicYear}-${period.semester}`}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Semester header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                  <div>
                    <p className="text-[0.9375rem] font-semibold text-ink-900">
                      {SEMESTER_LABELS[period.semester]}
                    </p>
                    <p className="text-[0.75rem] text-slate-400">{period.academicYear}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {period.rank && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.75rem] font-semibold text-amber-800">
                        Rank #{period.rank}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ${
                        period.periodAverage >= 50
                          ? 'bg-pine-100 text-pine-800'
                          : 'bg-danger-100 text-danger-700'
                      }`}
                    >
                      {period.periodAverage}%
                    </span>
                  </div>
                </div>

                {/* Subject rows */}
                {period.subjects.length === 0 ? (
                  <p className="px-5 py-4 text-sm italic text-slate-400">
                    No subject-level grades on file for this semester.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-5 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                          Subject
                        </th>
                        <th className="px-3 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                          Score
                        </th>
                        <th className="px-3 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                          Max
                        </th>
                        <th className="px-5 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {period.subjects.map((s) => (
                        <tr
                          key={s.subjectName}
                          className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-2.5 font-medium text-ink-900">
                            {s.subjectName}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-ink-800">
                            {s.totalScore}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                            {s.totalMaxMarks}
                          </td>
                          <td className={`px-5 py-2.5 text-right font-semibold ${passColor(s.percentage)}`}>
                            {s.percentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Semester average footer */}
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="px-5 py-2.5 text-[0.8125rem] font-semibold text-slate-500 uppercase tracking-wide">
                          Average
                        </td>
                        <td colSpan={2} />
                        <td className={`px-5 py-2.5 text-right text-[0.9375rem] font-bold ${passColor(period.periodAverage)}`}>
                          {period.periodAverage}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="mt-6 text-center text-[0.75rem] text-slate-400">
            This transcript is generated from official academic records.
            Contact the school administration for certified copies.
          </p>
        </>
      )}
    </div>
  );
}
