import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS = [
  { id: 'nennep-thptchuyenlaocai', displayName: 'THPT Chuyen Lao Cai' },
  { id: 'nennep-thptnguyendu', displayName: 'THPT Nguyen Du' },
  { id: 'nennep-thptlythuongkiet', displayName: 'THPT Ly Thuong Kiet' },
];

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
  const data = await res.json();
  return data.access_token;
}

async function createWebApp(token: string, projectId: string, displayName: string) {
  console.log(`\n⏳ Tạo Web App cho ${projectId}...`);
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName }),
  });
  const data = await res.json();
  if (data.error && data.error.code !== 409) {
    console.warn(`   ⚠ Lỗi tạo Web App ${projectId}:`, JSON.stringify(data.error));
    return null;
  }
  if (data.error?.code === 409) {
    console.log(`   ℹ Web App đã tồn tại cho ${projectId}, lấy danh sách...`);
    const listRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = await listRes.json();
    const app = listData.apps?.[0];
    if (!app) {
      console.warn(`   ⚠ Không tìm thấy Web App cho ${projectId}`);
      return null;
    }
    console.log(`   ✔ Web App đã có: ${app.appId} (${app.name})`);
    return app;
  }
  console.log(`   ✔ Web App tạo: ${data.appId} (${data.name})`);
  // Đợi operation
  if (data.name?.includes('/operations/')) {
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const opRes = await fetch(`https://firebase.googleapis.com/v1beta1/${data.name}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const opData = await opRes.json();
      if (opData.done) {
        console.log(`   ✔ Web App operation done:`, JSON.stringify(opData.response || opData).substring(0, 200));
        return opData.response || data;
      }
    }
  }
  return data;
}

async function getSdkConfig(token: string, appName: string) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/${appName}/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) {
    console.warn(`   ⚠ Lỗi lấy SDK config:`, JSON.stringify(data.error));
    return null;
  }
  return data;
}

async function main() {
  const token = await getAccessToken();
  for (const p of PROJECTS) {
    const app = await createWebApp(token, p.id, p.displayName);
    if (!app) continue;
    // Chờ một chút để Web App sẵn sàng
    await new Promise(r => setTimeout(r, 3000));
    const appName = app.name || `projects/${p.id}/webApps/${app.appId}`;
    const config = await getSdkConfig(token, appName);
    if (config) {
      console.log(`   📋 SDK Config cho ${p.id}:`, JSON.stringify(config, null, 2));
    }
  }
  console.log('\n🎉 Hoàn thành Web App cho 3 project!');
}

main().catch(console.error);
