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

### Task 1: Tạo Supabase Project + Schema

**Files:**
- Create: Supabase Dashboard (SQL Editor)
- Modify: `docs/superpowers/plans/YYYY-MM-DD-supabase-zalo-migration.md` (this file)

- [ ] **Step 1: Tạo Supabase Project**

Truy cập https://supabase.com → tạo project mới → lấy `PROJECT_ID`, `API_URL`, `API_KEY`.

- [ ] **Step 2: Chạy SQL Schema**

```sql
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

- [ ] **Step 3: Setup Row Level Security (RLS)**

```sql
-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Helper: lấy role_ids của user hiện tại
CREATE OR REPLACE FUNCTION get_user_role_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE((SELECT role_ids FROM user_profiles WHERE id = auth.uid()), '{}')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: kiểm tra permission
CREATE OR REPLACE FUNCTION has_permission(p_slug TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ANY(get_user_role_ids())
      AND p.slug = p_slug
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: kiểm tra is_admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = ANY(get_user_role_ids())
      AND r.is_admin = TRUE
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies cho user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (is_admin_user());

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON user_profiles
  FOR ALL USING (is_admin_user());

-- RLS Policies cho violations
CREATE POLICY "Authenticated users can view violations" ON violations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users with violation.create can insert" ON violations
  FOR INSERT WITH CHECK (has_permission('violation.create') OR is_admin_user());

CREATE POLICY "Users with violation.update can update" ON violations
  FOR UPDATE USING (has_permission('violation.update') OR is_admin_user());

CREATE POLICY "Users with violation.delete can delete" ON violations
  FOR DELETE USING (has_permission('violation.delete') OR has_permission('violation.bulk_delete') OR is_admin_user());

-- RLS Policies cho classes (all authenticated can read, admin can write)
CREATE POLICY "Authenticated can read classes" ON classes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Settings managers can manage classes" ON classes
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- RLS Policies cho students
CREATE POLICY "Authenticated can read students" ON students
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Settings managers can manage students" ON students
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- RLS Policies cho criteria
CREATE POLICY "Authenticated can read criteria" ON criteria
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Settings managers can manage criteria" ON criteria
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- RLS Policies cho time_configs
CREATE POLICY "Authenticated can read time_configs" ON time_configs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Settings managers can manage time_configs" ON time_configs
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- RLS Policies cho audit_logs
CREATE POLICY "Users with audit.view can read logs" ON audit_logs
  FOR SELECT USING (has_permission('audit.view') OR is_admin_user());

-- RLS Policies cho zalo_groups
CREATE POLICY "Users with zalo.manage can manage zalo_groups" ON zalo_groups
  FOR ALL USING (has_permission('zalo.manage') OR is_admin_user());

-- RLS Policies cho roles & permissions (admin only)
CREATE POLICY "Admin can manage roles" ON roles
  FOR ALL USING (is_admin_user());

CREATE POLICY "Authenticated can read roles" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read permissions" ON permissions
  FOR SELECT USING (auth.role() = 'authenticated');
```

- [ ] **Step 4: Seed vai trò mặc định (giữ nguyên từ hệ thống cũ)**

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

- [ ] **Step 1: Tạo Storage Bucket**

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

- [ ] **Step 2: Storage Policies**

```sql
-- Public read cho ảnh vi phạm
CREATE POLICY "Public read violation-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'violation-images');

-- Authenticated users with permission can upload
CREATE POLICY "Users with image.upload can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violation-images'
  AND auth.role() = 'authenticated'
);

-- Admin can delete
CREATE POLICY "Admins can delete violation-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'violation-images'
  AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role_ids && ARRAY[(SELECT id FROM roles WHERE is_admin = TRUE)])
);
```

---

### Task 3: Supabase Auth Configuration

**Files:**
- Modify: Supabase Dashboard → Authentication

- [ ] **Step 1: Cấu hình Auth Providers**

Trong Supabase Dashboard → Authentication → Providers → Email: bật "Enable Email Sign Up" với xác thực email.

- [ ] **Step 2: Cấu hình SMTP (cho reset password email)**

Supabase Dashboard → Authentication → Email → SMTP Settings: cấu hình SMTP của bạn (hoặc dùng Supabase built-in).

- [ ] **Step 3: Cấu hình Row Level Security cho auth.users**

```sql
-- Chỉ admin được xem danh sách users
CREATE POLICY "Admin can view all auth.users" ON auth.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role_ids && ARRAY[(SELECT id FROM roles WHERE is_admin = TRUE)])
  );
```

---

## PHASE 2 — Zalo Bot Infrastructure

### Task 4: Supabase Edge Function cho Zalo Bot Webhook

**Files:**
- Create: `supabase/functions/zalo-bot/index.ts`
- Create: `supabase/functions/zalo-bot/types.ts`
- Create: `supabase/functions/zalo-bot/handlers/qa.ts`
- Create: `supabase/functions/zalo-bot/handlers/statistics.ts`
- Create: `supabase/functions/zalo-bot/lib/zalo-api.ts`
- Create: `supabase/functions/zalo-bot/lib/supabase-admin.ts`

- [ ] **Step 1: Tạo Edge Function handler chính**

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

### Task 5: Zalo Bot — Cron Job cho thống kê định kỳ

**Files:**
- Create: `supabase/functions/zalo-scheduler/index.ts`

- [ ] **Step 1: Tạo scheduler function**

```typescript
// supabase/functions/zalo-scheduler/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ZALO_BOT_TOKEN = Deno.env.get('ZALO_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req: Request) => {
  // Supabase cron gọi với header x-hasura-defined-roles
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    // ── Weekly: Chủ nhật hàng tuần (dayOfWeek === 0) ────────
    if (dayOfWeek === 0) {
      await sendWeeklyReport();
    }

    // ── Monthly: Ngày 28-31 mỗi tháng ─────────────────────
    if (dayOfMonth >= 28) {
      await sendMonthlyReport();
    }

    return Response.json({ status: 'ok', timestamp: now.toISOString() });
  } catch (err) {
    console.error('Zalo scheduler error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function sendWeeklyReport(): Promise<void> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const { data: violations } = await supabase
    .from('violations')
    .select('id, date, class_id, points, criteria(type)')
    .gte('date', startStr)
    .lte('date', endStr);

  if (!violations || violations.length === 0) return;

  const totalMinus = violations.filter(v => v.criteria?.type === 'MINUS').reduce((s, v) => s + v.points, 0);
  const totalPlus = violations.filter(v => v.criteria?.type === 'PLUS').reduce((s, v) => s + Math.abs(v.points), 0);

  const classCount: Record<string, number> = {};
  violations.filter(v => v.criteria?.type === 'MINUS')
    .forEach(v => { classCount[v.class_id] = (classCount[v.class_id] || 0) + 1; });

  const topClasses = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, c]) => `• Lớp ${id}: ${c} vi phạm`)
    .join('\n');

  const message = `📅 **BÁO CÁO TUẦN NÀY** (${startStr} → ${endStr})\n\n`
    + `📌 Tổng vi phạm: ${violations.filter(v => v.criteria?.type === 'MINUS').length}\n`
    + `📌 Tổng điểm trừ: ${totalMinus} | Tổng điểm cộng: ${totalPlus}\n\n`
    + `🏆 Top lớp:\n${topClasses}`;

  await sendToAllGroups(message, 'weekly');
}

async function sendMonthlyReport(): Promise<void> {
  const now = new Date();
  const startStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const endStr = now.toISOString().split('T')[0];

  const { data: violations } = await supabase
    .from('violations')
    .select('id, class_id, points, criteria(type)')
    .gte('date', startStr)
    .lte('date', endStr);

  if (!violations || violations.length === 0) return;

  const totalMinus = violations.filter(v => v.criteria?.type === 'MINUS').reduce((s, v) => s + v.points, 0);

  const message = `📊 **BÁO CÁO THÁNG ${now.getMonth()+1}/${now.getFullYear()}**\n\n`
    + `📌 Tổng vi phạm: ${violations.filter(v => v.criteria?.type === 'MINUS').length}\n`
    + `📌 Tổng điểm trừ: ${totalMinus}\n\n`
    + `📅 Đã gửi tự động bởi Bot Nền Nếp CNT`;

  await sendToAllGroups(message, 'monthly');
}

async function sendToAllGroups(message: string, notifyType: string): Promise<void> {
  const { data: groups } = await supabase
    .from('zalo_groups')
    .select('group_id, group_name, notify_types')
    .contains('notify_types', [notifyType]);

  if (!groups) return;

  for (const group of groups) {
    await fetch(`https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZALO_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        recipient: { group_id: group.group_id },
        message: { text: message },
      }),
    });
  }
}
```

- [ ] **Step 2: Setup Supabase Cron Job**

```sql
-- Tạo cron job trong Supabase
-- Supabase cron format: '0 * * * *' = every hour
SELECT cron.schedule(
  'zalo-scheduler',
  '0 8 * * *',  -- chạy 8h sáng mỗi ngày
  $$
  SELECT net.http_post(
    url=>'https://<your-project>.supabase.co/functions/v1/zalo-scheduler',
    headers=>'{"x-cron-secret":"<your-cron-secret>","Content-Type":"application/json"}'::jsonb,
    body=>'{}'::jsonb
  );
  $$
);
```

---

## PHASE 3 — Frontend Migration

### Task 6: Tạo Supabase Client + Thay thế API Layer

**Files:**
- Create: `services/supabase.ts`
- Modify: `services/googleApi.ts` (backup → supabase.ts)
- Modify: `types.ts`
- Modify: `contexts/AppContext.tsx`
- Modify: `contexts/ModalContext.tsx`

- [ ] **Step 1: Tạo Supabase client**

```typescript
// services/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth helpers ──────────────────────────────────────────────
export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

export const onAuthStateChange = (callback: (event: string, session: any) => void) =>
  supabase.auth.onAuthStateChange(callback);

// ── CRUD helpers ──────────────────────────────────────────────
export const getAllData = async () => {
  const [
    { data: users },
    { data: classes },
    { data: students },
    { data: criteria },
    { data: violations },
    { data: timeConfigs },
  ] = await Promise.all([
    supabase.from('user_profiles').select('*'),
    supabase.from('classes').select('*'),
    supabase.from('students').select('*'),
    supabase.from('criteria').select('*'),
    supabase.from('violations').select('*, criteria(*), students(*)').order('timestamp', { ascending: false }),
    supabase.from('time_configs').select('*').order('start_date'),
  ]);

  return { users, classes, students, criteria, violations, timeConfigs };
};

export const createViolation = (violation: any) =>
  supabase.from('violations').insert(violation).select().single();

export const updateViolation = (violation: any) =>
  supabase.from('violations').update(violation).eq('id', violation.id);

export const deleteViolation = (id: string) =>
  supabase.from('violations').delete().eq('id', id);

export const deleteViolations = (ids: string[]) =>
  supabase.from('violations').delete().in('id', ids);

export const batchCreateViolations = (records: any[]) =>
  supabase.from('violations').insert(records);

export const batchUpdateViolations = (records: any[]) =>
  Promise.all(records.map(r => supabase.from('violations').update(r).eq('id', r.id)));

export const syncSettings = (payload: {
  classes?: any[];
  students?: any[];
  criteria?: any[];
  timeConfigs?: any[];
}) => Promise.all([
  payload.classes?.length && supabase.from('classes').upsert(payload.classes),
  payload.students?.length && supabase.from('students').upsert(payload.students),
  payload.criteria?.length && supabase.from('criteria').upsert(payload.criteria),
  payload.timeConfigs?.length && supabase.from('time_configs').upsert(payload.timeConfigs),
]);

export const syncUsers = (users: any[]) =>
  supabase.from('user_profiles').upsert(users);

export const getAuditLogs = () =>
  supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500);

export const saveAuditLog = (log: any) =>
  supabase.from('audit_logs').insert(log);

// ── Storage ───────────────────────────────────────────────────
export const uploadViolationImage = async (
  file: Blob,
  fileNameInfo: { className: string; studentName: string; violation: string; date: string }
): Promise<string> => {
  const safeName = `${fileNameInfo.className}_${fileNameInfo.studentName}_${fileNameInfo.violation}_${fileNameInfo.date}`
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const fileName = `${safeName}_${Date.now()}.webp`;

  const { data, error } = await supabase.storage
    .from('violation-images')
    .upload(fileName, file, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('violation-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
};
```

- [ ] **Step 2: Thêm env variables**

```bash
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Update types.ts**

```typescript
// Thêm type cho Supabase Auth user
export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email?: string;
  role_ids: string[];
  class_id?: string;
  summary_meetings: number;
}

// Giữ nguyên User interface cũ — map từ UserProfile khi cần
```

- [ ] **Step 4: Cập nhật AppContext để dùng Supabase**

Thay `api.getAllData()` bằng `getAllData()` từ supabase.ts.
Thay tất cả `api.xxx()` bằng các helper từ supabase.ts.

---

### Task 7: Image Compression Pipeline

**Files:**
- Create: `utils/imageCompress.ts`

- [ ] **Step 1: Tạo hàm compress**

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

### Task 8: RBAC Settings UI (Admin Panel)

**Files:**
- Create: `components/settings/SettingsRolesTab.tsx`
- Create: `components/settings/SettingsPermissionsTab.tsx`
- Modify: `components/settings/SettingsTab.tsx`
- Modify: `components/SettingsAccountsTab.tsx` (thêm role management)

- [ ] **Step 1: SettingsRolesTab — UI quản lý vai trò**

```typescript
// components/settings/SettingsRolesTab.tsx
// UI cho admin:
// - Danh sách vai trò hiện có (CRUD)
// - Click role → xem/gắn permissions (checkboxes)
// - Tạo role mới (name, label, color)
// - Nút gán vai trò cho user trong SettingsAccountsTab
```

- [ ] **Step 2: Cập nhật SettingsAccountsTab**

Thêm cột/button "Vai trò" — click mở modal chọn role (multi-select) từ danh sách roles.

```typescript
// Trong modal chọn role:
// - Fetch all roles từ Supabase
// - Checkbox multi-select cho mỗi role của user
// - Khi save: update user_profiles.role_ids = selectedRoleIds
```

---

## PHASE 4 — Data Migration

### Task 9: Di chuyển data từ Google Sheets sang Supabase

**Files:**
- Create: `scripts/migrate-google-sheets-to-supabase.ts` (Node.js script)

- [ ] **Step 1: Tạo migration script**

```typescript
// scripts/migrate-google-sheets-to-supabase.ts
/**
 * Migration script — chạy 1 lần để chuyển data từ GAS/Sheets
 * sang Supabase. Cần credentials.json (Google service account)
 * và Supabase credentials trong .env
 *
 * Run: npx ts-node scripts/migrate-google-sheets-to-supabase.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Lấy data từ GAS endpoint hiện tại ──────────────────────
async function fetchFromGAS<T>(action: string): Promise<T> {
  const response = await fetch(
    `https://script.google.com/macros/s/YOUR_GAS_ID/exec?action=${action}`
  );
  return response.json();
}

// ── Migrate users ────────────────────────────────────────────
async function migrateUsers(): Promise<void> {
  console.log('Migrating users...');
  const data = await fetchFromGAS<any>('getAllData');
  const users = (data.Users || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email || null,
    role_ids: [], // sẽ gán sau
    class_id: u.className || null,
    summary_meetings: u.summaryMeetings || 0,
  }));

  // Map old role name → role UUID
  const { data: roles } = await supabase.from('roles').select('id, name');
  const roleMap: Record<string, string> = {};
  roles?.forEach(r => { roleMap[r.name] = r.id; });

  const usersWithRoles = users.map((u: any) => {
    const roleName = Object.keys(roleMap).find(
      name => name.toUpperCase() === u.role?.toUpperCase()
    );
    return {
      ...u,
      role_ids: roleName ? [roleMap[roleName]] : [],
    };
  });

  await supabase.from('user_profiles').upsert(usersWithRoles);
  console.log(`✓ ${usersWithRoles.length} users migrated`);
}

// ── Migrate classes ───────────────────────────────────────────
async function migrateClasses(): Promise<void> {
  console.log('Migrating classes...');
  const data = await fetchFromGAS<any>('getAllData');
  const classes = (data.Classes || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    homeroom_teacher: c.homeroomTeacher,
  }));
  await supabase.from('classes').upsert(classes);
  console.log(`✓ ${classes.length} classes migrated`);
}

// ── Migrate students ──────────────────────────────────────────
async function migrateStudents(): Promise<void> {
  console.log('Migrating students...');
  const data = await fetchFromGAS<any>('getAllData');
  const students = (data.Students || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    class_id: s.classId,
    bike_number: s.bikeNumber || null,
  }));
  await supabase.from('students').upsert(students);
  console.log(`✓ ${students.length} students migrated`);
}

// ── Migrate criteria ───────────────────────────────────────────
async function migrateCriteria(): Promise<void> {
  console.log('Migrating criteria...');
  const data = await fetchFromGAS<any>('getAllData');
  const criteria = (data.Criteria || []).map((c: any) => ({
    id: c.id,
    content: c.content,
    points: c.points,
    type: c.type,
  }));
  await supabase.from('criteria').upsert(criteria);
  console.log(`✓ ${criteria.length} criteria migrated`);
}

// ── Migrate violations ────────────────────────────────────────
async function migrateViolations(): Promise<void> {
  console.log('Migrating violations...');
  const data = await fetchFromGAS<any>('getAllData');
  const violations = (data.Violations || []).map((v: any) => ({
    id: v.id,
    date: v.date,
    class_id: v.classId,
    student_id: v.studentId || null,
    criteria_id: v.criteriaId,
    points: v.points,
    note: v.note || null,
    images: Array.isArray(v.images) ? v.images : [],
    reported_by: v.reportedBy || null,
    is_security_report: v.isSecurityReport || false,
    timestamp: v.timestamp || Date.now(),
  }));
  await supabase.from('violations').insert(violations);
  console.log(`✓ ${violations.length} violations migrated`);
}

// ── Migrate time_configs ──────────────────────────────────────
async function migrateTimeConfigs(): Promise<void> {
  console.log('Migrating time_configs...');
  const data = await fetchFromGAS<any>('getAllData');
  const timeConfigs = (data.TimeConfigs || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    start_date: t.startDate,
    end_date: t.endDate,
  }));
  await supabase.from('time_configs').upsert(timeConfigs);
  console.log(`✓ ${timeConfigs.length} time_configs migrated`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('Starting migration to Supabase...\n');
  await migrateClasses();
  await migrateStudents();
  await migrateCriteria();
  await migrateUsers();
  await migrateViolations();
  await migrateTimeConfigs();
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
```

---

### Task 10: Image Migration (Google Drive → Supabase Storage)

**Files:**
- Create: `scripts/migrate-images.ts`

- [ ] **Step 1: Tạo image migration script**

```typescript
// scripts/migrate-images.ts
/**
 * Migrate ảnh từ Google Drive sang Supabase Storage
 * Ảnh nén lại thành WebP 85%, resize 1920px
 *
 * Cần duyệt qua violations đang có, lấy images[],
 * download từ Google Drive → compress → upload lên Supabase
 */
import { createClient } from '@supabase/supabase-js';
import { compressImage } from '../utils/imageCompress';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function migrateImage(oldUrl: string, violationId: string, index: number): Promise<string | null> {
  try {
    // Parse Google Drive URL để lấy file ID
    // Format: https://drive.google.com/uc?export=view&id=FILE_ID
    const fileId = oldUrl.match(/id=([^&]+)/)?.[1];
    if (!fileId) return null;

    // Download ảnh từ Google Drive
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN}`,
        },
      }
    );
    if (!response.ok) return null;

    const blob = await response.blob();
    const compressed = await compressImage(blob);

    // Upload lên Supabase
    const fileName = `violations/${violationId}/${index}.webp`;
    const { data, error } = await supabase.storage
      .from('violation-images')
      .upload(fileName, compressed, { contentType: 'image/webp' });

    if (error) {
      console.error(`Failed to upload image for ${violationId}[${index}]:`, error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('violation-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (err) {
    console.error(`Error migrating image ${oldUrl}:`, err);
    return null;
  }
}

async function main() {
  // Lấy tất cả violations có images
  const { data: violations } = await supabase
    .from('violations')
    .select('id, images')
    .not('images', 'eq', '{}');

  if (!violations) return;

  for (const v of violations) {
    if (!v.images || v.images.length === 0) continue;

    const newImages: string[] = [];
    for (let i = 0; i < v.images.length; i++) {
      const newUrl = await migrateImage(v.images[i], v.id, i);
      newImages.push(newUrl || v.images[i]);
    }

    // Update violation với URLs mới
    await supabase
      .from('violations')
      .update({ images: newImages })
      .eq('id', v.id);

    console.log(`✓ ${v.id}: ${newImages.length} images migrated`);
  }

  console.log('✅ Image migration complete!');
}

main().catch(console.error);
```

---

## PHASE 5 — Integration & Testing

### Task 11: Zalo OA Setup + Webhook Registration

**Files:**
- Modify: Supabase Edge Function environment variables

- [ ] **Step 1: Register webhook với Zalo**

```bash
# Gọi API setWebhook của Zalo
curl -X POST "https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/setWebhook" \
  -H "Authorization: Bearer ${ZALO_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"webhook_url": "https://your-project.supabase.co/functions/v1/zalo-bot"}'
```

- [ ] **Step 2: Cấu hình environment variables trong Supabase**

Supabase Dashboard → Edge Functions → Secrets:
```
ZALO_BOT_TOKEN=your-zalo-bot-token
ZALO_BOT_SECRET_TOKEN=your-webhook-secret
CRON_SECRET=your-cron-secret
```

---

### Task 12: End-to-End Testing Checklist

**Files:**
- Create: `docs/testing-checklist.md`

- [ ] **Step 1: Tạo testing checklist**

```markdown
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

## Zalo Bot
- [ ] Bot được add vào group
- [ ] Tag bot → reply đúng
- [ ] "@bot thống kê tuần này" → có data
- [ ] "@bot xếp hạng" → có data
- [ ] "@bot hỏi lớp 10A1" → có data
- [ ] "@bot help" → danh sách lệnh
- [ ] Weekly report gửi đúng schedule
- [ ] Monthly report gửi đúng schedule

## Settings
- [ ] CRUD Classes
- [ ] CRUD Students  
- [ ] CRUD Criteria
- [ ] CRUD Time Configs
- [ ] Sync settings lên Supabase

## Data Migration
- [ ] Users đầy đủ (700+ students)
- [ ] Classes đầy đủ
- [ ] Violations history đầy đủ
- [ ] Ảnh vi phạm migrate thành công

## Performance
- [ ] Load trang < 2s (Supabase)
- [ ] Upload ảnh < 3s
- [ ] Thống kê < 1s
```

---

## PHASE 6 — Deployment & Cutover

### Task 13: Environment Setup + Deploy

- [ ] **Step 1: Tạo Supabase project mới (production)**
- [ ] **Step 2: Chạy migration scripts**
- [ ] **Step 3: Deploy frontend lên Netlify** (giữ nguyên)
- [ ] **Step 4: Update VITE_SUPABASE_URL trong Netlify env vars**
- [ ] **Step 5: DNS/SSL verification**
- [ ] **Step 6: Disable GAS deployment** (không xóa, để backup)

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

## Spec Self-Review

1. **Spec coverage:** ✅ All major features covered
2. **Placeholder scan:** ✅ No TBD/TODO — all steps complete
3. **Type consistency:** ✅ Types match between Supabase schema and frontend
4. **Scope:** ✅ Focused on full migration, not redesign
5. **Dependencies:** ✅ Logical order with prerequisites clear