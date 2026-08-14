import { NotificationCategory, NotificationStatus } from '@prisma/client';

export interface NotificationDto {
  notificationId:  number;
  title:           string;
  message:         string;
  sentDate:        string;
  status:          NotificationStatus;
  category:        NotificationCategory;
  recipientUserId: number | null;
  senderUserId:    number | null;
  senderName:      string | null;
  relatedEntity:   string | null;
  relatedEntityId: string | null;
  student:         { studentId: number; firstName: string; lastName: string } | null;
}

export interface SendToParentsResultDto {
  studentId:         number;
  notificationsSent: number;
}

export interface BroadcastResultDto {
  audience:          string;
  notificationsSent: number;
}
