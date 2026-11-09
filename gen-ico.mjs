// assets/icon-src/{16..256}.png(크기마다 따로 그린 것) → assets/icon.ico (exe/설치본 아이콘)
// 원본 = assets/icon-src/icon.svg(헥스텍 문장 · 2026-11-09) · 크기별 PNG가 없으면 assets/icon.png 하나로
import fs from 'node:fs';
import pngToIcoMod from 'png-to-ico';
const pngToIco = pngToIcoMod.default || pngToIcoMod;
const sizes = [16, 24, 32, 48, 64, 128, 256].map(n => `assets/icon-src/${n}.png`).filter(f => fs.existsSync(f));
fs.writeFileSync('assets/icon.ico', await pngToIco(sizes.length ? sizes.map(f => fs.readFileSync(f)) : 'assets/icon.png'));
console.log('✅ assets/icon.ico 생성', sizes.length ? `(${sizes.length}개 크기)` : '(icon.png 하나)');
