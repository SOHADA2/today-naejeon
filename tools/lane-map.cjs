// 🗺️ 칼바람 나락 다리 지도 다시 만들기(2026-11-01 · replayrec.js LANE12·TOWERS12의 출처) — 롤 클라가 켜진 PC에서 전적만 읽음(리플레이·큐 안 씀)
// 사용(리포 루트): node tools/lane-map.cjs [LoL 폴더]
//   이 계정 전적의 칼바람(맵 12) 판 타임라인 → 1분마다 10명 위치·사건 위치를 모아 다리 방향(PCA)·600 간격 옆 폭(2%·98%) + 포탑·억제기 파괴 위치를 출력
//   ⚠️ 롤 패치로 맵이 바뀌면 다시 돌려 replayrec.js의 LANE12(중심·각도 포함)·TOWERS12를 바꿀 것
const fs = require('fs'), https = require('https'), path = require('path');
const LOL = process.argv[2] || process.env.LOL_DIR || 'C:/Riot Games/League of Legends';
const [, , port, pw] = fs.readFileSync(path.join(LOL, 'lockfile'), 'utf8').split(':');
const get = p => new Promise(r => https.get({ host: '127.0.0.1', port, path: p, rejectUnauthorized: false, auth: 'riot:' + pw }, res => { let s = ''; res.setEncoding('utf8'); res.on('data', c => s += c); res.on('end', () => { try { r(JSON.parse(s)); } catch (_) { r(null); } }); }).on('error', () => r(null)));
(async () => {
  const pts = [], towers = {}, games = new Set();
  for (let beg = 0; beg < 200; beg += 20) {
    const m = await get(`/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=${beg}&endIndex=${beg + 20}`);
    const list = (m && m.games && m.games.games) || [];
    if (!list.length) break;
    for (const g of list) {
      if (g.mapId !== 12 || games.has(g.gameId)) continue;
      const tl = await get(`/lol-match-history/v1/game-timelines/${g.gameId}`);
      if (!tl || !tl.frames) continue;
      games.add(g.gameId);
      for (const f of tl.frames) {
        for (const p of Object.values(f.participantFrames || {})) if (p.position) pts.push([p.position.x, p.position.y]);
        for (const e of f.events || []) {
          if (!e.position) continue;
          if (/BUILDING/.test(e.type)) { const k = `${Math.round(e.position.x / 50) * 50},${Math.round(e.position.y / 50) * 50}`; towers[k] = (towers[k] || 0) + 1; }
          else pts.push([e.position.x, e.position.y]);
        }
      }
    }
  }
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let sxx = 0, sxy = 0, syy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), c = Math.cos(th), s = Math.sin(th), bins = {};
  for (const [x, y] of pts) { const S = (x - mx) * c + (y - my) * s, P = -(x - mx) * s + (y - my) * c, b = Math.round(S / 600); (bins[b] = bins[b] || []).push(P); }
  const q = (v, f) => { v = v.slice().sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(f * v.length))]; };
  console.log(`칼바람 ${games.size}판 · 위치 ${pts.length}개 · 중심 (${mx.toFixed(0)}, ${my.toFixed(0)}) · 다리 방향 ${(th * 180 / Math.PI).toFixed(1)}°`);
  console.log('LANE12 =', JSON.stringify(Object.keys(bins).map(Number).sort((a, b) => a - b).filter(b => Math.abs(b) <= 12).map(b => [b * 600, Math.round(q(bins[b], 0.02)), Math.round(q(bins[b], 0.98))])));
  console.log('TOWERS12(파괴 위치·횟수) =', JSON.stringify(Object.entries(towers).sort((a, b) => b[1] - a[1])));
})();
