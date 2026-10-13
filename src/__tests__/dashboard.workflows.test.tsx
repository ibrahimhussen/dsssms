/**
 * Dashboard + navigation workflow tests
 * - Each role sees the correct dashboard component
 * - Role-specific RBAC navigation guards
 * - Error pages (404, 401)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthenticatedUser } from '../types/auth';

// ── Shared mock ───────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-icons/md', () => { const i = () => <span />; return { MdVisibility:i,MdVisibilityOff:i,MdErrorOutline:i,MdSchool:i,MdAssessment:i,MdDescription:i,MdFactCheck:i,MdMenuBook:i,MdPrint:i,MdDownload:i,MdEmojiEvents:i,MdBarChart:i,MdSend:i,MdChat:i,MdInbox:i,MdArrowBack:i,MdPerson:i,MdAdd:i,MdDelete:i,MdEdit:i,MdCheck:i,MdClose:i,MdSearch:i,MdRefresh:i,MdWarning:i,MdInfo:i,MdCheckCircle:i,MdNotifications:i,MdLogout:i,MdMenu:i }; });

function makeUser(role: AuthenticatedUser['role'] = 'DIRECTOR'): AuthenticatedUser {
  return { userId: 1, username: 'u', email: null, role, status: 'ACTIVE', permissions: [], isTemporaryPassword: false, profilePicture: null, fullName: 'Test User' };
}

// ── A. Error pages ────────────────────────────────────────────────────────────

import { NotFoundPage }      from '../pages/errors/NotFoundPage';
import { UnauthorizedPage }  from '../pages/errors/UnauthorizedPage';

describe('A. Error pages', () => {
  it('NotFoundPage renders a 404 heading or "not found" text', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    // Either "404" or "not found" must appear
    const body = document.body.textContent?.toLowerCase() ?? '';
    expect(body.includes('404') || body.includes('not found')).toBe(true);
  });

  it('UnauthorizedPage renders "unauthorized" or "403" text', () => {
    render(
      <MemoryRouter>
        <UnauthorizedPage />
      </MemoryRouter>
    );
    const body = document.body.textContent?.toLowerCase() ?? '';
    expect(
      body.includes('unauthorized') || body.includes('403') || body.includes('permission') || body.includes('access')
    ).toBe(true);
  });
});

// ── B. DashboardPage role routing ─────────────────────────────────────────────

vi.mock('../pages/dashboard/AdminDashboard',        () => ({ AdminDashboard:        () => <div data-testid="admin-dash" /> }));
vi.mock('../pages/dashboard/DirectorDashboard',     () => ({ DirectorDashboard:     () => <div data-testid="director-dash" /> }));
vi.mock('../pages/dashboard/ViceDirectorDashboard', () => ({ ViceDirectorDashboard: () => <div data-testid="vd-dash" /> }));
vi.mock('../pages/dashboard/TeacherDashboard',      () => ({ TeacherDashboard:      () => <div data-testid="teacher-dash" /> }));
vi.mock('../pages/dashboard/StudentDashboard',      () => ({ StudentDashboard:      () => <div data-testid="student-dash" /> }));
vi.mock('../pages/dashboard/ParentDashboard',       () => ({ ParentDashboard:       () => <div data-testid="parent-dash" /> }));
vi.mock('../components/ui/LedgerRule',              () => ({ LedgerRule: () => <hr /> }));

import { DashboardPage } from '../pages/dashboard/DashboardPage';

function renderDashAs(role: AuthenticatedUser['role']) {
  mockUseAuth.mockReturnValue({ user: makeUser(role), isLoading: false, login: vi.fn(), logout: vi.fn() });
  return render(<DashboardPage />);
}

describe('B. DashboardPage — one dashboard per role', () => {
  beforeEach(() => vi.clearAllMocks());

  const roleToTestId: Array<[AuthenticatedUser['role'], string]> = [
    ['ADMIN',          'admin-dash'],
    ['DIRECTOR',       'director-dash'],
    ['VICE_DIRECTOR',  'vd-dash'],
    ['TEACHER',        'teacher-dash'],
    ['STUDENT',        'student-dash'],
    ['PARENT',         'parent-dash'],
  ];

  for (const [role, testId] of roleToTestId) {
    it(`renders ${testId} for ${role}`, () => {
      renderDashAs(role);
      expect(screen.getByTestId(testId)).toBeInTheDocument();
      // No other dashboard visible
      for (const [, tid] of roleToTestId.filter(([r]) => r !== role)) {
        expect(screen.queryByTestId(tid)).not.toBeInTheDocument();
      }
    });
  }

  it('renders null when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, login: vi.fn(), logout: vi.fn() });
    const { container } = render(<DashboardPage />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the fullName in the h1 heading', () => {
    renderDashAs('DIRECTOR');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test User');
  });
});

// ── C. ProtectedRoute RBAC matrix ─────────────────────────────────────────────

import { ProtectedRoute } from '../routes/ProtectedRoute';

describe('C. ProtectedRoute RBAC matrix', () => {
  beforeEach(() => vi.clearAllMocks());

  const ADMIN_ROLES: AuthenticatedUser['role'][] = ['ADMIN'];
  const OVERSIGHT: AuthenticatedUser['role'][] = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'];

  function mount(role: AuthenticatedUser['role'] | null, allowed: AuthenticatedUser['role'][]) {
    mockUseAuth.mockReturnValue({ user: role ? makeUser(role) : null, isLoading: false, login: vi.fn(), logout: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/page']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={allowed} />}>
            <Route path="/page" element={<div data-testid="allowed" />} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized" />} />
          <Route path="/login" element={<div data-testid="login" />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('ADMIN can access ADMIN-only page', () => {
    mount('ADMIN', ADMIN_ROLES);
    expect(screen.getByTestId('allowed')).toBeInTheDocument();
  });

  it('DIRECTOR cannot access ADMIN-only page → /unauthorized', () => {
    mount('DIRECTOR', ADMIN_ROLES);
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('allowed')).not.toBeInTheDocument();
  });

  it('TEACHER cannot access oversight page → /unauthorized', () => {
    mount('TEACHER', OVERSIGHT);
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });

  it('STUDENT cannot access oversight page → /unauthorized', () => {
    mount('STUDENT', OVERSIGHT);
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });

  it('null user → /login regardless of allowedRoles', () => {
    mount(null, OVERSIGHT);
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('DIRECTOR can access oversight page', () => {
    mount('DIRECTOR', OVERSIGHT);
    expect(screen.getByTestId('allowed')).toBeInTheDocument();
  });
});
