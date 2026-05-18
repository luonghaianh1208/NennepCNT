# Nền Nếp CNT — Migration Plan: Supabase + Zalo Bot

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển toàn bộ hệ thống từ Google Apps Script + Sheets sang Supabase (Postgres + Storage + Auth) + Zalo Bot. Khớp data từ hệ thống cũ, RBAC linh hoạt, ảnh nén WebP 85%.

**Architecture:**
- Frontend (React + Vite) gọi trực tiếp Supabase (Postgres via client SDK + Storage)
- Supabase Auth (email/password) thay GAS `verifyLogin`
- Supabase Storage cho ảnh vi phạm (WebP 85%, resize 1920px max)
- Zalo Bot chạy trên Supabase Edge Function + webhook — listen group, trả lời Q&A, gửi thống kê định kỳ
- RBAC: nhiều role × nhiều permissions × nhiều user (many-to-many)

**Tech Stack:** Supabase (Postgres + Storage + Edge Functions + Auth), React + TypeScript + Vite, Supabase JS SDK v2, Sharp (Edge Function image processing), Zalo Bot API

---

## PHASE 1 — Supabase Infrastructure

### Task 1: Tạo Supabase Project + Schema ✅ HOÀN THÀNH

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql` ✅
- Modify: `docs/superpowers/plans/2026-05-18-supabase-zalo-migration.md` ✅ (this file - updated with status)

- [x] **Step 1: Tạo Supabase Project** ✅

Truy cập https://supabase.com → tạo project mới → lấy `PROJECT_ID`, `API_URL`, `API_KEY`.

- [x] **Step 2: Chạy SQL Schema** ✅
  - Đã tạo file `supabase/migrations/001_initial_schema.sql`
  - Chạy trong Supabase SQL Editor tại: https://jzhxdwriskdxcivirbip.supabase.co/project/sql
  - File chứa: Schema + RLS policies + seed data (8 roles, 14 permissions)
-- ============================================================
-- NỀN NẾP CNT — Supabase Postgres Schema
-- Migration từ Google Sheets
-- ============================================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ──────────────────────────────────────────────────
CREATE TYPE violation_type AS ENUM ('MINUS', 'PLUS');
CREATE TYPE time_config_type AS ENUM ('WEEK', 'MONTH', 'SEMESTER');
CREATE TYPE audit_action AS ENUM (
  'DELETE_VIOLATION', 'BULK_DELETE', 'UPDATE_VIOLATION',
  'CREATE_VIOLATION', 'SYNC_SETTINGS', 'USER_MANAGEMENT'
);

-- ── TABLES ──────────────────────────────────────────────────

-- 1. permissions (quyền cụ thể)
CREATE TABLE permissions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR(64) UNIQUE NOT NULL, -- e.g. 'violation.create', 'settings.manage'
  label       VARCHAR(128) NOT NULL,        -- e.g. 'Tạo vi phạm', 'Quản lý cài đặt'
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. roles (vai trò — admin tự tạo, gán permissions)
CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(64) UNIQUE NOT NULL,
  label       VARCHAR(128) NOT NULL,
  color       VARCHAR(32) DEFAULT 'gray',
  is_admin    BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. role_permissions (N-N)
CREATE TABLE role_permissions (
  role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. users (Supabase Auth tự tạo bảng auth.users, ta tạo bảng profile)
CREATE TABLE user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         VARCHAR(128) NOT NULL,
  username     VARCHAR(64) UNIQUE NOT NULL,
  email        VARCHAR(256),
  role_ids     UUID[] DEFAULT '{}',        -- mảng vai trò (N-N)
  class_id     VARCHAR(32),                -- lớp phụ trách (GV_CN)
  summary_meetings INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. classes
CREATE TABLE classes (
  id               VARCHAR(32) PRIMARY KEY,  -- e.g. '10A1'
  name             VARCHAR(32) NOT NULL,
  grade            INTEGER     NOT NULL,
  homeroom_teacher VARCHAR(128),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 6. students
CREATE TABLE students (
  id         VARCHAR(32) PRIMARY KEY,  -- e.g. 'S001'
  name       VARCHAR(128) NOT NULL,
  class_id   VARCHAR(32) REFERENCES classes(id),
  bike_number VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. criteria (tiêu chí vi phạm/thành tích)
CREATE TABLE criteria (
  id      VARCHAR(32) PRIMARY KEY,
  content TEXT       NOT NULL,
  points  INTEGER    NOT NULL,
  type    violation_type NOT NULL, -- 'MINUS' = vi phạm (trừ điểm), 'PLUS' = thành tích (cộng điểm)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. violations + achievements gộp chung (type phân biệt)
CREATE TABLE violations (
  id               VARCHAR(64) PRIMARY KEY,
  date             DATE        NOT NULL,
  class_id         VARCHAR(32) REFERENCES classes(id),
  student_id       VARCHAR(32) REFERENCES students(id),  -- NULL nếu vi phạm lớp
  criteria_id      VARCHAR(32) REFERENCES criteria(id),
  points           INTEGER     NOT NULL,  -- dương = vi phạm, âm = thành tích
  note             TEXT,
  images           TEXT[] DEFAULT '{}',   -- mảng URL Supabase Storage
  reported_by      VARCHAR(64) REFERENCES user_profiles(id),
  is_security_report BOOLEAN DEFAULT FALSE,
  timestamp        BIGINT      NOT NULL,  -- Unix ms
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 9. time_configs (tuần, tháng, học kỳ)
CREATE TABLE time_configs (
  id          VARCHAR(32) PRIMARY KEY,
  name        VARCHAR(64) NOT NULL,
  type        time_config_type NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 10. audit_logs
CREATE TABLE audit_logs (
  id              VARCHAR(64) PRIMARY KEY,
  timestamp       BIGINT      NOT NULL,
  user_id         VARCHAR(64) REFERENCES user_profiles(id),
  user_name       VARCHAR(128),
  user_role       VARCHAR(64),
  action          audit_action NOT NULL,
  details         TEXT,
  target_id       VARCHAR(64),
  violation_id    VARCHAR(64),
  violation_date  DATE,
  violation_class VARCHAR(32),
  violation_criteria VARCHAR(128),
  violation_points INTEGER,
  time_str        VARCHAR(64)
);

-- 11. zalo_groups (cấu hình group Zalo cho thống kê)
CREATE TABLE zalo_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_name  VARCHAR(128) NOT NULL,
  group_id    VARCHAR(64) NOT NULL,  -- Zalo OA group ID
  notify_types VARCHAR(32)[] DEFAULT '{}',  -- ['weekly', 'monthly', 'severe']
  class_id    VARCHAR(32) REFERENCES classes(id),  -- NULL = toàn trường
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_violations_date      ON violations(date);
CREATE INDEX idx_violations_class    ON violations(class_id);
CREATE INDEX idx_violations_student ON violations(student_id);
CREATE INDEX idx_violations_timestamp ON violations(timestamp);
CREATE INDEX idx_students_class      ON students(class_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_time_configs_type  ON time_configs(type);

-- ── SEED: Default Permissions ────────────────────────────────
INSERT INTO permissions (slug, label, description) VALUES
  ('violation.create',    'Tạo vi phạm/thành tích',     'Cho phép tạo bản ghi vi phạm'),
  ('violation.read',      'Xem vi phạm',                 'Cho phép xem danh sách vi phạm'),
  ('violation.update',    'Sửa vi phạm',                 'Cho phép sửa bản ghi vi phạm'),
  ('violation.delete',    'Xóa vi phạm',                 'Cho phép xóa bản ghi vi phạm'),
  ('violation.bulk_delete','Xóa hàng loạt',               'Cho phép xóa nhiều vi phạm cùng lúc'),
  ('settings.manage',     'Quản lý cài đặt',             'Quản lý lớp, học sinh, tiêu chí, thời gian'),
  ('users.manage',        'Quản lý tài khoản',           'Tạo/sửa/xóa tài khoản người dùng'),
  ('roles.manage',        'Quản lý vai trò',              'Tạo/sửa vai trò và gán quyền'),
  ('reports.view',         'Xem báo cáo',                 'Xem thống kê, xếp hạng, xuất Excel'),
  ('ranking.view',        'Xem xếp hạng',                'Xem bảng xếp hạng nền nếp'),
  ('audit.view',          'Xem audit log',                'Xem nhật ký hành động'),
  ('image.upload',        'Upload ảnh',                   'Cho phép upload ảnh vi phạm'),
  ('settings.sync',       'Đồng bộ cài đặt',            'Đồng bộ cấu hình lên server'),
  ('zalo.manage',         'Quản lý Zalo Bot',             'Cấu hình Zalo Bot và nhóm');
```

- [x] **Step 3: Setup Row Level Security (RLS)** ✅
  - Đã thêm vào file `supabase/migrations/001_initial_schema.sql`
  - 22 policies + 3 helper functions (get_user_role_ids, has_permission, is_admin_user)

- [x] **Step 4: Seed vai trò mặc định** ✅
  - Đã thêm vào file `supabase/migrations/001_initial_schema.sql`
  - 8 roles (ADMIN, BCH, BCH_PHU_TRACH, RED_FLAG, DISCIPLINE, TEACHER, LEADER, GUEST)
  - 14 permissions đã seed
  - Role permissions đã gán cho BCH, RED_FLAG, TEACHER, GUEST

---

### Task 2: Setup Supabase Storage (Ảnh vi phạm) ✅ HOÀN THÀNH

**Files:**
- Create: `supabase/migrations/002_storage_bucket.sql` ✅
- Cần chạy SQL trong Supabase SQL Editor

- [x] **Step 1: Tạo Storage Bucket** ✅
  - Đã tạo file `supabase/migrations/002_storage_bucket.sql`
  - Bucket: `violation-images` (public, 5MB, WebP/JPEG/PNG/HEIC)

- [x] **Step 2: Storage Policies** ✅
  - Public read policy
  - Authenticated upload policy với permission check (`storage_has_permission`)
  - Admin delete policy

---

### Task 3: Supabase Auth Configuration ✅ HOÀN THÀNH

**Files:**
- Create: `docs/supabase-auth-setup.md` ✅
- Cần chạy SQL trong Supabase SQL Editor

- [x] **Step 1: Cấu hình Auth Providers** ✅
  - Hướng dẫn trong `docs/supabase-auth-setup.md`

- [x] **Step 2: Cấu hình SMTP** ✅
  - Hướng dẫn trong `docs/supabase-auth-setup.md`

- [x] **Step 3: Cấu hình Row Level Security cho auth.users** ✅
  - Đã thêm vào `docs/supabase-auth-setup.md`

```sql
-- Seed default roles
INSERT INTO roles (name, label, color, is_admin) VALUES
  ('ADMIN',         'Quản trị viên',        'blue',   TRUE),
  ('BCH',           'Ban Chấp Hành',         'purple', FALSE),
  ('BCH_PHU_TRACH', 'BCH Phụ trách NN',      'indigo', FALSE),
  ('RED_FLAG',      'Cờ đỏ',                'red',    FALSE),
  ('DISCIPLINE',    'Nền nếp',              'orange', FALSE),
  ('TEACHER',       'Giáo viên CN',          'green',  FALSE),
  ('LEADER',        'Lãnh đạo',              'indigo', TRUE),
  ('GUEST',         'Khách',                'gray',   FALSE)
ON CONFLICT (name) DO NOTHING;

-- Seed vai trò mặc định gán permissions
-- ADMIN: toàn quyền (is_admin = TRUE → bypass RLS)
-- BCH: violation.create + violation.read + reports.view + ranking.view
-- RED_FLAG: violation.create + violation.read
-- TEACHER: violation.read + reports.view + ranking.view (class scope)
-- GUEST: violation.read (class scope)
DO $$
DECLARE
  admin_id UUID := (SELECT id FROM roles WHERE name = 'ADMIN');
  bch_id   UUID := (SELECT id FROM roles WHERE name = 'BCH');
  rf_id    UUID := (SELECT id FROM roles WHERE name = 'RED_FLAG');
  tea_id   UUID := (SELECT id FROM roles WHERE name = 'TEACHER');
  guest_id UUID := (SELECT id FROM roles WHERE name = 'GUEST');
BEGIN
  -- ADMIN có is_admin = TRUE nên không cần gán permissions riêng
  -- BCH
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT bch_id, id FROM permissions WHERE slug IN (
    'violation.create','violation.read','violation.update',
    'reports.view','ranking.view','audit.view'
  ) ON CONFLICT DO NOTHING;

  -- RED_FLAG
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT rf_id, id FROM permissions WHERE slug IN (
    'violation.create','violation.read','image.upload'
  ) ON CONFLICT DO NOTHING;

  -- TEACHER
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT tea_id, id FROM permissions WHERE slug IN (
    'violation.read','reports.view','ranking.view'
  ) ON CONFLICT DO NOTHING;

  -- GUEST
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT guest_id, id FROM permissions WHERE slug IN (
    'violation.read','ranking.view'
  ) ON CONFLICT DO NOTHING;
END $$;
```

---

### Task 2: Setup Supabase Storage (Ảnh vi phạm)

**Files:**
- Create: Supabase Dashboard → Storage

- [x] **Step 1: Tạo Storage Bucket** ✅
  - Đã tạo file `supabase/migrations/002_storage_bucket.sql`
  - Chạy SQL trong Supabase SQL Editor

```sql
-- Tạo bucket cho ảnh vi phạm (public để hiển thị trong webapp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'violation-images',
  'violation-images',
  TRUE,
  5242880,  -- 5MB limit/trước khi nén (gốc từ điện thoại)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);
```

- [x] **Step 2: Storage Policies** ✅
  - Đã thêm vào `supabase/migrations/002_storage_bucket.sql`
  - Fixed: Upload policy kiểm tra `has_permission('image.upload')` thay vì chỉ check authenticated

---

### Task 3: Supabase Auth Configuration

**Files:**
- Modify: Supabase Dashboard → Authentication

- [x] **Step 1: Cấu hình Auth Providers** ✅
  - Hướng dẫn trong `docs/supabase-auth-setup.md`

- [x] **Step 2: Cấu hình SMTP** ✅
  - Hướng dẫn trong `docs/supabase-auth-setup.md`

- [x] **Step 3: Cấu hình Row Level Security cho auth.users** ✅
  - Đã thêm vào `docs/supabase-auth-setup.md`

---

## PHASE 2 — Zalo Bot Infrastructure

### Task 4: Supabase Edge Function cho Zalo Bot Webhook ✅ HOÀN THÀNH

**Files:**
- Create: `supabase/functions/zalo-bot/index.ts` ✅
- Create: `supabase/functions/zalo-bot/types.ts` ✅
- Create: `supabase/functions/zalo-bot/handlers/qa.ts` ✅
- Create: `supabase/functions/zalo-bot/handlers/statistics.ts` ✅
- Create: `supabase/functions/zalo-bot/lib/zalo-api.ts` ✅
- Create: `supabase/functions/zalo-bot/lib/supabase-admin.ts` ⚠️ (integrated vào index.ts)

- [x] **Step 1: Tạo Edge Function handler chính** ✅
  - File: `supabase/functions/zalo-bot/index.ts`
  - Xử lý cả group_message (khi tag bot) và follow event (tin nhắn riêng)
  - Fixed: Token từ env, webhook signature verification, phân biệt group/private

- [x] **Step 2: Tạo types.ts** ✅
  - File: `supabase/functions/zalo-bot/types.ts`

- [x] **Step 3: Tạo Q&A handler** ✅
  - File: `supabase/functions/zalo-bot/handlers/qa.ts`
  - Fixed: SQL injection protection (escape wildcards)

- [x] **Step 4: Tạo Statistics handler** ✅
  - File: `supabase/functions/zalo-bot/handlers/statistics.ts`
  - Fixed: Query `violations` với `type='PLUS'` thay vì table `achievements` không tồn tại

- [x] **Step 5: Deploy Edge Function** ⏳
  - Cần chạy: `supabase functions deploy zalo-bot`

```typescript
// supabase/functions/zalo-bot/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ZaloWebhookPayload, ZaloMessageEvent } from './types.ts';
import { handleQA } from './handlers/qa.ts';
import { handleStatistics } from './handlers/statistics.ts';

const ZALO_BOT_TOKEN = Deno.env.get('ZALO_BOT_TOKEN')!;
const WEBHOOK_SECRET = Deno.env.get('ZALO_BOT_SECRET_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Tạo Supabase admin client (bypass RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req: Request) => {
  // ── Webhook verification (GET) ────────────────────────────
  if (req.method === 'GET') {
    const secretToken = req.headers.get('x-bot-api-secret-token');
    if (secretToken !== WEBHOOK_SECRET) {
      return Response.json({ message: 'Unauthorized' }, { status: 403 });
    }
    const url = new URL(req.url);
    const verifyToken = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (verifyToken === WEBHOOK_SECRET) {
      return new Response(challenge, { status: 200 });
    }
    return Response.json({ message: 'Invalid verify_token' }, { status: 400 });
  }

  // ── Handle incoming messages (POST) ─────────────────────
  const secretToken = req.headers.get('x-bot-api-secret-token');
  if (secretToken !== WEBHOOK_SECRET) {
    return Response.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const payload: ZaloWebhookPayload = await req.json();
    
    // Xử lý từng event trong message event
    if (payload.event === 'group_message') {
      const message = payload.message;
      
      // Kiểm tra xem có phải reply message (bot được tag)
      if (message.msg_type !== 'reply') {
        return Response.json({ status: 'ignored' });
      }

      const senderId = payload.sender_id;
      const groupId = payload.group_id;
      const content = (message.content || '').trim().toLowerCase();

      let reply = '';

      // ── Q&A Mode ───────────────────────────────────────
      if (content.includes('hỏi') || content.includes('?')) {
        reply = await handleQA(supabaseAdmin, content, groupId);
      }
      // ── Statistics Mode ───────────────────────────────
      else if (
        content.includes('thống kê') ||
        content.includes('tổng kết') ||
        content.includes('xếp hạng') ||
        content.includes('báo cáo')
      ) {
        reply = await handleStatistics(supabaseAdmin, content, groupId);
      }
      // ── Help ─────────────────────────────────────────
      else if (content.includes('help') || content.includes('trợ giúp')) {
        reply = `🤖 Bot Nền Nếp CNT\n\n`
          + `📌 Các lệnh:\n`
          + `• "@bot thống kê [tuần/tháng/học kỳ]" — xem thống kê\n`
          + `• "@bot xếp hạng" — bảng xếp hạng nền nếp\n`
          + `• "@bot hỏi [câu hỏi]" — hỏi đáp về vi phạm\n`
          + `• "@bot top 10" — top vi phạm nhiều nhất`;
      }
      else {
        reply = `🤖 Tôi không hiểu. Gõ "@bot help" để xem các lệnh.`;
      }

      // Gửi reply
      await sendZaloMessage(senderId, groupId, reply);

      return Response.json({ status: 'ok', reply });
    }

    return Response.json({ status: 'ignored' });
  } catch (err) {
    console.error('Zalo webhook error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ── Gửi tin nhắn Zalo ──────────────────────────────────────────
async function sendZaloMessage(
  senderId: string,
  groupId: string,
  message: string
): Promise<void> {
  await fetch(`https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZALO_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      recipient: { group_id: groupId },
      message: { text: message },
    }),
  });
}
```

- [ ] **Step 2: Tạo types.ts**

```typescript
// supabase/functions/zalo-bot/types.ts
export interface ZaloWebhookPayload {
  event: string;
  sender_id: string;
  group_id: string;
  message: {
    msg_type: string;  // 'reply' = reply trong group
    content: string;
    message_id: string;
  };
  timestamp: number;
}

export interface ViolationStats {
  totalViolations: number;
  totalAchievements: number;
  topStudents: { name: string; classId: string; points: number }[];
  topClasses: { name: string; grade: number; avgScore: number }[];
  periodLabel: string;
}

export interface ZaloGroupConfig {
  group_id: string;
  group_name: string;
  notify_types: string[];
  class_id: string | null;
}
```

- [ ] **Step 3: Tạo Q&A handler**

```typescript
// supabase/functions/zalo-bot/handlers/qa.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function handleQA(
  supabase: SupabaseClient,
  query: string,
  groupId: string
): Promise<string> {
  // Xóa prefix "hỏi " hoặc "?"
  const question = query
    .replace(/@bot/gi, '')
    .replace(/hỏi\s*/gi, '')
    .replace(/\?/g, '')
    .trim();

  if (!question) {
    return '❓ Vui lòng nhập câu hỏi cụ thể. Ví dụ: "@bot hỏi lớp 10A1 có bao nhiêu vi phạm tuần này"';
  }

  // ── Parse câu hỏi để trích xuất entity ──────────────────
  // Format: "hỏi [lớp/student] [name] [thời gian]"

  // Tìm lớp trong câu hỏi
  const classMatch = question.match(/(lớp|lop)\s*(\d+[A-Z]\d)/i)
    || question.match(/(\d+[A-Z]\d)/i);
  const classId = classMatch ? classMatch[2] || classMatch[1] : null;

  // Tìm tên học sinh
  const studentMatch = question.match(/hs\s*([^\s]+)/i)
    || question.match(/học sinh\s*([^\s,]+)/i);
  const studentName = studentMatch ? studentMatch[1] : null;

  // ── Truy vấn Supabase ──────────────────────────────────
  let violationsQuery = supabase
    .from('violations')
    .select(`
      id,
      date,
      class_id,
      points,
      note,
      criteria:criteria(content, points, type),
      students:students(name, class_id)
    `)
    .order('date', { ascending: false })
    .limit(10);

  if (classId) {
    violationsQuery = violationsQuery.eq('class_id', classId.toUpperCase());
  }

  const { data: violations, error } = await violationsQuery;

  if (error || !violations || violations.length === 0) {
    return `🔍 Không tìm thấy dữ liệu vi phạm${classId ? ` cho lớp ${classId}` : ''}.`;
  }

  // Tổng hợp câu trả lời
  const totalPoints = violations.reduce((sum, v) => sum + v.points, 0);
  const count = violations.length;
  const latest = violations[0];

  let response = `📋 Kết quả${classId ? ` cho lớp ${classId}` : ''}:\n\n`;
  response += `• Tổng số vi phạm: ${count}\n`;
  response += `• Tổng điểm trừ: ${totalPoints}\n`;
  response += `• Vi phạm gần nhất: ${latest?.date} - ${latest?.criteria?.content || 'N/A'}\n`;

  return response;
}
```

- [ ] **Step 4: Tạo Statistics handler**

```typescript
// supabase/functions/zalo-bot/handlers/statistics.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function handleStatistics(
  supabase: SupabaseClient,
  query: string,
  groupId: string
): Promise<string> {
  // Xác định khoảng thời gian từ query
  let period = 'tuần này';
  let startDate: string;
  let endDate: string = new Date().toISOString().split('T')[0];

  if (query.includes('tháng') || query.includes('month')) {
    period = 'tháng này';
    const now = new Date();
    startDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  } else if (query.includes('học kỳ') || query.includes('hk')) {
    period = 'học kỳ';
    const now = new Date();
    const term = now.getMonth() < 6 ? 'HK1' : 'HK2';
    startDate = `${now.getFullYear()}-09-01`;
    endDate = `${now.getFullYear()}-12-31`;
  } else {
    // Mặc định: tuần này (tính từ thứ 2)
    period = 'tuần này';
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startDate = new Date(now.setDate(diff)).toISOString().split('T')[0];
  }

  // ── Lấy violations trong khoảng thời gian ────────────────
  const { data: violations } = await supabase
    .from('violations')
    .select(`
      id, date, class_id, points,
      criteria:criteria(content, type)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (!violations || violations.length === 0) {
    return `📊 Thống kê ${period}: Không có dữ liệu vi phạm.`;
  }

  // ── Tính toán stats ──────────────────────────────────────
  const totalMinus = violations
    .filter(v => v.criteria?.type === 'MINUS')
    .reduce((s, v) => s + v.points, 0);
  const totalPlus = violations
    .filter(v => v.criteria?.type === 'PLUS')
    .reduce((s, v) => s + Math.abs(v.points), 0);
  const totalViolations = violations.filter(v => v.criteria?.type === 'MINUS').length;

  // Top 5 lớp vi phạm nhiều nhất
  const classCount: Record<string, number> = {};
  violations.forEach(v => {
    if (v.criteria?.type === 'MINUS') {
      classCount[v.class_id] = (classCount[v.class_id] || 0) + 1;
    }
  });
  const topClasses = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([classId, count]) => ({ classId, count }));

  let response = `📊 Thống kê ${period} (${startDate} → ${endDate}):\n\n`;
  response += `• Tổng vi phạm: ${totalViolations}\n`;
  response += `• Tổng điểm trừ: ${totalMinus}\n`;
  response += `• Tổng điểm cộng: ${totalPlus}\n`;
  response += `\n🏆 Top lớp vi phạm nhiều nhất:\n`;
  topClasses.forEach((c, i) => {
    response += `  ${i+1}. Lớp ${c.classId}: ${c.count} vi phạm\n`;
  });

  return response;
}
```

- [ ] **Step 5: Deploy Edge Function**

```bash
supabase functions deploy zalo-bot
```

---

### Task 5: Zalo Bot — Cron Job cho thống kê định kỳ ✅ HOÀN THÀNH

**Files:**
- Create: `supabase/functions/zalo-scheduler/index.ts` ✅
- Create: `supabase/migrations/003_zalo_scheduler.sql` ✅

- [x] **Step 1: Tạo scheduler function** ✅
  - File: `supabase/functions/zalo-scheduler/index.ts`
  - Gửi weekly report (Chủ Nhật) và monthly report (ngày 28-31)
  - Fixed: Date mutation bug

- [x] **Step 2: Setup Supabase Cron Job** ⏳
  - SQL: `supabase/migrations/003_zalo_scheduler.sql`
  - Cần enable pg_cron extension và chạy SQL trong Supabase

---

## PHASE 3 — Frontend Migration

### Task 6: Tạo Supabase Client + Thay thế API Layer ✅ HOÀN THÀNH

**Files:**
- Create: `services/supabase.ts` ✅
- Create: `.env.example` ✅
- Modify: `types.ts` ⚠️ (UserProfile type đã có sẵn)
- Modify: `contexts/AppContext.tsx` ⏳ (cần tích hợp Supabase thay vì GAS)

- [x] **Step 1: Tạo Supabase client** ✅
  - File: `services/supabase.ts`
  - Auth helpers, CRUD helpers, storage helpers
  - Fixed: Removed hardcoded URL/key fallbacks, added URL verification after upload, batchUpdateViolations uses upsert

- [x] **Step 2: Thêm env variables** ✅
  - File: `.env.example`

- [ ] **Step 3: Update types.ts** ⏳
  - UserProfile interface đã có trong types.ts

- [ ] **Step 4: Cập nhật AppContext để dùng Supabase** ⏳
  - Cần thay `api.getAllData()` bằng `getAllData()` từ supabase.ts
  - Cần cập nhật tất cả `api.xxx()` calls

---

### Task 7: Image Compression Pipeline ✅ HOÀN THÀNH

**Files:**
- Create: `utils/imageCompress.ts` ✅

- [x] **Step 1: Tạo hàm compress** ✅
  - File: `utils/imageCompress.ts`
  - Functions: `compressImage`, `blobToBase64`, `createThumbnail`
  - WebP 85%, 1920px max resize

```typescript
// utils/imageCompress.ts
/**
 * Nén ảnh vi phạm: resize max 1920px + WebP 85%
 * Trả về Blob WebP để upload lên Supabase Storage
 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const img = await createImageBitmap(file);
  const originalWidth = img.width;
  const originalHeight = img.height;

  // ── Resize: max 1920px chiều rộng ────────────────────────
  const MAX_WIDTH = 1920;
  let { width, height } = { width: originalWidth, height: originalHeight };

  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  // ── Vẽ vào canvas ───────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // ── Export as WebP 85% ───────────────────────────────────
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
      'image/webp',
      0.85
    );
  });

  return blob;
}

/**
 * Chuyển File/Blob thành base64 (cho preview trước khi upload)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Tạo thumbnail data URL (cho preview nhanh trong UI)
 */
export async function createThumbnail(file: File | Blob, maxSize = 200): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.8);
}
```

---

### Task 8: RBAC Settings UI (Admin Panel) ✅ HOÀN THÀNH

**Files:**
- Create: `components/settings/SettingsRolesTab.tsx` ✅
- Create: `components/settings/SettingsPermissionsTab.tsx` ✅
- Modify: `components/settings/SettingsTab.tsx` ✅
- Modify: `components/settings/SettingsAccountsTab.tsx` ✅

- [x] **Step 1: SettingsRolesTab — UI quản lý vai trò** ✅
  - File: `components/settings/SettingsRolesTab.tsx`
  - CRUD roles, gán permissions cho role

- [x] **Step 2: Cập nhật SettingsAccountsTab** ✅
  - Thêm "Phân quyền" button trong bảng users
  - Modal multi-select roles, lưu vào `user_profiles.role_ids`

---

## PHASE 4 — Data Migration

### Task 9: Di chuyển data từ Google Sheets sang Supabase ✅ HOÀN THÀNH

**Files:**
- Create: `scripts/migrate-google-sheets-to-supabase.ts` ✅

- [x] **Step 1: Tạo migration script** ✅
  - File: `scripts/migrate-google-sheets-to-supabase.ts`
  - Hỗ trợ load từ local JSON backup hoặc GAS endpoint
  - Fallback: tạo sample data nếu không có backup
  - Migrate order: classes → students → criteria → users → violations → time_configs

---

### Task 10: Image Migration (Google Drive → Supabase Storage) ✅ HOÀN THÀNH

**Files:**
- Create: `scripts/migrate-images.ts` ✅
- Create: `scripts/migrate-images-simple.ts` ✅

- [x] **Step 1: Tạo image migration script** ✅
  - File: `scripts/migrate-images.ts` - full migration từ Drive
  - File: `scripts/migrate-images-simple.ts` - simplified từ local files
  - Compress: WebP 85%, 1920px max
  - Upload to Supabase Storage, update violation records

---

## PHASE 5 — Integration & Testing

### Task 11: Zalo OA Setup + Webhook Registration ✅ HOÀN THÀNH

**Files:**
- Create: `docs/zalo-oa-setup.md` ✅

- [x] **Step 1: Register webhook với Zalo** ✅
  - Hướng dẫn trong `docs/zalo-oa-setup.md`
  - Cần chạy curl command để set webhook URL

- [x] **Step 2: Cấu hình environment variables trong Supabase** ✅
  - Hướng dẫn trong `docs/zalo-oa-setup.md`
  - ZALO_BOT_TOKEN, ZALO_BOT_SECRET_TOKEN, CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

---

### Task 12: End-to-End Testing Checklist ✅ HOÀN THÀNH

**Files:**
- Create: `docs/testing-checklist.md` ✅

- [x] **Step 1: Tạo testing checklist** ✅
  - File: `docs/testing-checklist.md`
  - Bao gồm: Auth, Violations CRUD, Image Compression, RBAC, Zalo Bot (private + group), Settings, Data Migration, Performance, Security

---

## PHASE 6 — Deployment & Cutover

### Task 13: Environment Setup + Deploy 🔄 ĐANG THỰC HIỆN

- [x] **Step 1: Chạy SQL migrations trong Supabase** ✅
  - `supabase db push` đã chạy thành công cả 3 migrations
  - Fixed: `uuid_generate_v4()` → `gen_random_uuid()` (Supabase pgcrypto)

- [x] **Step 2: Deploy Edge Functions** ✅
  - `supabase functions deploy zalo-bot` ✅
  - `supabase functions deploy zalo-scheduler` ✅
  - Đã set secrets: `ZALO_BOT_TOKEN`, `ZALO_BOT_SECRET_TOKEN`

- [x] **Step 3: Đăng ký Webhook với Zalo** ✅
  - Webhook URL: `https://jzhxdwriskdxcivirbip.supabase.co/functions/v1/zalo-bot`
  - Secret token: `CntBotSecret2026`
  - Verify token: `CntBotSecret2026`
  - Đã test: `{"success":true}` với các commands help, thống kê, hỏi lớp

- [ ] **Step 4: Deploy frontend lên Netlify** ⏳
  - Build: `npm run build`
  - Update VITE_SUPABASE_URL trong Netlify env vars

- [ ] **Step 5: Disable GAS deployment** (không xóa, để backup)

---

## File Map

```
supabase/
  functions/
    zalo-bot/
      index.ts          ← Edge Function webhook handler
      types.ts          ← Zalo payload types
      handlers/
        qa.ts           ← Q&A handler
        statistics.ts   ← Statistics handler
      lib/
        zalo-api.ts     ← Zalo API client
    zalo-scheduler/
      index.ts          ← Cron job handler (weekly/monthly reports)

services/
  supabase.ts           ← NEW: Supabase client + CRUD helpers

utils/
  imageCompress.ts      ← NEW: WebP compression (resize 1920px, 85%)

scripts/
  migrate-google-sheets-to-supabase.ts  ← One-time data migration
  migrate-images.ts                      ← Image migration (Drive → Storage)

components/
  settings/
    SettingsRolesTab.tsx      ← NEW: RBAC role management UI
    SettingsPermissionsTab.tsx ← NEW: Permission management UI
```

---

## Dependencies Between Tasks

```
Task 1 (Schema)        → prerequisites: Supabase project created
Task 2 (Storage)       → prerequisites: Task 1 complete
Task 3 (Auth Config)   → prerequisites: Task 1 complete
Task 4 (Zalo Bot EF)   → prerequisites: Task 3, Supabase project
Task 5 (Cron Job)      → prerequisites: Task 4
Task 6 (Frontend)     → prerequisites: Task 1, 2, 3
Task 7 (Image Comp)    → prerequisites: Task 6
Task 8 (RBAC UI)       → prerequisites: Task 6
Task 9 (Data Migrate)  → prerequisites: Task 1, 2, 3, 6
Task 10 (Image Migrate)→ prerequisites: Task 1, 2, 7, 9
Task 11 (Zalo Setup)   → prerequisites: Task 4, 5
Task 12 (Testing)      → prerequisites: Task 9, 10, 11
Task 13 (Deploy)       → prerequisites: Task 12
```

---

## Recommended Order

**Phase 1 (Week 1):** Tasks 1-3 — Database + Auth setup
**Phase 2 (Week 2):** Tasks 4-5 — Zalo Bot backend
**Phase 3 (Week 3):** Tasks 6-8 — Frontend migration
**Phase 4 (Week 4):** Tasks 9-10 — Data migration
**Phase 5 (Week 5):** Tasks 11-12 — Integration + Testing
**Phase 6 (Week 6):** Task 13 — Deployment + Cutover

---

## Summary

### Completed Tasks ✅

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Supabase Schema + RLS + Seed | ✅ Hoàn thành |
| Task 2 | Supabase Storage Bucket | ✅ Hoàn thành |
| Task 3 | Supabase Auth Configuration | ✅ Hoàn thành |
| Task 4 | Zalo Bot Edge Function | ✅ Hoàn thành |
| Task 5 | Zalo Scheduler (Cron) | ✅ Hoàn thành |
| Task 6 | Supabase Client Layer | ✅ Hoàn thành (code) |
| Task 7 | Image Compression Pipeline | ✅ Hoàn thành |
| Task 8 | RBAC Settings UI | ✅ Hoàn thành |
| Task 9 | Data Migration Script | ✅ Hoàn thành |
| Task 10 | Image Migration Script | ✅ Hoàn thành |
| Task 11 | Zalo OA Webhook Setup | ✅ Hoàn thành (docs) |
| Task 12 | Testing Checklist | ✅ Hoàn thành |

### Not Completed Tasks ⏳

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 6 (Step 4) | AppContext Integration | ⏳ Chưa làm | Cần tích hợp Supabase vào AppContext thay GAS |
| Task 13 | Deployment & Cutover | 🔄 Đang thực hiện | SQL ✅, Edge Funcs ✅, Zalo Webhook ✅ |
| Task 13 (Step 4-5) | Frontend Deploy + GAS Cutover | ⏳ Chưa làm | Netlify + env vars |

### Files Created

```
supabase/
  migrations/
    001_initial_schema.sql    ← Schema + RLS + Seed
    002_storage_bucket.sql   ← Storage bucket + policies
    003_zalo_scheduler.sql    ← Cron job setup
  functions/
    zalo-bot/
      index.ts               ← Webhook handler
      types.ts               ← Types
      handlers/
        qa.ts                ← Q&A handler
        statistics.ts       ← Statistics handler
      lib/
        zalo-api.ts          ← Zalo API client
    zalo-scheduler/
      index.ts               ← Cron scheduler

services/
  supabase.ts                ← Supabase client

utils/
  imageCompress.ts           ← WebP compression

components/settings/
  SettingsRolesTab.tsx       ← RBAC roles UI
  SettingsPermissionsTab.tsx ← Permissions viewer

scripts/
  migrate-google-sheets-to-supabase.ts
  migrate-images.ts
  migrate-images-simple.ts

docs/
  supabase-auth-setup.md
  zalo-oa-setup.md
  testing-checklist.md
```

### Security Fixes Applied

1. ✅ Removed hardcoded Zalo bot token → use env vars
2. ✅ Added webhook signature verification (HMAC-SHA256)
3. ✅ Fixed SQL injection in Q&A handler
4. ✅ Fixed Zalo API URL (double token bug)
5. ✅ Fixed follow event group/private distinction
6. ✅ Fixed storage policy permission check
7. ✅ Fixed UUID type mismatch in schema
8. ✅ Removed hardcoded Supabase URL/key fallbacks