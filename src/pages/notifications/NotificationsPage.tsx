import { useState } from 'react';
import {
  useMyInbox,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '../../hooks/useNotifications';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import type { ListNotificationsParams, NotificationStatus } from '../../types/notification';

export function NotificationsPage() {
  const [filters, setFilters] = useState<ListNotificationsParams>({ page: 1, limit: 20 });

  const { data, isLoading } = useMyInbox(filters);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

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
      </div>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <SelectField
          label="Filter"
          className="min-w-[160px]"
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              status: (e.target.value || undefined) as NotificationStatus | undefined,
              page: 1,
            }))
          }
        >
          <option value="">All</option>
          <option value="UNREAD">Unread</option>
          <option value="READ">Read</option>
        </SelectField>

        <Button variant="ghost" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || !data?.unreadCount}>
          Mark all as read
        </Button>
      </div>

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
                n.status === 'UNREAD' ? 'border-gold-500/40 bg-gold-100/40' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-1 flex items-start justify-between gap-3">
                <p className="font-semibold text-ink-900">{n.title}</p>
                <span className="shrink-0 text-xs text-slate-500">{new Date(n.sentDate).toLocaleString()}</span>
              </div>
              <p className="mb-3 text-sm text-ink-700">{n.message}</p>
              <div className="flex gap-3">
                {n.status === 'UNREAD' && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.notificationId)}
                    className="text-sm font-semibold text-pine-700 hover:underline"
                  >
                    Mark as read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteNotification.mutate(n.notificationId)}
                  className="text-sm font-semibold text-danger-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}
    </div>
  );
}
