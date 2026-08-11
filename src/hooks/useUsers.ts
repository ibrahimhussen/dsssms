import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../lib/users-api';
import type { CreateStaffInput, GrantPermissionInput, ListUsersParams } from '../types/user';
import type { UserStatus } from '../types/auth';

const usersQueryKey = (params: ListUsersParams) => ['users', params] as const;
const permissionsQueryKey = (userId: number) => ['users', userId, 'permissions'] as const;

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

export function useUserPermissions(userId: number, enabled = true) {
  return useQuery({
    queryKey: permissionsQueryKey(userId),
    queryFn: () => usersApi.getPermissions(userId),
    enabled,
  });
}

export function useGrantPermission(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantPermissionInput) => usersApi.grantPermission(userId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: permissionsQueryKey(userId) });
    },
  });
}

export function useRevokePermission(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissionId: number) => usersApi.revokePermission(userId, permissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: permissionsQueryKey(userId) });
    },
  });
}
