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
  // Stage 9 will add: Parents, Classrooms, Subjects, Teaching Assignments,
  // Attendance, Grades, Academic Reports, Notifications — each scoped to
  // the roles permitted by the backend RBAC rules.
];

export function getVisibleNavItems(role: RoleName): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));
}
