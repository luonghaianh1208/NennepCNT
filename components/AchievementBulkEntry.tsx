import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, CheckCircle2, Loader2, Camera, X, Star, Info } from 'lucide-react';
import { Violation } from '../types';
import { getLocalDateString, removeVietnameseTones, isDateOutsideAllConfigs, lookupPrizePoints } from '../utils';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';
import { api } from '../services/firebase';

/**
 * Nhập thành tích theo hoạt động: khai báo một hoạt động rồi ghi giải thưởng
 * cho nhiều lớp trong cùng một bảng, lưu một lần.
 *
 * Điểm tra từ bảng giải × cấp độ trong Cấu hình → Quy định, vẫn sửa tay được
 * cho hoạt động có mức thưởng riêng.
 */

// Giải thưởng, nhóm và cấp độ lấy từ Cấu hình → Quy định của từng trường
const EMPTY_ROW = { classId: '', participants: '', prize: '', points: '' };

type Row = typeof EMPTY_ROW;

const AchievementBulkEntry: React.FC = () => {
  const { classes, criteria, setCriteria, violations, setViolations, currentUser, timeConfigs, schoolSettings } = useAppStore();
  const { showToast, showAlert, showConfirm } = useModal();

  const [date, setDate] = useState(getLocalDateString());
  const [activityName, setActivityName] = useState('');
  const [group, setGroup] = useState(schoolSettings.activityGroups[0] ?? '');
  const [level, setLevel] = useState(schoolSettings.activityLevels[0] ?? '');
  const [rows, setRows] = useState<Row[]>(Array.from({ length: 5 }, () => ({ ...EMPTY_ROW, prize: schoolSettings.prizes[0] ?? '' })));
  const [image, setImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const achievementCriteria = useMemo(() => criteria.filter(c => c.type === 'PLUS'), [criteria]);

  // Ngày ngoài mọi mốc thời gian → bản ghi lưu được nhưng không vào xếp hạng
  const dateOutOfRange = useMemo(
    () => isDateOutsideAllConfigs(date, timeConfigs),
    [date, timeConfigs],
  );

  /** Gợi ý tên hoạt động: bóc phần giải thưởng khỏi tên tiêu chí đã có */
  const activitySuggestions = useMemo(() => {
    const names = new Set<string>();
    achievementCriteria.forEach(c => {
      const stripped = c.content.replace(
        /^(giải\s+)?(nhất|nhì|ba|khuyến khích|kk|tham gia)\s+/i,
        '',
      );
      if (stripped && stripped !== c.content) names.add(stripped.trim());
    });
    return [...names].sort();
  }, [achievementCriteria]);

  /**
   * Điểm thưởng tra từ bảng giải × cấp độ trong Cấu hình → Quy định.
   *
   * Trước đây mỗi hoạt động mới đẻ ra một tiêu chí riêng cho từng giải, nên
   * danh mục thành tích phình rất nhanh (67 tiêu chí cho 29 hoạt động). Nay
   * tên hoạt động lưu thẳng vào bản ghi, tiêu chí chỉ còn tối đa
   * "số giải × số cấp độ" mục dùng chung cho mọi hoạt động.
   */
  const suggestPoints = (prize: string, lv: string) => lookupPrizePoints(schoolSettings, prize, lv);

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows(prev =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.prize !== undefined) {
          const suggested = suggestPoints(next.prize, level);
          if (suggested) next.points = String(suggested);
        }
        return next;
      }),
    );
  };

  /** Đổi cấp độ thì gợi ý lại điểm cho mọi dòng đang dùng mức chuẩn */
  const applyLevelPoints = (nextLevel: string) => {
    setRows(prev =>
      prev.map(row => {
        const suggested = suggestPoints(row.prize, nextLevel);
        const wasStandard = !row.points || row.points === String(suggestPoints(row.prize, level));
        return suggested && wasStandard ? { ...row, points: String(suggested) } : row;
      }),
    );
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const activity = activityName.trim();
    if (!activity) return showToast('Nhập tên hoạt động trước đã', 'error');

    const filled = rows.filter(r => r.classId && r.points !== '');
    if (!filled.length) return showToast('Chưa có dòng nào đủ lớp và số điểm', 'error');

    const duplicated = filled.map(r => r.classId).filter((id, i, arr) => arr.indexOf(id) !== i);
    if (duplicated.length) return showToast('Một lớp xuất hiện ở hai dòng, kiểm tra lại', 'error');

    // Ngày ngoài mốc thời gian: hỏi lại cho chắc, tránh ghi xong mà điểm không được tính
    if (dateOutOfRange) {
      const ok = await showConfirm({
        title: 'Ngày nằm ngoài năm học',
        message:
          `Ngày ${date} không thuộc tuần, tháng hay học kỳ nào đã cấu hình.\n\n` +
          `Bản ghi sẽ được lưu nhưng KHÔNG xuất hiện trong bảng xếp hạng, trang tổng quan ` +
          `hay báo cáo tuần — chỉ tra cứu được khi lọc "Tất cả thời gian".\n\n` +
          `Bạn muốn tiếp tục, hay quay lại đổi ngày?`,
        type: 'danger',
        confirmText: 'Vẫn lưu',
        cancelText: 'Để tôi đổi ngày',
      });
      if (!ok) return;
    }

    setIsSaving(true);
    try {
      // 1. Ảnh trao giải (nếu có) dùng chung cho mọi lớp trong hoạt động này
      let imageUrls: string[] = [];
      if (image) {
        const res = await api.uploadImage(image, {
          className: 'HoatDong',
          studentName: removeVietnameseTones(activity).replace(/\s+/g, '_'),
          violation: 'ThanhTich',
          date,
        });
        if (res.status !== 'success') throw new Error(res.message || 'Không tải được ảnh lên');
        imageUrls = [res.url];
      }

      // 2. Tiêu chí dùng chung theo "giải × cấp độ", KHÔNG tạo riêng cho từng
      //    hoạt động nữa. Tên hoạt động đã nằm trong chính bản ghi.
      const newCriteria: typeof criteria = [];
      const criteriaIdFor = async (prize: string, points: number) => {
        const label = `Khen thưởng ${prize} — ${level}`;
        const key = removeVietnameseTones(label).replace(/\s+/g, ' ').trim();
        const existing =
          achievementCriteria.find(c => removeVietnameseTones(c.content).replace(/\s+/g, ' ').trim() === key) ??
          newCriteria.find(c => removeVietnameseTones(c.content).replace(/\s+/g, ' ').trim() === key);
        if (existing) return existing.id;

        const created = {
          id: `C${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          content: label,
          points: Math.abs(points),
          type: 'PLUS' as const,
        };
        await api.createCriteria(created);
        newCriteria.push(created);
        return created.id;
      };

      // 3. Dựng bản ghi — thành tích lưu điểm âm theo đúng quy ước của hệ thống
      const records: Violation[] = [];
      for (const [i, row] of filled.entries()) {
        const points = Number(row.points) || 0;
        const criteriaId = await criteriaIdFor(row.prize, points);
        const participants = Number(row.participants) || 0;

        records.push({
          id: `A${Date.now()}_${i}`,
          date,
          classId: row.classId,
          studentId: '',
          criteriaId,
          points: -Math.abs(points),
          note: [activity, group, level, participants ? `${participants} HS tham gia` : '']
            .filter(Boolean)
            .join(' · '),
          images: imageUrls,
          reportedBy: currentUser.id,
          isSecurityReport: false,
          timestamp: Date.now() + i,
          activityName: activity,
          activityGroup: group,
          activityLevel: level,
          participants,
        });
      }

      const result = await api.batchCreateViolations(records);
      if (result?.error) throw new Error(result.error);

      setViolations([...records, ...violations]);
      if (newCriteria.length) setCriteria([...criteria, ...newCriteria]);

      setRows(Array.from({ length: 5 }, () => ({ ...EMPTY_ROW })));
      setActivityName('');
      setImage(null);
      showToast(
        `Đã ghi nhận ${records.length} lớp cho hoạt động "${activity}"` +
          (newCriteria.length ? `, thêm ${newCriteria.length} tiêu chí mới` : ''),
        'success',
      );
    } catch (e: any) {
      showAlert('Không lưu được', e.message ?? String(e), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalRows = rows.filter(r => r.classId && r.points !== '').length;

  return (
    <div className="space-y-4">
      {/* ── Thông tin chung của hoạt động ─────────────────────────────────── */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 font-bold text-green-800">
          <Star size={18} /> Thông tin hoạt động
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Tên hoạt động <span className="text-red-500">*</span>
            </label>
            <input
              list="activity-suggestions"
              className="w-full p-3 rounded-lg border-2 border-green-300 bg-white font-medium"
              placeholder="Ví dụ: Flashmob 2026, Hội khoẻ Phù Đổng..."
              value={activityName}
              onChange={e => setActivityName(e.target.value)}
            />
            <datalist id="activity-suggestions">
              {activitySuggestions.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nhóm hoạt động</label>
            <select className="w-full p-3 rounded-lg border border-slate-300 bg-white" value={group} onChange={e => setGroup(e.target.value)}>
              {schoolSettings.activityGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Cấp độ</label>
            <select className="w-full p-3 rounded-lg border border-slate-300 bg-white" value={level} onChange={e => { setLevel(e.target.value); applyLevelPoints(e.target.value); }}>
              {schoolSettings.activityLevels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ngày ghi nhận</label>
            <input
              type="date"
              className={`w-full p-3 rounded-lg border bg-white ${dateOutOfRange ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-300'}`}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            {dateOutOfRange && (
              <p className="text-xs text-amber-700 mt-1 leading-snug">
                Ngày này nằm ngoài mọi tuần/tháng/học kỳ đã cấu hình. Bản ghi vẫn lưu được nhưng
                <b> không được tính vào xếp hạng và báo cáo</b> — chọn ngày trong năm học, hoặc bổ
                sung mốc thời gian ở phần Cấu hình.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ảnh trao giải (tuỳ chọn)</label>
            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleImage} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full p-3 rounded-lg border border-slate-300 bg-white flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-50"
            >
              <Camera size={16} /> {image ? 'Đổi ảnh khác' : 'Chọn ảnh dùng chung'}
            </button>
          </div>
        </div>

        {image && (
          <div className="relative w-full h-36 bg-white rounded-lg overflow-hidden border border-slate-200">
            <img src={image} alt="Ảnh trao giải" className="w-full h-full object-contain" />
            <button onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Bảng các lớp được khen thưởng ─────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Tên lớp cần rộng để đọc được, còn số người và điểm chỉ vài ký tự */}
        <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed min-w-[440px]">
          <colgroup>
            <col className="w-[31%]" />
            <col className="w-[15%]" />
            <col className="w-[25%]" />
            <col className="w-[22%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
            <tr>
              <th className="px-3 py-2 text-left">Lớp</th>
              <th className="px-2 py-2 text-left">Số người</th>
              <th className="px-2 py-2 text-left">Giải thưởng</th>
              <th className="px-2 py-2 text-left">Điểm</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const takenByOthers = rows.filter((_, j) => j !== i).map(r => r.classId);
              const suggested = suggestPoints(row.prize, level);
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <select
                      className={`w-full p-2 rounded border bg-white ${row.classId ? 'border-blue-400 text-blue-800 font-medium' : 'border-slate-200 text-slate-500'}`}
                      value={row.classId}
                      onChange={e => updateRow(i, { classId: e.target.value })}
                    >
                      <option value="">Chọn lớp</option>
                      {classes
                        .filter(c => !takenByOthers.includes(c.id))
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" min={0}
                      className="w-full p-2 rounded border border-slate-200 bg-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      value={row.participants}
                      onChange={e => updateRow(i, { participants: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="w-full p-2 rounded border border-slate-200 bg-white"
                      value={row.prize}
                      onChange={e => updateRow(i, { prize: e.target.value })}
                    >
                      {schoolSettings.prizes.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" min={0}
                      className={`w-full p-2 rounded border bg-white font-bold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${suggested ? 'border-green-300 text-green-700' : 'border-slate-200 text-slate-700'}`}
                      placeholder="0"
                      title={suggested
                        ? `Mức chuẩn của trường: ${row.prize} · ${level} = ${suggested}đ`
                        : `Chưa khai mức điểm cho ${row.prize} · ${level} trong Cấu hình → Quy định — tự nhập điểm`}
                      value={row.points}
                      onChange={e => updateRow(i, { points: e.target.value })}
                    />
                  </td>
                  <td className="px-1 text-center">
                    {rows.length > 1 && (
                      <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        <button
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
          className="w-full py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 border-t border-slate-100 flex items-center justify-center gap-1"
        >
          <Plus size={16} /> Thêm dòng
        </button>
      </div>

      <p className="text-xs text-slate-500 flex items-start gap-1.5">
        <Info size={14} className="mt-0.5 shrink-0" />
        Ô điểm viền xanh là mức chuẩn của trường, tra từ bảng giải × cấp độ trong
        Cấu hình → Quy định; hoạt động đặc biệt thì gõ đè lên. Số người tham gia chỉ để đối
        chiếu mức thưởng, không tự cộng vào điểm.
      </p>

      <button
        disabled={isSaving || !totalRows}
        onClick={handleSave}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        {isSaving ? 'Đang lưu...' : `Lưu thành tích cho ${totalRows} lớp`}
      </button>
    </div>
  );
};

export default AchievementBulkEntry;
