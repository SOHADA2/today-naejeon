// 🧪 대기실·방 목록 캡처 장면 만들기(가짜 이름) — 왼쪽 창(overlay)을 고친 뒤 화면 검사에 씀(v0.1.196 · 다른 PC에서도 같은 검사를 돌리게 리포에 둠)
// 사용(리포 루트 · 이 PC 셸은 ELECTRON_RUN_AS_NODE 끄고 = env -u ELECTRON_RUN_AS_NODE):
//   node tools/ui-scenes-lobby.cjs <장면.json>                                  ← 장면 파일 만들기(122장면: 302·402px × 61가지 상태 · 서버·롤 연결 없음)
//   ./node_modules/electron/dist/electron.exe tools/ui-shot.cjs <장면.json> <출력 폴더>    ← PNG + 글자 겹침·잘림 검사(「TODAY IN-HOUSE」 머리 배경 글자 겹침·잘림은 원래 그런 것)
//   ./node_modules/electron/dist/electron.exe tools/ui-errcheck.cjs <장면.json>            ← 렌더러 실행 오류(다시 그리기·방장 여부 뒤집기까지)
// 장면 이름: h- 방장 · m- 팀원 · x- 그 밖(롤 초대·디스코드 안내·12명·오류 줄·오늘 순위·방 목록) · 끝 숫자 = 창 폭
const fs = require('fs');
const out = process.argv[2];
if (!out) { console.error('사용: node tools/ui-scenes-lobby.cjs <장면.json>'); process.exit(1); }
const set = { tutorialSeen: true, tutorialDc: true, dcNudgeOff: false, discord: { app: true, on: true }, autoSeat: true, sfxOn: true, sfxVol: 1, dock: true, sidePanel: true, closeAsk: true, hotkey: 'Shift+F7' };
const NM = ['테스터에이', '테스터비', '테스터씨', '띄어 쓴 이름', '테스터E', '열여섯글자이름열여섯글자이름가나', '테스터G', '테스터H', '테스터I', '테스터J', '테스터K', '테스터L'];
const mem = (k, me, spec) => NM.slice(0, k).map((n, i) => ({ key: 'p' + i, name: n, online: true, st: spec && i === me ? 'spec' : 'in', me: i === me, host: i === 0, dc: i % 3 !== 2, ver: '9.9.9' }));
const L0 = { phase: 'None', party: null, nq: 2400, invite: null };
const V = { kind: 'voice', gid: '1', ch: '2', name: '시험 서버' };   // 디스코드: 서버엔 있는데 음성 채널 밖(방 줄에 아이콘)
const lobby = (k, me, mode, extra, spec) => Object.assign({ sides: {}, mode, captains: {}, hostName: NM[0], latest: '9.9.9', room: { id: 'r1', name: '오늘 내전?', priv: false }, members: mem(k, me, spec), isHost: me === 0, dcGuild: 'g', dcInv: true, dcJoin: V, lol: L0 }, extra || {});
const pre = "__emit('settings'," + JSON.stringify(set) + "); ";
const wait = " await new Promise(r=>setTimeout(r,300)); ";
// k = 방 사람 수 · me = 내 자리 번호(0 = 방장) · more = 그린 뒤 실행할 JS · extra = 대기실 데이터 덮어쓰기 · spec = 내가 관전 중 · h = 창 높이
const sc = (name, w, k, me, mode, more, extra, spec, h) => ({ name, page: 'overlay', w, h: h || 720, audit: 1,
  js: pre + "__emit('myName'," + JSON.stringify(NM[me]) + "); __emit('lobby', " + JSON.stringify(lobby(k, me, mode, extra, spec)) + ");" + wait + (more || '') });
const rooms = [{ id: 'r1', name: '오늘 내전?', host: NM[0], members: NM.slice(0, 3), n: 3, priv: false }, { id: 'r2', name: '칼바람 5인큐', host: NM[4], members: [NM[4], NM[3]], n: 2, priv: true }];
const today = { ok: true, standings: [{ rank: 1, name: NM[0], wins: 3, losses: 1 }, { rank: 2, name: NM[2], wins: 2, losses: 2 }, { rank: 3, name: NM[1], wins: 1, losses: 3 }], matches: [1, 2, 3, 4] };
const partyLead = { phase: 'Lobby', party: { q: 2400, n: 3, max: 5, leader: true, ids: [] }, nq: 2400 }, partyIn = { phase: 'Lobby', party: { q: 2400, n: 2, max: 5, leader: false, ids: [] }, nq: 2400 };
const S = [];
for (const w of [302, 402]) {
  // 방장
  S.push(sc('h-alone-' + w, w, 1, 0, 'random'));                                                                        // 혼자 = 「친구가 … 들어오면 자리에 앉아요」 · 「2명부터 시작」
  S.push(sc('h-random5-' + w, w, 5, 0, 'random'));                                                                      // 홀수 = 「5명 → 2 : 2 · 남는 1명은 관전」
  S.push(sc('h-draft-pick-' + w, w, 6, 0, 'draft'));                                                                    // 팀장 전 = 모든 자리에 「팀장」 버튼
  S.push(sc('h-draft-ready-' + w, w, 10, 0, 'draft', '', { captains: { teamA: NM[0], teamB: NM[2] } }));                // 팀장 2/2 + 뽑는 순서 막대
  S.push(sc('h-pop-' + w, w, 4, 0, 'balance', "document.getElementById('lb-mchip').click();"));                         // 방식 고르는 창(내전)
  { // 🏆 v0.1.288~289 시리즈 — 방식 창 「판 수」 · 대기실 대진 카드(12자 팀 이름) · 팀원 안내 줄 · 팀 화면 점수 띠 · 투표 · 결과(시리즈 끝)
    const SER = { bo: 3, a: '불꽃', b: '열두글자팀이름열두글자팀' };
    S.push(sc('h-pop-ser-' + w, w, 4, 0, 'random', "document.getElementById('lb-mchip').click();", { series: SER }));
    S.push(sc('m-ser-' + w, w, 4, 1, 'random', '', { series: Object.assign({}, SER, { bo: 5 }) }));
    S.push(sc('h-vs-' + w, w, 4, 0, 'random', '', { series: SER }));   // v0.1.289 대진 카드(방장 = 이름 칸)
    const ss = (phase, n, wa, wb, done, extra) => Object.assign({ phase, teamA: [NM[0], NM[2], NM[5]], teamB: [NM[1], NM[3], NM[4]], mode: 'random', teamsFormedAt: Date.now(), ids: {},
      series: { id: 's1', bo: 3, need: 2, names: { teamA: SER.a, teamB: SER.b }, wins: { teamA: wa, teamB: wb }, n, games: [], done } }, extra || {});
    const sx = (name, sess) => ({ name: name + '-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('session', { session: " + JSON.stringify(sess) + ", myName: " + JSON.stringify(NM[0]) + ", isHost: true });" + wait });
    S.push(sx('x-ser-team', ss('teams', 1, 1, 0, null)));
    S.push(sx('x-ser-vote', ss('vote', 2, 1, 1, null, { game: { id: 'g2', winner: 'teamB' }, votes: {} })));
    S.push(sx('x-ser-res', ss('result', 3, 2, 1, 'teamA', { game: { id: 'g3', winner: 'teamA' }, result: { mvp: NM[2], svp: NM[1], manner: NM[5] } })));
  }
  S.push(sc('h-manual-' + w, w, 6, 0, 'manual', '', { sides: { [NM[0]]: 'teamA', [NM[1]]: 'teamB', [NM[2]]: 'teamA' } })); // 직접 = 1팀·2팀 열 + 팀 미정 칩
  S.push(sc('h-normal-' + w, w, 4, 0, 'normal'));                                                                       // 일반 = 「파티 만들고 초대」
  S.push(sc('h-normal-party-' + w, w, 4, 0, 'normal', '', { lol: partyLead }));                                         // 롤 파티 3/5 · 다시 초대 · 「큐 시작」
  S.push(sc('h-normal-pop-' + w, w, 7, 0, 'normal', "document.getElementById('lb-mchip').click();"));                   // 7명(6번째부터 파티 자리 없음) + 고르는 창(일반)
  S.push(sc('h-menu-' + w, w, 4, 0, 'random', "document.getElementById('lb-rbtn').click();"));
  S.push(sc('h-menu-ser-' + w, w, 4, 0, 'random', "document.getElementById('lb-rbtn').click(); await new Promise(r=>setTimeout(r,350)); document.getElementById('lb-hm-ser').click();", { series: { bo: 3, a: '불꽃', b: '번개' } }));   // 🏆 v0.1.289 방 메뉴 → 시리즈 바꾸기                          // 방 메뉴
  S.push(sc('m-menu-' + w, w, 4, 2, 'random', "document.getElementById('lb-rbtn').click();"));                          // 🚪 v0.1.265 팀원 방 메뉴(지금 방장 · 신고 · 나가기)
  S.push(sc('h-menu-rep-' + w, w, 4, 0, 'random', "document.getElementById('lb-rbtn').click(); await new Promise(r=>setTimeout(r,350)); document.getElementById('lb-hm-rep').click();"));   // 신고할 사람 고르기
  // 🗺️ v0.1.232 소환사의 협곡
  S.push(sc('h-sr-pop-' + w, w, 6, 0, 'draft', "document.getElementById('lb-mchip').click();", { game: 'sr', srPick: 3130 }));                       // 고르는 창(게임 = 협곡 · 픽 방식 줄)
  S.push(sc('h-sr-pop-short-' + w, w, 10, 0, 'balance', "document.getElementById('lb-mchip').click();", { game: 'sr', srPick: 3100 }, false, 576));  // 낮은 창 + 10명
  S.push(sc('h-sr-switch-' + w, w, 6, 0, 'random', '', { game: 'sr', srPick: 3130, lol: { phase: 'Lobby', inCustom: true, cmap: 12, cq: 3270, ids: [], invs: {}, party: null, nq: 2400 } }));   // 롤 방이 아수라장 → 「협곡으로 바꾸기」
  S.push(sc('h-sr-nq-pop-' + w, w, 4, 0, 'normal', "document.getElementById('lb-mchip').click();", { lol: { phase: 'None', party: null, nq: 440 } }));  // 일반 = 자유 랭크
  S.push(sc('m-sr-' + w, w, 6, 2, 'draft', '', { game: 'sr', srPick: 3130 }));                                                                       // 팀원 상태 카드 「협곡 내전 · 드래프트」
  // 팀원
  S.push(sc('m-draft-' + w, w, 6, 2, 'draft'));                                                                         // 상태 카드
  S.push(sc('m-spec-' + w, w, 4, 2, 'random', '', null, true));                                                         // 관전 중 = 「다시 참가하기」
  S.push(sc('m-normal-' + w, w, 4, 1, 'normal', '', { lol: partyIn }));                                                 // 일반 · 파티에 들어와 있음
  S.push(sc('m-nohost-' + w, w, 3, 1, 'random', '', { hostName: null, members: mem(3, 1).map(m => Object.assign(m, { host: false })) })); // 방장 없음 = 「방장 하기」
  // 그 밖
  S.push({ name: 'x-login-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + wait });                               // 롤 로그인 전 = 시작하는 법
  S.push(sc('x-invite-' + w, w, 4, 1, 'random', '', { lol: { phase: 'None', party: null, nq: 2400, invite: { id: 'i1', from: NM[0] } } })); // 롤 초대 수락 줄(자동 수락 끈 사람)
  S.push(sc('x-dchint-' + w, w, 4, 1, 'random', "document.getElementById('lb-dci').click(); await new Promise(r=>setTimeout(r,200));"));     // 디스코드 아이콘 누른 뒤 안내
  S.push(sc('x-12-' + w, w, 12, 0, 'random'));                                                                          // 12명 = 10/10 +2
  S.push(sc('x-err-' + w, w, 4, 0, 'random', "lbErr('롤 파티는 5명까지라 테스터G, 테스터H님은 초대 안 했어요');"));      // 오류 줄(아래 구역)
  S.push(Object.assign(sc('x-today-' + w, w, 6, 2, 'balance'), { stub: { getToday: today } }));                         // 오늘 순위
  S.push({ name: 'x-rooms-empty-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms: [], room: null, ready: true }) + ");" + wait });
  S.push({ name: 'x-rooms-list-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true }) + ");" + wait });
  // ⚔ 선픽 줄다리기(v0.1.230) — 시계를 멈춰 그 순간을 찍음(window.__fpClock = 초 · __fpSeed = 0 뒤집기 / 1 밀어붙이기) · 16자 이름 · 낮은 창
  const DRAFT = first => ({ phase: 'draft', mode: 'draft', captains: { teamA: NM[0], teamB: NM[5] }, teamA: [NM[0]], teamB: [NM[5]], pool: [NM[1], NM[2], NM[3], NM[4]], order: ['teamA', 'teamB', 'teamB', 'teamA'], pickIdx: 0, teamSize: 3, firstPick: first });
  const fp = (name, first, sec, seed, h) => ({ name: name + '-' + w, page: 'overlay', w, h: h || 720, audit: 1, js: pre + "window.__fpClock = () => " + sec + "; window.__fpSeed = " + seed + "; { const s = " + JSON.stringify(DRAFT(first)) + "; s.draftStartedAt = Date.now(); s.turnEndsAt = Date.now() + 34700; __emit('session', { session: s, myName: " + JSON.stringify(NM[0]) + ", isHost: true }); } await new Promise(r=>setTimeout(r,500));", wait: 60 });
  S.push(fp('x-fp-clash', 'teamA', 0.36, 0));              // 막 맞붙음
  S.push(fp('x-fp-tug', 'teamA', 1.32, 0));                // 당기는 중(1팀이 밂 · 16자 이름 쪽이 좁아짐)
  S.push(fp('x-fp-strain', 'teamB', 2.25, 1));             // 버팀(2팀이 밂)
  S.push(fp('x-fp-res-t1', 'teamA', 3.7, 0));              // 결과 = 1팀
  S.push(fp('x-fp-res-t2', 'teamB', 3.7, 1));              // 결과 = 2팀(16자 이름)
  S.push(fp('x-fp-tug-short', 'teamB', 1.32, 1, 576));     // 낮은 창
  S.push(fp('x-fp-res-short', 'teamB', 3.7, 1, 576));
  // 🚀 처음 켠 사람(v0.1.227) — 롤 로그인 전 카드의 「롤 클라이언트 켜기」 버튼·켜는 중 · 서버 연결 안 됨 · 방 만드는 칸 · 사용법(따라 하기 8단계 + 끝 카드 + 자세한 사용법 7쪽)
  S.push({ name: 'x-login-launch-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('start'," + JSON.stringify({ lol: 'off', launch: true, launching: false }) + ");" + wait });
  S.push({ name: 'x-login-launching-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('start'," + JSON.stringify({ lol: 'off', launch: false, launching: true }) + ");" + wait });
  // 🔒 v0.1.253 기록 공개 동의 안 함 = 보기만(방 목록 맨 위 카드 · 들어가기 → 동의 창 · ⚙ 개인정보 줄)
  S.push({ name: 'x-rooms-pub-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[5]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true, pub: { need: true, at: 0 } }) + ");" + wait });
  S.push({ name: 'x-rooms-pub-empty-' + w, page: 'overlay', w, h: 576, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms: [], room: null, ready: true, pub: { need: true, at: 0 } }) + ");" + wait });
  S.push({ name: 'x-rooms-pub-ask-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true, pub: { need: true, at: 0 } }) + ");" + wait + "window.tnPubAsk();" + wait });
  S.push({ name: 'x-set-pub-no-' + w, page: 'overlay', w, h: 720, js: "__emit('settings'," + JSON.stringify(Object.assign({}, set, { pub: { need: true, at: 0 } })) + "); __emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true }) + ");" + wait + "window.tnSettingsOpen('acct');" + wait + "const b=document.querySelector('[data-act=pubon]'); if(b) b.scrollIntoView();" + wait });
  S.push({ name: 'x-set-pub-yes-' + w, page: 'overlay', w, h: 720, js: "__emit('settings'," + JSON.stringify(Object.assign({}, set, { pub: { need: false, at: Date.UTC(2026, 10, 26, 3) } })) + "); __emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true }) + ");" + wait + "window.tnSettingsOpen('acct');" + wait + "const b=document.querySelector('[data-act=puboff]'); if(b) b.scrollIntoView();" + wait });
  // 🏘️ v0.1.258 커뮤니티 — 새로 설치한 사람 고르기 카드(게스트·로그인) · 방 목록 머리 「ROOMS · 큐」 · ⚙ 커뮤니티 줄
  S.push({ name: 'x-rooms-comm-ask-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true, comm: { name: null, id: null, ask: true }, pub: { need: true, at: 0 } }) + ");" + wait });
  S.push({ name: 'x-rooms-comm-guest-' + w, page: 'overlay', w, h: 576, audit: 1, js: pre + "__emit('rooms', " + JSON.stringify({ rooms: [], room: null, ready: true, comm: { name: null, id: null, ask: true } }) + ");" + wait });
  S.push({ name: 'x-rooms-comm-que-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[5]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true, comm: { name: '열여섯글자커뮤니티이름이에요', id: 'que', ask: false } }) + ");" + wait });
  S.push({ name: 'x-set-comm-' + w, page: 'overlay', w, h: 720, js: "__emit('settings'," + JSON.stringify(Object.assign({}, set, { comm: { name: '큐', id: 'que', ask: false }, pub: { need: false, at: Date.UTC(2026, 10, 26) } })) + "); __emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true }) + ");" + wait + "window.tnSettingsOpen('acct');" + wait + "const b=document.querySelector('[data-act=comm]'); if(b) b.scrollIntoView();" + wait });
  S.push({ name: 'x-rooms-slow-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms: [], room: null, ready: false, slow: true }) + ");" + wait });
  S.push({ name: 'x-rooms-form-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms: [], room: null, ready: true }) + ");" + wait + "document.getElementById('rm-new2').click();" + wait });
  S.push({ name: 'x-rooms-form-ser-' + w, page: 'overlay', w, h: 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms: [], room: null, ready: true }) + ");" + wait + "document.getElementById('rm-new2').click();" + wait + "document.querySelector('.rm-bseg[data-bo=\"3\"]').click(); document.getElementById('rm-tna').value='불꽃'; document.getElementById('rm-tnb').value='열두글자팀이름열두글자팀';" + wait });   // 🏆 v0.1.289 시리즈 방 만들기
  // 🧭 따라 하기(v0.1.228 · 예시 화면 + 밝게 남긴 버튼 + 말풍선) 8단계 · 낮은 창(576)에서 아래 버튼·고르는 창·팀 화면 · 끝 카드(마지막 단계에서 「다음」)
  const TUT = pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true }) + ");" + wait;
  for (let k = 0; k < 8; k++) S.push({ name: 'x-tut-g' + (k + 1) + '-' + w, page: 'overlay', w, h: 720, audit: 1, js: TUT + "window.tnTutorial(" + k + ");" + wait + wait });
  for (const k of [2, 4, 6, 7]) S.push({ name: 'x-tut-g' + (k + 1) + '-short-' + w, page: 'overlay', w, h: 576, audit: 1, js: TUT + "window.tnTutorial(" + k + ");" + wait + wait });
  S.push({ name: 'x-tut-g8-picked-' + w, page: 'overlay', w, h: 720, audit: 1, js: TUT + "window.tnTutorial(7);" + wait + "document.querySelector('#vt-body .vt-cand.mvp').click();" + wait + wait });   // 투표 후보를 누른 뒤 = 끝 카드
  S.push({ name: 'x-tut-end-' + w, page: 'overlay', w, h: 720, audit: 1, js: TUT + "window.tnTutorial(7);" + wait + "document.querySelector('.tg-next').click();" + wait + wait });
  for (let k = 0; k < 7; k++) S.push({ name: 'x-tut-more' + (k + 1) + '-' + w, page: 'overlay', w, h: k === 2 ? 576 : 720, audit: 1, js: pre + "__emit('myName'," + JSON.stringify(NM[0]) + "); __emit('rooms', " + JSON.stringify({ rooms, room: null, ready: true }) + ");" + wait + "window.tnTutorial(" + k + ", 'more');" + wait });   // 가장 긴 쪽(MODE)은 낮은 창(576)으로
  S.push(sc('x-short-' + w, w, 10, 0, 'draft', '', { captains: { teamA: NM[0], teamB: NM[2] } }, false, 576));          // 낮은 창(576 = 롤 클라 최소 크기 1024×576 옆)에서 10명 드래프트 = 한 화면
  // 💬 채팅(v0.1.202) — 글 = 입력 칸 위 「최근 말」 줄 · 이모티콘 = 그 사람 얼굴 자리에서 뜸(⚠️ 얼굴 글자와 겹치는 게 정상 → 겹침 검사에 걸림) · 접기
  const SAY = "__emit('chat',{key:'p0',text:'다들 준비됐어?',at:1}); __emit('chat',{key:'p3',text:'잠깐만 물 좀 떠 올게 금방 옴 ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ',at:2}); __emit('chat',{key:'p2',text:'ㄱㄱ',at:3});";
  const EMOJ = " __emit('chat',{key:'p4',text:'👍',at:4}); __emit('chat',{key:'p1',text:'🔥',at:5}); await new Promise(r=>setTimeout(r,300));";
  S.push(sc('x-chat-' + w, w, 6, 2, 'random', SAY + EMOJ));                                                             // 팀원 화면: 글 3줄(내 것 = 금색) + 이모티콘 2개
  S.push(sc('x-chat-host-' + w, w, 5, 0, 'draft', "__emit('chat',{key:'p0',text:'팀장 누가 할래',at:1}); __emit('chat',{key:'p4',text:'나!',at:2}); __emit('chat',{key:'p2',text:'✅',at:3}); await new Promise(r=>setTimeout(r,300));"));   // 방장 화면
  S.push(sc('x-chat-long-' + w, w, 6, 2, 'random', "__emit('chat',{key:'p5',text:'" + '가나다라마바사아자차'.repeat(5) + "',at:1}); __emit('chat',{key:'p0',text:'" + 'abcdefghij'.repeat(5) + "',at:2}); await new Promise(r=>setTimeout(r,300));"));   // 16자 이름 + 50자 글(한글·띄어쓰기 없는 영문)
  S.push(sc('x-chat-fold-' + w, w, 6, 2, 'random', "document.getElementById('lb-chat-dn').click(); " + SAY + " await new Promise(r=>setTimeout(r,1100));"));   // 접힌 한 줄 = 마지막 말 미리 보기 + 「새 말 2」
  S.push(sc('x-chat-short-' + w, w, 10, 0, 'draft', SAY + " await new Promise(r=>setTimeout(r,300));", { captains: { teamA: NM[0], teamB: NM[2] } }, false, 576));   // 낮은 창(576 = 롤 클라 최소 크기 1024×576 옆) 10명 + 글 3줄 = 자리가 밀림(스크롤)
  S.push(sc('x-chat-short-fold-' + w, w, 10, 0, 'draft', "document.getElementById('lb-chat-dn').click(); " + SAY + " await new Promise(r=>setTimeout(r,1100));", { captains: { teamA: NM[0], teamB: NM[2] } }, false, 576));   // 같은 화면에서 접음 = 10명 한 화면
}
fs.writeFileSync(out, JSON.stringify(S));
console.log('장면', S.length, '개 →', out);
