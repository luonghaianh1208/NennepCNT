
import React, { useState, useMemo } from 'react';
import { PlusCircle, Trash2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import { getLocalDateString, detectOverlappingWeeks } from '../../utils';

const SettingsTimeTab: React.FC = () => {
  const { timeConfigs, setTimeConfigs, setUnsavedChanges } = useAppStore();
  const { showConfirm } = useModal();
  const [newTimeType, setNewTimeType] = useState<'WEEK' | 'MONTH' | 'SEMESTER'>('WEEK');

  const handleUpdateTimeConfig = (id: string, field: 'startDate' | 'endDate' | 'name' | 'type', value: string) => {
    setUnsavedChanges(true);
    setTimeConfigs(timeConfigs.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Phát hiện tuần trùng nhau
  const overlappingWeeks = useMemo(() => detectOverlappingWeeks(timeConfigs), [timeConfigs]);

  const handleAddTimeConfig = () => {
    const newId = `${newTimeType.charAt(0)}${Date.now()}`;
    const name = newTimeType === 'WEEK' ? 'Tuần Mới' : (newTimeType === 'MONTH' ? 'Tháng Mới' : 'Học Kỳ Mới');
    const todayLocal = getLocalDateString();
    setTimeConfigs([...timeConfigs, { id: newId, name, type: newTimeType, startDate: todayLocal, endDate: todayLocal }]);
    setUnsavedChanges(true);
  };

  const handleDeleteTimeConfig = async (id: string) => {
    const ok = await showConfirm({ title: 'Xóa mốc thời gian', message: 'Xóa mốc thời gian này?' });
    if (!ok) return;
    setTimeConfigs(timeConfigs.filter(c => c.id !== id));
    setUnsavedChanges(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      {/* Warning: Tuần trùng nhau */}
      {overlappingWeeks.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">⚠️ Phát hiện {overlappingWeeks.length} cặp tuần bị trùng ngày!</p>
            <p className="text-xs text-amber-700 mt-0.5">Các cặp tuần trùng sẽ gây tính điểm sai (vi phạm bị đếm nhiều lần):</p>
            <ul className="mt-1 space-y-0.5">
              {overlappingWeeks.map((pair, i) => (
                <li key={i} className="text-xs text-amber-700 font-medium">• <strong>{pair.a}</strong> trùng với <strong>{pair.b}</strong></li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
        <h3 className="font-bold text-lg text-slate-800">Quản lý Thời gian (Tuần/Tháng/Kỳ)</h3>
        <div className="flex gap-2">
          <select
            className="border border-slate-300 rounded-lg p-1.5 text-sm outline-none"
            value={newTimeType}
            onChange={e => setNewTimeType(e.target.value as any)}
          >
            <option value="WEEK">Thêm Tuần</option>
            <option value="MONTH">Thêm Tháng</option>
            <option value="SEMESTER">Thêm Học Kỳ</option>
          </select>
          <button
            onClick={handleAddTimeConfig}
            className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors flex items-center gap-1 text-sm px-3 font-bold"
          >
            <PlusCircle size={16}/> Thêm
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {(['WEEK', 'MONTH', 'SEMESTER'] as const).map(type => {
          const configs = timeConfigs.filter(c => c.type === type);
          if (configs.length === 0) return null;
          return (
            <div key={type}>
              <div className="text-xs font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-1">
                {type === 'WEEK' ? 'Danh sách Tuần' : (type === 'MONTH' ? 'Danh sách Tháng' : 'Danh sách Học Kỳ')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {configs.map(config => (
                  <div key={config.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 relative group hover:border-blue-300 transition-colors">
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => handleDeleteTimeConfig(config.id)}
                        className="text-slate-500 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                    <div className="mb-2 pr-6">
                      <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Tên hiển thị</label>
                      <input
                        type="text"
                        className="w-full text-sm font-bold bg-transparent border-b border-transparent focus:border-blue-500 outline-none pb-0.5 text-slate-800"
                        value={config.name}
                        onChange={e => handleUpdateTimeConfig(config.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Bắt đầu</label>
                        <input
                          type="date"
                          className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white"
                          value={config.startDate}
                          onChange={e => handleUpdateTimeConfig(config.id, 'startDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Kết thúc</label>
                        <input
                          type="date"
                          className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white"
                          value={config.endDate}
                          onChange={e => handleUpdateTimeConfig(config.id, 'endDate', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsTimeTab;
