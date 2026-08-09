import type { PaginationParams } from './pagination';

export type NotificationStatus = 'READ' | 'UNREAD';

export interface NotificationRecord {
  notificationId: number;
  title: string;
  message: string;
  sentDate: string;
  status: NotificationStatus;
  recipientUserId: number | null;
  student: { studentId: number; firstName: string; lastName: string } | null;
}

export interface ListNotificationsParams extends PaginationParams {
  status?: NotificationStatus;
}

export interface SendToParentsInput {
  title: string;
  message: string;
}

export type BroadcastAudience =
  | 'ALL_STAFF'
  | 'ALL_TEACHERS'
  | 'ALL_PARENTS'
  | 'ALL_STUDENTS'
  | 'CLASSROOM_STUDENTS'
  | 'CLASSROOM_PARENTS';

export interface BroadcastNotificationInput {
  audience: BroadcastAudience;
  classroomId?: number;
  title: string;
  message: string;
}

export interface BroadcastResult {
  audience: BroadcastAudience;
  notificationsSent: number;
}
