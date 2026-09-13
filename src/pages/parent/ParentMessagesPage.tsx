import { useState, useRef, useEffect } from 'react';
import { useMyParentProfile } from '../../hooks/useParents';
import {
  useEligibleTeachers,
  useMessageThreads,
  useMessageThread,
  useSendMessage,
  useReplyToMessage,
} from '../../hooks/useMessaging';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { MdSend, MdChat } from 'react-icons/md';
import type { EligibleTeacherDto, MessageDto } from '../../types/messaging';

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
  studentId,
  teacher,
  myUserId,
  onBack,
}: {
  studentId:  number;
  teacher:    EligibleTeacherDto;
  myUserId:   number;
  onBack:     () => void;
}) {
  const { data: messages, isLoading } = useMessageThread(studentId, teacher.userId);
  const sendMsg   = useSendMessage();
  const replyMsg  = useReplyToMessage();
  const [body, setBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Flatten root messages + their replies in chronological order
  const flat: (MessageDto & { isReply: boolean })[] = [];
  for (const m of messages ?? []) {
    flat.push({ ...m, isReply: false });
    for (const r of m.replies) flat.push({ ...r, isReply: true });
  }
  flat.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Last root message id — replies go against it
  const lastRootId = (messages ?? []).filter((m) => m.parentMessageId === null).slice(-1)[0]?.id;

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (lastRootId) {
      await replyMsg.mutateAsync({ messageId: lastRootId, input: { body: trimmed } });
    } else {
      await sendMsg.mutateAsync({ studentId, recipientUserId: teacher.userId, body: trimmed });
    }
    setBody('');
  }

  const isSending = sendMsg.isPending || replyMsg.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-pine-700 hover:underline"
        >
          ← Back
        </button>
        <div className="min-w-0">
          <p className="font-semibold text-ink-900 truncate">
            {teacher.firstName} {teacher.lastName}
          </p>
          <p className="text-xs text-slate-500">{teacher.subjectName}</p>
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
            <p className="text-sm">No messages yet. Send the first one.</p>
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
                <p className="text-[0.9rem] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[0.7rem] ${isMine ? 'text-pine-200' : 'text-slate-400'} text-right`}>
                  {fmtTime(m.createdAt)}
                  {!isMine && !m.isRead && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-pine-600 align-middle" />
                  )}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-pine-600 min-h-[44px] max-h-[120px]"
            placeholder="Type a message…"
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
            isLoading={isSending}
            disabled={!body.trim()}
            className="shrink-0"
          >
            <MdSend className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-[0.7rem] text-slate-400">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ParentMessagesPage() {
  const { data: profile, isLoading: profileLoading } = useMyParentProfile();

  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>(undefined);
  const [activeTeacher,     setActiveTeacher]     = useState<EligibleTeacherDto | null>(null);

  // Default to first child once profile loads
  useEffect(() => {
    if (profile?.children.length && !selectedStudentId) {
      setSelectedStudentId(profile.children[0].studentId);
    }
  }, [profile, selectedStudentId]);

  const { data: teachers, isLoading: teachersLoading } = useEligibleTeachers(selectedStudentId);
  const { data: threads } = useMessageThreads({ studentId: selectedStudentId });

  const myUserId = profile?.userId ?? 0;

  if (profileLoading)
    return (
      <div className="flex items-center gap-2 py-16 text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
        <span className="text-sm">Loading…</span>
      </div>
    );

  if (!profile?.children.length)
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink-900">Messages</h1>
        <LedgerRule />
        <EmptyState
          title="No children linked"
          description="Contact the school to link your children to your account."
        />
      </div>
    );

  const selectedChild = profile.children.find((c) => c.studentId === selectedStudentId);

  // If a conversation is open, show it full-height
  if (activeTeacher && selectedStudentId) {
    return (
      <div className="flex flex-col max-w-2xl h-[calc(100vh-120px)] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <ConversationView
          studentId={selectedStudentId}
          teacher={activeTeacher}
          myUserId={myUserId}
          onBack={() => setActiveTeacher(null)}
        />
      </div>
    );
  }

  // Thread list + teacher picker
  return (
    <div className="max-w-2xl">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Messages</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Message your child's teachers directly.
          </p>
        </div>
        {profile.children.length > 1 && (
          <SelectField
            label="Child"
            className="min-w-[180px]"
            value={selectedStudentId ?? ''}
            onChange={(e) => {
              setSelectedStudentId(Number(e.target.value));
              setActiveTeacher(null);
            }}
          >
            {profile.children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <LedgerRule />

      {/* Teachers you can contact */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {selectedChild?.firstName}'s Teachers
        </p>
        {teachersLoading ? (
          <div className="flex items-center gap-2 py-4 text-slate-400">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
            <span className="text-sm">Loading teachers…</span>
          </div>
        ) : !teachers?.length ? (
          <p className="text-sm italic text-slate-400">No teachers assigned to this child's classroom yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {teachers.map((t) => {
              const thread = threads?.items.find(
                (th) => th.studentId === selectedStudentId && th.otherUserId === t.userId
              );
              const unread = thread?.unreadCount ?? 0;
              return (
                <button
                  key={t.teacherId}
                  type="button"
                  onClick={() => setActiveTeacher(t)}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="font-semibold text-ink-900">
                      {t.firstName} {t.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{t.subjectName}</p>
                    {thread && (
                      <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[300px]">
                        {thread.lastMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {unread > 0 && (
                      <Badge tone="positive">{unread} new</Badge>
                    )}
                    <span className="text-xs text-pine-700 font-medium">Open →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
