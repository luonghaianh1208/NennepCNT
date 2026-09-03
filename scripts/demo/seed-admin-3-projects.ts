/**
 * Seed `luonghaianh1208@gmail.com` vào allowlist làm ADMIN cho 3 project.
 *
 * Admin SDK bỏ qua luật Firestore (chỉ client mới bị) nên ghi thẳng được
 * document `allowlist/{email}`. Sau khi cấp, người dùng đăng nhập bằng Google
 * với chính email này là claimAccess tự gắn role ADMIN.
 *
 * Mỗi lần chạy chỉ ghi nếu document chưa tồn tại — an toàn để chạy lại.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';

const PROJECTS = [
  'nennep-thptchuyenlaocai',
  'nennep-thptnguyendu',
  'nennep-thptlythuongkiet',
];

const ADMIN_EMAIL = 'luonghaianh1208@gmail.com';
const ADMIN_NAME = 'Lương Hải Anh';
const ADMIN_ROLE = 'ADMIN';

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

async function seedAdmin(token: string, projectId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/allowlist/${encodeURIComponent(ADMIN_EMAIL)}`;
  // Check exists
  const get = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (get.ok) {
    const existing = await get.json();
    const fields = existing.fields || {};
    console.log(`  ℹ ${projectId}: đã có role=${fields.role?.stringValue || '?'}`);
    return;
  }
  const body = {
    fields: {
      email: { stringValue: ADMIN_EMAIL },
      name: { stringValue: ADMIN_NAME },
      role: { stringValue: ADMIN_ROLE },
      className: { stringValue: '' },
      active: { booleanValue: true },
      uid: { stringValue: '' },
      lastSignIn: { nullValue: 'NULL_VALUE' },
      createdAt: { timestampValue: new Date().toISOString() },
    },
  };
  const post = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (post.ok) {
    console.log(`  ✔ ${projectId}: cấp ADMIN cho ${ADMIN_EMAIL}`);
  } else {
    console.log(`  ❌ ${projectId}: ${post.status} ${await post.text()}`);
  }
}

async function main() {
  const token = await getAccessToken();
  for (const pid of PROJECTS) {
    console.log(`\n=== ${pid} ===`);
    await seedAdmin(token, pid);
  }
  console.log('\n🎉 Hoàn thành seed admin cho 3 project!');
  console.log(`\nLưu ý: sau khi đăng nhập vào trang web của mỗi trường, ô "Trạng thái"`);
  console.log(`sẽ chuyển từ "CHƯA VÀO LẦN NÀO" sang "ĐANG DÙNG". Đó là dấu hiệu`);
  console.log(`admin đã được gắn role thành công.`);
}

main().catch(console.error);
