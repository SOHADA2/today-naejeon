// 아이콘 생성기(aram-overlay 원본·금색). ⚠️ 투데이 내전 아이콘은 이걸 돌린 뒤 금색→파랑으로 재색칠한 것 — 다시 돌리면 금색으로 돌아감
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0); const t = Buffer.from(type, 'ascii'); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, data])), 0); return Buffer.concat([l, t, data, cr]); };
function encodePng(S, px) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
  const row = S * 4 + 1, raw = Buffer.alloc(row * S);
  for (let y = 0; y < S; y++) { raw[y * row] = 0; for (let x = 0; x < S * 4; x++) raw[y * row + 1 + x] = px[y * S * 4 + x]; }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function render(S) {
  const px = new Uint8ClampedArray(S * S * 4);
  const k = S / 256; // scale factor
  const blend = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= S || y >= S || a <= 0) return;
    const i = (y * S + x) * 4, sa = a / 255, da = px[i + 3] / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    px[i] = (r * sa + px[i] * da * (1 - sa)) / oa; px[i + 1] = (g * sa + px[i + 1] * da * (1 - sa)) / oa;
    px[i + 2] = (b * sa + px[i + 2] * da * (1 - sa)) / oa; px[i + 3] = oa * 255;
  };
  const inRound = (x, y, pad, rad) => { const a = pad, b = S - pad; let dx = 0, dy = 0;
    if (x < a + rad) dx = a + rad - x; else if (x > b - rad) dx = x - (b - rad);
    if (y < a + rad) dy = a + rad - y; else if (y > b - rad) dy = y - (b - rad);
    if (x < a || x > b || y < a || y > b) return false; return dx * dx + dy * dy <= rad * rad; };
  const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };

  // 검 하나(위 향함·grip 원점)의 로컬 도형들 — 스케일 반영
  const sword = () => {
    const P = (a, b) => [a * k, b * k];
    return {
      polys: [
        [P(0, -118), P(7, -34), P(-7, -34)],                 // 날
        [P(-28, -34), P(28, -34), P(28, -23), P(-28, -23)],  // 가드
        [P(-5.5, -23), P(5.5, -23), P(5.5, 12), P(-5.5, 12)],// 손잡이
      ],
      pommel: { c: P(0, 18), r: 10 * k },
    };
  };
  const rot = (p, ang, cx, cy) => { const s = Math.sin(ang), c = Math.cos(ang); return [cx + p[0] * c - p[1] * s, cy + p[0] * s + p[1] * c]; };
  const cx = S * 0.5, cy = S * 0.46;
  const swords = [
    { sw: sword(), ang: -Math.PI / 4 },
    { sw: sword(), ang: Math.PI / 4 },
  ].map(o => ({
    polys: o.sw.polys.map(poly => poly.map(p => rot(p, o.ang, cx, cy))),
    pommel: { c: rot(o.sw.pommel.c, o.ang, cx, cy), r: o.sw.pommel.r },
  }));

  const SS = 3; // 3x3 슈퍼샘플(안티앨리어싱)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // 배경 라운드
    let bgc = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) if (inRound(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, 8 * k, 46 * k)) bgc++;
    if (bgc) {
      const t = y / S; const r = 18 - t * 6, g = 15 - t * 5, b = 26 - t * 8; // 다크 그라디언트
      blend(x, y, r, g, b, 255 * (bgc / (SS * SS)));
    }
    // 검(골드)
    let cov = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px2 = x + (sx + 0.5) / SS, py2 = y + (sy + 0.5) / SS; let hit = false;
      for (const s of swords) {
        for (const poly of s.polys) if (inPoly(px2, py2, poly)) { hit = true; break; }
        if (!hit) { const dx = px2 - s.pommel.c[0], dy = py2 - s.pommel.c[1]; if (dx * dx + dy * dy <= s.pommel.r * s.pommel.r) hit = true; }
        if (hit) break;
      }
      if (hit) cov++;
    }
    if (cov) { const t = y / S; blend(x, y, 255, 224 - t * 40, 138 - t * 60, 255 * (cov / (SS * SS))); } // 골드(위 밝고 아래 진함)
  }
  return encodePng(S, px);
}

writeFileSync(new URL('./assets/icon.png', import.meta.url), render(256));
writeFileSync(new URL('./assets/icon-tray.png', import.meta.url), render(64));
console.log('✅ assets/icon.png(256), assets/icon-tray.png(64) 생성 — 교차 검');
