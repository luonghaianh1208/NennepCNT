/**
 * Sinh file Word hướng dẫn sử dụng toàn diện (.docx) cho trường tiếp nhận bàn giao.
 *
 * Đầy đủ 100% quy trình vận hành:
 *   1. Đăng nhập & Xác thực Google (Allowlist)
 *   2. Quản lý tài khoản & Phân quyền (8 vai trò, 12 quyền chi tiết, bảng ma trận quyền)
 *   3. Thiết lập danh mục ban đầu (Thương hiệu, Lớp, Học sinh, Mốc thời gian, Tiêu chí lỗi, Quy định chung)
 *   4. Ghi nhận vi phạm hằng ngày (Cá nhân, Tập thể, Ảnh minh chứng, Cảnh báo ngoài cấu hình)
 *   5. Ghi nhận khen thưởng theo hoạt động (Hoạt động đa lớp, Bảng điểm Giải x Cấp)
 *   6. Tra cứu, sửa, xoá & kiểm duyệt dữ liệu (Lọc nâng cao, Lọc trùng, Ngoài cấu hình, Xuất Excel)
 *   7. Tổng quan, Xếp hạng & Xuất báo cáo (Theo tuần/tháng/kỳ, Xuất Word báo cáo chuẩn trường)
 *   8. Xem chi tiết hồ sơ lớp (Biểu đồ diễn biến, Lịch sử lỗi/thành tích)
 *   9. Ban Nề Nếp & Phân công trực (Task Force)
 *   10. Nhật ký hệ thống (Audit Log & Truy vết khiếu nại)
 *   11. Bảng xử lý tình huống thường gặp & Liên hệ hỗ trợ kỹ thuật
 *
 * Chạy: npx tsx scripts/generate-school-guide.ts
 * Kết quả: HuongDan_SuDung_NenNep.docx ở thư mục gốc
 */
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { writeFileSync } from 'fs';
import { join } from 'path';

const FONT = 'Times New Roman';
const SZ_BODY = 26; // 13pt — Cỡ chữ hành chính chuẩn
const SZ_H1 = 32;   // 16pt — Tiêu đề mục chính
const SZ_H2 = 28;   // 14pt — Tiêu đề mục con
const SZ_H3 = 26;   // 13pt đậm — Tiêu đề nhánh
const SZ_TITLE = 38;// 19pt — Tiêu đề bìa

// ── HELPERS ĐỊNH DẠNG VĂN BẢN ────────────────────────────────────────────────

const p = (text: string, opts: {
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  after?: number;
  before?: number;
  bold?: boolean;
  italics?: boolean;
  size?: number;
  indent?: { left?: number; hanging?: number };
  color?: string;
} = {}) =>
  new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 100, line: 310 },
    indent: opts.indent,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? SZ_BODY,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
      }),
    ],
  });

const heading1 = (text: string) =>
  new Paragraph({
    spacing: { before: 360, after: 140 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: SZ_H1,
        bold: true,
        color: 'B91C1C', // Đỏ Đoàn
      }),
    ],
  });

const heading2 = (text: string) =>
  new Paragraph({
    spacing: { before: 220, after: 100 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: SZ_H2,
        bold: true,
        color: '0F172A',
      }),
    ],
  });

const heading3 = (text: string) =>
  new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: SZ_H3,
        bold: true,
        color: '1E293B',
      }),
    ],
  });

const step = (n: number, text: string, subText?: string) => {
  const runs = [
    new TextRun({ text: `Bước ${n}: `, font: FONT, size: SZ_BODY, bold: true, color: 'B91C1C' }),
    new TextRun({ text, font: FONT, size: SZ_BODY, bold: true }),
  ];
  if (subText) {
    runs.push(new TextRun({ text: ` — ${subText}`, font: FONT, size: SZ_BODY }));
  }
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 400, hanging: 400 },
    children: runs,
  });
};

const bullet = (text: string, boldPrefix?: string) => {
  const runs = [];
  if (boldPrefix) {
    runs.push(new TextRun({ text: boldPrefix + ' ', font: FONT, size: SZ_BODY, bold: true }));
  }
  runs.push(new TextRun({ text, font: FONT, size: SZ_BODY }));
  return new Paragraph({
    spacing: { after: 60 },
    bullet: { level: 0 },
    children: runs,
  });
};

const noteBox = (text: string, type: 'info' | 'warn' | 'ok' = 'info', title?: string) => {
  const borderColor = type === 'warn' ? 'DC2626' : type === 'ok' ? '16A34A' : 'D97706';
  const bgColor = type === 'warn' ? 'FEF2F2' : type === 'ok' ? 'F0FDF4' : 'FFFBEB';
  const icon = type === 'warn' ? '⚠️ LƯU Ý QUAN TRỌNG: ' : type === 'ok' ? '💡 ĐIỂM TIỆN ÍCH: ' : '📌 HƯỚNG DẪN: ';

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
      right: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor } as any,
            children: [
              new Paragraph({
                spacing: { line: 290 },
                children: [
                  new TextRun({
                    text: title ? `${title}: ` : icon,
                    font: FONT,
                    size: SZ_BODY,
                    bold: true,
                    color: borderColor,
                  }),
                  new TextRun({
                    text,
                    font: FONT,
                    size: SZ_BODY,
                    color: '1E293B',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

const space = new Paragraph({ spacing: { after: 120 } });
const pageBreak = new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] });

// ── BẢNG MA TRẬN PHÂN QUYỀN ──────────────────────────────────────────────────

const createPermissionMatrixTable = () => {
  const headers = ['Quyền hạn', 'Quản trị', 'Lãnh đạo', 'BCH P.Trách', 'BCH', 'Cờ đỏ', 'Nền nếp', 'GVCN', 'Khách'];
  const permissions = [
    { name: 'Ghi vi phạm', desc: 'Chấm lỗi hằng ngày, chụp ảnh', roles: [true, false, true, true, true, true, false, false] },
    { name: 'Ghi khen thưởng', desc: 'Ghi nhận điểm cộng, thành tích', roles: [true, false, true, true, false, false, false, false] },
    { name: 'Sửa/xoá bản ghi người khác', desc: 'Cán bộ quản lý kiểm duyệt', roles: [true, false, true, false, false, false, false, false] },
    { name: 'Xoá hàng loạt', desc: 'Chọn nhiều dòng xoá cùng lúc', roles: [true, false, true, false, false, false, false, false] },
    { name: 'Thấy tên người nhập', desc: 'Hiện tên thật thay vì "Ẩn danh"', roles: [true, true, true, true, false, true, false, false] },
    { name: 'Chỉ xem lớp phụ trách', desc: 'Giới hạn phạm vi theo lớp gán', roles: [false, false, false, false, true, true, true, false] },
    { name: 'Công cụ kiểm duyệt', desc: 'Lọc trùng lặp, ngoài cấu hình', roles: [true, false, true, false, false, false, false, false] },
    { name: 'Quản lý danh mục', desc: 'Lớp, HS, Tiêu chí, Mốc thời gian', roles: [true, false, false, false, false, false, false, false] },
    { name: 'Quản lý tài khoản', desc: 'Cấp quyền, khoá, phân vai trò', roles: [true, false, false, false, false, false, false, false] },
    { name: 'Phân công Ban Nề Nếp', desc: 'Quản lý đội cờ đỏ, chấm công', roles: [true, false, true, false, false, false, false, false] },
    { name: 'Hệ thống & Thương hiệu', desc: 'Đổi tên trường, logo, xem Log', roles: [true, false, false, false, false, false, false, false] },
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          new TableCell({
            shading: { type: ShadingType.SOLID, color: 'B91C1C', fill: 'B91C1C' },
            margins: { top: 100, bottom: 100, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                children: [new TextRun({ text: h, font: FONT, size: 20, bold: true, color: 'FFFFFF' })],
              }),
            ],
          })
        ),
      }),
      ...permissions.map((pRow, idx) =>
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC', fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: pRow.name, font: FONT, size: 20, bold: true }),
                    new TextRun({ text: `\n(${pRow.desc})`, font: FONT, size: 18, italics: true, color: '64748B' }),
                  ],
                }),
              ],
            }),
            ...pRow.roles.map(hasPerm =>
              new TableCell({
                shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC', fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
                margins: { top: 80, bottom: 80, left: 40, right: 40 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: hasPerm ? '✓' : '–',
                        font: FONT,
                        size: hasPerm ? 22 : 20,
                        bold: hasPerm,
                        color: hasPerm ? '16A34A' : 'CBD5E1',
                      }),
                    ],
                  }),
                ],
              })
            ),
          ],
        })
      ),
    ],
  });
};

// ── BẢNG XỬ LÝ SỰ CỐ TOÀN DIỆN ──────────────────────────────────────────────

const createTroubleshootingTable = () => {
  const issues = [
    {
      q: 'Bấm đăng nhập nhưng báo "Chưa được cấp quyền truy cập"',
      a: 'Email Google chưa có trong danh sách của trường hoặc quản trị viên gõ nhầm một ký tự. Liên hệ Quản trị viên kiểm tra mục Cấu hình → Tài khoản để đối chiếu chính xác địa chỉ email.',
    },
    {
      q: 'Cửa sổ đăng nhập Google không hiện lên',
      a: 'Trình duyệt đang chặn cửa sổ Pop-up. Cho phép Pop-up cho trang web này. Trên Safari (iPhone/iPad): Vào Cài đặt → Safari → Tắt "Chặn cửa sổ bật lên".',
    },
    {
      q: 'Đăng nhập nhầm tài khoản Google cá nhân khác',
      a: 'Bấm nút "Đăng xuất" ở góc phải thanh tiêu đề. Khi đăng nhập lại, hệ thống luôn mở hộp thoại để bạn chủ động chọn đúng tài khoản Google được cấp quyền.',
    },
    {
      q: 'Ghi vi phạm xong nhưng không thấy lớp bị trừ điểm ở Xếp hạng',
      a: 'Vào tab Tra cứu, bật công cụ kiểm duyệt "Ngoài cấu hình". Nếu ngày ghi nhận nằm ngoài tất cả các Tuần đã tạo, điểm sẽ không được gom vào bảng xếp hạng. Sửa lại ngày bản ghi hoặc tạo thêm Tuần mới.',
    },
    {
      q: 'Nhập file Excel báo nhiều dòng lỗi màu đỏ',
      a: 'Kiểm tra cột Ten_lop trong file Excel có khớp 100% với danh mục Lớp đã tạo trong Cấu hình → Lớp học hay không (bao gồm chữ hoa, chữ thường và dấu cách thừa).',
    },
    {
      q: 'Không thể tải ảnh minh chứng hoặc báo lỗi tải ảnh',
      a: 'Ảnh dung lượng quá lớn (khuyến nghị dưới 5MB) hoặc mạng yếu. Dùng camera điện thoại chụp trực tiếp hoặc nén ảnh trước khi tải lên.',
    },
    {
      q: 'Cán bộ / Cờ đỏ chuyển công tác hoặc học sinh tốt nghiệp',
      a: 'Chỉ thực hiện Khoá tài khoản (nút 🔒), TUYỆT ĐỐI KHÔNG XOÁ tài khoản để giữ nguyên dấu vết và tên người đã nhập liệu trên các biên bản vi phạm cũ.',
    },
    {
      q: 'Đầu năm học mới: muốn dọn dẹp để bắt đầu năm mới',
      a: 'Hệ thống giữ toàn bộ lịch sử các năm để tra cứu. Nhà trường chỉ cần vào Cấu hình → Thời gian để tạo danh sách Tuần, Tháng, Kỳ cho năm học mới, không cần xoá dữ liệu năm cũ.',
    },
    {
      q: 'Máy của giáo viên vẫn hiển thị số điểm cũ của tuần trước',
      a: 'Bấm nút "Làm mới" (biểu tượng mũi tên xoay tròn) ở góc phải. Riêng tuần đang diễn ra có sóng Realtime cập nhật tự động trong 1 giây.',
    },
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: '1E293B', fill: '1E293B' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: 'Tình huống / Sự cố', font: FONT, size: SZ_BODY, bold: true, color: 'FFFFFF' })] })],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: '1E293B', fill: '1E293B' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: 'Nguyên nhân & Hướng xử lý ngay', font: FONT, size: SZ_BODY, bold: true, color: 'FFFFFF' })] })],
          }),
        ],
      }),
      ...issues.map((row, idx) =>
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC', fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
              margins: { top: 90, bottom: 90, left: 90, right: 90 },
              children: [new Paragraph({ children: [new TextRun({ text: row.q, font: FONT, size: SZ_BODY, bold: true, color: 'B91C1C' })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC', fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
              margins: { top: 90, bottom: 90, left: 90, right: 90 },
              children: [new Paragraph({ children: [new TextRun({ text: row.a, font: FONT, size: SZ_BODY })] })],
            }),
          ],
        })
      ),
    ],
  });
};

// ── KHỞI TẠO TÀI LIỆU WORD CHÍNH ─────────────────────────────────────────────

const doc = new Document({
  creator: '2Anh AI Education — Lương Hải Anh',
  title: 'Hướng dẫn sử dụng Hệ thống Quản lý Nền nếp Học sinh',
  styles: {
    default: {
      document: { run: { font: FONT, size: SZ_BODY } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1418 }, // Lề chuẩn: Trái 2.5cm, còn lại 2cm
        },
      },
      children: [
        // ── TRANG BÌA ────────────────────────────────────────────────────────
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 140 }, children: [
          new TextRun({ text: 'CÔNG TY TNHH GIÁO DỤC 2ANH AI', font: FONT, size: 28, bold: true, color: '1E293B' }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
          new TextRun({ text: '2ANH AI EDUCATION — GIẢI PHÁP CHUYỂN ĐỔI SỐ HỌC ĐƯỜNG', font: FONT, size: 22, bold: true, color: '64748B' }),
        ] }),
        space,
        space,
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [
          new TextRun({ text: 'HƯỚNG DẪN SỬ DỤNG', font: FONT, size: 42, bold: true, color: 'B91C1C' }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [
          new TextRun({ text: 'HỆ THỐNG QUẢN LÝ NỀN NẾP & THI ĐUA HỌC SINH', font: FONT, size: 30, bold: true, color: '0F172A' }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          new TextRun({ text: 'Phiên bản chuyên nghiệp 4.1.2 — Công nghệ Đồng bộ Đám mây', font: FONT, size: 24, italics: true, color: 'D97706' }),
        ] }),
        space,
        space,
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: 'Tài liệu bàn giao và chuẩn hoá quy trình vận hành', font: FONT, size: 24, bold: true }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [
          new TextRun({ text: 'Dành cho: Ban Giám Hiệu · Đoàn Thanh Niên · Ban Nề Nếp · Giáo Viên Chủ Nhiệm', font: FONT, size: 22, italics: true, color: '475569' }),
        ] }),
        space,
        space,
        space,
        space,
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: 'Tác giả & Đơn vị phát triển: Lương Hải Anh — 2Anh AI Education', font: FONT, size: 22, bold: true }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: 'Hỗ trợ kỹ thuật: 0352 071 197 · lienhe@2anhaiedu.vn · https://nennep.pro.vn', font: FONT, size: 20, italics: true, color: '64748B' }),
        ] }),
        pageBreak,

        // ── MỤC LỤC ──────────────────────────────────────────────────────────
        heading1('MỤC LỤC NỘI DUNG VẬN HÀNH'),
        p('Tài liệu hướng dẫn gồm 11 phần được chuẩn hoá theo quy trình thực tế tại các trường THPT:'),
        space,
        bullet('1. Đăng nhập lần đầu & Cơ chế bảo mật Google không mật khẩu'),
        bullet('2. Cấp quyền truy cập & Bảng ma trận 12 quyền hạn cho 8 vai trò'),
        bullet('3. Thiết lập danh mục ban đầu (Thương hiệu, Lớp, Học sinh, Mốc thời gian, Tiêu chí, Quy định)'),
        bullet('4. Ghi nhận vi phạm nề nếp hằng ngày (Cá nhân, Tập thể, Minh chứng ảnh)'),
        bullet('5. Ghi nhận khen thưởng theo hoạt động (Cộng điểm đa lớp, Bảng điểm chuẩn)'),
        bullet('6. Tra cứu, sửa, xoá & Công cụ kiểm duyệt dữ liệu'),
        bullet('7. Tổng quan, Xếp hạng thi đua & Xuất báo cáo tuần ra file Word'),
        bullet('8. Xem chi tiết hồ sơ lớp & Biểu đồ tiến độ nề nếp'),
        bullet('9. Quản lý Ban Nề Nếp & Phân công trực cờ đỏ (Task Force)'),
        bullet('10. Nhật ký thao tác hệ thống (Audit Log)'),
        bullet('11. Xử lý các tình huống thường gặp & Thông tin hỗ trợ kỹ thuật'),
        pageBreak,

        // ── PHẦN 1 ──────────────────────────────────────────────────────────
        heading1('1. Đăng nhập lần đầu & Cơ chế bảo mật'),
        p('Hệ thống Nền Nếp ứng dụng cơ chế xác thực đám mây trực tiếp qua tài khoản Google. Điểm ưu việt tuyệt đối: KHÔNG CÓ MẬT KHẨU RIÊNG, KHÔNG LO QUÊN MẬT KHẨU, BẢO MẬT TUYỆT ĐỐI.'),
        space,
        heading2('1.1. Các bước đăng nhập cho cán bộ / giáo viên / học sinh'),
        step(1, 'Truy cập vào tên miền của nhà trường', 'Ví dụ: https://thptnguyendu.nennep.pro.vn hoặc https://thptchuyenlaocai.nennep.pro.vn.'),
        step(2, 'Quan sát giao diện khách', 'Khi chưa đăng nhập, người dùng (phụ huynh, học sinh) vẫn xem được trang Tổng quan, Tra cứu và Bảng xếp hạng công khai.'),
        step(3, 'Bấm nút "Đăng nhập"', 'Nằm ở góc phải trên cùng của thanh tiêu đề.'),
        step(4, 'Chọn tài khoản Google', 'Hộp thoại Google xuất hiện, chọn đúng địa chỉ email mà nhà trường đã được cấp quyền.'),
        step(5, 'Vào hệ thống làm việc', 'Hệ thống tự động nhận diện vai trò và mở đúng các tính năng tương ứng.'),
        space,
        noteBox('Nếu xuất hiện thông báo "Địa chỉ email chưa được cấp quyền truy cập": Nghĩa là email này chưa được thêm vào danh sách quản trị của trường. Hãy liên hệ Quản trị viên nhà trường để được cấp quyền, chú ý cung cấp CHÍNH XÁC địa chỉ email Google đang dùng.', 'warn', 'LƯU Ý TRUY CẬP'),
        pageBreak,

        // ── PHẦN 2 ──────────────────────────────────────────────────────────
        heading1('2. Cấp quyền truy cập & Bảng phân quyền 8 vai trò'),
        p('Chỉ tài khoản giữ vai trò Quản trị viên (Admin) mới có quyền truy cập vào mục Cấu hình → Tài khoản để phân quyền cho các thành viên trong trường.'),
        space,
        heading2('2.1. Cấp quyền cho từng cá nhân'),
        step(1, 'Vào Cấu hình → Tài khoản (mục "Ai được vào hệ thống").'),
        step(2, 'Nhập Họ tên đầy đủ và Địa chỉ email Google của người được cấp.'),
        step(3, 'Chọn Vai trò phù hợp và Lớp phụ trách (nếu là Cờ đỏ hoặc GVCN).'),
        step(4, 'Bấm nút dấu cộng (+) màu xanh. Tài khoản có hiệu lực ngay lập tức mà không cần gửi thư xác nhận.'),
        space,
        heading2('2.2. Nhập danh sách tài khoản hàng loạt bằng Excel'),
        step(1, 'Bấm nút "Tải mẫu" để tải về file Excel chuẩn.'),
        step(2, 'Điền danh sách gồm 4 cột: Ho_ten, Email_Google, Lop, Vai_tro.'),
        step(3, 'Bấm "Nhập Excel", hệ thống sẽ quét và nạp tối đa 200 tài khoản mỗi lượt.'),
        space,
        heading2('2.3. Ý nghĩa các trạng thái tài khoản & Thao tác quản trị'),
        bullet('Trạng thái ĐANG DÙNG: Cán bộ đã đăng nhập thành công ít nhất một lần.', '●'),
        bullet('Trạng thái CHƯA VÀO LẦN NÀO: Đã cấp quyền nhưng cán bộ chưa đăng nhập (cần nhắc nhở hoặc kiểm tra lại chính tả email).', '●'),
        bullet('Nút Khoá 🔒: Tạm ngưng quyền truy cập nhưng GIỮ NGUYÊN toàn bộ lịch sử vi phạm/khen thưởng do người đó đã ghi.', '●'),
        bullet('Nút Bút ✏️: Đổi vai trò hoặc lớp phụ trách. Có hiệu lực ngay lập tức.', '●'),
        bullet('Nút Thùng rác 🗑️: Thu hồi quyền vĩnh viễn (chỉ cho phép khi người này chưa từng ghi bản ghi nào).', '●'),
        space,
        heading2('2.4. Bảng ma trận 12 quyền hạn chi tiết của 8 vai trò mặc định'),
        p('Dưới đây là bảng phân quyền chuẩn được thiết lập sẵn khi bàn giao:'),
        space,
        createPermissionMatrixTable(),
        pageBreak,

        // ── PHẦN 3 ──────────────────────────────────────────────────────────
        heading1('3. Thiết lập danh mục ban đầu (Bắt buộc)'),
        p('Khi bắt đầu năm học mới hoặc tiếp nhận hệ thống, Đoàn trường cần thực hiện thiết lập danh mục theo ĐÚNG 6 BƯỚC TUẦN TỰ sau đây để tránh phải nhập lại dữ liệu:'),
        space,
        heading2('Bước 1: Cấu hình Thương hiệu nhà trường'),
        step(1, 'Vào Cấu hình → Thương hiệu.'),
        step(2, 'Nhập Tên đầy đủ của trường (ví dụ: Trường THPT Nguyễn Du), Tên rút gọn (hiện trên thanh tiêu đề), Khẩu hiệu năm học.'),
        step(3, 'Tải lên Logo nhà trường (file ảnh PNG/JPG vuông, nền trong suốt, dưới 2MB).'),
        step(4, 'Bấm "Lưu thương hiệu". Toàn bộ hệ thống sẽ cập nhật nhận diện ngay lập tức.'),
        space,
        heading2('Bước 2: Tạo danh sách Lớp học'),
        step(1, 'Vào Cấu hình → Lớp học.'),
        step(2, 'Bấm "Tải mẫu" để lấy file Excel chuẩn gồm 2 cột: Ten_lop và Giao_vien_chu_nhiem.'),
        step(3, 'Điền danh sách lớp (ví dụ: 10A1, 10A2, 11B1, 12C3...).'),
        step(4, 'Bấm "Nhập Excel", sau đó bấm "Lưu Thay Đổi" ở góc dưới bên phải màn hình.'),
        space,
        noteBox('Mã lớp học là định danh cốt lõi. Tên lớp phải thống nhất tuyệt đối giữa danh mục Lớp và danh sách Học sinh nhập ở bước sau.', 'warn', 'QUY TẮC ĐỒNG BỘ MÃ LỚP'),
        space,
        heading2('Bước 3: Nhập danh sách Học sinh toàn trường'),
        step(1, 'Vào Cấu hình → Học sinh.'),
        step(2, 'Bấm "Tải mẫu" để lấy file Excel gồm 3 cột: Ten_lop, Ho_ten_HS, So_xe (Biển số xe đạp/xe máy nếu trường có quản lý nề nếp gửi xe).'),
        step(3, 'Bấm "Nhập Excel", hệ thống sẽ tự động ghép học sinh vào từng lớp tương ứng.'),
        step(4, 'Kiểm tra thông báo số lượng học sinh thành công, sau đó bấm "Lưu Thay Đổi".'),
        space,
        heading2('Bước 4: Thiết lập Mốc thời gian (Tuần / Tháng / Học kỳ)'),
        step(1, 'Vào Cấu hình → Thời gian. Bước này QUAN TRỌNG NHẤT để hệ thống tính điểm xếp hạng.'),
        step(2, 'Bấm "Tải mẫu" để lấy file Excel 100 dòng mốc thời gian.'),
        step(3, 'Khai báo các cột: Ten (ví dụ "Tuần 1", "Tuần 2", "Học kỳ I"), Loai (WEEK / MONTH / SEMESTER), Ngay_bat_dau (YYYY-MM-DD), Ngay_ket_thuc (YYYY-MM-DD).'),
        step(4, 'Bấm "Nhập Excel" và bấm "Lưu Thay Đổi".'),
        space,
        heading2('Bước 5: Cấu hình Tiêu chí lỗi vi phạm & Điểm trừ'),
        step(1, 'Vào Cấu hình → Lỗi vi phạm.'),
        step(2, 'Bấm "Tải mẫu" lấy file Excel gồm 2 cột: Noi_dung_loi và Diem.'),
        step(3, 'Điền danh mục các lỗi (ví dụ: "Đi học muộn" — 5đ, "Không mặc đồng phục" — 2đ, "Sử dụng điện thoại trong giờ" — 10đ...). Điểm nhập số dương, hệ thống tự động trừ.'),
        step(4, 'Bấm "Nhập Excel" và bấm "Lưu Thay Đổi".'),
        space,
        heading2('Bước 6: Thiết lập Quy định chung & Bảng điểm thưởng'),
        step(1, 'Vào Cấu hình → Quy định.'),
        step(2, 'Điểm khởi đầu mỗi tuần: Mặc định là 500 điểm (tuỳ trường có thể đặt 1000 hoặc 100).'),
        step(3, 'Hệ số Học kỳ II: Mặc định là 1 (nếu trường có quy định học kỳ 2 nhân đôi thì đặt là 2).'),
        step(4, 'Bắt buộc ảnh minh chứng: Bật ON để yêu cầu cờ đỏ bắt buộc phải chụp ảnh khi chấm vi phạm.'),
        step(5, 'Chuyển sang tab Cấu hình → Điểm thưởng: Nhập ma trận điểm cho các Giải (Nhất, Nhì, Ba, Khuyến khích) tương ứng với từng Cấp độ (Cấp Trường, Cấp Huyện/TP, Cấp Tỉnh, Cấp Quốc gia). Ba danh mục Giải thưởng, Cấp độ và Nhóm hoạt động cũng khai ngay tại tab này.'),
        pageBreak,

        // ── PHẦN 4 ──────────────────────────────────────────────────────────
        heading1('4. Ghi nhận vi phạm hằng ngày (Nhập Lỗi)'),
        p('Màn hình làm việc hằng ngày của Đội Cờ đỏ, Ban Nề nếp và Cán bộ Đoàn trực tuần.'),
        space,
        heading2('4.1. Quy trình chấm lỗi chuẩn 7 bước'),
        step(1, 'Vào tab Nhập Lỗi, chọn chế độ "Nhập Vi Phạm".'),
        step(2, 'Chọn Ngày ghi nhận vi phạm (mặc định là ngày hôm nay).'),
        step(3, 'Chọn Khối → Chọn Lớp học vi phạm.'),
        step(4, 'Chọn Đối tượng: Chọn "Cá nhân" (rồi chọn tên học sinh) hoặc chọn "Tập thể lớp" (nếu là lỗi cả lớp như vệ sinh, trật tự, trực nhật).'),
        step(5, 'Chọn Nội dung lỗi vi phạm: Điểm trừ sẽ tự động nhảy theo đúng tiêu chí đã cài đặt.'),
        step(6, 'Tải ảnh minh chứng: Chụp trực tiếp bằng điện thoại hoặc tải ảnh từ thư viện máy.'),
        step(7, 'Ghi chú chi tiết (nếu có) và bấm nút "LƯU VI PHẠM".'),
        space,
        noteBox('Cơ chế giữ nguyên form thông minh: Sau khi bấm Lưu thành công, thông tin ngày và lớp vẫn được giữ nguyên để cán bộ tiếp tục chọn nhanh lỗi thứ hai của cùng học sinh đó mà không phải chọn lại từ đầu.', 'ok', 'MẸO NHẬP NHANH'),
        space,
        noteBox('Nếu ngày chọn rơi ra ngoài tất cả các Tuần đã cấu hình, hệ thống sẽ hiện cảnh báo viền vàng "Bản ghi ngoài cấu hình". Bản ghi vẫn được lưu nhưng sẽ KHÔNG TÍNH ĐIỂM vào tuần nào cho đến khi Quản trị viên bổ sung mốc thời gian.', 'warn', 'CẢNH BÁO MỐC THỜI GIAN'),
        pageBreak,

        // ── PHẦN 5 ──────────────────────────────────────────────────────────
        heading1('5. Ghi nhận khen thưởng theo hoạt động'),
        p('Áp dụng khi nhà trường tổ chức các phong trào thi đua tập trung như Hội diễn văn nghệ 20/11, Hội khoẻ Phù Đổng, Hội trại 26/3, Cuộc thi KHKT... nơi có nhiều lớp cùng đạt giải.'),
        space,
        heading2('5.1. Quy trình nhập điểm thưởng hàng loạt cho nhiều lớp'),
        step(1, 'Vào tab Nhập Lỗi, chuyển sang chế độ "Nhập Thành Tích".'),
        step(2, 'Nhập Tên hoạt động (ví dụ: "Hội thao Chào mừng 20/11"). Gõ vài chữ hệ thống sẽ gợi ý tên hoạt động cũ.'),
        step(3, 'Chọn Nhóm hoạt động (Học tập / Văn thể mỹ / Hoạt động Đoàn / Phong trào khác) và Cấp độ tổ chức.'),
        step(4, 'Chọn Ngày và tải lên Ảnh minh chứng trao giải (1 ảnh dùng chung cho tất cả các lớp).'),
        step(5, 'Ở bảng danh sách lớp đạt giải bên dưới: Bấm "Thêm dòng", chọn Lớp và chọn Giải thưởng (Nhất/Nhì/Ba/Khuyến khích). Số điểm chuẩn (viền xanh) sẽ tự động hiển thị từ ma trận đã khai ở tab Cấu hình → Điểm thưởng.'),
        step(6, 'Bấm nút "LƯU TOÀN BỘ THÀNH TÍCH". Toàn bộ các lớp sẽ được cộng điểm cùng lúc.'),
        space,
        noteBox('Điểm khen thưởng là điểm CỘNG (+) trực tiếp vào quỹ điểm tuần của lớp. Học sinh cờ đỏ không có quyền nhập mục này nhằm bảo đảm tính khách quan và nghiêm túc.', 'info', 'PHÂN QUYỀN ĐIỂM THƯỞNG'),
        pageBreak,

        // ── PHẦN 6 ──────────────────────────────────────────────────────────
        heading1('6. Tra cứu, Sửa, Xoá & Công cụ kiểm duyệt'),
        p('Màn hình Tra Cứu (ListTab) cung cấp bức tranh toàn cảnh về mọi biên bản nề nếp đã ghi nhận trong toàn trường, hỗ trợ đối chiếu minh bạch.'),
        space,
        heading2('6.1. Các bộ lọc thông minh'),
        bullet('Lọc theo Mốc thời gian: Xem nhanh theo Tuần cụ thể, Tháng hoặc cả Học kỳ.', '🔍'),
        bullet('Lọc theo Lớp: Xem riêng biên bản của một lớp hoặc xem toàn trường.', '🔍'),
        bullet('Lọc theo Loại: Tách riêng danh sách Vi phạm (trừ điểm) hoặc Thành tích (cộng điểm).', '🔍'),
        bullet('Ô tìm kiếm tức thì: Gõ tên học sinh, tên lớp, biển số xe, nội dung lỗi hoặc người lập biên bản.', '🔍'),
        space,
        heading2('6.2. Sửa và Xoá bản ghi'),
        step(1, 'Sửa bản ghi: Bấm biểu tượng Cây bút (✏️) ở dòng tương ứng để sửa lại ngày, đổi tên học sinh, chỉnh điểm số hoặc thay ảnh minh chứng. Điểm thi đua của lớp sẽ tự động tính lại ngay lập tức.'),
        step(2, 'Xoá bản ghi: Bấm biểu tượng Thùng rác (🗑️) để xoá. Hệ thống sẽ lưu lại thông tin bản ghi đã xoá vào Nhật ký hệ thống (Audit Log) để phục vụ đối chiếu khi có khiếu nại.'),
        step(3, 'Xoá hàng loạt: Tích chọn ô vuông ở đầu các dòng cần xoá và bấm nút "Xoá đã chọn" trên thanh công cụ màu đỏ.'),
        space,
        heading2('6.3. Hai công cụ kiểm duyệt dành cho Quản trị viên'),
        bullet('Công cụ "Lọc Trùng Lặp": Tự động quét và hiển thị các bản ghi có cùng học sinh, cùng lỗi trong cùng một ngày (do 2 cờ đỏ cùng chấm nhầm) để cán bộ xoá bản ghi thừa.', '⚡'),
        bullet('Công cụ "Ngoài Cấu Hình": Hiển thị các bản ghi có ngày không thuộc tuần nào, giúp Quản trị viên phát hiện lỗi nhập sai ngày.', '⚡'),
        bullet('Nút "Xuất Excel": Xuất toàn bộ dữ liệu đang xem ra file Excel để in ấn, báo cáo Ban Giám Hiệu.', '⚡'),
        pageBreak,

        // ── PHẦN 7 ──────────────────────────────────────────────────────────
        heading1('7. Tổng quan, Xếp hạng thi đua & Xuất báo cáo'),
        p('Hệ thống tự động hóa hoàn toàn việc tính điểm thi đua theo công thức chuẩn: Điểm tổng kết = Điểm khởi đầu (500đ) − Tổng điểm trừ vi phạm + Tổng điểm thưởng thành tích.'),
        space,
        heading2('7.1. Bảng xếp hạng thi đua tuần / tháng / học kỳ'),
        bullet('Tự động xếp thứ hạng từ cao xuống thấp theo từng Khối (Khối 10, Khối 11, Khối 12).', '📊'),
        bullet('Hỗ trợ gắn Cờ thi đua / Huy hiệu cho Lớp Xuất sắc Nhất tuần, Nhì tuần, Ba tuần.', '📊'),
        bullet('Chế độ xem Học kỳ II tự động áp dụng Hệ số nhân (2x) nếu trường có cài đặt.', '📊'),
        space,
        heading2('7.2. Xuất Báo cáo Thi đua Tuần ra file Word (.docx)'),
        p('Đây là tính năng độc quyền giúp Bí thư Đoàn trường không phải mất hàng giờ tổng hợp biên bản giấy mỗi tối Chủ Nhật:'),
        step(1, 'Trong tab Xếp Hạng, chọn chế độ "Theo Tuần" và chọn Tuần cần báo cáo.'),
        step(2, 'Bấm nút "TẢI BÁO CÁO TUẦN" (màu xanh lá).'),
        step(3, 'Hệ thống tự động sinh ra một file Word (.docx) chuẩn thể thức văn bản hành chính của Bộ GD&ĐT gồm:'),
        bullet('Phần 1: Nhận xét Đánh giá chung (Ưu điểm, Tồn tại, Đề xuất tuần tới).', '  -'),
        bullet('Phần 2: Bảng tổng hợp chi tiết các lỗi vi phạm theo từng tiêu chí.', '  -'),
        bullet('Phần 3: Bảng xếp hạng thi đua chi tiết kèm điểm số và thứ hạng của từng lớp theo từng khối.', '  -'),
        bullet('Phần 4: Chỗ ký tên của Bí thư Đoàn trường và phê duyệt của Hiệu trưởng.', '  -'),
        pageBreak,

        // ── PHẦN 8 ──────────────────────────────────────────────────────────
        heading1('8. Xem chi tiết hồ sơ lớp (Class Profile)'),
        p('Mỗi lớp học có một trang hồ sơ riêng biệt giúp Giáo viên chủ nhiệm và Ban cán sự lớp nắm bắt tình hình nền nếp của lớp mình.'),
        space,
        heading2('8.1. Các thông tin trong Hồ sơ lớp'),
        bullet('Điểm thi đua hiện tại và Thứ hạng của lớp so với các lớp cùng khối.', '📌'),
        bullet('Biểu đồ diễn biến điểm số qua từng tuần trong học kỳ (nhận diện tuần nào lớp tiến bộ, tuần nào giảm sút).', '📌'),
        bullet('Danh sách học sinh hay vi phạm nhiều nhất trong lớp để GVCN có biện pháp giáo dục kịp thời.', '📌'),
        bullet('Lịch sử toàn bộ biên bản vi phạm và khen thưởng của riêng lớp đó kèm ảnh minh chứng.', '📌'),
        pageBreak,

        // ── PHẦN 9 ──────────────────────────────────────────────────────────
        heading1('9. Ban Nề Nếp & Phân công trực cờ đỏ (Task Force)'),
        p('Phân hệ dành riêng cho Ban Thường vụ Đoàn trường để quản lý lực lượng chấm chéo nề nếp.'),
        space,
        heading2('9.1. Quản lý và theo dõi Đội Cờ đỏ'),
        bullet('Danh sách thành viên Ban Nề nếp / Cờ đỏ kèm theo Lớp học sinh đang học và Lớp được phân công trực.', '🛡️'),
        bullet('Thống kê số lượng biên bản vi phạm do từng cờ đỏ đã chấm trong tuần/tháng nhằm đánh giá mức độ tích cực và trách nhiệm của từng em.', '🛡️'),
        bullet('Phân công lại lớp trực tuần nhanh chóng bằng cách đổi Lớp phụ trách trong mục Tài khoản.', '🛡️'),
        pageBreak,

        // ── PHẦN 10 ─────────────────────────────────────────────────────────
        heading1('10. Nhật ký thao tác hệ thống (Audit Log)'),
        p('Nhật ký hệ thống (Vào Cấu hình → Log) là công cụ bảo vệ tính toàn vẹn và chống tiêu cực trong công tác thi đua.'),
        space,
        heading2('10.1. Các hành vi được hệ thống ghi vết tự động'),
        bullet('Ai đã xoá một bản ghi vi phạm (Lưu lại ảnh chụp nguyên trạng bản ghi trước khi bị xoá).', '📝'),
        bullet('Ai đã chỉnh sửa tiêu chí, sửa mốc thời gian hoặc đổi điểm số.', '📝'),
        bullet('Ai đã cấp quyền, đổi vai trò hoặc khoá tài khoản của cán bộ khác.', '📝'),
        bullet('Thời gian thực hiện chính xác đến từng giây và địa chỉ email của người thực hiện.', '📝'),
        space,
        noteBox('Nhật ký hệ thống chỉ có quyền đọc (Read-only), không ai (kể cả Quản trị viên) có thể chỉnh sửa hay xoá lịch sử log. Điều này bảo đảm tuyệt đối tính minh bạch cho nhà trường.', 'ok', 'TÍNH TOÀN VẸN LOG'),
        pageBreak,

        // ── PHẦN 11 ─────────────────────────────────────────────────────────
        heading1('11. Xử lý sự cố thường gặp & Hỗ trợ kỹ thuật'),
        p('Bảng tổng hợp các tình huống hay gặp trong thực tế và cách xử lý nhanh chóng:'),
        space,
        createTroubleshootingTable(),
        space,
        space,
        heading2('Kênh hỗ trợ kỹ thuật trực tiếp từ Đơn vị phát triển'),
        p('Khi gặp các vấn đề kỹ thuật chuyên sâu hoặc cần mở rộng tính năng, quý Thầy/Cô vui lòng liên hệ:'),
        space,
        p('CÔNG TY TNHH GIÁO DỤC 2ANH AI', { align: AlignmentType.CENTER, bold: true, size: 28, color: 'B91C1C' }),
        p('Đại diện kỹ thuật: Thầy Lương Hải Anh', { align: AlignmentType.CENTER, bold: true }),
        p('Hotline / Zalo hỗ trợ 24/7: 0352 071 197 (Ưu tiên)', { align: AlignmentType.CENTER, bold: true, color: '16A34A' }),
        p('Email tiếp nhận: lienhe@2anhaiedu.vn · luonghaianh1208@gmail.com', { align: AlignmentType.CENTER }),
        p('Cổng thông tin giải pháp: https://nennep.pro.vn', { align: AlignmentType.CENTER, italics: true, color: '2563EB' }),
        space,
        noteBox('Khi liên hệ hỗ trợ, Thầy/Cô vui lòng gửi kèm: Tên trường, Đường link web trường đang truy cập, và Ảnh chụp màn hình lỗi để được xử lý nhanh nhất.', 'info', 'LƯU Ý KHI GỌI KỸ THUẬT'),
        space,
        space,
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '— HẾT TÀI LIỆU HƯỚNG DẪN BÀN GIAO —', font: FONT, size: SZ_BODY, bold: true, italics: true, color: '64748B' }),
          ],
        }),
      ],
    },
  ],
});

// ── XUẤT FILE WORD (.DOCX) ───────────────────────────────────────────────────

const outPath = join(process.cwd(), 'HuongDan_SuDung_NenNep.docx');
Packer.toBuffer(doc).then((buf) => {
  writeFileSync(outPath, buf);
  console.log('🎉 ĐÃ XUẤT THÀNH CÔNG FILE WORD HƯỚNG DẪN TOÀN DIỆN:');
  console.log('   -> Đường dẫn:', outPath);
  console.log('   -> Dung lượng:', (buf.length / 1024).toFixed(1), 'KB');
});
