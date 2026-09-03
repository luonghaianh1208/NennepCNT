/**
 * Gắn tên miền phụ `*.nennep.pro.vn` vào 3 project:
 *   1. Authorized domains của Identity Platform (cho phép đăng nhập Google)
 *   2. Firebase Hosting custom domain (cấp CNAME để trỏ về Firebase)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS = [
  'nennep-thptchuyenlaocai',
  'nennep-thptnguyendu',
  'nennep-thptlythuongkiet',
];

const CUSTOM_DOMAINS: Record<string, string> = {
  'nennep-thptchuyenlaocai': 'thptchuyenlaocai.nennep.pro.vn',
  'nennep-thptnguyendu': 'thptnguyendu.nennep.pro.vn',
  'nennep-thptlythuongkiet': 'thptlythuongkiet.nennep.pro.vn',
};

const DEFAULT_DOMAINS = (projectId: string) => [
  `${projectId}.firebaseapp.com`,
  `${projectId}.web.app`,
  'localhost',
];

async function getAccessToken() {
  const cfg = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const { tokens } = JSON.parse(readFileSync(cfg, 'utf8'));
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

async function addAuthorizedDomain(token: string, projectId: string, domain: string) {
  // GET config hiện tại
  const get = await fetch(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cfg = await get.json();
  if (!cfg.authorizedDomains) cfg.authorizedDomains = DEFAULT_DOMAINS(projectId);
  if (cfg.authorizedDomains.includes(domain)) {
    console.log(`   ℹ ${domain} đã có trong authorized domains`);
    return;
  }
  cfg.authorizedDomains.push(domain);
  const put = await fetch(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=authorizedDomains`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authorizedDomains: cfg.authorizedDomains }),
  });
  if (!put.ok) {
    console.warn(`   ⚠ PATCH authorized domains: ${put.status} ${await put.text()}`);
  } else {
    console.log(`   ✔ Đã thêm ${domain} vào Authorized domains`);
  }
}

async function createCustomDomain(token: string, projectId: string, domain: string) {
  // Tìm site mặc định
  const sitesRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/sites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sites = (await sitesRes.json()).sites || [];
  const defaultSite = sites.find((s: any) => s.type === 'DEFAULT_SITE') || sites[0];
  if (!defaultSite) {
    console.log('   ⚠ Chưa có site mặc định — phải deploy hosting trước rồi mới tạo custom domain được');
    return;
  }
  const siteName = defaultSite.name;
  console.log(`   Site mặc định: ${siteName}`);

  // Tạo custom domain
  const cdRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/sites/${siteName.split('/').pop()}/customDomains`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ domain }),
  });
  const cdData = await cdRes.json();
  if (cdData.error) {
    if (cdData.error.code === 409) {
      console.log(`   ℹ Custom domain ${domain} đã tồn tại`);
    } else {
      console.log(`   ⚠ Lỗi tạo custom domain: ${cdData.error.message || JSON.stringify(cdData.error)}`);
    }
    return;
  }
  console.log(`   ✔ Custom domain tạo, trạng thái: ${cdData.state}`);
  console.log(`   Ownership info: ${JSON.stringify(cdData.ownershipVerification, null, 2)}`);
}

async function main() {
  const token = await getAccessToken();

  for (const pid of PROJECTS) {
    const domain = CUSTOM_DOMAINS[pid];
    console.log(`\n⏳ [${pid}] thêm ${domain}...`);
    try {
      await addAuthorizedDomain(token, pid, domain);
    } catch (e: any) {
      console.warn(`   ⚠ authorized domains: ${e.message || e}`);
    }
    try {
      await createCustomDomain(token, pid, domain);
    } catch (e: any) {
      console.warn(`   ⚠ custom domain: ${e.message || e}`);
    }
  }
}

main().catch(console.error);
