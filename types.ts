
export type Role = string; // Chuyển từ Union Type sang string để hỗ trợ role động

export type AppTheme = 'DOAN';

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
  // Dành cho thành tích nhập theo hoạt động (một hoạt động — nhiều lớp)
  activityName?: string;
  activityGroup?: string;
  activityLevel?: string;
  participants?: number;
}

export interface TimeConfig {
  id: string;
  name: string;
  type: 'WEEK' | 'MONTH' | 'SEMESTER'; // Thêm WEEK vào type
  startDate: string;
  endDate: string;
}

// --- Audit Log ---
/**
 * Chỉ ghi nhật ký những việc mà bản thân dữ liệu không tự nói lên được:
 * mọi thao tác xoá, và việc thêm tiêu chí / mốc thời gian.
 * Ai nhập vi phạm hay thành tích thì đã nằm sẵn trong chính bản ghi đó.
 */
export type AuditAction =
  | 'DELETE_VIOLATION'
  | 'BULK_DELETE'
  | 'DELETE_CRITERIA'
  | 'DELETE_TIME_CONFIG'
  | 'DELETE_CLASS'
  | 'DELETE_STUDENT'
  | 'CREATE_CRITERIA'
  | 'CREATE_TIME_CONFIG'
  // Thao tác tài khoản do máy chủ ghi
  | 'CREATE_ACCOUNT'
  | 'IMPORT_ACCOUNTS'
  | 'RESET_PASSWORD'
  | 'SET_ACCOUNT_STATUS'
  | 'SET_ACCOUNT_ROLE'
  | 'DELETE_ACCOUNT';

export interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  details: string;
  targetId?: string;
  // Thông tin bản ghi vi phạm bị xóa
  violationId?: string;
  violationDate?: string;
  violationClass?: string;
  violationCriteria?: string;
  violationPoints?: number;
  // Hướng hiển thị (lấy từ server khi load)
  timeStr?: string;
}

