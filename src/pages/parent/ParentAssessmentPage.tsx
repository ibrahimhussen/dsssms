import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMyParentProfile } from '../../hooks/useParents';
import { useStudentGrades } from '../../hooks/useGrades';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { SelectField } from '../../components/ui/SelectField';
import { EmptyState } from '../../components/ui/EmptyState';
import type { GradeCategory, Semester } from '../../types/grade';

const SEMESTER_LABELS: Record<Semester, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

const CATEGORY_LABELS: Record<GradeCategory, string> = {
  QUIZ: 'Quiz', ASSIGNMENT: 'Assignment', TEST: 'Test',
  MID_EXAM: 'Mid Exam', FINAL_EXAM: 'Final Exam', OTHER: 'Other',
};

const CATEGORY_STYLE: Record<GradeCategory, string> = {
  QUIZ:       'bg-sky-100 text-sky-800',
  ASSIGNMENT: 'bg-violet-100 text-violet-800',
  TEST:       'bg-amber-100 text-amber-800',
  MID_EXAM:   'bg-orange-100 text-orange-800',
  FINAL_EXAM: 'bg-pine-100 text-pine-800',
  OTHER:      'bg-slate-100 text-slate-700',
};

export function ParentAssessmentPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useMyParentProfile();

  const selectedId = searchParams.get('studentId')
    ? Number(searchParams.get('studentId'))
    : profile?.children[0]?.studentId;

  const [semester, setSemester] = useState<Semester | ''>('');
  const [academicYear, setAcademicYear] = useState<string>('');

  const { data: gradesData, isLoading: gradesLoading } = useStudentGrades(
    selectedId,
    {
      semester:     semester     || undefined,
      academicYear: academicYear || undefined,
    }
  );

  const availableYears = useMemo(() => {
    const years = new Set((gradesData ?? []).map((g) => g.academicYear));
    return [...years].sort().reverse();
  }, [gradesData]);

  const selectedChild = profile?.children.find((c) => c.studentId === selectedId);

  if (profileLoading) return (
    <div className="flex items-center gap-2 py-16 text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
      <span className="text-sm">Loading…</span>
    </div>
  );

  if (!profile?.children.length) return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-ink-900">Assessment</h1>
      <LedgerRule />
      <EmptyState title="No children linked" description="Contact the school to link your children to your account." />
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`/parent/children`}
            className="mb-1 inline-flex items-center text-xs font-medium text-slate-500 hover:text-pine-700"
          >
            ← Academic Overview
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900">Assessment</h1>
          {selectedChild && (
            <p className="mt-0.5 text-sm text-slate-500">
              {selectedChild.firstName} {selectedChild.lastName} · {selectedChild.admissionNumber}
            </p>
          )}
        </div>
        {profile.children.length > 1 && (
          <SelectField label="Child" className="min-w-[200px]"
            value={selectedId ?? ''}
            onChange={(e) => setSearchParams({ studentId: e.target.value })}>
            {profile.children.map((c) => (
              <option key={c.studentId} value={c.studentId}>{c.firstName} {c.lastName}</option>
            ))}
          </SelectField>
        )}
      </div>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField label="Semester" className="min-w-[150px]"
          value={semester}
          onChange={(e) => setSemester(e.target.value as Semester | '')}>
          <option value="">All semesters</option>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>
        <SelectField label="Academic Year" className="min-w-[150px]"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}>
          <option value="">All years</option>
          {availableYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
        </SelectField>
      </div>

      {gradesLoading ? (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading assessments…</span>
        </div>
      ) : !gradesData || gradesData.length === 0 ? (
        <EmptyState title="No assessments" description="No released assessment results are available yet." />
      ) : (
        <div className="flex flex-col gap-4">
          {gradesData.map((subject) => (
            <div key={`${subject.teacherSubjectId}-${subject.semester}-${subject.academicYear}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-[0.9375rem] font-semibold text-ink-900">{subject.subject.subjectName}</p>
                  <p className="mt-0.5 text-[0.75rem] text-slate-400">
                    {subject.academicYear} · {SEMESTER_LABELS[subject.semester]} · {subject.teacher.firstName} {subject.teacher.lastName}
                  </p>
                </div>
              </div>
              {subject.components.length === 0 ? (
                <p className="px-4 py-3 text-sm italic text-slate-400">No assessments defined yet.</p>
              ) : (
                <>
                  <ul>
                    {subject.components.map((c, idx) => (
                      <li key={c.gradeComponentId}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 ${idx < subject.components.length - 1 ? 'border-b border-slate-100' : ''}`}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${CATEGORY_STYLE[c.category]}`}>
                            {CATEGORY_LABELS[c.category]}
                          </span>
                          <span className="truncate text-sm text-ink-800">{c.name}</span>
                        </div>
                        <div className="shrink-0">
                          {c.isReleased && c.score !== null ? (
                            <span className="font-mono text-[0.9375rem] font-semibold text-ink-900">
                              {c.score}<span className="text-sm font-normal text-slate-400">/{c.maxMarks}</span>
                            </span>
                          ) : (
                            <span className="font-mono text-sm text-slate-300">—/{c.maxMarks}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {subject.totalMaxMarks > 0 && (
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</span>
                      <span className="font-mono text-base font-bold text-ink-900">
                        {subject.totalScore}<span className="text-sm font-normal text-slate-400">/{subject.totalMaxMarks}</span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
