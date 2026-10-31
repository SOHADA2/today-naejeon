// 🧪 팟지 리플레이 녹화(replayrec.js) 시험 — 가짜 롤 클라(LCU) + 가짜 리플레이 창구(2999 대신 29990)로 처음부터 끝까지
// 사용: node tools/replayrec-test.cjs   (openssl 필요 · Firebase 안 씀 · 롤 없이 됨)
// 시나리오: ok(지정 폴더에 저장) · docs(문서/Highlights에 저장) · champ(게임 이름으로 카메라 안 잡힘→챔피언 이름) · noapi(창구 안 열림) · ingame(게임 중이면 안 함)
const https = require('https'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const makeReplayRec = require('../replayrec');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'replayrec-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(TMP, 'k.pem'), '-out', path.join(TMP, 'c.pem'), '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
const tls = { key: fs.readFileSync(path.join(TMP, 'k.pem')), cert: fs.readFileSync(path.join(TMP, 'c.pem')) };
const body = req => new Promise(r => { let s = ''; req.on('data', c => s += c); req.on('end', () => { try { r(JSON.parse(s)); } catch (_) { r(null); } }); });

async function run(name, opt) {
  const GID = 8436539295, calls = [];
  const st = { phase: opt.phase || 'EndOfGame', meta: 'download', api: false, rec: null, render: {}, killed: 0, t: 0, paused: false, wall: Date.now(), seekUntil: 0, seeks: [], recs: [], hidden: false, hides: 0, shown: 0, cfgDuring: null };
  const lolDir = path.join(TMP, name, 'lol'), outDir = path.join(TMP, name, 'out'), docsDir = path.join(TMP, name, 'docs');
  fs.mkdirSync(path.join(lolDir, 'Config'), { recursive: true }); fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(lolDir, 'Config', 'game.cfg'), '[General]\r\nWindowMode=2\r\n[Performance]\r\nFrameCapType=4\r\n');
  const lcuRaw = async (m, p, b) => {
    calls.push(`${m} ${p}`);
    if (p === '/lol-gameflow/v1/gameflow-phase') return { status: 200, data: st.phase };
    if (p === `/lol-replays/v1/metadata/${GID}`) return { status: 200, data: { state: st.meta } };
    if (m === 'POST' && p.endsWith('/download/graceful')) { setTimeout(() => st.meta = 'watch', 1500); return { status: 204 }; }
    if (m === 'POST' && p.endsWith('/watch')) { st.cfgDuring = fs.readFileSync(path.join(lolDir, 'Config', 'game.cfg'), 'utf8'); st.phase = 'WatchInProgress'; if (opt.realGameAfter) setTimeout(() => { st.phase = 'GameStart'; }, opt.realGameAfter); if (!opt.noapi) setTimeout(() => st.api = true, 1200); return { status: 204 }; }
    return { status: 404 };
  };
  const srv = https.createServer(tls, async (req, res) => {
    const b = req.method === 'POST' ? await body(req) : null; calls.push(`2999 ${req.method} ${req.url}`);
    const send = (code, j) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (!st.api) return send(404, {});
    const frozen = opt.stallHidden && st.hidden;   // stall: 화면 밖이면 롤이 안 그림(재생 멈춤)
    if (frozen && !st.frozeAt) { st.frozeAt = Date.now(); st.t = st.t + (Date.now() - st.wall) / 1000; }
    if (!frozen && st.frozeAt) { st.frozeAt = 0; st.wall = Date.now(); }
    const now = () => st.paused || frozen || Date.now() < st.seekUntil ? st.t : st.t + (Date.now() - st.wall) / 1000;
    const finish = () => { if (st.rec && st.rec.recording && now() >= st.rec.endTime) {   // 리플레이 시간이 endTime 지나면 파일 생김
      const dir = opt.toDocs ? docsDir : st.rec.path; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, st.nClip ? `clip${st.nClip + 1}.webm` : 'clip.webm'), Buffer.alloc(2.5 * 1048576, 1)); st.nClip = (st.nClip || 0) + 1; st.recs.push(Object.assign({}, st.rec)); st.rec.recording = false; } };
    if (req.url === '/replay/playback') {
      if (b) { const t = now(); if (b.time != null) { st.t = b.time; st.seekUntil = Date.now() + 2000; st.seeks.push(b.time); } else st.t = t; if (b.paused != null) st.paused = b.paused; st.wall = Math.max(Date.now(), st.seekUntil); }
      finish(); return send(200, { length: 771, time: now(), paused: st.paused, seeking: Date.now() < st.seekUntil, speed: 1 });
    }
    if (req.url === '/replay/render') { if (b) st.render = Object.assign({}, b, opt.champOnly && b.selectionName !== opt.champ ? { selectionName: '' } : {}); return send(200, st.render); }
    if (req.url === '/replay/recording') {
      if (b && b.recording) { st.rec = Object.assign({}, b); st.recAt = now(); }
      finish(); return send(200, st.rec ? Object.assign({ outputPath: opt.toDocs ? docsDir : st.rec.path, currentTime: now() }, st.rec) : { recording: false });
    }
    send(404, {});
  }).listen(29990, '127.0.0.1');
  const rr = makeReplayRec({ lcuRaw, lolDir: () => lolDir, log: m => opt.v && console.log('   ', m), kill: async () => { st.killed++; st.api = false; st.phase = 'EndOfGame'; }, liveBase: 'https://127.0.0.1:29990', docsDir, outDir, loadWaitSec: 6, restoreFile: path.join(TMP, name, 'restore.json'),
    hideWindow: () => { st.hidden = true; st.hides++; return { stop: () => { st.hidden = false; return 3; }, show: () => { st.hidden = false; st.shown++; } }; } });
  const t = Date.now();
  const out = await rr.record(opt.parts ? { gameId: GID, parts: opt.parts } : { gameId: GID, from: 644, to: 650, focus: 'ap렉사이서폿', champ: opt.champ || '볼리베어' });
  srv.close();
  const cfg = fs.readFileSync(path.join(lolDir, 'Config', 'game.cfg'), 'utf8');
  return { out, st, calls, cfg, sec: ((Date.now() - t) / 1000).toFixed(1), restoreLeft: fs.existsSync(path.join(TMP, name, 'restore.json')) };
}

(async () => {
  let fail = 0; const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) fail++; };
  console.log('■ ok — 지정 폴더에 녹화'); let r = await run('ok', {});
  ok(r.out && r.out.endsWith('clip.webm') && r.out.includes(path.join('ok', 'out')), `영상 경로 ${r.out} (${r.sec}초)`);
  ok(/\[General\]\r\nEnableReplayApi=1\r\nWindowMode=2\r\n\[Performance\]/.test(r.cfg) && fs.existsSync(path.join(TMP, 'ok', 'lol', 'Config', 'game.cfg.tn-backup')), 'game.cfg 끝나면 EnableReplayApi=1만 남고 창 설정은 원래대로(WindowMode=2·Width/Height 없음·CRLF)');
  ok(/WindowMode=1\r\n/.test(r.st.cfgDuring) && /Width=1920\r\n/.test(r.st.cfgDuring) && /Height=1080\r\n/.test(r.st.cfgDuring) && !r.restoreLeft, '녹화 동안만 창 모드 1920×1080 · 되돌림 기록 지움');
  ok(r.st.hides === 1 && !r.st.hidden && r.st.shown === 0, '리플레이 창 숨김 → 끝나고 숨기기 멈춤');
  ok(r.calls.some(c => c.endsWith('/download/graceful')) && r.calls.some(c => c.endsWith('/watch')), '받기 요청 → 리플레이 열기');
  ok(r.st.rec && r.st.rec.startTime === 644 && r.st.rec.endTime === 650 && r.st.rec.codec === 'webm', '녹화 구간 644~650초 · webm');
  ok(r.st.seeks[0] === 641 && r.st.recAt <= 641.5, `되감기 끝난 뒤 3초 앞(641초)부터 재생하며 녹화 (녹화 요청 때 리플레이 ${r.st.recAt.toFixed(1)}초)`);
  ok(r.st.render.selectionName === 'ap렉사이서폿' && r.st.render.cameraAttached === true && r.st.render.interfaceScoreboard === false, '카메라 = 주인공 따라가기 · 점수판 숨김');
  ok(r.st.killed === 1, '끝나고 리플레이 닫음');
  console.log('■ stall — 화면 밖에선 롤이 리플레이를 안 그림'); r = await run('stall', { stallHidden: true });
  ok(r.out && r.st.shown === 1, `6초 멈춤 → 화면 안으로 꺼내 이어서 녹화 (${r.sec}초)`);
  console.log('■ restore — 녹화 도중 앱이 꺼졌다 다시 켜짐');
  { const dir = path.join(TMP, 'rs', 'Config'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, 'game.cfg');
    fs.writeFileSync(f, '[General]\r\nWindowMode=1\r\nWidth=1920\r\nHeight=1080\r\nEnableReplayApi=1\r\n'); const rf = path.join(TMP, 'rs', 'restore.json');
    fs.writeFileSync(rf, JSON.stringify({ f, before: { WindowMode: '0', Width: '3440', Height: null } }));
    makeReplayRec({ lcuRaw: async () => ({ status: 0 }), lolDir: () => null, log() {}, kill: async () => {}, outDir: TMP, restoreFile: rf }).restorePending();
    const c = fs.readFileSync(f, 'utf8'); ok(c === '[General]\r\nWindowMode=0\r\nWidth=3440\r\nEnableReplayApi=1\r\n' && !fs.existsSync(rf), '다음 실행 때 원래 값으로(없던 Height 줄은 지움)'); }
  console.log('■ docs — 롤이 문서/Highlights에 저장'); r = await run('docs', { toDocs: true });
  ok(r.out && r.out.includes(path.join('docs', 'docs')), `영상 경로 ${r.out}`);
  console.log('■ champ — 게임 이름으로 카메라가 안 잡힘'); r = await run('champ', { champOnly: true, champ: '볼리베어' });
  ok(r.st.render.selectionName === '볼리베어' && r.out, '챔피언 이름으로 다시 지정해 녹화');
  console.log('■ noapi — 리플레이 창구가 안 열림'); r = await run('noapi', { noapi: true });
  ok(r.out === null && r.st.killed === 1, `null 돌려주고 리플레이 창 닫음 (${r.sec}초)`);
  console.log('■ two — 팟지 + 숨은 영웅 두 장면을 리플레이 한 번에'); r = await run('two', { parts: [{ from: 644, to: 650, focus: 'ap렉사이서폿', champ: '볼리베어' }, { from: 600, to: 606, focus: '탱커왕', champ: '말파이트' }] });
  ok(Array.isArray(r.out) && r.out.length === 2 && r.out[0] && r.out[1] && r.out[0] !== r.out[1], `영상 2개 ${(r.out || []).map(p => p && path.basename(p)).join(', ')} (${r.sec}초)`);
  ok(r.st.recs.length === 2 && r.st.recs[1].startTime === 600 && r.st.render.selectionName === '탱커왕' && r.st.killed === 1 && r.calls.filter(c => c.endsWith('/watch')).length === 1, '리플레이는 한 번만 열고 닫음 · 둘째 장면은 그 사람 카메라');
  console.log('■ fov — 장면마다 카메라 시야(v0.1.80)'); r = await run('fov', { parts: [{ from: 644, to: 650, focus: 'ap렉사이서폿', champ: '볼리베어', fov: 68 }] });
  ok(r.st.render.fieldOfView === 68, `리플레이 카메라 시야 68로 바꿈(${r.st.render.fieldOfView})`);
  console.log('■ realgame — 녹화 도중 실제 게임이 시작됨(v0.1.80)'); r = await run('realgame', { realGameAfter: 4500, parts: [{ from: 644, to: 650, focus: 'ap렉사이서폿', champ: '볼리베어' }, { from: 600, to: 606, focus: '탱커왕', champ: '말파이트' }] });
  ok(Array.isArray(r.out) && r.out.every(x => x === null) && r.st.killed === 0, `녹화 멈추고 실제 게임은 안 끔(영상 ${JSON.stringify(r.out)} · 끈 횟수 ${r.st.killed})`);
  console.log('■ ingame — 실제 게임 중'); r = await run('ingame', { phase: 'InProgress' });
  ok(r.out === null && !r.calls.some(c => c.endsWith('/watch')) && r.st.killed === 0, '아무것도 안 열고 아무것도 안 닫음');
  console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})();
