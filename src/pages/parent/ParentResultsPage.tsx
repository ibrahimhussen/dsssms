import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMyParentProfile } from '../../hooks/useParents';
import { useStudentReportHistory } from '../../hooks/useAcademicReports';
import { gradesApi } from '../../lib/grades-api';
import { systemSettingsApi } from '../../lib/system-settings-api';
import { buildReportCardHtml } from '../../lib/report-card-html';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { SelectField } from '../../components/ui/SelectField';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MdDownload, MdEmojiEvents } from 'react-icons/md';
import type { Semester } from '../../types/grade';
import type { AcademicReport } from '../../types/academic-report';

const SEM: Record<Semester, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

export function ParentResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useMyParentProfile();

  const selectedId = searchParams.get('studentId')
    ? Number(searchParams.get('studentId'))
    : profile?.children[0]?.studentId;

  const { data: reports, isLoading: reportsLoading } = useStudentReportHistory(selectedId);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const selectedChild = profile?.children.find((c) => c.studentId === selectedId);
  const sorted = reports
    ? [...reports].sort(
        (a, b) =>
          b.academicYear.localeCompare(a.academicYear) ||
          b.semester.localeCompare(a.semester)
      )
    : [];

  async function handlePrint(r: AcademicReport) {
    if (!selectedId) return;
    setDownloadingId(r.reportId);
    try {
      // Fetch grades and settings in parallel
      const [subjects, settings] = await Promise.all([
        gradesApi.getStudentGrades(selectedId, {
          semester:     r.semester,
          academicYear: r.academicYear,
        }),
        systemSettingsApi.get(),
      ]);

      const html = buildReportCardHtml({
        schoolName:      settings.schoolName,
        schoolZone:      settings.schoolZone    ?? null,
        schoolWereda:    settings.schoolWereda  ?? null,
        schoolRegion:    settings.schoolRegion  ?? null,
        schoolLogo:      settings.schoolLogo    ?? null,
        studentName:     r.studentName,
        admissionNumber: selectedChild?.admissionNumber ?? '',
        classroomLabel:  `${selectedChild?.firstName ?? ''} ${selectedChild?.lastName ?? ''}`.trim(),
        semester:        r.semester,
        academicYear:    r.academicYear,
        averageMark:     r.averageMark,
        rank:            r.rank,
        subjects,
        isNonOfficial:   true,
      });

      const htmlWithPrint = html.replace(
        '</body></html>',
        `<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script></body></html>`
      );
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(htmlWithPrint);
      w.document.close();
      w.focus();
    } finally {
      setDownloadingId(null);
    }
  }

  if (profileLoading)
    return (
      <div className="flex items-center gap-2 py-16 text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
        <span className="text-sm">Loading…</span>
      </div>
    );

  if (!profile?.children.length)
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink-900">Results</h1>
        <LedgerRule />
        <EmptyState
          title="No children linked"
          description="Contact the school to link your children to your account."
        />
      </div>
    );

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/parent/children" className="mb-1 inline-flex items-center text-xs font-medium text-slate-500 hover:text-pine-700">
            ← Academic Overview
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900">Results</h1>
          {selectedChild && (
            <p className="mt-0.5 text-sm text-slate-500">
              {selectedChild.firstName} {selectedChild.lastName} &middot;{' '}
              {selectedChild.admissionNumber}
            </p>
          )}
        </div>
        {profile.children.length > 1 && (
          <SelectField
            label="Child"
            className="min-w-[200px]"
            value={selectedId ?? ''}
            onChange={(e) => setSearchParams({ studentId: e.target.value })}
          >
            {profile.children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <LedgerRule />

      {reportsLoading ? (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading results…</span>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No results yet"
          description="Report cards will appear here once the school generates semester reports."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {sorted.map((r) => {
            const pass = r.averageMark >= 50;
            return (
              <div
                key={r.reportId}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {SEM[r.semester as Semester]}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-700">{r.academicYear}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${pass ? 'bg-pine-100 text-pine-800' : 'bg-danger-100 text-danger-700'}`}>
                    {pass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div>
                  <p className={`text-3xl font-black ${pass ? 'text-pine-800' : 'text-danger-600'}`}>
                    {r.averageMark.toFixed(1)}%
                  </p>
                  {r.rank && (
                    <div className="mt-1 flex items-center gap-1 text-amber-600">
                      <MdEmojiEvents className="h-4 w-4" />
                      <span className="text-xs font-semibold">Rank #{r.rank}</span>
                    </div>
                  )}
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pass ? 'bg-pine-500' : 'bg-danger-400'}`}
                    style={{ width: `${Math.min(r.averageMark, 100)}%` }}
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={() => void handlePrint(r)}
                  isLoading={downloadingId === r.reportId}
                  className="mt-1 w-full"
                >
                  <MdDownload className="h-4 w-4" /> Print / Save as PDF
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
