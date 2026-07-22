import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  CreateNotificationInput,
  ListAllNotificationsParams,
  ListNotificationsParams,
  MarkAllAsReadResult,
  Notification,
  NotificationInbox,
  SendToParentsInput,
  SendToParentsResult,
} from '../types/notification';

export const notificationsApi = {
  send(input: CreateNotificationInput) {
    return unwrap(apiClient.post<ApiResponse<Notification>>('/notifications', input));
  },

  sendToParents(studentId: number, input: SendToParentsInput) {
    return unwrap(
      apiClient.post<ApiResponse<SendToParentsResult>>(`/notifications/student/${studentId}/parents`, input)
    );
  },

  getMyNotifications(params: ListNotificationsParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<NotificationInbox>>('/notifications/me', { params: cleanParams(params) })
    ).then(({ items, meta }) => ({
      // The backend returns { items, unreadCount } in data, we need to extract items
      items: (items as any).items || items,
      unreadCount: (items as any).unreadCount || 0,
      meta,
    }));
  },

  markAsRead(notificationId: number) {
    return unwrap(apiClient.patch<ApiResponse<Notification>>(`/notifications/${notificationId}/read`));
  },

  markAllAsRead() {
    return unwrap(apiClient.patch<ApiResponse<MarkAllAsReadResult>>('/notifications/read-all'));
  },

  delete(notificationId: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/notifications/${notificationId}`));
  },

  listAll(params: ListAllNotificationsParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<Notification[]>>('/notifications', { params: cleanParams(params) })
    );
  },
};
