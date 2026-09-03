/**
 * Sửa className của tài khoản demo cho khớp mã lớp thật.
 *
 * Tài khoản cờ đỏ demo lưu className là "10 Toán 1" (có dấu cách) trong khi mã
 * lớp thật là "10Toán1". Chừng nào chưa siết quyền thì không ai thấy, nhưng
 * firestore.rules nay thực thi ownClassOnly bằng cách so className với classId —
 * lệch một dấu cách là tài khoản đó không ghi được gì.
 *
 * Chạy: pnpm tsx scripts/demo/fix-demo-classname.ts
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// firebase-admin không nhận refresh token trực tiếp cho Firestore. Mượn lại
// đăng nhập sẵn có của Firebase CLI qua một file ADC tạm, xoá ngay sau khi dùng.
const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const adcPath = join(tmpdir(), `nennep-adc-${Date.now()}.json`);

const cleanup = () => { if (existsSync(adcPath)) unlinkSync(adcPath); };

async function main() {
  if (!existsSync(configPath)) {
    console.error('✖ Chưa đăng nhập Firebase CLI. Chạy `firebase login` rồi thử lại.');
    process.exit(1);
  }
  const tokens = JSON.parse(readFileSync(configPath, 'utf8')).tokens;
  writeFileSync(adcPath, JSON.stringify({
    type: 'authorized_user',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: tokens.refresh_token,
  }));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;

  initializeApp({ credential: applicationDefault(), projectId: 'nennep-demo' });
  const db = getFirestore();

  const [classSnap, userSnap] = await Promise.all([
    db.collection('classes').get(),
    db.collection('users').get(),
  ]);
  const classIds = new Set(classSnap.docs.map(d => d.id));

  // Khớp mờ: bỏ dấu cách rồi so không phân biệt hoa thường
  const normalise = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  const byNormalised = new Map(classSnap.docs.map(d => [normalise(d.id), d.id]));

  let fixed = 0;
  let orphan = 0;
  for (const doc of userSnap.docs) {
    const current = String(doc.data().className ?? '').trim();
    if (!current || classIds.has(current)) continue;

    const match = byNormalised.get(normalise(current));
    if (match) {
      await doc.ref.update({ className: match });
      console.log(`  ✔ ${doc.data().name}: "${current}" → "${match}"`);
      fixed++;
    } else {
      console.log(`  ⚠ ${doc.data().name}: "${current}" không khớp lớp nào — kiểm tra tay`);
      orphan++;
    }
  }

  console.log(`\nĐã sửa ${fixed} tài khoản; ${orphan} tài khoản cần xem lại.`);
}

main()
  .catch(e => { console.error('✖', e?.message ?? e); process.exitCode = 1; })
  .finally(cleanup);
