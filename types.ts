
export type Role = string; // Chuyển từ Union Type sang string để hỗ trợ role động

export type AppTheme = 'DOAN';

/**
 * 12 quyền của hệ thống. Mỗi vai trò bật/tắt từng quyền trong Thiết lập → Vai trò.
 * Quyền được thực thi ở cả giao diện lẫn tầng dữ liệu (xem firestore.rules).
 */
export interface RolePermissions {
  /** Chấm lỗi hằng ngày */
  entryViolation: boolean;
  /** Nhập điểm cộng, thành tích hoạt động — tách hẳn khỏi ghi vi phạm */
  entryAchievement: boolean;
  /** Tải mẫu và nhập hàng loạt từ Excel */
  importExcel: boolean;
  /** Sửa hoặc xoá bản ghi do người khác nhập (không có thì chỉ sửa được của mình) */
  editOthers: boolean;
  /** Chọn nhiều dòng rồi xoá một lượt */
  bulkDelete: boolean;
  /** Thấy tên người nhập liệu, thay vì hiện "Ẩn danh" */
  seeReporter: boolean;
  /** Bị giới hạn chỉ xem lớp mình phụ trách */
  ownClassOnly: boolean;
  /** Lọc bản ghi trùng lặp và bản ghi ngoài mốc thời gian */
  moderation: boolean;
  /** Lớp, học sinh, tiêu chí, mốc thời gian */
  manageCatalog: boolean;
  /** Cấp, khoá, đổi vai trò, gửi lại mật khẩu */
  manageAccounts: boolean;
  /** Phân công trực và cờ đỏ */
  manageTaskforce: boolean;
  /** Xem nhật ký và đổi thương hiệu nhà trường */
  manageSystem: boolean;
}

export type PermissionKey = keyof RolePermissions;

/**
 * Quy định riêng của từng trường — những thứ trước đây gán cứng trong mã nguồn.
 * Lưu ở settings/school, quản trị viên sửa trong Cấu hình → Quy định.
 */
export interface SchoolSettings {
  /** Điểm khởi đầu mỗi tuần của một lớp (mặc định 500) */
  baseScore: number;
  /** Hệ số nhân cho học kỳ II khi tính cả năm (1 = không nhân) */
  semester2Multiplier: number;
  /** Bắt buộc có ảnh minh chứng mới lưu được vi phạm */
  requirePhotoForViolation: boolean;
  /** Các khối lớp của trường, ví dụ ['10','11','12'] hoặc ['6','7','8','9'] */
  grades: string[];
  /** Danh sách giải thưởng dùng khi nhập khen thưởng */
  prizes: string[];
  /** Nhóm hoạt động */
  activityGroups: string[];
  /** Cấp độ hoạt động */
  activityLevels: string[];
  /**
   * Bảng điểm khen thưởng theo giải × cấp độ, ví dụ prizePoints['Nhất']['Cấp trường'] = 50.
   * Nhờ bảng này mà mỗi hoạt động mới không còn đẻ ra tiêu chí riêng nữa.
   */
  prizePoints: Record<string, Record<string, number>>;
  /** Tông màu nhận diện của trường */
  themePreset: string;
}

export interface RoleConfig extends RolePermissions {
  label: string;
  color: string;
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

