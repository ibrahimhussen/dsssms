import { useState } from 'react';
import { useSendToParents } from '../../hooks/useNotifications';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { Button } from '../../components/ui/Button';

export function MessageParentsModal({
  student,
  onClose,
}: {
  student: { studentId: number; firstName: string; lastName: string } | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const sendToParents = useSendToParents();

  function handleClose() {
    setTitle('');
    setMessage('');
    setFeedback(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    setFeedback(null);
    try {
      const result = await sendToParents.mutateAsync({ studentId: student.studentId, input: { title, message } });
      setFeedback({ type: 'success', message: `Sent to ${result.notificationsSent} parent(s).` });
      setTitle('');
      setMessage('');
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Could not send the message.' });
    }
  }

  return (
    <Modal title={student ? `Message ${student.firstName} ${student.lastName}'s parents` : 'Message parents'} isOpen={Boolean(student)} onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
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
          <Button type="submit" isLoading={sendToParents.isPending}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
