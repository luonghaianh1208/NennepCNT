import React, { useState, useEffect } from 'react';
import { Save, Loader2, Trophy, Table2 } from 'lucide-react';
import { SchoolSettings } from '../../types';
import { renameInList, renamePrizeKey, renameLevelKey } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import ListEditor from './ListEditor';

/**
 * Điểm thưởng — trước đây nằm lẫn trong tab Quy định, phải cuộn qua công thức
 * tính điểm và quy định nhập liệu mới thấy. Tách ra tab riêng vì đây là bảng
 * quản trị viên phải mở lại nhiều lần mỗi mùa phong trào.
 *
 * Ba danh mục (giải, nhóm, cấp độ) ở cùng đây với bảng điểm, vì bảng điểm lấy
 * hàng từ danh sách giải và cột từ danh sách cấp độ — tách hai nơi thì sửa một
 * bên không thấy bên kia đổi theo.
 */
const SettingsRewardsTab: React.FC = () => {
  const { schoolSettings, saveSchoolSettings } = useAppStore();
  const { showToast } = useModal();

  const [form, setForm] = useState<SchoolSettings>(schoolSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Quy định của trường nạp bất đồng bộ. Mở tab này lúc mạng chậm thì form chụp
  // đúng giá trị MẶC ĐỊNH, sửa một ô rồi bấm Lưu là ghi đè toàn bộ quy định
  // riêng của trường — không hoàn tác được. Đồng bộ lại khi dữ liệu thật về,
  // nhưng chỉ khi người dùng chưa sửa dở.
  useEffect(() => {
    if (!dirty) setForm(schoolSettings);
  }, [schoolSettings, dirty]);

  const set = (patch: Partial<SchoolSettings>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const showError = (message: string) => showToast(message, 'error');

  const handleSave = async () => {
    if (!form.prizes.length) return showToast('Phải có ít nhất một loại giải thưởng', 'error');
    if (!form.activityLevels.length) return showToast('Phải có ít nhất một cấp độ hoạt động', 'error');

    setIsSaving(true);
    const ok = await saveSchoolSettings(form);
    setIsSaving(false);
    if (ok) setDirty(false);
    showToast(ok ? 'Đã lưu bảng điểm thưởng' : 'Lưu thất bại, thử lại giúp em', ok ? 'success' : 'error');
  };

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

  const renameGroup = (from: string, to: string) => set({ activityGroups: renameInList(form.activityGroups, from, to) });

  return (
    <div className="space-y-4">
      {/* ── Bảng điểm thưởng — việc chính của tab này, để lên trên cùng ──── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-1">
          <Table2 size={18} /> Bảng điểm thưởng
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          Khai một lần, dùng cho mọi hoạt động. Khi nhập khen thưởng, chọn giải và cấp độ là hệ
          thống điền điểm sẵn — vẫn sửa tay được cho hoạt động đặc biệt. Ô để 0 nghĩa là không gợi ý.
        </p>

        {form.prizes.length === 0 || form.activityLevels.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Bảng điểm lấy hàng từ danh sách <strong>Giải thưởng</strong> và cột từ danh sách
            <strong> Cấp độ hoạt động</strong>. Thêm ít nhất một mục ở mỗi danh sách bên dưới thì bảng sẽ hiện ra.
          </div>
        ) : (
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
                          aria-label={`Điểm thưởng ${prize} — ${lv}`}
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
        )}

        <p className="text-xs text-slate-500 mt-2">
          Sửa tên giải hay cấp độ thì điểm đã khai đi theo, nhưng các bản ghi khen thưởng cũ vẫn
          giữ tên tại thời điểm nhập — đổi tên trước khi vào mùa nhập là gọn nhất.
        </p>
      </div>

      {/* ── Ba danh mục dựng nên bảng điểm ──────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <Trophy size={18} /> Danh mục khen thưởng
        </h3>

        <ListEditor label="Giải thưởng" items={form.prizes} placeholder="Ví dụ: Giải phong trào"
          hint="Mỗi mục là một hàng trong bảng điểm phía trên, và hiện trong ô chọn giải khi nhập khen thưởng."
          onChange={prizes => set({ prizes })} onRename={renamePrize} onError={showError} />

        <ListEditor label="Cấp độ hoạt động" items={form.activityLevels} placeholder="Ví dụ: Cấp quận"
          hint="Mỗi mục là một cột trong bảng điểm. Cấp càng cao thường điểm thưởng càng lớn."
          onChange={activityLevels => set({ activityLevels })} onRename={renameLevel} onError={showError} />

        <ListEditor label="Nhóm hoạt động" items={form.activityGroups} placeholder="Ví dụ: Tình nguyện"
          hint="Không ảnh hưởng tới điểm, chỉ dùng để phân loại hoạt động khi thống kê."
          onChange={activityGroups => set({ activityGroups })} onRename={renameGroup} onError={showError} />
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full md:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        Lưu điểm thưởng
      </button>
    </div>
  );
};

export default SettingsRewardsTab;
