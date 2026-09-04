// components/AboutModal.tsx
import React from 'react';
import { X, Download, ExternalLink, Users, BarChart3, FileText, Zap, Palette } from 'lucide-react';
import { generateProductHtml } from '../utils/generateHtml';
import { useAppStore } from '../contexts/AppContext';

/** Phiên bản và bản quyền — cố định, trường sử dụng không sửa được từ giao diện */
export const APP_VERSION = '4.1.1 — Tháng 9/2026';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { branding } = useAppStore();
  const handleDownload = () => {
    generateProductHtml();
  };

  if (!isOpen) return null;

  // Nói bằng giá trị người dùng nhận được, không nhắc tên công nghệ
  const features = [
    { icon: <Zap size={16} />, label: 'Cập nhật trực tiếp — một người nhập, cả trường thấy ngay' },
    { icon: <BarChart3 size={16} />, label: 'Tự động tính điểm và xếp hạng theo tuần, tháng, học kỳ' },
    { icon: <FileText size={16} />, label: 'Nhập vi phạm và khen thưởng nhiều lớp trong một lượt' },
    { icon: <Download size={16} />, label: 'Báo cáo Word và Excel xuất trong một lần bấm' },
    { icon: <Users size={16} />, label: 'Đăng nhập bằng tài khoản Google, cấp quyền hàng loạt từ Excel' },
    { icon: <Palette size={16} />, label: 'Mang thương hiệu riêng của nhà trường' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
        <div className="w-full max-w-md md:max-w-lg bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">

          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="relative mx-4 rounded-2xl p-4 mt-2 overflow-hidden" style={{ background: `linear-gradient(160deg, var(--brand-from, #b91c1c), var(--brand-to, #7f1d1d))` }}>
            {/* Decorative */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -right-2 top-8 w-16 h-16 bg-white/5 rounded-full" />

            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={branding.schoolName}
                      className="w-10 h-10 object-contain bg-white rounded-full p-0.5 shadow-md z-10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white text-red-800 font-black flex items-center justify-center shadow-md z-10">
                      {branding.shortName.trim().charAt(0) || 'N'}
                    </div>
                  )}
                  <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png"
                    alt="Đoàn" className="w-10 h-10 object-contain z-0" />
                </div>
                <div>
                  <h2 className="text-white font-black text-lg leading-tight">{branding.shortName}</h2>
                  <p className="text-yellow-300 text-xs font-semibold">{branding.slogan || 'Hệ Thống Quản Lý Nền Nếp'}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white transition-colors mt-1">
                <X size={20} />
              </button>
            </div>

            <p className="text-red-100 text-xs mt-3 leading-relaxed relative z-10">
              Nền tảng số hoá toàn bộ quy trình theo dõi, đánh giá và xếp hạng nền nếp học sinh — 
              chính xác, minh bạch, tức thì.
            </p>
          </div>

          {/* Features grid */}
          <div className="px-4 mt-4 grid grid-cols-2 gap-2">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <span className="text-red-600">{f.icon}</span>
                <span className="text-xs font-medium text-slate-700">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Info rows */}
          <div className="px-4 mt-4 space-y-2">
            {[
              ['Đơn vị sử dụng', branding.schoolName],
              ['Năm học', branding.academicYear || '—'],
              ['Phiên bản', APP_VERSION],
              ['Tác giả', 'Lương Hải Anh — 2Anh AI Education'],
              ['Nền tảng', 'Web App (iOS · Android · Desktop)'],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <span className="text-xs text-slate-800 font-semibold">{val}</span>
              </div>
            ))}
          </div>

          {/* Live link */}
          <div className="px-4 mt-3">
            <a
              href="https://nennep-demo.web.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-sm font-semibold text-blue-700 transition-all"
            >
              <ExternalLink size={14} />
              Xem Demo trực tiếp
            </a>
          </div>

          {/* PDF Button */}
          <div className="px-4 mt-3 pb-8">
            <button
              onClick={handleDownload}
              className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Tải tài liệu giới thiệu sản phẩm (HTML)
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">
              File HTML đẹp · 9 trang · Có nút tải ảnh ZIP
            </p>
          </div>

          {/* Copyright */}
          <div className="border-t border-slate-100 px-4 py-3 text-center bg-slate-50 rounded-none">
            <p className="text-[10px] text-slate-500">
              © 2026 Lương Hải Anh · 2Anh AI Education
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Bảo lưu mọi quyền — Không sao chép khi chưa được phép
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutModal;
