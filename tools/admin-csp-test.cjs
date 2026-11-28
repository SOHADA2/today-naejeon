// 🛡️ 운영 보드 실행 차단(CSP) 시험(2026-11-28) — 진짜 docs/admin을 로컬 웹 서버로 띄우고(홈페이지와 같은 주소 구조) 진짜 Firebase를 불러와 봄
//   사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): ./node_modules/electron/dist/electron.exe tools/admin-csp-test.cjs
//   확인 = ① 페이지·글꼴·Firebase 모듈이 차단 위반 없이 뜨고 로그인 버튼이 보임 ② 로그인 버튼 → 구글 로그인 창이 열리고 본 페이지에 위반 없음(실제 로그인은 안 함 · 창은 닫음)
//          ③ 일부러 넣은 인라인 스크립트·onerror가 실행되지 않음
const { app, BrowserWindow } = require('electron');
const http = require('http'), fs = require('fs'), path = require('path');
app.on('window-all-closed', () => {});
const ROOT = path.join(__dirname, '..', 'docs'), TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, bad = 0; const T = (n, c, x) => { c ? ok++ : bad++; console.log(c ? '✅' : '❌', n, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); };
app.whenReady().then(async () => {
  const srv = http.createServer((q, r) => {   // /today-naejeon/admin/ → docs/admin/index.html (GitHub Pages와 같은 모양)
    let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/today-naejeon/, ''); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, path.normalize(p)); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
  }).listen(0, '127.0.0.1');
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}/today-naejeon/admin/`;
  const win = new BrowserWindow({ width: 1180, height: 900, show: false });
  const viol = [], pops = [];
  win.webContents.on('console-message', e => { const m = e && e.message || ''; if (/Content Security Policy|Refused to/.test(m)) viol.push(m.slice(0, 200)); });
  win.webContents.setWindowOpenHandler(({ url }) => { pops.push(url); return { action: 'allow', overrideBrowserWindowOptions: { show: false } }; });
  await win.loadURL(URL0); await sleep(5000);
  const st = await win.webContents.executeJavaScript(`({ csp: !!document.querySelector('meta[http-equiv=Content-Security-Policy]'), login: (b => !!b && b.offsetParent !== null)(document.getElementById('login2')),   // Firebase가 로그인 상태를 알려 주면 gate를 다시 그림(login → login2) = 모듈이 실제로 돈 것
    fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i), mod: !!document.querySelector('script[src="admin.js"]') })`);
  T('페이지에 CSP 있음 · 보드 스크립트 = admin.js', st.csp && st.mod);
  T('Firebase를 불러와 로그인 상태를 받고 로그인 화면을 다시 그림', st.login, st);
  T('글꼴(Pretendard·Barlow) 받음', st.fonts.some(f => /Pretendard/.test(f)) && st.fonts.some(f => /Barlow/.test(f)), st.fonts);
  T('여는 동안 차단 위반 0', viol.length === 0, viol);
  // ② 로그인 버튼 → 구글 로그인 창
  const v0 = viol.length;
  await win.webContents.executeJavaScript(`document.getElementById('login2').click(); 0`, true); await sleep(7000);
  const kids = BrowserWindow.getAllWindows().filter(w => w !== win), kidUrl = kids.map(w => w.webContents.getURL());
  const toast = await win.webContents.executeJavaScript(`(document.getElementById('toast') || {}).textContent || ''`);
  T('로그인 창이 열림(Firebase 로그인 처리 → 구글)', pops.some(u => /firebaseapp\.com\/__\/auth\/handler/.test(u)) || kidUrl.some(u => /accounts\.google\.com|firebaseapp\.com/.test(u)), { pops: pops.map(u => u.slice(0, 80)), kidUrl: kidUrl.map(u => u.slice(0, 80)), toast });
  T('로그인 누른 뒤 본 페이지 차단 위반 0', viol.length === v0, viol.slice(v0));
  T('로그인 오류 알림 없음', !/로그인 실패/.test(toast), toast);
  kids.forEach(w => { try { w.destroy(); } catch (_) {} });
  // ③ 나쁜 값 넣어 보기
  const r = await win.webContents.executeJavaScript(`(async () => { window.__x = []; const d = document.createElement('div'); document.body.appendChild(d);
    d.innerHTML = '<img src="x.png" onerror="window.__x.push(1)"><svg onload="window.__x.push(2)"></svg>';
    const s = document.createElement('script'); s.textContent = 'window.__x.push(3)'; document.body.appendChild(s);
    let ext = 'blocked'; try { await fetch('https://example.com/'); ext = 'open'; } catch (_) {}
    await new Promise(r => setTimeout(r, 500)); return { ran: window.__x, ext }; })()`);
  T('인라인 스크립트·onerror 실행 안 됨 · 바깥 사이트로 못 보냄', r.ran.length === 0 && r.ext === 'blocked', r);
  srv.close(); console.log(`\n운영 보드 CSP 시험 · 통과 ${ok} · 실패 ${bad}`); app.exit(bad ? 1 : 0);
});
