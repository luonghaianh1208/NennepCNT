import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, CheckCircle2, Loader2, Camera, X, Star, Info } from 'lucide-react';
import { Violation } from '../types';
import { getLocalDateString, removeVietnameseTones } from '../utils';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';
import { api } from '../services/firebase';

/**
 * Nhập thành tích theo hoạt động: khai báo một hoạt động rồi ghi giải thưởng
 * cho nhiều lớp trong cùng một bảng, lưu một lần.
 *
 * Điểm được gợi ý từ tiêu chí có sẵn (ví dụ "Nhất Flashmob 2026") nhưng vẫn sửa
 * được, vì có hoạt động dùng mức thưởng riêng. Hoạt động chưa có trong danh mục
 * thì hệ thống tự thêm tiêu chí mới để lần sau dùng lại.
 */

const PRIZES = ['Nhất', 'Nhì', 'Ba', 'Khuyến khích', 'Tham gia'];
const GROUPS = ['Văn nghệ', 'Thể thao', 'Học tập', 'Phong trào', 'Khác'];
const LEVELS = ['Cấp trường', 'Cấp thành phố', 'Cấp tỉnh', 'Cấp quốc gia'];
const EMPTY_ROW = { classId: '', participants: '', prize: 'Nhất', points: '' };

type Row = typeof EMPTY_ROW;

const AchievementBulkEntry: React.FC = () => {
  const { classes, criteria, setCriteria, violations, setViolations, currentUser } = useAppStore();
  const { showToast, showAlert } = useModal();

  const [date, setDate] = useState(getLocalDateString());
  const [activityName, setActivityName] = useState('');
  const [group, setGroup] = useState(GROUPS[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [rows, setRows] = useState<Row[]>(Array.from({ length: 5 }, () => ({ ...EMPTY_ROW })));
  const [image, setImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const achievementCriteria = useMemo(() => criteria.filter(c => c.type === 'PLUS'), [criteria]);

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

  /** Tìm tiêu chí ứng với "<giải> <hoạt động>", bỏ qua dấu và chữ hoa thường */
  const findCriteria = (prize: string, activity: string) => {
    if (!activity.trim()) return undefined;
    const target = removeVietnameseTones(`${prize} ${activity}`).replace(/\s+/g, ' ').trim();
    return achievementCriteria.find(
      c => removeVietnameseTones(c.content).replace(/\s+/g, ' ').trim() === target,
    );
  };

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows(prev =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Đổi giải hoặc vừa nhập tên hoạt động → gợi ý lại điểm từ tiêu chí có sẵn
        if (patch.prize !== undefined) {
          const found = findCriteria(next.prize, activityName);
          if (found) next.points = String(Math.abs(found.points));
        }
        return next;
      }),
    );
  };

  /** Khi gõ xong tên hoạt động thì điền điểm cho những dòng chưa có điểm */
  const applySuggestedPoints = (name: string) => {
    setRows(prev =>
      prev.map(row => {
        if (row.points) return row;
        const found = findCriteria(row.prize, name);
        return found ? { ...row, points: String(Math.abs(found.points)) } : row;
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

      // 2. Thiếu tiêu chí nào thì tạo mới để lần sau chọn lại được
      const newCriteria: typeof criteria = [];
      const criteriaIdFor = async (prize: string, points: number) => {
        const existing = findCriteria(prize, activity) ?? newCriteria.find(
          c => removeVietnameseTones(c.content) === removeVietnameseTones(`${prize} ${activity}`),
        );
        if (existing) return existing.id;

        const created = {
          id: `C${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          content: `${prize} ${activity}`,
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
              onBlur={e => applySuggestedPoints(e.target.value)}
            />
            <datalist id="activity-suggestions">
              {activitySuggestions.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nhóm hoạt động</label>
            <select className="w-full p-3 rounded-lg border border-slate-300 bg-white" value={group} onChange={e => setGroup(e.target.value)}>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Cấp độ</label>
            <select className="w-full p-3 rounded-lg border border-slate-300 bg-white" value={level} onChange={e => setLevel(e.target.value)}>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ngày ghi nhận</label>
            <input type="date" className="w-full p-3 rounded-lg border border-slate-300 bg-white" value={date} onChange={e => setDate(e.target.value)} />
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
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
            <tr>
              <th className="px-3 py-2 text-left">Lớp</th>
              <th className="px-3 py-2 text-left w-32">Số người tham gia</th>
              <th className="px-3 py-2 text-left w-40">Giải thưởng</th>
              <th className="px-3 py-2 text-left w-28">Số điểm</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const takenByOthers = rows.filter((_, j) => j !== i).map(r => r.classId);
              const suggested = findCriteria(row.prize, activityName);
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
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0}
                      className="w-full p-2 rounded border border-slate-200 bg-white"
                      placeholder="Số người"
                      value={row.participants}
                      onChange={e => updateRow(i, { participants: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full p-2 rounded border border-slate-200 bg-white"
                      value={row.prize}
                      onChange={e => updateRow(i, { prize: e.target.value })}
                    >
                      {PRIZES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0}
                      className={`w-full p-2 rounded border bg-white font-bold ${suggested ? 'border-green-300 text-green-700' : 'border-slate-200 text-slate-700'}`}
                      placeholder="Điểm"
                      title={suggested ? `Gợi ý từ tiêu chí "${suggested.content}"` : 'Hoạt động chưa có trong danh mục — tự nhập điểm'}
                      value={row.points}
                      onChange={e => updateRow(i, { points: e.target.value })}
                    />
                  </td>
                  <td className="px-2">
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

        <button
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
          className="w-full py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 border-t border-slate-100 flex items-center justify-center gap-1"
        >
          <Plus size={16} /> Thêm dòng
        </button>
      </div>

      <p className="text-xs text-slate-500 flex items-start gap-1.5">
        <Info size={14} className="mt-0.5 shrink-0" />
        Ô điểm viền xanh là điểm lấy sẵn từ tiêu chí đã có; hoạt động mới thì tự nhập điểm,
        hệ thống sẽ thêm tiêu chí để lần sau chọn lại. Số người tham gia chỉ để đối chiếu mức
        thưởng, không tự cộng vào điểm.
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
