/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Auth workflow tests
 * LoginPage, GuestRoute, ProtectedRoute, role-redirect, token-storage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthenticatedUser } from '../types/auth';
import { getRoleDashboardPath, getPostLoginRedirect } from '../lib/role-redirect';
import { tokenStorage } from '../lib/token-storage';

// ── Mock AuthContext ──────────────────────────────────────────────────────────

const mockLogin   = vi.fn();
const mockLogout  = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth:      () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-icons so SVG imports don't crash jsdom
vi.mock('react-icons/md', () => { const i = () => <span />; return { MdVisibility:i,MdVisibilityOff:i,MdErrorOutline:i,MdSchool:i,MdAssessment:i,MdDescription:i,MdFactCheck:i,MdMenuBook:i,MdPrint:i,MdDownload:i,MdEmojiEvents:i,MdBarChart:i,MdSend:i,MdChat:i,MdInbox:i,MdArrowBack:i,MdPerson:i,MdAdd:i,MdDelete:i,MdEdit:i,MdCheck:i,MdClose:i,MdSearch:i,MdRefresh:i,MdWarning:i,MdInfo:i,MdCheckCircle:i,MdNotifications:i,MdLogout:i,MdMenu:i }; });

vi.mock('../components/ui/Button', () => ({
  Button: ({
    children, isLoading: _l, ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) => (
    <button {...props}>{children}</button>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(role: AuthenticatedUser['role'] = 'DIRECTOR'): AuthenticatedUser {
  return {
    userId: 1, username: 'u', email: null, role,
    status: 'ACTIVE', permissions: [], isTemporaryPassword: false,
    profilePicture: null, fullName: 'Test User',
  };
}

function authState(user: AuthenticatedUser | null, loading = false) {
  mockUseAuth.mockReturnValue({ user, isLoading: loading, login: mockLogin, logout: mockLogout });
}

// ── A. role-redirect ─────────────────────────────────────────────────────────

describe('A. role-redirect', () => {
  it('getRoleDashboardPath returns "/" for every role', () => {
    const roles: AuthenticatedUser['role'][] = [
      'ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'TEACHER', 'STUDENT', 'PARENT',
    ];
    for (const r of roles) expect(getRoleDashboardPath(r)).toBe('/');
  });

  it('getPostLoginRedirect honours a safe "from" path', () => {
    expect(getPostLoginRedirect('TEACHER', '/grades')).toBe('/grades');
    expect(getPostLoginRedirect('DIRECTOR', '/students/101')).toBe('/students/101');
  });

  it('getPostLoginRedirect blocks /login, /unauthorized and / as "from"', () => {
    expect(getPostLoginRedirect('DIRECTOR', '/login')).toBe('/');
    expect(getPostLoginRedirect('DIRECTOR', '/unauthorized')).toBe('/');
    expect(getPostLoginRedirect('DIRECTOR', '/')).toBe('/');
  });

  it('getPostLoginRedirect falls back to "/" when from is null/undefined', () => {
    expect(getPostLoginRedirect('STUDENT', null)).toBe('/');
    expect(getPostLoginRedirect('STUDENT', undefined)).toBe('/');
  });
});

// ── B. token-storage ─────────────────────────────────────────────────────────

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

  it('getRefreshToken always returns null (moved to httpOnly cookie)', () => {
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('setTokens stores the access token', () => {
    tokenStorage.setTokens('at123', 'rt_ignored');
    expect(tokenStorage.getAccessToken()).toBe('at123');
  });
});

// ── C. LoginPage ─────────────────────────────────────────────────────────────

import { LoginPage } from '../pages/auth/LoginPage';

function renderLogin(user: AuthenticatedUser | null = null) {
  authState(user);
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<div data-testid="home" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('C. LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(makeUser());
  });

  it('renders username field', () => {
    renderLogin();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  });

  it('renders password field', () => {
    renderLogin();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders the sign-in heading', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sign in/i);
  });

  it('shows validation error when submitting with empty username', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/enter your username/i)).toBeInTheDocument()
    );
  });

  it('shows validation error when submitting with empty password', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'director');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/enter your password/i)).toBeInTheDocument()
    );
  });

  it('calls login with trimmed username on valid submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), '  director  ');
    await user.type(screen.getByLabelText('Password'), 'Pass1!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('director', 'Pass1!'));
  });

  it('navigates to "/" after successful login', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'director');
    await user.type(screen.getByLabelText('Password'), 'Pass1!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByTestId('home')).toBeInTheDocument()
    );
  });

  it('shows server error when login throws', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/username/i), 'bad');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    );
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(input.type).toBe('text');
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input.type).toBe('password');
  });
});

// ── D. GuestRoute ─────────────────────────────────────────────────────────────

import { GuestRoute } from '../routes/GuestRoute';

describe('D. GuestRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders outlet for unauthenticated user', () => {
    authState(null);
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

  it('redirects authenticated user to "/"', () => {
    authState(makeUser());
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
    authState(null, true);
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

function mountProtected(
  role: AuthenticatedUser['role'] | null,
  allowed: AuthenticatedUser['role'][],
  loading = false,
) {
  authState(role ? makeUser(role) : null, loading);
  render(
    <MemoryRouter initialEntries={['/page']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={allowed} />}>
          <Route path="/page" element={<div data-testid="allowed" />} />
        </Route>
        <Route path="/unauthorized" element={<div data-testid="unauthorized" />} />
        <Route path="/login"        element={<div data-testid="login" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('E. ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unauthenticated user → /login', () => {
    mountProtected(null, ['ADMIN']);
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('wrong role → /unauthorized', () => {
    mountProtected('TEACHER', ['ADMIN']);
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('allowed')).not.toBeInTheDocument();
  });

  it('correct role → renders content', () => {
    mountProtected('DIRECTOR', ['ADMIN', 'DIRECTOR']);
    expect(screen.getByTestId('allowed')).toBeInTheDocument();
  });

  it('no allowedRoles restriction → any authenticated user passes', () => {
    authState(makeUser('STUDENT'));
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div data-testid="open" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('open')).toBeInTheDocument();
  });

  it('isLoading → shows spinner, no content', () => {
    mountProtected(null, ['ADMIN'], true);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('allowed')).not.toBeInTheDocument();
  });

  it('renders children prop directly', () => {
    authState(makeUser());
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="child" />
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('STUDENT cannot access TEACHER-only page', () => {
    mountProtected('STUDENT', ['TEACHER']);
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });

  it('PARENT cannot access oversight page', () => {
    mountProtected('PARENT', ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']);
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });
});
