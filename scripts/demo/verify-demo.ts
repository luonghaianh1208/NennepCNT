import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'nennep-demo' });
const db = getFirestore();

(async () => {
  for (const c of ['classes', 'students', 'criteria', 'timeConfigs', 'users', 'violations']) {
    const s = await db.collection(c).count().get();
    console.log(c.padEnd(12), s.data().count);
  }
  const snap = await db.collection('violations').orderBy('timestamp', 'desc').limit(50).get();
  const withImg = snap.docs.map((d) => d.data()).find((d: any) => (d.images ?? []).length);
  console.log('Vi phạm mẫu:', withImg?.date, '|', withImg?.classId, '| điểm', withImg?.points);
  const url = withImg.images[0];
  console.log('URL ảnh:', url.slice(0, 110) + '...');
  const r = await fetch(url);
  console.log('Tải ảnh →', r.status, r.headers.get('content-type'), Math.round(Number(r.headers.get('content-length') || 0) / 1024) + 'KB');
})();
