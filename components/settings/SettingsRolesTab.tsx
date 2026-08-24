import React, { useState } from 'react';
import { Plus, Trash2, Shield, Check, Save, Loader2, Info } from 'lucide-react';
import { PermissionKey, RoleConfig } from '../../types';
import { EMPTY_PERMISSIONS, PERMISSION_GROUPS } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

/**
 * Quản lý vai trò và 12 quyền của hệ thống.
 *
 * Quyền ở đây không chỉ ẩn nút trên giao diện: khi lưu, bảng quyền được ghi
 * xuống cơ sở dữ liệu và chính quy tắc bảo mật đọc bảng đó để chặn từ gốc.
 */
const SettingsRolesTab: React.FC = () => {
  const { roleConfigs, setRoleConfigs, saveRoleConfigs } = useAppStore();
  const { showAlert, showConfirm, showToast } = useModal();

  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('gray');
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const roleKeys = Object.keys(roleConfigs);

  const handleAddRole = () => {
    if (!newRoleKey || !newRoleLabel) return showToast('Mã vai trò và tên hiển thị không được trống', 'error');
    const key = newRoleKey.toUpperCase().replace(/\s/g, '_');
    if (roleConfigs[key]) return showToast('Mã vai trò này đã tồn tại', 'error');
    setRoleConfigs({ ...roleConfigs, [key]: { label: newRoleLabel, color: newRoleColor, ...EMPTY_PERMISSIONS } });
    setNewRoleKey('');
    setNewRoleLabel('');
    setDirty(true);
  };

  const handleDeleteRole = async (key: string) => {
    if (key === 'ADMIN' || key === 'GUEST') {
      return showAlert('Không thể xoá', 'Quản trị viên và Khách là hai vai trò gốc của hệ thống.', 'error');
    }
    const ok = await showConfirm({
      title: 'Xoá vai trò',
      message: `Xoá vai trò ${key}? Tài khoản đang mang vai trò này sẽ mất hết quyền cho tới khi được gán vai trò khác.`,
      type: 'danger',
      confirmText: 'Xoá vai trò',
    });
    if (ok) {
      const next = { ...roleConfigs };
      delete next[key];
      setRoleConfigs(next);
      setDirty(true);
    }
  };

  const togglePermission = (key: string, permission: PermissionKey) => {
    // Không cho tự khoá mình ra ngoài: quản trị viên luôn giữ quyền quản lý tài khoản
    if (key === 'ADMIN' && permission === 'manageAccounts' && roleConfigs[key].manageAccounts) {
      return showToast('Quản trị viên phải giữ quyền quản lý tài khoản, nếu không sẽ không ai cấp được tài khoản nữa', 'error');
    }
    setRoleConfigs({
      ...roleConfigs,
      [key]: { ...roleConfigs[key], [permission]: !roleConfigs[key][permission] } as RoleConfig,
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await saveRoleConfigs(roleConfigs);
    setIsSaving(false);
    if (ok) setDirty(false);
    showToast(ok ? 'Đã lưu bảng quyền' : 'Lưu thất bại, vui lòng thử lại', ok ? 'success' : 'error');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Shield size={20} /> Vai trò và quyền</h3>
            <p className="text-sm text-slate-500 mt-0.5">Bấm vào ô để bật hoặc tắt quyền của từng vai trò.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || !dirty}
            className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-40"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {dirty ? 'Lưu thay đổi' : 'Đã lưu'}
          </button>
        </div>

        {/* Bảng quyền: hàng là quyền, cột là vai trò */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-slate-600 min-w-[240px]">Quyền</th>
                {roleKeys.map(key => (
                  <th key={key} className="px-2 py-2 text-center font-bold text-slate-600 whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`w-2.5 h-2.5 rounded-full bg-${roleConfigs[key].color}-500`} />
                      <span className="text-xs">{roleConfigs[key].label}</span>
                      {key !== 'ADMIN' && key !== 'GUEST' && (
                        <button onClick={() => handleDeleteRole(key)} title={`Xoá vai trò ${key}`}
                          className="text-slate-300 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map(group => (
                <React.Fragment key={group.group}>
                  <tr className="bg-slate-100/70">
                    <td colSpan={roleKeys.length + 1} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {group.group}
                    </td>
                  </tr>
                  {group.items.map(item => (
                    <tr key={item.key} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{item.label}</div>
                        <div className="text-xs text-slate-400 leading-snug">{item.hint}</div>
                      </td>
                      {roleKeys.map(key => {
                        const on = roleConfigs[key][item.key];
                        return (
                          <td key={key} className="px-2 py-2 text-center">
                            <button
                              onClick={() => togglePermission(key, item.key)}
                              title={`${roleConfigs[key].label}: ${on ? 'đang có quyền' : 'chưa có quyền'} ${item.label.toLowerCase()}`}
                              className={`w-7 h-7 rounded-md border flex items-center justify-center mx-auto transition-colors ${
                                on ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-slate-200 text-transparent hover:border-slate-300'
                              }`}
                            >
                              <Check size={15} strokeWidth={3} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 flex items-start gap-1.5 mt-3">
          <Info size={14} className="mt-0.5 shrink-0" />
          Quyền "Chỉ xem lớp phụ trách" là giới hạn chứ không phải mở rộng: bật lên thì vai trò đó chỉ
          xem được lớp mình phụ trách. Bảng quyền có hiệu lực ngay sau khi lưu, kể cả với người đang đăng nhập.
        </p>
      </div>

      {/* Thêm vai trò mới */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h4 className="font-bold text-slate-800 mb-3">Thêm vai trò mới</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="p-2 border border-slate-300 rounded text-sm" placeholder="Mã (VD: TO_TRUONG)"
            value={newRoleKey} onChange={e => setNewRoleKey(e.target.value)} />
          <input className="p-2 border border-slate-300 rounded text-sm" placeholder="Tên hiển thị (VD: Tổ trưởng)"
            value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} />
          <select className="p-2 border border-slate-300 rounded text-sm bg-white"
            value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)}>
            {['gray', 'blue', 'red', 'green', 'purple', 'orange', 'indigo'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button onClick={handleAddRole} className="bg-blue-600 text-white px-4 rounded font-bold text-sm flex items-center justify-center gap-1">
            <Plus size={16} /> Thêm
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Vai trò mới chưa có quyền nào, bật thêm trong bảng phía trên rồi bấm Lưu.</p>
      </div>
    </div>
  );
};

export default SettingsRolesTab;
