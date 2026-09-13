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
  /** The other party in the conversation (from the viewer's perspective) */
  otherUserId:   number;
  otherName:     string;
  otherRole:     string;
  subjectName:   string;   // subject the teacher teaches for this child
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
