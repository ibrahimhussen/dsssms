import { useState } from 'react';
import {
  useMyInbox,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { ComposeAnnouncementModal } from './ComposeAnnouncementModal';
import type {
  ListNotificationsParams,
  NotificationCategory,
  NotificationStatus,
} from '../../types/notification';

// Only oversight roles can send school-wide announcements.
// Teachers can send to classroom only — handled inside ComposeAnnouncementModal.
const COMPOSE_ROLES = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'TEACHER'];

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  SYSTEM:       'System',
  ACADEMIC:     'Academic',
  ATTENDANCE:   'Attendance',
  REGISTRATION: 'Registration',
  PROMOTION:    'Promotion',
  ANNOUNCEMENT: 'Announcement',
};

function categoryBadge(category: NotificationCategory) {
  switch (category) {
    case 'ACADEMIC':     return <Badge tone="positive">Academic</Badge>;
    case 'ATTENDANCE':   return <Badge tone="warning">Attendance</Badge>;
    case 'PROMOTION':    return <Badge tone="neutral">Promotion</Badge>;
    case 'REGISTRATION': return <Badge tone="neutral">Registration</Badge>;
    case 'SYSTEM':       return <Badge tone="danger">System</Badge>;
    case 'ANNOUNCEMENT': return <Badge>Announcement</Badge>;
    default:             return null;
  }
}

export function NotificationsPage() {
  const { user } = useAuth();
  const canCompose = Boolean(user && COMPOSE_ROLES.includes(user.role));
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [filters, setFilters] = useState<ListNotificationsParams>({ page: 1, limit: 20 });

  const { data, isLoading } = useMyInbox(filters);
  const markRead          = useMarkNotificationRead();
  const markAllRead       = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const [notifError, setNotifError] = useState<string | null>(null);

  function handleMarkRead(id: number) {
    setNotifError(null);
    markRead.mutate(id, {
      onError: (err) => setNotifError(err instanceof Error ? err.message : 'Could not mark as read.'),
    });
  }

  function handleMarkAllRead() {
    setNotifError(null);
    markAllRead.mutate(undefined, {
      onError: (err) => setNotifError(err instanceof Error ? err.message : 'Could not mark all as read.'),
    });
  }

  function handleDelete(id: number) {
    setNotifError(null);
    deleteNotification.mutate(id, {
      onError: (err) => setNotifError(err instanceof Error ? err.message : 'Could not delete.'),
    });
  }

  return (
    <div className="max-w-[720px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl">
          Notifications
          {data && data.unreadCount > 0 && (
            <span className="ml-2 align-middle">
              <Badge tone="warning">{data.unreadCount} unread</Badge>
            </span>
          )}
        </h1>
        {canCompose && (
          <Button onClick={() => setComposeOpen(true)}>Send announcement</Button>
        )}
      </div>
      <LedgerRule />

      {/* ── Filters ── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <SelectField
            label="Status"
            className="min-w-[140px]"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: (e.target.value || undefined) as NotificationStatus | undefined,
                page: 1,
              }))
            }
          >
            <option value="">All statuses</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </SelectField>

          <SelectField
            label="Category"
            className="min-w-[160px]"
            value={filters.category ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                category: (e.target.value || undefined) as NotificationCategory | undefined,
                page: 1,
              }))
            }
          >
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </SelectField>
        </div>

        <Button
          variant="ghost"
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending || !data?.unreadCount}
        >
          Mark all as read
        </Button>
      </div>

      {notifError && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {notifError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((n) => (
            <li
              key={n.notificationId}
              className={`rounded-2xl border p-4 shadow-sm ${
                n.status === 'UNREAD'
                  ? 'border-gold-500/40 bg-gold-100/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-ink-900">{n.title}</p>
                  {categoryBadge(n.category)}
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {new Date(n.sentDate).toLocaleString()}
                </span>
              </div>

              <p className="mb-2 text-sm text-ink-700">{n.message}</p>

              {n.senderName && (
                <p className="mb-2 text-xs text-slate-500">From: {n.senderName}</p>
              )}

              <div className="flex gap-3">
                {n.status === 'UNREAD' && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.notificationId)}
                    className="text-sm font-semibold text-pine-700 hover:underline"
                  >
                    Mark as read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(n.notificationId)}
                  className="text-sm font-semibold text-danger-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && (
        <Pagination
          meta={data.meta}
          onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        />
      )}

      {canCompose && (
        <ComposeAnnouncementModal
          isOpen={isComposeOpen}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
}
