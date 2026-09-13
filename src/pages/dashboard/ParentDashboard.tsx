import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  useMyParentProfile,
  useChildAttendanceSummary,
  useChildAttendanceTrend,
} from '../../hooks/useDashboardData';
import { useStudentReportHistory } from '../../hooks/useAcademicReports';
import { academicReportsApi } from '../../lib/academic-reports-api';
import { gradesApi } from '../../lib/grades-api';
import { systemSettingsApi } from '../../lib/system-settings-api';
import { buildReportCardHtml } from '../../lib/report-card-html';
import { buildPrintForExport, subjectsForGroups } from '../../lib/transcript-html';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChart } from '../../components/ui/Charts';

function openPrintWindow(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html.replace(
    '</body></html>',
    '<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script></body></html>'
  ));
  w.document.close();
  w.focus();
}

export function ParentDashboard() {
  const { data: profile, isLoading: isProfileLoading } = useMyParentProfile();
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>(undefined);
  const [isDownloadingReportCard, setIsDownloadingReportCard] = useState(false);
  const [isDownloadingTranscript, setIsDownloadingTranscript] = useState(false);

  const children = profile?.children ?? [];
  const activeStudentId = selectedStudentId ?? children[0]?.studentId;
  const activeChild = children.find((c) => c.studentId === activeStudentId);

  const { data: attendanceSummary, isLoading: isAttendanceLoading } = useChildAttendanceSummary(activeStudentId);
  const { data: attendanceTrend, isLoading: isAttendanceTrendLoading } = useChildAttendanceTrend(activeStudentId);
  const { data: reports, isLoading: isReportsLoading } = useStudentReportHistory(activeStudentId);

  const sortedReports = reports
    ? [...reports].sort((a, b) => (a.academicYear + a.semester).localeCompare(b.academicYear + b.semester))
    : [];
  const latestReport = sortedReports[sortedReports.length - 1];

  async function handleDownloadTranscript() {
    if (!activeStudentId) return;
    setIsDownloadingTranscript(true);
    try {
      const [transcript, settings] = await Promise.all([
        academicReportsApi.getStudentTranscript(activeStudentId),
        systemSettingsApi.get(),
      ]);
      const map = new Map<string, { grade: string; s1?: typeof transcript.periods[0]; s2?: typeof transcript.periods[0] }>();
      for (const period of transcript.periods) {
        const entry = map.get(period.academicYear) ?? { grade: period.className };
        if (period.semester === 'SEMESTER_1') entry.s1 = period; else entry.s2 = period;
        entry.grade = period.className;
        map.set(period.academicYear, entry);
      }
      const yearGroups = [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, { grade, s1, s2 }]) => ({ year, grade, s1, s2 }));
      const allSubjectNames = subjectsForGroups(yearGroups);
      const html = buildPrintForExport({
        schoolName: transcript.schoolName,
        schoolZone: settings.schoolZone ?? null,
        schoolWereda: settings.schoolWereda ?? null,
        schoolRegion: settings.schoolRegion ?? null,
        schoolLogo: settings.schoolLogo ?? null,
        studentName: transcript.studentName,
        admissionNumber: transcript.admissionNumber,
        gender: transcript.gender === 'M' ? 'M' : 'F',
        dob: transcript.dateOfBirth,
        enrolledAt: transcript.enrolledAt,
        dateOfLeavingAt: transcript.dateOfLeavingAt,
        cumulativeAverage: transcript.cumulativeAverage,
        generatedDate: transcript.generatedDate,
        profilePicture: null,
        yearGroups,
        allSubjectNames,
        isStudentCopy: true,
      });
      openPrintWindow(html);
    } finally {
      setIsDownloadingTranscript(false);
    }
  }

  async function handleDownloadReportCard() {
    if (!activeStudentId || !latestReport) return;
    setIsDownloadingReportCard(true);
    try {
      const [subjects, settings] = await Promise.all([
        gradesApi.getStudentGrades(activeStudentId, {
          semester: latestReport.semester,
          academicYear: latestReport.academicYear,
        }),
        systemSettingsApi.get(),
      ]);
      const html = buildReportCardHtml({
        schoolName: settings.schoolName,
        schoolZone: settings.schoolZone ?? null,
        schoolWereda: settings.schoolWereda ?? null,
        schoolRegion: settings.schoolRegion ?? null,
        schoolLogo: settings.schoolLogo ?? null,
        studentName: latestReport.studentName,
        admissionNumber: activeChild?.admissionNumber ?? '',
        classroomLabel: activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : '',
        semester: latestReport.semester,
        academicYear: latestReport.academicYear,
        averageMark: latestReport.averageMark,
        rank: latestReport.rank,
        subjects,
        isNonOfficial: true,
      });
      openPrintWindow(html);
    } finally {
      setIsDownloadingReportCard(false);
    }
  }

  return (
    <>
      <Card className="mb-5">
        <h2 className="mb-3 text-lg">Your children</h2>
        {isProfileLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : children.length === 0 ? (
          <EmptyState title="No linked students" description="Contact the school administrator if this seems wrong." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <button
                key={child.studentId}
                type="button"
                onClick={() => setSelectedStudentId(child.studentId)}
                className={clsx(
                  'rounded-lg border px-4 py-2 text-left text-sm transition-colors',
                  child.studentId === activeStudentId
                    ? 'border-pine-900 bg-pine-900 text-paper-50'
                    : 'border-slate-200 text-ink-900 hover:bg-paper-100'
                )}
              >
                <span className="block font-semibold">{child.firstName} {child.lastName}</span>
                <span className={clsx('font-mono text-[0.75rem]', child.studentId === activeStudentId ? 'text-paper-100' : 'text-slate-500')}>
                  {child.admissionNumber}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {activeChild && (
        <>
          <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
            <StatCard label="Attendance rate" value={isAttendanceLoading ? '-' : `${attendanceSummary?.presentPercentage ?? 0}%`} />
            <StatCard
              label="Overall average"
              value={
                isReportsLoading ? '-' : latestReport ? (
                  <>{latestReport.averageMark}%{latestReport.rank && <Badge tone="positive"> Rank #{latestReport.rank}</Badge>}</>
                ) : '-'
              }
            />
            <StatCard label="Days present" value={isAttendanceLoading ? '-' : attendanceSummary?.present} />
            <StatCard label="Days absent" value={isAttendanceLoading ? '-' : attendanceSummary?.absent} />
          </div>

          <div className="mb-5 flex flex-wrap gap-3">
            <Link to="/notifications" className="text-sm font-semibold text-pine-700 hover:underline">
              Contact school / notifications
            </Link>
            {latestReport && (
              <>
                <span className="text-slate-300">·</span>
                <Button variant="ghost" onClick={() => void handleDownloadReportCard()} isLoading={isDownloadingReportCard}>
                  Download latest report card (PDF)
                </Button>
                <span className="text-slate-300">·</span>
                <Button variant="ghost" onClick={() => void handleDownloadTranscript()} isLoading={isDownloadingTranscript}>
                  Download transcript (PDF)
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            <Card>
              <h2 className="mb-4 text-lg">{activeChild.firstName}&apos;s academic progress</h2>
              {isReportsLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <LineChart
                  data={sortedReports.map((r) => ({
                    label: `${r.semester === 'SEMESTER_1' ? 'S1' : 'S2'} ${r.academicYear}`,
                    value: r.averageMark,
                  }))}
                  valueSuffix="%"
                  emptyLabel="No report cards yet"
                />
              )}
            </Card>
            <Card>
              <h2 className="mb-4 text-lg">Attendance history</h2>
              {isAttendanceTrendLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <LineChart data={attendanceTrend ?? []} valueSuffix="%" emptyLabel="No attendance recorded yet" />
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}