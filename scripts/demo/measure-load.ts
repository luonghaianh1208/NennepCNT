/** Đo thời gian tải dữ liệu như phía client vẫn làm, để biết chậm ở khâu nào */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA8vDLt97KKSKsGQ9gExVMC93phNbdVlK8',
  authDomain: 'nennep-demo.firebaseapp.com',
  projectId: 'nennep-demo',
  storageBucket: 'nennep-demo.firebasestorage.app',
  messagingSenderId: '870692201715',
  appId: '1:870692201715:web:1a08bcd260084a3aa74386',
});
const db = getFirestore(app);

const names = ['users', 'classes', 'students', 'criteria', 'violations', 'achievements', 'timeConfigs'];

(async () => {
  const t0 = Date.now();
  const results = await Promise.all(
    names.map(async (n) => {
      const start = Date.now();
      const snap = await getDocs(collection(db, n));
      const bytes = JSON.stringify(snap.docs.map((d) => d.data())).length;
      return { n, docs: snap.size, ms: Date.now() - start, kb: Math.round(bytes / 1024) };
    }),
  );
  results.forEach((r) => console.log(`${r.n.padEnd(13)} ${String(r.docs).padStart(5)} doc  ${String(r.ms).padStart(6)}ms  ${r.kb}KB`));
  console.log(`TỔNG (song song): ${Date.now() - t0}ms`);
  process.exit(0);
})();
