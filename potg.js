// ── 🎬 팟지(PLAY OF THE GAME) — v0.1.30 ─────────────────────────────────────
// 오버워치 「팟지」처럼 판이 끝나면 최고의 장면 하나를 모두가 롤 클라 가운데 창에서 같이 봄.
//  ① 수집(모든 앱, 게임 중): 롤 라이브 클라이언트(2999) 사건 기록(킬·멀티킬·에이스·오브젝트) + **내 체력**(1초마다, 내 것만 보임)
//     → 게임 끝나면 today/potg/raw/{day}/{gameId}/{이름키} 로 올림(모두 앱을 켜니 10명 체력이 다 모임)
//  ② 고르기(방장 앱): 몰아친 킬(10초 안) · 솔로킬 · 에이스 · 퍼블 · 오브젝트 스틸 · 낮은 체력으로 점수 → session.potg
//     ⚠️ 딜량은 게임 중엔 롤이 안 알려줌 → 장면 고르기엔 못 씀(판 전체 딜량은 정산 기록에 있음)
//  ③ 영상(선택): today/clips/{day}/{gameId} = 512KB 조각(base64) — 리플레이 녹화가 붙으면 방장이 올림(지금은 개발용 TN_FAKE_CLIP만)
//  ④ 정리: today/clips·today/potg/raw 는 **3일**(오늘·어제·그제, v0.1.31) — 앱이 켜질 때·30분마다 그보다 오래된 날을 지움. 각자 「내 컴퓨터에 저장」으로 소장
const https = require('https');
const fs = require('fs');
const path = require('path');

const CHUNK = 512 * 1024;        // 영상 조각 크기(base64 전) — Firebase 한 번 쓰기 부담 줄이기
const KEEP_DAYS = 3;             // 영상·수집 보관 일수(오늘 포함 · 하루 = 새벽 6시 기준)
const MULTI_GAP = 10;            // 이 초 안에 이어진 킬 = 한 장면(롤 멀티킬 기준과 같음)
const KEEP_EVENTS = ['ChampionKill', 'Multikill', 'Ace', 'FirstBlood', 'DragonKill', 'BaronKill', 'HeraldKill', 'HordeKill', 'AtakhanKill', 'InhibKilled', 'TurretKilled', 'GameEnd'];
const MULTI_LABEL = ['', '킬', '더블킬', '트리플킬', '쿼드라킬', '펜타킬'];
const MULTI_BONUS = [0, 0, 80, 200, 400, 700];

module.exports = function makePotg(d) {
  // d = { T, FIREBASE_DB, fbSet, fbDelete, getJson, dayKey, normName, userData, getPlayers, log }
  const norm = s => String(s || '').split('#')[0].replace(/\s+/g, '').toLowerCase();
  const fbKey = s => d.normName(String(s || '').split('#')[0]).replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_') || 'unknown';
  const log = m => { try { d.log('[potg] ' + m); } catch (_) {} };

  // 라이브 클라이언트(게임 중에만 열림·자체서명 인증서)
  const live = p => new Promise(resolve => {
    const req = https.get({ host: '127.0.0.1', port: 2999, path: p, rejectUnauthorized: false, timeout: 1500 }, res => {
      let s = ''; res.on('data', c => s += c); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (_) { resolve(null); } });
    });
    req.on('error', () => resolve(null)); req.on('timeout', () => { req.destroy(); resolve(null); });
  });
  const nameOf = a => String((a && (a.riotIdGameName || (typeof a.riotId === 'string' ? a.riotId.split('#')[0] : '') || a.summonerName)) || '').trim();

  // ── ① 수집 ───────────────────────────────────────────────────────────────
  let col = null;   // { gameId, me, hp:[[t,pct]], events, players, timers }
  function startCollect(gameId) {
    if (col) return;
    col = { gameId: gameId || null, me: '', hp: [], ms: [], events: [], players: [], lastHpAt: -99, busy: false };
    const hpTick = async () => {
      if (!col || col.busy) return; col.busy = true;
      try {
        const [a, g] = await Promise.all([live('/liveclientdata/activeplayer'), live('/liveclientdata/gamestats')]);
        if (col && a && g && typeof g.gameTime === 'number') {
          if (!col.me) col.me = nameOf(a);
          const cs = a.championStats || {}, pct = cs.maxHealth > 0 ? Math.max(0, Math.round(cs.currentHealth / cs.maxHealth * 100)) : null;
          const t = Math.round(g.gameTime * 2) / 2, last = col.hp[col.hp.length - 1];
          if (pct != null && (!last || Math.abs(last[1] - pct) >= 2 || t - col.lastHpAt >= 5)) { col.hp.push([t, pct]); col.lastHpAt = t; }   // 바뀔 때만(용량)
          const sp = Math.round(cs.moveSpeed || 0), lm = col.ms[col.ms.length - 1];   // 🐢 이동 속도(v0.1.44) — 여러 명이 한꺼번에 느려지면 광역 둔화 신호
          if (sp > 0 && (!lm || Math.abs(lm[1] - sp) / lm[1] >= 0.15)) col.ms.push([t, sp]);
        }
      } finally { if (col) col.busy = false; }
    };
    const evTick = async () => {
      const e = await live('/liveclientdata/eventdata');
      if (col && e && Array.isArray(e.Events)) col.events = e.Events;
      const pl = d.getPlayers(); if (col && pl && pl.length) col.players = pl;
    };
    col.t1 = setInterval(hpTick, 1000); col.t2 = setInterval(evTick, 3000); evTick();
    log(`수집 시작 (게임 ${gameId || '?'})`);
  }
  async function stopCollect(gameId) {
    if (!col) return;
    const c = col; col = null; clearInterval(c.t1); clearInterval(c.t2);
    const gid = gameId || c.gameId;
    if (!gid || !c.me || (!c.events.length && !c.hp.length)) { log('올릴 수집 없음'); return; }
    const events = c.events.filter(e => KEEP_EVENTS.includes(e.EventName)).map(e => {
      const o = { n: e.EventName, t: Math.round((e.EventTime || 0) * 10) / 10 };
      if (e.KillerName) o.k = String(e.KillerName); if (e.VictimName) o.v = String(e.VictimName);
      if (Array.isArray(e.Assisters) && e.Assisters.length) o.a = e.Assisters.map(String);
      if (e.KillStreak) o.s = e.KillStreak; if (e.Acer) o.k = String(e.Acer); if (e.AcingTeam) o.team = e.AcingTeam;
      if (e.Recipient) o.k = String(e.Recipient); if (e.Stolen === 'True' || e.Stolen === true) o.stolen = 1; if (e.DragonType) o.dt = e.DragonType;
      return o;
    });
    const rec = { name: c.me, at: Date.now(), events, hp: c.hp, ms: c.ms, players: c.players.map(p => ({ name: p.name, champ: p.champ, teamId: p.teamId, skin: p.skin == null ? null : p.skin })) };
    const r = await d.fbSet(`${d.T}/potg/raw/${d.dayKey()}/${gid}/${fbKey(c.me)}`, rec);
    log(`수집 올림 ${r.ok ? '✅' : '❌'} 사건 ${events.length} · 체력 ${c.hp.length}`);
  }

  // ── ② 고르기(방장) ────────────────────────────────────────────────────────
  // raws = {이름키: rec} · s = session · eog = 정산 선수 목록(챔피언 id)
  // opt.only = 이 이름들만 주인공 후보(🎮 같이 한 일반 판 = 우리 팀만 · 상대는 모르는 사람)
  function pickPotg(raws, s, eog, opt) {
    const list = Object.values(raws || {}).filter(Boolean);
    if (!list.length) return null;
    const src = list.slice().sort((a, b) => (b.events || []).length - (a.events || []).length)[0];   // 사건이 제일 많이 남은 PC(모두 같은 사건)
    const players = {};
    for (const r of list) for (const p of r.players || []) if (p && p.name) players[norm(p.name)] = p;
    const hpOf = {}; for (const r of list) hpOf[norm(r.name)] = r.hp || [];
    const isPlayer = n => !!players[norm(n)];
    const ev = (src.events || []).slice().sort((a, b) => a.t - b.t);
    const kills = ev.filter(e => e.n === 'ChampionKill' && isPlayer(e.k) && isPlayer(e.v));
    const champId = n => { const p = (eog || []).find(x => norm(x.summonerName) === norm(n)); return p ? p.championId : null; };
    const teamOfName = n => (s.teamA || []).some(x => norm(x) === norm(n)) ? 'teamA' : (s.teamB || []).some(x => norm(x) === norm(n)) ? 'teamB' : null;
    const minHp = (n, t0, t1) => { const h = hpOf[norm(n)]; if (!h || !h.length) return null; let m = null, prev = null;
      for (const [t, p] of h) { if (t <= t0 && (!prev || t > prev[0])) prev = [t, p]; if (t >= t0 && t <= t1) m = m == null ? p : Math.min(m, p); }
      if (prev) m = m == null ? prev[1] : Math.min(m, prev[1]); return m; };
    const cands = [];
    const byKiller = {};
    for (const k of kills) (byKiller[norm(k.k)] = byKiller[norm(k.k)] || []).push(k);
    for (const ks of Object.values(byKiller)) {
      let cur = [];
      const flush = () => { if (cur.length) cands.push({ kind: 'kills', killer: cur[0].k, ks: cur }); cur = []; };
      for (const k of ks) { if (cur.length && k.t - cur[cur.length - 1].t > MULTI_GAP) flush(); cur.push(k); }
      flush();
    }
    for (const e of ev) if (/^(DragonKill|BaronKill|HeraldKill|HordeKill|AtakhanKill)$/.test(e.n) && e.stolen && isPlayer(e.k)) cands.push({ kind: 'steal', killer: e.k, ks: [], obj: e });
    const only = opt && opt.only ? new Set(opt.only.map(norm)) : null;
    if (only) for (let i = cands.length - 1; i >= 0; i--) if (!only.has(norm(cands[i].killer))) cands.splice(i, 1);
    if (!cands.length) return null;
    const fb = ev.find(e => e.n === 'FirstBlood');
    // 💥 딜량(v0.1.45) — 게임 중엔 순간 딜량을 롤이 안 알려줘서 판 전체 딜량(정산)으로: 1위 +50 · 2위의 1.4배+면 +100 · 2위 +20 (킬 장면끼리 비슷할 때 딜러 쪽으로)
    const dmgs = (eog || []).filter(x => x && x.damage > 0).sort((a, b) => b.damage - a.damage);
    const dmgBonus = n => { const i = dmgs.findIndex(x => norm(x.summonerName) === norm(n)); if (i < 0 || i > 1) return null;
      const ratio = i === 0 && dmgs[1] ? dmgs[0].damage / dmgs[1].damage : 0;
      return { score: i === 1 ? 20 : ratio >= 1.4 ? 100 : 50, tag: i === 0 ? `딜량 1위 ${Math.round(dmgs[0].damage).toLocaleString('en-US')}` : null }; };
    for (const c of cands) {
      const n = Math.min(5, c.ks.length), t0 = c.ks.length ? c.ks[0].t : c.obj.t, t1 = c.ks.length ? c.ks[c.ks.length - 1].t : c.obj.t;
      let score = 100 * n + MULTI_BONUS[n]; const tags = [];
      const solo = c.ks.filter(k => !k.a || !k.a.length).length;
      if (solo) { score += 30 * solo; if (n === 1) tags.push('솔로킬'); }
      if (ev.some(e => e.n === 'Ace' && norm(e.k) === norm(c.killer) && e.t >= t0 && e.t <= t1 + 3)) { score += 120; tags.push('에이스'); }
      if (fb && c.ks.some(k => Math.abs(k.t - fb.t) < 1.5)) { score += 40; tags.push('퍼스트 블러드'); }
      if (c.kind === 'steal') { const big = /Baron|Atakhan/.test(c.obj.n); score += big ? 350 : 250; tags.unshift(({ BaronKill: '바론', DragonKill: '드래곤', HeraldKill: '전령', HordeKill: '공허 유충', AtakhanKill: '아타칸' })[c.obj.n] + ' 스틸'); }
      const hp = minHp(c.killer, t0 - 2, t1 + 0.5);
      if (hp != null && hp <= 40) { score += hp <= 10 ? 220 : hp <= 25 ? 120 : 40; tags.push(`체력 ${hp}%`); }
      const db = dmgBonus(c.killer); if (db) { score += db.score; if (db.tag) tags.push(db.tag); }
      score += Math.min(60, t1 / 30);   // 같은 점수면 승부처(뒤쪽)
      Object.assign(c, { n, t0, t1, score, tags, hp });
    }
    cands.sort((a, b) => b.score - a.score);
    const c = cands[0], p = players[norm(c.killer)] || {};
    const label = c.kind === 'steal' ? c.tags[0] : (c.n === 1 && c.tags.includes('솔로킬') ? '솔로킬' : MULTI_LABEL[c.n]);
    const name = (s.teamA || []).concat(s.teamB || []).find(x => norm(x) === norm(c.killer)) || String(c.killer).split('#')[0];
    return {
      name, champ: p.champ || '', championId: champId(c.killer), team: teamOfName(c.killer), skin: p.skin == null ? null : p.skin,
      label, tags: c.tags.filter(t => t !== label), score: Math.round(c.score),
      t0: c.t0, t1: c.t1, clipFrom: Math.max(0, Math.floor(c.t0 - 5)), clipTo: Math.ceil(c.t1 + 3),   // 팟지 공식: 킬 5초 전부터(빌드업) — v0.1.35 8→5초
      kills: c.ks.map(k => { const v = players[norm(k.v)] || {}; return { t: k.t, victim: String(k.v).split('#')[0], champ: v.champ || '', championId: champId(k.v), solo: !k.a || !k.a.length }; }),
      obj: c.obj ? { n: c.obj.n, t: c.obj.t } : null,
      apps: list.length,
    };
  }
  // ── ②-2 숨은 영웅(v0.1.44 · 방장) — 킬이 아닌 서포터·탱커 장면 하나 ─────────────────────
  //  게임 중 시각이 있는 재료 = 킬 기록(어시스트 포함) · 10명 각자의 체력(1초) · 이동 속도 / 시각 없는 재료 = 정산 합계(힐·보호막·받은 피해·CC 시간)
  //  ① 한타 = 이어진 킬(10초 안) + 그 앞으로 이어진 체력 깎임(3초 안 간격) · 우리 팀 킬 ≥ 우리 팀 죽음인 한타만
  //  ② 장면 종류: 광역 이니시(적 여러 명이 1.5초 안에 한꺼번에 깎임 + 그 팀 CC 시간 1위) · 버티기(체력 크게 받아내고 생존)
  //     · 세이브(아군이 25% 아래로 떨어졌다 크게 회복 + 그 팀 힐·보호막 1위) · 한타 설계(어시스트 3+ · 킬 1 이하)
  //  ③ 정산 합계가 압도적(2위의 1.5배+)이면 큰 보너스·낮은 문턱 · 팟지 주인공은 빼고 고름
  const HERO_MIN = 260, HERO_MIN_DOM = 180;
  // v0.1.67: 점수만 넘으면 거의 매 판 나왔음(10/28~29 15판 중 14판 · 어시 3~4개 「한타 설계」가 대부분) → 사장님: 쓸만한 장면 없으면 안 넣어도 됨(평범한 장면이 더 별로)
  //   종류별 「특별함」 문턱을 넘어야 후보: 한타 설계 = 어시 6+(5개면 에이스 + 살아남음 — 칼바람은 5어시 한타가 흔함) · 광역 이니시 = 적 4명+ 동시 적중(3명이면 CC 압도) · 버티기 = 체력 100%+ 받아내고 20% 아래까지 갔다 생존(또는 받은 피해 압도)
  //   · 세이브 = 실제로 아군을 살림 + 점수 350+ · 회복만 많은 「생명줄」은 힐 압도일 때만
  const heroSpecial = c => c.kind === 'play' ? c.P.assists >= 6 || (c.P.assists >= 5 && c.ace && !c.P.dead) : c.kind === 'engage' ? c.hitWho.length >= 4 || c.dom : c.kind === 'tank' ? (c.P.taken >= 100 && c.P.minHp != null && c.P.minHp <= 20) || c.dom : c.kind === 'save' ? c.score >= 350 || c.dom : c.dom;
  const HERO_LABEL = { engage: ['광역 이니시', 'BIG ENGAGE'], tank: ['버티기', 'UNKILLABLE'], save: ['세이브', 'CLUTCH SAVE'], heal: ['생명줄', 'LIFELINE'], play: ['한타 설계', 'PLAYMAKER'] };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  function steps(series) {   // 체력 기록 → 깎임/회복 조각 [{t, d}] (부활로 차오른 건 뺌)
    const out = [];
    for (let i = 1; i < (series || []).length; i++) {
      const [, p0] = series[i - 1], [t1, p1] = series[i];
      if (p1 === p0) continue;
      if (p1 > p0 && p0 <= 3 && p1 - p0 >= 50) continue;   // 부활
      out.push({ t: t1, d: p1 - p0 });
    }
    return out;
  }
  function heroStats(eog) {   // 정산 합계 → 사람별 {sup, tank, cc} 값·전체 순위·팀 순위·2위 대비 배율(1위만)
    const rows = (eog || []).filter(p => p && p.summonerName);
    const val = { sup: p => (p.healMates || 0) + (p.shieldMates || 0), tank: p => (p.taken || 0) + (p.mitig || 0), cc: p => p.cc || 0 };
    const out = {};
    for (const [k, f] of Object.entries(val)) {
      const sorted = rows.map(p => ({ n: norm(p.summonerName), v: f(p), team: p.teamId })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
      sorted.forEach((x, i) => {
        const teamRank = sorted.filter(y => y.team === x.team).indexOf(x) + 1;
        (out[x.n] = out[x.n] || {})[k] = { v: x.v, rank: i + 1, teamRank, ratio: i === 0 && sorted[1] ? x.v / sorted[1].v : null };
      });
    }
    return out;
  }
  function pickHero(raws, s, eog, potgName, opt) {
    const only = opt && opt.only ? new Set(opt.only.map(norm)) : null;
    const list = Object.values(raws || {}).filter(Boolean);
    if (!list.length) return null;
    const src = list.slice().sort((a, b) => (b.events || []).length - (a.events || []).length)[0];
    const players = {}; for (const r of list) for (const p of r.players || []) if (p && p.name) players[norm(p.name)] = p;
    const side = n => (players[n] || {}).teamId || 0;
    const hpOf = {}, msOf = {}; for (const r of list) { hpOf[norm(r.name)] = r.hp || []; msOf[norm(r.name)] = r.ms || []; }
    const ev = (src.events || []).slice().sort((a, b) => a.t - b.t);
    const kills = ev.filter(e => e.n === 'ChampionKill' && players[norm(e.k)] && players[norm(e.v)]);
    if (!kills.length) return null;
    const st = heroStats(eog);
    const dmgRank = {}; (eog || []).slice().sort((a, b) => (b.damage || 0) - (a.damage || 0)).forEach((p, i) => { if (p.damage) dmgRank[norm(p.summonerName)] = i + 1; });
    const champId = n => { const p = (eog || []).find(x => norm(x.summonerName) === norm(n)); return p ? p.championId : null; };
    const dmg = []; for (const [n, h] of Object.entries(hpOf)) for (const x of steps(h)) if (x.d < 0) dmg.push(Object.assign({ n }, x));
    dmg.sort((a, b) => a.t - b.t);
    // ① 한타 나누기
    const fights = []; let cur = [];
    for (const k of kills) { if (cur.length && k.t - cur[cur.length - 1].t > MULTI_GAP) { fights.push(cur); cur = []; } cur.push(k); }
    if (cur.length) fights.push(cur);
    const cands = [];
    for (const ks of fights) {
      const k0 = ks[0].t, kN = ks[ks.length - 1].t;
      let start = k0;   // 첫 킬 앞으로 3초 안 간격으로 이어진 체력 깎임까지(최대 10초)
      for (let i = dmg.length - 1; i >= 0; i--) { const x = dmg[i]; if (x.t > k0) continue; if (x.t < k0 - 12) break; if (start - x.t <= 3) start = x.t; }
      start = Math.max(start, k0 - 10); const end = kN + 2;
      const deadAt = {}; for (const k of ks) if (deadAt[norm(k.v)] == null) deadAt[norm(k.v)] = k.t;
      const inFight = (n, t) => t >= start - 0.5 && t <= end && (deadAt[n] == null || t <= deadAt[n] + 0.5);
      const per = {};
      for (const n of Object.keys(players)) {
        const xs = steps(hpOf[n]).filter(x => inFight(n, x.t));
        let minHp = null, minAt = null;
        for (const [t, p] of hpOf[n] || []) if (inFight(n, t) && (minHp == null || p < minHp)) { minHp = p; minAt = t; }
        per[n] = { taken: -xs.filter(x => x.d < 0).reduce((a, x) => a + x.d, 0), healed: xs.filter(x => x.d > 0).reduce((a, x) => a + x.d, 0),
          minHp, minAt, firstHit: (xs.find(x => x.d < 0) || {}).t, rises: xs.filter(x => x.d > 0),
          kills: ks.filter(k => norm(k.k) === n).length, assists: ks.filter(k => (k.a || []).some(a => norm(a) === n)).length, dead: deadAt[n] != null };
      }
      for (const X of [100, 200]) {
        const mates = Object.keys(players).filter(n => side(n) === X), foes = Object.keys(players).filter(n => side(n) && side(n) !== X);
        const teamK = ks.filter(k => side(norm(k.k)) === X).length, teamD = ks.filter(k => side(norm(k.v)) === X).length;
        if (!teamK || teamK < teamD) continue;   // 이긴(또는 비긴) 한타만
        const ace = ev.some(e => e.n === 'Ace' && e.t >= start && e.t <= end + 3 && side(norm(e.k)) === X);
        // 광역: 적이 1.5초 안에 몇 명이나 한꺼번에 깎였나(6%+) · 그때 이동 속도가 한꺼번에 25%+ 떨어진 적 수
        let hits = 0, hitAt = null, hitWho = [];
        const fd = dmg.filter(x => foes.includes(x.n) && x.d <= -6 && x.t >= start - 0.5 && x.t <= end);
        for (const a of fd) { const who = [...new Set(fd.filter(b => b.t >= a.t && b.t <= a.t + 1.5).map(b => b.n))]; if (who.length > hits) { hits = who.length; hitAt = a.t; hitWho = who; } }
        let slows = 0;
        if (hitAt != null) slows = foes.filter(n => { const m = msOf[n] || []; for (let i = 1; i < m.length; i++) if (m[i][0] >= hitAt - 1 && m[i][0] <= hitAt + 2 && m[i][1] <= m[i - 1][1] * 0.75) return true; return false; }).length;
        const firstMate = mates.filter(n => per[n].firstHit != null).sort((a, b) => per[a].firstHit - per[b].firstHit)[0];
        for (const n of mates) {
          if (potgName && n === norm(potgName)) continue;
          if (only && !only.has(n)) continue;
          const P = per[n], S = st[n] || {}, involved = P.kills + P.assists;
          const base = { n, start, end, teamK, P };
          // 광역 이니시 — 누가 걸었는지는 롤이 안 알려줌 → 그 팀 CC 시간 1위(정산 없으면 우리 팀에서 제일 먼저 맞은 사람)
          if (hits >= 3 && involved >= 1 && (S.cc ? S.cc.teamRank === 1 : n === firstMate)) {
            const dom = !!(S.cc && S.cc.ratio >= 1.5);
            const score = 75 * hits + (hits >= 5 ? 100 : 0) + 45 * teamK + 15 * slows + (dom ? 110 : S.cc && S.cc.rank === 1 ? 50 : 20) + (P.dead ? 0 : 30);
            const tags = [`적 ${hits}명 동시 적중`]; if (slows >= 2) tags.push(`${slows}명 둔화`);
            if (S.cc) tags.push(`${S.cc.rank === 1 ? 'CC 1위' : '팀 CC 1위'} ${Math.round(S.cc.v)}초`);
            tags.push(`한타 ${teamK}킬`);
            cands.push(Object.assign({}, base, { kind: 'engage', score, peak: hitAt, tags, hitWho, dom }));
          }
          // 버티기 — 한타 동안 깎인 체력 합(%)이 크고 살아남음
          if (!P.dead && P.taken >= 70 && (teamK >= 2 || (P.minHp != null && P.minHp <= 15))) {
            const dom = !!(S.tank && S.tank.ratio >= 1.4);
            const score = 1.3 * Math.min(P.taken, 300) + (P.minHp <= 15 ? 90 : P.minHp <= 30 ? 45 : 0) + 45 * teamK + (dom ? 100 : S.tank && S.tank.rank === 1 ? 40 : 0) + (n === firstMate ? 35 : 0) + 0.4 * Math.min(P.healed, 150);
            const tags = [`받아낸 피해 체력의 ${Math.round(P.taken)}%`]; if (P.minHp != null && P.minHp <= 30) tags.push(`최저 체력 ${P.minHp}%`);
            if (S.tank && S.tank.rank === 1) tags.push(`받은 피해 1위 ${fmt(S.tank.v)}`); tags.push(`한타 ${teamK}킬`);
            cands.push(Object.assign({}, base, { kind: 'tank', score, peak: P.minAt, tags, dom }));
          }
          // 세이브·생명줄 — 누가 살렸는지는 롤이 안 알려줌 → 그 팀 힐·보호막 1위(정산 없으면 어시스트 2+·킬 1 이하)를 살린 사람으로 봄
          if (S.sup ? S.sup.teamRank === 1 : (P.assists >= 2 && P.kills <= 1)) {
            const saved = []; let allyHeal = 0, bestRise = null;
            for (const m of mates) {
              if (m === n) continue; const Q = per[m]; allyHeal += Q.healed;
              const low = (hpOf[m] || []).find(([t, p]) => inFight(m, t) && p <= 25);
              if (low && !Q.dead) { const rs = Q.rises.filter(r => r.t > low[0] && r.t <= low[0] + 5), up = rs.reduce((a, r) => a + r.d, 0); if (up >= 20) saved.push({ n: m, low: low[1], up, t: low[0], at: rs.slice().sort((a, b) => b.d - a.d)[0].t }); }   // at = 가장 크게 차오른 순간(정지 화면)
              for (const r of Q.rises) if (!bestRise || r.d > bestRise.d) bestRise = r;
            }
            if (saved.length || allyHeal >= 60) {
              const dom = !!(S.sup && S.sup.ratio >= 1.5);
              const score = 90 * saved.length + 0.9 * Math.min(allyHeal, 300) + 40 * teamK - 40 * (ks.filter(k => side(norm(k.v)) === X).length) + (dom ? 120 : S.sup && S.sup.rank === 1 ? 50 : 0) + (P.dead ? 0 : 20);
              const tags = []; if (saved.length) tags.push(`아군 ${saved.length}명 구함`); tags.push(`아군 회복 +${Math.round(allyHeal)}%`);
              if (S.sup) tags.push(`힐·보호막 ${S.sup.rank === 1 ? '1위' : '팀 1위'} ${fmt(S.sup.v)}`);
              const sv = saved.sort((a, b) => b.up - a.up)[0];
              cands.push(Object.assign({}, base, { kind: sv ? 'save' : 'heal', score, peak: sv ? sv.at : bestRise ? bestRise.t : P.minAt, tags, ally: sv || null, dom }));
            }
          }
          // 한타 설계 — 킬은 안 먹고 어시스트로 판을 만듦 · 칼바람은 한타가 잦아 어시스트 3개가 흔함 → 점수 낮게, 그 판 딜량 1·2위(딜러)는 깎음
          if (P.assists >= 3 && P.kills <= 1) {
            const score = 60 * P.assists + 35 * teamK + (ace ? 70 : 0) + (P.dead ? 0 : 20) - ((dmgRank[n] || 9) <= 2 ? 120 : 0);
            const myKs = ks.filter(k => (k.a || []).some(a => norm(a) === n) || norm(k.k) === n);
            cands.push(Object.assign({}, base, { kind: 'play', score, ace, peak: myKs[myKs.length - 1].t, tags: [`어시스트 ${P.assists}`, `한타 ${teamK}킬`].concat(ace ? ['에이스'] : []), myKs }));
          }
        }
      }
    }
    for (const c of cands) { if (c.peak == null) c.peak = c.start; c.score += Math.min(40, c.peak / 45); }   // 같은 점수면 승부처(뒤쪽)
    cands.sort((a, b) => b.score - a.score);
    // v0.1.58: 팟지와 같은 한타면 건너뜀(사장님: 어시스트 많이 묻힌 사람이 팟지 장면 그대로 「한타 설계」로 붙음 — 10/29 540~556 vs 541~553)
    const clipOf = c => { const f = Math.max(0, Math.floor(Math.max(c.start - 2, c.peak - 8))); return [f, Math.ceil(Math.max(c.peak + 2.5, Math.min(c.end + 1, f + 12)))]; };
    const avoid = opt && Array.isArray(opt.avoid) ? opt.avoid : null;
    // v0.1.66: 영상 구간만 비교하면 같은 한타의 「이니시」(바로 앞 장면)가 빠져나감(10/29 이니시 525~537 · 팟지 537~557, 한타는 527~555 하나) → 한타 전체가 팟지 구간과 겹쳐도 건너뜀
    const clash = c => { if (!avoid) return false; const [f, t] = clipOf(c); return (f < avoid[1] && t > avoid[0]) || (c.start < avoid[1] && c.end > avoid[0]); };
    const c = cands.find(x => x.score >= (x.dom ? HERO_MIN_DOM : HERO_MIN) && heroSpecial(x) && !clash(x));
    if (!c) return null;
    const p = players[c.n] || {}, S = st[c.n] || {};
    const name = (s.teamA || []).concat(s.teamB || []).find(x => norm(x) === c.n) || String(p.name || c.n).split('#')[0];
    const team = (s.teamA || []).some(x => norm(x) === c.n) ? 'teamA' : (s.teamB || []).some(x => norm(x) === c.n) ? 'teamB' : null;
    const [clipFrom, clipTo] = clipOf(c);
    const trim = h => (h || []).filter(([t]) => t >= clipFrom - 3 && t <= clipTo + 1);
    const who = n => { const v = players[n] || {}; return { name: String(v.name || n).split('#')[0], champ: v.champ || '', championId: champId(n) }; };
    const stats = [];   // 끝 화면 판 전체 지표(정산) — 그 사람이 1위·팀 1위인 것만
    const statRow = (k, label, unit) => { const x = S[k]; if (x && x.teamRank === 1) stats.push({ label, v: Math.round(x.v), unit: unit || '', rank: x.rank, ratio: x.ratio ? +x.ratio.toFixed(1) : null }); };
    statRow('sup', '아군 힐·보호막'); statRow('tank', '받아낸 피해'); statRow('cc', 'CC 건 시간', '초');
    return {
      kind: c.kind, name, champ: p.champ || '', championId: champId(c.n), team, skin: p.skin == null ? null : p.skin,
      label: HERO_LABEL[c.kind][0], en: HERO_LABEL[c.kind][1], tags: c.tags, score: Math.round(c.score),
      t0: c.start, t1: c.end, peak: c.peak, clipFrom, clipTo, stats,
      hp: trim(hpOf[c.n]), taken: Math.round(c.P.taken), minHp: c.P.minHp,
      hits: c.kind === 'engage' ? c.hitWho.map(who) : null,
      ally: c.ally ? Object.assign(who(c.ally.n), { hp: trim(hpOf[c.ally.n]), low: c.ally.low, up: Math.round(c.ally.up), t: c.ally.t }) : null,
      assists: c.kind === 'play' ? c.myKs.map(k => Object.assign(who(norm(k.v)), { t: k.t, mine: norm(k.k) === c.n })) : null,
    };
  }
  async function readRaws(gameId) {
    for (const day of [d.dayKey(), d.dayKey(Date.now() - 6 * 3600 * 1000)]) {
      const r = await d.getJson(`${d.FIREBASE_DB}/${d.T}/potg/raw/${day}/${gameId}.json`);
      if (r && typeof r === 'object') return r;
    }
    return null;
  }

  // ── ③ 영상 조각 ───────────────────────────────────────────────────────────
  // 🎞️ v0.1.69 영상 = **GitHub 릴리스**(비공개 저장소 · 날마다 릴리스 `clips-YYYY-MM-DD` · 영상 = 그 릴리스 파일 · 받는 양 제한 없음)
  //   사장님: Firebase 무료 한도(내려받기 월 10GB)는 거의 다 「모두가 팟지 영상을 받아 보는 것」 → 영상은 GitHub만(Firebase 예비 없음 — 사장님 지시)
  //   v0.1.68 litterbox는 실패(업로드 500/412 → 집 IP가 BunkerWeb에 차단) → 버림
  //   저장소·토큰 = Firebase `today/config/clips` {repo, token}(토큰 = 그 저장소 Contents 읽기·쓰기만 · 바꾸면 앱 업데이트 없이 반영 · 10분 캐시) · 개발 = env TN_CLIPS_REPO+TN_CLIPS_TOKEN
  //   실패 = 영상 없음(킬 타임라인 카드) · Firebase 조각 받기는 v0.1.67 이전에 올라간 옛 영상(meta.n>0)만
  const GH = process.env.TN_GH_API || 'https://api.github.com';
  let _gh = null;
  async function ghCfg() {
    if (_gh && Date.now() - _gh.at < 600000) return _gh;
    const c = process.env.TN_CLIPS_REPO && process.env.TN_CLIPS_TOKEN ? { repo: process.env.TN_CLIPS_REPO, token: process.env.TN_CLIPS_TOKEN }
      : await d.getJson(`${d.FIREBASE_DB}/${d.T}/config/clips.json`);
    _gh = c && c.repo && c.token ? { repo: c.repo, token: c.token, at: Date.now() } : null;
    return _gh;
  }
  async function gh(cfg, method, p, body, o) {
    const r = await fetch(/^https?:/.test(p) ? p : `${GH}/repos/${cfg.repo}${p}`, { method, redirect: (o && o.redirect) || 'follow',
      headers: Object.assign({ Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'today-naejeon' }, o && o.headers),
      body: body == null ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body), signal: AbortSignal.timeout((o && o.timeout) || 30000) });
    let j = null; if (r.status < 300 || r.status >= 400) try { j = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, j, r };
  }
  async function dayRelease(cfg, day) {   // 그날 릴리스(없으면 만듦 · 다른 앱이 동시에 만들었으면 다시 찾음)
    const tag = `clips-${day}`;
    let r = await gh(cfg, 'GET', `/releases/tags/${tag}`); if (r.ok) return r.j;
    r = await gh(cfg, 'POST', '/releases', { tag_name: tag, name: `팟지 영상 ${day}`, body: '투데이 내전 앱이 자동으로 올리고 3일 뒤 지움' }); if (r.ok) return r.j;
    log(`영상 릴리스 만들기 실패 ${r.status} ${JSON.stringify(r.j || {}).slice(0, 120)}`);
    r = await gh(cfg, 'GET', `/releases/tags/${tag}`); return r.ok ? r.j : null;
  }
  async function uploadClip(gameId, buf, mime) {
    const day = d.dayKey();
    mime = mime || 'video/webm';
    try {
      const cfg = await ghCfg(); if (!cfg) { log('영상 저장소 설정 없음(today/config/clips) → 영상 없음'); return null; }
      const rel = await dayRelease(cfg, day); if (!rel) return null;
      const name = `${String(gameId).replace(/[^\w-]/g, '')}-${Date.now().toString(36)}.${extOf(mime)}`;   // 같은 판 다시 올려도 안 부딪힘
      const r = await gh(cfg, 'POST', `${rel.upload_url.replace(/\{.*$/, '')}?name=${encodeURIComponent(name)}`, buf, { headers: { 'Content-Type': mime }, timeout: 180000 });
      if (!r.ok || !r.j || !r.j.id) { log(`영상 올리기 실패 ${r.status} ${JSON.stringify(r.j || {}).slice(0, 120)}`); return null; }
      const meta = { day, gameId: String(gameId), n: 0, size: buf.length, mime, at: Date.now(), gh: r.j.id };
      log(`영상 올림 ✅ ${(buf.length / 1048576).toFixed(1)}MB · GitHub ${name}`);
      return meta;
    } catch (e) { log('영상 올리기 실패 ' + e.message); return null; }
  }
  async function getGh(meta) {   // 비공개 저장소 파일 = API가 서명된 임시 주소로 넘겨줌 → 그 주소는 토큰 없이 받음
    const cfg = await ghCfg(); if (!cfg) { log('영상 저장소 설정 없음 → 영상 못 받음'); return null; }
    const r = await gh(cfg, 'GET', `/releases/assets/${meta.gh}`, null, { headers: { Accept: 'application/octet-stream' }, redirect: 'manual' });
    const loc = r.r.headers.get('location');
    const res = loc ? await fetch(loc, { signal: AbortSignal.timeout(90000) }) : r.r;
    if (!res.ok) { log(`영상 받기 실패 ${r.status}/${res.status}`); return null; }
    return Buffer.from(await res.arrayBuffer());
  }
  const clipDir = () => path.join(d.userData, 'clips');
  const extOf = mime => /mp4/.test(mime || '') ? 'mp4' : 'webm';
  async function getClip(meta) {   // → 내 PC 임시 파일 경로(한 번 받으면 재사용)
    if (!meta || (!meta.n && !meta.gh)) return null;
    fs.mkdirSync(clipDir(), { recursive: true });
    const f = path.join(clipDir(), `${String(meta.gameId).replace(/[^\w-]/g, '')}.${extOf(meta.mime)}`);
    try { if (fs.statSync(f).size === meta.size) return f; } catch (_) {}
    if (meta.gh) {   // 🎞️ GitHub만(Firebase 한도 안 씀)
      try {
        const buf = await getGh(meta);
        if (buf && buf.length === meta.size) { fs.writeFileSync(f, buf); return f; }
        if (buf) log(`영상 크기 불일치 ${buf.length}/${meta.size}`);
      } catch (e) { log('영상 받기 실패 ' + e.message); }
      return null;
    }
    const parts = new Array(meta.n);
    let next = 0;
    const worker = async () => { while (next < meta.n) { const i = next++; const s = await d.getJson(`${d.FIREBASE_DB}/${d.T}/clips/${meta.day}/${meta.gameId}/c/${i}.json`); if (typeof s !== 'string') throw new Error('chunk ' + i); parts[i] = Buffer.from(s, 'base64'); } };
    try { await Promise.all([worker(), worker(), worker(), worker()]); } catch (e) { log('영상 받기 실패 ' + e.message); return null; }
    const buf = Buffer.concat(parts);
    if (buf.length !== meta.size) { log('영상 크기 불일치'); return null; }
    fs.writeFileSync(f, buf);
    return f;
  }

  // ── ④ 정리: 3일 지난 영상·수집 지우기 + 내 PC 임시 영상도 3일 지난 것 ─────────────
  async function cleanup() {
    const oldest = d.dayKey(Date.now() - (KEEP_DAYS - 1) * 86400000);   // 이 날짜보다 앞이면 삭제(YYYY-MM-DD 문자열 비교)
    for (const root of ['clips', 'potg/raw']) {
      const days = await d.getJson(`${d.FIREBASE_DB}/${d.T}/${root}.json?shallow=true`);
      if (!days || typeof days !== 'object') continue;
      for (const day of Object.keys(days)) if (day < oldest) { await d.fbDelete(`${d.T}/${root}/${day}`); log(`지난 ${root} 삭제: ${day}`); }
    }
    try {   // 🎞️ GitHub 릴리스도 3일 지난 날 지움(릴리스 + 태그)
      const cfg = await ghCfg();
      const r = cfg && await gh(cfg, 'GET', '/releases?per_page=100');
      for (const rel of (r && r.ok && Array.isArray(r.j) ? r.j : [])) {
        const m = /^clips-(\d{4}-\d\d-\d\d)$/.exec(rel.tag_name || ''); if (!m || m[1] >= oldest) continue;
        const del = await gh(cfg, 'DELETE', `/releases/${rel.id}`);
        if (del.ok || del.status === 404) { await gh(cfg, 'DELETE', `/git/refs/tags/${rel.tag_name}`); log(`지난 영상 릴리스 삭제: ${m[1]}`); }
      }
    } catch (e) { log('영상 릴리스 정리 실패 ' + e.message); }
    try { for (const f of fs.readdirSync(clipDir())) { const p = path.join(clipDir(), f); if (Date.now() - fs.statSync(p).mtimeMs > KEEP_DAYS * 86400000) fs.unlinkSync(p); } } catch (_) {}
  }

  // 🖼️ 스킨 일러스트 주소(v0.1.43) — CommunityDragon 챔피언 정보에서 그 스킨(크로마면 원래 스킨)의 가운데 맞춘 일러스트 1280×720 · 못 찾으면 기본 스킨
  const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
  const cdPath = p => p ? CD + '/' + String(p).replace(/^\/lol-game-data\/assets\//i, '').toLowerCase() : null;
  async function splashFor(championId, skin) {
    if (!championId) return null;
    const j = await d.getJson(`${CD}/v1/champions/${Number(championId)}.json`);
    const skins = (j && j.skins) || []; if (!skins.length) return null;
    const want = Number(championId) * 1000 + (Number(skin) || 0);
    const s = skins.find(x => x.id === want) || skins.find(x => (x.chromas || []).some(cr => cr.id === want)) || skins.find(x => x.isBase) || skins[0];
    return cdPath(s.splashPath || s.uncenteredSplashPath);
  }

  return { splashFor, startCollect, stopCollect, pickPotg, pickHero, heroStats, readRaws, uploadClip, getClip, cleanup, extOf, _pick: pickPotg };
};
