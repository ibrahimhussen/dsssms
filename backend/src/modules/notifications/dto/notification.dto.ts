import { NotificationStatus } from '@prisma/client';

export interface NotificationDto {
  notificationId: number;
  title: string;
  message: string;
  sentDate: Date;
  status: NotificationStatus;
  recipientUserId: number | null;
  student: { studentId: number; firstName: string; lastName: string } | null;
}

export interface SendToParentsResultDto {
  studentId: number;
  notificationsSent: number;
}
