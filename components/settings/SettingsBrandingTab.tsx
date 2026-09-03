import React, { useRef, useState, useEffect } from 'react';
import { Save, Image as ImageIcon, Loader2, Info, X } from 'lucide-react';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';
import { api, userMessage } from '../../services/firebase';

/**
 * Thương hiệu của trường: tên, logo, khẩu hiệu, năm học.
 * Đây là toàn bộ phần khách hàng được phép đổi — phần bản quyền tác giả nằm
 * trong trang Giới thiệu và không sửa được từ giao diện.
 */
const SettingsBrandingTab: React.FC = () => {
  const { branding, saveBranding } = useAppStore();
  const { showToast, showAlert } = useModal();

  const [form, setForm] = useState(branding);
  const [dirty, setDirty] = useState(false);

  // Thương hiệu nạp bất đồng bộ — xem chú thích cùng lỗi ở SettingsRulesTab
  useEffect(() => { if (!dirty) setForm(branding); }, [branding, dirty]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<typeof form>) => { setForm(prev => ({ ...prev, ...patch })); setDirty(true); };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      return showToast('Logo nên nhỏ hơn 2MB để trang tải nhanh', 'error');
    }

    const reader = new FileReader();
    reader.onload = async ev => {
      setIsUploading(true);
      try {
        const res = await api.uploadLogo(ev.target?.result as string);
        if (res.status !== 'success') throw new Error(res.message || 'Không tải được logo');
        set({ logoUrl: res.url });
        showToast('Đã tải logo lên, nhớ bấm Lưu', 'success');
      } catch (err: any) {
        showAlert('Không tải được logo', userMessage(err), 'error');
      } finally {
        setIsUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.schoolName.trim() || !form.shortName.trim()) {
      return showToast('Tên trường và tên rút gọn không được để trống', 'error');
    }
    setIsSaving(true);
    const ok = await saveBranding({ ...form, schoolName: form.schoolName.trim(), shortName: form.shortName.trim() });
    setIsSaving(false);
    if (ok) setDirty(false);
    showToast(ok ? 'Đã lưu thương hiệu' : 'Lưu thất bại, thử lại giúp em', ok ? 'success' : 'error');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-5">
      <div>
        <h3 className="font-bold text-lg text-slate-800">Thương hiệu nhà trường</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Những thông tin này hiện trên thanh tiêu đề và trang giới thiệu của hệ thống.
        </p>
      </div>

      {/* Xem trước đúng như trên thanh tiêu đề */}
      <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: `linear-gradient(160deg, var(--brand-from, #b91c1c), var(--brand-to, #7f1d1d))` }}>
        {form.logoUrl ? (
          <img src={form.logoUrl} alt="Logo" className="w-11 h-11 object-contain bg-white rounded-full p-0.5 shadow-md" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-white/90 text-red-800 font-black flex items-center justify-center shadow-md">
            {form.shortName.trim().charAt(0) || 'N'}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xl font-black text-yellow-300 leading-none truncate">{form.shortName || 'TÊN RÚT GỌN'}</div>
          <div className="text-[10px] text-yellow-300 font-bold uppercase tracking-widest mt-1 truncate">
            {form.schoolName || 'Tên đầy đủ của trường'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">Tên đầy đủ của trường *</label>
          <input
            className="w-full p-2.5 border border-slate-300 rounded-lg"
            placeholder="Ví dụ: Trường THPT Nguyễn Huệ – Hà Nội"
            value={form.schoolName}
            onChange={e => set({ schoolName: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Tên rút gọn trên tiêu đề *</label>
          <input
            className="w-full p-2.5 border border-slate-300 rounded-lg"
            placeholder="NỀN NẾP CNT"
            value={form.shortName}
            onChange={e => set({ shortName: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Năm học</label>
          <input
            className="w-full p-2.5 border border-slate-300 rounded-lg"
            placeholder="2025-2026"
            value={form.academicYear ?? ''}
            onChange={e => set({ academicYear: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">Khẩu hiệu (hiện ở trang giới thiệu)</label>
          <input
            className="w-full p-2.5 border border-slate-300 rounded-lg"
            placeholder="Hệ Thống Quản Lý Nền Nếp"
            value={form.slogan ?? ''}
            onChange={e => set({ slogan: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">Logo trường</label>
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleLogo} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
              {form.logoUrl ? 'Đổi logo khác' : 'Chọn ảnh logo'}
            </button>
            {form.logoUrl && (
              <button
                onClick={() => set({ logoUrl: '' })}
                className="flex items-center gap-1 px-3 py-2.5 text-slate-500 hover:text-red-600 text-sm"
              >
                <X size={14} /> Bỏ logo
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Nên dùng ảnh vuông, nền trong suốt (PNG), dưới 2MB.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <Info size={14} className="mt-0.5 shrink-0" />
        Tông màu nhận diện đổi ở tab <strong>Quy định</strong>. Phần bản quyền tác giả trong trang
        Giới thiệu là cố định, không thay đổi được.
      </p>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full md:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        Lưu thương hiệu
      </button>
    </div>
  );
};

export default SettingsBrandingTab;
