
import { RoleConfig, ClassEntity, Student, Criteria, User, Violation, TimeConfig } from './types';

// Đổi tên thành INITIAL_... để làm giá trị khởi tạo cho State
export const INITIAL_ROLE_DEFINITIONS: Record<string, RoleConfig> = {
  ADMIN: { label: 'Quản trị viên', color: 'blue', canEntry: true, isAdmin: true },
  BCH: { label: 'Ban Chấp Hành', color: 'purple', canEntry: true, isAdmin: false },
  BCH_PHU_TRACH: { label: 'BCH Phụ trách NN', color: 'indigo', canEntry: true, isAdmin: false },
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
 */
export const parseCSVLine = (text: string): string[] => {
    const re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    
    if (!re_valid.test(text)) return text.split(',').map(s => s.trim());
    
    const a = [];
    text.replace(re_value, function(m0, m1, m2, m3) {
        if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        else if (m3 !== undefined) a.push(m3);
        return '';
    });
    if (/,\s*$/.test(text)) a.push('');
    return a;
};

/**
 * Xóa dấu tiếng Việt và ký tự đặc biệt để tạo filename an toàn
 */
export const removeVietnameseTones = (str: string) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    // Some system encode vietnamese combining accent as individual utf-8 characters
    // \u0300, \u0301, \u0303, \u0309, \u0323
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
    // Remove extra spaces and special characters
    str = str.replace(/[^a-zA-Z0-9 ]/g, "");
    str = str.replace(/\s+/g, "_");
    return str;
};

/**
 * Parse image field safely from DB which might be a JSON string or Array
 */
export const safeParseImages = (imgField: string[] | string | undefined): string[] => {
    if (!imgField) return [];
    if (Array.isArray(imgField)) return imgField;
    try {
        // If it's a string looking like JSON array
        if (typeof imgField === 'string' && imgField.startsWith('[')) {
            return JSON.parse(imgField);
        }
        // If it's just a single string url
        if (typeof imgField === 'string') return [imgField];
    } catch (e) {
        console.error("Error parsing images", e);
        return [];
    }
    return [];
};

/**
 * Chuyển ngày (ISO/Date string) thành DD/MM/YYYY để hiển thị đẹp
 */
export const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        // Handle ISO string like 2026-01-02T17:00:00.000Z or just YYYY-MM-DD
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
};

/**
 * Chuyển ngày bất kỳ về YYYY-MM-DD (Local Time) để đưa vào input[type="date"]
 * Fix lỗi: 2026-01-02T17:00:00.000Z (UTC) -> 2026-01-03 (VN) thay vì bị cắt thành 2026-01-02
 */
export const formatDateForInput = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        // Sử dụng local time để lấy ngày tháng năm chính xác theo múi giờ người dùng
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        return '';
    }
};
