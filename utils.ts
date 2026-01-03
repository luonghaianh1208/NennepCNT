
import { RoleConfig, ClassEntity, Student, Criteria, User, Violation, TimeConfig } from './types';

// Đổi tên thành INITIAL_... để làm giá trị khởi tạo cho State
export const INITIAL_ROLE_DEFINITIONS: Record<string, RoleConfig> = {
  ADMIN: { label: 'Quản trị viên', color: 'blue', canEntry: true, isAdmin: true },
  BCH: { label: 'Ban Chấp Hành', color: 'purple', canEntry: true, isAdmin: false },
  RED_FLAG: { label: 'Cờ đỏ', color: 'red', canEntry: true, isAdmin: false },
  DISCIPLINE: { label: 'Nền nếp', color: 'orange', canEntry: true, isAdmin: false },
  TEACHER: { label: 'Giáo viên CN', color: 'green', canEntry: false, isAdmin: false },
  LEADER: { label: 'Lãnh đạo', color: 'indigo', canEntry: false, isAdmin: true },
  GUEST: { label: 'Khách', color: 'gray', canEntry: false, isAdmin: false },
};

export const MOCK_CLASSES: ClassEntity[] = [
  { id: '10A1', name: '10A1', grade: 10, homeroomTeacher: 'Cô Lan' },
  { id: '10A2', name: '10A2', grade: 10, homeroomTeacher: 'Thầy Hùng' },
];

export const MOCK_STUDENTS: Student[] = [
  { id: 'S1', name: 'Nguyễn Văn A', classId: '10A1' },
  { id: 'S2', name: 'Trần Thị B', classId: '10A1' },
];

export const MOCK_CRITERIA: Criteria[] = [
  { id: 'C1', content: 'Đi học muộn', points: 5, type: 'MINUS' },
  { id: 'C2', content: 'Không đeo khăn quàng/phù hiệu', points: 2, type: 'MINUS' },
];

export const MOCK_USERS: User[] = [
  { id: 'U1', name: 'Administrator', username: 'admin', password: 'admin123', role: 'ADMIN', email: 'admin@school.edu' },
];

export const GUEST_USER: User = {
  id: 'GUEST',
  name: 'Khách',
  username: 'guest',
  role: 'GUEST',
};

export const INITIAL_TIME_CONFIGS: TimeConfig[] = [
  { id: 'M09', name: 'Tháng 09', type: 'MONTH', startDate: '2023-09-05', endDate: '2023-09-30' },
  { id: 'M10', name: 'Tháng 10', type: 'MONTH', startDate: '2023-10-01', endDate: '2023-10-31' },
  { id: 'HK1', name: 'Học kỳ I', type: 'SEMESTER', startDate: '2023-09-05', endDate: '2024-01-15' },
];

export const INITIAL_VIOLATIONS: Violation[] = [];

export const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

export const getUniqueWeeksCount = (startDateStr: string, endDateStr: string): number => {
    if (!startDateStr || !endDateStr) return 1;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const uniqueWeeks = new Set<string>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const weekNum = getWeekNumber(new Date(d));
        const year = d.getFullYear();
        uniqueWeeks.add(`${year}-W${weekNum}`);
    }
    return Math.max(1, uniqueWeeks.size);
};

export const calculateScore = (violations: Violation[], base = 500, weeksCount = 1, isRangeMode = false) => {
  const totalPoints = violations.reduce((sum, v) => sum + v.points, 0);
  if (isRangeMode) {
      const averagePenaltyPerWeek = totalPoints / weeksCount;
      const score = base - averagePenaltyPerWeek;
      return parseFloat(score.toFixed(2));
  } else {
      return parseFloat((base - totalPoints).toFixed(2));
  }
};

/**
 * Hàm phân tích dòng CSV, xử lý trường hợp có dấu phẩy trong ngoặc kép
 * Ví dụ: "Nguyen Van A", "Lop 10A1, 10A2", ...
 */
export const parseCSVLine = (text: string): string[] => {
    const re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    
    // Return empty array if input string is not well formed CSV string.
    if (!re_valid.test(text)) return text.split(',').map(s => s.trim()); // Fallback to simple split if regex fails
    
    const a = [];
    text.replace(re_value, function(m0, m1, m2, m3) {
        // Remove backslash from \' in single quoted values.
        if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        // Remove backslash from \" in double quoted values.
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        else if (m3 !== undefined) a.push(m3);
        return '';
    });
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
};
