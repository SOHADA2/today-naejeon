// 🔐 보안 2단계 규칙 시험(롤 계정 로그인 기준 · v0.1.243 · tools/rules-riot.cjs로 만든 규칙) — 롤 클라이언트가 켜진 PC에서
//   표식 3가지: R = 이 PC 롤 계정 로그인(중계 /riot-auth → uid = 내 puuid · riot:true) · N = 익명(게스트) · 관리자(gapi) = 준비·정리
//   「남」= 가짜 puuid(관리자가 그 사람 칸·방을 만들어 둠) · 시험 칸 = rt_ 접두·2000-01-01 · 진짜 내 칸은 해가 없는 값만 씀(accounts lastSeen · owners 시각)
//   사용(리포 루트): node tools/rules-riot-test.cjs   · RT_BEFORE=1 = 아직 2단계 전 규칙(허용 칸만 셈 · 차단 칸은 참고로만)
//   ⚠️ 롤 계정 로그인 표식·라이엇 증표는 화면에 안 찍음
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
const BEFORE = process.env.RT_BEFORE === '1';
let pass = 0, fail = 0, info = 0;
const SV = { '.sv': 'timestamp' }, D = 'today/days/2000-01-01';
const OTHER = '00000000-0000-4000-8000-0000000000aa';
(async () => {
  const me = await lcu('/lol-summoner/v1/current-summoner'), ent = await lcu('/entitlements/v1/token');
  if (!me || !me.puuid || !ent || !ent.accessToken) { console.log('롤 로그인 안 됨'); process.exit(1); }
  const A = me.puuid;
  const ct = await post(PX + '/riot-auth', { token: ent.accessToken }, { 'x-tn-app': 'today-naejeon' });
  const rs = ct && ct.token ? await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { token: ct.token, returnSecureToken: true }) : null;
  const RT = rs && rs.idToken; if (!RT) { console.log('롤 계정 로그인 실패'); process.exit(1); }
  const NT = (await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { returnSecureToken: true }) || {}).idToken;
  const NU = JSON.parse(Buffer.from(NT.split('.')[1], 'base64url')).user_id;
  console.log(`롤 계정 ${me.gameName} · 익명 uid ${NU.slice(0, 6)}… · ${BEFORE ? '지금 규칙(2단계 전) — 허용 칸만 셈' : '2단계 규칙'}\n`);
  const req = async (tok, method, p, body) => (await fetch(`${DB}/${p}.json?auth=${tok}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).status;
  const t = async (who, name, want, method, p, body) => {
    if (BEFORE && want !== 'ok') { info++; return; }   // 2단계 전엔 차단 칸을 보내지 않음(지금 규칙에선 실제로 써져서 내 진짜 칸을 「사칭」으로 덮음)
    const s = await req(who === 'R' ? RT : NT, method, p, body), ok = want === 'ok' ? s === 200 : s === 401 || s === 403;
    ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', want === 'ok' ? '허용' : '차단', who, name, s);
  };
  const now = Date.now();
  // 준비(관리자): 남의 방 rt_x(남만 들어옴 · 방금 소식) · 소식 끊긴 방 rt_s · 남의 칸
  admin('PUT', 'today/roomList/rt_x', { name: '남의방', priv: false, host: '남', at: now, seen: now, by: '남' });
  admin('PUT', `today/rooms/rt_x/uids/${OTHER}`, OTHER);
  admin('PUT', 'today/rooms/rt_x/session', { phase: 'teams' });
  admin('PUT', 'today/roomList/rt_s', { name: '빈방', priv: false, host: '남', at: now - 600000, seen: now - 600000, by: '남' });
  admin('PUT', 'today/rooms/rt_s/session', { phase: 'lobby' });
  admin('PUT', `today/discord/${OTHER}`, { id: '123456789012345678', at: 1 });

  console.log('— 읽기');
  await t('N', '방 목록', 'ok', 'GET', 'today/roomList');
  await t('N', '경기 기록·계정·점수·접속 표시', 'ok', 'GET', 'today/accounts');
  await t('N', '경기 기록', 'ok', 'GET', `${D}`);
  await t('N', '접속 표시', 'ok', 'GET', 'today/presence');
  await t('N', '설정 clipProxy', 'ok', 'GET', 'today/config/clipProxy');
  await t('R', '방 안(남의 방도 · 공개 방 = 들어가면 보이는 것)', 'ok', 'GET', 'today/rooms/rt_x');
  await t('R', '방 전체 목록(빈 방 정리용 shallow)', 'ok', 'GET', 'today/rooms');
  await t('R', '내 디스코드 칸', 'ok', 'GET', `today/discord/${A}`);
  await t('N', '방 안(게스트)', 'deny', 'GET', 'today/rooms/rt_x');
  await t('R', 'today 통째', 'deny', 'GET', 'today');
  await t('N', 'today 통째', 'deny', 'GET', 'today');
  await t('R', '디스코드 전체', 'deny', 'GET', 'today/discord');
  await t('R', '남의 디스코드 칸', 'deny', 'GET', `today/discord/${OTHER}`);
  await t('R', '기기 등록(owners)', 'deny', 'GET', 'today/owners');
  await t('R', '설정 통째', 'deny', 'GET', 'today/config');
  await t('R', '옛 칸 today/session', 'deny', 'GET', 'today/session');

  console.log('— 본인 칸');
  await t('R', '내 접속 표시', 'ok', 'PUT', `today/presence/${A}`, { name: me.gameName, at: now, app: 'rt' });
  await t('N', '게스트 접속 표시 g_', 'ok', 'PUT', 'today/presence/g_rt_guest', { name: '게스트', at: now });
  await t('R', '남의 접속 표시', 'deny', 'PUT', `today/presence/${OTHER}`, { name: '사칭', at: now });
  await t('N', '게스트가 남(롤 계정)의 접속 표시', 'deny', 'PUT', `today/presence/${A}`, { name: '사칭', at: now });
  await t('R', '내 계정 칸 갱신(lastSeen)', 'ok', 'PATCH', `today/accounts/${A}`, { lastSeen: now });
  await t('R', '남의 계정 칸', 'deny', 'PATCH', `today/accounts/${OTHER}`, { name: '사칭' });
  await t('N', '게스트가 계정 칸', 'deny', 'PATCH', `today/accounts/${A}`, { name: '사칭' });
  await t('R', '남의 전적 점수', 'deny', 'PUT', `today/ratings/${OTHER}`, { at: now });
  await t('R', '남의 디스코드 칸 덮기', 'deny', 'PUT', `today/discord/${OTHER}`, { id: '999999999999999999', at: now });
  await t('R', '내 기기 등록', 'ok', 'PUT', `today/owners/${A}/${A}`, now);
  await t('R', '남의 계정에 내 기기 등록', 'deny', 'PUT', `today/owners/${OTHER}/${A}`, now);
  await t('N', '게스트 기기 등록', 'deny', 'PUT', `today/owners/${A}/${NU}`, now);
  await t('N', '자리 신호(게스트도)', 'ok', 'PUT', 'today/conns/rt_dev', now);

  console.log('— 방(내 방 rt_r)');
  await t('N', '게스트가 방 만들기', 'deny', 'PUT', 'today/roomList/rt_n', { name: '게스트방', at: now, seen: now });
  await t('R', '방 만들기(방 목록)', 'ok', 'PUT', 'today/roomList/rt_r', { name: '시험방', priv: false, host: '시험', at: now, seen: now, by: '시험' });
  await t('R', '들어오기 전 방 안 쓰기', 'deny', 'PUT', 'today/rooms/rt_r/session', { phase: 'lobby' });
  await t('R', '남의 uid로 들어왔음 칸', 'deny', 'PUT', `today/rooms/rt_r/uids/${OTHER}`, A);
  await t('N', '게스트가 들어왔음 칸', 'deny', 'PUT', `today/rooms/rt_r/uids/${NU}`, NU);
  await t('R', '들어왔음 칸(내 uid)', 'ok', 'PUT', `today/rooms/rt_r/uids/${A}`, A);
  await t('R', '방장 칸', 'ok', 'PUT', 'today/rooms/rt_r/host', { puuid: A, name: '시험', at: now });
  await t('R', '판 상태', 'ok', 'PUT', 'today/rooms/rt_r/session', { phase: 'teams', teamA: ['a'] });
  await t('R', '방 여러 칸 한 번에(PATCH)', 'ok', 'PATCH', 'today/rooms/rt_r', { 'lobby/mode': 'draft', normalLive: { a: 1 }, 'bridge/gamePhase': 'Lobby' });
  await t('R', '대기실 통째 쓰기(앱은 안 함 · 칸별로만)', 'deny', 'PUT', 'today/rooms/rt_r/lobby', { mode: 'x' });
  await t('R', '대기실 방식·남의 참가 칸(방장)', 'ok', 'PATCH', 'today/rooms/rt_r/lobby', { mode: 'random', join: { [OTHER]: { name: '남', st: 'spec' } }, sides: { a: 'teamA' } });
  await t('R', '강퇴 칸(방장 → 남)', 'ok', 'PUT', `today/rooms/rt_r/lobby/kick/${OTHER}`, { at: now, by: '시험' });
  await t('R', '내 한마디', 'ok', 'PUT', `today/rooms/rt_r/lobby/chat/${A}`, { text: '안녕', at: now });
  await t('R', '남의 이름으로 한마디', 'deny', 'PUT', `today/rooms/rt_r/lobby/chat/${OTHER}`, { text: '사칭', at: now });
  await t('R', '내 핑', 'ok', 'PUT', `today/rooms/rt_r/lobby/ping/${A}`, { k: 'look', at: now });
  await t('R', '남의 이름으로 핑', 'deny', 'PUT', `today/rooms/rt_r/lobby/ping/${OTHER}`, { k: 'look', at: now });
  await t('R', '남의 이름으로 롤 화면 핑', 'deny', 'PUT', `today/rooms/rt_r/lobby/cping/${OTHER}`, { k: 'look', at: now });
  await t('R', '한마디 51자(모양 검사 그대로)', 'deny', 'PUT', `today/rooms/rt_r/lobby/chat/${A}`, { text: '가'.repeat(51), at: now });
  await t('R', '내 방 사람 칸', 'ok', 'PUT', `today/rooms/rt_r/members/${A}`, { name: '시험', at: now });
  await t('R', '남의 방 사람 칸', 'deny', 'PUT', `today/rooms/rt_r/members/${OTHER}`, { name: '사칭', at: now });
  await t('R', '내 디스코드 사본', 'ok', 'PUT', `today/rooms/rt_r/dc/${A}`, { id: '123456789012345678', at: now });
  await t('R', '남의 디스코드 사본', 'deny', 'PUT', `today/rooms/rt_r/dc/${OTHER}`, { id: '123456789012345678', at: now });
  await t('R', '방 목록 소식(seen·인원)', 'ok', 'PATCH', 'today/roomList/rt_r', { seen: now, n: 1, mem: '시험' });
  await t('R', '방 안 모르는 칸', 'deny', 'PUT', 'today/rooms/rt_r/junk', 'x');
  await t('R', '목록에 있는 방 통째 지우기', 'deny', 'DELETE', 'today/rooms/rt_r');
  await t('N', '게스트가 남의 방 판 상태', 'deny', 'PUT', 'today/rooms/rt_r/session', { phase: 'hack' });

  console.log('— 남의 방(rt_x · 안 들어감)');
  await t('R', '판 상태 바꾸기', 'deny', 'PUT', 'today/rooms/rt_x/session', { phase: 'hack' });
  await t('R', '대기실 방식', 'deny', 'PATCH', 'today/rooms/rt_x/lobby', { mode: 'hack' });
  await t('R', '방장 칸 빼앗기', 'deny', 'PUT', 'today/rooms/rt_x/host', { puuid: A, at: now });
  await t('R', '방 목록 고치기', 'deny', 'PATCH', 'today/roomList/rt_x', { name: '해킹' });
  await t('R', '살아 있는 방 목록 지우기', 'deny', 'DELETE', 'today/roomList/rt_x');
  await t('R', '방 사람 칸에 나(본인 칸 = 됨 · 들어오는 것과 같음)', 'ok', 'PUT', `today/rooms/rt_x/members/${A}`, { name: '시험', at: now });
  await t('R', '나도 들어옴 → 그다음 판 상태', 'ok', 'PUT', `today/rooms/rt_x/uids/${A}`, A);
  await t('R', '  (들어온 뒤) 판 상태', 'ok', 'PATCH', 'today/rooms/rt_x/session', { note: 'rt' });
  await t('R', '  나가기 — 방 사람 칸 먼저', 'ok', 'DELETE', `today/rooms/rt_x/members/${A}`);
  await t('R', '  나가기 — 들어왔음 칸', 'ok', 'DELETE', `today/rooms/rt_x/uids/${A}`);
  await t('R', '  나간 뒤 판 상태', 'deny', 'PATCH', 'today/rooms/rt_x/session', { note: 'hack' });

  console.log('— 빈 방 정리(rt_s · 10분 소식 없음)');
  await t('R', '소식 끊긴 방 목록 지우기', 'ok', 'DELETE', 'today/roomList/rt_s');
  await t('R', '목록에서 없어진 방 통째 지우기', 'ok', 'DELETE', 'today/rooms/rt_s');
  await t('R', '목록에 없는 방에 들어왔음 칸', 'deny', 'PUT', `today/rooms/rt_s/uids/${A}`, A);
  await t('N', '게스트가 방 정리', 'deny', 'DELETE', 'today/roomList/rt_x');

  console.log('— 경기 기록·팟지·증강');
  await t('R', '내전 기록 — 들어간 방', 'ok', 'PUT', `${D}/matches/rt_1`, { gameId: 'rt_1', ts: now, sv: SV, roomId: 'rt_r', roomName: '시험방' });
  await t('R', '내전 기록 — 안 들어간 방', 'deny', 'PUT', `${D}/matches/rt_2`, { gameId: 'rt_2', ts: now, sv: SV, roomId: 'rt_x' });
  await t('R', '내전 기록 — 방 번호 없음', 'deny', 'PUT', `${D}/matches/rt_3`, { gameId: 'rt_3', ts: now, sv: SV });
  await t('R', '일반 판 기록', 'ok', 'PUT', `${D}/normals/rt_n`, { gameId: 'rt_n', ts: now, sv: SV });
  await t('N', '게스트가 일반 판 기록', 'deny', 'PUT', `${D}/normals/rt_g`, { gameId: 'rt_g', ts: now, sv: SV });
  await t('R', '막 끝난 판 투표(PATCH)', 'ok', 'PATCH', `${D}/matches/rt_1`, { mvp: 'a', votes: { x: 1 } });
  await t('N', '게스트가 투표 바꾸기', 'deny', 'PATCH', `${D}/matches/rt_1`, { mvp: 'hack' });
  await t('R', '기록 덮어쓰기(그대로 막힘)', 'deny', 'PUT', `${D}/matches/rt_1`, { gameId: 'hack', sv: SV, roomId: 'rt_r' });
  await t('R', '팟지 수집', 'ok', 'PUT', 'today/potg/raw/2000-01-01/rt_g/rt_k', { a: 1 });
  await t('N', '게스트 팟지 수집', 'deny', 'PUT', 'today/potg/raw/2000-01-01/rt_g/rt_k2', { a: 1 });
  await t('R', '영상 메타', 'ok', 'PUT', 'today/clips/2000-01-01/rt_g/meta', { n: 1 });
  await t('N', '게스트 영상', 'deny', 'PUT', 'today/clips/2000-01-01/rt_g2/meta', { n: 1 });
  await t('R', '증강 가이드 편집', 'ok', 'PUT', 'today/augGuide/champs/rt_x', { a: 1 });
  await t('N', '게스트 증강 가이드 편집', 'deny', 'PUT', 'today/augGuide/champs/rt_y', { a: 1 });
  await t('R', '설정 바꾸기(그대로 막힘)', 'deny', 'PUT', 'today/config/clipProxy', 'https://evil.example');

  console.log('— 내 방 나가기(앱 순서 = 방 안 내 칸 → 들어왔음 칸)');
  for (const k of ['lobby/chat', 'lobby/ping', 'members', 'dc']) await t('R', `  ${k} 지우기`, 'ok', 'DELETE', `today/rooms/rt_r/${k}/${A}`);
  await t('R', '  들어왔음 칸 지우기', 'ok', 'DELETE', `today/rooms/rt_r/uids/${A}`);
  await t('R', '  나간 뒤 대기실 칸(차례가 틀리면 이렇게 막힘)', 'deny', 'DELETE', `today/rooms/rt_r/lobby/join/${OTHER}`);

  console.log(`\n통과 ${pass} · 실패 ${fail}${info ? ` · 건너뜀 ${info}(차단 칸 = 2단계 적용 뒤에 시험)` : ''}`);
  for (const p of ['today/roomList/rt_r', 'today/rooms/rt_r', 'today/roomList/rt_x', 'today/rooms/rt_x', 'today/roomList/rt_s', 'today/rooms/rt_s', 'today/roomList/rt_n', 'today/rooms/rt_n', D, 'today/potg/raw/2000-01-01', 'today/clips/2000-01-01', 'today/augGuide/champs/rt_x', 'today/augGuide/champs/rt_y', 'today/presence/g_rt_guest', 'today/conns/rt_dev', `today/discord/${OTHER}`, `today/presence/${OTHER}`, `today/accounts/${OTHER}`, `today/ratings/${OTHER}`, `today/owners/${OTHER}`, `today/owners/${A}/${NU}`]) admin('DELETE', p);
  admin('PATCH', `today/presence/${A}`, { app: require('../package.json').version });   // 시험으로 쓴 내 접속 표시 버전 글자 되돌림(다음 신호 때 앱이 다시 씀)
  console.log('정리 끝');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('오류', e.message); process.exit(1); });
