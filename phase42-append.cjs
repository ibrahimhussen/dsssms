const fs = require('fs');
const p = 'backend/src/modules/academic-register/__tests__/full-year-register.test.ts';

const block = `
describe('Grade/year isolation', () => {
  let svc;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });
  it('register metadata shows correct grade and section', async () => {
    withScoresForBoth([C1],[STU1],[70],[65]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.metadata.grade).toBe('Grade 9');
    expect(r.metadata.section).toBe('A');
    expect(r.metadata.academicYear).toBe('2026/27');
  });
  it('GradeSubjectConfig query uses classroom grade and requested academicYear', async () => {
    withScoresForBoth([C1,C2],[STU1],[70,65],[68,60]);
    await svc.generateClassroomRegister(ACTOR, Q_S1);
    const calls = prisma.gradeSubjectConfig.findMany.mock.calls;
    expect(calls[0][0].where.className).toBe('Grade 9');
    expect(calls[0][0].where.academicYear).toBe('2026/27');
  });
  it('different classroom uses its own classroomId', async () => {
    prisma.classroom.findUnique.mockResolvedValue(CL10A);
    prisma.gradeSubjectConfig.findMany.mockResolvedValue([C1,C2]);
    prisma.student.findMany.mockResolvedValue([{...STU1,classroomId:3}]);
    prisma.student.count.mockResolvedValue(1);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.studentConduct.findMany.mockResolvedValue([]);
    prisma.classroom.findMany.mockResolvedValue([CL10A]);
    prisma.systemSetting.findUnique.mockResolvedValue(SETTINGS);
    prisma.classroomFinalization.findUnique.mockResolvedValue(null);
    prisma.teacherSubject.findMany.mockResolvedValue([]);
    prisma.subjectFinalization.findMany.mockResolvedValue([]);
    prisma.gradeComponent.findMany.mockResolvedValue([]);
    prisma.gradeEntry.findMany.mockResolvedValue([]);
    const q = { classroomId:3, academicYear:'2026/27', viewMode:'SEMESTER_1' };
    const r = await svc.generateClassroomRegister(ACTOR, q);
    expect(r.metadata.grade).toBe('Grade 10');
    expect(r.metadata.classroomId).toBe(3);
  });
});

describe('Section ranking', () => {
  let svc;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });
  it('student with higher average gets rank 1', async () => {
    const ts=[{id:10,subjectId:1}];
    const fins=[{teacherSubjectId:10,status:'FINALIZED'}];
    const comps=[{gradeComponentId:100,teacherSubjectId:10,maxMarks:100}];
    base(CL9A,[C1],[STU1,STU2],{status:'FINALIZED',finalizedAt:new Date()});
    prisma.student.count.mockResolvedValue(2);
    prisma.teacherSubject.findMany.mockResolvedValue(ts);
    prisma.subjectFinalization.findMany.mockResolvedValue(fins);
    prisma.gradeComponent.findMany.mockResolvedValue(comps);
    prisma.gradeEntry.findMany.mockResolvedValue([
      {gradeComponentId:100,studentId:101,score:80},
      {gradeComponentId:100,studentId:102,score:65},
    ]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    const alice = r.students.find(s=>s.studentId===101);
    const bob   = r.students.find(s=>s.studentId===102);
    expect(alice.sectionRank).toBe(1);
    expect(bob.sectionRank).toBe(2);
  });
  it('tied averages share the same rank (competition ranking)', async () => {
    const ts=[{id:10,subjectId:1}];
    const fins=[{teacherSubjectId:10,status:'FINALIZED'}];
    const comps=[{gradeComponentId:100,teacherSubjectId:10,maxMarks:100}];
    base(CL9A,[C1],[STU1,STU2],{status:'FINALIZED',finalizedAt:new Date()});
    prisma.student.count.mockResolvedValue(2);
    prisma.teacherSubject.findMany.mockResolvedValue(ts);
    prisma.subjectFinalization.findMany.mockResolvedValue(fins);
    prisma.gradeComponent.findMany.mockResolvedValue(comps);
    prisma.gradeEntry.findMany.mockResolvedValue([
      {gradeComponentId:100,studentId:101,score:75},
      {gradeComponentId:100,studentId:102,score:75},
    ]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    const alice = r.students.find(s=>s.studentId===101);
    const bob   = r.students.find(s=>s.studentId===102);
    expect(alice.sectionRank).toBe(bob.sectionRank);
    expect(alice.sectionRank).toBe(1);
  });
  it('PENDING student gets null rank', async () => {
    base(CL9A,[C1],[STU1],null);
    prisma.teacherSubject.findMany.mockResolvedValue([]);
    prisma.subjectFinalization.findMany.mockResolvedValue([]);
    prisma.gradeComponent.findMany.mockResolvedValue([]);
    prisma.gradeEntry.findMany.mockResolvedValue([]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    expect(r.students[0].sectionRank).toBeNull();
  });
  it('FAIL student still receives a section rank', async () => {
    const ts=[{id:10,subjectId:1}];
    const fins=[{teacherSubjectId:10,status:'FINALIZED'}];
    const comps=[{gradeComponentId:100,teacherSubjectId:10,maxMarks:100}];
    base(CL9A,[C1],[STU1],{status:'FINALIZED',finalizedAt:new Date()});
    prisma.student.count.mockResolvedValue(1);
    prisma.teacherSubject.findMany.mockResolvedValue(ts);
    prisma.subjectFinalization.findMany.mockResolvedValue(fins);
    prisma.gradeComponent.findMany.mockResolvedValue(comps);
    prisma.gradeEntry.findMany.mockResolvedValue([{gradeComponentId:100,studentId:101,score:30}]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    expect(r.students[0].academicStatus).toBe('FAIL');
    expect(r.students[0].sectionRank).toBe(1);
  });
  it('section metadata: each student row includes classroomId', async () => {
    withScoresForBoth([C1],[STU1],[75],[70]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.metadata.classroomId).toBe(1);
    expect(r.metadata.totalStudents).toBe(1);
  });
});
`;

const existing = fs.readFileSync(p, 'utf8');
fs.writeFileSync(p, existing + block, 'utf8');
console.log('done:', fs.statSync(p).size);
