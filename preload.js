// 렌더러(오버레이·오른쪽 패널·마커·토스트)에 안전한 API만 노출
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 📡 메인 → 렌더러 이벤트
  onPlayers: (cb) => ipcRenderer.on('players', (_e, d) => cb(d)),       // 인게임 명단(2999)
  onState: (cb) => ipcRenderer.on('state', (_e, d) => cb(d)),           // 게임 중 여부
  onSession: (cb) => ipcRenderer.on('session', (_e, d) => cb(d)),       // today/session(팀·투표·결과)
  onLobby: (cb) => ipcRenderer.on('lobby', (_e, d) => cb(d)),           // 🚪 대기실
  onMyName: (cb) => ipcRenderer.on('myname', (_e, n) => cb(n)),
  onDocked: (cb) => ipcRenderer.on('docked', (_e, v) => cb(v)),
  onMerged: (cb) => ipcRenderer.on('merged', (_e, v) => cb(v)),
  onDoorFx: (cb) => ipcRenderer.on('door-fx', (_e, d) => cb(d)),
  // 🏠 홈 화면(v0.1.127 · 롤 클라 없을 때 한 창) — {mode, me, rooms, room, online, full, ready, ver}
  getHome: () => ipcRenderer.invoke('home-get'),
  onHome: (cb) => ipcRenderer.on('home', (_e, d) => cb(d)),
  onHomeIntro: (cb) => ipcRenderer.on('home-intro', (_e, m) => cb(m)),
  homeMin: () => ipcRenderer.send('home-min'),
  homeClose: () => ipcRenderer.send('home-close'),
  homePanels: () => ipcRenderer.send('home-panels'),          // 🚪 창이 움직이는 동안 안쪽 화면을 문짝처럼(v0.1.127)          // 🚪 클라 없을 때 두 창이 맞붙은 한 창 — 머리줄 하나로(왼쪽 제목·오른쪽 버튼)         // 🖥️ 클라 도킹 중이면 각진 모서리
  onSlotTeam: (cb) => ipcRenderer.on('slot-team', (_e, t) => cb(t)),    // 📍 클라 위 내 팀 마커(1/2)
  onRecToast: (cb) => ipcRenderer.on('rec-toast', (_e, d) => cb(d)),
  onAugRank: (cb) => ipcRenderer.on('augrank', (_e, d) => cb(d)),      // 🎯 증강 순위(설정에서 켠 사람 · 베타)        // 🖥️ 게임 중 정보 창(설정에서 켠 사람)    // 🎬 팟지 녹화 중 안내(방장 PC)
  onTeamBuild: (cb) => ipcRenderer.on('teambuild', (_e, d) => cb(d)),
  // 🪟 창
  sideClose: () => ipcRenderer.send('side-hide'),
  sideMinimize: () => ipcRenderer.send('side-min'),
  overlayMinimize: () => ipcRenderer.send('overlay-min'),
  hideOverlay: () => ipcRenderer.send('overlay-hide'),
  openWeb: () => ipcRenderer.send('open-web'),
  // 🔄 업데이트(v0.1.39: 창 안에 표시) {cur, state:'idle'|'checking'|'downloading'|'ready'|'latest'|'error'|'dev', version, pct} · 🚪 클라 종료 확인창
  getUpdate: () => ipcRenderer.invoke('update-info'),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, d) => cb(d)),
  checkUpdate: () => ipcRenderer.send('update-check'),
  updateNow: () => ipcRenderer.send('update-now'),
  // ⚙️ 설정 {sfxOn, sfxVol, dock, sidePanel, closeAsk, hotkey}
  getSettings: () => ipcRenderer.invoke('settings-get'),
  openTutorial: () => ipcRenderer.send('tutorial-open'),                   // 📘 사용법 다시 보기
  onTutorial: (cb) => ipcRenderer.on('tutorial', (_e, d) => cb(d)),
  onTierReveal: (cb) => ipcRenderer.on('tier-reveal', (_e, d) => cb(d)),   // 🏅 아수라장 티어 공개(v0.1.113)
  setSetting: (key, value) => ipcRenderer.invoke('settings-set', { key, value }),
  discordConnect: () => ipcRenderer.invoke('discord-connect'),             // 🎧 v0.1.131 디스코드 서버 연결(봇 초대 화면)
  discordUnlink: () => ipcRenderer.invoke('discord-unlink'),
  discordInvite: (link) => ipcRenderer.invoke('discord-invite', link),       // 🎧 v0.1.138 방장 초대 링크
  discordJoin: (o) => ipcRenderer.invoke('discord-join', o),
  lolLobby: (o) => ipcRenderer.invoke('lol-lobby', o),      // 🎮 v0.1.185 롤 사용자 설정 방 만들기 + 초대
  lolParty: (o) => ipcRenderer.invoke('lol-party', o),      // 🎮 v0.1.191 일반판 = 롤 일반 큐 파티 만들기 + 초대(5명까지)
  lolQueue: (on) => ipcRenderer.invoke('lol-queue', { on: !!on }),   // 큐 시작 / 취소
  lolNormalQ: (q) => ipcRenderer.send('lol-normal-q', q),   // 일반판 큐 고르기(아수라장 2400 · 칼바람 450)
  lolAccept: () => ipcRenderer.invoke('lol-accept'),        // 🎮 방장 롤 초대 수락
  onSettings: (cb) => ipcRenderer.on('settings', (_e, d) => cb(d)),
  quitApp: () => ipcRenderer.send('app-quit'),
  quitConfirm: (yes, noAsk) => ipcRenderer.send('quit-confirm', yes, !!noAsk),
  // 👤 입장(라이엇 계정 자동)
  getPlayers: () => ipcRenderer.invoke('get-players'),
  onAccount: (cb) => ipcRenderer.on('account', (_e, d) => cb(d)),   // 👤 롤 로그인 계정(자동 입장·계정 바뀌면 자동 전환)
  getRoster: () => ipcRenderer.invoke('roster-data'),                // 👥 지금 접속 중 + 오늘 뛴 사람
  setHost: (v) => ipcRenderer.invoke('set-host', v),                   // 👑 방장 하기/그만하기 → {ok, err}
  handHost: (puuid) => ipcRenderer.invoke('hand-host', { puuid }),       // 👑 방장 넘겨주기
  getHostNotice: () => ipcRenderer.invoke('host-notice-get'),            // 👑 v0.1.151 방장이 나에게 넘어옴 안내
  hostNoticeOk: () => ipcRenderer.invoke('host-notice-ok'),
  onHostNotice: (cb) => ipcRenderer.on('host-notice', (_e, d) => cb(d)),
  getHost: () => ipcRenderer.invoke('host-info'),
  onHost: (cb) => ipcRenderer.on('host', (_e, d) => cb(d)),             // 👑 지금 방장 {host:{name,alive,mine}, isHost, note}
  // ⚔️ 팀 짜기(방장)
  tbStart: (names, mode) => ipcRenderer.invoke('tb-start', { names, mode }),
  tbAgain: () => ipcRenderer.invoke('tb-again'),
  draftStart: (names, captains) => ipcRenderer.invoke('draft-start', { names, captains }),   // 🎯 드래프트(방장)
  draftMap: (map) => ipcRenderer.invoke('draft-map', { map }),   // 🎮 v0.1.188 선픽 아닌 팀장이 다리 고르기
  draftPick: (name) => ipcRenderer.invoke('draft-pick', { name }),                                // 🎯 팀장 픽
  // 🚪 대기실(모두 같이 보는 화면) — onLobby로 {members, mode, captains, hostName, isHost}
  getLobby: () => ipcRenderer.invoke('lobby-data'),
  lobbyMe: (st) => ipcRenderer.invoke('lobby-me', { st }),                  // 'in' 참가 · 'spec' 관전 · null 취소
  lobbySet: (key, st) => ipcRenderer.invoke('lobby-set', { key, st }),      // 👑 남의 상태
  lobbyGuest: (name) => ipcRenderer.invoke('lobby-guest', { name }),        // 👑 앱 없는 사람 추가
  lobbyGuestRm: (key) => ipcRenderer.invoke('lobby-guest-rm', { key }),
  lobbyMode: (mode) => ipcRenderer.invoke('lobby-mode', { mode }),         // 👑 랜덤/드래프트
  lobbyCaptain: (name, rand) => ipcRenderer.invoke('lobby-captain', { name, rand }),   // 👑 팀장 지정
  lobbyStart: () => ipcRenderer.invoke('lobby-start'),                      // 👑 시작
  lobbySide: (name, team) => ipcRenderer.invoke('lobby-side', { name, team }),   // 🧩 직접: 1팀/2팀/빼기(null)
  lobbySidesPrev: () => ipcRenderer.invoke('lobby-sides-prev'),               // 🧩 지난 판 팀 그대로
  lobbySidesClear: () => ipcRenderer.invoke('lobby-sides-clear'),
  lobbyReopen: () => ipcRenderer.invoke('lobby-reopen'),
  // 🚪 방(v0.1.94) — onRooms로 {rooms:[{id,name,priv,host,n,members,mine}], room, me, ready}
  onRooms: (cb) => ipcRenderer.on('rooms', (_e, d) => cb(d)),
  getRooms: () => ipcRenderer.invoke('rooms-data'),
  roomCreate: (name, priv, pw) => ipcRenderer.invoke('room-create', { name, priv, pw }),
  roomJoin: (id, pw) => ipcRenderer.invoke('room-join', { id, pw }),
  roomLeave: () => ipcRenderer.invoke('room-leave'),                    // 👑 지금 판 접고 대기실로
  showOverlay: () => ipcRenderer.send('overlay-show'),
  hostResult: (winner) => ipcRenderer.invoke('host-result', { winner }),   // 🏁 승리팀 직접 기록
  // 🗳️ 투표
  voteCast: (mvpPick, mannerPick) => ipcRenderer.invoke('vote-cast', { mvpPick, mannerPick }),
  voteClear: () => ipcRenderer.invoke('vote-clear'),
  voteClose: () => ipcRenderer.invoke('vote-close'),
  // 📊 오늘 기록
  getToday: (day) => ipcRenderer.invoke('today-data', { day }),
  // 👤 개인 내전 프로필 — arg: {me:true} | {puuid} | {name}
  getProfile: (arg) => ipcRenderer.invoke('profile', arg),
  getAugments: () => ipcRenderer.invoke('augments'),
  getAugGuide: () => ipcRenderer.invoke('augguide'),                       // 🧭 챔피언 선택 화면 증강 가이드(내 챔피언+벤치)
  onAugGuide: (cb) => ipcRenderer.on('augguide', (_e, d) => cb(d)),
  getAugGG: (champId) => ipcRenderer.invoke('augguide-gg', champId),         // 🧭 v0.1.100: 그 챔피언 가이드(aramgg 합친 것 · 편집 시작용)
  getAugGuideAll: () => ipcRenderer.invoke('augguide-all'),                // 🧭 편집용 전체(카테고리·챔피언·증강·우리 기록에 나온 증강)
  saveAugGuide: (champId, guide, baseAt, sum) => ipcRenderer.invoke('augguide-save', { champId, guide, baseAt, sum }),   // ✍️ baseAt = 편집 시작 때 버전(남이 먼저 고쳤으면 충돌 알림) · sum = 무엇을 바꿨는지
  getAugGuideHist: (champId) => ipcRenderer.invoke('augguide-hist', champId),            // ✍️ 그 챔피언 고친 기록
  getAugGuideRecent: () => ipcRenderer.invoke('augguide-recent'),                        // ✍️ 최근 고친 것(모든 챔피언)
  restoreAugGuide: (champId, k, which) => ipcRenderer.invoke('augguide-restore', { champId, k, which }),   // ✍️ 되돌리기
  getAugPatches: () => ipcRenderer.invoke('aug-patches'),                   // 📰 v0.1.144 패치 노트
  getAugLab: () => ipcRenderer.invoke('auglab-pool'),   // 🧪 증강 연구(뽑을 증강 목록)
  auglabOpen: () => ipcRenderer.send('auglab-open'),    // 🧪 v0.1.175 가운데 창 열기(이미 떠 있으면 새 판)
  auglabClose: () => ipcRenderer.send('auglab-close'),
  auglabDone: (r) => ipcRenderer.send('auglab-done', r),   // 한 판 결과 → 오른쪽 창 「연구」 탭
  onAuglabStart: (cb) => ipcRenderer.on('auglab-start', () => cb()),
  onAuglabResult: (cb) => ipcRenderer.on('auglab-result', (_e, d) => cb(d)),
  openAugLink: (url) => ipcRenderer.send('augguide-link', url),   // 🧭 플랜 원문(arammayhem) 기본 브라우저로   // 🧩 증강 번호 → {name, icon, rarity}(최신 패치 데이터)
  // 📼 게임 끝난 뒤 기록 저장 진행 상태 {stage:'get'|'save'|'rec'|'done', since, src, tries, max, problem}
  onRec: (cb) => ipcRenderer.on('rec', (_e, d) => cb(d)),
  getRec: () => ipcRenderer.invoke('rec-state'),
  openProfile: (arg) => ipcRenderer.send('open-profile', arg),
  onOpenProfile: (cb) => ipcRenderer.on('open-profile', (_e, d) => cb(d)),
  // 🎬 팟지 — 가운데 창 {card, manual} · 영상 받기 → {url} · 저장 · 닫기 · 결과 화면에서 다시 보기
  onPotg: (cb) => ipcRenderer.on('potg', (_e, d) => cb(d)),
  potgClip: (meta) => ipcRenderer.invoke('potg-clip', meta),
  potgSave: (meta, name, hero) => ipcRenderer.invoke('potg-save', { meta, name, hero: !!hero }),
  potgClose: () => ipcRenderer.send('potg-close'),
  onPotgWait: (cb) => ipcRenderer.on('potg-wait', (_e, d) => cb(d)),           // ⏳ 팟지 기다림 화면
  onPotgWaitProg: (cb) => ipcRenderer.on('potg-wait-prog', (_e, d) => cb(d)),
  potgGuess: (i) => ipcRenderer.send('potg-guess', i),                          // 🔮 팟지 예측
  potgCancel: () => ipcRenderer.send('potg-cancel'),                            // 🚫 팟지 건너뛰기(녹화하는 사람만 · v0.1.118)
  potgReplay: () => ipcRenderer.send('potg-replay'),
  potgOpen: (card) => ipcRenderer.send('potg-open', card),   // 🎮 「오늘」 탭 일반 판 팟지
});
