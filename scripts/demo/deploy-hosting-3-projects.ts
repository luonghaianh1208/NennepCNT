/**
 * Build + Deploy Hosting cho 3 project trường.
 *
 * Mỗi trường có tenant-config.json riêng (apiKey, projectId, schoolName) — file
 * này chỉ là chỗ build nhúng runtime config vào gói tĩnh.
 *
 * Vì cùng một mã nguồn nhưng phải build 3 lần (mỗi lần một tenant-config),
 * script dùng cơ chế:
 *   1. Copy tenant-config.json → public/ cho từng trường
 *   2. Chạy build (Vite nhúng file tĩnh vào dist/)
 *   3. Deploy hosting qua firebase-tools CLI
 */
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const CONFIG_FILE = 'scripts/demo/tenant-configs.json';
const PUBLIC_TENANT = 'public/tenant-config.json';

const PROJECTS = [
  {
    pid: 'nennep-thptchuyenlaocai',
    domain: 'thptchuyenlaocai.nennep.pro.vn',
    name: 'THPT Chuyên Lào Cai',
    shortName: 'NỀN NẾP — THPT CHUYÊN LÀO CAI',
    slogan: 'Hệ thống quản lý nền nếp — THPT Chuyên Lào Cai',
  },
  {
    pid: 'nennep-thptnguyendu',
    domain: 'thptnguyendu.nennep.pro.vn',
    name: 'THPT Nguyễn Du',
    shortName: 'NỀN NẾP — THPT NGUYỄN DU',
    slogan: 'Hệ thống quản lý nền nếp — THPT Nguyễn Du',
  },
  {
    pid: 'nennep-thptlythuongkiet',
    domain: 'thptlythuongkiet.nennep.pro.vn',
    name: 'THPT Lý Thường Kiệt',
    shortName: 'NỀN NẾP — THPT LÝ THƯỜNG KIỆT',
    slogan: 'Hệ thống quản lý nền nếp — THPT Lý Thường Kiệt',
  },
];

async function main() {
  // Lưu tenant-config hiện tại để phục hồi cuối cùng
  const original = readFileSync(PUBLIC_TENANT, 'utf8');
  const configs = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));

  for (const p of PROJECTS) {
    const cfg = configs[p.pid];
    if (!cfg) {
      console.log(`⚠ Không có SDK config cho ${p.pid}, bỏ qua`);
      continue;
    }
    console.log(`\n=== ${p.pid} (${p.domain}) ===`);
    const tenantConfig = {
      firebase: {
        apiKey: cfg.config.apiKey,
        // authDomain phải TRÙNG tên miền của trang, không được để
        // *.firebaseapp.com. Cửa sổ đăng nhập mở /__/auth/handler của
        // authDomain — khác origin thì trình duyệt trong Zalo/Messenger và app
        // thêm ra màn hình chính tách riêng bộ nhớ tạm, sinh lỗi
        // "missing initial state" lúc được lúc không.
        //
        // Đổi được vì đã đủ ba điều kiện, thiếu một là chết đăng nhập cả trường:
        //   1. Tên miền nằm trong Authorized domains của Firebase Auth
        //   2. Tên miền phục vụ thật /__/auth/handler (đọc nội dung, không tin mã 200)
        //   3. https://<tên miền>/__/auth/handler nằm trong Authorized redirect
        //      URIs của OAuth client — thêm TRƯỚC khi đổi dòng này
        authDomain: p.domain,
        projectId: cfg.config.projectId,
        storageBucket: cfg.config.storageBucket,
        messagingSenderId: cfg.config.messagingSenderId,
        appId: cfg.config.appId,
      },
      branding: {
        schoolName: p.name,
        shortName: p.shortName,
        slogan: p.slogan,
      },
    };
    writeFileSync(PUBLIC_TENANT, JSON.stringify(tenantConfig, null, 2) + '\n');
    console.log(`  ✔ Ghi tenant-config (${p.name})`);

    console.log(`  ⏳ Build...`);
    execSync('npm run build 2>&1 | tail -3', { stdio: 'inherit' });

    console.log(`  ⏳ Deploy hosting...`);
    try {
      execSync(`npx firebase deploy --only hosting --project ${p.pid} 2>&1 | tail -5`, { stdio: 'inherit' });
    } catch (e: any) {
      console.log(`  ❌ Deploy hosting lỗi`);
    }
  }

  // Phục hồi tenant-config ban đầu
  writeFileSync(PUBLIC_TENANT, original);
  console.log('\n✔ Phục hồi public/tenant-config.json (cho demo)');
}

main().catch(console.error);
