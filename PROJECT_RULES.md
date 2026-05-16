# CÁC QUY TẮC PHÁT TRIỂN DỰ ÁN (PROJECT RULES)

Đây là tài liệu ghi nhận các quy tắc (rules), convention, và định hướng phát triển hiện tại của dự án **Nền Nếp CNT**. Mọi bản cập nhật, sửa lỗi hay tính năng mới đều phải tuân thủ các quy tắc này. Nếu người dùng (User) yêu cầu thêm rule mới, thông tin sẽ được bổ sung trực tiếp vào đây.

## 1. Stack Công Nghệ & UI/UX
- **Frontend Core:** Bắt buộc sử dụng `React.js` + `TypeScript` + `Vite` làm cốt lõi. Giao diện (Styling) hoàn toàn sử dụng `Tailwind CSS`.
- **Theme chủ đạo:** Theo quy chuẩn "Đoàn" (Màu Đỏ, Vàng, sử dụng background gradient `from-red-700 to-red-900`, chữ màu `yellow-300`). Cần giữ nguyên các hiệu ứng animation (vd: sao rơi `star-fall`) đã có để duy trì bản sắc.
- **Không dùng Supabase:** Dự án đã loại bỏ hoàn toàn Supabase. Tuyệt đối không thêm lại các library liên quan đến Supabase vào ứng dụng, mọi logic đều xử lý qua REST API của Google Apps Script.
- **UI Components:** Ưu tiên tái sử dụng các components (như `LoginModal`, `LoadingSpinner`) hoặc hàm hiển thị (như modal hooks trong `ModalContext`) thay vì code lại từ đầu. Thêm `aria-label` và `title` trên các nút bấm để hỗ trợ Accessibily.

## 2. Quy Tắc Gọi API & Tối Ưu Tốc Độ Apps Script (GAS)
- **Batching (Gộp Data):** Google Apps Script có thời gian "Cold Start" (độ trễ khi khởi động script). Do đó, những tác vụ có thể thực thi hàng loạt (vd: `Xoá nhiều`, `Cập nhật nhiều`, `Import file Excel`) **BẮT BUỘC** phải dùng các Endpoint dạng Batch (vd: `batchUpdateViolations`, `batchCreateViolations`). TUYỆT ĐỐI không dùng vòng lặp For trên Client để call N requests.
- **Cache dữ liệu:** Khi tải ứng dụng, chỉ gọi `getAllData` 1 lần duy nhất để mang toàn bộ Sheet data về global state (`AppContext`). Sau đó, mọi tính năng Filter/Tìm kiếm sẽ thao tác trên memory của trình duyệt thay vì fetch liên tục.

## 3. Quy Tắc Bảo Mật & Logic Đăng Nhập
- **Validation Password tại Server:** Chức năng kiểm tra mật khẩu (`verifyLogin`) BẮT BUỘC phải thực hiện trên Server (GAS). Khớp trên Spreadsheet -> trả về Client thông tin User (KHÔNG BAO GỒM CỘT PASSWORD). 
- **Endpoint Data Rỗng Password:** Trong endpoint `getAllData`, MẢNG TÀI KHOẢN TRẢ VỀ CHO CLIENT LÀ `safeUser` => hoàn toàn ĐÃ BỊ LOẠI BỎ field `password`.
- **Khôi phục mật khẩu (Reset Password):** Query dựa trên cột C (Email). Cấp mật khẩu mặc định mới với định dạng `CNT@xxxx` (x là số), sau đó GAS gửi mail (bằng `MailApp.sendEmail`) thông báo tới email tương ứng. Chức năng này không được thay đổi format vì Client yêu cầu cấu trúc bảo mật này.

## 4. Xử Lý Excel & Dữ Liệu Tiếng Việt
- **Xử lý dấu tiếng Việt:** Mọi module import từ Excel (xử lý ở dạng client side với `exceljs` hoặc `xlsx`) CẦN có hàm convert chuỗi tiếng Việt. Đặc biệt, thuật toán phải nhận diện chính xác các từ nhầm dấu (ví dụ: `Hóa` so khớp tương đồng với `Hoá`), dùng Unicode Normalization + chuyển về không dấu khi tiến hành validation text.
- **Phân loại Tiêu chí khi Import:** Khi bulk import, nếu Điểm (Points) là giá trị Dương => lưu vào Sheet `Violations` (Lỗi). Nếu Điểm là giá trị Âm => lưu vào Sheet `Achievements` (Thành tích).

## 5. Quy Tắc Deploy
- Mọi triển khai Web sẽ thực hiện qua Netlify. Build command cố định là `npm run build` hoặc `vite build`. Publish directory là thư mục `dist`. Đảm bảo code chạy không mắc lỗi Lint hay Type Error trước khi Push để Netlify builder không bị crash.

---
_Lưu ý: Bất cứ yêu cầu rule mới nào từ người dùng trong tương lai sẽ quy định thêm vào file này để Agent (hoặc AI tiếp theo) đọc hiểu dễ dàng._
