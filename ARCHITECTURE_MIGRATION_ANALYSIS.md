# Phân Tích Kiến Trúc: Di Chuyển Từ GAS/Google Sheets sang Firebase & Các Nền Tảng Khác

**Ngày phân tích:** 15/05/2026  
**Dự án:** Nền Nếp CNT - Hệ thống quản lý điểm thi đua  
**Tác giả:** Phân tích tự động bởi AI

---

## 1. Tóm Tắt Kiến Trúc Hiện Tại

### Stack Hiện Tại
| Thành phần | Công nghệ | Mô tả |
|------------|-----------|-------|
| **Frontend** | React + TypeScript + Vite + TailwindCSS | Single Page Application deploy trên Netlify |
| **Backend** | Google Apps Script (GAS) | REST API部署 với `doGet/doPost` handlers |
| **Database** | Google Sheets | NoSQL-like sheet với 8 bảng (Users, Classes, Students, Criteria, Violations, Achievements, TimeConfigs, AuditLogs) |
| **File Storage** | Google Drive | Lưu ảnh vi phạm dưới dạng file |
| **Email** | Gmail/MailApp | Gửi email đặt lại mật khẩu qua `MailApp.sendEmail()` |
| **Authentication** | Server-side validation | Password so sánh trên GAS, không trả về client |

### Đặc Điểm Kiến Trúc Quan Trọng
1. **All-in-One Google Ecosystem:** Toàn bộ backend logic nằm trong 1 file `gas_backend.gs` (~680 dòng)
2. **Batch Operations:** Tối ưu cold-start latency bằng batch endpoints (`batchCreateViolations`, `batchUpdateViolations`)
3. **Security Model:** Password validation server-side, `safeUser` objects không chứa password field
4. **Single Spreadsheet ID:** `1taypp0IhgTN2hGPi5GpHl9TC-viDwMLiclAtcO7kREk`
5. **Drive Folder ID:** `1VfEXuGC3XjDPiAW3wQZCAQ-I4OF3EVvC`

---

## 2. Đánh Giá: Có Hợp Lý Không Khi Chuyển Sang Firebase?

### ✅ Lý Do NÊN Chuyển

| Lý Do | Chi Tiết | Mức Độ Ưu Tiên |
|-------|----------|----------------|
| **Real-time Updates** | Firebase Firestore có real-time listeners, không cần refresh manual | Cao - Nếu cần đồng bộ live giữa các giáo viên/học sinh |
| **Scalability** | Firebase auto-scales, không lo quota limits như Google Sheets | Trung bình - Hiện tại quy mô trường học ~1000-2000 học sinh |
| **Better Querying** | Firestore/SQL có complex queries, filtering, indexing tốt hơn Google Sheets | Cao - Hiện tại phải load ALL data về client rồi filter |
| **Performance** | Giảm cold-start latency (GAS ~2-5s khi cold), Firebase ~100-300ms | Cao - UX cải thiện đáng kể |
| **Authentication Built-in** | Firebase Auth cung cấp email/password, Google login, rate limiting | Trung bình - Hiện tại đã có custom auth hoạt động tốt |
| **Cloud Functions** | TypeScript/Node.js backend thay vì GAS Apps Script | Cao - Dễ maintain, debug, version control hơn |
| **Storage** | Firebase Storage thay thế Google Drive API | Trung bình - Firebase Storage có CDN, resumable uploads |

### ❌ Lý Do KHÔNG NÊN Chuyển

| Lý Do | Chi Tiết | Mức Độ Ưu Tiên |
|-------|----------|----------------|
| **Chi Phí** | Firebase có tính phí khi vượt free tier, GAS miễn phí hoàn toàn | Cao - Trường học thường có ngân sách hạn chế |
| **Migration Complexity** | Chuyển Google Sheets schema → Firestore/SQL cần rewrite toàn bộ backend | Cao - ~2-3 ngày work cho data migration + testing |
| **Loss of Google Integration** | Không thể edit data trực tiếp trong Sheets, không auto-save backups | Trung bình - Hiện tại admin có thể edit trực tiếp trong Sheets |
| **Email Functionality** | Firebase không có built-in email như MailApp, cần 3rd party (SendGrid, Resend) | Trung bình - Tăng dependency, cost |
| **Audit Trail** | Google Sheets tự động có version history, Firebase cần cài đặt thêm | Thấp - Đã có AuditLogs sheet |
| **Hosting Simplicity** | GAS deployment = 1 click, Firebase cần configure Functions, Firestore, Storage | Thấp - Netlify đã handle frontend |

### 🟡 Lý Do TRUNG TÍNH

| Lý Do | Chi Tiết |
|-------|----------|
| **Development Speed** | GAS: Faster prototyping (1 file), Firebase: Cần setup nhiều services |
| **Learning Curve** | GAS: Dễ cho người không-code, Firebase: Đòi hỏi backend knowledge |
| **Offline Support** | Firestore có offline persistence, Sheets không có |
| **Data Export** | Sheets: Export Excel/CSV dễ dàng, Firebase: Cần tool/script riêng |

---

## 3. Bảng So Sánh Chi Tiết: GAS vs Firebase vs Các Nền Tảng Khác

### 3.1 So Sánh Tổng Quan

| Tiêu Chí | Google Apps Script | Firebase (Firestore + Functions) | Supabase | Appwrite | Self-hosted Node + PostgreSQL |
|----------|-------------------|----------------------------------|----------|----------|------------------------------|
| **Chi Phí (Monthly)** | $0 | ~$10-50 (predict 2k users) | Free tier generous | Free tier generous | $5-20 (VPS) |
| **Cold Start Latency** | 2-5s | 100-500ms (Node 20) | 200-600ms | 200-600ms | 50-200ms |
| **Real-time** | ❌ No | ✅ Firestore Listen | ✅ Realtime Subscriptions | ✅ Realtime | ⚠️ Cần WebSocket setup |
| **Authentication** | ⚠️ Custom | ✅ Firebase Auth | ✅ Supabase Auth | ✅ Appwrite Auth | ⚠️ Cần JWT implementation |
| **Database Type** | NoSQL (Sheets) | NoSQL (Document) | PostgreSQL (Relational) | NoSQL + SQL | PostgreSQL |
| **Query Capabilities** | 🔴 Rất kém | 🟡 Giới hạn | 🟢 Rất tốt | 🟢 Tốt | 🟢 Tốt nhất |
| **File Storage** | Google Drive | Firebase Storage | Storage (S3-compatible) | Storage | ⚠️ Cần setup riêng |
| **Email Service** | ✅ Built-in MailApp | ⚠️ Cần 3rd party | ⚠️ Cần 3rd party | ⚠️ Cần 3rd party | ⚠️ Cần SMTP config |
| **Hosting** | ✅ Included | ✅ Functions + Hosting | ✅ Edge Functions | ✅ Cloud + Self-host | ⚠️ Tự deploy/manage |
| **Version Control** | ⚠️ Partial (Script history) | ✅ Git + Functions | ✅ Git + Migrations | ✅ Git + Migrations | ✅ Full Git control |
| **Scalability** | 🔴 Limited (Quota) | 🟢 Auto-scale | 🟢 Auto-scale | 🟡 Self-host limit | 🟡 Phụ thuộc VPS |
| **Offline Support** | ❌ No | ✅ Firestore | ⚠️ Limited | ⚠️ Limited | ⚠️ Cần implement |
| **Best For** | Protoype, Internal tools | Mobile apps, Real-time | SQL lovers, Open source | All-in-one solution | Full control, Privacy |

### 3.2 So Sánh Chi Tiết Theo Use Case

#### Use Case: Login & Authentication

| Nhà Cung Cấp | Cách Triển Khai | Bảo Mật | Độ Phức Tạp |
|--------------|-----------------|---------|-------------|
| **GAS** | Custom password check trong sheet, server-side validation | 🟡 Trung bình (plain text password trong sheet) | 🔵 Thấp (đã implement) |
| **Firebase** | Firebase Auth (email/password, Google SSO), auto token refresh | 🟢 Cao (bcrypt, rate limiting, 2FA ready) | 🟡 Trung bình (SDK setup) |
| **Supabase** | Supabase Auth (PostgreSQL backed), JWT tokens | 🟢 Cao (PostgreSQL + Row Level Security) | 🟡 Trung bình |
| **Appwrite** | Appwrite Auth (magic URL, OAuth providers) | 🟢 Cao | 🟡 Trung bình |
| **Self-hosted** | Custom JWT + bcrypt | 🟢 Cao (nếu implement đúng) | 🔴 Cao (security burden) |

#### Use Case: CRUD Violations (Điểm Thi Đua)

| Nhà Cung Cấp | Read Performance | Write Performance | Complex Queries |
|--------------|------------------|-------------------|-----------------|
| **GAS** | 🔴 2-5s cold, load ALL data | 🔴 1-3s per batch | 🔴 Không có (filter client-side) |
| **Firebase** | 🟢 100-300ms, incremental loads | 🟢 100-200ms | 🟡 Giới hạn (no joins, need denormalize) |
| **Supabase** | 🟢 100-300ms, SQL queries | 🟢 100-200ms | 🟢 Rất tốt (PostgreSQL full power) |
| **Appwrite** | 🟢 100-300ms | 🟢 100-200ms | 🟢 Tốt (Database queries) |
| **Self-hosted** | 🟢 50-150ms | 🟢 50-150ms | 🟢 Tốt nhất (custom queries) |

#### Use Case: File Upload (Ảnh Vi Phạm)

| Nhà Cung Cấp | Upload Speed | CDN | Storage Cost | Integration |
|--------------|--------------|-----|--------------|-------------|
| **Google Drive** | 🟡 Trung bình | 🟡 Có | 🟢 Free (15GB chung) | ✅ Native (GAS) |
| **Firebase Storage** | 🟢 Nhanh | 🟢 Global CDN | 🟡 $0.026/GB | ✅ Native SDK |
| **Supabase Storage** | 🟢 Nhanh | 🟡 Regional | 🟢 Free 1GB | ✅ Native SDK |
| **Appwrite Storage** | 🟢 Nhanh | ⚠️ Tự config | 🟢 Tự host free | ✅ Native SDK |
| **Self-hosted** | 🟢 Phụ thuộc VPS | ⚠️ Cần Cloudflare | 🟢 Tự chọn | ⚠️ Cần setup |

#### Use Case: Email (Reset Password)

| Nhà Cung Cấp | Built-in | Cost | Deliverability | Customization |
|--------------|----------|------|----------------|---------------|
| **GAS MailApp** | ✅ Yes | 🟢 Free | 🟡 Trung bình | 🟡 HTML template |
| **Firebase + SendGrid** | ❌ No | 🟡 $15/mo | 🟢 Cao | 🟢 Rất tốt |
| **Supabase + Resend** | ❌ No | 🟡 $20/mo | 🟢 Cao | 🟢 Rất tốt |
| **Appwrite + SMTP** | ⚠️ Config | 🟢 Free (self SMTP) | 🟡 Phụ thuộc | 🟡 HTML template |
| **Self-hosted + Nodemailer** | ⚠️ Config | 🟢 Free | 🟡 Phụ thuộc | 🟢 Rất tốt |

---

## 4. Phân Tích Chi Tiết Từng Nền Tảng

### 4.1 Firebase (Google Ecosystem)

#### Kiến Trúc Đề Xuất
```
Frontend (React + Netlify)
    ↓
Firebase Firestore (Database)
Firebase Cloud Functions (Backend API)
Firebase Storage (Ảnh)
Firebase Auth (Authentication)
    ↓
Resend/SendGrid (Email - 3rd party)
```

#### Ưu Điểm
- ✅ **Ecosystem Integration:** Firebase + React có SDK mạnh mẽ
- ✅ **Real-time:** Firestore listeners cho live updates (nếu cần)
- ✅ **Scalability:** Auto-scale, không lo traffic spikes
- ✅ **TypeScript Support:** Cloud Functions dùng TypeScript, type-safe
- ✅ **Offline First:** Firestore offline persistence cho mobile/web
- ✅ **Security Rules:** Firestore rules như row-level security

#### Nhược Điểm
- ❌ **Chi Phí:** Tính phí theo usage (reads/writes/storage)
- ❌ **Vendor Lock-in:** Khó migrate khỏi Firebase sau này
- ❌ **NoSQL Limitations:** Không có JOINs, complex queries khó
- ❌ **Email:** Không có built-in email, cần tích hợp 3rd party
- ❌ **Learning Curve:** Firestore data modeling khác SQL

#### Migration Effort
- **Database Migration:** 2-3 ngày (Sheets → Firestore)
- **Backend Rewrite:** 3-5 ngày (GAS → Cloud Functions)
- **Auth Migration:** 1-2 ngày (Custom → Firebase Auth)
- **File Migration:** 1 ngày (Drive → Firebase Storage)
- **Testing:** 2-3 ngày
- **Total:** ~9-14 ngày làm việc

#### Chi Phí Dự Kiến (2000 users, 10k violations/month)
- **Firestore:** ~$5-10/month
- **Functions:** ~$5-10/month
- **Storage:** ~$2-5/month
- **Auth:** Free (10k MAU)
- **Email (SendGrid):** $15/month (nếu cần)
- **Total:** ~$27-40/month (không có email: ~$12-25/month)

---

### 4.2 Supabase (Open Source Firebase Alternative)

#### Kiến Trúc Đề Xuất
```
Frontend (React + Netlify)
    ↓
Supabase PostgreSQL (Database + API)
Supabase Edge Functions (Backend Logic)
Supabase Storage (Ảnh)
Supabase Auth (Authentication)
    ↓
Resend/SendGrid (Email - 3rd party)
```

#### Ưu Điểm
- ✅ **PostgreSQL:** Full SQL power, JOINs, complex queries
- ✅ **Real-time:** PostgreSQL changes → WebSocket subscriptions
- ✅ **Row Level Security:** Database-level auth rules
- ✅ **Auto-API:** REST + GraphQL tự động từ schema
- ✅ **Open Source:** Tự host được nếu cần
- ✅ **Migration Tools:** pg_dump, migration files

#### Nhược Điểm
- ❌ **Chi Phí Email:** Không có built-in email
- ❌ **Complexity:** PostgreSQL knowledge cần thiết
- ❌ **Self-host Burden:** Nếu self-host, cần maintain database
- ❌ **Smaller Community:** So với Firebase

#### Migration Effort
- **Database Migration:** 3-4 ngày (Sheets → PostgreSQL schema)
- **Backend Rewrite:** 2-4 ngày (GAS → Edge Functions)
- **Auth Migration:** 1-2 ngày (Custom → Supabase Auth)
- **File Migration:** 1 ngày (Drive → Supabase Storage)
- **Testing:** 2-3 ngày
- **Total:** ~9-14 ngày làm việc

#### Chi Phí Dự Kiến (Pro Plan)
- **Supabase Pro:** $25/month (500GB bandwidth, 8GB database)
- **Storage:** Free trong quota
- **Email:** $15/month (SendGrid)
- **Total:** ~$40/month

---

### 4.3 Appwrite (All-in-One Backend)

#### Kiến Trúc Đề Xuất
```
Frontend (React + Netlify)
    ↓
Appwrite Database (Database)
Appwrite Functions (Backend Logic)
Appwrite Storage (Ảnh)
Appwrite Auth (Authentication)
    ↓
SMTP Server (Email - Tự config)
```

#### Ưu Điểm
- ✅ **All-in-One:** Database, Auth, Storage, Functions trong 1 platform
- ✅ **Self-host Friendly:** Docker one-command deploy
- ✅ **Open Source:** Không vendor lock-in lo lắng
- ✅ **Real-time:** WebSocket real-time updates
- ✅ **Multi-platform:** Web, iOS, Android SDKs

#### Nhược Điểm
- ❌ **Smaller Community:** So với Firebase/Supabase
- ❌ **Performance:** Self-host cần resource management
- ❌ **Email:** Cần tự config SMTP server
- ❌ **Maturity:** Dự án trẻ hơn Firebase

#### Migration Effort
- **Database Migration:** 3-4 ngày
- **Backend Rewrite:** 3-5 ngày
- **Auth Migration:** 1-2 ngày
- **File Migration:** 1 ngày
- **Testing:** 2-3 ngày
- **Total:** ~10-15 ngày làm việc

#### Chi Phí Dự Kiến
- **Cloud Plan:** Free tier generous (1GB storage, 10GB bandwidth)
- **Self-hosted:** $5-20/month (VPS)
- **Email (SMTP):** Free (Gmail SMTP, Outlook) hoặc $10-20 (SendGrid)
- **Total:** ~$5-20/month (self-host)

---

### 4.4 Giữ Nguyên GAS/Google Sheets

#### Kiến Trúc Hiện Tại
```
Frontend (React + Netlify)
    ↓
Google Apps Script (REST API)
Google Sheets (Database)
Google Drive (File Storage)
Gmail/MailApp (Email)
```

#### Ưu Điểm
- ✅ **Zero Cost:** Hoàn toàn miễn phí
- ✅ **No Maintenance:** Google handle infrastructure
- ✅ **Direct Edit:** Admin có thể edit data trực tiếp trong Sheets
- ✅ **Built-in Email:** MailApp send email không cần config
- ✅ **Version History:** Sheets auto version, có thể rollback
- ✅ **Simple Deployment:** 1 click deploy từ Apps Script editor

#### Nhược Điểm
- ❌ **Cold Start Latency:** 2-5s khi idle
- ❌ **Quota Limits:** 6min execution time/day, 100k API calls/day
- ❌ **Poor Querying:** Filter phải làm ở client-side
- ❌ **No Real-time:** Phải manual refresh
- ❌ **Security:** Plain text passwords trong sheet
- ❌ **Scalability:** Không tốt khi data > 100k rows

#### Chi Phí Dự Kiến
- **Total:** $0/month

---

## 5. Khuyến Nghị Theo Scenarios

### Scenario A: Giữ Nguyên Hiện Tại (Recommended cho hiện tại)

**Khi nào chọn:**
- ✅ Ngân sách hạn chế ($0/month)
- ✅ Quy mô nhỏ (< 2000 users, < 50k records)
- ✅ Không cần real-time updates
- ✅ Team không có backend expertise
- ✅ Cần simple deployment & maintenance

**Cải thiện có thể làm:**
1. **Client-side Caching:** localStorage cache để giảm API calls
2. **Pagination:** Load分批 thay vì load ALL data
3. **Service Worker:** Cache API responses cho offline support
4. **CDN:** Serve static assets qua Cloudflare

**Phù hợp với dự án này:** ✅ **YES** - Hiện tại đã hoạt động ổn, không có pain points lớn

---

### Scenario B: Chuyển Sang Firebase

**Khi nào chọn:**
- ✅ Cần real-time updates (live scoring, multi-user editing)
- ✅ Dự kiến scale lớn (> 10k users)
- ✅ Có ngân sách ($20-50/month)
- ✅ Team có Node.js/TypeScript expertise
- ✅ Cần mobile app support (iOS/Android)

**Migration Plan:**
1. **Phase 1 (1 tuần):** Setup Firebase project, Firestore schema, Cloud Functions
2. **Phase 2 (1 tuần):** Data migration (Sheets → Firestore), testing
3. **Phase 3 (1 tuần):** Auth migration (Custom → Firebase Auth)
4. **Phase 4 (3-5 ngày):** File migration (Drive → Firebase Storage)
5. **Phase 5 (1 tuần):** Testing, rollback plan, deploy

**Rủi Ro:**
- Downtime trong migration
- Chi phí phát sinh nếu không optimize queries
- Firebase vendor lock-in

---

### Scenario C: Chuyển Sang Supabase

**Khi nào chọn:**
- ✅ Team yêu thích SQL/PostgreSQL
- ✅ Cần complex queries, JOINs
- ✅ Muốn open-source, self-host option
- ✅ Có ngân sách ($25-50/month)
- ✅ Cần Row Level Security ở database level

**Migration Plan:**
1. **Phase 1 (1 tuần):** Design PostgreSQL schema, setup Supabase project
2. **Phase 2 (1-2 tuần):** Data migration (Sheets → PostgreSQL), migration scripts
3. **Phase 3 (1 tuần):** Backend logic (GAS → Edge Functions)
4. **Phase 4 (3-5 ngày):** Auth + Storage migration
5. **Phase 5 (1 tuần):** Testing, optimization

**Rủi Ro:**
- PostgreSQL learning curve cho team
- Data modeling khác biệt lớn từ Sheets

---

### Scenario D: Tự Host (Self-hosted Node + PostgreSQL)

**Khi nào chọn:**
- ✅ Cần full control over data & infrastructure
- ✅ Team có DevOps expertise
- ✅ Privacy/compliance requirements
- ✅ Ngân sách hạn chế nhưng có VPS skills ($5-20/month)
- ✅ Muốn tránh vendor lock-in

**Migration Plan:**
1. **Phase 1 (2 tuần):** Setup VPS, PostgreSQL, Node.js API
2. **Phase 2 (2 tuần):** Write backend API (CRUD, Auth, File handling)
3. **Phase 3 (1-2 tuần):** Data migration, testing
4. **Phase 4 (1 tuần):** Email SMTP config, SSL certificates
5. **Phase 5 (1-2 tuần):** Monitoring, backup setup, deployment

**Rủi Ro:**
- High maintenance burden
- Security responsibility
- Downtime risk nếu không có monitoring

---

## 6. Bảng Tổng Hợp Khuyến Nghị

| Yếu Tố | GAS (Hiện Tại) | Firebase | Supabase | Appwrite | Self-hosted |
|--------|----------------|----------|----------|----------|-------------|
| **Chi Phí** | 🟢 $0 | 🟡 $12-40 | 🟡 $40 | 🟢 $5-20 | 🟢 $5-20 |
| **Performance** | 🔴 2-5s | 🟢 100-300ms | 🟢 100-300ms | 🟢 100-300ms | 🟢 50-150ms |
| **Scalability** | 🔴 Limited | 🟢 Auto | 🟢 Auto | 🟡 Limited | 🟡 Limited |
| **Maintenance** | 🟢 Zero | 🟢 Low | 🟢 Low | 🟡 Medium | 🔴 High |
| **Real-time** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Setup |
| **Query Power** | 🔴 Poor | 🟡 Limited | 🟢 Excellent | 🟢 Good | 🟢 Excellent |
| **Email** | ✅ Built-in | ⚠️ 3rd party | ⚠️ 3rd party | ⚠️ Config | ⚠️ Config |
| **Security** | 🟡 Medium | 🟢 High | 🟢 High | 🟢 High | 🟢 High (nếu config đúng) |
| **Migration Effort** | - | 9-14 ngày | 9-14 ngày | 10-15 ngày | 14-21 ngày |
| **Recommended For** | Protoype, Small | Real-time apps | SQL teams | All-in-one | Full control |

---

## 7. Kết Luận & Khuyến Nghị

### 🟢 Khuyến Nghị Chính: GIỮ NGUYÊN GAS/GOOGLE SHEETS

**Lý do:**

1. **Zero Cost:** Không phát sinh chi phí, phù hợp với ngân sách trường học
2. **Zero Maintenance:** Google handle infrastructure, không cần DevOps
3. **Currently Working:** Hệ thống đang hoạt động ổn, không có critical pain points
4. **Low Technical Barrier:** Admin có thể edit data trực tiếp trong Sheets
5. **Built-in Email:** MailApp send email không cần tích hợp 3rd party
6. **Simple Rollback:** Version history trong Sheets cho phép rollback dễ dàng

### 🟡 Khi Nào NÊN Chuyển?

Chuyển khi có **CÁC YÊU CẦU NÀY:**

1. **Real-time Updates:** Cần live scoring, multi-user editing sync
2. **Scale Lớn:** > 10k users hoặc > 100k records
3. **Performance Pain:** 2-5s cold start là không chấp nhận được
4. **Complex Queries:** Cần JOINs, aggregations, advanced filtering
5. **Mobile App:** Cần iOS/Android app share backend
6. **Budget Available:** Có $20-50/month để chi trả

### 🔴 Nếu Quyết ĐỊNH CHUYỂN, Chọn Nền Tảng Nào?

**Thứ tự ưu tiên:**

1. **Firebase** - Nếu muốn ecosystem integration, real-time, mobile support
2. **Supabase** - Nếu team yêu thích SQL/PostgreSQL, cần complex queries
3. **Appwrite** - Nếu muốn self-host option, all-in-one solution
4. **Self-hosted** - Nếu cần full control, có DevOps team

### 📋 Migration Checklist (Nếu Quyết Định Chuyển)

```markdown
## Pre-Migration
- [ ] Backup toàn bộ Google Sheets + Drive
- [ ] Define success criteria (performance targets, cost limits)
- [ ] Setup staging environment
- [ ] Write comprehensive tests cho backend mới

## Data Migration
- [ ] Export Sheets → JSON/CSV
- [ ] Design new schema (Firestore/PostgreSQL)
- [ ] Write migration scripts
- [ ] Test migration với production data volume
- [ ] Dry run migration (validate data integrity)

## Backend Migration
- [ ] Setup new backend (Firebase Functions/Supabase Edge)
- [ ] Rewrite all API endpoints (CRUD, Auth, File, Email)
- [ ] Implement rate limiting, error handling
- [ ] Setup monitoring, logging

## Frontend Migration
- [ ] Update API client (GAS URL → new backend URL)
- [ ] Update auth logic (Custom → Firebase Auth/Supabase Auth)
- [ ] Update file upload logic (Drive → Storage)
- [ ] Test all features end-to-end

## Testing
- [ ] Unit tests cho backend functions
- [ ] Integration tests cho API endpoints
- [ ] E2E tests cho critical user flows
- [ ] Load tests cho performance validation
- [ ] Security audit (auth, RBAC, data validation)

## Deployment
- [ ] Setup rollback plan
- [ ] Deploy backend mới (staging first)
- [ ] Migrate data (staging → validate → production)
- [ ] Deploy frontend với new API URL
- [ ] Monitor errors, performance (first 48h)

## Post-Migration
- [ ] Decommission old GAS project (sau 30 days)
- [ ] Update documentation
- [ ] Train team on new tools
- [ ] Review costs, optimize queries
```

---

## 8. Phụ Lục: Mã Nguồn Minh Họa

### 8.1 Firebase Firestore Schema Ví Dụ

```typescript
// Firestore Collections Structure

// users collection
interface UserDoc {
  id: string;
  name: string;
  username: string;
  // passwordHash: string; // Firebase Auth handles this
  role: string;
  className?: string;
  email?: string;
  summaryMeetings?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// violations collection
interface ViolationDoc {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  studentId?: string;
  criteriaId: string;
  points: number;
  note?: string;
  imageUrls?: string[]; // Firebase Storage URLs
  reportedBy: string;
  isSecurityReport: boolean;
  timestamp: number;
  createdAt: Timestamp;
}

// Indexes needed for common queries
// - classId + date (range query)
// - studentId + date (range query)
// - timestamp (sorting)
```

### 8.2 Supabase PostgreSQL Schema Ví Dụ

```sql
-- PostgreSQL Schema for Supabase

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- Or use Supabase Auth
  role TEXT NOT NULL,
  class_id UUID REFERENCES classes(id),
  email TEXT,
  summary_meetings INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  homeroom_teacher TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Violations table
CREATE TABLE violations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES criteria(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  note TEXT,
  image_urls TEXT[],
  reported_by UUID REFERENCES users(id),
  is_security_report BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_violations_class_date ON violations(class_id, date);
CREATE INDEX idx_violations_student_date ON violations(student_id, date);
CREATE INDEX idx_violations_timestamp ON violations(created_at);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Example RLS policy: Only authenticated users can read violations
CREATE POLICY "Authenticated users can read violations"
  ON violations FOR SELECT
  TO authenticated
  USING (TRUE);
```

### 8.3 Firebase Cloud Functions (TypeScript) Ví Dụ

```typescript
// Firebase Functions example - Replace GAS endpoints

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const verifyLogin = functions.https.onCall(async (data, context) => {
  const { username, password } = data;
  
  // Use Firebase Auth or custom password check
  const userQuery = await db.collection('users')
    .where('username', '==', username)
    .limit(1)
    .get();
    
  if (userQuery.empty) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  
  const userDoc = userQuery.docs[0];
  // Verify password (or use Firebase Auth verifyPassword)
  // ...
  
  return { success: true, user: userDoc.data() };
});

export const getAllData = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const [users, classes, students, criteria, violations, timeConfigs] = await Promise.all([
    db.collection('users').get(),
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('criteria').get(),
    db.collection('violations').orderBy('timestamp', 'desc').get(),
    db.collection('timeConfigs').get(),
  ]);
  
  return {
    Users: users.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    Classes: classes.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    Students: students.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    Criteria: criteria.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    Violations: violations.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    TimeConfigs: timeConfigs.docs.map(doc => ({ id: doc.id, ...doc.data() })),
  };
});
```

---

## 9. Tài Liệu Tham Khảo

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Firebase Pricing Calculator](https://firebase.google.com/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
- [Appwrite Self-hosted Guide](https://appwrite.io/docs/self-hosting)
- [Google Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas)

---

**Kết thúc báo cáo.**

*Để bắt đầu migration, hãy tạo task list chi tiết cho từng phase.*