// 🎬 팟지 미리보기 영상 만들기(v0.1.41) — 실제 팟지 창(potg/potg.html·potg.js)을 화면에 안 띄우고(offscreen) 재생하며 녹화
//   화면 = offscreen 'paint' 프레임 → 30fps로 고름 · 소리 = 재생 중 기록(영상·BGM 위치/볼륨·효과음 시각)대로 tools/potg-preview-mix.py가 다시 섞음
// 사용(리포 루트, ELECTRON_RUN_AS_NODE 끄고): electron tools/potg-preview.cjs <영상.webm> <card.json> <출력폴더>
//   card.json = 팟지 카드(potg.js가 받는 것과 같은 모양, clip은 {n:1} 아무거나) · 출력 = frames/*.jpg + log.json
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const [clipFile, cardFile, outDir] = process.argv.slice(-3);
const W = +process.env.PREVIEW_W || 960, H = Math.round(W * 9 / 16 + 136), FPS = 30;   // PREVIEW_W=560 = 가장 좁은 팟지 창
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const repo = path.join(__dirname, '..');
  fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });
  const clipCopy = path.join(repo, 'potg', '_preview_clip' + path.extname(clipFile));
  fs.copyFileSync(clipFile, clipCopy);
  const clip2 = process.env.PREVIEW_CLIP2 ? path.join(repo, 'potg', '_preview_clip2' + path.extname(process.env.PREVIEW_CLIP2)) : clipCopy;   // 숨은 영웅 영상(card.hero.clip = {n:1, hero:1})
  if (clip2 !== clipCopy) fs.copyFileSync(process.env.PREVIEW_CLIP2, clip2);
  const url = p => 'file:///' + p.replace(/\\/g, '/');
  const page = path.join(repo, 'potg', '_preview.html');
  fs.writeFileSync(page, fs.readFileSync(path.join(repo, 'potg', 'potg.html'), 'utf8').replace('<script src="../desktop/settings.js"></script>',
    `<script>window.__tnVol = 1; window.api = { onPotg: cb => (window.__cb = cb), potgClip: async m => ({ url: m && m.hero ? ${JSON.stringify(url(clip2))} : ${JSON.stringify(url(clipCopy))} }), potgSave: async () => ({}), potgClose: () => {} };</script>`));
  const win = new BrowserWindow({ width: W, height: H, show: false, frame: false, webPreferences: { offscreen: true, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false } });
  win.webContents.setAudioMuted(true);   // 스피커로 안 나감(재생·시각은 그대로)
  win.webContents.setFrameRate(FPS);
  const frames = []; let t0 = null;
  win.webContents.on('paint', (_e, _d, img) => { if (t0 == null) return; frames.push({ t: (Date.now() - t0) / 1000, jpg: img.toJPEG(88) }); });
  await win.loadFile(page);
  await new Promise(r => setTimeout(r, 1500));   // 소리·글꼴 미리 불러오기
  const card = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
  t0 = Date.now();
  await win.webContents.executeJavaScript(`(() => {
    window.__L = { ev: [], s: [], t0: performance.now() };
    const now = () => (performance.now() - __L.t0) / 1000;
    const ps = playSfx; playSfx = (n, g) => { __L.ev.push({ n, t: now(), g: g || 1 }); ps(n, g); };
    (function loop() { const v = el('pg-video'); __L.s.push([now(), v.currentTime, v.paused || v.ended || !v.src ? 0 : 1, v.volume, v.playbackRate, bgm.a.currentTime, bgm.a.paused ? 0 : 1, bgm.a.volume, /_preview_clip2/.test(v.src) ? 1 : 0]); requestAnimationFrame(loop); })();
    window.__cb({ card: ${JSON.stringify(card)}, manual: true }); return 1; })()`);
  for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 500)); if (await win.webContents.executeJavaScript(`document.getElementById('pg-end').style.display === ''`)) break; }
  await new Promise(r => setTimeout(r, 5600));   // 끝 화면 + BGM 페이드
  const log = JSON.parse(await win.webContents.executeJavaScript('JSON.stringify(__L)'));
  const dur = (Date.now() - t0) / 1000;
  let j = 0, n = 0;
  for (let t = 0; t < dur; t += 1 / FPS) { while (j + 1 < frames.length && frames[j + 1].t <= t) j++; if (!frames.length) break; fs.writeFileSync(path.join(outDir, 'frames', String(n++).padStart(5, '0') + '.jpg'), frames[j].jpg); }
  fs.writeFileSync(path.join(outDir, 'log.json'), JSON.stringify({ ...log, dur, frames: n, fps: FPS }));
  fs.unlinkSync(page); fs.unlinkSync(clipCopy); if (clip2 !== clipCopy) fs.unlinkSync(clip2);
  console.log(`frames ${n} · ${dur.toFixed(1)}s · 효과음 ${log.ev.map(e => e.n + '@' + e.t.toFixed(2)).join(' ')}`);
  app.exit(0);
});
