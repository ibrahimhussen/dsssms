import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from '../lib/messaging-api';
import type { ListThreadsParams, ReplyMessageInput, SendMessageInput } from '../types/messaging';

export function useEligibleTeachers(studentId: number | undefined) {
  return useQuery({
    queryKey: ['messaging', 'eligible-teachers', studentId],
    queryFn: () => messagingApi.getEligibleTeachers(studentId!),
    enabled: studentId !== undefined,
    staleTime: 60_000,
  });
}

export function useMessageThreads(params: ListThreadsParams = {}) {
  return useQuery({
    queryKey: ['messaging', 'threads', params],
    queryFn: () => messagingApi.listThreads(params),
  });
}

export function useMessageThread(
  studentId: number | undefined,
  otherUserId: number | undefined
) {
  return useQuery({
    queryKey: ['messaging', 'thread', studentId, otherUserId],
    queryFn: () => messagingApi.getThread(studentId!, otherUserId!),
    enabled: studentId !== undefined && otherUserId !== undefined,
    refetchInterval: 15_000, // poll every 15s for new replies
  });
}

export function useMessageUnreadCount() {
  return useQuery({
    queryKey: ['messaging', 'unread-count'],
    queryFn: () => messagingApi.getUnreadCount(),
    refetchInterval: 30_000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) => messagingApi.sendMessage(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messaging'] });
    },
  });
}

export function useReplyToMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, input }: { messageId: number; input: ReplyMessageInput }) =>
      messagingApi.replyToMessage(messageId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messaging'] });
    },
  });
}
