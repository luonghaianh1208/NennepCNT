/**
 * Bật Firebase Identity Platform trên 3 project rồi mới thêm tên miền.
 *
 * Identity Platform (Auth) chưa được bật nên GET /v2/projects/{id}/config trả 404.
 * Sau khi enable service 'firebase.googleapis.com' thì sẽ có.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS = [
  'nennep-thptchuyenlaocai',
  'nennep-thptnguyendu',
  'nennep-thptlythuongkiet',
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

async function enableService(token: string, projectId: string, service: string) {
  const res = await fetch(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${service}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.ok;
}

async function enableGoogleSignIn(token: string, projectId: string) {
  // API IdentityToolkit v2: POST /oauthIdpConfig
  const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/oauthIdpConfigs?updateMask=clientId,clientSecret,name`;
  // Lấy clientId mặc định của project
  const get = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/defaultSupportedIdpConfigs?idpId=google.com`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   (${projectId}) defaultSupportedIdpConfigs status:`, get.status);
  return get.ok;
}

async function main() {
  const token = await getAccessToken();
  for (const pid of PROJECTS) {
    console.log(`\n⏳ [${pid}] bật Identity Platform + Google provider...`);
    const r1 = await enableService(token, pid, 'identitytoolkit.googleapis.com');
    console.log(`   identitytoolkit: ${r1 ? 'OK' : 'FAIL'}`);
    const r2 = await enableService(token, pid, 'firebase.googleapis.com');
    console.log(`   firebase: ${r2 ? 'OK' : 'FAIL'}`);
    // Chờ propagation
    await new Promise(r => setTimeout(r, 5000));
    await enableGoogleSignIn(token, pid);
  }
}

main().catch(console.error);
