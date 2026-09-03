import React, { useState } from 'react';
import { Save, Loader2, Plus, X, Info, Calculator, Palette, Pencil, Check } from 'lucide-react';
import { SchoolSettings } from '../../types';
import { THEME_PRESETS, renameInList, renamePrizeKey, renameLevelKey } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

/** Tên dài hơn thế này là vỡ bảng điểm thưởng, chặn ngay ở ô nhập */
const MAX_LABEL = 40;

/**
 * Ô nhập danh sách dạng thẻ: gõ rồi Enter để thêm, bút chì để sửa tên tại chỗ,
 * x để bỏ. Đặt ngoài component cha để gõ dở không bị mất khi cha vẽ lại.
 */
const ListEditor: React.FC<{
  label: string;
  hint: string;
  items: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
  onRename: (from: string, to: string) => void;
  onError: (message: string) => void;
}> = ({ label, hint, items, placeholder, onChange, onRename, onError }) => {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (items.includes(value)) return onError(`"${value}" đã có trong danh sách`);
    onChange([...items, value]);
    setDraft('');
  };

  const trimmed = newName.trim();
  // Trùng tên mục khác thì không cho lưu — hai mục cùng tên sẽ đè điểm của nhau
  const isValid = !!trimmed && trimmed.length <= MAX_LABEL && (trimmed === editing || !items.includes(trimmed));

  const saveRename = () => {
    if (!isValid || editing === null) return;
    if (trimmed !== editing) onRename(editing, trimmed);
    setEditing(null);
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map(item => (editing === item ? (
          <span key={item} className="inline-flex items-center gap-1 bg-white border border-blue-400 rounded-full pl-3 pr-1.5 py-1">
            <input autoFocus value={newName} maxLength={MAX_LABEL} aria-label={`Tên mới cho ${item}`}
              className={`w-32 bg-transparent text-sm outline-none ${isValid ? 'text-slate-800' : 'text-red-600'}`}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
                if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
              }} />
            <button onClick={saveRename} disabled={!isValid}
              className="text-green-600 hover:text-green-700 disabled:text-slate-300"
              title={isValid ? 'Lưu tên mới' : 'Tên trống hoặc trùng mục khác'}>
              <Check size={13} />
            </button>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600" title="Thôi không sửa">
              <X size={13} />
            </button>
          </span>
        ) : (
          <span key={item} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full pl-3 pr-1.5 py-1 text-sm">
            {item}
            <button onClick={() => { setEditing(item); setNewName(item); }}
              className="text-slate-400 hover:text-blue-600" title={`Sửa tên ${item}`}>
              <Pencil size={11} />
            </button>
            <button onClick={() => onChange(items.filter(i => i !== item))}
              className="text-slate-400 hover:text-red-600" title={`Bỏ ${item}`}>
              <X size={13} />
            </button>
          </span>
        )))}
        {!items.length && <span className="text-xs text-slate-400 italic">Chưa có mục nào</span>}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 p-2 border border-slate-300 rounded text-sm"
          placeholder={placeholder}
          value={draft}
          maxLength={MAX_LABEL}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button onClick={add} className="px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-sm font-bold">
          <Plus size={15} />
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1">{hint}</p>
    </div>
  );
};

/**
 * Quy định riêng của trường — những thứ trước đây gán cứng trong mã nguồn:
 * công thức tính điểm, khối lớp, danh sách giải thưởng, tông màu nhận diện.
 */
const SettingsRulesTab: React.FC = () => {
  const { schoolSettings, saveSchoolSettings } = useAppStore();
  const { showToast } = useModal();

  const [form, setForm] = useState<SchoolSettings>(schoolSettings);
  const [isSaving, setIsSaving] = useState(false);

  const set = (patch: Partial<SchoolSettings>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (form.baseScore <= 0) return showToast('Điểm khởi đầu phải lớn hơn 0', 'error');
    if (!form.grades.length) return showToast('Phải có ít nhất một khối lớp', 'error');
    if (!form.prizes.length) return showToast('Phải có ít nhất một loại giải thưởng', 'error');

    setIsSaving(true);
    // Chốt chặn cuối: kể cả có cách nào lọt qua ô nhập thì hệ số vẫn không dưới 1
    const ok = await saveSchoolSettings({
      ...form,
      semester2Multiplier: Math.max(1, Number(form.semester2Multiplier) || 1),
    });
    setIsSaving(false);
    showToast(ok ? 'Đã lưu quy định của trường' : 'Lưu thất bại, thử lại giúp em', ok ? 'success' : 'error');
  };

  const showError = (message: string) => showToast(message, 'error');

  // Đổi tên giải hoặc cấp độ phải chuyển cả khoá trong bảng điểm, nếu không thì
  // cột điểm đã khai biến mất mà không báo gì.
  const renamePrize = (from: string, to: string) => set({
    prizes: renameInList(form.prizes, from, to),
    prizePoints: renamePrizeKey(form.prizePoints, from, to),
  });

  const renameLevel = (from: string, to: string) => set({
    activityLevels: renameInList(form.activityLevels, from, to),
    prizePoints: renameLevelKey(form.prizePoints, from, to),
  });

  // Khối lớp và nhóm hoạt động không nằm trong bảng điểm nên chỉ đổi danh sách
  const renameGrade = (from: string, to: string) => set({ grades: renameInList(form.grades, from, to) });
  const renameGroup = (from: string, to: string) => set({ activityGroups: renameInList(form.activityGroups, from, to) });

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
            <p className="text-xs text-slate-400 mt-1">Mỗi lớp bắt đầu với số điểm này, trừ dần khi vi phạm.</p>
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
            <p className="text-xs text-slate-400 mt-1">Điền 1 nếu trường tính hai học kỳ ngang nhau.</p>
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

      {/* ── Khen thưởng ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <h3 className="font-bold text-lg text-slate-800">Danh mục khen thưởng</h3>

        <ListEditor label="Giải thưởng" items={form.prizes} placeholder="Ví dụ: Giải phong trào"
          hint="Hiện trong ô chọn giải khi nhập khen thưởng theo hoạt động."
          onChange={prizes => set({ prizes })} onRename={renamePrize} onError={showError} />

        <ListEditor label="Nhóm hoạt động" items={form.activityGroups} placeholder="Ví dụ: Tình nguyện"
          hint="Dùng để phân loại hoạt động khi thống kê."
          onChange={activityGroups => set({ activityGroups })} onRename={renameGroup} onError={showError} />

        <ListEditor label="Cấp độ hoạt động" items={form.activityLevels} placeholder="Ví dụ: Cấp quận"
          hint="Cấp càng cao thường điểm thưởng càng lớn."
          onChange={activityLevels => set({ activityLevels })} onRename={renameLevel} onError={showError} />

        {/* Bảng điểm: thay cho việc mỗi hoạt động đẻ ra một tiêu chí riêng */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Bảng điểm thưởng</label>
          <p className="text-xs text-slate-400 mb-2">
            Khai một lần, dùng cho mọi hoạt động. Khi nhập khen thưởng, chọn giải và cấp độ là hệ
            thống điền điểm sẵn — vẫn sửa tay được cho hoạt động đặc biệt. Ô để 0 nghĩa là không gợi ý.
            Sửa tên giải hay cấp độ thì điểm đã khai đi theo, nhưng các bản ghi khen thưởng cũ vẫn
            giữ tên tại thời điểm nhập — đổi tên trước khi vào mùa nhập là gọn nhất.
          </p>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-600 min-w-[130px]">Giải</th>
                  {form.activityLevels.map(lv => (
                    <th key={lv} className="px-2 py-2 text-center font-bold text-slate-600 whitespace-nowrap">{lv}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.prizes.map(prize => (
                  <tr key={prize} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{prize}</td>
                    {form.activityLevels.map(lv => (
                      <td key={lv} className="px-2 py-1.5">
                        <input
                          type="number" min={0}
                          className="w-full p-1.5 border border-slate-200 rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={form.prizePoints?.[prize]?.[lv] ?? 0}
                          onChange={e => set({
                            prizePoints: {
                              ...form.prizePoints,
                              [prize]: { ...(form.prizePoints?.[prize] ?? {}), [lv]: Number(e.target.value) || 0 },
                            },
                          })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
