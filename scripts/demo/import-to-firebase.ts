/**
 * Đẩy dữ liệu demo lên Firebase: ảnh vào Storage, bản ghi vào Firestore,
 * và tạo sẵn 4 tài khoản đăng nhập để trình diễn.
 *
 * Cần: file khoá dịch vụ (service account key) tải từ Firebase Console
 *   Project settings → Service accounts → Generate new private key
 *
 * Chạy: pnpm tsx scripts/demo/import-to-firebase.ts --key ./firebase-admin-key.json
 */
import { readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

const OUT_DIR = join(process.cwd(), 'scripts', 'demo', 'out');
const BUCKET = 'nennep-demo.firebasestorage.app';

const argOf = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? String(process.argv[i + 1]) : fallback;
};
const KEY_PATH = argOf('key', './firebase-admin-key.json');
/** Bỏ qua bước ảnh khi Storage chưa sẵn sàng (chưa bật Blaze) */
const SKIP_IMAGES = process.argv.includes('--skip-images');

/** Tài khoản trình diễn — mật khẩu cố định để đưa cho khách xem thử */
const DEMO_ACCOUNTS = [
  { email: 'admin@nennep.demo', name: 'Quản trị viên Demo', role: 'ADMIN', className: '' },
  { email: 'bch@nennep.demo', name: 'Cán bộ Đoàn Demo', role: 'BCH', className: '' },
  { email: 'codo@nennep.demo', name: 'Cờ đỏ Demo', role: 'RED_FLAG', className: '10 Toán 1' },
  { email: 'gv@nennep.demo', name: 'Giáo viên Demo', role: 'GUEST', className: '10 Toán 1' },
];
const DEMO_PASSWORD = 'NenNep@2026';

/** Ghi một collection theo lô 400 doc — dưới hạn 500 thao tác mỗi batch của Firestore */
async function writeCollection(db: FirebaseFirestore.Firestore, name: string, docs: any[]) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 400)) {
      batch.set(db.collection(name).doc(String(doc.id)), doc);
    }
    await batch.commit();
  }
  console.log(`   ${name}: ${docs.length}`);
}

async function main() {
  // Ưu tiên khoá dịch vụ; nếu không có thì dùng credential mặc định của máy
  // (GOOGLE_APPLICATION_CREDENTIALS — ví dụ tài khoản đã đăng nhập Firebase CLI)
  const hasKey = existsSync(KEY_PATH);
  if (!hasKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      `Không thấy file khoá "${KEY_PATH}" và cũng không có GOOGLE_APPLICATION_CREDENTIALS.\n` +
        '  Tải khoá tại: Firebase Console → Project settings → Service accounts → Generate new private key',
    );
  }

  initializeApp({
    credential: hasKey ? cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) : applicationDefault(),
    projectId: 'nennep-demo',
    storageBucket: BUCKET,
  });
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const auth = getAuth();

  const data = JSON.parse(readFileSync(join(OUT_DIR, 'demo-data.json'), 'utf8'));
  const imagesMap: Record<string, string[]> = JSON.parse(
    readFileSync(join(OUT_DIR, 'images-map.json'), 'utf8'),
  );

  // ─── 1. Ảnh lên Storage ───────────────────────────────────────────────────
  const urlByViolation: Record<string, string[]> = {};
  const entries = Object.entries(imagesMap);
  let uploaded = 0;

  console.log(SKIP_IMAGES ? '→ Bỏ qua bước ảnh (--skip-images)' : '→ Đẩy ảnh lên Storage...');
  const queue = SKIP_IMAGES ? [] : [...entries];
  const worker = async () => {
    while (queue.length) {
      const [violationId, files] = queue.shift()!;
      for (const file of files.filter(Boolean)) {
        const dest = `violations/${file}`;
        // Download token: cách chuẩn của Firebase để ảnh xem được mà không cần
        // mở công khai cả bucket (bucket mới bật uniform access nên makePublic sẽ lỗi)
        const downloadToken = randomUUID();
        await bucket.upload(join(OUT_DIR, 'images', file), {
          destination: dest,
          metadata: {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000',
            metadata: { firebaseStorageDownloadTokens: downloadToken },
          },
        });
        (urlByViolation[violationId] ??= []).push(
          `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(dest)}?alt=media&token=${downloadToken}`,
        );
      }
      if (++uploaded % 25 === 0) console.log(`   ${uploaded}/${entries.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`   Xong ${uploaded} bản ghi có ảnh`);

  // ─── 2. Dữ liệu lên Firestore ─────────────────────────────────────────────
  console.log('→ Ghi dữ liệu vào Firestore...');
  // Chưa đẩy ảnh thì tạm giữ link Drive cũ, lần chạy sau sẽ thay bằng link Storage
  const violations = data.violations.map((v: any) => ({
    ...v,
    images: urlByViolation[v.id] ?? (SKIP_IMAGES ? v.images : []),
  }));

  await writeCollection(db, 'classes', data.classes);
  await writeCollection(db, 'students', data.students);
  await writeCollection(db, 'criteria', data.criteria);
  await writeCollection(db, 'timeConfigs', data.timeConfigs);
  await writeCollection(db, 'users', data.users);
  await writeCollection(db, 'violations', violations);

  await db.doc('settings/branding').set({
    schoolName: 'THPT Chuyên Nguyễn Trãi',
    shortName: 'NỀN NẾP CNT',
    logoUrl: '',
    themePreset: 'DOAN',
    academicYear: '2025-2026',
    isDemo: true,
  });

  // ─── 3. Tài khoản trình diễn ──────────────────────────────────────────────
  console.log('→ Tạo tài khoản demo...');
  for (const acc of DEMO_ACCOUNTS) {
    const user = await auth
      .createUser({ email: acc.email, password: DEMO_PASSWORD, displayName: acc.name })
      .catch(async (e: any) => {
        if (e.code !== 'auth/email-already-exists') throw e;
        return auth.getUserByEmail(acc.email);
      });
    await auth.setCustomUserClaims(user.uid, { role: acc.role });
    await db.collection('users').doc(user.uid).set({
      id: user.uid,
      name: acc.name,
      username: acc.email,
      email: acc.email,
      role: acc.role,
      className: acc.className,
      summaryMeetings: 0,
    });
    console.log(`   ${acc.email} · ${acc.role}`);
  }

  console.log('\n✔ Hoàn tất');
  console.log(`   Mật khẩu chung của các tài khoản demo: ${DEMO_PASSWORD}`);
}

main().catch((e) => {
  console.error('✘ Lỗi:', e.message ?? e);
  process.exit(1);
});
