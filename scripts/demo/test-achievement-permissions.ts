/**
 * Kiểm chứng quyền ghi điểm thưởng: chỉ ADMIN được ghi vào `achievements`
 * và sửa danh mục tiêu chí; các vai trò khác vẫn ghi được vi phạm.
 *
 * Chạy: pnpm tsx scripts/demo/test-achievement-permissions.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const app = initializeApp({
  apiKey: 'AIzaSyA8vDLt97KKSKsGQ9gExVMC93phNbdVlK8',
  authDomain: 'nennep-demo.firebaseapp.com',
  projectId: 'nennep-demo',
  storageBucket: 'nennep-demo.firebasestorage.app',
  messagingSenderId: '870692201715',
  appId: '1:870692201715:web:1a08bcd260084a3aa74386',
});
const db = getFirestore(app);
const auth = getAuth(app);

const sample = (id: string) => ({
  id,
  date: '2026-05-20',
  classId: '10Toán1',
  studentId: '',
  criteriaId: 'TEST',
  points: -30,
  note: 'Kiểm thử quyền',
  images: [],
  reportedBy: 'test',
  isSecurityReport: false,
  timestamp: 1779600000000,
});

const attempt = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    console.log(`   ${label}: ĐƯỢC PHÉP`);
    return true;
  } catch (e: any) {
    console.log(`   ${label}: BỊ TỪ CHỐI (${e.code ?? e.message})`);
    return false;
  }
};

(async () => {
  const cleanup: (() => Promise<unknown>)[] = [];

  console.log('▶ Tài khoản BCH (không phải admin)');
  await signInWithEmailAndPassword(auth, 'bch@nennep.demo', 'NenNep@2026');
  const bchAch = await attempt('Ghi điểm thưởng', () => setDoc(doc(db, 'achievements', 'TEST_PERM_A'), sample('TEST_PERM_A')));
  const bchCri = await attempt('Thêm tiêu chí', () => setDoc(doc(db, 'criteria', 'TEST_PERM_C'), { id: 'TEST_PERM_C', content: 'Thử', points: 10, type: 'PLUS' }));
  const bchVio = await attempt('Ghi vi phạm', () => setDoc(doc(db, 'violations', 'TEST_PERM_V'), { ...sample('TEST_PERM_V'), points: 10 }));
  if (bchVio) cleanup.push(() => deleteDoc(doc(db, 'violations', 'TEST_PERM_V')));

  console.log('\n▶ Tài khoản ADMIN');
  await signOut(auth);
  await signInWithEmailAndPassword(auth, 'admin@nennep.demo', 'NenNep@2026');
  const adminAch = await attempt('Ghi điểm thưởng', () => setDoc(doc(db, 'achievements', 'TEST_PERM_A2'), sample('TEST_PERM_A2')));
  if (adminAch) cleanup.push(() => deleteDoc(doc(db, 'achievements', 'TEST_PERM_A2')));

  for (const undo of cleanup) await undo();
  console.log('\n(đã dọn dữ liệu kiểm thử)');

  const pass = !bchAch && !bchCri && bchVio && adminAch;
  console.log(pass ? '\n✔ ĐÚNG YÊU CẦU: chỉ admin ghi được điểm thưởng' : '\n✘ Quyền chưa đúng như mong đợi');
  process.exit(pass ? 0 : 1);
})();
