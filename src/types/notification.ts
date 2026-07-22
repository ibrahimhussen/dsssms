import type { PaginationParams } from './pagination';

export type NotificationStatus = 'UNREAD' | 'READ';

export interface Notification {
  notificationId: number;
  title: string;
  message: string;
  sentDate: string;
  status: NotificationStatus;
  recipientUserId: number | null;
  student: { studentId: number; firstName: string; lastName: string } | null;
}

export interface NotificationInbox {
  items: Notification[];
  unreadCount: number;
}

export interface SendToParentsResult {
  studentId: number;
  notificationsSent: number;
}

export interface CreateNotificationInput {
  recipientUserId: number;
  studentId?: number;
  title: string;
  message: string;
}

export interface SendToParentsInput {
  title: string;
  message: string;
}

export interface ListNotificationsParams extends PaginationParams {
  status?: NotificationStatus;
}

export interface ListAllNotificationsParams extends ListNotificationsParams {
  recipientUserId?: number;
  studentId?: number;
}

export interface MarkAllAsReadResult {
  updatedCount: number;
}
