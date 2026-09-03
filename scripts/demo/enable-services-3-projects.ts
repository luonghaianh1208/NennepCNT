import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS = [
  'nennep-thptchuyenlaocai',
  'nennep-thptnguyendu',
  'nennep-thptlythuongkiet',
];

const SERVICES_TO_ENABLE = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebasestorage.googleapis.com',
  'cloudfunctions.googleapis.com',
  'cloudbuild.googleapis.com',
  'artifactregistry.googleapis.com',
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

async function enableServices(token: string, projectId: string) {
  console.log(`\n⏳ Bật các API cần thiết cho ${projectId}...`);
  const res = await fetch(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      serviceIds: SERVICES_TO_ENABLE,
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.warn(`   ⚠ Lỗi batchEnable ${projectId}:`, data.error.message || data.error);
    return;
  }
  // Chờ operation
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const opRes = await fetch(`https://serviceusage.googleapis.com/v1/${data.name}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const opData = await opRes.json();
    if (opData.done) {
      console.log(`   ✔ Các API đã bật xong cho ${projectId}.`);
      break;
    }
  }
}

async function createFirestore(token: string, projectId: string) {
  console.log(`⏳ Tạo Firestore database (default) tại asia-southeast1 cho ${projectId}...`);
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId: 'asia-southeast1',
      type: 'FIRESTORE_NATIVE',
    }),
  });
  const data = await res.json();
  if (data.error && data.error.code !== 409) {
    console.warn(`   ⚠ Lỗi Firestore ${projectId}:`, data.error.message || data.error);
  } else {
    console.log(`   ✔ Firestore (asia-southeast1) đã sẵn sàng cho ${projectId}.`);
  }
}

async function main() {
  const token = await getAccessToken();
  for (const pid of PROJECTS) {
    await enableServices(token, pid);
    await createFirestore(token, pid);
  }
  console.log('\n🎉 Hoàn thành thiết lập dịch vụ cho 3 project!');
}

main().catch(console.error);
