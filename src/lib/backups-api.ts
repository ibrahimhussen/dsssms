import { apiClient, unwrap } from './api-client';
import { triggerBlobDownload } from './download-file';
import type { ApiResponse } from '../types/api';
import type { BackupFile, RestoreResult } from '../types/backup';


export const backupsApi = {
  list() {
    return unwrap(apiClient.get<ApiResponse<BackupFile[]>>('/backups'));
  },

  create() {
    return unwrap(apiClient.post<ApiResponse<BackupFile>>('/backups'));
  },

  async upload(file: File): Promise<BackupFile> {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap(
      apiClient.post<ApiResponse<BackupFile>>('/backups/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },

  async download(fileName: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/backups/${encodeURIComponent(fileName)}/download`, {
      responseType: 'blob',
    });
    triggerBlobDownload(response.data, fileName);
  },

  restore(fileName: string) {
    return unwrap(
      apiClient.post<ApiResponse<RestoreResult>>(`/backups/${encodeURIComponent(fileName)}/restore`, { confirm: true })
    );
  },

  delete(fileName: string) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/backups/${encodeURIComponent(fileName)}`));
  },
};
