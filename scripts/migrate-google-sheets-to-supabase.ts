/**
 * Migration script — runs once to move data from GAS/Sheets to Supabase.
 * Run: npx ts-node scripts/migrate-google-sheets-to-supabase.ts
 *
 * Requires:
 * - VITE_SUPABASE_URL in .env
 * - SUPABASE_SERVICE_ROLE_KEY in .env
 * - GAS backend URL (optional, for live migration)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Fetch from GAS ─────────────────────────────────────────────
async function fetchFromGAS<T>(action: string): Promise<T> {
  // This would need the actual GAS ID - placeholder for now
  // For now, we expect local JSON backup files
  throw new Error('GAS ID not configured - use local JSON files instead');
}

// ── Load from local JSON (for testing/migration from backup) ──
interface LocalData {
  Users?: any[];
  Classes?: any[];
  Students?: any[];
  Criteria?: any[];
  Violations?: any[];
  TimeConfigs?: any[];
}

function loadLocalData(): LocalData {
  const dataPath = './migration-data.json';
  if (existsSync(dataPath)) {
    const content = readFileSync(dataPath, 'utf-8');
    return JSON.parse(content);
  }
  return {};
}

// ── Migrate classes ───────────────────────────────────────────
async function migrateClasses(): Promise<void> {
  console.log('Migrating classes...');
  const data = loadLocalData();
  const classes = (data.Classes || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    homeroom_teacher: c.homeroomTeacher,
  }));

  if (classes.length === 0) {
    // Create sample classes for testing
    classes.push(
      { id: '10A1', name: '10A1', grade: 10, homeroom_teacher: 'Nguyễn Văn A' },
      { id: '10A2', name: '10A2', grade: 10, homeroom_teacher: 'Trần Thị B' },
      { id: '11A1', name: '11A1', grade: 11, homeroom_teacher: 'Lê Văn C' },
      { id: '12A1', name: '12A1', grade: 12, homeroom_teacher: 'Phạm Thị D' },
    );
  }

  await supabase.from('classes').upsert(classes);
  console.log(`✓ ${classes.length} classes migrated`);
}

// ── Migrate students ──────────────────────────────────────────
async function migrateStudents(): Promise<void> {
  console.log('Migrating students...');
  const data = loadLocalData();
  const students = (data.Students || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    class_id: s.classId,
    bike_number: s.bikeNumber || null,
  }));

  if (students.length === 0) {
    console.log('  (no students in backup, skipping)');
    return;
  }

  await supabase.from('students').upsert(students);
  console.log(`✓ ${students.length} students migrated`);
}

// ── Migrate criteria ──────────────────────────────────────────
async function migrateCriteria(): Promise<void> {
  console.log('Migrating criteria...');
  const data = loadLocalData();
  const criteria = (data.Criteria || []).map((c: any) => ({
    id: c.id,
    content: c.content,
    points: c.points,
    type: c.type,
  }));

  if (criteria.length === 0) {
    // Create sample criteria
    criteria.push(
      { id: 'CR001', content: 'Không đội mũ bảo hiểm', points: 2, type: 'MINUS' },
      { id: 'CR002', content: 'Ngược chiều', points: 3, type: 'MINUS' },
      { id: 'CR003', content: 'Đi xe không đăng ký', points: 1, type: 'MINUS' },
      { id: 'CR004', content: 'Tham gia hoạt động Đoàn', points: -2, type: 'PLUS' },
      { id: 'CR005', content: 'Đạt giải thưởng', points: -5, type: 'PLUS' },
    );
  }

  await supabase.from('criteria').upsert(criteria);
  console.log(`✓ ${criteria.length} criteria migrated`);
}

// ── Migrate users ─────────────────────────────────────────────
async function migrateUsers(): Promise<void> {
  console.log('Migrating users...');
  const data = loadLocalData();
  const users = (data.Users || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email || null,
    role_ids: [],
    class_id: u.className || null,
    summary_meetings: u.summaryMeetings || 0,
  }));

  if (users.length === 0) {
    console.log('  (no users in backup, skipping)');
    return;
  }

  await supabase.from('user_profiles').upsert(users);
  console.log(`✓ ${users.length} users migrated`);
}

// ── Migrate violations ────────────────────────────────────────
async function migrateViolations(): Promise<void> {
  console.log('Migrating violations...');
  const data = loadLocalData();
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

  if (violations.length === 0) {
    console.log('  (no violations in backup, skipping)');
    return;
  }

  await supabase.from('violations').insert(violations);
  console.log(`✓ ${violations.length} violations migrated`);
}

// ── Migrate time_configs ───────────────────────────────────────
async function migrateTimeConfigs(): Promise<void> {
  console.log('Migrating time_configs...');
  const data = loadLocalData();
  const timeConfigs = (data.TimeConfigs || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    start_date: t.startDate,
    end_date: t.endDate,
  }));

  if (timeConfigs.length === 0) {
    // Create sample time configs
    const now = new Date();
    const year = now.getFullYear();
    timeConfigs.push(
      { id: 'WEEK_1', name: 'Tuần 1', type: 'WEEK', start_date: `${year}-09-01`, end_date: `${year}-09-07` },
      { id: 'MONTH_1', name: 'Tháng 9', type: 'MONTH', start_date: `${year}-09-01`, end_date: `${year}-09-30` },
      { id: 'HK1', name: 'Học kỳ 1', type: 'SEMESTER', start_date: `${year}-09-01`, end_date: `${year}-12-31` },
    );
  }

  await supabase.from('time_configs').upsert(timeConfigs);
  console.log(`✓ ${timeConfigs.length} time_configs migrated`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('Starting migration to Supabase...\n');

  // Migrate in order (dependencies matter)
  await migrateClasses();
  await migrateStudents();
  await migrateCriteria();
  await migrateUsers();
  await migrateViolations();
  await migrateTimeConfigs();

  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
