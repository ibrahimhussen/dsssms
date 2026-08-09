import { useState } from 'react';
import { useMyInbox } from '../../hooks/useNotifications';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ComposeAnnouncementModal } from '../notifications/ComposeAnnouncementModal';
import { LedgerRule } from '../../components/ui/LedgerRule';
import type { NotificationRecord } from '../../types/notification';

export function AnnouncementsPage() {
  const { data: notificationsData, isLoading } = useMyInbox({ page: 1, limit: 20 });
  const [isComposeOpen, setComposeOpen] = useState(false);

  const notifications: NotificationRecord[] = notificationsData?.items ?? [];

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Announcements Publishing Center</h1>
          <p className="text-sm text-slate-500">Create, publish, and target school announcements for staff, students, and parents</p>
        </div>
        <Button onClick={() => setComposeOpen(true)}>Create Announcement</Button>
      </div>
      <LedgerRule />

      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-500">Loading announcements...</p>
          </Card>
        ) : notifications.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-500">No announcements published yet.</p>
          </Card>
        ) : (
          notifications.map((n) => (
            <Card key={n.notificationId}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{n.title}</h3>
                    <Badge tone="positive">PUBLISHED</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{n.message}</p>
                  <div className="mt-3 text-xs text-slate-400">
                    Published on {new Date(n.sentDate).toLocaleDateString()} at{' '}
                    {new Date(n.sentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <ComposeAnnouncementModal isOpen={isComposeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
