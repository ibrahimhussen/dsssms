import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVisibleNavItems } from './nav-config';
import { getRoleLabel } from '../lib/role-labels';
import { Button } from '../components/ui/Button';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null; // ProtectedRoute guarantees this, guarded again for type-safety

  const navItems = getVisibleNavItems(user.role);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span className="wordmark">DSSSMS</span>
          <span className="app-sidebar-subtitle">Dinsho Secondary School</span>
        </div>

        <nav className="app-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-user">
            <span className="app-topbar-name">{user.username}</span>
            <span className="app-topbar-role">{getRoleLabel(user.role)}</span>
          </div>
          <Button variant="ghost" onClick={() => void handleLogout()}>
            Sign out
          </Button>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
