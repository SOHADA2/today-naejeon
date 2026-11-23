// 🔐 롤 계정 로그인 시험(v0.1.242) — 롤 클라이언트가 켜져 있는 PC에서 · 읽기 전용(롤 쪽은 GET만) · 라이엇 증표는 화면에 안 찍음
//   ① LCU 로그인 증표가 라이엇 공개 키로 확인되는지(여기서 직접) ② 중계 /riot-auth → Firebase 커스텀 로그인 → uid = 롤 puuid인지
//   ③ 계정 번호만 바꾼 위조·엉터리·앱 표시 없는 요청이 거절되는지(401·401·403)
//   사용(리포 루트): node tools/riot-auth-test.cjs [lockfile 경로]
//     lockfile 기본 = D:\Riot Games\… → C:\Riot Games\… 순서로 찾음 · 중계 주소 = env TN_CLIP_PROXY 또는 기본
//   롤이 꺼져 있거나 라이엇이 증표 모양을 바꾸면 ①에서 멈춤 → 앱은 익명 로그인으로 그대로 돌아감(main fbToken)
const fs = require('fs'), https = require('https'), crypto = require('crypto'), path = require('path');
const LF = [process.argv[2], 'D:/Riot Games/League of Legends/lockfile', 'C:/Riot Games/League of Legends/lockfile'].filter(Boolean).find(p => fs.existsSync(p));
if (!LF) { console.log('lockfile 없음 — 롤 클라이언트를 켜고 다시(또는 경로를 인자로)'); process.exit(1); }
const [, , port, pw] = fs.readFileSync(LF, 'utf8').split(':');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const KEY = (MAIN.match(/FIREBASE_API_KEY = '([^']+)'/) || [])[1], W = process.env.TN_CLIP_PROXY || (MAIN.match(/RIOT_AUTH_URL = [^']*'(https:[^']+)'/) || [])[1];
const DB = (MAIN.match(/FIREBASE_DB = '([^']+)'/) || [])[1];
const lcu = p => new Promise((ok, no) => https.get({ host: '127.0.0.1', port, path: p, rejectUnauthorized: false, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + pw).toString('base64') } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch (_) { ok(null); } }); }).on('error', no));
const post = (u, b, h) => fetch(u, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h || {}), body: JSON.stringify(b) }).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
const pay = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url'));
const mask = s => String(s || '').slice(0, 8) + '…';
const APP = { 'x-tn-app': 'today-naejeon' };
(async () => {
  const me = await lcu('/lol-summoner/v1/current-summoner'), ent = await lcu('/entitlements/v1/token');
  const tok = ent && ent.accessToken; if (!me || !me.puuid || !tok) { console.log('롤 로그인 안 됨 / 증표 없음'); process.exit(1); }
  console.log('롤 계정', me.gameName + '#' + me.tagLine, '· puuid', mask(me.puuid));
  const [h, p, sig] = tok.split('.'), Hh = JSON.parse(Buffer.from(h, 'base64url')), P = pay(tok);
  const J = await (await fetch('https://auth.riotgames.com/jwks.json')).json(), k = (J.keys || []).find(x => x.kid === Hh.kid);
  const ok = !!k && crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: k, format: 'jwk' }), Buffer.from(sig, 'base64url'));
  console.log('① 라이엇 서명', ok ? '✅' : '❌', '· kid', Hh.kid, '· iss', P.iss, '· cid', P.cid, '· sub = puuid?', P.sub === me.puuid);
  const r = await post(W + '/riot-auth', { token: tok }, APP);
  console.log('② 중계 /riot-auth →', r.s, r.j && r.j.uid ? 'uid = puuid? ' + (r.j.uid === me.puuid) : JSON.stringify(r.j));
  if (r.j && r.j.token) {
    const s = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { token: r.j.token, returnSecureToken: true });
    const Q = s.j && s.j.idToken ? pay(s.j.idToken) : null;
    console.log('   Firebase 로그인 →', s.s, Q ? `user_id = puuid? ${Q.user_id === me.puuid} · riot ${Q.riot} · ${Q.firebase.sign_in_provider}` : JSON.stringify(s.j).slice(0, 160));
    if (Q && DB) { const g = await fetch(`${DB}/today/config.json?shallow=true&auth=${s.j.idToken}`); console.log('   그 로그인으로 DB 읽기 →', g.status); }
  }
  const P2 = Object.assign({}, P, { sub: '00000000-0000-0000-0000-000000000000' });
  console.log('③ 위조', (await post(W + '/riot-auth', { token: h + '.' + Buffer.from(JSON.stringify(P2)).toString('base64url') + '.' + sig }, APP)).s, '· 엉터리', (await post(W + '/riot-auth', { token: 'a.b.c' }, APP)).s, '· 앱 표시 없이', (await post(W + '/riot-auth', { token: tok })).s, '(기대 401 · 401 · 403)');
})().catch(e => { console.log(/ECONNREFUSED/.test(e.message) ? '롤 클라이언트가 꺼져 있음(lockfile만 남음) — 롤을 켜고 다시' : '오류 ' + e.message); process.exit(1); });
