// 🛡️ 보안 점검 규칙 시험(v0.1.293 · 2026-11-28 · tools/rules-riot.cjs ⑩ · rules-community.cjs) — 롤 클라이언트가 켜진 PC에서 · 규칙을 서버에 적용한 뒤 돌림
//   사용(리포 루트): node tools/rules-sec-test.cjs
//   표식: R = 이 PC 롤 계정 로그인(uid = 내 puuid · riot:true) · N = 익명(게스트) · 관리자(gapi) = 준비·정리 · 「남」 = 가짜 계정 번호 · 시험 칸 = rt_ 접두 · 2000-01-01
//   확인 = ① 방장 칸 빼앗기 차단(지금 방장만 고침 · 없거나 45초 넘게 조용할 때만 「나」로) ② 방 밖 브릿지 칸 닫힘 ③ 경기 기록에 붙는 칸 = 그 방 사람·기록한 사람만
//          ④ 신고의 대상·방 = 번호 모양만 ⑤ 커뮤니티 운영자 칸 = 아는 칸만 (대회 결과 칸은 tools/rules-tourney-test.cjs)
//   ⚠️ 롤 계정 로그인 표식·라이엇 증표는 화면에 안 찍음
const fs = require('fs'), https = require('https'), path = require('path'), { execFileSync } = require('child_process');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const KEY = (MAIN.match(/FIREBASE_API_KEY = '([^']+)'/) || [])[1], PX = process.env.TN_CLIP_PROXY || (MAIN.match(/RIOT_AUTH_URL = [^']*'(https:[^']+)'/) || [])[1];
const DB = (MAIN.match(/FIREBASE_DB = '([^']+)'/) || [])[1];
const admin = (m, p, body) => execFileSync('node', [path.join(__dirname, 'gapi.cjs'), m, `${DB}/${p}.json`].concat(body !== undefined ? [JSON.stringify(body)] : [])).toString().trim();
const LF = ['D:/Riot Games/League of Legends/lockfile', 'C:/Riot Games/League of Legends/lockfile'].find(p => fs.existsSync(p));
if (!LF) { console.log('lockfile 없음 — 롤 클라이언트를 켜고 다시'); process.exit(1); }
const [, , port, pw] = fs.readFileSync(LF, 'utf8').split(':');
const lcu = p => new Promise(ok => https.get({ host: '127.0.0.1', port, path: p, rejectUnauthorized: false, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + pw).toString('base64') } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch (_) { ok(null); } }); }).on('error', () => ok(null)));
const post = (u, b, h) => fetch(u, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h || {}), body: JSON.stringify(b) }).then(r => r.json().catch(() => null));
let pass = 0, fail = 0;
const SV = { '.sv': 'timestamp' }, D = 'today/days/2000-01-01', OTHER = '00000000-0000-4000-8000-0000000000aa', H = 'today/rooms/rt_h/host';
(async () => {
  const me = await lcu('/lol-summoner/v1/current-summoner'), ent = await lcu('/entitlements/v1/token');
  if (!me || !me.puuid || !ent || !ent.accessToken) { console.log('롤 로그인 안 됨'); process.exit(1); }
  const A = me.puuid;
  const ct = await post(PX + '/riot-auth', { token: ent.accessToken }, { 'x-tn-app': 'today-naejeon' });
  const rs = ct && ct.token ? await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { token: ct.token, returnSecureToken: true }) : null;
  const RT = rs && rs.idToken; if (!RT) { console.log('롤 계정 로그인 실패'); process.exit(1); }
  const NT = (await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { returnSecureToken: true }) || {}).idToken;
  console.log(`롤 계정 ${me.gameName}\n`);
  const req = async (tok, method, p, body) => (await fetch(`${DB}/${p}.json?auth=${tok}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).status;
  const t = async (who, name, want, method, p, body) => { const s = await req(who === 'R' ? RT : NT, method, p, body), ok = want === 'ok' ? s === 200 : s === 401 || s === 403;
    ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', want === 'ok' ? '허용' : '차단', who, name, s); };
  const now = Date.now();
  try {
    // 준비(관리자): 방 rt_h(나 + 남이 들어와 있음 · 방장 = 남 · 방금 소식) · 내가 안 들어간 방 rt_x2
    admin('PUT', 'today/roomList/rt_h', { name: '방장시험', priv: false, host: '남', at: now, seen: now, by: '남' });
    admin('PUT', 'today/rooms/rt_h/uids', { [A]: A, [OTHER]: OTHER });
    admin('PUT', H, { puuid: OTHER, name: '남', at: now });
    admin('PUT', 'today/roomList/rt_x2', { name: '남의방', priv: false, host: '남', at: now, seen: now, by: '남' });
    admin('PUT', `today/rooms/rt_x2/uids/${OTHER}`, OTHER);

    console.log('— ① 방장 칸');
    await t('R', '살아 있는 남의 방장 자리를 내 것으로', 'deny', 'PUT', H, { puuid: A, name: '나', at: now });
    await t('R', '남의 방장 칸 시각만 옛날로 바꾸기', 'deny', 'PATCH', H, { at: 1 });
    await t('R', '남의 방장 칸 계정 번호만 바꾸기', 'deny', 'PUT', `${H}/puuid`, A);
    await t('R', '남의 방장 칸 지우기', 'deny', 'DELETE', H);
    admin('PUT', H, { puuid: OTHER, name: '남', at: now + 60000, upd: true });
    await t('R', '업데이트로 맡아 둔 자리(시각 = 미래) 빼앗기', 'deny', 'PUT', H, { puuid: A, name: '나', at: now });
    admin('PUT', H, { puuid: OTHER, name: '남', at: now - 120000 });
    await t('R', '조용한 방장 자리에 다른 사람을 앉히기', 'deny', 'PUT', H, { puuid: OTHER, name: '남', at: now });
    await t('R', '조용한 방장 자리 지우기만', 'deny', 'DELETE', H);
    await t('R', '2분째 조용한 방장 → 내가 이어받기', 'ok', 'PUT', H, { puuid: A, name: '나', at: now });
    await t('R', '내 방장 칸 살아 있음 표시', 'ok', 'PUT', H, { puuid: A, name: '나', at: Date.now() });
    await t('R', '방장인 내가 남에게 넘겨주기', 'ok', 'PUT', H, { puuid: OTHER, name: '남', at: Date.now(), from: '나', fromKey: A });
    await t('R', '넘겨준 뒤 다시 빼앗기', 'deny', 'PUT', H, { puuid: A, name: '나', at: Date.now() });
    admin('DELETE', H);
    await t('R', '방장 없는 방 — 남을 방장으로 적기', 'deny', 'PUT', H, { puuid: OTHER, name: '남', at: now });
    await t('R', '방장 없는 방 — 내가 방장 하기', 'ok', 'PUT', H, { puuid: A, name: '나', at: Date.now() });
    await t('R', '방장인 내가 그만하기(지우기)', 'ok', 'DELETE', H);
    await t('R', '안 들어간 방의 빈 방장 자리', 'deny', 'PUT', 'today/rooms/rt_x2/host', { puuid: A, name: '나', at: now });

    console.log('— ② 방 밖 브릿지 칸');
    await t('R', '방 밖 브릿지 — 접속 표시', 'deny', 'PUT', 'today/bridge/connected', true);
    await t('R', '방 밖 브릿지 — 게임 중 명단', 'deny', 'PUT', 'today/bridge/inGame', { players: ['a'], at: now });
    await t('N', '방 밖 브릿지 — 게스트가 큰 값 쓰기', 'deny', 'PUT', 'today/bridge/operators/rt_x', { name: 'x'.repeat(2000) });
    await t('N', '방 밖 브릿지 — 읽기', 'deny', 'GET', 'today/bridge');
    await t('R', '방 안 브릿지(들어간 방)', 'ok', 'PUT', 'today/rooms/rt_h/bridge/gamePhase', 'Lobby');

    console.log('— ③ 경기 기록에 붙는 칸');
    admin('PUT', `${D}/matches/rt_s1`, { gameId: 'rt_s1', sv: now, roomId: 'rt_x2', uid: OTHER });
    admin('PUT', `${D}/matches/rt_s2`, { gameId: 'rt_s2', sv: now, roomId: 'rt_x2', uid: A });
    admin('PUT', `${D}/matches/rt_s3`, { gameId: 'rt_s3', sv: now, roomId: 'rt_h' });
    admin('PUT', `${D}/normals/rt_sn`, { gameId: 'rt_sn', sv: now });
    await t('R', '남의 방 판(내가 기록한 것도 아님) — MVP 바꾸기', 'deny', 'PATCH', `${D}/matches/rt_s1`, { mvp: 'hack' });
    await t('R', '남의 방 판 — 팟지 칸 덮어쓰기', 'deny', 'PUT', `${D}/matches/rt_s1/potg`, { name: 'hack' });
    await t('R', '내가 기록한 판(방에서 나간 뒤) — 팟지 붙이기', 'ok', 'PATCH', `${D}/matches/rt_s2`, { potg: { name: 'a' } });
    await t('R', '들어와 있는 방의 판 — 투표 결과', 'ok', 'PATCH', `${D}/matches/rt_s3`, { mvp: 'a', votes: { x: 1 } });
    await t('R', '같이 한 일반 판 — 팟지 붙이기(예전대로)', 'ok', 'PATCH', `${D}/normals/rt_sn`, { potg: { name: 'a' } });
    await t('N', '게스트 — 일반 판 팟지', 'deny', 'PATCH', `${D}/normals/rt_sn`, { potg: { name: 'hack' } });
    await t('R', '새 내전 기록 — 기록한 사람을 남으로 적기', 'deny', 'PUT', `${D}/matches/rt_s4`, { gameId: 'rt_s4', sv: SV, roomId: 'rt_h', uid: OTHER });
    await t('R', '새 내전 기록 — 기록한 사람 = 나', 'ok', 'PUT', `${D}/matches/rt_s5`, { gameId: 'rt_s5', sv: SV, roomId: 'rt_h', uid: A });
    await t('R', '새 내전 기록 — 기록한 사람 칸 없음(옛 앱)', 'ok', 'PUT', `${D}/matches/rt_s6`, { gameId: 'rt_s6', sv: SV, roomId: 'rt_h' });

    console.log('— ④ 신고');
    const rep = x => Object.assign({ at: now, by: A, byName: '시험', target: OTHER, name: '남', room: 'rt_h', roomName: '방장시험', why: '기타', memo: '시험', st: 'open' }, x);
    await t('R', '신고 — 대상에 「../」 경로', 'deny', 'PUT', 'today/reports/rt_s1', rep({ target: '../../admins/x' }));
    await t('R', '신고 — 대상에 빗금', 'deny', 'PUT', 'today/reports/rt_s2', rep({ target: 'a/b' }));
    await t('R', '신고 — 대상에 점', 'deny', 'PUT', 'today/reports/rt_s3', rep({ target: '..' }));
    await t('R', '신고 — 대상이 숫자', 'deny', 'PUT', 'today/reports/rt_s4', rep({ target: 5 }));
    await t('R', '신고 — 정상', 'ok', 'PUT', 'today/reports/rt_s5', rep({}));

    console.log('— ⑤ 커뮤니티 운영자 칸(주인 운영자로)');
    admin('PUT', `today/admins/${A}`, { name: '시험운영자', at: now, owner: true });
    await t('R', '커뮤니티 운영자 — 정지 칸 모양(until·reason) 끼워 쓰기', 'deny', 'PUT', `today/c/rt_c/admins/${OTHER}`, { name: '남', at: now, until: 9e15, reason: 'x', by: 'y' });
    await t('R', '커뮤니티 운영자 — 모르는 칸', 'deny', 'PUT', `today/c/rt_c/admins/${OTHER}`, { name: '남', x: 1 });
    await t('R', '커뮤니티 운영자 — 정상(이름·시각)', 'ok', 'PUT', `today/c/rt_c/admins/${OTHER}`, { name: '남', at: now });
    await t('R', '운영자 — 내가 기록 안 한 판 통째 다시 쓰기(개인정보 지우기)', 'ok', 'PUT', `${D}/matches/rt_s1`, { gameId: 'rt_s1', sv: now, roomId: 'rt_x2', uid: '지운 이름 0000' });
    admin('DELETE', `today/admins/${A}`);
  } finally {
    try { admin('DELETE', `today/admins/${A}`); } catch (_) {}
    for (const p of ['today/roomList/rt_h', 'today/rooms/rt_h', 'today/roomList/rt_x2', 'today/rooms/rt_x2', `${D}/matches/rt_s1`, `${D}/matches/rt_s2`, `${D}/matches/rt_s3`, `${D}/matches/rt_s4`, `${D}/matches/rt_s5`, `${D}/matches/rt_s6`, `${D}/normals/rt_sn`,
      'today/reports/rt_s1', 'today/reports/rt_s2', 'today/reports/rt_s3', 'today/reports/rt_s4', 'today/reports/rt_s5', `today/c/rt_c/admins/${OTHER}`, 'today/bridge/operators/rt_x']) { try { admin('DELETE', p); } catch (_) {} }
    console.log(`\n통과 ${pass} · 실패 ${fail}\n정리 끝`);
  }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('오류', e.message); process.exit(1); });
