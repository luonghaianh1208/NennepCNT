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

try { process.loadEnvFile(); } catch { /* chưa có .env thì bỏ qua */ }

// Địa chỉ nguồn dữ liệu cũ đọc từ biến môi trường — không viết vào mã nguồn,
// kho này công khai. Đặt SOURCE_DATA_URL trong .env khi cần chạy lại script.
const GAS_URL = process.env.SOURCE_DATA_URL ?? '';
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

/** Biển số giả nhưng đúng dạng Việt Nam, ổn định theo id */
const fakeBikeNumber = (seed: string) => {
  const h = hash(`BIEN_${seed}`);
  const tinh = 10 + (h % 89);
  const seri = 'ABCDEFGHKLMNPSTUVXYZ'[(h >> 7) % 20];
  return `${tinh}${seri}-${String((h >> 11) % 100000).padStart(5, '0')}`;
};

/**
 * Ghi chú vi phạm là ô nhập tự do, thường có dạng "em Nguyễn Văn A không đeo
 * phù hiệu" — tên thật đi thẳng vào demo nếu không quét. Thay bằng đúng tên giả
 * đã sinh cho người đó, để câu văn vẫn đọc được.
 *
 * Quét tên dài trước tên ngắn: "Nguyễn Văn An" phải được thay trước "Nguyễn Văn",
 * nếu không sẽ để lại mảnh tên thật.
 */
const buildNameScrubber = (people: { real: string; fake: string }[]) => {
  const pairs = people
    .filter(p => p.real.trim().split(/\s+/).length >= 2)
    .sort((a, b) => b.real.length - a.real.length);

  return (note: string) => {
    if (!note) return '';
    let out = note;
    for (const { real, fake } of pairs) {
      if (out.toLowerCase().includes(real.toLowerCase())) {
        out = out.replace(new RegExp(real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), fake);
      }
    }
    return out;
  };
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
  if (!GAS_URL) {
    console.error(
      '\n✖ Thiếu SOURCE_DATA_URL.\n' +
      '  Đặt SOURCE_DATA_URL=<địa chỉ nguồn dữ liệu> trong tệp .env rồi chạy lại.\n'
    );
    process.exit(1);
  }

  console.log('→ Tải dữ liệu thật từ nguồn cũ...');
  const res = await fetch(`${GAS_URL}?action=getAllData&t=${Date.now()}`);
  const data = await res.json();

  // ─── Lớp & tiêu chí ───────────────────────────────────────────────────────
  // Tên GVCN là người thật — ánh xạ được giáo viên với lớp nên phải ẩn danh.
  const classes = (data.Classes ?? []).map((c: any) => ({
    id: String(c.id),
    name: String(c.name),
    grade: Number(c.grade) || 0,
    homeroomTeacher: c.homeroomTeacher ? fakeName(`GVCN_${c.id}`) : '',
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
      // Biển số xe thật tra ngược ra được một gia đình cụ thể — sinh biển giả,
      // vẫn giữ chỗ để demo khoe được tính năng tra xe.
      bikeNumber: s.bikeNumber ? fakeBikeNumber(String(s.id)) : '',
    }));

  // ─── Tài khoản: ẩn danh tên, BỎ email và mật khẩu thật ────────────────────
  const users = (data.Users ?? [])
    .filter((u: any) => String(u.id ?? '').trim())
    .map((u: any) => ({
      id: String(u.id),
      name: u.name ? fakeName(`USER_${u.id}`) : '',
      username: String(u.id),
      role: String(u.role ?? 'GUEST'),
      className: String(u.className ?? ''),
      email: '',
      summaryMeetings: Number(u.summaryMeetings) || 0,
      isDemoProfile: true,
    }));

  // Bảng tên thật → tên giả, dùng để quét ghi chú tự do
  const scrubNames = buildNameScrubber([
    ...(data.Students ?? []).map((s: any) => ({ real: String(s.name ?? ''), fake: fakeName(String(s.id)) })),
    ...(data.Users ?? []).map((u: any) => ({ real: String(u.name ?? ''), fake: fakeName(`USER_${u.id}`) })),
    ...(data.Classes ?? []).map((c: any) => ({ real: String(c.homeroomTeacher ?? ''), fake: fakeName(`GVCN_${c.id}`) })),
  ]);

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
        note: scrubNames(String(v.note ?? '')),
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
