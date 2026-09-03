/**
 * Xóa tài khoản admin luonghaianh1208@gmail.com khỏi danh sách allowlist
 * của 3 project trường để bảo đảm tính riêng tư cho nhà trường:
 *   - nennep-thptchuyenlaocai
 *   - nennep-thptlythuongkiet
 *   - nennep-thptnguyendu
 *
 * Chạy: npx tsx scripts/demo/remove-admin-3-projects.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS = [
  'nennep-thptchuyenlaocai',
  'nennep-thptlythuongkiet',
  'nennep-thptnguyendu',
];

const ADMIN_EMAIL = 'luonghaianh1208@gmail.com';

async function getAccessToken() {
  const cfg = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const j = JSON.parse(readFileSync(cfg, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: j.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  return (await r.json()).access_token;
}

async function removeAdmin(token: string, projectId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/allowlist/${encodeURIComponent(ADMIN_EMAIL)}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.ok) {
    console.log(`  ✔ [${projectId}] Đã xóa ${ADMIN_EMAIL} khỏi allowlist`);
  } else if (res.status === 404) {
    console.log(`  ℹ [${projectId}] ${ADMIN_EMAIL} không tồn tại trong allowlist`);
  } else {
    console.log(`  ❌ [${projectId}] Lỗi ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  console.log('⏳ Đang lấy Access Token Google...');
  const token = await getAccessToken();

  console.log(`\n🚀 Bắt đầu xóa ${ADMIN_EMAIL} khỏi 3 project:\n`);
  for (const pid of PROJECTS) {
    await removeAdmin(token, pid);
  }

  console.log('\n🎉 Hoàn tất! Danh sách tài khoản trên web của 3 trường giờ hoàn toàn riêng tư.');
}

main().catch(console.error);
