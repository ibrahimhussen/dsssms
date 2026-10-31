/**
 * Teacher workflow tests
 * - GradesPage: subject selector, add-component modal, loading states
 * - TeacherMessagesPage: thread list, empty state, thread rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AuthenticatedUser } from '../types/auth';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// All react-icons as no-ops
vi.mock('react-icons/md', () => { const i = () => <span />; return { MdVisibility:i,MdVisibilityOff:i,MdErrorOutline:i,MdSchool:i,MdAssessment:i,MdDescription:i,MdFactCheck:i,MdMenuBook:i,MdPrint:i,MdDownload:i,MdEmojiEvents:i,MdBarChart:i,MdSend:i,MdChat:i,MdInbox:i,MdArrowBack:i,MdPerson:i,MdAdd:i,MdDelete:i,MdEdit:i,MdCheck:i,MdClose:i,MdSearch:i,MdRefresh:i,MdWarning:i,MdInfo:i,MdCheckCircle:i,MdNotifications:i,MdLogout:i,MdMenu:i }; });

// Hooks
vi.mock('../hooks/useDashboardData', () => ({ useMyTeachingAssignments: vi.fn() }));
vi.mock('../hooks/useGrades', () => ({
  useGradeScheme:           vi.fn(),
  useClassroomTotals:       vi.fn(),
  useDeleteGradeComponent:  vi.fn(),
  useReleaseGradeComponent: vi.fn(),
}));
vi.mock('../hooks/useMessaging', () => ({
  useMessageThreads:  vi.fn(),
  useMessageThread:   vi.fn(),
  useReplyToMessage:  vi.fn(),
}));
vi.mock('../hooks/useFinalization', () => ({
  useSubmitForReview:      vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSubjectFinalization:  vi.fn(() => ({ data: undefined, isLoading: false })),
}));

// UI stubs
vi.mock('../components/ui/LedgerRule',    () => ({ LedgerRule: () => <hr /> }));
vi.mock('../components/ui/EmptyState',    () => ({ EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div> }));
vi.mock('../components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('../components/ui/Button',        () => ({ Button: ({ children, onClick, disabled, type }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: string }) => <button onClick={onClick} disabled={disabled} type={type as 'button' | 'submit' | 'reset'}>{children}</button> }));
vi.mock('../components/ui/Badge',         () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock('../components/ui/Card',          () => ({ Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../components/ui/SelectField',   () => ({
  SelectField: ({ label, value, onChange, children }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) => (
    <label>
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={onChange}>{children}</select>
    </label>
  ),
}));
vi.mock('../components/ui/TextField', () => ({
  TextField: ({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <label><span>{label}</span><input aria-label={label} value={value} onChange={onChange} /></label>
  ),
}));
vi.mock('../pages/grades/AddGradeComponentModal', () => ({
  AddGradeComponentModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-component-modal" /> : null,
}));
vi.mock('../pages/grades/GradeEntryModal', () => ({ GradeEntryModal: () => null }));

import { useMyTeachingAssignments } from '../hooks/useDashboardData';
import { useGradeScheme, useClassroomTotals, useDeleteGradeComponent, useReleaseGradeComponent } from '../hooks/useGrades';
import { useMessageThreads, useMessageThread, useReplyToMessage } from '../hooks/useMessaging';

function makeUser(role: AuthenticatedUser['role'] = 'TEACHER'): AuthenticatedUser {
  return { userId: 3, username: 'teacher', email: null, role, status: 'ACTIVE', permissions: [], isTemporaryPassword: false, profilePicture: null, fullName: 'Tom T' };
}

function setupHooksIdle() {
  (useMyTeachingAssignments as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined });
  (useGradeScheme           as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false });
  (useClassroomTotals       as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false });
  (useDeleteGradeComponent  as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync: vi.fn() });
  (useReleaseGradeComponent as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync: vi.fn() });
  (useMessageThreads        as ReturnType<typeof vi.fn>).mockReturnValue({ data: { items: [], meta: { totalItems: 0, page: 1, limit: 20, totalPages: 1 } }, isLoading: false });
  (useMessageThread         as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
  (useReplyToMessage        as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
}

// ── A. GradesPage ─────────────────────────────────────────────────────────────

import { GradesPage } from '../pages/grades/GradesPage';

describe('A. GradesPage — teacher result entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    setupHooksIdle();
  });

  it('renders "Enter grades" heading', () => {
    render(<MemoryRouter><GradesPage /></MemoryRouter>);
    expect(screen.getByRole('heading')).toHaveTextContent(/enter grades/i);
  });

  it('renders Subject & classroom selector', () => {
    render(<MemoryRouter><GradesPage /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: /subject.*classroom/i })).toBeInTheDocument();
  });

  it('renders Semester selector', () => {
    render(<MemoryRouter><GradesPage /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: /semester/i })).toBeInTheDocument();
  });

  it('renders Academic year input', () => {
    render(<MemoryRouter><GradesPage /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: /academic year/i })).toBeInTheDocument();
  });

  it('populates subject dropdown from useMyTeachingAssignments data', () => {
    (useMyTeachingAssignments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{
        id: 1,
        subject: { subjectName: 'Mathematics' },
        classroom: { className: 'Grade 9', section: 'A', academicYear: '2026/27' },
      }],
    });
    render(<MemoryRouter><GradesPage /></MemoryRouter>);
    expect(screen.getByRole('option', { name: /Mathematics/i })).toBeInTheDocument();
  });

  it('does not crash when scheme is loading', () => {
    (useMyTeachingAssignments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: 1, subject: { subjectName: 'English' }, classroom: { className: 'Grade 9', section: 'A', academicYear: '2026/27' } }],
    });
    (useGradeScheme as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    render(<MemoryRouter><GradesPage /></MemoryRouter>);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('Add Component button opens the modal', () => {
    (useMyTeachingAssignments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ id: 1, subject: { subjectName: 'English' }, classroom: { className: 'Grade 9', section: 'A', academicYear: '2026/27' } }],
    });
    (useGradeScheme as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { components: [], totalMaxMarks: 0, remainingMarks: 100, hasFinalExam: false },
      isLoading: false,
    });
    (useClassroomTotals as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });

    render(<MemoryRouter><GradesPage /></MemoryRouter>);

    // Select a subject to activate the scope
    fireEvent.change(screen.getByRole('combobox', { name: /subject.*classroom/i }), { target: { value: '1' } });

    // Modal is closed initially
    expect(screen.queryByTestId('add-component-modal')).not.toBeInTheDocument();

    // Click the Add Component button
    const addBtn = screen.getByRole('button', { name: /add component/i });
    fireEvent.click(addBtn);
    expect(screen.getByTestId('add-component-modal')).toBeInTheDocument();
  });
});

// ── B. TeacherMessagesPage ────────────────────────────────────────────────────

import { TeacherMessagesPage } from '../pages/messages/TeacherMessagesPage';

describe('B. TeacherMessagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: makeUser(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    setupHooksIdle();
  });

  it('renders the Messages heading', () => {
    render(<MemoryRouter><TeacherMessagesPage /></MemoryRouter>);
    expect(screen.getByRole('heading')).toHaveTextContent(/messages/i);
  });

  it('shows empty state when no threads exist', () => {
    render(<MemoryRouter><TeacherMessagesPage /></MemoryRouter>);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders thread list items when threads are returned', () => {
    (useMessageThreads as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        items: [{
          otherUserId: 10, otherName: 'Papa P', otherRole: 'PARENT',
          subjectName: '', studentId: 101, studentName: 'Alice A',
          lastMessage: 'Hello teacher', lastMessageAt: new Date().toISOString(),
          unreadCount: 2,
        }],
        meta: { totalItems: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
    });
    render(<MemoryRouter><TeacherMessagesPage /></MemoryRouter>);
    expect(screen.getByText('Papa P')).toBeInTheDocument();
    expect(screen.getByText(/Hello teacher/)).toBeInTheDocument();
  });

  it('does not crash when threads are loading', () => {
    (useMessageThreads as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    render(<MemoryRouter><TeacherMessagesPage /></MemoryRouter>);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('shows unread count badge when unreadCount > 0', () => {
    (useMessageThreads as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        items: [{
          otherUserId: 10, otherName: 'Mama M', otherRole: 'PARENT',
          subjectName: '', studentId: 102, studentName: 'Bob B',
          lastMessage: 'Please check', lastMessageAt: new Date().toISOString(),
          unreadCount: 3,
        }],
        meta: { totalItems: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
    });
    render(<MemoryRouter><TeacherMessagesPage /></MemoryRouter>);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
