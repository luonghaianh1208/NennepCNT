/**
 * Sinh file hợp đồng mẫu (.docx) để ký kết chuyển giao hệ thống cho trường mới.
 *
 * Chạy: pnpm tsx scripts/generate-contract.ts
 * Kết quả: HopDong_Mau_ChuyenGiao_NenNep.docx ở thư mục gốc dự án
 */
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, TabStopType,
} from 'docx';
import { writeFileSync } from 'fs';
import { join } from 'path';

const FONT = 'Times New Roman';
const SIZE = 26; // 13pt — cỡ chữ văn bản hành chính

const p = (text: string, opts: any = {}) =>
  new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 120, line: 300 },
    indent: opts.indent,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? SIZE,
        bold: opts.bold,
        italics: opts.italics,
        allCaps: opts.caps,
      }),
    ],
  });

const dieu = (so: string, ten: string) =>
  new Paragraph({
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text: `Điều ${so}. ${ten}`, font: FONT, size: SIZE, bold: true })],
  });

const gach = (text: string) => p(text, { indent: { left: 340 } });

/** Bảng chữ ký ba bên: hai bên hợp đồng và đại diện kỹ thuật */
const oChuKy = (tieuDe: string, ghiChu: string) =>
  new TableCell({
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children: [
      p(tieuDe, { align: AlignmentType.CENTER, bold: true, after: 40 }),
      p(ghiChu, { align: AlignmentType.CENTER, italics: true, size: 22, after: 1400 }),
      p('..............................................', { align: AlignmentType.CENTER, after: 0 }),
    ],
  });

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
  sections: [
    {
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1417, right: 992 } } },
      children: [
        // ── Quốc hiệu ─────────────────────────────────────────────────────
        p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: AlignmentType.CENTER, bold: true, after: 40 }),
        p('Độc lập – Tự do – Hạnh phúc', { align: AlignmentType.CENTER, bold: true, after: 40 }),
        p('------------------------', { align: AlignmentType.CENTER, after: 320 }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: 'HỢP ĐỒNG CHUYỂN GIAO VÀ CUNG CẤP DỊCH VỤ', font: FONT, size: 32, bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: 'HỆ THỐNG QUẢN LÝ NỀN NẾP HỌC SINH', font: FONT, size: 32, bold: true })],
        }),
        p('Số: ......../2026/HĐCG-NN', { align: AlignmentType.CENTER, italics: true, after: 280 }),

        // ── Căn cứ ────────────────────────────────────────────────────────
        p('Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24 tháng 11 năm 2015;', { italics: true, after: 60 }),
        p('Căn cứ Luật Công nghệ thông tin số 67/2006/QH11 ngày 29 tháng 6 năm 2006;', { italics: true, after: 60 }),
        p('Căn cứ Luật Sở hữu trí tuệ và các văn bản sửa đổi, bổ sung;', { italics: true, after: 60 }),
        p('Căn cứ Nghị định số 13/2023/NĐ-CP ngày 17 tháng 4 năm 2023 về bảo vệ dữ liệu cá nhân;', { italics: true, after: 60 }),
        p('Căn cứ nhu cầu và khả năng của hai bên,', { italics: true, after: 200 }),

        p('Hôm nay, ngày ...... tháng ...... năm 20......, tại ................................................................, chúng tôi gồm:', { after: 240 }),

        // ── Bên A ─────────────────────────────────────────────────────────
        p('BÊN A – BÊN CHUYỂN GIAO', { bold: true, after: 80 }),
        p('Đoàn TNCS Hồ Chí Minh Trường THPT Chuyên Nguyễn Trãi', { bold: true, after: 60 }),
        p('Địa chỉ: .................................................................................................................'),
        p('Người đại diện: ................................................  Chức vụ: ..............................................'),
        p('Điện thoại: ....................................  Thư điện tử: .......................................................'),
        p('Đại diện kỹ thuật (tác giả phần mềm): Ông Lương Hải Anh – 2Anh AI Education'),
        p('Điện thoại: 0328 186 264   ·   Thư điện tử: luonghaianh1208@gmail.com', { after: 200 }),

        // ── Bên B ─────────────────────────────────────────────────────────
        p('BÊN B – BÊN TIẾP NHẬN', { bold: true, after: 80 }),
        p('Đoàn TNCS Hồ Chí Minh Trường THPT ...........................................................', { bold: true, after: 60 }),
        p('Địa chỉ: .................................................................................................................'),
        p('Người đại diện: ................................................  Chức vụ: ..............................................'),
        p('Điện thoại: ....................................  Thư điện tử: .......................................................', { after: 200 }),

        p('Hai bên thống nhất ký kết hợp đồng với các điều khoản sau:', { after: 120 }),

        // ── Các điều khoản ────────────────────────────────────────────────
        dieu('1', 'Nội dung hợp đồng'),
        p('1.1. Bên A chuyển giao cho Bên B quyền sử dụng Hệ thống Quản lý Nền nếp học sinh (sau đây gọi là “Hệ thống”) dưới hình thức một bản triển khai riêng, mang thương hiệu của Bên B, dữ liệu độc lập với các đơn vị khác.'),
        p('1.2. Bên A cung cấp dịch vụ triển khai, đào tạo sử dụng, vận hành hạ tầng và hỗ trợ kỹ thuật trong suốt thời hạn hợp đồng.'),
        p('1.3. Hợp đồng này chuyển giao quyền sử dụng, KHÔNG chuyển giao quyền sở hữu phần mềm, mã nguồn hay quyền tác giả đối với Hệ thống.'),

        dieu('2', 'Phạm vi công việc'),
        p('Bên A thực hiện các nội dung sau:'),
        gach('a) Khảo sát nhu cầu: cơ cấu lớp, bộ tiêu chí nền nếp, mẫu báo cáo và danh sách tài khoản của Bên B.'),
        gach('b) Dựng hệ thống riêng cho Bên B, gắn tên trường, logo và địa chỉ truy cập riêng.'),
        gach('c) Nhập dữ liệu nền: danh sách lớp, học sinh, bộ tiêu chí, mốc thời gian năm học.'),
        gach('d) Cấp tài khoản quản trị và tài khoản người dùng theo phân quyền do Bên B đề nghị.'),
        gach('đ) Đào tạo sử dụng cho cán bộ phụ trách: tối thiểu 01 buổi, có tài liệu hướng dẫn kèm theo.'),
        gach('e) Vận hành hạ tầng, sao lưu dữ liệu định kỳ và cập nhật phiên bản trong thời hạn hợp đồng.'),
        gach('g) Hỗ trợ kỹ thuật qua điện thoại, thư điện tử hoặc ứng dụng nhắn tin trong giờ hành chính.'),

        dieu('3', 'Giá trị hợp đồng và phương thức thanh toán'),
        p('3.1. Phí triển khai ban đầu (một lần): ............................................ đồng.'),
        p('3.2. Phí duy trì hệ thống: ............................................ đồng/năm, đã bao gồm chi phí hạ tầng, sao lưu, cập nhật phiên bản và hỗ trợ kỹ thuật.'),
        p('3.3. Ưu đãi áp dụng cho Bên B (nếu có): chiết khấu ............ % theo chính sách dành cho đơn vị đăng ký sớm hoặc ký hợp đồng nhiều năm. Trường hợp ký từ 03 năm trở lên, mức phí duy trì được giữ nguyên trong suốt thời hạn hợp đồng.'),
        p('3.4. Phương thức thanh toán: chuyển khoản hoặc tiền mặt, chia làm ...... đợt:'),
        gach('Đợt 1: ......% giá trị hợp đồng, trong vòng ...... ngày kể từ ngày ký.'),
        gach('Đợt 2: ......% giá trị còn lại, sau khi nghiệm thu và bàn giao.'),
        p('3.5. Các khoản phí trên chưa bao gồm chi phí phát sinh do Bên B yêu cầu chỉnh sửa ngoài phạm vi tại Điều 2; nếu có, hai bên thỏa thuận bằng phụ lục hợp đồng.'),

        dieu('4', 'Quyền và nghĩa vụ của Bên A'),
        p('4.1. Bàn giao Hệ thống đúng phạm vi, đúng tiến độ đã thống nhất.'),
        p('4.2. Bảo đảm Hệ thống hoạt động ổn định; khắc phục sự cố kỹ thuật trong thời gian sớm nhất, tối đa 24 giờ làm việc kể từ khi nhận được thông báo đối với lỗi làm gián đoạn sử dụng.'),
        p('4.3. Chịu toàn bộ chi phí hạ tầng vận hành Hệ thống trong thời hạn hợp đồng.'),
        p('4.4. Bảo mật dữ liệu của Bên B; không sử dụng dữ liệu học sinh vào bất kỳ mục đích nào khác ngoài việc vận hành Hệ thống cho Bên B.'),
        p('4.5. Được quyền tạm ngừng cung cấp dịch vụ nếu Bên B vi phạm nghĩa vụ thanh toán hoặc vi phạm quy định về bản quyền tại Điều 6, sau khi đã thông báo bằng văn bản trước tối thiểu 15 ngày.'),

        dieu('5', 'Quyền và nghĩa vụ của Bên B'),
        p('5.1. Cung cấp đầy đủ, kịp thời và chính xác dữ liệu nền và thông tin cần thiết cho việc triển khai.'),
        p('5.2. Cử cán bộ đầu mối phối hợp trong quá trình triển khai, đào tạo và vận hành.'),
        p('5.3. Thanh toán đầy đủ, đúng hạn theo Điều 3.'),
        p('5.4. Quản lý tài khoản được cấp; chịu trách nhiệm về nội dung dữ liệu do người dùng của mình nhập vào Hệ thống.'),
        p('5.5. Được toàn quyền sở hữu đối với dữ liệu của nhà trường; được yêu cầu xuất toàn bộ dữ liệu bất kỳ lúc nào.'),

        dieu('6', 'Quyền sở hữu trí tuệ và bản quyền'),
        p('6.1. Toàn bộ mã nguồn, thiết kế, tài liệu và thương hiệu “Nền Nếp” thuộc quyền sở hữu của tác giả – 2Anh AI Education.'),
        p('6.2. Bên B không được sao chép, phân phối, cho thuê, chuyển nhượng quyền sử dụng cho bên thứ ba; không dịch ngược, phân tích hoặc can thiệp vào mã nguồn của Hệ thống.'),
        p('6.3. Bên B không được gỡ bỏ, che khuất hoặc thay đổi các thông tin về bản quyền, tác giả hiển thị trên Hệ thống và tài liệu kèm theo.'),
        p('6.4. Vi phạm khoản 6.2 hoặc 6.3 dẫn tới chấm dứt hợp đồng ngay lập tức; bên vi phạm bồi thường thiệt hại theo quy định pháp luật.'),

        dieu('7', 'Dữ liệu và bảo vệ thông tin cá nhân'),
        p('7.1. Dữ liệu học sinh, giáo viên và toàn bộ dữ liệu nghiệp vụ phát sinh thuộc quyền sở hữu của Bên B. Bên A là bên xử lý dữ liệu theo ủy quyền của Bên B.'),
        p('7.2. Hai bên tuân thủ quy định pháp luật về bảo vệ dữ liệu cá nhân, đặc biệt đối với dữ liệu của người chưa thành niên.'),
        p('7.3. Bên A sao lưu dữ liệu định kỳ và bàn giao bản sao lưu cho Bên B khi có yêu cầu.'),
        p('7.4. Khi hợp đồng chấm dứt, Bên A bàn giao toàn bộ dữ liệu cho Bên B dưới định dạng có thể sử dụng lại (Excel hoặc tương đương) và xóa dữ liệu khỏi hệ thống của mình trong vòng 30 ngày, trừ trường hợp Bên B có yêu cầu khác bằng văn bản.'),

        dieu('8', 'Thời hạn hợp đồng'),
        p('8.1. Hợp đồng có hiệu lực từ ngày ...... tháng ...... năm 20...... đến ngày ...... tháng ...... năm 20......'),
        p('8.2. Trước khi hết hạn 30 ngày, hai bên thống nhất việc gia hạn. Nếu không có ý kiến khác bằng văn bản, hợp đồng được gia hạn thêm một năm với các điều khoản tương tự.'),

        dieu('9', 'Nghiệm thu và bảo hành'),
        p('9.1. Việc nghiệm thu được thực hiện sau khi Hệ thống vận hành đầy đủ các chức năng theo Điều 2 và Bên B đã được đào tạo sử dụng.'),
        p('9.2. Bên A bảo hành và sửa lỗi phần mềm miễn phí trong suốt thời hạn hợp đồng.'),
        p('9.3. Các yêu cầu bổ sung tính năng mới ngoài phạm vi hợp đồng được hai bên thỏa thuận riêng.'),

        dieu('10', 'Chấm dứt hợp đồng'),
        p('10.1. Hợp đồng chấm dứt khi hết thời hạn mà không gia hạn; hoặc theo thỏa thuận bằng văn bản của hai bên.'),
        p('10.2. Một bên được đơn phương chấm dứt nếu bên kia vi phạm nghiêm trọng nghĩa vụ hợp đồng và không khắc phục trong vòng 30 ngày kể từ khi nhận được thông báo bằng văn bản.'),
        p('10.3. Khi chấm dứt, hai bên thực hiện nghĩa vụ tại khoản 7.4 và quyết toán các khoản đã phát sinh.'),

        dieu('11', 'Điều khoản chung'),
        p('11.1. Hai bên cam kết thực hiện đúng các điều khoản đã ký; mọi thay đổi phải được lập thành phụ lục có chữ ký của hai bên.'),
        p('11.2. Tranh chấp phát sinh được giải quyết trước hết bằng thương lượng; nếu không đạt kết quả, đưa ra Tòa án có thẩm quyền giải quyết theo quy định pháp luật.'),
        p('11.3. Hợp đồng gồm ...... trang, được lập thành 04 bản có giá trị pháp lý như nhau: Bên A giữ 02 bản, Bên B giữ 02 bản.', { after: 400 }),

        // ── Chữ ký ────────────────────────────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                oChuKy('ĐẠI DIỆN BÊN A', '(Ký, ghi rõ họ tên và đóng dấu)'),
                oChuKy('ĐẠI DIỆN BÊN B', '(Ký, ghi rõ họ tên và đóng dấu)'),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 400 }, children: [] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                oChuKy('ĐẠI DIỆN KỸ THUẬT', 'Lương Hải Anh – 2Anh AI Education'),
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  },
                  children: [p('', { after: 0 })],
                }),
              ],
            }),
          ],
        }),

        p('Ghi chú: Đây là hợp đồng mẫu để hai bên tham khảo và điền thông tin. Trước khi ký chính thức, nên rà soát lại với bộ phận pháp chế hoặc người có chuyên môn pháp lý của nhà trường.',
          { italics: true, size: 20, after: 0 }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  const out = join(process.cwd(), 'HopDong_Mau_ChuyenGiao_NenNep.docx');
  writeFileSync(out, buffer);
  console.log(`✔ Đã tạo hợp đồng mẫu: ${out}`);
  console.log(`  Dung lượng: ${Math.round(buffer.length / 1024)}KB`);
});
