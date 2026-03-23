
import React, { useState, useEffect, useMemo } from 'react';
import { useModal } from './contexts/ModalContext';
import {
  Shield,
  PlusCircle,
  List,
  Trophy,
  BarChart2,
  Settings,
  LogIn,
  LogOut,
  Loader2,
  Users,
  RefreshCw,
  CheckCircle2,
  Snowflake,
  Star,
  X
  , Info
} from 'lucide-react';
import { Violation } from './types';
import { INITIAL_ROLE_DEFINITIONS, GUEST_USER } from './utils';
import { useAppStore } from './contexts/AppContext';
import { api } from './services/googleApi';

import EntryTab from './components/EntryTab';
import ListTab from './components/ListTab';
import AboutModal from './components/AboutModal';
import RankingTab from './components/RankingTab';
import ClassDetailTab from './components/ClassDetailTab';
import SettingsTab from './components/SettingsTab';
import TaskForceTab from './components/TaskForceTab';

import ViewViolationModal from './components/modals/ViewViolationModal';
import EditViolationModal from './components/modals/EditViolationModal';

export default function App() {
  const {
    currentUser, setCurrentUser,
    users, roleConfigs,
    appTheme, setAppTheme,
    isLoading, isRefreshing, refreshData,
    violations,
    deleteViolation, deleteViolations, updateViolation,
    setViolations
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<string>('list');

  // ─── Persist filter state across tab switches ─────────────────────────────
  const [listFilterMode, setListFilterMode] = useState<'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL'>('ALL');
  const [listFilterConfigId, setListFilterConfigId] = useState<string>('');
  const [listFilterClassId, setListFilterClassId] = useState<string>('ALL');
  const [listFilterCriteriaType, setListFilterCriteriaType] = useState<'ALL' | 'MINUS' | 'PLUS'>('ALL');

  const [rankingFilterMode, setRankingFilterMode] = useState<'WEEK' | 'MONTH' | 'SEMESTER' | 'ALL'>('WEEK');
  const [rankingFilterConfigId, setRankingFilterConfigId] = useState<string>('');
  const [rankingGradeTab, setRankingGradeTab] = useState<'10' | '11' | '12'>('10');
  const [classDetailSelectedId, setClassDetailSelectedId] = useState<string>('');

  // Navigate to ListTab with specific filters (called from RankingTab click on class)
  const navigateToList = (classId: string, mode: 'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL', configId: string) => {
    setListFilterClassId(classId);
    setListFilterMode(mode);
    setListFilterConfigId(configId);
    setActiveTab('list');
  };

  // Local UI State
  const [showGlobalSuccess, setShowGlobalSuccess] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [editingViolation, setEditingViolation] = useState<Violation | null>(null);
  const [viewingViolation, setViewingViolation] = useState<Violation | null>(null);
  // Undo state — lưu snapshot trước bulk operation để có thể hoàn tác
  const [undoSnapshot, setUndoSnapshot] = useState<import('./types').Violation[] | null>(null);
  const undoTimerRef = (typeof window !== 'undefined' ? { current: null as ReturnType<typeof setTimeout> | null } : { current: null });

  const { showConfirm, showAlert, showToast } = useModal();

  // ✅ Auto Login: khôi phục phiên tức thì từ localStorage (không cần gọi GAS)
  // User object được lưu sau khi đăng nhập thành công (không có password)
  useEffect(() => {
    const savedUser = localStorage.getItem('nnp_user_session');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.role && user.role !== 'GUEST') {
          setCurrentUser(user);
          const userRoleKey = user.role.toUpperCase();
          const roleConfig = roleConfigs[userRoleKey] || roleConfigs['GUEST'] || INITIAL_ROLE_DEFINITIONS[userRoleKey];
          if (roleConfig?.canEntry) setActiveTab('entry');
          else if (roleConfig?.isAdmin) setActiveTab('settings');
          else setActiveTab('list');
        }
      } catch (e) {
        localStorage.removeItem('nnp_user_session');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy 1 lần khi mount, không cần GAS call


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return; // Chặn double-submit
    setLoginError('');
    setIsLoggingIn(true);
    try {
      // Gọi server-side verifyLogin, password được so sánh trên GAS, không trả về browser
      const result = await api.verifyLogin(loginUsername, loginPassword);

      if (result?.success && result.user) {
        const user = result.user;
        setCurrentUser(user);
        setShowLoginModal(false);

        // Lưu user object (không có password) vào localStorage — dùng để auto-login nhanh lần sau
        localStorage.setItem('nnp_user_session', JSON.stringify(user));
        // Giữ lại nnp_user_creds nếu rememberMe (dùng để re-verify sau này nếu cần)
        if (rememberMe) {
          localStorage.setItem('nnp_user_creds', btoa(`${loginUsername}:${loginPassword}`));
        } else {
          localStorage.removeItem('nnp_user_creds');
          // Không rememberMe → KHÔNG xóa session (_session luôn tồn tại trong tab hiện tại)
        }

        setLoginUsername('');
        setLoginPassword('');

        const userRoleKey = user.role.toUpperCase();
        const roleConfig = roleConfigs[userRoleKey] || roleConfigs['GUEST'];

        if (roleConfig.canEntry) setActiveTab('entry');
        else if (roleConfig.isAdmin) setActiveTab('settings');
        else setActiveTab('list');
      } else {
        setLoginError(result?.error || 'Tên đăng nhập hoặc mật khẩu không đúng');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const ok = await showConfirm({ title: 'Đăng xuất', message: 'Bạn có chắc muốn đăng xuất?', type: 'confirm' });
    if (ok) {
      setCurrentUser(GUEST_USER);
      setActiveTab('list');
      localStorage.removeItem('nnp_user_creds');
    }
  };

  const handleEditClick = (e: React.MouseEvent, v: Violation) => {
    e.stopPropagation();
    setEditingViolation(v);
  };

  const onSaveEdit = async (updatedV: Violation) => {
    try {
      await updateViolation(updatedV);
      setEditingViolation(null);
      showToast('Đã lưu thành công!', 'success');
    } catch {
      showToast('Lỗi khi lưu. Vui lòng thử lại.', 'error');
    }
  };

  const onDeleteViolation = async (id: string) => {
    const ok = await showConfirm({ title: 'Xác nhận xóa', message: 'Xóa vĩnh viễn mục này trên hệ thống?', type: 'danger', confirmText: 'Xóa' });
    if (ok) {
      if (viewingViolation?.id === id) setViewingViolation(null);
      try {
        await deleteViolation(id);
        showToast('Đã xóa thành công.', 'success');
      } catch {
        showToast('Lỗi khi xóa. Vui lòng thử lại.', 'error');
      }
    }
  };

  const onBulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    const ok = await showConfirm({ title: 'Xóa hàng loạt', message: `Bạn có chắc muốn xóa ${ids.length} mục đã chọn? Hành động này không thể hoàn tác.`, type: 'danger', confirmText: `Xóa ${ids.length} mục` });
    if (!ok) return;
    try {
      await deleteViolations(ids);
      showToast(`Đã xóa ${ids.length} mục thành công.`, 'success');
    } catch {
      showToast('Lỗi khi xóa hàng loạt. Vui lòng thử lại.', 'error');
    }
  };

  const onBulkUpdate = async (ids: string[], patch: Partial<import('./types').Violation>, onProgress?: (done: number, total: number) => void) => {
    if (ids.length === 0) return;

    // Lưu snapshot trước khi sửa (để undo)
    const snapshot = violations.filter(v => ids.includes(v.id));
    setUndoSnapshot(snapshot);

    // Build full records với patch áp dụng
    const updatedRecords = snapshot.map(v => ({ ...v, ...patch }));

    // Cập nhật state local ngay lập tức (optimistic)
    setViolations(prev => prev.map(v => {
      const updated = updatedRecords.find(u => u.id === v.id);
      return updated || v;
    }));

    // Gọi batch API GAS (1 request cho N records)
    try {
      await api.batchUpdateViolations(updatedRecords);
    } catch {
      // Nếu lỗi, rollback state
      setViolations(prev => prev.map(v => {
        const original = snapshot.find(s => s.id === v.id);
        return original || v;
      }));
      showToast('Lỗi khi cập nhật. Đã hoàn hồi dữ liệu.', 'error');
      return;
    }

    // Hiện undo toast trong 8 giây
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoSnapshot(null), 8000);
  };

  // Hoàn tác bulk edit
  const onUndoBulkUpdate = async () => {
    if (!undoSnapshot || undoSnapshot.length === 0) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const toRestore = undoSnapshot;
    setUndoSnapshot(null);
    setViolations(prev => prev.map(v => {
      const original = toRestore.find(s => s.id === v.id);
      return original || v;
    }));
    try {
      await api.batchUpdateViolations(toRestore);
      showToast('Đã hoàn tác thành công!', 'success');
    } catch {
      showToast('Lỗi khi hoàn tác.', 'error');
    }
  };

  const isCurrentUserAdmin = () => {
    const roleKey = currentUser.role.toUpperCase();
    return roleConfigs[roleKey]?.isAdmin || false;
  };

  const canCurrentUserEntry = () => {
    const roleKey = currentUser.role.toUpperCase();
    return roleConfigs[roleKey]?.canEntry || false;
  };

  const toggleTheme = () => {
    setAppTheme(appTheme === 'DOAN' ? 'WINTER' : 'DOAN');
  };
  const snowflakes = useMemo(() => Array.from({ length: 15 }, (_, i) => ({
    key: `snow-${i}`,
    width: `${Math.random() * 4 + 2}px`,
    height: `${Math.random() * 4 + 2}px`,
    left: `${Math.random() * 100}%`,
    top: `-${Math.random() * 20}px`,
    duration: `${Math.random() * 5 + 3}s`,
    delay: `${Math.random() * 5}s`,
    opacity: Math.random() * 0.5 + 0.3,
  })), []);

  const stars = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    key: `star-${i}`,
    left: `${Math.random() * 90 + 5}%`,
    top: `${Math.random() * 60}%`,
    delay: `${Math.random() * 2}s`,
  })), []);

  // Ngôi sao vàng rơi (effect Đoàn)
  const doanStars = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    key: `dstar-${i}`,
    left: `${Math.random() * 100}%`,
    top: `-${Math.random() * 20}px`,
    duration: `${Math.random() * 4 + 4}s`,
    delay: `${Math.random() * 6}s`,
    size: `${Math.random() * 6 + 6}px`,
    opacity: Math.random() * 0.5 + 0.5,
  })), []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="font-medium">Đang tải dữ liệu từ hệ thống...</p>
      </div>
    );
  }
  const headerBgClass = appTheme === 'DOAN' ? 'bg-gradient-to-b from-red-700 to-red-900' : 'bg-blue-900';
  const headerTextClass = appTheme === 'DOAN' ? 'text-yellow-100' : 'text-blue-100';
  const primaryTitleColor = appTheme === 'DOAN' ? 'text-yellow-300' : 'text-white';

  return (
    <div className="min-h-screen bg-slate-50 font-sans mx-auto max-w-md md:max-w-2xl lg:max-w-4xl shadow-2xl overflow-hidden flex flex-col relative">
      <style>{`
          @keyframes snowfall {
            0% { transform: translateY(-10px) translateX(0px); opacity: 0; }
            20% { opacity: 0.9; }
            100% { transform: translateY(300px) translateX(20px); opacity: 0; }
          }
          @keyframes star-fall {
            0% { transform: translateY(-10px) translateX(0px) rotate(0deg) scale(0.5); opacity: 0; }
            20% { opacity: 0.9; }
            60% { transform: translateY(160px) translateX(15px) rotate(180deg) scale(1.2); opacity: 0.8; }
            100% { transform: translateY(320px) translateX(-10px) rotate(360deg) scale(0.8); opacity: 0; }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.6); }
          }
          .snowflake {
            position: absolute;
            background: white;
            border-radius: 50%;
            pointer-events: none;
            animation: snowfall linear infinite;
          }
          .doan-star {
            position: absolute;
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            background: #FDE047;
            pointer-events: none;
            animation: star-fall linear infinite;
          }
          .star-twinkle {
            position: absolute;
            width: 3px;
            height: 3px;
            background: white;
            border-radius: 50%;
            animation: twinkle 3s ease-in-out infinite;
            box-shadow: 0 0 4px 1px rgba(255, 255, 255, 0.4);
          }
      `}</style>

      <header className={`${headerBgClass} text-white p-4 pt-8 pb-6 sticky top-0 z-20 shadow-lg rounded-b-[2rem] relative overflow-hidden transition-colors duration-500`}>
        {/* --- EFFECTS --- */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {appTheme === 'WINTER' ? (
            <>
              {snowflakes.map(s => (
                <div key={s.key} className="snowflake" style={{ width: s.width, height: s.height, left: s.left, top: s.top, animationDuration: s.duration, animationDelay: s.delay, opacity: s.opacity }}></div>
              ))}
              {stars.map(s => (
                <div key={s.key} className="star-twinkle" style={{ left: s.left, top: s.top, animationDelay: s.delay }}></div>
              ))}
              <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-0">
                <div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-white/30 to-transparent"></div>
              </div>
            </>
          ) : (
            <>
              {/* Ngôi sao vàng rơi — Đoàn TNCS */}
              {doanStars.map(s => (
                <div key={s.key} className="doan-star" style={{ width: s.size, height: s.size, left: s.left, top: s.top, animationDuration: s.duration, animationDelay: s.delay, opacity: s.opacity }}></div>
              ))}
              {/* Logo emblem Đoàn */}
              <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png" className="absolute -top-2 -right-2 w-28 md:w-36 z-0 pointer-events-none opacity-20" alt="Huy hiệu Đoàn" />
            </>
          )}
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex -space-x-2">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/70/THPT_Chuyen_Nguyen_Trai.png" alt="CNT" className="w-10 h-10 object-contain bg-white rounded-full p-0.5 shadow-md z-10" />
                <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png" alt="Doan" className="w-10 h-10 object-contain drop-shadow-md z-0" />
              </div>

              <div>
                <h1 className={`text-2xl font-black tracking-tight leading-none ${primaryTitleColor}`}>NỀN NẾP CNT</h1>
                {appTheme === 'DOAN' ? (
                  <div className="text-[10px] text-yellow-300 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                    <span>★ 95 năm Đoàn TNCS Hồ Chí Minh</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-0.5">THPT Chuyên Nguyễn Trãi</div>
                )}
              </div>
            </div>

            <div className="pl-1 space-y-0.5">
              <p className={`${headerTextClass} text-xs opacity-90`}>
                'Chào mừng Kỷ niệm 95 năm Ngày thành lập Đoàn TNCS Hồ Chí Minh'
              </p>
              <p className={`${appTheme === 'DOAN' ? 'text-yellow-300/90' : 'text-blue-300/90'} text-[10px] font-semibold`}>(26/3/1931 – 26/3/2026)</p>
              <p className={`${appTheme === 'DOAN' ? 'text-yellow-500/80' : 'text-blue-400'} text-[10px] font-mono`}>Developed by Lương Hải Anh © 2026</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 pt-1">
            <div className="relative group">
              {currentUser.role !== 'GUEST' ? (
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium transition-colors border ${appTheme === 'DOAN' ? 'bg-red-800/50 hover:bg-red-800 border-red-700 text-white' : 'bg-blue-800/50 hover:bg-blue-800 border-blue-700 text-white'}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-white ${appTheme === 'DOAN' ? 'text-red-900' : 'text-blue-900'}`}>{currentUser.name.charAt(0)}</div>
                  <span className="max-w-[80px] truncate">{currentUser.name}</span>
                  <LogOut size={14} className="ml-1 opacity-70" />
                </button>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-md ${appTheme === 'DOAN' ? 'bg-yellow-400 text-red-900 hover:bg-yellow-300' : 'bg-white text-blue-900 hover:bg-blue-50'}`}
                >
                  <LogIn size={16} /> Đăng nhập
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-full transition-all shadow-sm ${appTheme === 'DOAN' ? 'bg-red-800 text-yellow-200 hover:bg-red-700' : 'bg-blue-800 text-blue-200 hover:bg-blue-700'}`}
                title="Đổi giao diện"
              >
                {appTheme === 'DOAN' ? <Snowflake size={18} /> : <Star size={18} />}
              </button>

              <button
                onClick={() => setShowAbout(true)}
                className={`p-2 rounded-full transition-all shadow-sm ${appTheme === 'DOAN' ? 'bg-red-800 text-yellow-200 hover:bg-red-700' : 'bg-blue-800 text-blue-200 hover:bg-blue-700'}`}
                title="Giới thiệu sản phẩm"
              >
                <Info size={18} />
              </button>

              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className={`p-2 rounded-full transition-colors disabled:opacity-50 ${appTheme === 'DOAN' ? 'bg-red-800 text-yellow-400 hover:bg-red-700 hover:text-white' : 'bg-blue-800 text-blue-200 hover:bg-blue-700 hover:text-white'}`}
                title="Làm mới dữ liệu từ Database"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto scroll-smooth">
        {activeTab === 'entry' && currentUser.role !== 'GUEST' && canCurrentUserEntry() && (
          <EntryTab onNavigateToCriteria={(mode) => { setActiveTab('settings'); }} />
        )}
        {activeTab === 'list' && (
          <ListTab
            onDeleteViolation={onDeleteViolation}
            onBulkDelete={onBulkDelete}
            onBulkUpdate={onBulkUpdate}
            onUndoBulkUpdate={onUndoBulkUpdate}
            undoSnapshot={undoSnapshot}
            setViewingViolation={setViewingViolation}
            setEditingViolation={setEditingViolation}
            filterMode={listFilterMode}
            setFilterMode={setListFilterMode}
            filterConfigId={listFilterConfigId}
            setFilterConfigId={setListFilterConfigId}
            filterClassId={listFilterClassId}
            setFilterClassId={setListFilterClassId}
            filterCriteriaType={listFilterCriteriaType}
            setFilterCriteriaType={setListFilterCriteriaType}
          />
        )}
        {activeTab === 'ranking' && (
          <RankingTab
            filterMode={rankingFilterMode}
            setFilterMode={setRankingFilterMode}
            filterConfigId={rankingFilterConfigId}
            setFilterConfigId={setRankingFilterConfigId}
            gradeTab={rankingGradeTab}
            setGradeTab={setRankingGradeTab}
            onNavigateToList={navigateToList}
          />
        )}
        {activeTab === 'detail' && (
          <ClassDetailTab setViewingViolation={setViewingViolation} selectedClassId={classDetailSelectedId} setSelectedClassId={setClassDetailSelectedId} />
        )}
        {activeTab === 'taskforce' && (isCurrentUserAdmin() || ['BCH_PHU_TRACH', 'BCH', 'RED_FLAG', 'DISCIPLINE'].includes(currentUser.role)) && (
          <TaskForceTab />
        )}
        {activeTab === 'settings' && isCurrentUserAdmin() && (
          <SettingsTab />
        )}
        {activeTab === 'settings' && !isCurrentUserAdmin() && (
          <div className="text-center py-20 text-slate-400">Bạn không có quyền truy cập.</div>
        )}

      </main>

      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto z-10 pb-safe">
        {/* Navigation Buttons */}
        <div className="flex justify-around items-center">
          {currentUser.role !== 'GUEST' && canCurrentUserEntry() && (
            <button onClick={() => setActiveTab('entry')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'entry' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <PlusCircle size={24} className={activeTab === 'entry' ? 'fill-blue-100' : ''} strokeWidth={activeTab === 'entry' ? 2.5 : 2} />
              <span className="text-[10px] font-bold mt-1">Nhập Lỗi</span>
            </button>
          )}
          <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'list' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <List size={24} strokeWidth={activeTab === 'list' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Tra Cứu</span>
          </button>
          <button onClick={() => setActiveTab('ranking')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'ranking' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <Trophy size={24} className={activeTab === 'ranking' ? 'fill-blue-100' : ''} strokeWidth={activeTab === 'ranking' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Xếp Hạng</span>
          </button>
          <button onClick={() => setActiveTab('detail')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'detail' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <BarChart2 size={24} strokeWidth={activeTab === 'detail' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Lớp</span>
          </button>

          {(isCurrentUserAdmin() || ['BCH_PHU_TRACH', 'BCH', 'RED_FLAG', 'DISCIPLINE'].includes(currentUser.role)) && (
            <button onClick={() => setActiveTab('taskforce')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'taskforce' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Users size={24} strokeWidth={activeTab === 'taskforce' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Ban Nền Nếp</span>
            </button>
          )}

          {isCurrentUserAdmin() && (
            <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'settings' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Cấu Hình</span>
            </button>
          )}
        </div>
      </nav>

      {/* Global Success Notification — now handled by Toast */}

      {/* Login Modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/80 backdrop-blur-sm p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <LogIn size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Đăng Nhập</h2>
              <p className="text-slate-500 text-sm mt-1">Vui lòng đăng nhập để tiếp tục</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tên đăng nhập <span className="text-xs font-normal text-slate-500 italic ml-1">(nhập email đã đăng kí)</span>
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Mật khẩu <span className="text-xs font-normal text-slate-500 italic ml-1">(nhập pass đã được cấp dạng CNT@xxxx)</span>
                </label>
                <input
                  type="password"
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none">
                  Ghi nhớ đăng nhập
                </label>
              </div>

              {loginError && <div className="text-red-500 text-sm font-medium text-center">{loginError}</div>}
              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 ${isLoggingIn ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
              >
                {isLoggingIn ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang xác thực...
                  </>
                ) : 'Đăng Nhập'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modals using Store data internally */}
      <EditViolationModal
        violation={editingViolation}
        onClose={() => setEditingViolation(null)}
        onSave={onSaveEdit}
      />

      <ViewViolationModal
        violation={viewingViolation}
        onClose={() => setViewingViolation(null)}
        onDelete={onDeleteViolation}
      />
    </div>
  );
}
