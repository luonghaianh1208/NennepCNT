-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE violation_type AS ENUM ('MINUS', 'PLUS');
CREATE TYPE time_config_type AS ENUM ('WEEK', 'MONTH', 'SEMESTER');
CREATE TYPE audit_action AS ENUM (
  'DELETE_VIOLATION', 'BULK_DELETE', 'UPDATE_VIOLATION',
  'CREATE_VIOLATION', 'SYNC_SETTINGS', 'USER_MANAGEMENT'
);

-- permissions
CREATE TABLE permissions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR(64) UNIQUE NOT NULL,
  label       VARCHAR(128) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- roles
CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(64) UNIQUE NOT NULL,
  label       VARCHAR(128) NOT NULL,
  color       VARCHAR(32) DEFAULT 'gray',
  is_admin    BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- role_permissions
CREATE TABLE role_permissions (
  role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- user_profiles
CREATE TABLE user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         VARCHAR(128) NOT NULL,
  username     VARCHAR(64) UNIQUE NOT NULL,
  email        VARCHAR(256),
  role_ids     UUID[] DEFAULT '{}',
  class_id     VARCHAR(32),
  summary_meetings INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- classes
CREATE TABLE classes (
  id               VARCHAR(32) PRIMARY KEY,
  name             VARCHAR(32) NOT NULL,
  grade            INTEGER     NOT NULL,
  homeroom_teacher VARCHAR(128),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- students
CREATE TABLE students (
  id         VARCHAR(32) PRIMARY KEY,
  name       VARCHAR(128) NOT NULL,
  class_id   VARCHAR(32) REFERENCES classes(id),
  bike_number VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- criteria
CREATE TABLE criteria (
  id      VARCHAR(32) PRIMARY KEY,
  content TEXT       NOT NULL,
  points  INTEGER    NOT NULL,
  type    violation_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- violations
CREATE TABLE violations (
  id               VARCHAR(64) PRIMARY KEY,
  date             DATE        NOT NULL,
  class_id         VARCHAR(32) REFERENCES classes(id),
  student_id       VARCHAR(32) REFERENCES students(id),
  criteria_id      VARCHAR(32) REFERENCES criteria(id),
  points           INTEGER     NOT NULL,
  note             TEXT,
  images           TEXT[] DEFAULT '{}',
  reported_by      UUID REFERENCES user_profiles(id),
  is_security_report BOOLEAN DEFAULT FALSE,
  timestamp        BIGINT      NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- time_configs
CREATE TABLE time_configs (
  id          VARCHAR(32) PRIMARY KEY,
  name        VARCHAR(64) NOT NULL,
  type        time_config_type NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- audit_logs
CREATE TABLE audit_logs (
  id              VARCHAR(64) PRIMARY KEY,
  timestamp       BIGINT      NOT NULL,
  user_id         UUID REFERENCES user_profiles(id),
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

-- zalo_groups
CREATE TABLE zalo_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_name  VARCHAR(128) NOT NULL,
  group_id    VARCHAR(64) NOT NULL,
  notify_types VARCHAR(32)[] DEFAULT '{}',
  class_id    VARCHAR(32) REFERENCES classes(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_violations_criteria ON violations(criteria_id);
CREATE INDEX idx_violations_date ON violations(date);
CREATE INDEX idx_violations_class ON violations(class_id);
CREATE INDEX idx_violations_student ON violations(student_id);
CREATE INDEX idx_violations_timestamp ON violations(timestamp);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_time_configs_type ON time_configs(type);

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

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_role_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE((SELECT role_ids FROM user_profiles WHERE id = auth.uid()), '{}')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_permission(p_slug TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ANY(get_user_role_ids())
      AND p.slug = p_slug
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = ANY(get_user_role_ids())
      AND r.is_admin = TRUE
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- user_profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (is_admin_user());
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage users" ON user_profiles
  FOR ALL USING (is_admin_user());

-- violations policies
CREATE POLICY "Authenticated users can view violations" ON violations
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users with violation.create can insert" ON violations
  FOR INSERT WITH CHECK (has_permission('violation.create') OR is_admin_user());
CREATE POLICY "Users with violation.update can update" ON violations
  FOR UPDATE USING (has_permission('violation.update') OR is_admin_user());
CREATE POLICY "Users with violation.delete can delete" ON violations
  FOR DELETE USING (has_permission('violation.delete') OR has_permission('violation.bulk_delete') OR is_admin_user());

-- classes policies
CREATE POLICY "Authenticated can read classes" ON classes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Settings managers can manage classes" ON classes
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- students policies
CREATE POLICY "Authenticated can read students" ON students
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Settings managers can manage students" ON students
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- criteria policies
CREATE POLICY "Authenticated can read criteria" ON criteria
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Settings managers can manage criteria" ON criteria
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- time_configs policies
CREATE POLICY "Authenticated can read time_configs" ON time_configs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Settings managers can manage time_configs" ON time_configs
  FOR ALL USING (has_permission('settings.manage') OR is_admin_user());

-- audit_logs policies
CREATE POLICY "Users with audit.view can read logs" ON audit_logs
  FOR SELECT USING (has_permission('audit.view') OR is_admin_user());

-- zalo_groups policies
CREATE POLICY "Users with zalo.manage can manage zalo_groups" ON zalo_groups
  FOR ALL USING (has_permission('zalo.manage') OR is_admin_user());

-- roles policies
CREATE POLICY "Admin can manage roles" ON roles
  FOR ALL USING (is_admin_user());
CREATE POLICY "Authenticated can read roles" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- permissions policies
CREATE POLICY "Authenticated can read permissions" ON permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed permissions
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

-- Seed role_permissions
DO $$
DECLARE
  admin_id UUID := (SELECT id FROM roles WHERE name = 'ADMIN');
  bch_id   UUID := (SELECT id FROM roles WHERE name = 'BCH');
  rf_id    UUID := (SELECT id FROM roles WHERE name = 'RED_FLAG');
  tea_id   UUID := (SELECT id FROM roles WHERE name = 'TEACHER');
  guest_id UUID := (SELECT id FROM roles WHERE name = 'GUEST');
BEGIN
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT bch_id, id FROM permissions WHERE slug IN (
    'violation.create','violation.read','violation.update',
    'reports.view','ranking.view','audit.view'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT rf_id, id FROM permissions WHERE slug IN (
    'violation.create','violation.read','image.upload'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT tea_id, id FROM permissions WHERE slug IN (
    'violation.read','reports.view','ranking.view'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT guest_id, id FROM permissions WHERE slug IN (
    'violation.read','ranking.view'
  ) ON CONFLICT DO NOTHING;
END $$;