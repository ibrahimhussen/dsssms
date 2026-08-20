import type { RoleName } from '../types/auth';
import type { IconType } from 'react-icons';
import {
  MdDashboard, MdPeople, MdSettings, MdHistory,
  MdBackup, MdMeetingRoom, MdMenuBook, MdAssignment,
  MdSchedule, MdFactCheck, MdAssessment, MdDescription,
  MdTrendingUp, MdGavel, MdCampaign, MdNotifications,
  MdAccountCircle, MdLogout, MdUpgrade, MdFolder,
  MdManageAccounts, MdSchool, MdGroups,
} from 'react-icons/md';
import { FaUserGraduate, FaChalkboardTeacher, FaUsers } from 'react-icons/fa';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavItem {
  type:               'item';
  label:              string;
  path:               string;
  allowedRoles?:      RoleName[];
  requiredPermission?: string;
  icon:               IconType;
  isLogout?:          boolean;
}

export interface NavGroup {
  type:          'group';
  label:         string;
  icon:          IconType;
  allowedRoles:  RoleName[];   // group is only rendered when user role is in this list
  children:      NavItem[];
}

export type NavEntry = NavItem | NavGroup;

// ── Shared role sets ──────────────────────────────────────────────────────────
// Note: SCHOOL_MGMT is kept for Director/Vice Director groups below
const SCHOOL_MGMT: RoleName[] = ['DIRECTOR', 'VICE_DIRECTOR'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(
  label: string,
  path: string,
  icon: IconType,
  opts: { allowedRoles?: RoleName[]; requiredPermission?: string; isLogout?: boolean } = {}
): NavItem {
  return { type: 'item', label, path, icon, ...opts };
}

function group(
  label: string,
  icon: IconType,
  allowedRoles: RoleName[],
  children: NavItem[]
): NavGroup {
  return { type: 'group', label, icon, allowedRoles, children };
}

// ── Nav entries ───────────────────────────────────────────────────────────────

export const NAV_ENTRIES: NavEntry[] = [
  // ── Universal ────────────────────────────────────────────────────────────────
  item('Dashboard', '/', MdDashboard),

  // ════════════════ ADMIN GROUPS ════════════════════════════════════════════════

  group('User Management', MdManageAccounts, ['ADMIN'], [
    item('Staff Accounts',    '/users',           MdPeople),
    item('System Settings',   '/system-settings', MdSettings),
  ]),

  group('School Management', MdGroups, ['ADMIN'], [
    item('Students', '/students', FaUserGraduate),
  ]),

  group('Academic Management', MdSchool, ['ADMIN'], [
    item('Grade Subject Config', '/grade-subject-config', MdAssignment),
    item('Academic Register',    '/academic-register',    MdMenuBook),
    item('Results Finalization', '/finalization',         MdFactCheck),
  ]),

  group('System Management', MdFolder, ['ADMIN'], [
    item('Audit Logs',       '/audit-logs', MdHistory),
    item('Backup & Restore', '/backups',    MdBackup),
  ]),

  group('Communication', MdCampaign, ['ADMIN'], [
    item('Notifications', '/notifications', MdNotifications),
  ]),

  // ════════════════ DIRECTOR GROUPS ════════════════════════════════════════════

  group('School Management', MdGroups, ['DIRECTOR'], [
    item('Students',  '/students',  FaUserGraduate, { requiredPermission: 'students:view' }),
    item('Teachers',  '/teachers',  FaChalkboardTeacher),
    item('Parents',   '/parents',   FaUsers),
    item('Classrooms', '/classrooms', MdMeetingRoom),
  ]),

  group('Academic Management', MdSchool, ['DIRECTOR'], [
    item('Subjects',             '/subjects',             MdMenuBook),
    item('Teaching Assignments', '/teaching-assignments', MdAssignment),
    item('Academic Register',    '/academic-register',    MdMenuBook),
    item('Results Finalization', '/finalization',         MdFactCheck),
    item('Academic Reports',     '/academic-reports',     MdDescription),
    item('Grade Subject Config', '/grade-subject-config', MdAssignment),
  ]),

  group('Attendance', MdFactCheck, ['DIRECTOR'], [
    item('Attendance Reports', '/attendance-reports', MdAssessment),
  ]),

  group('Timetable', MdSchedule, ['DIRECTOR'], [
    item('Class Timetable', '/timetable-admin', MdSchedule),
  ]),

  group('School Performance', MdTrendingUp, ['DIRECTOR'], [
    item('School Performance', '/school-performance', MdTrendingUp),
  ]),

  group('Student Promotion', MdUpgrade, ['DIRECTOR'], [
    item('Promotion', '/promotion', MdUpgrade),
  ]),

  group('Communication', MdCampaign, ['DIRECTOR'], [
    item('Announcements',  '/announcements',  MdCampaign),
    item('Notifications',  '/notifications',  MdNotifications),
  ]),

  // ════════════════ VICE DIRECTOR GROUPS ═══════════════════════════════════════

  group('Academic Management', MdSchool, ['VICE_DIRECTOR'], [
    item('Students',             '/students',             FaUserGraduate),
    item('Classrooms',           '/classrooms',           MdMeetingRoom),
    item('Subjects',             '/subjects',             MdMenuBook),
    item('Teaching Assignments', '/teaching-assignments', MdAssignment),
    item('Academic Register',    '/academic-register',    MdMenuBook),
    item('Results Finalization', '/finalization',         MdFactCheck),
    item('Grade Subject Config', '/grade-subject-config', MdAssignment),
    item('Academic Reports',     '/academic-reports',     MdDescription),
  ]),

  group('Attendance', MdFactCheck, ['VICE_DIRECTOR'], [
    item('Attendance',         '/attendance',         MdFactCheck),
    item('Attendance Reports', '/attendance-reports', MdAssessment),
  ]),

  group('Timetable', MdSchedule, ['VICE_DIRECTOR'], [
    item('Class Timetable', '/timetable-admin', MdSchedule),
  ]),

  group('Student Affairs', MdGavel, ['VICE_DIRECTOR'], [
    item('Student Conduct',    '/conduct',            MdGavel),
    item('Discipline Records', '/discipline-records', MdGavel),
    item('Student Promotion',  '/promotion',          MdUpgrade),
  ]),

  group('Communication', MdCampaign, ['VICE_DIRECTOR'], [
    item('Announcements', '/announcements', MdCampaign),
    item('Notifications', '/notifications', MdNotifications),
  ]),

  // ════════════════ TEACHER (flat — no groups) ══════════════════════════════════

  item('My Classes',       '/my-classes',    MdMeetingRoom,  { allowedRoles: ['TEACHER'] }),
  item('Class Timetable',  '/timetable',     MdSchedule,     { allowedRoles: ['TEACHER'] }),
  item('Take Attendance',  '/attendance',    MdFactCheck,    { allowedRoles: ['TEACHER'] }),
  item('Enter Grades',     '/grades',        MdDescription,  { allowedRoles: ['TEACHER'] }),
  item('Assignments',      '/homework',      MdAssignment,   { allowedRoles: ['TEACHER'] }),
  item('Discipline Records', '/discipline-records', MdGavel, { allowedRoles: ['TEACHER'] }),
  item('Results Finalization', '/finalization', MdFactCheck, { allowedRoles: ['TEACHER'] }),

  // ════════════════ STUDENT (flat — no groups) ══════════════════════════════════

  item('My Timetable',  '/timetable',     MdSchedule,    { allowedRoles: ['STUDENT'] }),
  item('My Attendance', '/my-attendance', MdFactCheck,   { allowedRoles: ['STUDENT'] }),
  item('My Grades',     '/my-grades',     MdDescription, { allowedRoles: ['STUDENT'] }),
  item('Transcript',    '/transcript',    MdMenuBook,    { allowedRoles: ['STUDENT'] }),
  item('Assignments',   '/my-homework',   MdAssignment,  { allowedRoles: ['STUDENT'] }),

  // ════════════════ UNIVERSAL BOTTOM ════════════════════════════════════════════

  item('Notifications', '/notifications', MdNotifications),
  item('My Profile',    '/profile',       MdAccountCircle),
  item('Logout',        '#logout',        MdLogout, { isLogout: true }),
];

// ── Filtering — called in AppLayout ──────────────────────────────────────────

/**
 * Returns the nav entries visible to a given role.
 * - Items:  included if allowedRoles is absent OR includes role (or requiredPermission matches)
 * - Groups: included if role is in group.allowedRoles; children are always included as-is
 *           (the group's allowedRoles gate already ensures they're only shown to the right role)
 * - Universal items (no allowedRoles) are only shown to roles that don't use groups,
 *   UNLESS the item is Notifications/Profile/Logout which are truly universal.
 */
export function getNavEntries(role: RoleName, userPermissions: string[] = []): NavEntry[] {
  const GROUPED_ROLES: RoleName[] = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'];
  const useGroups = GROUPED_ROLES.includes(role);

  // Universal bottom items shown to everyone
  const UNIVERSAL_PATHS = new Set(['/notifications', '/profile', '#logout']);

  return NAV_ENTRIES.filter((entry): boolean => {
    // Groups: show if this role is in the group's allowedRoles
    if (entry.type === 'group') {
      return entry.allowedRoles.includes(role);
    }

    // Items
    const navItem = entry as NavItem;

    // Always show universal items (Dashboard, Notifications, Profile, Logout)
    if (!navItem.allowedRoles) {
      // Dashboard (path '/') — show to everyone
      if (navItem.path === '/') return true;
      // Notifications/Profile/Logout — show to everyone
      if (UNIVERSAL_PATHS.has(navItem.path)) {
        // For grouped roles, Notifications is inside a group — don't show as flat item too
        if (useGroups && navItem.path === '/notifications') return false;
        return true;
      }
      return true;
    }

    // Role-specific items: show only for non-grouped roles (Teacher, Student, Parent)
    // For grouped roles, role-specific items appear inside groups only
    if (useGroups) return false;

    if (navItem.allowedRoles.includes(role)) return true;
    if (navItem.requiredPermission && userPermissions.includes(navItem.requiredPermission)) return true;
    return false;
  });
}

// ── Legacy flat items getter — kept for any code that still imports it ────────
/** @deprecated Use getNavEntries instead */
export function getVisibleNavItems(role: RoleName, userPermissions: string[] = []) {
  return getNavEntries(role, userPermissions)
    .filter((e): e is NavItem => e.type === 'item');
}
