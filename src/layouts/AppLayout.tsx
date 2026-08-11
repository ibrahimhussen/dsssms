import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVisibleNavItems } from './nav-config';
import { getRoleLabel } from '../lib/role-labels';
import { Button } from '../components/ui/Button';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null; // ProtectedRoute guarantees this, guarded again for type-safety

  const navItems = getVisibleNavItems(user.role, user.permissions);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] max-[720px]:grid-cols-1">
      <aside className="flex flex-col gap-8 bg-pine-900 p-4 text-paper-100 max-[720px]:hidden">
        <div className="flex flex-col gap-1 px-2">
          <span className="font-display text-xl font-semibold text-paper-50">DSSSMS</span>
          <span className="text-xs text-slate-300">Dinsho Secondary School</span>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            
            if (item.isLogout) {
              return (
                <button
                  key={item.path}
                  onClick={() => void handleLogout()}
                  className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium text-paper-100 transition-colors hover:bg-white/10"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                    isActive ? 'bg-pine-700 font-semibold text-paper-50' : 'text-paper-100 hover:bg-white/10'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[0.9375rem] font-semibold text-ink-900">{user.username}</span>
            <span className="text-xs text-slate-500">{getRoleLabel(user.role)}</span>
          </div>
          <Button variant="ghost" onClick={() => void handleLogout()}>
            Sign out
          </Button>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
