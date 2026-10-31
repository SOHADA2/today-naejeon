// 🎥 팟지 카메라 시험(v0.1.80) — 실제 롤 리플레이로 같은 장면을 시야(fov)만 바꿔 여러 번 녹화해 비교(replayrec.js 그대로 · 창 숨김·화면 설정 되돌림 포함)
// 사용(리포 루트): node tools/replay-cam-test.cjs <게임번호> <시작초> <끝초> <주인공 게임 이름> <챔피언 이름> <시야,시야,…> [출력폴더]
//   예: node tools/replay-cam-test.cjs 8440219574 880 893 애긔반달곰 자야 50,60,68
//   ⚠️ 롤 클라가 그동안 리플레이를 열어(1~2분) 큐를 못 잡음 → 사장님께 먼저 묻기 · 설치된 투데이 내전 앱은 끄고(리플레이를 게임으로 착각) 끝나면 다시 켜기
//   ⚠️ 리플레이는 그 판에 참가한 계정 PC에서만(관전한 판은 LCU metadata 404)
//   결과 = 출력폴더의 webm(1920×1080) + 로그의 「카메라 {sel, att, mode, fov…}」 → ffmpeg로 킬 시각 프레임을 뽑아 비교(docs/screen-layout.md 3절)
const fs = require('fs'), path = require('path'), os = require('os'), https = require('https'), { spawn, execFile } = require('child_process');
const repo = path.join(__dirname, '..');
const [gameId, from, to, focus, champ, fovs, outArg] = process.argv.slice(2);
if (!gameId || !fovs) { console.log('사용: node tools/replay-cam-test.cjs <게임번호> <시작초> <끝초> <주인공 이름> <챔피언 이름> <시야,…> [출력폴더]'); process.exit(1); }
const out = outArg || fs.mkdtempSync(path.join(os.tmpdir(), 'replay-cam-'));
const makeReplayRec = require(path.join(repo, 'replayrec.js'));
const LOL = process.env.LOL_DIR || 'C:/Riot Games/League of Legends';
const lcuRaw = (method, p, body) => new Promise(resolve => {
  const [, , port, pw] = fs.readFileSync(path.join(LOL, 'lockfile'), 'utf8').split(':');
  const data = body == null ? null : JSON.stringify(body);
  const req = https.request({ host: '127.0.0.1', port, path: p, method, rejectUnauthorized: false, auth: 'riot:' + pw, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
    let s = ''; res.setEncoding('utf8'); res.on('data', c => s += c); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (_) {} resolve({ status: res.statusCode, data: j }); });
  });
  req.on('error', () => resolve({ status: 0, data: null })); if (data) req.write(data); req.end();
});
const src = fs.readFileSync(path.join(repo, 'main.js'), 'utf8'); const a = src.indexOf('const HIDE_PS = String.raw`') + 27; const HIDE_PS = src.slice(a, src.indexOf('`;', a));
function hideWindow() {   // main.js hideReplayWindow와 같음
  const run = (mode, sec) => spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(`& {${HIDE_PS}} ${mode} ${sec}`, 'utf16le').toString('base64')], { windowsHide: true });
  let moved = 0; const ps = run('hide', 300); ps.stdout.on('data', b => { const m = String(b).match(/moved (\d+)/g); if (m) moved = +m[m.length - 1].split(' ')[1]; });
  const stop = () => { try { ps.kill(); } catch (_) {} return moved; };
  return { stop, show: () => { stop(); run('show', 10); } };
}
const rr = makeReplayRec(Object.assign(makeReplayRec.defaults(), {
  lcuRaw, lolDir: () => LOL, outDir: out,
  kill: (pid) => new Promise(r => execFile('taskkill', pid ? ['/PID', String(pid), '/F'] : ['/IM', 'League of Legends.exe', '/F'], () => r())),
  log: m => console.log(new Date().toTimeString().slice(0, 8), m), restoreFile: path.join(out, 'restore.json'), borderlessFile: path.join(out, 'bl.json'), hideWindow,
}));
(async () => {
  const base = { from: +from, to: +to, focus, champ };
  const parts = String(fovs).split(',').map(f => Object.assign({ fov: +f || undefined }, base));
  const files = await rr.record({ gameId: +gameId, parts });
  console.log('영상', JSON.stringify(files, null, 1));
})();
