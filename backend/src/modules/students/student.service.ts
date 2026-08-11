import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/app-error';
import { hashPassword } from '../../core/utils/password.util';
import {
  buildBaseUsername,
  ensureUniqueUsername,
  generateAdmissionNumber,
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

const MAX_ADMISSION_NUMBER_ATTEMPTS = 5;

export class StudentService {
  /**
   * Registers a new student, optionally linking one or more guardians in
   * the same atomic transaction (each guardian is either an existing
   * parentId or brand-new parent details — see LinkParentToStudentInput).
   * Implements the proposal's "Register Student" use case (4.4).
   */
  async createStudent(input: CreateStudentInput): Promise<CreateStudentResultDto> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId: input.classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');

    const role = await prisma.role.findUnique({ where: { roleName: RoleName.STUDENT } });
    if (!role) throw new ValidationError('STUDENT role is not configured in the system');

    const baseUsername = buildBaseUsername(input.firstName, input.lastName);
    const username = await ensureUniqueUsername(
      baseUsername,
      async (candidate) => (await prisma.user.findUnique({ where: { username: candidate } })) !== null
    );

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    let attempt = 0;
    let lastError: unknown;

    while (attempt < MAX_ADMISSION_NUMBER_ATTEMPTS) {
      attempt += 1;
      const admissionNumber = generateAdmissionNumber();

      try {
        const guardianCredentials: import('./dto/student.dto').GuardianCredentialsIssuedDto[] = [];

        const student = await prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              username,
              passwordHash,
              roleId: role.roleId,
            },
          });

          const createdStudent = await tx.student.create({
            data: {
              userId: createdUser.userId,
              admissionNumber,
              firstName: input.firstName,
              lastName: input.lastName,
              gender: input.gender,
              dateOfBirth: input.dateOfBirth,
              address: input.address,
              classroomId: input.classroomId,
              
              // NEW FIELDS:
              admissionType: input.admissionType ?? 'NEW_STUDENT',
              previousSchoolName: input.previousSchoolName,
              previousSchoolType: input.previousSchoolType,
              previousSchoolLocation: input.previousSchoolLocation,
              lastGradeCompleted: input.lastGradeCompleted,
              completionYear: input.completionYear,
              previousStudentId: input.previousStudentId,
              transferReason: input.transferReason,
              transferCertificateRef: input.transferCertificateRef,
              previousAcademicSummary: input.previousAcademicSummary ?? Prisma.JsonNull,
            },
          });

          const studentId = createdStudent.studentId;

          if (input.parents?.length) {
            const newlyCreated = await this.linkParentsWithinTransaction(tx, studentId, input.parents);
            guardianCredentials.push(...newlyCreated);
          }

          const full = await tx.student.findUniqueOrThrow({
            where: { studentId },
            include: STUDENT_INCLUDE,
          });

          return full;
        });

        return {
          student: toStudentSummaryDto(student),
          credentials: { username, temporaryPassword },
          guardianCredentials,
        };
      } catch (err) {
        lastError = err;
        const isAdmissionCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          (err.meta?.target as string[] | undefined)?.includes('admissionNumber');

        if (!isAdmissionCollision) {
          throw err;
        }
        // else: loop and try a freshly generated admission number
      }
    }

    throw lastError instanceof Error ? lastError : new ValidationError('Failed to generate a unique admission number');
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
      ...(query.classroomId && { classroomId: query.classroomId }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search } },
          { lastName: { contains: query.search } },
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
  async exportStudents(query: Pick<ListStudentsQuery, 'classroomId' | 'search'>): Promise<StudentSummaryDto[]> {
    const where: Prisma.StudentWhereInput = {
      ...(query.classroomId && { classroomId: query.classroomId }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search } },
          { lastName: { contains: query.search } },
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

  async getStudentById(studentId: number): Promise<StudentSummaryDto> {
    const student = await prisma.student.findUnique({ where: { studentId }, include: STUDENT_INCLUDE });
    if (!student) throw new NotFoundError('Student');
    return toStudentSummaryDto(student);
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
