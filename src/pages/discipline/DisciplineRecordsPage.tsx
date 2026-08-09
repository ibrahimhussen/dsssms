import { useState } from 'react';
import { useDisciplineRecords, useCreateDisciplineRecord, useUpdateDisciplineRecord } from '../../hooks/useDiscipline';
import { useAuth } from '../../context/AuthContext';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LedgerRule } from '../../components/ui/LedgerRule';
import type { DisciplineRecord, DisciplineSeverity, DisciplineStatus } from '../../lib/discipline-api';

export function DisciplineRecordsPage() {
  const { user } = useAuth();
  const [severityFilter, setSeverityFilter] = useState<DisciplineSeverity | ''>('');
  const [statusFilter, setStatusFilter] = useState<DisciplineStatus | ''>('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for new incident
  const [studentIdInput, setStudentIdInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [severityInput, setSeverityInput] = useState<DisciplineSeverity>('MEDIUM');
  const [actionInput, setActionInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = ['ADMIN', 'VICE_DIRECTOR', 'TEACHER'].includes(user?.role || '');

  const { data: records, isLoading } = useDisciplineRecords({
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const createMutation = useCreateDisciplineRecord();
  const updateMutation = useUpdateDisciplineRecord();

  async function handleCreateIncident() {
    setFormError(null);
    if (!studentIdInput || !titleInput || !descInput) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        studentId: Number(studentIdInput),
        title: titleInput,
        description: descInput,
        severity: severityInput,
        actionTaken: actionInput,
      });
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create discipline record.');
    }
  }

  function resetForm() {
    setStudentIdInput('');
    setTitleInput('');
    setDescInput('');
    setSeverityInput('MEDIUM');
    setActionInput('');
    setFormError(null);
  }

  async function handleStatusChange(id: number, status: DisciplineStatus) {
    try {
      await updateMutation.mutateAsync({ id, input: { status } });
    } catch (err) {
      console.error(err);
    }
  }

  const columns: Column<DisciplineRecord>[] = [
    {
      header: 'Student',
      render: (r) => (
        <div>
          <div className="font-medium text-ink-900">{r.studentName}</div>
          <div className="text-xs text-slate-500">{r.admissionNumber} · {r.className}</div>
        </div>
      ),
    },
    {
      header: 'Incident Details',
      render: (r) => (
        <div>
          <div className="font-medium text-ink-900">{r.title}</div>
          <div className="text-xs text-slate-600 line-clamp-1">{r.description}</div>
          <div className="text-[11px] text-slate-400">Date: {r.incidentDate} · Reported by {r.reportedBy}</div>
        </div>
      ),
    },
    {
      header: 'Severity',
      render: (r) => {
        const toneMap: Record<DisciplineSeverity, 'neutral' | 'positive' | 'warning' | 'danger'> = {
          LOW: 'neutral',
          MEDIUM: 'warning',
          HIGH: 'danger',
          CRITICAL: 'danger',
        };
        return <Badge tone={toneMap[r.severity]}>{r.severity}</Badge>;
      },
    },
    {
      header: 'Status',
      render: (r) => {
        const statusMap: Record<DisciplineStatus, 'neutral' | 'positive' | 'warning' | 'danger'> = {
          OPEN: 'danger',
          UNDER_REVIEW: 'warning',
          RESOLVED: 'positive',
          DISMISSED: 'neutral',
        };
        return <Badge tone={statusMap[r.status]}>{r.status.replace('_', ' ')}</Badge>;
      },
    },
    {
      header: 'Action Taken',
      render: (r) => r.actionTaken || <span className="text-xs text-slate-400 italic">None recorded</span>,
    },
    ...(canManage
      ? [
          {
            header: 'Actions',
            render: (r: DisciplineRecord) => (
              <select
                value={r.status}
                onChange={(e) => void handleStatusChange(r.id, e.target.value as DisciplineStatus)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="OPEN">Mark Open</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolve</option>
                <option value="DISMISSED">Dismiss</option>
              </select>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Discipline Records</h1>
          <p className="text-sm text-slate-500">Log, monitor, and manage student conduct incidents and behavioral reviews</p>
        </div>
        {canManage && <Button onClick={() => setIsModalOpen(true)}>Log New Incident</Button>}
      </div>
      <LedgerRule />

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <TextField
            label="Search"
            placeholder="Search student or incident..."
            className="min-w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <SelectField
            label="Severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as DisciplineSeverity | '')}
          >
            <option value="">All Severities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </SelectField>

          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DisciplineStatus | '')}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </SelectField>
        </div>

        <Table
          columns={columns}
          rows={records ?? []}
          getRowKey={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="No discipline records match these criteria."
        />
      </Card>

      <Modal title="Log Discipline Incident" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-4">
          <TextField
            label="Student ID"
            placeholder="Enter Student ID (e.g. 1)"
            value={studentIdInput}
            onChange={(e) => setStudentIdInput(e.target.value)}
          />

          <TextField
            label="Incident Title"
            placeholder="e.g. Classroom Disruption or Unexcused Absence"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Incident Description</label>
            <textarea
              className="w-full rounded-md border border-slate-300 p-2 text-sm"
              rows={3}
              placeholder="Describe what occurred..."
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
            />
          </div>

          <SelectField
            label="Severity Level"
            value={severityInput}
            onChange={(e) => setSeverityInput(e.target.value as DisciplineSeverity)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </SelectField>

          <TextField
            label="Initial Action Taken (optional)"
            placeholder="e.g. Verbal warning, parent contact, or detention"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
          />

          {formError && <p className="text-xs text-danger-600">{formError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateIncident()} isLoading={createMutation.isPending}>
              Submit Incident
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
