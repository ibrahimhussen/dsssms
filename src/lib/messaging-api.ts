import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  MessageDto,
  ConversationThreadDto,
  EligibleTeacherDto,
  SendMessageInput,
  ReplyMessageInput,
  ListThreadsParams,
} from '../types/messaging';

export const messagingApi = {
  /** Parent: get teachers eligible to receive messages for a child */
  getEligibleTeachers(studentId: number) {
    return unwrap(
      apiClient.get<ApiResponse<EligibleTeacherDto[]>>('/messaging/eligible-teachers', {
        params: { studentId },
      })
    );
  },

  /** Parent: send a new message to a teacher */
  sendMessage(input: SendMessageInput) {
    return unwrap(apiClient.post<ApiResponse<MessageDto>>('/messaging', input));
  },

  /** Parent or Teacher: reply to a message */
  replyToMessage(messageId: number, input: ReplyMessageInput) {
    return unwrap(apiClient.post<ApiResponse<MessageDto>>(`/messaging/${messageId}/reply`, input));
  },

  /** List conversation threads */
  listThreads(params: ListThreadsParams = {}) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<ConversationThreadDto[]>>('/messaging', {
        params: cleanParams(params as Record<string, unknown>),
      })
    );
  },

  /** Get full conversation between current user and another user about a student */
  getThread(studentId: number, otherUserId: number) {
    return unwrap(
      apiClient.get<ApiResponse<MessageDto[]>>('/messaging/thread', {
        params: { studentId, otherUserId },
      })
    );
  },

  /** Get unread message count */
  getUnreadCount() {
    return unwrap(
      apiClient.get<ApiResponse<{ count: number }>>('/messaging/unread-count')
    );
  },
};
