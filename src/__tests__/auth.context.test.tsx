/**
 * AuthContext — hydration, login, logout, session-expired event.
 * Separate file so vi.mock of auth-api doesn't interfere with other tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import type { AuthenticatedUser } from '../types/auth';
import { tokenStorage } from '../lib/token-storage';

// Real AuthContext — NOT mocked in this file
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../lib/auth-api', () => ({
  authApi: {
    me:     vi.fn(),
    login:  vi.fn(),
    logout: vi.fn(),
  },
}));

import { authApi } from '../lib/auth-api';

function makeUser(role: AuthenticatedUser['role'] = 'DIRECTOR'): AuthenticatedUser {
  return {
    userId: 1, username: 'dir', email: null, role,
    status: 'ACTIVE', permissions: [], isTemporaryPassword: false,
    profilePicture: null, fullName: 'Dave D',
  };
}

function TestConsumer() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div data-testid="loading">loading</div>;
  return <div data-testid="user">{user?.username ?? 'no-user'}</div>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('user=null and isLoading=false when no token stored', async () => {
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    );
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('hydrates user when a valid token is in sessionStorage', async () => {
    tokenStorage.setAccessToken('valid.token');
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser('TEACHER'));
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('dir')
    );
    expect(authApi.me).toHaveBeenCalledOnce();
  });

  it('clears token and sets user=null when hydration fails', async () => {
    tokenStorage.setAccessToken('expired.token');
    (authApi.me as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    );
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('session-expired event sets user to null', async () => {
    tokenStorage.setAccessToken('tok');
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('dir')
    );
    await act(async () => {
      window.dispatchEvent(new Event('dsssms:session-expired'));
    });
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('login stores token and sets user', async () => {
    (authApi.me as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no token'));

    function LoginTrigger() {
      const { user, login } = useAuth();
      return (
        <div>
          <div data-testid="user">{user?.role ?? 'none'}</div>
          <button onClick={() => void login('dir', 'pass')}>Login</button>
        </div>
      );
    }

    (authApi.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'new.tok',
      user: makeUser('DIRECTOR'),
    });

    const { getByRole } = render(<AuthProvider><LoginTrigger /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));

    await act(async () => { getByRole('button').click(); });
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('DIRECTOR')
    );
    expect(tokenStorage.getAccessToken()).toBe('new.tok');
  });

  it('logout clears token and sets user to null', async () => {
    tokenStorage.setAccessToken('tok');
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
    (authApi.logout as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    function LogoutTrigger() {
      const { user, logout } = useAuth();
      return (
        <div>
          <div data-testid="user">{user?.username ?? 'none'}</div>
          <button onClick={() => void logout()}>Logout</button>
        </div>
      );
    }

    const { getByRole } = render(<AuthProvider><LogoutTrigger /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('dir'));
    await act(async () => { getByRole('button').click(); });
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('none')
    );
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});
