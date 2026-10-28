// ── 내장 브릿지 (투데이 내전) ─────────────────────────────────────────────
// 롤 클라이언트(LCU)에 직접 붙어 게임 페이즈·EOG 통계(KDA·딜량·골드·증강·멀티킬)를 캡처해
// **today/bridge/*** 에만 기록한다. 사이트(시즌2)가 읽는 bridge/* · normal_matches/* 는 절대 건드리지 않음
// → 투데이 내전 경기는 사이트 LP·골드·전적에 반영되지 않는다(완전 분리).
// aram-overlay bridge.js에서 이식: 일반게임(비커스텀) 기록·voteStarted 신호 제거, 경로만 today/ 아래로.

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { EventEmitter } = require('events');
const { execFile }     = require('child_process');

const FIREBASE_URL      = 'https://aramchaos-ca022-default-rtdb.asia-southeast1.firebasedatabase.app';
const BRIDGE_ROOT       = 'today/bridge';   // ⚠️ 사이트 bridge/ 와 분리(시즌2 데이터 오염 방지)

// 주입 옵션(startBridge에서 세팅)
let _log        = () => {};
let _getOpName  = () => null;   // 진행자 이름 = 오버레이 config.myName
let _appVer     = '';           // 오버레이 앱 버전(정보용)
let _onAccount  = () => {};     // 👤 롤에 로그인된 라이엇 계정 변경 알림({puuid,gameName,tagLine} | null)
let _onEog      = () => {};     // 📼 게임 결과 수집 단계 알림 → 왼쪽 창 「기록 저장 중」 화면
let _fakeLcu    = null;         // 🧪 개발용 "port:password"(TN_FAKE_LCU) — lockfile 대신 이 주소로 붙음
let _isHost     = () => false;  // 👑 이 PC가 방장인지(리플레이 확인에서 실제 다운로드는 방장만)
let _lolDir     = null;         // 롤 설치 폴더(lockfile 있는 곳) — Config/game.cfg 확인용

function log(msg) { try { _log('[bridge] ' + msg); } catch (_) {} }

// ── Node https 헬퍼 (axios 대체) ────────────────────────────────────────────
// LCU(127.0.0.1)·라이브클라(2999)는 자체서명 인증서라 무시. Firebase는 정상 검증.
function httpReq(method, url, body, extraHeaders) {
  return new Promise(resolve => {
    let u; try { u = new URL(url); } catch (_) { return resolve({ status: 0, data: null, etag: null }); }
    const payload = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const headers = Object.assign({}, extraHeaders || {});
    if (payload != null) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
    const req = https.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method,
      rejectUnauthorized: !(u.hostname === '127.0.0.1'),   // 로컬(LCU/2999)만 자체서명 무시
      headers, timeout: 6000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (_) {} resolve({ status: res.statusCode, data: j, etag: res.headers.etag || null }); });
    });
    req.on('error', () => resolve({ status: 0, data: null, etag: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null, etag: null }); });
    if (payload != null) req.write(payload);
    req.end();
  });
}

// ── Firebase (인증 없는 PUT/GET — 실브릿지와 동일) ───────────────────────────
let fbOk = null, fbErrorLogged = false;
async function fbSet(p, data) {
  const r = await httpReq('PUT', `${FIREBASE_URL}/${p}.json`, typeof data === 'string' ? JSON.stringify(data) : data);   // 문자열도 JSON으로(안 하면 HTTP 400 — gamePhase가 계속 실패했음)
  if (r.status >= 200 && r.status < 300) { fbOk = true; fbErrorLogged = false; return true; }
  fbOk = false;
  if (!fbErrorLogged) { log(`⚠️ Firebase 쓰기 실패(${p} · HTTP ${r.status})`); fbErrorLogged = true; }
  return false;
}
async function fbGet(p) {
  const r = await httpReq('GET', `${FIREBASE_URL}/${p}.json`);
  return r.data;
}
// ETag 기반 조건부 GET/PUT — 다른 브릿지/오버레이 동시 실행 시 atomic CAS(중복 EOG 저장 차단)
async function fbGetWithEtag(p) {
  const r = await httpReq('GET', `${FIREBASE_URL}/${p}.json`, undefined, { 'X-Firebase-ETag': 'true' });
  return { data: r.data, etag: r.etag };
}
async function fbSetIfMatch(p, data, etag) {
  const r = await httpReq('PUT', `${FIREBASE_URL}/${p}.json`, data === null ? null : data, { 'if-match': etag || 'null_etag' });
  if (r.status === 412) return { ok: false, conflict: true };
  if (r.status >= 200 && r.status < 300) { fbOk = true; return { ok: true }; }
  throw new Error('fb ' + r.status);
}

// ── 라이브 클라이언트 데이터(2999) — 진행 중 실제 참가자 명단 ────────────────
async function liveGamePlayerNames() {
  const r = await httpReq('GET', 'https://127.0.0.1:2999/liveclientdata/playerlist');
  const list = Array.isArray(r.data) ? r.data : [];
  return list.filter(p => !p.isBot)
    .map(p => String(p.riotIdGameName || p.summonerName || (typeof p.riotId === 'string' ? p.riotId.split('#')[0] : '') || '').trim())
    .filter(Boolean);
}

// ── lockfile 기반 LCU 커넥터 (aram-bridge와 동일) ────────────────────────────
class LockfileConnector extends EventEmitter {
  constructor() { super(); this._connected = false; this._timer = null; this._curPort = null; this._psAt = 0; this._busy = false; }
  start() { this._poll(); this._timer = setInterval(() => this._poll(), 3000); }
  stop()  { if (this._timer) { clearInterval(this._timer); this._timer = null; } }
  // ⚠️ Electron 메인 프로세스라 blocking(execSync) 금지 — PowerShell 폴백은 async(execFile)로, 자주 안 뜨게 15초 스로틀.
  _findLockfile() {
    return new Promise(resolve => {
      const candidates = [
        'C:\\Riot Games\\League of Legends\\lockfile',
        'D:\\Riot Games\\League of Legends\\lockfile',
        path.join(process.env.LOCALAPPDATA || '', '..\\Local\\Riot Games\\League of Legends\\lockfile'),
      ];
      for (const p of candidates) { try { if (fs.existsSync(p)) return resolve(p); } catch (_) {} }
      if (Date.now() - this._psAt < 15000) return resolve(null);   // 비표준 설치 폴백은 15초에 한 번만
      this._psAt = Date.now();
      execFile('powershell',
        ['-NoProfile', '-NonInteractive', '-Command', "try{(Get-Process LeagueClientUx -EA Stop)[0].Path}catch{''}"],
        { timeout: 4000, windowsHide: true, encoding: 'utf8' },
        (err, stdout) => {
          const out = (!err && stdout) ? String(stdout).trim() : '';
          if (out) { const lf = path.join(path.dirname(out), 'lockfile'); try { if (fs.existsSync(lf)) return resolve(lf); } catch (_) {} }
          resolve(null);
        });
    });
  }
  async _poll() {
    if (_fakeLcu) {   // 🧪 개발용 가짜 LCU
      if (!this._connected) { const [port, password] = _fakeLcu.split(':'); this._connected = true; this._curPort = port; this.emit('connect', { username: 'riot', password, port, protocol: 'https' }); }
      return;
    }
    if (this._busy) return;   // 이전 폴 진행 중이면 겹치지 않게
    this._busy = true;
    let lfPath = null;
    try { lfPath = await this._findLockfile(); } catch (_) {}
    this._busy = false;
    if (lfPath) {
      try {
        const [, , port, password, protocol] = fs.readFileSync(lfPath, 'utf8').trim().split(':');
        if (port && password) {
          if (this._connected && this._curPort !== port) {   // 롤 재시작 → 새 port 로 재연결
            this._connected = false; this._curPort = null; this.emit('disconnect');
          }
          if (!this._connected) {
            this._connected = true; this._curPort = port; _lolDir = path.dirname(lfPath);
            this.emit('connect', { username: 'riot', password, port, protocol: protocol || 'https' });
          }
        }
        return;
      } catch (_) {}
    }
    if (this._connected) { this._connected = false; this._curPort = null; this.emit('disconnect'); }
  }
  forceReset() { if (this._connected) { this._connected = false; this._curPort = null; this.emit('disconnect'); } }
}

// ── 진행자 식별 (오버레이 config.myName + PC별 안정 ID) ──────────────────────
function _stableOperatorId() {
  const seed = (os.hostname() || 'host') + '|' + ((os.userInfo && os.userInfo().username) || '');
  let h = 0; for (let i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) | 0; }
  return 'op_' + (h >>> 0).toString(36);
}
const OPERATOR_ID = _stableOperatorId();
function _operatorPayload() {
  return { name: _getOpName() || null, at: Date.now(), app: 'today', appVer: _appVer || null };
}

// ── 상태 변수 ────────────────────────────────────────────────────────────────
const connector = new LockfileConnector();
let basePort = null, baseAuth = null;   // LCU 접속(포트 + Basic 인증 헤더)
let lastPhase = null, pollTimer = null, heartbeatTimer = null;
let activeIsCustom = null, eogSaved = false, gameInProgress = false, activeGameId = null;
let _eogBusy = false, eogTimer = null, _missedGame = null, _endedEmitted = false;   // ⚡ 정산 화면 빠른 감시 · 클라를 꺼서 못 잡은 판(다음 연결 때 전적에서 복구)
let inGamePlayersFilled = false, _lastSess = null, _lastPickNames = [], lastSavedGameId = null;
let _running = false, _pollFailCount = 0;

// ── LCU 요청(Basic 인증) ─────────────────────────────────────────────────────
async function lcu(pathStr) {
  if (!basePort) throw new Error('no lcu');
  const r = await httpReq('GET', `https://127.0.0.1:${basePort}${pathStr}`, undefined, { Authorization: baseAuth });
  if (r.status >= 200 && r.status < 300) return r.data;
  throw new Error('lcu ' + r.status);
}
// 상태 코드까지 그대로 돌려줌(리플레이 확인 기록용)
async function lcuRaw(method, pathStr, body) {
  if (!basePort) return { status: 0, data: null };
  return httpReq(method, `https://127.0.0.1:${basePort}${pathStr}`, body, { Authorization: baseAuth });
}

// ── 하트비트(프로세스 생존 신호 + 진행자 표시) ────────────────────────────────
function startHeartbeat() {
  if (heartbeatTimer) return;
  const beat = () => {
    fbSet(`${BRIDGE_ROOT}/operators/${OPERATOR_ID}`, _operatorPayload());  // 다중 진행자 표시
  };
  beat();
  heartbeatTimer = setInterval(beat, 5000);
}

// ── 챔피언 선택 수집 (EOG 이름 보완용) ───────────────────────────────────────
async function handleChampSelect() {
  try {
    const session = await lcu('/lol-champ-select/v1/session');
    const mapPlayer = p => ({
      cellId: p.cellId, champId: p.championId,
      name: p.riotIdGameName || p.summonerName || '',
      position: p.assignedPosition || '', rerolls: p.allowedRerolls ?? 2, isSelf: !!p.isSelf,
    });
    await fbSet(`${BRIDGE_ROOT}/champSelect`, {
      myTeam: (session.myTeam || []).map(mapPlayer),
      theirTeam: (session.theirTeam || []).map(mapPlayer),
      benchChampions: (session.benchChampions || []).map(c => ({ champId: c.championId })),
      timerPhase: session.timer?.phase || '', updatedAt: Date.now(),
    });
  } catch (_) {}
}

// ── 게임 종료 통계 수집 (핵심 — KDA·딜량·골드·증강·멀티킬) ─────────────────────
async function handleEndOfGame(abnormal = false) {
  if (eogSaved || _eogBusy) return;
  _eogBusy = true;   // 1초 감시·3초 폴링이 겹쳐 두 번 저장하지 않게
  try {
    const eog = await lcu('/lol-end-of-game/v1/eog-stats-block');
    if (!eog?.teams) return;
    const currentGameId = eog.gameId || null;
    if (currentGameId && currentGameId === lastSavedGameId) return;   // 직전 게임 재캡처 차단
    if (activeGameId && currentGameId && String(currentGameId) !== String(activeGameId)) return;   // 이번 게임 블록만(클라가 이전 게임 결과를 들고 있을 수 있음)

    const winTeam = eog.teams.find(t => t.isWinningTeam);
    const winSide = winTeam?.teamId === 100 ? 'blue' : 'red';

    let champPickNames = {};
    try { champPickNames = (await fbGet(`${BRIDGE_ROOT}/lastChampPicks`)) || {}; } catch (_) {}

    const players = [];
    for (const team of eog.teams) {
      for (const p of (team.players || [])) {
        const s = p.stats || {};
        players.push({
          summonerName: p.riotIdGameName || p.summonerName || champPickNames[p.championId] || '',
          puuid:        p.puuid || null,   // 👤 계정 고유 ID — 투데이 내전은 이걸로 1팀/2팀 판정
          championId:   p.championId,
          championName: p.championName || p.skinName || '',
          kills:   s.CHAMPIONS_KILLED || 0,
          deaths:  s.NUM_DEATHS || 0,
          assists: s.ASSISTS || 0,
          damage:  s.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS || 0,
          gold:    s.GOLD_EARNED || 0,
          cs:      (s.MINIONS_KILLED || 0) + (s.NEUTRAL_MINIONS_KILLED || 0),
          teamId:  team.teamId,
          isWin:   !!team.isWinningTeam,
          items:   [s.ITEM0, s.ITEM1, s.ITEM2, s.ITEM3, s.ITEM4, s.ITEM5].filter(i => i > 0),
          augments: Object.keys(s).filter(k => /^PLAYER_AUGMENT_\d+$/.test(k))
            .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0])).map(k => s[k]).filter(i => i > 0),
          doubleKills: s.DOUBLE_KILLS || 0, tripleKills: s.TRIPLE_KILLS || 0,
          quadraKills: s.QUADRA_KILLS || 0, pentaKills: s.PENTA_KILLS || 0,
          firstBlood: (s.FIRST_BLOOD_KILL || 0) === 1,
        });
      }
    }

    // 🎮 일반게임(비커스텀)은 투데이 내전 기록이 아님 → 저장하지 않음(사이트 normal_matches 에도 안 씀)
    if (activeIsCustom === false) { eogSaved = true; if (currentGameId) lastSavedGameId = currentGameId; log('🎮 일반게임 — 기록 안 함'); emitEog('skip', currentGameId); return; }

    // ⚡ LCU에서 받은 즉시 메모리에 확보 → 그다음 서버에 씀(정산 화면을 바로 나가도 이미 손에 있음)
    eogSaved = true; lastSavedGameId = currentGameId; stopEogWatch();
    emitEog('captured', currentGameId, { src: '정산 화면' });
    await saveEog({ players, winSide, gameId: eog.gameId || null, gameTime: eog.gameLength || 0, savedAt: Date.now() }, '정산 화면');
  } catch (_) {} finally { _eogBusy = false; }
}
// 내전 EOG 저장 — ETag 조건부 PUT(다른 PC의 브릿지가 먼저 썼으면 건너뜀)
function emitEog(stage, gameId, extra) { try { _onEog(Object.assign({ stage, gameId: gameId || null, at: Date.now() }, extra || {})); } catch (_) {} }
async function saveEog(payload, src) {
  let etag = null;
  try {
    const { data: existing, etag: e } = await fbGetWithEtag(`${BRIDGE_ROOT}/eogStats`);
    etag = e;
    if (existing && payload.gameId && String(existing.gameId) === String(payload.gameId)) { log('같은 게임 이미 저장됨 — 건너뜀'); emitEog('saved', payload.gameId, { src: '다른 PC' }); return true; }
  } catch (_) {}
  let w;
  try { w = await fbSetIfMatch(`${BRIDGE_ROOT}/eogStats`, payload, etag); }
  catch (e) { log('⚠️ EOG 저장 실패 — 일반 PUT 폴백'); w = { ok: await fbSet(`${BRIDGE_ROOT}/eogStats`, payload) }; }
  if (w && w.conflict) { log('다른 PC가 먼저 저장 — 건너뜀'); emitEog('saved', payload.gameId, { src: '다른 PC' }); return true; }
  if (w && w.ok) { log(`게임 결과 저장 ✅ (${src}) 승리 진영: ${payload.winSide}`); emitEog('saved', payload.gameId, { src }); }
  else emitEog('retry', payload.gameId, { src });
  return !!(w && w.ok);
}

// ⚡ 게임 중엔 1초마다 정산 결과가 나왔는지 확인 — 3초 폴링 사이에 정산 화면을 나가 버려도 놓치지 않게
function startEogWatch() {
  if (eogTimer) return;
  eogTimer = setInterval(() => {
    if (!basePort || !gameInProgress || eogSaved) { stopEogWatch(); return; }
    if (activeGameId) handleEndOfGame(false);   // 이번 게임 ID를 알 때만(이전 게임 결과를 잘못 잡지 않게)
  }, 1000);
}
function stopEogWatch() { if (eogTimer) { clearInterval(eogTimer); eogTimer = null; } }

// 🛟 정산 화면을 끝내 못 잡았으면 롤 클라 「전적(매치 기록)」에서 그 판을 찾아 복구 — 5초 간격 최대 3분
const _histPending = new Set();
let _champNames = null;
async function champNames() {
  if (_champNames) return _champNames;
  try { const list = await lcu('/lol-game-data/assets/v1/champion-summary.json'); _champNames = {}; for (const c of list || []) if (c && c.id > 0) _champNames[c.id] = c.name; } catch (_) {}
  return _champNames || {};
}
function scheduleHistoryBackfill(gameId) {
  if (!gameId || _histPending.has(String(gameId))) return;
  _histPending.add(String(gameId));
  log(`⚠️ 정산 화면을 못 잡음 — 전적에서 게임 ${gameId} 결과를 가져오는 중`);
  let tries = 0;
  emitEog('history', gameId, { tries: 0, max: 36 });
  const tick = async () => {
    tries++;
    if (!basePort) { _histPending.delete(String(gameId)); _missedGame = { gameId, custom: true }; emitEog('closed', gameId); return; }   // 클라 꺼짐 → 다음 연결 때 다시
    if (tries > 36) { _histPending.delete(String(gameId)); log('전적에서도 못 찾음 — 방장이 승리팀을 직접 고르세요'); emitEog('missed', gameId); return; }
    emitEog('history', gameId, { tries, max: 36 });
    try {
      const cur = await fbGet(`${BRIDGE_ROOT}/eogStats`);
      if (cur && String(cur.gameId) === String(gameId)) { _histPending.delete(String(gameId)); log('다른 PC가 이미 저장 — 복구 불필요'); emitEog('saved', gameId, { src: '다른 PC' }); return; }
      const g = await lcu(`/lol-match-history/v1/games/${gameId}`);
      if (g && Array.isArray(g.participants) && g.participants.length) {
        if (g.gameType && g.gameType !== 'CUSTOM_GAME') { _histPending.delete(String(gameId)); log('🎮 일반게임 — 기록 안 함'); emitEog('skip', gameId); return; }
        emitEog('captured', gameId, { src: '전적' });
        if (await saveEog(await historyToEog(g), '전적에서 복구')) { _histPending.delete(String(gameId)); return; }
      }
    } catch (_) {}
    setTimeout(tick, 5000);
  };
  setTimeout(tick, 3000);
}
// 🎬 리플레이 확인(v0.1.29 · 팟지 준비) — 내전이 끝나면 「이 판 리플레이를 받아서 볼 수 있나」를 조용히 확인해 서버에 남김
// 화면엔 아무것도 안 띄움. 모든 참가자 앱 = 리플레이 상태만 10초마다 기록 · 방장 앱만 실제로 한 번 받아 파일이 생기는지까지 확인
// 기록: today/bridge/replayProbe/{gameId}/{PC id} = { name, appVer, host, cfg, config, steps:[{t,state}], create, download, file, result }
// t = 게임 끝나고 몇 초 뒤인지. 커스텀 게임 리플레이 지원 여부·준비 시간·리플레이 조작 창구(game.cfg EnableReplayApi) 설정 여부를 실제 게임에서 확인하려는 것
const _probed = new Set();
const REPLAY_DONE = ['watch', 'missingOrExpired', 'unsupported', 'incompatible', 'error'];
function startReplayProbe(gameId) {
  if (!gameId || _probed.has(String(gameId))) return;
  _probed.add(String(gameId));
  const t0 = Date.now(), sec = () => Math.round((Date.now() - t0) / 1000);
  const rec = { name: _getOpName() || '', appVer: _appVer, host: !!_isHost(), at: t0, steps: [], result: 'checking' };
  const key = `${BRIDGE_ROOT}/replayProbe/${gameId}/${OPERATOR_ID}`;
  const save = () => fbSet(key, rec).catch(() => {});
  let tries = 0, created = false, asked = false, last = null;
  log(`🎬 게임 ${gameId} 리플레이 확인 시작`);
  (async () => {
    try {   // 리플레이 조작 창구 설정(읽기만) · 클라 리플레이 설정
      if (_lolDir) { const cfg = fs.readFileSync(path.join(_lolDir, 'Config', 'game.cfg'), 'utf8'); const m = cfg.match(/EnableReplayApis*=s*(S+)/i); rec.cfg = m ? m[1] : 'none'; }
    } catch (_) { rec.cfg = 'unreadable'; }
    const c = await lcuRaw('GET', '/lol-replays/v1/configuration');
    rec.config = c.status === 200 && c.data ? { enabled: c.data.isReplaysEnabled, patching: c.data.isPatching, forEnd: c.data.isReplaysForEndOfGameEnabled, forHistory: c.data.isReplaysForMatchHistoryEnabled, minVer: c.data.minServerVersion || null } : { status: c.status };
    save();
  })();
  const tick = async () => {
    tries++;
    if (!basePort || tries > 90) { rec.result = rec.result === 'checking' ? (basePort ? 'timeout' : 'client-closed') : rec.result; save(); return; }   // 최대 15분
    const m = await lcuRaw('GET', `/lol-replays/v1/metadata/${gameId}`);
    const state = m.status === 200 && m.data ? String(m.data.state || 'unknown') : 'http' + m.status;
    if (state !== last) { last = state; rec.steps.push({ t: sec(), state }); log(`🎬 리플레이 상태: ${state} (${sec()}초)`); save(); }
    if (!created && (m.status === 404 || state === 'unknown' || state === 'checking') && tries >= 2) {   // 전적 화면이 하듯 정보 만들기 요청
      created = true;
      try {
        const g = await lcu(`/lol-match-history/v1/games/${gameId}`);
        const r = await lcuRaw('POST', `/lol-replays/v1/metadata/${gameId}/create/gameVersion/${encodeURIComponent(g.gameVersion || '')}/gameType/${encodeURIComponent(g.gameType || '')}/queueId/${g.queueId || 0}`, {});
        rec.create = { t: sec(), status: r.status, gameType: g.gameType || null, queueId: g.queueId == null ? null : g.queueId, ver: g.gameVersion || null };
      } catch (_) { rec.create = { t: sec(), status: 'no-history' }; created = false; }
      save();
    }
    if (state === 'download' && !asked && _isHost()) {   // 방장 PC만 실제로 받아 봄(시간당 10개 제한·디스크)
      asked = true;
      const r = await lcuRaw('POST', `/lol-replays/v1/rofls/${gameId}/download/graceful`, { componentType: 'replay-button_match-history' });
      rec.download = { t: sec(), status: r.status };
      save();
    }
    if (state === 'watch') {   // 받아짐 → 파일 확인
      try {
        const p = await lcu('/lol-replays/v1/rofls/path');
        const f = fs.readdirSync(p).find(n => n.includes(String(gameId)) && n.endsWith('.rofl'));
        rec.file = f ? { name: f, mb: +(fs.statSync(path.join(p, f)).size / 1048576).toFixed(1) } : { missing: true };
      } catch (_) { rec.file = { error: true }; }
    }
    if (REPLAY_DONE.includes(state) || (state === 'download' && !_isHost() && tries >= 3)) {   // 끝(방장 아니면 「받을 수 있음」 확인까지만)
      rec.result = state === 'watch' || state === 'download' ? 'ok-' + state : state; rec.done = sec();
      log(`🎬 리플레이 확인 끝: ${rec.result}`); save(); return;
    }
    setTimeout(tick, 10000);
  };
  setTimeout(tick, 5000);
}
async function historyToEog(g) {
  const names = await champNames();
  const who = {}; for (const pi of g.participantIdentities || []) who[pi.participantId] = pi.player || {};
  const players = g.participants.map(p => {
    const s = p.stats || {}, pl = who[p.participantId] || {};
    return {
      summonerName: pl.gameName || pl.summonerName || '', puuid: pl.puuid || null,
      championId: p.championId, championName: names[p.championId] || '',
      kills: s.kills || 0, deaths: s.deaths || 0, assists: s.assists || 0,
      damage: s.totalDamageDealtToChampions || 0, gold: s.goldEarned || 0, cs: (s.totalMinionsKilled || 0) + (s.neutralMinionsKilled || 0),
      teamId: p.teamId, isWin: !!s.win,
      items: [s.item0, s.item1, s.item2, s.item3, s.item4, s.item5].filter(i => i > 0),
      augments: [s.playerAugment1, s.playerAugment2, s.playerAugment3, s.playerAugment4, s.playerAugment5, s.playerAugment6].filter(i => i > 0),
      doubleKills: s.doubleKills || 0, tripleKills: s.tripleKills || 0, quadraKills: s.quadraKills || 0, pentaKills: s.pentaKills || 0,
      firstBlood: !!s.firstBloodKill,
    };
  });
  const win = players.find(p => p.isWin) || (() => { const t = (g.teams || []).find(t => t.win === 'Win'); return t ? { teamId: t.teamId } : null; })();
  return { players, winSide: win ? (win.teamId === 100 ? 'blue' : 'red') : null, gameId: g.gameId, gameTime: g.gameDuration || 0, savedAt: Date.now(), source: 'history' };
}

// ── 진행 중 참가자 명단 (Live Client 1순위 → champSelect → gameflow) ──────────
async function updateInGamePlayers(initial = false) {
  if (!gameInProgress || inGamePlayersFilled) return;
  const live = await liveGamePlayerNames();
  if (live.length) {
    await fbSet(`${BRIDGE_ROOT}/inGame`, { isCustom: activeIsCustom, players: live, at: Date.now() });
    inGamePlayersFilled = true; log(`🎮 진행 중 명단 ${live.length}명 (liveclient)`); return;
  }
  if (!initial) return;
  let names = [], src = 'none';
  if (_lastPickNames.length) { names = _lastPickNames.slice(); src = 'champSelect'; }
  else if (_lastSess) {
    try {
      const teams = [ ...((_lastSess?.gameData?.teamOne) || []), ...((_lastSess?.gameData?.teamTwo) || []) ];
      names = teams.map(p => String(p.summonerName || p.gameName || (typeof p.riotId === 'string' ? p.riotId.split('#')[0] : '') || '').trim()).filter(Boolean);
      src = 'gameflow';
    } catch (_) {}
  }
  await fbSet(`${BRIDGE_ROOT}/inGame`, { isCustom: activeIsCustom, players: names, at: Date.now() });
  if (names.length) log(`🎮 진행 중 명단(임시) ${names.length}명 (${src})`);
}

// ── 게임 페이즈 폴링 (3초) ───────────────────────────────────────────────────
async function poll() {
  if (!basePort) return;
  try {
    const phase = await lcu('/lol-gameflow/v1/gameflow-phase');
    _pollFailCount = 0;
    if (phase !== lastPhase) {
      log(`페이즈: ${lastPhase ?? '-'} → ${phase}`);
      lastPhase = phase;
      if (phase === 'GameStart' || phase === 'InProgress') _endedEmitted = false;
      else if (gameInProgress && phase !== 'Reconnect' && !_endedEmitted) { _endedEmitted = true; emitEog('ended', activeGameId); if (activeIsCustom !== false) startReplayProbe(activeGameId); }   // 📼 게임 끝남 → 「기록 저장 중」 시작
      if (phase !== 'GameStart' && phase !== 'InProgress') { inGamePlayersFilled = false; fbSet(`${BRIDGE_ROOT}/inGame`, null); }
      switch (phase) {
        case 'ChampSelect':
          await fbSet(`${BRIDGE_ROOT}/gamePhase`, 'ChampSelect'); break;
        case 'GameStart':
        case 'InProgress':
          gameInProgress = true; inGamePlayersFilled = false; _lastPickNames = [];
          try {
            const _sess = await lcu('/lol-gameflow/v1/session');
            if (_sess?.gameData?.gameId) activeGameId = _sess.gameData.gameId;
            if (_sess?.gameData) activeIsCustom = !!_sess.gameData.isCustomGame;
            _lastSess = _sess;
          } catch (_) {}
          await fbSet(`${BRIDGE_ROOT}/gamePhase`, 'InProgress');
          try {
            const picks = await fbGet(`${BRIDGE_ROOT}/champSelect`);
            if (picks) {
              const pickMap = {};
              for (const p of [...(picks.myTeam || []), ...(picks.theirTeam || [])]) { if (p.champId && p.name) pickMap[p.champId] = p.name; }
              if (Object.keys(pickMap).length) { await fbSet(`${BRIDGE_ROOT}/lastChampPicks`, pickMap); _lastPickNames = Object.values(pickMap).filter(Boolean); }
            }
          } catch (_) {}
          await fbSet(`${BRIDGE_ROOT}/champSelect`, null);
          await updateInGamePlayers(true);
          startEogWatch();
          break;
        case 'PreEndOfGame':
        case 'WaitingForStats':
        case 'EndOfGame':
          await fbSet(`${BRIDGE_ROOT}/gamePhase`, 'EndOfGame'); await handleEndOfGame(); break;
        case 'Reconnect':
          await fbSet(`${BRIDGE_ROOT}/gamePhase`, gameInProgress ? 'EndOfGame' : 'Reconnect');
          if (gameInProgress && !eogSaved) await handleEndOfGame(true); break;
        case 'None': case 'Lobby': case 'Matchmaking': case 'ReadyCheck':
          if (gameInProgress && !eogSaved && (phase === 'None' || phase === 'Lobby')) {
            await handleEndOfGame(true);
            if (!eogSaved && activeGameId && activeIsCustom !== false) scheduleHistoryBackfill(activeGameId);   // 🛟 정산 화면을 바로 나감 → 전적에서
          }
          await fbSet(`${BRIDGE_ROOT}/gamePhase`, phase);
          await fbSet(`${BRIDGE_ROOT}/champSelect`, null);
          if (['None', 'Lobby'].includes(phase)) { eogSaved = false; gameInProgress = false; activeGameId = null; activeIsCustom = null; stopEogWatch(); }
          break;
      }
    }
    if (phase === 'ChampSelect') await handleChampSelect();
    if (gameInProgress && !eogSaved && ['EndOfGame', 'PreEndOfGame', 'WaitingForStats', 'Reconnect'].includes(phase))
      await handleEndOfGame(phase === 'Reconnect');
    if (gameInProgress && !inGamePlayersFilled && (phase === 'InProgress' || phase === 'GameStart'))
      await updateInGamePlayers(false);
  } catch (_) {
    _pollFailCount++;
    if (_pollFailCount >= 4) { _pollFailCount = 0; log('⚠️ LCU 응답 없음(연속) — 연결 재설정'); connector.forceReset(); }
  }
}

// ── 👤 현재 로그인 계정 감시 — 친구가 같은 PC에서 자기 계정으로 바꿔 로그인해도 바로 반영 ──
let _acctTimer = null, _acctKey = undefined;
async function pollAccount() {
  let acc = null;
  if (basePort) {
    try {
      const me = await lcu('/lol-summoner/v1/current-summoner');
      if (me && me.puuid) acc = { puuid: me.puuid, gameName: String(me.gameName || me.displayName || '').trim(), tagLine: String(me.tagLine || '').trim(), iconId: me.profileIconId || null };
    } catch (_) {}
  }
  const key = acc ? acc.puuid + '|' + acc.gameName + '|' + acc.tagLine + '|' + (acc.iconId || '') : null;
  if (key !== _acctKey) { _acctKey = key; try { _onAccount(acc); } catch (_) {} }
}

// ── LCU 연결 이벤트 ──────────────────────────────────────────────────────────
connector.on('connect', async data => {
  basePort = data.port;
  baseAuth = 'Basic ' + Buffer.from(`${data.username}:${data.password}`).toString('base64');
  log('롤 클라이언트 연결됨 ✅');
  try { const me = await lcu('/lol-summoner/v1/current-summoner'); log(`접속 계정: ${me.displayName || me.gameName || ''}`); } catch (_) {}
  pollAccount();
  if (!_acctTimer) _acctTimer = setInterval(pollAccount, 5000);   // 로그인 직후엔 계정이 늦게 잡힐 수 있어 5초마다 재확인
  await fbSet(`${BRIDGE_ROOT}/connected`, true);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 3000); poll();
  if (_missedGame) { const m = _missedGame; _missedGame = null; scheduleHistoryBackfill(m.gameId); }   // 🛟 게임 직후 클라를 꺼서 못 잡은 판
});
connector.on('disconnect', async () => {
  log('롤 클라이언트 종료 — 재연결 대기');
  if (gameInProgress && !eogSaved && activeGameId && activeIsCustom !== false) { _missedGame = { gameId: activeGameId }; emitEog('closed', activeGameId); log('⚠️ 결과 저장 전에 클라 종료 — 다음에 롤을 켜면 전적에서 가져옴(안 되면 방장이 승리팀 직접 선택)'); }
  stopEogWatch();
  basePort = null; baseAuth = null; lastPhase = null; eogSaved = false;
  pollAccount();   // 클라 종료 → 계정 없음
  gameInProgress = false; activeGameId = null; activeIsCustom = null;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  await fbSet(`${BRIDGE_ROOT}/connected`, false);
  await fbSet(`${BRIDGE_ROOT}/inGame`, null);
});

// ── 시작/종료 ────────────────────────────────────────────────────────────────
async function start(opts) {
  if (_running) return;
  _running = true;
  _log       = (opts && opts.log)            || (() => {});
  _getOpName = (opts && opts.getOperatorName) || (() => null);
  _appVer    = (opts && opts.appVer)          || '';
  _onAccount = (opts && opts.onAccount)       || (() => {});
  _fakeLcu   = (opts && opts.fakeLcu)         || null;
  _onEog     = (opts && opts.onEog)           || (() => {});
  _isHost    = (opts && opts.isHost)          || (() => false);
  log('내장 브릿지 시작 — LCU 감지 대기');
  startHeartbeat();
  connector.start();
}
// 종료 정리 — connected/operators/inGame 노드 정리(안 하면 홈페이지가 최대 120초간 "연결중" 표시). best-effort.
function stop() {
  if (!_running) return;
  _running = false;
  connector.stop();
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  stopEogWatch();
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (_acctTimer) { clearInterval(_acctTimer); _acctTimer = null; }
  fbSet(`${BRIDGE_ROOT}/connected`, false);
  fbSet(`${BRIDGE_ROOT}/inGame`, null);
  fbSet(`${BRIDGE_ROOT}/operators/${OPERATOR_ID}`, null);
}

module.exports = { start, stop };
