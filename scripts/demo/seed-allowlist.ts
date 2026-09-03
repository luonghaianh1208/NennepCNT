/**
 * Dựng danh sách cho phép (`allowlist`) từ bảng tài khoản hiện có.
 *
 * Chạy MỘT LẦN khi chuyển từ đăng nhập mật khẩu sang đăng nhập Google. Mỗi tài
 * khoản đang có email hợp lệ sẽ thành một dòng trong danh sách; từ đó họ đăng
 * nhập bằng Google với chính email ấy là vào được, giữ nguyên vai trò và lớp.
 *
 * Tài khoản không có email (nhập từ dữ liệu cũ) sẽ được liệt kê để quản trị
 * viên bổ sung tay — không đoán bừa địa chỉ cho ai.
 *
 * Chạy: pnpm tsx scripts/demo/seed-allowlist.ts [--project <id>]
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const argOf = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? String(process.argv[i + 1]) : fallback;
};
const projectId = argOf('project', 'nennep-demo');

// firebase-admin không nhận refresh token trực tiếp; mượn đăng nhập của
// Firebase CLI qua một file ADC tạm rồi xoá ngay.
const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const adcPath = join(tmpdir(), `nennep-adc-${Date.now()}.json`);
const cleanup = () => { if (existsSync(adcPath)) unlinkSync(adcPath); };

async function main() {
  if (!existsSync(configPath)) {
    console.error('✖ Chưa đăng nhập Firebase CLI. Chạy `firebase login` rồi thử lại.');
    process.exit(1);
  }
  const { tokens } = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(adcPath, JSON.stringify({
    type: 'authorized_user',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: tokens.refresh_token,
  }));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;

  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();

  const [users, existing] = await Promise.all([
    db.collection('users').get(),
    db.collection('allowlist').get(),
  ]);
  const already = new Set(existing.docs.map(d => d.id));

  let added = 0;
  let skipped = 0;
  const missingEmail: string[] = [];

  for (const doc of users.docs) {
    const data = doc.data();
    const email = String(data.email ?? '').trim().toLowerCase();

    if (!email.includes('@')) {
      missingEmail.push(String(data.name ?? doc.id));
      continue;
    }
    if (already.has(email)) { skipped++; continue; }

    await db.collection('allowlist').doc(email).set({
      email,
      name: String(data.name ?? email),
      role: String(data.role ?? 'GUEST').toUpperCase(),
      className: String(data.className ?? ''),
      active: data.active !== false,
      // Hồ sơ đã tồn tại nghĩa là người này từng đăng nhập — giữ lại mã tài khoản
      uid: doc.id,
      lastSignIn: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    added++;
  }

  console.log(`\nĐã thêm ${added} địa chỉ vào danh sách cho phép; bỏ qua ${skipped} địa chỉ đã có.`);
  if (missingEmail.length) {
    console.log(`\n⚠ ${missingEmail.length} tài khoản chưa có email, phải thêm tay ở Cấu hình → Tài khoản:`);
    missingEmail.slice(0, 20).forEach(n => console.log(`   · ${n}`));
    if (missingEmail.length > 20) console.log(`   … và ${missingEmail.length - 20} người nữa`);
  }
}

main()
  .catch(e => { console.error('✖', e?.message ?? e); process.exitCode = 1; })
  .finally(cleanup);
