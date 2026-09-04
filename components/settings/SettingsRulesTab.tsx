import React, { useState, useEffect } from 'react';
import { Save, Loader2, Info, Calculator, Palette } from 'lucide-react';
import { SchoolSettings } from '../../types';
import { THEME_PRESETS, renameInList } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import ListEditor from './ListEditor';

/**
 * Quy định riêng của trường — những thứ trước đây gán cứng trong mã nguồn:
 * công thức tính điểm, khối lớp, tông màu nhận diện.
 *
 * Điểm thưởng và ba danh mục khen thưởng đã tách sang tab Điểm thưởng riêng.
 */
const SettingsRulesTab: React.FC = () => {
  const { schoolSettings, saveSchoolSettings } = useAppStore();
  const { showToast } = useModal();

  const [form, setForm] = useState<SchoolSettings>(schoolSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Quy định của trường nạp bất đồng bộ. Mở tab này lúc mạng chậm thì form chụp
  // đúng giá trị MẶC ĐỊNH, sửa một ô màu rồi bấm Lưu là ghi đè toàn bộ quy định
  // riêng của trường, kể cả bảng điểm thưởng đã khai công phu — không hoàn tác
  // được. Đồng bộ lại khi dữ liệu thật về, nhưng chỉ khi người dùng chưa sửa dở.
  useEffect(() => {
    if (!dirty) setForm(schoolSettings);
  }, [schoolSettings, dirty]);

  const set = (patch: Partial<SchoolSettings>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (form.baseScore <= 0) return showToast('Điểm khởi đầu phải lớn hơn 0', 'error');
    if (!form.grades.length) return showToast('Phải có ít nhất một khối lớp', 'error');

    setIsSaving(true);
    // Chốt chặn cuối: kể cả có cách nào lọt qua ô nhập thì hệ số vẫn không dưới 1
    const ok = await saveSchoolSettings({
      ...form,
      semester2Multiplier: Math.max(1, Number(form.semester2Multiplier) || 1),
    });
    setIsSaving(false);
    if (ok) setDirty(false);
    showToast(ok ? 'Đã lưu quy định của trường' : 'Lưu thất bại, thử lại giúp em', ok ? 'success' : 'error');
  };

  const showError = (message: string) => showToast(message, 'error');

  // Khối lớp không nằm trong bảng điểm nên chỉ đổi danh sách
  const renameGrade = (from: string, to: string) => set({ grades: renameInList(form.grades, from, to) });

  return (
    <div className="space-y-4">
      {/* ── Công thức tính điểm ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-1">
          <Calculator size={18} /> Công thức tính điểm
        </h3>
        <p className="text-sm text-slate-500 mb-4">Mỗi trường có cách tính riêng — chỉnh ở đây, không cần sửa phần mềm.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Điểm khởi đầu mỗi tuần</label>
            <input type="number" min={1}
              className="w-full p-2.5 border border-slate-300 rounded-lg"
              value={form.baseScore}
              onChange={e => set({ baseScore: Number(e.target.value) || 0 })} />
            <p className="text-xs text-slate-500 mt-1">Mỗi lớp bắt đầu với số điểm này, trừ dần khi vi phạm.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Hệ số học kỳ II</label>
            {/* Hệ số dưới 1 nghĩa là học kỳ II bị tính nhẹ hơn kỳ I — gần như
                luôn là gõ nhầm. Rời ô là tự nhảy về 1, khỏi cần cảnh báo. */}
            <input type="number" min={1} step={0.5}
              className="w-full p-2.5 border border-slate-300 rounded-lg"
              value={form.semester2Multiplier}
              onChange={e => set({ semester2Multiplier: Number(e.target.value) })}
              onBlur={e => { if (!(Number(e.target.value) >= 1)) set({ semester2Multiplier: 1 }); }} />
            <p className="text-xs text-slate-500 mt-1">Điền 1 nếu trường tính hai học kỳ ngang nhau.</p>
          </div>
        </div>

        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
          <span className="font-bold text-slate-700">Cách tính hiện tại: </span>
          <span className="text-slate-600">
            Điểm lớp = {form.baseScore} × số tuần − tổng điểm trừ + tổng điểm cộng.
            {form.semester2Multiplier !== 1 && <> Khi xem cả năm: điểm HK1 + điểm HK2 × {form.semester2Multiplier}.</>}
          </span>
        </div>
      </div>

      {/* ── Quy định nhập liệu ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <h3 className="font-bold text-lg text-slate-800">Quy định nhập liệu</h3>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1 w-4 h-4"
            checked={form.requirePhotoForViolation}
            onChange={e => set({ requirePhotoForViolation: e.target.checked })} />
          <span>
            <span className="font-medium text-slate-800">Bắt buộc ảnh minh chứng khi ghi vi phạm</span>
            <p className="text-xs text-slate-500">Tắt đi nếu cán bộ nhập liệu dùng máy không có camera, hoặc trường tin tưởng không cần bằng chứng ảnh.</p>
          </span>
        </label>

        <ListEditor
          label="Khối lớp của trường"
          hint="Trường liên cấp thì thêm khối 6, 7, 8, 9. Thứ tự ở đây là thứ tự hiện trên bảng xếp hạng."
          items={form.grades}
          placeholder="Ví dụ: 10"
          onChange={grades => set({ grades })}
          onRename={renameGrade}
          onError={showError}
        />
      </div>

      {/* ── Tông màu ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-1">
          <Palette size={18} /> Tông màu nhận diện
        </h3>
        <p className="text-sm text-slate-500 mb-3">Áp cho thanh tiêu đề, màn hình chờ và trang giới thiệu.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => (
            <button key={key} onClick={() => set({ themePreset: key })}
              className={`rounded-xl overflow-hidden border-2 transition-all ${
                form.themePreset === key ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
              }`}>
              <div className="h-14 flex items-center justify-center font-black text-lg"
                style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`, color: preset.accent }}>
                NỀN NẾP
              </div>
              <div className="py-2 text-xs font-semibold text-slate-700 bg-white">{preset.label}</div>
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 flex items-start gap-1.5 mt-3">
          <Info size={14} className="mt-0.5 shrink-0" />
          Màu cảnh báo giữ nguyên trong mọi tông: đỏ vẫn là điểm trừ và nút xoá, xanh lá vẫn là điểm cộng.
          Đổi những màu này đi thì người dùng đọc sai thông tin.
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full md:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        Lưu quy định
      </button>
    </div>
  );
};

export default SettingsRulesTab;
