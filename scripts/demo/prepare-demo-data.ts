/**
 * Chuẩn bị dữ liệu demo từ dữ liệu thật trên Google Sheets (qua GAS).
 *
 * - Lấy ~200 vi phạm mỗi học kỳ, trải đều theo thời gian, ưu tiên có ảnh minh chứng
 * - Ẩn danh tên học sinh (sinh tên Việt ổn định theo id, chạy lại cho kết quả giống nhau)
 * - Loại bỏ email thật để demo không bao giờ gửi mail tới giáo viên của trường
 * - Chuẩn hoá ngày về YYYY-MM-DD, khử trùng id học sinh
 *
 * Chạy: pnpm tsx scripts/demo/prepare-demo-data.ts [--per-semester 200]
 * Kết quả: scripts/demo/out/demo-data.json + images-manifest.json
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbx5QAqX116WySkFKgb6v0Ia_x4ZWs-PhhJGSWnlnTa3Ld2XyaofoCt7_mrBhTiIn2r3nQ/exec';
const OUT_DIR = join(process.cwd(), 'scripts', 'demo', 'out');

const argOf = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const PER_SEMESTER = argOf('per-semester', 200);

// ─── Ẩn danh tên học sinh ────────────────────────────────────────────────────
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh'];
const DEM = ['Văn', 'Thị', 'Hữu', 'Đức', 'Minh', 'Thu', 'Thanh', 'Quang', 'Ngọc', 'Gia', 'Bảo', 'Khánh', 'Hải', 'Phương', 'Tuấn'];
const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Duy', 'Giang', 'Hà', 'Hạnh', 'Hiếu', 'Huy', 'Khoa', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Nga', 'Nhi', 'Phong', 'Quân', 'Quỳnh', 'Sơn', 'Thảo', 'Trang', 'Trung', 'Tú', 'Vy', 'Yến'];

/** Hash ổn định: cùng một id luôn ra cùng một tên, chạy lại không đổi */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const fakeName = (seed: string) => {
  const h = hash(seed);
  return `${HO[h % HO.length]} ${DEM[(h >> 5) % DEM.length]} ${TEN[(h >> 11) % TEN.length]}`;
};

// ─── Chuẩn hoá ngày: nhận cả YYYY-MM-DD lẫn M/D/YYYY ─────────────────────────
const toISODate = (raw: unknown): string | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const asArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  const s = String(v ?? '').trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [s];
  } catch {
    return [s];
  }
};

/** Lấy `count` phần tử trải đều trên danh sách đã sắp xếp thay vì cắt đầu/cuối */
const spread = <T>(list: T[], count: number): T[] => {
  if (list.length <= count) return list;
  const step = list.length / count;
  return Array.from({ length: count }, (_, i) => list[Math.floor(i * step)]);
};

async function main() {
  console.log('→ Tải dữ liệu thật từ Google Apps Script...');
  const res = await fetch(`${GAS_URL}?action=getAllData&t=${Date.now()}`);
  const data = await res.json();

  // ─── Lớp & tiêu chí: giữ nguyên toàn bộ ───────────────────────────────────
  const classes = (data.Classes ?? []).map((c: any) => ({
    id: String(c.id),
    name: String(c.name),
    grade: Number(c.grade) || 0,
    homeroomTeacher: String(c.homeroomTeacher ?? ''),
  }));

  const criteria = (data.Criteria ?? []).map((c: any) => ({
    id: String(c.id),
    content: String(c.content),
    points: Number(c.points) || 0,
    type: c.type === 'PLUS' ? 'PLUS' : 'MINUS',
  }));

  // ─── Học sinh: khử trùng id + ẩn danh tên ─────────────────────────────────
  const seenStudent = new Set<string>();
  let duplicateStudents = 0;
  const students = (data.Students ?? [])
    .filter((s: any) => {
      const id = String(s.id ?? '').trim();
      if (!id || seenStudent.has(id)) {
        duplicateStudents++;
        return false;
      }
      seenStudent.add(id);
      return true;
    })
    .map((s: any) => ({
      id: String(s.id),
      name: fakeName(String(s.id)),
      classId: String(s.classId ?? ''),
      bikeNumber: String(s.bikeNumber ?? ''),
    }));

  // ─── Tài khoản: giữ tên giáo viên, BỎ email và mật khẩu thật ──────────────
  const users = (data.Users ?? [])
    .filter((u: any) => String(u.id ?? '').trim())
    .map((u: any) => ({
      id: String(u.id),
      name: String(u.name ?? ''),
      username: String(u.id),
      role: String(u.role ?? 'GUEST'),
      className: String(u.className ?? ''),
      email: '',
      summaryMeetings: Number(u.summaryMeetings) || 0,
      isDemoProfile: true,
    }));

  const timeConfigs = (data.TimeConfigs ?? []).map((t: any) => ({
    id: String(t.id),
    name: String(t.name),
    type: String(t.type),
    startDate: toISODate(t.startDate) ?? '',
    endDate: toISODate(t.endDate) ?? '',
  }));

  // ─── Chọn vi phạm theo từng học kỳ ────────────────────────────────────────
  const semesters = timeConfigs.filter((t: any) => t.type === 'SEMESTER');
  if (!semesters.length) throw new Error('Không tìm thấy học kỳ nào trong TimeConfigs');

  const allViolations = (data.Violations ?? [])
    .map((v: any) => {
      const date = toISODate(v.date);
      if (!date) return null;
      return {
        id: String(v.id),
        date,
        classId: String(v.classId ?? ''),
        studentId: String(v.studentId ?? ''),
        criteriaId: String(v.criteriaId ?? ''),
        points: Number(v.points) || 0,
        note: String(v.note ?? ''),
        images: asArray(v.images),
        reportedBy: String(v.reportedBy ?? ''),
        isSecurityReport: v.isSecurityReport === true || v.isSecurityReport === 'TRUE',
        timestamp: Number(v.timestamp) || new Date(date).getTime(),
      };
    })
    .filter(Boolean) as any[];

  const picked: any[] = [];
  for (const sem of semesters) {
    const inRange = allViolations
      .filter((v) => v.date >= sem.startDate && v.date <= sem.endDate)
      .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

    // Một nửa có ảnh để demo khoe được phần minh chứng, một nửa không
    const withImg = inRange.filter((v) => v.images.length > 0);
    const noImg = inRange.filter((v) => v.images.length === 0);
    const wantImg = Math.min(Math.ceil(PER_SEMESTER / 2), withImg.length);
    const chosen = [...spread(withImg, wantImg), ...spread(noImg, PER_SEMESTER - wantImg)];

    picked.push(...chosen);
    console.log(
      `   ${sem.name}: ${inRange.length} bản ghi → chọn ${chosen.length} (${wantImg} có ảnh)`,
    );
  }

  picked.sort((a, b) => b.timestamp - a.timestamp);

  // ─── Danh sách ảnh cần chuyển sang Storage ────────────────────────────────
  const manifest: { violationId: string; index: number; driveId: string; url: string }[] = [];
  for (const v of picked) {
    v.images.forEach((url: string, index: number) => {
      const m = url.match(/\/file\/d\/([\w-]+)/) ?? url.match(/[?&]id=([\w-]+)/);
      if (m) manifest.push({ violationId: v.id, index, driveId: m[1], url });
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, 'demo-data.json'),
    JSON.stringify({ classes, students, criteria, users, timeConfigs, violations: picked }, null, 2),
    'utf8',
  );
  writeFileSync(join(OUT_DIR, 'images-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n✔ Xong');
  console.log(`   Lớp ${classes.length} · Học sinh ${students.length} (bỏ ${duplicateStudents} bản trùng id)`);
  console.log(`   Tiêu chí ${criteria.length} · Tài khoản ${users.length} · Mốc thời gian ${timeConfigs.length}`);
  console.log(`   Vi phạm ${picked.length} · Ảnh cần chuyển ${manifest.length}`);
  console.log(`   → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error('✘ Lỗi:', e);
  process.exit(1);
});
