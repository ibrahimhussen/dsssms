/**
 * Auth workflow tests
 * - LoginPage rendering, validation, submit, error, password toggle
 * - AuthContext: hydration, login, logout, session-expired event
 * - GuestRoute: redirects authenticated user, renders outlet for guest
 * - ProtectedRoute: redirects unauthenticated, blocks wrong role, passes allowed
 * - role-redirect helpers
 * - token-storage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthenticatedUser } from '../types/auth';
import { getRoleDashboardPath, getPostLoginRedirect } from '../lib/role-redirect';
import { tokenStorage } from '../lib/token-storage';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeUser(role: AuthenticatedUser['role'] = 'DIRECTOR'): AuthenticatedUser {
  return { userId: 1, username: 'dir', email: null, role, status: 'ACTIVE', permissions: [], isTemporaryPassword: false, profilePicture: null, fullName: 'Dave D' };
}

// ── A. role-redirect ──────────────────────────────────────────────────────────

describe('A. role-redirect helpers', () => {
  it('getRoleDashboardPath returns "/" for every role', () => {
    const roles: AuthenticatedUser['role'][] = ['ADMIN','DIRECTOR','VICE_DIRECTOR','TEACHER','STUDENT','PARENT'];
    for (const r of roles) expect(getRoleDashboardPath(r)).toBe('/');
  });

  it('getPostLoginRedirect uses "from" when it is a safe non-blocked path', () => {
    expect(getPostLoginRedirect('TEACHER', '/grades')).toBe('/grades');
    expect(getPostLoginRedirect('TEACHER', '/students/101')).toBe('/students/101');
  });

  it('getPostLoginRedirect falls back to dashboard for blocked paths', () => {
    expect(getPostLoginRedirect('DIRECTOR', '/login')).toBe('/');
    expect(getPostLoginRedirect('DIRECTOR', '/unauthorized')).toBe('/');
    expect(getPostLoginRedirect('DIRECTOR', '/')).toBe('/');
  });

  it('getPostLoginRedirect falls back to dashboard when from is null/undefined', () => {
    expect(getPostLoginRedirect('STUDENT', null)).toBe('/');
    expect(getPostLoginRedirect('STUDENT', undefined)).toBe('/');
  });
});

// ── B. token-storage ──────────────────────────────────────────────────────────

describe('B. token-storage', () => {
  afterEach(() => sessionStorage.clear());

  it('starts with no access token', () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('setAccessToken persists to sessionStorage', () => {
    tokenStorage.setAccessToken('tok.abc');
    expect(tokenStorage.getAccessToken()).toBe('tok.abc');
  });

  it('clear removes the access token', () => {
    tokenStorage.setAccessToken('tok.abc');
    tokenStorage.clear();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('getRefreshToken always returns null (deprecated — lives in httpOnly cookie)', () => {
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('setTokens stores the access token (ignores refresh)', () => {
    tokenStorage.setTokens('at123', 'rt_ignored');
    expect(tokenStorage.getAccessToken()).toBe('at123');
  });
});

// ── C. LoginPage ──────────────────────────────────────────────────────────────

const mockLogin  = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Also mock react-icons to prevent SVG rendering issues
vi.mock('react-icons/md', () => ({
  MdVisibility:    () => <span data-testid="icon-visibility" />,
  MdVisibilityOff: () => <span data-testid="icon-visibility-off" />,
  MdErrorOutline:  () => <span data-testid="icon-error" />,
  MdSchool:        () => <span data-testid="icon-school" />,
}));

vi.mock('../components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) => (
    <button {...props}>{children}</button>
  ),
}));

import { LoginPage } from '../pages/auth/LoginPage';

function renderLogin(user: AuthenticatedUser | null = null) {
  mockUseAuth.mockReturnValue({ user, isLoading: false, login: mockLogin, logout: mockLogout });
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div data-testid="home" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('C. LoginPage', () => {
  beforeEach(() => { vi.clearAllMocks(); mockLogin.mockResolvedValue(makeUser()); });

  it('renders username and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the sign-in heading', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sign in/i);
  });

  it('renders the submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error when username is empty on submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/enter your username/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty on submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'director');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    });
  });

  it('calls login with trimmed username and password on valid submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), '  director  ');
    await user.type(screen.getByLabelText(/password/i), 'Pass1!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('director', 'Pass1!');
    });
  });

  it('navigates to "/" after successful login', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'director');
    await user.type(screen.getByLabelText(/password/i), 'Pass1!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument();
    });
  });

  it('shows server error when login throws', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'bad');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();
    const input = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(input.type).toBe('password');
    const toggle = screen.getByRole('button', { name: /show password/i });
    await user.click(toggle);
    expect(input.type).toBe('text');
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input.type).toBe('password');
  });
});

// ── D. GuestRoute ─────────────────────────────────────────────────────────────

import { GuestRoute } from '../routes/GuestRoute';

describe('D. GuestRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders outlet content when user is not logged in', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route index element={<div data-testid="guest-content" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('guest-content')).toBeInTheDocument();
  });

  it('redirects authenticated user to "/" ', () => {
    mockUseAuth.mockReturnValue({ user: makeUser(), isLoading: false, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<div data-testid="login-page" />} />
          </Route>
          <Route path="/" element={<div data-testid="dashboard" />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('shows loading spinner when isLoading=true', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route index element={<div data-testid="guest" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('guest')).not.toBeInTheDocument();
  });
});

// ── E. ProtectedRoute ─────────────────────────────────────────────────────────

import { ProtectedRoute } from '../routes/ProtectedRoute';

describe('E. ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects unauthenticated user to /login', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<div data-testid="admin" />} />
          </Route>
          <Route path="/login" element={<div data-testid="login" />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('login')).toBeInTheDocument();
    expect(screen.queryByTestId('admin')).not.toBeInTheDocument();
  });

  it('renders content for authenticated user with no role restriction', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('STUDENT'), isLoading: false, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div data-testid="protected" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('redirects to /unauthorized when role is not in allowedRoles', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('TEACHER'), isLoading: false, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin-only" element={<div data-testid="admin-page" />} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized" />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
  });

  it('renders content when user role IS in allowedRoles', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('DIRECTOR'), isLoading: false, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']} />}>
            <Route index element={<div data-testid="director-content" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('director-content')).toBeInTheDocument();
  });

  it('shows loading state while isLoading=true', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div data-testid="content" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('renders children prop directly (non-Outlet usage)', () => {
    mockUseAuth.mockReturnValue({ user: makeUser(), isLoading: false, login: mockLogin, logout: mockLogout });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="child-content" />
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});

// ── F. AuthContext ────────────────────────────────────────────────────────────

// Re-use the real AuthContext (unmock for this section)
vi.unmock('../context/AuthContext');

import { AuthProvider, useAuth } from '../context/AuthContext';
import { authApi } from '../lib/auth-api';

vi.mock('../lib/auth-api', () => ({
  authApi: {
    me:     vi.fn(),
    login:  vi.fn(),
    logout: vi.fn(),
  },
}));

function TestConsumer() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>loading</div>;
  return <div data-testid="user">{user?.username ?? 'no-user'}</div>;
}

describe('F. AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('isLoading=false and user=null when no token stored', async () => {
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
    const { findByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    // No token → no me() call, isLoading resolves to false quickly
    const el = await findByTestId('user');
    expect(el).toHaveTextContent('no-user');
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('hydrates user from stored token on mount', async () => {
    tokenStorage.setAccessToken('existing.token');
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser('TEACHER'));
    const { findByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    const el = await findByTestId('user');
    expect(el).toHaveTextContent('dir');
  });

  it('clears token and sets user=null when hydration fails', async () => {
    tokenStorage.setAccessToken('bad.token');
    (authApi.me as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));
    const { findByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    const el = await findByTestId('user');
    expect(el).toHaveTextContent('no-user');
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('session-expired event clears user', async () => {
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
    tokenStorage.setAccessToken('tok');
    const { findByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await findByTestId('user');
    // Fire the session-expired event
    await act(async () => {
      window.dispatchEvent(new Event('dsssms:session-expired'));
    });
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });
});
