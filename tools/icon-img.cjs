// 🎨 앱·디스코드 아이콘 그림 만들기(2026-11-12 · 사장님 확정 = 시안 P3: 리틱체 「투데이 / 내전」 + 흐린 「TODAY IN-HOUSE」 사선 윤곽 무늬)
//   ⚠️ 리틱체(REATIC) 라이선스 = 그림·영상·인쇄물은 자유 · 글꼴 파일 판매·수정·재배포 금지 → 글꼴 파일은 리포에 넣지 않고
//      이 PC에 설치된 글꼴(%LOCALAPPDATA%\Microsoft\Windows\Fonts\REATIC-Bold.otf · REATIC-NarrowBold.otf)로 그림(PNG)만 만든다
//      (글꼴 받는 곳 = https://www.reaticindustry.com/reaticfont · 없으면 이 도구는 멈춤)
// 사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): electron tools/icon-img.cjs
//   → assets/icon-src/{16,24,32,48,64,128,256}.png(앱 · 16~32 = 「내전」만 크게 단순하게) · assets/icon.png(256) · assets/icon-tray.png(64)
//     docs/img/icon.png(512 네모 · 홈페이지·디스코드 상태 큰 그림) · docs/img/discord-icon.png(512 원형 · 디스코드 서버 아이콘·봇 사진)
//   다음 = node gen-ico.mjs(assets/icon.ico · CI의 npm run icon과 같음)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), FONTS = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts');
const furl = f => 'file:///' + f.replace(/\\/g, '/');
for (const f of ['REATIC-Bold.otf', 'REATIC-NarrowBold.otf']) if (!fs.existsSync(path.join(FONTS, f))) { console.log('❌ 리틱체가 없음:', path.join(FONTS, f)); process.exit(1); }

const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132332"/><stop offset="1" stop-color="#060b10"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7E4B0"/><stop offset=".45" stop-color="#D9B871"/><stop offset="1" stop-color="#A8822E"/></linearGradient>
  <clipPath id="tile"><path d="M26 0H230L256 26V230L230 256H26L0 230V26Z"/></clipPath>
  <clipPath id="circ"><circle cx="128" cy="125.5" r="150"/></clipPath>
</defs>`;
const T = (t, x, y, f, size, fill, extra = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${f}" font-size="${size}" fill="${fill}" ${extra}>${t}</text>`;
const ST = w => ` stroke="#08111a" stroke-width="${w}" paint-order="stroke"`;
const H = () => T('투데이', 128, 95, 'RB', 59, '#C9BC9C', 'letter-spacing="4"' + ST(6)) + T('내전', 128, 216, 'RNB', 113, 'url(#gold)', 'letter-spacing="4"' + ST(8));
const ROW = 'TODAY IN-HOUSE · '.repeat(8);
const PAT = () => {   // 시안 P3: 사선(-24°) 윤곽 무늬 · 줄 30 · 반 칸(70) 어긋남 · 글자 26 · 진하기 .22
  let s = '<g transform="rotate(-24 128 128)" fill="none" stroke="#C8AA6E" stroke-width="1" stroke-opacity=".22">';
  for (let r = 0, y = -120; y < 400; y += 30, r++) s += `<text x="${-260 + (r % 2) * 70}" y="${y}" font-family="Barlow Condensed" font-weight="700" font-style="italic" font-size="26" letter-spacing="3">${ROW}</text>`;
  return s + '</g>';
};
const FRAME = (small) => `<path d="M26 0H230L256 26V230L230 256H26L0 230V26Z" fill="none" stroke="url(#gold)" stroke-width="${small ? 16 : 10}"/>`
  + (small ? '' : '<path d="M30 14H226L242 30V226L226 242H30L14 226V30Z" fill="none" stroke="#C8AA6E" stroke-opacity=".45" stroke-width="2"/>');
// 앱(자른 모서리 네모) — small(16~32px) = 무늬·「투데이」 빼고 「내전」만 크게
const SQ = small => `<g clip-path="url(#tile)"><rect width="256" height="256" fill="url(#bg)"/>${small ? T('내전', 128, 176, 'RNB', 132, 'url(#gold)', 'letter-spacing="2"') : PAT() + H()}</g>${FRAME(small)}`;
// 디스코드(원형) — 글자 0.8배 · 무늬는 원 안에만
const CI = () => `<circle cx="128" cy="128" r="128" fill="url(#bg)"/><g transform="translate(128 130) scale(0.8) translate(-128 -128)"><g clip-path="url(#circ)">${PAT() + H()}</g></g>`
  + '<circle cx="128" cy="128" r="123" fill="none" stroke="url(#gold)" stroke-width="10"/><circle cx="128" cy="128" r="110" fill="none" stroke="#C8AA6E" stroke-opacity=".45" stroke-width="2"/>';

const OUT = [
  ...[16, 24, 32, 48, 64, 128, 256].map(s => ({ f: `assets/icon-src/${s}.png`, s, svg: SQ(s <= 32) })),
  { f: 'docs/img/icon.png', s: 512, svg: SQ(false) },
  { f: 'docs/img/discord-icon.png', s: 512, svg: CI() },
];
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  // 크기마다 4배(최대 1024)로 크게 그린 뒤 줄임 — 글자를 그대로 작게 그리면 화면용 선명화(ClearType) 때문에 가장자리에 빨강·파랑 번짐(32px에서 확인)
  const BIG = 1024, css = `@font-face { font-family:'RB'; src:url('${furl(path.join(FONTS, 'REATIC-Bold.otf'))}'); }
    @font-face { font-family:'RNB'; src:url('${furl(path.join(FONTS, 'REATIC-NarrowBold.otf'))}'); }
    @font-face { font-family:'Barlow Condensed'; src:url('${furl(path.join(R, 'assets/fonts/BarlowCondensed-700.woff2'))}'); font-weight:700; }
    html, body { margin:0; background:transparent; } svg { position:absolute; left:0; top:0; display:block; }`;
  const win = new BrowserWindow({ width: BIG, height: BIG, show: false, frame: false, transparent: true, backgroundColor: '#00000000', webPreferences: { offscreen: true } });
  const tmp = path.join(require('os').tmpdir(), 'tn-icon-img.html');
  for (const o of OUT) {
    const r = Math.min(BIG, o.s * 4);
    fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><svg width="${r}" height="${r}" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">${DEFS}${o.svg}</svg></body></html>`);
    await win.loadFile(tmp);
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => 0)');
    await new Promise(res => setTimeout(res, 500));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: r, height: r });
    fs.writeFileSync(path.join(R, o.f), img.resize({ width: o.s, height: o.s, quality: 'best' }).toPNG()); console.log('✅', o.f, o.s, '(' + r + '에서 줄임)');
  }
  fs.copyFileSync(path.join(R, 'assets/icon-src/256.png'), path.join(R, 'assets/icon.png'));
  fs.copyFileSync(path.join(R, 'assets/icon-src/64.png'), path.join(R, 'assets/icon-tray.png'));
  console.log('✅ assets/icon.png(256) · assets/icon-tray.png(64) · 다음 = node gen-ico.mjs');
  app.exit(0);
});
