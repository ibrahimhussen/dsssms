import { prisma } from '../../database/prisma-client';
import { NotFoundError } from '../../core/errors/app-error';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CreateDisciplineRecordInput,
  DisciplineRecordDto,
  DisciplineSeverity,
  DisciplineStatus,
  UpdateDisciplineRecordInput,
} from './discipline.dto';

// In-memory persistent store for discipline records (complements DB schema)
let memoryRecords: DisciplineRecordDto[] = [
  {
    id: 1,
    studentId: 1,
    studentName: 'Abebe Bikila',
    admissionNumber: 'ADM-2025-001',
    className: 'Grade 9 A',
    incidentDate: new Date().toISOString().slice(0, 10),
    title: 'Unexcused Absence / Tardiness',
    description: 'Repeatedly late for morning assembly and first period classes.',
    severity: 'MEDIUM',
    status: 'UNDER_REVIEW',
    reportedBy: 'Homeroom Teacher',
    actionTaken: 'Parent notified via phone call; counseling scheduled.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    studentId: 2,
    studentName: 'Tigist Assefa',
    admissionNumber: 'ADM-2025-002',
    className: 'Grade 10 B',
    incidentDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    title: 'Disruptive Classroom Behavior',
    description: 'Interrupted chemistry laboratory experiment by refusing to follow safety instructions.',
    severity: 'HIGH',
    status: 'OPEN',
    reportedBy: 'Science Teacher',
    actionTaken: 'Temporary laboratory suspension for 3 days.',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

let nextId = 3;

export class DisciplineService {
  async listRecords(filters?: {
    studentId?: number;
    severity?: DisciplineSeverity;
    status?: DisciplineStatus;
    search?: string;
  }): Promise<DisciplineRecordDto[]> {
    let list = [...memoryRecords];

    if (filters?.studentId) {
      list = list.filter((r) => r.studentId === filters.studentId);
    }
    if (filters?.severity) {
      list = list.filter((r) => r.severity === filters.severity);
    }
    if (filters?.status) {
      list = list.filter((r) => r.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.admissionNumber.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.className.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createRecord(actor: AuthenticatedUser, input: CreateDisciplineRecordInput): Promise<DisciplineRecordDto> {
    const student = await prisma.student.findUnique({
      where: { studentId: input.studentId },
      include: { classroom: true },
    });

    if (!student) {
      throw new NotFoundError('Student');
    }

    const record: DisciplineRecordDto = {
      id: nextId++,
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      className: `${student.classroom.className} ${student.classroom.section}`,
      incidentDate: input.incidentDate || new Date().toISOString().slice(0, 10),
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: 'OPEN',
      reportedBy: actor.username,
      actionTaken: input.actionTaken || '',
      createdAt: new Date().toISOString(),
    };

    memoryRecords.push(record);
    return record;
  }

  async updateRecord(id: number, input: UpdateDisciplineRecordInput): Promise<DisciplineRecordDto> {
    const index = memoryRecords.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new NotFoundError('Discipline record');
    }

    const existing = memoryRecords[index];
    const updated: DisciplineRecordDto = {
      ...existing,
      status: input.status ?? existing.status,
      actionTaken: input.actionTaken ?? existing.actionTaken,
      description: input.description ?? existing.description,
      severity: input.severity ?? existing.severity,
    };

    memoryRecords[index] = updated;
    return updated;
  }
}

export const disciplineService = new DisciplineService();
