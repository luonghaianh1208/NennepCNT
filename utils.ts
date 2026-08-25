
import { RoleConfig, RolePermissions, PermissionKey, SchoolSettings, ClassEntity, Student, Criteria, User, Violation, TimeConfig } from './types';
// exceljs (~900KB) chỉ cần khi người dùng bấm xuất Excel → nạp động trong hàm,
// không kéo vào gói chính làm chậm lần mở app đầu tiên

// Đổi tên thành INITIAL_... để làm giá trị khởi tạo cho State
/**
 * Bốn tông màu nhận diện. Chỉ đổi phần "áo" của hệ thống — thanh tiêu đề, màn
 * hình chờ, trang giới thiệu. Màu cảnh báo (đỏ cho xoá, cho điểm trừ) giữ
 * nguyên vì đó là màu mang ý nghĩa, đổi đi thì người dùng đọc sai thông tin.
 */
export const THEME_PRESETS: Record<string, { label: string; from: string; to: string; accent: string }> = {
  DOAN:  { label: 'Đoàn (đỏ – vàng)', from: '#b91c1c', to: '#7f1d1d', accent: '#fde047' },
  BLUE:  { label: 'Xanh dương',       from: '#1d4ed8', to: '#1e3a8a', accent: '#fde047' },
  GREEN: { label: 'Xanh lá',          from: '#15803d', to: '#14532d', accent: '#fef08a' },
  PLUM:  { label: 'Tím than',         from: '#6d28d9', to: '#4c1d95', accent: '#fde047' },
};

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  baseScore: 500,
  semester2Multiplier: 2,
  requirePhotoForViolation: true,
  grades: ['10', '11', '12'],
  prizes: ['Nhất', 'Nhì', 'Ba', 'Khuyến khích', 'Tham gia'],
  activityGroups: ['Văn nghệ', 'Thể thao', 'Học tập', 'Phong trào', 'Khác'],
  activityLevels: ['Cấp trường', 'Cấp thành phố', 'Cấp tỉnh', 'Cấp quốc gia'],
  themePreset: 'DOAN',
};

/** Đưa tông màu vào biến CSS để mọi màn hình dùng chung */
export const applyTheme = (presetKey: string) => {
  const preset = THEME_PRESETS[presetKey] ?? THEME_PRESETS.DOAN;
  const root = document.documentElement;
  root.style.setProperty('--brand-from', preset.from);
  root.style.setProperty('--brand-to', preset.to);
  root.style.setProperty('--brand-accent', preset.accent);
};

/** Danh sách quyền kèm mô tả — dùng cho màn hình Vai trò và tài liệu hướng dẫn */
export const PERMISSION_GROUPS: {
  group: string;
  items: { key: PermissionKey; label: string; hint: string }[];
}[] = [
  {
    group: 'Nhập liệu',
    items: [
      { key: 'entryViolation', label: 'Ghi vi phạm', hint: 'Chấm lỗi hằng ngày, kèm ảnh minh chứng' },
      { key: 'entryAchievement', label: 'Ghi khen thưởng', hint: 'Nhập điểm cộng, thành tích hoạt động' },
      { key: 'importExcel', label: 'Nhập từ Excel', hint: 'Tải mẫu và nhập hàng loạt nhiều dòng' },
    ],
  },
  {
    group: 'Sửa và xoá',
    items: [
      { key: 'editOthers', label: 'Sửa/xoá bản ghi người khác', hint: 'Không có quyền này thì chỉ sửa được bản ghi của chính mình' },
      { key: 'bulkDelete', label: 'Xoá hàng loạt', hint: 'Chọn nhiều dòng rồi xoá một lượt' },
    ],
  },
  {
    group: 'Xem',
    items: [
      { key: 'seeReporter', label: 'Thấy tên người nhập', hint: 'Không có thì cột người ghi hiện "Ẩn danh"' },
      { key: 'ownClassOnly', label: 'Chỉ xem lớp phụ trách', hint: 'Bật lên là bị giới hạn trong lớp mình, không xem lớp khác' },
      { key: 'moderation', label: 'Công cụ kiểm duyệt', hint: 'Lọc bản ghi trùng lặp và bản ghi ngoài mốc thời gian' },
    ],
  },
  {
    group: 'Quản trị',
    items: [
      { key: 'manageCatalog', label: 'Quản lý danh mục', hint: 'Lớp, học sinh, tiêu chí, mốc thời gian' },
      { key: 'manageAccounts', label: 'Quản lý tài khoản', hint: 'Cấp, khoá, đổi vai trò, gửi lại mật khẩu' },
      { key: 'manageTaskforce', label: 'Phân công Ban Nề Nếp', hint: 'Sắp lịch trực, phân công cờ đỏ' },
      { key: 'manageSystem', label: 'Hệ thống', hint: 'Xem nhật ký và đổi thương hiệu nhà trường' },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

/** Vai trò mới tạo mặc định chưa có quyền gì */
export const EMPTY_PERMISSIONS: RolePermissions = {
  entryViolation: false, entryAchievement: false, importExcel: false,
  editOthers: false, bulkDelete: false,
  seeReporter: false, ownClassOnly: false, moderation: false,
  manageCatalog: false, manageAccounts: false, manageTaskforce: false, manageSystem: false,
};

const withPermissions = (label: string, color: string, granted: PermissionKey[]): RoleConfig => ({
  label,
  color,
  ...EMPTY_PERMISSIONS,
  ...Object.fromEntries(granted.map(k => [k, true])),
} as RoleConfig);

export const INITIAL_ROLE_DEFINITIONS: Record<string, RoleConfig> = {
  ADMIN: withPermissions('Quản trị viên', 'blue', ALL_PERMISSIONS.filter(p => p !== 'ownClassOnly')),
  LEADER: withPermissions('Lãnh đạo', 'indigo', ['seeReporter']),
  BCH_PHU_TRACH: withPermissions('BCH Phụ trách NN', 'indigo', [
    'entryViolation', 'entryAchievement', 'importExcel',
    'editOthers', 'bulkDelete', 'seeReporter', 'moderation', 'manageTaskforce',
  ]),
  BCH: withPermissions('Ban Chấp Hành', 'purple', ['entryViolation', 'entryAchievement', 'seeReporter']),
  RED_FLAG: withPermissions('Cờ đỏ', 'red', ['entryViolation', 'ownClassOnly']),
  DISCIPLINE: withPermissions('Nền nếp', 'orange', ['entryViolation', 'seeReporter', 'ownClassOnly']),
  TEACHER: withPermissions('Giáo viên CN', 'green', ['ownClassOnly']),
  GUEST: withPermissions('Khách', 'gray', []),
};

/** Vai trò này có quyền đó không */
export const can = (
  roleConfigs: Record<string, RoleConfig>,
  role: string | undefined,
  permission: PermissionKey,
): boolean => !!roleConfigs?.[String(role ?? '').toUpperCase()]?.[permission];

/** Có bất kỳ quyền quản trị nào thì mới vào được trang Thiết lập */
export const canOpenSettings = (roleConfigs: Record<string, RoleConfig>, role: string | undefined): boolean =>
  can(roleConfigs, role, 'manageCatalog') ||
  can(roleConfigs, role, 'manageAccounts') ||
  can(roleConfigs, role, 'manageTaskforce') ||
  can(roleConfigs, role, 'manageSystem');

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

/**
 * Lấy ngày hôm nay theo Local Time (Việt Nam, UTC+7) dưới dạng "YYYY-MM-DD".
 * KHÔNG dùng new Date().toISOString() vì trả về UTC, gây lệch ngày sau 17h giờ VN.
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};


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

// -----------------------------------------------------------------------
// computeRankingContext — SINGLE SOURCE OF TRUTH cho logic tính xếp hạng
// Dùng chung cho rankingData (hiển thị) và processExport (xuất Excel)
// -----------------------------------------------------------------------
export interface SemesterContext {
  violations: Violation[];
  weeksCount: number;
  name: string;
}

export interface RankingContext {
  relevantViolations: Violation[];
  weeksCount: number;
  isRangeMode: boolean;
  periodStr: string;
  weightedSemesters?: { hk1: SemesterContext; hk2: SemesterContext };
  isHK2?: boolean; // true khi đang chọn học kỳ 2 đơn lẻ → hiển thị điểm ×2
}

/**
 * So sánh cấu hình trước và sau khi lưu để biết cần ghi nhật ký những gì.
 *
 * Chủ trương: chỉ ghi việc XOÁ và việc THÊM tiêu chí / mốc thời gian. Ai nhập
 * vi phạm hay thành tích thì đã nằm sẵn trong chính bản ghi đó, ghi lại lần nữa
 * chỉ làm nhật ký dài ra mà không thêm thông tin.
 */
export interface ConfigSnapshot {
  criteria: Criteria[];
  timeConfigs: TimeConfig[];
  classes: ClassEntity[];
  students: Student[];
}

export interface ConfigChange {
  action: string;
  details: string;
  targetId?: string;
}

export const diffConfigChanges = (before: ConfigSnapshot, after: ConfigSnapshot): ConfigChange[] => {
  const ids = (list: { id: string }[]) => new Set(list.map(i => i.id));
  const changes: ConfigChange[] = [];

  const oldCriteria = ids(before.criteria);
  after.criteria.filter(c => !oldCriteria.has(c.id)).forEach(c =>
    changes.push({
      action: 'CREATE_CRITERIA',
      details: `Thêm tiêu chí "${c.content}" (${c.type === 'PLUS' ? '+' : '-'}${c.points}đ)`,
      targetId: c.id,
    }));

  const oldTime = ids(before.timeConfigs);
  after.timeConfigs.filter(t => !oldTime.has(t.id)).forEach(t =>
    changes.push({
      action: 'CREATE_TIME_CONFIG',
      details: `Thêm mốc thời gian "${t.name}" (${t.startDate} → ${t.endDate})`,
      targetId: t.id,
    }));

  const newCriteria = ids(after.criteria);
  before.criteria.filter(c => !newCriteria.has(c.id)).forEach(c =>
    changes.push({ action: 'DELETE_CRITERIA', details: `Xoá tiêu chí "${c.content}"`, targetId: c.id }));

  const newTime = ids(after.timeConfigs);
  before.timeConfigs.filter(t => !newTime.has(t.id)).forEach(t =>
    changes.push({ action: 'DELETE_TIME_CONFIG', details: `Xoá mốc thời gian "${t.name}"`, targetId: t.id }));

  const newClasses = ids(after.classes);
  before.classes.filter(c => !newClasses.has(c.id)).forEach(c =>
    changes.push({ action: 'DELETE_CLASS', details: `Xoá lớp "${c.name}"`, targetId: c.id }));

  const newStudents = ids(after.students);
  const removedStudents = before.students.filter(s => !newStudents.has(s.id));
  if (removedStudents.length > 3) {
    // Xoá cả danh sách thì gộp một dòng cho dễ đọc, vẫn nêu tên vài em đầu
    changes.push({
      action: 'DELETE_STUDENT',
      details: `Xoá ${removedStudents.length} học sinh: ${removedStudents.slice(0, 3).map(s => s.name).join(', ')}...`,
    });
  } else {
    removedStudents.forEach(s =>
      changes.push({ action: 'DELETE_STUDENT', details: `Xoá học sinh "${s.name}"`, targetId: s.id }));
  }

  return changes;
};

/**
 * Đưa mọi kiểu ngày về dạng YYYY-MM-DD.
 *
 * Bắt buộc phải chuẩn hoá trước khi lưu: hệ thống lọc theo khoảng ngày bằng
 * cách so sánh chuỗi, nên một bản ghi ghi "20/05/2026" sẽ vô hình với xếp hạng,
 * tổng quan và đồng bộ trực tiếp dù vẫn nằm trong kho dữ liệu.
 */
/**
 * Excel lưu ngày bằng số thứ tự ngày tính từ 30/12/1899, không kèm múi giờ.
 * Quy đổi theo giờ UTC để không bị lệch một ngày khi máy ở múi giờ khác.
 */
export const excelSerialToISO = (serial: number): string => {
  if (!isFinite(serial) || serial <= 0) return '';
  const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
  const d = new Date(EXCEL_EPOCH_UTC + Math.round(serial) * 86400000);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
};

export const toISODate = (value: unknown): string => {
  // Ô ngày đọc từ Excel về dưới dạng số thứ tự
  if (typeof value === 'number') return excelSerialToISO(value);

  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/mm/yyyy và d-m-yyyy — cách người Việt vẫn gõ trong Excel
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // yyyy/mm/dd
  const ymd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? '' : toISODate(parsed);
};

/**
 * Ngày nằm ngoài mọi mốc thời gian đã cấu hình thì bản ghi vẫn lưu được nhưng
 * không lọt vào xếp hạng, tổng quan hay báo cáo — cần cảnh báo người nhập.
 */
export const isDateOutsideAllConfigs = (dateStr: string, configs: TimeConfig[]): boolean => {
  if (!dateStr || configs.length === 0) return false;
  return !configs.some(c => isDateInRange(dateStr, c.startDate, c.endDate));
};

export const computeRankingContext = (
  violations: Violation[],
  timeConfigs: TimeConfig[],
  filterMode: 'WEEK' | 'MONTH' | 'SEMESTER' | 'ALL',
  filterConfigId: string
): RankingContext => {
  const allConfiguredWeeks = timeConfigs.filter(c => c.type === 'WEEK');

  if (filterMode === 'ALL') {
    const semesterConfigs = timeConfigs
      .filter(c => c.type === 'SEMESTER')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    if (semesterConfigs.length >= 2) {
      const hk1 = semesterConfigs[0];
      const hk2 = semesterConfigs[1];

      const weeksInHK1 = allConfiguredWeeks.filter(w =>
        isDateInRange(w.startDate, hk1.startDate, hk1.endDate) ||
        isDateInRange(hk1.startDate, w.startDate, w.endDate)
      ).length;
      const weeksInHK2 = allConfiguredWeeks.filter(w =>
        isDateInRange(w.startDate, hk2.startDate, hk2.endDate) ||
        isDateInRange(hk2.startDate, w.startDate, w.endDate)
      ).length;

      const violationsHK1 = violations.filter(v => isDateInRange(v.date, hk1.startDate, hk1.endDate));
      const violationsHK2 = violations.filter(v => isDateInRange(v.date, hk2.startDate, hk2.endDate));

      const seen = new Set<string>();
      const relevantViolations = [...violationsHK1, ...violationsHK2].filter(v => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });

      return {
        relevantViolations,
        weeksCount: weeksInHK1 + weeksInHK2,
        isRangeMode: true,
        periodStr: `Năm học (${hk1.name} ×1 + ${hk2.name} ×2)`,
        weightedSemesters: {
          hk1: { violations: violationsHK1, weeksCount: Math.max(1, weeksInHK1), name: hk1.name },
          hk2: { violations: violationsHK2, weeksCount: Math.max(1, weeksInHK2), name: hk2.name },
        },
      };
    }

    // Fallback khi chưa đủ 2 học kỳ cấu hình
    if (allConfiguredWeeks.length > 0) {
      const rv = violations.filter(v =>
        allConfiguredWeeks.some(week => isDateInRange(v.date, week.startDate, week.endDate))
      );
      return {
        relevantViolations: rv,
        weeksCount: allConfiguredWeeks.length,
        isRangeMode: true,
        periodStr: `Toàn thời gian (${allConfiguredWeeks.length} tuần cấu hình)`,
      };
    } else {
      const minDate = getEarliestViolationDate(violations);
      const maxDate = getLatestViolationDate(violations);
      return {
        relevantViolations: violations,
        weeksCount: getUniqueWeeksCount(minDate, maxDate),
        isRangeMode: true,
        periodStr: '',
      };
    }
  }

  if (filterMode === 'WEEK') {
    const config = timeConfigs.find(c => c.id === filterConfigId);
    if (!config) return { relevantViolations: [], weeksCount: 1, isRangeMode: false, periodStr: '' };
    return {
      relevantViolations: violations.filter(v => isDateInRange(v.date, config.startDate, config.endDate)),
      weeksCount: 1,
      isRangeMode: false,
      periodStr: `${config.name} (${config.startDate} - ${config.endDate})`,
    };
  }

  // MONTH hoặc SEMESTER — overlap check
  const config = timeConfigs.find(c => c.id === filterConfigId);
  if (!config) return { relevantViolations: [], weeksCount: 1, isRangeMode: true, periodStr: '' };

  // Với SEMESTER: xác định xem đây có phải HK2 không (học kỳ có startDate lớn hơn)
  let isHK2 = false;
  if (filterMode === 'SEMESTER') {
    const semesterConfigs = timeConfigs
      .filter(c => c.type === 'SEMESTER')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (semesterConfigs.length >= 2 && config.id === semesterConfigs[semesterConfigs.length - 1].id) {
      isHK2 = true;
    }
  }

  const weeksInRange = allConfiguredWeeks.filter(week =>
    isDateInRange(week.startDate, config.startDate, config.endDate) ||
    isDateInRange(config.startDate, week.startDate, week.endDate)
  );

  if (weeksInRange.length > 0) {
    return {
      relevantViolations: violations.filter(v =>
        weeksInRange.some(week => isDateInRange(v.date, week.startDate, week.endDate))
      ),
      weeksCount: weeksInRange.length,
      isRangeMode: true,
      isHK2,
      periodStr: `${config.name} (${config.startDate} - ${config.endDate})`,
    };
  } else {
    // Fallback: chưa cài tuần trong khoảng này
    return {
      relevantViolations: violations.filter(v => isDateInRange(v.date, config.startDate, config.endDate)),
      weeksCount: getUniqueWeeksCount(config.startDate, config.endDate),
      isRangeMode: true,
      isHK2,
      periodStr: `${config.name} (${config.startDate} - ${config.endDate})`,
    };
  }
};

// -----------------------------------------------------------------------
// detectOverlappingWeeks — phát hiện các cặp tuần WEEK bị trùng ngày
// Trả về mảng các cặp tên tuần bị overlap: [{a: 'Tuần 4', b: 'Tuần 5'}]
// -----------------------------------------------------------------------
export const detectOverlappingWeeks = (
  timeConfigs: TimeConfig[]
): { a: string; b: string }[] => {
  const weeks = timeConfigs.filter(c => c.type === 'WEEK');
  const overlaps: { a: string; b: string }[] = [];

  for (let i = 0; i < weeks.length; i++) {
    for (let j = i + 1; j < weeks.length; j++) {
      const w1 = weeks[i];
      const w2 = weeks[j];
      // Overlap nếu: w1.start <= w2.end AND w2.start <= w1.end
      const w1StartInW2 = isDateInRange(w1.startDate, w2.startDate, w2.endDate);
      const w2StartInW1 = isDateInRange(w2.startDate, w1.startDate, w1.endDate);
      if (w1StartInW2 || w2StartInW1) {
        overlaps.push({ a: w1.name, b: w2.name });
      }
    }
  }
  return overlaps;
};

export const calculateScore = (violations: Violation[], base = 500, weeksCount = 1, isRangeMode = false) => {
  // Logic chuẩn toán học theo yêu cầu:
  // Công thức: (500 * Số_tuần - Tổng_trừ + Tổng_cộng)
  // Lưu ý: v.points > 0 là Điểm Trừ, v.points < 0 là Điểm Cộng (đã lưu số âm)
  // Do đó reduce sẽ tự động thực hiện: Tổng - Trừ + Cộng

  const totalDelta = violations.reduce((sum, v) => sum + v.points, 0);
  const safeWeeks = Math.max(1, weeksCount);

  if (isRangeMode) {
    // CẬP NHẬT: Tính TỔNG ĐIỂM TÍCH LŨY thay vì Điểm Trung Bình
    // Ví dụ: 5 tuần, mỗi tuần 500đ -> Tổng max = 2500đ
    const totalBase = base * safeWeeks;
    const score = totalBase - totalDelta;
    return parseFloat(score.toFixed(2));
  } else {
    // Tính cho 1 tuần đơn lẻ hoặc mặc định
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
  text.replace(re_value, function (m0, m1, m2, m3) {
    if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
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

/**
 * So sánh 2 chuỗi tiếng Việt linh hoạt:
 * 1. Chuẩn hóa Unicode NFC (xử lý "Hoá" vs "Hóa" do IME đặt dấu khác vị trí)
 * 2. Fallback: bỏ toàn bộ dấu rồi so base (xử lý mọi biến thể còn lại)
 * Trả về true nếu 2 chuỗi "giống nhau về mặt ngữ nghĩa".
 */
export const matchVietnamese = (a: string, b: string): boolean => {
  const clean = (s: string) => s.normalize('NFC').toLowerCase().trim();
  const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  return clean(a) === clean(b) || strip(a) === strip(b);
};

/**
 * Tính độ tương đồng giữa 2 chuỗi tiếng Việt (0–100).
 * Dùng thuật toán Bigram Sørensen–Dice sau khi bỏ dấu + lowercase.
 * Ví dụ: "hoc sinh tieu bieu" vs "Học sinh tiêu biểu" → ~100
 */
export const fuzzyMatchScore = (input: string, target: string): number => {
  const normalize = (s: string) =>
    s.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

  const a = normalize(input);
  const b = normalize(target);

  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  // Substring: nếu một chuỗi chứa chuỗi kia → điểm cao
  if (b.includes(a) || a.includes(b)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return Math.round((shorter / longer) * 95);
  }

  // Bigram Dice coefficient
  const getBigrams = (str: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.substring(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  bigramsA.forEach((count, bg) => {
    const countB = bigramsB.get(bg) || 0;
    intersection += Math.min(count, countB);
  });

  const totalA = Math.max(0, a.length - 1);
  const totalB = Math.max(0, b.length - 1);
  if (totalA + totalB === 0) return 0;

  return Math.round((2 * intersection / (totalA + totalB)) * 100);
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
    // Sử dụng parseLocalStartOfDay để tránh lệch ngày do UTC offset
    // "YYYY-MM-DD" qua new Date() sẽ parse thành UTC 00:00, có thể hiển thị sai ngày ở UTC+7
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) {
      const day = parts[2].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[0];
      return `${day}/${month}/${year}`;
    }
    // Fallback: với các định dạng khác (ISO full, ...) dùng local time
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

// -----------------------------------------------------------------------
// Duplicate violation detection helpers
// -----------------------------------------------------------------------

/**
 * Tạo chữ ký duy nhất cho một bản ghi vi phạm để so sánh trùng lặp.
 * Key = Ngày | Lớp | Học sinh (hoặc GROUP) | Tiêu chí
 */
export const getViolationSignature = (v: Violation): string => {
  const dateStr = v.date.includes('T') ? v.date.split('T')[0] : v.date;
  return `${dateStr}|${v.classId}|${v.studentId || 'GROUP'}|${v.criteriaId}`;
};

/**
 * Lọc ra các bản ghi vi phạm có dấu hiệu trùng lặp (cùng Ngày, Lớp, HS, Tiêu chí).
 * Trả về mảng đã sắp xếp: mới nhất trước, cùng ngày → gom nhóm theo signature.
 */
export const findDuplicateViolations = (violations: Violation[]): Violation[] => {
  const counts = new Map<string, number>();
  violations.forEach(v => {
    const sig = getViolationSignature(v);
    counts.set(sig, (counts.get(sig) || 0) + 1);
  });

  const duplicates = violations.filter(v => (counts.get(getViolationSignature(v)) || 0) > 1);

  return duplicates.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return getViolationSignature(a).localeCompare(getViolationSignature(b));
  });
};

// --- EXCEL EXPORT FUNCTION (ExcelJS với freezePane, styling, column width) ---
export interface ExcelExportOptions {
  columnWidths?: number[];
  headerColor?: string;      // Màu nền header (hex)
  alternateRowColor?: string; // Màu nền hàng chẵn/lẻ
  textKeywords?: {
    points?: string[];       // Từ khóa nhận diện cột điểm
    name?: string[];         // Từ khóa nhận diện cột tên
    date?: string[];         // Từ khóa nhận diện cột ngày
    role?: string[];         // Từ khóa nhận diện cột vai trò
  };
}

export const exportToExcel = (
  data: any[][],
  fileName: string,
  options?: ExcelExportOptions
) => {
  (async () => {
    try {
      if (!data || data.length === 0) {
        alert('Không có dữ liệu để xuất Excel.');
        return;
      }

      // Khởi tạo workbook và worksheet
      const Excel = (await import('exceljs')).default;
      const workbook = new Excel.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');

      // Cấu hình freeze pane (cố định hàng tiêu đề)
      worksheet.views = [
        {
          state: 'frozen',
          xSplit: 0,
          ySplit: 1,
          topRow: 1,
          activeCell: 'B2'
        }
      ];

      // Cấu hình autofilter cho hàng tiêu đề
      worksheet.autoFilter = {
        from: { column: 1, row: 1 },
        to: { column: data[0].length, row: data.length }
      };

      // Màu sắc mặc định
      const headerColor = options?.headerColor || '1e40af'; // blue-800
      const alternateRowColor = options?.alternateRowColor || 'f0f9ff'; // blue-50
      const pointsKeywords = options?.textKeywords?.points || ['điểm', 'error', 'lỗi', 'bonus'];
      const nameKeywords = options?.textKeywords?.name || ['tên', 'học sinh', 'giáo viên', 'homeroom'];
      const dateKeywords = options?.textKeywords?.date || ['ngày', 'thời gian', 'date'];
      const roleKeywords = options?.textKeywords?.role || ['vai trò', 'role', 'chức vụ'];

      // Xử lý hàng tiêu đề
      const headerRow = worksheet.getRow(1);
      const colWidths = options?.columnWidths || [];

      for (let col = 0; col < data[0].length; col++) {
        const cell = headerRow.getCell(col + 1);
        cell.value = data[0][col];
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerColor }
        };
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        // Tự động phát hiện kiểu dữ liệu từ header để set màu
        const headerText = String(data[0][col]).toLowerCase();
        let cellColor = headerColor; // mặc định

        if (pointsKeywords.some(k => headerText.includes(k))) {
          cellColor = 'dc2626'; // red-600 cho điểm
        } else if (nameKeywords.some(k => headerText.includes(k))) {
          cellColor = '1e40af'; // blue-800 cho tên
        } else if (dateKeywords.some(k => headerText.includes(k))) {
          cellColor = '7c3aed'; // violet-600 cho ngày
        } else if (roleKeywords.some(k => headerText.includes(k))) {
          cellColor = '059669'; // emerald-600 cho vai trò
        }

        // Cập nhật màu nếu đã phát hiện
        if (cellColor !== headerColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: cellColor }
          };
        }

        // Set độ rộng cột — tự nhận diện từ header
        const customWidth = colWidths[col];
        if (customWidth) {
          worksheet.getColumn(col + 1).width = customWidth;
        } else {
          // Tự động set độ rộng thông minh theo kiểu cột
          let autoWidth = 15; // mặc định
          if (nameKeywords.some(k => headerText.includes(k))) {
            autoWidth = 28; // Cột tên cần rộng hơn
          } else if (dateKeywords.some(k => headerText.includes(k))) {
            autoWidth = 18; // Cột ngày
          } else if (roleKeywords.some(k => headerText.includes(k))) {
            autoWidth = 18; // Cột vai trò
          } else if (pointsKeywords.some(k => headerText.includes(k))) {
            autoWidth = 16; // Cột điểm
          } else if (headerText.includes('stt') || headerText.includes('#')) {
            autoWidth = 8; // Cột STT nhỏ gọn
          } else if (headerText.includes('ghi chú') || headerText.includes('note') || headerText.includes('nội dung') || headerText.includes('lý do')) {
            autoWidth = 32; // Cột ghi chú / nội dung rộng
          } else if (headerText.includes('lớp') || headerText.includes('khối')) {
            autoWidth = 12; // Cột lớp / khối
          }
          worksheet.getColumn(col + 1).width = autoWidth;
        }
      }

      // Phân tích header để xác định kiểu cột (dùng cho format số thông minh)
      const colTypes: string[] = data[0].map((h: any) => {
        const ht = String(h).toLowerCase();
        if (ht.includes('stt') || ht.includes('#') || ht.includes('thứ hạng') || ht.includes('hạng')) return 'index';
        if (ht.includes('số lượt') || ht.includes('số lỗi') || ht.includes('tổng kết') || ht.includes('count') || ht.includes('lượt')) return 'count';
        if (pointsKeywords.some(k => ht.includes(k))) return 'points';
        return 'text';
      });

      // Xử lý hàng dữ liệu
      for (let row = 1; row < data.length; row++) {
        const dataRow = worksheet.getRow(row + 1);

        // Màu nền xen kẽ
        const rowBgColor = row % 2 === 0 ? alternateRowColor : 'FFFFFF';

        for (let col = 0; col < data[row].length; col++) {
          const cell = dataRow.getCell(col + 1);
          const rawValue = data[row][col];
          cell.value = rawValue;

          // Định dạng số thông minh: phân biệt số nguyên vs số thập phân
          const cellValue = String(rawValue);
          if (/^-?\d+(\.\d+)?$/.test(cellValue)) {
            const numVal = Number(cellValue);
            const colType = colTypes[col] || 'text';

            // STT, số lượt, hạng → luôn là số nguyên
            if (colType === 'index' || colType === 'count') {
              cell.value = Math.round(numVal);
              cell.numFmt = '#,##0';
            } else if (Number.isInteger(numVal)) {
              // Số nguyên → không có phần thập phân
              cell.numFmt = '#,##0';
            } else {
              // Số thập phân thực sự → giữ 2 chữ số
              cell.numFmt = '#,##0.00';
            }
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }

          // Áp dụng màu nền xen kẽ
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowBgColor }
          };

          // Border
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E5E5' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E5E5' } },
            left: { style: 'thin', color: { argb: 'FFE5E5E5' } },
            right: { style: 'thin', color: { argb: 'FFE5E5E5' } }
          };

          // Căn chỉnh text (chỉ set nếu chưa được set bởi logic số ở trên)
          if (!cell.alignment || !cell.alignment.horizontal) {
            cell.alignment = {
              vertical: 'middle',
              wrapText: true
            };
          }
        }
      }

      // Tạo buffer và download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Tạo link download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Lỗi xuất Excel:', error);
      alert('Có lỗi xảy ra khi xuất file Excel.');
    }
  })();
};
