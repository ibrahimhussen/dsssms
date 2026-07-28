import { useState } from 'react';
import clsx from 'clsx';
import { useMyClassrooms } from '../../hooks/useMyClassrooms';
import { useStudents } from '../../hooks/useStudents';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { StudentProfileModal } from './StudentProfileModal';
import type { StudentSummary } from '../../types/student';

export function MyClassesPage() {
  const { data: classrooms, isLoading: isClassroomsLoading } = useMyClassrooms();
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | undefined>(undefined);
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);

  const selectedClassroom = classrooms?.find((c) => c.classroomId === selectedClassroomId);

  const { data: rosterData, isLoading: isRosterLoading } = useStudents(
    { classroomId: selectedClassroomId, limit: 100 },
    { enabled: Boolean(selectedClassroomId) }
  );

  const columns: Column<StudentSummary>[] = [
    { header: 'Name', render: (s) => `${s.firstName} ${s.lastName}` },
    { header: 'Admission No.', className: 'font-mono text-[0.8125rem]', render: (s) => s.admissionNumber },
    { header: 'Gender', render: (s) => (s.gender === 'M' ? 'Male' : 'Female') },
    {
      header: 'Guardian contact',
      render: (s) =>
        s.parents.length > 0
          ? s.parents.map((p) => `${p.fullName}${p.phoneNumber ? ` (${p.phoneNumber})` : ''}`).join(', ')
          : '—',
    },
    {
      header: '',
      className: 'text-right',
      render: (s) => (
        <Button variant="ghost" onClick={() => setSelectedStudent(s)}>
          View profile
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">My classes &amp; students</h1>
      <LedgerRule />

      {isClassroomsLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !classrooms || classrooms.length === 0 ? (
        <EmptyState
          title="No teaching assignments yet"
          description="An administrator hasn't assigned you to any subject or classroom yet."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {classrooms.map((c) => (
              <button key={c.classroomId} type="button" onClick={() => setSelectedClassroomId(c.classroomId)}>
                <Card
                  className={clsx(
                    'h-full cursor-pointer text-left transition-shadow hover:shadow-md',
                    selectedClassroomId === c.classroomId && 'border-pine-700 ring-2 ring-pine-700/30'
                  )}
                >
                  <p className="font-display text-lg font-semibold text-ink-900">
                    {c.className} {c.section}
                  </p>
                  <p className="mb-2 text-[0.8125rem] text-slate-500">{c.academicYear}</p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {c.subjects.map((s) => (
                      <Badge key={s.subjectId}>{s.subjectName}</Badge>
                    ))}
                  </div>
                  <p className="text-[0.8125rem] text-slate-500">{c.studentCount} student(s) enrolled</p>
                </Card>
              </button>
            ))}
          </div>

          {!selectedClassroomId ? (
            <EmptyState title="Select a class above" description="Choose one of your classes to view its roster." />
          ) : (
            <>
              <h2 className="mb-3 text-lg">
                Roster — {selectedClassroom?.className} {selectedClassroom?.section}
              </h2>
              <Table
                columns={columns}
                rows={rosterData?.items ?? []}
                getRowKey={(s) => s.studentId}
                isLoading={isRosterLoading}
                emptyMessage="This classroom has no enrolled students yet."
              />
            </>
          )}
        </>
      )}

      <StudentProfileModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
    </div>
  );
}
