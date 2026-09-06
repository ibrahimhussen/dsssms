import { useEffect, useRef, useState } from 'react';
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
import {
  MdNotifications,
  MdAccountCircle,
  MdLock,
  MdLogout,
  MdExpandMore,
} from 'react-icons/md';

// ── Avatar ────────────────────────────────────────────────────────────────────

function UserAvatar({
  src,
  name,
  size = 'md',
}: {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';
  const initials = name
    ? name.split(' ').map((w) => w[0]?.toUpperCase()).slice(0, 2).join('')
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Profile picture'}
        className={`${dim} rounded-full object-cover border border-slate-200 shrink-0`}
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          img.style.display = 'none';
          const fallback = img.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  }

  return (
    <div
      className={`${dim} flex items-center justify-center rounded-full bg-pine-700 font-bold text-white shrink-0 select-none`}
    >
      {initials}
    </div>
  );
}

// ── User dropdown (top-right) ─────────────────────────────────────────────────

function UserDropdown({
  displayName,
  roleLabel,
  pictureSrc,
  onChangePassword,
  onSignOut,
}: {
  displayName: string;
  roleLabel:   string;
  pictureSrc:  string | null | undefined;
  onChangePassword: () => void;
  onSignOut:        () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-paper-100 transition-colors focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <UserAvatar src={pictureSrc} name={displayName} />
        <div className="flex flex-col items-start leading-tight max-[900px]:hidden">
          <span className="text-[0.9375rem] font-semibold text-ink-900 leading-snug">
            {displayName}
          </span>
          <span className="text-xs text-slate-500">{roleLabel}</span>
        </div>
        <MdExpandMore
          className={`h-4 w-4 text-slate-400 transition-transform max-[900px]:hidden ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-slate-200 bg-white shadow-lg z-50">
          {/* Identity summary */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-ink-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
          </div>

          {/* Actions */}
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); onChangePassword(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-800 hover:bg-paper-100 transition-colors"
            >
              <MdLock className="h-4 w-4 text-slate-400 shrink-0" />
              Change Password
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              type="button"
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
            >
              <MdLogout className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();

  // Keep profile picture in sync after the user changes it on the profile page
  const { data: profile } = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn:  () => authApi.getProfile(),
    staleTime: 60_000,
    enabled:  !!user,
  });

  if (!user) return null;

  const entries = getNavEntries(user.role, user.permissions);

  // fullName is now a first-class field on AuthenticatedUser (added in auth.service)
  const displayName = user.fullName?.trim() || user.username;
  const roleLabel   = getRoleLabel(user.role);

  // Profile picture: live fetch wins (reflects edits), AuthContext fallback otherwise
  const pictureSrc = profile?.profilePicture ?? user.profilePicture;

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  function handleChangePassword() {
    // Navigate to profile page with ?tab=password so it opens directly on the password tab
    navigate('/profile?tab=password');
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
      isActive
        ? 'bg-pine-700 font-semibold text-paper-50'
        : 'text-paper-100 hover:bg-white/10'
    }`;

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] max-[720px]:grid-cols-1">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="sticky top-0 h-screen flex flex-col bg-pine-900 p-4 text-paper-100 max-[720px]:hidden overflow-y-auto">

        {/* Brand */}
        <div className="flex flex-col gap-1 px-2 mb-6">
          <span className="font-display text-xl font-semibold text-paper-50">DSSSMS</span>
          <span className="text-xs text-slate-300">Dinsho Secondary School</span>
        </div>

        {/* Main nav — excludes logout flag and /profile (handled below) */}
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
          {entries
            .filter((e) => !(e.type === 'item' && (e as NavItem).isLogout))
            .filter((e) => !(e.type === 'item' && (e as NavItem).path === '/profile'))
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
                  className={navLinkClass}
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

        {/* Bottom — My Profile ONLY */}
        <div className="border-t border-white/10 pt-3">
          <NavLink to="/profile" className={navLinkClass}>
            {() => (
              <>
                <MdAccountCircle className="h-5 w-5 shrink-0" />
                <span className="truncate">My Profile</span>
              </>
            )}
          </NavLink>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col">

        {/* Top-right header */}
        <header className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-8 py-3">

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

          {/* User identity dropdown */}
          <UserDropdown
            displayName={displayName}
            roleLabel={roleLabel}
            pictureSrc={pictureSrc}
            onChangePassword={handleChangePassword}
            onSignOut={() => void handleSignOut()}
          />
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
