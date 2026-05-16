# CẤU TRÚC VÀ LOGIC DỰ ÁN: NỀN NẾP CNT

File này dùng để ghi nhớ toàn bộ thông tin về dự án, bao gồm cấu trúc thư mục, kiến trúc source code, logic hoạt động và workflow. Mỗi khi có update mới và hoàn thiện xong, nội dung sẽ được cập nhật thêm vào file này.

## 1. Tổng quan dự án (Overview)
- **Tên dự án:** Nền Nếp CNT
- **Mục đích:** Hệ thống quản lý chấm điểm thi đua, nền nếp của trường THPT Chuyên Nguyễn Trãi (Hải Dương).
- **Frontend:** React.js chuyên dụng với TypeScript, Vite, và TailwindCSS (sử dụng thư viện icon Lucide-react, biểu đồ Recharts, xử lý file với `xlsx`, `jspdf`, `docx`).
- **Backend:** Google Apps Script (GAS) đóng vai trò làm REST API. File source backend nằm trong thư mục gốc `gas_backend.gs`.
- **Database:** Google Sheets (`1taypp0IhgTN2hGPi5GpHl9TC-viDwMLiclAtcO7kREk`). Trạm dữ liệu lưu qua các sheet riêng lẻ.
- **Lưu trữ ảnh:** Google Drive (`1VfEXuGC3XjDPiAW3wQZCAQ-I4OF3EVvC`).
- **Triển khai (Deployment):** Netlify cho frontend web.
- **Giao diện (UI/UX Theme):** Giao diện "Đoàn" tối ưu (đỏ, vàng, hiệu ứng ngôi sao bay, logo trực quan).

## 2. Cấu trúc thư mục định tuyến (Directory Structure)
```text
nen-nep-cnt/
├── .netlify/                # Cấu hình cache/build Netlify
├── components/              # Các component UI của React
│   ├── modals/              # Các modal chức năng dùng chung (ViewViolation, EditViolation,...)
│   ├── settings/            # Tab con cấu hình cho Admin gộp trong Settings
│   ├── DashboardTab.tsx     # Tab Tổng quan (Landing page hiển thị mặc định)
│   ├── EntryTab.tsx         # Tab Nhập lỗi (dành cho Cờ đỏ/Admin nhập vi phạm hoặc thành tích)
│   ├── ListTab.tsx          # Tab Tra cứu danh sách lỗi toàn trường
│   ├── RankingTab.tsx       # Tab Xếp hạng điểm số các lớp
│   ├── ClassDetailTab.tsx   # Tab Xem chi tiết phân tích của một lớp
│   ├── TaskForceTab.tsx     # Tab Đặc nhiệm Ban Nền nếp
│   ├── LoginModal.tsx       # Modal xác thực đăng nhập (tách biệt logic login)
│   └── AboutModal.tsx       # Thông tin phiên bản & giới thiệu ứng dụng
├── contexts/                # Quản lý state toàn cục qua React Contexts
│   ├── AppContext.tsx       # Store chính (chứa dữ liệu global, cache, role mapping, user hiện hành)
│   └── ModalContext.tsx     # Quản lý hiển thị các toast, hộp thoại confirm và alert
├── services/                # Giao tiếp ngoại vi & API Call
│   └── googleApi.ts         # Endpoint call từ React App gọi HTTP POST/GET sang GAS
├── utils/                   # Hàm logic, helper và modules tạo báo cáo
│   ├── generateHtml.ts      # Tạo markup HTML report chờ render PDF
│   ├── generatePdf.ts       # Sinh file báo cáo chất lượng cao (PDF/Docx)
│   ├── reportGenerator.ts   # Chuyển API Data -> Report Data 
│   └── utils.ts             # Các hàm format String, Ngày, Date, cấu hình GUEST_USER mặc định
├── gas_backend.gs           # SUỘC BACKEND CHÍNH (Deploy trực tiếp tại App Script)
├── types.ts                 # Mô hình TypeScript Core (User, Violation, Criteria,...)
├── App.tsx                  # Root Component: Rendering Header, Navigation Tabs, Màn hình chính
├── index.tsx                # Entry point tạo DOM Root
├── package.json             # Các packages & lệnh Vite build
└── README.md
```

## 3. Kiến trúc Database (Google Sheets Data Layer)
Tất cả bảng cơ sở dữ liệu được map vào Object JSON trả về một lần (ngoại trừ password) lúc ứng dụng load:
- **`Users`**: Thông tin người dùng, roles, username, password (được giữ kín tại Google Scripts để xác minh trên server), email dùng lấy lại pass.
- **`Classes`**: Phân loại danh sách lớp theo khối và thông tin Giáo viên chủ nhiệm.
- **`Students`**: Thông tin học sinh gắn với một lớp xác định.
- **`Criteria`**: Kho tiêu chí nề nếp dùng chung: 
  - `MINUS`: Lỗi vi phạm (điểm trừ).
  - `PLUS`: Thành tích (điểm cộng).
- **`Violations`**: Chứa nhật ký vi phạm đã lập (nhóm lỗi vi phạm).
- **`Achievements`**: Chứa nhật ký thành tích (để gộp chung vào ViolationsArray xử lý trên client).
- **`TimeConfigs`**: Thiết lập thời gian thống kê (Học kỳ, Tháng, Tuần) để đối chiếu bộ lọc (Filter) ở ListTab/RankingTab.
- **`AuditLogs`**: Bảng Log ghi chi tiết các hành động như `CREATE`, `UPDATE`, `DELETE`, `BULK_DELETE`... phục vụ truy vết dữ liệu do người dùng hoặc quản trị viên thực hiện.

## 4. Logic Hoạt động Cơ bản (Workflow)
### 4.1 Luồng Xác thực (Authentication / Security)
1. User nhấn `Đăng nhập`, form gọi sang `verifyLogin` tại GAS kèm _Username_ & _Password_ do user cung cấp. 
2. GAS query trong sheet Users và so sánh trực tiếp trên Máy chủ.
3. Nếu thành công, Server trả lại object thông tin (id, role, name, v.v...) của tài khoản, **TUYỆT ĐỐI BỎ TRƯỜNG PASSWORD** nhằm ngăn lộ pass. Client lấy object lưu vào `localStorage`.
4. Nếu ấn _Quên mật khẩu_ -> Frontend truyền `email` -> Backend GAS tìm email tại cột `G` -> tạo password random `CNT@xxxx` -> lưu sheet -> sử dụng lớp `MailApp` tiến hành gửi mail thông báo.

### 4.2 Lấy và Cập nhật dữ liệu hàng loạt (Bulk Operations / Fetching)
- **Fetch ban đầu:** Ứng dụng gọi `api.getAllData()` qua AppContext. 
- Mọi logic lọc (Theo Tuần/Tháng, Theo Lớp, Tìm Kiếm...) sau đó đều làm việc với state trong bộ nhớ React, nâng tốc độ tải dữ liệu lên mức Real-time, bỏ qua thời gian cold-start cho mọi thao tác.
- **Hành động Lưu (Import/Cập nhật):**
  - Khi thêm hàng chục lỗi qua Import Excel vi phạm/thành tích (đã xử lý nhận dạng chữ không dấu / có dấu tiếng Việt tại Client), App không gửi N request nhỏ lẻ. 
  - Thay vào đó gọi tới endpoint `batchCreateViolations` / `batchUpdateViolations` với mảng `records`. Endpoint map thẳng mảng thành N row `setValues()` trong Sheet làm tốc độ đẩy lên giảm từ ~5-8s xuống 1s.

### 4.3 Quản lý Role (Phân quyền User)
- `GUEST`: Xem dashboard, xem điểm, tra cứu không lưu trữ thao tác cá nhân.
- `BCH_PHU_TRACH` / `RED_FLAG` / `DISCIPLINE`: Mở tab EntryTab (Nhập lỗi) chuyên dụng, lưu log thao tác.
- `ADMIN`: Mở tab Cấu hình (Settings) cho phép chỉnh sửa Tiêu chí, quản lý tài khoản, thay đổi thời gian tổng kết. Backend không chặn mềm (vì tính chất NoSQL Google Sheet tự động cho Script Admin) nhưng UI sẽ bị đóng khung quyền lực.

## 5. Quy trình Chỉnh sửa & Maintain Source Code
1. Muốn Update cấu trúc Data: Thay đổi Interface nội tại `types.ts`, thêm vào Object Headers `SCHEMA` ở `gas_backend.gs` nhằm đồng bộ sheet mới khi cần gọi function `setupDatabase()`.
2. Kiểm tra Test: Login quyền Cờ đỏ (Mô phỏng nhập điểm) -> Xem list tab hiển thị mới chuẩn. Login quyền Admin -> Xem update bulk. 
3. Sau khi chỉnh sửa code, luôn chạy build bằng lệnh `npm run build` hoặc test UI bằng `npm run dev`. Web được tự động triển khai tới Netlify khi Code được đẩy qua git.
