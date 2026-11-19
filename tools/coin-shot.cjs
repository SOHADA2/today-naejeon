// 🪙 선픽 동전 3D 캡처(화면 밖 · v0.1.229) — 시각을 고정해 그 순간을 그림(window.__coinClock) · ui-shot과 달리 그래픽 가속을 끄지 않음(WebGL이 있어야 3D 동전이 그려짐)
//   사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): electron tools/coin-shot.cjs <출력 폴더> [폭=402] [높이=720]
//   환경 변수: COIN_TIMES="0.10,0.70,1.63"(초 · 0.34 튕김 · 1.62 멈춤) · COIN_TEAMS="A,B"(1팀/2팀 선픽) → coin-<팀>-<초>.png
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2).filter(a => !a.startsWith("-") && !/coin-shot.cjs$/.test(a));
const repo = path.join(__dirname, ".."), outDir = args[0], w0 = args[1] || "402", h0 = args[2] || "720";
if (!outDir) { console.error("사용: electron tools/coin-shot.cjs <출력 폴더> [폭] [높이]"); process.exit(1); }
const W = +w0, H = +h0;
const TIMES = (process.env.COIN_TIMES || '0.10,0.33,0.45,0.70,1.00,1.30,1.55,1.63,1.75,2.60').split(',').map(Number);
const TEAMS = (process.env.COIN_TEAMS || 'A,B').split(',');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const team of TEAMS) for (const T of TIMES) {
    const win = new BrowserWindow({ width: W, height: H, show: false, frame: false, transparent: true,
      webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, preload: path.join(repo, 'tools', 'ui-stub-preload.js') } });
    win.webContents.setAudioMuted(true);
    const logs = [];
    win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) logs.push(msg); });
    await win.loadFile(path.join(repo, 'overlay', 'overlay.html'));
    await new Promise(r => setTimeout(r, 900));
    const sess = { phase: 'draft', mode: 'draft', captains: { teamA: '테스터에이', teamB: '열여섯글자이름열여섯글자이름가나' }, teamA: ['테스터에이'], teamB: ['열여섯글자이름열여섯글자이름가나'], pool: ['테스터비', '테스터씨', '띄어 쓴 이름', '테스터E'], order: ['teamA', 'teamB', 'teamB', 'teamA'], pickIdx: 0, teamSize: 3, firstPick: team === 'A' ? 'teamA' : 'teamB' };
    const info = await win.webContents.executeJavaScript(`(async () => {
      await window.coin3d.preload();
      window.__coinClock = () => ${T};
      const s = ${JSON.stringify(sess)}; s.draftStartedAt = Date.now(); s.turnEndsAt = Date.now() + 33800;
      __emit('settings', { tutorialSeen: true, tutorialDc: true });
      __emit('session', { session: s, myName: '테스터에이', isHost: true });
      await new Promise(r => setTimeout(r, ${T >= 1.62 ? 1100 : 500}));
      return JSON.stringify({ ok3d: window.coin3d.ok, ready: window.coin3d.ready(), cn3d: document.getElementById('coin').classList.contains('cn3d'), canvas: !!document.querySelector('.cn-3d'), disp: document.getElementById('coin').style.display });
    })()`);
    const img = await win.webContents.capturePage();
    const name = `coin-${team}-${String(T.toFixed(2)).replace('.', '_')}.png`;
    fs.writeFileSync(path.join(outDir, name), img.toPNG());
    console.log('saved', name, info, logs.slice(0, 3).join(' | '));
    win.destroy();
  }
  app.exit(0);
});
