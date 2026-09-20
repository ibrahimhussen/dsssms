import { describe, it, expect } from 'vitest';
import { getRoleLabel, ROLE_LABELS } from '../role-labels';
import type { RoleName } from '../../types/auth';

/**
 * Role label tests.
 *
 * These labels appear in the dashboard header and throughout the UI.
 * Changes here would affect what every user sees as their role name.
 */
describe('getRoleLabel', () => {
  it('returns the correct label for every defined role', () => {
    const cases: Array<[RoleName, string]> = [
      ['ADMIN',         'Administrator'],
      ['DIRECTOR',      'Director'],
      ['VICE_DIRECTOR', 'Vice Director'],
      ['TEACHER',       'Teacher'],
      ['STUDENT',       'Student'],
      ['PARENT',        'Parent'],
    ];

    for (const [role, expectedLabel] of cases) {
      expect(getRoleLabel(role)).toBe(expectedLabel);
    }
  });

  it('covers all RoleName values — no role is missing a label', () => {
    const allRoles: RoleName[] = [
      'ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'TEACHER', 'STUDENT', 'PARENT',
    ];

    for (const role of allRoles) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(typeof ROLE_LABELS[role]).toBe('string');
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });
});
