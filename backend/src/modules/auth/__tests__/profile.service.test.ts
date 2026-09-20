/**
 * Phase 4.9 — getFullProfile Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { getFullProfile } from '../profile.service';
import { prisma } from '../../../database/prisma-client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkBase(roleName: string) {
  return {
    userId: 1, username: 'user1', email: null, status: 'ACTIVE',
    profilePicture: null, isTemporaryPassword: true,
    lastLoginAt: null, createdAt: new Date('2026-01-01'),
    role: { roleName },
    administrator: null, director: null, viceDirector: null,
    teacher: null, student: null, parent: null,
  };
}

describe('getFullProfile', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('throws UnauthorizedError (401) when user not found', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(null);
    await expect(getFullProfile(999)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('returns base fields for all roles', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('ADMIN'),
      administrator: { firstName: 'Dave', lastName: 'D' },
    });
    const r = await getFullProfile(1);
    expect(r.userId).toBe(1);
    expect(r.username).toBe('user1');
    expect(r.role).toBe('ADMIN');
    expect(r.isTemporaryPassword).toBe(true);
  });

  it('ADMIN: roleData contains fullName from administrator profile', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('ADMIN'),
      administrator: { firstName: 'Dave', lastName: 'D' },
    });
    const r = await getFullProfile(1);
    expect((r as { roleData: { fullName: string } }).roleData.fullName).toBe('Dave D');
  });

  it('DIRECTOR: roleData contains fullName from director profile', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('DIRECTOR'),
      director: { firstName: 'Dir', lastName: 'X' },
    });
    const r = await getFullProfile(1);
    expect((r as { roleData: { fullName: string } }).roleData.fullName).toBe('Dir X');
  });

  it('VICE_DIRECTOR: roleData contains fullName from viceDirector profile', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('VICE_DIRECTOR'),
      viceDirector: { firstName: 'Vice', lastName: 'V' },
    });
    const r = await getFullProfile(1);
    expect((r as { roleData: { fullName: string } }).roleData.fullName).toBe('Vice V');
  });

  it('TEACHER: roleData contains assignments and homeroomClasses', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('TEACHER'),
      teacher: {
        firstName: 'Tom', lastName: 'T',
        qualification: 'BSc', specialization: 'Maths', phoneNumber: '+251',
        subjectAssignments: [{
          subject: { subjectName: 'Mathematics' },
          classroom: { className: 'Grade 9', section: 'A', academicYear: '2026/27' },
        }],
        classroomsAsHomeroom: [{ className: 'Grade 9', section: 'A', academicYear: '2026/27' }],
      },
    });
    const r = await getFullProfile(1);
    const rd = (r as { roleData: { assignments: unknown[]; homeroomClasses: unknown[] } }).roleData;
    expect(rd.assignments).toHaveLength(1);
    expect(rd.homeroomClasses).toHaveLength(1);
  });

  it('STUDENT: roleData contains classroom and parents', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('STUDENT'),
      student: {
        studentId: 101, admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'A',
        gender: 'F', dateOfBirth: new Date('2010-01-15'), address: null,
        studentStatus: 'ACTIVE', admissionType: 'NEW_STUDENT',
        enrolledAt: new Date('2026-09-01'),
        classroom: { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' },
        parentLinks: [{
          relationship: 'MOTHER',
          parent: { fullName: 'Mama M', phoneNumber: '+251911' },
        }],
      },
    });
    const r = await getFullProfile(1);
    const rd = (r as { roleData: { classroom: { className: string }; parents: unknown[] } }).roleData;
    expect(rd.classroom?.className).toBe('Grade 9');
    expect(rd.parents).toHaveLength(1);
  });

  it('PARENT: roleData contains children with classroom info', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('PARENT'),
      parent: {
        fullName: 'Papa P', phoneNumber: '+251911',
        links: [{
          relationship: 'FATHER',
          student: {
            admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'A',
            classroom: { className: 'Grade 9', section: 'A', academicYear: '2026/27' },
          },
        }],
      },
    });
    const r = await getFullProfile(1);
    const rd = (r as { roleData: { children: { admissionNumber: string }[] } }).roleData;
    expect(rd.children).toHaveLength(1);
    expect(rd.children[0].admissionNumber).toBe('DSH-001');
  });

  it('lastLoginAt is null when user has never logged in', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('ADMIN'),
      administrator: { firstName: 'Dave', lastName: 'D' },
      lastLoginAt: null,
    });
    const r = await getFullProfile(1);
    expect(r.lastLoginAt).toBeNull();
  });

  it('lastLoginAt is ISO string when user has logged in', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      ...mkBase('ADMIN'),
      administrator: { firstName: 'Dave', lastName: 'D' },
      lastLoginAt: new Date('2026-09-10T08:00:00Z'),
    });
    const r = await getFullProfile(1);
    expect(r.lastLoginAt).toBe('2026-09-10T08:00:00.000Z');
  });
});
