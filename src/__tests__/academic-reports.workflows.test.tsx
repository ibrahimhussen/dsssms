/**
 * Academic Reports page — regression tests for academic-year and classroom dropdowns.
 *
 * Bug: The page used hardcoded clock-based academic year options ("2025/26",
 * "2026/27", "2027/28") instead of deriving them from classroom data. The seed
 * file stores classrooms with academicYear "2026" (bare), so selecting "2026/27"
 * from the hardcoded list produced zero classroom matches → empty dropdown.
 *
 * Fix: Academic year options are now derived from classroom records via
 * useClassroomOptions(), matching the pattern used by Academic Register and
 * Results Finalization pages. Loading and error states are now surfaced.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// react-icons as no-ops
vi.mock('react-icons/md', () => {
  const i = () => <span />;
  return { MdAutoAwesome: i, MdBarChart: i, MdCheckCircle: i, MdWarningAmber: i, MdInfoOutline: i };
});

const mockUseClassroomOptions = vi.fn();
vi.mock('../hooks/useClassrooms', () => ({
  useClassroomOptions: () => mockUseClassroomOptions(),
}));

vi.mock('../hooks/useAcademicReports', () => ({
  useGenerateClassroomReports: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  })),
}));

// UI stubs
vi.mock('../components/ui/LedgerRule', () => ({ LedgerRule: () => <hr /> }));
vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));
vi.mock('../components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('../components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));
vi.mock('../components/ui/SelectField', () => ({
  SelectField: ({
    label,
    value,
    onChange,
    children,
    disabled,
  }: {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <label>
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={onChange} disabled={disabled}>
        {children}
      </select>
    </label>
  ),
}));

import { AcademicReportsPage } from '../pages/academic-reports/AcademicReportsPage';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkClassroom(id: number, className: string, section: string, academicYear: string) {
  return {
    classroomId: id,
    className,
    section,
    academicYear,
    session: 'MORNING' as const,
    homeroomTeacher: null,
    studentCount: 25,
  };
}

const CLASSROOMS_2026 = [
  mkClassroom(1, 'Grade 9', 'A', '2026'),
  mkClassroom(2, 'Grade 9', 'B', '2026'),
  mkClassroom(3, 'Grade 9', 'C', '2026'),
  mkClassroom(4, 'Grade 10', 'A', '2026'),
  mkClassroom(5, 'Grade 11', 'A', '2026'),
];

const CLASSROOMS_MIXED = [
  mkClassroom(6, 'Grade 9', 'A', '2025/26'),
  ...CLASSROOMS_2026,
];

function setClassrooms(
  items: ReturnType<typeof mkClassroom>[] | undefined,
  opts?: { isLoading?: boolean; error?: Error | null }
) {
  mockUseClassroomOptions.mockReturnValue({
    data: items
      ? { items, meta: { totalItems: items.length, page: 1, limit: 100, totalPages: 1 } }
      : undefined,
    isLoading: opts?.isLoading ?? false,
    error: opts?.error ?? null,
  });
}

// ── Tests: academic year derived from classrooms ───────────────────────────────

describe('AcademicReportsPage — academic year derived from classrooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "2026" in academic year dropdown when classrooms use that format', () => {
    setClassrooms(CLASSROOMS_2026);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    const yearSelect = screen.getByRole('combobox', { name: /academic year/i });
    const yearValues = Array.from(yearSelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter(Boolean);

    expect(yearValues).toContain('2026');
    // Must NOT contain hardcoded "2026/27" — the original bug
    expect(yearValues).not.toContain('2026/27');
  });

  it('does NOT show hardcoded "2025/26", "2026/27", "2027/28" when classrooms only use "2026"', () => {
    setClassrooms(CLASSROOMS_2026);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    const yearValues = Array.from(
      screen.getByRole('combobox', { name: /academic year/i }).querySelectorAll('option')
    )
      .map((o) => o.value)
      .filter(Boolean);

    expect(yearValues).toEqual(['2026']);
    expect(yearValues).not.toContain('2025/26');
    expect(yearValues).not.toContain('2026/27');
    expect(yearValues).not.toContain('2027/28');
  });

  it('shows historical years like "2025/26" alongside "2026"', () => {
    setClassrooms(CLASSROOMS_MIXED);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    const yearValues = Array.from(
      screen.getByRole('combobox', { name: /academic year/i }).querySelectorAll('option')
    )
      .map((o) => o.value)
      .filter(Boolean);

    expect(yearValues).toContain('2026');
    expect(yearValues).toContain('2025/26');
  });

  it('auto-selects the most recent academic year from classroom data', async () => {
    setClassrooms(CLASSROOMS_MIXED);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /academic year/i })).toHaveValue('2026');
    });
  });
});

// ── Tests: classroom dropdown for specific grades ──────────────────────────────

describe('AcademicReportsPage — classroom dropdown for Grade 9', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Grade 9 sections A, B, C after selecting Grade 9 and 2026', async () => {
    setClassrooms(CLASSROOMS_2026);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    // Wait for auto-select of academic year
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /academic year/i })).toHaveValue('2026');
    });

    // Select Grade 9
    fireEvent.change(screen.getByRole('combobox', { name: /grade/i }), {
      target: { value: 'Grade 9' },
    });

    // Classroom dropdown should show A, B, C
    const classroomSelect = screen.getByRole('combobox', { name: /classroom/i });
    const classroomTexts = Array.from(classroomSelect.querySelectorAll('option')).map(
      (o) => o.textContent
    );

    expect(classroomTexts).toContain('Grade 9 A');
    expect(classroomTexts).toContain('Grade 9 B');
    expect(classroomTexts).toContain('Grade 9 C');
  });

  it('shows only Grade 10 section A after selecting Grade 10', async () => {
    setClassrooms(CLASSROOMS_2026);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /academic year/i })).toHaveValue('2026');
    });

    fireEvent.change(screen.getByRole('combobox', { name: /grade/i }), {
      target: { value: 'Grade 10' },
    });

    const classroomSelect = screen.getByRole('combobox', { name: /classroom/i });
    const classroomTexts = Array.from(classroomSelect.querySelectorAll('option')).map(
      (o) => o.textContent
    );

    expect(classroomTexts).toContain('Grade 10 A');
    expect(classroomTexts).not.toContain('Grade 9 A');
  });
});

// ── Tests: dependent dropdown behavior ────────────────────────────────────────

describe('AcademicReportsPage — dependent dropdown behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears classroom selection when grade changes', async () => {
    setClassrooms(CLASSROOMS_2026);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /academic year/i })).toHaveValue('2026');
    });

    // Select Grade 9 and a classroom
    fireEvent.change(screen.getByRole('combobox', { name: /grade/i }), {
      target: { value: 'Grade 9' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /classroom/i }), {
      target: { value: '1' },
    });
    expect(screen.getByRole('combobox', { name: /classroom/i })).toHaveValue('1');

    // Change grade to Grade 10 — classroom selection should clear
    fireEvent.change(screen.getByRole('combobox', { name: /grade/i }), {
      target: { value: 'Grade 10' },
    });
    expect(screen.getByRole('combobox', { name: /classroom/i })).toHaveValue('');
  });

  it('clears classroom selection when academic year changes', async () => {
    setClassrooms(CLASSROOMS_MIXED);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /academic year/i })).toHaveValue('2026');
    });

    // Select Grade 9 and a classroom
    fireEvent.change(screen.getByRole('combobox', { name: /grade/i }), {
      target: { value: 'Grade 9' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /classroom/i }), {
      target: { value: '1' },
    });
    expect(screen.getByRole('combobox', { name: /classroom/i })).toHaveValue('1');

    // Change academic year — classroom selection should clear
    fireEvent.change(screen.getByRole('combobox', { name: /academic year/i }), {
      target: { value: '2025/26' },
    });
    expect(screen.getByRole('combobox', { name: /classroom/i })).toHaveValue('');
  });

  it('shows "No sections found" when no classrooms match the grade/year', async () => {
    // Grade 10 exists but only in "2025/26", not "2026" — so selecting Grade 10
    // with auto-selected year "2026" should yield zero classroom matches.
    setClassrooms([
      mkClassroom(1, 'Grade 9', 'A', '2026'),
      mkClassroom(2, 'Grade 10', 'A', '2025/26'),
    ]);
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /academic year/i })).toHaveValue('2026');
    });

    // Select Grade 10 — no classrooms exist for Grade 10 in 2026
    fireEvent.change(screen.getByRole('combobox', { name: /grade/i }), {
      target: { value: 'Grade 10' },
    });

    const classroomSelect = screen.getByRole('combobox', { name: /classroom/i });
    const emptyOption = classroomSelect.querySelector('option[value=""]');
    expect(emptyOption?.textContent).toContain('No sections found');
  });
});

// ── Tests: loading and error states ────────────────────────────────────────────

describe('AcademicReportsPage — loading and error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading indicator while classrooms are loading', () => {
    setClassrooms(undefined, { isLoading: true });
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading classrooms/i)).toBeInTheDocument();
  });

  it('displays classroom fetch error instead of silent empty dropdown', () => {
    setClassrooms(undefined, { error: new Error('Network connection failed') });
    render(
      <MemoryRouter>
        <AcademicReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/network connection failed/i)).toBeInTheDocument();
  });
});
