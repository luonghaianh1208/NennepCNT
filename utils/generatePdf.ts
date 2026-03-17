// utils/generatePdf.ts
// ── Rewrite: html2pdf.js (browser-native fonts → Vietnamese OK) ───────────────
// Palette: #1E459F (Navy) · #CF2A2A (Red) · #FABD32 (Gold) · #E1DCCA (Cream)

/* eslint-disable @typescript-eslint/ban-ts-comment */
export async function generateProductPdf(): Promise<void> {
  // @ts-ignore – html2pdf.js has no @types but works at runtime
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-99999px;left:0;width:210mm;background:#fff;';
  container.innerHTML = buildHTML();
  document.body.appendChild(container);

  try {
    await (html2pdf as any)().set({
      margin: 0,
      filename: 'HeThong_NenNep_CNT_GioiThieuSanPham_2026.pdf',
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.pb' },
    }).from(container).save();
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function css(): string {
  return `<style>
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body,html{font-family:'Be Vietnam Pro','Segoe UI',Arial,sans-serif;font-size:10px;}
    .pb{page-break-before:always;}
    /* ── Trang bìa ── */
    .cover{width:210mm;min-height:297mm;background:linear-gradient(150deg,#1E459F 0%,#2156c8 35%,#a52222 65%,#CF2A2A 100%);position:relative;display:flex;flex-direction:column;padding:12mm 14mm 10mm;}
    .cover-stripe{position:absolute;top:0;left:0;right:0;height:3mm;background:linear-gradient(90deg,#FABD32,#fff0,#FABD32);}
    .cover-logos{display:flex;justify-content:space-between;align-items:center;margin-bottom:10mm;}
    .cover-logos img{height:18mm;width:18mm;object-fit:contain;background:white;border-radius:50%;padding:2px;}
    .cover-logos .school-name{text-align:center;color:#FABD32;font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;}
    .cover-title{text-align:center;margin:4mm 0 6mm;}
    .cover-title h1{font-size:30px;font-weight:900;color:#FABD32;letter-spacing:2px;line-height:1.25;text-shadow:0 2px 8px rgba(0,0,0,0.4);}
    .cover-title .sub{font-size:13px;color:rgba(255,255,255,0.9);font-weight:600;margin-top:3mm;letter-spacing:1px;}
    .cover-divider{height:2px;background:linear-gradient(90deg,transparent,#FABD32 30%,#FABD32 70%,transparent);margin:4mm 20mm;}
    .cover-tagline{text-align:center;color:rgba(255,255,255,0.85);font-size:10px;font-style:italic;line-height:1.7;margin:4mm 8mm;}
    .cover-badges{display:flex;justify-content:center;gap:6mm;margin:6mm 0;}
    .badge{background:rgba(255,255,255,0.1);border:1px solid rgba(250,189,50,0.5);border-radius:6px;padding:4mm 6mm;text-align:center;min-width:42mm;}
    .badge .bicon{font-size:16px;display:block;margin-bottom:2mm;}
    .badge .blabel{font-size:7.5px;color:#FABD32;font-weight:700;text-transform:uppercase;letter-spacing:1px;}
    .badge .bval{font-size:9px;color:rgba(255,255,255,0.9);font-weight:600;margin-top:1mm;}
    .cover-toc{background:#E1DCCA;border-radius:8px;padding:6mm 8mm;margin:6mm 0;border-left:4px solid #FABD32;}
    .toc-title{font-size:11px;font-weight:900;color:#1E459F;text-align:center;text-transform:uppercase;letter-spacing:2px;margin-bottom:4mm;border-bottom:2px solid #FABD32;padding-bottom:2mm;}
    .toc-row{display:flex;justify-content:space-between;padding:2mm 0;border-bottom:1px dashed rgba(30,69,159,0.2);}
    .toc-row:last-child{border-bottom:none;}
    .toc-num{color:#CF2A2A;font-weight:700;min-width:10mm;}
    .toc-label{color:#1E459F;font-weight:600;flex:1;}
    .toc-page{color:#CF2A2A;font-size:8.5px;font-weight:700;}
    .cover-footer{margin-top:auto;text-align:center;}
    .cover-footer p{font-size:8px;color:rgba(255,255,255,0.55);margin-bottom:2mm;}
    .cover-footer .copy{font-size:9px;color:#FABD32;font-weight:700;}
    /* ── Trang nội dung ── */
    .page{width:210mm;min-height:297mm;background:#fff;display:flex;flex-direction:column;}
    .ph{background:linear-gradient(135deg,#1E459F,#CF2A2A);padding:5px 14mm;display:flex;justify-content:space-between;align-items:center;}
    .ph-name{color:white;font-size:8px;font-weight:700;letter-spacing:0.5px;}
    .ph-right{color:rgba(255,255,255,0.7);font-size:7.5px;}
    .content{flex:1;padding:5mm 14mm 4mm;}
    .section-hdr{background:linear-gradient(90deg,#CF2A2A,#1E459F);color:white;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:900;margin:5mm 0 4mm;display:flex;align-items:center;gap:6px;}
    .section-hdr .icon{font-size:14px;}
    .sub-hdr{color:#1E459F;font-weight:700;font-size:10px;border-left:3px solid #FABD32;padding-left:8px;margin:5mm 0 3mm;}
    .body-txt{color:#333;font-size:9px;line-height:1.7;margin-bottom:3mm;}
    .bullet{color:#333;font-size:9px;line-height:1.65;padding-left:12px;position:relative;margin-bottom:2.5mm;}
    .bullet::before{content:'●';color:#FABD32;position:absolute;left:0;font-size:8px;}
    .card{background:#E1DCCA;border-left:4px solid #CF2A2A;padding:4mm 6mm;border-radius:4px;margin:3mm 0;}
    .highlight{background:linear-gradient(135deg,#1E459F15,#CF2A2A10);border:1px solid #FABD32;border-radius:6px;padding:5mm;text-align:center;margin:4mm 0;}
    .highlight h3{font-size:13px;font-weight:900;color:#1E459F;margin-bottom:2mm;}
    .highlight p{font-size:8.5px;color:#555;}
    .step{display:flex;gap:8px;margin-bottom:5mm;align-items:flex-start;}
    .step-num{min-width:22px;height:22px;background:linear-gradient(135deg,#1E459F,#CF2A2A);color:#FABD32;font-weight:900;font-size:11px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .step-body h4{color:#1E459F;font-weight:700;font-size:10px;margin-bottom:2px;}
    .step-body p{color:#444;font-size:9px;line-height:1.6;}
    .step-arrow{text-align:left;padding-left:11px;color:#FABD32;font-size:14px;margin:-3mm 0;}
    /* Tables */
    table{width:100%;border-collapse:collapse;font-size:9px;margin:3mm 0;}
    th{background:linear-gradient(135deg,#1E459F,#CF2A2A);color:white;padding:5px 8px;font-weight:700;text-align:left;}
    td{padding:5px 8px;vertical-align:top;border-bottom:1px solid #E1DCCA;color:#333;}
    tr:nth-child(even) td{background:#f8f5ef;}
    tr:hover td{background:#E1DCCA44;}
    .td-role{font-weight:700;color:#1E459F;}
    .td-green{color:#1a7a1a;font-weight:700;}
    .td-red{color:#CF2A2A;}
    /* Footer trang */
    .pf{border-top:1.5px solid #E1DCCA;padding:3px 14mm;display:flex;justify-content:space-between;align-items:center;margin-top:auto;}
    .pf-left{font-size:7.5px;color:#888;}
    .pf-right{font-size:7.5px;color:#CF2A2A;font-weight:700;}
    /* Trang cuối */
    .last-page{width:210mm;min-height:297mm;background:linear-gradient(150deg,#1E459F 0%,#152f6a 60%,#1E459F 100%);display:flex;flex-direction:column;padding:12mm 14mm;}
    .contact-box{background:#E1DCCA;border-radius:10px;padding:8mm;margin:6mm 0 4mm;}
    .contact-row{display:flex;gap:6mm;padding:2.5mm 0;border-bottom:1px dashed rgba(30,69,159,0.2);}
    .contact-row:last-child{border-bottom:none;}
    .contact-lbl{color:#CF2A2A;font-weight:700;font-size:9.5px;min-width:30mm;}
    .contact-val{color:#1E459F;font-weight:600;font-size:9.5px;}
    .commit-box{background:rgba(255,255,255,0.08);border:1px solid rgba(250,189,50,0.4);border-radius:8px;padding:5mm 8mm;margin:4mm 0;}
    .commit-item{color:rgba(255,255,255,0.85);font-size:9px;line-height:1.8;padding-left:18px;position:relative;}
    .commit-item::before{content:'✅';position:absolute;left:0;}
  </style>`;
}

function pageHeader(title: string): string {
  return `<div class="ph"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP CNT  —  TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">${title}</span></div>`;
}

function pageFooter(num: number, total: number): string {
  return `<div class="pf"><span class="pf-left">© 2026 Lương Hải Anh – Hệ thống Quản lý Nền nếp CNT  |  Tài liệu bảo mật</span><span class="pf-right">Trang ${num} / ${total}</span></div>`;
}

function sectionHdr(icon: string, title: string): string {
  return `<div class="section-hdr"><span class="icon">${icon}</span>${title}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
function buildHTML(): string {
  const TOTAL = 9;
  return css() + cover() + p2() + p3() + p4() + p5() + p6() + p7() + p8() + p9(TOTAL);
}

// ── Trang bìa ────────────────────────────────────────────────────────────────
function cover(): string { return `
<div class="cover">
  <div class="cover-stripe"></div>

  <div class="cover-logos">
    <div style="text-align:center">
      <img src="https://upload.wikimedia.org/wikipedia/commons/7/70/THPT_Chuyen_Nguyen_Trai.png" alt="CNT" />
      <div class="school-name" style="margin-top:3px">THPT Chuyên<br>Nguyễn Trãi</div>
    </div>
    <div style="text-align:center">
      <div class="cover-title" style="margin:0">
        <h1>HỆ THỐNG<br>QUẢN LÝ NỀN NẾP</h1>
        <div class="sub">TRƯỜNG THPT CHUYÊN NGUYỄN TRÃI – HẢI DƯƠNG</div>
      </div>
    </div>
    <div style="text-align:center">
      <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png" alt="Đoàn" />
      <div class="school-name" style="margin-top:3px">Đoàn TNCS<br>Hồ Chí Minh</div>
    </div>
  </div>

  <div class="cover-divider"></div>

  <div class="cover-tagline">
    <em>"Số hoá toàn bộ quy trình theo dõi, đánh giá và xếp hạng nền nếp<br>
    học sinh — chính xác, minh bạch, tức thì."</em>
  </div>

  <div class="cover-badges">
    <div class="badge"><span class="bicon">📅</span><div class="blabel">Phiên bản</div><div class="bval">3.1.0 · 2026</div></div>
    <div class="badge"><span class="bicon">🏫</span><div class="blabel">Đối tượng</div><div class="bval">Trường THPT</div></div>
    <div class="badge"><span class="bicon">📱</span><div class="blabel">Truy cập</div><div class="bval">Web / Mobile</div></div>
  </div>

  <div class="cover-toc">
    <div class="toc-title">Nội dung tài liệu</div>
    ${[
      ['I','Tổng quan sản phẩm','2'],['II','Tính năng nổi bật','3'],
      ['III','Quy trình hoạt động','4'],['IV','Phân cấp & Phân quyền','5'],
      ['V','Ưu việt so với phương pháp cũ','6'],['VI','Chi phí đầu tư nền tảng','7'],
      ['VII','Mô hình nhân rộng','8'],['VIII','Thông tin liên hệ & Bản quyền','9'],
    ].map(([n,l,p])=>`<div class="toc-row"><span class="toc-num">${n}.</span><span class="toc-label">${l}</span><span class="toc-page">Trang ${p}</span></div>`).join('')}
  </div>

  <div class="cover-footer">
    <p>Tài liệu này được bảo mật. Vui lòng không phát tán khi chưa được phép.</p>
    <div class="copy">© 2026 Lương Hải Anh  ·  THPT Chuyên Nguyễn Trãi  ·  Hải Phòng</div>
  </div>
</div>`; }

// ── Trang 2: Tổng quan ───────────────────────────────────────────────────────
function p2(): string { return `
<div class="page pb">
  ${pageHeader('Tổng quan sản phẩm')}
  <div class="content">
    ${sectionHdr('🌟','I. TỔNG QUAN SẢN PHẨM')}
    <p class="body-txt">Hệ thống Quản lý Nền nếp CNT là nền tảng <strong>số hoá toàn bộ quy trình theo dõi, đánh giá và xếp hạng nền nếp học sinh</strong> dành cho các trường THPT. Được phát triển bởi <strong>Lương Hải Anh</strong> tại THPT Chuyên Nguyễn Trãi (Hải Phòng), hệ thống giải quyết triệt để bài toán ghi chép thủ công bằng sổ sách, giúp Ban Đoàn – Ban Nề Nếp vận hành hiệu quả, minh bạch và tiết kiệm thời gian.</p>

    ${sectionHdr('❓','BÀI TOÁN ĐẶT RA')}
    ${[
      'Ghi chép vi phạm thủ công qua sổ giấy dễ thất lạc, sai sót, khó tổng hợp',
      'Tính điểm thi đua cuối tuần/tháng/học kỳ tốn nhiều giờ tra cứu và tính toán bằng tay',
      'Không có kênh thông tin minh bạch để học sinh, phụ huynh tra cứu tình hình nề nếp',
      'Báo cáo DOCX/Excel cho cấp trên phải làm thủ công sau mỗi kỳ đánh giá',
      'Không lưu trữ lịch sử dữ liệu qua các năm học để phân tích xu hướng',
    ].map(t=>`<div class="bullet">${t}</div>`).join('')}

    ${sectionHdr('✅','GIẢI PHÁP CUNG CẤP')}
    ${[
      'Nhập liệu vi phạm/thành tích tức thì qua giao diện web trên điện thoại hoặc máy tính — không cần phần mềm cài đặt',
      'Hệ thống tự động tính điểm theo công thức chuẩn, cập nhật xếp hạng lớp theo tuần/tháng/học kỳ',
      'Giao diện tra cứu cho tất cả học sinh và phụ huynh (không cần đăng nhập)',
      'Xuất báo cáo DOCX/Excel chỉ một cái bấm, đúng định dạng yêu cầu của nhà trường',
      'Lưu trữ dữ liệu tập trung trên Google Sheets — bền vững, có thể xuất và phân tích bất kỳ lúc nào',
    ].map(t=>`<div class="bullet">${t}</div>`).join('')}

    <div class="highlight">
      <h3>🎯 Sứ mệnh</h3>
      <p>Biến công việc quản lý nền nếp từ gánh nặng thủ công trở thành quy trình<br>tự động, chính xác và hoàn toàn minh bạch với toàn trường.</p>
    </div>
  </div>
  ${pageFooter(2,9)}
</div>`; }

// ── Trang 3: Tính năng ───────────────────────────────────────────────────────
function p3(): string {
  const feats: [string,string,string][] = [
    ['📝','Nhập liệu vi phạm & thành tích','Nhập nhanh qua form có gợi ý tên lớp/học sinh; hỗ trợ vi phạm cá nhân và tập thể lớp; đính kèm ảnh minh chứng; import hàng loạt qua file CSV.'],
    ['🔍','Tra cứu & Lọc','Lọc theo lớp, tiêu chí, loại (vi phạm/thành tích), khoảng thời gian (tuần/tháng/học kỳ). Nổi bật bản ghi trùng lặp để kiểm duyệt.'],
    ['🏆','Xếp hạng tự động','Bảng xếp hạng lớp cập nhật theo tuần/tháng/học kỳ; phân theo khối; màu sắc thể hiện thứ hạng; nhấn vào lớp để xem chi tiết vi phạm.'],
    ['📄','Xuất báo cáo DOCX','Tự động tạo file Word theo đúng mẫu báo cáo; liệt kê đầy đủ vi phạm cá nhân lẫn tập thể theo từng tiêu chí, từng lớp.'],
    ['📊','Xuất bảng Excel','File Excel đẹp, tự tính điểm tổng, sẵn sàng nộp cho Ban Giám Hiệu hoặc lưu trữ.'],
    ['⚙️','Cấu hình linh hoạt','Admin cấu hình tiêu chí, điểm trừ/cộng, thời gian (tuần/tháng/học kỳ), tài khoản người dùng và phân quyền trực tiếp trên hệ thống.'],
    ['🔐','Bảo mật đăng nhập','Xác thực server-side — mật khẩu không bao giờ rời server. Phiên đăng nhập bền vững, không bị đăng xuất khi tải lại trang.'],
    ['✏️','Sửa hàng loạt (Bulk Edit)','Chọn nhiều vi phạm → đổi ngày, ghi chú hoặc tiêu chí cho tất cả chỉ trong 1 thao tác. Có nút Hoàn tác trong 8 giây.'],
    ['⚠️','Cảnh báo thông minh','Cảnh báo khi import dữ liệu có ngày ngoài kỳ cấu hình; cảnh báo trùng tuần trong Settings; badge nổi bật bản ghi lệch kỳ.'],
    ['📱','Tối ưu mobile','Giao diện responsive, hoạt động mượt mà trên điện thoại iOS/Android — không cần cài app.'],
    ['🎨','Đa giao diện','Chế độ màu Đoàn TNCS (đỏ-vàng) và Winter (xanh tuyết) — đổi trực tiếp trên header.'],
  ];
  return `
<div class="page pb">
  ${pageHeader('Tính năng nổi bật')}
  <div class="content">
    ${sectionHdr('🚀','II. TÍNH NĂNG NỔI BẬT')}
    ${feats.map(([icon,title,desc])=>`
    <div style="display:flex;gap:8px;margin-bottom:4mm;align-items:flex-start;">
      <div style="min-width:26px;height:26px;background:linear-gradient(135deg,#1E459F,#CF2A2A);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">${icon}</div>
      <div>
        <div style="color:#1E459F;font-weight:700;font-size:10px;margin-bottom:1px;">${title}</div>
        <div style="color:#444;font-size:8.5px;line-height:1.6;">${desc}</div>
      </div>
    </div>`).join('')}
  </div>
  ${pageFooter(3,9)}
</div>`; }

// ── Trang 4: Quy trình ───────────────────────────────────────────────────────
function p4(): string {
  const steps: [string,string,string][] = [
    ['1','⚙️  ADMIN CẤU HÌNH HỆ THỐNG','Quản trị viên thiết lập danh sách lớp, học sinh, tiêu chí vi phạm/thành tích, điểm quy đổi và phân kỳ thời gian (tuần, tháng, học kỳ). Thao tác thực hiện trực tiếp trên giao diện Settings — không cần chỉnh sửa dữ liệu thô.'],
    ['2','📝  GIÁO VIÊN / BAN NỀ NẾP NHẬP LIỆU','Mỗi ngày, cán bộ được phân quyền nhập vi phạm hoặc thành tích vào hệ thống qua form nhập liệu. Có thể nhập từng dòng hoặc import hàng loạt qua file CSV. Ảnh minh chứng được đính kèm trực tiếp.'],
    ['3','🤖  HỆ THỐNG TỰ ĐỘNG TÍNH TOÁN','Mỗi khi có dữ liệu mới, điểm thi đua của từng lớp được tính lại tự động theo công thức: Điểm = 500 × (số tuần trong kỳ) − tổng điểm trừ + tổng điểm cộng. Không cần thao tác thủ công.'],
    ['4','📊  XEM XẾP HẠNG & TRA CỨU','Toàn bộ giáo viên, học sinh, phụ huynh có thể tra cứu bảng xếp hạng theo tuần/tháng/học kỳ, xem lịch sử vi phạm của từng lớp — không cần đăng nhập.'],
    ['5','📋  XUẤT BÁO CÁO CUỐI KỲ','Admin một cái bấm để xuất file DOCX (báo cáo chi tiết từng lớp) hoặc Excel (bảng tổng hợp điểm). File đúng chuẩn, sẵn sàng nộp cho Ban Giám Hiệu hoặc lưu trữ lịch sử.'],
  ];
  return `
<div class="page pb">
  ${pageHeader('Quy trình hoạt động')}
  <div class="content">
    ${sectionHdr('🔄','III. QUY TRÌNH HOẠT ĐỘNG')}
    <p class="body-txt" style="margin-bottom:5mm;">Hệ thống vận hành theo vòng lặp liên tục — từ cấu hình ban đầu đến nhập liệu hàng ngày, tính toán tự động và báo cáo cuối kỳ.</p>
    ${steps.map(([n,title,desc],i)=>`
    <div class="step">
      <div class="step-num">${n}</div>
      <div class="step-body">
        <h4 style="color:#1E459F;font-weight:800;font-size:10px;margin-bottom:2px;">${title}</h4>
        <p style="color:#444;font-size:9px;line-height:1.6;">${desc}</p>
      </div>
    </div>
    ${i < steps.length-1 ? '<div class="step-arrow">↓</div>' : ''}`).join('')}
  </div>
  ${pageFooter(4,9)}
</div>`; }

// ── Trang 5: Phân quyền ──────────────────────────────────────────────────────
function p5(): string { return `
<div class="page pb">
  ${pageHeader('Phân cấp & Phân quyền')}
  <div class="content">
    ${sectionHdr('🔐','IV. PHÂN CẤP & PHÂN QUYỀN')}
    <table>
      <thead><tr><th style="width:30mm">Vai trò</th><th style="width:36mm">Đối tượng</th><th>Quyền hạn chính</th></tr></thead>
      <tbody>
        <tr><td class="td-role">👁️ Khách<br><small style="color:#888;font-weight:400">(Không đăng nhập)</small></td><td>Học sinh, phụ huynh, khách</td><td>Xem bảng xếp hạng · Tra cứu lớp · Xem lịch sử vi phạm tổng quan</td></tr>
        <tr><td class="td-role">✏️ Cán bộ<br><small style="color:#888;font-weight:400">Nhập liệu</small></td><td>Giáo viên, cán bộ Đoàn</td><td>Tất cả quyền Khách · Nhập vi phạm/thành tích · Xem toàn bộ danh sách vi phạm</td></tr>
        <tr><td class="td-role">🛡️ Admin</td><td>GVCN, Phó Hiệu Trưởng</td><td>Tất cả quyền Cán bộ · Sửa/Xóa vi phạm · Bulk Edit · Xuất báo cáo DOCX/Excel · Xem audit log xóa</td></tr>
        <tr><td class="td-role">👑 Quản trị<br><small style="color:#888;font-weight:400">Hệ thống</small></td><td>Chuyên viên CNTT, Hiệu trưởng</td><td>Tất cả quyền Admin · Cấu hình tiêu chí, điểm, lớp, học sinh · Quản lý tài khoản · Cấu hình kỳ đánh giá</td></tr>
      </tbody>
    </table>

    ${sectionHdr('ℹ️','LƯU Ý PHÂN QUYỀN')}
    ${[
      'Mỗi tài khoản được gán 1 vai trò cố định, quản trị viên có thể điều chỉnh bất kỳ lúc nào.',
      'Tài khoản Khách không cần đăng nhập — đây là thiết kế có chủ ý để minh bạch thông tin với toàn trường.',
      'Mật khẩu được kiểm tra hoàn toàn trên server — trình duyệt không bao giờ tiếp xúc với mật khẩu gốc.',
      'Nhật ký xóa (Audit Log) ghi lại đầy đủ ai xóa gì, lúc nào — hỗ trợ kiểm tra nội bộ.',
    ].map(t=>`<div class="bullet">${t}</div>`).join('')}

    <div class="card" style="margin-top:6mm;">
      <div style="color:#CF2A2A;font-weight:700;font-size:10px;margin-bottom:3px;">🔒 Bảo mật dữ liệu</div>
      <p style="font-size:9px;color:#444;line-height:1.6;">Toàn bộ mật khẩu người dùng được kiểm tra server-side qua Google Apps Script. Dữ liệu học sinh chỉ hiển thị theo mức phân quyền tương ứng. Lịch sử thao tác được ghi nhận trong Audit Log riêng biệt.</p>
    </div>
  </div>
  ${pageFooter(5,9)}
</div>`; }

// ── Trang 6: So sánh ─────────────────────────────────────────────────────────
function p6(): string { return `
<div class="page pb">
  ${pageHeader('Ưu việt so với phương pháp cũ')}
  <div class="content">
    ${sectionHdr('📊','V. ƯU VIỆT SO VỚI PHƯƠNG PHÁP CŨ')}
    <table>
      <thead><tr><th style="width:42mm">Tiêu chí</th><th style="width:36mm">📓 Sổ giấy / Ghi tay</th><th style="width:38mm">📊 Excel thủ công</th><th>🖥️ Nền Nếp CNT</th></tr></thead>
      <tbody>
        <tr><td style="font-weight:700">Tốc độ nhập liệu</td><td class="td-red">Chậm, dễ nhầm</td><td class="td-red">Trung bình</td><td class="td-green">⚡ Nhanh, gợi ý tự động</td></tr>
        <tr><td style="font-weight:700">Tính điểm xếp hạng</td><td class="td-red">Thủ công, sai số cao</td><td class="td-red">Phải tự viết công thức</td><td class="td-green">✅ Tự động, chính xác 100%</td></tr>
        <tr><td style="font-weight:700">Tra cứu theo thời gian</td><td class="td-red">Không có</td><td class="td-red">Khó, phải sort tay</td><td class="td-green">✅ Lọc tuần/tháng/HK tức thì</td></tr>
        <tr><td style="font-weight:700">Xuất báo cáo</td><td class="td-red">Gõ tay (2–3 giờ)</td><td class="td-red">Copy-paste (30–60 phút)</td><td class="td-green">✅ 1 cái bấm, dưới 5 giây</td></tr>
        <tr><td style="font-weight:700">Truy cập từ xa</td><td class="td-red">Không có</td><td class="td-red">Gửi file qua Zalo/Email</td><td class="td-green">✅ Bất kỳ thiết bị, lúc nào</td></tr>
        <tr><td style="font-weight:700">Phân quyền truy cập</td><td class="td-red">Không có</td><td class="td-red">Không có</td><td class="td-green">✅ 4 mức, cấu hình linh hoạt</td></tr>
        <tr><td style="font-weight:700">Lưu trữ lịch sử</td><td class="td-red">Thất lạc theo năm</td><td class="td-red">Tuỳ người quản lý</td><td class="td-green">✅ Tập trung, tìm kiếm được</td></tr>
        <tr><td style="font-weight:700">Chi phí hạ tầng</td><td style="color:#888">0đ (tốn thời gian)</td><td style="color:#888">0đ (tốn thời gian)</td><td class="td-green">✅ Miễn phí nền tảng</td></tr>
        <tr><td style="font-weight:700">Nhân rộng trường khác</td><td class="td-red">Không thể</td><td class="td-red">Khó</td><td class="td-green">✅ Triển khai trong 1 tuần</td></tr>
      </tbody>
    </table>

    <div class="highlight" style="margin-top:6mm;">
      <h3 style="color:#CF2A2A;">⏱️ Tiết kiệm thực tế</h3>
      <p>So với sổ giấy, hệ thống giúp tiết kiệm <strong style="color:#1E459F;">trung bình 8–12 giờ mỗi tháng</strong> cho công tác tổng hợp và báo cáo nề nếp của Ban Đoàn và giáo viên chủ nhiệm.</p>
    </div>
  </div>
  ${pageFooter(6,9)}
</div>`; }

// ── Trang 7: Chi phí ─────────────────────────────────────────────────────────
function p7(): string { return `
<div class="page pb">
  ${pageHeader('Chi phí đầu tư nền tảng')}
  <div class="content">
    ${sectionHdr('💰','VI. CHI PHÍ ĐẦU TƯ NỀN TẢNG')}
    <div style="background:linear-gradient(135deg,#e8f5e9,#f1f8e9);border:2px solid #4caf50;border-radius:8px;padding:6mm;text-align:center;margin:3mm 0 5mm;">
      <div style="font-size:20px;font-weight:900;color:#2e7d32;">✅  CHI PHÍ NỀN TẢNG: HOÀN TOÀN MIỄN PHÍ</div>
      <div style="font-size:9px;color:#555;margin-top:2mm;">Toàn bộ hạ tầng vận hành dựa trên Google Workspace for Education (cấp miễn phí cho trường học)</div>
    </div>
    <table>
      <thead><tr><th>Thành phần</th><th>Mô tả</th><th style="width:25mm;text-align:center">Chi phí</th></tr></thead>
      <tbody>
        <tr><td style="font-weight:700">Google Sheets</td><td>Cơ sở dữ liệu lưu trữ toàn bộ dữ liệu nền nếp</td><td class="td-green" style="text-align:center">Miễn phí</td></tr>
        <tr><td style="font-weight:700">Google Apps Script</td><td>Backend xử lý logic nghiệp vụ, phân quyền, API</td><td class="td-green" style="text-align:center">Miễn phí</td></tr>
        <tr><td style="font-weight:700">Netlify (Web Hosting)</td><td>Lưu trữ và phân phối giao diện web toàn cầu</td><td class="td-green" style="text-align:center">Miễn phí</td></tr>
        <tr><td style="font-weight:700">Google Drive</td><td>Lưu trữ ảnh minh chứng vi phạm</td><td class="td-green" style="text-align:center">Miễn phí</td></tr>
      </tbody>
    </table>

    ${sectionHdr('📦','CÁC GÓI DỊCH VỤ TRIỂN KHAI')}
    <table>
      <thead><tr><th style="width:35mm">Gói</th><th>Bao gồm</th><th style="width:28mm">Thời gian</th><th style="width:35mm">Phù hợp với</th></tr></thead>
      <tbody>
        <tr>
          <td style="font-weight:700;color:#1E459F">🚀 Triển khai cơ bản</td>
          <td>Cài đặt + đào tạo 1 buổi + hỗ trợ 30 ngày</td>
          <td style="text-align:center;color:#CF2A2A;font-weight:700">3–5 ngày</td>
          <td>Trường đã có Google Workspace</td>
        </tr>
        <tr>
          <td style="font-weight:700;color:#CF2A2A">⭐ Triển khai nâng cao</td>
          <td>Cơ bản + tùy chỉnh tiêu chí, mẫu báo cáo + hỗ trợ 3 tháng</td>
          <td style="text-align:center;color:#CF2A2A;font-weight:700">1 tuần</td>
          <td>Trường cần tùy biến báo cáo</td>
        </tr>
        <tr>
          <td style="font-weight:700;color:#FABD32;background:#1E459F22;">🏆 Bảo trì dài hạn</td>
          <td>Nâng cao + bảo trì định kỳ, thêm tính năng theo yêu cầu, hỗ trợ không giới hạn</td>
          <td style="text-align:center;color:#CF2A2A;font-weight:700">Theo HĐ</td>
          <td>Đồng hành dài hạn</td>
        </tr>
      </tbody>
    </table>

    <div class="card">
      <div style="color:#1E459F;font-weight:700;font-size:9.5px;margin-bottom:3px;">💡 Lưu ý về đầu tư</div>
      <p style="font-size:9px;color:#444;line-height:1.6;">Chi phí duy nhất là thời gian cài đặt ban đầu và đào tạo người dùng. Không có phí thuê server, phí bản quyền phần mềm, hay phí duy trì hàng tháng. Trường chỉ cần có tài khoản Google (Gmail hoặc Google Workspace for Education).</p>
    </div>
  </div>
  ${pageFooter(7,9)}
</div>`; }

// ── Trang 8: Nhân rộng ───────────────────────────────────────────────────────
function p8(): string { return `
<div class="page pb">
  ${pageHeader('Mô hình nhân rộng')}
  <div class="content">
    ${sectionHdr('🌐','VII. MÔ HÌNH NHÂN RỘNG')}
    <p class="body-txt">Hệ thống được thiết kế từ đầu với khả năng <strong>nhân rộng ra nhiều trường học</strong>. Mỗi trường sẽ có một phiên bản độc lập với dữ liệu riêng biệt. Quá trình triển khai đơn giản, không yêu cầu phần cứng đặc biệt.</p>

    ${sectionHdr('📋','6 BƯỚC TRIỂN KHAI')}
    <table>
      <thead><tr><th style="width:16mm;text-align:center">Bước</th><th style="width:24mm;text-align:center">Thời gian</th><th>Nội dung</th></tr></thead>
      <tbody>
        ${[
          ['1','1–2 ngày','Khảo sát nhu cầu trường: cơ cấu lớp, tiêu chí nề nếp, mẫu báo cáo hiện tại, tài khoản Google'],
          ['2','1–2 ngày','Cài đặt hệ thống riêng: backend, cơ sở dữ liệu Sheets, hosting web với domain/subdomain tùy chọn'],
          ['3','1 ngày','Nhập dữ liệu nền: danh sách lớp, học sinh, tiêu chí vi phạm/thành tích, phân kỳ thời gian'],
          ['4','1 buổi','Đào tạo sử dụng cho cán bộ quản lý và giáo viên nhập liệu (có tài liệu hướng dẫn kèm theo)'],
          ['5','7–30 ngày','Giai đoạn vận hành thử — hỗ trợ trực tiếp qua điện thoại/Zalo, điều chỉnh theo phản hồi thực tế'],
          ['6','Ổn định','Bàn giao chính thức, cam kết hỗ trợ kỹ thuật theo gói đã chọn'],
        ].map(([n,t,c])=>`<tr><td style="text-align:center;font-weight:900;color:white;background:linear-gradient(135deg,#1E459F,#CF2A2A);">${n}</td><td style="text-align:center;color:#CF2A2A;font-weight:700;">${t}</td><td>${c}</td></tr>`).join('')}
      </tbody>
    </table>

    ${sectionHdr('⚙️','YÊU CẦU TỐI THIỂU ĐỂ TRIỂN KHAI')}
    ${[
      'Tài khoản Google (Gmail hoặc Google Workspace for Education của trường)',
      'Kết nối Internet ổn định (dùng để đồng bộ dữ liệu khi nhập liệu)',
      'Thiết bị nhập liệu: điện thoại smartphone hoặc máy tính (không cần cài đặt gì)',
      'Ít nhất 1 người phụ trách kỹ thuật tại trường để phối hợp cài đặt ban đầu',
    ].map(t=>`<div class="bullet">${t}</div>`).join('')}

    <div class="highlight">
      <h3>🏫 Mục tiêu nhân rộng</h3>
      <p>Từ mô hình thành công tại THPT Chuyên Nguyễn Trãi, hệ thống hướng tới<br>triển khai tại <strong style="color:#CF2A2A;">tất cả các trường THPT</strong> trên địa bàn TP. Hải Phòng<br>và các tỉnh lân cận.</p>
    </div>
  </div>
  ${pageFooter(8,9)}
</div>`; }

// ── Trang 9: Liên hệ ─────────────────────────────────────────────────────────
function p9(total: number): string { return `
<div class="last-page pb">
  <div style="text-align:center;margin-bottom:8mm;">
    <div style="display:inline-block;background:rgba(250,189,50,0.15);border:2px solid #FABD32;border-radius:50%;width:20mm;height:20mm;line-height:20mm;font-size:26px;">📬</div>
    <h2 style="font-size:22px;font-weight:900;color:#FABD32;margin:4mm 0 2mm;letter-spacing:2px;">THÔNG TIN LIÊN HỆ</h2>
    <p style="color:rgba(255,255,255,0.7);font-size:10px;">Để được tư vấn, báo giá hoặc triển khai thử nghiệm — liên hệ trực tiếp với tác giả</p>
  </div>

  <div class="contact-box">
    ${[
      ['👤 Tác giả','Lương Hải Anh'],
      ['🏫 Đơn vị','THPT Chuyên Nguyễn Trãi – TP. Hải Phòng'],
      ['📧 Email','luonghaianh1208@gmail.com'],
      ['📞 SĐT / Zalo','0328 186 264'],
      ['🌐 Demo live','https://nennepcnt.netlify.app'],
    ].map(([l,v])=>`<div class="contact-row"><span class="contact-lbl">${l}</span><span class="contact-val">${v}</span></div>`).join('')}
  </div>

  <div style="margin:4mm 0 2mm;">
    <div style="color:#FABD32;font-weight:700;font-size:11px;text-align:center;margin-bottom:3mm;text-transform:uppercase;letter-spacing:2px;">Cam kết của tác giả</div>
    <div class="commit-box">
      <div class="commit-item">Sản phẩm đã vận hành thực tế tại THPT Chuyên Nguyễn Trãi từ đầu năm 2026</div>
      <div class="commit-item">Hỗ trợ kỹ thuật nhanh chóng, nhiệt tình trong suốt quá trình sử dụng</div>
      <div class="commit-item">Liên tục cập nhật, cải tiến theo phản hồi thực tế của đơn vị sử dụng</div>
      <div class="commit-item">Bảo mật thông tin học sinh theo quy định của Bộ Giáo dục và Đào tạo</div>
    </div>
  </div>

  <div style="border-top:1px solid rgba(250,189,50,0.3);padding-top:5mm;margin-top:auto;">
    <div style="text-align:center;">
      <div style="font-size:11px;font-weight:900;color:#FABD32;margin-bottom:3mm;">© 2026 Lương Hải Anh. Bảo lưu mọi quyền.</div>
      <div style="font-size:8px;color:rgba(255,255,255,0.45);line-height:1.7;">Tài liệu này được bảo mật. Nghiêm cấm sao chép, phát tán khi chưa có sự đồng ý bằng văn bản của tác giả.<br>Thương hiệu "Nền Nếp CNT" và toàn bộ giải pháp trong tài liệu này thuộc quyền sở hữu của tác giả.</div>
    </div>
  </div>
</div>`; }
