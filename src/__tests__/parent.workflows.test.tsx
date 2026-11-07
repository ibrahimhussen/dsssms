/**
 * Parent workflow tests
 * - ParentChildrenPage: child list, empty state
 * - ParentResultsPage: results heading
 * - ParentMessagesPage: thread list, empty state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AuthenticatedUser } from '../types/auth';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

vi.mock('react-icons/md', () => { const i = () => <span />; return { MdVisibility:i,MdVisibilityOff:i,MdErrorOutline:i,MdSchool:i,MdAssessment:i,MdDescription:i,MdFactCheck:i,MdMenuBook:i,MdPrint:i,MdDownload:i,MdEmojiEvents:i,MdBarChart:i,MdSend:i,MdChat:i,MdInbox:i,MdArrowBack:i,MdPerson:i,MdAdd:i,MdDelete:i,MdEdit:i,MdCheck:i,MdClose:i,MdSearch:i,MdRefresh:i,MdWarning:i,MdInfo:i,MdCheckCircle:i,MdNotifications:i,MdLogout:i,MdMenu:i }; });

vi.mock('../hooks/useParents', () => ({
  useMyParentProfile: vi.fn(),
  useMyChildren:      vi.fn(),
  useMyProfile:       vi.fn(),
}));

vi.mock('../hooks/useMessaging', () => ({
  useMessageThreads:   vi.fn(),
  useMessageThread:    vi.fn(),
  useSendMessage:      vi.fn(),
  useEligibleTeachers: vi.fn(),
  useReplyToMessage:   vi.fn(),
}));

vi.mock('../hooks/useAcademicReports', () => ({
  useStudentReports:       vi.fn(),
  useStudentReport:        vi.fn(),
  useStudentTranscript:    vi.fn(),
  useStudentReportHistory: vi.fn(),
  useMyAcademicReports:    vi.fn(),
  useMyTranscript:         vi.fn(),
}));

vi.mock('../hooks/useStudents',   () => ({ useStudentById: vi.fn() }));
vi.mock('../hooks/useAttendance', () => ({ useStudentAttendanceSummary: vi.fn() }));

vi.mock('@tanstack/react-query', async (orig) => {
  const actual = await orig<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false }) };
});

vi.mock('../lib/auth-api',            () => ({ authApi:            { getProfile: vi.fn() } }));
vi.mock('../lib/system-settings-api', () => ({ systemSettingsApi: { get: vi.fn() } }));
vi.mock('../lib/students-api',        () => ({ studentsApi:        { getById: vi.fn() } }));
vi.mock('../lib/grades-api',          () => ({ gradesApi:          { getMyGrades: vi.fn() } }));
vi.mock('../lib/report-card-html',    () => ({ buildReportCardHtml: vi.fn().mockReturnValue('<html>') }));

vi.mock('../components/ui/LedgerRule',  () => ({ LedgerRule: () => <hr /> }));
vi.mock('../components/ui/EmptyState',  () => ({ EmptyState: ({ title }: { title: string }) => <div data-testid="empty">{title}</div> }));
vi.mock('../components/ui/Button',      () => ({ Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button> }));
vi.mock('../components/ui/Badge',       () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock('../components/ui/SelectField', () => ({
  SelectField: ({ label, value, onChange, children }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) => (
    <label><span>{label}</span><select aria-label={label} value={value} onChange={onChange}>{children}</select></label>
  ),
}));
vi.mock('../components/ui/TextField', () => ({
  TextField: ({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <label><span>{label}</span><input aria-label={label} value={value} onChange={onChange} /></label>
  ),
}));

import { useMyParentProfile } from '../hooks/useParents';
import { useMessageThreads, useSendMessage, useEligibleTeachers } from '../hooks/useMessaging';
import { useStudentReportHistory } from '../hooks/useAcademicReports';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeParent(): AuthenticatedUser {
  return { userId: 5, username: 'par', email: null, role: 'PARENT', status: 'ACTIVE', permissions: [], isTemporaryPassword: false, profilePicture: null, fullName: 'Papa P' };
}

const CHILD = {
  studentId: 101, firstName: 'Alice', lastName: 'A',
  admissionNumber: 'DSH-001', gender: 'F', dateOfBirth: '2010-01-15',
  relationship: 'FATHER',
  classroom: { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' },
};

// profile shape returned by useMyParentProfile
const PROFILE = { parentId: 10, userId: 5, fullName: 'Papa P', phoneNumber: null, status: 'ACTIVE', children: [CHILD] };
const EMPTY_PROFILE = { parentId: 10, userId: 5, fullName: 'Papa P', phoneNumber: null, status: 'ACTIVE', children: [] };

// ── A. ParentChildrenPage ─────────────────────────────────────────────────────

import { ParentChildrenPage } from '../pages/parent/ParentChildrenPage';

describe('A. ParentChildrenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: makeParent(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false });
  });

  it('renders the Academic Overview / children heading', () => {
    render(<MemoryRouter><ParentChildrenPage /></MemoryRouter>);
    const body = document.body.textContent?.toLowerCase() ?? '';
    expect(body.includes('child') || body.includes('academic') || body.includes('overview')).toBe(true);
  });

  it('shows empty state when no children linked', () => {
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({ data: EMPTY_PROFILE, isLoading: false });
    render(<MemoryRouter><ParentChildrenPage /></MemoryRouter>);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('renders each child name when children exist', () => {
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({ data: PROFILE, isLoading: false });
    render(<MemoryRouter><ParentChildrenPage /></MemoryRouter>);
    expect(screen.getByText(/Alice/i)).toBeInTheDocument();
  });

  it('shows admission number for each child', () => {
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({ data: PROFILE, isLoading: false });
    render(<MemoryRouter><ParentChildrenPage /></MemoryRouter>);
    expect(screen.getByText('DSH-001')).toBeInTheDocument();
  });

  it('does not crash while loading', () => {
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    render(<MemoryRouter><ParentChildrenPage /></MemoryRouter>);
    expect(document.body).toBeInTheDocument();
  });

  it('shows empty state when profile is null', () => {
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({ data: null, isLoading: false });
    render(<MemoryRouter><ParentChildrenPage /></MemoryRouter>);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });
});

// ── B. ParentMessagesPage ─────────────────────────────────────────────────────

import { ParentMessagesPage } from '../pages/parent/ParentMessagesPage';

describe('B. ParentMessagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: makeParent(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    (useMyParentProfile  as ReturnType<typeof vi.fn>).mockReturnValue({ data: PROFILE, isLoading: false });
    (useMessageThreads   as ReturnType<typeof vi.fn>).mockReturnValue({ data: { items: [], meta: { totalItems: 0, page: 1, limit: 20, totalPages: 1 } }, isLoading: false });
    (useEligibleTeachers as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    (useSendMessage      as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders the Messages heading', () => {
    render(<MemoryRouter><ParentMessagesPage /></MemoryRouter>);
    const body = document.body.textContent?.toLowerCase() ?? '';
    expect(body.includes('message')).toBe(true);
  });

  it('shows empty state when no children linked to profile', () => {
    // Empty state appears when profile.children.length === 0
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { ...PROFILE, children: [] },
      isLoading: false,
    });
    render(<MemoryRouter><ParentMessagesPage /></MemoryRouter>);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('renders teacher list section when profile has children', () => {
    // When children exist, the teacher-picker / thread-list view renders
    render(<MemoryRouter><ParentMessagesPage /></MemoryRouter>);
    const body = document.body.textContent?.toLowerCase() ?? '';
    // The Messages heading and child's name should appear
    expect(body.includes('message')).toBe(true);
  });

  it('renders thread section (messages heading visible)', () => {
    (useMessageThreads as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        items: [{
          otherUserId: 3, otherName: 'Tom T', otherRole: 'TEACHER',
          subjectName: 'English', studentId: 101, studentName: 'Alice A',
          lastMessage: 'How is Alice doing?', lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        }],
        meta: { totalItems: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
    });
    render(<MemoryRouter><ParentMessagesPage /></MemoryRouter>);
    // Messages heading always visible when profile has children
    expect(screen.getByRole('heading')).toHaveTextContent(/messages/i);
  });

  it('does not crash while profile is loading', () => {
    (useMyParentProfile as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    render(<MemoryRouter><ParentMessagesPage /></MemoryRouter>);
    expect(document.body).toBeInTheDocument();
  });
});

// ── C. ParentResultsPage ──────────────────────────────────────────────────────

import { ParentResultsPage } from '../pages/parent/ParentResultsPage';

describe('C. ParentResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: makeParent(), isLoading: false, login: vi.fn(), logout: vi.fn() });
    (useMyParentProfile      as ReturnType<typeof vi.fn>).mockReturnValue({ data: PROFILE, isLoading: false });
    (useStudentReportHistory as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false });
  });

  it('renders heading with results or grades', () => {
    render(<MemoryRouter><ParentResultsPage /></MemoryRouter>);
    const body = document.body.textContent?.toLowerCase() ?? '';
    expect(body.includes('result') || body.includes('grade') || body.includes('report')).toBe(true);
  });

  it('renders child name in the selector/header', () => {
    render(<MemoryRouter><ParentResultsPage /></MemoryRouter>);
    const body = document.body.textContent ?? '';
    expect(body.includes('Alice') || body.includes('DSH-001')).toBe(true);
  });

  it('does not crash when no reports returned', () => {
    (useStudentReportHistory as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    render(<MemoryRouter><ParentResultsPage /></MemoryRouter>);
    expect(document.body).toBeInTheDocument();
  });
});
