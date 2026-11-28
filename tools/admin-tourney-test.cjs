// 🏆 운영 보드 「대회」 탭 시험(v0.1.291) — 서버·구글 로그인 없이 · 실제 docs/admin/index.html을 화면 밖 창에 띄워 버튼을 눌러 봄
//   사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): ./node_modules/electron/dist/electron.exe tools/admin-tourney-test.cjs [캡처 폴더]
//   방법 = 페이지의 Firebase 가져오기 두 줄을 가짜 로그인으로 바꾸고 fetch를 메모리 DB(window.__db)로 돌림 → 대회 만들기 → 팀 4개 → 선수 → 대진 → 시작 → 결과 넣기 → 승자 정하기
const { app, BrowserWindow } = require('electron');
const cmOf = (e, lv, msg, line, src) => e && typeof e.message === 'string' ? { lv: ({ info: 1, warning: 2, error: 3 })[e.level] || 0, msg: e.message, line: e.lineNumber, src: e.sourceId } : { lv, msg, line, src };   // Electron 35+ = 이벤트 객체(47에서 옛 인자 없어짐)
const fs = require('fs'), path = require('path'), os = require('os');
const outDir = process.argv.slice(2).find(a => !a.endsWith('.cjs') && !a.startsWith('-')) || null;
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, bad = 0;
const check = (name, cond, extra) => { if (cond) ok++; else { bad++; console.log('✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
app.whenReady().then(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tn-admin-')), src = path.join(__dirname, '..', 'docs', 'admin');
  // 2026-11-28: 보드 스크립트 = admin.js(모듈 파일) · 페이지에 CSP가 있어 시험용 인라인 스크립트가 막힘 → 시험 사본에선 CSP 줄을 빼고 씀(CSP 자체는 tools/admin-csp-test.cjs)
  let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\r?\n?/, '');
  let ajs = fs.readFileSync(path.join(src, 'admin.js'), 'utf8');
  const imp = /import \{[^}]*\} from 'https:\/\/www\.gstatic\.com\/firebasejs\/[^']+';\r?\n/g;
  if ((ajs.match(imp) || []).length !== 2) { console.log('✗ Firebase 가져오기 줄을 못 찾음'); app.exit(1); return; }
  ajs = ajs.replace(imp, '');
  ajs = `const FAKE = { currentUser: { uid: 'adm1', displayName: '시험 운영자', getIdToken: async () => 'tok' }, authStateReady: async () => {} };
const initializeApp = () => ({}), getAuth = () => FAKE, GoogleAuthProvider = function () {}, signInWithPopup = async () => {}, signOut = async () => {}, onAuthStateChanged = (a, cb) => setTimeout(() => cb(a.currentUser), 0);
` + ajs;
  const acc = {}; const NM = ['가람', '나래', '다온', '라온', '마루', '바다', '사랑', '아라', '자람', '차오름', '카이', '타래', '파랑', '하늘', '동의안함'];
  NM.forEach((n, i) => { acc['p' + i] = Object.assign({ name: n, tag: 'KR1', lastSeen: 1000 + i }, n === '동의안함' ? {} : { pub: 1 }); });
  const boot = `window.__db = ${JSON.stringify({ today: { admins: { adm1: { name: '시험', owner: true } }, accounts: acc } })}; window.__prompts = []; window.__toasts = [];
    window.confirm = () => true; window.prompt = () => window.__prompts.length ? window.__prompts.shift() : null;
    (function () { const seg = u => decodeURIComponent(new URL(u).pathname).replace(/\\.json$/, '').split('/').filter(Boolean);
      const at = (p, mk) => { let o = window.__db; for (const k of p) { if (o[k] == null || typeof o[k] !== 'object') { if (!mk) return undefined; o[k] = {}; } o = o[k]; } return o; };
      const set = (p, v) => { if (!p.length) return; const par = at(p.slice(0, -1), v !== null); if (!par) return; if (v === null || v === undefined) delete par[p[p.length - 1]]; else par[p[p.length - 1]] = JSON.parse(JSON.stringify(v)); };
      const get = p => { let o = window.__db; for (const k of p) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : o; };
      window.fetch = async (url, opt) => { opt = opt || {}; const m = (opt.method || 'GET').toUpperCase(), p = seg(url), body = opt.body ? JSON.parse(opt.body) : undefined; let res = null;
        if (m === 'GET') { res = get(p); if (/shallow=true/.test(url) && res && typeof res === 'object') res = Object.fromEntries(Object.keys(res).map(k => [k, true])); }
        else if (m === 'PUT') { set(p, body); res = body; }
        else if (m === 'PATCH') { for (const [k, v] of Object.entries(body || {})) set(p.concat(k.split('/')), v); res = body; }
        else if (m === 'DELETE') { set(p, null); }
        else if (m === 'POST') { const k = 'k' + Date.now() + Math.random().toString(36).slice(2, 6); set(p.concat(k), body); res = { name: k }; }
        return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(res === undefined ? null : res)) }; }; })();`;
  html = html.replace('<script src="tourney.js"></script>', `<script>${boot}</script>\n<script src="tourney.js"></script>`);
  fs.writeFileSync(path.join(dir, 'index.html'), html); fs.writeFileSync(path.join(dir, 'admin.js'), ajs); fs.copyFileSync(path.join(src, 'tourney.js'), path.join(dir, 'tourney.js'));
  const win = new BrowserWindow({ width: 1180, height: 1500, show: false, webPreferences: { offscreen: true } });
  const errs = []; win.webContents.on('console-message', (...a) => { const { lv, msg } = cmOf(...a); if (lv >= 3) errs.push(msg); });
  await win.loadFile(path.join(dir, 'index.html')); await sleep(1500);
  const js = code => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const db = p => js(`return JSON.parse(JSON.stringify((function(){let o=window.__db;for(const k of ${JSON.stringify(p)}.split('/')){if(o==null)return null;o=o[k];}return o===undefined?null:o;})()))`);
  const shot = async n => { if (!outDir) return; fs.mkdirSync(outDir, { recursive: true }); await sleep(250); fs.writeFileSync(path.join(outDir, n + '.png'), (await win.webContents.capturePage()).toPNG()); };
  const toast = () => js(`return document.getElementById('toast').textContent`);
  await js(`document.querySelector('nav.tabs button[data-t="tour"]').click()`); await sleep(300);
  check('대회 탭이 열림', await js(`return !document.querySelector('section[data-p="tour"]').classList.contains('hide')`));
  // 이름 검사
  await js(`document.getElementById('tn-name').value = 'LCK 멸망전'; document.getElementById('tn-go').click()`); await sleep(300);
  check('공식 대회 이름 거절', Object.keys((await db('today/tourneys')) || {}).length === 0, await toast());
  await js(`document.getElementById('tn-name').value = '가을 멸망전'; document.getElementById('tn-bof').value = '5'; document.getElementById('tn-go').click()`); await sleep(600);
  let T = await db('today/tourneys'); const tid = Object.keys(T || {})[0];
  check('대회 만들기', tid && T[tid].name === '가을 멸망전' && T[tid].fmt === 'se' && T[tid].bo === 3 && T[tid].boF === 5 && T[tid].st === 'draft', T);
  await shot('1-new');
  // 팀 4개
  for (const [n, g] of [['불꽃', 'FIR'], ['번개', 'BLT'], ['바람', 'WND'], ['파도', 'WAV']]) { await js(`document.getElementById('tn-tname').value = ${JSON.stringify(n)}; document.getElementById('tn-ttag').value = ${JSON.stringify(g)}; document.querySelector('[data-ta="tadd"]').click()`); await sleep(450); }
  T = await db('today/tourneys/' + tid); const teamIds = Object.entries(T.teams || {}).sort((a, b) => a[1].seed - b[1].seed).map(x => x[0]);
  check('팀 4개 · 시드 1~4', teamIds.length === 4 && teamIds.map(k => T.teams[k].seed).join() === '1,2,3,4', T.teams);
  // 선수: 첫 팀에 3명(첫 사람 = 팀장) + 후보 1 · 동의 안 한 사람 거절 · 다른 팀 중복 거절
  const view = async v => { await js(`document.querySelector('[data-tv="${v}"]').click()`); await sleep(250); };   // v0.1.292 「팀」/「대진」 화면
  const pick = async mid => { await js(`document.querySelector('[data-bm="${mid}"]').click()`); await sleep(250); };   // 대진표에서 경기 고르기
  const add = async (k, who, sub) => { await js(`const i = document.querySelector('.tn-add[data-k="${k}"]'); i.value = ${JSON.stringify(who)}; document.querySelector('.tn-role[data-k="${k}"]').value = ${JSON.stringify(sub ? 'sub' : '')}; document.querySelector('[data-ta="madd"][data-k="${k}"]').click()`); await sleep(450); };
  await add(teamIds[0], '가람#KR1'); await add(teamIds[0], '나래'); await add(teamIds[0], '다온'); await add(teamIds[0], '라온', true);
  await add(teamIds[0], '동의안함'); check('기록 공개 동의 안 한 계정 거절', /동의/.test(await toast()), await toast());
  await add(teamIds[1], '가람'); check('다른 팀 선수 중복 거절', /이미/.test(await toast()), await toast());
  await add(teamIds[1], '마루'); await add(teamIds[1], '바다');
  T = await db('today/tourneys/' + tid);
  check('선수 등록', Object.keys(T.teams[teamIds[0]].mem).length === 4 && T.teams[teamIds[0]].mem.p0.r === 'cap' && T.teams[teamIds[0]].mem.p3.r === 'sub' && Object.keys(T.teams[teamIds[1]].mem).length === 2, T.teams[teamIds[0]].mem);
  // 역할 바꾸기: 나래(선수) → 팀장 = 가람은 선수로
  await js(`document.querySelector('[data-ta="mrole"][data-k="${teamIds[0]}"][data-p="p1"]').click()`); await sleep(450);
  T = await db('today/tourneys/' + tid); check('팀장은 한 명', T.teams[teamIds[0]].mem.p1.r === 'cap' && T.teams[teamIds[0]].mem.p0.r === '', T.teams[teamIds[0]].mem);
  // 시드: 2번을 위로 → 대진 만들기
  await shot('2-teams'); await view('matches');
  check('대진 짜기 화면 = 미리 보기 대진표', await js(`return !!document.querySelector('.tn-bk .m.pre')`));
  await js(`document.querySelector('[data-ta="sup"][data-k="${teamIds[1]}"]').click()`); await sleep(450);
  T = await db('today/tourneys/' + tid); check('시드 바꾸기', T.teams[teamIds[1]].seed === 1 && T.teams[teamIds[0]].seed === 2, [T.teams[teamIds[0]].seed, T.teams[teamIds[1]].seed]);
  await shot('3-seed');
  await js(`document.querySelector('[data-ta="gen"]').click()`); await sleep(600);
  T = await db('today/tourneys/' + tid);
  check('대진 = 3경기 · 결승 5판', T.matches && Object.keys(T.matches).length === 3 && T.matches.r2m0.bo === 5 && T.matches.r1m0.a === teamIds[1] && T.matches.r1m0.b === teamIds[3], T.matches);
  check('대진을 만들면 대진표 그림이 보임', await js(`return document.querySelectorAll('.tn-bk [data-bm]').length`) === 3);
  await view('teams'); check('대진이 있으면 팀 추가 막힘', await js(`return document.querySelector('[data-ta="tadd"]').disabled`)); await view('matches');
  await js(`document.querySelector('[data-ta="st"][data-v="live"]').click()`); await sleep(500);
  check('대회 시작', (await db('today/tourneys/' + tid + '/st')) === 'live');
  // 방장 앱이 넣는 결과 흉내: 1경기 2:0
  await js(`window.__db.today.tourneys[${JSON.stringify(tid)}].res = { r1m0: { g1: { w: ${JSON.stringify(teamIds[1])}, day: '2026-11-28', at: 1 }, g2: { w: ${JSON.stringify(teamIds[1])}, day: '2026-11-28', at: 2 } } }; document.getElementById('reload2').click()`); await sleep(900);
  await js(`document.querySelector('nav.tabs button[data-t="tour"]').click()`); await sleep(300);
  await pick('r1m0');
  const txt = await js(`return document.getElementById('tn-detail').innerText`);
  check('결과가 대진에 보임(2 : 0 · 끝)', /2 : 0/.test(txt) && /1판 · 번개 승/.test(txt), txt.slice(0, 600));
  // 2경기 = 운영자가 승자 정하기(기권)
  await pick('r1m1');
  await js(`const s = document.querySelector('select[data-tw="r1m1"]'); s.value = ${JSON.stringify(teamIds[2])}; s.dispatchEvent(new Event('change'))`); await sleep(600);
  T = await db('today/tourneys/' + tid); check('운영자 승자', T.matches.r1m1.win === teamIds[2], T.matches.r1m1);
  await pick('r2m0');
  const txt2 = await js(`return document.querySelector('.tn-det').innerText`);
  check('결승 대진이 채워짐', /결승/.test(txt2) && /번개/.test(txt2) && /바람/.test(txt2), txt2);
  await shot('4-bracket'); await pick('r1m0');
  // 결과 지우기 · 운영 기록
  await js(`document.querySelector('[data-ta="rclr"][data-k="r1m0"]').click()`); await sleep(500);
  check('결과 지우기', !(await db('today/tourneys/' + tid + '/res/r1m0')));
  const log = Object.values((await db('today/modlog')) || {}).map(l => l.act);
  check('운영 기록', ['tnew', 'tgen', 'tst', 'twin', 'tres'].every(a => log.includes(a)), log);
  // 풀리그 대회 하나 더 → 지우기
  await js(`document.getElementById('tn-name').value = '리그 시험'; document.getElementById('tn-fmt').value = 'rr'; document.getElementById('tn-go').click()`); await sleep(600);
  T = await db('today/tourneys'); const rid = Object.keys(T).find(k => k !== tid);
  check('풀리그 대회 만들기', rid && T[rid].fmt === 'rr' && !T[rid].boF, T[rid]);
  await js(`window.__prompts.push('리그 시험'); document.querySelector('[data-ta="del"]').click()`); await sleep(600);
  check('대회 지우기(이름 확인)', !(await db('today/tourneys/' + rid)) && !!(await db('today/tourneys/' + tid)));
  check('화면 오류 없음', errs.length === 0, errs.slice(0, 3));
  console.log(`운영 보드 대회 시험 ${ok + bad}건 · 통과 ${ok} · 실패 ${bad}`);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  app.exit(bad ? 1 : 0);
});
