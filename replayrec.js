// ── 🎬 팟지 영상 = 리플레이 녹화(v0.1.33 · 방장 PC만) ─────────────────────────────
// 판이 끝나고 방장 앱이 팟지 장면을 고르면, 롤의 리플레이를 몰래 열어 그 장면만 롤 자체 녹화 기능으로 webm으로 뜬다.
//  ① game.cfg [General] EnableReplayApi=1 (리플레이 조작 창구 — 리플레이 게임이 켜질 때 읽음 · 처음 한 번 game.cfg.tn-backup 남김)
//  ② 리플레이 파일 준비: /lol-replays/v1/metadata/{gameId} 가 watch 될 때까지(download면 받기 요청)
//  ③ 리플레이 열기: POST /lol-replays/v1/rofls/{gameId}/watch → 리플레이 게임 창이 뜸(방장 화면에 잠깐 보임)
//  ④ 리플레이 창구(127.0.0.1:2999/replay/*) 열릴 때까지 기다림 → 카메라 = 팟지 주인공 따라가기 · 점수판/채팅/타임라인 숨김
//  ⑤ /replay/recording 으로 clipFrom~clipTo 녹화(롤이 직접 webm으로 저장 · 프레임 고정이라 느린 PC에서도 끊김 없음)
//  ⑥ 리플레이 닫기(롤 상태가 리플레이 보는 중일 때만 게임 창 종료 — 실제 게임은 절대 안 건드림) → 파일 경로 돌려줌
// ⚠️ 실기 미확인: 녹화 파일이 path 폴더에 생기는지(아니면 문서/League of Legends/Highlights) · selectionName이 게임 이름인지 → 둘 다 찾음/시도
const fs = require('fs');
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
      let s = ''; res.on('data', c => s += c); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (_) {} resolve({ status: res.statusCode, data: j }); });
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

  // ② 리플레이 파일 준비(최대 90초)
  async function waitRofl(gameId) {
    let asked = false;
    for (let i = 0; i < 45; i++) {
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
  async function closeReplay() {
    const ph = await d.lcuRaw('GET', '/lol-gameflow/v1/gameflow-phase');
    const pb = await live('GET', '/replay/playback');
    if ((ph.status === 200 && ph.data === 'WatchInProgress') || (pb.status === 200 && pb.data && typeof pb.data.length === 'number')) {
      try { await d.kill(); log('리플레이 닫음'); } catch (_) {}
    } else log(`리플레이 닫기 건너뜀(상태 ${ph.data})`);
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
    const ph = await d.lcuRaw('GET', '/lol-gameflow/v1/gameflow-phase');
    if (ph.status !== 200) { log('롤 클라 연결 없음'); return null; }
    if (['GameStart', 'InProgress', 'Reconnect', 'ChampSelect', 'Matchmaking', 'ReadyCheck'].includes(ph.data)) { log('게임/큐/챔프 선택 중이라 녹화 안 함: ' + ph.data); return null; }   // 큐 잡는 중에 리플레이를 열면 큐가 꼬임(일반 판은 바로 다음 큐를 잡는 경우가 많음)
    log(`게임 ${gameId} ${parts.map(p => p.from + '~' + p.to).join(', ')}초 녹화 시작 · 창구 ${ensureReplayApi()}`);
    if (!await waitRofl(gameId)) return null;
    log(`리플레이 준비됨 (${sec()}초)`);
    const cfg = cfgForRecord(); if (cfg) log(`창 모드 1920×1080 (원래 ${JSON.stringify(cfg.before)})`);
    const hid = d.hideWindow ? d.hideWindow() : null;   // 리플레이 창이 뜨면 바로 화면 밖으로
    const w = await d.lcuRaw('POST', `/lol-replays/v1/rofls/${gameId}/watch`, { componentType: 'replay-button_match-history' });
    if (!(w.status >= 200 && w.status < 300)) { log('리플레이 열기 실패 HTTP ' + w.status); if (hid) hid.stop(); restoreCfg(cfg); return null; }
    try {
      let len = 0;   // ④ 리플레이 로딩(최대 120초)
      for (let i = 0; i < (d.loadWaitSec || 120) && !len; i++) { const p = await live('GET', '/replay/playback'); if (p.status === 200 && p.data && p.data.length > 0) len = p.data.length; else await sleep(1000); }
      if (!len) { log('리플레이 창구가 안 열림(EnableReplayApi?)'); return null; }
      log(`리플레이 열림 · 길이 ${Math.round(len)}초 (${sec()}초)`);
      const outs = [];
      for (let pi = 0; pi < parts.length; pi++) outs.push(await recordOne(parts[pi], pi).catch(e => { log(`장면 ${pi + 1} 오류 ${e && e.message}`); return null; }));
      return outs;
      async function recordOne({ from, to, focus, champ }, pi) {   // 장면 하나(되감기 → 카메라 → 녹화 → 파일)
        if (pi) log(`── 장면 ${pi + 1} · ${from}~${to}초`);
          to = Math.min(to, len - 0.5); from = Math.max(0, Math.min(from, to - 3));
          // v0.1.34: 앞 구간(PRE초) 먼저 재생해 화면·카메라가 자리 잡은 뒤 녹화 — 전엔 되감기(seek)가 끝나기 전에 녹화가 시작돼
          //   첫 몇 초가 멈춘 기지 화면이었고, 녹화도 7~10초 만에 끊겨 정작 킬 장면이 빠졌음(실제 판 8436676738·8436741245)
          const PRE = 3, startAt = Math.max(0, from - PRE);
          const seekTo = async t => {   // 되감기 끝날 때까지(최대 40초)
            await live('POST', '/replay/playback', { time: t, paused: true, speed: 1 });
            for (let i = 0; i < 80; i++) { await sleep(500); const p = await live('GET', '/replay/playback'); if (p.data && !p.data.seeking && Math.abs((p.data.time || 0) - t) < 1.5) return true; }
            return false;
          };
          log(`되감기 ${startAt}초 ${await seekTo(startAt) ? '완료' : '확인 못 함'} (${sec()}초)`);
          const view = { cameraAttached: true, cameraMode: 'top', interfaceScoreboard: false, interfaceChat: false, interfaceTimeline: false, interfaceReplay: false, interfaceMinimap: false, interfaceFrames: false, interfaceScore: false, interfaceTarget: false, interfaceQuests: false, interfaceKillCallouts: false, interfaceAnnounce: false };   // 화면 깨끗하게(체력바만 남김 · 롤 킬 알림은 확대하면 위가 잘려서 끄고 팟지 킬 피드로 대신)
          await live('POST', '/replay/render', Object.assign({ selectionName: focus }, view));
          const r = await live('GET', '/replay/render');
          if (champ && !(r.data && r.data.selectionName)) { await live('POST', '/replay/render', Object.assign({ selectionName: champ }, view)); log('카메라: 챔피언 이름으로 다시 지정'); }   // 게임 이름이 안 먹으면
          await sleep(1500);   // 장면 불러오기
          const outDir = d.outDir; fs.mkdirSync(outDir, { recursive: true });
          const since = Date.now();
          const rr = await live('POST', '/replay/recording', { recording: true, startTime: from, endTime: to, framesPerSecond: FPS, enforceFrameRate: true, codec: 'webm', lossless: false, width: W, height: H, path: outDir, replaySpeed: 1 });
          if (!(rr.status >= 200 && rr.status < 300)) { log('녹화 시작 실패 HTTP ' + rr.status); return null; }
          await live('POST', '/replay/playback', { time: startAt, paused: false, speed: 1 });
          // ⑤ 끝 = 리플레이 시간이 to를 지나고 녹화가 멈춤(녹화 쪽 값만 믿지 않음 — 리플레이 시간 기준) · 최대 (구간+앞부분)×4 + 30초
          let lastPath = null, last = 0, n = 0, moveAt = Date.now(), moveT = -1, shown = !hid;
          const limit = Date.now() + ((to - startAt) * 4 + 30) * 1000;
          while (Date.now() < limit) {
            await sleep(1000);
            const [g, p] = await Promise.all([live('GET', '/replay/recording'), live('GET', '/replay/playback')]);
            const rec = g.data || {}, t = p.data ? p.data.time : null;
            if (rec.outputPath || rec.path) lastPath = rec.outputPath || rec.path;
            if (++n % 3 === 1) log(`진행 리플레이 ${t == null ? '?' : t.toFixed(1)}초 · 녹화 ${rec.recording ? '중' : '멈춤'}${rec.currentTime != null ? ' ' + Number(rec.currentTime).toFixed(1) : ''}`);
            if (t != null) last = t;
            if (t != null && Math.abs(t - moveT) > 0.3) { moveT = t; moveAt = Date.now(); }
            else if (!shown && Date.now() - moveAt > 6000) { shown = true; hid.show(); log('화면 밖에선 리플레이가 멈춰서 화면 안으로 꺼냄'); await live('POST', '/replay/playback', { paused: false }); moveAt = Date.now(); }
            if (t != null && t >= to + 0.5 && !rec.recording) break;
            if (p.data && p.data.paused && t != null && t < to) await live('POST', '/replay/playback', { paused: false });   // 누가 멈췄으면 다시 재생
          }
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
      await closeReplay();   // 열기 요청을 보냈으면 늘 정리(창구가 안 열렸어도 게임 창은 떴을 수 있음)
      if (hid) { const h = hid.stop(); if (h != null) log(`창 숨김 ${h}회`); }
      restoreCfg(cfg);   // 리플레이를 강제로 닫아서 롤이 설정을 덮어쓰지 않음 → 그 뒤에 되돌림
    }
  }

  return { record, ensureReplayApi, restorePending: () => restoreCfg(null), _findClip: findClip };
}

module.exports = makeReplayRec;
module.exports.defaults = () => ({ docsDir: path.join(os.homedir(), 'Documents', 'League of Legends', 'Highlights') });
