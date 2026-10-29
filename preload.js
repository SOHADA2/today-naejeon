// 렌더러(오버레이·오른쪽 패널·마커·토스트)에 안전한 API만 노출
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 📡 메인 → 렌더러 이벤트
  onPlayers: (cb) => ipcRenderer.on('players', (_e, d) => cb(d)),       // 인게임 명단(2999)
  onState: (cb) => ipcRenderer.on('state', (_e, d) => cb(d)),           // 게임 중 여부
  onSession: (cb) => ipcRenderer.on('session', (_e, d) => cb(d)),       // today/session(팀·투표·결과)
  onLobby: (cb) => ipcRenderer.on('lobby', (_e, d) => cb(d)),           // 🚪 대기실
  onMyName: (cb) => ipcRenderer.on('myname', (_e, n) => cb(n)),
  onDocked: (cb) => ipcRenderer.on('docked', (_e, v) => cb(v)),         // 🖥️ 클라 도킹 중이면 각진 모서리
  onSlotTeam: (cb) => ipcRenderer.on('slot-team', (_e, t) => cb(t)),    // 📍 클라 위 내 팀 마커(1/2)
  onRecToast: (cb) => ipcRenderer.on('rec-toast', (_e, d) => cb(d)),    // 🎬 팟지 녹화 중 안내(방장 PC)
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
  setSetting: (key, value) => ipcRenderer.invoke('settings-set', { key, value }),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, d) => cb(d)),
  quitApp: () => ipcRenderer.send('app-quit'),
  quitConfirm: (yes, noAsk) => ipcRenderer.send('quit-confirm', yes, !!noAsk),
  // 👤 입장(라이엇 계정 자동)
  getPlayers: () => ipcRenderer.invoke('get-players'),
  onAccount: (cb) => ipcRenderer.on('account', (_e, d) => cb(d)),   // 👤 롤 로그인 계정(자동 입장·계정 바뀌면 자동 전환)
  getRoster: () => ipcRenderer.invoke('roster-data'),                // 👥 지금 접속 중 + 오늘 뛴 사람
  setHost: (v) => ipcRenderer.invoke('set-host', v),                   // 👑 방장 하기/그만하기 → {ok, err}
  handHost: (puuid) => ipcRenderer.invoke('hand-host', { puuid }),       // 👑 방장 넘겨주기
  getHost: () => ipcRenderer.invoke('host-info'),
  onHost: (cb) => ipcRenderer.on('host', (_e, d) => cb(d)),             // 👑 지금 방장 {host:{name,alive,mine}, isHost, note}
  // ⚔️ 팀 짜기(방장)
  tbStart: (names, mode) => ipcRenderer.invoke('tb-start', { names, mode }),
  tbAgain: () => ipcRenderer.invoke('tb-again'),
  draftStart: (names, captains) => ipcRenderer.invoke('draft-start', { names, captains }),   // 🎯 드래프트(방장)
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
  lobbyReopen: () => ipcRenderer.invoke('lobby-reopen'),                    // 👑 지금 판 접고 대기실로
  lobbyUpdateReq: () => ipcRenderer.invoke('lobby-update-req'),             // 👑 옛 버전 앱들 업데이트 시키기
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
  getAugments: () => ipcRenderer.invoke('augments'),   // 🧩 증강 번호 → {name, icon, rarity}(최신 패치 데이터)
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
  potgReplay: () => ipcRenderer.send('potg-replay'),
  potgOpen: (card) => ipcRenderer.send('potg-open', card),   // 🎮 「오늘」 탭 일반 판 팟지
});
