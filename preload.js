// 렌더러(오버레이·오른쪽 패널·마커·토스트)에 안전한 API만 노출
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 📡 메인 → 렌더러 이벤트
  onPlayers: (cb) => ipcRenderer.on('players', (_e, d) => cb(d)),       // 인게임 명단(2999)
  onState: (cb) => ipcRenderer.on('state', (_e, d) => cb(d)),           // 게임 중 여부
  onSession: (cb) => ipcRenderer.on('session', (_e, d) => cb(d)),       // today/session(팀·투표·결과)
  onLobby: (cb) => ipcRenderer.on('lobby', (_e, d) => cb(d)),           // 방장 준비 중 배너
  onMyName: (cb) => ipcRenderer.on('myname', (_e, n) => cb(n)),
  onDocked: (cb) => ipcRenderer.on('docked', (_e, v) => cb(v)),         // 🖥️ 클라 도킹 중이면 각진 모서리
  onSlotTeam: (cb) => ipcRenderer.on('slot-team', (_e, t) => cb(t)),    // 📍 클라 위 내 팀 마커(1/2)
  onTeamBuild: (cb) => ipcRenderer.on('teambuild', (_e, d) => cb(d)),
  // 🪟 창
  sideClose: () => ipcRenderer.send('side-hide'),
  sideMinimize: () => ipcRenderer.send('side-min'),
  overlayMinimize: () => ipcRenderer.send('overlay-min'),
  hideOverlay: () => ipcRenderer.send('overlay-hide'),
  openWeb: () => ipcRenderer.send('open-web'),
  // 🔄 업데이트 토스트 · 🚪 클라 종료 확인창
  onUpdateInfo: (cb) => ipcRenderer.on('update-info', (_e, d) => cb(d)),
  updateNow: () => ipcRenderer.send('update-now'),
  updateLater: () => ipcRenderer.send('update-later'),
  quitConfirm: (yes) => ipcRenderer.send('quit-confirm', yes),
  // 👤 입장
  getPlayers: () => ipcRenderer.invoke('get-players'),
  setMyName: (n) => ipcRenderer.send('set-myname', n),
  setHost: (v) => ipcRenderer.send('set-host', v),
  // ⚔️ 팀 짜기(방장)
  tbStart: (names, mode) => ipcRenderer.invoke('tb-start', { names, mode }),
  tbAgain: () => ipcRenderer.invoke('tb-again'),
  lobbyPrep: (names) => ipcRenderer.send('lobby-prep', { names }),
  lobbyClear: () => ipcRenderer.send('lobby-clear'),
  hostResult: (winner) => ipcRenderer.invoke('host-result', { winner }),   // 🏁 승리팀 직접 기록
  // 🗳️ 투표
  voteCast: (mvpPick, mannerPick) => ipcRenderer.invoke('vote-cast', { mvpPick, mannerPick }),
  voteClear: () => ipcRenderer.invoke('vote-clear'),
  voteClose: () => ipcRenderer.invoke('vote-close'),
  // 📊 오늘 기록
  getToday: (day) => ipcRenderer.invoke('today-data', { day }),
});
