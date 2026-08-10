import type { RoleName } from '../types/auth';

export interface NavItem {
  label: string;
  path: string;
  allowedRoles?: RoleName[]; // omitted = visible to every authenticated role
}

// School-management oversight roles (Director + Vice Director).
// ADMIN is excluded — system admin handles technical concerns, not school ops.
const SCHOOL_MGMT: RoleName[] = ['DIRECTOR', 'VICE_DIRECTOR'];

export const NAV_ITEMS: NavItem[] = [
  // ── Universal ──────────────────────────────────────────────────────────────
  { label: 'Dashboard', path: '/' },

  // ── System Administrator only ───────────────────────────────────────────────
  { label: 'Staff Accounts',       path: '/users',           allowedRoles: ['ADMIN'] },
  { label: 'System Settings',      path: '/system-settings', allowedRoles: ['ADMIN'] },
  { label: 'Audit Logs',           path: '/audit-logs',      allowedRoles: ['ADMIN'] },
  { label: 'Backup & Restore',     path: '/backups',         allowedRoles: ['ADMIN'] },

  // ── Director + Vice Director (school management) ────────────────────────────
  { label: 'Students',             path: '/students',             allowedRoles: SCHOOL_MGMT },
  { label: 'Teachers',             path: '/teachers',             allowedRoles: SCHOOL_MGMT },
  // Parents: Director only (Vice Director does not manage parent accounts)
  { label: 'Parents',              path: '/parents',              allowedRoles: ['DIRECTOR'] },
  { label: 'Classrooms',           path: '/classrooms',           allowedRoles: SCHOOL_MGMT },
  { label: 'Subjects',             path: '/subjects',             allowedRoles: SCHOOL_MGMT },
  { label: 'Teaching Assignments', path: '/teaching-assignments', allowedRoles: SCHOOL_MGMT },
  { label: 'Class Timetable',      path: '/timetable-admin',      allowedRoles: SCHOOL_MGMT },
  { label: 'Attendance',           path: '/attendance',           allowedRoles: SCHOOL_MGMT },
  { label: 'Attendance Reports',   path: '/attendance-reports',   allowedRoles: SCHOOL_MGMT },
  { label: 'Academic Reports',     path: '/academic-reports',     allowedRoles: SCHOOL_MGMT },
  { label: 'School Performance',   path: '/school-performance',   allowedRoles: SCHOOL_MGMT },
  { label: 'Discipline Records',   path: '/discipline-records',   allowedRoles: [...SCHOOL_MGMT, 'TEACHER'] },
  { label: 'Announcements',        path: '/announcements',        allowedRoles: SCHOOL_MGMT },

  // ── Teacher ─────────────────────────────────────────────────────────────────
  { label: 'My Classes',           path: '/my-classes',    allowedRoles: ['TEACHER'] },
  { label: 'Class Timetable',      path: '/timetable',     allowedRoles: ['TEACHER'] },
  { label: 'Take Attendance',      path: '/attendance',    allowedRoles: ['TEACHER'] },
  { label: 'Enter Grades',         path: '/grades',        allowedRoles: ['TEACHER'] },
  { label: 'Assignments',          path: '/homework',      allowedRoles: ['TEACHER'] },

  // ── Student ──────────────────────────────────────────────────────────────────
  { label: 'My Timetable',         path: '/timetable',     allowedRoles: ['STUDENT'] },
  { label: 'My Attendance',        path: '/my-attendance', allowedRoles: ['STUDENT'] },
  { label: 'My Grades',            path: '/my-grades',     allowedRoles: ['STUDENT'] },
  { label: 'Transcript',           path: '/transcript',    allowedRoles: ['STUDENT'] },
  { label: 'Assignments',          path: '/my-homework',   allowedRoles: ['STUDENT'] },

  // ── Universal bottom items ───────────────────────────────────────────────────
  { label: 'Notifications', path: '/notifications' },
  { label: 'My Profile',    path: '/profile' },
];

export function getVisibleNavItems(role: RoleName): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));
}
