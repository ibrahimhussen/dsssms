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
  console.log('Seeding system settings...');
  await seedSystemSettings();
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
  console.log('Seeding demo classrooms (4 grades × 3 sections = 12 classrooms)...');

  const classroomDefs = [
    { className: 'Grade 9',  section: 'A' },
    { className: 'Grade 9',  section: 'B' },
    { className: 'Grade 9',  section: 'C' },
    { className: 'Grade 10', section: 'A' },
    { className: 'Grade 10', section: 'B' },
    { className: 'Grade 10', section: 'C' },
    { className: 'Grade 11', section: 'A' },
    { className: 'Grade 11', section: 'B' },
    { className: 'Grade 11', section: 'C' },
    { className: 'Grade 12', section: 'A' },
    { className: 'Grade 12', section: 'B' },
    { className: 'Grade 12', section: 'C' },
  ];

  const classrooms: Record<string, Awaited<ReturnType<typeof prisma.classroom.upsert>>> = {};

  for (const def of classroomDefs) {
    const key = `${def.className}-${def.section}`;
    classrooms[key] = await prisma.classroom.upsert({
      where: {
        className_section_academicYear: {
          className: def.className,
          section: def.section,
          academicYear: CURRENT_ACADEMIC_YEAR,
        },
      },
      update: {},
      create: {
        className: def.className,
        section: def.section,
        academicYear: CURRENT_ACADEMIC_YEAR,
        // Assign the demo teacher as homeroom for Grade 9 A only
        homeroomTeacherId: def.className === 'Grade 9' && def.section === 'A' ? teacher.teacherId : undefined,
      },
    });
    console.log(`  Classroom: ${def.className} ${def.section} (${CURRENT_ACADEMIC_YEAR})`);
  }

  // Convenience reference — Grade 9 A is the primary demo classroom
  const classroom = classrooms['Grade 9-A'];

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
  // 40-minute morning periods stored in standard 24h time.
  // Ethiopian display: 08:00 std → 02:00 local, 08:40 std → 02:40 local, etc.
  const timetableSeed = [
    { teacherSubject: teacherSubjectAssignments[0], semester: Semester.SEMESTER_1, dayOfWeek: 'MONDAY' as const,    period: 1, startTime: '08:00', endTime: '08:40', roomNumber: 'Room 12' },
    { teacherSubject: teacherSubjectAssignments[1], semester: Semester.SEMESTER_1, dayOfWeek: 'MONDAY' as const,    period: 2, startTime: '08:40', endTime: '09:20', roomNumber: 'Room 12' },
    { teacherSubject: teacherSubjectAssignments[0], semester: Semester.SEMESTER_1, dayOfWeek: 'WEDNESDAY' as const, period: 3, startTime: '09:20', endTime: '10:00', roomNumber: 'Room 12' },
    { teacherSubject: teacherSubjectAssignments[1], semester: Semester.SEMESTER_1, dayOfWeek: 'FRIDAY' as const,    period: 1, startTime: '08:00', endTime: '08:40', roomNumber: 'Room 12' },
  ];
  for (const slot of timetableSeed) {
    await prisma.timetableEntry.upsert({
      where: {
        teacherSubjectId_semester_dayOfWeek_period: {
          teacherSubjectId: slot.teacherSubject.id,
          semester: slot.semester,
          dayOfWeek: slot.dayOfWeek,
          period: slot.period,
        },
      },
      update: {},
      create: {
        teacherSubjectId: slot.teacherSubject.id,
        semester: slot.semester,
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
      },
    });
  }

  // --- Director & Vice Director -----------------------------------------------
  console.log('Seeding demo Director and Vice Director...');

  const directorUsername = 'director.demo';
  const directorUser = await prisma.user.findUnique({ where: { username: directorUsername } });
  if (!directorUser) {
    await prisma.user.create({
      data: {
        username: directorUsername,
        email: 'director@dinsho-secondary.edu.et',
        passwordHash: await hash(DEFAULT_PASSWORD),
        roleId: roles.DIRECTOR,
        director: { create: { firstName: 'Alemu', lastName: 'Tadesse' } },
      },
    });
    console.log(`  Created director — username: ${directorUsername} / password: ${DEFAULT_PASSWORD}`);
  } else {
    await resetPasswordIfEnabled(directorUsername, 'Director');
  }

  const viceDirectorUsername = 'vicedirector.demo';
  const viceDirectorUser = await prisma.user.findUnique({ where: { username: viceDirectorUsername } });
  if (!viceDirectorUser) {
    await prisma.user.create({
      data: {
        username: viceDirectorUsername,
        email: 'vicedirector@dinsho-secondary.edu.et',
        passwordHash: await hash(DEFAULT_PASSWORD),
        roleId: roles.VICE_DIRECTOR,
        viceDirector: { create: { firstName: 'Tigist', lastName: 'Haile' } },
      },
    });
    console.log(`  Created vice director — username: ${viceDirectorUsername} / password: ${DEFAULT_PASSWORD}`);
  } else {
    await resetPasswordIfEnabled(viceDirectorUsername, 'Vice Director');
  }

  // --- Students + Parents ------------------------------------------------------
  console.log('Seeding demo students and parents...');

  // Students split across Grade 9 A and Grade 9 B to demonstrate multi-section
  const studentSeed = [
    { firstName: 'Husen',   lastName: 'Ahmed',    gender: Gender.M, dob: '2010-03-14', guardianName: 'Tesfaye Alemu',   classroomKey: 'Grade 9-A' },
    { firstName: 'Chaltu',  lastName: 'Sani',     gender: Gender.F, dob: '2010-07-02', guardianName: 'Getachew Worku',  classroomKey: 'Grade 9-A' },
    { firstName: 'Selam',   lastName: 'Mulugeta', gender: Gender.F, dob: '2010-01-22', guardianName: 'Mulugeta Bekele', classroomKey: 'Grade 9-A' },
    { firstName: 'Abdi',    lastName: 'Bekele',   gender: Gender.M, dob: '2010-05-10', guardianName: 'Bekele Girma',    classroomKey: 'Grade 9-B' },
    { firstName: 'Meron',   lastName: 'Tesfaye',  gender: Gender.F, dob: '2010-09-18', guardianName: 'Tesfaye Lemma',   classroomKey: 'Grade 9-B' },
    { firstName: 'Dawit',   lastName: 'Haile',    gender: Gender.M, dob: '2010-11-03', guardianName: 'Haile Wolde',     classroomKey: 'Grade 9-B' },
  ];

  const students = [];

  for (const [idx, s] of studentSeed.entries()) {
    const admissionNumber = `DSH-2026-0000${idx + 1}`;  // fixed demo IDs
    const studentClassroom = classrooms[s.classroomKey];
    const existingStudent = await prisma.student.findUnique({ where: { admissionNumber }, include: { user: true } });
    if (existingStudent) {
      students.push(existingStudent);
      if (existingStudent.user) {
        await resetPasswordIfEnabled(existingStudent.user.username, `Student ${existingStudent.user.username}`);
      }
      continue;
    }

    const studentUsername = admissionNumber;  // Student ID = Username
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
            classroomId: studentClassroom.classroomId,
          },
        },
      },
      include: { student: true },
    });
    const student = studentUserRecord.student!;
    students.push(student);

    // Create initial StudentEnrollment for this admission year
    await prisma.studentEnrollment.upsert({
      where: { studentId_academicYear: { studentId: student.studentId, academicYear: CURRENT_ACADEMIC_YEAR } },
      update: {},
      create: {
        studentId: student.studentId,
        classroomId: studentClassroom.classroomId,
        academicYear: CURRENT_ACADEMIC_YEAR,
        decision: 'ACTIVE',
      },
    });

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

    console.log(`  Created student — ${s.firstName} ${s.lastName} → ${s.classroomKey} — username: ${studentUsername}`);
    console.log(`  Created guardian — username: ${parentUsername} / password: ${DEFAULT_PASSWORD}`);
  }

  // Grade 9 A students only (for attendance + grades which are classroom-specific)
  const grade9AStudents = students.filter((_, i) => studentSeed[i].classroomKey === 'Grade 9-A');

  // --- Sample attendance (today) ------------------------------------------------
  console.log('Seeding sample attendance for today (Grade 9 A)...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const student of grade9AStudents) {
    await prisma.attendance.upsert({
      where: { studentId_attendanceDate_period: { studentId: student.studentId, attendanceDate: today, period: 0 } },
      update: {},
      create: {
        studentId: student.studentId,
        teacherId: teacher.teacherId,
        classroomId: classroom.classroomId,
        attendanceDate: today,
        period: 0,
        status: AttendanceStatus.PRESENT,
      },
    });
  }

  // --- Sample grades (Semester 1) ------------------------------------------------
  console.log('Seeding a sample grading scheme and scores for Semester 1 (Grade 9 A)...');
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

    for (const [studentIndex, student] of grade9AStudents.entries()) {
      for (const component of components) {
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

  // --- Grade Subject Config (all grades / 2026/27) --------------------------------
  console.log('Seeding Grade Subject Config for all grades...');

  // Grade 9: Mathematics, English, Biology, Physics
  // Grade 10: Mathematics, English, Biology, Physics (same subjects for demo)
  // Grade 11: Mathematics, English, Biology, Physics
  // Grade 12: Mathematics, English, Biology, Physics
  const gradeSubjectDefs = [
    'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  ];

  for (const className of gradeSubjectDefs) {
    for (const [sortOrder, subject] of subjects.entries()) {
      await prisma.gradeSubjectConfig.upsert({
        where: {
          className_academicYear_subjectId: {
            className,
            academicYear: CURRENT_ACADEMIC_YEAR,
            subjectId: subject.subjectId,
          },
        },
        update: {},
        create: {
          className,
          academicYear: CURRENT_ACADEMIC_YEAR,
          subjectId: subject.subjectId,
          sortOrder,
        },
      });
    }
    console.log(`  Configured ${subjects.length} subjects for ${className} ${CURRENT_ACADEMIC_YEAR}`);
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
      data: grade9AStudents.map((s) => ({ assignmentId: assignment.assignmentId, studentId: s.studentId })),
    });
  }

  // --- Seed StudentIdCounter so next real registration starts at DSH-2026-00007 ---
  console.log('Seeding StudentIdCounter...');
  await prisma.studentIdCounter.upsert({
    where: { year: 2026 },
    update: {},
    create: { year: 2026, lastSequence: 6 }, // 6 demo students already seeded
  });

  // --- Historical academic reports + enrollments for Grade 9A students (transcript demo) -----
  // Seeds AcademicReport rows AND StudentEnrollment rows for prior years so the
  // transcript shows Grade 9→10→11→12 all on one page.
  console.log('Seeding historical academic reports + enrollments (multi-year transcript demo)...');

  // Look up the Grade 10A, 11A, 12A classrooms (already seeded for 2026/27)
  const gr10a = await prisma.classroom.findFirst({ where: { className: 'Grade 10', section: 'A', academicYear: CURRENT_ACADEMIC_YEAR } });
  const gr11a = await prisma.classroom.findFirst({ where: { className: 'Grade 11', section: 'A', academicYear: CURRENT_ACADEMIC_YEAR } });
  const gr12a = await prisma.classroom.findFirst({ where: { className: 'Grade 12', section: 'A', academicYear: CURRENT_ACADEMIC_YEAR } });

  // Map: academicYear → classroomId for historical enrollments
  // 2023/24 = Grade 9 (use existing Grade 9A classroom)
  // 2024/25 = Grade 10
  // 2025/26 = Grade 11
  // 2026/27 = Grade 12 (demo: show full Grade 9→12 progression)
  const historicalEnrollments: { academicYear: string; classroomId: number }[] = [
    { academicYear: '2023/24', classroomId: classroom.classroomId },   // Grade 9 A
    { academicYear: '2024/25', classroomId: gr10a?.classroomId ?? classroom.classroomId },
    { academicYear: '2025/26', classroomId: gr11a?.classroomId ?? classroom.classroomId },
    { academicYear: CURRENT_ACADEMIC_YEAR, classroomId: gr12a?.classroomId ?? classroom.classroomId }, // Grade 12 A
  ];

  // Seed enrollments for each Grade 9A student for each historical year
  for (const student of grade9AStudents) {
    for (const { academicYear, classroomId } of historicalEnrollments) {
      await prisma.studentEnrollment.upsert({
        where: { studentId_academicYear: { studentId: student.studentId, academicYear } },
        update: { classroomId },
        create: {
          studentId:    student.studentId,
          classroomId,
          academicYear,
          decision:     'ACTIVE',
        },
      });
    }
  }
  console.log('  Seeded historical enrollments for Grade 9A students (Gr9→Gr10→Gr11)');

  const historicalYears = [
    { academicYear: '2023/24', rank9a: [2, 1, 3] },   // chaltu 1st, husen 2nd, selam 3rd
    { academicYear: '2024/25', rank9a: [1, 2, 3] },   // husen 1st
    { academicYear: '2025/26', rank9a: [3, 1, 2] },   // selam 1st
  ];

  // Base averages per student per year (realistic variation)
  const historicalAverages: Record<string, number[]> = {
    '2023/24': [66.4, 68.5, 65.2],   // [husen, chaltu, selam]
    '2024/25': [72.1, 70.8, 69.5],
    '2025/26': [74.3, 73.1, 75.0],
  };

  const grade9AStudentIds = grade9AStudents.map((s) => s.studentId);

  for (const { academicYear, rank9a } of historicalYears) {
    const avgs = historicalAverages[academicYear];
    for (const sem of [Semester.SEMESTER_1, Semester.SEMESTER_2] as Semester[]) {
      // Slight variation between semesters
      const semOffset = sem === Semester.SEMESTER_1 ? -1.5 : 1.5;
      for (let i = 0; i < grade9AStudentIds.length; i++) {
        const studentId = grade9AStudentIds[i];
        const average = Math.round((avgs[i] + semOffset) * 100) / 100;
        const rank = rank9a[i];
        await prisma.academicReport.upsert({
          where: { studentId_semester_academicYear: { studentId, semester: sem, academicYear } },
          update: { averageMark: average, rank, generatedDate: new Date() },
          create: { studentId, semester: sem, academicYear, averageMark: average, rank },
        });
      }
      console.log(`  Seeded reports for ${academicYear} ${sem}`);
    }
  }

  console.log('\nSeeding complete. All demo accounts use the password: ' + DEFAULT_PASSWORD);
  console.log('  admin / director.demo / vicedirector.demo / abebe.kebede');
  console.log('  Students: husen.ahmed, chaltu.sani, selam.mulugeta (Grade 9A)');
  console.log('            abdi.bekele, meron.tesfaye, dawit.haile (Grade 9B)');
  console.log('  Classrooms: 12 classrooms across Grade 9–12, Sections A–C');
  console.log('  admin / director.demo / vicedirector.demo / abebe.kebede');
  console.log('  Students: husen.ahmed, chaltu.sani, selam.mulugeta (Grade 9A)');
  console.log('            abdi.bekele, meron.tesfaye, dawit.haile (Grade 9B)');
  console.log('  Classrooms: 12 classrooms across Grade 9–12, Sections A–C');
}

async function seedSystemSettings(): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      schoolName: 'Dinsho Secondary School',
      schoolAddress: 'Dinsho, Bale Zone, Oromia, Ethiopia',
      contactEmail: 'info@dinsho-secondary.edu.et',
      currentAcademicYear: CURRENT_ACADEMIC_YEAR,
      promotionPassMark: 50,
    },
  });
  console.log('  SystemSetting seeded.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });