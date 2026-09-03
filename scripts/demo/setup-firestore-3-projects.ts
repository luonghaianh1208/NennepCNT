import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS = [
  'nennep-thptchuyenlaocai',
  'nennep-thptnguyendu',
  'nennep-thptlythuongkiet',
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

async function createFirestore(token: string, projectId: string) {
  console.log(`\n⏳ Khởi tạo Firestore Database (default) tại asia-southeast1 cho ${projectId}...`);
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
    console.log(`   ✔ Firestore (asia-southeast1) sẵn sàng cho ${projectId}.`);
  }
}

async function main() {
  const token = await getAccessToken();
  for (const pid of PROJECTS) {
    await createFirestore(token, pid);
  }
}

main().catch(console.error);
