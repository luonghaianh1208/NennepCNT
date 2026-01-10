
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Violation, ClassEntity, Student, Criteria, TimeConfig, RoleConfig, AppTheme } from '../types';
import { INITIAL_ROLE_DEFINITIONS, GUEST_USER, INITIAL_TIME_CONFIGS, formatDateForInput } from '../utils';
import { api } from '../services/googleApi';

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
  
  // App State
  currentUser: User;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void; // Wrapped setter to save to localStorage
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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- STATE DECLARATIONS (Moved from App.tsx) ---
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
  
  const [academicYear, setAcademicYear] = useState<string>('2023-2024');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- ACTIONS ---

  const setAppTheme = (theme: AppTheme) => {
      setAppThemeState(theme);
      localStorage.setItem('nnp_app_theme', theme);
  };

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    
    const data = await api.getAllData();
    if (data) {
      if(data.Users) setUsers(data.Users);
      if(data.Classes) setClasses(data.Classes);
      if(data.Students) setStudents(data.Students);
      if(data.Criteria) setCriteria(data.Criteria);
      if(data.Violations) setViolations(data.Violations);
      
      if(data.TimeConfigs && data.TimeConfigs.length > 0) {
        const normalizedTimeConfigs = data.TimeConfigs.map((tc: TimeConfig) => ({
            ...tc,
            startDate: formatDateForInput(tc.startDate),
            endDate: formatDateForInput(tc.endDate)
        }));
        setTimeConfigs(normalizedTimeConfigs);
      }
    }
    
    if (showLoading) setIsLoading(false);
    else setIsRefreshing(false);
  }, []);

  const refreshData = () => fetchData(false);

  const syncSettings = async (): Promise<boolean> => {
     setIsRefreshing(true);
     const payload = { Users: users, Classes: classes, Students: students, Criteria: criteria, TimeConfigs: timeConfigs };
     try {
        await api.syncSettings(payload);
        setUnsavedChanges(false);
        return true;
     } catch (e) {
        console.error(e);
        return false;
     } finally {
        setIsRefreshing(false);
     }
  };

  const deleteViolation = async (id: string) => {
      // Optimistic update
      setViolations(prev => prev.filter(v => v.id !== id));
      await api.deleteViolation(id);
  };

  const deleteViolations = async (ids: string[]) => {
      setViolations(prev => prev.filter(v => !ids.includes(v.id)));
      await api.deleteViolations(ids);
  };

  const updateViolation = async (v: Violation) => {
      setViolations(prev => prev.map(item => item.id === v.id ? v : item));
      await api.updateViolation(v);
  };

  const createViolation = async (v: Violation) => {
      setViolations(prev => [v, ...prev]);
      await api.createViolation(v);
  };

  // --- INITIALIZATION ---
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
      currentUser, setCurrentUser,
      appTheme, setAppTheme,
      isLoading, isRefreshing,
      unsavedChanges, setUnsavedChanges,
      academicYear, setAcademicYear,
      fetchData, refreshData, syncSettings,
      deleteViolation, deleteViolations, updateViolation, createViolation
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
