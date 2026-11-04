import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MdPerson,
  MdSchool,
  MdHistory,
  MdOpenInNew,
  MdCheckCircle,
  MdSearch,
} from 'react-icons/md';
import { useQuery } from '@tanstack/react-query';
import { useStudent, useStudentEnrollmentHistory } from '../../hooks/useStudents';
import { useStudentGradesByYear } from '../../hooks/useGrades';
import { useAuth } from '../../context/AuthContext';
import { academicRegisterApi } from '../../lib/academic-register-api';
import { useClassroomRoster } from '../../hooks/useClassrooms';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { EmptyState } from '../../components/ui/EmptyState';
import type { StudentEnrollmentRecord } from '../../types/student';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

function decisionBadge(decision: string) {
  switch (decision) {
    case 'PROMOTED':       return <Badge tone="positive">Promoted</Badge>;
    case 'REPEATED':       return <Badge tone="warning">Repeated</Badge>;
    case 'GRADUATED':      return <Badge tone="positive">Graduated</Badge>;
    case 'ACTIVE':         return <Badge tone="neutral">Current</Badge>;
    case 'TRANSFERRED_OUT':return <Badge tone="danger">Transferred out</Badge>;
    case 'CORRECTED':      return <Badge tone="warning">Corrected</Badge>;
    default:               return <Badge>{decision}</Badge>;
  }
}

function statusTone(status: string): 'positive' | 'danger' | 'warning' | 'neutral' {
  if (status === 'PASS')        return 'positive';
  if (status === 'FAIL')        return 'danger';
  if (status === 'INCOMPLETE')  return 'warning';
  return 'neutral';
}

// ── Student selector (for staff) ──────────────────────────────────────────────

interface StudentSelectorProps {
  onSelect: (studentId: number) => void;
}

function StudentSelector({ onSelect }: StudentSelectorProps) {
  const [admNum, setAdmNum] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['students', 'search', submitted],
    queryFn: async () => {
      if (!submitted.trim()) return null;
      const { studentsApi } = await import('../../lib/students-api');
      const res = await studentsApi.list({ search: submitted.trim(), limit: 20, page: 1 });
      return res;
    },
    enabled: Boolean(submitted.trim()),
  });

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wide">Find student</p>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Admission number or name"
          className="min-w-[280px]"
          placeholder="e.g. DSH-2026-00001 or Alice"
          value={admNum}
          onChange={(e) => setAdmNum(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSubmitted(admNum); }}
        />
        <Button variant="secondary" onClick={() => setSubmitted(admNum)}>
          <MdSearch className="h-4 w-4" /> Search
        </Button>
      </div>

      {isLoading && <p className="mt-3 text-sm text-slate-400">Searching…</p>}
      {error && (
        <p className="mt-3 text-sm text-danger-600">
          {error instanceof Error ? error.message : 'Search failed.'}
        </p>
      )}

      {data && data.items.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">No students found for "{submitted}".</p>
      )}

      {data && data.items.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {data.items.map((s) => (
            <li key={s.studentId} className="flex items-center justify-between px-4 py-2.5 hover:bg-paper-50">
              <div>
                <span className="font-medium text-ink-900">{s.firstName} {s.lastName}</span>
                <span className="ml-2 font-mono text-xs text-slate-400">{s.admissionNumber}</span>
                <span className="ml-2 text-xs text-slate-400">{s.classroom.className} {s.classroom.section}</span>
              </div>
              <Button variant="ghost" onClick={() => onSelect(s.studentId)}>
                <MdOpenInNew className="h-4 w-4" /> View history
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Historical Register Panel ─────────────────────────────────────────────────

interface RegisterPanelProps {
  enrollment: StudentEnrollmentRecord;
}

function RegisterPanel({ enrollment }: RegisterPanelProps) {
  // Load the full classroom register for this enrollment's classroom + academic year
  const { data: roster } = useClassroomRoster(enrollment.classroomId, enrollment.academicYear);
  const { data: register, isLoading, error } = useQuery({
    queryKey: ['academic-register', enrollment.classroomId, enrollment.academicYear, 'SEMESTER_1'],
    queryFn: () =>
      academicRegisterApi.getRegister({
        classroomId:  enrollment.classroomId,
        academicYear: enrollment.academicYear,
        viewMode:     'SEMESTER_1',
      }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
        <span className="text-sm">Loading historical register…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
        <p className="text-sm text-danger-700">
          {error instanceof Error ? error.message : 'Could not load historical register.'}
        </p>
      </div>
    );
  }

  if (!register) return null;

  const { metadata, subjects, students } = register;

  return (
    <div>
      {/* Register header */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Students',    value: metadata.totalStudents },
          { label: 'Subjects',    value: subjects.length },
          { label: 'Pass',        value: metadata.passCount,       color: 'text-pine-700' },
          { label: 'Fail',        value: metadata.failCount,       color: 'text-danger-600' },
          { label: 'Incomplete',  value: metadata.incompleteCount, color: 'text-gold-600' },
          { label: 'Pending',     value: metadata.pendingCount,    color: 'text-slate-500' },
          { label: 'Avg',         value: metadata.classAverage !== null ? `${metadata.classAverage}%` : '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
            <p className={`mt-0.5 text-xl font-bold ${stat.color ?? 'text-ink-900'}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {metadata.isOfficialView && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-pine-200 bg-pine-50 px-4 py-2.5">
          <MdCheckCircle className="h-4 w-4 text-pine-700 shrink-0" />
          <p className="text-sm text-pine-800 font-semibold">
            Official finalized register
            {metadata.finalizedAt ? ` · Finalized ${new Date(metadata.finalizedAt).toLocaleDateString()}` : ''}
          </p>
        </div>
      )}

      {/* Roster count info */}
      {roster && roster.isHistorical && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5">
          <MdHistory className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          <p className="text-sm text-gold-700">
            Historical roster — {roster.students.length} students were enrolled in this classroom in {enrollment.academicYear}.
          </p>
        </div>
      )}

      {/* Register table */}
      {students.length === 0 ? (
        <EmptyState title="No student results" description="No marks were recorded for this classroom in this period." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-10 px-3 py-3 text-center">Rank</th>
                <th className="px-3 py-3">Student</th>
                {subjects.map((s) => (
                  <th key={s.subjectId} className="px-3 py-3 text-right">{s.subjectName}</th>
                ))}
                <th className="px-3 py-3 text-right">Avg</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...students]
                .sort((a, b) => {
                  if (a.sectionRank !== null && b.sectionRank !== null) return a.sectionRank - b.sectionRank;
                  if (a.sectionRank !== null) return -1;
                  if (b.sectionRank !== null) return 1;
                  return a.studentName.localeCompare(b.studentName);
                })
                .map((s, idx) => (
                  <tr
                    key={s.studentId}
                    className={`border-b border-slate-100 last:border-0 hover:bg-paper-50 ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      {s.sectionRank !== null ? (
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          s.sectionRank === 1 ? 'bg-amber-100 text-amber-800'
                          : s.sectionRank === 2 ? 'bg-slate-200 text-slate-700'
                          : s.sectionRank === 3 ? 'bg-orange-100 text-orange-700'
                          : 'bg-paper-100 text-ink-700'
                        }`}>{s.sectionRank}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-ink-900">{s.studentName}</p>
                      <p className="text-[0.65rem] text-slate-400">{s.admissionNumber}</p>
                    </td>
                    {s.subjectResults.map((r) => (
                      <td key={r.subjectId} className="px-3 py-2.5 text-right font-mono">
                        {r.finalResult !== null ? r.finalResult.toFixed(1) : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {s.average !== null ? `${s.average.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={statusTone(s.academicStatus)}>{s.academicStatus}</Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Student Academic History panel ────────────────────────────────────────────

interface HistoryPanelProps {
  studentId: number;
}

function HistoryPanel({ studentId }: HistoryPanelProps) {
  const { user } = useAuth();
  const { data: student, isLoading: studentLoading } = useStudent(studentId);
  const { data: enrollments, isLoading: enrollmentsLoading } = useStudentEnrollmentHistory(studentId);

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);

  const selectedEnrollment = enrollments?.find((e) => e.id === selectedEnrollmentId) ?? null;

  // For student/parent roles viewing their own grades — show breakdown by year
  const showGradeBreakdown = user?.role === 'STUDENT' || user?.role === 'PARENT';
  const { data: gradeBreakdown, isLoading: gradesLoading } = useStudentGradesByYear(
    showGradeBreakdown && selectedEnrollment ? studentId : undefined,
    selectedEnrollment?.academicYear ?? ''
  );

  if (studentLoading || enrollmentsLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
        <span>Loading academic history…</span>
      </div>
    );
  }

  if (!student) return <EmptyState title="Student not found" description="The requested student record could not be loaded." />;

  const age = student.dateOfBirth ? calcAge(student.dateOfBirth) : null;
  const isOversight = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(user?.role ?? '');
  const isTeacher   = user?.role === 'TEACHER';

  return (
    <div>
      {/* ── Student Profile ── */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pine-100">
            <MdPerson className="h-8 w-8 text-pine-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-ink-900">
              {student.firstName} {student.lastName}
            </h2>
            <p className="mt-0.5 font-mono text-sm text-slate-500">{student.admissionNumber}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>Gender: <strong>{student.gender}</strong></span>
              {age !== null && <span>Age: <strong>{age}</strong></span>}
              <span>Status: <strong>{student.studentStatus}</strong></span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-paper-50 px-4 py-3 text-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Current classroom</p>
            <p className="font-semibold text-ink-900">
              {student.classroom.className} {student.classroom.section}
            </p>
            <p className="text-slate-500">{student.classroom.academicYear}</p>
          </div>
        </div>
      </div>

      {/* ── Academic Timeline ── */}
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Academic Timeline</h3>

      {(!enrollments || enrollments.length === 0) ? (
        <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="font-semibold text-slate-600">No enrollment history</p>
          <p className="mt-1 text-sm text-slate-400">
            This student has not been through a promotion batch yet. Their current enrollment will appear here after the first batch is approved.
          </p>
        </div>
      ) : (
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Academic year</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {[...enrollments]
                .sort((a, b) => b.academicYear.localeCompare(a.academicYear))
                .map((e) => (
                  <tr
                    key={e.id}
                    className={`border-b border-slate-100 last:border-0 transition-colors hover:bg-paper-50 ${
                      selectedEnrollmentId === e.id ? 'bg-pine-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono">{e.academicYear}</td>
                    <td className="px-4 py-3 font-medium">{e.className}</td>
                    <td className="px-4 py-3">{e.section}</td>
                    <td className="px-4 py-3">{decisionBadge(e.decision)}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant={selectedEnrollmentId === e.id ? 'secondary' : 'ghost'}
                        onClick={() =>
                          setSelectedEnrollmentId(selectedEnrollmentId === e.id ? null : e.id)
                        }
                      >
                        <MdSchool className="h-4 w-4" />
                        {selectedEnrollmentId === e.id ? 'Hide' : 'View register'}
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Historical Register / Grade Breakdown ── */}
      {selectedEnrollment && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-baseline justify-between gap-2">
            <h3 className="font-semibold text-ink-900">
              {selectedEnrollment.className} {selectedEnrollment.section} — {selectedEnrollment.academicYear}
            </h3>
            {decisionBadge(selectedEnrollment.decision)}
          </div>

          {/* Oversight + Teacher: show full class register via existing academic register service */}
          {(isOversight || isTeacher) && (
            <RegisterPanel enrollment={selectedEnrollment} />
          )}

          {/* Student + Parent: show this student's own grade breakdown */}
          {showGradeBreakdown && (
            <>
              {gradesLoading ? (
                <div className="flex items-center gap-2 py-6 text-slate-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
                  <span className="text-sm">Loading grades…</span>
                </div>
              ) : !gradeBreakdown || gradeBreakdown.length === 0 ? (
                <EmptyState
                  title="No grade records"
                  description="No subject marks are available for this academic period."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[520px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Semester</th>
                        <th className="px-4 py-3 text-right">Score / Total</th>
                        <th className="px-4 py-3 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeBreakdown.map((row, idx) => {
                        const pct = row.totalMaxMarks > 0
                          ? Math.round((row.totalScore / row.totalMaxMarks) * 1000) / 10
                          : null;
                        return (
                          <tr
                            key={`${row.subject.subjectId}-${row.semester}`}
                            className={`border-b border-slate-100 last:border-0 ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                          >
                            <td className="px-4 py-2.5 font-medium">{row.subject.subjectName}</td>
                            <td className="px-4 py-2.5 text-slate-500">
                              {row.semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">
                              {row.totalScore} / {row.totalMaxMarks}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold">
                              {pct !== null ? `${pct}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function StudentAcademicHistoryPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isOversight = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(user?.role ?? '');
  const isTeacher   = user?.role === 'TEACHER';
  const isStudent   = user?.role === 'STUDENT';
  const isParent    = user?.role === 'PARENT';

  // Staff can provide a studentId query param or use the search widget
  const urlStudentId = searchParams.get('studentId');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    urlStudentId ? Number(urlStudentId) : null
  );

  // For students: look up their own studentId
  const { data: myProfile } = useQuery({
    queryKey: ['students', 'me-profile'],
    queryFn: async () => {
      const { studentsApi } = await import('../../lib/students-api');
      return studentsApi.getMyProfile();
    },
    enabled: isStudent,
  });

  // For parents: we need them to pick a child — reuse existing ParentChildrenPage data
  const { data: parentProfile } = useQuery({
    queryKey: ['parent', 'profile'],
    queryFn: async () => {
      const { parentsApi } = await import('../../lib/parents-api');
      return parentsApi.getMyProfile();
    },
    enabled: isParent,
  });

  const effectiveStudentId =
    isStudent  ? (myProfile?.studentId ?? null) :
    isParent   ? selectedStudentId :
    /* staff */ selectedStudentId;

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Student Academic History</h1>
      <LedgerRule />

      {/* ── Staff / Teacher: search for a student ── */}
      {(isOversight || isTeacher) && !effectiveStudentId && (
        <StudentSelector onSelect={setSelectedStudentId} />
      )}

      {(isOversight || isTeacher) && effectiveStudentId && (
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => setSelectedStudentId(null)}>
            ← Search again
          </Button>
        </div>
      )}

      {/* ── Parents: pick a child ── */}
      {isParent && !effectiveStudentId && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wide">Select a child</p>
          {!parentProfile ? (
            <p className="text-sm text-slate-400">Loading your children…</p>
          ) : parentProfile.children.length === 0 ? (
            <EmptyState title="No linked children" description="No students are linked to your account." />
          ) : (
            <div className="flex flex-wrap gap-3">
              {parentProfile.children.map((child) => (
                <button
                  key={child.studentId}
                  onClick={() => setSelectedStudentId(child.studentId)}
                  className="rounded-xl border border-slate-200 bg-paper-50 px-5 py-3 text-left hover:border-pine-700 hover:bg-pine-50/30 transition-colors"
                >
                  <p className="font-semibold text-ink-900">{child.firstName} {child.lastName}</p>
                  <p className="text-sm text-slate-400">{child.admissionNumber}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isParent && effectiveStudentId && (
        <div className="mb-4">
          <Button variant="ghost" onClick={() => setSelectedStudentId(null)}>← Back</Button>
        </div>
      )}

      {/* ── History panel ── */}
      {effectiveStudentId ? (
        <HistoryPanel studentId={effectiveStudentId} />
      ) : isStudent ? (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span>Loading your academic history…</span>
        </div>
      ) : null}
    </div>
  );
}
