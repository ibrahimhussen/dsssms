import { useState } from 'react';
import { useMyTranscript } from '../../hooks/useAcademicReports';
import { academicReportsApi } from '../../lib/academic-reports-api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';

const SEMESTER_LABELS: Record<string, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

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

  return (
    <div className="max-w-[760px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl">Transcript</h1>
        {transcript && transcript.periods.length > 0 && (
          <Button onClick={() => void handleDownload()} isLoading={isDownloading}>
            Download PDF
          </Button>
        )}
      </div>
      <p className="mb-1 text-[0.9375rem] text-ink-700">Your full academic record, semester by semester.</p>
      <LedgerRule />

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !transcript || transcript.periods.length === 0 ? (
        <EmptyState title="No academic reports yet" description="Your transcript will appear here once reports have been generated for at least one semester." />
      ) : (
        <>
          <Card className="mb-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.875rem]">
              <div>
                <span className="text-slate-500">Student: </span>
                {transcript.studentName}
              </div>
              <div>
                <span className="text-slate-500">Admission #: </span>
                {transcript.admissionNumber}
              </div>
              <div>
                <span className="text-slate-500">Classroom: </span>
                {transcript.classroomLabel}
              </div>
              <div>
                <span className="text-slate-500">Enrolled: </span>
                {new Date(transcript.enrolledAt).toLocaleDateString()}
              </div>
            </div>
            {transcript.cumulativeAverage !== null && (
              <div className="mt-4 flex items-baseline gap-2 border-t border-slate-200 pt-4">
                <span className="text-[0.8125rem] text-slate-500">Cumulative average across {transcript.periods.length} semester(s):</span>
                <span className="font-display text-xl font-semibold text-pine-900">{transcript.cumulativeAverage}%</span>
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-5">
            {[...transcript.periods].reverse().map((period) => (
              <Card key={`${period.academicYear}-${period.semester}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg">
                    {SEMESTER_LABELS[period.semester]} — {period.academicYear}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge tone={period.periodAverage >= 50 ? 'positive' : 'danger'}>{period.periodAverage}%</Badge>
                    {period.rank && <Badge>Rank #{period.rank}</Badge>}
                  </div>
                </div>

                {period.subjects.length === 0 ? (
                  <p className="text-sm text-slate-500">No subject-level grades on file for this semester.</p>
                ) : (
                  <table className="w-full text-left text-[0.875rem]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 font-medium">Subject</th>
                        <th className="pb-2 font-medium">Score</th>
                        <th className="pb-2 font-medium">Max</th>
                        <th className="pb-2 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {period.subjects.map((s) => (
                        <tr key={s.subjectName} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5">{s.subjectName}</td>
                          <td className="py-1.5">{s.totalScore}</td>
                          <td className="py-1.5">{s.totalMaxMarks}</td>
                          <td className="py-1.5">{s.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
