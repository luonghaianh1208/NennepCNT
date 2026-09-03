/**
 * Cấp quyền ADMIN cho các thầy cô quản trị của 3 trường:
 *   - THPT Chuyên Lào Cai: nnbchauhnue@gmail.com
 *   - THPT Lý Thường Kiệt: Dothunga.hp@gmail.com
 *   - THPT Nguyễn Du: ducnhatsupham@gmail.com
 *
 * Chạy: npx tsx scripts/demo/seed-school-admins.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface SchoolAdmin {
  projectId: string;
  schoolName: string;
  email: string;
  name: string;
}

const SCHOOL_ADMINS: SchoolAdmin[] = [
  {
    projectId: 'nennep-thptchuyenlaocai',
    schoolName: 'THPT Chuyên Lào Cai',
    email: 'nnbchauhnue@gmail.com',
    name: 'Quản Trị Viên — THPT Chuyên Lào Cai',
  },
  {
    projectId: 'nennep-thptlythuongkiet',
    schoolName: 'THPT Lý Thường Kiệt',
    email: 'dothunga.hp@gmail.com', // Chuẩn hóa về chữ thường
    name: 'Quản Trị Viên — THPT Lý Thường Kiệt',
  },
  {
    projectId: 'nennep-thptnguyendu',
    schoolName: 'THPT Nguyễn Du',
    email: 'ducnhatsupham@gmail.com',
    name: 'Quản Trị Viên — THPT Nguyễn Du',
  },
];

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

async function addAdmin(token: string, admin: SchoolAdmin) {
  const normEmail = admin.email.trim().toLowerCase();
  const url = `https://firestore.googleapis.com/v1/projects/${admin.projectId}/databases/(default)/documents/allowlist/${encodeURIComponent(normEmail)}`;

  const body = {
    fields: {
      email: { stringValue: normEmail },
      name: { stringValue: admin.name },
      role: { stringValue: 'ADMIN' },
      className: { stringValue: '' },
      active: { booleanValue: true },
      uid: { stringValue: '' },
      lastSignIn: { nullValue: 'NULL_VALUE' },
      createdAt: { timestampValue: new Date().toISOString() },
    },
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    console.log(`  ✔ [${admin.schoolName}] Cấp ADMIN thành công cho: ${normEmail}`);
  } else {
    console.log(`  ❌ [${admin.schoolName}] Lỗi ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  console.log('⏳ Đang lấy Access Token Google...');
  const token = await getAccessToken();

  console.log('\n🚀 Bắt đầu cấp quyền ADMIN cho 3 trường:\n');
  for (const admin of SCHOOL_ADMINS) {
    await addAdmin(token, admin);
  }

  console.log('\n🎉 Hoàn thành thiết lập tài khoản Admin cho cả 3 trường!');
  console.log('Các thầy cô dùng tài khoản Google tương ứng đăng nhập vào link trường là có full quyền Quản trị viên.');
}

main().catch(console.error);
