/**
 * AUTHORITATIVE TIMETABLE PERIOD CONFIGURATION
 *
 * Single source of truth for all timetable period definitions.
 * Used by TimetableMatrixTable, AddTimetableEntryModal, and backend validation.
 *
 * School times are Ethiopian traditional clock (ETC):
 *   ETC = standard 24h − 6 hours
 *   e.g. standard 08:00 → ETC 02:00
 *
 * Storage times (startTime / endTime) are stored in standard 24h format.
 * Display times (localTime) are Ethiopian traditional clock format.
 *
 * Each teaching period = 40 minutes exactly.
 * Break = 15 minutes. Breaks CANNOT receive timetable entries.
 */

export type PeriodSession = 'Morning' | 'Afternoon' | 'Break';

export interface TimetablePeriod {
  /** Unique identifier */
  id: string;
  /** Display name: "Period 1", "☕ Break", etc. */
  name: string;
  /** Ethiopian traditional clock display: "02:00 – 02:40" */
  localTime: string;
  /** Session classification */
  session: PeriodSession;
  /** Period number (1–6 within session, undefined for breaks) */
  periodNumber?: number;
  /** Storage time start — standard 24h, e.g. "08:00" */
  startTime: string;
  /** Storage time end — standard 24h, e.g. "08:40" */
  endTime: string;
  /** True if this slot is a break — cannot be assigned a lesson */
  isBreak: boolean;
}

// ── Morning Session ───────────────────────────────────────────────────────────
// School time 02:00–06:15 (standard 08:00–12:15)
// Break: 04:00–04:15 (standard 10:00–10:15)

export const MORNING_PERIODS: TimetablePeriod[] = [
  { id: 'm-p1', name: 'Period 1', localTime: '02:00 – 02:40', session: 'Morning',  periodNumber: 1, startTime: '08:00', endTime: '08:40', isBreak: false },
  { id: 'm-p2', name: 'Period 2', localTime: '02:40 – 03:20', session: 'Morning',  periodNumber: 2, startTime: '08:40', endTime: '09:20', isBreak: false },
  { id: 'm-p3', name: 'Period 3', localTime: '03:20 – 04:00', session: 'Morning',  periodNumber: 3, startTime: '09:20', endTime: '10:00', isBreak: false },
  { id: 'm-br', name: '☕ Break', localTime: '04:00 – 04:15', session: 'Break',                     startTime: '10:00', endTime: '10:15', isBreak: true  },
  { id: 'm-p4', name: 'Period 4', localTime: '04:15 – 04:55', session: 'Morning',  periodNumber: 4, startTime: '10:15', endTime: '10:55', isBreak: false },
  { id: 'm-p5', name: 'Period 5', localTime: '04:55 – 05:35', session: 'Morning',  periodNumber: 5, startTime: '10:55', endTime: '11:35', isBreak: false },
  { id: 'm-p6', name: 'Period 6', localTime: '05:35 – 06:15', session: 'Morning',  periodNumber: 6, startTime: '11:35', endTime: '12:15', isBreak: false },
];

// ── Afternoon Session ─────────────────────────────────────────────────────────
// School time 06:30–10:45 (standard 12:30–16:45)
// Break: 08:30–08:45 (standard 14:30–14:45)

export const AFTERNOON_PERIODS: TimetablePeriod[] = [
  { id: 'a-p1', name: 'Period 1', localTime: '06:30 – 07:10', session: 'Afternoon', periodNumber: 1, startTime: '12:30', endTime: '13:10', isBreak: false },
  { id: 'a-p2', name: 'Period 2', localTime: '07:10 – 07:50', session: 'Afternoon', periodNumber: 2, startTime: '13:10', endTime: '13:50', isBreak: false },
  { id: 'a-p3', name: 'Period 3', localTime: '07:50 – 08:30', session: 'Afternoon', periodNumber: 3, startTime: '13:50', endTime: '14:30', isBreak: false },
  { id: 'a-br', name: '☕ Break', localTime: '08:30 – 08:45', session: 'Break',                      startTime: '14:30', endTime: '14:45', isBreak: true  },
  { id: 'a-p4', name: 'Period 4', localTime: '08:45 – 09:25', session: 'Afternoon', periodNumber: 4, startTime: '14:45', endTime: '15:25', isBreak: false },
  { id: 'a-p5', name: 'Period 5', localTime: '09:25 – 10:05', session: 'Afternoon', periodNumber: 5, startTime: '15:25', endTime: '16:05', isBreak: false },
  { id: 'a-p6', name: 'Period 6', localTime: '10:05 – 10:45', session: 'Afternoon', periodNumber: 6, startTime: '16:05', endTime: '16:45', isBreak: false },
];

export const ALL_PERIODS: TimetablePeriod[] = [...MORNING_PERIODS, ...AFTERNOON_PERIODS];

/** Break time ranges — used for backend validation */
export const BREAK_RANGES = [
  { startTime: '10:00', endTime: '10:15', session: 'Morning' as const },
  { startTime: '14:30', endTime: '14:45', session: 'Afternoon' as const },
];

/** Returns the teaching periods (no breaks) for a session */
export function getTeachingPeriods(session: 'Morning' | 'Afternoon'): TimetablePeriod[] {
  const source = session === 'Morning' ? MORNING_PERIODS : AFTERNOON_PERIODS;
  return source.filter((p) => !p.isBreak);
}

/** Detects whether a given start/end falls on a break slot */
export function isBreakSlot(startTime: string, endTime: string): boolean {
  return BREAK_RANGES.some((b) => b.startTime === startTime && b.endTime === endTime);
}

/** Returns the period definition for a given storage startTime/endTime, or undefined */
export function findPeriodByTime(startTime: string, endTime: string): TimetablePeriod | undefined {
  return ALL_PERIODS.find((p) => p.startTime === startTime && p.endTime === endTime);
}
