import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../lib/users-api';
import type { CreateStaffInput, ListUsersParams } from '../types/user';
import type { UserStatus } from '../types/auth';

const usersQueryKey = (params: ListUsersParams) => ['users', params] as const;

export function useUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: usersQueryKey(params),
    queryFn: () => usersApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => usersApi.createStaff(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: UserStatus }) => usersApi.updateStatus(userId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (userId: number) => usersApi.resetPassword(userId),
  });
}
