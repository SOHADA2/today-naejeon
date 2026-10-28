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
  // d = { lcuRaw(method, path, body) → {status,data}, lolDir() → 롤 폴더|null, log, kill() → Promise, liveBase?, docsDir?, outDir }
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

  // ① 리플레이 조작 창구 켜기(game.cfg)
  function ensureReplayApi() {
    const dir = d.lolDir && d.lolDir();
    if (!dir) return 'no-dir';
    const f = path.join(dir, 'Config', 'game.cfg');
    let s = ''; try { s = fs.readFileSync(f, 'utf8'); } catch (_) {}
    if (/^\s*EnableReplayApi\s*=\s*1\s*$/mi.test(s)) return 'already';
    const eol = s.includes('\r\n') ? '\r\n' : '\n';
    try { if (s && !fs.existsSync(f + '.tn-backup')) fs.writeFileSync(f + '.tn-backup', s); } catch (_) {}
    if (/^\s*EnableReplayApi\s*=.*$/mi.test(s)) s = s.replace(/^\s*EnableReplayApi\s*=.*$/mi, 'EnableReplayApi=1');
    else if (/^\[General\][ \t]*$/mi.test(s)) s = s.replace(/^\[General\][ \t]*$/mi, m => m + eol + 'EnableReplayApi=1');
    else s = `[General]${eol}EnableReplayApi=1${eol}` + s;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, s);
    return 'set';
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
  async function record({ gameId, from, to, focus, champ }) {
    const t0 = Date.now(), sec = () => ((Date.now() - t0) / 1000).toFixed(1);
    const ph = await d.lcuRaw('GET', '/lol-gameflow/v1/gameflow-phase');
    if (ph.status !== 200) { log('롤 클라 연결 없음'); return null; }
    if (['GameStart', 'InProgress', 'Reconnect', 'ChampSelect'].includes(ph.data)) { log('게임/챔프 선택 중이라 녹화 안 함: ' + ph.data); return null; }
    log(`게임 ${gameId} ${from}~${to}초 녹화 시작 · 창구 ${ensureReplayApi()}`);
    if (!await waitRofl(gameId)) return null;
    log(`리플레이 준비됨 (${sec()}초)`);
    const w = await d.lcuRaw('POST', `/lol-replays/v1/rofls/${gameId}/watch`, { componentType: 'replay-button_match-history' });
    if (!(w.status >= 200 && w.status < 300)) { log('리플레이 열기 실패 HTTP ' + w.status); return null; }
    try {
      let len = 0;   // ④ 리플레이 로딩(최대 120초)
      for (let i = 0; i < (d.loadWaitSec || 120) && !len; i++) { const p = await live('GET', '/replay/playback'); if (p.status === 200 && p.data && p.data.length > 0) len = p.data.length; else await sleep(1000); }
      if (!len) { log('리플레이 창구가 안 열림(EnableReplayApi?)'); return null; }
      log(`리플레이 열림 · 길이 ${Math.round(len)}초 (${sec()}초)`);
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
      let lastPath = null, last = 0, n = 0;
      const limit = Date.now() + ((to - startAt) * 4 + 30) * 1000;
      while (Date.now() < limit) {
        await sleep(1000);
        const [g, p] = await Promise.all([live('GET', '/replay/recording'), live('GET', '/replay/playback')]);
        const rec = g.data || {}, t = p.data ? p.data.time : null;
        if (rec.outputPath || rec.path) lastPath = rec.outputPath || rec.path;
        if (++n % 3 === 1) log(`진행 리플레이 ${t == null ? '?' : t.toFixed(1)}초 · 녹화 ${rec.recording ? '중' : '멈춤'}${rec.currentTime != null ? ' ' + Number(rec.currentTime).toFixed(1) : ''}`);
        if (t != null) last = t;
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
    } finally {
      await closeReplay();   // 열기 요청을 보냈으면 늘 정리(창구가 안 열렸어도 게임 창은 떴을 수 있음)
    }
  }

  return { record, ensureReplayApi, _findClip: findClip };
}

module.exports = makeReplayRec;
module.exports.defaults = () => ({ docsDir: path.join(os.homedir(), 'Documents', 'League of Legends', 'Highlights') });
