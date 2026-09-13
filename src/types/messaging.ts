export interface MessageDto {
  id:              number;
  studentId:       number;
  studentName:     string;
  senderUserId:    number;
  senderName:      string;
  recipientUserId: number;
  recipientName:   string;
  body:            string;
  isRead:          boolean;
  parentMessageId: number | null;
  createdAt:       string;
  replies:         MessageDto[];
}

export interface ConversationThreadDto {
  otherUserId:   number;
  otherName:     string;
  otherRole:     string;
  subjectName:   string;
  studentId:     number;
  studentName:   string;
  lastMessage:   string;
  lastMessageAt: string;
  unreadCount:   number;
}

export interface EligibleTeacherDto {
  teacherId:   number;
  userId:      number;
  firstName:   string;
  lastName:    string;
  subjectName: string;
}

export interface SendMessageInput {
  studentId:       number;
  recipientUserId: number;
  body:            string;
}

export interface ReplyMessageInput {
  body: string;
}

export interface ListThreadsParams {
  studentId?: number;
  page?:      number;
  limit?:     number;
}
