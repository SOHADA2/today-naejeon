// 🧪 홈 화면(롤 클라 없이 켰을 때 한 창 · home/home.html) 캡처 장면 만들기(가짜 이름) — 홈 화면을 고친 뒤 화면 검사에 씀(v0.1.227)
// 사용(리포 루트 · 이 PC 셸은 ELECTRON_RUN_AS_NODE 끄고 = env -u ELECTRON_RUN_AS_NODE):
//   node tools/ui-scenes-home.cjs <장면.json>                                               ← 장면 파일 만들기(9장면 · 810×680 · 서버·롤 연결 없음)
//   ./node_modules/electron/dist/electron.exe tools/ui-shot.cjs <장면.json> <출력 폴더>      ← PNG + 글자 겹침·잘림 검사
//   ./node_modules/electron/dist/electron.exe tools/ui-errcheck.cjs <장면.json>              ← 렌더러 실행 오류
// 장면 이름: g- 게스트(롤 로그인 전 = 처음 켠 사람) · m- 롤 로그인한 사람(롤 클라가 내려가 있음)
const fs = require('fs');
const out = process.argv[2];
if (!out) { console.error('사용: node tools/ui-scenes-home.cjs <장면.json>'); process.exit(1); }
const rooms = [{ id: 'r1', name: '오늘 내전?', host: '테스터에이', members: ['테스터에이', '테스터비', '테스터씨'], n: 3, priv: false },
  { id: 'r2', name: '열여섯글자방이름열여섯글자방이름', host: '테스터E', members: ['테스터E', '띄어 쓴 이름', '열여섯글자이름열여섯글자이름가나'], n: 3, priv: true }];
const guest = { name: '게스트', tag: '', guest: true, me: true, room: null };
const others = [{ name: '테스터에이', tag: 'KR1', guest: false, me: false, room: '오늘 내전?' }, { name: '열여섯글자이름열여섯글자이름가나', tag: 'KR1', guest: false, me: false, room: '열여섯글자방이름열여섯글자방이름' }, { name: '게스트', tag: '', guest: true, me: false, room: null }];
const me = { name: '테스터씨', tag: 'KR1', guest: false, me: true, room: null };
const base = { mode: 'home', match: null, day: '2026-11-19', ver: '9.9.9', ready: true, full: null, room: null, slow: false };
const OFF = { lol: 'off', launch: false, launching: false };
const S = (name, d) => ({ name, page: 'home', w: 810, h: 680, audit: 1, js: "__emit('home'," + JSON.stringify(Object.assign({}, base, d)) + "); await new Promise(r=>setTimeout(r,300));" });
const scenes = [
  S('g-launch', { me: null, rooms: [], online: [guest], start: Object.assign({}, OFF, { launch: true }) }),          // 처음 켬: 라이엇 클라이언트 찾음 = 「롤 클라이언트 켜기」
  S('g-launching', { me: null, rooms: [], online: [guest], start: Object.assign({}, OFF, { launching: true }) }),    // 방금 누름 = 「켜는 중」
  S('g-wait', { me: null, rooms, online: [guest].concat(others), start: OFF }),                                      // 라이엇 클라이언트를 못 찾음 = 글만 · 방 목록은 보기만
  S('g-login', { me: null, rooms, online: [guest].concat(others), start: { lol: 'login', launch: false, launching: false } }),   // 롤 클라는 켜짐 · 계정 확인 중
  S('g-loading', { me: null, rooms: [], online: [guest], ready: false, start: OFF }),                                // 방 목록 받는 중
  S('g-slow', { me: null, rooms: [], online: [guest], ready: false, slow: true, start: OFF }),                       // 서버 연결 안 됨
  S('m-rooms', { me: { name: '테스터씨', tag: 'KR1' }, rooms, online: [me].concat(others), start: { lol: 'ok' } }),   // 로그인함 · 방 밖 = 방마다 「들어가기」
  S('m-empty', { me: { name: '테스터씨', tag: 'KR1' }, rooms: [], online: [me], start: { lol: 'ok' } }),              // 로그인함 · 방 없음 = 「방 만들기」
  S('m-inroom', { me: { name: '테스터씨', tag: 'KR1' }, room: { id: 'r1', name: '오늘 내전?' }, rooms: rooms.map((r, k) => Object.assign({}, r, { mine: !k })), online: [Object.assign({}, me, { room: '오늘 내전?' })].concat(others), start: { lol: 'ok' } }),   // 방 안 = 버튼 없음
  // 🏘️ v0.1.265 커뮤니티 고르기(홈) — 새로 설치(ask = 카드 바로) · 이미 고름(머리 「커뮤니티 바꾸기」 → 누르면 카드) · 긴 이름
  S('g-comm-ask', { me: null, rooms, online: [guest].concat(others), start: Object.assign({}, OFF, { launch: true }), comm: { name: null, id: null, ask: true } }),
  S('m-comm-ask', { me: { name: '테스터씨', tag: 'KR1' }, rooms, online: [me].concat(others), start: { lol: 'ok' }, comm: { name: null, id: null, ask: true } }),
  S('m-comm-btn', { me: { name: '테스터씨', tag: 'KR1' }, rooms, online: [me].concat(others), start: { lol: 'ok' }, comm: { name: '큐', id: 'queue', ask: false } }),
  (x => (x.js += "document.getElementById('comm-chg').click(); await new Promise(r=>setTimeout(r,200));", x))(S('m-comm-open', { me: { name: '테스터씨', tag: 'KR1' }, rooms, online: [me].concat(others), start: { lol: 'ok' }, comm: { name: '열여섯글자커뮤니티이름열여섯글자', id: 'x', ask: false } })),
];
fs.writeFileSync(out, JSON.stringify(scenes));
console.log('장면', scenes.length, '개 →', out);
