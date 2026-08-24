/**
 * Kiểm chứng realtime: mở listener cho tuần đang theo dõi, ghi thử một bản ghi
 * rồi xem listener có nhận được ngay không, cuối cùng dọn sạch.
 *
 * Chạy: pnpm tsx scripts/demo/test-realtime.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

const WEEK = { start: '2026-05-18', end: '2026-05-24' }; // Tuần 36
const TEST_ID = 'TEST_REALTIME_TMP';

(async () => {
  await signInWithEmailAndPassword(auth, 'admin@nennep.demo', 'NenNep@2026');
  console.log('✔ Đã đăng nhập admin');

  let firstCount = 0;
  let sawTestRecord = false;
  let sawRemoval = false;
  const t0 = Date.now();

  const stop = onSnapshot(
    query(collection(db, 'violations'), where('date', '>=', WEEK.start), where('date', '<=', WEEK.end)),
    (snap) => {
      const has = snap.docs.some((d) => d.id === TEST_ID);
      if (!firstCount) {
        firstCount = snap.size;
        console.log(`   Lần đầu nhận: ${snap.size} bản ghi trong tuần 36`);
      } else if (has && !sawTestRecord) {
        sawTestRecord = true;
        console.log(`✔ Listener thấy bản ghi mới sau ${Date.now() - t0}ms (không cần bấm làm mới)`);
      } else if (!has && sawTestRecord) {
        sawRemoval = true;
        console.log('✔ Listener thấy bản ghi bị xoá');
      }
    },
    (e) => console.log('✘ Listener lỗi:', e.message),
  );

  await new Promise((r) => setTimeout(r, 2500));

  console.log('→ Ghi một vi phạm thử...');
  await setDoc(doc(db, 'violations', TEST_ID), {
    id: TEST_ID,
    date: '2026-05-20',
    classId: '10Toán1',
    studentId: '',
    criteriaId: 'TEST',
    points: 5,
    note: 'Bản ghi kiểm thử realtime',
    images: [],
    reportedBy: 'test',
    isSecurityReport: false,
    timestamp: 1779600000000,
  });

  await new Promise((r) => setTimeout(r, 3000));
  console.log('→ Xoá bản ghi thử...');
  await deleteDoc(doc(db, 'violations', TEST_ID));
  await new Promise((r) => setTimeout(r, 3000));

  stop();
  console.log(
    sawTestRecord && sawRemoval
      ? '\n✔ REALTIME HOẠT ĐỘNG: thêm và xoá đều tự hiện, dữ liệu đã dọn sạch'
      : '\n✘ Realtime chưa hoạt động như mong đợi',
  );
  process.exit(sawTestRecord && sawRemoval ? 0 : 1);
})();
