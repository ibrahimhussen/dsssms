import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { systemSettingsApi } from '../lib/system-settings-api';
import type { UpdateSystemSettingInput } from '../types/system-setting';

export function useSystemSettings() {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: () => systemSettingsApi.get(),
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSystemSettingInput) => systemSettingsApi.update(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
  });
}
