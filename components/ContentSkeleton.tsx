import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Khung xám thay cho màn hình chờ chặn cả trang.
 *
 * Giao diện, thanh tiêu đề và thanh điều hướng hiện ngay từ đầu; chỉ vùng nội
 * dung là khung xám cho tới khi dữ liệu về. Người dùng thấy app sống sau khoảng
 * một giây thay vì ngồi nhìn vòng xoay.
 */
const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
);

const ContentSkeleton: React.FC = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Đang tải dữ liệu">
    {/* Dải tổng quan */}
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <Bar className="h-4 w-40" />
      <Bar className="h-3 w-28" />
    </div>

    {/* Bốn ô số liệu */}
    <div className="grid grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <Bar className="h-3 w-24" />
          <Bar className="h-7 w-12" />
          <Bar className="h-2 w-20" />
        </div>
      ))}
    </div>

    {/* Khối biểu đồ */}
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <Bar className="h-4 w-56" />
      <Bar className="h-40 w-full" />
    </div>

    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-2">
      <Loader2 size={16} className="animate-spin" />
      Đang tải dữ liệu từ hệ thống...
    </div>
  </div>
);

export default ContentSkeleton;
