import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/Card';
import { useStudentAttendanceSummary } from '../../hooks/useAttendance';
import type { StudentSummary } from '../../types/student';

const RELATIONSHIP_LABELS: Record<string, string> = {
  FATHER: 'Father',
  MOTHER: 'Mother',
  GUARDIAN: 'Guardian',
  OTHER: 'Other',
};

interface StudentProfileModalProps {
  student: StudentSummary | null;
  onClose: () => void;
}

export function StudentProfileModal({ student, onClose }: StudentProfileModalProps) {
  const { data: summary, isLoading } = useStudentAttendanceSummary(student?.studentId);

  return (
    <Modal
      title={student ? `${student.firstName} ${student.lastName}` : 'Student'}
      isOpen={Boolean(student)}
      onClose={onClose}
      widthClassName="max-w-[560px]"
    >
      {student && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-slate-500">Admission No.</span>
              <p className="font-mono text-ink-900">{student.admissionNumber}</p>
            </div>
            <div>
              <span className="text-slate-500">Gender</span>
              <p className="text-ink-900">{student.gender === 'M' ? 'Male' : 'Female'}</p>
            </div>
            <div>
              <span className="text-slate-500">Date of birth</span>
              <p className="text-ink-900">{new Date(student.dateOfBirth).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-slate-500">Enrolled</span>
              <p className="text-ink-900">{new Date(student.enrolledAt).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-slate-500">Classroom</span>
              <p className="text-ink-900">
                {student.classroom.className} {student.classroom.section} ({student.classroom.academicYear})
              </p>
            </div>
            {student.address && (
              <div>
                <span className="text-slate-500">Address</span>
                <p className="text-ink-900">{student.address}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-700">Guardians</h3>
            {student.parents.length === 0 ? (
              <p className="text-sm text-slate-500">No guardian on file.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {student.parents.map((p) => (
                  <li key={p.parentId} className="rounded-lg border border-paper-100 px-3 py-2 text-sm">
                    <span className="font-semibold text-ink-900">{p.fullName}</span>{' '}
                    <span className="text-slate-500">
                      ({RELATIONSHIP_LABELS[p.relationship] ?? p.relationship})
                      {p.phoneNumber ? ` · ${p.phoneNumber}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-700">Attendance</h3>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Present" value={summary?.present ?? 0} />
                <StatCard label="Absent" value={summary?.absent ?? 0} />
                <StatCard label="Rate" value={`${summary?.presentPercentage ?? 0}%`} />
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
