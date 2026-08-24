/** Dọn dữ liệu kiểm thử còn sót bằng quyền quản trị */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'nennep-demo' });
const db = getFirestore();

(async () => {
  for (const [col, id] of [['criteria', 'TEST_C_HOATDONG'], ['violations', 'TEST_REALTIME_TMP']] as const) {
    const ref = db.collection(col).doc(id);
    if ((await ref.get()).exists) {
      await ref.delete();
      console.log(`✔ Đã xoá ${col}/${id}`);
    } else {
      console.log(`   ${col}/${id}: không còn`);
    }
  }
  const counts = await Promise.all(
    ['criteria', 'violations', 'achievements'].map(async c => `${c}: ${(await db.collection(c).count().get()).data().count}`),
  );
  console.log('Số bản ghi hiện tại →', counts.join(' · '));
  process.exit(0);
})();
