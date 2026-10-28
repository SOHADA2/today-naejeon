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
  const st = { phase: opt.phase || 'EndOfGame', meta: 'download', api: false, rec: null, render: {}, killed: 0 };
  const lolDir = path.join(TMP, name, 'lol'), outDir = path.join(TMP, name, 'out'), docsDir = path.join(TMP, name, 'docs');
  fs.mkdirSync(path.join(lolDir, 'Config'), { recursive: true }); fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(lolDir, 'Config', 'game.cfg'), '[General]\r\nWindowMode=2\r\n[Performance]\r\nFrameCapType=4\r\n');
  const lcuRaw = async (m, p, b) => {
    calls.push(`${m} ${p}`);
    if (p === '/lol-gameflow/v1/gameflow-phase') return { status: 200, data: st.phase };
    if (p === `/lol-replays/v1/metadata/${GID}`) return { status: 200, data: { state: st.meta } };
    if (m === 'POST' && p.endsWith('/download/graceful')) { setTimeout(() => st.meta = 'watch', 1500); return { status: 204 }; }
    if (m === 'POST' && p.endsWith('/watch')) { st.phase = 'WatchInProgress'; if (!opt.noapi) setTimeout(() => st.api = true, 1200); return { status: 204 }; }
    return { status: 404 };
  };
  const srv = https.createServer(tls, async (req, res) => {
    const b = req.method === 'POST' ? await body(req) : null; calls.push(`2999 ${req.method} ${req.url}`);
    const send = (code, j) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (!st.api) return send(404, {});
    if (req.url === '/replay/playback') return send(200, { length: 771, time: 0, paused: false });
    if (req.url === '/replay/render') { if (b) st.render = Object.assign({}, b, opt.champOnly && b.selectionName !== opt.champ ? { selectionName: '' } : {}); return send(200, st.render); }
    if (req.url === '/replay/recording') {
      if (b && b.recording) { st.rec = Object.assign({}, b, { currentTime: b.startTime }); setTimeout(() => {
        const dir = opt.toDocs ? docsDir : b.path; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'clip.webm'), Buffer.alloc(2.5 * 1048576, 1)); st.rec.recording = false; st.rec.currentTime = b.endTime; }, 2500); }
      return send(200, st.rec ? Object.assign({ path: opt.toDocs ? docsDir : st.rec.path }, st.rec) : { recording: false });
    }
    send(404, {});
  }).listen(29990, '127.0.0.1');
  const rr = makeReplayRec({ lcuRaw, lolDir: () => lolDir, log: m => opt.v && console.log('   ', m), kill: async () => { st.killed++; st.api = false; st.phase = 'EndOfGame'; }, liveBase: 'https://127.0.0.1:29990', docsDir, outDir, loadWaitSec: 6 });
  const t = Date.now();
  const out = await rr.record({ gameId: GID, from: 644, to: 659, focus: 'ap렉사이서폿', champ: opt.champ || '볼리베어' });
  srv.close();
  const cfg = fs.readFileSync(path.join(lolDir, 'Config', 'game.cfg'), 'utf8');
  return { out, st, calls, cfg, sec: ((Date.now() - t) / 1000).toFixed(1) };
}

(async () => {
  let fail = 0; const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) fail++; };
  console.log('■ ok — 지정 폴더에 녹화'); let r = await run('ok', {});
  ok(r.out && r.out.endsWith('clip.webm') && r.out.includes(path.join('ok', 'out')), `영상 경로 ${r.out} (${r.sec}초)`);
  ok(/\[General\]\r\nEnableReplayApi=1\r\nWindowMode=2/.test(r.cfg) && fs.existsSync(path.join(TMP, 'ok', 'lol', 'Config', 'game.cfg.tn-backup')), 'game.cfg [General]에 EnableReplayApi=1(CRLF 유지·백업)');
  ok(r.calls.some(c => c.endsWith('/download/graceful')) && r.calls.some(c => c.endsWith('/watch')), '받기 요청 → 리플레이 열기');
  ok(r.st.rec && r.st.rec.startTime === 644 && r.st.rec.endTime === 659 && r.st.rec.codec === 'webm' && r.st.rec.width === 768, '녹화 구간 644~659초 · webm 768×432');
  ok(r.st.render.selectionName === 'ap렉사이서폿' && r.st.render.cameraAttached === true && r.st.render.interfaceScoreboard === false, '카메라 = 주인공 따라가기 · 점수판 숨김');
  ok(r.st.killed === 1, '끝나고 리플레이 닫음');
  console.log('■ docs — 롤이 문서/Highlights에 저장'); r = await run('docs', { toDocs: true });
  ok(r.out && r.out.includes(path.join('docs', 'docs')), `영상 경로 ${r.out}`);
  console.log('■ champ — 게임 이름으로 카메라가 안 잡힘'); r = await run('champ', { champOnly: true, champ: '볼리베어' });
  ok(r.st.render.selectionName === '볼리베어' && r.out, '챔피언 이름으로 다시 지정해 녹화');
  console.log('■ noapi — 리플레이 창구가 안 열림'); r = await run('noapi', { noapi: true });
  ok(r.out === null && r.st.killed === 1, `null 돌려주고 리플레이 창 닫음 (${r.sec}초)`);
  console.log('■ ingame — 실제 게임 중'); r = await run('ingame', { phase: 'InProgress' });
  ok(r.out === null && !r.calls.some(c => c.endsWith('/watch')) && r.st.killed === 0, '아무것도 안 열고 아무것도 안 닫음');
  console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})();
