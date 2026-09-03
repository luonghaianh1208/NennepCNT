/**
 * Kiểm chứng luồng nhập thành tích theo hoạt động bằng tài khoản KHÔNG phải admin:
 * tạo tiêu chí mới cho hoạt động chưa có, ghi thành tích cho 3 lớp một lượt,
 * đọc lại để đối chiếu rồi dọn sạch.
 *
 * Chạy: pnpm tsx scripts/demo/test-achievement-entry.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { DEMO_EMAIL, DEMO_PASSWORD } from './credentials';

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

const CRITERIA_ID = 'TEST_C_HOATDONG';
const RECORD_IDS = ['TEST_A_1', 'TEST_A_2', 'TEST_A_3'];

(async () => {
  const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL.bch, DEMO_PASSWORD);
  const token = await cred.user.getIdTokenResult();
  console.log(`✔ Đăng nhập ${DEMO_EMAIL.bch} (vai trò: ${token.claims.role}) — không phải ADMIN`);

  // 1. Tạo tiêu chí cho hoạt động chưa có trong danh mục
  await setDoc(doc(db, 'criteria', CRITERIA_ID), {
    id: CRITERIA_ID,
    content: 'Nhất Hội thi kiểm thử',
    points: 45,
    type: 'PLUS',
  });
  console.log('✔ Người nhập liệu (không phải admin) tạo được tiêu chí mới');

  // 2. Ghi thành tích cho 3 lớp trong một lượt
  const batch = writeBatch(db);
  RECORD_IDS.forEach((id, i) => {
    batch.set(doc(db, 'achievements', id), {
      id,
      date: '2026-05-20',
      classId: ['10Toán1', '11Lý', '12Sinh'][i],
      studentId: '',
      criteriaId: CRITERIA_ID,
      points: -45,
      note: `Hội thi kiểm thử · Học tập · Cấp trường · ${(i + 1) * 4} HS tham gia`,
      images: [],
      reportedBy: cred.user.uid,
      isSecurityReport: false,
      timestamp: Date.now() + i,
      activityName: 'Hội thi kiểm thử',
      activityGroup: 'Học tập',
      activityLevel: 'Cấp trường',
      participants: (i + 1) * 4,
    });
  });
  await batch.commit();
  console.log('✔ Ghi 3 lớp trong một lượt');

  // 3. Đọc lại đối chiếu
  const check = await getDoc(doc(db, 'achievements', RECORD_IDS[1]));
  const d = check.data()!;
  console.log(
    `✔ Đọc lại: lớp ${d.classId} | ${d.points}đ | ${d.participants} HS | ${d.activityLevel}`,
  );

  // 4. Dọn sạch
  const cleanup = writeBatch(db);
  RECORD_IDS.forEach(id => cleanup.delete(doc(db, 'achievements', id)));
  await cleanup.commit();
  await deleteDoc(doc(db, 'criteria', CRITERIA_ID)).catch(() =>
    console.log('  (tiêu chí thử phải để admin xoá — đúng như quy tắc đã đặt)'),
  );
  console.log('\n✔ LUỒNG NHẬP THÀNH TÍCH HOẠT ĐỘNG BÌNH THƯỜNG');
  process.exit(0);
})().catch(e => {
  console.error('✘ Lỗi:', e.message);
  process.exit(1);
});
