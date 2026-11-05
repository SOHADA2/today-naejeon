// ── 🎬 팟지 영상 = 리플레이 녹화(v0.1.33 · 방장 PC만) ─────────────────────────────
// 판이 끝나고 방장 앱이 팟지 장면을 고르면, 롤의 리플레이를 몰래 열어 그 장면만 롤 자체 녹화 기능으로 webm으로 뜬다.
//  ① game.cfg [General] EnableReplayApi=1 (리플레이 조작 창구 — 리플레이 게임이 켜질 때 읽음 · 처음 한 번 game.cfg.tn-backup 남김)
//  ② 리플레이 파일 준비: /lol-replays/v1/metadata/{gameId} 가 watch 될 때까지(download면 받기 요청)
//  ③ 리플레이 열기: POST /lol-replays/v1/rofls/{gameId}/watch → 리플레이 게임 창이 뜸(방장 화면에 잠깐 보임)
//  ④ 리플레이 창구(127.0.0.1:2999/replay/*) 열릴 때까지 기다림 → 카메라 = 팟지 주인공 따라가기 · 점수판/채팅/타임라인 숨김
//  ⑤ /replay/recording 으로 clipFrom~clipTo 녹화(롤이 직접 webm으로 저장 · 1배속 실제 시간으로)
//     ⚠️ v0.1.56: enforceFrameRate:true면 롤이 그리는 속도대로 게임 시간을 흘려(실측 ~2.6배속) 영상이 구간의 40~50% 길이 빨리감기가 됨
//        (10/28 내전 19초→9.5초·14초→7초, 10/29 일반 판 17초→6.9초) → 팟지 연출(킬 자막·슬로)이 게임 시간 기준이라 다 어긋났음 → false
//  ⑥ 리플레이 닫기(롤 상태가 리플레이 보는 중일 때만 게임 창 종료 — 실제 게임은 절대 안 건드림) → 파일 경로 돌려줌
// ⚠️ 실기 미확인: 녹화 파일이 path 폴더에 생기는지(아니면 문서/League of Legends/Highlights) · selectionName이 게임 이름인지 → 둘 다 찾음/시도
const fs = require('fs');
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const https = require('https');

const W = 768, H = 432, FPS = 30;   // 작게(서버 용량·팀원 내려받기) — 15초 ≈ 수 MB 예상

function makeReplayRec(d) {
  // d = { lcuRaw(method, path, body) → {status,data}, lolDir() → 롤 폴더|null, log, kill() → Promise, liveBase?, docsDir?, outDir,
  //       restoreFile?(바꾼 game.cfg 값 기억), hideWindow?() → {stop() → 숨긴 횟수, show()} }
  const log = m => { try { d.log('[replay] ' + m); } catch (_) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const base = d.liveBase || 'https://127.0.0.1:2999';
  const live = (method, p, body) => new Promise(resolve => {
    const u = new URL(base + p), payload = body == null ? null : JSON.stringify(body);
    const req = https.request({ hostname: u.hostname, port: u.port, path: u.pathname, method, rejectUnauthorized: false, timeout: 4000,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {} }, res => {
      let s = ''; res.setEncoding('utf8'); res.on('data', c => s += c); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (_) {} resolve({ status: res.statusCode, data: j }); });
    });
    req.on('error', () => resolve({ status: 0, data: null })); req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null }); });
    if (payload) req.write(payload); req.end();
  });

  // ① game.cfg [General] — EnableReplayApi=1(계속 둠) + 녹화하는 동안만 창 모드 1920×1080(v0.1.37: 화면 밖으로 숨기려면 창 모드여야 하고,
  //    방장 모니터가 달라도 늘 같은 크기·화질로 찍힘) → 끝나면 바꾼 값만 원래대로. 앱이 중간에 꺼져도 다음 실행 때 restorePending()이 되돌림
  const cfgPath = () => { const dir = d.lolDir && d.lolDir(); return dir ? path.join(dir, 'Config', 'game.cfg') : null; };
  function setGeneral(f, vals) {   // → 바꾸기 전 값({키: 값 또는 null=없던 줄})
    let s = ''; try { s = fs.readFileSync(f, 'utf8'); } catch (_) {}
    const eol = s.includes('\r\n') ? '\r\n' : '\n', before = {};
    try { if (s && !fs.existsSync(f + '.tn-backup')) fs.writeFileSync(f + '.tn-backup', s); } catch (_) {}
    if (!/^\[General\][ \t]*$/mi.test(s)) s = `[General]${eol}` + s;
    for (const [k, v] of Object.entries(vals)) {
      const re = new RegExp(`^[ \\t]*${k}[ \\t]*=(.*)$`, 'mi'), m = s.match(re);
      before[k] = m ? m[1].trim() : null;
      if (v == null) { if (m) s = s.replace(new RegExp(`^[ \\t]*${k}[ \\t]*=.*(\\r?\\n)?`, 'mi'), ''); }
      else if (m) s = s.replace(re, `${k}=${v}`);
      else s = s.replace(/^\[General\][ \t]*$/mi, h => h + eol + `${k}=${v}`);
    }
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, s);
    return before;
  }
  function ensureReplayApi() {
    const f = cfgPath(); if (!f) return 'no-dir';
    let s = ''; try { s = fs.readFileSync(f, 'utf8'); } catch (_) {}
    if (/^\s*EnableReplayApi\s*=\s*1\s*$/mi.test(s)) return 'already';
    setGeneral(f, { EnableReplayApi: 1 }); return 'set';
  }
  const WIN = { WindowMode: 1, Width: 1920, Height: 1080 };   // 1 = 창 모드
  function cfgForRecord() {
    const f = cfgPath(); if (!f) return null;
    const before = setGeneral(f, WIN);
    if (d.restoreFile) try { fs.writeFileSync(d.restoreFile, JSON.stringify({ f, before, at: Date.now() })); } catch (_) {}
    return { f, before };
  }
  function restoreCfg(r) {
    if (!r) { try { r = JSON.parse(fs.readFileSync(d.restoreFile, 'utf8')); } catch (_) { return 'none'; } }
    try {
      let s = fs.readFileSync(r.f, 'utf8'); const cur = {};
      for (const k of Object.keys(WIN)) { const m = s.match(new RegExp(`^[ \\t]*${k}[ \\t]*=(.*)$`, 'mi')); cur[k] = m ? m[1].trim() : null; }
      const back = {}; for (const k of Object.keys(WIN)) if (String(cur[k]) === String(WIN[k])) back[k] = r.before[k];   // 그새 사용자가 바꾼 값은 건드리지 않음
      setGeneral(r.f, back);
    } catch (_) {}
    try { if (d.restoreFile) fs.unlinkSync(d.restoreFile); } catch (_) {}
    return 'restored';
  }

  // 🖥️ 게임 중 정보 창(v0.1.77) — 챔피언 선택 때 「테두리 없는 창」(WindowMode=2)으로 바꿨다가 게임 끝나면 바꾼 값만 되돌림
  //   전체 화면(0)은 다른 창이 게임 위에 못 뜸 · 롤은 게임이 켜질 때 game.cfg를 읽음 · 해상도는 안 건드림 · 앱이 중간에 꺼져도 다음 실행 때 되돌림
  const BL = { WindowMode: 2 };
  function borderlessOn() {
    const f = cfgPath(); if (!f || !d.borderlessFile) return 'no-dir';
    if (fs.existsSync(d.borderlessFile)) return 'pending';   // 이미 바꿔 둠
    let s = ''; try { s = fs.readFileSync(f, 'utf8'); } catch (_) {}
    const m = s.match(/^[ \t]*WindowMode[ \t]*=(.*)$/mi);
    if (m && m[1].trim() === '2') return 'already';
    const before = setGeneral(f, BL);
    try { fs.writeFileSync(d.borderlessFile, JSON.stringify({ f, before, at: Date.now() })); } catch (_) {}
    log(`게임 중 정보 창: 테두리 없는 창으로 (원래 ${JSON.stringify(before)})`);
    return 'set';
  }
  function borderlessOff() {
    let r; try { r = JSON.parse(fs.readFileSync(d.borderlessFile, 'utf8')); } catch (_) { return 'none'; }
    try {
      const s = fs.readFileSync(r.f, 'utf8'), m = s.match(/^[ \t]*WindowMode[ \t]*=(.*)$/mi);
      if (m && m[1].trim() === '2') setGeneral(r.f, { WindowMode: r.before.WindowMode });   // 그새 사용자가 바꿨으면 안 건드림
    } catch (_) {}
    try { fs.unlinkSync(d.borderlessFile); } catch (_) {}
    log('게임 중 정보 창: 화면 모드 원래대로');
    return 'restored';
  }

  // ② 리플레이 파일 준비(최대 90초)
  async function waitRofl(gameId) {
    let asked = false;
    for (let i = 0; i < 45 && !_cancel; i++) {
      const m = await d.lcuRaw('GET', `/lol-replays/v1/metadata/${gameId}`);
      const st = m.status === 200 && m.data ? m.data.state : null;
      if (st === 'watch') return true;
      if (st === 'download' && !asked) { asked = true; await d.lcuRaw('POST', `/lol-replays/v1/rofls/${gameId}/download/graceful`, { componentType: 'replay-button_match-history' }); log('리플레이 받기 요청'); }
      if (['missingOrExpired', 'unsupported', 'incompatible', 'error'].includes(st)) { log('리플레이 못 받음: ' + st); return false; }
      await sleep(2000);
    }
    return false;
  }

  // 녹화된 webm 찾기 — 지정 폴더 → 롤이 알려준 폴더 → 문서/League of Legends/Highlights (녹화 시작 뒤에 생긴 것 중 최신)
  function findClip(dirs, since) {
    let best = null;
    for (const dir of dirs.filter(Boolean)) {
      let names = []; try { names = fs.readdirSync(dir); } catch (_) { continue; }
      for (const n of names) {
        if (!/\.webm$/i.test(n)) continue;
        const p = path.join(dir, n); let st; try { st = fs.statSync(p); } catch (_) { continue; }
        if (st.mtimeMs >= since - 3000 && st.size > 0 && (!best || st.mtimeMs > best.t)) best = { p, t: st.mtimeMs, size: st.size };
      }
    }
    return best;
  }

  // 리플레이 닫기 — 롤이 「리플레이 보는 중」이거나 리플레이 창구가 살아 있을 때만(실제 게임 창은 절대 안 닫음)
  // ⚠️ v0.1.80: 예전엔 「League of Legends.exe」를 이름으로 다 끔 → 녹화하는 동안 시작된 실제 게임(방장이 관전하던 내전)까지 꺼져 「재접속」(2026-10-31 실제로 겪음)
  //   → 리플레이 열 때 새로 생긴 프로세스 번호만 끔 · 번호를 모르면 롤이 「리플레이 보는 중」일 때만(실제 게임도 2999 /replay를 열 수 있어 그건 안 믿음)
  const gamePids = () => new Promise(r => { if (process.platform !== 'win32') return r([]); execFile('tasklist', ['/FI', 'IMAGENAME eq League of Legends.exe', '/FO', 'CSV', '/NH'], { windowsHide: true }, (e, out) => r(String(out || '').split(/\r?\n/).map(l => (l.match(/^"League of Legends\.exe","(\d+)"/) || [])[1]).filter(Boolean).map(Number))); });
  const REAL = ['ChampSelect', 'GameStart', 'InProgress', 'Reconnect', 'ReadyCheck', 'Matchmaking'];   // 이 상태가 되면 실제 게임·큐 → 녹화 그만
  // 🚫 v0.1.118: 녹화하는 사람이 「이번 판 팟지 건너뛰기」(사장님: 쓸만한 장면 없는 노잼판) → cancel() — 실제 게임 시작처럼 「그만」으로 처리(리플레이 닫기·소리 켜기·설정 되돌림은 finally 그대로)
  let _cancel = false;
  async function realGame() { if (_cancel) return '건너뛰기(녹화한 사람)'; const ph = await d.lcuRaw('GET', '/lol-gameflow/v1/gameflow-phase'); return ph.status === 200 && REAL.includes(ph.data) ? ph.data : null; }
  async function closeReplay(pid) {
    if (pid) { try { await d.kill(pid); log(`리플레이 닫음(프로세스 ${pid}만)`); } catch (_) {} return; }
    const ph = await d.lcuRaw('GET', '/lol-gameflow/v1/gameflow-phase');
    if (ph.status === 200 && ph.data === 'WatchInProgress') { try { await d.kill(); log('리플레이 닫음'); } catch (_) {} }
    else log(`리플레이 닫기 건너뜀(상태 ${ph.data})`);
  }

  // ⑥까지 한 번에 — 성공하면 webm 경로, 아니면 null(그땐 카드로 나옴)
  //   v0.1.44: parts = [{from,to,focus,champ}, …] 이면 리플레이를 한 번만 열고 장면마다 이어서 녹화 → 경로 배열(실패한 장면은 null)
  async function record(opt) {
    const multi = Array.isArray(opt.parts);
    const out = await recordParts(opt.gameId, multi ? opt.parts : [{ from: opt.from, to: opt.to, focus: opt.focus, champ: opt.champ }]);
    return multi ? (out || parts0(opt.parts)) : (out && out[0]) || null;
  }
  const parts0 = ps => ps.map(() => null);
  async function recordParts(gameId, parts) {
    const t0 = Date.now(), sec = () => ((Date.now() - t0) / 1000).toFixed(1);
    _cancel = false;
    const ph = await d.lcuRaw('GET', '/lol-gameflow/v1/gameflow-phase');
    if (ph.status !== 200) { log('롤 클라 연결 없음'); return null; }
    if (['GameStart', 'InProgress', 'Reconnect', 'ChampSelect', 'Matchmaking', 'ReadyCheck'].includes(ph.data)) { log('게임/큐/챔프 선택 중이라 녹화 안 함: ' + ph.data); return null; }   // 큐 잡는 중에 리플레이를 열면 큐가 꼬임(일반 판은 바로 다음 큐를 잡는 경우가 많음)
    log(`게임 ${gameId} ${parts.map(p => p.from + '~' + p.to).join(', ')}초 녹화 시작 · 창구 ${ensureReplayApi()}`);
    if (!await waitRofl(gameId)) { if (_cancel) log('건너뛰기 — 리플레이 열기 전에 그만'); return null; }
    if (_cancel) { log('건너뛰기 — 리플레이 열기 전에 그만'); return null; }
    log(`리플레이 준비됨 (${sec()}초)`);
    const cfg = cfgForRecord(); if (cfg) log(`창 모드 1920×1080 (원래 ${JSON.stringify(cfg.before)})`);
    const hid = d.hideWindow ? d.hideWindow() : null;   // 리플레이 창이 뜨면 바로 화면 밖으로
    const before = await gamePids(); let replayPid = null, aborted = null;   // 리플레이 프로세스 = 열기 뒤 새로 생긴 것
    const w = await d.lcuRaw('POST', `/lol-replays/v1/rofls/${gameId}/watch`, { componentType: 'replay-button_match-history' });
    if (!(w.status >= 200 && w.status < 300)) { log('리플레이 열기 실패 HTTP ' + w.status); if (hid) hid.stop(); restoreCfg(cfg); return null; }
    // 🔇 v0.1.92: 방장 스피커에서만 리플레이 소리 끔(d.muteAudio = main gameAudioMute · 녹화 영상엔 소리 그대로 · 실측) — 리플레이 프로세스 번호만
    let muted = false;
    const mute = async on => {
      if (!d.muteAudio || !replayPid || (!on && !muted)) return;
      const r = await d.muteAudio([replayPid], on).catch(() => null);
      if (on && r && r.muted) { if (!muted) log(`리플레이 소리 끔(방장 스피커만 · 영상엔 소리 있음 · ${sec()}초)`); muted = true; }
      if (!on) { log(`리플레이 소리 다시 켬 ${r ? `세션 ${r.sessions} · 음소거 ${r.muted}` : '실패(다음 게임 때 다시 풂)'}`); if (r && !r.muted) muted = false; }
    };
    try {
      let len = 0;   // ④ 리플레이 로딩(최대 120초)
      for (let i = 0; i < (d.loadWaitSec || 120) && !len && !_cancel; i++) {
        const p = await live('GET', '/replay/playback'); if (p.status === 200 && p.data && p.data.length > 0) { len = p.data.length; break; }
        // 🔇 v0.1.117: 로딩 동안에도 끔(사장님: 녹화할 때 소리가 남 — 실기 ap렉사이서폿 PC: 열기 요청 → 열림까지 ~50초 로딩 소리가 다 나고 열린 뒤에야 껐음)
        //   → 리플레이 프로세스가 생기면 1초마다 소리 세션을 찾아 바로 끔(세션은 소리가 나기 시작할 때 생김)
        if (!muted && d.muteAudio) { const np = (await gamePids()).find(x => !before.includes(x)); if (np) { replayPid = np; await mute(true); } }
        await sleep(1000);
      }
      if (!len) { log('리플레이 창구가 안 열림(EnableReplayApi?)'); return null; }
      replayPid = (await gamePids()).find(x => !before.includes(x)) || replayPid;
      log(`리플레이 열림 · 길이 ${Math.round(len)}초 · 프로세스 ${replayPid || '?'} (${sec()}초)`);
      await mute(true);
      const outs = [];
      for (let pi = 0; pi < parts.length; pi++) outs.push(aborted || (aborted = await realGame()) ? null : await recordOne(parts[pi], pi).catch(e => { log(`장면 ${pi + 1} 오류 ${e && e.message}`); return null; }));
      if (aborted) log('실제 게임·큐가 시작돼 녹화 그만: ' + aborted);
      return outs;
      async function recordOne({ from, to, focus, champ, fov, cam, camAt, camRamp, seq, direct, speed, probe }, pi) {   // cam = 처음 카메라에 덧붙일 render 값(예: {cameraMode:'tps'}) · camAt = [{t: 게임 초, set: render 값}] 녹화 중 그 시각에 바꿈(섞은 연출 · v0.1.87 시험)   // 장면 하나(되감기 → 카메라 → 녹화 → 파일)
        if (pi) log(`── 장면 ${pi + 1} · ${from}~${to}초`);
        if (_cancel) return null;
        if (!muted) await mute(true);   // 열 때 소리 세션이 아직 없었으면 여기서
          to = Math.min(to, len - 0.5); from = Math.max(0, Math.min(from, to - 3));
          // v0.1.34: 앞 구간(PRE초) 먼저 재생해 화면·카메라가 자리 잡은 뒤 녹화 — 전엔 되감기(seek)가 끝나기 전에 녹화가 시작돼
          //   첫 몇 초가 멈춘 기지 화면이었고, 녹화도 7~10초 만에 끊겨 정작 킬 장면이 빠졌음(실제 판 8436676738·8436741245)
          const PRE = makeReplayRec.PRE, startAt = Math.max(0, from - PRE);
          const seekTo = async t => {   // 되감기 끝날 때까지(최대 40초)
            await live('POST', '/replay/playback', { time: t, paused: true, speed: 1 });
            for (let i = 0; i < 80 && !_cancel; i++) { await sleep(500); const p = await live('GET', '/replay/playback'); if (p.data && !p.data.seeking && Math.abs((p.data.time || 0) - t) < 1.5) return true; }
            return false;
          };
          // v0.1.81: 첫 장면이 빈 곳으로 시작하던 것(사장님) — 멈춘 채 카메라를 붙이면 주인공 쪽으로 다 못 옮긴 채 녹화가 시작됨
          //   → WARM초 더 앞으로 되감고, 녹화 없이 먼저 재생해 카메라가 따라붙은 뒤 startAt에 닿으면 녹화 시작(영상 0초는 길이로 실측하니 타이밍은 그대로)
          const WARM = 2, warmAt = Math.max(0, startAt - WARM);
          // 🎥 연출 카메라(2026-11-01 사장님: 시작은 이 사람의 팟지라는 걸 알게 정면/등 뒤 모습 → 교전은 상대가 안 보이는 일이 없게)
          //   롤 3인칭(tps)은 리플레이가 꺼져서 카메라를 직접 계산: ① 미리 보기 = 주인공(2배속)·잡힐 상대들(4배속, 킬 4초 전~0.5초 뒤만)을
          //   위에서 붙어 따라가는 카메라(fps+붙기·offset O)로 재생하며 「카메라 위치 − O」 = 그 챔피언 위치를 기록
          //   ② 0.1초마다 카메라 위치·바라볼 곳 계산 → ③ /replay/sequence 키프레임(롤이 매 프레임 이어 줌 · 붙기는 끔)
          //   소개(from부터 intro초) = 주인공 얼굴 쪽 낮은 곳에서 75° 돎(예시 12) → 1.2초 동안 위로 빠지며
          //   교전 = 주인공 + 곧(4초 안) 잡힐 상대들 가운데를 늘 보던 각도(위에서 55°)로 보고, 다 들어오게 거리를 자동(1700~3200) · ±0.6초 평균으로 흔들림 없이
          const scout = async (name, t0, t1, speed, alias) => {
            const O = { x: 0, y: 1492, z: -1006 };
            await live('POST', '/replay/sequence', {});   // 앞 키프레임이 남아 있으면 카메라가 안 붙음(실측)
            await live('POST', '/replay/render', { selectionName: name, cameraMode: 'fps', cameraAttached: true, selectionOffset: O, cameraRotation: { x: 0, y: 56, z: 0 } });
            const sel = ((await live('GET', '/replay/render')).data || {}).selectionName;
            if (!sel && alias) await live('POST', '/replay/render', { selectionName: alias });   // 게임 이름이 안 먹으면 영문 챔피언 이름(실측: 「스몰더」 못 찾음)
            if (!sel && !((await live('GET', '/replay/render')).data || {}).selectionName) { log(`연출 카메라: ${name}${alias ? '/' + alias : ''} 못 찾음`); return null; }
            await seekTo(Math.max(0, t0));
            await live('POST', '/replay/playback', { time: Math.max(0, t0), paused: false, speed });
            const pts = [], st = Date.now(), lim = st + (t1 - t0) / speed * 1000 + 15000;
            while (Date.now() < lim && !_cancel) {
              const [p, r] = await Promise.all([live('GET', '/replay/playback'), live('GET', '/replay/render')]);
              const t = p.data && p.data.time, cp = r.data && r.data.cameraPosition;
              if (t != null && cp && Date.now() - st > 250) pts.push({ t, x: cp.x - O.x, y: cp.y - O.y, z: cp.z - O.z });   // 붙는 동안(처음 0.25초)은 버림
              if (t != null && t >= t1) break;
              await sleep(30);
            }
            await live('POST', '/replay/playback', { paused: true, speed: 1 });
            return pts.length >= 5 ? pts : null;
          };
          if (typeof probe === 'function') { await probe({ live, seekTo, scout, log }); return null; }   // 🧪 시험 도구 전용(위치 조사 등 · 녹화 안 함 · 앱은 안 씀)
          // 🗺️ 칼바람 나락 다리 지도(2026-11-01 · 이 PC 전적의 칼바람 20판 타임라인 위치 4,068개): 중심 (6534, 6335) · 다리 방향 43.7°
          //   [다리 방향 위치 s, 걸어 다닌 곳의 옆 위치 2%, 98%] — 600 간격 · 리플레이 x,z = 타임라인 x,y
          const LANE12 = [[-7200,-840,334],[-6600,-1121,1344],[-6000,-1040,935],[-5400,-1251,1085],[-4800,-1308,872],[-4200,-691,779],[-3600,-621,845],[-3000,-544,819],[-2400,-608,791],[-1800,-623,793],[-1200,-559,763],[-600,-583,658],[0,-603,544],[600,-540,722],[1200,-569,771],[1800,-579,741],[2400,-530,825],[3000,-589,617],[3600,-486,678],[4200,-698,701],[4800,-1071,969],[5400,-1143,1005],[6000,-1058,837],[6600,-1138,400],[7200,-607,256]];
          const laneIn = (x, z, m) => {   // 다리 안쪽에서 m 이상 떨어져 있나
            const A = 43.7 * Math.PI / 180, dx = x - 6534, dz = z - 6335, sl = dx * Math.cos(A) + dz * Math.sin(A), pp = -dx * Math.sin(A) + dz * Math.cos(A);
            const i = Math.max(0, Math.min(LANE12.length - 2, Math.floor((sl + 7200) / 600))), k = Math.max(0, Math.min(1, (sl + 7200) / 600 - i)), a = LANE12[i], b = LANE12[i + 1];
            const lo = a[1] + (b[1] - a[1]) * k, hi = a[2] + (b[2] - a[2]) * k;
            return pp > lo + m && pp < hi - m;
          };
          // 🗼 다리 위 포탑·억제기(타임라인 파괴 기록 위치) — 낮은 카메라와 주인공 사이에 끼면 가림(제이스 실기: 포탑 기둥에 2초 가림) · 부서져도 잔해가 있어 늘 피함
          const TOWERS12 = [[4950, 4950], [3850, 3850], [3100, 3200], [2050, 2600], [2500, 2100], [7900, 7750], [9000, 8850], [9700, 9550], [10350, 10550], [10800, 10100]];
          const nearTower = (c, h) => TOWERS12.some(([x, z]) => {   // 카메라가 포탑 300 안이거나, 카메라→주인공 선이 포탑 260 안을 지나면
            const vx = h.x - c.x, vz = h.z - c.z, L2 = vx * vx + vz * vz || 1, k = Math.max(0, Math.min(1, ((x - c.x) * vx + (z - c.z) * vz) / L2));
            return Math.hypot(x - c.x, z - c.z) < 300 || Math.hypot(x - (c.x + vx * k), z - (c.z + vz * k)) < 260;
          });
          const at = (pts, t) => { if (!pts || t < pts[0].t - 0.3 || t > pts[pts.length - 1].t + 0.3) return null; let i = pts.findIndex(q => q.t >= t); if (i <= 0) return pts[i < 0 ? pts.length - 1 : 0]; const a = pts[i - 1], b = pts[i], k = (t - a.t) / Math.max(1e-3, b.t - a.t); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }; };
          const directSeq = async (c, t0, t1) => {
            const hero = await scout(focus, t0, t1, 2, champ);
            if (!hero) { log('연출 카메라: 주인공 위치 기록 실패 → 위에서 보기'); return {}; }
            const vs = [];
            for (const v of c.victims || []) { const pts = await scout(v.name, Math.max(t0, v.t - 4.5), Math.min(t1, v.t + 0.6), 4, v.alias); if (pts) vs.push({ k: v.t, pts, name: v.name }); }
            await live('POST', '/replay/render', { cameraAttached: false, cameraMode: 'fps' });
            const intro = c.intro == null ? 2.4 : c.intro, i0 = from, i1 = from + intro, BL = 1.2, P = 55 * Math.PI / 180, STEP = 0.1;
            const ts = []; for (let t = t0; t <= t1 + 1e-6; t += STEP) ts.push(+t.toFixed(2));
            // 교전 화면: 주인공 + 곧 잡힐 상대 → 가운데·필요한 거리
            const raw = ts.map(t => {
              const h = at(hero, t) || at(hero, Math.min(Math.max(t, hero[0].t), hero[hero.length - 1].t)), ps = [h];
              for (const v of vs) if (t >= v.k - 4 && t <= v.k + 0.4) { const q = at(v.pts, t); if (q && Math.hypot(q.x - h.x, q.z - h.z) < 2200) ps.push(q); }
              const xs = ps.map(q => q.x), zs = ps.map(q => q.z), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
              const s = Math.max(...ps.map(q => Math.hypot(q.x - cx, q.z - cz))) + 300;
              return { x: cx, y: h.y, z: cz, d: Math.min(3200, Math.max(1700, s * 2.6)), h };   // 사장님 2026-11-01 「완벽」(예시 12) 값 그대로
            });
            const sm = ts.map((_, i) => { let x = 0, y = 0, z = 0, d = 0, w = 0; for (let j = -6; j <= 6; j++) { const r = raw[Math.min(raw.length - 1, Math.max(0, i + j))], g = Math.exp(-(j * j) / 18); x += r.x * g; y += r.y * g; z += r.z * g; d += r.d * g; w += g; } return { x: x / w, y: y / w, z: z / w, d: d / w }; });
            // 🔭 v0.1.121: 멀리서 죽는 상대 쪽으로 잠깐(사장님: 킬 캐치가 어떨 땐 안 맞음 — 주인공은 다른 쪽인데 도망간 상대가 멀리서 죽으면 화면 밖이라 효과만 터짐 → 죽은 순서대로 그쪽을 비춰 줌)
            //   상대가 죽는 순간 교전 화면에서 벗어나 있으면(교전 화면 가운데에서 거리×0.42 넘게 · 예전엔 주인공에서 2200 넘는 상대는 아예 안 넣었음)
            //   킬 −0.9~+0.4초 동안 그 상대를 가까이(1250) 비춤 · 앞뒤 0.35초씩 부드럽게 옮겨 갔다 옴(그 구간은 슬로라 천천히) · c.focus = 'all'이면 모든 킬(시험용)
            const FD = 1250, fcs = [];
            for (const v of vs) {
              const i = Math.max(0, Math.min(ts.length - 1, Math.round((v.k - t0) / STEP))), f = sm[i], q = at(v.pts, v.k); if (!q) continue;
              const off = Math.hypot(q.x - f.x, q.z - f.z), far = off > f.d * 0.42;
              const force = c.focus === 'all' || (Array.isArray(c.focus) && c.focus.includes(v.name));   // 시험용: 'all' 또는 [상대 이름…]
              if (far || force) fcs.push({ v, a: v.k - 0.9, b: v.k + 0.4 });
              log(`연출 카메라: ${v.name || '상대'} 죽는 곳 = 교전 화면 가운데에서 ${Math.round(off)}(${far ? '화면 밖 → 그쪽을 비춤' : force ? '화면 안 · 시험으로 비춤' : '화면 안'})`);
            }
            const focusAt = t => {   // → { w: 0~1, q: 그 상대 위치 }
              let w = 0, q = null;
              for (const F of fcs) {
                const x = t < F.a || t > F.b ? 0 : Math.min(1, (t - F.a) / 0.35, (F.b - t) / 0.35), e = x * x * (3 - 2 * x);
                if (e > w) { const p = F.v.pts, qq = at(p, Math.min(Math.max(t, p[0].t), p[p.length - 1].t)); if (qq) { w = e; q = qq; } }
              }
              return { w, q };
            };
            // 소개 카메라(사장님 「가장 멋있음」 = 예시 12): 얼굴이 향하는 쪽(첫 상대 쪽, 없으면 움직이는 쪽) 낮은 곳(높이 260·거리 430)에서 바라보며 75° 돎
            //   ⚠️ 주인공·카메라가 다리 가장자리(얼음 덤불·벽)에 걸리면 가림(말파이트·초가스 실기 · nearClip으로 카메라 앞을 지워도 안 됨)
            //   → 칼바람 다리 지도(LANE12)로 도는 방향 두 가지(+75°/−75°)를 미리 따져 카메라·주인공·그 사이가 소개 내내 다리 안쪽인 쪽을 고름
            //   → 둘 다 걸리면 롤 기본 방향(남→북)으로 가까이(예시 13) — 롤 맵은 이 방향에선 거의 안 가림
            const hA = at(hero, i0) || hero[0], v0 = vs.length ? at(vs[0].pts, Math.max(i0, vs[0].pts[0].t)) : null, hB = at(hero, i0 + 1.5) || hA;
            let ux = v0 ? v0.x - hA.x : hB.x - hA.x, uz = v0 ? v0.z - hA.z : hB.z - hA.z; const ul = Math.hypot(ux, uz); if (ul < 50) { ux = 0; uz = -1; } else { ux /= ul; uz /= ul; }
            const ease = t => { const k = Math.min(1, Math.max(0, (t - i0) / Math.max(0.1, intro))); return k * k * (3 - 2 * k); };
            const lowCam = sg => t => {   // 예시 12
              const h = at(hero, t) || hA, a = sg * ease(t) * 75 * Math.PI / 180, rx = ux * Math.cos(a) - uz * Math.sin(a), rz = ux * Math.sin(a) + uz * Math.cos(a);
              return { pos: { x: h.x + rx * 430, y: h.y + 260, z: h.z + rz * 430 }, tgt: { x: h.x, y: h.y + 90, z: h.z } };
            };
            const safeCam = t => {   // 예시 13: 롤 기본 방향으로 가까이(거리 760·50°) ±20°
              const h = at(hero, t) || hA, a = (ease(t) * 40 - 20) * Math.PI / 180, D = 760, IP = 50 * Math.PI / 180, hz = D * Math.cos(IP);
              return { pos: { x: h.x - Math.sin(a) * hz, y: h.y + 90 + D * Math.sin(IP), z: h.z - Math.cos(a) * hz }, tgt: { x: h.x, y: h.y + 90, z: h.z } };
            };
            const clear = cam => { for (let t = i0; t <= i1 + 1e-6; t += 0.2) { const c = cam(t), h = c.tgt; if (!laneIn(h.x, h.z, 200) || !laneIn(c.pos.x, c.pos.z, 150) || !laneIn((h.x + c.pos.x) / 2, (h.z + c.pos.z) / 2, 150) || nearTower(c.pos, h)) return false; } return true; };
            const L1 = lowCam(1), L2 = lowCam(-1), introCam = intro <= 0 ? safeCam : clear(L1) ? L1 : clear(L2) ? L2 : safeCam;
            log(`연출 카메라: 소개 = ${introCam === L1 ? '낮게 돌기 +75°' : introCam === L2 ? '낮게 돌기 −75°' : '기본 방향 가까이(낮은 카메라는 다리 가장자리·포탑에 가릴 수 있음)'}`);
            const kp = [], kr = []; let yawPrev = null;
            ts.forEach((t, i) => {
              const f = sm[i]; let fight = { pos: { x: f.x, y: f.y + f.d * Math.sin(P), z: f.z - f.d * Math.cos(P) }, tgt: { x: f.x, y: f.y, z: f.z } };
              const fo = focusAt(t);   // 🔭 멀리서 죽는 상대 쪽
              if (fo.w > 0) { const q = fo.q, fc = { pos: { x: q.x, y: q.y + FD * Math.sin(P), z: q.z - FD * Math.cos(P) }, tgt: { x: q.x, y: q.y, z: q.z } }, M = (a, b) => ({ x: a.x + (b.x - a.x) * fo.w, y: a.y + (b.y - a.y) * fo.w, z: a.z + (b.z - a.z) * fo.w }); fight = { pos: M(fight.pos, fc.pos), tgt: M(fight.tgt, fc.tgt) }; }
              const k = Math.min(1, Math.max(0, (t - i1) / BL)), w = intro > 0 ? k * k * (3 - 2 * k) : 1, ic = w < 1 ? introCam(t) : fight;
              const L = (a, b) => ({ x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, z: a.z + (b.z - a.z) * w });
              const pos = L(ic.pos, fight.pos), tgt = L(ic.tgt, fight.tgt), dx = tgt.x - pos.x, dz = tgt.z - pos.z;
              let yaw = Math.atan2(dx, dz) * 180 / Math.PI; if (yawPrev != null) { while (yaw - yawPrev > 180) yaw -= 360; while (yaw - yawPrev < -180) yaw += 360; } yawPrev = yaw;   // 359→0 튀지 않게
              const pitch = Math.atan2(pos.y - tgt.y, Math.hypot(dx, dz)) * 180 / Math.PI;
              kp.push({ time: t, value: { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), z: +pos.z.toFixed(1) }, blend: 'linear' });
              kr.push({ time: t, value: { x: +yaw.toFixed(2), y: +pitch.toFixed(2), z: 0 }, blend: 'linear' });
            });
            log(`연출 카메라: 주인공 위치 ${hero.length}개 · 상대 ${vs.length}/${(c.victims || []).length}명 · 상대 쪽 비춤 ${fcs.length}번 · 키프레임 ${kp.length}개 (${sec()}초)`);
            await seekTo(t0);
            return { cameraPosition: kp, cameraRotation: kr };
          };
          log(`되감기 ${warmAt}초 ${await seekTo(warmAt) ? '완료' : '확인 못 함'} (${sec()}초)`);
          const view = { cameraAttached: true, cameraMode: 'top', selectionOffset: { x: 0, y: 0, z: 0 }, fieldOfView: 50, interfaceScoreboard: false, interfaceChat: false, interfaceTimeline: false, interfaceReplay: false, interfaceMinimap: false, interfaceFrames: false, interfaceScore: false, interfaceTarget: false, interfaceQuests: false, interfaceKillCallouts: false, interfaceAnnounce: false };   // 화면 깨끗하게(체력바만 남김 · 롤 킬 알림은 확대하면 위가 잘려서 끄고 팟지 킬 피드로 대신)
          await live('POST', '/replay/render', Object.assign({ selectionName: focus }, view));
          const r = await live('GET', '/replay/render');
          if (champ && !(r.data && r.data.selectionName)) { await live('POST', '/replay/render', Object.assign({ selectionName: champ }, view)); log('카메라: 챔피언 이름으로 다시 지정'); }   // 게임 이름이 안 먹으면
          if (cam) await live('POST', '/replay/render', cam);
          if (direct) seq = Object.assign({}, seq, await directSeq(direct, warmAt, to + 0.6));   // 🎥 연출 카메라(소개 → 교전)
          if (_cancel) return null;   // 🚫 미리 보기 도중 건너뛰기
          // seq = 키프레임 연출(롤이 매 프레임 이어 줌 · /replay/sequence 형식 {fieldOfView: [{time, value, blend}], …}) — camAt(0.1초마다 render 바꾸기)은 계단식이라 슬로모션에서 버벅여 보였음(2026-11-01)
          // 🐢 v0.1.120: 슬로 구간 재생 속도 키프레임(speed = [[게임 초, 속도], …] · main slowKeys) — 그 구간을 느리게 재생하며 실제 시간으로 찍어 슬로도 1초 30장
          if (Array.isArray(speed) && speed.length) { seq = Object.assign({}, seq, { playbackSpeed: speed.map(([time, value]) => ({ time, value, blend: 'linear' })) }); log(`슬로 구간 느리게 녹화 · 속도 바꿈 ${speed.length / 2}번(${speed.filter((_, i) => i % 2).map(k => k[1]).join(" → ")}배)`); }
          await live('POST', '/replay/sequence', seq || {});   // 앞 장면 연출이 남지 않게 늘 새로
          if (fov) await live('POST', '/replay/render', { fieldOfView: fov });   // v0.1.80: 시야 넓히기(먼 사거리 · 주인공이 화면 끝에 걸리던 것)
          { const c = (await live('GET', '/replay/render')).data || {}; log(`카메라 ${JSON.stringify({ sel: c.selectionName, att: c.cameraAttached, mode: c.cameraMode, fov: c.fieldOfView, off: c.selectionOffset, move: c.cameraMoveSpeed, look: c.cameraLookSpeed, pos: c.cameraPosition, rot: c.cameraRotation })}`); }
          await sleep(800);   // 장면 불러오기
          if (warmAt < startAt) {   // 카메라 따라붙기(녹화 없이 재생)
            await live('POST', '/replay/playback', { time: warmAt, paused: false, speed: 1 });
            for (let i = 0; i < 60; i++) { await sleep(100); const q = await live('GET', '/replay/playback'); if (q.data && (q.data.time || 0) >= startAt - 0.15) break; }
          }
          const outDir = d.outDir; fs.mkdirSync(outDir, { recursive: true });
          const since = Date.now();
          const rr = await live('POST', '/replay/recording', { recording: true, startTime: from, endTime: to, framesPerSecond: FPS, enforceFrameRate: false, codec: 'webm', lossless: false, width: W, height: H, path: outDir, replaySpeed: 1 });
          if (!(rr.status >= 200 && rr.status < 300)) { log('녹화 시작 실패 HTTP ' + rr.status); return null; }
          if (warmAt >= startAt) await live('POST', '/replay/playback', { time: startAt, paused: false, speed: 1 });   // 따라붙기 없었을 때(게임 맨 앞)만 여기서 재생
          // ⑤ 끝 = 리플레이 시간이 to를 지나고 녹화가 멈춤(녹화 쪽 값만 믿지 않음 — 리플레이 시간 기준) · 최대 (구간+앞부분)×4 + 30초
          let lastPath = null, last = 0, n = 0, moveAt = Date.now(), moveT = -1, shown = !hid;
          const limit = Date.now() + ((to - startAt) * 4 + 30) * 1000;
          // 🎥 섞은 연출 — 0.1초마다 리플레이 시각을 보고 정한 시각이 되면 카메라 render 값을 바꿈(예: 킬 1.5초 전 3인칭 → 킬 뒤 원래대로)
          const camQ = Array.isArray(camAt) ? camAt.slice().sort((x, y) => x.t - y.t) : [];
          let camBusy = false;
          const camTimer = camQ.length ? setInterval(async () => {
            if (camBusy || !camQ.length) return; camBusy = true;
            try { const q = await live('GET', '/replay/playback'), t = q.data && q.data.time; while (camQ.length && t != null && t >= camQ[0].t) { const c = camQ.shift(); await live('POST', '/replay/render', c.set); log(`카메라 바꿈 ${t.toFixed(1)}초 ${JSON.stringify(c.set)}`); } } finally { camBusy = false; }
          }, 100) : null;
          // 🎥 카메라 이어 옮기기(camRamp = [{t0, t1, from, to}] · from/to = render 값, 숫자만 사이를 smoothStep으로 채움) — selectionOffset·cameraRotation은 /replay/sequence 키프레임이 안 돼서
          //   camAt 12단계(0.1초 계단)는 슬로모션에서 버벅여 보였음(사장님 2026-11-01) → 리플레이 시각을 0.25초마다 맞추고 그 사이는 시계로 이어 매 ~16ms 바꿈(앞 요청이 끝나야 다음)
          const ramps = Array.isArray(camRamp) ? camRamp.slice().sort((x, y) => x.t0 - y.t0) : [];
          let rampOn = ramps.length > 0;
          const lerpObj = (A, Z, e) => { if (typeof A === 'number' && typeof Z === 'number') return +(A + (Z - A) * e).toFixed(2); if (A && typeof A === 'object') { const o = {}; for (const k of Object.keys(A)) o[k] = lerpObj(A[k], Z ? Z[k] : undefined, e); return o; } return A; };
          const rampLoop = rampOn ? (async () => {
            let pt = null, pAt = 0, polled = 0, done = new Set();
            while (rampOn) {
              const nw = Date.now();
              if (nw - polled > 250) { polled = nw; const q = await live('GET', '/replay/playback'); if (q.data && q.data.time != null) { pt = q.data.time; pAt = Date.now(); } }
              if (pt != null) {
                const t = pt + (Date.now() - pAt) / 1000;
                for (let i = 0; i < ramps.length; i++) {
                  const r = ramps[i];
                  if (t < r.t0 || done.has(i)) continue;
                  const k = Math.min(1, (t - r.t0) / Math.max(0.01, r.t1 - r.t0)), e = k * k * (3 - 2 * k);
                  await live('POST', '/replay/render', lerpObj(r.from, r.to, e));
                  if (k >= 1) { done.add(i); log(`카메라 이동 끝 ${t.toFixed(1)}초`); }
                  break;
                }
                if (done.size === ramps.length) break;
              }
              await sleep(16);
            }
          })() : null;
          while (Date.now() < limit) {
            await sleep(1000);
            if ((aborted = await realGame())) { log('녹화 중 실제 게임·큐 시작 → 이 장면 버림: ' + aborted); if (camTimer) clearInterval(camTimer); rampOn = false; return null; }
            const [g, p] = await Promise.all([live('GET', '/replay/recording'), live('GET', '/replay/playback')]);
            const rec = g.data || {}, t = p.data ? p.data.time : null;
            if (rec.outputPath || rec.path) lastPath = rec.outputPath || rec.path;
            if (++n % 3 === 1) log(`진행 리플레이 ${t == null ? '?' : t.toFixed(1)}초 · 녹화 ${rec.recording ? '중' : '멈춤'}${rec.currentTime != null ? ' ' + Number(rec.currentTime).toFixed(1) : ''}`);
            if (t != null) last = t;
            if (t != null && Math.abs(t - moveT) > 0.15) { moveT = t; moveAt = Date.now(); }   // 🐢 슬로(0.3배) 구간은 1초에 0.3초만 가서 0.3이면 멈춤으로 오인
            else if (!shown && Date.now() - moveAt > 6000) { shown = true; hid.show(); log('화면 밖에선 리플레이가 멈춰서 화면 안으로 꺼냄'); await live('POST', '/replay/playback', { paused: false }); moveAt = Date.now(); }
            if (t != null && t >= to + 0.5 && !rec.recording) break;
            if (p.data && p.data.paused && t != null && t < to) await live('POST', '/replay/playback', { paused: false });   // 누가 멈췄으면 다시 재생
          }
          if (camTimer) clearInterval(camTimer);
          rampOn = false; if (rampLoop) await rampLoop;
          log(`녹화 구간 끝 · 리플레이 ${last.toFixed(1)}초 (${sec()}초)`);
          await live('POST', '/replay/playback', { paused: true });
          let clip = null, prev = -1;   // 파일 다 써질 때까지(크기가 그대로면 끝)
          for (let i = 0; i < 20; i++) {
            clip = findClip([outDir, lastPath && (path.extname(lastPath) ? path.dirname(lastPath) : lastPath), d.docsDir], since);
            if (clip && clip.size === prev) break;
            prev = clip ? clip.size : -1; await sleep(700);
          }
          if (!clip) { log('녹화 파일을 못 찾음'); return null; }
          log(`녹화 끝 ✅ ${(clip.size / 1048576).toFixed(1)}MB · ${clip.p} (${sec()}초)`);
          return clip.p;
      }
    } finally {
      await mute(false);   // ⚠️ 닫기 전에 꼭 — 윈도우가 음소거를 기억해 다음 실제 게임까지 소리가 안 날 수 있음
      await closeReplay(replayPid);   // 열기 요청을 보냈으면 늘 정리(창구가 안 열렸어도 게임 창은 떴을 수 있음) · 리플레이 프로세스만
      if (hid) { const h = hid.stop(); if (h != null) log(`창 숨김 ${h}회`); }
      restoreCfg(cfg);   // 리플레이를 강제로 닫아서 롤이 설정을 덮어쓰지 않음 → 그 뒤에 되돌림
    }
  }

  return { record, cancel: () => { _cancel = true; }, ensureReplayApi, restorePending: () => restoreCfg(null), borderlessOn, borderlessOff, _findClip: findClip };
}

// v0.1.58: 롤은 startTime을 안 기다리고 재생이 시작되는 startAt(= from − PRE)부터 바로 찍음(실측: 540~556 요청 → 538.1초에 이미 녹화 중 · 영상 18.9초)
//   → 영상 0초 = startAt. main recordPotgClip이 영상이 생긴 장면의 clipFrom을 여기로 옮겨 팟지 연출(킬 자막·슬로) 시각을 맞춤
makeReplayRec.PRE = 3;
makeReplayRec.videoStart = (from, to) => Math.max(0, Math.max(0, Math.min(from, to - 3)) - makeReplayRec.PRE);   // recordOne과 같은 계산
module.exports = makeReplayRec;
module.exports.defaults = () => ({ docsDir: path.join(os.homedir(), 'Documents', 'League of Legends', 'Highlights') });
