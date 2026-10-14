/**
 * revised-scope.ts
 * READ-ONLY. Recalculates exact deletion scope under revised constraints:
 *   - Keep demo teacher abebe.kebede (teacherId=1) and all teacher-linked data
 *   - Keep TeacherSubject id=2 (English, Grade 9A) to protect GradeEntry 169 & 170
 *   - Keep TeacherSubject id=1 (Math, Grade 9A) — same teacher, safer to keep both
 *   - Keep all classrooms unchanged
 *   - Keep StudentIdCounter unchanged
 *   - Never delete real grades, real attendance, real audit records
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const DEMO_STUDENT_IDS  = [1, 2, 3, 4, 5, 6];
const DEMO_STUDENT_ADMS = ['DSH-2026-00001','DSH-2026-00002','DSH-2026-00003',
                           'DSH-2026-00004','DSH-2026-00005','DSH-2026-00006'];
const DEMO_PARENT_USERNAMES = ['tesfaye.alemu','getachew.worku','mulugeta.bekele',
                               'bekele.girma','tesfaye.lemma','haile.wolde'];
const DEMO_STAFF_USERNAMES  = ['director.demo','vicedirector.demo'];
// abebe.kebede intentionally excluded from deletion

async function main(): Promise<void> {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  const adapter = new PrismaMariaDb({
    host: dbUrl.hostname, port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    connectionLimit: 3,
  });
  const prisma = new PrismaClient({ adapter });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DSSSMS Phase 5.3 — Revised Scope (READ ONLY)');
  console.log('  Constraints: keep teacher, keep tsId=1&2, keep classrooms');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1. Demo students ────────────────────────────────────────────────────
  const demoStudents = await prisma.student.findMany({
    where: { admissionNumber: { in: DEMO_STUDENT_ADMS } },
    include: { user: { select: { userId: true, username: true } } },
    orderBy: { studentId: 'asc' },
  });
  console.log(`DEMO STUDENTS (${demoStudents.length}):`);
  for (const s of demoStudents) {
    console.log(`  studentId=${s.studentId} adm=${s.admissionNumber} userId=${s.user?.userId} username=${s.user?.username}`);
  }
  const demoStudentUserIds = demoStudents.map(s => s.user!.userId);

  // ── 2. Student-cascaded records ─────────────────────────────────────────
  console.log('\n── STUDENT-CASCADE RECORDS ────────────────────────────────');

  // GradeEntry — students 1-6 only (NOT through GradeComponent which could hit real entries)
  const gradeEntryCount = await prisma.gradeEntry.count({
    where: { studentId: { in: DEMO_STUDENT_IDS } },
  });
  // Verify none of these entries are the protected ones (169, 170 belong to students 9 & 10)
  const protectedInScope = await prisma.gradeEntry.count({
    where: { studentId: { in: DEMO_STUDENT_IDS }, gradeEntryId: { in: [169, 170] } },
  });
  console.log(`  GradeEntry (studentId in demo):     ${gradeEntryCount}`);
  console.log(`  Protected entries 169/170 in scope: ${protectedInScope} (must be 0)`);

  const academicReports = await prisma.academicReport.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  const attendance      = await prisma.attendance.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  const enrollments     = await prisma.studentEnrollment.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  const parentLinks     = await prisma.studentParentLink.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  const assignmentSubs  = await prisma.assignmentSubmission.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  const ptMessages      = await prisma.parentTeacherMessage.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  const conducts        = await prisma.studentConduct.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  const disciplines     = await prisma.disciplineRecord.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });

  // PromotionEntry — must delete explicitly (no cascade from Student)
  const promoEntries = await prisma.promotionEntry.findMany({
    where: { studentId: { in: DEMO_STUDENT_IDS } },
    select: { id: true, studentId: true, batchId: true },
  });
  const promoEntryIds  = promoEntries.map(e => e.id);
  const promoBatchIds  = [...new Set(promoEntries.map(e => e.batchId))];
  // Verify batches are all-demo
  for (const bid of promoBatchIds) {
    const totalInBatch = await prisma.promotionEntry.count({ where: { batchId: bid } });
    const demoInBatch  = await prisma.promotionEntry.count({ where: { batchId: bid, studentId: { in: DEMO_STUDENT_IDS } } });
    console.log(`  PromotionBatch ${bid}: ${totalInBatch} total / ${demoInBatch} demo — all-demo=${totalInBatch === demoInBatch}`);
  }

  // Notifications for demo students (studentId) — cascade from Student
  const notifStudentLinked = await prisma.notification.count({
    where: { studentId: { in: DEMO_STUDENT_IDS } },
  });
  console.log(`  AcademicReport:                     ${academicReports}`);
  console.log(`  Attendance (demo students):          ${attendance}`);
  console.log(`  StudentEnrollment:                   ${enrollments}`);
  console.log(`  StudentParentLink:                   ${parentLinks}`);
  console.log(`  AssignmentSubmission:                ${assignmentSubs}`);
  console.log(`  ParentTeacherMessage:                ${ptMessages}`);
  console.log(`  StudentConduct:                      ${conducts}`);
  console.log(`  DisciplineRecord:                    ${disciplines}`);
  console.log(`  PromotionEntry (explicit delete):    ${promoEntries.length} — ids=[${promoEntryIds.join(',')}]`);
  console.log(`  PromotionBatch (after entries gone): ${promoBatchIds.length} — ids=[${promoBatchIds.join(',')}]`);
  console.log(`  Notification (studentId cascade):   ${notifStudentLinked}`);

  // ── 3. Demo parent accounts — individual verification ─────────────────
  console.log('\n── PARENT ACCOUNTS (individual verification) ───────────────');
  const demoParentUsers = await prisma.user.findMany({
    where: { username: { in: DEMO_PARENT_USERNAMES } },
    include: {
      parent: {
        include: { links: { select: { id: true, studentId: true } } },
      },
      notifications: { select: { notificationId: true } },
      sentNotifications: { select: { notificationId: true } },
      sentMessages: { select: { id: true } },
      receivedMessages: { select: { id: true } },
      refreshTokens: { select: { id: true } },
    },
    orderBy: { username: 'asc' },
  });

  for (const u of demoParentUsers) {
    const p = u.parent;
    const linkedStudentIds = p?.links.map(l => l.studentId) ?? [];
    const allLinksDemo = linkedStudentIds.every(sid => DEMO_STUDENT_IDS.includes(sid));
    const sentMsgs = u.sentMessages.length;
    const recvMsgs = u.receivedMessages.length;
    // Are any messages NOT about demo students?
    const nonDemoMsgs = await prisma.parentTeacherMessage.count({
      where: {
        OR: [{ senderUserId: u.userId }, { recipientUserId: u.userId }],
        studentId: { notIn: DEMO_STUDENT_IDS },
      },
    });
    console.log(`  username=${u.username} userId=${u.userId} parentId=${p?.parentId}`);
    console.log(`    linked students: [${linkedStudentIds.join(',')}] all-demo=${allLinksDemo}`);
    console.log(`    notifications received: ${u.notifications.length}`);
    console.log(`    notifications sent: ${u.sentNotifications.length}`);
    console.log(`    PTMessages sent: ${sentMsgs} recv: ${recvMsgs} non-demo: ${nonDemoMsgs}`);
    console.log(`    refreshTokens: ${u.refreshTokens.length}`);
    console.log(`    SAFE TO DELETE: ${allLinksDemo && nonDemoMsgs === 0 ? 'YES' : 'NO — CHECK MANUALLY'}`);
  }

  // ── 4. Notifications — full breakdown ─────────────────────────────────
  console.log('\n── NOTIFICATIONS (full breakdown) ──────────────────────────');
  const totalNotif = await prisma.notification.count();
  // Demo-linked: sent to/from demo users OR linked to demo students
  const demoParentUserIds = demoParentUsers.map(u => u.userId);
  const allDemoUserIds    = [...demoStudentUserIds, ...demoParentUserIds];

  const notifToParents  = await prisma.notification.count({ where: { recipientUserId: { in: demoParentUserIds } } });
  const notifToStudents = await prisma.notification.count({ where: { recipientUserId: { in: demoStudentUserIds } } });
  const notifFromDemo   = await prisma.notification.count({ where: { senderUserId: { in: allDemoUserIds } } });
  const notifStudentId  = await prisma.notification.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });

  // Union (avoid double-counting)
  const notifDemoUnion = await prisma.notification.count({
    where: {
      OR: [
        { recipientUserId: { in: allDemoUserIds } },
        { senderUserId:    { in: allDemoUserIds } },
        { studentId:       { in: DEMO_STUDENT_IDS } },
      ],
    },
  });

  // Check for notifications whose ONLY link is to demo users but recipient is real
  const notifRealRecipient = await prisma.notification.count({
    where: {
      recipientUserId: { notIn: allDemoUserIds },
      OR: [
        { senderUserId: { in: allDemoUserIds } },
        { studentId:    { in: DEMO_STUDENT_IDS } },
      ],
    },
  });

  console.log(`  Total notifications:               ${totalNotif}`);
  console.log(`  Recipient is demo parent:          ${notifToParents}`);
  console.log(`  Recipient is demo student:         ${notifToStudents}`);
  console.log(`  Sender is demo user:               ${notifFromDemo}`);
  console.log(`  studentId is demo student:         ${notifStudentId}`);
  console.log(`  UNION (all demo-linked):           ${notifDemoUnion}`);
  console.log(`  Non-demo recipient, demo sender:   ${notifRealRecipient} ← MUST verify`);
  console.log(`  Safe non-demo notifications:       ${totalNotif - notifDemoUnion}`);

  // Show real-recipient notifications that have demo sender/student
  if (notifRealRecipient > 0) {
    const flagged = await prisma.notification.findMany({
      where: {
        recipientUserId: { notIn: allDemoUserIds },
        OR: [
          { senderUserId: { in: allDemoUserIds } },
          { studentId:    { in: DEMO_STUDENT_IDS } },
        ],
      },
      select: { notificationId: true, recipientUserId: true, senderUserId: true, studentId: true, title: true, category: true },
    });
    console.log('\n  FLAGGED NOTIFICATIONS (real recipient, demo sender/student):');
    for (const n of flagged) {
      console.log(`    id=${n.notificationId} recipient=${n.recipientUserId} sender=${n.senderUserId} studentId=${n.studentId} cat=${n.category} title="${n.title}"`);
    }
  }

  // ── 5. Demo staff (director.demo, vicedirector.demo) ──────────────────
  console.log('\n── DEMO STAFF (director.demo, vicedirector.demo) ───────────');
  const demoStaff = await prisma.user.findMany({
    where: { username: { in: DEMO_STAFF_USERNAMES } },
    include: {
      director:    true,
      viceDirector: true,
      finalizedClassrooms: { select: { id: true } },
      finalizedSubjects:   { select: { id: true } },
      reviewedSubjects:    { select: { id: true } },
      preparedBatches:     { select: { id: true } },
      approvedBatches:     { select: { id: true } },
      rejectedBatches:     { select: { id: true } },
      notifications:       { select: { notificationId: true } },
      sentNotifications:   { select: { notificationId: true } },
      reportedDisciplineRecords: { select: { id: true } },
    },
  });
  for (const u of demoStaff) {
    console.log(`  username=${u.username} userId=${u.userId}`);
    console.log(`    finalizedClassrooms: ${u.finalizedClassrooms.length}`);
    console.log(`    finalizedSubjects:   ${u.finalizedSubjects.length}`);
    console.log(`    reviewedSubjects:    ${u.reviewedSubjects.length}`);
    console.log(`    preparedBatches:     ${u.preparedBatches.length}`);
    console.log(`    approvedBatches:     ${u.approvedBatches.length}`);
    console.log(`    rejectedBatches:     ${u.rejectedBatches.length}`);
    console.log(`    notifications:       ${u.notifications.length}`);
    console.log(`    sentNotifications:   ${u.sentNotifications.length}`);
    console.log(`    disciplineRecords:   ${u.reportedDisciplineRecords.length}`);
  }

  // ── 6. Final summary — what will actually be deleted ──────────────────
  console.log('\n── REVISED DELETION SUMMARY ────────────────────────────────');
  console.log('  STEP 1  DELETE PromotionEntry ids=[' + promoEntryIds.join(',') + ']  (' + promoEntries.length + ' rows)');
  console.log('  STEP 2  DELETE PromotionBatch  ids=[' + promoBatchIds.join(',') + ']  (' + promoBatchIds.length + ' rows)');
  console.log('  STEP 3  DELETE Student admissionNumber IN (DSH-2026-00001..00006)');
  console.log('          CASCADE: GradeEntry(' + gradeEntryCount + ') AcademicReport(' + academicReports + ')');
  console.log('          CASCADE: Attendance(' + attendance + ') Enrollment(' + enrollments + ')');
  console.log('          CASCADE: ParentLink(' + parentLinks + ') AssignSub(' + assignmentSubs + ')');
  console.log('          CASCADE: PTMessage(' + ptMessages + ') Notification(studentId cascade)(' + notifStudentLinked + ')');
  console.log('  STEP 4  DELETE User (6 demo parents) → CASCADE Parent, Notification, RefreshToken');
  console.log('  STEP 5  DELETE User (director.demo, vicedirector.demo) → CASCADE Director, ViceDirector');
  console.log('  KEPT    abebe.kebede teacher — NOT deleted');
  console.log('  KEPT    TeacherSubject ids 1,2 (and all GradeComponents/Entries under them)');
  console.log('  KEPT    GradeEntry 169, 170 (real student scores) — safe, student cascade only hits demo students');
  console.log('  KEPT    Attendance 21,25,26,27 (real students, demo teacher reference) — NOT deleted');
  console.log('  KEPT    All 17 classrooms unchanged');
  console.log('  KEPT    StudentIdCounter unchanged');

  // ── 7. Verify protected entries 169/170 are NOT reachable by student cascade
  console.log('\n── PROTECTED ENTRY VERIFICATION ────────────────────────────');
  const entry169 = await prisma.gradeEntry.findUnique({ where: { gradeEntryId: 169 }, select: { gradeEntryId: true, studentId: true, score: true } });
  const entry170 = await prisma.gradeEntry.findUnique({ where: { gradeEntryId: 170 }, select: { gradeEntryId: true, studentId: true, score: true } });
  console.log(`  GradeEntry 169: studentId=${entry169?.studentId} (demo student? ${DEMO_STUDENT_IDS.includes(entry169?.studentId ?? -1)}) score=${entry169?.score}`);
  console.log(`  GradeEntry 170: studentId=${entry170?.studentId} (demo student? ${DEMO_STUDENT_IDS.includes(entry170?.studentId ?? -1)}) score=${entry170?.score}`);
  console.log(`  → Both entries belong to NON-demo students. Deleting demo students will NOT cascade to them.`);
  console.log(`  → BUT: if TeacherSubject id=2 is deleted, GradeComponent 5 cascades → these entries are lost.`);
  console.log(`  → DECISION: TeacherSubject id=2 (and id=1) are KEPT. Protected entries remain safe.`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
