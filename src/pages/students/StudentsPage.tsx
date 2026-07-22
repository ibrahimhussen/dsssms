import { useState } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { CredentialsDialog } from '../../components/ui/CredentialsDialog';
import type { CredentialsItem } from '../../components/ui/CredentialsDialog';
import { CreateStudentModal } from './CreateStudentModal';
import type { StudentSummary, CreateStudentResult, ListStudentsParams } from '../../types/student';

export function StudentsPage() {
  const [filters, setFilters] = useState<ListStudentsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<CredentialsItem[]>([]);

  const { data, isLoading } = useStudents(filters);
  const { data: classroomsData } = useClassroomOptions();

  function updateFilter<K extends keyof ListStudentsParams>(key: K, value: ListStudentsParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleCreated(result: CreateStudentResult) {
    setCreateOpen(false);
    const items: CredentialsItem[] = [
      {
        label: `Student — ${result.student.firstName} ${result.student.lastName}`,
        username: result.credentials.username,
        temporaryPassword: result.credentials.temporaryPassword,
      },
      ...result.guardianCredentials.map((g) => ({
        label: `Guardian — ${g.fullName}`,
        username: g.username,
        temporaryPassword: g.temporaryPassword,
      })),
    ];
    setIssuedCredentials(items);
  }

  const columns: Column<StudentSummary>[] = [
    { header: 'Name', render: (s) => `${s.firstName} ${s.lastName}` },
    { header: 'Admission No.', className: 'font-mono text-[0.8125rem]', render: (s) => s.admissionNumber },
    {
      header: 'Classroom',
      render: (s) => `${s.classroom.className} ${s.classroom.section} (${s.classroom.academicYear})`,
    },
    { header: 'Gender', render: (s) => (s.gender === 'M' ? 'Male' : 'Female') },
    {
      header: 'Guardians',
      render: (s) => (s.parents.length > 0 ? s.parents.map((p) => p.fullName).join(', ') : '—'),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Students</h1>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Classroom"
            className="min-w-[200px]"
            value={filters.classroomId ?? ''}
            onChange={(e) => updateFilter('classroomId', e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All classrooms</option>
            {classroomsData?.items.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.className} {c.section} ({c.academicYear})
              </option>
            ))}
          </SelectField>

          <TextField
            label="Search"
            className="min-w-[220px]"
            placeholder="Name or admission number"
            defaultValue={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
          />
        </div>

        <Button onClick={() => setCreateOpen(true)}>Register student</Button>
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(s) => s.studentId}
        isLoading={isLoading}
        emptyMessage="No students match these filters."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}

      <CreateStudentModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />

      <CredentialsDialog isOpen={issuedCredentials.length > 0} onClose={() => setIssuedCredentials([])} items={issuedCredentials} />
    </div>
  );
}
