import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdCheckCircle,
  MdWarningAmber,
  MdErrorOutline,
  MdLock,
  MdLockOpen,
  MdInfoOutline,
} from 'react-icons/md';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useGradeSubjectConfig } from '../../hooks/useGradeSubjectConfig';
import { useAuth } from '../../context/AuthContext';
import {
  useClassroomSubjectFinalizations,
  useReviewSubject,
  useFinalizeSubject,
  useFinalizeClassroom,
  useSubmitForReview,
} from '../../hooks/useFinalization';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Semester } from '../../types/grade';
import type { SubjectFinalization } from '../../types/finalization';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADE_OPTIONS = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`;
}

function semesterLabel(s: Semester) {
  return s === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2';
}

function statusBadge(status: SubjectFinalization['status']) {
  switch (status) {
    case 'DRAFT':        return <Badge tone="neutral">Draft</Badge>;
    case 'UNDER_REVIEW': return <Badge tone="warning">Under Review</Badge>;
    case 'APPROVED':     return <Badge tone="positive">Approved</Badge>;
    case 'FINALIZED':    return <Badge tone="positive">Finalized</Badge>;
    default:             return <Badge>{status}</Badge>;
  }
}

// ── Summary panel ─────────────────────────────────────────────────────────────

interface SummaryPanelProps {
  classroom: { className: string; section: string } | undefined;
  academicYear: string;
  semester: Semester;
  subjects: SubjectFinalization[];
  requiredCount: number;
  onFinalizeClick: () => void;
  isFinalizing: boolean;
  isOversight: boolean;
}

function SummaryPanel({
  classroom,
  academicYear,
  semester,
  subjects,
  requiredCount,
  onFinalizeClick,
  isFinalizing,
  isOversight,
}: SummaryPanelProps) {
  const [showBlockers, setShowBlockers] = useState(false);

  const approvedCount   = subjects.filter((s) => s.status === 'APPROVED' || s.status === 'FINALIZED').length;
  const finalizedCount  = subjects.filter((s) => s.status === 'FINALIZED').length;
  const allFinalized    = finalizedCount === requiredCount && requiredCount > 0;
  const classroomFinalized = allFinalized;

  // Not-ready reasons
  const blockers: string[] = [];
  subjects.forEach((s) => {
    if (s.status === 'DRAFT')        blockers.push(`${s.subjectName}: Draft — not submitted for review`);
    if (s.status === 'UNDER_REVIEW') blockers.push(`${s.subjectName}: Under Review — awaiting approval`);
    if (s.missingResultsCount > 0)   blockers.push(`${s.subjectName}: ${s.missingResultsCount} student(s) missing results`);
    if (!s.teacherSubjectId)         blockers.push(`${s.subjectName}: No teacher assigned`);
  });

  const allApproved = subjects.length > 0 && subjects.every((s) => s.status === 'APPROVED' || s.status === 'FINALIZED');
  const readyToFinalize = allApproved && subjects.every((s) => s.missingResultsCount === 0);

  const totalStudents = subjects[0]?.studentCount ?? 0;
  const totalMissing  = subjects.reduce((acc, s) => acc + s.missingResultsCount, 0);

  // Status label
  let statusLabel = '';
  let statusTone: 'positive' | 'warning' | 'neutral' | 'danger' = 'neutral';
  let StatusIcon: React.ElementType = MdInfoOutline;

  if (classroomFinalized) {
    statusLabel = 'Finalized';
    statusTone  = 'positive';
    StatusIcon  = MdLock;
  } else if (readyToFinalize) {
    statusLabel = 'Ready for Finalization';
    statusTone  = 'positive';
    StatusIcon  = MdLockOpen;
  } else if (blockers.length > 0) {
    statusLabel = 'Not Ready';
    statusTone  = 'warning';
    StatusIcon  = MdWarningAmber;
  } else {
    statusLabel = 'Pending';
    statusTone  = 'neutral';
    StatusIcon  = MdInfoOutline;
  }

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-0.5">Finalization Summary</p>
          <p className="font-semibold text-ink-900">
            {classroom ? `${classroom.className} — Section ${classroom.section}` : '—'}
            <span className="ml-2 font-normal text-slate-500 text-sm">
              {academicYear} · {semesterLabel(semester)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon
            className={`h-4 w-4 ${
              statusTone === 'positive' ? 'text-pine-700' :
              statusTone === 'warning'  ? 'text-gold-600' :
              statusTone === 'danger'   ? 'text-danger-600' : 'text-slate-400'
            }`}
          />
          <Badge tone={statusTone === 'danger' ? 'warning' : statusTone}>{statusLabel}</Badge>
          {readyToFinalize && !classroomFinalized && isOversight && (
            <Button onClick={onFinalizeClick} isLoading={isFinalizing}>
              <MdLock className="h-3.5 w-3.5" /> Finalize Results
            </Button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Students',         value: totalStudents,                      color: '' },
          { label: 'Req. Subjects',    value: requiredCount,                      color: '' },
          { label: 'Approved',         value: `${approvedCount}/${requiredCount}`,color: approvedCount === requiredCount ? 'text-pine-700' : 'text-slate-700' },
          { label: 'Finalized',        value: `${finalizedCount}/${requiredCount}`,color: finalizedCount === requiredCount ? 'text-pine-700' : 'text-slate-700' },
          { label: 'Missing Results',  value: totalMissing,                       color: totalMissing > 0 ? 'text-gold-600' : 'text-slate-500' },
          { label: 'Draft',            value: subjects.filter((s) => s.status === 'DRAFT').length, color: 'text-slate-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p className={`text-xl font-bold text-ink-900 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Blockers */}
      {blockers.length > 0 && (
        <div className="border-t border-gold-100 bg-gold-50 px-5 py-3">
          <button
            type="button"
            onClick={() => setShowBlockers((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <MdWarningAmber className="h-4 w-4 shrink-0 text-gold-600" />
              <span className="text-sm font-semibold text-gold-700">
                Not ready for finalization — {blockers.length} issue{blockers.length > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-xs text-gold-600">{showBlockers ? 'Hide ▲' : 'Show ▼'}</span>
          </button>
          {showBlockers && (
            <ul className="mt-2 list-disc pl-8 space-y-1">
              {blockers.map((b, i) => (
                <li key={i} className="text-sm text-gold-800">{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Finalized info */}
      {classroomFinalized && (
        <div className="flex items-center gap-2 border-t border-pine-100 bg-pine-50 px-5 py-2.5">
          <MdCheckCircle className="h-4 w-4 text-pine-700 shrink-0" />
          <p className="text-sm text-pine-800 font-semibold">
            All subjects finalized — Academic Register is official.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FinalizationPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const isOversight = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(user?.role ?? '');
  const isTeacher   = user?.role === 'TEACHER';

  const { data: classroomsData } = useClassroomOptions();

  // ── Cascading filters ─────────────────────────────────────────────────────
  const [grade, setGrade]               = useState('');
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [classroomId, setClassroomId]   = useState<number>(0);
  const [semester, setSemester]         = useState<Semester>('SEMESTER_1');
  const [teacherFilter, setTeacherFilter] = useState('');

  // Academic years from classrooms
  const availableYears = useMemo(() => {
    const s = new Set<string>();
    classroomsData?.items.forEach((c) => s.add(c.academicYear));
    return Array.from(s).sort().reverse();
  }, [classroomsData]);

  // Sections filtered to grade + year
  const filteredClassrooms = useMemo(() => {
    if (!grade || !academicYear) return [];
    return (classroomsData?.items ?? []).filter(
      (c) => c.className === grade && c.academicYear === academicYear
    );
  }, [classroomsData, grade, academicYear]);

  const selectedClassroom = classroomsData?.items.find((c) => c.classroomId === classroomId);

  // Required subjects from GradeSubjectConfig
  const { data: configuredSubjects } = useGradeSubjectConfig(grade, academicYear);
  const requiredCount = configuredSubjects?.length ?? 0;
  const isGradeConfigured = Boolean(grade && academicYear && configuredSubjects !== undefined);
  void isGradeConfigured; // used implicitly via configuredSubjects.length

  // ── Data ─────────────────────────────────────────────────────────────────
  const {
    data: subjectFinalizations,
    isLoading,
    error,
    refetch,
  } = useClassroomSubjectFinalizations(classroomId, semester, academicYear);

  const submitForReview   = useSubmitForReview();
  const reviewSubject     = useReviewSubject();
  const finalizeSubject   = useFinalizeSubject();
  const finalizeClassroom = useFinalizeClassroom();

  const [actionError,           setActionError]           = useState<string | null>(null);
  const [classroomConfirmOpen,  setClassroomConfirmOpen]  = useState(false);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const displayedRows = useMemo(() => {
    if (!subjectFinalizations) return [];
    if (!teacherFilter) return subjectFinalizations;
    return subjectFinalizations.filter((f) =>
      f.teacherName.toLowerCase().includes(teacherFilter.toLowerCase())
    );
  }, [subjectFinalizations, teacherFilter]);

  const teacherNames = useMemo(() => {
    const s = new Set<string>();
    subjectFinalizations?.forEach((f) => {
      if (f.teacherName && f.teacherName !== '— No teacher assigned —') s.add(f.teacherName);
    });
    return Array.from(s).sort();
  }, [subjectFinalizations]);

  // ── Computed readiness ────────────────────────────────────────────────────
  const allApproved = (subjectFinalizations?.length ?? 0) > 0 &&
    subjectFinalizations?.every((s) => s.status === 'APPROVED' || s.status === 'FINALIZED') === true;
  const noMissingResults = subjectFinalizations?.every((s) => s.missingResultsCount === 0) === true;
  const readyToFinalize = allApproved && noMissingResults;
  const allFinalized    = subjectFinalizations?.every((s) => s.status === 'FINALIZED') === true &&
    (subjectFinalizations?.length ?? 0) > 0;
  // suppress unused-variable lint — both used inside SummaryPanel and isOversight guard
  void readyToFinalize; void allFinalized;

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleSubmitForReview(teacherSubjectId: number) {
    setActionError(null);
    try {
      await submitForReview.mutateAsync({ teacherSubjectId, semester, academicYear });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Submit failed.');
    }
  }

  async function handleApprove(teacherSubjectId: number) {
    setActionError(null);
    try {
      await reviewSubject.mutateAsync({ teacherSubjectId, semester, academicYear, approved: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approve failed.');
    }
  }

  async function handleReject(teacherSubjectId: number) {
    setActionError(null);
    try {
      await reviewSubject.mutateAsync({ teacherSubjectId, semester, academicYear, approved: false });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reject failed.');
    }
  }

  async function handleFinalizeSubject(teacherSubjectId: number) {
    setActionError(null);
    try {
      await finalizeSubject.mutateAsync({ teacherSubjectId, semester, academicYear });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Finalization failed.');
    }
  }

  async function handleFinalizeClassroom() {
    if (!classroomId) return;
    setActionError(null);
    try {
      await finalizeClassroom.mutateAsync({ classroomId, semester, academicYear });
      setClassroomConfirmOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Classroom finalization failed.');
      setClassroomConfirmOpen(false);
    }
  }

  function handleGradeChange(g: string) {
    setGrade(g);
    setClassroomId(0);
  }

  function handleYearChange(y: string) {
    setAcademicYear(y);
    setClassroomId(0);
  }

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: Column<SubjectFinalization>[] = [
    {
      header: 'Subject',
      render: (f) => (
        <div>
          <p className="font-medium text-ink-900">{f.subjectName}</p>
          {!f.teacherSubjectId && (
            <p className="text-xs text-gold-600">No teacher assigned</p>
          )}
        </div>
      ),
    },
    {
      header: 'Teacher',
      render: (f) => (
        <span className={f.teacherSubjectId ? 'text-slate-600' : 'text-slate-400 italic'}>
          {f.teacherName}
        </span>
      ),
    },
    { header: 'Status', render: (f) => statusBadge(f.status) },
    {
      header: 'Results',
      render: (f) => (
        <span className="font-mono text-sm">
          {f.studentCount - f.missingResultsCount}/{f.studentCount}
          {f.missingResultsCount > 0 && (
            <span className="ml-1 text-gold-600 text-xs">
              ({f.missingResultsCount} missing)
            </span>
          )}
        </span>
      ),
    },
    {
      header: 'Reviewed By',
      render: (f) =>
        f.reviewedByUser
          ? `${f.reviewedByUser.firstName} ${f.reviewedByUser.lastName}`
          : '—',
    },
    {
      header: 'Finalized At',
      render: (f) =>
        f.finalizedAt ? new Date(f.finalizedAt).toLocaleDateString() : '—',
    },
    {
      header: 'Actions',
      render: (f) => (
        <div className="flex flex-wrap gap-2">
          {isTeacher && f.status === 'DRAFT' && f.teacherSubjectId > 0 && (
            <Button
              onClick={() => void handleSubmitForReview(f.teacherSubjectId)}
              isLoading={submitForReview.isPending}
            >
              Submit
            </Button>
          )}
          {isOversight && f.status === 'UNDER_REVIEW' && (
            <>
              <Button
                variant="secondary"
                onClick={() => void handleApprove(f.teacherSubjectId)}
                isLoading={reviewSubject.isPending}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleReject(f.teacherSubjectId)}
                isLoading={reviewSubject.isPending}
              >
                Reject
              </Button>
            </>
          )}
          {isOversight && f.status === 'APPROVED' && (
            <Button
              onClick={() => void handleFinalizeSubject(f.teacherSubjectId)}
              isLoading={finalizeSubject.isPending}
            >
              Finalize
            </Button>
          )}
          {f.status === 'FINALIZED' && (
            <span className="text-xs italic text-slate-400">Finalized</span>
          )}
        </div>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Results Finalization</h1>
      <LedgerRule />

      {/* ── Filter card ── */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Classroom
        </p>
        <div className="flex flex-wrap items-end gap-3">

          <SelectField
            label="Academic Year"
            className="min-w-[160px]"
            value={academicYear}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            {availableYears.length === 0 && (
              <option value={currentAcademicYear()}>{currentAcademicYear()}</option>
            )}
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </SelectField>

          <SelectField
            label="Grade"
            className="min-w-[150px]"
            value={grade}
            onChange={(e) => handleGradeChange(e.target.value)}
          >
            <option value="">Select grade…</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectField>

          <SelectField
            label="Section"
            className="min-w-[160px]"
            value={classroomId || ''}
            onChange={(e) => setClassroomId(Number(e.target.value) || 0)}
            disabled={!grade || !academicYear}
          >
            <option value="">
              {!grade || !academicYear
                ? 'Select grade & year first…'
                : filteredClassrooms.length === 0
                ? 'No sections found'
                : 'Select section…'}
            </option>
            {filteredClassrooms.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.section}
                {c.homeroomTeacher
                  ? ` — ${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}`
                  : ''}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value as Semester)}
          >
            <option value="SEMESTER_1">Semester 1</option>
            <option value="SEMESTER_2">Semester 2</option>
          </SelectField>

          {teacherNames.length > 1 && (
            <SelectField
              label="Filter by Teacher"
              className="min-w-[200px]"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
            >
              <option value="">All teachers</option>
              {teacherNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </SelectField>
          )}
        </div>

        {/* Grade not configured warning */}
        {grade && academicYear && configuredSubjects !== undefined && configuredSubjects.length === 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5">
            <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <p className="text-sm text-gold-700">
              No required subjects configured for <strong>{grade}</strong> — <strong>{academicYear}</strong>.{' '}
              <button
                type="button"
                className="font-semibold underline hover:no-underline"
                onClick={() => navigate('/grade-subject-config')}
              >
                Configure Grade Subjects
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Errors */}
      {(error || actionError) && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5">
          <MdErrorOutline className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
          <p className="text-sm text-danger-600">
            {actionError ?? (error instanceof Error ? error.message : 'Failed to load data.')}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!classroomId && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
          <p className="font-semibold text-slate-600">Select a classroom to begin</p>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Choose an academic year, grade, section, and semester to review subject
            approval status and finalize the academic period.
          </p>
        </div>
      )}

      {/* Loading */}
      {classroomId > 0 && isLoading && (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
          Loading finalization data…
        </div>
      )}

      {/* Summary + table */}
      {classroomId > 0 && !isLoading && subjectFinalizations && (
        <>
          <SummaryPanel
            classroom={selectedClassroom}
            academicYear={academicYear}
            semester={semester}
            subjects={subjectFinalizations}
            requiredCount={requiredCount}
            onFinalizeClick={() => setClassroomConfirmOpen(true)}
            isFinalizing={finalizeClassroom.isPending}
            isOversight={isOversight}
          />

          {/* Count bar */}
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span><strong>{displayedRows.length}</strong> subject{displayedRows.length !== 1 ? 's' : ''}{teacherFilter ? ' (filtered)' : ''}</span>
            <span className="text-pine-700"><strong>{displayedRows.filter((f) => f.status === 'APPROVED').length}</strong> approved</span>
            <span className="text-gold-600"><strong>{displayedRows.filter((f) => f.status === 'UNDER_REVIEW').length}</strong> under review</span>
            <span className="text-slate-400"><strong>{displayedRows.filter((f) => f.status === 'DRAFT').length}</strong> draft</span>
          </div>

          <Table
            columns={columns}
            rows={displayedRows}
            getRowKey={(f) => `${f.id}-${f.teacherSubjectId}`}
            emptyMessage="No subjects match the selected filters."
            error={error}
            onRetry={() => void refetch()}
          />

          {/* Legend */}
          {subjectFinalizations.some((s) => !s.teacherSubjectId) && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gold-600">
              <MdWarningAmber className="h-3.5 w-3.5" />
              Subjects with no teacher assigned are required by Grade Subject Configuration but cannot be submitted or finalized until a teacher is assigned.
            </p>
          )}
        </>
      )}

      {/* Finalize classroom confirm */}
      <ConfirmDialog
        isOpen={classroomConfirmOpen}
        title="Finalize classroom results"
        message={[
          `Finalize ${selectedClassroom ? `${selectedClassroom.className} ${selectedClassroom.section}` : 'this classroom'}`,
          `Academic Year: ${academicYear}`,
          `Semester: ${semesterLabel(semester)}`,
          `Required subjects: ${requiredCount}`,
          `Students: ${subjectFinalizations?.[0]?.studentCount ?? 0}`,
          '',
          'All required subjects are approved. Students and parents will be notified. This action is recorded in the audit log.',
        ].join('\n')}
        confirmLabel="Finalize"
        isDangerous={false}
        isLoading={finalizeClassroom.isPending}
        onConfirm={() => void handleFinalizeClassroom()}
        onCancel={() => setClassroomConfirmOpen(false)}
      />
    </div>
  );
}
