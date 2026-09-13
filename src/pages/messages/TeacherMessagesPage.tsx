import { useState, useRef, useEffect } from 'react';
import {
  useMessageThreads,
  useMessageThread,
  useReplyToMessage,
} from '../../hooks/useMessaging';
import { useAuth } from '../../context/AuthContext';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MdSend, MdChat, MdInbox } from 'react-icons/md';
import type { ConversationThreadDto, MessageDto } from '../../types/messaging';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: '2-digit', month: 'short' }) +
        ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Conversation view ─────────────────────────────────────────────────────────

function ConversationView({
  thread,
  myUserId,
  onBack,
}: {
  thread:    ConversationThreadDto;
  myUserId:  number;
  onBack:    () => void;
}) {
  const { data: messages, isLoading } = useMessageThread(thread.studentId, thread.otherUserId);
  const replyMsg  = useReplyToMessage();
  const [body, setBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Flatten root + replies chronologically
  const flat: (MessageDto & { isReply: boolean })[] = [];
  for (const m of messages ?? []) {
    flat.push({ ...m, isReply: false });
    for (const r of m.replies) flat.push({ ...r, isReply: true });
  }
  flat.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Last root message id for threading
  const lastRootId = (messages ?? [])
    .filter((m) => m.parentMessageId === null)
    .slice(-1)[0]?.id;

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || !lastRootId) return;
    await replyMsg.mutateAsync({ messageId: lastRootId, input: { body: trimmed } });
    setBody('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-pine-700 hover:underline shrink-0"
        >
          ← Back
        </button>
        <div className="min-w-0">
          <p className="font-semibold text-ink-900 truncate">{thread.otherName}</p>
          <p className="text-xs text-slate-500">
            Re: {thread.studentName}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
        {isLoading && (
          <div className="flex justify-center py-8 text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          </div>
        )}
        {!isLoading && flat.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <MdChat className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No messages in this conversation.</p>
          </div>
        )}
        {flat.map((m) => {
          const isMine = m.senderUserId === myUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMine
                    ? 'bg-pine-700 text-white rounded-br-sm'
                    : 'bg-white text-ink-900 border border-slate-200 rounded-bl-sm'
                }`}
              >
                {!isMine && (
                  <p className="text-[0.7rem] font-semibold text-pine-700 mb-1">{m.senderName}</p>
                )}
                <p className="text-[0.9rem] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[0.7rem] ${isMine ? 'text-pine-200' : 'text-slate-400'} text-right`}>
                  {fmtTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose — teacher can only reply, not initiate */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        {!lastRootId ? (
          <p className="text-sm italic text-slate-400 text-center py-1">
            No messages to reply to yet.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-pine-600 min-h-[44px] max-h-[120px]"
                placeholder="Type a reply…"
                rows={1}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                onClick={() => void handleSend()}
                isLoading={replyMsg.isPending}
                disabled={!body.trim()}
                className="shrink-0"
              >
                <MdSend className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-[0.7rem] text-slate-400">
              Press Enter to send · Shift+Enter for new line
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TeacherMessagesPage() {
  const { user } = useAuth();
  const myUserId = user?.userId ?? 0;

  const { data: threadsData, isLoading } = useMessageThreads();
  const [activeThread, setActiveThread] = useState<ConversationThreadDto | null>(null);

  const threads = threadsData?.items ?? [];
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  // If a conversation is open, show it full-height
  if (activeThread) {
    return (
      <div className="flex flex-col max-w-2xl h-[calc(100vh-120px)] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <ConversationView
          thread={activeThread}
          myUserId={myUserId}
          onBack={() => setActiveThread(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink-900">Messages</h1>
        {totalUnread > 0 && <Badge tone="positive">{totalUnread} unread</Badge>}
      </div>
      <p className="mt-0.5 text-sm text-slate-500">
        Messages from parents of students you teach. Read-only contact — you cannot send new conversations.
      </p>
      <LedgerRule />

      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading messages…</span>
        </div>
      )}

      {!isLoading && threads.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <MdInbox className="h-12 w-12 text-slate-300 mb-3" />
          <EmptyState
            title="No messages yet"
            description="When a parent sends you a message about their child, it will appear here."
          />
        </div>
      )}

      {!isLoading && threads.length > 0 && (
        <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {threads.map((t, idx) => (
            <button
              key={`${t.studentId}-${t.otherUserId}-${idx}`}
              type="button"
              onClick={() => setActiveThread(t)}
              className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 text-left transition-colors"
            >
              <div className="min-w-0">
                {/* Parent name */}
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink-900 truncate">{t.otherName}</p>
                  {t.unreadCount > 0 && (
                    <Badge tone="positive">{t.unreadCount}</Badge>
                  )}
                </div>
                {/* Student context */}
                <p className="text-xs text-slate-500 mt-0.5">
                  Re: {t.studentName}
                </p>
                {/* Last message preview */}
                <p className="mt-1 text-sm text-slate-600 truncate max-w-[340px]">
                  {t.lastMessage}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-400 whitespace-nowrap">
                  {fmtTime(t.lastMessageAt)}
                </p>
                <p className="mt-1 text-xs text-pine-700 font-medium">Reply →</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
