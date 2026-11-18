// 🔊 v0.1.223 롤 설치 파일(.wad.client v3) 읽기 — 읽기 전용(이 PC 롤 폴더에서 파일 하나 꺼내 보기 · 핑 소리 찾을 때 씀)
//   핑 소리 묶음 = Game/DATA/FINAL/Maps/Shipping/Common.wad.client 안 50f98eaf44561da5(hud_global_audio.bnk · 1.8MB · wem 116개) · 18c06847909e7515(hud_global_events.bnk)
//   파일 이름 ↔ 해시 = CommunityDragon raw.communitydragon.org/data/hashes/lol/hashes.game.txt
// 롤 WAD(.wad.client v3) 읽기 — 읽기 전용 · 이 PC 설치 파일에서 소리 묶음만 꺼내 봄
// node wad.cjs list <wad> [hash...]      → 그 해시가 있는지
// node wad.cjs get <wad> <hash> <out>    → 꺼내서 저장
// node wad.cjs grep <wad> <text> [max]   → 압축 풀어 글자 찾기(파일 해시·위치)
const fs = require('fs'), zlib = require('zlib');
function readWad(file) {
  const fd = fs.openSync(file, 'r'), h = Buffer.alloc(272); fs.readSync(fd, h, 0, 272, 0);
  if (h.toString('latin1', 0, 2) !== 'RW') throw new Error('WAD 아님');
  const major = h[2]; if (major !== 3) throw new Error('버전 ' + major);
  const n = h.readUInt32LE(268), ent = Buffer.alloc(n * 32); fs.readSync(fd, ent, 0, n * 32, 272);
  const list = [];
  for (let i = 0; i < n; i++) { const o = i * 32; list.push({ hash: ent.readBigUInt64LE(o).toString(16).padStart(16, '0'), off: ent.readUInt32LE(o + 8), csize: ent.readUInt32LE(o + 12), size: ent.readUInt32LE(o + 16), type: ent[o + 20] & 15, sub: ent[o + 20] >> 4 }); }
  return { fd, list };
}
function data(w, e) {
  const b = Buffer.alloc(e.csize); fs.readSync(w.fd, b, 0, e.csize, e.off);
  if (e.type === 0) return b;
  if (e.type === 1) return zlib.gunzipSync(b);
  if (e.type === 3) return zlib.zstdDecompressSync(b);
  if (e.type === 4) { try { return zlib.zstdDecompressSync(b); } catch (_) { return null; } }
  return null;
}
const [cmd, file, ...rest] = process.argv.slice(2);
const w = readWad(file);
if (cmd === 'list') { for (const h of rest) { const e = w.list.find(x => x.hash === h.toLowerCase()); console.log(h, e ? JSON.stringify(e) : '없음'); } console.log('항목', w.list.length); }
else if (cmd === 'get') { const e = w.list.find(x => x.hash === rest[0].toLowerCase()); const d = e && data(w, e); if (!d) { console.log('못 꺼냄', e && e.type); process.exit(1); } fs.writeFileSync(rest[1], d); console.log('저장', d.length, 'type', e.type); }
else if (cmd === 'grep') {
  const t = Buffer.from(rest[0]), max = +(rest[1] || 50); let hit = 0;
  for (const e of w.list) { if (e.size > 30e6) continue; let d = null; try { d = data(w, e); } catch (_) {} if (!d) continue; let i = d.indexOf(t); if (i < 0) continue; const ctx = d.toString('latin1', Math.max(0, i - 60), i + 80).replace(/[^\x20-\x7e]/g, '.'); console.log(e.hash, e.size, ctx); if (++hit >= max) break; }
}
