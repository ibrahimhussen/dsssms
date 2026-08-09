import {
  PrismaClient,
  RoleName,
  Gender,
  ParentRelationship,
  AttendanceStatus,
  Semester,
} from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  user: 'dsssms_user',
  password: 'mudasir',
  database: 'dsssms_db',
  connectionLimit: 5,
});

const prisma = new PrismaClient({
  adapter,
});

const DEFAULT_PASSWORD = 'Demo@12345'; // Meets the password policy; CHANGE on first login in any real deployment.
const CURRENT_ACADEMIC_YEAR = '2026/27';

// Dev convenience only: reseeding resets every demo account's password back to
// DEFAULT_PASSWORD, even if it already existed. Never do this in a production seed.
const RESET_PASSWORDS_ON_RESEED = true;

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Generates a unique username, appending a numeric suffix on collision. */
async function uniqueUsername(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

/** Resets an existing user's password to DEFAULT_PASSWORD, if enabled. */
async function resetPasswordIfEnabled(username: string, label: string): Promise<void> {
  if (!RESET_PASSWORDS_ON_RESEED) {
    console.log(`  ${label} already exists, skipping.`);
    return;
  }
  await prisma.user.update({
    where: { username },
    data: { passwordHash: await hash(DEFAULT_PASSWORD) },
  });
  console.log(`  ${label} already exists — password reset to: ${DEFAULT_PASSWORD}`);
}

async function main(): Promise<void> {
  console.log('Seeding roles...');
  for (const roleName of Object.values(RoleName)) {
    await prisma.role.upsert({ where: { roleName }, update: {}, create: { roleName } });
  }
  const roles = Object.fromEntries(
    (await prisma.role.findMany()).map((r) => [r.roleName, r.roleId])
  ) as Record<RoleName, number>;

  // --- Admin ---------------------------------------------------------------
  console.log('Seeding default administrator...');
  const adminUsername = 'admin';
  const adminUser = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!adminUser) {
    await prisma.user.create({
      data: {
        username: adminUsername,
        email: 'admin@dinsho-secondary.edu.et',
        passwordHash: await hash(DEFAULT_PASSWORD),
        roleId: roles.ADMIN,
        administrator: { create: { firstName: 'System', lastName: 'Administrator' } },
      },
    });
    console.log(`  Created admin — username: ${adminUsername} / password: ${DEFAULT_PASSWORD}`);
  } else {
    await resetPasswordIfEnabled(adminUsername, 'Admin');
  }

  // --- Subjects --------------------------------------------------------------
  console.log('Seeding subjects...');
  const subjectSeed = [
    { subjectCode: 'MATH9', subjectName: 'Mathematics' },
    { subjectCode: 'ENG9', subjectName: 'English' },
    { subjectCode: 'BIO9', subjectName: 'Biology' },
    { subjectCode: 'PHY9', subjectName: 'Physics' },
  ];
  const subjects = [];
  for (const s of subjectSeed) {
    const subject = await prisma.subject.upsert({ where: { subjectCode: s.subjectCode }, update: {}, create: s });
    subjects.push(subject);
  }

  // --- Teacher ----------------------------------------------------------------
  console.log('Seeding a demo teacher...');
  const teacherUsername = 'abebe.kebede';
  let teacherUser = await prisma.user.findUnique({ where: { username: teacherUsername }, include: { teacher: true } });
  if (!teacherUser?.teacher) {
    teacherUser = await prisma.user.create({
      data: {
        username: teacherUsername,
        passwordHash: await hash(DEFAULT_PASSWORD),
        roleId: roles.TEACHER,
        teacher: {
          create: {
            firstName: 'Abebe',
            lastName: 'Kebede',
            qualification: 'BSc Mathematics',
            specialization: 'Mathematics & Physics',
          },
        },
      },
      include: { teacher: true },
    });
    console.log(`  Created teacher — username: ${teacherUsername} / password: ${DEFAULT_PASSWORD}`);
  } else {
    await resetPasswordIfEnabled(teacherUsername, 'Teacher');
  }
  const teacher = teacherUser.teacher!;

  // --- Classroom ----------------------------------------------------------------
  console.log('Seeding a demo classroom...');
  const classroom = await prisma.classroom.upsert({
    where: {
      className_section_academicYear: { className: 'Grade 9', section: 'A', academicYear: CURRENT_ACADEMIC_YEAR },
    },
    update: {},
    create: {
      className: 'Grade 9',
      section: 'A',
      academicYear: CURRENT_ACADEMIC_YEAR,
      homeroomTeacherId: teacher.teacherId,
    },
  });

  // --- Teaching assignments ------------------------------------------------------
  console.log('Seeding teaching assignments...');
  const teacherSubjectAssignments = [];
  for (const subject of subjects.slice(0, 2)) {
    // Teacher teaches Math and English to this demo classroom.
    const assignment = await prisma.teacherSubject.upsert({
      where: {
        teacherId_subjectId_classroomId: {
          teacherId: teacher.teacherId,
          subjectId: subject.subjectId,
          classroomId: classroom.classroomId,
        },
      },
      update: {},
      create: { teacherId: teacher.teacherId, subjectId: subject.subjectId, classroomId: classroom.classroomId },
    });
    teacherSubjectAssignments.push(assignment);
  }

  // --- Timetable ------------------------------------------------------------------
  console.log('Seeding a sample weekly timetable...');
  const timetableSeed = [
    { teacherSubject: teacherSubjectAssignments[0], semester: Semester.SEMESTER_1, dayOfWeek: 'MONDAY' as const, startTime: '08:00', endTime: '08:45', roomNumber: 'Room 12' },
    { teacherSubject: teacherSubjectAssignments[1], semester: Semester.SEMESTER_1, dayOfWeek: 'MONDAY' as const, startTime: '08:45', endTime: '09:30', roomNumber: 'Room 12' },
    { teacherSubject: teacherSubjectAssignments[0], semester: Semester.SEMESTER_1, dayOfWeek: 'WEDNESDAY' as const, startTime: '09:30', endTime: '10:15', roomNumber: 'Room 12' },
    { teacherSubject: teacherSubjectAssignments[1], semester: Semester.SEMESTER_1, dayOfWeek: 'FRIDAY' as const, startTime: '08:00', endTime: '08:45', roomNumber: 'Room 12' },
  ];
  for (const slot of timetableSeed) {
    await prisma.timetableEntry.upsert({
      where: {
        teacherSubjectId_semester_dayOfWeek_startTime: {
          teacherSubjectId: slot.teacherSubject.id,
          semester: slot.semester,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
        },
      },
      update: {},
      create: {
        teacherSubjectId: slot.teacherSubject.id,
        semester: slot.semester,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
      },
    });
  }

  // --- Students + Parents ------------------------------------------------------
  console.log('Seeding demo students and parents...');
  const studentSeed = [
    { firstName: 'husen', lastName: 'Ahmed', gender: Gender.F, dob: '2010-03-14', guardianName: 'Tesfaye Alemu' },
    { firstName: 'chaltu', lastName: 'sani', gender: Gender.M, dob: '2010-07-02', guardianName: 'Getachew Worku' },
    { firstName: 'Selam', lastName: 'Mulugeta', gender: Gender.F, dob: '2010-01-22', guardianName: 'Mulugeta Bekele' },
  ];

  const students = [];

  for (const s of studentSeed) {
    const admissionNumber = `ADM-2025-${1000 + studentSeed.indexOf(s)}`;
    const existingStudent = await prisma.student.findUnique({ where: { admissionNumber }, include: { user: true } });
    if (existingStudent) {
      students.push(existingStudent);
      if (existingStudent.user) {
        await resetPasswordIfEnabled(existingStudent.user.username, `Student ${existingStudent.user.username}`);
      }
      continue;
    }

    const studentUsername = await uniqueUsername(`${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}`);
    const studentUserRecord = await prisma.user.create({
      data: {
        username: studentUsername,
        passwordHash: await hash(DEFAULT_PASSWORD),
        roleId: roles.STUDENT,
        student: {
          create: {
            admissionNumber,
            firstName: s.firstName,
            lastName: s.lastName,
            gender: s.gender,
            dateOfBirth: new Date(s.dob),
            classroomId: classroom.classroomId,
          },
        },
      },
      include: { student: true },
    });
    const student = studentUserRecord.student!;
    students.push(student);

    const parentUsername = await uniqueUsername(
      `${s.guardianName.split(' ')[0].toLowerCase()}.${s.guardianName.split(' ')[1].toLowerCase()}`
    );
    const parentUserRecord = await prisma.user.create({
      data: {
        username: parentUsername,
        passwordHash: await hash(DEFAULT_PASSWORD),
        roleId: roles.PARENT,
        parent: { create: { fullName: s.guardianName } },
      },
      include: { parent: true },
    });

    await prisma.studentParentLink.create({
      data: {
        studentId: student.studentId,
        parentId: parentUserRecord.parent!.parentId,
        relationship: ParentRelationship.GUARDIAN,
      },
    });

    console.log(`  Created student — username: ${studentUsername} / password: ${DEFAULT_PASSWORD}`);
    console.log(`  Created guardian — username: ${parentUsername} / password: ${DEFAULT_PASSWORD}`);
  }

  // --- Sample attendance (today) ------------------------------------------------
  console.log('Seeding sample attendance for today...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const student of students) {
    await prisma.attendance.upsert({
      where: { studentId_attendanceDate: { studentId: student.studentId, attendanceDate: today } },
      update: {},
      create: {
        studentId: student.studentId,
        teacherId: teacher.teacherId,
        classroomId: classroom.classroomId,
        attendanceDate: today,
        status: AttendanceStatus.PRESENT,
      },
    });
  }

  // --- Sample grades (Semester 1) ------------------------------------------------
  console.log('Seeding a sample grading scheme and scores for Semester 1...');
  const gradeComponentSeed = [
    { category: 'QUIZ' as const, name: 'Quiz 1', maxMarks: 10 },
    { category: 'ASSIGNMENT' as const, name: 'Assignment 1', maxMarks: 10 },
    { category: 'MID_EXAM' as const, name: 'Mid Exam', maxMarks: 30 },
    { category: 'FINAL_EXAM' as const, name: 'Final Exam', maxMarks: 50 },
  ];

  for (const teacherSubject of teacherSubjectAssignments) {
    const components = [];
    for (const c of gradeComponentSeed) {
      const component = await prisma.gradeComponent.upsert({
        where: {
          teacherSubjectId_semester_academicYear_name: {
            teacherSubjectId: teacherSubject.id,
            semester: Semester.SEMESTER_1,
            academicYear: CURRENT_ACADEMIC_YEAR,
            name: c.name,
          },
        },
        update: {},
        create: {
          teacherSubjectId: teacherSubject.id,
          semester: Semester.SEMESTER_1,
          academicYear: CURRENT_ACADEMIC_YEAR,
          category: c.category,
          name: c.name,
          maxMarks: c.maxMarks,
        },
      });
      components.push(component);
    }

    for (const [studentIndex, student] of students.entries()) {
      for (const component of components) {
        // A simple deterministic spread so demo scores aren't all identical.
        const ratio = 0.65 + (0.3 * ((studentIndex + component.gradeComponentId) % 4)) / 3;
        const score = Math.round(Number(component.maxMarks) * ratio * 100) / 100;
        await prisma.gradeEntry.upsert({
          where: { gradeComponentId_studentId: { gradeComponentId: component.gradeComponentId, studentId: student.studentId } },
          update: {},
          create: { gradeComponentId: component.gradeComponentId, studentId: student.studentId, score },
        });
      }
    }
  }

  // --- Sample assignment ------------------------------------------------------
  console.log('Seeding a sample assignment...');
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const existingAssignment = await prisma.assignment.findFirst({
    where: { teacherSubjectId: teacherSubjectAssignments[0].id, title: 'Algebra worksheet — Chapter 3' },
  });
  if (!existingAssignment) {
    const assignment = await prisma.assignment.create({
      data: {
        teacherSubjectId: teacherSubjectAssignments[0].id,
        title: 'Algebra worksheet — Chapter 3',
        description: 'Complete odd-numbered questions 1–25 and show your working.',
        dueDate,
      },
    });
    await prisma.assignmentSubmission.createMany({
      data: students.map((s) => ({ assignmentId: assignment.assignmentId, studentId: s.studentId })),
    });
  }

  console.log('\nSeeding complete. All demo accounts use the password: ' + DEFAULT_PASSWORD);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });