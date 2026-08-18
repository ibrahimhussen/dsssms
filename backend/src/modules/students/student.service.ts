import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/app-error';
import { hashPassword } from '../../core/utils/password.util';
import {
  generateStudentId,
  generateTemporaryPassword,
} from '../../core/utils/code-generator.util';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { parentService } from '../parents/parent.service';
import { LinkParentToStudentInput } from '../parents/validation/parent.validation';
import {
  CreateStudentInput,
  ListStudentsQuery,
  UpdateStudentInput,
  TransferOutInput,
} from './validation/student.validation';
import { CreateStudentResultDto, StudentSummaryDto } from './dto/student.dto';

const STUDENT_INCLUDE = {
  user: true,
  classroom: true,
  parentLinks: { include: { parent: true } },
} satisfies Prisma.StudentInclude;

type StudentWithRelations = Prisma.StudentGetPayload<{ include: typeof STUDENT_INCLUDE }>;

function toStudentSummaryDto(student: StudentWithRelations): StudentSummaryDto {
  return {
    studentId: student.studentId,
    userId: student.userId,
    username: student.user.username,
    admissionNumber: student.admissionNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth,
    address: student.address,
    enrolledAt: student.enrolledAt,
    classroom: {
      classroomId: student.classroom.classroomId,
      className: student.classroom.className,
      section: student.classroom.section,
      academicYear: student.classroom.academicYear,
    },
    parents: student.parentLinks.map((link) => ({
      parentId: link.parent.parentId,
      fullName: link.parent.fullName,
      phoneNumber: link.parent.phoneNumber,
      relationship: link.relationship,
    })),
    admissionType: student.admissionType,
    studentStatus: student.studentStatus,
    previousSchoolName: student.previousSchoolName,
    previousSchoolType: student.previousSchoolType,
    previousSchoolLocation: student.previousSchoolLocation,
    lastGradeCompleted: student.lastGradeCompleted,
    completionYear: student.completionYear,
    previousStudentId: student.previousStudentId,
    transferReason: student.transferReason,
    transferCertificateRef: student.transferCertificateRef,
    previousAcademicSummary: student.previousAcademicSummary,
    transferredOutAt: student.transferredOutAt,
    transferredOutDestination: student.transferredOutDestination,
    transferredOutReason: student.transferredOutReason,
  };
}

const MAX_ADMISSION_NUMBER_ATTEMPTS = 5; // kept to avoid breaking bulkImport error handling

export class StudentService {
  /**
   * Registers a new student. Generates a permanent DSH-YYYY-NNNNN student ID
   * inside the transaction (concurrency-safe via StudentIdCounter table).
   * The student ID is also used as the username — simple, unique, memorable.
   */
  async createStudent(input: CreateStudentInput): Promise<CreateStudentResultDto> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId: input.classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const role = await prisma.role.findUnique({ where: { roleName: RoleName.STUDENT } });
    if (!role) throw new ValidationError('STUDENT role is not configured in the system');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const admissionYear = new Date().getFullYear();

    const guardianCredentials: import('./dto/student.dto').GuardianCredentialsIssuedDto[] = [];

    const student = await prisma.$transaction(async (tx) => {
      // Generate DSH-YYYY-NNNNN inside the transaction — row-lock on StudentIdCounter
      // guarantees no two concurrent registrations get the same number.
      const admissionNumber = await generateStudentId(tx, admissionYear);

      // Student ID = Username for simplicity and consistency.
      const username = admissionNumber;

      const createdUser = await tx.user.create({
        data: { username, passwordHash, roleId: role.roleId },
      });

      const createdStudent = await tx.student.create({
        data: {
          userId:                   createdUser.userId,
          admissionNumber,
          firstName:                input.firstName,
          lastName:                 input.lastName,
          gender:                   input.gender,
          dateOfBirth:              input.dateOfBirth,
          address:                  input.address,
          classroomId:              input.classroomId,
          admissionType:            input.admissionType ?? 'NEW_STUDENT',
          previousSchoolName:       input.previousSchoolName,
          previousSchoolType:       input.previousSchoolType,
          previousSchoolLocation:   input.previousSchoolLocation,
          lastGradeCompleted:       input.lastGradeCompleted,
          completionYear:           input.completionYear,
          previousStudentId:        input.previousStudentId,
          transferReason:           input.transferReason,
          transferCertificateRef:   input.transferCertificateRef,
          previousAcademicSummary:  input.previousAcademicSummary ?? Prisma.JsonNull,
        },
      });

      const studentId = createdStudent.studentId;

      // Initial StudentEnrollment for this admission year
      await tx.studentEnrollment.upsert({
        where:  { studentId_academicYear: { studentId, academicYear: classroom.academicYear } },
        create: { studentId, classroomId: input.classroomId, academicYear: classroom.academicYear, decision: 'ACTIVE' },
        update: {},
      });

      if (input.parents?.length) {
        const newCreds = await this.linkParentsWithinTransaction(tx, studentId, input.parents);
        guardianCredentials.push(...newCreds);
      }

      return tx.student.findUniqueOrThrow({ where: { studentId }, include: STUDENT_INCLUDE });
    });

    return {
      student:              toStudentSummaryDto(student),
      credentials:          { username: student.admissionNumber, temporaryPassword },
      guardianCredentials,
    };
  }

  async bulkImportStudents(studentsInput: CreateStudentInput[]) {
    let successCount = 0;
    const errors: any[] = [];
    
    for (const input of studentsInput) {
      try {
        await this.createStudent(input);
        successCount++;
      } catch (err: any) {
        errors.push({ student: input.firstName + ' ' + input.lastName, error: err.message });
      }
    }
    
    return { successCount, errors };
  }

  async transferOutStudent(studentId: number, input: TransferOutInput) {
    const student = await prisma.student.findUnique({ where: { studentId } });
    if (!student) throw new NotFoundError('Student');

    const updated = await prisma.student.update({
      where: { studentId },
      data: {
        studentStatus: 'TRANSFERRED_OUT',
        transferredOutAt: new Date(),
        transferredOutDestination: input.transferredOutDestination,
        transferredOutReason: input.transferredOutReason,
      },
      include: STUDENT_INCLUDE,
    });
    
    return toStudentSummaryDto(updated);
  }

  async listStudents(
    query: ListStudentsQuery
  ): Promise<{ items: StudentSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.StudentWhereInput = {
      ...(query.classroomId   && { classroomId: query.classroomId }),
      ...(query.admissionType && { admissionType: query.admissionType }),
      ...(query.studentStatus && { studentStatus: query.studentStatus }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search } },
          { lastName:  { contains: query.search } },
          { admissionNumber: { contains: query.search } },
        ],
      }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.student.findMany({ where, include: STUDENT_INCLUDE, skip, take, orderBy: { studentId: 'desc' } }),
      prisma.student.count({ where }),
    ]);

    return {
      items: items.map(toStudentSummaryDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }

  /** Same filters as `listStudents`, but returns every match (capped) for a full export rather than one page. */
  async exportStudents(query: Pick<ListStudentsQuery, 'classroomId' | 'search' | 'admissionType' | 'studentStatus'>): Promise<StudentSummaryDto[]> {
    const where: Prisma.StudentWhereInput = {
      ...(query.classroomId   && { classroomId: query.classroomId }),
      ...(query.admissionType && { admissionType: query.admissionType }),
      ...(query.studentStatus && { studentStatus: query.studentStatus }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search } },
          { lastName:  { contains: query.search } },
          { admissionNumber: { contains: query.search } },
        ],
      }),
    };

    const items = await prisma.student.findMany({
      where,
      include: STUDENT_INCLUDE,
      orderBy: { studentId: 'desc' },
      take: 5000,
    });

    return items.map(toStudentSummaryDto);
  }

  async previewGeneratePasswords(classroomId: number): Promise<{
    total: number;
    eligible: number;
    alreadyPersonal: number;
  }> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const students = await prisma.student.findMany({
      where: { classroomId, studentStatus: 'ACTIVE' },
      include: { user: true },
    });

    const eligible        = students.filter((s) => s.user.isTemporaryPassword).length;
    const alreadyPersonal = students.filter((s) => !s.user.isTemporaryPassword).length;

    return { total: students.length, eligible, alreadyPersonal };
  }

  /**
   * GENERATE (new/temporary only) — only processes students whose
   * isTemporaryPassword is still true (never changed their password).
   * Does NOT touch students who have already set a personal password.
   * Safe to call multiple times — running twice produces 0 new entries
   * for students already processed.
   */
  async bulkGenerateNewPasswords(
    classroomId: number,
    actorUserId: number,
    actorIpAddress?: string
  ): Promise<{
    total:     number;
    generated: number;
    skipped:   number;
    failed:    number;
    results: {
      studentId:         number;
      admissionNumber:   string;
      firstName:         string;
      lastName:          string;
      username:          string;
      temporaryPassword: string;
    }[];
  }> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const students = await prisma.student.findMany({
      where: { classroomId, studentStatus: 'ACTIVE' },
      include: { user: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    let generated = 0;
    let skipped   = 0;
    let failed    = 0;
    const results: {
      studentId: number; admissionNumber: string;
      firstName: string; lastName: string;
      username: string; temporaryPassword: string;
    }[] = [];

    for (const student of students) {
      // Skip students who already changed their password (personal password set)
      if (!student.user.isTemporaryPassword) {
        skipped++;
        continue;
      }

      try {
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await hashPassword(temporaryPassword);

        await prisma.user.update({
          where: { userId: student.userId },
          data: {
            passwordHash,
            isTemporaryPassword: true, // remains temporary until student changes it
            failedLoginAttempts: 0,
            lockedUntil: null,
            status: 'ACTIVE',
          },
        });

        // Revoke active sessions so the student must log in fresh with new credentials
        await prisma.refreshToken.updateMany({
          where: { userId: student.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        results.push({
          studentId:         student.studentId,
          admissionNumber:   student.admissionNumber,
          firstName:         student.firstName,
          lastName:          student.lastName,
          username:          student.user.username,
          temporaryPassword,
        });
        generated++;
      } catch {
        failed++;
      }
    }

    await prisma.auditLog.create({
      data: {
        userId:    actorUserId,
        action:    'STUDENT_BULK_PASSWORD_GENERATION',
        entity:    'Classroom',
        entityId:  String(classroomId),
        ipAddress: actorIpAddress,
        metadata: {
          classroomId,
          className:    classroom.className,
          section:      classroom.section,
          academicYear: classroom.academicYear,
          total:     students.length,
          generated,
          skipped,
          failed,
          // NO passwords in audit log
        },
      },
    });

    return { total: students.length, generated, skipped, failed, results };
  }

  /**
   * BULK RESET — resets ALL active students' passwords regardless of whether
   * they previously changed them. This is the "forgot password, need new temp"
   * operation. Kept separate from bulkGenerateNewPasswords.
   */
  async bulkResetClassroomPasswords(
    classroomId: number,
    actorUserId: number,
    actorIpAddress?: string
  ): Promise<{
    processed:  number;
    results: {
      studentId:         number;
      admissionNumber:   string;
      firstName:         string;
      lastName:          string;
      username:          string;
      temporaryPassword: string;
      isNew:             boolean;
    }[];
  }> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const students = await prisma.student.findMany({
      where: { classroomId, studentStatus: 'ACTIVE' },
      include: { user: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const results = [];

    for (const student of students) {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);

      if (student.user) {
        // Account exists — reset password and revoke all sessions
        await prisma.user.update({
          where: { userId: student.userId },
          data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, status: 'ACTIVE', isTemporaryPassword: true },
        });
        await prisma.refreshToken.updateMany({
          where: { userId: student.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        results.push({
          studentId:         student.studentId,
          admissionNumber:   student.admissionNumber,
          firstName:         student.firstName,
          lastName:          student.lastName,
          username:          student.user.username,
          temporaryPassword,
          isNew:             false,
        });
      } else {
        // Edge case: student record exists but no User account yet — create one
        // (Should not happen in normal flow but handled defensively)
        const role = await prisma.role.findUnique({ where: { roleName: 'STUDENT' } });
        if (!role) continue;
        const newUser = await prisma.user.create({
          data: {
            username: student.admissionNumber,
            passwordHash,
            roleId: role.roleId,
          },
        });
        await prisma.student.update({
          where: { studentId: student.studentId },
          data: { userId: newUser.userId },
        });

        results.push({
          studentId:         student.studentId,
          admissionNumber:   student.admissionNumber,
          firstName:         student.firstName,
          lastName:          student.lastName,
          username:          student.admissionNumber,
          temporaryPassword,
          isNew:             true,
        });
      }
    }

    // Audit — no plaintext passwords in the log
    await prisma.auditLog.create({
      data: {
        userId:   actorUserId,
        action:   'STUDENT_ACCOUNT_BULK_GENERATED',
        entity:   'Classroom',
        entityId: String(classroomId),
        ipAddress: actorIpAddress,
        metadata: {
          classroomId,
          className: classroom.className,
          section:   classroom.section,
          academicYear: classroom.academicYear,
          totalProcessed: results.length,
          newAccounts: results.filter((r) => r.isNew).length,
        },
      },
    });

    return { processed: results.length, results };
  }

  /**
   * Reset password for one student. Returns the new temporary password once.
   * Reuses the same secure generation and revocation logic as bulk reset.
   */
  async resetStudentPassword(
    studentId: number,
    actorUserId: number,
    actorIpAddress?: string
  ): Promise<{ username: string; temporaryPassword: string }> {
    const student = await prisma.student.findUnique({
      where: { studentId },
      include: { user: true },
    });
    if (!student) throw new NotFoundError('Student');
    if (!student.user) throw new NotFoundError('Student account');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { userId: student.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, status: 'ACTIVE', isTemporaryPassword: true },
    });

    await prisma.refreshToken.updateMany({
      where: { userId: student.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId:   actorUserId,
        action:   'STUDENT_PASSWORD_RESET',
        entity:   'Student',
        entityId: String(studentId),
        ipAddress: actorIpAddress,
        metadata: { studentId, username: student.user.username },
      },
    });

    return { username: student.user.username, temporaryPassword };
  }

  async exportClassroomCredentials(classroomId: number): Promise<{ studentId: number; admissionNumber: string; firstName: string; lastName: string; username: string }[]> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const students = await prisma.student.findMany({
      where: { classroomId, studentStatus: 'ACTIVE' },
      include: { user: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return students.map((s) => ({
      studentId:       s.studentId,
      admissionNumber: s.admissionNumber,
      firstName:       s.firstName,
      lastName:        s.lastName,
      // username = admissionNumber (Student ID = Username per system design)
      username:        s.user.username,
    }));
  }

  async getStudentById(studentId: number): Promise<StudentSummaryDto> {
    const student = await prisma.student.findUnique({ where: { studentId }, include: STUDENT_INCLUDE });
    if (!student) throw new NotFoundError('Student');
    return toStudentSummaryDto(student);
  }

  async getEnrollmentHistory(studentId: number) {
    const student = await prisma.student.findUnique({ where: { studentId } });
    if (!student) throw new NotFoundError('Student');

    const enrollments = await prisma.studentEnrollment.findMany({
      where: { studentId },
      include: { classroom: true },
      orderBy: { academicYear: 'asc' },
    });

    return enrollments.map((e) => ({
      id:           e.id,
      academicYear: e.academicYear,
      classroomId:  e.classroomId,
      className:    e.classroom.className,
      section:      e.classroom.section,
      decision:     e.decision,
      batchId:      e.batchId,
      notes:        e.notes,
      createdAt:    e.createdAt.toISOString(),
    }));
  }

  async getStudentByUserId(userId: number): Promise<StudentSummaryDto> {
    const student = await prisma.student.findUnique({ where: { userId }, include: STUDENT_INCLUDE });
    if (!student) throw new NotFoundError('Student');
    return toStudentSummaryDto(student);
  }

  async updateStudent(studentId: number, input: UpdateStudentInput): Promise<StudentSummaryDto> {
    await this.assertExists(studentId);

    const updated = await prisma.student.update({
      where: { studentId },
      data: input,
      include: STUDENT_INCLUDE,
    });

    return toStudentSummaryDto(updated);
  }

  async transferClassroom(studentId: number, classroomId: number): Promise<StudentSummaryDto> {
    await this.assertExists(studentId);

    const classroom = await prisma.classroom.findUnique({ where: { classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const updated = await prisma.student.update({
      where: { studentId },
      data: { classroomId },
      include: STUDENT_INCLUDE,
    });

    return toStudentSummaryDto(updated);
  }

  async addParentLink(studentId: number, input: LinkParentToStudentInput): Promise<{ student: StudentSummaryDto; guardianCredentials: import('./dto/student.dto').GuardianCredentialsIssuedDto[] }> {
    await this.assertExists(studentId);

    const guardianCredentials = await prisma.$transaction(async (tx) => this.linkParentsWithinTransaction(tx, studentId, [input]));

    const student = await this.getStudentById(studentId);
    return { student, guardianCredentials };
  }

  async removeParentLink(studentId: number, parentId: number): Promise<void> {
    const link = await prisma.studentParentLink.findUnique({
      where: { studentId_parentId: { studentId, parentId } },
    });

    if (!link) throw new NotFoundError('Parent link');

    await prisma.studentParentLink.delete({ where: { id: link.id } });
  }

  /**
   * Shared by createStudent and addParentLink — links existing or newly-created
   * parents, returning login credentials for any parent that was newly created
   * (so the caller can hand them to the guardian; nothing is returned for
   * guardians linked via an existing parentId, since no new account was made).
   */
  private async linkParentsWithinTransaction(
    tx: Prisma.TransactionClient,
    studentId: number,
    parentInputs: LinkParentToStudentInput[]
  ): Promise<import('./dto/student.dto').GuardianCredentialsIssuedDto[]> {
    const issuedCredentials: import('./dto/student.dto').GuardianCredentialsIssuedDto[] = [];

    for (const parentInput of parentInputs) {
      let parentId: number;

      if (parentInput.parentId) {
        const existingParent = await tx.parent.findUnique({ where: { parentId: parentInput.parentId } });
        if (!existingParent) throw new NotFoundError('Parent');
        parentId = existingParent.parentId;
      } else if (parentInput.newParent) {
        const created = await parentService.createParent(parentInput.newParent, tx);
        parentId = created.parent.parentId;
        issuedCredentials.push({
          fullName: created.parent.fullName,
          username: created.credentials.username,
          temporaryPassword: created.credentials.temporaryPassword,
        });
      } else {
        throw new ValidationError('Each parent entry must include either parentId or newParent');
      }

      const alreadyLinked = await tx.studentParentLink.findUnique({
        where: { studentId_parentId: { studentId, parentId } },
      });

      if (alreadyLinked) {
        throw new ConflictError('This parent is already linked to this student');
      }

      await tx.studentParentLink.create({
        data: { studentId, parentId, relationship: parentInput.relationship },
      });
    }

    return issuedCredentials;
  }

  private async assertExists(studentId: number) {
    const student = await prisma.student.findUnique({ where: { studentId } });
    if (!student) throw new NotFoundError('Student');
    return student;
  }
}

export const studentService = new StudentService();
