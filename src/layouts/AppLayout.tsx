import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getNavEntries } from './nav-config';
import type { NavItem } from './nav-config';
import { NavGroupItem } from './NavGroupItem';
import { getRoleLabel } from '../lib/role-labels';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import { authApi } from '../lib/auth-api';
import { MdNotifications, MdLogout } from 'react-icons/md';

// ── Tiny inline avatar (reused across sidebar + header) ──────────────────────

function UserAvatar({
  src,
  name,
  size = 'sm',
}: {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'md' ? 'h-9 w-9 text-sm' : 'h-8 w-8 text-xs';
  const initials = name
    ? name.split(' ').map((w) => w[0]?.toUpperCase()).slice(0, 2).join('')
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Profile picture'}
        className={`${sizeClass} rounded-full object-cover border border-white/30 shrink-0`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-pine-700 font-bold text-white shrink-0 select-none`}
    >
      {initials}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();

  // Fetch live profile so avatar stays in sync after the user changes it
  const { data: profile } = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: () => authApi.getProfile(),
    staleTime: 60_000,
    enabled: !!user,
  });

  if (!user) return null;

  const entries = getNavEntries(user.role, user.permissions);

  // Profile picture — prefer the live profile fetch, fall back to AuthContext value
  const pictureSrc = profile?.profilePicture ?? user.profilePicture;
  const fullName =
    (profile?.roleData as Record<string, unknown> | null)?.fullName as string | null | undefined;
  const displayName = fullName ?? user.username;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] max-[720px]:grid-cols-1">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sticky top-0 h-screen flex flex-col bg-pine-900 p-4 text-paper-100 max-[720px]:hidden overflow-y-auto">
        {/* Brand */}
        <div className="flex flex-col gap-1 px-2 mb-6">
          <span className="font-display text-xl font-semibold text-paper-50">DSSSMS</span>
          <span className="text-xs text-slate-300">Dinsho Secondary School</span>
        </div>

        {/* Nav entries */}
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
          {entries
            .filter((e) => !(e.type === 'item' && (e as NavItem).isLogout))
            .map((entry, idx) => {
              if (entry.type === 'group') {
                return <NavGroupItem key={`group-${idx}`} group={entry} />;
              }

              const navItem = entry as NavItem;
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

        {/* User card + Logout — pinned to the bottom of the sidebar */}
        <div className="border-t border-white/10 pt-3 flex flex-col gap-1">
          {/* My Profile link */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isActive ? 'bg-pine-700' : 'hover:bg-white/10'
              }`
            }
          >
            <UserAvatar src={pictureSrc} name={displayName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-paper-50 leading-tight">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-400 leading-tight">
                My Profile
              </p>
            </div>
          </NavLink>

          {/* Logout */}
          <button
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium text-paper-100 transition-colors hover:bg-white/10"
          >
            <MdLogout className="h-5 w-5 shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-8 py-3">
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

          {/* Profile link with avatar */}
          <NavLink
            to="/profile"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-paper-100 transition-colors"
          >
            <UserAvatar src={pictureSrc} name={displayName} size="md" />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[0.9375rem] font-semibold text-ink-900">{user.username}</span>
              <span className="text-xs text-slate-500">{getRoleLabel(user.role)}</span>
            </div>
          </NavLink>
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
