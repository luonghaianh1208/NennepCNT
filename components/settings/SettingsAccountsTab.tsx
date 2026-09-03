
import React, { useState, useRef } from 'react';
import { Plus, Edit, Trash2, Save, Check, X, FileSpreadsheet, Download, KeyRound, Lock, Unlock } from 'lucide-react';
import { User, RoleConfig } from '../../types';
import { exportToExcel } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import { accounts, userMessage } from '../../services/firebase';

const SettingsAccountsTab: React.FC = () => {
  const { users, setUsers, classes, roleConfigs, currentUser, setCurrentUser, refreshData, syncUsers } = useAppStore();
  const { showAlert, showConfirm, showToast } = useModal();

  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('RED_FLAG');
  const [newUserClass, setNewUserClass] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const excelAccountInputRef = useRef<HTMLInputElement>(null);

  // Tài khoản do Cloud Function tạo: người dùng nhận email tự đặt mật khẩu,
  // quản trị viên không đặt hộ mật khẩu cho ai
  const handleAddUser = async () => {
    if (!newUserFullName || !newUserUsername) return showToast('Nhập họ tên và email', 'error');
    if (!newUserUsername.includes('@')) return showToast('Tài khoản phải là email thật để nhận thư đặt mật khẩu', 'error');
    if (users.find(u => u.username === newUserUsername || u.email === newUserUsername)) {
      return showToast('Email này đã có tài khoản', 'error');
    }

    setBusy(true);
    try {
      await accounts.create({
        name: newUserFullName,
        email: newUserUsername,
        role: newUserRole,
        className: newUserClass || '',
      });
      setNewUserFullName('');
      setNewUserUsername('');
      setNewUserClass('');
      await refreshData();
      showToast('Đã tạo tài khoản. Thư đặt mật khẩu đã gửi tới email của người dùng.', 'success');
    } catch (e: any) {
      showToast(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Xoá hẳn chỉ được phép khi tài khoản chưa từng nhập bản ghi nào; còn lại thì khoá
  const handleDeleteUser = async (id: string) => {
    const ok = await showConfirm({
      title: 'Xoá tài khoản',
      message: 'Xoá vĩnh viễn tài khoản này? Nếu người này đã từng nhập dữ liệu, hệ thống sẽ chỉ cho khoá để giữ dấu vết người nhập liệu.',
      type: 'danger',
      confirmText: 'Xoá',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await accounts.remove(id);
      await refreshData();
      showToast('Đã xoá tài khoản.', 'success');
    } catch (e: any) {
      showAlert('Không xoá được', userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async (u: User & { active?: boolean }) => {
    const willActivate = u.active === false;
    setBusy(true);
    try {
      await accounts.setStatus(u.id, willActivate);
      await refreshData();
      showToast(willActivate ? 'Đã mở khoá tài khoản.' : 'Đã khoá đăng nhập của tài khoản này.', 'success');
    } catch (e: any) {
      showToast(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendReset = async (u: User) => {
    const email = u.email || u.username;
    if (!email?.includes('@')) return showToast('Tài khoản này chưa có email hợp lệ', 'error');
    setBusy(true);
    try {
      await accounts.sendReset(email);
      showToast(`Đã gửi thư đặt lại mật khẩu tới ${email}`, 'success');
    } catch (e: any) {
      showToast(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    if (!editingUser.name) return showToast('Tên không được để trống', 'error');

    const original = users.find(u => u.id === editingUser.id);
    setBusy(true);
    try {
      // Vai trò nằm trong custom claim của Firebase Auth nên phải đi qua Cloud Function
      if (original && original.role !== editingUser.role) {
        await accounts.setRole(editingUser.id, editingUser.role);
      }
      setUsers(users.map(u => (u.id === editingUser.id ? editingUser : u)));
      if (currentUser.id === editingUser.id) setCurrentUser(editingUser);
      await syncUsers();
      setEditingUser(null);
      showToast('Đã lưu thông tin tài khoản!', 'success');
    } catch (e: any) {
      showAlert('Không lưu được', userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // --- TẢI FILE EXCEL MẪU ---
  const handleDownloadAccountTemplate = () => {
    const roleKeys = Object.keys(roleConfigs).join(' / ');
    const data = [
      ['Ho_ten', 'Email', 'Lop', 'Role'],
      ['Nguyễn Văn A', 'nguyenvana@truong.edu.vn', '10A1', 'RED_FLAG'],
      ['Trần Thị B', 'tranthib@truong.edu.vn', '10A2', 'TEACHER'],
      [`(Role hợp lệ: ${roleKeys})`, 'Mỗi người nhận email tự đặt mật khẩu', '', ''],
    ];
    exportToExcel(data, 'Mau_Import_TaiKhoan');
  };

  // --- IMPORT TỪ EXCEL ---
  const handleImportAccountsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const existingEmails = new Set(users.map(u => (u.email || u.username || '').toLowerCase()));

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const pending: { name: string; email: string; role: string; className: string }[] = [];
        let dupCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          const [hoTen, emailRaw, lop, roleRaw] = row;
          const name = String(hoTen || '').trim();
          const email = String(emailRaw || '').trim().toLowerCase();
          const classNameStr = String(lop || '').trim();
          const roleStr = String(roleRaw || '').trim().toUpperCase().replace(/\s/g, '_');

          if (!name || !email.includes('@')) continue;
          if (existingEmails.has(email)) {
            dupCount++;
            continue;
          }
          existingEmails.add(email);

          // Map role linh hoạt
          let role = roleConfigs[roleStr] ? roleStr : 'GUEST';
          if (roleStr.includes('CỜ') || roleStr.includes('CO') || roleStr.includes('RED')) role = 'RED_FLAG';
          if (roleStr.includes('NỀN') || roleStr.includes('NEN') || roleStr.includes('DISCIPLINE')) role = 'DISCIPLINE';
          if (roleStr.includes('GV') || roleStr.includes('GIÁO') || roleStr.includes('TEACHER')) role = 'TEACHER';
          if (roleStr.includes('ADMIN')) role = 'ADMIN';
          if (roleStr.includes('BCH')) role = 'BCH';

          const cls = classes.find(c => c.name === classNameStr || c.id === classNameStr);
          pending.push({ name, email, role, className: cls?.id ?? '' });
        }

        e.target.value = '';

        if (!pending.length) {
          showToast(`Không có tài khoản hợp lệ.${dupCount > 0 ? ` (${dupCount} email đã tồn tại)` : ''}`, 'error');
          return;
        }

        setBusy(true);
        showToast(`Đang tạo ${pending.length} tài khoản và gửi thư đặt mật khẩu...`, 'info');
        try {
          // Cloud Function nhận tối đa 200 mỗi lượt
          let created = 0;
          const failed: { email: string; reason: string }[] = [];
          for (let i = 0; i < pending.length; i += 200) {
            const res = await accounts.importMany(pending.slice(i, i + 200));
            created += res.created.length;
            failed.push(...res.failed);
          }
          await refreshData();

          const note = [
            `Đã tạo ${created} tài khoản, mỗi người nhận một email đặt mật khẩu.`,
            dupCount > 0 ? `Bỏ qua ${dupCount} email đã tồn tại.` : '',
            failed.length ? `${failed.length} dòng lỗi: ${failed.slice(0, 3).map(f => f.email).join(', ')}...` : '',
          ].filter(Boolean).join(' ');
          showAlert(failed.length ? 'Hoàn tất, có dòng lỗi' : 'Hoàn tất', note, failed.length ? 'info' : 'success');
        } catch (err: any) {
          showAlert('Không tạo được tài khoản', userMessage(err), 'error');
        } finally {
          setBusy(false);
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
          <input className="p-2 border rounded text-sm" type="email" placeholder="Email nhận thư đặt mật khẩu" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)}/>
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
            <button onClick={handleAddUser} disabled={busy} className="bg-blue-600 text-white px-3 rounded font-bold disabled:opacity-50"><Plus size={18}/></button>
          </div>
        </div>

        <p className="text-xs text-slate-500 -mt-2 mb-4">
          Người dùng tự đặt mật khẩu qua thư hệ thống gửi — quản trị viên không cần (và không thể) đặt hộ mật khẩu.
        </p>

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
                      {u.name}
                      {(u as any).active === false && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1 rounded ml-1">ĐÃ KHOÁ</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold bg-${config.color}-100 text-${config.color}-700`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.className || '-'}</td>
                    {/* Bốn nút 16px sát nhau, nút ngoài cùng là xoá vĩnh viễn đứng ngay
                        cạnh nút sửa — trên điện thoại là bẫy chạm nhầm. Vùng chạm 44px
                        và tách nút xoá ra xa bằng một vạch ngăn. */}
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-1">
                        <button onClick={() => handleSendReset(u)} disabled={busy} title="Gửi thư đặt lại mật khẩu"
                          className="text-slate-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-40 rounded-lg w-11 h-11 inline-flex items-center justify-center"><KeyRound size={16}/></button>
                        <button onClick={() => handleToggleStatus(u as any)} disabled={busy}
                          title={(u as any).active === false ? 'Mở khoá đăng nhập' : 'Khoá đăng nhập (giữ nguyên dữ liệu đã nhập)'}
                          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 rounded-lg w-11 h-11 inline-flex items-center justify-center">
                          {(u as any).active === false ? <Unlock size={16}/> : <Lock size={16}/>}
                        </button>
                        <button onClick={() => setEditingUser({ ...u })} title="Sửa thông tin"
                          className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg w-11 h-11 inline-flex items-center justify-center"><Edit size={16}/></button>
                        <span className="w-px h-6 bg-slate-200 mx-1" aria-hidden="true" />
                        <button onClick={() => handleDeleteUser(u.id)} disabled={busy} title="Xoá vĩnh viễn tài khoản"
                          className="text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-lg w-11 h-11 inline-flex items-center justify-center"><Trash2 size={16}/></button>
                      </div>
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email đăng nhập</label>
                <input className="w-full p-2 border rounded-lg bg-slate-100 text-slate-500" value={editingUser.email || editingUser.username} readOnly/>
                <p className="text-xs text-slate-500 mt-1">
                  Email là danh tính đăng nhập nên không sửa tại đây. Cần đổi thì tạo tài khoản mới rồi khoá tài khoản cũ.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu</label>
                <button
                  onClick={() => handleSendReset(editingUser)}
                  disabled={busy}
                  className="w-full p-2 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:bg-amber-100 disabled:opacity-50"
                >
                  <KeyRound size={16}/> Gửi thư đặt lại mật khẩu
                </button>
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
