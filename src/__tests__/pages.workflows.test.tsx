/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.16 � Remaining Page Workflow Tests
 * Smoke-tests every major page: renders without crash, shows a heading/text.
 * DATABASE SAFETY: all hooks/APIs mocked � no real network or DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthenticatedUser } from "../types/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseAuth = vi.fn();
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("react-icons/md", () => { const i = () => <span />; return { MdVisibility:i,MdVisibilityOff:i,MdErrorOutline:i,MdSchool:i,MdAssessment:i,MdDescription:i,MdFactCheck:i,MdMenuBook:i,MdPrint:i,MdDownload:i,MdEmojiEvents:i,MdBarChart:i,MdSend:i,MdChat:i,MdInbox:i,MdArrowBack:i,MdPerson:i,MdAdd:i,MdDelete:i,MdEdit:i,MdCheck:i,MdClose:i,MdSearch:i,MdRefresh:i,MdWarning:i,MdWarningAmber:i,MdInfo:i,MdInfoOutline:i,MdCheckCircle:i,MdNotifications:i,MdLogout:i,MdMenu:i,MdSettings:i,MdBackup:i,MdRestore:i,MdUpload:i,MdHistory:i,MdPeople:i,MdClass:i,MdBook:i,MdAssignment:i,MdGrade:i,MdCheckBox:i,MdSchedule:i,MdTune:i,MdFilterList:i,MdSort:i,MdTableChart:i,MdPictureAsPdf:i,MdFileDownload:i,MdOpenInNew:i,MdMoreVert:i,MdExpandMore:i,MdExpandLess:i,MdArrowForward:i,MdLockReset:i,MdKey:i,MdAdminPanelSettings:i,MdVerified:i,MdBlock:i,MdEmail:i,MdPhone:i,MdBadge:i,MdCalendarToday:i,MdEvent:i,MdToday:i,MdAccessTime:i,MdCampaign:i,MdAnnouncement:i,MdStar:i,MdFlag:i,MdReport:i,MdDashboard:i,MdHome:i,MdTableRows:i,MdViewList:i,MdGridView:i,MdListAlt:i,MdTimeline:i,MdTrendingUp:i,MdTrendingDown:i,MdPercent:i,MdNumbers:i,MdFormatListBulleted:i,MdLock:i,MdLockOpen:i,MdOutlineEmail:i,MdVisibilityOutline:i }; });

vi.mock("../components/ui/LedgerRule",   () => ({ LedgerRule: () => <hr /> }));
vi.mock("../components/ui/EmptyState",   () => ({ EmptyState: ({ title }: { title: string }) => <div data-testid="empty">{title}</div> }));
vi.mock("../components/ui/Button",       () => ({ Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button> }));
vi.mock("../components/ui/Badge",        () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("../components/ui/Card",         () => ({ Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, StatCard: ({ label, value }: { label: string; value: React.ReactNode }) => <div><span>{label}</span><span>{value}</span></div> }));
vi.mock("../components/ui/SelectField",  () => ({ SelectField: ({ label, children, value, onChange }: { label: string; children?: React.ReactNode; value?: string; onChange?: React.ChangeEventHandler<HTMLSelectElement> }) => <label><span>{label}</span><select aria-label={label} value={value} onChange={onChange}>{children}</select></label> }));
vi.mock("../components/ui/TextField",    () => ({ TextField: ({ label, value, onChange, placeholder }: { label?: string; value?: string; onChange?: React.ChangeEventHandler<HTMLInputElement>; placeholder?: string }) => <input aria-label={label ?? placeholder ?? "input"} value={value} onChange={onChange} /> }));
vi.mock("../components/ui/ConfirmDialog",() => ({ ConfirmDialog: () => null }));
vi.mock("../components/ui/Spinner",      () => ({ Spinner: () => <div data-testid="spinner" /> }));
vi.mock("../components/ui/Pagination",   () => ({ Pagination: () => null }));
vi.mock("../components/ui/Modal",        () => ({ Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => isOpen ? <div data-testid="modal">{children}</div> : null }));
vi.mock("../components/ui/Tabs",         () => ({ Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, TabList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Tab: ({ children }: { children: React.ReactNode }) => <button>{children}</button>, TabPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../components/ui/Table",        () => ({ Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table> }));

// Hook mocks � exact export names from each hooks file
vi.mock("../hooks/useNotifications",           () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useMyInbox: h, useMarkNotificationRead: h, useMarkAllNotificationsRead: h, useDeleteNotification: h, useSendToParents: h, useBroadcastNotification: h, useSentAnnouncements: h }; });
vi.mock("../hooks/useStudents",                () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useStudents: h, useStudent: h, useStudentEnrollmentHistory: h, useCreateStudent: h, useBulkImportStudents: h, useTransferOutStudent: h, useMyStudentProfile: h }; });
vi.mock("../hooks/useAttendance",              () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useClassroomAttendance: h, useMarkBulkAttendance: h, useMyAttendanceHistory: h, useStudentAttendanceSummary: h, useStudentAttendanceHistory: h }; });
vi.mock("../hooks/useFinalization",            () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useSubmitForReview: h, useReviewSubject: h, useFinalizeSubject: h, useFinalizeClassroom: h, useSubjectFinalization: h, useClassroomFinalization: h, useClassroomSubjectFinalizations: h, useCorrectSubjectFinalization: h, useCorrectClassroomFinalization: h }; });
vi.mock("../hooks/useAcademicRegister",        () => { const h = () => ({ data: undefined, isLoading: false }); return { useAcademicRegister: h, useGradeRegister: h }; });
vi.mock("../hooks/useUsers",                   () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useUsers: h, useCreateStaff: h, useUpdateUserStatus: h, useResetUserPassword: h, useUserPermissions: h, useGrantPermission: h, useRevokePermission: h, useOfficeHolders: h, useReplaceOfficeHolder: h }; });
vi.mock("../hooks/useClassrooms",              () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useClassroomOptions: h, useClassrooms: h, useCreateClassroom: h, useDeleteClassroom: h }; });
vi.mock("../hooks/useSubjects",                () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useSubjectOptions: h, useSubjects: h, useCreateSubject: h, useDeleteSubject: h }; });
vi.mock("../hooks/usePromotion",               () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { usePromotionBatches: h, usePromotionBatch: h, useStudentEnrollmentHistory: h, useCreatePromotionBatch: h, useUpdatePromotionEntry: h, useBulkAssignClassroom: h, useSubmitPromotionBatch: h, useApprovePromotionBatch: h, useRejectPromotionBatch: h, useCorrectPromotionEntry: h }; });
vi.mock("../hooks/useHomework",                () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useMyHomeworkAsTeacher: h, useMyHomeworkAsStudent: h, useHomeworkSubmissions: h, useCreateHomework: h, useUpdateHomeworkSubmissionStatus: h, useMarkMyHomeworkSubmission: h, useDeleteHomework: h }; });
vi.mock("../hooks/useAcademicReports",         () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve() }); return { useGenerateClassroomReports: h, useMyAcademicReports: h, useStudentReportHistory: h, useMyTranscript: h, useStudentTranscript: h, useMyReportCard: h, useStudentReportCard: h }; });
vi.mock("../hooks/useGrades",                  () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useGradeScheme: h, useCreateGradeComponent: h, useDeleteGradeComponent: h, useComponentRoster: h, useRecordComponentEntries: h, useClassroomTotals: h, useMyGrades: h, useStudentGrades: h, useReleaseGradeComponent: h }; });
vi.mock("../hooks/useDashboardData",           () => { const h = () => ({ data: undefined, isLoading: false }); return { useMyTeachingAssignments: h, useMyAttendanceSummary: h, useMyParentProfile: h, useMyAttendanceTrend: h, useChildAttendanceSummary: h, useChildAttendanceTrend: h, useTodaysAttendanceStatus: h, useTeacherAttendanceSummary: h, useTeacherGradeDistribution: h }; });
vi.mock("../hooks/useDashboardStats",          () => { const h = () => ({ data: undefined, isLoading: false }); return { useAdminDashboard: h, useDirectorDashboard: h, useViceDirectorDashboard: h }; });
vi.mock("../hooks/useBackups",                 () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useBackups: h, useCreateBackup: h, useUploadBackup: h, useRestoreBackup: h, useDeleteBackup: h }; });
vi.mock("../hooks/useSystemSettings",          () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useSystemSettings: h, useUpdateSystemSettings: h }; });
vi.mock("../hooks/useAuditLogs",               () => { const h = () => ({ data: undefined, isLoading: false }); return { useAuditLogs: h }; });
vi.mock("../hooks/useDiscipline",              () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useDisciplineRecords: h, useCreateDisciplineRecord: h, useUpdateDisciplineRecord: h }; });
vi.mock("../hooks/useConduct",                 () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useUpsertConduct: h, useUpdateConduct: h, useStudentConduct: h, useClassroomConducts: h, useClassroomConductSummary: h, useDeleteConduct: h }; });
vi.mock("../hooks/useParents",                 () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useParents: h, useCreateParent: h, useMyParentProfile: h }; });
vi.mock("../hooks/useTeacherSubjects",         () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useAssignments: h, useCreateAssignment: h, useDeleteAssignment: h }; });
vi.mock("../hooks/useMyClassrooms",            () => { const h = () => ({ data: undefined, isLoading: false }); return { useMyClassrooms: h }; });
vi.mock("../hooks/useTimetable",               () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useMyTimetable: h, useTimetable: h, useCreateTimetableEntry: h, useDeleteTimetableEntry: h, usePublishTimetableEntry: h }; });
vi.mock("../hooks/useTeacherOptions",          () => { const h = () => ({ data: undefined, isLoading: false }); return { useTeacherOptions: h }; });
vi.mock("../hooks/useGradeSubjectConfig",      () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useConfiguredGrades: h, useGradeSubjectConfig: h, useUpsertGradeSubjectConfig: h, useRemoveGradeSubjectConfig: h, useCopyFromYear: h }; });
vi.mock("../hooks/useMessaging",               () => { const h = () => ({ data: undefined, isLoading: false, mutateAsync: () => Promise.resolve(), mutate: () => {} }); return { useMessageThreads: h, useMessageThread: h, useReplyToMessage: h, useSendMessage: h, useEligibleTeachers: h }; });
vi.mock("../hooks/useUnreadNotificationCount", () => ({ useUnreadNotificationCount: () => ({ data: 0, isLoading: false }) }));

// API mocks
vi.mock("../lib/auth-api",            () => ({ authApi: { getProfile: () => Promise.resolve(null), me: () => Promise.resolve(null), login: () => Promise.resolve(null), logout: () => Promise.resolve(null) } }));
vi.mock("../lib/system-settings-api", () => ({ systemSettingsApi: { get: () => Promise.resolve(null) } }));
vi.mock("../lib/students-api",        () => ({ studentsApi: { getById: () => Promise.resolve(null), list: () => Promise.resolve([]) } }));
vi.mock("../lib/grades-api",          () => ({ gradesApi: { getMyGrades: () => Promise.resolve([]) } }));
vi.mock("../lib/report-card-html",    () => ({ buildReportCardHtml: () => "<html>" }));

// Modal stubs
vi.mock("../pages/students/NewAdmissionModal",        () => ({ NewAdmissionModal: () => null }));
vi.mock("../pages/students/BulkImportModal",          () => ({ BulkImportModal: () => null }));
vi.mock("../pages/students/StudentDetailModal",       () => ({ StudentDetailModal: () => null }));
vi.mock("../pages/students/ClassCredentialsModal",    () => ({ ClassCredentialsModal: () => null }));
vi.mock("../pages/students/TransferOutModal",         () => ({ TransferOutModal: () => null }));
vi.mock("../pages/students/MessageParentsModal",      () => ({ MessageParentsModal: () => null }));
vi.mock("../pages/students/TransferAdmissionModal",   () => ({ TransferAdmissionModal: () => null }));
vi.mock("../pages/classrooms/CreateClassroomModal",   () => ({ CreateClassroomModal: () => null }));
vi.mock("../pages/subjects/CreateSubjectModal",       () => ({ CreateSubjectModal: () => null }));
vi.mock("../pages/parents/CreateParentModal",         () => ({ CreateParentModal: () => null }));
vi.mock("../pages/teacher-subjects/CreateAssignmentModal", () => ({ CreateAssignmentModal: () => null }));
vi.mock("../pages/homework/CreateHomeworkModal",      () => ({ CreateHomeworkModal: () => null }));
vi.mock("../pages/homework/HomeworkSubmissionsModal", () => ({ HomeworkSubmissionsModal: () => null }));
vi.mock("../pages/notifications/ComposeAnnouncementModal", () => ({ ComposeAnnouncementModal: () => null }));
vi.mock("../pages/my-classes/StudentProfileModal",    () => ({ StudentProfileModal: () => null }));
vi.mock("../pages/timetable-admin/AddTimetableEntryModal", () => ({ AddTimetableEntryModal: () => null }));
vi.mock("../pages/timetable-admin/TimetableMatrixTable",   () => ({ TimetableMatrixTable: () => <table /> }));
vi.mock("../pages/users/UserPermissionsModal",        () => ({ UserPermissionsModal: () => null }));
vi.mock("../pages/promotion/PromotionBatchPage",      () => ({ PromotionBatchPage: () => <div data-testid="batch-page" /> }));
vi.mock("../pages/promotion/PromotionApprovePage",    () => ({ PromotionApprovePage: () => <div data-testid="approve-page" /> }));

// -- Helpers -------------------------------------------------------------------

function makeUser(role: AuthenticatedUser["role"] = "DIRECTOR"): AuthenticatedUser {
  return { userId: 1, username: "u", email: null, role, status: "ACTIVE", permissions: [], isTemporaryPassword: false, profilePicture: null, fullName: "Test User" };
}
function setUser(role: AuthenticatedUser["role"] = "DIRECTOR") {
  mockUseAuth.mockReturnValue({ user: makeUser(role), isLoading: false, login: vi.fn(), logout: vi.fn() });
}
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrap(element: React.ReactElement) {
  return render(<QueryClientProvider client={qc}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
}
function hasContent() {
  return document.body.textContent!.trim().length > 5;
}

// -- Page imports --------------------------------------------------------------

import { NotificationsPage }      from "../pages/notifications/NotificationsPage";
import { StudentsPage }           from "../pages/students/StudentsPage";
import { AttendancePage }         from "../pages/attendance/AttendancePage";
import { FinalizationPage }       from "../pages/finalization/FinalizationPage";
import { AcademicRegisterPage }   from "../pages/academic-register/AcademicRegisterPage";
import { ProfilePage }            from "../pages/profile/ProfilePage";
import { ClassroomsPage }         from "../pages/classrooms/ClassroomsPage";
import { SubjectsPage }           from "../pages/subjects/SubjectsPage";
import { UsersPage }              from "../pages/users/UsersPage";
import { PromotionPage }          from "../pages/promotion/PromotionPage";
import { TeacherHomeworkPage }    from "../pages/homework/TeacherHomeworkPage";
import { StudentHomeworkPage }    from "../pages/my-homework/StudentHomeworkPage";
import { MyAttendancePage }       from "../pages/my-attendance/MyAttendancePage";
import { MyClassesPage }          from "../pages/my-classes/MyClassesPage";
import { AnnouncementsPage }      from "../pages/announcements/AnnouncementsPage";
import { BackupRestorePage }      from "../pages/backups/BackupRestorePage";
import { SystemSettingsPage }     from "../pages/system-settings/SystemSettingsPage";
import { AuditLogsPage }          from "../pages/audit-logs/AuditLogsPage";
import { DisciplineRecordsPage }  from "../pages/discipline/DisciplineRecordsPage";
import { ConductPage }            from "../pages/conduct/ConductPage";

// -- Smoke test suite ----------------------------------------------------------

type PageDef = { name: string; El: React.ComponentType; role: AuthenticatedUser["role"] };

const PAGES: PageDef[] = [
  { name: "NotificationsPage",     El: NotificationsPage,     role: "DIRECTOR" },
  { name: "StudentsPage",          El: StudentsPage,          role: "DIRECTOR" },
  { name: "AttendancePage",        El: AttendancePage,        role: "TEACHER"  },
  { name: "FinalizationPage",      El: FinalizationPage,      role: "DIRECTOR" },
  { name: "AcademicRegisterPage",  El: AcademicRegisterPage,  role: "DIRECTOR" },
  { name: "ProfilePage",           El: ProfilePage,           role: "TEACHER"  },
  { name: "ClassroomsPage",        El: ClassroomsPage,        role: "DIRECTOR" },
  { name: "SubjectsPage",          El: SubjectsPage,          role: "DIRECTOR" },
  { name: "UsersPage",             El: UsersPage,             role: "ADMIN"    },
  { name: "PromotionPage",         El: PromotionPage,         role: "DIRECTOR" },
  { name: "TeacherHomeworkPage",   El: TeacherHomeworkPage,   role: "TEACHER"  },
  { name: "StudentHomeworkPage",   El: StudentHomeworkPage,   role: "STUDENT"  },
  { name: "MyAttendancePage",      El: MyAttendancePage,      role: "STUDENT"  },
  { name: "MyClassesPage",         El: MyClassesPage,         role: "TEACHER"  },
  { name: "AnnouncementsPage",     El: AnnouncementsPage,     role: "DIRECTOR" },
  { name: "BackupRestorePage",     El: BackupRestorePage,     role: "ADMIN"    },
  { name: "SystemSettingsPage",    El: SystemSettingsPage,    role: "ADMIN"    },
  { name: "AuditLogsPage",         El: AuditLogsPage,         role: "ADMIN"    },
  { name: "DisciplineRecordsPage", El: DisciplineRecordsPage, role: "DIRECTOR" },
  { name: "ConductPage",           El: ConductPage,           role: "DIRECTOR" },
];

describe("Page smoke tests � render without crash", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const { name, El, role } of PAGES) {
    it(`${name} renders for ${role}`, () => {
      setUser(role);
      wrap(<El />);
      expect(hasContent()).toBe(true);
    });
  }
});

// -- Heading keyword tests -----------------------------------------------------

describe("Page headings and keywords", () => {
  beforeEach(() => vi.clearAllMocks());

  const HEADING_CHECKS: Array<{ name: string; El: React.ComponentType; role: AuthenticatedUser["role"]; keywords: string[] }> = [
    { name: "NotificationsPage",     El: NotificationsPage,     role: "DIRECTOR", keywords: ["notification","inbox","announcement"] },
    { name: "StudentsPage",          El: StudentsPage,          role: "DIRECTOR", keywords: ["student"] },
    { name: "AttendancePage",        El: AttendancePage,        role: "TEACHER",  keywords: ["attendance","mark"] },
    { name: "FinalizationPage",      El: FinalizationPage,      role: "DIRECTOR", keywords: ["finali","result","subject"] },
    { name: "AcademicRegisterPage",  El: AcademicRegisterPage,  role: "DIRECTOR", keywords: ["register","academic","grade"] },
    { name: "ProfilePage",           El: ProfilePage,           role: "TEACHER",  keywords: ["profile","account","password","setting"] },
    { name: "ClassroomsPage",        El: ClassroomsPage,        role: "DIRECTOR", keywords: ["classroom","class"] },
    { name: "SubjectsPage",          El: SubjectsPage,          role: "DIRECTOR", keywords: ["subject"] },
    { name: "UsersPage",             El: UsersPage,             role: "ADMIN",    keywords: ["user","staff","account"] },
    { name: "PromotionPage",         El: PromotionPage,         role: "DIRECTOR", keywords: ["promotion","batch"] },
    { name: "TeacherHomeworkPage",   El: TeacherHomeworkPage,   role: "TEACHER",  keywords: ["homework","assignment"] },
    { name: "StudentHomeworkPage",   El: StudentHomeworkPage,   role: "STUDENT",  keywords: ["homework","assignment"] },
    { name: "MyAttendancePage",      El: MyAttendancePage,      role: "STUDENT",  keywords: ["attendance"] },
    { name: "MyClassesPage",         El: MyClassesPage,         role: "TEACHER",  keywords: ["class","student","roster"] },
    { name: "AnnouncementsPage",     El: AnnouncementsPage,     role: "DIRECTOR", keywords: ["announcement","broadcast","notification"] },
    { name: "BackupRestorePage",     El: BackupRestorePage,     role: "ADMIN",    keywords: ["backup","restore"] },
    { name: "SystemSettingsPage",    El: SystemSettingsPage,    role: "ADMIN",    keywords: ["setting","system","school"] },
    { name: "AuditLogsPage",         El: AuditLogsPage,         role: "ADMIN",    keywords: ["audit","log","activity"] },
    { name: "DisciplineRecordsPage", El: DisciplineRecordsPage, role: "DIRECTOR", keywords: ["discipline","incident","record"] },
    { name: "ConductPage",           El: ConductPage,           role: "DIRECTOR", keywords: ["conduct","rating","behaviour","classroom"] },
  ];

  for (const { name, El, role, keywords } of HEADING_CHECKS) {
    it(`${name} contains expected keyword`, () => {
      setUser(role);
      wrap(<El />);
      const body = document.body.textContent?.toLowerCase() ?? "";
      const found = keywords.some(k => body.includes(k));
      expect(found, `Expected one of [${keywords.join(",")}] in ${name}`).toBe(true);
    });
  }
});
