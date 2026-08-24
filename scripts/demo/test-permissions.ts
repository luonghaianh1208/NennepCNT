/**
 * Kiểm chứng phân quyền THẬT ở tầng dữ liệu, không phải chỉ ẩn nút.
 *
 * Kịch bản quan trọng nhất: cờ đỏ (học sinh) ghi được vi phạm nhưng KHÔNG ghi
 * được khen thưởng — nếu chỉ ẩn nút thì gọi thẳng vào cơ sở dữ liệu vẫn lọt.
 *
 * Chạy: pnpm tsx scripts/demo/test-permissions.ts
 */
import { readFileSync } from 'fs';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initFirebase, auth, db } from '../../services/firebase';

initFirebase(JSON.parse(readFileSync('public/tenant-config.json', 'utf8')).firebase);

const sample = (id: string, points: number) => ({
  id, date: '2026-05-20', classId: '10Toán1', studentId: '', criteriaId: 'TEST',
  points, note: 'kiểm thử phân quyền', images: [], reportedBy: 'test',
  isSecurityReport: false, timestamp: 1779600000000,
});

const attempt = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    console.log(`   ${label.padEnd(34)} ĐƯỢC PHÉP`);
    return true;
  } catch (e: any) {
    console.log(`   ${label.padEnd(34)} BỊ TỪ CHỐI`);
    return false;
  }
};

const cleanup = async (ids: string[]) => {
  for (const id of ids) {
    await deleteDoc(doc(db, 'violations', id)).catch(() => {});
    await deleteDoc(doc(db, 'achievements', id)).catch(() => {});
  }
};

(async () => {
  const results: Record<string, boolean> = {};

  console.log('▶ CỜ ĐỎ (học sinh) — chỉ có quyền ghi vi phạm');
  await signInWithEmailAndPassword(auth, 'codo@nennep.demo', 'NenNep@2026');
  results.codoViolation = await attempt('Ghi vi phạm', () => setDoc(doc(db, 'violations', 'TEST_P1'), sample('TEST_P1', 10)));
  results.codoAchievement = await attempt('Ghi khen thưởng', () => setDoc(doc(db, 'achievements', 'TEST_P2'), sample('TEST_P2', -20)));
  results.codoCatalog = await attempt('Sửa danh mục tiêu chí', () => setDoc(doc(db, 'criteria', 'TEST_P3'), { id: 'TEST_P3', content: 'x', points: 1, type: 'MINUS' }));

  console.log('\n▶ BAN CHẤP HÀNH — có thêm quyền ghi khen thưởng');
  await signOut(auth);
  await signInWithEmailAndPassword(auth, 'bch@nennep.demo', 'NenNep@2026');
  results.bchAchievement = await attempt('Ghi khen thưởng', () => setDoc(doc(db, 'achievements', 'TEST_P4'), sample('TEST_P4', -20)));
  results.bchCatalog = await attempt('Sửa danh mục tiêu chí', () => setDoc(doc(db, 'criteria', 'TEST_P5'), { id: 'TEST_P5', content: 'x', points: 1, type: 'MINUS' }));

  console.log('\n▶ QUẢN TRỊ VIÊN — đủ quyền');
  await signOut(auth);
  await signInWithEmailAndPassword(auth, 'admin@nennep.demo', 'NenNep@2026');
  results.adminAchievement = await attempt('Ghi khen thưởng', () => setDoc(doc(db, 'achievements', 'TEST_P6'), sample('TEST_P6', -20)));
  results.adminCatalog = await attempt('Sửa danh mục tiêu chí', () => setDoc(doc(db, 'criteria', 'TEST_P7'), { id: 'TEST_P7', content: 'x', points: 1, type: 'MINUS' }));

  await cleanup(['TEST_P1', 'TEST_P2', 'TEST_P4', 'TEST_P6']);
  await deleteDoc(doc(db, 'criteria', 'TEST_P3')).catch(() => {});
  await deleteDoc(doc(db, 'criteria', 'TEST_P5')).catch(() => {});
  await deleteDoc(doc(db, 'criteria', 'TEST_P7')).catch(() => {});
  console.log('\n(đã dọn dữ liệu kiểm thử)');

  const pass =
    results.codoViolation && !results.codoAchievement && !results.codoCatalog &&
    results.bchAchievement && !results.bchCatalog &&
    results.adminAchievement && results.adminCatalog;

  console.log(pass ? '\n✔ PHÂN QUYỀN ĐÚNG NHƯ BẢNG ĐÃ ĐẶT' : '\n✘ CÓ QUYỀN KHÔNG ĐÚNG MONG ĐỢI');
  process.exit(pass ? 0 : 1);
})();
