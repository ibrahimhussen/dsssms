import type { RoleName } from '../types/auth';

export interface NavItem {
  label: string;
  path: string;
  allowedRoles?: RoleName[]; // omitted = visible to every authenticated role
}

const OVERSIGHT_ROLES: RoleName[] = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'];

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Staff accounts', path: '/users', allowedRoles: ['ADMIN'] },
  { label: 'Students', path: '/students', allowedRoles: OVERSIGHT_ROLES },
  { label: 'Parents', path: '/parents', allowedRoles: OVERSIGHT_ROLES },
  { label: 'Classrooms', path: '/classrooms', allowedRoles: OVERSIGHT_ROLES },
  { label: 'Subjects', path: '/subjects', allowedRoles: OVERSIGHT_ROLES },
  { label: 'Teaching assignments', path: '/teaching-assignments', allowedRoles: OVERSIGHT_ROLES },
  { label: 'Class timetable', path: '/timetable-admin', allowedRoles: OVERSIGHT_ROLES },
  { label: 'My classes', path: '/my-classes', allowedRoles: ['TEACHER'] },
  { label: 'Class timetable', path: '/timetable', allowedRoles: ['TEACHER'] },
  { label: 'Take attendance', path: '/attendance', allowedRoles: ['TEACHER'] },
  { label: 'Enter grades', path: '/grades', allowedRoles: ['TEACHER'] },
  { label: 'Assignments', path: '/homework', allowedRoles: ['TEACHER'] },
  { label: 'My timetable', path: '/timetable', allowedRoles: ['STUDENT'] },
  { label: 'My attendance', path: '/my-attendance', allowedRoles: ['STUDENT'] },
  { label: 'My grades', path: '/my-grades', allowedRoles: ['STUDENT'] },
  { label: 'Transcript', path: '/transcript', allowedRoles: ['STUDENT'] },
  { label: 'Assignments', path: '/my-homework', allowedRoles: ['STUDENT'] },
  { label: 'Academic reports', path: '/academic-reports', allowedRoles: OVERSIGHT_ROLES },
  { label: 'Audit logs', path: '/audit-logs', allowedRoles: ['ADMIN'] },
  { label: 'System settings', path: '/system-settings', allowedRoles: ['ADMIN'] },
  { label: 'Backup & restore', path: '/backups', allowedRoles: ['ADMIN'] },
  { label: 'Notifications', path: '/notifications' },
];

export function getVisibleNavItems(role: RoleName): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));
}
