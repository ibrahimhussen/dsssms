import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../lib/notifications-api';
import type { ListNotificationsParams, SendToParentsInput } from '../types/notification';

export function useMyInbox(params: ListNotificationsParams) {
  return useQuery({
    queryKey: ['notifications', 'me', params],
    queryFn: () => notificationsApi.getMyInbox(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'me'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'me'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) => notificationsApi.delete(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'me'] });
    },
  });
}

export function useSendToParents() {
  return useMutation({
    mutationFn: ({ studentId, input }: { studentId: number; input: SendToParentsInput }) =>
      notificationsApi.sendToParents(studentId, input),
  });
}
