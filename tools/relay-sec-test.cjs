// 🛡️ 영상 중계(worker/clips-proxy.js) 보안 시험(2026-11-28 보안 점검) — 롤 클라이언트가 켜진 PC에서 · 중계를 deploy한 뒤
//   사용(리포 루트): node tools/relay-sec-test.cjs
//   확인 = 게스트(익명) 표식으로는 올리기·직접 올리기 토큰·디스코드 길이 전부 막힘 · 롤 계정 표식 = 토큰 받기 됨 · 남의 방 디스코드 옮기기·남의 디스코드 번호 묻기 거절 · /shot 닫힘
//   ⚠️ 표식·토큰 값은 화면에 안 찍음 · 디스코드에서 실제로 사람을 옮기는 요청은 안 보냄(거절되는 것만)
const fs = require('fs'), https = require('https'), path = require('path');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const KEY = (MAIN.match(/FIREBASE_API_KEY = '([^']+)'/) || [])[1], W = process.env.TN_CLIP_PROXY || (MAIN.match(/RIOT_AUTH_URL = [^']*'(https:[^']+)'/) || [])[1];
const LF = ['D:/Riot Games/League of Legends/lockfile', 'C:/Riot Games/League of Legends/lockfile'].find(p => fs.existsSync(p));
if (!LF) { console.log('lockfile 없음 — 롤 클라이언트를 켜고 다시'); process.exit(1); }
const [, , port, pw] = fs.readFileSync(LF, 'utf8').split(':');
const lcu = p => new Promise(ok => https.get({ host: '127.0.0.1', port, path: p, rejectUnauthorized: false, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + pw).toString('base64') } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch (_) { ok(null); } }); }).on('error', () => ok(null)));
const post = (u, b, h) => fetch(u, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json', 'x-tn-app': 'today-naejeon' }, h || {}), body: b === undefined ? undefined : JSON.stringify(b) }).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
let pass = 0, fail = 0;
const T = (name, ok, x) => { ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', name, x === undefined ? '' : x); };
(async () => {
  const me = await lcu('/lol-summoner/v1/current-summoner'), ent = await lcu('/entitlements/v1/token');
  if (!me || !me.puuid || !ent || !ent.accessToken) { console.log('롤 로그인 안 됨'); process.exit(1); }
  const ct = await post(W + '/riot-auth', { token: ent.accessToken });
  const rs = ct.j && ct.j.token ? await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { token: ct.j.token, returnSecureToken: true }) : null;
  const RT = rs && rs.j && rs.j.idToken; T('롤 계정 로그인(중계 /riot-auth)', !!RT, ct.s);
  const NT = ((await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { returnSecureToken: true })).j || {}).idToken;
  const R = { Authorization: 'Bearer ' + RT }, N = { Authorization: 'Bearer ' + NT }, day = new Date().toISOString().slice(0, 10), FAKE = '123456789012345678';
  let r;
  r = await post(`${W}/upload-token?day=${day}`, undefined, N); T('게스트 — 직접 올리기 토큰(저장소 쓰기 토큰) 거절', r.s === 401 && !(r.j && r.j.token), r.s);
  r = await post(`${W}/upload?day=${day}&name=rt_sec.webm`, undefined, N); T('게스트 — 올리기 거절', r.s === 401, r.s);
  r = await post(`${W}/discord/guild`, { guild: FAKE }, N); T('게스트 — 디스코드 서버 확인 거절', r.s === 401, r.s);
  r = await post(`${W}/discord/member`, { guild: FAKE, id: FAKE }, N); T('게스트 — 디스코드 사람 확인 거절', r.s === 401, r.s);
  r = await post(`${W}/discord/move`, { moves: [{ id: FAKE, to: 'lobby' }], room: 'rt_none' }, N); T('게스트 — 디스코드 옮기기 거절', r.s === 401, r.s);
  r = await post(`${W}/upload-token?day=${day}`, undefined, {}); T('표식 없음 — 거절', r.s === 401, r.s);
  r = await post(`${W}/shot`, {}, R); T('/shot 닫힘', r.s === 410, r.s);
  r = await post(`${W}/upload-token?day=${day}`, undefined, R); T('롤 계정 — 직접 올리기 토큰 받기(앱이 쓰는 길)', r.s === 200 && !!(r.j && (r.j.token || r.j.url || r.j.upload)), r.s + ' ' + (r.j ? Object.keys(r.j).join(',') : ''));
  r = await post(`${W}/discord/move`, { moves: [{ id: FAKE, to: 'lobby' }], room: 'rt_none' }, R); T('롤 계정 — 내가 방장이 아닌(없는) 방으로 옮기기 거절', r.s === 403, r.s + ' ' + JSON.stringify(r.j));
  r = await post(`${W}/discord/move`, { moves: [{ id: FAKE, to: 'lobby' }], room: '../../x' }, R); T('롤 계정 — 방 번호에 이상한 글자 거절', r.s === 403, r.s + ' ' + JSON.stringify(r.j));
  r = await post(`${W}/discord/member`, { guild: FAKE, id: FAKE }, R); T('롤 계정 — 남의 디스코드 번호 묻기 거절', r.s === 403, r.s + ' ' + JSON.stringify(r.j));
  r = await post(`${W}/riot-auth`, { token: 'x.y.z' }); T('엉터리 라이엇 증표 거절', r.s === 401, r.s);
  console.log(`\n중계 보안 시험 · 통과 ${pass} · 실패 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('오류', e.message); process.exit(1); });
