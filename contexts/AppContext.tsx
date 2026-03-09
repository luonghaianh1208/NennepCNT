
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Violation, ClassEntity, Student, Criteria, TimeConfig, RoleConfig, AppTheme, AuditLog, AuditAction } from '../types';
import { INITIAL_ROLE_DEFINITIONS, GUEST_USER, INITIAL_TIME_CONFIGS } from '../utils';
import { api } from '../services/googleApi';

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
  unsavedChanges: boolean;
  setUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  academicYear: string;
  setAcademicYear: React.Dispatch<React.SetStateAction<string>>;

  // Actions
  fetchData: (showLoading?: boolean) => Promise<void>;
  refreshData: () => void;
  syncSettings: () => Promise<boolean>;
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
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nnp_app_theme');
      return (saved === 'WINTER' || saved === 'TET') ? saved : 'TET';
    }
    return 'TET';
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

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await api.getAllData();
      if (data) {
        if (data.Users) setUsers(data.Users);
        if (data.Classes) setClasses(data.Classes);
        if (data.Students) setStudents(data.Students);
        if (data.Criteria) setCriteria(data.Criteria);
        if (data.Violations) setViolations(data.Violations);

        if (data.TimeConfigs && data.TimeConfigs.length > 0) {
          const normalizeDate = (s: string) => (s && s.includes('T') ? s.split('T')[0] : s || '');
          const normalizedTimeConfigs = data.TimeConfigs.map((tc: TimeConfig) => ({
            ...tc,
            startDate: normalizeDate(tc.startDate),
            endDate: normalizeDate(tc.endDate),
          }));
          setTimeConfigs(normalizedTimeConfigs);
        }

        // Load audit logs từ DB (cấp thấp hơn, không đợi)
        api.getAuditLogs().then(logs => {
          if (Array.isArray(logs) && logs.length > 0) {
            setAuditLogs(logs.slice(-MAX_AUDIT_ENTRIES));
          }
        }).catch(() => {
          // Fallback: dùng localStorage
          setAuditLogs(loadAuditLogs());
        });
      }
    } catch (e) {
      console.error('fetchData error:', e);
    } finally {
      if (showLoading) setIsLoading(false);
      else setIsRefreshing(false);
    }
  }, []);

  const refreshData = () => fetchData(false);

  // ── Sync settings ─────────────────────────────────────────────────────────
  const syncSettings = async (): Promise<boolean> => {
    setIsRefreshing(true);
    const payload = { Users: users, Classes: classes, Students: students, Criteria: criteria, TimeConfigs: timeConfigs };
    try {
      await api.syncSettings(payload);
      setUnsavedChanges(false);
      logAction(currentUser, 'SYNC_SETTINGS', `Đồng bộ cấu hình: ${classes.length} lớp, ${students.length} HS, ${criteria.length} tiêu chí`);
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
      await api.updateViolation(v);
      logAction(currentUser, 'UPDATE_VIOLATION', `Sửa bản ghi vi phạm`, v.id);
    } catch (e) {
      setViolations(snapshot);
      throw e;
    }
  };

  const createViolation = async (v: Violation) => {
    setViolations(prev => [v, ...prev]);
    try {
      await api.createViolation(v);
      logAction(currentUser, 'CREATE_VIOLATION', `Tạo bản ghi mới (${v.classId})`, v.id);
    } catch (e) {
      // Rollback: remove the optimistically added entry
      setViolations(prev => prev.filter(item => item.id !== v.id));
      throw e;
    }
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

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
      isLoading, isRefreshing,
      unsavedChanges, setUnsavedChanges,
      academicYear, setAcademicYear,
      fetchData, refreshData, syncSettings,
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
