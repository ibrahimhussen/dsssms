import { useState } from 'react';
import {
  MdPerson,
  MdSchool,
  MdHistory,
  MdInfo,
  MdCheckCircle,
  MdWarningAmber,
} from 'react-icons/md';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useStudent, useStudentEnrollmentHistory } from '../../hooks/useStudents';
import type { StudentSummary } from '../../types/student';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: StudentSummary['studentStatus']) {
  switch (status) {
    case 'ACTIVE':          return <Badge tone="positive">Active</Badge>;
    case 'GRADUATED':       return <Badge tone="warning">Graduated</Badge>;
    case 'SUSPENDED':       return <Badge tone="danger">Suspended</Badge>;
    case 'TRANSFERRED_OUT': return <Badge tone="danger">Transferred Out</Badge>;
    default:                return null;
  }
}

function decisionLabel(decision: string) {
  switch (decision) {
    case 'ACTIVE':          return { label: 'Active enrollment', tone: 'positive' as const };
    case 'PROMOTED':        return { label: 'Promoted',          tone: 'positive' as const };
    case 'REPEATED':        return { label: 'Repeated year',     tone: 'warning'  as const };
    case 'GRADUATED':       return { label: 'Graduated',         tone: 'positive' as const };
    case 'TRANSFERRED_OUT': return { label: 'Transferred out',   tone: 'danger'   as const };
    case 'CORRECTED':       return { label: 'Corrected',         tone: 'neutral'  as const };
    default:                return { label: decision,            tone: 'neutral'  as const };
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'history' | 'previous';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-pine-700 text-pine-800'
          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="min-w-[180px] shrink-0 text-[0.8125rem] text-slate-500">{label}</span>
      <span className="text-[0.875rem] text-ink-900">{value ?? '—'}</span>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  student: StudentSummary | null;
  onClose: () => void;
}

export function StudentDetailModal({ student, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const { data: fullStudent } = useStudent(student?.studentId ?? null);
  const { data: enrollments, isLoading: enrollmentsLoading } =
    useStudentEnrollmentHistory(student?.studentId ?? null);

  // Use full detail if loaded, fall back to the list summary
  const s = fullStudent ?? student;

  if (!s) return null;

  const hasPreviousInfo = Boolean(
    s.previousSchoolName ||
    s.lastGradeCompleted ||
    s.previousAcademicSummary
  );

  // Parse previousAcademicSummary if it's a structured object
  const prevSummary = s.previousAcademicSummary as Record<string, unknown> | null | undefined;
  const prevSubjects = Array.isArray((prevSummary as any)?.subjects)
    ? ((prevSummary as any).subjects as { subjectName: string; mark: number; grade: string }[])
    : null;

  return (
    <Modal
      title={`${s.firstName} ${s.lastName}`}
      isOpen={Boolean(student)}
      onClose={onClose}
      widthClassName="max-w-[680px]"
    >
      {/* Student header */}
      <div className="mb-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-paper-50 px-4 py-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-100 shrink-0">
          <MdPerson className="h-6 w-6 text-pine-700" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{s.firstName} {s.lastName}</p>
          <p className="font-mono text-xs text-slate-500">{s.admissionNumber}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {statusBadge(s.studentStatus)}
            <Badge tone={s.admissionType === 'TRANSFER' ? 'warning' : 'positive'}>
              {s.admissionType === 'TRANSFER' ? 'Transfer' : 'New Admission'}
            </Badge>
          </div>
        </div>
        <div className="ml-auto text-right text-sm text-slate-500 shrink-0">
          <p className="font-medium text-ink-900">{s.classroom.className} {s.classroom.section}</p>
          <p>{s.classroom.academicYear}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex border-b border-slate-200">
        <TabButton
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          icon={<MdPerson className="h-4 w-4" />}
          label="Profile"
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          icon={<MdHistory className="h-4 w-4" />}
          label="Enrollment History"
        />
        {hasPreviousInfo && (
          <TabButton
            active={activeTab === 'previous'}
            onClick={() => setActiveTab('previous')}
            icon={<MdSchool className="h-4 w-4" />}
            label="Previous Records"
          />
        )}
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <div>
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
            Personal Information
          </p>
          <div className="rounded-xl border border-slate-200 bg-white px-4 mb-4">
            <Field label="Full name"       value={`${s.firstName} ${s.lastName}`} />
            <Field label="Gender"          value={s.gender === 'M' ? 'Male' : 'Female'} />
            <Field label="Date of birth"   value={new Date(s.dateOfBirth).toLocaleDateString()} />
            <Field label="Address"         value={s.address} />
            <Field label="Admission No."   value={<span className="font-mono">{s.admissionNumber}</span>} />
            <Field label="Enrolled"        value={new Date(s.enrolledAt).toLocaleDateString()} />
            <Field label="Username"        value={<span className="font-mono">{s.username}</span>} />
          </div>

          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
            Current Enrollment
          </p>
          <div className="rounded-xl border border-slate-200 bg-white px-4 mb-4">
            <Field label="Classroom"       value={`${s.classroom.className} ${s.classroom.section}`} />
            <Field label="Academic year"   value={s.classroom.academicYear} />
          </div>

          {s.parents.length > 0 && (
            <>
              <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                Guardians
              </p>
              <div className="rounded-xl border border-slate-200 bg-white px-4">
                {s.parents.map((p) => (
                  <div key={p.parentId} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-ink-900 font-medium">{p.fullName}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {p.phoneNumber && <span>{p.phoneNumber}</span>}
                      <Badge tone="neutral">{p.relationship}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Transfer-out info */}
          {s.studentStatus === 'TRANSFERRED_OUT' && s.transferredOutAt && (
            <div className="mt-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
              <p className="text-sm font-semibold text-danger-700 mb-1">Transferred Out</p>
              <Field label="Date"        value={new Date(s.transferredOutAt).toLocaleDateString()} />
              <Field label="Destination" value={s.transferredOutDestination} />
              <Field label="Reason"      value={s.transferredOutReason} />
            </div>
          )}
        </div>
      )}

      {/* ── Enrollment history tab ── */}
      {activeTab === 'history' && (
        <div>
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <MdInfo className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500">
              One row per academic year. This is the authoritative enrollment history.
              Promotion, repetition, and graduation decisions are recorded here.
            </p>
          </div>

          {enrollmentsLoading ? (
            <div className="flex items-center gap-2 py-8 text-slate-500 text-sm">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
              Loading enrollment history…
            </div>
          ) : !enrollments || enrollments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center">
              <p className="text-sm text-slate-500">No enrollment history yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Enrollment records are created on admission and updated through the Promotion workflow.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-paper-100 text-left text-xs uppercase tracking-wide text-ink-700">
                    <th className="px-4 py-2.5">Academic Year</th>
                    <th className="px-4 py-2.5">Grade / Section</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const d = decisionLabel(e.decision);
                    return (
                      <tr key={e.id} className="border-t border-slate-100 hover:bg-paper-50">
                        <td className="px-4 py-2.5 font-medium">{e.academicYear}</td>
                        <td className="px-4 py-2.5">{e.className} {e.section}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={d.tone}>{d.label}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{e.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Previous academic records tab ── */}
      {activeTab === 'previous' && (
        <div>
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <MdInfo className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500">
              Previous school and academic history recorded at admission.
              This information is separate from the student's current academic results at this school.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 mb-4">
            <Field label="Previous school"    value={s.previousSchoolName} />
            <Field label="School type"        value={s.previousSchoolType} />
            <Field label="School location"    value={s.previousSchoolLocation} />
            <Field label="Last grade completed" value={s.lastGradeCompleted} />
            <Field label="Completion year"    value={s.completionYear} />
            {s.admissionType === 'TRANSFER' && (
              <>
                <Field label="Previous student ID"   value={s.previousStudentId} />
                <Field label="Transfer certificate"  value={s.transferCertificateRef} />
                <Field label="Transfer reason"       value={s.transferReason} />
              </>
            )}
          </div>

          {/* Structured previous subject results */}
          {prevSubjects && prevSubjects.length > 0 && (
            <>
              <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                Previous Academic Performance — {s.lastGradeCompleted ?? 'Prior Grade'}
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-paper-100 text-left text-xs uppercase tracking-wide text-ink-700">
                      <th className="px-4 py-2.5">Subject</th>
                      <th className="px-4 py-2.5 text-right">Mark</th>
                      <th className="px-4 py-2.5">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prevSubjects.map((sub, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2">{sub.subjectName}</td>
                        <td className="px-4 py-2 text-right font-mono">{sub.mark}</td>
                        <td className="px-4 py-2 font-medium">
                          {Number(sub.mark) >= 50
                            ? <span className="text-pine-700">{sub.grade || 'Pass'}</span>
                            : <span className="text-danger-600">{sub.grade || 'Fail'}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(prevSummary as any)?.overallAverage && (
                <p className="mt-2 text-right text-sm text-slate-600">
                  Overall average: <strong className="text-ink-900">{(prevSummary as any).overallAverage}</strong>
                </p>
              )}
            </>
          )}

          {/* Unstructured summary fallback */}
          {prevSummary && !prevSubjects && (
            <div className="rounded-xl border border-slate-200 bg-paper-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                Previous Academic Summary
              </p>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                {JSON.stringify(prevSummary, null, 2)}
              </pre>
            </div>
          )}

          {!hasPreviousInfo && (
            <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center">
              <p className="text-sm text-slate-500">No previous records recorded.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
