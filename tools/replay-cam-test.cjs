// 🎥 팟지 카메라 시험(v0.1.80) — 실제 롤 리플레이로 같은 장면을 시야(fov)만 바꿔 여러 번 녹화해 비교(replayrec.js 그대로 · 창 숨김·화면 설정 되돌림 포함)
// 사용(리포 루트): node tools/replay-cam-test.cjs <게임번호> <시작초> <끝초> <주인공 게임 이름> <챔피언 이름> <연출,…> [킬 시각,…] [출력폴더]
//   연출 = 숫자(그 시야로 지금 시점) · top(지금 시점·시야 60) · tps(챔피언 등 뒤 3인칭 내내) · follow(fps+붙기 = 챔피언 추적 내내) · mix(지금 시점 → 첫 킬 1.5초 전 챔피언 추적 → 마지막 킬 1초 뒤 원래대로 · 킬 시각 필요)
//   예: node tools/replay-cam-test.cjs 8440219574 880 893 애긔반달곰 자야 top,tps,mix 883.4,886.9,889.5
//   (v0.1.80 시야 비교 = … 자야 50,60,68) · 직접 지정 = JSON을 ; 로 나눠서(아래 preset 참고)
//   ⚠️ cameraMode 'tps'(3인칭)는 리플레이가 꺼짐(2026-11-01 실기 · SentryHandleException) → 쓰지 말 것
//   ⚠️ 롤 클라가 그동안 리플레이를 열어(1~2분) 큐를 못 잡음 → 사장님께 먼저 묻기 · 설치된 투데이 내전 앱은 끄고(리플레이를 게임으로 착각) 끝나면 다시 켜기
//   ⚠️ 리플레이는 그 판에 참가한 계정 PC에서만(관전한 판은 LCU metadata 404)
//   결과 = 출력폴더의 webm(1920×1080) + 로그의 「카메라 {sel, att, mode, fov…}」 → ffmpeg로 킬 시각 프레임을 뽑아 비교(docs/screen-layout.md 3절)
const fs = require('fs'), path = require('path'), os = require('os'), https = require('https'), { spawn, execFile } = require('child_process');
const repo = path.join(__dirname, '..');
const [gameId, from, to, focus, champ, fovs, killsArg, outArg] = process.argv.slice(2);
if (!gameId || !fovs) { console.log('사용: node tools/replay-cam-test.cjs <게임번호> <시작초> <끝초> <주인공 이름> <챔피언 이름> <연출,…> [킬 시각,…] [출력폴더]'); process.exit(1); }
const kills = String(killsArg || '').split(',').map(Number).filter(Number.isFinite).sort((a, b) => a - b);
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
  const preset = v => {
    if (v === 'top') return { fov: 60 };
    if (v === 'tps') return { fov: 60, cam: { cameraMode: 'tps' } };   // ⚠️ 리플레이가 꺼짐(쓰지 말 것)
    if (v === 'follow') return { fov: 60, cam: { cameraMode: 'fps', cameraAttached: true } };   // 챔피언 추적(2026-11-01 실기: top·focus는 붙기가 안 먹고 fps+붙기만 실제로 따라감)
    if (v === 'mix') { if (!kills.length) throw new Error('mix는 킬 시각이 필요해요'); return { fov: 60, camAt: [{ t: kills[0] - 1.5, set: { cameraMode: 'fps', cameraAttached: true } }, { t: kills[kills.length - 1] + 1, set: { cameraMode: 'top', cameraAttached: true } }] }; }
    // 🎥 섞은 연출(2026-11-01 실기로 찾은 진짜 따라가기 = fps+붙기+selectionOffset): 평소 ②(같은 거리·주인공 가운데) → 첫 킬 1.2초 전부터 0.9초 동안 ③(더 가까이)/④(가깝고 낮게)로 다가감 → 마지막 킬 0.8초 뒤부터 1초 동안 ②로 빠짐
    const CAM = { far: { y: 1492, z: -1006, r: 56 }, near: { y: 1000, z: -675, r: 56 }, low: { y: 700, z: -835, r: 40 } };
    const follow = c => ({ cameraMode: 'fps', cameraAttached: true, selectionOffset: { x: 0, y: c.y, z: c.z }, cameraRotation: { x: 0, y: c.r, z: 0 } });
    if (v === 'far' || v === 'near' || v === 'low') return { fov: 60, cam: follow(CAM[v]) };
    if (v === 'mixseq') {   // ② + 키프레임으로 시야만 60→40(확대)→60 — 롤이 매 프레임 부드럽게 이음(계단식 camAt 대신)
      if (!kills.length) throw new Error('mixseq는 킬 시각이 필요해요');
      const k0 = kills[0], kN = kills[kills.length - 1], kf = (time, value) => ({ time: +time.toFixed(2), value, blend: 'smoothStep' });
      return { fov: 60, cam: follow(CAM.far), seq: { fieldOfView: [kf(k0 - 1.4, 60), kf(k0 - 0.3, 40), kf(kN + 0.6, 40), kf(kN + 1.8, 60)] } };
    }
    if (v.startsWith("direct:")) {   // 🎥 연출 카메라(replayrec direct) · direct:<잡힌 상대 게임 이름>@<킬 시각>[@영문 챔피언 이름]|… · 소개 2.4초를 위해 시작을 2초 앞당김
      const victims = v.slice(7).split('|').map(x => { const [name, t, alias] = x.split('@'); return { name, t: +t, alias }; }).filter(x => x.name && Number.isFinite(x.t));   // direct: 만 쓰면 상대 없음(숨은 영웅)
      return { fov: 60, from: +from - 2, direct: { victims } };
    }
    if (v === 'rampnear' || v === 'ramplow') {   // mixnear/mixlow와 같은 움직임을 매 프레임 이어서(camRamp) — 계단식 버벅임 없앰
      if (!kills.length) throw new Error(v + '는 킬 시각이 필요해요');
      const B = follow(CAM.far), N = follow(CAM[v === 'rampnear' ? 'near' : 'low']), pick = c => ({ selectionOffset: c.selectionOffset, cameraRotation: c.cameraRotation });
      return { fov: 60, cam: B, camRamp: [{ t0: kills[0] - 1.2, t1: kills[0] - 0.3, from: pick(B), to: pick(N) }, { t0: kills[kills.length - 1] + 0.8, t1: kills[kills.length - 1] + 1.8, from: pick(N), to: pick(B) }] };
    }
    if (v === 'mixnear' || v === 'mixlow') {
      if (!kills.length) throw new Error(v + '는 킬 시각이 필요해요');
      const B = CAM.far, N = CAM[v === 'mixnear' ? 'near' : 'low'], camAt = [];
      const ramp = (t0, dur, A, Z) => { for (let i = 1; i <= 12; i++) { const k = i / 12, e = k * k * (3 - 2 * k), m = (x, y) => Math.round(x + (y - x) * e); camAt.push({ t: +(t0 + dur * k).toFixed(2), set: { selectionOffset: { x: 0, y: m(A.y, Z.y), z: m(A.z, Z.z) }, cameraRotation: { x: 0, y: +(A.r + (Z.r - A.r) * e).toFixed(1), z: 0 } } }); } };
      ramp(kills[0] - 1.2, 0.9, B, N); ramp(kills[kills.length - 1] + 0.8, 1.0, N, B);
      return { fov: 60, cam: follow(B), camAt };
    }
    if (v === 'zoom') {   // 3인칭 대신: 첫 킬 1.5초 전부터 0.1초마다 시야 60→42·주인공을 가운데로(selectionOffset z 0→700) · 마지막 킬 0.6초 뒤부터 되돌림
      if (!kills.length) throw new Error('zoom은 킬 시각이 필요해요');
      const camAt = [], ramp = (t0, dur, f0, f1, z0, z1) => { for (let i = 0; i <= 10; i++) { const k = i / 10, e = k * k * (3 - 2 * k); camAt.push({ t: +(t0 + dur * k).toFixed(2), set: { fieldOfView: +(f0 + (f1 - f0) * e).toFixed(1), selectionOffset: { x: 0, y: 0, z: Math.round(z0 + (z1 - z0) * e) } } }); } };
      ramp(kills[0] - 1.5, 1.0, 60, 42, 0, 700); ramp(kills[kills.length - 1] + 0.6, 1.2, 42, 60, 700, 0);
      return { fov: 60, camAt };
    }
    if (v.startsWith('{')) return JSON.parse(v);   // 직접 지정: {"fov":45,"cam":{"cameraRotation":{"x":0,"y":40,"z":0}},"from":883,"to":887}
    return { fov: +v || undefined };
  };
  const names = String(fovs).includes('{') ? String(fovs).split(';') : String(fovs).split(',');   // JSON 연출은 ; 로 나눔
  const parts = names.map(v => Object.assign({}, base, preset(v)));   // 연출에 from/to가 있으면 그 구간
  console.log('연출', names.join(' / '), '· 킬', kills.join(', ') || '-', '· 출력', out);
  const files = await rr.record({ gameId: +gameId, parts });
  console.log('영상', JSON.stringify(files, null, 1));
})();
