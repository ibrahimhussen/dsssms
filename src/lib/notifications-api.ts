import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse, PaginationMeta } from '../types/api';
import type {
  BroadcastNotificationInput,
  BroadcastResult,
  ListNotificationsParams,
  NotificationRecord,
  SendToParentsInput,
} from '../types/notification';

export const notificationsApi = {
  async getMyInbox(
    params: ListNotificationsParams
  ): Promise<{ items: NotificationRecord[]; unreadCount: number; meta: PaginationMeta }> {
    const { data } = await apiClient.get<ApiResponse<{ items: NotificationRecord[]; unreadCount: number }>>(
      '/notifications/me',
      { params: cleanParams(params) }
    );
    if (!data.success) throw new Error(data.message);
    return {
      items:       data.data.items,
      unreadCount: data.data.unreadCount,
      meta:        data.pagination ?? {
        page: 1,
        limit: data.data.items.length,
        totalItems: data.data.items.length,
        totalPages: 1,
      },
    };
  },

  markAsRead(notificationId: number) {
    return unwrap(apiClient.patch<ApiResponse<NotificationRecord>>(`/notifications/${notificationId}/read`));
  },

  markAllAsRead() {
    return unwrap(apiClient.patch<ApiResponse<{ updatedCount: number }>>('/notifications/read-all'));
  },

  delete(notificationId: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/notifications/${notificationId}`));
  },

  sendToParents(studentId: number, input: SendToParentsInput) {
    return unwrap(
      apiClient.post<ApiResponse<{ studentId: number; notificationsSent: number }>>(
        `/notifications/student/${studentId}/parents`,
        input
      )
    );
  },

  broadcast(input: BroadcastNotificationInput) {
    return unwrap(apiClient.post<ApiResponse<BroadcastResult>>('/notifications/broadcast', input));
  },

  /** Fetches ANNOUNCEMENT notifications sent by a specific user — used by the Announcements page. */
  async getSentAnnouncements(
    params: ListNotificationsParams & { senderUserId: number }
  ): Promise<{ items: NotificationRecord[]; meta: PaginationMeta }> {
    const { data } = await apiClient.get<ApiResponse<NotificationRecord[]>>(
      '/notifications',
      {
        params: cleanParams({
          ...params,
          senderUserId:         params.senderUserId,
          category:             'ANNOUNCEMENT',
          broadcastSummaryOnly: 'true',
        }),
      }
    );
    if (!data.success) throw new Error(data.message);
    return {
      items: data.data,
      meta:  data.pagination ?? {
        page:       params.page ?? 1,
        limit:      params.limit ?? 20,
        totalItems: data.data.length,
        totalPages: 1,
      },
    };
  },
};
