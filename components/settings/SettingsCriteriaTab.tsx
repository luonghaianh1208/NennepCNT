
import React, { useState, useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Criteria } from '../../types';
import { parseCSVLine } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

interface Props {
  type: 'MINUS' | 'PLUS';
}

const SettingsCriteriaTab: React.FC<Props> = ({ type }) => {
  const { criteria, setCriteria, setUnsavedChanges } = useAppStore();
  const { showConfirm, showToast } = useModal();

  const [newCriteriaContent, setNewCriteriaContent] = useState('');
  const [newCriteriaPoints, setNewCriteriaPoints] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);

  const isViolation = type === 'MINUS';

  const handleAddCriteria = () => {
    if (!newCriteriaContent || !newCriteriaPoints) return showToast('Vui lòng nhập đầy đủ nội dung và điểm', 'error');
    const newId = `C${Date.now()}`;
    setCriteria([...criteria, { id: newId, content: newCriteriaContent, points: parseFloat(newCriteriaPoints), type }]);
    setNewCriteriaContent('');
    setNewCriteriaPoints('');
    setUnsavedChanges(true);
  };

  const handleDeleteCriteria = async (id: string) => {
    const ok = await showConfirm({ title: 'Xóa tiêu chí', message: 'Bạn có chắc muốn xóa tiêu chí này không?', type: 'danger', confirmText: 'Xóa' });
    if (ok) {
      setCriteria(criteria.filter(c => c.id !== id));
      setUnsavedChanges(true);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/);
      const newCriteria: Criteria[] = [];
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const row = parseCSVLine(line);
        if (isViolation && row.length >= 3) {
          const content = row[1];
          const points = parseFloat(row[2]);
          if (!isNaN(points)) {
            newCriteria.push({ id: `C_IMP_${Date.now()}_${Math.random()}`, content, points: Math.abs(points), type: 'MINUS' });
            count++;
          }
        } else if (!isViolation && row.length >= 2) {
          const content = row[0];
          const points = parseFloat(row[1]);
          if (!isNaN(points)) {
            newCriteria.push({ id: `C_PLUS_IMP_${Date.now()}_${Math.random()}`, content, points: Math.abs(points), type: 'PLUS' });
            count++;
          }
        }
      }
      e.target.value = '';
      if (count > 0) {
        setCriteria([...criteria, ...newCriteria]);
        setUnsavedChanges(true);
        showToast(`Đã thêm ${count} tiêu chí ${isViolation ? 'vi phạm' : 'thành tích'}. Nhớ bấm LƯU.`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const filteredCriteria = criteria.filter(c => c.type === type);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">
          {isViolation ? 'Cấu hình Vi Phạm' : 'Cấu hình Thành Tích'}
        </h3>
        <div>
          <input type="file" ref={csvRef} onChange={handleImportCSV} accept=".csv" className="hidden"/>
          <button onClick={() => csvRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
            <Upload size={16}/> Import CSV
          </button>
        </div>
      </div>

      {isViolation ? (
        <div className="bg-red-50 p-2 rounded text-xs text-red-800 mb-4 border border-red-100">
          <strong>Format CSV:</strong> Hang_muc (Cá nhân/Tập thể), Loai_loi, Diem_tru <br/>
          <em>VD: Cá nhân, Đi học muộn, 5</em>
        </div>
      ) : (
        <div className="bg-green-50 p-2 rounded text-xs text-green-800 mb-4 border border-green-100">
          <strong>Format CSV:</strong> Noi_dung, Diem_cong <br/>
          <em>VD: Nhặt được của rơi, 20</em>
        </div>
      )}

      <div className="flex gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <input
          className="flex-[2] p-2 border border-slate-300 rounded text-sm"
          placeholder={isViolation ? 'Tên lỗi vi phạm...' : 'Tên thành tích...'}
          value={newCriteriaContent}
          onChange={e => setNewCriteriaContent(e.target.value)}
        />
        <input
          className="flex-1 p-2 border border-slate-300 rounded text-sm"
          placeholder={isViolation ? 'Điểm trừ' : 'Điểm cộng'}
          type="number"
          value={newCriteriaPoints}
          onChange={e => setNewCriteriaPoints(e.target.value)}
        />
        <button onClick={handleAddCriteria} className="bg-blue-600 text-white px-4 rounded font-bold text-sm">Thêm</button>
      </div>

      <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
            <tr>
              <th className="px-4 py-3">Nội dung</th>
              <th className="px-4 py-3 w-24 text-right">{isViolation ? 'Điểm trừ' : 'Điểm cộng'}</th>
              <th className="px-4 py-3 w-16 text-right">Xóa</th>
            </tr>
          </thead>
          <tbody>
            {filteredCriteria.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700 font-medium">{c.content}</td>
                <td className={`px-4 py-3 text-right font-bold ${isViolation ? 'text-red-600' : 'text-green-600'}`}>
                  {isViolation ? `-${c.points}` : `+${c.points}`}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDeleteCriteria(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SettingsCriteriaTab;
