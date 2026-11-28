// 🛡️ 화면 실행 차단(CSP) 시험(v0.1.293 보안 점검) — 앱의 모든 화면 파일에 일부러 「남이 서버에 넣은 나쁜 값」을 넣어 보고 코드가 실행되지 않는지 확인
//   사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): ./node_modules/electron/dist/electron.exe tools/csp-test.cjs
//   넣어 보는 것 = <img onerror>·<svg onload>·인라인 <script>·javascript: 링크 누르기·로컬 파일 읽기(fetch file://)·바깥 사이트로 보내기(fetch https)·<iframe>·<base>
//   + 정상 동작 = 화면 스크립트가 돌았는지(window.api를 불렀는지) · 그림 오류 처리(data-err="rm")가 되는지
const { app, BrowserWindow } = require('electron');
const cmOf = (e, lv, msg, line, src) => e && typeof e.message === 'string' ? { lv: ({ info: 1, warning: 2, error: 3 })[e.level] || 0, msg: e.message, line: e.lineNumber, src: e.sourceId } : { lv, msg, line, src };   // Electron 35+ = 이벤트 객체(47에서 옛 인자 없어짐)
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..');
const PAGES = ['overlay/overlay.html', 'sidepanel/sidepanel.html', 'home/home.html', 'potg/potg.html', 'auglab/auglab.html', 'desktop/foldtab.html', 'desktop/quit-confirm.html', 'desktop/rec.html', 'potg/shrink.html', 'slot/slot.html', 'slot/cping.html'];
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let ok = 0, bad = 0; const fail = (p, m) => { bad++; console.log('✗', p, m); };
  for (const p of PAGES) {
    const html = fs.readFileSync(path.join(repo, p), 'utf8');
    if (!/http-equiv="Content-Security-Policy"/.test(html)) { fail(p, 'CSP 줄이 없음'); continue; }
    if (/<script>/.test(html) || /\son[a-z]+\s*=\s*"/.test(html.replace(/<meta[^>]*>/g, ''))) { fail(p, '인라인 스크립트·핸들러가 남아 있음'); continue; }
    const win = new BrowserWindow({ width: 400, height: 600, show: false, webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, preload: path.join(repo, 'tools', 'ui-stub-preload.js') } });
    win.webContents.setAudioMuted(true);
    const viol = []; win.webContents.on('console-message', (...a) => { const { msg } = cmOf(...a); if (/Content Security Policy|Refused to/.test(msg)) viol.push(msg.slice(0, 80)); });
    try { await win.loadFile(path.join(repo, p), p.includes('foldtab') ? { query: { side: 'L' } } : undefined); } catch (e) { fail(p, '안 열림 ' + e.message); win.destroy(); continue; }
    await new Promise(r => setTimeout(r, 600));
    const own = viol.length;   // 우리 화면 자체가 차단에 걸리면 안 됨
    const r = await win.webContents.executeJavaScript(`(async () => {
      const d = document.createElement('div'); document.body.appendChild(d); window.__x = [];
      d.innerHTML = '<img src="x-none.png" onerror="window.__x.push(\\'img\\')"><svg onload="window.__x.push(\\'svg\\')"></svg><a id="__j" href="javascript:window.__x.push(\\'href\\')">a</a><iframe src="https://example.com/"></iframe><base href="https://example.com/"><img id="__rm" data-err="rm" src="x-none2.png">';
      const s = document.createElement('script'); s.textContent = 'window.__x.push("script")'; document.body.appendChild(s);
      try { document.getElementById('__j').click(); } catch (_) {}
      const net = async u => { try { await fetch(u); return 'open'; } catch (_) { return 'blocked'; } };
      const file = await net(location.href), web = await net('https://example.com/');
      await new Promise(r => setTimeout(r, 500));
      return { ran: window.__x, file, web, base: document.baseURI.startsWith('https://example.com') ? 'changed' : 'kept', rm: !document.getElementById('__rm'), imgerr: !!document.querySelector('script[src$="imgerr.js"]') };
    })()`).catch(e => ({ err: e.message }));
    win.destroy();
    const good = r && !r.err && r.ran.length === 0 && r.file === 'blocked' && r.web === 'blocked' && r.base === 'kept' && own === 0 && (!r.imgerr || r.rm);
    if (good) ok++; else fail(p, JSON.stringify(Object.assign({ 우리화면이걸림: own }, r)));
  }
  console.log(`화면 실행 차단 시험 ${ok + bad}화면 · 통과 ${ok} · 실패 ${bad}`);
  app.exit(bad ? 1 : 0);
});
