import type { RoleName } from '../types/auth';
import type { IconType } from 'react-icons';
import {
  MdDashboard, MdPeople, MdAdminPanelSettings, MdSettings, MdHistory,
  MdBackup, MdMeetingRoom, MdMenuBook, MdAssignment,
  MdSchedule, MdFactCheck, MdAssessment, MdDescription,
  MdTrendingUp, MdGavel, MdCampaign, MdNotifications,
  MdAccountCircle, MdLogout, MdUpgrade,
} from 'react-icons/md';
import { FaUserGraduate, FaChalkboardTeacher, FaUsers } from 'react-icons/fa';

export interface NavItem {
  label: string;
  path: string;
  allowedRoles?: RoleName[]; // omitted = visible to every authenticated role
  requiredPermission?: string; // if user has this permission, they bypass allowedRoles
  icon: IconType;
  isLogout?: boolean;         // rendered as a button instead of a link
}

// School-management oversight roles (Director + Vice Director).
// ADMIN is excluded — system admin handles technical concerns, not school ops.
const SCHOOL_MGMT: RoleName[] = ['DIRECTOR', 'VICE_DIRECTOR'];

export const NAV_ITEMS: NavItem[] = [
  // ── Universal ──────────────────────────────────────────────────────────────
  { label: 'Dashboard', path: '/', icon: MdDashboard },

  // ── System Administrator only ───────────────────────────────────────────────
  { label: 'Staff Accounts',            path: '/users',           allowedRoles: ['ADMIN'], icon: MdPeople },
  { label: 'User Roles & Permissions',  path: '/users',           allowedRoles: ['ADMIN'], icon: MdAdminPanelSettings },
  { label: 'System Settings',           path: '/system-settings', allowedRoles: ['ADMIN'], icon: MdSettings },
  { label: 'Audit Logs',                path: '/audit-logs',      allowedRoles: ['ADMIN'], icon: MdHistory },
  { label: 'Backup & Restore',          path: '/backups',         allowedRoles: ['ADMIN'], icon: MdBackup },

  // ── Director + Vice Director (school management) ────────────────────────────
  { label: 'Students',             path: '/students',             allowedRoles: SCHOOL_MGMT, requiredPermission: 'students:view', icon: FaUserGraduate },
  { label: 'Teachers',             path: '/teachers',             allowedRoles: SCHOOL_MGMT, icon: FaChalkboardTeacher },
  // Parents: Director only (Vice Director does not manage parent accounts)
  { label: 'Parents',              path: '/parents',              allowedRoles: ['DIRECTOR'], icon: FaUsers },
  { label: 'Classrooms',           path: '/classrooms',           allowedRoles: SCHOOL_MGMT, icon: MdMeetingRoom },
  { label: 'Subjects',             path: '/subjects',             allowedRoles: SCHOOL_MGMT, icon: MdMenuBook },
  { label: 'Teaching Assignments', path: '/teaching-assignments', allowedRoles: SCHOOL_MGMT, icon: MdAssignment },
  { label: 'Class Timetable',      path: '/timetable-admin',      allowedRoles: SCHOOL_MGMT, icon: MdSchedule },
  { label: 'Attendance',           path: '/attendance',           allowedRoles: SCHOOL_MGMT, icon: MdFactCheck },
  { label: 'Attendance Reports',   path: '/attendance-reports',   allowedRoles: SCHOOL_MGMT, icon: MdAssessment },
  { label: 'Academic Reports',     path: '/academic-reports',     allowedRoles: SCHOOL_MGMT, icon: MdDescription },
  { label: 'Academic Register',   path: '/academic-register',   allowedRoles: [...SCHOOL_MGMT, 'ADMIN'], icon: MdMenuBook },
  { label: 'Results Finalization', path: '/finalization',         allowedRoles: [...SCHOOL_MGMT, 'TEACHER', 'ADMIN'], icon: MdFactCheck },
  { label: 'Student Conduct',     path: '/conduct',             allowedRoles: SCHOOL_MGMT, icon: MdGavel },
  { label: 'School Performance',   path: '/school-performance',   allowedRoles: SCHOOL_MGMT, icon: MdTrendingUp },
  { label: 'Discipline Records',   path: '/discipline-records',   allowedRoles: [...SCHOOL_MGMT, 'TEACHER'], icon: MdGavel },
  { label: 'Announcements',        path: '/announcements',        allowedRoles: SCHOOL_MGMT, icon: MdCampaign },
  { label: 'Student Promotion',    path: '/promotion',            allowedRoles: SCHOOL_MGMT, icon: MdUpgrade },

  // ── Teacher ─────────────────────────────────────────────────────────────────
  { label: 'My Classes',           path: '/my-classes',    allowedRoles: ['TEACHER'], icon: MdMeetingRoom },
  { label: 'Class Timetable',      path: '/timetable',     allowedRoles: ['TEACHER'], icon: MdSchedule },
  { label: 'Take Attendance',      path: '/attendance',    allowedRoles: ['TEACHER'], icon: MdFactCheck },
  { label: 'Enter Grades',         path: '/grades',        allowedRoles: ['TEACHER'], icon: MdDescription },
  { label: 'Assignments',          path: '/homework',      allowedRoles: ['TEACHER'], icon: MdAssignment },

  // ── Student ──────────────────────────────────────────────────────────────────
  { label: 'My Timetable',         path: '/timetable',     allowedRoles: ['STUDENT'], icon: MdSchedule },
  { label: 'My Attendance',        path: '/my-attendance', allowedRoles: ['STUDENT'], icon: MdFactCheck },
  { label: 'My Grades',            path: '/my-grades',     allowedRoles: ['STUDENT'], icon: MdDescription },
  { label: 'Transcript',           path: '/transcript',    allowedRoles: ['STUDENT'], icon: MdMenuBook },
  { label: 'Assignments',          path: '/my-homework',   allowedRoles: ['STUDENT'], icon: MdAssignment },

  // ── Universal bottom items ───────────────────────────────────────────────────
  { label: 'Notifications', path: '/notifications', icon: MdNotifications },
  { label: 'My Profile',    path: '/profile',       icon: MdAccountCircle },
  { label: 'Logout',        path: '#logout',        icon: MdLogout, isLogout: true },
];

export function getVisibleNavItems(role: RoleName, userPermissions: string[] = []): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.allowedRoles) return true;
    if (item.allowedRoles.includes(role)) return true;
    if (item.requiredPermission && userPermissions.includes(item.requiredPermission)) return true;
    return false;
  });
}
