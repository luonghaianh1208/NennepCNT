/** Nạp bảng vai trò & quyền mặc định cho một bản triển khai */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { INITIAL_ROLE_DEFINITIONS } from '../../utils';

initializeApp({ credential: applicationDefault(), projectId: process.env.TENANT_PROJECT ?? 'nennep-demo' });

(async () => {
  await getFirestore().doc('settings/roles').set(INITIAL_ROLE_DEFINITIONS);
  console.log('✔ Đã nạp bảng quyền cho', Object.keys(INITIAL_ROLE_DEFINITIONS).length, 'vai trò:');
  Object.entries(INITIAL_ROLE_DEFINITIONS).forEach(([k, v]: any) => {
    const on = Object.entries(v).filter(([kk, vv]) => vv === true).map(([kk]) => kk);
    console.log(`   ${v.label.padEnd(18)} ${on.length} quyền`);
  });
  process.exit(0);
})();
