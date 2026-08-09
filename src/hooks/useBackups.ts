import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backupsApi } from '../lib/backups-api';

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: () => backupsApi.list(),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => backupsApi.create(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useUploadBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => backupsApi.upload(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useRestoreBackup() {
  return useMutation({
    mutationFn: (fileName: string) => backupsApi.restore(fileName),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileName: string) => backupsApi.delete(fileName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}
