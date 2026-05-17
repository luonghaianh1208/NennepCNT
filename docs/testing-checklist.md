# Testing Checklist — Nền Nếp CNT Migration

## Auth
- [ ] Đăng nhập với email/password mới
- [ ] Đăng xuất
- [ ] Reset password email nhận được
- [ ] Ghi nhớ đăng nhập (remember me)

## Violations CRUD
- [ ] Tạo vi phạm mới (RED_FLAG role)
- [ ] Xem danh sách vi phạm
- [ ] Sửa vi phạm
- [ ] Xóa vi phạm (đơn)
- [ ] Xóa hàng loạt (BCH)
- [ ] Upload ảnh vi phạm (nén WebP)

## Image Compression
- [ ] Ảnh resize về max 1920px
- [ ] Ảnh lưu dưới dạng WebP
- [ ] Dung lượng ~200-500KB sau nén
- [ ] Preview ảnh trong ViewViolationModal
- [ ] Zoom ảnh rõ ràng

## RBAC
- [ ] ADMIN: thấy tất cả, quản lý vai trò
- [ ] BCH: tạo vi phạm, xem báo cáo
- [ ] RED_FLAG: chỉ tạo vi phạm
- [ ] TEACHER: chỉ xem (class scope)
- [ ] GUEST: chỉ xem (class scope)
- [ ] Admin tạo role mới
- [ ] Admin gán permissions cho role
- [ ] Admin gán role cho user

## Zalo Bot (Private Messages)
- [ ] Follow OA → bot nhận được event
- [ ] Gửi "help" → nhận được danh sách lệnh
- [ ] Gửi "thống kê tuần này" → nhận được thống kê
- [ ] Gửi "thống kê tháng này" → nhận được thống kê
- [ ] Gửi "hỏi lớp 10A1" → nhận được thông tin lớp

## Zalo Bot (Group Messages)
- [ ] Bot được add vào group Zalo
- [ ] Tag bot (@bot) trong group → bot reply
- [ ] "@bot thống kê tuần này" → có data
- [ ] "@bot xếp hạng" → có bảng xếp hạng
- [ ] "@bot hỏi lớp 10A1" → có data
- [ ] "@bot help" → danh sách lệnh
- [ ] "@bot top 10" → top vi phạm

## Settings
- [ ] CRUD Classes
- [ ] CRUD Students
- [ ] CRUD Criteria
- [ ] CRUD Time Configs
- [ ] Sync settings lên Supabase

## Data Migration
- [ ] Users đầy đủ
- [ ] Classes đầy đủ
- [ ] Violations history đầy đủ
- [ ] Ảnh vi phạm migrate thành công

## Performance
- [ ] Load trang < 2s (Supabase)
- [ ] Upload ảnh < 3s
- [ ] Thống kê < 1s

## Security
- [ ] RLS policies block unauthorized access
- [ ] Service role key không bị lộ trong frontend code
- [ ] Webhook verify token hoạt động