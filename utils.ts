
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
  { id: 'W01', name: 'Tuần 1', type: 'WEEK', startDate: '2023-09-05', endDate: '2023-09-10' },
  { id: 'W02', name: 'Tuần 2', type: 'WEEK', startDate: '2023-09-11', endDate: '2023-09-17' },
  { id: 'M09', name: 'Tháng 09', type: 'MONTH', startDate: '2023-09-05', endDate: '2023-09-30' },
  { id: 'M10', name: 'Tháng 10', type: 'MONTH', startDate: '2023-10-01', endDate: '2023-10-31' },
  { id: 'HK1', name: 'Học kỳ I', type: 'SEMESTER', startDate: '2023-09-05', endDate: '2024-01-15' },
];

export const INITIAL_VIOLATIONS: Violation[] = [];

// Helper lấy ngày khai giảng (05/09) của năm học hiện tại
export const getSchoolYearStart = (): Date => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  // Nếu đang là tháng 1-8 thì năm học bắt đầu từ tháng 9 năm ngoái
  const startYear = currentMonth < 8 ? now.getFullYear() - 1 : now.getFullYear();
  return new Date(startYear, 8, 5); // 05/09
};

// --- START: DATE HANDLING HELPERS (LOCAL TIMEZONE STRICT) ---

// Chuyển string YYYY-MM-DD thành Date object vào lúc 00:00:00 giờ địa phương
const parseLocalStartOfDay = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // Xử lý chuỗi ISO full nếu có
    const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
        // new Date(y, m, d) tạo date theo giờ địa phương
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
    }
    return new Date(dateStr); // Fallback
};

// Chuyển string YYYY-MM-DD thành Date object vào lúc 23:59:59.999 giờ địa phương
const parseLocalEndOfDay = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
    }
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d;
};
// --- END: DATE HANDLING HELPERS ---


// Tìm ngày sớm nhất trong danh sách vi phạm
export const getEarliestViolationDate = (violations: Violation[]): Date => {
    if (!violations || violations.length === 0) return getSchoolYearStart();
    
    // Khởi tạo minDate bằng ngày của vi phạm đầu tiên
    let minDate = parseLocalStartOfDay(violations[0].date);

    for (const v of violations) {
        const d = parseLocalStartOfDay(v.date);
        if (d < minDate) minDate = d;
    }
    return minDate;
};

// Tìm ngày muộn nhất
export const getLatestViolationDate = (violations: Violation[]): Date => {
    if (!violations || violations.length === 0) return new Date();
    
    let maxDate = parseLocalEndOfDay(violations[0].date);

    for (const v of violations) {
        const d = parseLocalEndOfDay(v.date);
        if (d > maxDate) maxDate = d;
    }
    
    const now = new Date();
    return maxDate > now ? maxDate : now;
};

export const getWeekNumber = (d: Date) => {
  // Copy date để không ảnh hưởng biến gốc, chuyển về UTC để tính toán chuẩn ISO
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

// Helper để lấy định dạng YYYY-Www
export const getYearWeekKey = (d: Date) => {
    const w = getWeekNumber(d);
    const y = d.getFullYear();
    // Xử lý trường hợp tuần 1 rơi vào cuối năm trước hoặc tuần 52 rơi vào đầu năm sau
    // Tuy nhiên với mục đích thống kê đơn giản, ta dùng year của date gốc
    return `${y}-W${w.toString().padStart(2, '0')}`;
};

// Đếm số tuần duy nhất giữa 2 mốc thời gian (Bao gồm cả tuần bắt đầu và kết thúc)
export const getUniqueWeeksCount = (startDateStr: string | Date, endDateStr: string | Date): number => {
    if (!startDateStr || !endDateStr) return 1;

    // Chuyển đổi input về Date object chuẩn (Local Time)
    const start = typeof startDateStr === 'string' ? parseLocalStartOfDay(startDateStr) : startDateStr;
    const end = typeof endDateStr === 'string' ? parseLocalEndOfDay(endDateStr) : endDateStr;

    // Đảm bảo start <= end
    if (start > end) return 1;

    const uniqueWeeks = new Set<string>();
    const current = new Date(start); // Clone start để loop
    
    // Loop qua từng ngày để add week key
    // Vì end đã được set là 23:59:59 nên loop này sẽ bao gồm cả ngày cuối cùng
    while (current <= end) {
        uniqueWeeks.add(getYearWeekKey(current));
        current.setDate(current.getDate() + 1); // Tăng 1 ngày
    }
    
    return Math.max(1, uniqueWeeks.size);
};

// Kiểm tra xem một ngày có nằm trong khoảng không (Chính xác tuyệt đối theo Local Time)
export const isDateInRange = (targetDateStr: string, startStr: string, endStr: string): boolean => {
    if (!targetDateStr || !startStr || !endStr) return false;
    
    // Chuyển target về giữa ngày để so sánh an toàn, hoặc đầu ngày
    const target = parseLocalStartOfDay(targetDateStr).getTime();
    
    const start = parseLocalStartOfDay(startStr).getTime(); // 00:00:00 ngày bắt đầu
    const end = parseLocalEndOfDay(endStr).getTime();       // 23:59:59 ngày kết thúc

    // So sánh timestamp
    return target >= start && target <= end;
};

export const calculateScore = (violations: Violation[], base = 500, weeksCount = 1, isRangeMode = false) => {
  // Logic chuẩn toán học theo yêu cầu:
  // Công thức: (500 * Số_tuần - Tổng_trừ + Tổng_cộng) / Số_tuần
  
  const totalDelta = violations.reduce((sum, v) => sum + v.points, 0);
  const safeWeeks = Math.max(1, weeksCount);

  if (isRangeMode) {
      const averageDeltaPerWeek = totalDelta / safeWeeks;
      const score = base - averageDeltaPerWeek;
      return parseFloat(score.toFixed(2));
  } else {
      return parseFloat((base - totalDelta).toFixed(2));
  }
};

/**
 * Hàm phân tích dòng CSV
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
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    str = str.replace(/[^a-zA-Z0-9 ]/g, "");
    str = str.replace(/\s+/g, "_");
    return str;
};

export const safeParseImages = (imgField: string[] | string | undefined): string[] => {
    if (!imgField) return [];
    if (Array.isArray(imgField)) return imgField;
    try {
        if (typeof imgField === 'string' && imgField.startsWith('[')) {
            return JSON.parse(imgField);
        }
        if (typeof imgField === 'string') return [imgField];
    } catch (e) {
        console.error("Error parsing images", e);
        return [];
    }
    return [];
};

export const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
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
 * FIXED: Chuyển đổi mọi định dạng ngày tháng về chuỗi YYYY-MM-DD theo giờ địa phương (Local Time).
 * Khắc phục lỗi lệch ngày do Timezone khi Google trả về chuỗi ISO (VD: 2023-09-04T17:00:00Z -> 2023-09-05).
 */
export const formatDateForInput = (dateStr: string | Date | undefined): string => {
    if (!dateStr) return '';

    // Nếu đã là Date object
    if (dateStr instanceof Date) {
        const y = dateStr.getFullYear();
        const m = (dateStr.getMonth() + 1).toString().padStart(2, '0');
        const d = dateStr.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Nếu là string
    if (typeof dateStr === 'string') {
        // Nếu đã chuẩn YYYY-MM-DD thì giữ nguyên (tin tưởng dữ liệu người dùng nhập)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

        // Nếu là ISO string (có chứa T), parse ra Date rồi lấy Local Time
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }

    return '';
};
