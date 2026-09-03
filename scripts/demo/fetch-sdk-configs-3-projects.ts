/**
 * Lấy SDK config của Firebase Web App cho 3 project đã có.
 *
 * Firebase không trả config ngay trong response khi tạo Web App — phải đợi
 * operation xong rồi mới đọc /v1beta1/{appName}/config.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS = [
  'nennep-thptchuyenlaocai',
  'nennep-thptnguyendu',
  'nennep-thptlythuongkiet',
];

const CUSTOM_DOMAINS = {
  'nennep-thptchuyenlaocai': 'thptchuyenlaocai.nennep.pro.vn',
  'nennep-thptnguyendu': 'thptnguyendu.nennep.pro.vn',
  'nennep-thptlythuongkiet': 'thptlythuongkiet.nennep.pro.vn',
};

async function getAccessToken() {
  const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const { tokens } = JSON.parse(readFileSync(configPath, 'utf8'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  return (await res.json()).access_token;
}

async function listWebApps(token: string, projectId: string) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()).apps || [];
}

async function getSdkConfig(token: string, appName: string) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

async function main() {
  const token = await getAccessToken();
  const summary: Record<string, any> = {};

  for (const pid of PROJECTS) {
    console.log(`\n⏳ Lấy SDK config cho ${pid}...`);
    const apps = await listWebApps(token, pid);
    console.log(`   Tìm thấy ${apps.length} Web App`);
    if (apps.length === 0) continue;
    const app = apps[0];
    const config = await getSdkConfig(token, app.name);
    if (!config) {
      console.log('   ⚠ Chưa lấy được config (Web App vừa tạo, chờ vài phút)');
      summary[pid] = { appId: app.appId, name: app.name };
    } else {
      console.log(`   ✔ SDK Config:`);
      console.log('   ', JSON.stringify(config, null, 2).split('\n').join('\n    '));
      summary[pid] = { appId: app.appId, config };
    }
  }

  console.log('\n=== Tóm tắt ===');
  console.log(JSON.stringify(summary, null, 2));

  // Ghi ra file để dùng cho bước deploy
  writeFileSync('scripts/demo/sdk-configs.json', JSON.stringify(summary, null, 2));
}

main().catch(console.error);
