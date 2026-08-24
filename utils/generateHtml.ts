// utils/generateHtml.ts
// Tải file HTML đẹp (standalone) + nút chụp ảnh hàng loạt ZIP

export function generateProductHtml(): void {
  const html = buildFullHtml();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'NenNep_TaiLieuGioiThieu_2026.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildFullHtml(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Hệ Thống Quản Lý Nền Nếp – Tài Liệu Giới Thiệu Sản Phẩm 2026</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{background:linear-gradient(135deg,#0d1b3e 0%,#1a1025 50%,#0d1b3e 100%);min-height:100vh;font-family:'Be Vietnam Pro','Segoe UI',Arial,sans-serif;padding:80px 20px 40px;}
/* ── Toolbar ── */
#toolbar{position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#1E459F,#CF2A2A);padding:10px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 20px rgba(0,0,0,0.5);}
#toolbar .brand{color:#FABD32;font-weight:900;font-size:14px;letter-spacing:1px;}
#toolbar .controls{display:flex;align-items:center;gap:12px;}
#captureBtn{background:#FABD32;color:#1E459F;border:none;padding:8px 20px;border-radius:20px;font-weight:900;font-size:13px;cursor:pointer;transition:all .2s;font-family:inherit;}
#captureBtn:hover{background:#fff;transform:scale(1.03);}
#captureBtn:disabled{opacity:.6;cursor:not-allowed;transform:none;}
#captureStatus{color:rgba(255,255,255,.85);font-size:12px;min-width:200px;}
#progressBar{height:4px;background:rgba(255,255,255,.2);border-radius:2px;width:160px;overflow:hidden;}
#progressFill{height:100%;background:#FABD32;width:0%;transition:width .3s;border-radius:2px;}
/* ── Pages ── */
.pages-wrap{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:32px;}
.page{width:100%;background:#fff;border-radius:12px;box-shadow:0 8px 48px rgba(0,0,0,.5);overflow:hidden;position:relative;}
/* ── Cover ── */
.cover{background:linear-gradient(150deg,#1E459F 0%,#2156c8 35%,#a52222 65%,#CF2A2A 100%);padding:40px 48px 36px;min-height:760px;display:flex;flex-direction:column;}
.cover-stripe{height:4px;background:linear-gradient(90deg,#FABD32,rgba(255,255,255,.1),#FABD32);margin-bottom:32px;border-radius:2px;}
.cover-logos{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;}
.logo-box{text-align:center;}
.logo-box img{height:68px;width:68px;object-fit:contain;background:white;border-radius:50%;padding:4px;box-shadow:0 4px 20px rgba(0,0,0,.3);}
.logo-box p{color:#FABD32;font-size:10px;font-weight:700;letter-spacing:2px;margin-top:8px;text-transform:uppercase;}
.cover-center{text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 0;}
.cover-center h1{font-size:42px;font-weight:900;color:#FABD32;letter-spacing:3px;line-height:1.2;text-shadow:0 3px 12px rgba(0,0,0,.4);}
.cover-center .sub{margin-top:12px;font-size:15px;color:rgba(255,255,255,.9);font-weight:600;letter-spacing:1px;}
.cover-divider{width:60%;height:2px;background:linear-gradient(90deg,transparent,#FABD32,transparent);margin:20px auto;}
.cover-tagline{color:rgba(255,255,255,.8);font-style:italic;font-size:13px;text-align:center;line-height:1.8;max-width:520px;margin:0 auto 28px;}
.cover-badges{display:flex;justify-content:center;gap:20px;margin:20px 0;}
.badge{background:rgba(255,255,255,.1);border:1px solid rgba(250,189,50,.5);border-radius:10px;padding:14px 20px;text-align:center;min-width:130px;}
.badge .bico{font-size:22px;display:block;margin-bottom:6px;}
.badge .blbl{color:#FABD32;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;}
.badge .bval{color:rgba(255,255,255,.9);font-size:11px;font-weight:600;margin-top:4px;}
.toc-box{background:#E1DCCA;border-radius:10px;padding:20px 24px;margin:20px 0;border-left:5px solid #FABD32;}
.toc-title{font-size:13px;font-weight:900;color:#1E459F;text-align:center;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #FABD32;}
.toc-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed rgba(30,69,159,.2);}
.toc-row:last-child{border-bottom:none;}
.toc-num{color:#CF2A2A;font-weight:700;min-width:30px;font-size:13px;}
.toc-lbl{color:#1E459F;font-weight:600;flex:1;font-size:12px;}
.toc-pg{color:#CF2A2A;font-size:11px;font-weight:700;}
.cover-footer{margin-top:auto;text-align:center;}
.cover-footer .copy{color:#FABD32;font-size:12px;font-weight:700;}
.cover-footer p{color:rgba(255,255,255,.5);font-size:10px;margin-bottom:6px;}
/* ── Interior pages ── */
.page-header{background:linear-gradient(135deg,#1E459F,#CF2A2A);padding:12px 28px;display:flex;justify-content:space-between;align-items:center;}
.ph-name{color:white;font-size:11px;font-weight:700;letter-spacing:.5px;}
.ph-right{color:rgba(255,255,255,.7);font-size:11px;}
.content{padding:22px 28px 18px;}
.section-hdr{background:linear-gradient(90deg,#CF2A2A,#1E459F);color:white;padding:9px 14px;border-radius:6px;font-size:14px;font-weight:900;margin:18px 0 12px;display:flex;align-items:center;gap:8px;}
.sub-hdr{color:#1E459F;font-weight:700;font-size:13px;border-left:4px solid #FABD32;padding-left:10px;margin:16px 0 8px;}
.body-txt{color:#333;font-size:12px;line-height:1.8;margin-bottom:10px;}
.bullet{color:#333;font-size:12px;line-height:1.7;padding-left:18px;position:relative;margin-bottom:6px;}
.bullet::before{content:'●';color:#FABD32;position:absolute;left:0;}
.card{background:#E1DCCA;border-left:5px solid #CF2A2A;padding:12px 16px;border-radius:6px;margin:10px 0;}
.highlight{background:linear-gradient(135deg,#1E459F11,#CF2A2A0a);border:1.5px solid #FABD32;border-radius:10px;padding:18px;text-align:center;margin:14px 0;}
.highlight h3{font-size:17px;font-weight:900;color:#1E459F;margin-bottom:8px;}
.highlight p{font-size:12px;color:#555;line-height:1.7;}
.step{display:flex;gap:12px;margin-bottom:16px;align-items:flex-start;}
.step-num{min-width:30px;height:30px;background:linear-gradient(135deg,#1E459F,#CF2A2A);color:#FABD32;font-weight:900;font-size:15px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.step-body h4{color:#1E459F;font-weight:800;font-size:13px;margin-bottom:4px;}
.step-body p{color:#444;font-size:12px;line-height:1.6;}
.step-arrow{padding-left:15px;color:#FABD32;font-size:18px;margin:-8px 0;}
table{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0;}
th{background:linear-gradient(135deg,#1E459F,#CF2A2A);color:white;padding:10px 12px;font-weight:700;text-align:left;}
td{padding:9px 12px;vertical-align:top;border-bottom:1px solid #E1DCCA;color:#333;}
tr:nth-child(even) td{background:#f8f5ef;}
.td-role{font-weight:700;color:#1E459F;}
.td-grn{color:#1a7a1a;font-weight:700;}
.td-red{color:#CF2A2A;}
.page-footer{border-top:2px solid #E1DCCA;padding:8px 28px;display:flex;justify-content:space-between;align-items:center;}
.pf-l{font-size:10px;color:#888;}
.pf-r{font-size:11px;color:#CF2A2A;font-weight:700;}
/* ── Contact page ── */
.last-page{background:linear-gradient(150deg,#1E459F 0%,#152f6a 60%,#1E459F 100%);padding:40px 48px;min-height:600px;display:flex;flex-direction:column;}
.contact-box{background:#E1DCCA;border-radius:12px;padding:24px;margin:16px 0 14px;}
.contact-row{display:flex;gap:20px;padding:8px 0;border-bottom:1px dashed rgba(30,69,159,.2);}
.contact-row:last-child{border-bottom:none;}
.c-lbl{color:#CF2A2A;font-weight:700;font-size:13px;min-width:120px;}
.c-val{color:#1E459F;font-weight:600;font-size:13px;}
.commit-box{background:rgba(255,255,255,.08);border:1px solid rgba(250,189,50,.4);border-radius:10px;padding:18px;margin:12px 0;}
.commit-item{color:rgba(255,255,255,.85);font-size:12px;line-height:1.9;padding-left:24px;position:relative;}
.commit-item::before{content:'✅';position:absolute;left:0;}
</style>
</head>
<body>
<div id="toolbar">
  <span class="brand">🎯 Hệ thống Quản lý Nền nếp – Tài liệu giới thiệu sản phẩm 2026</span>
  <div class="controls">
    <div id="progressBar"><div id="progressFill"></div></div>
    <span id="captureStatus">Nhấn nút để tải ảnh hàng loạt</span>
    <button id="captureBtn" onclick="captureAll()">📸 Tải ảnh hàng loạt (ZIP)</button>
  </div>
</div>

<div class="pages-wrap">

<!-- TRANG BÌA -->
<div class="page" id="page-1">
<div class="cover">
  <div class="cover-stripe"></div>
  <div class="cover-logos">
    <div class="logo-box">
      <div style="height:68px;width:68px;border-radius:50%;background:linear-gradient(135deg,#CF2A2A,#7f1d1d);color:#FABD32;font-size:30px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.3)">N</div>
      <p>Nền Nếp<br>2Anh AI Education</p>
    </div>
    <div class="cover-center" style="text-align:center">
      <h1>HỆ THỐNG<br>QUẢN LÝ NỀN NẾP</h1>
      <div class="sub">GIẢI PHÁP DÀNH CHO CÁC TRƯỜNG THPT</div>
      <div class="cover-divider"></div>
      <div class="cover-tagline">"Số hoá toàn bộ quy trình theo dõi, đánh giá và xếp hạng<br>nền nếp học sinh — chính xác, minh bạch, tức thì."</div>
      <div class="cover-badges">
        <div class="badge"><span class="bico">📅</span><div class="blbl">Phiên bản</div><div class="bval">4.0 · Tháng 8/2026</div></div>
        <div class="badge"><span class="bico">🏫</span><div class="blbl">Đối tượng</div><div class="bval">Trường THPT</div></div>
        <div class="badge"><span class="bico">📱</span><div class="blbl">Truy cập</div><div class="bval">Web / Mobile</div></div>
      </div>
    </div>
    <div class="logo-box">
      <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png" alt="Đoàn"/>
      <p>Đoàn TNCS<br>Hồ Chí Minh</p>
    </div>
  </div>
  <div class="toc-box">
    <div class="toc-title">Nội dung tài liệu</div>
    ${[['I','Tổng quan sản phẩm','2'],['II','Tính năng nổi bật','3'],['III','Quy trình hoạt động','4'],['IV','Phân cấp & Phân quyền','5'],['V','Ưu việt so phương pháp cũ','6'],['VI','Chi phí đầu tư nền tảng','7'],['VII','Mô hình nhân rộng','8'],['VIII','Liên hệ & Bản quyền','9']].map(([n,l,p])=>`<div class="toc-row"><span class="toc-num">${n}.</span><span class="toc-lbl">${l}</span><span class="toc-pg">Trang ${p}</span></div>`).join('')}
  </div>
  <div class="cover-footer">
    <p>Tài liệu bảo mật – Vui lòng không phát tán khi chưa được phép</p>
    <div class="copy">© 2026 Lương Hải Anh · 2Anh AI Education</div>
  </div>
</div>
</div>

<!-- TRANG 2: TỔNG QUAN -->
<div class="page" id="page-2">
<div class="page-header"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP – TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">Tổng quan sản phẩm</span></div>
<div class="content">
  <div class="section-hdr"><span>🌟</span> I. TỔNG QUAN SẢN PHẨM</div>
  <p class="body-txt">Hệ thống Quản lý Nền nếp là nền tảng <strong>số hoá toàn bộ quy trình theo dõi, đánh giá và xếp hạng nền nếp học sinh</strong> dành cho các trường THPT. Sản phẩm do <strong>Lương Hải Anh – 2Anh AI Education</strong> phát triển, đã vận hành thực tế qua nhiều học kỳ tại THPT Chuyên Nguyễn Trãi với hơn 1.100 học sinh và 2.500 lượt ghi nhận. Mỗi trường nhận một bản triển khai riêng, mang thương hiệu của chính trường mình, dữ liệu tách biệt hoàn toàn.</p>
  <div class="sub-hdr">❓ Bài toán đặt ra</div>
  ${['Ghi chép vi phạm thủ công qua sổ giấy dễ thất lạc, sai sót, khó tổng hợp','Tính điểm thi đua cuối tuần/tháng/học kỳ tốn nhiều giờ tra cứu và tính toán bằng tay','Không có kênh thông tin minh bạch để học sinh, phụ huynh tra cứu tình hình nề nếp','Báo cáo DOCX/Excel cho cấp trên phải làm thủ công sau mỗi kỳ đánh giá','Không lưu trữ lịch sử dữ liệu qua các năm học để phân tích xu hướng'].map(t=>`<div class="bullet">${t}</div>`).join('')}
  <div class="sub-hdr">✅ Giải pháp cung cấp</div>
  ${['Nhập liệu vi phạm/thành tích tức thì qua trình duyệt trên điện thoại hoặc máy tính — không cần cài đặt','Hệ thống tự động tính điểm theo công thức chuẩn, cập nhật xếp hạng lớp theo tuần/tháng/học kỳ','Dữ liệu tuần đang diễn ra đồng bộ trực tiếp: một người nhập, mọi máy đang mở thấy ngay','Giao diện tra cứu mở cho học sinh và phụ huynh, không cần đăng nhập','Xuất báo cáo DOCX/Excel chỉ một cái bấm, đúng định dạng nhà trường yêu cầu','Dữ liệu và ảnh minh chứng lưu trên hạ tầng Google Firebase — bền vững, sao lưu và xuất ra bất kỳ lúc nào'].map(t=>`<div class="bullet">${t}</div>`).join('')}
  <div class="highlight"><h3>🎯 Sứ mệnh</h3><p>Biến công việc quản lý nền nếp từ gánh nặng thủ công trở thành quy trình tự động,<br>chính xác và hoàn toàn minh bạch với toàn trường.</p></div>
</div>
<div class="page-footer"><span class="pf-l">© 2026 Lương Hải Anh – 2Anh AI Education</span><span class="pf-r">Trang 2 / 9</span></div>
</div>

<!-- TRANG 3: TÍNH NĂNG -->
<div class="page" id="page-3">
<div class="page-header"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP – TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">Tính năng nổi bật</span></div>
<div class="content">
  <div class="section-hdr"><span>🚀</span> II. TÍNH NĂNG NỔI BẬT</div>
  ${[['📝','Nhập vi phạm nhanh trên điện thoại','Form gợi ý theo lớp và tiêu chí; hỗ trợ cả cá nhân lẫn tập thể; đính kèm ảnh minh chứng chụp trực tiếp.'],['🏅','Nhập khen thưởng theo hoạt động (mới)','Khai báo một hoạt động rồi ghi giải thưởng cho nhiều lớp trong cùng một bảng, lưu một lần. Điểm tự lấy từ tiêu chí có sẵn, vẫn sửa được cho hoạt động có mức thưởng riêng.'],['⚡','Đồng bộ trực tiếp theo thời gian thực (mới)','Vi phạm và khen thưởng của tuần đang diễn ra tự hiện trên mọi máy đang mở trong khoảng một giây — không ai phải bấm làm mới.'],['🔍','Tra cứu & lọc nâng cao','Lọc theo lớp, tiêu chí, loại, khoảng thời gian; phát hiện bản ghi trùng lặp; cảnh báo bản ghi nằm ngoài mốc thời gian đã cấu hình.'],['🏆','Xếp hạng tự động theo kỳ','Bảng xếp hạng cập nhật theo tuần/tháng/học kỳ, phân theo khối, có quy tắc trọng số học kỳ II.'],['📄','Xuất báo cáo Word & Excel','Tạo file báo cáo tuần đúng mẫu nhà trường và bảng Excel tự tính điểm tổng, sẵn sàng nộp Ban Giám hiệu.'],['👥','Quản lý tài khoản chuẩn hoá (mới)','Tạo tài khoản lẻ hoặc hàng loạt từ Excel, hệ thống tự gửi thư để người dùng tự đặt mật khẩu. Khoá tài khoản thay vì xoá để giữ nguyên dấu vết người nhập liệu.'],['🔐','Bảo mật theo vai trò ở tầng dữ liệu (mới)','Phân quyền thực thi ngay trong cơ sở dữ liệu chứ không chỉ ẩn nút: cờ đỏ ghi được vi phạm, chỉ quản trị viên ghi được điểm thưởng và sửa danh mục.'],['🖼️','Ảnh minh chứng nén tự động (mới)','Ảnh chụp được nén còn khoảng một phần năm dung lượng mà vẫn đọc rõ chi tiết, hiển thị ngay trong ứng dụng thay vì phải mở tab khác.'],['🎨','Mang thương hiệu riêng của trường (mới)','Tên trường, tên rút gọn, khẩu hiệu và logo do nhà trường tự đặt trong phần Thiết lập, hiện trên mọi màn hình.'],['✏️','Sửa hàng loạt','Chọn nhiều bản ghi rồi đổi ngày, ghi chú hoặc tiêu chí trong một thao tác, có hoàn tác.'],['⚠️','Cảnh báo trước khi làm hỏng dữ liệu (mới)','Nhắc khi ghi nhận vào ngày ngoài năm học, và cho biết một tiêu chí đang gắn với bao nhiêu bản ghi trước khi cho xoá.'],['📱','Chạy tốt trên điện thoại','Giao diện responsive cho iOS và Android, không cần cài app; dữ liệu có bộ nhớ đệm nên mạng trường chập chờn vẫn xem được.'],['📋','Nhật ký thao tác','Ghi lại ai làm gì, lúc nào — phục vụ đối chiếu khi có khiếu nại về điểm thi đua.']].map(([ico,title,desc])=>`<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start"><div style="min-width:34px;height:34px;background:linear-gradient(135deg,#1E459F,#CF2A2A);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${ico}</div><div><div style="color:#1E459F;font-weight:700;font-size:13px;margin-bottom:2px">${title}</div><div style="color:#444;font-size:12px;line-height:1.6">${desc}</div></div></div>`).join('')}
</div>
<div class="page-footer"><span class="pf-l">© 2026 Lương Hải Anh – 2Anh AI Education</span><span class="pf-r">Trang 3 / 9</span></div>
</div>

<!-- TRANG 4: QUY TRÌNH -->
<div class="page" id="page-4">
<div class="page-header"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP – TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">Quy trình hoạt động</span></div>
<div class="content">
  <div class="section-hdr"><span>🔄</span> III. QUY TRÌNH HOẠT ĐỘNG</div>
  <p class="body-txt">Hệ thống vận hành theo vòng lặp liên tục — từ cấu hình ban đầu đến nhập liệu hàng ngày, tự động tính toán và báo cáo cuối kỳ.</p>
  ${[['1','⚙️ Admin cấu hình hệ thống','Thiết lập danh sách lớp, học sinh, tiêu chí vi phạm/thành tích, điểm quy đổi và phân kỳ thời gian. Thao tác trực tiếp trên giao diện Settings — không cần chỉnh dữ liệu thô.'],['2','📝 Giáo viên / Ban nề nếp nhập liệu','Mỗi ngày, cán bộ được phân quyền nhập vi phạm hoặc thành tích. Có thể nhập từng dòng hoặc import hàng loạt qua CSV. Ảnh minh chứng đính kèm trực tiếp.'],['3','🤖 Hệ thống tự động tính toán','Điểm thi đua mỗi lớp tính lại tự động: Điểm = 500 × (số tuần trong kỳ) − tổng điểm trừ + tổng điểm cộng. Không cần thao tác thủ công.'],['4','📊 Xem xếp hạng & tra cứu','Giáo viên, học sinh, phụ huynh tra cứu bảng xếp hạng và lịch sử vi phạm của từng lớp — không cần đăng nhập.'],['5','📋 Xuất báo cáo cuối kỳ','Admin một cái bấm để xuất DOCX (báo cáo chi tiết) hoặc Excel (bảng tổng hợp điểm). Đúng chuẩn, sẵn sàng nộp Ban Giám Hiệu.']].map(([n,title,desc],i,arr)=>`<div class="step"><div class="step-num">${n}</div><div class="step-body"><h4>${title}</h4><p>${desc}</p></div></div>${i<arr.length-1?'<div class="step-arrow">↓</div>':''}`).join('')}
</div>
<div class="page-footer"><span class="pf-l">© 2026 Lương Hải Anh – 2Anh AI Education</span><span class="pf-r">Trang 4 / 9</span></div>
</div>

<!-- TRANG 5: PHÂN QUYỀN -->
<div class="page" id="page-5">
<div class="page-header"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP – TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">Phân cấp & Phân quyền</span></div>
<div class="content">
  <div class="section-hdr"><span>🔐</span> IV. PHÂN CẤP & PHÂN QUYỀN</div>
  <table><thead><tr><th>Vai trò</th><th>Đối tượng</th><th>Quyền hạn chính</th></tr></thead><tbody>
    <tr><td class="td-role">👁️ Khách</td><td>Học sinh, phụ huynh, khách</td><td>Xem bảng xếp hạng · Tra cứu lớp · Xem lịch sử vi phạm tổng quan</td></tr>
    <tr><td class="td-role">✏️ Cán bộ nhập liệu</td><td>Giáo viên, cán bộ Đoàn</td><td>Tất cả quyền Khách · Nhập vi phạm/thành tích · Xem toàn bộ danh sách</td></tr>
    <tr><td class="td-role">🛡️ Admin</td><td>GVCN, Phó Hiệu Trưởng</td><td>Tất cả quyền Cán bộ · Sửa/Xóa · Bulk Edit · Xuất báo cáo · Audit Log</td></tr>
    <tr><td class="td-role">👑 Quản trị hệ thống</td><td>Chuyên viên CNTT, Hiệu trưởng</td><td>Tất cả quyền Admin · Cấu hình tiêu chí, điểm, lớp · Quản lý tài khoản · Cấu hình kỳ đánh giá</td></tr>
  </tbody></table>
  <div class="sub-hdr">ℹ️ Lưu ý phân quyền</div>
  ${['Mỗi tài khoản được gán 1 vai trò cố định, quản trị viên có thể điều chỉnh bất kỳ lúc nào.','Tài khoản Khách không cần đăng nhập — thiết kế có chủ ý để minh bạch thông tin toàn trường.','Mật khẩu được kiểm tra hoàn toàn server-side — trình duyệt không tiếp xúc mật khẩu gốc.','Nhật ký xóa (Audit Log) ghi lại đầy đủ ai xóa gì, lúc nào — hỗ trợ kiểm tra nội bộ.'].map(t=>`<div class="bullet">${t}</div>`).join('')}
  <div class="card" style="margin-top:20px"><div style="color:#CF2A2A;font-weight:700;font-size:13px;margin-bottom:6px">🔒 Bảo mật dữ liệu</div><p style="font-size:12px;color:#444;line-height:1.7">Đăng nhập do Google Firebase Authentication đảm nhiệm — mật khẩu được băm một chiều, hệ thống không lưu và không nhìn thấy mật khẩu của bất kỳ ai. Quyền ghi dữ liệu thực thi ngay trong cơ sở dữ liệu theo vai trò, nên không thể lách bằng cách gọi thẳng API. Mọi thao tác quản trị đều ghi vào Nhật ký thao tác.</p></div>
</div>
<div class="page-footer"><span class="pf-l">© 2026 Lương Hải Anh – 2Anh AI Education</span><span class="pf-r">Trang 5 / 9</span></div>
</div>

<!-- TRANG 6: SO SÁNH -->
<div class="page" id="page-6">
<div class="page-header"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP – TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">Ưu việt so phương pháp cũ</span></div>
<div class="content">
  <div class="section-hdr"><span>📊</span> V. ƯU VIỆT SO VỚI PHƯƠNG PHÁP CŨ</div>
  <table><thead><tr><th>Tiêu chí</th><th>📓 Sổ giấy / Ghi tay</th><th>📊 Excel thủ công</th><th>🖥️ Hệ thống Nền Nếp</th></tr></thead><tbody>
    ${[['Tốc độ nhập liệu','Chậm, dễ nhầm','Trung bình','⚡ Nhanh, gợi ý tự động'],['Tính điểm xếp hạng','Thủ công, sai số cao','Phải tự viết công thức','✅ Tự động, chính xác 100%'],['Tra cứu theo thời gian','Không có','Khó, phải sort tay','✅ Lọc tuần/tháng/HK tức thì'],['Xuất báo cáo','Gõ tay (2–3 giờ)','Copy-paste (30–60 phút)','✅ 1 cái bấm, dưới 5 giây'],['Truy cập từ xa','Không có','Gửi file qua Zalo','✅ Bất kỳ thiết bị, lúc nào'],['Phân quyền truy cập','Không có','Không có','✅ 4 mức, cấu hình linh hoạt'],['Lưu trữ lịch sử','Thất lạc theo năm','Tùy người quản lý','✅ Tập trung, tìm kiếm được'],['Chi phí hạ tầng','0đ (tốn thời gian)','0đ (tốn thời gian)','✅ Miễn phí nền tảng'],['Nhân rộng trường khác','Không thể','Khó','✅ Triển khai trong 1 tuần']].map(([t,a,b,c])=>`<tr><td style="font-weight:700">${t}</td><td class="td-red">${a}</td><td class="td-red">${b}</td><td class="td-grn">${c}</td></tr>`).join('')}
  </tbody></table>
  <div class="highlight" style="margin-top:18px"><h3>⏱️ Tiết kiệm thực tế</h3><p>So với sổ giấy, hệ thống giúp tiết kiệm <strong style="color:#1E459F">trung bình 8–12 giờ mỗi tháng</strong> cho công tác<br>tổng hợp và báo cáo nề nếp của Ban Đoàn và giáo viên chủ nhiệm.</p></div>
</div>
<div class="page-footer"><span class="pf-l">© 2026 Lương Hải Anh – 2Anh AI Education</span><span class="pf-r">Trang 6 / 9</span></div>
</div>

<!-- TRANG 7: CHI PHÍ -->
<div class="page" id="page-7">
<div class="page-header"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP – TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">Chi phí đầu tư nền tảng</span></div>
<div class="content">
  <div class="section-hdr"><span>💰</span> VI. CHI PHÍ ĐẦU TƯ NỀN TẢNG</div>
  <div style="background:linear-gradient(135deg,#e8f5e9,#f1f8e9);border:2px solid #4caf50;border-radius:10px;padding:20px;text-align:center;margin:10px 0 18px">
    <div style="font-size:22px;font-weight:900;color:#2e7d32">✅ CHI PHÍ HẠ TẦNG: GẦN NHƯ BẰNG KHÔNG</div>
    <div style="font-size:12px;color:#555;margin-top:8px">Với quy mô một trường THPT, toàn bộ hạ tầng nằm trong hạn mức miễn phí hằng ngày của Google Firebase — thực tế khoảng 0 đến 50.000đ/tháng</div>
  </div>
  <table><thead><tr><th>Thành phần</th><th>Mô tả</th><th style="width:120px;text-align:center">Chi phí</th></tr></thead><tbody>
    ${[['Cloud Firestore','Cơ sở dữ liệu thời gian thực, mỗi trường một kho riêng biệt'],['Firebase Authentication','Đăng nhập, đặt lại mật khẩu, phân quyền theo vai trò'],['Cloud Functions','Xử lý nghiệp vụ nhạy cảm: cấp và khoá tài khoản'],['Firebase Storage','Lưu ảnh minh chứng, tự nén trước khi tải lên'],['Firebase Hosting','Phân phối giao diện qua mạng máy chủ toàn cầu, có SSL']].map(([n,d])=>`<tr><td style="font-weight:700">${n}</td><td>${d}</td><td class="td-grn" style="text-align:center">Trong hạn mức miễn phí</td></tr>`).join('')}
  </tbody></table>
  <div class="section-hdr" style="margin-top:20px"><span>📦</span> CÁC GÓI DỊCH VỤ TRIỂN KHAI</div>
  <table><thead><tr><th>Gói</th><th>Bao gồm</th><th>Thời gian</th><th>Phù hợp</th></tr></thead><tbody>
    <tr><td style="font-weight:700;color:#1E459F">🚀 Cơ bản</td><td>Cài đặt + đào tạo 1 buổi + hỗ trợ 30 ngày</td><td style="color:#CF2A2A;font-weight:700">3–5 ngày</td><td>Trường triển khai lần đầu</td></tr>
    <tr><td style="font-weight:700;color:#CF2A2A">⭐ Nâng cao</td><td>Cơ bản + tùy chỉnh tiêu chí, mẫu báo cáo + hỗ trợ 3 tháng</td><td style="color:#CF2A2A;font-weight:700">1 tuần</td><td>Trường cần tùy biến báo cáo</td></tr>
    <tr><td style="font-weight:700;color:#1E459F">🏆 Bảo trì dài hạn</td><td>Nâng cao + bảo trì định kỳ, thêm tính năng theo yêu cầu</td><td style="color:#CF2A2A;font-weight:700">Theo HĐ</td><td>Đồng hành dài hạn</td></tr>
  </tbody></table>
  <div class="card"><div style="color:#1E459F;font-weight:700;font-size:13px;margin-bottom:6px">💡 Lưu ý về đầu tư</div><p style="font-size:12px;color:#444;line-height:1.7">Chi phí duy nhất là thời gian cài đặt và đào tạo ban đầu. Không có phí thuê server, phí bản quyền hay phí duy trì hàng tháng. Trường chỉ cần có tài khoản Google.</p></div>
</div>
<div class="page-footer"><span class="pf-l">© 2026 Lương Hải Anh – 2Anh AI Education</span><span class="pf-r">Trang 7 / 9</span></div>
</div>

<!-- TRANG 8: NHÂN RỘNG -->
<div class="page" id="page-8">
<div class="page-header"><span class="ph-name">HỆ THỐNG QUẢN LÝ NỀN NẾP – TÀI LIỆU GIỚI THIỆU SẢN PHẨM</span><span class="ph-right">Mô hình nhân rộng</span></div>
<div class="content">
  <div class="section-hdr"><span>🌐</span> VII. MÔ HÌNH NHÂN RỘNG</div>
  <p class="body-txt">Hệ thống được thiết kế từ đầu với khả năng <strong>nhân rộng ra nhiều trường học</strong>. Mỗi trường sẽ có phiên bản độc lập với dữ liệu riêng biệt. Triển khai đơn giản, không yêu cầu phần cứng đặc biệt.</p>
  <div class="sub-hdr">📋 6 bước triển khai</div>
  <table><thead><tr><th style="width:60px;text-align:center">Bước</th><th style="width:100px;text-align:center">Thời gian</th><th>Nội dung</th></tr></thead><tbody>
    ${[['1','1–2 ngày','Khảo sát nhu cầu: cơ cấu lớp, tiêu chí nề nếp, mẫu báo cáo, tài khoản Google'],['2','1–2 ngày','Cài đặt hệ thống riêng: backend, Sheets, hosting web với domain/subdomain tùy chọn'],['3','1 ngày','Nhập dữ liệu nền: danh sách lớp, học sinh, tiêu chí, phân kỳ thời gian'],['4','1 buổi','Đào tạo sử dụng cho cán bộ quản lý và giáo viên nhập liệu'],['5','7–30 ngày','Vận hành thử — hỗ trợ qua điện thoại/Zalo, điều chỉnh theo phản hồi'],['6','Ổn định','Bàn giao chính thức, cam kết hỗ trợ kỹ thuật theo gói đã chọn']].map(([n,t,c])=>`<tr><td style="text-align:center;font-weight:900;color:white;background:linear-gradient(135deg,#1E459F,#CF2A2A)">${n}</td><td style="text-align:center;color:#CF2A2A;font-weight:700">${t}</td><td>${c}</td></tr>`).join('')}
  </tbody></table>
  <div class="sub-hdr">⚙️ Yêu cầu tối thiểu</div>
  ${['Tài khoản Google (Gmail hoặc Google Workspace for Education của trường)','Kết nối Internet ổn định (để đồng bộ dữ liệu khi nhập liệu)','Thiết bị nhập liệu: smartphone hoặc máy tính (không cần cài đặt gì)','Ít nhất 1 người phụ trách kỹ thuật tại trường để phối hợp cài đặt'].map(t=>`<div class="bullet">${t}</div>`).join('')}
  <div class="highlight"><h3>🏫 Mục tiêu nhân rộng</h3><p>Từ mô hình đã chạy thật tại THPT Chuyên Nguyễn Trãi, sản phẩm sẵn sàng bàn giao cho<br><strong style="color:#CF2A2A">mọi trường THPT</strong> — mỗi trường một bản riêng, mang thương hiệu riêng, dữ liệu tách biệt.</p></div>
</div>
<div class="page-footer"><span class="pf-l">© 2026 Lương Hải Anh – 2Anh AI Education</span><span class="pf-r">Trang 8 / 9</span></div>
</div>

<!-- TRANG 9: LIÊN HỆ -->
<div class="page" id="page-9">
<div class="last-page">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;background:rgba(250,189,50,.15);border:2px solid #FABD32;border-radius:50%;width:70px;height:70px;line-height:70px;font-size:36px">📬</div>
    <h2 style="font-size:28px;font-weight:900;color:#FABD32;margin:14px 0 8px;letter-spacing:2px">THÔNG TIN LIÊN HỆ</h2>
    <p style="color:rgba(255,255,255,.7);font-size:13px">Để được tư vấn, báo giá hoặc triển khai thử nghiệm</p>
  </div>
  <div class="contact-box">
    ${[['👤 Tác giả','Lương Hải Anh'],['🏫 Đơn vị','2Anh AI Education'],['📧 Email','luonghaianh1208@gmail.com'],['📞 SĐT / Zalo','0328 186 264'],['🌐 Bản demo','https://nennep-demo.web.app']].map(([l,v])=>`<div class="contact-row"><span class="c-lbl">${l}</span><span class="c-val">${v}</span></div>`).join('')}
  </div>
  <div style="margin:12px 0 8px"><div style="color:#FABD32;font-weight:700;font-size:14px;text-align:center;margin-bottom:10px;text-transform:uppercase;letter-spacing:2px">Cam kết của tác giả</div>
  <div class="commit-box">
    <div class="commit-item">Sản phẩm đã vận hành thực tế tại THPT Chuyên Nguyễn Trãi từ đầu năm 2026</div>
    <div class="commit-item">Phiên bản 4.0 (tháng 8/2026): chuyển sang nền tảng Firebase — đồng bộ trực tiếp theo thời gian thực, đăng nhập bảo mật chuẩn, ảnh minh chứng tự nén, mở ứng dụng nhanh gấp nhiều lần</div>
    <div class="commit-item">Phiên bản 4.0: nhập khen thưởng theo hoạt động cho nhiều lớp một lượt, cấp tài khoản hàng loạt tự gửi thư đặt mật khẩu, giao diện mang thương hiệu riêng của trường</div>
    <div class="commit-item">Hỗ trợ kỹ thuật nhanh chóng, nhiệt tình trong suốt quá trình sử dụng</div>
    <div class="commit-item">Liên tục cập nhật, cải tiến theo phản hồi thực tế của đơn vị sử dụng</div>
    <div class="commit-item">Bảo mật thông tin học sinh theo quy định của Bộ Giáo dục và Đào tạo</div>
  </div></div>
  <div style="margin-top:auto;border-top:1px solid rgba(250,189,50,.3);padding-top:16px;text-align:center">
    <div style="font-size:14px;font-weight:900;color:#FABD32;margin-bottom:8px">© 2026 Lương Hải Anh. Bảo lưu mọi quyền.</div>
    <div style="font-size:11px;color:rgba(255,255,255,.45);line-height:1.8">Tài liệu bảo mật. Nghiêm cấm sao chép, phát tán khi chưa có sự đồng ý bằng văn bản của tác giả.<br>Thương hiệu "Nền Nếp" và toàn bộ giải pháp thuộc quyền sở hữu của tác giả — 2Anh AI Education.</div>
  </div>
</div>
</div>

</div><!-- .pages-wrap -->

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
async function captureAll() {
  const btn = document.getElementById('captureBtn');
  const status = document.getElementById('captureStatus');
  const fill = document.getElementById('progressFill');
  const pages = document.querySelectorAll('.pages-wrap > .page');
  btn.disabled = true;
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i++) {
    status.textContent = 'Đang chụp trang ' + (i+1) + '/' + pages.length + '...';
    fill.style.width = Math.round((i / pages.length) * 90) + '%';
    try {
      const canvas = await html2canvas(pages[i], {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: null, scrollX: 0, scrollY: 0,
        width: pages[i].offsetWidth, height: pages[i].offsetHeight
      });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
      const num = String(i+1).padStart(2,'0');
      zip.file('NenNep_CNT_Trang_' + num + '.jpg', blob);
    } catch(e) { console.error('Page ' + (i+1) + ' capture error:', e); }
  }
  status.textContent = 'Đang nén file ZIP...';
  fill.style.width = '95%';
  const content = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:6}});
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url; a.download = 'NenNep_CNT_BoAnh_GioiThieu.zip';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  fill.style.width = '100%';
  status.textContent = '✅ Đã tải xong! Mở file ZIP để xem ảnh.';
  btn.disabled = false;
  setTimeout(() => { fill.style.width = '0%'; status.textContent = 'Nhấn nút để tải ảnh hàng loạt'; }, 5000);
}
</script>
</body>
</html>`;
}
