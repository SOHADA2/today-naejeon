// ✏️ 핑·이모티콘 스케치 그림 만들기(v0.1.256 · 사장님: 핑을 스케치 느낌으로 귀엽게 · 대기실용 뜻으로 · 롤 게임 파일 그림 대신)
//   분필 선(흰 선이 살짝 흔들림 = feTurbulence + feDisplacementMap) + 파스텔 색 칠 위에 색연필 빗금 + 표정
//   사용(리포 루트): env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe tools/ping-sketch.cjs [출력 폴더(기본 assets/ping)] [크기(기본 192)]
//   → {이름}.png(투명 배경) · 이름 = 아래 IC 열쇠(핑 9개 + 이모티콘용 hi·cry) · overlay.js PING·EMO와 slot/cping.html PING이 이 이름을 씀
//   그림을 고치면 이 파일의 IC만 고치고 다시 돌림(앱 코드는 PNG만 읽음 = 화면에서 필터 계산 없음)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'assets', 'ping')), SIZE = +(process.argv[3] || 192);
const W = '#f4efe4';   // 분필 흰색
const IC = {
  // 여기 봐요(가운데 · 끌지 않음) = 웃는 위치 핀 + 반짝
  look: ['#7cc6ff', `
    <path d="M37 64 C24 48 16 40 16 30 C16 18 26 10 37 10 C48 10 58 18 58 30 C58 40 50 48 37 64 Z" F/>
    <circle cx="31" cy="29" r="2.6" fill="${W}"/><circle cx="43" cy="29" r="2.6" fill="${W}"/>
    <path d="M32 36 Q37 40 42 36" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M62 14 l4 -4 M64 22 l6 0 M58 8 l1 -6" stroke="#ffd56b" stroke-width="2.6" stroke-linecap="round"/>`],
  // 준비 완료 = 체크 동그라미
  ready: ['#7be0b0', `
    <circle cx="35" cy="39" r="24" F/>
    <path d="M23 39 L32 48 L49 29" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M62 12 l0 8 M58 16 l8 0" stroke="#ffd56b" stroke-width="2.6" stroke-linecap="round"/>`],
  // 가자! = 웃는 깃발
  go: ['#ff9f5a', `
    <path d="M18 10 L18 66" stroke="${W}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M18 13 C28 8 36 18 46 13 C52 10 58 11 62 14 L62 40 C56 36 50 37 44 40 C34 45 28 36 18 40 Z" F/>
    <path d="M32 24 q2 -3 4 0 M44 23 q2 -3 4 0" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M35 31 Q40 35 45 30" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>`],
  // 좋아요 = 엄지척
  good: ['#a7e36b', `
    <path d="M26 34 L33 14 C34 10 40 10 41 15 L40 30 L55 30 C60 30 62 34 61 38 L57 56 C56 60 53 62 49 62 L26 62 Z" F/>
    <rect x="12" y="33" width="12" height="30" rx="2" F/>
    <path d="M42 40 l14 0 M41 48 l13 0" stroke="${W}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`],
  // ㅋㅋ = 웃음 터진 얼굴
  lol: ['#ffd56b', `
    <circle cx="37" cy="38" r="25" F/>
    <path d="M24 32 q4 -6 8 0 M42 32 q4 -6 8 0" fill="none" stroke="${W}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M25 42 L49 42 Q47 56 37 56 Q27 56 25 42 Z" fill="#0a1018" stroke="${W}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M14 30 C11 35 12 38 15 39 C18 38 18 35 14 30 Z M60 30 C57 35 58 38 61 39 C64 38 64 35 60 30 Z" fill="#9fd8ff" stroke="${W}" stroke-width="1.6"/>`],
  // 잠깐만 = 모래시계
  wait: ['#b9a4ff', `
    <path d="M22 12 L52 12 M22 62 L52 62" stroke="${W}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M25 13 C25 28 34 32 37 37 C34 42 25 46 25 61 L49 61 C49 46 40 42 37 37 C40 32 49 28 49 13 Z" F/>
    <path d="M29 58 Q37 48 45 58 Z" fill="#ffd56b" stroke="${W}" stroke-width="1.6"/>
    <path d="M37 40 L37 50" stroke="#ffd56b" stroke-width="2" stroke-dasharray="2 3" stroke-linecap="round"/>`],
  // 미안 = 땀 흘리는 얼굴
  sorry: ['#9fd8ff', `
    <circle cx="35" cy="39" r="24" F/>
    <path d="M23 30 l7 2 M47 30 l-7 2" stroke="${W}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="27" cy="38" r="2.4" fill="${W}"/><circle cx="43" cy="38" r="2.4" fill="${W}"/>
    <path d="M28 49 Q31 46 35 49 Q39 52 42 49" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M60 14 C65 21 65 25 60 27 C55 25 55 21 60 14 Z" fill="#9fd8ff" stroke="${W}" stroke-width="2"/>`],
  // ? = 물음표 동그라미
  ask: ['#ffc24d', `
    <circle cx="37" cy="37" r="25" F/>
    <path d="M29 30 C29 22 45 21 45 30 C45 36 37 37 37 44" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="37" cy="51" r="2.8" fill="${W}"/>`],
  // 고마워 = 볼 빨간 하트
  thanks: ['#ff9ccc', `
    <path d="M37 62 C20 50 12 41 12 31 C12 23 18 17 25 17 C30 17 34 20 37 25 C40 20 44 17 49 17 C56 17 62 23 62 31 C62 41 54 50 37 62 Z" F/>
    <path d="M25 33 q3 -4 6 0 M43 33 q3 -4 6 0" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M32 41 Q37 46 42 41" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="22" cy="40" r="3" fill="#ff6f9f" opacity=".8"/><circle cx="52" cy="40" r="3" fill="#ff6f9f" opacity=".8"/>`],
  // 이모티콘 「인사」 = 손 흔들기(손바닥 + 흔드는 선)
  hi: ['#ffd9a8', `
    <path d="M24 62 C18 56 16 48 16 40 L16 30 C16 27 21 27 21 30 L21 38 L22 16 C22 12 28 12 28 16 L28 34 L30 12 C30 8 36 8 36 12 L36 34 L39 15 C39 11 45 11 45 15 L44 36 L48 28 C50 24 55 26 54 30 L48 48 C46 56 42 62 36 62 Z" F/>
    <path d="M58 12 Q63 18 60 24 M64 8 Q71 18 66 28" fill="none" stroke="${W}" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`],
  // 이모티콘 「ㅠㅠ」 = 눈물 줄줄 얼굴
  cry: ['#9fd8ff', `
    <circle cx="37" cy="38" r="25" F/>
    <path d="M24 34 q4 -3 8 0 M42 34 q4 -3 8 0" fill="none" stroke="${W}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M28 37 L27 56 M46 37 L47 56" stroke="#5fb0e8" stroke-width="4" stroke-linecap="round"/>
    <path d="M31 50 Q37 45 43 50" fill="none" stroke="${W}" stroke-width="2.6" stroke-linecap="round"/>`],
};
// 한 장 = 따로 서는 SVG(필터·빗금을 그 안에 둠 → <img>로 그려도 됨) · F = 색 칠 + 빗금 + 분필 테두리
function svg(k) {
  const [c, body] = IC[k];
  const d = body.replace(/<(\w+)([^>]*?) F\/>/g, (m, tag, a) => `<${tag}${a} fill="${c}" fill-opacity=".9"/><${tag}${a} fill="url(#hw)"/><${tag}${a} fill="none" stroke="${W}" stroke-width="3" stroke-linejoin="round"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="-3 -3 80 80"><defs>
    <filter id="sk" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>
    <pattern id="hw" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" stroke-width="1.3" opacity=".45"/></pattern>
    </defs><g filter="url(#sk)">${d}</g></svg>`;
}
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<canvas id=c></canvas>');
  for (const k of Object.keys(IC)) {
    const url = 'data:image/svg+xml;base64,' + Buffer.from(svg(k)).toString('base64');
    const png = await win.webContents.executeJavaScript(`new Promise((ok, no) => { const im = new Image(); im.onload = () => { const c = document.getElementById('c'); c.width = ${SIZE}; c.height = ${SIZE}; const x = c.getContext('2d'); x.clearRect(0, 0, ${SIZE}, ${SIZE}); x.drawImage(im, 0, 0, ${SIZE}, ${SIZE}); ok(c.toDataURL('image/png')); }; im.onerror = () => no('그림 실패'); im.src = ${JSON.stringify(url)}; })`);
    fs.writeFileSync(path.join(out, k + '.png'), Buffer.from(png.split(',')[1], 'base64'));
    console.log('저장', k + '.png');
  }
  // 바퀴 판 = 손으로 그린 원 + 8칸 점선 + 가운데 원(wheel.png · 512) — 그림 한가운데 원 반지름 = 판의 36%(overlay --cr/--R 38/104 · cping 76/216와 거의 같음)
  let sep = ''; for (let i = 0; i < 8; i++) { const a = (i * 45 - 22.5 - 90) * Math.PI / 180; sep += `<line x1="${(150 + 58 * Math.cos(a)).toFixed(1)}" y1="${(150 + 58 * Math.sin(a)).toFixed(1)}" x2="${(150 + 134 * Math.cos(a)).toFixed(1)}" y2="${(150 + 134 * Math.sin(a)).toFixed(1)}" stroke="${W}" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round" opacity=".55"/>`; }
  const wheel = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 300 300"><defs>
    <filter id="sk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
    <g filter="url(#sk)"><circle cx="150" cy="150" r="141" fill="rgba(8,14,22,.66)" stroke="${W}" stroke-width="2.6" stroke-opacity=".8"/>${sep}
    <circle cx="150" cy="150" r="54" fill="#0a1018" stroke="${W}" stroke-width="2.6"/></g></svg>`;
  const wurl = 'data:image/svg+xml;base64,' + Buffer.from(wheel).toString('base64');
  const wpng = await win.webContents.executeJavaScript(`new Promise((ok, no) => { const im = new Image(); im.onload = () => { const c = document.getElementById('c'); c.width = 512; c.height = 512; const x = c.getContext('2d'); x.clearRect(0, 0, 512, 512); x.drawImage(im, 0, 0, 512, 512); ok(c.toDataURL('image/png')); }; im.onerror = () => no('바퀴 실패'); im.src = ${JSON.stringify(wurl)}; })`);
  fs.writeFileSync(path.join(out, 'wheel.png'), Buffer.from(wpng.split(',')[1], 'base64'));
  console.log('저장 wheel.png');
  app.exit(0);
}).catch(e => { console.error(e); app.exit(1); });
