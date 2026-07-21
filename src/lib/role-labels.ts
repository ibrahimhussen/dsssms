import type { RoleName } from '../types/auth';

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: 'Administrator',
  DIRECTOR: 'Director',
  VICE_DIRECTOR: 'Vice Director',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

export function getRoleLabel(role: RoleName): string {
  return ROLE_LABELS[role];
}
