// 🏆 대회 규칙 시험(v0.1.291 · tools/rules-riot.cjs ⑨) — 롤 클라이언트가 켜진 PC에서 · 규칙을 서버에 적용한 뒤 돌림
//   사용(리포 루트): node tools/rules-tourney-test.cjs
//   표식: R = 이 PC 롤 계정 로그인(uid = 내 puuid · riot:true) · N = 익명(게스트) · 관리자(gapi) = 준비·정리 · 시험 칸 = rt_ 접두 · 2000-01-01
//   확인 = 대회는 누구나 읽고 운영자만 씀 · 결과 칸(res/{경기}/{게임}) = 그 게임의 경기 기록과 대회·경기·이긴 팀이 같을 때만 롤 로그인으로 새로 쓰기(고치기·지우기 X)
const fs = require('fs'), https = require('https'), path = require('path'), { execFileSync } = require('child_process');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const KEY = (MAIN.match(/FIREBASE_API_KEY = '([^']+)'/) || [])[1], PX = process.env.TN_CLIP_PROXY || (MAIN.match(/RIOT_AUTH_URL = [^']*'(https:[^']+)'/) || [])[1];
const DB = (MAIN.match(/FIREBASE_DB = '([^']+)'/) || [])[1];
const admin = (m, p, body) => execFileSync('node', [path.join(__dirname, 'gapi.cjs'), m, `${DB}/${p}.json`].concat(body ? [JSON.stringify(body)] : [])).toString().trim();
const LF = ['D:/Riot Games/League of Legends/lockfile', 'C:/Riot Games/League of Legends/lockfile'].find(p => fs.existsSync(p));
if (!LF) { console.log('lockfile 없음 — 롤 클라이언트를 켜고 다시'); process.exit(1); }
const [, , port, pw] = fs.readFileSync(LF, 'utf8').split(':');
const lcu = p => new Promise((ok, no) => https.get({ host: '127.0.0.1', port, path: p, rejectUnauthorized: false, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + pw).toString('base64') } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch (_) { ok(null); } }); }).on('error', no));
const post = (u, b, h) => fetch(u, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h || {}), body: JSON.stringify(b) }).then(r => r.json().catch(() => null));
let pass = 0, fail = 0;
const D = 'today/days/2000-01-01/matches', TP = 'today/tourneys/rt_t1';
(async () => {
  const me = await lcu('/lol-summoner/v1/current-summoner'), ent = await lcu('/entitlements/v1/token');
  if (!me || !me.puuid || !ent || !ent.accessToken) { console.log('롤 로그인 안 됨'); process.exit(1); }
  const A = me.puuid;
  const ct = await post(PX + '/riot-auth', { token: ent.accessToken }, { 'x-tn-app': 'today-naejeon' });
  const rs = ct && ct.token ? await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { token: ct.token, returnSecureToken: true }) : null;
  const RT = rs && rs.idToken; if (!RT) { console.log('롤 계정 로그인 실패'); process.exit(1); }
  const NT = (await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { returnSecureToken: true }) || {}).idToken;
  console.log(`롤 계정 ${me.gameName}\n`);
  const req = async (tok, method, p, body) => (await fetch(`${DB}/${p}.json${tok ? '?auth=' + tok : ''}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).status;
  const t = async (who, name, want, method, p, body) => { const s = await req(who === 'R' ? RT : who === 'N' ? NT : null, method, p, body), ok = want === 'ok' ? s === 200 : s === 401 || s === 403;
    ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', want === 'ok' ? '허용' : '차단', who, name, s); };
  const now = Date.now(), g = (w, mid, tid) => ({ roomId: 'rt_x', sv: 1, winner: 'teamA', teamA: ['a'], teamB: ['b'], series: { tid: tid || 'rt_t1', mid: mid || 'r1m0', a: 'ta', b: 'tb', w } });
  try {
    // 준비(관리자): 대회 하나 + 그 대회 경기 기록 3개(ta 승 · ta 승 · 다른 대회 것)
    admin('PUT', TP, { name: '규칙 시험', fmt: 'se', st: 'live', at: now, teams: { ta: { name: '가' }, tb: { name: '나' } } });
    admin('PUT', `${D}/rt_tg1`, g('ta')); admin('PUT', `${D}/rt_tg2`, g('ta')); admin('PUT', `${D}/rt_tg3`, g('ta', 'r1m0', 'rt_other'));
    await t('N', '게스트 — 대회 읽기', 'ok', 'GET', 'today/tourneys');
    await t('-', '로그인 없이 — 대회 읽기', 'deny', 'GET', 'today/tourneys');
    await t('R', '롤 계정 — 대회 만들기', 'deny', 'PUT', 'today/tourneys/rt_t2', { name: '몰래', fmt: 'se', st: 'live' });
    await t('R', '롤 계정 — 대회 이름 바꾸기', 'deny', 'PUT', `${TP}/name`, '바꿈');
    await t('R', '롤 계정 — 대진 승자 칸 쓰기', 'deny', 'PUT', `${TP}/matches/r1m0/win`, 'ta');
    await t('R', '롤 계정 — 팀에 나를 넣기', 'deny', 'PUT', `${TP}/teams/ta/mem/${A}`, { n: 'x', r: '' });
    await t('R', '결과 칸 — 경기 기록과 맞음', 'ok', 'PUT', `${TP}/res/r1m0/rt_tg1`, { w: 'ta', day: '2000-01-01', at: now, n: 1 });
    await t('R', '결과 칸 — 이미 있는 칸 덮어쓰기', 'deny', 'PUT', `${TP}/res/r1m0/rt_tg1`, { w: 'ta', day: '2000-01-01', at: now, n: 2 });
    await t('R', '결과 칸 — 지우기', 'deny', 'DELETE', `${TP}/res/r1m0/rt_tg1`);
    await t('R', '결과 칸 — 이긴 팀이 기록과 다름', 'deny', 'PUT', `${TP}/res/r1m0/rt_tg2`, { w: 'tb', day: '2000-01-01', at: now });
    await t('R', '결과 칸 — 경기 번호가 기록과 다름', 'deny', 'PUT', `${TP}/res/r2m0/rt_tg2`, { w: 'ta', day: '2000-01-01', at: now });
    await t('R', '결과 칸 — 없는 게임', 'deny', 'PUT', `${TP}/res/r1m0/rt_none`, { w: 'ta', day: '2000-01-01', at: now });
    await t('R', '결과 칸 — 다른 대회의 게임', 'deny', 'PUT', `${TP}/res/r1m0/rt_tg3`, { w: 'ta', day: '2000-01-01', at: now });
    await t('R', '결과 칸 — 날짜를 틀리게', 'deny', 'PUT', `${TP}/res/r1m0/rt_tg2`, { w: 'ta', day: '2000-01-02', at: now });
    await t('R', '결과 칸 — 모르는 칸 끼워 넣기', 'deny', 'PUT', `${TP}/res/r1m0/rt_tg2`, { w: 'ta', day: '2000-01-01', at: now, x: 1 });
    await t('N', '게스트 — 결과 칸(기록과 맞아도)', 'deny', 'PUT', `${TP}/res/r1m0/rt_tg2`, { w: 'ta', day: '2000-01-01', at: now });
    await t('R', '결과 칸 — 둘째 게임(기록과 맞음)', 'ok', 'PUT', `${TP}/res/r1m0/rt_tg2`, { w: 'ta', day: '2000-01-01', at: now, n: 2 });
    await t('R', '결과 칸 — 경기 통째로 쓰기', 'deny', 'PUT', `${TP}/res/r1m0`, { rt_x: { w: 'tb', day: '2000-01-01', at: now } });
    // 운영자
    admin('PUT', `today/admins/${A}`, { name: '시험운영자', at: now });
    await t('R', '운영자 — 대회 만들기', 'ok', 'PUT', 'today/tourneys/rt_t2', { name: '운영자 대회', fmt: 'rr', st: 'draft', bo: 3, at: now });
    await t('R', '운영자 — 이름 없는 대회', 'deny', 'PUT', 'today/tourneys/rt_t3', { fmt: 'se', st: 'draft' });
    await t('R', '운영자 — 팀·선수 넣기', 'ok', 'PUT', 'today/tourneys/rt_t2/teams/ta', { name: '가', seed: 1, mem: { [A]: { n: 'x', r: 'cap' } } });
    await t('R', '운영자 — 대진 넣기', 'ok', 'PUT', 'today/tourneys/rt_t2/matches', { r1m0: { r: 1, i: 0, a: 'ta', b: 'tb', bo: 3 } });
    await t('R', '운영자 — 승자 정하기', 'ok', 'PUT', `${TP}/matches/r1m0/win`, 'tb');
    await t('R', '운영자 — 결과 지우기', 'ok', 'DELETE', `${TP}/res/r1m0`);
    await t('R', '운영자 — 대회 지우기', 'ok', 'DELETE', 'today/tourneys/rt_t2');
    admin('DELETE', `today/admins/${A}`);
    await t('R', '운영자에서 빠진 뒤 — 대회 쓰기', 'deny', 'PUT', `${TP}/st`, 'done');
  } finally {
    try { admin('DELETE', `today/admins/${A}`); } catch (_) {}
    for (const p of [TP, 'today/tourneys/rt_t2', 'today/tourneys/rt_t3', `${D}/rt_tg1`, `${D}/rt_tg2`, `${D}/rt_tg3`]) { try { admin('DELETE', p); } catch (_) {} }
    console.log(`\n통과 ${pass} · 실패 ${fail}\n정리 끝`);
  }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('오류', e.message); process.exit(1); });
