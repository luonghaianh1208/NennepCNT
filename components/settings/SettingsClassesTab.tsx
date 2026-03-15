
import React, { useState, useRef } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { ClassEntity } from '../../types';
import { parseCSVLine } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

const SettingsClassesTab: React.FC = () => {
  const { classes, setClasses, students, setStudents, setUnsavedChanges } = useAppStore();
  const { showConfirm, showToast } = useModal();

  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('10');
  const [newClassTeacher, setNewClassTeacher] = useState('');
  const csvClassInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportClassesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/);
      const newClasses: ClassEntity[] = [];
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const row = parseCSVLine(line);
        if (row.length >= 2) {
          const grade = parseInt(row[0]);
          const name = row[1];
          const teacher = row[2] || 'Chưa cập nhật';
          const id = name.replace(/\s/g, '');
          if (!classes.find(c => c.id === id) && !newClasses.find(c => c.id === id)) {
            newClasses.push({ id, name, grade, homeroomTeacher: teacher });
            count++;
          }
        }
      }
      e.target.value = '';
      if (count > 0) {
        setClasses([...classes, ...newClasses]);
        setUnsavedChanges(true);
        showToast(`Đã thêm ${count} lớp mới. Nhớ bấm LƯU để đồng bộ.`, 'success');
      } else {
        showToast('Không tìm thấy lớp mới hoặc file lỗi format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">Danh sách Lớp học</h3>
        <div>
          <input type="file" ref={csvClassInputRef} onChange={handleImportClassesCSV} accept=".csv" className="hidden"/>
          <button onClick={() => csvClassInputRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
            <Upload size={16}/> Import CSV
          </button>
        </div>
      </div>

      <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 mb-4 border border-blue-100">
        <strong>Format CSV Lớp:</strong> Khoi_lop, Ten_lop, Ten_GVCN
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
