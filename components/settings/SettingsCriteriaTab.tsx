
import React, { useState, useRef, useMemo } from 'react';
import { Trash2, FileSpreadsheet, Download } from 'lucide-react';
import { Criteria } from '../../types';
import { exportToExcel } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

interface Props {
  type: 'MINUS' | 'PLUS';
}

const SettingsCriteriaTab: React.FC<Props> = ({ type }) => {
  const { criteria, setCriteria, violations, setUnsavedChanges } = useAppStore();
  const { showConfirm, showToast } = useModal();

  /** Số bản ghi đang gắn với từng tiêu chí — xoá tiêu chí là chúng mất chỗ bám */
  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    violations.forEach(v => map.set(v.criteriaId, (map.get(v.criteriaId) ?? 0) + 1));
    return map;
  }, [violations]);

  const [newCriteriaContent, setNewCriteriaContent] = useState('');
  const [newCriteriaPoints, setNewCriteriaPoints] = useState('');
  const excelRef = useRef<HTMLInputElement>(null);

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
    const target = criteria.find(c => c.id === id);
    const used = usageCount.get(id) ?? 0;
    const label = isViolation ? 'lỗi vi phạm' : 'điểm thưởng';

    const message = used
      ? `Tiêu chí "${target?.content}" đang gắn với ${used} bản ghi ${label} đã nhập.\n\n` +
        `Xoá tiêu chí KHÔNG xoá ${used} bản ghi đó, nhưng chúng sẽ mất tên tiêu chí — ` +
        `danh sách và báo cáo sẽ hiển thị trống ở cột nội dung, điểm vẫn giữ nguyên.\n\n` +
        `Nếu chỉ muốn ngưng dùng cho năm sau, nên giữ lại tiêu chí này.`
      : `Tiêu chí "${target?.content}" chưa gắn với bản ghi nào, xoá đi là sạch sẽ.`;

    const ok = await showConfirm({
      title: used ? `Cảnh báo: ${used} bản ghi đang dùng` : 'Xoá tiêu chí',
      message,
      type: 'danger',
      confirmText: used ? `Vẫn xoá (${used} bản ghi mất tên)` : 'Xoá',
    });
    if (ok) {
      setCriteria(criteria.filter(c => c.id !== id));
      setUnsavedChanges(true);
    }
  };

  // --- TẢI FILE EXCEL MẪU ---
  const handleDownloadTemplate = () => {
    if (isViolation) {
      const data = [
        ['Loai_loi', 'Diem_tru'],
        ['Đi học muộn', '5'],
        ['Không đeo khăn quàng', '2'],
        ['Sử dụng điện thoại trong giờ học', '10'],
      ];
      exportToExcel(data, 'Mau_Import_TieuChi_ViPham');
    } else {
      const data = [
        ['Noi_dung', 'Diem_cong'],
        ['Học sinh tiêu biểu', '20'],
        ['Nhặt được của rơi', '15'],
        ['Lớp xuất sắc tuần', '10'],
      ];
      exportToExcel(data, 'Mau_Import_TieuChi_ThanhTich');
    }
  };

  // --- IMPORT TỪ EXCEL ---
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set ID đã dùng để kiểm tra trùng
    const existingIds = new Set(criteria.map(c => c.id));

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const newCriteria: Criteria[] = [];
        let count = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          // Cột: Loai_loi/Noi_dung | Diem_tru/Diem_cong
          const content = String(row[0] || '').trim();
          const points = parseFloat(String(row[1] || '0'));

          if (!content || isNaN(points) || points <= 0) continue;

          // Sinh ID unique: timestamp + index
          let newId = `C${Date.now()}_${i}`;
          while (existingIds.has(newId)) {
            newId = `C${Date.now()}_${i}_${Math.floor(Math.random() * 9999)}`;
          }
          existingIds.add(newId);

          newCriteria.push({
            id: newId,
            content,
            points: Math.abs(points),
            type,
          });
          count++;
        }

        e.target.value = '';

        if (count > 0) {
          setCriteria([...criteria, ...newCriteria]);
          setUnsavedChanges(true);
          showToast(`Đã thêm ${count} tiêu chí ${isViolation ? 'vi phạm' : 'thành tích'}. Nhớ bấm LƯU.`, 'success');
        } else {
          showToast('Không tìm thấy tiêu chí hợp lệ trong file. Kiểm tra lại định dạng cột.', 'error');
        }
      } catch (err) {
        e.target.value = '';
        showToast('Không thể đọc file Excel. Hãy kiểm tra lại định dạng file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredCriteria = criteria.filter(c => c.type === type);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">
          {isViolation ? 'Cấu hình Vi Phạm' : 'Cấu hình Thành Tích'}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold border border-blue-200"
            title="Tải file Excel mẫu"
          >
            <Download size={15} /> Tải mẫu
          </button>
          <input type="file" ref={excelRef} onChange={handleImportExcel} accept=".xlsx,.xls" className="hidden" />
          <button
            onClick={() => excelRef.current?.click()}
            className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200"
            title="Import tiêu chí từ file Excel"
          >
            <FileSpreadsheet size={15} /> Import Excel
          </button>
        </div>
      </div>

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
              <th className="px-4 py-3 w-28 text-right">Đang dùng</th>
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
                  {usageCount.get(c.id) ? (
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded"
                      title={`${usageCount.get(c.id)} bản ghi đang gắn với tiêu chí này`}>
                      {usageCount.get(c.id)} bản ghi
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">chưa dùng</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDeleteCriteria(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
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
