export interface BackupFileDto {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupFileContents {
  version: number;
  createdAt: string;
  data: Record<string, Record<string, unknown>[]>;
}
