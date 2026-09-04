
import React, { useState } from 'react';
import { Save, Settings, SlidersHorizontal, Calendar, GraduationCap, Users, AlertTriangle, UserPlus, ClipboardList, Palette, Trophy } from 'lucide-react';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';

import SettingsRolesTab from './settings/SettingsRolesTab';
import SettingsTimeTab from './settings/SettingsTimeTab';
import SettingsClassesTab from './settings/SettingsClassesTab';
import SettingsStudentsTab from './settings/SettingsStudentsTab';
import SettingsCriteriaTab from './settings/SettingsCriteriaTab';
import SettingsAccountsTab from './settings/SettingsAccountsTab';
import SettingsAuditLogTab from './settings/SettingsAuditLogTab';
import SettingsBrandingTab from './settings/SettingsBrandingTab';
import SettingsRulesTab from './settings/SettingsRulesTab';
import SettingsRewardsTab from './settings/SettingsRewardsTab';

// Không còn tab "Thành tích": danh mục tiêu chí khen thưởng trùng vai trò với
// bảng điểm giải × cấp độ, mà hai nơi lại là hai nguồn điểm khác nhau — sửa một
// bên thì bên kia không biết. Khen thưởng nay khai duy nhất ở tab Điểm thưởng;
// tiêu chí do hệ thống tự sinh khi ghi, người dùng không phải đụng tới.
type SubTab = 'BRANDING' | 'RULES' | 'REWARDS' | 'ROLES' | 'TIME' | 'CLASSES' | 'STUDENTS' | 'CRITERIA_VIOLATION' | 'ACCOUNTS' | 'AUDIT_LOG';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'BRANDING', label: 'Thương hiệu', icon: <Palette size={16} /> },
  { id: 'RULES', label: 'Quy định', icon: <SlidersHorizontal size={16} /> },
  { id: 'REWARDS', label: 'Điểm thưởng', icon: <Trophy size={16} /> },
  { id: 'ROLES', label: 'Vai trò', icon: <Settings size={16} /> },
  { id: 'TIME', label: 'Thời gian', icon: <Calendar size={16} /> },
  { id: 'CLASSES', label: 'Lớp học', icon: <GraduationCap size={16} /> },
  { id: 'STUDENTS', label: 'Học sinh', icon: <Users size={16} /> },
  { id: 'CRITERIA_VIOLATION', label: 'Lỗi vi phạm', icon: <AlertTriangle size={16} /> },
  { id: 'ACCOUNTS', label: 'Tài khoản', icon: <UserPlus size={16} /> },
  { id: 'AUDIT_LOG', label: 'Log', icon: <ClipboardList size={16} /> },
];

interface SettingsTabProps {
  initialSubTab?: SubTab;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ initialSubTab }) => {
  const { syncSettings, unsavedChanges } = useAppStore();
  const { showConfirm, showToast } = useModal();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>(initialSubTab || 'ROLES');

  // Đồng bộ khi prop thay đổi (navigate từ tab khác)
  React.useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Đóng trình duyệt lúc còn thay đổi chưa lưu thì mất trắng công nhập, im lặng
  React.useEffect(() => {
    if (!unsavedChanges) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsavedChanges]);

  const handleSaveSettings = async () => {
    const ok = await showConfirm({ title: 'Lưu cấu hình', message: 'Lưu toàn bộ cấu hình lên hệ thống?', confirmText: 'Lưu' });
    if (!ok) return;
    const success = await syncSettings();
    if (success) {
      showToast('Đã lưu thành công!', 'success');
    } else {
      showToast('Lỗi khi lưu dữ liệu. Vui lòng thử lại.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-24 relative">
      {/* Sub-tab Navigation */}
      <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 overflow-x-auto no-scrollbar">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all ${activeSubTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'
              }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Floating Save Button */}
      {unsavedChanges && (
        <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in">
          <button
            onClick={handleSaveSettings}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-xl flex items-center gap-2 active:scale-95 transition-all"
          >
            <Save size={20} /> Lưu Thay Đổi
          </button>
        </div>
      )}

      {/* Sub-tab Content */}
      {activeSubTab === 'BRANDING' && <SettingsBrandingTab />}
      {activeSubTab === 'RULES' && <SettingsRulesTab />}
      {activeSubTab === 'REWARDS' && <SettingsRewardsTab />}
      {activeSubTab === 'ROLES' && <SettingsRolesTab />}
      {activeSubTab === 'TIME' && <SettingsTimeTab />}
      {activeSubTab === 'CLASSES' && <SettingsClassesTab />}
      {activeSubTab === 'STUDENTS' && <SettingsStudentsTab />}
      {activeSubTab === 'CRITERIA_VIOLATION' && <SettingsCriteriaTab type="MINUS" />}
      {activeSubTab === 'ACCOUNTS' && <SettingsAccountsTab />}
      {activeSubTab === 'AUDIT_LOG' && <SettingsAuditLogTab />}
    </div>
  );
};

export default SettingsTab;
