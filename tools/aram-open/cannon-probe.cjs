// 🧪 포탄(우물 대포) 타는 순간 찾기 — 죽은 챔피언을 부활 뒤 4배속으로 따라가며 위치를 재서 「아주 빠르게 움직인 구간」(초속 1200+ · 1500 넘게 이동)을 찾음
//   사용: CP_GAME=<게임> CP_DEATHS='[["게임 이름", 죽은 초], …]' node tools/replay-cam-test.cjs <게임> <죽은 초+5> <+10> <이름> <챔피언> "!tools/aram-open/cannon-probe.cjs" "" <폴더> → 이 폴더 cannon-<게임>.json
//   실측(2026-11-05 · 16.22): 부활 후 우물 대포에 ~1초 서 있다가 2.5초 동안 낮은 포물선(높이 ~200)으로 다리 1/3 지점까지 · 블루 (1340,1325)→(5240,5135) · 레드 (11450,11190)→(7605,7530)
const fs = require('fs'), path = require('path'), https = require('https');
const GAME = Number(process.env.CP_GAME), DEATHS = JSON.parse(process.env.CP_DEATHS);   // [[이름, 죽은 시각], …]
const lock = fs.readFileSync('C:/Riot Games/League of Legends/lockfile', 'utf8').split(':');
const lcu = p => new Promise(r => https.get({ host: '127.0.0.1', port: lock[2], path: p, rejectUnauthorized: false, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + lock[3]).toString('base64') } }, s => { let d = ''; s.setEncoding('utf8'); s.on('data', c => d += c); s.on('end', () => { try { r(JSON.parse(d)); } catch (_) { r(null); } }); }));
module.exports = [{ from: DEATHS[0][1] + 5, to: DEATHS[0][1] + 10, probe: async ({ scout, log }) => {
  const g = await lcu(`/lol-match-history/v1/games/${GAME}`), cs = await lcu('/lol-game-data/assets/v1/champion-summary.json');
  const alias = {}; for (const c of cs || []) alias[c.id] = c.alias;
  const pid = {}; for (const p of g.participantIdentities) pid[p.player.gameName || p.player.summonerName] = p.participantId;
  const champOf = n => { const p = g.participants.find(x => x.participantId === pid[n]); return p ? alias[p.championId] : ''; };
  const out = [];
  for (const [name, td] of DEATHS) {
    const pts = await scout(name, td + 5, td + 38, 4, champOf(name));
    if (!pts) { log(`${name} 못 따라감`); continue; }
    const segs = []; let cur = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dt = b.t - a.t; if (dt <= 0.02) continue;
      const v = Math.hypot(b.x - a.x, b.z - a.z) / dt;
      if (v > 1200 && v < 20000) { if (!cur) cur = { t0: a.t, p0: { x: a.x, z: a.z }, vmax: 0, n: 0 }; cur.t1 = b.t; cur.p1 = { x: b.x, z: b.z }; cur.vmax = Math.max(cur.vmax, v); cur.n++; }
      else if (cur) { segs.push(cur); cur = null; }
    }
    if (cur) segs.push(cur);
    const big = segs.filter(s => Math.hypot(s.p1.x - s.p0.x, s.p1.z - s.p0.z) > 1500);
    log(`${name}(${champOf(name)}) ${td}초 사망 → 빠른 이동 ${big.map(s => `${s.t0.toFixed(1)}~${s.t1.toFixed(1)}초 (${Math.round(s.p0.x)},${Math.round(s.p0.z)})→(${Math.round(s.p1.x)},${Math.round(s.p1.z)}) 최고 ${Math.round(s.vmax)}/초`).join(' | ') || '없음'}`);
    out.push({ name, alias: champOf(name), td, big, pts });
  }
  fs.writeFileSync(path.join(__dirname, `cannon-${GAME}.json`), JSON.stringify(out));
} }];
