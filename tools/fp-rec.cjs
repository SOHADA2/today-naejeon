// 🎥 선픽 줄다리기를 한 장씩 정확히 녹화(v0.1.230) — 시계를 정해 그리고(window.__fpClock·__fpPaint) 캡처 → 사장님께 보여 줄 시안 영상을 만들 때
//   (화면 밖 창을 실시간으로 녹화하면 1초에 20장쯤만 그려져 「버벅여」 보임 → 한 장씩)
//   사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): electron tools/fp-rec.cjs <출력 폴더>   → frames-A(1팀 선픽 · 뒤집기) · frames-B(2팀 선픽 · 밀어붙이기)/f0000.png …
//   환경 변수: TEAMS=A,B · FPS=30 · LEN=4.8(초) · PRE=0.35(시작 전 드래프트 화면) · W=402 · H=720 · ICONS=1(예시 롤 아이콘을 얼굴에 넣음 · 인터넷)
//   영상으로(ffmpeg는 꼭 -nostdin + < /dev/null): ffmpeg -nostdin -framerate 30 -i frames-A/f%04d.png -i assets/sfx/firstpick.ogg
//     -filter_complex "[0:v]format=yuv420p[v];[1:a]adelay=367:all=1,apad=whole_dur=5.17[a]" -map "[v]" -map "[a]" -t 5.17 -c:v libx264 -crf 16 -c:a aac out.mp4 < /dev/null   (367ms = PRE 11장)
const { app, BrowserWindow, net } = require('electron');
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..'), outDir = process.argv.slice(2).filter(a => !a.startsWith('-') && !/fp-rec.cjs$/.test(a))[0];
if (!outDir) { console.error('사용: electron tools/fp-rec.cjs <출력 폴더>'); process.exit(1); }
const W = +(process.env.W || 402), H = +(process.env.H || 720), FPS = +(process.env.FPS || 30), LEN = +(process.env.LEN || 4.8), PRE = +(process.env.PRE || 0.35);
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let ver = null; if (process.env.ICONS === '1') try { ver = (await (await net.fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]; } catch (_) {}
  for (const team of (process.env.TEAMS || 'A,B').split(',')) {
    const dir = path.join(outDir, 'frames-' + team); fs.mkdirSync(dir, { recursive: true });
    const win = new BrowserWindow({ width: W, height: H, show: false, frame: false, transparent: true,
      webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, preload: path.join(repo, 'tools', 'ui-stub-preload.js') } });
    win.webContents.setAudioMuted(true);
    await win.loadFile(path.join(repo, 'overlay', 'overlay.html'));
    await new Promise(r => setTimeout(r, 900));
    const sess = { phase: 'draft', mode: 'draft', captains: { teamA: '테스터에이', teamB: '열여섯글자이름열여섯글자이름가나' }, teamA: ['테스터에이'], teamB: ['열여섯글자이름열여섯글자이름가나'], pool: ['테스터씨', '띄어 쓴 이름', '테스터E', '테스터G'], order: ['teamA', 'teamB', 'teamB', 'teamA'], pickIdx: 0, teamSize: 3, firstPick: team === 'A' ? 'teamA' : 'teamB' };
    await win.webContents.executeJavaScript(`(async () => {
      window.__fpSeed = ${team === 'A' ? 0 : 1}; window.__fpClock = () => 0;
      __emit('settings', { tutorialSeen: true, tutorialDc: true });
      const s = ${JSON.stringify(sess)}; s.turnEndsAt = Date.now() + 34400;
      __emit('session', { session: Object.assign({}, s, { draftStartedAt: 0, firstPick: null }), myName: '테스터에이', isHost: true });
      await new Promise(r => setTimeout(r, 400));
      window.__go = () => { const _st = window.setTimeout; window.setTimeout = (fn, d, ...a) => (d >= 1000 ? 0 : _st(fn, d, ...a)); s.draftStartedAt = Date.now(); __emit('session', { session: s, myName: '테스터에이', isHost: true }); window.setTimeout = _st; window.__anims = document.getAnimations(); window.__anims.forEach(a => a.pause()); };
    })()`);
    const shot = async (n) => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(dir, 'f' + String(n).padStart(4, '0') + '.png'), img.toPNG()); };
    let n = 0;
    for (let k = 0; k < Math.round(PRE * FPS); k++) await shot(n++);   // 시작 전
    await win.webContents.executeJavaScript('window.__go(); new Promise(r => setTimeout(r, 200))');
    if (ver) { const ok = await win.webContents.executeJavaScript(`(async () => { const ids = { '테스터에이': 4568, '열여섯글자이름열여섯글자이름가나': 4661 }; const jobs = []; document.querySelectorAll('.tw-in, .tw-res').forEach(b => { const nm = (b.querySelector('.tw-nm') || {}).textContent, av = b.querySelector('.tw-av'); if (!av || !ids[nm]) return; const im = new Image(); jobs.push(new Promise(r => { im.onload = () => r(1); im.onerror = () => { im.remove(); r(0); }; setTimeout(() => r(0), 6000); })); im.src = 'https://ddragon.leagueoflegends.com/cdn/${ver}/img/profileicon/' + ids[nm] + '.png'; av.appendChild(im); }); return (await Promise.all(jobs)).join(''); })()`); console.log('icons', ok); }   // 층의 나타남·사라짐(WAAPI)은 멈춰 두고 시계에 맞춰 돌림 · 긴 타이머(연출 끝)는 녹화 동안 안 돎
    for (let k = 0; k < Math.round(LEN * FPS); k++) {
      const T = k / FPS;
      await win.webContents.executeJavaScript(`window.__fpClock = () => ${T}; (window.__anims || []).forEach(a => { a.currentTime = ${T * 1000}; }); if (window.__fpPaint) window.__fpPaint(${T * 1000}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
      await shot(n++);
    }
    console.log(team, 'frames', n, 'start', Math.round(PRE * FPS));
    win.destroy();
  }
  app.exit(0);
});
