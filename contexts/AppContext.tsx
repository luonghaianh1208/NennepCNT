
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, Violation, ClassEntity, Student, Criteria, TimeConfig, RoleConfig, AppTheme, AuditLog, AuditAction } from '../types';
import { INITIAL_ROLE_DEFINITIONS, GUEST_USER, INITIAL_TIME_CONFIGS, getLocalDateString, diffConfigChanges } from '../utils';
import { api, subscribeToRange } from '../services/firebase';
import { FALLBACK_BRANDING, getConfigBranding, type TenantBranding } from '../services/tenantConfig';

// ─── MAX audit entries to keep in localStorage ───────────────────────────────
const MAX_AUDIT_ENTRIES = 500;
const AUDIT_STORAGE_KEY = 'nnp_audit_logs';

interface AppContextType {
  // Data
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  violations: Violation[];
  setViolations: React.Dispatch<React.SetStateAction<Violation[]>>;
  classes: ClassEntity[];
  setClasses: React.Dispatch<React.SetStateAction<ClassEntity[]>>;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  criteria: Criteria[];
  setCriteria: React.Dispatch<React.SetStateAction<Criteria[]>>;
  timeConfigs: TimeConfig[];
  setTimeConfigs: React.Dispatch<React.SetStateAction<TimeConfig[]>>;
  roleConfigs: Record<string, RoleConfig>;
  setRoleConfigs: React.Dispatch<React.SetStateAction<Record<string, RoleConfig>>>;

  // Thương hiệu của trường (tên, logo, khẩu hiệu) — mỗi bản triển khai một khác
  branding: TenantBranding;
  saveBranding: (next: TenantBranding) => Promise<boolean>;

  /** Lưu bảng vai trò và quyền xuống cơ sở dữ liệu */
  saveRoleConfigs: (next: Record<string, RoleConfig>) => Promise<boolean>;

  // Audit
  auditLogs: AuditLog[];
  clearAuditLogs: () => void;

  // App State
  currentUser: User;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  /** Đang lấy thêm dữ liệu ở chế độ nền — giao diện vẫn dùng được bình thường */
  isBackgroundLoading: boolean;
  /** Tuần đang được theo dõi trực tiếp (null nếu chưa xác định được tuần nào) */
  liveWeek: TimeConfig | null;
  /** Bảo đảm đã có dữ liệu cho một khoảng ngày trước khi hiển thị số liệu */
  ensureRangeLoaded: (start: string, end: string) => Promise<void>;
  /** Bảo đảm đã có toàn bộ dữ liệu (dùng khi chọn "tất cả thời gian") */
  ensureAllLoaded: () => Promise<void>;
  unsavedChanges: boolean;
  setUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  academicYear: string;
  setAcademicYear: React.Dispatch<React.SetStateAction<string>>;

  // Actions
  fetchData: (showLoading?: boolean) => Promise<void>;
  refreshData: () => void;
  syncSettings: () => Promise<boolean>;
  syncUsers: () => Promise<boolean>;
  deleteViolation: (id: string) => Promise<void>;
  deleteViolations: (ids: string[]) => Promise<void>;
  updateViolation: (v: Violation) => Promise<void>;
  createViolation: (v: Violation) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const loadAuditLogs = (): AuditLog[] => {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveAuditLogs = (logs: AuditLog[]) => {
  try {
    // Keep only the latest MAX_AUDIT_ENTRIES entries
    const trimmed = logs.slice(-MAX_AUDIT_ENTRIES);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
  // eslint-disable-next-line no-empty
  } catch {}
};

// ─── Provider ────────────────────────────────────────────────────────────────
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    // Chỉ còn theme DOAN (đã xóa WINTER/TET)
    return 'DOAN';
  });

  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [timeConfigs, setTimeConfigs] = useState<TimeConfig[]>(INITIAL_TIME_CONFIGS);
  const [roleConfigs, setRoleConfigs] = useState<Record<string, RoleConfig>>(INITIAL_ROLE_DEFINITIONS);

  const [academicYear, setAcademicYear] = useState<string>('2025-2026');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Audit logs — loaded from DB (và fallback localStorage)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [branding, setBranding] = useState<TenantBranding>({
    ...FALLBACK_BRANDING,
    ...getConfigBranding(),
  });

  // ── Audit log helper ──────────────────────────────────────────────────────
  const logAction = useCallback((
    user: User,
    action: AuditAction,
    details: string,
    targetId?: string,
    violationInfo?: {
      violationId?: string;
      violationDate?: string;
      violationClass?: string;
      violationCriteria?: string;
      violationPoints?: number;
    }
  ) => {
    const entry: AuditLog = {
      id: `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      details,
      targetId,
      ...(violationInfo || {}),
    };

    // Cập nhật state local
    setAuditLogs(prev => {
      const updated = [...prev, entry].slice(-MAX_AUDIT_ENTRIES);
      // Fallback: lưu localStorage nếu API chưa ready
      saveAuditLogs(updated);
      return updated;
    });

    // ✅ Ghi lên DB (fire-and-forget, không block UI)
    api.saveAuditLog(entry).catch(e => console.warn('saveAuditLog failed:', e));
  }, []);

  const clearAuditLogs = useCallback(() => {
    setAuditLogs([]);
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  }, []);

  // ── App theme ─────────────────────────────────────────────────────────────
  const setAppTheme = (theme: AppTheme) => {
    setAppThemeState(theme);
    localStorage.setItem('nnp_app_theme', theme);
  };

  // ── Tải dữ liệu theo lớp ưu tiên ──────────────────────────────────────────
  //
  // Đợt 1 (chặn giao diện): danh mục nhỏ + vi phạm của tuần này và tuần trước
  //   → chỉ khoảng trăm bản ghi, app dùng được ngay.
  // Đợt 2 (chạy nền): danh bạ học sinh/tài khoản, rồi phần còn lại của học kỳ.
  // Khoảng nào chưa tải mà người dùng chọn xem thì lấy thêm đúng khoảng đó.

  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  /** Những khoảng ngày đã có đủ dữ liệu trong bộ nhớ */
  const loadedRanges = useRef<{ start: string; end: string }[]>([]);
  const loadedAll = useRef(false);

  const mergeRecords = useCallback((incoming: Violation[]) => {
    setViolations(prev => {
      const map = new Map(prev.map(v => [v.id, v]));
      incoming.forEach(v => map.set(v.id, v));
      return [...map.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    });
  }, []);

  const normalizeDate = (s: string) => (s && s.includes('T') ? s.split('T')[0] : s || '');

  const isRangeLoaded = (start: string, end: string) =>
    loadedAll.current || loadedRanges.current.some(r => r.start <= start && r.end >= end);

  /** Lấy thêm dữ liệu cho một khoảng thời gian nếu chưa có */
  const ensureRangeLoaded = useCallback(async (start: string, end: string) => {
    if (!start || !end || isRangeLoaded(start, end)) return;
    setIsBackgroundLoading(true);
    try {
      const records = await api.getRecordsInRange(start, end);
      loadedRanges.current = [...loadedRanges.current, { start, end }];
      mergeRecords(records as Violation[]);
    } catch (e) {
      console.error('ensureRangeLoaded error:', e);
    } finally {
      setIsBackgroundLoading(false);
    }
  }, [mergeRecords]);

  /** Người dùng chọn xem "tất cả thời gian" thì mới thực sự kéo hết */
  const ensureAllLoaded = useCallback(async () => {
    if (loadedAll.current) return;
    setIsBackgroundLoading(true);
    try {
      const records = await api.getAllRecords();
      loadedAll.current = true;
      mergeRecords(records as Violation[]);
    } catch (e) {
      console.error('ensureAllLoaded error:', e);
    } finally {
      setIsBackgroundLoading(false);
    }
  }, [mergeRecords]);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // Danh bạ học sinh/tài khoản chạy song song ngay từ đầu: nó không chặn
      // giao diện, nhưng phải có sớm vì màn hình Nhập lỗi cần chọn học sinh
      const directoryPromise = api.getDirectory();

      // ── Đợt 1: danh mục + khoảng thời gian đang diễn ra ──────────────────
      const core = await api.getCoreData();
      setClasses(core.classes);
      setCriteria(core.criteria);
      // Mốc so sánh cho lần lưu cấu hình tiếp theo — thiếu bước này thì lần lưu
      // đầu tiên sẽ hiểu nhầm toàn bộ dữ liệu sẵn có là "vừa được thêm"
      configSnapshot.current = {
        ...configSnapshot.current,
        criteria: core.criteria,
        classes: core.classes,
      };

      const configs = core.timeConfigs.map((tc: TimeConfig) => ({
        ...tc,
        startDate: normalizeDate(tc.startDate),
        endDate: normalizeDate(tc.endDate),
      }));
      if (configs.length) {
        setTimeConfigs(configs);
        configSnapshot.current = { ...configSnapshot.current, timeConfigs: configs };
      }

      const weeks = configs
        .filter((t: TimeConfig) => t.type === 'WEEK' && t.startDate && t.endDate)
        .sort((a: TimeConfig, b: TimeConfig) => a.startDate.localeCompare(b.startDate));

      const today = getLocalDateString();
      const currentIdx = weeks.findIndex((w: TimeConfig) => today >= w.startDate && today <= w.endDate);
      // Ngoài năm học thì bám hai tuần cuối cùng để màn hình vẫn có số liệu
      const lastIdx = weeks.length - 1;
      const idx = currentIdx > -1 ? currentIdx : lastIdx;
      const window = weeks.length
        ? { start: weeks[Math.max(0, idx - 1)].startDate, end: weeks[idx].endDate }
        : null;

      if (window) {
        const records = await api.getRecordsInRange(window.start, window.end);
        loadedRanges.current = [window];
        loadedAll.current = false;
        setViolations(records as Violation[]);
      } else {
        // Chưa cấu hình tuần nào thì đành lấy hết
        const records = await api.getAllRecords();
        loadedAll.current = true;
        setViolations(records as Violation[]);
      }

      if (showLoading) setIsLoading(false);
      else setIsRefreshing(false);

      // ── Đợt 2: chạy nền, không chặn giao diện ────────────────────────────
      setIsBackgroundLoading(true);
      directoryPromise
        .then(({ students: st, users: us }) => {
          setStudents(st);
          setUsers(us);
          configSnapshot.current = { ...configSnapshot.current, students: st };
        })
        .then(async () => {
          // Nạp nốt học kỳ đang diễn ra để xếp hạng và báo cáo có đủ số liệu
          const semesters = configs.filter((t: TimeConfig) => t.type === 'SEMESTER');
          const currentSemester =
            semesters.find((s: TimeConfig) => today >= s.startDate && today <= s.endDate) ??
            semesters[semesters.length - 1];
          if (currentSemester) {
            await ensureRangeLoaded(currentSemester.startDate, currentSemester.endDate);
          }
        })
        .catch(e => console.error('Tải nền lỗi:', e))
        .finally(() => setIsBackgroundLoading(false));

      // Nhật ký thao tác: chỉ người đã đăng nhập mới đọc được
      api.getAuditLogs().then(logs => {
        if (Array.isArray(logs) && logs.length > 0) setAuditLogs(logs.slice(-MAX_AUDIT_ENTRIES));
      }).catch(() => setAuditLogs(loadAuditLogs()));
    } catch (e) {
      console.error('fetchData error:', e);
      if (showLoading) setIsLoading(false);
      else setIsRefreshing(false);
    }
  }, [ensureRangeLoaded]);

  const refreshData = () => fetchData(false);

  // ── Sync settings ─────────────────────────────────────────────────────────
  /**
   * Ảnh chụp cấu hình lần gần nhất, để biết lần lưu này thêm gì và xoá gì.
   * Chỉ ghi nhật ký đúng những thay đổi đó thay vì một dòng "đã lưu cấu hình"
   * chung chung không nói lên điều gì.
   */
  const configSnapshot = useRef<{ criteria: Criteria[]; timeConfigs: TimeConfig[]; classes: ClassEntity[]; students: Student[] }>({
    criteria: [], timeConfigs: [], classes: [], students: [],
  });

  const logConfigChanges = () => {
    const after = { criteria, timeConfigs, classes, students };
    diffConfigChanges(configSnapshot.current, after).forEach(c =>
      logAction(currentUser, c.action as AuditAction, c.details, c.targetId));
    configSnapshot.current = after;
  };

  const syncSettings = async (): Promise<boolean> => {
    setIsRefreshing(true);
    // ⚠️ QUAN TRỌNG: KHÔNG gửi Users lên đây vì getAllData không trả về password
    // → nếu gửi users state sẽ ghi đè password thành rỗng!
    const payload = { Classes: classes, Students: students, Criteria: criteria, TimeConfigs: timeConfigs };
    try {
      await api.syncSettings(payload);
      setUnsavedChanges(false);
      logConfigChanges();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sync Users RIÊNG BIỆT — chỉ gọi khi admin thực sự thêm/sửa/xóa tài khoản
  const syncUsers = async (): Promise<boolean> => {
    setIsRefreshing(true);
    try {
      // Thao tác tài khoản đã được máy chủ ghi nhật ký riêng
      await api.syncUsers(users);
      setUnsavedChanges(false);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── CRUD with ROLLBACK on failure ─────────────────────────────────────────

  const deleteViolation = async (id: string) => {
    // Snapshot violation info TRƯỚC KHI XÓA — để audit log biết lỗi nào bị xóa
    const targetViolation = violations.find(v => v.id === id);
    const snapshot = violations;
    setViolations(prev => prev.filter(v => v.id !== id));
    try {
      await api.deleteViolation(id);

      // Build thông tin chi tiết về lỗi vừa bị xóa
      logAction(
        currentUser,
        'DELETE_VIOLATION',
        `Xóa vi phạm ngày ${targetViolation?.date || '?'} - Lớp ${targetViolation?.classId || '?'}`,
        id,
        {
          violationId:       id,
          violationDate:     targetViolation?.date,
          violationClass:    targetViolation?.classId,
          violationCriteria: targetViolation?.criteriaId,
          violationPoints:   targetViolation?.points,
        }
      );
    } catch (e) {
      setViolations(snapshot);
      throw e;
    }
  };

  const deleteViolations = async (ids: string[]) => {
    // Snapshot TRƯỚC KHI XÓA — để biết các lỗi nào bị xóa
    const targetViolations = violations.filter(v => ids.includes(v.id));
    const snapshot = violations;
    setViolations(prev => prev.filter(v => !ids.includes(v.id)));
    try {
      await api.deleteViolations(ids);

      // Log từng record riêng — mỗi lần xóa một dòng audit log
      targetViolations.forEach(v => {
        logAction(
          currentUser,
          'BULK_DELETE',
          `Xóa hàng loạt (${ids.length} mục) - Lớp ${v.classId} ngày ${v.date}`,
          v.id,
          {
            violationId:       v.id,
            violationDate:     v.date,
            violationClass:    v.classId,
            violationCriteria: v.criteriaId,
            violationPoints:   v.points,
          }
        );
      });
    } catch (e) {
      setViolations(snapshot);
      throw e;
    }
  };

  const updateViolation = async (v: Violation) => {
    const snapshot = violations;
    setViolations(prev => prev.map(item => item.id === v.id ? v : item));
    try {
      // Không ghi nhật ký: bản ghi vi phạm đã có sẵn người nhập liệu bên trong
      await api.updateViolation(v);
    } catch (e) {
      setViolations(snapshot);
      throw e;
    }
  };

  const createViolation = async (v: Violation) => {
    setViolations(prev => [v, ...prev]);
    try {
      await api.createViolation(v);
    } catch (e) {
      // Rollback: remove the optimistically added entry
      setViolations(prev => prev.filter(item => item.id !== v.id));
      throw e;
    }
  };

  // ── Thương hiệu của trường ────────────────────────────────────────────────
  useEffect(() => {
    api.getBranding().then(saved => {
      if (saved) setBranding(prev => ({ ...prev, ...saved }));
      if (saved?.shortName) document.title = saved.shortName;
    });
  }, []);

  // ── Bảng vai trò và quyền ─────────────────────────────────────────────────
  // Chưa cấu hình thì dùng bảng mặc định; trường nào sửa thì lấy bản đã lưu
  useEffect(() => {
    api.getRoleConfigs().then(saved => {
      if (saved && Object.keys(saved).length) {
        setRoleConfigs(saved as Record<string, RoleConfig>);
      }
    });
  }, []);

  const saveRoleConfigs = async (next: Record<string, RoleConfig>): Promise<boolean> => {
    try {
      await api.saveRoleConfigs(next);
      setRoleConfigs(next);
      return true;
    } catch (e) {
      console.error('saveRoleConfigs error:', e);
      return false;
    }
  };

  const saveBranding = async (next: TenantBranding): Promise<boolean> => {
    try {
      await api.saveBranding(next);
      setBranding(next);
      if (next.shortName) document.title = next.shortName;
      return true;
    } catch (e) {
      console.error('saveBranding error:', e);
      return false;
    }
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // ── Theo dõi trực tiếp tuần hiện tại ──────────────────────────────────────
  // Chỉ tuần đang diễn ra mới cần thấy nhau tức thì; dữ liệu cũ hiếm khi đổi
  // nên vẫn dùng nút làm mới như trước.
  const [liveWeek, setLiveWeek] = useState<TimeConfig | null>(null);

  useEffect(() => {
    const weeks = timeConfigs.filter(t => t.type === 'WEEK' && t.startDate && t.endDate);
    if (!weeks.length) return;

    const today = getLocalDateString();
    // Ngoài năm học (nghỉ hè) thì bám vào tuần gần nhất để màn hình vẫn sống
    const week =
      weeks.find(w => today >= w.startDate && today <= w.endDate) ??
      [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate)).pop()!;

    setLiveWeek(week);

    return subscribeToRange(week.startDate, week.endDate, records => {
      setViolations(prev => {
        const outsideWeek = prev.filter(v => !(v.date >= week.startDate && v.date <= week.endDate));
        return [...records, ...outsideWeek].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      });
    });
  }, [timeConfigs]);

  return (
    <AppContext.Provider value={{
      users, setUsers,
      violations, setViolations,
      classes, setClasses,
      students, setStudents,
      criteria, setCriteria,
      timeConfigs, setTimeConfigs,
      roleConfigs, setRoleConfigs,
      auditLogs, clearAuditLogs,
      currentUser, setCurrentUser,
      appTheme, setAppTheme,
      isLoading, isRefreshing, isBackgroundLoading, liveWeek,
      ensureRangeLoaded, ensureAllLoaded,
      branding, saveBranding, saveRoleConfigs,
      unsavedChanges, setUnsavedChanges,
      academicYear, setAcademicYear,
      fetchData, refreshData, syncSettings, syncUsers,
      deleteViolation, deleteViolations, updateViolation, createViolation,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
