
import React, { useState, useRef } from 'react';
import { Plus, X, FileSpreadsheet, Download } from 'lucide-react';
import { ClassEntity } from '../../types';
import { exportToExcel } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import * as XLSX from 'xlsx';

const SettingsClassesTab: React.FC = () => {
  const { classes, setClasses, students, setStudents, setUnsavedChanges } = useAppStore();
  const { showConfirm, showToast } = useModal();

  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('10');
  const [newClassTeacher, setNewClassTeacher] = useState('');
  const excelClassInputRef = useRef<HTMLInputElement>(null);

  const handleAddClass = () => {
    if (!newClassName) return showToast('Vui lòng nhập tên lớp', 'error');
    const newId = newClassName.replace(/\s/g, '');
    if (classes.find(c => c.id === newId)) return showToast('Lớp này đã tồn tại', 'error');
    setClasses([...classes, { id: newId, name: newClassName, grade: parseInt(newClassGrade), homeroomTeacher: newClassTeacher || 'Chưa cập nhật' }]);
    setNewClassName('');
    setNewClassTeacher('');
    setUnsavedChanges(true);
  };

  const handleDeleteClass = async (id: string) => {
    const ok = await showConfirm({ title: 'Xóa Lớp', message: 'Xóa lớp sẽ xóa cả học sinh trong lớp. Tiếp tục?', type: 'danger', confirmText: 'Xóa lớp' });
    if (ok) {
      setClasses(classes.filter(c => c.id !== id));
      setStudents(students.filter(s => s.classId !== id));
      setUnsavedChanges(true);
    }
  };

  // --- TẢI FILE EXCEL MẪU ---
  const handleDownloadClassTemplate = () => {
    const data = [
      ['Khoi_lop', 'Ten_lop', 'Ten_GVCN'],
      ['10', '10A1', 'Cô Nguyễn Lan'],
      ['10', '10A2', 'Thầy Trần Hùng'],
      ['11', '11B1', 'Cô Lê Hoa'],
    ];
    exportToExcel(data, 'Mau_Import_LopHoc');
  };

  // --- IMPORT TỪ EXCEL ---
  const handleImportClassesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const existingClassIds = new Set(classes.map(c => c.id));

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const newClasses: ClassEntity[] = [];
        let count = 0;
        let dupCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          const [khoiRaw, tenLop, tenGVCN] = row;
          const name = String(tenLop || '').trim();
          if (!name) continue;

          // ID lớp = tên không dấu cách (convention hiện tại của hệ thống)
          const id = name.replace(/\s/g, '');
          const grade = parseInt(String(khoiRaw || '10')) || 10;
          const teacher = String(tenGVCN || '').trim() || 'Chưa cập nhật';

          if (existingClassIds.has(id)) {
            dupCount++;
            continue;
          }

          existingClassIds.add(id); // Tránh trùng trong cùng lượt import
          newClasses.push({ id, name, grade, homeroomTeacher: teacher });
          count++;
        }

        e.target.value = '';

        if (count > 0) {
          setClasses([...classes, ...newClasses]);
          setUnsavedChanges(true);
          const note = [
            `Đã thêm ${count} lớp mới.`,
            dupCount > 0 ? `Bỏ qua ${dupCount} lớp đã tồn tại.` : '',
            'Nhớ bấm LƯU để đồng bộ.',
          ].filter(Boolean).join(' ');
          showToast(note, 'success');
        } else {
          showToast(`Không tìm thấy lớp mới.${dupCount > 0 ? ` (${dupCount} lớp đã tồn tại)` : ''}`, 'error');
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
        <h3 className="font-bold text-lg text-slate-800">Danh sách Lớp học</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadClassTemplate}
            className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold border border-blue-200"
            title="Tải file Excel mẫu"
          >
            <Download size={15}/> Tải mẫu
          </button>
          <input type="file" ref={excelClassInputRef} onChange={handleImportClassesExcel} accept=".xlsx,.xls" className="hidden"/>
          <button
            onClick={() => excelClassInputRef.current?.click()}
            className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200"
            title="Import lớp học từ file Excel"
          >
            <FileSpreadsheet size={15}/> Import Excel
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 bg-slate-100 p-3 rounded-lg border border-slate-200 mb-4">
        <input className="flex-1 p-2 rounded border border-slate-300 text-sm outline-none" placeholder="Tên lớp (VD: 10A5)" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
        <select className="p-2 rounded border border-slate-300 text-sm outline-none bg-white" value={newClassGrade} onChange={e => setNewClassGrade(e.target.value)}>
          <option value="10">Khối 10</option>
          <option value="11">Khối 11</option>
          <option value="12">Khối 12</option>
        </select>
        <input className="flex-1 p-2 rounded border border-slate-300 text-sm outline-none" placeholder="GVCN (Tùy chọn)" value={newClassTeacher} onChange={e => setNewClassTeacher(e.target.value)} />
        <button onClick={handleAddClass} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-sm flex items-center justify-center gap-1">
          <Plus size={16}/> Thêm
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {classes.map(c => (
          <div key={c.id} className="bg-white border border-slate-200 p-3 rounded-lg relative group hover:shadow-md transition-shadow">
            <button onClick={() => handleDeleteClass(c.id)} className="absolute top-1 right-1 text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all">
              <X size={14}/>
            </button>
            <div className="font-bold text-slate-800 text-center text-lg">{c.name}</div>
            <div className="text-xs text-slate-500 text-center truncate">{c.homeroomTeacher}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsClassesTab;
