import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parentsApi } from '../lib/parents-api';
import type { CreateParentInput, ListParentsParams } from '../types/parent';

export function useParents(params: ListParentsParams) {
  return useQuery({
    queryKey: ['parents', params],
    queryFn: () => parentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateParentInput) => parentsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
  });
}
