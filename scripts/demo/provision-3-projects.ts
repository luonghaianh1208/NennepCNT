import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';

const BILLING_ACCOUNT_ID = '01DA6E-471738-B66BAE'; // EcoSort

const PROJECTS = [
  { id: 'nennep-thptchuyenlaocai', name: 'Nen Nep THPT Chuyen Lao Cai' },
  { id: 'nennep-thptnguyendu', name: 'Nen Nep THPT Nguyen Du' },
  { id: 'nennep-thptlythuongkiet', name: 'Nen Nep THPT Ly Thuong Kiet' },
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
  if (!data.access_token) throw new Error('Không lấy được access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function createGcpProject(token: string, id: string, name: string) {
  console.log(`\n⏳ Đang tạo GCP project "${id}" (${name})...`);
  const res = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId: id, name }),
  });
  const data = await res.json();
  if (data.error && data.error.code !== 409) {
    throw new Error(`Tạo project ${id} lỗi: ` + JSON.stringify(data.error));
  }
  if (data.error?.code === 409) {
    console.log(`   Project ${id} đã tồn tại từ trước.`);
  } else {
    console.log(`   ✔ Đã gửi yêu cầu tạo project ${id}. Đang chờ Google xử lý...`);
    // Chờ Operation xong
    let done = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const opRes = await fetch(`https://cloudresourcemanager.googleapis.com/v1/${data.name}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const opData = await opRes.json();
      if (opData.done) {
        done = true;
        break;
      }
    }
    console.log(`   ✔ GCP project ${id} đã sẵn sàng.`);
  }
}

async function linkBilling(token: string, projectId: string) {
  console.log(`⏳ Gắn tài khoản thanh toán EcoSort (${BILLING_ACCOUNT_ID}) cho ${projectId}...`);
  const res = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      billingAccountName: `billingAccounts/${BILLING_ACCOUNT_ID}`,
      billingEnabled: true,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Gắn billing lỗi: ` + JSON.stringify(data.error));
  console.log(`   ✔ Gắn billing EcoSort thành công: billingEnabled = ${data.billingEnabled}`);
}

async function addFirebase(token: string, projectId: string) {
  console.log(`⏳ Kích hoạt Firebase cho project ${projectId}...`);
  const res = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (data.error && data.error.code !== 409) {
    console.warn(`   ⚠ Cảnh báo kích hoạt Firebase:`, data.error.message);
  } else {
    console.log(`   ✔ Đã kích hoạt Firebase cho ${projectId}.`);
  }
}

async function main() {
  const token = await getAccessToken();

  for (const p of PROJECTS) {
    try {
      await createGcpProject(token, p.id, p.name);
      await linkBilling(token, p.id);
      await addFirebase(token, p.id);
    } catch (e: any) {
      console.error(`✖ Lỗi khi xử lý ${p.id}:`, e.message || e);
    }
  }

  console.log('\n========================================');
  console.log('🎉 Hoàn thành khởi tạo 3 project!');
  console.log('========================================\n');
}

main().catch(console.error);
