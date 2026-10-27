// assets/icon.png → assets/icon.ico (exe/설치본 아이콘)
import fs from 'node:fs';
import pngToIcoMod from 'png-to-ico';
const pngToIco = pngToIcoMod.default || pngToIcoMod;
fs.writeFileSync('assets/icon.ico', await pngToIco('assets/icon.png'));
console.log('✅ assets/icon.ico 생성');
