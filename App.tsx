
import React, { useState, useEffect, useMemo } from 'react';
import { useModal } from './contexts/ModalContext';
import {
  Shield,
  PlusCircle,
  List,
  Trophy,
  BarChart2,
  Settings,
  LogOut,
  Loader2,
  Users,
  RefreshCw,
  CheckCircle2,
  Star,
  X,
  Info,
  LayoutDashboard,
} from 'lucide-react';
import { Violation } from './types';
import { INITIAL_ROLE_DEFINITIONS, GUEST_USER } from './utils';
import { useAppStore } from './contexts/AppContext';
import { api, onAuthChange, signOut } from './services/firebase';

import DashboardTab from './components/DashboardTab';
import AboutModal from './components/AboutModal';
import LoginModal from './components/LoginModal';

// Các tab còn lại nạp khi người dùng bấm vào, không kéo hết vào lần mở app đầu.
// Riêng ClassDetailTab kéo theo recharts nên tách ra là đáng nhất.
const EntryTab = React.lazy(() => import('./components/EntryTab'));
const ListTab = React.lazy(() => import('./components/ListTab'));
const RankingTab = React.lazy(() => import('./components/RankingTab'));
const ClassDetailTab = React.lazy(() => import('./components/ClassDetailTab'));
const SettingsTab = React.lazy(() => import('./components/SettingsTab'));
const TaskForceTab = React.lazy(() => import('./components/TaskForceTab'));

const TabFallback = () => (
  <div className="flex justify-center items-center py-20 text-slate-400">
    <Loader2 size={28} className="animate-spin" />
  </div>
);

import ViewViolationModal from './components/modals/ViewViolationModal';
import EditViolationModal from './components/modals/EditViolationModal';

export default function App() {
  const {
    currentUser, setCurrentUser,
    users, roleConfigs,
    isLoading, isRefreshing, refreshData,
    violations,
    deleteViolation, deleteViolations, updateViolation,
    setViolations,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // ─── Persist filter state across tab switches ─────────────────────────────
  const [listFilterMode, setListFilterMode] = useState<'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL'>('ALL');
  const [listFilterConfigId, setListFilterConfigId] = useState<string>('');
  const [listFilterClassId, setListFilterClassId] = useState<string>('ALL');
  const [listFilterCriteriaType, setListFilterCriteriaType] = useState<'ALL' | 'MINUS' | 'PLUS'>('ALL');

  const [rankingFilterMode, setRankingFilterMode] = useState<'WEEK' | 'MONTH' | 'SEMESTER' | 'ALL'>('WEEK');
  const [rankingFilterConfigId, setRankingFilterConfigId] = useState<string>('');
  const [rankingGradeTab, setRankingGradeTab] = useState<'10' | '11' | '12'>('10');
  const [classDetailSelectedId, setClassDetailSelectedId] = useState<string>('');
  const [settingsSubTab, setSettingsSubTab] = useState<'ROLES' | 'TIME' | 'CLASSES' | 'STUDENTS' | 'CRITERIA_VIOLATION' | 'CRITERIA_ACHIEVEMENT' | 'ACCOUNTS' | 'AUDIT_LOG' | undefined>(undefined);

  const navigateToList = (classId: string, mode: 'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL', configId: string) => {
    setListFilterClassId(classId);
    setListFilterMode(mode);
    setListFilterConfigId(configId);
    setActiveTab('list');
  };

  // Local UI State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [editingViolation, setEditingViolation] = useState<Violation | null>(null);
  const [viewingViolation, setViewingViolation] = useState<Violation | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<import('./types').Violation[] | null>(null);
  const undoTimerRef = (typeof window !== 'undefined' ? { current: null as ReturnType<typeof setTimeout> | null } : { current: null });

  const { showConfirm, showAlert, showToast } = useModal();

  // ⏳ Issue 4: GAS Cold Start Warning — hiện toast nếu load > 3 giây
  useEffect(() => {
    if (!isLoading && !isRefreshing) return;
    const timer = setTimeout(() => {
      showToast('⏳ Đang tải dữ liệu, vui lòng chờ...', 'info');
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoading, isRefreshing]);

  // ✅ Tự khôi phục phiên đăng nhập — Firebase Auth tự giữ token, không lưu
  // mật khẩu ở localStorage nữa
  useEffect(() => {
    return onAuthChange(user => {
      if (user && user.role && user.role !== 'GUEST') {
        setCurrentUser(user);
        const userRoleKey = String(user.role).toUpperCase();
        const roleConfig = roleConfigs[userRoleKey] || roleConfigs['GUEST'] || INITIAL_ROLE_DEFINITIONS[userRoleKey];
        if (roleConfig?.canEntry) setActiveTab('entry');
        else if (roleConfig?.isAdmin) setActiveTab('settings');
        else setActiveTab('dashboard');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    const ok = await showConfirm({ title: 'Đăng xuất', message: 'Bạn có chắc muốn đăng xuất?', type: 'confirm' });
    if (ok) {
      await signOut();
      setCurrentUser(GUEST_USER);
      setActiveTab('dashboard');
    }
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

    const snapshot = violations.filter(v => ids.includes(v.id));
    setUndoSnapshot(snapshot);

    const updatedRecords = snapshot.map(v => ({ ...v, ...patch }));

    setViolations(prev => prev.map(v => {
      const updated = updatedRecords.find(u => u.id === v.id);
      return updated || v;
    }));

    try {
      await api.batchUpdateViolations(updatedRecords);
    } catch {
      setViolations(prev => prev.map(v => {
        const original = snapshot.find(s => s.id === v.id);
        return original || v;
      }));
      showToast('Lỗi khi cập nhật. Đã hoàn hồi dữ liệu.', 'error');
      return;
    }

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoSnapshot(null), 8000);
  };

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

  // ─── Đoàn falling-star particles ─────────────────────────────────────────
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
        <Loader2 className="animate-spin text-red-600" size={40} />
        <p className="font-medium">Đang tải dữ liệu từ hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans mx-auto max-w-md md:max-w-2xl lg:max-w-4xl shadow-2xl overflow-hidden flex flex-col relative">
      <style>{`
        @keyframes star-fall {
          0%   { transform: translateY(-10px) translateX(0px) rotate(0deg) scale(0.5); opacity: 0; }
          20%  { opacity: 0.9; }
          60%  { transform: translateY(160px) translateX(15px) rotate(180deg) scale(1.2); opacity: 0.8; }
          100% { transform: translateY(320px) translateX(-10px) rotate(360deg) scale(0.8); opacity: 0; }
        }
        .doan-star {
          position: absolute;
          clip-path: polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
          background: #FDE047;
          pointer-events: none;
          animation: star-fall linear infinite;
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-b from-red-700 to-red-900 text-white px-4 pt-5 pb-4 sticky top-0 z-20 shadow-lg rounded-b-[1.5rem] relative overflow-hidden transition-colors duration-500">
        {/* Đoàn star particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {doanStars.map(s => (
            <div key={s.key} className="doan-star" style={{ width: s.size, height: s.size, left: s.left, top: s.top, animationDuration: s.duration, animationDelay: s.delay, opacity: s.opacity }} />
          ))}
          <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png" className="absolute -top-2 -right-2 w-28 md:w-36 z-0 pointer-events-none opacity-20" alt="Huy hiệu Đoàn" />
        </div>

        <div className="flex justify-between items-center relative z-10">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/70/THPT_Chuyen_Nguyen_Trai.png" alt="CNT" className="w-9 h-9 object-contain bg-white rounded-full p-0.5 shadow-md z-10" />
              <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png" alt="Doan" className="w-9 h-9 object-contain drop-shadow-md z-0" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-yellow-300">NỀN NẾP CNT</h1>
              <div className="text-[10px] text-yellow-300 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                <span>★ 95 năm Đoàn TNCS Hồ Chí Minh</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Info button */}
            <button
              onClick={() => setShowAbout(true)}
              className="p-2 rounded-full bg-red-800 text-yellow-200 hover:bg-red-700 transition-all shadow-sm"
              title="Giới thiệu sản phẩm"
            >
              <Info size={18} />
            </button>

            {/* Refresh */}
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="p-2 rounded-full bg-red-800 text-yellow-400 hover:bg-red-700 hover:text-white transition-colors disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            {/* User / Login */}
            {currentUser.role !== 'GUEST' ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium transition-colors border bg-red-800/50 hover:bg-red-800 border-red-700 text-white"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-white text-red-900">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="max-w-[72px] truncate">{currentUser.name}</span>
                <LogOut size={14} className="ml-1 opacity-70" />
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-md bg-yellow-400 text-red-900 hover:bg-yellow-300"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main className="flex-1 p-4 overflow-y-auto scroll-smooth">
        <React.Suspense fallback={<TabFallback />}>
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'entry' && currentUser.role !== 'GUEST' && canCurrentUserEntry() && (
          <EntryTab onNavigateToCriteria={(mode) => {
            setSettingsSubTab(mode === 'VIOLATION' ? 'CRITERIA_VIOLATION' : 'CRITERIA_ACHIEVEMENT');
            setActiveTab('settings');
          }} />
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
          <SettingsTab initialSubTab={settingsSubTab} />
        )}
        {activeTab === 'settings' && !isCurrentUserAdmin() && (
          <div className="text-center py-20 text-slate-400">Bạn không có quyền truy cập.</div>
        )}
        </React.Suspense>
      </main>

      {/* ── BOTTOM NAV ─────────────────────────────────────────────────────── */}
      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto z-10 pb-safe">
        <div className="flex justify-around items-center">
          {/* Dashboard — luôn hiển thị */}
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'dashboard' ? 'text-red-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Tổng Quan</span>
          </button>

          {currentUser.role !== 'GUEST' && canCurrentUserEntry() && (
            <button onClick={() => setActiveTab('entry')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'entry' ? 'text-red-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <PlusCircle size={24} className={activeTab === 'entry' ? 'fill-red-100' : ''} strokeWidth={activeTab === 'entry' ? 2.5 : 2} />
              <span className="text-[10px] font-bold mt-1">Nhập Lỗi</span>
            </button>
          )}

          <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'list' ? 'text-red-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <List size={24} strokeWidth={activeTab === 'list' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Tra Cứu</span>
          </button>

          <button onClick={() => setActiveTab('ranking')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'ranking' ? 'text-red-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <Trophy size={24} className={activeTab === 'ranking' ? 'fill-red-100' : ''} strokeWidth={activeTab === 'ranking' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Xếp Hạng</span>
          </button>

          <button onClick={() => setActiveTab('detail')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'detail' ? 'text-red-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <BarChart2 size={24} strokeWidth={activeTab === 'detail' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Lớp</span>
          </button>

          {(isCurrentUserAdmin() || ['BCH_PHU_TRACH', 'BCH', 'RED_FLAG', 'DISCIPLINE'].includes(currentUser.role)) && (
            <button onClick={() => setActiveTab('taskforce')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'taskforce' ? 'text-red-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Users size={24} strokeWidth={activeTab === 'taskforce' ? 2.5 : 2} />
              <span className="text-[10px] font-bold mt-1">Ban NN</span>
            </button>
          )}

          {isCurrentUserAdmin() && (
            <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'settings' ? 'text-red-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
              <span className="text-[10px] font-bold mt-1">Cấu Hình</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={(tab) => setActiveTab(tab)}
        />
      )}

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
