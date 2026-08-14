import { useQuery } from '@tanstack/react-query';
import { apiClient, unwrap } from '../lib/api-client';
import type { ApiResponse } from '../types/api';

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      unwrap(
        apiClient.get<ApiResponse<{ unreadCount: number }>>('/notifications/unread-count')
      ).then((d) => d.unreadCount),
    refetchInterval: 30_000, // poll every 30 s
    staleTime: 15_000,
  });
}
