/**
 * Kiểm chứng chốt chặn mất dữ liệu: đồng bộ cấu hình khi danh sách học sinh
 * còn trống (chưa tải xong / tải lỗi) phải bị từ chối, không được xoá gì.
 *
 * Chạy: pnpm tsx scripts/demo/test-sync-guard.ts
 */
import { readFileSync } from 'fs';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { initFirebase, api, auth } from '../../services/firebase';

const config = JSON.parse(readFileSync('public/tenant-config.json', 'utf8')).firebase;
initFirebase(config);

(async () => {
  await signInWithEmailAndPassword(auth, 'admin@nennep.demo', 'NenNep@2026');

  const before = await api.getDirectory();
  const core = await api.getCoreData();
  console.log(`Trước khi thử: ${before.students.length} học sinh, ${core.classes.length} lớp\n`);

  console.log('Gọi đồng bộ với danh sách học sinh TRỐNG (mô phỏng dữ liệu chưa tải xong):');
  try {
    await api.syncSettings({
      Classes: core.classes,
      Students: [], // ← đây là kịch bản nguy hiểm
      Criteria: core.criteria,
      TimeConfigs: core.timeConfigs,
    });
    console.log('   ✘ ĐÃ CHẠY — không có chốt chặn!');
  } catch (e: any) {
    console.log('   ✔ BỊ TỪ CHỐI:', e.message.slice(0, 120));
  }

  const after = await api.getDirectory();
  console.log(`\nSau khi thử: ${after.students.length} học sinh`);
  console.log(
    after.students.length === before.students.length
      ? '✔ DỮ LIỆU NGUYÊN VẸN'
      : `✘ MẤT ${before.students.length - after.students.length} HỌC SINH`,
  );
  process.exit(after.students.length === before.students.length ? 0 : 1);
})().catch(e => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});
