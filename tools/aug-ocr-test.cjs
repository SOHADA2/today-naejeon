// 🎯 증강 순위 글자 읽기 시험(v0.1.80~) — 게임 스크린샷으로 앱과 똑같이: 이름 띠(augBand)만 OCR → findCards → 두 장이면 셋째 다시 읽기(augThird)
// 사용(리포 루트, ELECTRON_RUN_AS_NODE 끄고): electron tools/aug-ocr-test.cjs <스크린샷.png> [화면너비 화면높이]   (기본 = 스크린샷 크기)
//   + 마지막에 「지금 화면」 띠를 실제로 캡처(cap)해 캡처·읽기 시간과 앱 메인 스레드 멈춤을 잼(렉 확인)
//   main.js의 OCR_PS·augBand·augCap·augThird를 그대로 꺼내 씀(따로 베끼지 않음) · 증강 이름 = CommunityDragon 최신
const { app, screen, nativeImage } = require('electron');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), https = require('https');
const repo = path.join(__dirname, '..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--') && !a.endsWith('.cjs') && a !== '.');
const png = args[0];
const src = fs.readFileSync(path.join(repo, 'main.js'), 'utf8').replace(/\r\n/g, '\n');
const grab = (s, e) => { const a = src.indexOf(s); return src.slice(a, src.indexOf(e, a)); };
const i0 = src.indexOf('const OCR_PS = `') + 16; const OCR_PS = eval('`' + src.slice(i0, src.indexOf('\n`;', i0)) + '\n`');
const augscan = require(path.join(repo, 'augscan.js'));
const q = []; const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(OCR_PS, 'utf16le').toString('base64')]);
let buf = '', readyRes; const ready = new Promise(r => readyRes = r); p.stdout.setEncoding('utf8');
p.stdout.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!l) continue; let j; try { j = JSON.parse(l); } catch (_) { continue; } if ('ready' in j) { readyRes(j); continue; } const r = q.shift(); r && r(j); } });
const ocrRead = c => new Promise(r => { q.push(r); p.stdin.write(c + '\n'); });
eval(grab('function augBand(pr)', '\nasync function augTick').replace('const augCap =', 'var augCap ='));
app.whenReady().then(async () => {
  console.log('OCR', JSON.stringify(await ready));
  const list = await new Promise(r => https.get('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/cherry-augments.json', res => { res.setEncoding('utf8'); let s = ''; res.on('data', c => s += c); res.on('end', () => r(JSON.parse(s))); }));
  const names = list.filter(x => x.id >= 1000 && x.nameTRA && !x.nameTRA.startsWith('#')).map(x => ({ id: x.id, name: x.nameTRA })), nm = Object.fromEntries(names.map(x => [x.id, x.name])), ix = augscan.nameIndex(names);
  if (png) {
    const sz = nativeImage.createFromPath(path.resolve(png)).getSize();
    const pr = { x: 0, y: 0, width: +args[1] || sz.width, height: +args[2] || sz.height }, band = augBand(pr);
    const imgCmd = (x, y, w, h, k) => `img ${Math.round(x)} ${Math.round(y)} ${Math.round(w)} ${Math.round(h)} ${k} ${path.resolve(png)}`;
    const t = Date.now(); const r = await ocrRead(imgCmd(band.x, band.y, band.w, band.h, 1)); const found = augscan.findCards(ix, r.lines, pr.height);
    let third = '';
    if (found && found.cards.length === 2) { const c3 = await augThird(band, found, ix, pr.height, imgCmd); if (c3) { found.cards = found.cards.concat(c3).sort((a, b) => a.x - b.x); third = ` · 셋째 다시 읽기 → ${nm[c3.id]}`; } }
    console.log(`스크린샷 ${pr.width}×${pr.height} · 띠 ${band.w}×${band.h} · 읽기 ${r.ms}ms · 줄 ${(r.lines || []).length}`);
    console.log(`  → ${found ? found.cards.map(c => `${nm[c.id]}(x ${band.x + c.x} · 점수 ${c.score.toFixed(2)})`).join(' | ') : '증강 화면 아님'}${third} · 전체 ${Date.now() - t}ms`);
  }
  const d = screen.getPrimaryDisplay(), lb = augBand(screen.dipToScreenRect(null, d.bounds));
  const cap = (x, y, w, h, k) => `cap ${[x, y, w, h].map(Math.round).join(' ')} ${k}`;
  let maxLag = 0, last = Date.now(); const iv = setInterval(() => { const n = Date.now(); maxLag = Math.max(maxLag, n - last - 10); last = n; }, 10);
  for (let i = 0; i < 3; i++) { maxLag = 0; const r = await ocrRead(cap(lb.x, lb.y, lb.w, lb.h, 1)); await new Promise(z => setTimeout(z, 200)); console.log(`지금 화면 띠 캡처 ${r.cap}ms · 캡처+읽기 ${r.ms}ms · 메인 스레드 최대 멈춤 ${maxLag}ms${r.err ? ' · 오류 ' + r.err : ''}`); }
  clearInterval(iv); p.kill(); app.exit(0);
});
