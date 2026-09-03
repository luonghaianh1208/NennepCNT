# Quy trình triển khai cho một trường mới

Tài liệu này đủ chi tiết để một người (hoặc một AI agent) dựng xong một bản
chạy độc lập cho trường khách hàng trong khoảng 30 phút.

**Mô hình:** mỗi trường một Firebase project riêng, đứng tên tài khoản Google của
2Anh AI Education. Dữ liệu các trường tách biệt hoàn toàn, không dùng chung.

---

## 0. Chuẩn bị

- Đã cài `firebase-tools` và đăng nhập: `firebase login`
- Biết mã tài khoản thanh toán sẽ gắn: `firebase projects:list` để đối chiếu
- Đặt trước hai giá trị:
  - `PROJECT_ID` — ví dụ `nennep-thpt-abc` (chỉ chữ thường, số và dấu gạch ngang)
  - Tên đầy đủ của trường, tên rút gọn hiển thị trên tiêu đề

> **Lưu ý về hạn mức:** mỗi tài khoản thanh toán của Google chỉ gắn được 5 project.
> Hết chỗ thì tạo tài khoản thanh toán mới, hoặc xin Google nâng hạn mức.

---

## 1. Tạo project và bật dịch vụ

```bash
firebase projects:create PROJECT_ID --display-name "Nen Nep - THPT ABC"
firebase apps:create web "Nen Nep Web" --project PROJECT_ID
firebase apps:sdkconfig WEB --project PROJECT_ID      # ghi lại 6 giá trị cấu hình
```

Bật billing (Blaze) — bắt buộc vì Cloud Functions và Storage cần:

```
https://console.firebase.google.com/project/PROJECT_ID/usage/details
```
Chọn *Modify plan* → Blaze → đặt ngân sách cảnh báo 10 USD.

> **Chỗ trống còn lại (kiểm 03/09/2026):** mỗi tài khoản thanh toán gắn được tối
> đa 5 project. `Firebase Payment` và `Firebase Payment` (cái thứ hai) đã đầy;
> **EcoSort** còn 4 chỗ, **My Maps Billing Account** còn 5. Gộp các trường vào
> **EcoSort** để cuối tháng chỉ đối chiếu một hoá đơn. Hết chỗ thì **xin nâng
> hạn mức** trên chính tài khoản đó, đừng tạo tài khoản mới — cái mới lại bắt
> đầu từ 5 và càng về sau càng khó theo dõi.

Tạo cơ sở dữ liệu và kho ảnh (đặt tại Singapore cho gần Việt Nam):

```bash
firebase firestore:databases:create "(default)" --location asia-southeast1 --project PROJECT_ID
```

Storage bật qua API (xem `scripts/demo/` để tham khảo cách gọi), hoặc bấm
*Get started* trong Console ở mục Storage.

### Bật đăng nhập Google — bước DUY NHẤT phải làm tay, mỗi trường một lần

Không tự động hoá được: bật Google cần tạo một OAuth client, mà bước đó bắt
buộc qua giao diện Console. Mỗi project có cấu hình đăng nhập riêng nên trường
nào cũng phải làm.

`https://console.firebase.google.com/project/PROJECT_ID/authentication/providers`

→ **Google** → gạt **Enable**. Màn hình hiện hai ô ở mục *project-level setting*:

| Ô | Điền gì | Vì sao |
|---|---|---|
| **Public-facing name** | Tên trường, ví dụ `Nền Nếp — THPT Nguyễn Huệ` | Đây là dòng chữ Google hiện cho người dùng: *"Chọn tài khoản để tiếp tục đến ..."*. Để mặc định `project-8706...` thì giáo viên và học sinh thấy một dãy số lạ và ngần ngại không dám bấm |
| **Support email** | Email quản trị của trường, hoặc email đơn vị triển khai | **Bắt buộc**, không chọn thì nút Save không ăn |

Bấm **Save**. Hai mục *Web SDK configuration* và *Safelist client IDs* để nguyên —
Firebase tự điền sau khi lưu.

Dòng cảnh báo về **SHA-1 fingerprint** chỉ áp dụng cho ứng dụng Android. Sản phẩm
này chạy trên web nên bỏ qua.

Kiểm tra ngay sau đó: mở trang của trường, bấm *Đăng nhập bằng Google*. Chưa bật
thì hệ thống báo *"Hệ thống chưa bật đăng nhập bằng Google"* — báo đúng chỗ sai,
không phải lỗi mơ hồ.

> **Không cần bật Email/Password.** Hệ thống đã bỏ hẳn mật khẩu riêng: quản trị
> viên chỉ ghi email vào danh sách cho phép, người dùng đăng nhập bằng chính tài
> khoản Google của họ.

---

## 2. Deploy mã nguồn

```bash
# Quy tắc bảo mật + Cloud Functions
firebase deploy --only firestore:rules,storage,functions --project PROJECT_ID

# Cấu hình riêng của trường
cp public/tenant-config.json public/tenant-config.json.bak
# → sửa public/tenant-config.json: dán 6 giá trị firebase lấy ở bước 1,
#   điền branding.schoolName và branding.shortName

pnpm build
firebase deploy --only hosting --project PROJECT_ID
```

**Nhập Excel:** mặc định TẮT cho mọi trường (`FEATURES.excelImport` trong
`utils.ts`). Trường nào xin thì đổi thành `true`, dựng lại rồi triển khai riêng
cho trường đó. Mã nguồn giữ nguyên, không xoá — quyết định 03/09/2026.

Kết quả: `https://PROJECT_ID.web.app`

> **Vì sao chỉ cần build một lần cho mọi trường:** cấu hình Firebase không nhúng
> vào mã mà nạp lúc chạy từ `tenant-config.json`. Muốn cập nhật phiên bản cho
> nhiều trường, chỉ cần thay `tenant-config.json` rồi deploy lại cùng một bộ `dist`.

---

## 3. Nạp dữ liệu ban đầu

Cần một file khoá dịch vụ: Console → Project settings → Service accounts →
*Generate new private key*, lưu thành `firebase-admin-key.json` (đã được gitignore).

```bash
# Thương hiệu nhà trường
TENANT_PROJECT=PROJECT_ID \
SCHOOL_NAME="Trường THPT ABC" \
SHORT_NAME="NỀN NẾP ABC" \
ACADEMIC_YEAR="2025-2026" \
pnpm tsx scripts/demo/set-branding.ts
```

Lớp, học sinh, tiêu chí, mốc thời gian: nhập bằng file Excel mẫu ngay trong app
(Thiết lập → từng mục → *Tải mẫu* → *Import Excel*), hoặc viết script nạp riêng
theo mẫu `scripts/demo/import-to-firebase.ts`.

---

## 4. Cấp quyền cho quản trị viên đầu tiên

Hệ thống không tạo tài khoản cho ai — chỉ ghi email vào danh sách cho phép. Dòng
đầu tiên phải ghi bằng khoá dịch vụ, vì Cloud Function chỉ cho admin gọi (con gà
và quả trứng):

```js
// node -e với firebase-admin, dùng GOOGLE_APPLICATION_CREDENTIALS
const email = 'quantri@truong.edu.vn';   // PHẢI là địa chỉ đăng nhập Google được
await db.collection('allowlist').doc(email).set({
  email, name: 'Quản trị viên', role: 'ADMIN', className: '',
  active: true, uid: '', lastSignIn: null,
});
```

Sau đó người đó vào app, bấm *Đăng nhập bằng Google* với chính địa chỉ ấy — hệ
thống tự gắn quyền ADMIN ngay lần đầu.

Mọi người còn lại cấp ngay trong app: **Cấu hình → Ai được vào hệ thống** → nhập
lẻ hoặc nhập Excel. Không gửi thư, không có mật khẩu; ai có email trong danh sách
là đăng nhập được ngay.

> Chuyển từ bản cũ dùng mật khẩu sang: chạy
> `pnpm tsx scripts/demo/seed-allowlist.ts --project PROJECT_ID` để dựng danh
> sách từ bảng tài khoản sẵn có. Script liệt kê rõ ai chưa có email để bổ sung
> tay, không đoán bừa địa chỉ.

---

## 5. Kiểm tra trước khi bàn giao

- [ ] Mở link, thấy đúng tên và logo trường
- [ ] Bấm *Đăng nhập bằng Google*, cửa sổ Google hiện **tên trường** chứ không phải `project-8706...`
- [ ] Đăng nhập admin được bằng tài khoản Google
- [ ] Cấp quyền thử cho một địa chỉ Google khác, người đó đăng nhập vào được ngay
- [ ] Đăng nhập bằng một địa chỉ KHÔNG có trong danh sách → bị từ chối, có câu hướng dẫn liên hệ ai
- [ ] Đổi vai trò của một người đang mở app → quyền của họ đổi trong vài giây, không cần đăng xuất
- [ ] Nhập thử một vi phạm kèm ảnh, ảnh xem lại được
- [ ] Nhập thử một thành tích cho nhiều lớp
- [ ] Xếp hạng hiện đúng số liệu
- [ ] Mở hai cửa sổ, nhập ở một bên, bên kia tự cập nhật (realtime tuần hiện tại)
- [ ] Trang Giới thiệu vẫn ghi đủ thông tin bản quyền

---

## 6. Bàn giao

Gửi nhà trường: đường dẫn hệ thống, tài khoản quản trị, hướng dẫn sử dụng,
và đầu mối hỗ trợ. **Không giao mã nguồn và không chuyển quyền sở hữu Firebase
project** — đó là ranh giới giữ bản quyền phần mềm.

---

## Cập nhật phiên bản cho các trường đang chạy

```bash
pnpm build
for P in nennep-thpt-abc nennep-thpt-xyz; do
  # nhớ thay tenant-config.json tương ứng trước mỗi lần deploy
  firebase deploy --only hosting --project $P
done
```

Khi có thay đổi ở Cloud Functions hoặc quy tắc bảo mật thì thêm
`--only functions,firestore:rules,storage` cho từng project.
