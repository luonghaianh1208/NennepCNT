import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Save, X, FileSpreadsheet, Download, Lock, Unlock, RefreshCw, Info } from 'lucide-react';
import { RoleConfig } from '../../types';
import { exportToExcel } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import { accounts, userMessage, type AllowlistEntry } from '../../services/firebase';

/**
 * Danh sách người được vào hệ thống.
 *
 * Hệ thống đăng nhập bằng tài khoản Google nên ở đây KHÔNG tạo tài khoản và
 * không có mật khẩu nào cả — chỉ ghi email vào danh sách. Ai đăng nhập Google
 * mà email nằm trong danh sách thì được gắn vai trò ngay lần đầu.
 *
 * Cột "Trạng thái" cho biết ai đã thực sự vào hệ thống lần nào chưa — thứ mà
 * cách cũ (gửi thư đặt mật khẩu) không bao giờ biết được.
 */
const SettingsAccountsTab: React.FC = () => {
  const { classes, roleConfigs, currentUser } = useAppStore();
  const { showAlert, showConfirm, showToast } = useModal();

  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('RED_FLAG');
  const [newClass, setNewClass] = useState('');
  const [editing, setEditing] = useState<AllowlistEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await accounts.list();
      setEntries(list.sort((a, b) => a.name.localeCompare(b.name, 'vi')));
    } catch (e: any) {
      showToast(userMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void reload(); }, [reload]);

  const handleAdd = async () => {
    if (!newName.trim()) return showToast('Nhập họ tên', 'error');
    if (!newEmail.includes('@')) return showToast('Nhập địa chỉ Google (Gmail hoặc email nhà trường)', 'error');

    setBusy(true);
    try {
      await accounts.create({ name: newName.trim(), email: newEmail.trim(), role: newRole, className: newClass });
      setNewName('');
      setNewEmail('');
      setNewClass('');
      await reload();
      showToast('Đã cấp quyền. Người này đăng nhập bằng Google là vào được ngay.', 'success');
    } catch (e: any) {
      showToast(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (entry: AllowlistEntry) => {
    const ok = await showConfirm({
      title: 'Thu hồi quyền truy cập',
      message: `Xoá ${entry.email} khỏi danh sách?\n\nNếu người này đã từng nhập dữ liệu, hệ thống sẽ chỉ cho khoá để giữ nguyên dấu vết người nhập liệu.`,
      type: 'danger',
      confirmText: 'Xoá khỏi danh sách',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await accounts.remove(entry.email);
      await reload();
      showToast('Đã thu hồi quyền truy cập.', 'success');
    } catch (e: any) {
      showAlert('Không xoá được', userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async (entry: AllowlistEntry) => {
    const willActivate = entry.active === false;
    setBusy(true);
    try {
      await accounts.setStatus(entry.email, willActivate);
      await reload();
      showToast(willActivate ? 'Đã mở khoá.' : 'Đã khoá — người này không đăng nhập được nữa.', 'success');
    } catch (e: any) {
      showToast(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const original = entries.find(e => e.email === editing.email);
    setBusy(true);
    try {
      if (original && original.role !== editing.role) {
        await accounts.setRole(editing.email, editing.role);
      }
      await reload();
      setEditing(null);
      showToast('Đã lưu.', 'success');
    } catch (e: any) {
      showAlert('Không lưu được', userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadTemplate = () => {
    const roleKeys = Object.keys(roleConfigs).join(' / ');
    exportToExcel([
      ['Ho_ten', 'Email_Google', 'Lop', 'Vai_tro'],
      ['Nguyễn Văn A', 'nguyenvana@gmail.com', '10A1', 'RED_FLAG'],
      ['Trần Thị B', 'tranthib@thpt-abc.edu.vn', '10A2', 'TEACHER'],
      [`(Vai trò hợp lệ: ${roleKeys})`, 'Phải là địa chỉ đăng nhập Google được', '', ''],
    ], 'Mau_Cap_Quyen_Truy_Cap');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const existing = new Set(entries.map(u => u.email.toLowerCase()));
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });

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
          if (existing.has(email)) { dupCount++; continue; }
          existing.add(email);

          // Khớp mờ tên vai trò để người nhập gõ tiếng Việt cũng được
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
          showToast(`Không có dòng hợp lệ.${dupCount > 0 ? ` (${dupCount} email đã có trong danh sách)` : ''}`, 'error');
          return;
        }

        setBusy(true);
        try {
          let created = 0;
          const failed: { email: string; reason: string }[] = [];
          // Máy chủ nhận tối đa 200 mỗi lượt
          for (let i = 0; i < pending.length; i += 200) {
            const res = await accounts.importMany(pending.slice(i, i + 200));
            created += res.created.length;
            failed.push(...res.failed);
          }
          await reload();

          showAlert(
            failed.length ? 'Hoàn tất, có dòng lỗi' : 'Hoàn tất',
            [
              `Đã cấp quyền cho ${created} người. Họ đăng nhập bằng Google là vào được ngay, không cần chờ thư.`,
              dupCount > 0 ? `Bỏ qua ${dupCount} email đã có trong danh sách.` : '',
              failed.length ? `${failed.length} dòng lỗi: ${failed.slice(0, 3).map(f => f.email).join(', ')}…` : '',
            ].filter(Boolean).join('\n\n'),
            failed.length ? 'info' : 'success',
          );
        } catch (err: any) {
          showAlert('Không cấp quyền được', userMessage(err), 'error');
        } finally {
          setBusy(false);
        }
      } catch {
        e.target.value = '';
        showToast('Không đọc được file Excel. Kiểm tra lại định dạng file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="font-bold text-lg text-slate-800">Ai được vào hệ thống</h3>
          <div className="flex items-center gap-2">
            <button onClick={reload} disabled={loading}
              className="flex items-center gap-1 text-sm bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-bold border border-slate-200 disabled:opacity-50"
              title="Tải lại danh sách">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleDownloadTemplate}
              className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold border border-blue-200"
              title="Tải file Excel mẫu">
              <Download size={15} /> Tải mẫu
            </button>
            <input type="file" ref={excelInputRef} onChange={handleImportExcel} accept=".xlsx,.xls" className="hidden" />
            <button onClick={() => excelInputRef.current?.click()} disabled={busy}
              className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200 disabled:opacity-50"
              title="Cấp quyền hàng loạt từ file Excel">
              <FileSpreadsheet size={15} /> Nhập Excel
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-600 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <span>
            Hệ thống đăng nhập bằng <strong>tài khoản Google</strong>. Ở đây chỉ cần ghi đúng địa chỉ
            Google của từng người — không tạo mật khẩu, không gửi thư, người dùng vào được ngay.
            Ghi sai địa chỉ thì người đó đăng nhập sẽ báo "chưa được cấp quyền".
          </span>
        </p>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="acc-name" className="block text-xs font-bold text-slate-600 mb-1">Họ tên</label>
            <input id="acc-name" className="w-full p-2 border border-slate-300 rounded text-sm"
              placeholder="Nguyễn Văn A" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="acc-email" className="block text-xs font-bold text-slate-600 mb-1">Địa chỉ Google</label>
            <input id="acc-email" type="email" className="w-full p-2 border border-slate-300 rounded text-sm"
              placeholder="nguyenvana@gmail.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="acc-role" className="block text-xs font-bold text-slate-600 mb-1">Vai trò</label>
            <select id="acc-role" className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
              value={newRole} onChange={e => setNewRole(e.target.value)}>
              {Object.entries(roleConfigs).map(([key, config]: [string, RoleConfig]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="acc-class" className="block text-xs font-bold text-slate-600 mb-1">Lớp phụ trách</label>
            <div className="flex gap-2">
              <select id="acc-class" className="flex-1 p-2 border border-slate-300 rounded text-sm bg-white"
                value={newClass} onChange={e => setNewClass(e.target.value)}>
                <option value="">- Không giới hạn -</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleAdd} disabled={busy} title="Thêm vào danh sách"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded font-bold disabled:opacity-50">
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
              <tr>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Địa chỉ Google</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Lớp</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Đang tải danh sách…</td></tr>
              )}
              {!loading && !entries.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Chưa có ai trong danh sách. Thêm ở ô phía trên hoặc nhập từ Excel.
                </td></tr>
              )}
              {entries.map(entry => {
                const config = roleConfigs[entry.role] || roleConfigs['GUEST'] || { color: 'gray', label: entry.role };
                const locked = entry.active === false;
                const isMe = entry.email === (currentUser.email || '').toLowerCase();
                return (
                  <tr key={entry.email} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {entry.name}
                      {isMe && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1.5">bạn</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{entry.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold bg-${config.color}-100 text-${config.color}-700`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {classes.find(c => c.id === entry.className)?.name || entry.className || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {locked ? (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold">ĐÃ KHOÁ</span>
                      ) : entry.uid ? (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold">ĐANG DÙNG</span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold">CHƯA VÀO LẦN NÀO</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-1">
                        <button onClick={() => handleToggleStatus(entry)} disabled={busy}
                          title={locked ? 'Mở khoá' : 'Khoá đăng nhập (giữ nguyên dữ liệu đã nhập)'}
                          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 rounded-lg w-11 h-11 inline-flex items-center justify-center">
                          {locked ? <Unlock size={16} /> : <Lock size={16} />}
                        </button>
                        <button onClick={() => setEditing({ ...entry })} title="Đổi vai trò"
                          className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg w-11 h-11 inline-flex items-center justify-center">
                          <Edit size={16} />
                        </button>
                        <span className="w-px h-6 bg-slate-200 mx-1" aria-hidden="true" />
                        <button onClick={() => handleDelete(entry)} disabled={busy} title="Thu hồi quyền truy cập"
                          className="text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-lg w-11 h-11 inline-flex items-center justify-center">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sửa vai trò ────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog" aria-modal="true" aria-label="Sửa vai trò">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 my-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{editing.name}</h3>
                <p className="text-sm text-slate-500">{editing.email}</p>
              </div>
              <button onClick={() => setEditing(null)} aria-label="Đóng"
                className="text-slate-500 hover:text-slate-700 w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <label htmlFor="edit-role" className="block text-xs font-bold text-slate-600 mb-1">Vai trò</label>
            <select id="edit-role" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white mb-4"
              value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>
              {Object.entries(roleConfigs).map(([key, config]: [string, RoleConfig]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Đổi vai trò có hiệu lực <strong>ngay lập tức</strong>, kể cả với người đang mở ứng dụng —
              màn hình của họ tự cập nhật quyền mới trong vài giây, không cần đăng xuất.
              Muốn đổi <em>quyền của từng vai trò</em> thì sang tab <strong>Vai trò</strong>.
            </p>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Huỷ
              </button>
              <button onClick={handleSaveEdit} disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                <Save size={16} /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsAccountsTab;
