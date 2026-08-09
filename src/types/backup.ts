export interface BackupFile {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export interface RestoreResult {
  tableCounts: Record<string, number>;
}
