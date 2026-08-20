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
import { StudentDetailModal } from './StudentDetailModal';
import { ClassCredentialsModal } from './ClassCredentialsModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import type { StudentSummary, CreateStudentResult, ListStudentsParams, StudentStatus } from '../../types/student';


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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [filters, setFilters] = useState<ListStudentsParams>({
    page: 1,
    limit: 20,
    studentStatus: 'ACTIVE', // default to active students only
  });
  const [isNewOpen, setNewOpen] = useState(false);
  const [isTransferAdmissionOpen, setTransferAdmissionOpen] = useState(false);
  const [isBulkOpen, setBulkOpen] = useState(false);
  const [transferOutTarget, setTransferOutTarget] = useState<StudentSummary | null>(null);
  const [detailTarget, setDetailTarget] = useState<StudentSummary | null>(null);
  const [isCredentialsOpen, setCredentialsOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<StudentSummary | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<CredentialsItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<StudentSummary | null>(null);

  const { data, isLoading, error, refetch } = useStudents(filters);
  const { data: classroomsData } = useClassroomOptions();

  async function handleResetPassword(student: StudentSummary) {
    setResetTarget(student);
    setResetResult(null);
    setResetError(null);
  }

  async function confirmResetPassword() {
    if (!resetTarget) return;
    setIsResetting(true);
    setResetError(null);
    try {
      const result = await studentsApi.resetStudentPassword(resetTarget.studentId);
      setResetResult(result);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Reset failed. Please try again.');
    } finally {
      setIsResetting(false);
    }
  }

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
          <Button variant="ghost" onClick={() => setDetailTarget(s)}>
            View profile
          </Button>
          {s.parents.length > 0 && (
            <Button variant="ghost" onClick={() => setMessageTarget(s)}>
              Message parents
            </Button>
          )}
          {s.studentStatus === 'ACTIVE' && isAdmin && (
            <Button variant="ghost" onClick={() => void handleResetPassword(s)}>
              Reset password
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

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(
          [
            { label: 'Active',         value: 'ACTIVE'          },
            { label: 'Graduated',      value: 'GRADUATED'       },
            { label: 'Transferred Out', value: 'TRANSFERRED_OUT' },
            { label: 'All',            value: undefined          },
          ] as { label: string; value: StudentStatus | undefined }[]
        ).map(({ label, value }) => {
          const isActive = filters.studentStatus === value;
          return (
            <button
              key={label}
              type="button"
              onClick={() => updateFilter('studentStatus', value)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-pine-700 text-pine-800'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

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
          {filters.classroomId && isAdmin && (
            <Button variant="secondary" onClick={() => setCredentialsOpen(true)}>
              Class Credentials
            </Button>
          )}
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
      <StudentDetailModal student={detailTarget} onClose={() => setDetailTarget(null)} />
      <ClassCredentialsModal
        classroomId={isCredentialsOpen ? (filters.classroomId ?? null) : null}
        classroomLabel={
          classroomsData?.items.find((c) => c.classroomId === filters.classroomId)
            ? `${classroomsData.items.find((c) => c.classroomId === filters.classroomId)!.className} ${classroomsData.items.find((c) => c.classroomId === filters.classroomId)!.section}`
            : 'Class'
        }
        onClose={() => setCredentialsOpen(false)}
      />

      <CredentialsDialog isOpen={issuedCredentials.length > 0} onClose={() => setIssuedCredentials([])} items={issuedCredentials} />
      <MessageParentsModal student={messageTarget} onClose={() => setMessageTarget(null)} />

      {/* Reset password confirm */}
      <ConfirmDialog
        isOpen={Boolean(resetTarget) && !resetResult}
        title="Reset student password"
        message={resetTarget
          ? `Reset the password for ${resetTarget.firstName} ${resetTarget.lastName} (${resetTarget.admissionNumber})?\n\nA new temporary password will be generated. Their current password will be invalidated and all active sessions will end. They must change the new password on first login.`
          : ''}
        confirmLabel="Reset Password"
        isDangerous={false}
        isLoading={isResetting}
        onConfirm={() => void confirmResetPassword()}
        onCancel={() => { setResetTarget(null); setResetError(null); }}
      />

      {/* Show reset result */}
      {resetResult && resetTarget && (
        <Modal
          title="Password Reset Successful"
          isOpen={true}
          onClose={() => { setResetTarget(null); setResetResult(null); }}
          widthClassName="max-w-[460px]"
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-pine-200 bg-pine-50 p-4">
              <p className="text-xs uppercase tracking-wide text-pine-600 mb-3 font-semibold">New credentials</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Student</span>
                  <span className="font-medium text-ink-900">{resetTarget.firstName} {resetTarget.lastName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Student ID</span>
                  <span className="font-mono text-sm font-semibold text-pine-700">{resetTarget.admissionNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Username</span>
                  <span className="font-mono text-sm font-semibold text-pine-700">{resetResult.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Temporary Password</span>
                  <span className="font-mono text-base font-bold text-ink-900 tracking-wider bg-slate-100 rounded px-2 py-0.5">
                    {resetResult.temporaryPassword}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gold-700 bg-gold-50 border border-gold-200 rounded-lg px-3 py-2">
              ⚠ This password will not be shown again. Give it to the student now and ask them to log in and change it immediately.
            </p>
            {resetError && (
              <p className="text-sm text-danger-600">{resetError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const w = window.open('', '_blank');
                  if (!w) return;
                  w.document.write(`<!DOCTYPE html><html><head><title>Password Reset</title>
                  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:400px}
                  h2{margin-bottom:16px}table{width:100%;border-collapse:collapse}
                  td{padding:8px 0;border-bottom:1px solid #eee}
                  .mono{font-family:monospace;font-weight:bold;font-size:14px}
                  .warn{background:#fff3cd;border:1px solid #ffc107;padding:8px;border-radius:4px;font-size:11px;margin-top:16px}
                  </style></head><body>
                  <h2>Password Reset — DSSSMS</h2>
                  <table>
                    <tr><td>Student</td><td class="mono">${resetTarget.firstName} ${resetTarget.lastName}</td></tr>
                    <tr><td>Student ID</td><td class="mono">${resetTarget.admissionNumber}</td></tr>
                    <tr><td>Username</td><td class="mono">${resetResult.username}</td></tr>
                    <tr><td>Temp Password</td><td class="mono">${resetResult.temporaryPassword}</td></tr>
                  </table>
                  <div class="warn">⚠ Change this password on first login. Do not share publicly.</div>
                  </body></html>`);
                  w.document.close();
                  w.focus();
                  setTimeout(() => w.print(), 300);
                }}
              >
                Print
              </Button>
              <Button onClick={() => { setResetTarget(null); setResetResult(null); }}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
