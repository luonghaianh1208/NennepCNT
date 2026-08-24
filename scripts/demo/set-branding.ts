/** Đặt thương hiệu cho một bản triển khai (chạy khi bàn giao trường mới) */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.TENANT_PROJECT ?? 'nennep-demo';
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const branding = {
  schoolName: process.env.SCHOOL_NAME ?? 'Trường THPT Demo',
  shortName: process.env.SHORT_NAME ?? 'NỀN NẾP DEMO',
  slogan: process.env.SLOGAN ?? 'Hệ Thống Quản Lý Nền Nếp',
  academicYear: process.env.ACADEMIC_YEAR ?? '2025-2026',
  logoUrl: process.env.LOGO_URL ?? '',
};

(async () => {
  await db.doc('settings/branding').set(branding, { merge: true });
  console.log(`✔ Đã đặt thương hiệu cho ${projectId}:`);
  Object.entries(branding).forEach(([k, v]) => console.log(`   ${k}: ${v || '(trống)'}`));
  process.exit(0);
})();
