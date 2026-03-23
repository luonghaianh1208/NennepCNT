
import React, { useState, useRef } from 'react';
import { Upload, Trash2, FileSpreadsheet, Download } from 'lucide-react';
import { Student } from '../../types';
import { removeVietnameseTones, exportToExcel } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import * as XLSX from 'xlsx';

const SettingsStudentsTab: React.FC = () => {
  const { classes, students, setStudents, setUnsavedChanges } = useAppStore();
  const { showToast } = useModal();

  const [selectedClassForStudent, setSelectedClassForStudent] = useState(classes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');
  const excelStudentInputRef = useRef<HTMLInputElement>(null);

  const handleAddStudent = () => {
    if (!newStudentName || !selectedClassForStudent) return;
    const safeId = `S_${selectedClassForStudent}_${removeVietnameseTones(newStudentName).replace(/\s+/g, '')}`.toUpperCase();
    if (students.find(s => s.id === safeId)) {
      showToast('Học sinh này đã tồn tại trong lớp', 'error');
      return;
    }
    setStudents([...students, { id: safeId, name: newStudentName, classId: selectedClassForStudent }]);
    setNewStudentName('');
    setUnsavedChanges(true);
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
    setUnsavedChanges(true);
  };

  // --- TẢI FILE EXCEL MẪU ---
  const handleDownloadStudentTemplate = () => {
    const data = [
      ['Ten_lop', 'Ho_ten_HS', 'So_xe'],
      ['10A1', 'Nguyễn Văn A', '29B1-12345'],
      ['10A1', 'Trần Thị B', ''],
      ['10A2', 'Lê Văn C', '51B2-67890'],
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
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const newStudents: Student[] = [];
        let count = 0;
        let missingClassCount = 0;

        // ── ATOMIC COUNTER: đảm bảo mỗi ID là duy nhất tuyệt đối ──────────────
        // Khởi từ Date.now(), tăng đều sau mỗi dòng → không bao giờ trùng
        // dù vòng lặp chạy đồng bộ trong cùng millisecond.
        let seq = Date.now();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          const [tenLop, hotMHS, soXe] = row;
          const className = String(tenLop || '').trim();
          const studentName = String(hotMHS || '').trim();
          if (!className || !studentName) continue;

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
            onChange={e => setSelectedClassForStudent(e.target.value)}
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Thêm thủ công tên học sinh..."
            value={newStudentName}
            onChange={e => setNewStudentName(e.target.value)}
          />
          <button onClick={handleAddStudent} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">Thêm</button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Họ và tên</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {students.filter(s => s.classId === selectedClassForStudent).map(s => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-400 text-xs">{s.id}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700">
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
