
import React, { useState } from 'react';
import { Plus, Trash2, Shield } from 'lucide-react';
import { RoleConfig } from '../../types';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

const SettingsRolesTab: React.FC = () => {
  const { roleConfigs, setRoleConfigs, setUnsavedChanges } = useAppStore();
  const { showAlert, showConfirm, showToast } = useModal();

  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('gray');

  const handleAddRole = () => {
    if (!newRoleKey || !newRoleLabel) return showToast('Mã vai trò và Tên hiển thị không được trống', 'error');
    const key = newRoleKey.toUpperCase().replace(/\s/g, '_');
    if (roleConfigs[key]) return showToast('Mã vai trò này đã tồn tại', 'error');
    setRoleConfigs({ ...roleConfigs, [key]: { label: newRoleLabel, color: newRoleColor, canEntry: false, isAdmin: false } });
    setNewRoleKey('');
    setNewRoleLabel('');
    setUnsavedChanges(true);
  };

  const handleDeleteRole = async (key: string) => {
    if (key === 'ADMIN' || key === 'GUEST') return showAlert('Không thể xóa', 'Không thể xóa vai trò mặc định', 'error');
    const ok = await showConfirm({ title: 'Xóa vai trò', message: `Xóa vai trò ${key}? Các tài khoản đang dùng vai trò này sẽ bị lỗi quyền.`, type: 'danger', confirmText: 'Xóa vai trò' });
    if (ok) {
      const newConfigs = { ...roleConfigs };
      delete newConfigs[key];
      setRoleConfigs(newConfigs);
      setUnsavedChanges(true);
    }
  };

  const handleToggleRolePermission = (key: string, field: 'canEntry' | 'isAdmin') => {
    setRoleConfigs({ ...roleConfigs, [key]: { ...roleConfigs[key], [field]: !roleConfigs[key][field] } });
    setUnsavedChanges(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2"><Shield size={20}/> Quản lý Vai trò</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {Object.entries(roleConfigs).map(([key, config]: [string, RoleConfig]) => (
          <div key={key} className="border p-3 rounded-lg flex flex-col gap-2 relative group hover:border-blue-300 bg-slate-50/50">
            {key !== 'ADMIN' && key !== 'GUEST' && (
              <button onClick={() => handleDeleteRole(key)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
            )}
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full bg-${config.color}-500 shadow-sm`}></div>
              <div>
                <div className="font-bold text-sm text-slate-800">{config.label}</div>
                <div className="text-[10px] text-slate-500 font-mono">{key}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleToggleRolePermission(key, 'canEntry')}
                className={`flex-1 text-xs py-1 rounded border ${config.canEntry ? 'bg-green-100 border-green-200 text-green-700 font-bold' : 'bg-white border-slate-200 text-slate-500'}`}
              >
                {config.canEntry ? 'Được chấm' : 'Không chấm'}
              </button>
              <button
                onClick={() => handleToggleRolePermission(key, 'isAdmin')}
                className={`flex-1 text-xs py-1 rounded border ${config.isAdmin ? 'bg-blue-100 border-blue-200 text-blue-700 font-bold' : 'bg-white border-slate-200 text-slate-500'}`}
              >
                {config.isAdmin ? 'Là Admin' : 'Không Admin'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Thêm vai trò mới</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="flex-1 p-2 border rounded text-sm uppercase" placeholder="Mã (VD: VE_SINH)" value={newRoleKey} onChange={e => setNewRoleKey(e.target.value)} />
          <input className="flex-[2] p-2 border rounded text-sm" placeholder="Tên hiển thị (VD: Ban Vệ Sinh)" value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} />
          <select className="p-2 border rounded text-sm" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)}>
            <option value="gray">Xám</option>
            <option value="red">Đỏ</option>
            <option value="blue">Xanh dương</option>
            <option value="green">Xanh lá</option>
            <option value="purple">Tím</option>
            <option value="orange">Cam</option>
            <option value="indigo">Chàm</option>
          </select>
          <button onClick={handleAddRole} className="bg-blue-600 text-white px-4 rounded font-bold text-sm flex items-center justify-center gap-1"><Plus size={16}/> Thêm</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsRolesTab;
