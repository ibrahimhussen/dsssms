import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useMyParentProfile } from "../../hooks/useParents";
import { useStudentReportHistory, useStudentReportCard } from "../../hooks/useAcademicReports";
import { gradesApi } from "../../lib/grades-api";
import { systemSettingsApi } from "../../lib/system-settings-api";
import { buildReportCardHtml } from "../../lib/report-card-html";
import { LedgerRule } from "../../components/ui/LedgerRule";
import { SelectField } from "../../components/ui/SelectField";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { MdPrint, MdEmojiEvents } from "react-icons/md";

const SEM_LABEL: Record<string, string> = {
  SEMESTER_1: "Semester I",
  SEMESTER_2: "Semester II",
};

const STATUS_TONE: Record<string, "positive" | "danger" | "warning"> = {
  PASS: "positive", FAIL: "danger", PENDING: "warning",
};

export function ParentReportCardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useMyParentProfile();

  const selectedId = searchParams.get("studentId")
    ? Number(searchParams.get("studentId"))
    : profile?.children[0]?.studentId;

  const { data: reports } = useStudentReportHistory(selectedId);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState(false);

  const sortedReports = useMemo(
    () => (reports ?? []).sort(
      (a, b) => b.academicYear.localeCompare(a.academicYear) || b.semester.localeCompare(a.semester)
    ), [reports]
  );

  useMemo(() => {
    if (sortedReports.length > 0 && !selectedSemester) {
      setSelectedSemester(sortedReports[0].semester);
      setSelectedYear(sortedReports[0].academicYear);
    }
  }, [sortedReports, selectedSemester]);

  const { data: reportCard, isLoading: rcLoading } = useStudentReportCard(
    selectedId,
    selectedSemester || undefined,
    selectedYear || undefined
  );

  const selectedChild = profile?.children.find((c) => c.studentId === selectedId);

  async function handlePrint() {
    if (!reportCard || !selectedId) return;
    setIsPrinting(true);
    try {
      const [subjects, settings] = await Promise.all([
        gradesApi.getStudentGrades(selectedId, { semester: reportCard.semester, academicYear: reportCard.academicYear }),
        systemSettingsApi.get(),
      ]);
      const html = buildReportCardHtml({
        schoolName: settings.schoolName,
        schoolZone: settings.schoolZone ?? null,
        schoolWereda: settings.schoolWereda ?? null,
        schoolRegion: settings.schoolRegion ?? null,
        schoolLogo: settings.schoolLogo ?? null,
        studentName: reportCard.studentName,
        admissionNumber: reportCard.admissionNumber,
        classroomLabel: `${reportCard.className} ${reportCard.section}`,
        semester: reportCard.semester,
        academicYear: reportCard.academicYear,
        averageMark: reportCard.average,
        rank: reportCard.rank,
        subjects,
        isNonOfficial: true,
      });
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(html.replace("</body></html>",
        "<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script></body></html>"));
      w.document.close(); w.focus();
    } finally { setIsPrinting(false); }
  }

  if (profileLoading) return (
    <div className="flex items-center gap-2 py-16 text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
      <span className="text-sm">Loading...</span>
    </div>
  );

  if (!profile?.children.length) return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Report Card</h1>
      <LedgerRule />
      <EmptyState title="No children linked" description="Contact the school to link your children to your account." />
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/parent/children" className="mb-1 inline-flex items-center text-xs font-medium text-slate-500 hover:text-pine-700">
            &larr; Academic Overview
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900">Report Card</h1>
          {selectedChild && (
            <p className="mt-0.5 text-sm text-slate-500">
              {selectedChild.firstName} {selectedChild.lastName} &middot; {selectedChild.admissionNumber}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {profile.children.length > 1 && (
            <SelectField label="Child" className="min-w-[180px]" value={selectedId ?? ""}
              onChange={(e) => { setSearchParams({ studentId: e.target.value }); setSelectedSemester(""); setSelectedYear(""); }}>
              {profile.children.map((c) => (
                <option key={c.studentId} value={c.studentId}>{c.firstName} {c.lastName}</option>
              ))}
            </SelectField>
          )}
          {reportCard && (
            <Button onClick={() => void handlePrint()} isLoading={isPrinting}>
              <MdPrint className="h-4 w-4" /> Print / Save as PDF
            </Button>
          )}
        </div>
      </div>
      <LedgerRule />

      {sortedReports.length === 0 ? (
        <EmptyState title="No report cards yet" description="Report cards appear once the school finalizes semester results." />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end gap-3">
            <SelectField label="Academic Year" className="min-w-[150px]" value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}>
              {[...new Set(sortedReports.map((r) => r.academicYear))].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </SelectField>
            <SelectField label="Semester" className="min-w-[150px]" value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}>
              {sortedReports.filter((r) => r.academicYear === selectedYear).map((r) => (
                <option key={r.semester} value={r.semester}>{SEM_LABEL[r.semester]}</option>
              ))}
            </SelectField>
          </div>

          {rcLoading ? (
            <div className="flex items-center gap-2 py-8 text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
              <span className="text-sm">Loading report card...</span>
            </div>
          ) : !reportCard ? (
            <EmptyState title="No finalized report card" description="Select a different period." />
          ) : (
            <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                  {SEM_LABEL[reportCard.semester]} &middot; {reportCard.academicYear}
                </p>
                <h2 className="mt-1 text-xl font-black">{reportCard.studentName}</h2>
                <p className="text-sm opacity-85">{reportCard.className} {reportCard.section} &middot; {reportCard.admissionNumber}</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-200">
                <div className="px-5 py-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Average</p>
                  <p className={`text-3xl font-black mt-1 ${reportCard.academicStatus === "PASS" ? "text-pine-700" : reportCard.academicStatus === "FAIL" ? "text-danger-600" : "text-amber-600"}`}>
                    {reportCard.average.toFixed(1)}%
                  </p>
                </div>
                <div className="px-5 py-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rank</p>
                  <p className="text-3xl font-black mt-1 text-ink-900">
                    {reportCard.rank !== null ? (
                      <span className="flex items-center justify-center gap-1"><MdEmojiEvents className="h-6 w-6 text-amber-500" />#{reportCard.rank}</span>
                    ) : "-"}
                  </p>
                </div>
                <div className="px-5 py-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
                  <div className="mt-2 flex justify-center">
                    <Badge tone={STATUS_TONE[reportCard.academicStatus] ?? "neutral"}>{reportCard.academicStatus}</Badge>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                      <th className="px-5 py-2.5 font-semibold w-8">#</th>
                      <th className="px-4 py-2.5 font-semibold">Subject</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Score</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Max</th>
                      <th className="px-4 py-2.5 font-semibold text-right">%</th>
                      <th className="px-4 py-2.5 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportCard.subjects.map((s, i) => (
                      <tr key={s.subjectName} className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/50" : ""}`}>
                        <td className="px-5 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-ink-900">{s.subjectName}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.totalScore !== null ? s.totalScore.toFixed(1) : "-"}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{s.totalMaxMarks}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          {s.percentage !== null ? (
                            <span className={s.percentage >= 50 ? "text-pine-700" : "text-danger-600"}>{s.percentage.toFixed(1)}%</span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {s.status ? <Badge tone={s.status === "PASS" ? "positive" : "danger"}>{s.status}</Badge> : <span className="text-slate-300 text-xs">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-blue-300 bg-blue-50 font-bold">
                      <td colSpan={2} className="px-5 py-2.5 text-xs uppercase tracking-wide text-blue-800">Total / Average</td>
                      <td className="px-4 py-2.5 text-right font-mono">{reportCard.totalObtained.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{reportCard.totalMaxMarks}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-800">{reportCard.average.toFixed(1)}%</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {(reportCard.failedSubjects.length > 0 || reportCard.attendance) && (
                <div className="grid grid-cols-2 gap-4 border-t border-slate-200 px-5 py-4 text-sm max-[600px]:grid-cols-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Failed Subjects</p>
                    <p className={reportCard.failedSubjects.length > 0 ? "text-danger-600 font-medium" : "text-slate-500"}>
                      {reportCard.failedSubjects.length > 0 ? reportCard.failedSubjects.join(", ") : "None"}
                    </p>
                  </div>
                  {reportCard.attendance && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Attendance</p>
                      <p className="text-slate-700">
                        Present: <strong>{reportCard.attendance.present}</strong> &nbsp;
                        Absent: <strong>{reportCard.attendance.absent}</strong> &nbsp;
                        Rate: <strong className={reportCard.attendance.percentage >= 80 ? "text-pine-700" : "text-danger-600"}>{reportCard.attendance.percentage}%</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-slate-200 bg-amber-50 px-5 py-3 text-center">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Student Copy - Not an Official Report Card</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}