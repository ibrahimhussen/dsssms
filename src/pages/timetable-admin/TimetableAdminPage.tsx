import { useState, useMemo } from 'react';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useAssignments } from '../../hooks/useTeacherSubjects';
import { useAuth } from '../../context/AuthContext';
import { useTimetable, useDeleteTimetableEntry, usePublishTimetableEntry } from '../../hooks/useTimetable';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AddTimetableEntryModal } from './AddTimetableEntryModal';
import { TimetableMatrixTable, DEFAULT_PERIODS } from './TimetableMatrixTable';
import type { DayOfWeek, TimetableEntry } from '../../types/timetable';
import type { Semester } from '../../types/grade';
import type { ClassSession } from '../../types/classroom';

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
};

function currentAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export function TimetableAdminPage() {
  const { data: classrooms } = useClassroomOptions();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [fillSlot, setFillSlot] = useState<{ day: DayOfWeek; startTime: string; endTime: string; period: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TimetableEntry | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const { user } = useAuth();

  // Available academic years from current system classroom information
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(classrooms?.items.map((c) => c.academicYear).filter(Boolean) ?? []));
    const defaultYear = currentAcademicYear();
    if (!years.includes(defaultYear)) {
      years.push(defaultYear);
    }
    return years.sort().reverse();
  }, [classrooms]);

  // Available sections (e.g. A, B, C, D) from classrooms
  const availableSections = useMemo(() => {
    const sections = Array.from(new Set(classrooms?.items.map((c) => c.section.trim().toUpperCase()).filter(Boolean) ?? []));
    return sections.sort();
  }, [classrooms]);

  // Filter classrooms by selected academic year and section if chosen
  const filteredClassrooms = useMemo(() => {
    if (!classrooms?.items) return [];
    return classrooms.items.filter((c) => {
      const matchesYear = !selectedAcademicYear || c.academicYear === selectedAcademicYear;
      const matchesSection = !selectedSection || c.section.trim().toUpperCase() === selectedSection.toUpperCase();
      return matchesYear && matchesSection;
    });
  }, [classrooms, selectedAcademicYear, selectedSection]);

  const { data: teachingAssignments } = useAssignments({ classroomId, limit: 100 });
  const { data: entries, isLoading } = useTimetable({ classroomId, semester });
  const deleteEntry = useDeleteTimetableEntry();
  const publishEntry = usePublishTimetableEntry();

  const draftEntries = useMemo(() => entries?.filter(e => e.status === 'DRAFT') ?? [], [entries]);

  // Identify selected classroom's session (MORNING or AFTERNOON)
  const selectedClassroom = useMemo(
    () => classrooms?.items.find((c) => c.classroomId === classroomId),
    [classrooms, classroomId]
  );
  const classroomSession: ClassSession | undefined = selectedClassroom?.session;

  function handleDownloadPdf() {
    if (!entries || !selectedClassroom) return;

    const semesterLabel = semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2';
    const classLabel = `${selectedClassroom.className} — Section ${selectedClassroom.section}`;
    const yearLabel = selectedClassroom.academicYear;
    const sessionLabel = classroomSession === 'MORNING' ? 'Morning Session (2:00 – 6:15)' : 'Afternoon Session (6:30 – 10:45)';
    const sessionIcon = classroomSession === 'MORNING' ? '☀️' : '🌤️';
    const sessionColor = classroomSession === 'MORNING' ? '#f59e0b' : '#6366f1';
    const sessionBgLight = classroomSession === 'MORNING' ? '#fffbeb' : '#eef2ff';

    // Build periods for this session
    const periods = DEFAULT_PERIODS.filter((p) => {
      if (!classroomSession) return true;
      if (p.session === 'Break') return p.id.startsWith(classroomSession === 'MORNING' ? 'm-' : 'a-');
      return p.session === (classroomSession === 'MORNING' ? 'Morning' : 'Afternoon');
    });

    const days: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const dayLabels: Record<string, string> = {
      MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
      THURSDAY: 'Thursday', FRIDAY: 'Friday',
    };

    // Build entry lookup
    const entryMap = new Map<string, TimetableEntry>();
    for (const e of entries) {
      entryMap.set(`${e.dayOfWeek}_${e.startTime}_${e.endTime}`, e);
    }

    // Subject color palette
    const subjectColors = [
      { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
      { bg: '#eff6ff', border: '#93c5fd', text: '#1e3a5f' },
      { bg: '#fdf4ff', border: '#d8b4fe', text: '#581c87' },
      { bg: '#fff7ed', border: '#fdba74', text: '#7c2d12' },
      { bg: '#f0fdf4', border: '#86efac', text: '#14532d' },
      { bg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d' },
      { bg: '#f0f9ff', border: '#7dd3fc', text: '#0c4a6e' },
      { bg: '#fefce8', border: '#fde047', text: '#713f12' },
    ];
    const subjectNames = [...new Set(entries.map((e) => e.teacherSubject.subject.subjectName))];
    const subjectColorMap = new Map<string, typeof subjectColors[0]>();
    subjectNames.forEach((name, i) => subjectColorMap.set(name, subjectColors[i % subjectColors.length]));

    // Build period header cells
    const periodHeaders = periods.map((p) => {
      if (p.session === 'Break') {
        return `<th class="break-header"><div class="period-name">☕ Rest</div><div class="period-time">${p.localTime}</div></th>`;
      }
      return `<th class="period-header"><div class="period-name">${p.name}</div><div class="period-time">${p.localTime}</div></th>`;
    }).join('\n');

    // Build body rows
    const bodyRows = days.map((day) => {
      const cells = periods.map((p) => {
        if (p.session === 'Break') {
          return '<td class="break-cell"><span class="break-icon">☕</span></td>';
        }
        const entry = entryMap.get(`${day}_${p.startTime}_${p.endTime}`);
        if (!entry) return '<td class="empty-cell">—</td>';
        const subjectName = entry.teacherSubject.subject.subjectName;
        const teacherName = `${entry.teacherSubject.teacher.firstName} ${entry.teacherSubject.teacher.lastName}`;
        const color = subjectColorMap.get(subjectName) ?? subjectColors[0];
        return `<td class="filled-cell" style="background:${color.bg};border-left:3px solid ${color.border};">
          <div class="subject-name" style="color:${color.text};">${subjectName}</div>
          <div class="teacher-name">${teacherName}</div>
          ${entry.roomNumber ? `<div class="room-badge">${entry.roomNumber}</div>` : ''}
        </td>`;
      }).join('\n');
      return `<tr><td class="day-cell">${dayLabels[day]}</td>${cells}</tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Timetable — ${classLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #fff;
      color: #1e293b;
      padding: 32px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 3px solid ${sessionColor};
    }

    .header-left h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }

    .header-left .subtitle {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .header-right {
      text-align: right;
    }

    .session-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: ${sessionBgLight};
      color: ${sessionColor};
      border: 1.5px solid ${sessionColor}33;
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .year-badge {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      font-size: 11px;
    }

    thead tr:first-child th {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
      font-weight: 700;
      font-size: 11px;
      padding: 10px 6px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    thead tr:first-child th:first-child {
      background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
      min-width: 90px;
    }

    .period-header {
      border-right: 1px solid #334155;
    }

    .period-name {
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 2px;
    }

    .period-time {
      font-weight: 400;
      font-size: 10px;
      opacity: 0.8;
    }

    .break-header {
      background: linear-gradient(135deg, #451a03 0%, #78350f 100%) !important;
      min-width: 60px;
    }

    tbody tr {
      transition: background 0.15s;
    }

    tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    .day-cell {
      font-weight: 700;
      font-size: 12px;
      color: #0f172a;
      padding: 12px 10px;
      background: #f1f5f9;
      border-right: 1.5px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      text-align: center;
      min-width: 90px;
    }

    .filled-cell {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
      vertical-align: top;
      min-width: 110px;
    }

    .subject-name {
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 2px;
      line-height: 1.3;
    }

    .teacher-name {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
    }

    .room-badge {
      display: inline-block;
      margin-top: 3px;
      background: #e2e8f0;
      color: #475569;
      font-size: 9px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .break-cell {
      background: #fefce8 !important;
      text-align: center;
      vertical-align: middle;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
      min-width: 60px;
    }

    .break-icon {
      font-size: 16px;
    }

    .empty-cell {
      text-align: center;
      color: #cbd5e1;
      font-size: 14px;
      padding: 12px 8px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
    }

    .footer {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .footer-left {
      font-size: 10px;
      color: #94a3b8;
    }

    .footer-right {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: #475569;
      font-weight: 500;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      border: 1px solid;
    }

    @media print {
      body { padding: 16px; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>📋 Weekly Class Timetable</h1>
      <div class="subtitle">${classLabel} &nbsp;•&nbsp; ${semesterLabel}</div>
    </div>
    <div class="header-right">
      <div class="session-badge">${sessionIcon} ${sessionLabel}</div>
      <div class="year-badge">Academic Year: ${yearLabel}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Day</th>
        ${periodHeaders}
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>

  <div class="legend">
    ${subjectNames.map((name) => {
      const c = subjectColorMap.get(name) ?? subjectColors[0];
      return `<span class="legend-item"><span class="legend-dot" style="background:${c.bg};border-color:${c.border};"></span>${name}</span>`;
    }).join('')}
  </div>

  <div class="footer">
    <div class="footer-left">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} • DSSSMS School Management System</div>
    <div class="footer-right">Section ${selectedClassroom.section} • ${yearLabel}</div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await deleteEntry.mutateAsync(pendingDelete.timetableEntryId);
    setPendingDelete(null);
  }

  async function handlePublishDrafts() {
    if (draftEntries.length === 0) return;
    setIsPublishing(true);
    try {
      await Promise.all(draftEntries.map(e => publishEntry.mutateAsync(e.timetableEntryId)));
    } finally {
      setIsPublishing(false);
    }
  }

  function handleFillSlot(day: DayOfWeek, startTime: string, endTime: string, periodNumber: number) {
    setFillSlot({ day, startTime, endTime, period: periodNumber });
    setIsAddOpen(true);
  }

  const byDay = new Map<DayOfWeek, TimetableEntry[]>();
  for (const e of entries ?? []) {
    const list = byDay.get(e.dayOfWeek) ?? [];
    list.push(e);
    byDay.set(e.dayOfWeek, list);
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Class timetable</h1>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Academic year"
            className="min-w-[150px]"
            value={selectedAcademicYear}
            onChange={(e) => {
              setSelectedAcademicYear(e.target.value);
              setClassroomId(undefined);
            }}
          >
            <option value="">All academic years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Semester"
            className="min-w-[170px]"
            value={semester}
            onChange={(e) => setSemester(e.target.value as Semester)}
          >
            <option value="SEMESTER_1">Semester 1 (SEM 1)</option>
            <option value="SEMESTER_2">Semester 2 (SEM 2)</option>
          </SelectField>

          <SelectField
            label="Section"
            className="min-w-[130px]"
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setClassroomId(undefined);
            }}
          >
            <option value="">All sections</option>
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Classroom"
            className="min-w-[220px]"
            value={classroomId ?? ''}
            onChange={(e) => setClassroomId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Select a classroom…</option>
            {filteredClassrooms.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.className} — Sec {c.section} ({c.academicYear}) [{c.session === 'MORNING' ? '☀️ Morning' : '🌤️ Afternoon'}]
              </option>
            ))}
          </SelectField>
        </div>

        {classroomId && (
          <div className="flex items-center gap-3">
            {classroomSession && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  classroomSession === 'MORNING'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-indigo-100 text-indigo-900'
                }`}
              >
                {classroomSession === 'MORNING' ? '☀️' : '🌤️'}
                {classroomSession === 'MORNING' ? 'Morning Session' : 'Afternoon Session'}
              </span>
            )}

            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-ink-900 shadow-xs' : 'text-slate-600 hover:text-ink-900'
                }`}
                onClick={() => setViewMode('grid')}
              >
                Table Grid
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  viewMode === 'cards' ? 'bg-white text-ink-900 shadow-xs' : 'text-slate-600 hover:text-ink-900'
                }`}
                onClick={() => setViewMode('cards')}
              >
                Card List
              </button>
            </div>

            <Button
              variant="ghost"
              onClick={handleDownloadPdf}
              title="Download timetable as PDF"
            >
              ⬇ Download PDF
            </Button>

            <Button
              onClick={() => {
                setFillSlot(null);
                setIsAddOpen(true);
              }}
              disabled={!teachingAssignments || teachingAssignments.items.length === 0}
            >
              Add timetable slot
            </Button>
            {user?.role === 'DIRECTOR' && (
              <Button
                variant="primary"
                disabled={draftEntries.length === 0 || isPublishing}
                onClick={() => void handlePublishDrafts()}
              >
                {isPublishing ? 'Publishing...' : `Publish ${draftEntries.length} Draft(s)`}
              </Button>
            )}
          </div>
        )}
      </div>

      {!classroomId ? (
        <EmptyState title="Select a classroom above" description="Choose a classroom to view or build its weekly timetable." />
      ) : teachingAssignments && teachingAssignments.items.length === 0 ? (
        <EmptyState
          title="No teaching assignments for this classroom"
          description="Assign a teacher to a subject for this classroom first, under Teaching assignments."
        />
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : viewMode === 'grid' ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Click on any empty cell <code className="font-semibold text-emerald-700">+ Fill slot</code> to quickly add a class to that exact time period.
          </p>
          <div id="timetable-print-area">
            <TimetableMatrixTable
              entries={entries ?? []}
              sessionFilter={classroomSession}
              isEditable={true}
              onFillSlot={handleFillSlot}
              onDeleteSlot={(entry) => setPendingDelete(entry)}
            />
          </div>
        </div>
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          title={`No schedule for ${semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2'}`}
          description={`Add the first timetable slot for this classroom for ${semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2'}.`}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {DAYS.filter((d) => (byDay.get(d)?.length ?? 0) > 0).map((day) => (
            <div key={day} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg">{DAY_LABELS[day]}</h2>
              <ul className="flex flex-col gap-2.5">
                {byDay
                  .get(day)!
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((e) => (
                    <li key={e.timetableEntryId} className="rounded-lg border border-paper-100 px-3 py-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-900">
                          {e.startTime} – {e.endTime}
                        </span>
                        {e.roomNumber && <Badge>{e.roomNumber}</Badge>}
                      </div>
                      <p className="mb-1.5 text-[0.8125rem] text-slate-500">
                        {e.teacherSubject.subject.subjectName} · {e.teacherSubject.teacher.firstName}{' '}
                        {e.teacherSubject.teacher.lastName}
                      </p>
                      <Button variant="ghost" onClick={() => setPendingDelete(e)}>
                        Remove
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {classroomId && (
        <AddTimetableEntryModal
          isOpen={isAddOpen}
          onClose={() => {
            setIsAddOpen(false);
            setFillSlot(null);
          }}
          teachingAssignments={teachingAssignments?.items ?? []}
          initialSemester={semester}
          initialDayOfWeek={fillSlot?.day}
          initialStartTime={fillSlot?.startTime}
          initialEndTime={fillSlot?.endTime}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Remove timetable slot"
        message={`Remove this ${pendingDelete ? DAY_LABELS[pendingDelete.dayOfWeek] : ''} slot? This cannot be undone.`}
        confirmLabel="Remove"
        isLoading={deleteEntry.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
