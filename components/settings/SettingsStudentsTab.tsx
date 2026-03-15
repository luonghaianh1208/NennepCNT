
import React, { useState, useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Student } from '../../types';
import { parseCSVLine, removeVietnameseTones } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

const SettingsStudentsTab: React.FC = () => {
  const { classes, students, setStudents, setUnsavedChanges } = useAppStore();
  const { showToast } = useModal();

  const [selectedClassForStudent, setSelectedClassForStudent] = useState(classes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');
  const csvStudentInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportStudentsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/);
      const newStudents: Student[] = [];
      let count = 0;
      let missingClassCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const row = parseCSVLine(line);
        if (row.length >= 2) {
          const className = row[0];
          const studentName = row[1];
          const bikeNumber = row[2] || '';
          const cls = classes.find(c => c.name.toLowerCase() === className.toLowerCase() || c.id.toLowerCase() === className.toLowerCase());
          if (cls) {
            const safeId = `S_${cls.id}_${removeVietnameseTones(studentName).replace(/\s+/g, '')}`.toUpperCase();
            if (!students.find(s => s.id === safeId) && !newStudents.find(s => s.id === safeId)) {
              newStudents.push({ id: safeId, name: studentName, classId: cls.id, bikeNumber });
              count++;
            }
          } else {
            missingClassCount++;
          }
        }
      }
      e.target.value = '';
      if (count > 0) {
        setStudents([...students, ...newStudents]);
        setUnsavedChanges(true);
        showToast(`Đã thêm ${count} học sinh${missingClassCount > 0 ? ` (bỏ qua ${missingClassCount} do không tìm thấy lớp)` : ''}. Nhớ bấm LƯU.`, 'success');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">Quản lý Học sinh</h3>
        <div>
          <input type="file" ref={csvStudentInputRef} onChange={handleImportStudentsCSV} accept=".csv" className="hidden"/>
          <button onClick={() => csvStudentInputRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
            <Upload size={16}/> Import CSV
          </button>
        </div>
      </div>

      <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 mb-4 border border-blue-100">
        <strong>Format CSV Học sinh:</strong> Ten_lop, Ho_ten_HS, So_xe
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
                    <Trash2 size={16}/>
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
