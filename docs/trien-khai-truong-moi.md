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

Tạo cơ sở dữ liệu và kho ảnh (đặt tại Singapore cho gần Việt Nam):

```bash
firebase firestore:databases:create "(default)" --location asia-southeast1 --project PROJECT_ID
```

Storage và Authentication bật qua API (xem `scripts/demo/` để tham khảo cách gọi),
hoặc bấm *Get started* trong Console ở hai mục Storage và Authentication →
Sign-in method → bật **Email/Password**.

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

## 4. Tạo tài khoản quản trị đầu tiên

Tài khoản admin đầu tiên phải tạo bằng khoá dịch vụ, vì Cloud Function chỉ cho
admin gọi (con gà và quả trứng):

```js
// node -e với firebase-admin, dùng GOOGLE_APPLICATION_CREDENTIALS
const user = await auth.createUser({ email: 'admin@truong.edu.vn', password: '<mật khẩu tạm>' });
await auth.setCustomUserClaims(user.uid, { role: 'ADMIN' });
await db.collection('users').doc(user.uid).set({
  id: user.uid, name: 'Quản trị viên', username: 'admin@truong.edu.vn',
  email: 'admin@truong.edu.vn', role: 'ADMIN', className: '', summaryMeetings: 0, active: true,
});
```

Sau đó vào app, dùng chức năng *Quên mật khẩu* để nhà trường tự đặt mật khẩu thật.
Mọi tài khoản còn lại tạo ngay trong app: Thiết lập → Tài khoản → nhập lẻ hoặc
Import Excel, hệ thống tự gửi thư đặt mật khẩu.

---

## 5. Kiểm tra trước khi bàn giao

- [ ] Mở link, thấy đúng tên và logo trường
- [ ] Đăng nhập admin được, đổi mật khẩu được
- [ ] Tạo thử một tài khoản giáo viên, người đó nhận được email (kiểm tra cả hộp thư rác)
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
