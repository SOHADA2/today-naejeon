// 서버 규칙 시험(v0.1.97 · 70건) — 인증 없는 요청(= 누구나)으로 허용/차단 확인 · 시험 경로 = 2000-01-01·rt_ 접두 · 끝나면 관리자로 정리(GAPI=관리자 토큰 스크립트 경로 · CLAUDE.md 서버 규칙)
const { execFileSync } = require('child_process');
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app';
const admin = (m, p, body) => execFileSync('node', [process.env.GAPI || require('path').join(__dirname, 'gapi.cjs'), m, `${DB}/${p}.json`].concat(body ? [JSON.stringify(body)] : [])).toString().trim();
const req = async (method, p, body, h) => (await fetch(`${DB}/${p}.json`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: h })).status;
let pass = 0, fail = 0;
const t = async (name, want, method, p, body, h) => { const s = await req(method, p, body, h); const ok = want === 'ok' ? s === 200 : s === 401 || s === 403 || s === 412; ok ? pass++ : fail++; console.log(ok ? '✅' : '❌', want === 'ok' ? '허용' : '차단', name, s); };
const SV = { '.sv': 'timestamp' }, D = 'today/days/2000-01-01';
(async () => {
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
  for (const p of [D, 'today/accounts/rt_acc', 'today/augGuide/champs/rt_x', 'today/presence/rt_p', 'today/bridge/junk', 'today/days/hack']) admin('DELETE', p);
  console.log('정리 끝');
})();
