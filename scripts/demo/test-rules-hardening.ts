/**
 * Kiểm chứng đúng những đường tấn công mà đợt rà soát đã nêu — bằng cách thử
 * làm thật, không đọc luật rồi tin.
 *
 * Chạy: pnpm tsx scripts/demo/test-rules-hardening.ts
 */
import { readFileSync } from 'fs';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc, updateDoc, addDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { initFirebase, auth, db } from '../../services/firebase';
import { DEMO_EMAIL, DEMO_PASSWORD } from './credentials';

initFirebase(JSON.parse(readFileSync('public/tenant-config.json', 'utf8')).firebase);

const created: { collection: string; id: string }[] = [];

/** `expected` là kết quả ĐÚNG mong đợi: true = phải được phép, false = phải bị chặn */
const check = async (label: string, expected: boolean, fn: () => Promise<unknown>) => {
  let allowed = true;
  try { await fn(); } catch { allowed = false; }
  const ok = allowed === expected;
  const verdict = allowed ? 'được phép' : 'bị chặn';
  console.log(`   ${ok ? '✔' : '✘'} ${label.padEnd(52)} ${verdict}`);
  return ok;
};

(async () => {
  const results: boolean[] = [];

  // ── Dựng một bản ghi của NGƯỜI KHÁC để thử sửa/xoá ────────────────────────
  await signInWithEmailAndPassword(auth, DEMO_EMAIL.admin, DEMO_PASSWORD);
  const adminUid = auth.currentUser!.uid;
  const victimId = 'ZZ_TEST_VICTIM';
  await setDoc(doc(db, 'violations', victimId), {
    id: victimId, date: '2026-05-20', classId: '10Toán1', studentId: '', criteriaId: 'TEST',
    points: 10, note: 'bản ghi của quản trị viên', images: [], reportedBy: adminUid,
    isSecurityReport: false, timestamp: 1779600000000,
  });
  created.push({ collection: 'violations', id: victimId });

  // Lấy một lớp KHÁC lớp mà cờ đỏ phụ trách
  const classSnap = await getDocs(query(collection(db, 'classes'), limit(20)));
  const otherClass = classSnap.docs.map(d => d.id).find(id => id !== '10Toán1') ?? '11Anh';
  await signOut(auth);

  // ── Cờ đỏ: quyền ghi vi phạm, KHÔNG có editOthers, CÓ ownClassOnly ────────
  console.log('\n▶ Cờ đỏ (entryViolation + ownClassOnly, không có editOthers)');
  await signInWithEmailAndPassword(auth, DEMO_EMAIL.redFlag, DEMO_PASSWORD);
  const redFlagUid = auth.currentUser!.uid;

  results.push(await check('ghi vi phạm cho lớp mình, đứng tên mình', true, () =>
    setDoc(doc(db, 'violations', 'ZZ_TEST_OWN'), {
      id: 'ZZ_TEST_OWN', date: '2026-05-20', classId: '10Toán1', studentId: '', criteriaId: 'TEST',
      points: 5, note: 'hợp lệ', images: [], reportedBy: redFlagUid,
      isSecurityReport: false, timestamp: 1779600000000,
    })));
  created.push({ collection: 'violations', id: 'ZZ_TEST_OWN' });

  results.push(await check('xoá bản ghi của người khác', false, () =>
    deleteDoc(doc(db, 'violations', victimId))));

  results.push(await check('sửa điểm bản ghi của người khác', false, () =>
    updateDoc(doc(db, 'violations', victimId), { points: 500 })));

  results.push(await check('ghi bản ghi mang tên người khác', false, () =>
    setDoc(doc(db, 'violations', 'ZZ_TEST_SPOOF'), {
      id: 'ZZ_TEST_SPOOF', date: '2026-05-20', classId: '10Toán1', studentId: '', criteriaId: 'TEST',
      points: 5, note: 'đổ vấy', images: [], reportedBy: adminUid,
      isSecurityReport: false, timestamp: 1779600000000,
    })));

  results.push(await check(`ghi vi phạm cho lớp khác (${otherClass})`, false, () =>
    setDoc(doc(db, 'violations', 'ZZ_TEST_OTHERCLASS'), {
      id: 'ZZ_TEST_OTHERCLASS', date: '2026-05-20', classId: otherClass, studentId: '', criteriaId: 'TEST',
      points: 5, note: 'ngoài lớp phụ trách', images: [], reportedBy: redFlagUid,
      isSecurityReport: false, timestamp: 1779600000000,
    })));

  results.push(await check('tự nâng quyền bằng cách ghi đè bảng phân quyền', false, () =>
    setDoc(doc(db, 'settings', 'roles'), { RED_FLAG: { manageSystem: true } }, { merge: true })));

  results.push(await check('tự đổi vai trò của mình thành ADMIN', false, () =>
    updateDoc(doc(db, 'users', redFlagUid), { role: 'ADMIN' })));

  results.push(await check('ghi nhật ký mang tên quản trị viên', false, () =>
    addDoc(collection(db, 'auditLogs'), {
      userId: adminUid, userName: 'Quản trị viên', userRole: 'ADMIN',
      action: 'DELETE_VIOLATION', details: 'bịa', timestamp: Date.now(),
    })));

  results.push(await check('đọc nhật ký (bên trong có email tài khoản)', false, () =>
    getDocs(query(collection(db, 'auditLogs'), limit(1)))));

  results.push(await check('xoá chính bản ghi mình vừa ghi', true, () =>
    deleteDoc(doc(db, 'violations', 'ZZ_TEST_OWN'))));

  // ── Dọn ───────────────────────────────────────────────────────────────────
  await signOut(auth);
  await signInWithEmailAndPassword(auth, DEMO_EMAIL.admin, DEMO_PASSWORD);
  for (const { collection: col, id } of created) {
    await deleteDoc(doc(db, col, id)).catch(() => {});
  }
  await deleteDoc(doc(db, 'violations', 'ZZ_TEST_SPOOF')).catch(() => {});
  await deleteDoc(doc(db, 'violations', 'ZZ_TEST_OTHERCLASS')).catch(() => {});
  console.log('\n(đã dọn dữ liệu kiểm thử)');

  const failed = results.filter(r => !r).length;
  console.log(failed === 0
    ? `\n✔ ${results.length}/${results.length} — mọi đường tấn công đã bị chặn, luồng hợp lệ vẫn chạy`
    : `\n✘ ${failed}/${results.length} kiểm tra KHÔNG đạt`);
  process.exit(failed === 0 ? 0 : 1);
})();
