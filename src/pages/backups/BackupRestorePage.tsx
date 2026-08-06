import { useRef, useState } from 'react';
import { useBackups, useCreateBackup, useUploadBackup, useRestoreBackup, useDeleteBackup } from '../../hooks/useBackups';
import { backupsApi } from '../../lib/backups-api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LedgerRule } from '../../components/ui/LedgerRule';
import type { BackupFile } from '../../types/backup';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupRestorePage() {
  const { data: backups, isLoading } = useBackups();
  const createBackup = useCreateBackup();
  const uploadBackup = useUploadBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingFileName, setDownloadingFileName] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupFile | null>(null);
  const [restoreResultMessage, setRestoreResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload(fileName: string) {
    setDownloadingFileName(fileName);
    try {
      await backupsApi.download(fileName);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not download the backup.');
    } finally {
      setDownloadingFileName(null);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMessage(null);
    try {
      await uploadBackup.mutateAsync(file);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not upload that file.');
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    setErrorMessage(null);
    try {
      const result = await restoreBackup.mutateAsync(restoreTarget.fileName);
      const totalRows = Object.values(result.tableCounts).reduce((sum, n) => sum + n, 0);
      setRestoreResultMessage(`Restored from ${restoreTarget.fileName} — ${totalRows} rows loaded across ${Object.keys(result.tableCounts).length} tables.`);
      setRestoreTarget(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Restore failed.');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setErrorMessage(null);
    try {
      await deleteBackup.mutateAsync(deleteTarget.fileName);
      setDeleteTarget(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not delete that backup.');
    }
  }

  const columns: Column<BackupFile>[] = [
    { header: 'File', className: 'font-mono text-[0.8125rem]', render: (b) => b.fileName },
    { header: 'Size', render: (b) => formatSize(b.sizeBytes) },
    { header: 'Created', render: (b) => new Date(b.createdAt).toLocaleString() },
    {
      header: 'Actions',
      render: (b) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => void handleDownload(b.fileName)} disabled={downloadingFileName === b.fileName}>
            Download
          </Button>
          <Button variant="ghost" onClick={() => setRestoreTarget(b)}>
            Restore
          </Button>
          <Button variant="ghost" onClick={() => setDeleteTarget(b)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Backup &amp; restore</h1>
      <p className="mb-1 text-[0.9375rem] text-ink-700">
        Backups capture every student, staff, academic, and attendance record. Restoring one replaces all current data.
      </p>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void createBackup.mutateAsync()} isLoading={createBackup.isPending}>
          Create backup now
        </Button>
        <Button variant="secondary" onClick={handleUploadClick} isLoading={uploadBackup.isPending}>
          Upload a backup file
        </Button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => void handleFileSelected(e)} />
      </div>

      {errorMessage && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {errorMessage}
        </p>
      )}
      {restoreResultMessage && (
        <p className="mb-4 rounded-lg bg-pine-100 px-3 py-2.5 text-sm text-pine-800" role="status">
          {restoreResultMessage}
        </p>
      )}

      <Table
        columns={columns}
        rows={backups ?? []}
        getRowKey={(b) => b.fileName}
        isLoading={isLoading}
        emptyMessage="No backups yet. Create one above."
      />

      <Modal title="Restore this backup?" isOpen={Boolean(restoreTarget)} onClose={() => setRestoreTarget(null)}>
        <p className="mb-4 text-[0.9375rem] text-ink-900">
          This will permanently delete <strong>all current data</strong> — every student, staff account, grade, attendance
          record, and report — and replace it with the contents of <strong className="font-mono">{restoreTarget?.fileName}</strong>.
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setRestoreTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirmRestore()} isLoading={restoreBackup.isPending}>
            Yes, overwrite everything
          </Button>
        </div>
      </Modal>

      <Modal title="Delete this backup file?" isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <p className="mb-4 text-[0.9375rem] text-ink-900">
          This removes <strong className="font-mono">{deleteTarget?.fileName}</strong> from the server. It does not affect any
          live data — only the saved snapshot.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirmDelete()} isLoading={deleteBackup.isPending}>
            Delete backup
          </Button>
        </div>
      </Modal>
    </div>
  );
}
