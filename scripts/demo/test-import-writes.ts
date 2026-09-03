/**
 * Kiểm chứng luồng ghi của import — gọi ĐÚNG hàm mà ứng dụng dùng
 * (services/firebase), không mô phỏng lại.
 *
 * Hai ca từng làm hỏng dữ liệu khi chuyển từ Apps Script sang Firestore:
 *   1. Vi phạm tập thể lớp: studentId = undefined
 *   2. Ngày người dùng gõ tay trong Excel: "20/05/2026"
 *
 * Chạy: pnpm tsx scripts/demo/test-import-writes.ts
 */
import { readFileSync } from 'fs';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { initFirebase, api, auth } from '../../services/firebase';
import { DEMO_EMAIL, DEMO_PASSWORD } from './credentials';

const config = JSON.parse(readFileSync('public/tenant-config.json', 'utf8')).firebase;
initFirebase(config);

const IDS = ['TEST_IMP_GROUP', 'TEST_IMP_DATE'];

(async () => {
  await signInWithEmailAndPassword(auth, DEMO_EMAIL.admin, DEMO_PASSWORD);
  console.log('✔ Đăng nhập admin\n');

  // Đúng hình dạng bản ghi mà màn hình import sinh ra
  const records = [
    {
      id: IDS[0],
      date: '2026-05-20',
      classId: '10Toán1',
      studentId: undefined, // dòng Excel không điền tên học sinh → vi phạm tập thể
      criteriaId: 'TEST',
      points: 10,
      note: 'kiểm thử tập thể',
      images: [],
      reportedBy: 'test',
      isSecurityReport: false,
      timestamp: 1779600000000,
    },
    {
      id: IDS[1],
      date: '20/05/2026', // người dùng gõ tay trong Excel
      classId: '11Lý',
      studentId: '',
      criteriaId: 'TEST',
      points: 10,
      note: 'kiểm thử ngày gõ tay',
      images: [],
      reportedBy: 'test',
      isSecurityReport: false,
      timestamp: 1779600000001,
    },
  ];

  console.log('1. Import một lô có cả hai ca khó:');
  const result = await api.batchCreateViolations(records as any);
  console.log(`   → ${result.status === 'success' ? 'GHI ĐƯỢC cả lô' : 'LỖI'}\n`);

  console.log('2. Đọc lại bằng truy vấn theo khoảng ngày (tuần 18/05–24/05):');
  const inWeek = await api.getRecordsInRange('2026-05-18', '2026-05-24');
  IDS.forEach(id => {
    const found = inWeek.find((r: any) => r.id === id);
    console.log(`   ${found ? '✔' : '✘'} ${id}${found ? ` — ngày lưu: ${found.date}` : ' — KHÔNG thấy'}`);
  });

  // Dọn sạch
  await api.deleteViolations(IDS);
  const after = await api.getRecordsInRange('2026-05-18', '2026-05-24');
  console.log(`\n(đã dọn: còn ${after.filter((r: any) => IDS.includes(r.id)).length} bản ghi kiểm thử)`);
  process.exit(0);
})().catch(e => {
  console.error('✘ Lỗi:', e.message);
  process.exit(1);
});
