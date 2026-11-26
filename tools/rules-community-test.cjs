// 🏘️ 커뮤니티 공간 규칙 시험(v0.1.258 · tools/rules-community.cjs로 만든 today/c/… · communities · communityCodes)
//   사용(리포 루트): node tools/rules-community-test.cjs   · 롤 클라이언트가 켜져 있으면 롤 계정 시험(R)까지 · 없으면 익명(게스트 · N)만
//   준비·정리 = 관리자(gapi) · 시험 커뮤니티 = rt_c(코드 RTCODE1) · 시험 칸 = rt_ 접두·2000-01-01 · 끝나면 다 지움
const fs = require('fs'), https = require('https'), path = require('path'), { execFileSync } = require('child_process');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const KEY = (MAIN.match(/FIREBASE_API_KEY = '([^']+)'/) || [])[1], PX = process.env.TN_CLIP_PROXY || (MAIN.match(/RIOT_AUTH_URL = [^']*'(https:[^']+)'/) || [])[1];
const DB = (MAIN.match(/FIREBASE_DB = '([^']+)'/) || [])[1];
const admin = (m, p, body) => execFileSync('node', [path.join(__dirname, 'gapi.cjs'), m, `${DB}/${p}.json`].concat(body !== undefined ? [JSON.stringify(body)] : [])).toString().trim();
const post = (u, b, h) => fetch(u, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h || {}), body: JSON.stringify(b) }).then(r => r.json().catch(() => null));
const C = 'today/c/rt_c', D = `${C}/days/2000-01-01`, SV = { '.sv': 'timestamp' }, OTHER = '00000000-0000-4000-8000-0000000000aa';
let pass = 0, fail = 0;
async function riot() {   // 롤 계정 로그인 표식(롤이 켜져 있을 때만)
  const LF = ['D:/Riot Games/League of Legends/lockfile', 'C:/Riot Games/League of Legends/lockfile'].find(p => fs.existsSync(p)); if (!LF) return null;
  const [, , port, pw] = fs.readFileSync(LF, 'utf8').split(':');
  const lcu = p => new Promise(ok => https.get({ host: '127.0.0.1', port, path: p, rejectUnauthorized: false, timeout: 3000, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + pw).toString('base64') } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch (_) { ok(null); } }); }).on('error', () => ok(null)));
  const me = await lcu('/lol-summoner/v1/current-summoner'), ent = await lcu('/entitlements/v1/token');
  if (!me || !me.puuid || !ent || !ent.accessToken) return null;
  const ct = await post(PX + '/riot-auth', { token: ent.accessToken }, { 'x-tn-app': 'today-naejeon' });
  const rs = ct && ct.token ? await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { token: ct.token, returnSecureToken: true }) : null;
  return rs && rs.idToken ? { tok: rs.idToken, A: me.puuid, name: me.gameName } : null;
}
(async () => {
  const NT = (await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { returnSecureToken: true }) || {}).idToken;
  const NU = JSON.parse(Buffer.from(NT.split('.')[1], 'base64url')).user_id;
  const R = await riot();
  console.log(`익명 uid ${NU.slice(0, 6)}… · ${R ? '롤 계정 ' + R.name : '롤 꺼짐 — 익명 시험만'}\n`);
  const req = async (tok, method, p, body) => (await fetch(`${DB}/${p}.json?auth=${tok}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).status;
  const t = async (who, name, want, method, p, body) => {
    if (who === 'R' && !R) return;
    const s = await req(who === 'R' ? R.tok : NT, method, p, body), ok = want === 'ok' ? s === 200 : s === 401 || s === 403;
    ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', want === 'ok' ? '허용' : '차단', who, name, s);
  };
  const now = Date.now();
  admin('PUT', 'today/communities/rt_c', { name: '시험커뮤', at: now, by: '시험' });
  admin('PUT', 'today/communityCodes/RTCODE1', 'rt_c');
  admin('PUT', `${C}/roomList/rt_x`, { name: '남의방', priv: false, host: '남', at: now, seen: now, by: '남' });
  admin('PUT', `${C}/rooms/rt_x/uids/${OTHER}`, OTHER);

  console.log('— 커뮤니티 찾기(초대 코드)');
  await t('N', '코드 한 칸 읽기', 'ok', 'GET', 'today/communityCodes/RTCODE1');
  await t('N', '코드 목록 읽기', 'deny', 'GET', 'today/communityCodes');
  await t('N', '커뮤니티 한 칸 읽기', 'ok', 'GET', 'today/communities/rt_c');
  await t('N', '커뮤니티 목록 읽기', 'deny', 'GET', 'today/communities');
  await t('N', '커뮤니티 만들기', 'deny', 'PUT', 'today/communities/rt_z', { name: 'x' });
  await t('N', '초대 코드 만들기', 'deny', 'PUT', 'today/communityCodes/HACK99', 'rt_c');
  await t('R', '롤 계정도 커뮤니티 만들기 못 함', 'deny', 'PUT', 'today/communities/rt_z', { name: 'x' });
  console.log('— 커뮤니티 칸 읽기');
  await t('N', '방 목록', 'ok', 'GET', `${C}/roomList`);
  await t('N', '접속 표시', 'ok', 'GET', `${C}/presence`);
  await t('N', '경기 기록', 'ok', 'GET', D);
  await t('N', '커뮤니티 통째', 'deny', 'GET', C);
  await t('N', '방 안(게스트)', 'deny', 'GET', `${C}/rooms/rt_x`);
  await t('R', '방 안(롤 계정)', 'ok', 'GET', `${C}/rooms/rt_x`);
  await t('N', '정지 목록', 'deny', 'GET', `${C}/bans`);
  console.log('— 커뮤니티 칸 쓰기');
  await t('N', '게스트 접속 표시', 'ok', 'PUT', `${C}/presence/g_rt_dev`, { name: '게스트', at: now });
  await t('N', '  지우기', 'ok', 'DELETE', `${C}/presence/g_rt_dev`);
  await t('N', '게스트가 방 만들기', 'deny', 'PUT', `${C}/roomList/rt_n`, { name: 'x', at: now, seen: now });
  await t('N', '커뮤니티 운영자 넣기', 'deny', 'PUT', `${C}/admins/${NU}`, { name: '나' });
  await t('N', '공지', 'deny', 'PUT', `${C}/notice`, { id: 'x', text: 'x', at: now, until: now + 1000, by: 'x' });
  await t('N', '이름표 규칙 밖 커뮤니티 칸', 'deny', 'PUT', 'today/c/RT_BAD!/presence/g_x', { name: 'x', at: now });
  if (R) {
    const A = R.A;
    await t('R', '내 접속 표시', 'ok', 'PUT', `${C}/presence/${A}`, { name: R.name, at: now, app: 'rt' });
    await t('R', '남의 접속 표시', 'deny', 'PUT', `${C}/presence/${OTHER}`, { name: '사칭', at: now });
    await t('R', '방 만들기', 'ok', 'PUT', `${C}/roomList/rt_m`, { name: '시험방', priv: false, host: '시험', at: now, seen: now, by: '시험' });
    await t('R', '들어왔음 칸', 'ok', 'PUT', `${C}/rooms/rt_m/uids/${A}`, A);
    await t('R', '판 상태', 'ok', 'PUT', `${C}/rooms/rt_m/session`, { phase: 'teams' });
    await t('R', '남의 방 판 상태', 'deny', 'PUT', `${C}/rooms/rt_x/session`, { phase: 'hack' });
    await t('R', '기본 커뮤니티 방에 든 걸로는 안 됨(목록에 없는 방)', 'deny', 'PUT', `${C}/rooms/rt_none/uids/${A}`, A);
    await t('R', '내전 기록 — 들어간 방', 'ok', 'PUT', `${D}/matches/rt_1`, { gameId: 'rt_1', ts: now, sv: SV, roomId: 'rt_m', roomName: '시험방' });
    await t('R', '내전 기록 — 안 들어간 방', 'deny', 'PUT', `${D}/matches/rt_2`, { gameId: 'rt_2', ts: now, sv: SV, roomId: 'rt_x' });
    await t('R', '기본 커뮤니티 방 번호로 기록(그 커뮤니티 방이 아님)', 'deny', 'PUT', `${D}/matches/rt_3`, { gameId: 'rt_3', ts: now, sv: SV, roomId: 'rt_none' });
    console.log('— 커뮤니티 정지(그 커뮤니티만)');
    admin('PUT', `${C}/bans/${A}`, { until: Date.now() + 120000, at: Date.now(), reason: '시험', by: '시험', name: R.name });
    await t('R', '정지 — 이 커뮤니티 접속 표시', 'deny', 'PUT', `${C}/presence/${A}`, { name: R.name, at: Date.now() });
    await t('R', '정지 — 기본 커뮤니티 칸은 됨', 'ok', 'PATCH', `today/accounts/${A}`, { lastSeen: Date.now() });
    admin('DELETE', `${C}/bans/${A}`);
    console.log('— 커뮤니티 운영자');
    admin('PUT', `${C}/admins/${A}`, { name: '시험운영자', at: Date.now() });
    await t('R', '커뮤니티 운영자 — 그 커뮤니티 통째 읽기', 'ok', 'GET', C);
    await t('R', '커뮤니티 운영자 — 남의 방 판 상태', 'ok', 'PUT', `${C}/rooms/rt_x/session`, { phase: 'lobby' });
    await t('R', '커뮤니티 운영자 — 그 커뮤니티 정지', 'ok', 'PUT', `${C}/bans/${OTHER}`, { until: Date.now() + 60000, at: Date.now(), reason: '시험', by: '시험', name: '남' });
    await t('R', '커뮤니티 운영자 — 기본 커뮤니티 정지는 못 함', 'deny', 'PUT', `today/bans/${OTHER}`, { until: Date.now() + 60000, at: Date.now(), reason: '시험', by: '시험', name: '남' });
    await t('R', '커뮤니티 운영자 — 기본 커뮤니티 통째 못 읽음', 'deny', 'GET', 'today');
    await t('R', '커뮤니티 운영자 — 운영자 추가 못 함', 'deny', 'PUT', `${C}/admins/${OTHER}`, { name: '남' });
    admin('DELETE', `${C}/admins/${A}`);
    await t('R', '운영자에서 빠진 뒤 — 정지 목록', 'deny', 'GET', `${C}/bans`);
  }
  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  for (const p of [C, 'today/communities/rt_c', 'today/communities/rt_z', 'today/communityCodes/RTCODE1', 'today/communityCodes/HACK99']) admin('DELETE', p);
  console.log('정리 끝');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('오류', e.message); process.exit(1); });
