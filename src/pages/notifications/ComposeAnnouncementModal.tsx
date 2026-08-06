import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useBroadcastNotification } from '../../hooks/useNotifications';
import { Modal } from '../../components/ui/Modal';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { Button } from '../../components/ui/Button';
import type { BroadcastAudience } from '../../types/notification';

const OVERSIGHT_AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string }[] = [
  { value: 'ALL_STAFF', label: 'All staff' },
  { value: 'ALL_TEACHERS', label: 'All teachers' },
  { value: 'ALL_PARENTS', label: 'All parents' },
  { value: 'ALL_STUDENTS', label: 'All students' },
  { value: 'CLASSROOM_STUDENTS', label: 'A classroom — students' },
  { value: 'CLASSROOM_PARENTS', label: 'A classroom — parents' },
];

const TEACHER_AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string }[] = [
  { value: 'CLASSROOM_STUDENTS', label: 'My class — students' },
  { value: 'CLASSROOM_PARENTS', label: 'My class — parents' },
];

const CLASSROOM_AUDIENCES: BroadcastAudience[] = ['CLASSROOM_STUDENTS', 'CLASSROOM_PARENTS'];

export function ComposeAnnouncementModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const isOversight = user?.role === 'ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'VICE_DIRECTOR';

  const { data: allClassrooms } = useClassroomOptions();
  const { data: myAssignments } = useMyTeachingAssignments();

  const classroomOptions = isOversight
    ? (allClassrooms?.items ?? []).map((c) => ({ classroomId: c.classroomId, label: `${c.className} ${c.section}` }))
    : Array.from(
        new Map(
          (myAssignments ?? []).map((a) => [
            a.classroom.classroomId,
            { classroomId: a.classroom.classroomId, label: `${a.classroom.className} ${a.classroom.section}` },
          ])
        ).values()
      );

  const [audience, setAudience] = useState<BroadcastAudience>(isOversight ? 'ALL_STAFF' : 'CLASSROOM_STUDENTS');
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const broadcast = useBroadcastNotification();
  const needsClassroom = CLASSROOM_AUDIENCES.includes(audience);

  function handleClose() {
    setTitle('');
    setMessage('');
    setClassroomId(undefined);
    setFeedback(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (needsClassroom && !classroomId) {
      setFeedback({ type: 'error', message: 'Choose a classroom for this audience.' });
      return;
    }

    try {
      const result = await broadcast.mutateAsync({
        audience,
        classroomId: needsClassroom ? classroomId : undefined,
        title,
        message,
      });
      setFeedback({ type: 'success', message: `Sent to ${result.notificationsSent} recipient(s).` });
      setTitle('');
      setMessage('');
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Could not send the announcement.' });
    }
  }

  return (
    <Modal title="Send announcement" isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <SelectField
          label="Send to"
          value={audience}
          onChange={(e) => {
            setAudience(e.target.value as BroadcastAudience);
            setClassroomId(undefined);
          }}
        >
          {(isOversight ? OVERSIGHT_AUDIENCE_OPTIONS : TEACHER_AUDIENCE_OPTIONS).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>

        {needsClassroom && (
          <SelectField
            label="Classroom"
            value={classroomId ?? ''}
            onChange={(e) => setClassroomId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Select a classroom…</option>
            {classroomOptions.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.label}
              </option>
            ))}
          </SelectField>
        )}

        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
        <TextAreaField
          label="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={5}
          required
        />

        {feedback && (
          <p
            className={`mb-4 rounded-lg px-3 py-2.5 text-sm ${
              feedback.type === 'success' ? 'bg-pine-100 text-pine-800' : 'bg-danger-100 text-danger-600'
            }`}
            role={feedback.type === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Close
          </Button>
          <Button type="submit" isLoading={broadcast.isPending}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
