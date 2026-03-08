
export type Role = string; // Chuyển từ Union Type sang string để hỗ trợ role động

export type AppTheme = 'WINTER' | 'TET';

export interface RoleConfig {
  label: string;
  color: string;
  canEntry: boolean;
  isAdmin: boolean; // Thêm quyền Admin
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: Role;
  className?: string;
  email?: string;
  summaryMeetings?: number; // Số lần xuống tổng kết thi đua
}

export interface ClassEntity {
  id: string;
  name: string;
  grade: number;
  homeroomTeacher: string;
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  bikeNumber?: string;
}

export interface Criteria {
  id: string;
  content: string;
  points: number;
  type: 'MINUS' | 'PLUS';
}

export interface Violation {
  id: string;
  date: string;
  classId: string;
  studentId?: string;
  criteriaId: string;
  points: number;
  note?: string;
  images?: string[];
  reportedBy: string;
  isSecurityReport: boolean;
  timestamp: number;
}

export interface TimeConfig {
  id: string;
  name: string;
  type: 'WEEK' | 'MONTH' | 'SEMESTER'; // Thêm WEEK vào type
  startDate: string;
  endDate: string;
}

// --- Audit Log ---
export type AuditAction =
  | 'DELETE_VIOLATION'
  | 'BULK_DELETE'
  | 'UPDATE_VIOLATION'
  | 'CREATE_VIOLATION'
  | 'SYNC_SETTINGS';

export interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  details: string;
  targetId?: string;
}

