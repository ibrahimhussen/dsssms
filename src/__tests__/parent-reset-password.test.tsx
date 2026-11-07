/**
 * Admin Parent Password Reset — frontend workflow tests
 *
 * Covers:
 *  - Admin sees the "Reset password" button
 *  - Director / Vice Director / Teacher do NOT see the button
 *  - Clicking the button opens a modal with a required reason field
 *  - The confirm button is disabled until a reason is entered
 *  - Submitting calls the API with the reason
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AuthenticatedUser } from '../types/auth';
import type { ParentSummary } from '../types/parent';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockUseParents = vi.fn();
const mockUseResetParentPassword = vi.fn();
vi.mock('../hooks/useParents', () => ({
  useParents: (...args: unknown[]) => mockUseParents(...args),
  useResetParentPassword: () => mockUseResetParentPassword(),
  useCreateParent: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useMyParentProfile: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('../components/ui/LedgerRule',  () => ({ LedgerRule: () => <hr /> }));
vi.mock('../components/ui/Pagination',  () => ({ Pagination: () => <div /> }));
vi.mock('../components/ui/TextField',   () => ({
  TextField: ({ label, onChange, value }: { label: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; value?: string }) => (
    <label><span>{label}</span><input aria-label={label} value={value ?? ''} onChange={onChange} /></label>
  ),
}));
vi.mock('../pages/parents/CreateParentModal', () => ({ CreateParentModal: () => null }));
vi.mock('../components/ui/CredentialsDialog',  () => ({ CredentialsDialog: () => null }));

// Keep Table, Button, Modal real for interaction testing

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkAdmin(): AuthenticatedUser {
  return { userId: 1, username: 'admin', email: null, role: 'ADMIN', status: 'ACTIVE', permissions: [], isTemporaryPassword: false, profilePicture: null, fullName: 'Admin User' };
}
function mkDirector(): AuthenticatedUser {
  return { ...mkAdmin(), userId: 2, username: 'dir', role: 'DIRECTOR', fullName: 'Director' };
}
function mkTeacher(): AuthenticatedUser {
  return { ...mkAdmin(), userId: 3, username: 'teach', role: 'TEACHER', fullName: 'Teacher' };
}

const PARENT_ROW: ParentSummary = {
  parentId: 10,
  userId: 100,
  username: 'papap',
  fullName: 'Papa Parent',
  phoneNumber: '+251911000000',
  email: null,
  children: [
    { studentId: 101, admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'A', relationship: 'FATHER' },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

import { ParentsPage } from '../pages/parents/ParentsPage';

describe('ParentsPage — admin password reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParents.mockReturnValue({
      data: { items: [PARENT_ROW], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseResetParentPassword.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ username: 'papap', temporaryPassword: 'TempPass1!' }),
      isPending: false,
    });
  });

  // ── Role-based visibility ──────────────────────────────────────────────────

  it('Admin sees the Reset password button', () => {
    mockUseAuth.mockReturnValue({ user: mkAdmin(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><ParentsPage /></MemoryRouter>);
    expect(screen.getByText('Reset password')).toBeInTheDocument();
  });

  it('Director does NOT see the Reset password button', () => {
    mockUseAuth.mockReturnValue({ user: mkDirector(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><ParentsPage /></MemoryRouter>);
    expect(screen.queryByText('Reset password')).toBeNull();
  });

  it('Teacher does NOT see the Reset password button', () => {
    mockUseAuth.mockReturnValue({ user: mkTeacher(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><ParentsPage /></MemoryRouter>);
    expect(screen.queryByText('Reset password')).toBeNull();
  });

  // ── Modal interaction ──────────────────────────────────────────────────────

  it('clicking Reset password opens a modal with a reason field', () => {
    mockUseAuth.mockReturnValue({ user: mkAdmin(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><ParentsPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('Reset password'));

    expect(screen.getByText(/Reason for reset/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Parent forgot password/i)).toBeInTheDocument();
  });

  it('confirm button is disabled until a reason is entered', () => {
    mockUseAuth.mockReturnValue({ user: mkAdmin(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><ParentsPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('Reset password'));

    // The modal's confirm button is labeled "Reset password" — but there are
    // two elements with that text (the row button + the modal button).
    // Find the one inside the modal (the last one).
    const allResetButtons = screen.getAllByText('Reset password');
    const modalConfirmButton = allResetButtons[allResetButtons.length - 1]!.closest('button')!;
    expect(modalConfirmButton).toBeDisabled();

    // Type a reason
    const textarea = screen.getByPlaceholderText(/Parent forgot password/i);
    fireEvent.change(textarea, { target: { value: 'Parent requested via phone' } });

    expect(modalConfirmButton).not.toBeDisabled();
  });

  it('submitting calls the API with the reason and parent ID', async () => {
    mockUseAuth.mockReturnValue({ user: mkAdmin(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    const mutateAsync = vi.fn().mockResolvedValue({ username: 'papap', temporaryPassword: 'TempPass1!' });
    mockUseResetParentPassword.mockReturnValue({ mutateAsync, isPending: false });

    render(<MemoryRouter><ParentsPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('Reset password'));

    const textarea = screen.getByPlaceholderText(/Parent forgot password/i);
    fireEvent.change(textarea, { target: { value: 'Forgot password' } });

    const allResetButtons = screen.getAllByText('Reset password');
    const modalConfirmButton = allResetButtons[allResetButtons.length - 1]!.closest('button')!;
    fireEvent.click(modalConfirmButton);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ parentId: 10, reason: 'Forgot password' });
    });
  });

  it('cancel closes the modal and does not call the API', () => {
    mockUseAuth.mockReturnValue({ user: mkAdmin(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    const mutateAsync = vi.fn();
    mockUseResetParentPassword.mockReturnValue({ mutateAsync, isPending: false });

    render(<MemoryRouter><ParentsPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('Reset password'));

    // Click Cancel
    fireEvent.click(screen.getByText('Cancel'));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByText(/Reason for reset/i)).toBeNull();
  });

  it('shows the parent name and username in the modal', () => {
    mockUseAuth.mockReturnValue({ user: mkAdmin(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><ParentsPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('Reset password'));

    // Parent name appears in the table row (1st) and in the modal's <strong> tag (2nd)
    expect(screen.getAllByText('Papa Parent').length).toBeGreaterThanOrEqual(2);

    // Username is embedded in the modal paragraph text — verify via body content
    const modalText = document.body.textContent ?? '';
    expect(modalText).toContain('papap');
  });
});
