import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNavEntries } from './nav-config';
import type { NavItem } from './nav-config';
import { NavGroupItem } from './NavGroupItem';
import { getRoleLabel } from '../lib/role-labels';
import { Button } from '../components/ui/Button';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import { MdNotifications } from 'react-icons/md';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();

  if (!user) return null;

  const entries = getNavEntries(user.role, user.permissions);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] max-[720px]:grid-cols-1">
      <aside className="sticky top-0 h-screen flex flex-col gap-8 bg-pine-900 p-4 text-paper-100 max-[720px]:hidden overflow-y-auto">
        <div className="flex flex-col gap-1 px-2">
          <span className="font-display text-xl font-semibold text-paper-50">DSSSMS</span>
          <span className="text-xs text-slate-300">Dinsho Secondary School</span>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Primary">
          {entries.map((entry, idx) => {
            // ── Group ──────────────────────────────────────────────────────────
            if (entry.type === 'group') {
              return <NavGroupItem key={`group-${idx}`} group={entry} />;
            }

            // ── Flat item ──────────────────────────────────────────────────────
            const navItem = entry as NavItem;

            if (navItem.isLogout) {
              return (
                <button
                  key="logout"
                  onClick={() => void handleLogout()}
                  className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium text-paper-100 transition-colors hover:bg-white/10"
                >
                  <navItem.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{navItem.label}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={`${navItem.path}-${navItem.label}`}
                to={navItem.path}
                end={navItem.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                    isActive
                      ? 'bg-pine-700 font-semibold text-paper-50'
                      : 'text-paper-100 hover:bg-white/10'
                  }`
                }
              >
                {() => {
                  const Icon = navItem.icon;
                  return (
                    <>
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{navItem.label}</span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-8 py-4">
          {/* Notification bell */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative rounded-lg p-1.5 text-slate-500 hover:bg-paper-100"
            aria-label="Notifications"
          >
            <MdNotifications className="h-5 w-5" />
            {unreadCount != null && unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-600 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <div className="flex flex-col items-end leading-tight">
            <span className="text-[0.9375rem] font-semibold text-ink-900">{user.username}</span>
            <span className="text-xs text-slate-500">{getRoleLabel(user.role)}</span>
          </div>
          <Button variant="ghost" onClick={() => void handleLogout()}>
            Sign out
          </Button>
        </header>

        <main className="flex-1 p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
