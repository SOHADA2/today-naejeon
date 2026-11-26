// 🔐 롤 계정 로그인 서명 키 다시 만들기(v0.1.242) — 중계(worker) 비밀값 RIOT_AUTH_SA가 없어졌거나 키를 바꿀 때만
//   전용 서비스 계정 tn-riot-auth(역할 없음 = DB 권한 없음 · Firebase 커스텀 로그인 증표 서명만)에 새 키를 만들어
//   **stdout으로 {client_email, private_key}만** 내보냄 → 화면·파일에 남기지 말고 바로 wrangler로 넘길 것
//   사용(리포 루트 · firebase login 된 PC · wrangler login 된 PC):
//     cd worker && node ../tools/riot-auth-key.cjs | npx wrangler@3 secret put RIOT_AUTH_SA
//     (Windows PowerShell이면 npx.cmd · 진행 글은 stderr로만 나옴)
//   ⚠️ 이 계정에 역할(roles)을 붙이지 말 것 · DB 관리자 계정(firebase-adminsdk) 키를 중계에 넣지 말 것
//   ⚠️ 옛 키는 Google에 남음 — 지우려면 IAM 「서비스 계정 → tn-riot-auth → 키」에서(또는 gapi DELETE …/keys/{id})
//   🏘️ 커뮤니티 전용 서버(v0.1.259) = 프로젝트를 인자로: node ../tools/riot-auth-key.cjs today-naejeon-queue | npx wrangler@3 secret put RIOT_AUTH_SA_TODAY_NAEJEON_QUEUE
//   계정이 없으면 만듦(처음 한 번 · IAM API가 꺼져 있으면 gapi로 serviceusage …/iam.googleapis.com:enable)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const P = process.argv[2] || 'today-naejeon-sohada', ID = 'tn-riot-auth', EMAIL = `${ID}@${P}.iam.gserviceaccount.com`;
const say = m => process.stderr.write(m + '\n');
function cliApi() {
  const roots = [process.env.FIREBASE_TOOLS_DIR, (() => { try { return path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'firebase-tools'); } catch (_) { return null; } })()].filter(Boolean);
  for (const r of roots) { try { return require(path.join(r, 'lib', 'api.js')); } catch (_) {} }
  throw new Error('firebase-tools를 못 찾음 — npm i -g firebase-tools 후 firebase login');
}
(async () => {
  const api = cliApi();
  const cfg = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE || process.env.HOME, '.config/configstore/firebase-tools.json'), 'utf8'));
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }) })).json();
  if (!t.access_token) throw new Error('firebase login 필요');
  const H = { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json', 'X-Goog-User-Project': P };
  let r = await fetch(`https://iam.googleapis.com/v1/projects/${P}/serviceAccounts/${EMAIL}`, { headers: H });
  if (r.status === 404) {
    r = await fetch(`https://iam.googleapis.com/v1/projects/${P}/serviceAccounts`, { method: 'POST', headers: H, body: JSON.stringify({ accountId: ID, serviceAccount: { displayName: 'today-naejeon riot auth (custom token signer only · no roles)' } }) });
    say('계정 만듦 ' + r.status + ' — 퍼질 때까지 20초 기다림'); await new Promise(z => setTimeout(z, 20000));
  } else if (!r.ok) throw new Error('계정 확인 실패 ' + r.status + ' (IAM API가 꺼져 있으면 켜기)');
  else say('계정 있음');
  const k = await fetch(`https://iam.googleapis.com/v1/projects/${P}/serviceAccounts/${EMAIL}/keys`, { method: 'POST', headers: H, body: JSON.stringify({ privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE', keyAlgorithm: 'KEY_ALG_RSA_2048' }) });
  const kj = await k.json(); if (!kj.privateKeyData) throw new Error('키 실패 ' + k.status + ' ' + JSON.stringify(kj).slice(0, 200));
  const cred = JSON.parse(Buffer.from(kj.privateKeyData, 'base64').toString('utf8'));
  say('키 만듦 · id ' + String(kj.name).split('/').pop().slice(0, 8) + '…');
  process.stdout.write(JSON.stringify({ client_email: cred.client_email, private_key: cred.private_key }));
})().catch(e => { say('오류 ' + e.message); process.exit(1); });
