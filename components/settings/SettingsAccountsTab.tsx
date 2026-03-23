
import React, { useState, useRef } from 'react';
import { Plus, Edit, Trash2, Save, Check, X, FileSpreadsheet, Download } from 'lucide-react';
import { User, RoleConfig } from '../../types';
import { exportToExcel } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import * as XLSX from 'xlsx';

const SettingsAccountsTab: React.FC = () => {
  const { users, setUsers, classes, roleConfigs, currentUser, setCurrentUser, setUnsavedChanges } = useAppStore();
  const { showAlert, showConfirm, showToast } = useModal();

  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('RED_FLAG');
  const [newUserClass, setNewUserClass] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const excelAccountInputRef = useRef<HTMLInputElement>(null);

  const handleAddUser = () => {
    if (!newUserFullName || !newUserUsername || !newUserPassword) return showToast('Vui lòng nhập đầy đủ thông tin bắt buộc', 'error');
    if (users.find(u => u.username === newUserUsername)) return showToast('Tên đăng nhập/Email đã tồn tại', 'error');
    const newUser: User = {
      id: `U${Date.now()}`,
      name: newUserFullName,
      username: newUserUsername,
      password: newUserPassword,
      role: newUserRole,
      className: newUserClass || undefined
    };
    setUsers([...users, newUser]);
    setNewUserFullName('');
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserClass('');
    setUnsavedChanges(true);
  };

  const handleDeleteUser = async (id: string) => {
    if (id === 'U1') return showAlert('Không thể xóa', 'Không thể xóa Admin mặc định', 'error');
    const ok = await showConfirm({ title: 'Xóa tài khoản', message: 'Xóa tài khoản này?', type: 'danger', confirmText: 'Xóa' });
    if (ok) {
      setUsers(users.filter(u => u.id !== id));
      setUnsavedChanges(true);
    }
  };

  const handleSaveUserEdit = () => {
    if (!editingUser) return;
    if (!editingUser.name || !editingUser.username) return showToast('Tên và Username không được để trống', 'error');
    const originalUser = users.find(u => u.id === editingUser.id);
    if (originalUser?.username !== editingUser.username) {
      if (users.find(u => u.username === editingUser.username)) return showToast('Username này đã tồn tại', 'error');
    }
    setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
    if (currentUser.id === editingUser.id) setCurrentUser(editingUser);
    setEditingUser(null);
    setUnsavedChanges(true);
  };

  // --- TẢI FILE EXCEL MẪU ---
  const handleDownloadAccountTemplate = () => {
    const roleKeys = Object.keys(roleConfigs).join(' / ');
    const data = [
      ['Ho_ten', 'Username', 'Password', 'Lop', 'Role'],
      ['Nguyễn Văn A', 'nguyenvana', '123456', '10A1', 'RED_FLAG'],
      ['Trần Thị B', 'tranthib', '123456', '10A2', 'TEACHER'],
      [`(Role hợp lệ: ${roleKeys})`, '', '', '', ''],
    ];
    exportToExcel(data, 'Mau_Import_TaiKhoan');
  };

  // --- IMPORT TỪ EXCEL ---
  const handleImportAccountsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set username đã tồn tại để kiểm tra trùng
    const existingUsernames = new Set(users.map(u => u.username));
    // Set ID đã tồn tại
    const existingIds = new Set(users.map(u => u.id));

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const newUsers: User[] = [];
        let count = 0;
        let dupCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          const [hoTen, username, password, lop, roleRaw] = row;
          const name = String(hoTen || '').trim();
          const uname = String(username || '').trim();
          const pwd = String(password || '').trim();
          const classNameStr = String(lop || '').trim();
          const roleStr = String(roleRaw || '').trim().toUpperCase().replace(/\s/g, '_');

          if (!name || !uname || !pwd) continue;

          if (existingUsernames.has(uname)) {
            dupCount++;
            continue;
          }

          // Map role linh hoạt
          let role = roleConfigs[roleStr] ? roleStr : 'GUEST';
          if (roleStr.includes('CỜ') || roleStr.includes('CO') || roleStr.includes('RED')) role = 'RED_FLAG';
          if (roleStr.includes('NỀN') || roleStr.includes('NEN') || roleStr.includes('DISCIPLINE')) role = 'DISCIPLINE';
          if (roleStr.includes('GV') || roleStr.includes('GIÁO') || roleStr.includes('TEACHER')) role = 'TEACHER';
          if (roleStr.includes('ADMIN')) role = 'ADMIN';
          if (roleStr.includes('BCH')) role = 'BCH';

          const cls = classes.find(c => c.name === classNameStr || c.id === classNameStr);

          // Sinh ID unique: timestamp + index
          let newId = `U_${Date.now()}_${i}`;
          while (existingIds.has(newId)) {
            newId = `U_${Date.now()}_${i}_${Math.floor(Math.random() * 9999)}`;
          }
          existingIds.add(newId);
          existingUsernames.add(uname); // Tránh trùng trong cùng lượt

          newUsers.push({
            id: newId,
            name,
            username: uname,
            password: pwd,
            role,
            className: cls?.id,
          });
          count++;
        }

        e.target.value = '';

        if (count > 0) {
          setUsers([...users, ...newUsers]);
          setUnsavedChanges(true);
          const note = [
            `Đã thêm ${count} tài khoản.`,
            dupCount > 0 ? `Bỏ qua ${dupCount} username đã tồn tại.` : '',
            'Nhớ bấm LƯU.',
          ].filter(Boolean).join(' ');
          showToast(note, 'success');
        } else {
          showToast(`Không có tài khoản hợp lệ.${dupCount > 0 ? ` (${dupCount} username đã tồn tại)` : ''}`, 'error');
        }
      } catch (err) {
        e.target.value = '';
        showToast('Không thể đọc file Excel. Hãy kiểm tra lại định dạng file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800">Quản lý Tài khoản</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAccountTemplate}
              className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold border border-blue-200"
              title="Tải file Excel mẫu"
            >
              <Download size={15}/> Tải mẫu
            </button>
            <input type="file" ref={excelAccountInputRef} onChange={handleImportAccountsExcel} accept=".xlsx,.xls" className="hidden"/>
            <button
              onClick={() => excelAccountInputRef.current?.click()}
              className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200"
              title="Import tài khoản từ file Excel"
            >
              <FileSpreadsheet size={15}/> Import Excel
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input className="p-2 border rounded text-sm" placeholder="Họ tên" value={newUserFullName} onChange={e => setNewUserFullName(e.target.value)}/>
          <input className="p-2 border rounded text-sm" placeholder="Username/Email" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)}/>
          <input className="p-2 border rounded text-sm" type="password" placeholder="Mật khẩu" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)}/>
          <select className="p-2 border rounded text-sm bg-white" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
            {Object.entries(roleConfigs).map(([key, config]: [string, RoleConfig]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select className="flex-1 p-2 border rounded text-sm bg-white" value={newUserClass} onChange={e => setNewUserClass(e.target.value)}>
              <option value="">- Chọn Lớp -</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={handleAddUser} className="bg-blue-600 text-white px-3 rounded font-bold"><Plus size={18}/></button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
              <tr>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Lớp</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const config = roleConfigs[u.role] || roleConfigs['GUEST'] || { color: 'gray', label: u.role };
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {u.name} {u.id === 'U1' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-1">DEFAULT</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold bg-${config.color}-100 text-${config.color}-700`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.className || '-'}</td>
                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                      <button onClick={() => setEditingUser({ ...u })} className="text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                      {u.id !== 'U1' && <button onClick={() => handleDeleteUser(u.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chỉnh sửa tài khoản */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Chỉnh sửa tài khoản</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ tên</label>
                <input className="w-full p-2 border rounded-lg" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username / Email</label>
                <input className="w-full p-2 border rounded-lg bg-slate-50" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới (Để trống nếu không đổi)</label>
                <input className="w-full p-2 border rounded-lg" type="password" placeholder="******" onChange={e => { if(e.target.value) setEditingUser({...editingUser, password: e.target.value}) }}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai trò &amp; Màu sắc</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {Object.entries(roleConfigs).map(([key, config]: [string, RoleConfig]) => (
                    <button
                      key={key}
                      onClick={() => setEditingUser({...editingUser, role: key})}
                      className={`p-2 rounded-lg border text-sm flex items-center justify-between transition-all ${editingUser.role === key ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full bg-${config.color}-500 shadow-sm`}></span>
                        {config.label}
                      </span>
                      {editingUser.role === key && <Check size={14} className="text-blue-600"/>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phụ trách Lớp (Tùy chọn)</label>
                <select className="w-full p-2 border rounded-lg bg-white" value={editingUser.className || ''} onChange={e => setEditingUser({...editingUser, className: e.target.value})}>
                  <option value="">-- Không phụ trách --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-slate-50 p-4 border-t flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Hủy</button>
              <button onClick={handleSaveUserEdit} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save size={18}/> Lưu thông tin
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsAccountsTab;
