// 🎬 팟지 영상 받아서 파일로(읽기만) — 점검 작업이 ffprobe·장면 캡처로 영상 내용 확인할 때 씀
// 사용: node tools/clip-dump.cjs [날짜] 출력폴더
const fs = require('fs'), path = require('path');
const DB = 'https://aramchaos-ca022-default-rtdb.asia-southeast1.firebasedatabase.app/today';
const get = async p => { const r = await fetch(`${DB}/${p}.json`); return r.ok ? r.json() : null; };
const dayKey = (t = Date.now()) => { const d = new Date(t - 6 * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
(async () => {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2] || '') ? process.argv[2] : dayKey(), out = process.argv[3] || process.argv[2] || 'clips';
  fs.mkdirSync(out, { recursive: true });
  const ids = Object.keys(await get(`clips/${day}?shallow=true`) || {});
  const ms = await get(`days/${day}/matches`) || {};
  for (const gid of ids) {
    const meta = await get(`clips/${day}/${gid}/meta`); if (!meta) continue;
    const parts = []; for (let i = 0; i < meta.n; i++) parts.push(Buffer.from(await get(`clips/${day}/${gid}/c/${i}`) || '', 'base64'));
    const buf = Buffer.concat(parts), f = path.join(out, `${gid}.webm`); fs.writeFileSync(f, buf);
    const p = (ms[gid] || {}).potg || {};
    fs.writeFileSync(path.join(out, `${gid}.json`), JSON.stringify({ size: buf.length, metaSize: meta.size, clipFrom: p.clipFrom, clipTo: p.clipTo, t0: p.t0, t1: p.t1, name: p.name, champ: p.champ, kills: (p.kills || []).map(k => k.t) }));
    console.log(`${gid} · ${(buf.length / 1048576).toFixed(1)}MB (서버 ${(meta.size / 1048576).toFixed(1)}MB) · 장면 ${p.clipFrom}~${p.clipTo}초 · 킬 ${(p.kills || []).map(k => k.t).join(', ')}`);
  }
})().catch(e => console.log('실패:', e.message));
