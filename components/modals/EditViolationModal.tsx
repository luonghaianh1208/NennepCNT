
import React, { useState, useEffect } from 'react';
import { Edit, X, Save } from 'lucide-react';
import { Violation } from '../../types';
import { formatDateForInput } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';

interface EditViolationModalProps {
  violation: Violation | null;
  onClose: () => void;
  onSave: (updatedViolation: Violation) => void;
}

const EditViolationModal: React.FC<EditViolationModalProps> = ({
  violation,
  onClose,
  onSave,
}) => {
  const { classes, students, criteria } = useAppStore();

  const [editDate, setEditDate] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editCriteriaId, setEditCriteriaId] = useState('');
  const [editNote, setEditNote] = useState('');

  useEffect(() => {
    if (violation) {
      setEditDate(formatDateForInput(violation.date));
      setEditClassId(violation.classId);
      setEditStudentId(violation.studentId || '');
      setEditCriteriaId(violation.criteriaId);
      setEditNote(violation.note || '');
    }
  }, [violation]);

  if (!violation) return null;

  const handleSaveClick = () => {
    const criteriaItem = criteria.find((c) => c.id === editCriteriaId);
    let finalPoints = criteriaItem ? criteriaItem.points : 0;
    
    if (criteriaItem?.type === 'PLUS') finalPoints = -Math.abs(finalPoints);
    else finalPoints = Math.abs(finalPoints);

    const updatedV: Violation = {
      ...violation,
      date: editDate,
      classId: editClassId,
      studentId: editStudentId || undefined,
      criteriaId: editCriteriaId,
      points: finalPoints,
      note: editNote,
    };

    onSave(updatedV);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Edit size={20} className="text-blue-600" /> Chỉnh sửa thông tin
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100">
            <X size={24} className="text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ngày ghi nhận</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lớp</label>
              <select
                value={editClassId}
                onChange={(e) => setEditClassId(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Học sinh</label>
              <select
                value={editStudentId}
                onChange={(e) => setEditStudentId(e.target.value)}
                className="w-full p-2 border rounded-lg"
                disabled={!violation.studentId && !editStudentId}
              >
                <option value="">-- Tập thể --</option>
                {students
                  .filter((s) => s.classId === editClassId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nội dung</label>
            <select
              value={editCriteriaId}
              onChange={(e) => setEditCriteriaId(e.target.value)}
              className="w-full p-2 border rounded-lg"
            >
              <optgroup label="Vi phạm">
                {criteria
                  .filter((c) => c.type === 'MINUS')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.content}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Thành tích">
                {criteria
                  .filter((c) => c.type === 'PLUS')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.content}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ghi chú</label>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full p-2 border rounded-lg"
              rows={2}
            ></textarea>
          </div>
        </div>
        <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg"
          >
            Hủy
          </button>
          <button
            onClick={handleSaveClick}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Save size={18} /> Lưu Thay Đổi
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditViolationModal;
