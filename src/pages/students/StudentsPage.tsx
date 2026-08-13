import { useState } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { studentsApi } from '../../lib/students-api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { CredentialsDialog } from '../../components/ui/CredentialsDialog';
import type { CredentialsItem } from '../../components/ui/CredentialsDialog';
import { MessageParentsModal } from './MessageParentsModal';
import { NewAdmissionModal } from './NewAdmissionModal';
import { TransferAdmissionModal } from './TransferAdmissionModal';
import { TransferOutModal } from './TransferOutModal';
import { BulkImportModal } from './BulkImportModal';
import type { StudentSummary, CreateStudentResult, ListStudentsParams } from '../../types/student';

function admissionBadge(type: StudentSummary['admissionType']) {
  return type === 'TRANSFER' ? (
    <Badge tone="warning">Transfer</Badge>
  ) : (
    <Badge tone="positive">New</Badge>
  );
}

function statusBadge(status: StudentSummary['studentStatus']) {
  switch (status) {
    case 'ACTIVE':       return <Badge tone="positive">Active</Badge>;
    case 'GRADUATED':    return <Badge tone="warning">Graduated</Badge>;
    case 'SUSPENDED':    return <Badge tone="danger">Suspended</Badge>;
    case 'TRANSFERRED_OUT': return <Badge tone="danger">Transferred Out</Badge>;
    default:             return null;
  }
}

export function StudentsPage() {
  const [filters, setFilters] = useState<ListStudentsParams>({ page: 1, limit: 20 });
  const [isNewOpen, setNewOpen] = useState(false);
  const [isTransferAdmissionOpen, setTransferAdmissionOpen] = useState(false);
  const [isBulkOpen, setBulkOpen] = useState(false);
  const [transferOutTarget, setTransferOutTarget] = useState<StudentSummary | null>(null);
  const [issuedCredentials, setIssuedCredentials] = useState<CredentialsItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<StudentSummary | null>(null);

  const { data, isLoading, error, refetch } = useStudents(filters);
  const { data: classroomsData } = useClassroomOptions();

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    try {
      await studentsApi.exportToExcel({ classroomId: filters.classroomId, search: filters.search });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  function updateFilter<K extends keyof ListStudentsParams>(key: K, value: ListStudentsParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleCreated(result: CreateStudentResult) {
    setNewOpen(false);
    setTransferAdmissionOpen(false);
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
    { header: 'Type', render: (s) => admissionBadge(s.admissionType) },
    { header: 'Status', render: (s) => statusBadge(s.studentStatus) },
    {
      header: 'Guardians',
      render: (s) => (s.parents.length > 0 ? s.parents.map((p) => p.fullName).join(', ') : '—'),
    },
    {
      header: 'Actions',
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.parents.length > 0 && (
            <Button variant="ghost" onClick={() => setMessageTarget(s)}>
              Message parents
            </Button>
          )}
          {s.studentStatus === 'ACTIVE' && (
            <Button variant="ghost" onClick={() => setTransferOutTarget(s)}>
              Transfer out
            </Button>
          )}
        </div>
      ),
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

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void handleExport()} isLoading={isExporting}>
            Export to Excel
          </Button>
          <Button variant="secondary" onClick={() => setBulkOpen(true)}>
            Bulk Import
          </Button>
          <Button variant="secondary" onClick={() => setTransferAdmissionOpen(true)}>
            Transfer Student Admission
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            New Student Admission
          </Button>
        </div>
      </div>

      {exportError && <ErrorMessage error={new Error(exportError)} className="mb-4" />}

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(s) => s.studentId}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        emptyMessage="No students match these filters."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}

      <NewAdmissionModal isOpen={isNewOpen} onClose={() => setNewOpen(false)} onCreated={handleCreated} />
      <TransferAdmissionModal isOpen={isTransferAdmissionOpen} onClose={() => setTransferAdmissionOpen(false)} onCreated={handleCreated} />
      <BulkImportModal isOpen={isBulkOpen} onClose={() => setBulkOpen(false)} />
      <TransferOutModal student={transferOutTarget} onClose={() => setTransferOutTarget(null)} />

      <CredentialsDialog isOpen={issuedCredentials.length > 0} onClose={() => setIssuedCredentials([])} items={issuedCredentials} />
      <MessageParentsModal student={messageTarget} onClose={() => setMessageTarget(null)} />
    </div>
  );
}
