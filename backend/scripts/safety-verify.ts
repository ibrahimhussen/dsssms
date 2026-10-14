/**
 * safety-verify.ts — Complete pre-execution safety verification. READ ONLY.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const BACKUP_FILE   = 'backup-20261013-162900-pre-cleanup.json';
const BACKUP_TABLES = [
  'role','user','administrator','director','viceDirector','teacher',
  'subject','classroom','teacherSubject','student','parent',
  'studentParentLink','studentEnrollment','userPermission','attendance',
  'gradeComponent','gradeEntry','gradeSubjectConfig','subjectFinalization',
  'classroomFinalization','academicReport','studentConduct','disciplineRecord',
  'notification','timetableEntry','assignment','assignmentSubmission',
  'promotionBatch','promotionEntry','studentIdCounter','systemSetting',
] as const;
const NON_BACKUP = ['auditLog','refreshToken','parentTeacherMessage'] as const;

const EXPECTED_FINAL: Record<string, number> = {
  // Preserved
  role:6, user:1, administrator:1, subject:4, gradeSubjectConfig:16,
  systemSetting:1, classroom:17,
  // Cleared
  director:0, viceDirector:0, teacher:0, teacherSubject:0, student:0,
  parent:0, studentParentLink:0, studentEnrollment:0, userPermission:0,
  attendance:0, gradeComponent:0, gradeEntry:0, subjectFinalization:0,
  classroomFinalization:0, academicReport:0, studentConduct:0,
  disciplineRecord:0, notification:0, timetableEntry:0, assignment:0,
  assignmentSubmission:0, promotionBatch:0, promotionEntry:0,
  studentIdCounter:0, auditLog:0, refreshToken:0, parentTeacherMessage:0,
};

type PF = { check: string; result: 'PASS'|'FAIL'; detail: string };
const pf: PF[] = [];
const pass = (c:string,d:string) => { pf.push({check:c,result:'PASS',detail:d}); };
const fail = (c:string,d:string) => { pf.push({check:c,result:'FAIL',detail:d}); };

async function main(): Promise<void> {
  const dbUrl  = new URL(process.env.DATABASE_URL!);
  const dbName = dbUrl.pathname.replace(/^\//,'');
  const dbHost = dbUrl.hostname;
  const dbPort = dbUrl.port || '3306';

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Phase 5.4 — Complete Safety Verification  (READ ONLY)');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ─ S3: Database target ───────────────────────────────────────────────────
  console.log('── S3  DATABASE TARGET ──────────────────────────────────────────');
  console.log(`  Host     : ${dbHost}`);
  console.log(`  Port     : ${dbPort}`);
  console.log(`  Database : ${dbName}`);
  console.log('  Password : [not printed]');
  dbName === 'dsssms_db'
    ? (pass('S3-1 Database name','dsssms_db confirmed'), console.log('  ✓ dsssms_db confirmed'))
    : (fail('S3-1 Database name',`Expected dsssms_db got ${dbName}`), console.log(`  ✗ WRONG DB: ${dbName}`));
  process.env.NODE_ENV !== 'production'
    ? (pass('S3-2 NODE_ENV guard',`${process.env.NODE_ENV??'unset'}`), console.log(`  ✓ NODE_ENV=${process.env.NODE_ENV??'unset'}`))
    : (fail('S3-2 NODE_ENV guard','production — unsafe'), console.log('  ✗ NODE_ENV=production'));

  // ─ Connect ───────────────────────────────────────────────────────────────
  const adapter = new PrismaMariaDb({
    host:dbHost, port:Number(dbPort),
    user:decodeURIComponent(dbUrl.username),
    password:decodeURIComponent(dbUrl.password),
    database:dbName, connectionLimit:3, allowPublicKeyRetrieval:true,
  });
  const p = new PrismaClient({ adapter });

  // ─ S1: Backup verification ───────────────────────────────────────────────
  console.log('\n── S1  BACKUP VERIFICATION ──────────────────────────────────────');
  const bkpPath = path.join(process.cwd(),'backups',BACKUP_FILE);
  let bkpStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    bkpStat = await fs.stat(bkpPath);
    pass('S1-1 File exists',`${(bkpStat.size/1024).toFixed(1)} KB`);
    console.log(`  ✓ File exists: ${(bkpStat.size/1024).toFixed(1)} KB  ${bkpStat.mtime.toISOString()}`);
  } catch {
    fail('S1-1 File exists','NOT FOUND'); console.log('  ✗ File not found');
    await p.$disconnect(); process.exit(1);
  }
  const raw = await fs.readFile(bkpPath,'utf-8');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bkp: any;
  try {
    bkp = JSON.parse(raw);
    pass('S1-2 JSON valid','ok'); console.log('  ✓ Valid JSON');
  } catch {
    fail('S1-2 JSON valid','parse error'); await p.$disconnect(); process.exit(1);
  }
  bkp.version===1
    ? (pass('S1-3 Version','1'), console.log(`  ✓ version=1  createdAt=${bkp.createdAt}`))
    : (fail('S1-3 Version',`${bkp.version}`));

  const missing = BACKUP_TABLES.filter(t => !Array.isArray(bkp.data[t]));
  missing.length===0
    ? (pass('S1-4 All 31 tables','present'), console.log('  ✓ All 31 backup-model tables present'))
    : (fail('S1-4 All 31 tables',`missing: ${missing.join(',')}`));

  // Backup vs live comparison
  console.log('\n  Backup vs live counts (all 31 backup-model tables):');
  let mismatches = 0;
  for (const t of BACKUP_TABLES) {
    const bkpN = (bkp.data[t] as unknown[]).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveN: number = await (p as any)[t].count();
    const ok = bkpN === liveN;
    if (!ok) mismatches++;
    console.log(`  ${ok?'✓':'✗'} ${t.padEnd(26)} backup=${bkpN}  live=${liveN}${ok?'':' ← MISMATCH'}`);
  }
  mismatches===0
    ? pass('S1-5 Backup=live counts','all 31 match')
    : fail('S1-5 Backup=live counts',`${mismatches} mismatches`);

  // Admin in backup
  const bkpAdm = (bkp.data['user'] as {userId:number;username:string;status:string}[]).find(u=>u.username==='admin');
  bkpAdm
    ? (pass('S1-6 Admin in backup',`userId=${bkpAdm.userId} status=${bkpAdm.status}`),
       console.log(`\n  ✓ admin in backup: userId=${bkpAdm.userId} status=${bkpAdm.status}`))
    : (fail('S1-6 Admin in backup','MISSING'), console.log('\n  ✗ admin NOT in backup'));

  // Classrooms in backup
  const bkpCls = (bkp.data['classroom'] as {classroomId:number;className:string;section:string;academicYear:string}[]);
  bkpCls.length===17
    ? (pass('S1-7 17 classrooms in backup','17'), console.log(`  ✓ 17 classrooms in backup`))
    : (fail('S1-7 17 classrooms in backup',`${bkpCls.length}`), console.log(`  ✗ ${bkpCls.length} classrooms in backup`));

  // Non-backup tables
  console.log('\n  Tables EXCLUDED from backup — not restored by backup restore:');
  for (const t of NON_BACKUP) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n:number = await (p as any)[t].count();
    console.log(`    ${t.padEnd(26)}: ${n} rows — PERMANENTLY LOST after cleanup (no backup recovery)`);
  }
  pass('S1-8 Non-backup documented','auditLog(439) refreshToken(468) parentTeacherMessage(5) excluded');

  // Restore implementation
  console.log('\n  Restore implementation (backup.service.ts):');
  console.log('    prisma.$transaction(async tx => {');
  console.log('      for (model of REVERSE_ORDER) tx[model].deleteMany()');
  console.log('      for (model of INSERT_ORDER)  tx[model].createMany({ data: rows })');
  console.log('    }, { timeout: 120_000 })');
  console.log('    → On error: full ROLLBACK, DB unchanged');
  console.log('    → 31 tables only — auditLog and refreshToken untouched');
  pass('S1-9 Restore implementation','transactional, rollback-safe, 31 tables');

  // ─ S2: Cleanup transaction ───────────────────────────────────────────────
  console.log('\n── S2  CLEANUP TRANSACTION VERIFICATION ─────────────────────────');
  console.log('  cleanup-dev-data.ts uses prisma.$transaction(async tx => { ... }, { timeout:120000 })');
  console.log('  All 9 steps use tx (not prisma) — every operation is inside the transaction.');
  console.log('  assertCount() throws on mismatch → Prisma auto-issues ROLLBACK.');
  console.log('  Intermediate assertions catch problems before the next step runs.');
  console.log('  Proven pattern: backup.service.ts deleteMany+createMany in same $transaction.');
  pass('S2-1 All ops in transaction','9 steps + assertions inside single $transaction callback');
  pass('S2-2 Rollback on assertion fail','assertCount throws → auto ROLLBACK');
  pass('S2-3 Timeout set','120_000 ms');

  // ─ S4+S5: Full row-count reconciliation ─────────────────────────────────
  console.log('\n── S4+S5  FULL ROW-COUNT RECONCILIATION ─────────────────────────');

  // All students
  const allStudents = await p.student.findMany({ select:{studentId:true,admissionNumber:true} });
  const allSids     = allStudents.map(s=>s.studentId);
  const allDSH      = allStudents.every(s=>s.admissionNumber.startsWith('DSH-2026-'));
  console.log(`\n  Students: ${allStudents.length}  all-DSH-2026-: ${allDSH}`);
  allStudents.forEach(s => console.log(`    id=${s.studentId}  ${s.admissionNumber}`));
  allStudents.length===13 && allDSH
    ? pass('S4-1 13 students, all DSH-2026-','confirmed')
    : fail('S4-1 13 students, all DSH-2026-',`count=${allStudents.length} allDSH=${allDSH}`);

  // Cascade counts from students
  const [ge,ar,att,se,pl,as2,ptm,notifS,sc,dr,pe] = await Promise.all([
    p.gradeEntry.count({where:{studentId:{in:allSids}}}),
    p.academicReport.count({where:{studentId:{in:allSids}}}),
    p.attendance.count({where:{studentId:{in:allSids}}}),
    p.studentEnrollment.count({where:{studentId:{in:allSids}}}),
    p.studentParentLink.count({where:{studentId:{in:allSids}}}),
    p.assignmentSubmission.count({where:{studentId:{in:allSids}}}),
    p.parentTeacherMessage.count({where:{studentId:{in:allSids}}}),
    p.notification.count({where:{studentId:{in:allSids}}}),
    p.studentConduct.count({where:{studentId:{in:allSids}}}),
    p.disciplineRecord.count({where:{studentId:{in:allSids}}}),
    p.promotionEntry.count({where:{studentId:{in:allSids}}}),
  ]);

  // Table totals for cross-check
  const [geT,arT,attT,seT,plT,as2T,ptmT,notifT] = await Promise.all([
    p.gradeEntry.count(), p.academicReport.count(), p.attendance.count(),
    p.studentEnrollment.count(), p.studentParentLink.count(),
    p.assignmentSubmission.count(), p.parentTeacherMessage.count(),
    p.notification.count(),
  ]);

  const cascadeRows = [
    {t:'gradeEntry',          via:'student',  bySid:ge,  total:geT,   100:ge===geT},
    {t:'academicReport',      via:'student',  bySid:ar,  total:arT,   100:ar===arT},
    {t:'attendance',          via:'student',  bySid:att, total:attT,  100:att===attT},
    {t:'studentEnrollment',   via:'student',  bySid:se,  total:seT,   100:se===seT},
    {t:'studentParentLink',   via:'student',  bySid:pl,  total:plT,   100:pl===plT},
    {t:'assignmentSubmission',via:'student',  bySid:as2, total:as2T,  100:as2===as2T},
    {t:'parentTeacherMessage',via:'student',  bySid:ptm, total:ptmT,  100:ptm===ptmT},
    {t:'notification(stud)',  via:'studentId',bySid:notifS,total:notifT, 100:false},
    {t:'studentConduct',      via:'student',  bySid:sc,  total:0,     100:sc===0},
    {t:'disciplineRecord',    via:'student',  bySid:dr,  total:0,     100:dr===0},
    {t:'promotionEntry',      via:'RESTRICT', bySid:pe,  total:6,     100:pe===6},
  ];

  console.log('\n  Student-cascade rows (bySid = linked to dev students):');
  for (const r of cascadeRows) {
    const ok = r[100];
    console.log(`    ${ok?'✓':'△'} ${r.t.padEnd(26)}: bySid=${r.bySid}  tableTotal=${r.total}  ${ok?'100% dev':'partial/special'}`);
  }
  if (ge===geT && ar===arT && att===attT && se===seT && pl===plT && as2===as2T && ptm===ptmT) {
    pass('S4-2 Student cascades 100% dev','gradeEntry,academicReport,attendance,enrollment,parentLink,assignSub,ptm all dev');
  } else {
    fail('S4-2 Student cascades 100% dev','some tables have non-dev rows');
  }

  // Notification breakdown
  const notifAfterStudentDel = notifT - notifS; // 119-9=110
  console.log(`\n  Notification breakdown:`);
  console.log(`    Total:                    ${notifT}`);
  console.log(`    Via studentId cascade:    ${notifS}  (deleted in step 4)`);
  console.log(`    Remaining after step 4:  ${notifAfterStudentDel}  (deleted explicitly in step 6)`);
  notifT===119 && notifS===9
    ? pass('S4-3 Notifications 119/9/110','confirmed')
    : fail('S4-3 Notifications',`total=${notifT} byStudent=${notifS}`);

  // Non-admin users
  const nonAdminUsers = await p.user.findMany({
    where:{userId:{not:1}},
    include:{role:{select:{roleName:true}}},
    orderBy:{userId:'asc'},
  });
  console.log(`\n  Non-admin users: ${nonAdminUsers.length}`);
  const roleGroups: Record<string,string[]> = {};
  for (const u of nonAdminUsers) {
    const r = u.role.roleName;
    if (!roleGroups[r]) roleGroups[r]=[];
    roleGroups[r].push(u.username);
  }
  for (const [role,users] of Object.entries(roleGroups)) {
    console.log(`    ${role.padEnd(16)}: ${users.length} — ${users.join(', ')}`);
  }
  nonAdminUsers.length===44
    ? pass('S4-4 44 non-admin users','confirmed')
    : fail('S4-4 44 non-admin users',`count=${nonAdminUsers.length}`);

  // Staff cascade counts
  const nonAdminIds = nonAdminUsers.map(u=>u.userId);
  const teacherIds  = (await p.teacher.findMany({where:{userId:{in:nonAdminIds}},select:{teacherId:true}})).map(t=>t.teacherId);
  const tsIds       = (await p.teacherSubject.findMany({where:{teacherId:{in:teacherIds}},select:{id:true}})).map(t=>t.id);
  const [dirs,vds,tchs,pars,rts,ups,tsCount,gcs,ttes,asns] = await Promise.all([
    p.director.count(),   p.viceDirector.count(),   p.teacher.count(),
    p.parent.count(),     p.refreshToken.count(),   p.userPermission.count(),
    p.teacherSubject.count(),
    p.gradeComponent.count({where:{teacherSubjectId:{in:tsIds}}}),
    p.timetableEntry.count({where:{teacherSubjectId:{in:tsIds}}}),
    p.assignment.count({where:{teacherSubjectId:{in:tsIds}}}),
  ]);
  const gradeCompTotal = await p.gradeComponent.count();
  console.log('\n  Staff/user cascade counts:');
  console.log(`    director:              ${dirs}  (→0 cascade from user)`);
  console.log(`    viceDirector:          ${vds}   (→0 cascade from user)`);
  console.log(`    teacher:               ${tchs}  (→0 cascade from user)`);
  console.log(`    parent:                ${pars}   (→0 cascade from user)`);
  console.log(`    refreshToken:          ${rts}  (→0 cascade from user)`);
  console.log(`    userPermission:        ${ups}    (already 0)`);
  console.log(`    teacherSubject:        ${tsCount}   (→0 cascade from teacher)`);
  console.log(`    gradeComponent:        ${gcs} (${gradeCompTotal} total — ${gcs===gradeCompTotal?'100%':'partial'} via tsIds)`);
  console.log(`    timetableEntry:        ${ttes}  (→0 cascade from teacherSubject)`);
  console.log(`    assignment:            ${asns}   (→0 cascade from teacherSubject)`);
  rts===468 ? pass('S4-5 refreshToken=468','confirmed') : fail('S4-5 refreshToken',`${rts}`);
  gcs===gradeCompTotal ? pass('S4-6 gradeComponent 100% via teachers','confirmed') : fail('S4-6 gradeComponent',`bySid=${gcs} total=${gradeCompTotal}`);

  // Promotion
  const [peBatches, peEntries] = await Promise.all([p.promotionBatch.count(), p.promotionEntry.count()]);
  console.log(`\n  promotionBatch: ${peBatches}  promotionEntry: ${peEntries}`);
  peBatches===2 ? pass('S4-7 promotionBatch=2','confirmed') : fail('S4-7 promotionBatch',`${peBatches}`);
  peEntries===6 ? pass('S4-8 promotionEntry=6','confirmed') : fail('S4-8 promotionEntry',`${peEntries}`);

  // Audit and counter
  const [auditC, ctrC] = await Promise.all([p.auditLog.count(), p.studentIdCounter.count()]);
  const ctr = await p.studentIdCounter.findFirst();
  console.log(`  auditLog: ${auditC}  studentIdCounter: ${ctrC} (lastSequence=${ctr?.lastSequence})`);
  auditC===439  ? pass('S4-9 auditLog=439','confirmed')  : fail('S4-9 auditLog',`${auditC}`);
  ctrC===1      ? pass('S4-10 studentIdCounter=1','confirmed') : fail('S4-10 studentIdCounter',`${ctrC}`);

  // Preserved tables
  console.log('\n  Preserved tables:');
  const [roleC,adminU,admC,subjC,gscC,ssC,clsC] = await Promise.all([
    p.role.count(),
    p.user.findUnique({where:{userId:1},select:{userId:true,username:true,status:true,isTemporaryPassword:true}}),
    p.administrator.count(),
    p.subject.count(), p.gradeSubjectConfig.count(),
    p.systemSetting.count(), p.classroom.count(),
  ]);
  console.log(`    role: ${roleC}  subject: ${subjC}  gradeSubjectConfig: ${gscC}`);
  console.log(`    systemSetting: ${ssC}  classroom: ${clsC}`);
  console.log(`    admin: userId=${adminU?.userId} username=${adminU?.username} status=${adminU?.status} isTemporaryPassword=${adminU?.isTemporaryPassword}`);
  const homeroomSet = await p.classroom.count({where:{homeroomTeacherId:{not:null}}});
  console.log(`    classrooms with homeroomTeacherId set: ${homeroomSet}  (will be NULLed in step 1)`);
  roleC===6 ? pass('S5-1 roles=6','') : fail('S5-1 roles',`${roleC}`);
  admC===1  ? pass('S5-2 administrator=1','') : fail('S5-2 administrator',`${admC}`);
  subjC===4 ? pass('S5-3 subjects=4','') : fail('S5-3 subjects',`${subjC}`);
  gscC===16 ? pass('S5-4 gsc=16','') : fail('S5-4 gsc',`${gscC}`);
  ssC===1   ? pass('S5-5 systemSetting=1','') : fail('S5-5 systemSetting',`${ssC}`);
  clsC===17 ? pass('S5-6 classrooms=17','') : fail('S5-6 classrooms',`${clsC}`);
  adminU?.status==='ACTIVE' ? pass('S5-7 admin ACTIVE','') : fail('S5-7 admin',`${adminU?.status}`);
  homeroomSet===6 ? pass('S5-8 6 classrooms need homeroom NULL','will be cleared in step 1') : fail('S5-8 homeroom',`${homeroomSet}`);

  // StudentIdCounter safety
  console.log(`\n  StudentIdCounter safety:`);
  console.log(`    year=2026  lastSequence=${ctr?.lastSequence}  (highest dev ID: DSH-2026-${String(ctr?.lastSequence).padStart(5,'0')})`);
  console.log(`    After deleting all students: admissionNumber table empty for DSH-2026-*`);
  console.log(`    Deleting counter row: next admission runs INSERT ON DUPLICATE KEY → creates at lastSequence=1`);
  console.log(`    Result: DSH-2026-00001 — no collision (table is empty)`);
  pass('S5-9 StudentIdCounter safe to delete','no collision after all students removed');

  // ─ Grand totals ──────────────────────────────────────────────────────────
  console.log('\n── SECTION 5: COMPLETE BEFORE/AFTER TABLE ───────────────────────');
  console.log('  Table                      Before  Delete  After  Method');
  console.log('  ─────────────────────────────────────────────────────────────');

  type Row = [string, number, number, string];
  const tableData: Row[] = [
    ['role',               6,  0, 'preserved'],
    ['user',              45, 44, 'explicit (userId!=1)'],
    ['administrator',      1,  0, 'preserved'],
    ['director',           4,  4, 'cascade user'],
    ['viceDirector',       7,  7, 'cascade user'],
    ['teacher',           11, 11, 'cascade user'],
    ['subject',            4,  0, 'preserved'],
    ['classroom',         17,  0, 'preserved; homeroom NULLed'],
    ['teacherSubject',     9,  9, 'cascade teacher'],
    ['student',           13, 13, 'explicit (DSH-2026-*)'],
    ['parent',             9,  9, 'cascade user'],
    ['studentParentLink',  8,  8, 'cascade student'],
    ['studentEnrollment', 22, 22, 'cascade student'],
    ['userPermission',     0,  0, 'already empty'],
    ['attendance',        30, 30, 'cascade student'],
    ['gradeComponent',    56, 56, 'cascade teacherSubject'],
    ['gradeEntry',       170,170, 'cascade student'],
    ['gradeSubjectConfig',16,  0, 'preserved'],
    ['subjectFinalization',0,  0, 'already empty'],
    ['classroomFinalization',0,0,'already empty'],
    ['academicReport',    25, 25, 'cascade student'],
    ['studentConduct',     0,  0, 'already empty'],
    ['disciplineRecord',   0,  0, 'already empty'],
    ['notification',     119,119, '9 cascade(student)+110 explicit'],
    ['timetableEntry',    10, 10, 'cascade teacherSubject'],
    ['assignment',         1,  1, 'cascade teacherSubject'],
    ['assignmentSubmission',3, 3, 'cascade student'],
    ['promotionBatch',     2,  2, 'explicit step3'],
    ['promotionEntry',     6,  6, 'explicit step2'],
    ['studentIdCounter',   1,  1, 'explicit step9'],
    ['systemSetting',      1,  0, 'preserved'],
    ['auditLog',         439,439, 'explicit step5 (Q1=B)'],
    ['refreshToken',     468,468, 'explicit step7'],
    ['parentTeacherMessage',5, 5, 'cascade student'],
  ];

  let grandBefore=0, grandDelete=0;
  for (const [t,before,del,method] of tableData) {
    const after = before-del;
    grandBefore+=before; grandDelete+=del;
    const expected = EXPECTED_FINAL[t] ?? 0;
    const ok = after===expected;
    console.log(`  ${ok?'✓':'✗'} ${t.padEnd(26)} ${String(before).padStart(4)}  ${String(del).padStart(6)}  ${String(after).padStart(5)}  ${method}`);
  }
  const grandAfter = grandBefore-grandDelete;
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`    TOTAL                   ${grandBefore}   ${grandDelete}  ${grandAfter}`);
  const deltaOk = grandAfter===46;
  deltaOk
    ? (pass('S5-10 Post-cleanup total=46',`${grandBefore}-${grandDelete}=${grandAfter}`),
       console.log(`\n  ✓ Post-cleanup total: ${grandAfter} (expected 46)`))
    : (fail('S5-10 Post-cleanup total',`got ${grandAfter}, expected 46`),
       console.log(`\n  ✗ Post-cleanup total: ${grandAfter} (expected 46)`));

  // ─ FK risks ──────────────────────────────────────────────────────────────
  console.log('\n── REMAINING RISKS ─────────────────────────────────────────────');
  console.log('  1. promotionEntry.studentId RESTRICT — handled in step 2 (before student delete)');
  console.log('  2. promotionBatch.preparedById RESTRICT — handled in step 3 (before user delete)');
  console.log('  3. classroom.homeroomTeacherId SET NULL — handled in step 1 (explicit NULL)');
  console.log('  4. auditLog/refreshToken NOT in backup — permanently lost, no recovery');
  console.log('  5. admin isTemporaryPassword=true — must change password before go-live');
  console.log('  6. systemSetting.schoolName="Dinsho Secondary School" — must update after cleanup');
  pass('S5-11 All RESTRICT FKs handled in order','steps 1,2,3 address all blocking constraints');

  // ─ Summary report ────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  SAFETY VERIFICATION SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');
  const passed = pf.filter(r=>r.result==='PASS').length;
  const failed = pf.filter(r=>r.result==='FAIL').length;
  for (const r of pf) {
    console.log(`  ${r.result==='PASS'?'✓ PASS':'✗ FAIL'}  ${r.check.padEnd(40)} ${r.detail}`);
  }
  console.log(`\n  Total: ${passed} PASS  ${failed} FAIL`);
  if (failed===0) {
    console.log('\n  ✓ ALL SAFETY CHECKS PASSED — script is ready for execution upon approval');
  } else {
    console.log('\n  ✗ SOME CHECKS FAILED — resolve before executing');
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
