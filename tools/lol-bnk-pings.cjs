// 🔊 v0.1.223 Wwise .bnk에서 핑 이벤트 → 소리(wem) 찾기 — 같은 폴더에 hud_audio.bnk·hud_events.bnk·names.txt(Play_sfx_hud_base_Pings_* 22개) · 결과 map.json + wem/ 폴더
//   이벤트 이름 → 번호 = 소문자 FNV-1 32 · 이벤트 → 액션 → 블렌드(9) 컨테이너 → 소리(2) 두 겹 · wem = Wwise Vorbis(0xFFFF) → ffmpeg로는 못 풂(vgmstream 필요)
// Wwise 소리 묶음(.bnk) 읽기 — 핑 이벤트 이름 → 실제 소리(wem) 번호 찾기
const fs = require('fs');
const fnv = s => { let h = 0x811c9dc5; for (const c of Buffer.from(s.toLowerCase())) { h = Math.imul(h, 0x01000193) >>> 0; h = (h ^ c) >>> 0; } return h >>> 0; };
function sections(b) { const o = {}; let p = 0; while (p + 8 <= b.length) { const id = b.toString('latin1', p, p + 4), n = b.readUInt32LE(p + 4); o[id] = b.subarray(p + 8, p + 8 + n); p += 8 + n; } return o; }
const ev = sections(fs.readFileSync('hud_events.bnk')), au = sections(fs.readFileSync('hud_audio.bnk'));
console.log('bank 버전', ev.BKHD.readUInt32LE(0));
const wems = new Map(); for (let i = 0; i < au.DIDX.length; i += 12) wems.set(au.DIDX.readUInt32LE(i), { off: au.DIDX.readUInt32LE(i + 4), size: au.DIDX.readUInt32LE(i + 8) });
const H = ev.HIRC, cnt = H.readUInt32LE(0), objs = new Map(); let p = 4; const types = {};
for (let i = 0; i < cnt; i++) { const t = H[p], n = H.readUInt32LE(p + 1), id = H.readUInt32LE(p + 5); objs.set(id, { t, body: H.subarray(p + 9, p + 5 + n) }); types[t] = (types[t] || 0) + 1; p += 5 + n; }
console.log('HIRC', cnt, JSON.stringify(types));
const names = fs.readFileSync('names.txt', 'utf8').split(/\r?\n/).filter(Boolean);
const u32s = b => { const r = []; for (let i = 0; i + 4 <= b.length; i++) r.push(b.readUInt32LE(i)); return r; };
function wemsOf(id, depth = 0, seen = new Set()) {   // 이벤트·액션·컨테이너를 따라 내려가 소리(wem) 번호 모음 — 본문 안의 u32 중 아는 번호를 따라감(대충이지만 핑처럼 작은 묶음엔 충분)
  if (depth > 6 || seen.has(id)) return []; seen.add(id);
  const o = objs.get(id); if (!o) return wems.has(id) ? [id] : [];
  if (o.t === 2) { const src = o.body.readUInt32LE(5); return wems.has(src) ? [src] : []; }
  const out = [];
  for (const v of u32s(o.body)) if (v !== id && (objs.has(v) && [2, 3, 5, 6, 9, 10].includes(objs.get(v).t))) out.push(...wemsOf(v, depth + 1, seen));
  return [...new Set(out)];
}
const res = {};
for (const nm of names) { const h = fnv(nm), o = objs.get(h); res[nm] = o ? wemsOf(h) : null; console.log(nm.padEnd(44), o ? 'type' + o.t : '없음', JSON.stringify(res[nm]), (res[nm] || []).map(w => wems.get(w).size).join(',')); }
fs.writeFileSync('map.json', JSON.stringify({ res, wems: [...wems] }));
// wem 꺼내기
fs.mkdirSync('wem', { recursive: true });
for (const ids of Object.values(res)) for (const w of ids || []) { const e = wems.get(w); fs.writeFileSync('wem/' + w + '.wem', au.DATA.subarray(e.off, e.off + e.size)); }
