// 서버 규칙 시험(v0.1.97 · 75건 + 2단계 표식 없는 요청 5건) — 기본 = 익명 로그인 표식을 붙인 요청(= 앱 설치본)으로 허용/차단 확인 + 표식 없는 요청 전부 거절 · RT_NOAUTH=1 = 1단계(표식 없이) · 시험 경로 = 2000-01-01·rt_ 접두 · 끝나면 관리자로 정리(GAPI=관리자 토큰 스크립트 경로 · CLAUDE.md 서버 규칙)
const { execFileSync } = require('child_process');
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app';
const admin = (m, p, body) => execFileSync('node', [process.env.GAPI || require('path').join(__dirname, 'gapi.cjs'), m, `${DB}/${p}.json`].concat(body ? [JSON.stringify(body)] : [])).toString().trim();
let TOK = '';   // 🔐 2단계(2026-11-04~): 앱처럼 익명 로그인 표식을 붙여 시험 · RT_NOAUTH=1이면 표식 없이(1단계 규칙 시험용)
const req = async (method, p, body, h, noauth) => (await fetch(`${DB}/${p}.json${TOK && !noauth ? `?auth=${TOK}` : ''}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: h })).status;
let pass = 0, fail = 0;
const t = async (name, want, method, p, body, h) => { const s = await req(method, p, body, h); const ok = want === 'ok' ? s === 200 : s === 401 || s === 403 || s === 412; ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', want === 'ok' ? '허용' : '차단', name, s); };
const SV = { '.sv': 'timestamp' }, D = 'today/days/2000-01-01';
(async () => {
  if (process.env.RT_NOAUTH !== '1') {
    const K = 'AIzaSyDhVbSzNQ306LUTcPo44Ru9G4_RqV9Dl_E';   // 웹 앱 키(공개용 식별자)
    TOK = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${K}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' })).json()).idToken || '';
    if (!TOK) { console.log('익명 로그인 실패'); process.exit(1); }
    const nt = async (name, method, p, body) => { const s = await req(method, p, body, undefined, true); const ok = s === 401 || s === 403; ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', '차단', name, s); };
    await nt('표식 없이 읽기 — 방 목록', 'GET', 'today/roomList');
    await nt('표식 없이 읽기 — 경기 기록', 'GET', 'today/days');
    await nt('표식 없이 쓰기 — 접속 표시', 'PUT', 'today/presence/rt_noauth', { name: 'x', at: 1 });
    await nt('표식 없이 쓰기 — 자리 신호', 'PUT', 'today/conns/rt_noauth', 1);
    const fake = await fetch(`${DB}/today/roomList.json?auth=abc.def.ghi`); const fok = fake.status === 401 || fake.status === 403; fok ? pass++ : fail++; console.log(fok ? '✅' : '❌', '차단 가짜 표식으로 읽기', fake.status);
  }
  // 📒 경기 기록
  await t('기록 만들기 — 서버 시각 없음', 'deny', 'PUT', `${D}/matches/rt_a`, { gameId: 'rt_a', ts: Date.now() }, { 'if-match': 'null_etag' });
  await t('기록 만들기 — 서버 시각 sv', 'ok', 'PUT', `${D}/matches/rt_1`, { gameId: 'rt_1', ts: Date.now(), sv: SV, stats: { a: 1 } }, { 'if-match': 'null_etag' });
  await t('일반 판 기록 만들기 — sv', 'ok', 'PUT', `${D}/normals/rt_n`, { gameId: 'rt_n', ts: Date.now(), sv: SV }, { 'if-match': 'null_etag' });
  await t('기록 만들기 — sv에 가짜 시각', 'deny', 'PUT', `${D}/matches/rt_b`, { gameId: 'rt_b', sv: 9e15 }, { 'if-match': 'null_etag' });
  await t('이상한 날짜 칸', 'deny', 'PUT', 'today/days/hack/matches/rt_c', { sv: SV });
  await t('이상한 종류 칸', 'deny', 'PUT', `${D}/junk/rt_c`, { sv: SV });
  await t('막 끝난 판 팟지(PATCH potg)', 'ok', 'PATCH', `${D}/matches/rt_1`, { potg: { name: 'a' } });
  await t('막 끝난 판 투표(PATCH mvp·svp·manner·votes)', 'ok', 'PATCH', `${D}/matches/rt_1`, { mvp: 'a', svp: 'b', manner: 'a', votes: { x: 1 } });
  await t('막 끝난 판 녹화·예측(PATCH potgRec·guess)', 'ok', 'PATCH', `${D}/matches/rt_1`, { potgRec: { ok: true }, guess: { answer: 'a' } });
  await t('기록 덮어쓰기', 'deny', 'PUT', `${D}/matches/rt_1`, { gameId: 'hack', sv: SV });
  await t('기록 지우기', 'deny', 'DELETE', `${D}/matches/rt_1`);
  await t('선수 기록 바꾸기', 'deny', 'PATCH', `${D}/matches/rt_1`, { stats: { a: 999 } });
  await t('서버 시각 바꾸기(sv)', 'deny', 'PATCH', `${D}/matches/rt_1`, { sv: Date.now() + 9e9 });
  admin('PUT', `${D}/matches/rt_old`, { gameId: 'rt_old', ts: 1, sv: Date.now() - 7 * 3600e3, mvp: 'a' });
  admin('PUT', `${D}/matches/rt_nosv`, { gameId: 'rt_nosv', ts: Date.now(), mvp: 'a' });
  await t('7시간 지난 판 MVP 바꾸기', 'deny', 'PATCH', `${D}/matches/rt_old`, { mvp: 'hack' });
  await t('7시간 지난 판 팟지 바꾸기', 'deny', 'PUT', `${D}/matches/rt_old/potg`, { name: 'hack' });
  await t('7시간 지난 판 투표 지우기', 'deny', 'DELETE', `${D}/matches/rt_old/votes`);
  await t('sv 없는 옛 기록 MVP 바꾸기', 'deny', 'PATCH', `${D}/matches/rt_nosv`, { mvp: 'hack' });
  await t('하루치 통째 지우기', 'deny', 'DELETE', D);
  await t('전체 기록 지우기', 'deny', 'DELETE', 'today/days');
  await t('today 통째 지우기', 'deny', 'DELETE', 'today');
  // 👤 접속 표시
  const P = 'today/presence/rt_p';
  await t('접속 표시', 'ok', 'PUT', P, { name: '시험', tag: 'KR1', icon: 29, at: Date.now(), host: false, app: '0.1.97', room: 'r1' });
  await t('접속 표시 — 모르는 칸', 'deny', 'PUT', P, { name: '시험', at: 1, junk: 'x'.repeat(1000) });
  await t('접속 표시 — 이름 너무 김', 'deny', 'PUT', P, { name: 'x'.repeat(41), at: 1 });
  await t('접속 표시 — 객체 아님', 'deny', 'PUT', P, 'x'.repeat(5000));
  await t('접속 표시 지우기(내 것)', 'ok', 'DELETE', P);
  await t('접속 표시 통째 지우기', 'deny', 'DELETE', 'today/presence');
  // 🚦 자리
  await t('자리 신호', 'ok', 'PUT', 'today/conns/rt_dev', Date.now());
  await t('자리 통째 지우기', 'deny', 'DELETE', 'today/conns');
  await t('자리 신호 지우기', 'ok', 'DELETE', 'today/conns/rt_dev');
  // 🚪 방
  await t('방 목록 올리기', 'ok', 'PUT', 'today/roomList/rt_r', { name: '시험방', priv: true, pw: 'a'.repeat(64), host: '시험', by: '시험', at: 1, seen: 1 });
  await t('방 살아있음(PATCH)', 'ok', 'PATCH', 'today/roomList/rt_r', { seen: Date.now(), host: '시험', pw: null });
  await t('방 목록 — 모르는 칸', 'deny', 'PATCH', 'today/roomList/rt_r', { junk: 'x' });
  await t('방 목록 통째 지우기', 'deny', 'DELETE', 'today/roomList');
  await t('방 판 상태', 'ok', 'PUT', 'today/rooms/rt_r/session', { phase: 'teams', teamA: ['a'] });
  await t('방 대기실·방장·브릿지', 'ok', 'PATCH', 'today/rooms/rt_r', { lobby: { v: 1 }, host: { puuid: 'x' }, bridge: { gamePhase: 'Lobby' } });
  await t('방 안 모르는 칸', 'deny', 'PUT', 'today/rooms/rt_r/junk', 'x');
  // 💬 대기실 한마디(v0.1.202 규칙 · 글 50자까지 · 대기실의 다른 칸은 그대로 자유)
  await t('한마디 — 한글 50자', 'ok', 'PUT', 'today/rooms/rt_r/lobby/chat/rt_p', { text: '가'.repeat(50), at: Date.now() });
  await t('한마디 — 그림 글자 25개', 'ok', 'PUT', 'today/rooms/rt_r/lobby/chat/rt_p', { text: '😀'.repeat(25), at: Date.now() });
  await t('한마디 — 51자', 'deny', 'PUT', 'today/rooms/rt_r/lobby/chat/rt_p', { text: '가'.repeat(51), at: Date.now() });
  await t('한마디 — 빈 글', 'deny', 'PUT', 'today/rooms/rt_r/lobby/chat/rt_p', { text: '', at: 1 });
  await t('한마디 — 글자가 아님', 'deny', 'PUT', 'today/rooms/rt_r/lobby/chat/rt_p', { text: 123, at: 1 });
  await t('한마디 — 시각 없음', 'deny', 'PUT', 'today/rooms/rt_r/lobby/chat/rt_p', { text: 'a' });
  await t('한마디 — 모르는 칸', 'deny', 'PUT', 'today/rooms/rt_r/lobby/chat/rt_p', { text: 'a', at: 1, junk: 'x' });
  await t('한마디 — 대기실 통째 쓰기에 긴 글 끼워 넣기', 'deny', 'PUT', 'today/rooms/rt_r/lobby', { mode: 'random', chat: { rt_p: { text: 'x'.repeat(51), at: 1 } } });
  await t('대기실 다른 칸은 그대로(방식·참가)', 'ok', 'PATCH', 'today/rooms/rt_r/lobby', { mode: 'draft', join: { rt_p: { name: '시험', st: 'in' } } });
  await t('한마디 지우기', 'ok', 'DELETE', 'today/rooms/rt_r/lobby/chat/rt_p');
  // 📦 v0.1.110 방 단위 데이터
  await t('방 사람 칸', 'ok', 'PUT', 'today/rooms/rt_r/members/rt_p', { name: '시험', tag: 'KR1', icon: 29, at: Date.now(), host: false, app: '0.1.110', room: 'rt_r' });
  await t('방 사람 칸 — 모르는 칸', 'deny', 'PUT', 'today/rooms/rt_r/members/rt_p', { name: '시험', at: 1, junk: 'x' });
  await t('방 목록 인원·이름', 'ok', 'PATCH', 'today/roomList/rt_r', { n: 2, mem: '시험\n시험2' });
  await t('방 목록 이름 줄 너무 김', 'deny', 'PATCH', 'today/roomList/rt_r', { mem: 'x'.repeat(401) });
  { const r = await fetch(`${DB}/today/days/2000-01-02/matches.json?orderBy=${encodeURIComponent('"roomName"')}&equalTo=${encodeURIComponent('"rt"')}${TOK ? `&auth=${TOK}` : ''}`); const ok = r.status === 200; ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', '허용 방 이름으로 골라 읽기(색인)', r.status); }
  await t('방 밖(_none) 쓰기', 'deny', 'PUT', 'today/rooms/_none/session', { a: 1 });
  await t('방 지우기(정리)', 'ok', 'DELETE', 'today/rooms/rt_r');
  await t('모든 방 통째 지우기', 'deny', 'DELETE', 'today/rooms');
  await t('방 목록에서 지우기', 'ok', 'DELETE', 'today/roomList/rt_r');
  // 🌉 브릿지(방 밖)
  await t('브릿지 게임 상태', 'ok', 'PUT', 'today/bridge/gamePhase', 'Lobby');
  await t('브릿지 운영자 표시', 'ok', 'PUT', 'today/bridge/operators/rt_op', { at: 1 });
  await t('브릿지 운영자 지우기', 'ok', 'DELETE', 'today/bridge/operators/rt_op');
  await t('브릿지 통째 지우기', 'deny', 'DELETE', 'today/bridge');
  await t('브릿지 점검 기록 통째 지우기', 'deny', 'DELETE', 'today/bridge/timelineProbe');
  await t('브릿지 모르는 칸', 'deny', 'PUT', 'today/bridge/junk', 'x');
  // 🎬 팟지 수집·영상(예비)
  await t('팟지 수집 쓰기', 'ok', 'PUT', 'today/potg/raw/2000-01-01/rt_g/rt_k', { a: 1 });
  await t('팟지 수집 하루치 덮어쓰기', 'deny', 'PUT', 'today/potg/raw/2000-01-01', { x: 1 });
  await t('팟지 수집 지난 날 지우기', 'ok', 'DELETE', 'today/potg/raw/2000-01-01');
  await t('팟지 통째 지우기', 'deny', 'DELETE', 'today/potg');
  await t('영상 조각 메타', 'ok', 'PUT', 'today/clips/2000-01-01/rt_g/meta', { n: 1 });
  await t('영상 조각', 'ok', 'PUT', 'today/clips/2000-01-01/rt_g/c/0', 'A'.repeat(1000));
  await t('영상 조각 — 너무 큼', 'deny', 'PUT', 'today/clips/2000-01-01/rt_g/c/1', 'A'.repeat(800001));
  await t('영상 모르는 칸', 'deny', 'PUT', 'today/clips/2000-01-01/rt_g/junk', 'x');
  await t('영상 지난 날 지우기', 'ok', 'DELETE', 'today/clips/2000-01-01');
  await t('영상 통째 지우기', 'deny', 'DELETE', 'today/clips');
  // 🏅 전적 기반 점수(v0.1.111)
  await t('점수 올리기', 'ok', 'PUT', 'today/ratings/rt_acc', { at: Date.now(), v: 1, solo: { tier: 'GOLD', div: 'II', lp: 45, w: 30, l: 28, q: 'solo' }, aram: { s: 62, gr: 'A', n: 40, w: 23, wr: 0.575, kda: 3.1 }, mayhem: { pl: 3, n: 3, w: 2 }, src: { list: 100, aram: 40, mayhem: 3, ranked: true } });
  await t('점수 올리기(v0.1.114 아수라장 내전·일반)', 'ok', 'PUT', 'today/ratings/rt_acc', { at: Date.now(), v: 2, custom: { s: 58, gr: 'B+', n: 12, w: 7, wr: 0.583, kda: 3.4 }, mayhem: { s: 52, gr: 'B', n: 19, w: 7, wr: 0.368, kda: 3.46 }, src: { list: 21, custom: 12, mayhem: 19 } });
  await t('점수 — 모르는 칸', 'deny', 'PATCH', 'today/ratings/rt_acc', { junk: 1 });
  await t('점수 — 등급 글자 너무 김', 'deny', 'PATCH', 'today/ratings/rt_acc/aram', { gr: 'SSS+' });
  await t('점수 통째 지우기', 'deny', 'DELETE', 'today/ratings');
  // 🪪 계정
  await t('계정 갱신(PATCH)', 'ok', 'PATCH', 'today/accounts/rt_acc', { name: '시험', tag: 'KR1', icon: 1, lastSeen: 1 });
  await t('계정 — 모르는 칸', 'deny', 'PATCH', 'today/accounts/rt_acc', { junk: 'x' });
  await t('계정 지우기', 'deny', 'DELETE', 'today/accounts/rt_acc');
  await t('계정 통째 지우기', 'deny', 'DELETE', 'today/accounts');
  // 🧭 증강
  await t('증강 챔피언 등급(앱)', 'ok', 'PUT', 'today/augGuide/champs/rt_x', { a: 1 });
  await t('증강 전체 등급 바꾸기', 'deny', 'PUT', 'today/augGuide/global', { a: 1 });
  await t('증강 챔피언 통째 지우기', 'deny', 'DELETE', 'today/augGuide/champs');
  // 🗑️ 옛 버전 칸(방 기능 전)·설정
  for (const k of ['session', 'lobby', 'host', 'normalLive', 'potgWait', 'potgRec']) await t(`옛 칸 today/${k} 쓰기`, 'deny', 'PUT', `today/${k}`, { a: 1 });
  await t('설정 바꾸기', 'deny', 'PUT', 'today/config/clipProxy', 'https://evil.example');
  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  for (const p of [D, 'today/ratings/rt_acc', 'today/accounts/rt_acc', 'today/augGuide/champs/rt_x', 'today/presence/rt_p', 'today/bridge/junk', 'today/days/hack']) admin('DELETE', p);
  console.log('정리 끝');
})();
