
import React, { useState, useRef, useMemo } from 'react';
import { Upload, Trash2, FileSpreadsheet, Download } from 'lucide-react';
import { Student } from '../../types';
import { removeVietnameseTones, exportToExcel, toISODate, formatDateDisplay } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

const SettingsStudentsTab: React.FC = () => {
  const { classes, students, setStudents, setUnsavedChanges } = useAppStore();
  const { showToast, showConfirm } = useModal();

  const [selectedClassForStudent, setSelectedClassForStudent] = useState(classes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentDob, setNewStudentDob] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const excelStudentInputRef = useRef<HTMLInputElement>(null);

  const classStudents = useMemo(
    () => students.filter(s => s.classId === selectedClassForStudent),
    [students, selectedClassForStudent]
  );

  // Đổi lớp thì bỏ hết lựa chọn cũ — tránh xoá nhầm em ở lớp không còn nhìn thấy
  const handleChangeClass = (classId: string) => {
    setSelectedClassForStudent(classId);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const allSelected = classStudents.length > 0 && selectedIds.size === classStudents.length;

  const handleToggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(classStudents.map(s => s.id)));
  };

  const handleDeleteSelected = async () => {
    const victims = classStudents.filter(s => selectedIds.has(s.id));
    if (victims.length === 0) return;

    // Đọc tên vài em đầu để người bấm thấy rõ mình đang xoá đúng nhóm nào
    const preview = victims.slice(0, 5).map(s => `• ${s.name}`).join('\n');
    const more = victims.length > 5 ? `\n• …và ${victims.length - 5} em nữa` : '';
    const ok = await showConfirm({
      title: `Xoá ${victims.length} học sinh`,
      message: `Xoá ${victims.length} em khỏi lớp này?\n\n${preview}${more}\n\nCác bản ghi vi phạm đã có của các em vẫn giữ nguyên, nhưng sẽ không tra được tên nữa.`,
      type: 'danger',
      confirmText: `Xoá ${victims.length} học sinh`,
    });
    if (!ok) return;

    setStudents(students.filter(s => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setUnsavedChanges(true);
    showToast(`Đã xoá ${victims.length} học sinh. Nhớ bấm LƯU để đồng bộ.`, 'success');
  };

  const handleAddStudent = () => {
    if (!newStudentName || !selectedClassForStudent) return;
    // Hai em trùng tên trong cùng lớp phải khác ID, nên ghép thêm ngày sinh vào ID
    const dobPart = newStudentDob ? `_${newStudentDob.replace(/-/g, '')}` : '';
    const safeId = `S_${selectedClassForStudent}_${removeVietnameseTones(newStudentName).replace(/\s+/g, '')}${dobPart}`.toUpperCase();
    if (students.find(s => s.id === safeId)) {
      showToast('Học sinh này đã tồn tại trong lớp', 'error');
      return;
    }
    setStudents([...students, {
      id: safeId,
      name: newStudentName,
      classId: selectedClassForStudent,
      dob: newStudentDob || undefined,
    }]);
    setNewStudentName('');
    setNewStudentDob('');
    setUnsavedChanges(true);
  };

  // Đây là chỗ duy nhất trong Cấu hình từng xoá ngay không hỏi lại, mà nút thùng
  // rác lại nhỏ và sát mép phải — trên điện thoại rất dễ chạm nhầm
  const handleDeleteStudent = async (id: string) => {
    const student = students.find(s => s.id === id);
    const ok = await showConfirm({
      title: 'Xoá học sinh',
      message: `Xoá "${student?.name || id}" khỏi danh sách lớp?\n\nCác bản ghi vi phạm đã có của em này vẫn giữ nguyên, nhưng sẽ không tra được tên nữa.`,
      type: 'danger',
      confirmText: 'Xoá học sinh',
    });
    if (!ok) return;
    setStudents(students.filter(s => s.id !== id));
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setUnsavedChanges(true);
  };

  // --- TẢI FILE EXCEL MẪU ---
  const handleDownloadStudentTemplate = () => {
    const data = [
      ['Ten_lop', 'Ho_ten_HS', 'Ngay_sinh', 'So_xe'],
      ['10A1', 'Nguyễn Văn A', '12/05/2009', '29B1-12345'],
      ['10A1', 'Trần Thị B', '03/11/2009', ''],
      ['10A2', 'Lê Văn C', '', '51B2-67890'],
    ];
    exportToExcel(data, 'Mau_Import_HocSinh');
  };

  // --- IMPORT TỪ EXCEL ---
  const handleImportStudentsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Build set của ID đã tồn tại để kiểm tra trùng
    const existingIds = new Set(students.map(s => s.id));

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // ── DÒ CỘT THEO TÊN TIÊU ĐỀ ──────────────────────────────────────────
        // File mẫu cũ chỉ có 3 cột (Ten_lop, Ho_ten_HS, So_xe), file mẫu mới có
        // thêm Ngay_sinh chen vào giữa. Đọc theo tên tiêu đề thì cả file cũ lẫn
        // file mới đều vào đúng cột, không cần trường nhập lại từ đầu.
        const normHeader = (v: any) =>
          removeVietnameseTones(String(v ?? '')).toLowerCase().replace(/[^a-z0-9]/g, '');
        const header = (rows[0] || []).map(normHeader);
        const findCol = (...keys: string[]) =>
          header.findIndex(h => h && keys.some(k => h === k || h.includes(k)));

        let colClass = findCol('tenlop', 'lop');
        let colName = findCol('hotenhs', 'hoten', 'hovaten');
        let colDob = findCol('ngaysinh', 'sinhngay', 'namsinh');
        let colBike = findCol('soxe', 'bienso', 'bienkiemsoat');

        // File không có dòng tiêu đề nhận diện được — quay về thứ tự cột mẫu mới
        if (colClass < 0 || colName < 0) {
          colClass = 0;
          colName = 1;
          colDob = 2;
          colBike = 3;
        }

        const newStudents: Student[] = [];
        let count = 0;
        let missingClassCount = 0;
        let badDobCount = 0;

        // ── ATOMIC COUNTER: đảm bảo mỗi ID là duy nhất tuyệt đối ──────────────
        // Khởi từ Date.now(), tăng đều sau mỗi dòng → không bao giờ trùng
        // dù vòng lặp chạy đồng bộ trong cùng millisecond.
        let seq = Date.now();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          const className = String(row[colClass] ?? '').trim();
          const studentName = String(row[colName] ?? '').trim();
          if (!className || !studentName) continue;

          // Ngày sinh nhận cả số thứ tự Excel lẫn dd/mm/yyyy người Việt hay gõ.
          // Ô để trống là hợp lệ — trường nào chưa có dữ liệu thì bỏ qua.
          const rawDob = colDob >= 0 ? row[colDob] : '';
          const hasDob = rawDob !== '' && rawDob !== null && rawDob !== undefined;
          const dob = hasDob ? toISODate(rawDob) : '';
          if (hasDob && !dob) badDobCount++;

          const soXe = colBike >= 0 ? row[colBike] : '';

          const cls = classes.find(c =>
            c.name.toLowerCase() === className.toLowerCase() ||
            c.id.toLowerCase() === className.toLowerCase()
          );

          if (!cls) {
            missingClassCount++;
            continue;
          }

          // Sinh ID: S_<classId>_<seq> — seq luôn tăng nên không bao giờ trùng
          // kể cả 2 HS cùng tên cùng lớp, hay khác lớp, hay nhiều lần import
          let newId = `S_${cls.id}_${seq}`.toUpperCase();
          seq++; // Tăng trước khi vào vòng while để fallback cũng an toàn
          while (existingIds.has(newId)) {
            newId = `S_${cls.id}_${seq}`.toUpperCase();
            seq++;
          }
          existingIds.add(newId); // Đánh dấu đã dùng — ngăn trùng trong cùng lượt

          newStudents.push({
            id: newId,
            name: studentName,
            classId: cls.id,
            dob: dob || undefined,
            bikeNumber: String(soXe || '').trim() || undefined,
          });
          count++;
        }

        e.target.value = '';

        if (count > 0) {
          setStudents([...students, ...newStudents]);
          setUnsavedChanges(true);
          const note = [
            `Đã thêm ${count} học sinh.`,
            missingClassCount > 0 ? `Bỏ qua ${missingClassCount} dòng do không tìm thấy lớp.` : '',
            badDobCount > 0 ? `${badDobCount} dòng có ngày sinh không đọc được nên để trống.` : '',
            'Nhớ bấm LƯU để đồng bộ.',
          ].filter(Boolean).join(' ');
          showToast(note, 'success');
        } else {
          showToast(`Không tìm thấy học sinh hợp lệ.${missingClassCount > 0 ? ` (${missingClassCount} dòng không tìm thấy lớp)` : ''}`, 'error');
        }
      } catch (err) {
        e.target.value = '';
        showToast('Không thể đọc file Excel. Hãy kiểm tra lại định dạng file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">Quản lý Học sinh</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadStudentTemplate}
            className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold border border-blue-200"
            title="Tải file Excel mẫu"
          >
            <Download size={15} /> Tải mẫu
          </button>
          <input type="file" ref={excelStudentInputRef} onChange={handleImportStudentsExcel} accept=".xlsx,.xls" className="hidden" />
          <button
            onClick={() => excelStudentInputRef.current?.click()}
            className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200"
            title="Import học sinh từ file Excel"
          >
            <FileSpreadsheet size={15} /> Import Excel
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-700">Xem lớp:</span>
          <select
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
            value={selectedClassForStudent}
            onChange={e => handleChangeClass(e.target.value)}
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-sm text-slate-500">{classStudents.length} học sinh</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Thêm thủ công tên học sinh..."
            value={newStudentName}
            onChange={e => setNewStudentName(e.target.value)}
          />
          <input
            type="date"
            className="p-2 border border-slate-300 rounded-lg text-sm sm:w-44"
            title="Ngày sinh (không bắt buộc) — giúp phân biệt hai em trùng tên"
            value={newStudentDob}
            onChange={e => setNewStudentDob(e.target.value)}
          />
          <button onClick={handleAddStudent} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Thêm</button>
        </div>
      </div>

      {/* Thanh hành động chỉ hiện khi đã chọn — lúc bình thường không chiếm chỗ */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm font-bold text-red-800">Đã chọn {selectedIds.size} học sinh</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-slate-600 px-3 py-1.5 rounded-lg hover:bg-white font-medium"
            >
              Bỏ chọn
            </button>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-bold"
            >
              <Trash2 size={15} /> Xoá {selectedIds.size} em
            </button>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-red-600 cursor-pointer align-middle"
                  title={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả học sinh trong lớp'}
                  checked={allSelected}
                  disabled={classStudents.length === 0}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Họ và tên</th>
              <th className="px-4 py-3">Ngày sinh</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {classStudents.map(s => (
              <tr key={s.id} className={`border-b last:border-0 ${selectedIds.has(s.id) ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-red-600 cursor-pointer align-middle"
                    title={`Chọn ${s.name}`}
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-slate-500 text-xs">{s.id}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {s.dob ? formatDateDisplay(s.dob) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDeleteStudent(s.id)} title={`Xoá ${s.name}`}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg w-11 h-11 inline-flex items-center justify-center">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SettingsStudentsTab;
