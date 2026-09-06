import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSentAnnouncements } from '../../hooks/useNotifications';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { ComposeAnnouncementModal } from '../notifications/ComposeAnnouncementModal';
import { LedgerRule } from '../../components/ui/LedgerRule';

// Human-readable label for each broadcast audience value
const AUDIENCE_LABELS: Record<string, string> = {
  ALL_STAFF:          'All Staff',
  ALL_TEACHERS:       'All Teachers',
  ALL_PARENTS:        'All Parents',
  ALL_STUDENTS:       'All Students',
  CLASSROOM_STUDENTS: 'Classroom — Students',
  CLASSROOM_PARENTS:  'Classroom — Parents',
};

export function AnnouncementsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [isComposeOpen, setComposeOpen] = useState(false);

  // Fetch only announcements sent by the current user
  const { data, isLoading, error } = useSentAnnouncements(user?.userId ?? 0, {
    page,
    limit: 20,
  });

  const announcements = data?.items ?? [];
  const meta          = data?.meta  ?? null;

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Announcements</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            School-wide communications you have published to staff, students, or parents.
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)}>
          + Create Announcement
        </Button>
      </div>
      <LedgerRule />

      {error && (
        <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-700">
            {error instanceof Error ? error.message : 'Could not load announcements.'}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
          Loading announcements…
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description="Create your first announcement to send a message to staff, students, or parents."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {announcements.map((n) => {
            // The message field stores "AUDIENCE|title|message" for broadcasts,
            // or just the plain message for simple sends. We show whatever is stored.
            const sentDate = new Date(n.sentDate);

            return (
              <Card key={n.notificationId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Title + category badge */}
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink-900">{n.title}</h3>
                      <Badge tone="positive">Published</Badge>
                      {n.category !== 'ANNOUNCEMENT' && (
                        <Badge tone="neutral">{n.category}</Badge>
                      )}
                    </div>

                    {/* Message body */}
                    <p className="text-sm text-slate-700 whitespace-pre-line">{n.message}</p>

                    {/* Metadata row */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span>
                        Published{' '}
                        <strong className="text-slate-600">
                          {sentDate.toLocaleDateString('en-GB', {
                            day:   'numeric',
                            month: 'long',
                            year:  'numeric',
                          })}
                        </strong>
                        {' at '}
                        {sentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {n.relatedEntity && (
                        <span>
                          Audience:{' '}
                          <strong className="text-slate-600">
                            {AUDIENCE_LABELS[n.relatedEntity] ?? n.relatedEntity}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {meta && (
            <Pagination
              meta={meta}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}

      <ComposeAnnouncementModal
        isOpen={isComposeOpen}
        onClose={() => setComposeOpen(false)}
      />
    </div>
  );
}
