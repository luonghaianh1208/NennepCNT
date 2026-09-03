/**
 * Sinh file Word hướng dẫn sử dụng cho từng trường bàn giao.
 *
 * Trình bày quy trình thiết lập ban đầu + ghi chú hằng ngày, dành cho Đoàn trường
 * tiếp nhận hệ thống. Không viết về mã nguồn, hạ tầng hay kỹ thuật — những thứ
 * đó thuộc tài liệu kỹ thuật riêng.
 *
 * Chạy: pnpm tsx scripts/generate-school-guide.ts
 * Kết quả: HuongDan_SuDung_NenNep.docx
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { writeFileSync } from 'fs';
import { join } from 'path';

const FONT = 'Times New Roman';
const SZ_BODY = 26; // 13pt — cỡ chữ hành chính
const SZ_H1 = 32;    // 16pt
const SZ_H2 = 28;    // 14pt

// ── helpers ────────────────────────────────────────────────────────────────

const p = (text: string, opts: any = {}) =>
  new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 100, line: 320 },
    indent: opts.indent,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? SZ_BODY,
        bold: opts.bold,
        italics: opts.italics,
      }),
    ],
  });

const heading = (text: string, level: 1 | 2) => new Paragraph({
    spacing: { before: level === 1 ? 360 : 220, after: 140 },
    children: [new TextRun({
      text, font: FONT,
      size: level === 1 ? SZ_H1 : SZ_H2,
      bold: true,
    })],
  });

const step = (n: number, text: string) => new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 540, hanging: 360 },
    children: [
      new TextRun({ text: `${n}. `, font: FONT, size: SZ_BODY, bold: true }),
      new TextRun({ text, font: FONT, size: SZ_BODY }),
    ],
  });

const bullet = (text: string) => new Paragraph({
    spacing: { after: 60 },
    bullet: { level: 0 },
    children: [new TextRun({ text, font: FONT, size: SZ_BODY })],
  });

const note = (text: string, type: 'info' | 'warn' | 'ok' = 'info') => {
  const color = type === 'warn' ? 'B91C1C' : type === 'ok' ? '16A34A' : 'B45309';
  const bg = type === 'warn' ? 'FEF2F2' : type === 'ok' ? 'F0FDF4' : 'FFFBEB';
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color },
      left:   { style: BorderStyle.SINGLE, size: 24, color },
      right:  { style: BorderStyle.SINGLE, size: 4, color },
      bottom: { style: BorderStyle.SINGLE, size: 4, color },
    },
    rows: [new TableRow({
      children: [new TableCell({
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        shading: { type: ShadingType.SOLID, color: bg, fill: bg } as any,
        children: [new Paragraph({
          children: [new TextRun({ text, font: FONT, size: SZ_BODY, color })],
        })],
      })],
    })],
  });
};

const space = new Paragraph({ spacing: { after: 120 } });

// ── nội dung ────────────────────────────────────────────────────────────────

// Helper bảng xử lý tình huống
const troubleTable = () =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, children: [new Paragraph({ children: [new TextRun({ text: "Tình huống", font: FONT, size: SZ_BODY, bold: true })] })] }),
          new TableCell({ shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, children: [new Paragraph({ children: [new TextRun({ text: "Cách xử lý", font: FONT, size: SZ_BODY, bold: true })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bấm đăng nhập mà báo \“chưa được cấp quyền\”", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Email chưa có trong danh sách hoặc ghi nhầm một ký tự. Báo lại quản trị viên kèm đúng địa chỉ đang dùng.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Cửa sổ Google không hiện ra", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Trình duyệt đang chặn cửa sổ bật lên. Cho phép cửa sổ bật lên cho trang này rồi thử lại. Nếu dùng iPhone Safari: vào Aa → Website Settings → bật Pop-up.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đăng nhập nhầm tài khoản Google", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bấm nút \"Đăng xuất\" ở góc phải trên, rồi đăng nhập lại — hệ thống luôn hiện ô chọn tài khoản.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bản ghi vi phạm không hiện ở xếp hạng", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Vào Tra cứu, bật bộ lọc \"Ngoài cấu hình\" để xem các bản ghi có ngày nằm ngoài mọi mốc thời gian đã cấu hình. Sửa ngày hoặc thêm mốc thời gian.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nhập Excel báo dòng lỗi", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bảng đối chiếu hiện ba cột màu. Cột đỏ là dòng lỗi — thường do tên lớp không khớp. Sửa file rồi nhập lại.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ảnh minh chứng không upload được", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ảnh quá lớn (trên 5MB) hoặc mạng chập chờn. Nén ảnh hoặc thử lại. Ảnh thấy trong kết quả tức là lưu thành công.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tài khoản cán bộ nghỉ việc / học sinh ra trường", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Khoá tài khoản, đừng xoá. Tài khoản đã ghi bản ghi nào thì không xoá được — hệ thống giữ lại dấu vết người nhập để đối chiếu khi cần.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đầu năm học mới — xoá dữ liệu cũ", font: FONT, size: SZ_BODY })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Hệ thống KHÔNG có nút xoá cả năm. Giữ lại lịch sử để tra cứu khi cần. Muốn \"bắt đầu lại\", vào Cấu hình → Thời gian để thêm mốc năm mới, không cần xoá dữ liệu cũ.", font: FONT, size: SZ_BODY })] })] }),
        ],
      }),
    ],
  });

const doc = new Document({
  creator: '2Anh AI Education',
  title: 'Hướng dẫn sử dụng hệ thống nền nếp',
  styles: {
    default: {
      document: { run: { font: FONT, size: SZ_BODY } },
    },
  },
  sections: [{
    properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1418 } } },
    children: [
      // ── Bìa ──
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 200 }, children: [
        new TextRun({ text: 'CÔNG TY TNHH GIÁO DỤC 2ANH AI', font: FONT, size: 28, bold: true }),
      ] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
        new TextRun({ text: '2ANH AI EDUCATION', font: FONT, size: 28, bold: true }),
      ] }),
      space,
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
        new TextRun({ text: 'HƯỚNG DẪN SỬ DỤNG', font: FONT, size: 40, bold: true }),
      ] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
        new TextRun({ text: 'Hệ thống quản lý nền nếp học sinh', font: FONT, size: 32, bold: true }),
      ] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
        new TextRun({ text: 'Phiên bản 4.0 — Tháng 9 / 2026', font: FONT, size: 24, italics: true }),
      ] }),
      space,
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
        new TextRun({ text: 'Bản dành cho Đoàn trường tiếp nhận bàn giao', font: FONT, size: 24 }),
      ] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: 'Tài liệu nội bộ — không phát hành ra ngoài', font: FONT, size: 22, italics: true, color: '6B7280' }),
      ] }),
      new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }),
      new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '© 2026 2Anh AI Education — Lương Hải Anh', font: FONT, size: 22, italics: true }),
      ] }),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── Mục lục ──
      heading('MỤC LỤC', 1),
      bullet('1. Đăng nhập lần đầu'),
      bullet('2. Cấp quyền cho cán bộ và cờ đỏ'),
      bullet('3. Thiết lập danh mục ban đầu (lớp, học sinh, tiêu chí, mốc thời gian)'),
      bullet('4. Ghi vi phạm hằng ngày'),
      bullet('5. Ghi khen thưởng theo hoạt động'),
      bullet('6. Tra cứu, sửa, xoá bản ghi'),
      bullet('7. Xem xếp hạng và xuất báo cáo'),
      bullet('8. Tùy chỉnh quy định và vai trò'),
      bullet('9. Thay đổi thương hiệu và logo nhà trường'),
      bullet('10. Xử lý tình huống thường gặp'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 1. Đăng nhập lần đầu ──
      heading('1. Đăng nhập lần đầu', 1),
      p('Hệ thống đăng nhập bằng tài khoản Google, không có mật khẩu riêng. Ai có email trong danh sách cho phép mới vào được.'),
      space,
      step(1, 'Mở đường dẫn hệ thống mà bên bàn giao cung cấp (ví dụ https://thptnguyendu.nennep.pro.vn).'),
      step(2, 'Bấm nút "Đăng nhập" ở góc phải trên cùng.'),
      step(3, 'Trong cửa sổ Google hiện ra, chọn tài khoản Google của mình — chính email mà Đoàn trường đã cấp.'),
      step(4, 'Lần đầu tiên hệ thống sẽ kiểm tra email trong danh sách cho phép và gắn vai trò. Nếu thấy báo lỗi "chưa được cấp quyền", báo lại Đoàn trường.'),
      space,
      note('Người chưa đăng nhập vẫn xem được màn hình Tổng quan và Xếp hạng — phụ huynh và học sinh có thể vào xem bằng trình duyệt ẩn danh, không cần tài khoản.', 'info'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 2. Cấp quyền ──
      heading('2. Cấp quyền cho cán bộ và cờ đỏ', 1),
      p('Chỉ tài khoản có quyền "Quản lý tài khoản" mới thấy mục này. Thường là BCH và quản trị viên.'),
      space,
      step(1, 'Vào Cấu hình → Tài khoản (mục "Ai được vào hệ thống").'),
      step(2, 'Điền Họ tên, Địa chỉ Google (email), Vai trò, Lớp phụ trách (nếu có). Bấm nút +.'),
      step(3, 'Hệ thống ghi vào danh sách cho phép. Người đó đăng nhập ngay lần sau bằng chính email ấy là vào được.'),
      space,
      p('Có 8 vai trò có sẵn, mỗi vai trò có một bộ quyền riêng. Bảng 12 quyền trong Cấu hình → Vai trò cho phép tích chọn từng ô để tạo vai trò mới phù hợp với trường.', { italics: true }),
      space,
      p('Ví dụ về vai trò thường dùng:'),
      bullet('Quản trị viên — full quyền, bao gồm cấp tài khoản và đổi quy định.'),
      bullet('BCH / BCH phụ trách — ghi cả vi phạm lẫn khen thưởng, xem được tên người ghi.'),
      bullet('Cờ đỏ — chỉ ghi vi phạm, giới hạn trong một lớp cụ thể (nếu bật quyền "Chỉ xem lớp phụ trách").'),
      bullet('Giáo viên chủ nhiệm — chỉ xem lớp mình, không ghi được.'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 3. Thiết lập ban đầu ──
      heading('3. Thiết lập danh mục ban đầu', 1),
      p('Bốn bước theo thứ tự. Làm theo thứ tự này để tránh phải sửa lại.'),
      space,
      heading('3.1. Cấu hình thương hiệu trường', 2),
      step(1, 'Vào Cấu hình → Thương hiệu.'),
      step(2, 'Nhập tên đầy đủ của trường, tên rút gọn (sẽ hiện trên thanh tiêu đề), khẩu hiệu (hiện ở trang Giới thiệu).'),
      step(3, 'Tải logo (file vuông, nền trong suốt, dưới 2MB).'),
      step(4, 'Bấm Lưu thương hiệu.'),
      space,
      note('Phần bản quyền của 2Anh AI Education ở trang Giới thiệu là cố định, không thay đổi được.', 'info'),
      space,
      heading('3.2. Tạo danh sách lớp', 2),
      p('Bước bắt buộc trước khi nhập học sinh. Học sinh chỉ thêm được khi lớp đã tồn tại.'),
      space,
      step(1, 'Vào Cấu hình → Lớp học.'),
      step(2, 'Tạo từng lớp bằng cách nhập thủ công, hoặc bấm "Tải mẫu" để lấy file Excel rồi nhập hàng loạt.'),
      step(3, 'File Excel có 2 cột: Ten_lop (bắt buộc) và Giao_vien_chu_nhiem (tuỳ chọn). Mã lớp là chính Ten_lop.'),
      step(4, 'Bấm "Nhập Excel" rồi bấm "Lưu Thay Đổi" ở góc dưới bên phải.'),
      space,
      note('Mã lớp phải khớp chính xác (cả chữ hoa/thường). Sau này nhập học sinh, cột Ten_lop phải khớp y vậy. Trường thường dùng mã kiểu "10A1", "11C2".', 'warn'),
      space,
      heading('3.3. Nhập danh sách học sinh', 2),
      step(1, 'Vào Cấu hình → Học sinh.'),
      step(2, 'Chọn lớp ở ô "Xem lớp" để xem danh sách hiện tại.'),
      step(3, 'Có thể nhập tay từng em (gõ tên → bấm nút +) hoặc bấm "Tải mẫu" để nhập hàng loạt.'),
      step(4, 'File Excel mẫu có cột: Ten_lop, Ho_ten_HS, So_xe (biển số xe, tuỳ chọn).'),
      step(5, 'Bấm "Nhập Excel", hệ thống sẽ báo bao nhiêu em thêm được, bao nhiêu dòng lỗi (thường do lệch tên lớp).'),
      step(6, 'Bấm "Lưu Thay Đổi" ở góc dưới bên phải.'),
      space,
      heading('3.4. Tạo mốc thời gian', 2),
      p('Tuần / tháng / học kỳ của năm học. Bước này bắt buộc trước khi ghi bất kỳ vi phạm nào, vì mỗi bản ghi phải thuộc một tuần nào đó mới tính vào xếp hạng được.'),
      space,
      step(1, 'Vào Cấu hình → Thời gian.'),
      step(2, 'Bấm "Tải mẫu" để có file Excel với 100 dòng trống.'),
      step(3, 'Điền 4 cột: Ten (ví dụ "Tuần 1", "Học kỳ 1"), Loai (WEEK / MONTH / SEMESTER), Ngay_bat_dau, Ngay_ket_thuc. Định dạng ngày là YYYY-MM-DD.'),
      step(4, 'Bấm "Nhập Excel" rồi "Lưu Thay Đổi".'),
      space,
      heading('3.5. Cấu hình tiêu chí vi phạm', 2),
      p('Bộ lỗi mà cán bộ Đoàn sẽ chấm hằng ngày.'),
      space,
      step(1, 'Vào Cấu hình → Lỗi vi phạm.'),
      step(2, 'Bấm "Tải mẫu" để lấy file Excel có 2 cột: Noi_dung_loi, Diem.'),
      step(3, 'Điền danh sách lỗi. Ví dụ: "Đi học muộn" — 5 điểm, "Không đeo phù hiệu" — 2 điểm. Điểm là số dương (hệ thống tự hiểu là trừ).'),
      step(4, 'Bấm "Nhập Excel" rồi "Lưu Thay Đổi".'),
      space,
      heading('3.6. Cấu hình quy định chung', 2),
      p('Bảng điểm giải thưởng, điểm khởi đầu mỗi tuần, màu nhận diện. Vào Cấu hình → Quy định.'),
      space,
      bullet('Điểm khởi đầu mỗi tuần: 500 (mặc định). Có thể đổi nếu trường muốn dùng con số khác.'),
      bullet('Hệ số học kỳ II: mặc định 1 (tức là không nhân đôi). Nếu trường muốn học kỳ 2 tính gấp đôi, đổi thành 2.'),
      bullet('Bảng điểm khen thưởng: khai theo cột giải (Nhất, Nhì, Ba…) và hàng cấp (Cấp trường, Cấp thành phố, Cấp tỉnh…). Mỗi ô là số điểm thưởng.'),
      bullet('Bắt buộc ảnh minh chứng khi ghi vi phạm: bật thì cán bộ phải chụp ảnh mới lưu được. Nên bật.'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 4. Ghi vi phạm hằng ngày ──
      heading('4. Ghi vi phạm hằng ngày', 1),
      p('Thao tác nhiều nhất trong ngày. Dành cho cờ đỏ và BCH.'),
      space,
      step(1, 'Vào tab Nhập lỗi (mặc định mở khi đăng nhập).'),
      step(2, 'Chọn ngày (mặc định hôm nay).'),
      step(3, 'Chọn khối → chọn lớp → chọn học sinh (hoặc chọn "Tập thể lớp" để ghi cho cả lớp).'),
      step(4, 'Chọn lỗi vi phạm. Điểm tự điền theo tiêu chí đã cấu hình.'),
      step(5, 'Ghi chú thêm (tuỳ chọn, nhưng nên ghi — giúp tra cứu sau).'),
      step(6, 'Nếu bật bắt buộc ảnh: chụp hoặc tải ảnh lên (nên dùng ảnh từ camera, không cần ảnh đẹp — chỉ cần rõ nội dung).'),
      step(7, 'Bấm "Lưu Vi Phạm".'),
      space,
      note('Nếu ngày ghi nhận nằm ngoài mọi mốc thời gian đã cấu hình, hệ thống báo cảnh báo vàng. Bản ghi vẫn lưu nhưng không tính vào xếp hạng. Nên bổ sung mốc thời gian thay vì lưu bản ghi ngoài.', 'warn'),
      space,
      p('Muốn ghi nhiều lỗi cho cùng một học sinh một lúc? Bấm Lưu, lỗi hiện tại vẫn còn — chỉ thay đổi lỗi và bấm Lưu lần nữa.'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 5. Khen thưởng ──
      heading('5. Ghi khen thưởng theo hoạt động', 1),
      p('Mỗi khi trường tổ chức một hoạt động — thi đấu thể thao, văn nghệ, học tập — thường có nhiều lớp đạt giải cùng lúc. Màn hình này ghi cả hoạt động một lần.'),
      space,
      step(1, 'Vào tab Nhập lỗi, chuyển sang "Nhập Điểm Thành Tích" ở góc trên.'),
      step(2, 'Gõ tên hoạt động, ví dụ "Hội khoẻ Phù Đổng 2026".'),
      step(3, 'Chọn nhóm hoạt động, cấp độ, ngày. Tải ảnh trao giải nếu có (ảnh dùng chung cho mọi lớp).'),
      step(4, 'Bấm "Thêm dòng" cho mỗi lớp đạt giải. Cột Lớp là danh sách chọn, cột Giải chọn từ bảng điểm đã cấu hình ở Quy định. Điểm tự điền.'),
      step(5, 'Bấm "Lưu toàn bộ" khi đã đủ. Tất cả bản ghi thành tích được ghi một lần.'),
      space,
      note('Bảng điểm khen thưởng (giải × cấp) chỉ khai ở Cấu hình → Quy định. Không cần tạo tiêu chí thành tích — hệ thống tự quản lý.', 'info'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 6. Tra cứu, sửa, xoá ──
      heading('6. Tra cứu, sửa, xoá bản ghi', 1),
      p('Vào tab Tra cứu (ListTab) để xem toàn bộ vi phạm và thành tích đã ghi. Có 4 bộ lọc: thời gian, lớp, loại, ô tìm kiếm tự do.'),
      space,
      p('Xem chi tiết một bản ghi: bấm vào dòng đó, cửa sổ hiện ra cho xem ảnh, ghi chú, người ghi.'),
      space,
      heading('6.1. Sửa bản ghi', 2),
      p('Bấm nút bút chì ở dòng cần sửa. Có thể sửa nội dung lỗi, ngày ghi nhận, ghi chú, ảnh. Sau khi sửa, bảng xếp hạng và điểm lớp tự cập nhật.'),
      space,
      heading('6.2. Xoá bản ghi', 2),
      p('Bấm nút thùng rác ở dòng cần xoá. Bắt buộc có quyền "Sửa/xoá bản ghi người khác". Mỗi lần xoá có ghi vào nhật ký.'),
      space,
      note('Có thể xoá nhiều dòng một lúc: tích chọn các ô vuông ở đầu dòng, bấm "Xoá" ở thanh hành động. Cần quyền "Xoá hàng loạt".', 'info'),
      space,
      heading('6.3. Lọc bản ghi ngày ngoài cấu hình', 2),
      p('Dành cho người quản trị. Bấm "Ngoài cấu hình" trong khối lọc để xem các bản ghi có ngày nằm ngoài mọi tuần/tháng/học kỳ đã cấu hình — thường là dấu hiệu cần thêm mốc thời gian bị thiếu.'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 7. Xếp hạng ──
      heading('7. Xem xếp hạng và xuất báo cáo', 1),
      p('Vào tab Xếp hạng. Mặc định xem tuần hiện tại. Có thể chuyển sang tháng, học kỳ, hoặc cả năm. Bấm nút khối để xem riêng từng khối.'),
      space,
      bullet('Bảng xếp hạng: lớp nào đứng đầu theo từng khối.'),
      bullet('Cột điểm: điểm khởi đầu trừ vi phạm cộng thành tích.'),
      bullet('Có hai chế độ: hiện điểm cả học kỳ I (mặc định) hoặc chỉ riêng học kỳ II (hệ số nhân 2x).'),
      space,
      heading('7.1. Xuất báo cáo tuần ra Word', 2),
      step(1, 'Trong tab Xếp hạng, chọn "Theo Tuần" và tuần cụ thể ở bộ lọc.'),
      step(2, 'Bấm "Tải Báo Cáo" — hệ thống sinh file Word gồm: ưu điểm, nhược điểm, chi tiết từng tiêu chí, bảng xếp hạng theo từng khối.'),
      step(3, 'Tải về in ra, ký tên, lưu vào hồ sơ trường.'),
      space,
      heading('7.2. Xuất dữ liệu ra Excel', 2),
      p('Trong tab Tra cứu, bấm "Xuất Excel" để tải toàn bộ danh sách đang xem về file Excel — dùng để gửi cho phòng giáo dục hoặc lưu hồ sơ.'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 8. Tùy chỉnh ──
      heading('8. Tùy chỉnh quy định và vai trò', 1),
      heading('8.1. Tạo vai trò mới', 2),
      step(1, 'Vào Cấu hình → Vai trò.'),
      step(2, 'Nhập mã vai trò (chữ hoa, không dấu cách, ví dụ "TO_TRUONG"), tên hiển thị, chọn màu.'),
      step(3, 'Tích chọn 12 quyền tương ứng trong bảng, bấm "Lưu Thay Đổi".'),
      space,
      heading('8.2. Sửa quy định chấm điểm', 2),
      p('Vào Cấu hình → Quy định. Có thể đổi điểm khởi đầu, hệ số học kỳ II, bảng điểm khen thưởng, bật/tắt bắt buộc ảnh. Lưu ý: đổi bảng điểm không tự sửa các bản ghi đã ghi trước đó.'),
      space,
      heading('8.3. Tên lớp và tên giải phải khớp chính xác', 2),
      p('Khi đổi tên lớp hoặc tên giải trong bảng, phải cập nhật bảng điểm khen thưởng cùng lúc — hai nơi dùng chung một tên. Nếu không, các bản ghi cũ sẽ hiện không tìm thấy điểm thưởng.'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 9. Thương hiệu ──
      heading('9. Thay đổi thương hiệu và logo nhà trường', 1),
      p('Cấu hình → Thương hiệu.'),
      space,
      step(1, 'Đổi tên trường, tên rút gọn trên thanh tiêu đề, khẩu hiệu — tất cả cập nhật ngay khi lưu.'),
      step(2, 'Tải logo mới (vuông, dưới 2MB). Có thể dùng "Bỏ logo" để quay lại chữ cái đầu.'),
      step(3, 'Màu nhận diện: tab Quy định có 4 tông màu (đỏ-vàng, xanh dương, xanh lá, tím than). Trường dùng màu nào tuỳ thuộc Đoàn.'),
      space,
      note('Phần bản quyền tác giả ở trang Giới thiệu là cố định, không thay đổi được.', 'info'),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── 10. Xử lý tình huống ──
      heading('10. Xử lý tình huống thường gặp', 1),
      space,
      p('Bảng dưới gom các lỗi hay gặp nhất khi vận hành. Cột "Cách xử lý" nêu việc cần làm ngay, không cần gọi kỹ thuật trừ khi trục trặc dai dẳng.', { italics: true }),
      space,
      troubleTable(),
      new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

      // ── Liên hệ ──
      heading('Liên hệ kỹ thuật', 1),
      p('Khi gặp lỗi mà tài liệu này không đề cập, hoặc lỗi lặp lại nhiều lần, liên hệ đơn vị triển khai:'),
      space,
      p('2Anh AI Education', { bold: true, align: AlignmentType.CENTER }),
      p('Lương Hải Anh', { align: AlignmentType.CENTER }),
      p('Zalo: 0352 071 197 (ưu tiên)', { align: AlignmentType.CENTER }),
      p('Email: lienhe@2anhaiedu.vn', { align: AlignmentType.CENTER }),
      space,
      note('Khi liên hệ, ghi rõ: tên trường, đường link, bước đang làm, kèm ảnh chụp màn hình nếu có. Tránh gửi mỗi "hỏng rồi" — càng mô tả chi tiết càng sửa nhanh.', 'info'),
      space,
      space,
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '— Hết —', font: FONT, size: SZ_BODY, italics: true }),
      ] }),
    ],
  }],
});

const out = join(process.cwd(), 'HuongDan_SuDung_NenNep.docx');
Packer.toBuffer(doc).then(buf => {
  writeFileSync(out, buf);
  console.log('✔ Đã ghi file hướng dẫn:', out);
});
