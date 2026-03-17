// utils/generatePdf.ts
// ──────────────────────────────────────────────────────────────────────────────
// PDF Giới thiệu sản phẩm – Hệ Thống Quản Lý Nền Nếp CNT
// Dùng jsPDF + jspdf-autotable để tạo PDF client-side, không cần server
// ──────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Constants ────────────────────────────────────────────────────────────────
const RED    = [178, 34, 34]   as [number,number,number]; // Đỏ Đoàn TNCS
const DARK   = [30, 30, 30]    as [number,number,number];
const GRAY   = [90, 90, 90]    as [number,number,number];
const LGRAY  = [245, 245, 245] as [number,number,number];
const WHITE  = [255, 255, 255] as [number,number,number];
const GOLD   = [212, 175, 55]  as [number,number,number];
const W = 210; // A4 width mm
const H = 297; // A4 height mm

// ── Helpers ──────────────────────────────────────────────────────────────────
const hex2rgb = (doc: jsPDF, r: number, g: number, b: number) => {
  doc.setTextColor(r, g, b);
};

function sectionHeader(doc: jsPDF, y: number, title: string, icon = '●'): number {
  doc.setFillColor(...RED);
  doc.rect(14, y, W - 28, 9, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(`${icon}  ${title}`, 18, y + 6.3);
  doc.setTextColor(...DARK);
  return y + 14;
}

function bullet(doc: jsPDF, x: number, y: number, text: string, indent = 0): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  hex2rgb(doc, ...DARK);
  const lines = doc.splitTextToSize(text, W - 28 - x - indent + 14);
  doc.text('•', x + indent, y);
  doc.text(lines, x + indent + 4, y);
  return y + lines.length * 5.5;
}

function bodyText(doc: jsPDF, x: number, y: number, text: string, color = DARK): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, W - 28);
  doc.text(lines, x, y);
  return y + lines.length * 5.8;
}

function addFooter(doc: jsPDF, pageNum: number, total: number) {
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('© 2026 Lương Hải Anh – Hệ Thống Quản Lý Nền Nếp CNT  |  Tài liệu nội bộ – Bảo mật', 14, H - 8);
  doc.text(`Trang ${pageNum} / ${total}`, W - 22, H - 8, { align: 'right' });
  doc.setDrawColor(200, 200, 200);
  doc.line(14, H - 12, W - 14, H - 12);
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function generateProductPdf() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let page = 1;

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG BÌA
  // ════════════════════════════════════════════════════════════════════════════
  // Nền gradient tối giả bằng 2 rect
  doc.setFillColor(20, 20, 40);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 72, 'F');

  // Đường kẻ vàng trang trí
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(14, 72, W - 14, 72);
  doc.line(14, 74, W - 14, 74);

  // Lấy logo từ URL (CNT + Đoàn)
  try {
    const logoData = await fetchImageAsBase64('https://upload.wikimedia.org/wikipedia/commons/7/70/THPT_Chuyen_Nguyen_Trai.png');
    doc.addImage(logoData, 'PNG', 14, 8, 28, 28, undefined, 'FAST');
    const doanData = await fetchImageAsBase64('https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png');
    doc.addImage(doanData, 'PNG', W - 42, 8, 28, 28, undefined, 'FAST');
  } catch (_) { /* logo lỗi thì bỏ qua */ }

  // Tên sản phẩm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...GOLD);
  doc.text('HỆ THỐNG', W / 2, 50, { align: 'center' });
  doc.text('QUẢN LÝ NỀN NẾP', W / 2, 62, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(255, 220, 180);
  doc.text('TRƯỜNG THPT CHUYÊN NGUYỄN TRÃI – HẢI DƯƠNG', W / 2, 80, { align: 'center' });

  // Tagline
  doc.setFontSize(12);
  doc.setTextColor(200, 200, 220);
  doc.setFont('helvetica', 'italic');
  doc.text('"Số hoá toàn bộ quy trình theo dõi, đánh giá và xếp hạng nền nếp', W / 2, 96, { align: 'center' });
  doc.text('học sinh – chính xác, minh bạch, tức thì."', W / 2, 103, { align: 'center' });

  // Divider
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(40, 112, W - 40, 112);

  // Badges thông tin
  const badges = [
    ['📅', 'Phiên bản 1.0', '2026'],
    ['🏫', 'Đối tượng', 'Trường THPT'],
    ['☁️', 'Nền tảng', 'Web / Mobile'],
  ];
  badges.forEach(([icon, label, val], i) => {
    const bx = 22 + i * 60;
    doc.setFillColor(50, 20, 20);
    doc.roundedRect(bx, 118, 52, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text(`${icon} ${label}`, bx + 26, 126, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text(val, bx + 26, 133, { align: 'center' });
  });

  // Mục lục preview
  doc.setFillColor(35, 35, 60);
  doc.roundedRect(14, 152, W - 28, 100, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text('NỘI DUNG TÀI LIỆU', W / 2, 162, { align: 'center' });

  const toc = [
    'I.    Tổng quan sản phẩm',
    'II.   Tính năng nổi bật',
    'III.  Quy trình hoạt động',
    'IV.   Phân cấp & Phân quyền',
    'V.    Ưu việt so với phương pháp cũ',
    'VI.   Chi phí đầu tư nền tảng',
    'VII.  Mô hình nhân rộng',
    'VIII. Thông tin liên hệ & Bản quyền',
  ];
  toc.forEach((item, i) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(210, 210, 230);
    doc.text(item, 30, 172 + i * 9.5);
    doc.setTextColor(120, 120, 150);
    doc.text(`Trang ${i + 2}`, W - 22, 172 + i * 9.5, { align: 'right' });
  });

  // Footer bìa
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 130);
  doc.text('Tài liệu này được bảo mật. Vui lòng không phát tán khi chưa được phép.', W / 2, 264, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.setFontSize(10);
  doc.text('© 2026 Lương Hải Anh  ·  THPT Chuyên Nguyễn Trãi  ·  Hải Dương', W / 2, 272, { align: 'center' });

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 2: TỔNG QUAN SẢN PHẨM
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  let y = 18;
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text('HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  –  TÀI LIỆU GIỚI THIỆU SẢN PHẨM', 14, 8);

  y = sectionHeader(doc, y, 'I. TỔNG QUAN SẢN PHẨM', '🌟');

  y = bodyText(doc, 14, y,
    'Hệ thống Quản lý Nền nếp CNT là nền tảng số hoá toàn bộ quy trình theo dõi, ' +
    'đánh giá và xếp hạng nền nếp học sinh dành cho các trường THPT. Được phát triển ' +
    'bởi Lương Hải Anh tại THPT Chuyên Nguyễn Trãi (Hải Dương), hệ thống giải quyết ' +
    'triệt để bài toán ghi chép thủ công bằng sổ sách, giúp Ban Đoàn – Ban Nề Nếp ' +
    'vận hành hiệu quả, minh bạch và tiết kiệm thời gian.'
  );

  y += 4;
  y = sectionHeader(doc, y, 'BÀI TOÁN ĐẶT RA', '❓');
  const problems = [
    'Ghi chép vi phạm thủ công qua sổ giấy dễ thất lạc, sai sót, khó tổng hợp',
    'Tính điểm thi đua cuối tuần/tháng/học kỳ tốn nhiều giờ tra cứu và tính toán bằng tay',
    'Không có kênh thông tin minh bạch để học sinh, phụ huynh tra cứu tình hình nề nếp',
    'Báo cáo DOCX/Excel cho cấp trên phải làm thủ công sau mỗi kỳ đánh giá',
    'Không lưu trữ lịch sử dữ liệu qua các năm học để phân tích xu hướng',
  ];
  problems.forEach(p => { y = bullet(doc, 14, y, p); y += 1; });

  y += 4;
  y = sectionHeader(doc, y, 'GIẢI PHÁP CUNG CẤP', '✅');
  const solutions = [
    'Nhập liệu vi phạm/thành tích tức thì qua giao diện web trên điện thoại hoặc máy tính — không cần phần mềm cài đặt',
    'Hệ thống tự động tính điểm theo công thức chuẩn, cập nhật xếp hạng lớp theo tuần/tháng/học kỳ',
    'Giao diện tra cứu cho tất cả học sinh và phụ huynh (không cần đăng nhập)',
    'Xuất báo cáo DOCX/Excel một cấm bấm, đúng định dạng yêu cầu của nhà trường',
    'Lưu trữ dữ liệu tập trung trên Google Sheets — bền vững, có thể xuất và phân tích bất kỳ lúc nào',
  ];
  solutions.forEach(s => { y = bullet(doc, 14, y, s); y += 1; });

  addFooter(doc, page, 9);

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 3: TÍNH NĂNG NỔI BẬT
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  doc.setFillColor(...RED); doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text('HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  –  TÀI LIỆU GIỚI THIỆU SẢN PHẨM', 14, 8);
  y = 18;
  y = sectionHeader(doc, y, 'II. TÍNH NĂNG NỔI BẬT', '🚀');

  const features: [string, string][] = [
    ['📝 Nhập liệu vi phạm & thành tích', 'Nhập nhanh qua form có gợi ý; hỗ trợ vi phạm cá nhân và tập thể lớp; đính kèm ảnh minh chứng; nhập hàng loạt qua file CSV.'],
    ['🔍 Tra cứu & lọc', 'Lọc theo lớp, tiêu chí, loại (vi phạm/thành tích), khoảng thời gian (tuần/tháng/học kỳ). Làm nổi bật bản ghi trùng lặp để kiểm duyệt.'],
    ['🏆 Xếp hạng tự động', 'Bảng xếp hạng lớp cập nhật theo tuần/tháng/học kỳ; phân theo khối; màu sắc thể hiện thứ hạng; nhấn vào lớp để xem chi tiết.'],
    ['📄 Xuất báo cáo DOCX', 'Tự động tạo file Word theo đúng mẫu báo cáo, liệt kê đầy đủ vi phạm cá nhân lẫn tập thể theo từng tiêu chí, từng lớp.'],
    ['📊 Xuất bảng Excel', 'File Excel đẹp, tự tính điểm tổng, sẵn sàng nộp cho BGH hoặc lưu trữ.'],
    ['⚙️ Cấu hình linh hoạt', 'Admin cấu hình tiêu chí, điểm trừ/cộng, thời gian (tuần, tháng, học kỳ), tài khoản người dùng và phân quyền trực tiếp trên hệ thống.'],
    ['🔐 Bảo mật đăng nhập', 'Xác thực server-side — mật khẩu không bao giờ rời server. Phiên đăng nhập bền vững, không bị đăng xuất khi tải lại trang.'],
    ['✏️ Sửa hàng loạt (Bulk Edit)', 'Chọn nhiều vi phạm → đổi ngày, ghi chú hoặc tiêu chí cho tất cả chỉ trong 1 thao tác. Có nút Hoàn tác trong 8 giây.'],
    ['⚠️ Cảnh báo thông minh', 'Cảnh báo khi import dữ liệu có ngày ngoài kỳ cấu hình; cảnh báo trùng tuần trong Settings; badge nổi bật bản ghi lệch kỳ.'],
    ['📱 Tối ưu mobile', 'Giao diện responsive, hoạt động mượt mà trên điện thoại iOS/Android — không cần cài app.'],
    ['🎨 Giao diện đa chủ đề', 'Chế độ màu Đoàn TNCS (đỏ-vàng) và Winter (xanh tuyết) hoán đổi trực tiếp trên header.'],
  ];

  features.forEach(([title, desc]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED);
    doc.text(title, 14, y);
    y += 5;
    y = bodyText(doc, 18, y, desc);
    y += 3;
    if (y > H - 25) { addFooter(doc, page, 9); doc.addPage(); page++; y = 18; }
  });

  addFooter(doc, page, 9);

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 4: QUY TRÌNH HOẠT ĐỘNG
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  doc.setFillColor(...RED); doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text('HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  –  TÀI LIỆU GIỚI THIỆU SẢN PHẨM', 14, 8);
  y = 18;
  y = sectionHeader(doc, y, 'III. QUY TRÌNH HOẠT ĐỘNG', '🔄');

  const steps: [string, string, string][] = [
    ['1', '⚙️  ADMIN CẤU HÌNH HỆ THỐNG', 'Quản trị viên thiết lập danh sách lớp, học sinh, tiêu chí vi phạm/thành tích, điểm quy đổi và phân kỳ thời gian (tuần, tháng, học kỳ). Thao tác thực hiện trực tiếp trên giao diện Settings — không cần chỉnh sửa dữ liệu thô.'],
    ['2', '📝  GIÁO VIÊN / BAN NỀ NẾP NHẬP LIỆU', 'Mỗi ngày, cán bộ được phân quyền nhập vi phạm hoặc thành tích vào hệ thống qua form nhập liệu. Có thể nhập từng dòng hoặc import hàng loạt qua file CSV. Ảnh minh chứng được đính kèm trực tiếp.'],
    ['3', '🤖  HỆ THỐNG TỰ ĐỘNG TÍNH TOÁN', 'Mỗi khi có dữ liệu mới, điểm thi đua của từng lớp được tính lại tự động theo công thức: Điểm = 500 × (số tuần trong kỳ) − tổng điểm trừ + tổng điểm cộng. Không cần thao tác thủ công.'],
    ['4', '📊  XEM XẾP HẠNG & TRA CỨU', 'Toàn bộ giáo viên, học sinh, phụ huynh có thể tra cứu bảng xếp hạng theo tuần/tháng/học kỳ, xem lịch sử vi phạm của từng lớp — không cần đăng nhập.'],
    ['5', '📋  XUẤT BÁO CÁO CUỐI KỲ', 'Admin một cái bấm để xuất file DOCX (báo cáo chi tiết từng lớp) hoặc Excel (bảng tổng hợp điểm). File đúng chuẩn, sẵn sàng nộp cho Ban Giám Hiệu hoặc lưu trữ lịch sử.'],
  ];

  steps.forEach(([num, title, desc]) => {
    // Step box
    doc.setFillColor(...RED);
    doc.circle(20, y + 3, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...WHITE);
    doc.text(num, 20, y + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED);
    doc.text(title, 28, y + 4);
    y += 9;
    y = bodyText(doc, 28, y, desc);

    // Mũi tên xuống (trừ dòng cuối)
    if (num !== '5') {
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.5);
      doc.line(20, y, 20, y + 5);
      doc.triangle(17, y + 5, 23, y + 5, 20, y + 8, 'F');
    }
    y += 10;
  });

  addFooter(doc, page, 9);

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 5: PHÂN CẤP & PHÂN QUYỀN
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  doc.setFillColor(...RED); doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text('HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  –  TÀI LIỆU GIỚI THIỆU SẢN PHẨM', 14, 8);
  y = 18;
  y = sectionHeader(doc, y, 'IV. PHÂN CẤP & PHÂN QUYỀN', '🔐');

  autoTable(doc, {
    startY: y,
    head: [['Vai trò', 'Đối tượng', 'Quyền hạn']],
    body: [
      ['👁️ Khách\n(Không đăng nhập)', 'Học sinh, phụ huynh, khách', '• Xem bảng xếp hạng\n• Tra cứu lớp cụ thể\n• Xem lịch sử vi phạm (không có tên HS)'],
      ['✏️ Cán bộ Nhập liệu', 'Giáo viên, cán bộ Đoàn', '• Tất cả quyền Khách\n• Nhập vi phạm / thành tích mới\n• Xem toàn bộ danh sách vi phạm'],
      ['🛡️ Admin', 'GVCN, Phó Hiệu Trưởng', '• Tất cả quyền Cán bộ\n• Sửa / Xóa vi phạm đơn lẻ hoặc hàng loạt\n• Xuất báo cáo DOCX, Excel\n• Xem audit log xóa'],
      ['👑 Quản trị hệ thống', 'Chuyên viên CNTT, Hiệu trưởng', '• Tất cả quyền Admin\n• Cấu hình tiêu chí, điểm, lớp, học sinh\n• Quản lý tài khoản và phân quyền\n• Cấu hình thời gian kỳ đánh giá'],
    ],
    theme: 'striped',
    headStyles: { fillColor: RED, textColor: WHITE, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9, valign: 'top' },
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 45 }, 2: { cellWidth: 100 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;
  y = sectionHeader(doc, y, 'LƯU Ý PHÂN QUYỀN', 'ℹ️');
  const notes = [
    'Mỗi tài khoản được gán 1 vai trò cố định, quản trị viên có thể điều chỉnh bất kỳ lúc nào.',
    'Tài khoản Khách không cần đăng nhập — đây là thiết kế có chủ ý để minh bạch thông tin với toàn trường.',
    'Mật khẩu được mã hoá và kiểm tra hoàn toàn trên server — trình duyệt không bao giờ tiếp xúc với mật khẩu gốc.',
    'Nhật ký xóa (Audit Log) ghi lại đầy đủ ai xóa gì, lúc nào — hỗ trợ kiểm tra nội bộ.',
  ];
  notes.forEach(n => { y = bullet(doc, 14, y, n); y += 2; });

  addFooter(doc, page, 9);

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 6: SO SÁNH ƯU VIỆT
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  doc.setFillColor(...RED); doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text('HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  –  TÀI LIỆU GIỚI THIỆU SẢN PHẨM', 14, 8);
  y = 18;
  y = sectionHeader(doc, y, 'V. ƯU VIỆT SO VỚI PHƯƠNG PHÁP CŨ', '📊');

  autoTable(doc, {
    startY: y,
    head: [['Tiêu chí', '📓 Sổ giấy / Ghi tay', '📊 Excel thủ công', '🖥️ Nền Nếp CNT']],
    body: [
      ['Tốc độ nhập liệu', 'Chậm, dễ nhầm', 'Trung bình', '⚡ Nhanh, gợi ý tự động'],
      ['Tính điểm xếp hạng', 'Thủ công, sai số cao', 'Phải tự viết công thức', '✅ Tự động, chính xác 100%'],
      ['Tra cứu theo thời gian', 'Không có', 'Khó, phải sort tay', '✅ Lọc tuần/tháng/học kỳ tức thì'],
      ['Xuất báo cáo', 'Gõ tay từng kỳ (2-3 giờ)', 'Copy-paste (30-60 phút)', '✅ 1 cái bấm, < 5 giây'],
      ['Truy cập từ xa', 'Không', 'Phải gửi file qua Zalo/Email', '✅ Bất kỳ thiết bị, bất kỳ lúc nào'],
      ['Phân quyền truy cập', 'Không có', 'Không có', '✅ 4 mức, cấu hình linh hoạt'],
      ['Lưu trữ lịch sử', 'Thất lạc theo năm', 'Tuỳ thuộc người quản lý file', '✅ Tập trung, bền vững, tìm kiếm được'],
      ['Chi phí triển khai', '0đ (nhưng tốn thời gian)', '0đ (nhưng tốn thời gian)', '✅ Miễn phí nền tảng'],
      ['Khả năng nhân rộng', 'Không', 'Khó', '✅ Triển khai trường mới trong < 1 tuần'],
    ],
    theme: 'grid',
    headStyles: { fillColor: RED, textColor: WHITE, fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 9, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold' },
      1: { cellWidth: 40, halign: 'center', textColor: [150, 30, 30] },
      2: { cellWidth: 42, halign: 'center', textColor: [120, 80, 0] },
      3: { cellWidth: 52, halign: 'center', textColor: [20, 100, 20], fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, page, 9);

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 7: CHI PHÍ ĐẦU TƯ
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  doc.setFillColor(...RED); doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text('HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  –  TÀI LIỆU GIỚI THIỆU SẢN PHẨM', 14, 8);
  y = 18;
  y = sectionHeader(doc, y, 'VI. CHI PHÍ ĐẦU TƯ NỀN TẢNG', '💰');

  // Highlight box "Miễn phí nền tảng"
  doc.setFillColor(240, 255, 240);
  doc.setDrawColor(40, 140, 40);
  doc.setLineWidth(1);
  doc.roundedRect(14, y, W - 28, 20, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 120, 20);
  doc.text('✅  CHI PHÍ NỀN TẢNG: HOÀN TOÀN MIỄN PHÍ', W / 2, y + 9, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  doc.text('Toàn bộ hạ tầng vận hành dựa trên Google Workspace for Education (cấp miễn phí cho trường học)', W / 2, y + 15, { align: 'center' });
  y += 26;

  autoTable(doc, {
    startY: y,
    head: [['Thành phần', 'Mô tả', 'Chi phí']],
    body: [
      ['Google Sheets', 'Cơ sở dữ liệu lưu trữ toàn bộ dữ liệu nền nếp', 'Miễn phí'],
      ['Google Apps Script', 'Backend xử lý logic nghiệp vụ, phân quyền, API', 'Miễn phí'],
      ['Netlify (Hosting web)', 'Lưu trữ và phân phối giao diện web toàn cầu', 'Miễn phí (gói Free)'],
      ['Google Drive', 'Lưu trữ ảnh minh chứng vi phạm', 'Miễn phí (15GB/tài khoản)'],
    ],
    theme: 'striped',
    headStyles: { fillColor: RED, textColor: WHITE, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 110 },
      2: { cellWidth: 32, halign: 'center', textColor: [20, 120, 20], fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;
  y = sectionHeader(doc, y, 'CÁC GÓI DỊCH VỤ ĐỀ XUẤT', '📦');

  autoTable(doc, {
    startY: y,
    head: [['Gói', 'Bao gồm', 'Thời gian triển khai', 'Phù hợp với']],
    body: [
      ['🚀 Triển khai cơ bản', 'Cài đặt hệ thống + đào tạo 1 buổi + hỗ trợ 30 ngày', '3-5 ngày làm việc', 'Trường đã có Google Workspace'],
      ['⭐ Triển khai nâng cao', 'Cơ bản + tùy chỉnh tiêu chí, mẫu báo cáo DOCX theo yêu cầu + hỗ trợ 3 tháng', '1 tuần', 'Trường cần tùy biến báo cáo'],
      ['🏆 Bảo trì & Nâng cấp', 'Nâng cao + bảo trì định kỳ, thêm tính năng theo yêu cầu, hỗ trợ không giới hạn', 'Theo hợp đồng', 'Trường muốn đồng hành dài hạn'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 80], textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 78 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 38 },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, page, 9);

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 8: MÔ HÌNH NHÂN RỘNG
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  doc.setFillColor(...RED); doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text('HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  –  TÀI LIỆU GIỚI THIỆU SẢN PHẨM', 14, 8);
  y = 18;
  y = sectionHeader(doc, y, 'VII. MÔ HÌNH NHÂN RỘNG', '🌐');

  y = bodyText(doc, 14, y,
    'Hệ thống được thiết kế từ đầu với khả năng nhân rộng ra nhiều trường học. ' +
    'Mỗi trường sẽ có một phiên bản độc lập với dữ liệu riêng biệt, không chia sẻ thông tin với ' +
    'trường khác. Quá trình triển khai đơn giản, không yêu cầu phần cứng đặc biệt.'
  );
  y += 4;

  const roadmap: [string, string, string][] = [
    ['Bước 1', '1-2 ngày', 'Khảo sát nhu cầu trường: cơ cấu lớp, tiêu chí nề nếp, mẫu báo cáo hiện tại, tài khoản Google'],
    ['Bước 2', '1-2 ngày', 'Cài đặt hệ thống riêng cho trường: backend GAS, cơ sở dữ liệu Sheets, hosting web với domain/subdomain tùy chọn'],
    ['Bước 3', '1 ngày', 'Nhập dữ liệu nền: danh sách lớp, học sinh, tiêu chí vi phạm/thành tích, phân kỳ thời gian'],
    ['Bước 4', '1 buổi', 'Đào tạo sử dụng cho cán bộ quản lý và giáo viên nhập liệu (có tài liệu hướng dẫn kèm theo)'],
    ['Bước 5', '7-30 ngày', 'Giai đoạn vận hành thử — hỗ trợ trực tiếp qua điện thoại/Zalo. Điều chỉnh theo phản hồi thực tế'],
    ['Bước 6', 'Ổn định', 'Bàn giao chính thức, cam kết hỗ trợ kỹ thuật theo gói đã chọn'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Bước', 'Thời gian', 'Nội dung']],
    body: roadmap,
    theme: 'striped',
    headStyles: { fillColor: RED, textColor: WHITE, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 28, halign: 'center', textColor: RED },
      2: { cellWidth: 132 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;
  y = sectionHeader(doc, y, 'YÊU CẦU TỐI THIỂU ĐỂ TRIỂN KHAI', '📋');
  const requirements = [
    'Tài khoản Google (Gmail hoặc Google Workspace for Education của trường)',
    'Kết nối Internet ổn định (dùng để đồng bộ dữ liệu)',
    'Thiết bị nhập liệu: điện thoại smartphone hoặc máy tính (không cần cài đặt gì)',
    'Ít nhất 1 người phụ trách kỹ thuật tại trường để phối hợp cài đặt ban đầu',
  ];
  requirements.forEach(r => { y = bullet(doc, 14, y, r); y += 2; });

  addFooter(doc, page, 9);

  // ════════════════════════════════════════════════════════════════════════════
  // TRANG 9: LIÊN HỆ & BẢN QUYỀN
  // ════════════════════════════════════════════════════════════════════════════
  doc.addPage(); page++;
  // Nền tối
  doc.setFillColor(20, 20, 40);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 55, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...GOLD);
  doc.text('THÔNG TIN LIÊN HỆ', W / 2, 28, { align: 'center' });
  doc.setFontSize(11); doc.setTextColor(220, 220, 220);
  doc.text('Để được tư vấn, báo giá hoặc triển khai thử nghiệm', W / 2, 38, { align: 'center' });
  doc.text('vui lòng liên hệ trực tiếp với tác giả:', W / 2, 45, { align: 'center' });

  // Card thông tin
  doc.setFillColor(35, 35, 60);
  doc.roundedRect(30, 64, W - 60, 80, 5, 5, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(30, 64, W - 60, 80, 5, 5, 'D');

  const contacts = [
    ['👤 Tác giả',  'Lương Hải Anh'],
    ['🏫 Đơn vị',   'THPT Chuyên Nguyễn Trãi – TP. Hải Dương'],
    ['📧 Email',    'luonghaianh1208@gmail.com'],
    ['📞 SĐT/Zalo', '0328 186 264'],
    ['🌐 Demo live', 'https://nennepcnt.netlify.app'],
  ];
  contacts.forEach(([label, val], i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GOLD);
    doc.text(label, 44, 80 + i * 12);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(220, 220, 255);
    doc.text(val, 90, 80 + i * 12);
  });

  // Cam kết
  doc.setFillColor(25, 25, 50);
  doc.roundedRect(14, 158, W - 28, 50, 4, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...GOLD);
  doc.text('CAM KẾT CỦA TÁC GIẢ', W / 2, 168, { align: 'center' });
  const commitments = [
    '✅  Sản phẩm đã vận hành thực tế tại THPT Chuyên Nguyễn Trãi từ đầu năm 2026',
    '✅  Hỗ trợ kỹ thuật nhanh chóng, nhiệt tình trong suốt quá trình sử dụng',
    '✅  Liên tục cập nhật, cải tiến theo phản hồi thực tế của đơn vị sử dụng',
  ];
  commitments.forEach((c, i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 230);
    doc.text(c, W / 2, 178 + i * 10, { align: 'center' });
  });

  // Bản quyền cuối trang
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(14, 224, W - 14, 224);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GOLD);
  doc.text('© 2026 Lương Hải Anh. Bảo lưu mọi quyền.', W / 2, 232, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(150, 150, 180);
  doc.text('Tài liệu này được bảo mật. Nghiêm cấm sao chép, phát tán khi chưa có sự đồng ý bằng văn bản của tác giả.', W / 2, 240, { align: 'center' });
  doc.text('Thương hiệu "Nền Nếp CNT" và toàn bộ giải pháp trong tài liệu này thuộc quyền sở hữu của tác giả.', W / 2, 248, { align: 'center' });

  addFooter(doc, page, 9);

  // ── SAVE FILE ────────────────────────────────────────────────────────────────
  doc.save('HeThong_NenNep_CNT_GioiThieuSanPham_2026.pdf');
}

// ── Fetch ảnh về base64 (qua cors proxy hoặc trực tiếp) ──────────────────────
async function fetchImageAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
