import React, { useState } from 'react';
import { Plus, X, Pencil, Check } from 'lucide-react';

/** Tên dài hơn thế này là vỡ bảng điểm thưởng, chặn ngay ở ô nhập */
export const MAX_LABEL = 40;

/**
 * Ô nhập danh sách dạng thẻ: gõ rồi Enter để thêm, bút chì để sửa tên tại chỗ,
 * x để bỏ. Đặt ở file riêng vì cả tab Quy định lẫn tab Điểm thưởng đều dùng,
 * và để gõ dở không bị mất khi component cha vẽ lại.
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
              className="text-green-600 hover:text-green-700 disabled:text-slate-400"
              title={isValid ? 'Lưu tên mới' : 'Tên trống hoặc trùng mục khác'}>
              <Check size={13} />
            </button>
            <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-600" title="Thôi không sửa">
              <X size={13} />
            </button>
          </span>
        ) : (
          <span key={item} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full pl-3 pr-1.5 py-1 text-sm">
            {item}
            <button onClick={() => { setEditing(item); setNewName(item); }}
              className="text-slate-500 hover:text-blue-600" title={`Sửa tên ${item}`}>
              <Pencil size={11} />
            </button>
            <button onClick={() => onChange(items.filter(i => i !== item))}
              className="text-slate-500 hover:text-red-600" title={`Bỏ ${item}`}>
              <X size={13} />
            </button>
          </span>
        )))}
        {!items.length && <span className="text-xs text-slate-500 italic">Chưa có mục nào</span>}
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
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
};

export default ListEditor;
