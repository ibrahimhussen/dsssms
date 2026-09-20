/**
 * Phase 4.8 — DisciplineService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { DisciplineService, DisciplineSeverity, DisciplineStatus } from '../discipline.service';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    student:          { findUnique: vi.fn() },
    disciplineRecord: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { prisma } from '../../../database/prisma-client';

const ACTOR = { userId: 1, role: 'DIRECTOR' as const, username: 'dir' };

const STU = {
  studentId: 101, admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'A',
  classroom: { classroomId: 1, className: 'Grade 9', section: 'A' },
};

function mkRecord(id = 1, status: DisciplineStatus = DisciplineStatus.OPEN) {
  return {
    id, studentId: 101, incidentDate: new Date('2026-09-10'), title: 'Misconduct',
    description: 'Details here', severity: DisciplineSeverity.MEDIUM,
    status, actionTaken: null, reportedByUserId: 1, createdAt: new Date(),
    student: STU,
    reportedBy: { username: 'dir' },
  };
}

describe('DisciplineService', () => {
  let svc: DisciplineService;
  beforeEach(() => { svc = new DisciplineService(); vi.clearAllMocks(); });

  // listRecords
  describe('listRecords', () => {
    it('returns all records with no filter', async () => {
      (prisma.disciplineRecord.findMany as Mock).mockResolvedValue([mkRecord()]);
      const r = await svc.listRecords();
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(1);
      expect(r[0].studentName).toBe('Alice A');
      expect(r[0].className).toBe('Grade 9 A');
    });

    it('returns empty when no records', async () => {
      (prisma.disciplineRecord.findMany as Mock).mockResolvedValue([]);
      const r = await svc.listRecords();
      expect(r).toHaveLength(0);
    });

    it('filters by studentId when provided', async () => {
      (prisma.disciplineRecord.findMany as Mock).mockResolvedValue([]);
      await svc.listRecords({ studentId: 101 });
      const where = (prisma.disciplineRecord.findMany as Mock).mock.calls[0][0].where;
      expect(where.studentId).toBe(101);
    });

    it('filters by severity when provided', async () => {
      (prisma.disciplineRecord.findMany as Mock).mockResolvedValue([]);
      await svc.listRecords({ severity: DisciplineSeverity.HIGH });
      const where = (prisma.disciplineRecord.findMany as Mock).mock.calls[0][0].where;
      expect(where.severity).toBe(DisciplineSeverity.HIGH);
    });

    it('filters by status when provided', async () => {
      (prisma.disciplineRecord.findMany as Mock).mockResolvedValue([]);
      await svc.listRecords({ status: DisciplineStatus.RESOLVED });
      const where = (prisma.disciplineRecord.findMany as Mock).mock.calls[0][0].where;
      expect(where.status).toBe(DisciplineStatus.RESOLVED);
    });

    it('applies search filter across title, description, and student name fields', async () => {
      (prisma.disciplineRecord.findMany as Mock).mockResolvedValue([]);
      await svc.listRecords({ search: 'fight' });
      const where = (prisma.disciplineRecord.findMany as Mock).mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });

    it('DTO has all required fields', async () => {
      (prisma.disciplineRecord.findMany as Mock).mockResolvedValue([mkRecord()]);
      const r = await svc.listRecords();
      const rec = r[0];
      expect(rec.id).toBe(1);
      expect(rec.studentId).toBe(101);
      expect(rec.admissionNumber).toBe('DSH-001');
      expect(rec.title).toBe('Misconduct');
      expect(rec.severity).toBe(DisciplineSeverity.MEDIUM);
      expect(rec.status).toBe(DisciplineStatus.OPEN);
      expect(rec.reportedBy).toBe('dir');
      expect(typeof rec.createdAt).toBe('string');
    });
  });

  // createRecord
  describe('createRecord', () => {
    it('creates and returns a record DTO', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.disciplineRecord.create as Mock).mockResolvedValue(mkRecord());
      const r = await svc.createRecord(ACTOR, {
        studentId: 101, title: 'Misconduct', description: 'Details',
        severity: DisciplineSeverity.MEDIUM,
      });
      expect(r.id).toBe(1);
      expect(r.status).toBe(DisciplineStatus.OPEN);
      expect(prisma.disciplineRecord.create).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when student does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.createRecord(ACTOR, {
        studentId: 999, title: 'T', description: 'D', severity: DisciplineSeverity.LOW,
      })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('newly created record always has status OPEN', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.disciplineRecord.create as Mock).mockResolvedValue(mkRecord());
      const r = await svc.createRecord(ACTOR, {
        studentId: 101, title: 'T', description: 'D', severity: DisciplineSeverity.LOW,
      });
      expect(r.status).toBe(DisciplineStatus.OPEN);
      const createData = (prisma.disciplineRecord.create as Mock).mock.calls[0][0].data;
      expect(createData.status).toBe('OPEN');
    });

    it('create NOT called when student not found', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.createRecord(ACTOR, {
        studentId: 999, title: 'T', description: 'D', severity: DisciplineSeverity.LOW,
      })).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.disciplineRecord.create).not.toHaveBeenCalled();
    });
  });

  // updateRecord
  describe('updateRecord', () => {
    it('updates status and returns DTO', async () => {
      (prisma.disciplineRecord.findUnique as Mock).mockResolvedValue(mkRecord());
      (prisma.disciplineRecord.update as Mock).mockResolvedValue(mkRecord(1, DisciplineStatus.RESOLVED));
      const r = await svc.updateRecord(1, { status: DisciplineStatus.RESOLVED });
      expect(r.status).toBe(DisciplineStatus.RESOLVED);
      expect(prisma.disciplineRecord.update).toHaveBeenCalledOnce();
    });

    it('updates actionTaken field', async () => {
      (prisma.disciplineRecord.findUnique as Mock).mockResolvedValue(mkRecord());
      (prisma.disciplineRecord.update as Mock).mockResolvedValue({ ...mkRecord(), actionTaken: 'Warned' });
      const r = await svc.updateRecord(1, { actionTaken: 'Warned' });
      expect(r.actionTaken).toBe('Warned');
    });

    it('throws NotFoundError when record does not exist', async () => {
      (prisma.disciplineRecord.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.updateRecord(999, { status: DisciplineStatus.RESOLVED }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('update NOT called when record not found', async () => {
      (prisma.disciplineRecord.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.updateRecord(999, { status: DisciplineStatus.RESOLVED }))
        .rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.disciplineRecord.update).not.toHaveBeenCalled();
    });
  });
});
