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
    col = { gameId: gameId || null, me: '', hp: [], events: [], players: [], lastHpAt: -99, busy: false };
    const hpTick = async () => {
      if (!col || col.busy) return; col.busy = true;
      try {
        const [a, g] = await Promise.all([live('/liveclientdata/activeplayer'), live('/liveclientdata/gamestats')]);
        if (col && a && g && typeof g.gameTime === 'number') {
          if (!col.me) col.me = nameOf(a);
          const cs = a.championStats || {}, pct = cs.maxHealth > 0 ? Math.max(0, Math.round(cs.currentHealth / cs.maxHealth * 100)) : null;
          const t = Math.round(g.gameTime * 2) / 2, last = col.hp[col.hp.length - 1];
          if (pct != null && (!last || Math.abs(last[1] - pct) >= 2 || t - col.lastHpAt >= 5)) { col.hp.push([t, pct]); col.lastHpAt = t; }   // 바뀔 때만(용량)
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
    const rec = { name: c.me, at: Date.now(), events, hp: c.hp, players: c.players.map(p => ({ name: p.name, champ: p.champ, teamId: p.teamId })) };
    const r = await d.fbSet(`${d.T}/potg/raw/${d.dayKey()}/${gid}/${fbKey(c.me)}`, rec);
    log(`수집 올림 ${r.ok ? '✅' : '❌'} 사건 ${events.length} · 체력 ${c.hp.length}`);
  }

  // ── ② 고르기(방장) ────────────────────────────────────────────────────────
  // raws = {이름키: rec} · s = session · eog = 정산 선수 목록(챔피언 id)
  function pickPotg(raws, s, eog) {
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
    if (!cands.length) return null;
    const fb = ev.find(e => e.n === 'FirstBlood');
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
      score += Math.min(60, t1 / 30);   // 같은 점수면 승부처(뒤쪽)
      Object.assign(c, { n, t0, t1, score, tags, hp });
    }
    cands.sort((a, b) => b.score - a.score);
    const c = cands[0], p = players[norm(c.killer)] || {};
    const label = c.kind === 'steal' ? c.tags[0] : (c.n === 1 && c.tags.includes('솔로킬') ? '솔로킬' : MULTI_LABEL[c.n]);
    const name = (s.teamA || []).concat(s.teamB || []).find(x => norm(x) === norm(c.killer)) || String(c.killer).split('#')[0];
    return {
      name, champ: p.champ || '', championId: champId(c.killer), team: teamOfName(c.killer),
      label, tags: c.tags.filter(t => t !== label), score: Math.round(c.score),
      t0: c.t0, t1: c.t1, clipFrom: Math.max(0, Math.floor(c.t0 - 5)), clipTo: Math.ceil(c.t1 + 3),   // 팟지 공식: 킬 5초 전부터(빌드업) — v0.1.35 8→5초
      kills: c.ks.map(k => { const v = players[norm(k.v)] || {}; return { t: k.t, victim: String(k.v).split('#')[0], champ: v.champ || '', championId: champId(k.v), solo: !k.a || !k.a.length }; }),
      obj: c.obj ? { n: c.obj.n, t: c.obj.t } : null,
      apps: list.length,
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
  async function uploadClip(gameId, buf, mime) {
    const day = d.dayKey(), base = `${d.T}/clips/${day}/${gameId}`, n = Math.ceil(buf.length / CHUNK);
    for (let i = 0; i < n; i++) {
      const r = await d.fbSet(`${base}/c/${i}`, buf.subarray(i * CHUNK, (i + 1) * CHUNK).toString('base64'));
      if (!r.ok) { log(`영상 조각 ${i} 올리기 실패`); return null; }
    }
    const meta = { day, gameId: String(gameId), n, size: buf.length, mime: mime || 'video/webm', at: Date.now() };
    await d.fbSet(`${base}/meta`, meta);
    log(`영상 올림 ✅ ${(buf.length / 1048576).toFixed(1)}MB · 조각 ${n}`);
    return meta;
  }
  const clipDir = () => path.join(d.userData, 'clips');
  const extOf = mime => /mp4/.test(mime || '') ? 'mp4' : 'webm';
  async function getClip(meta) {   // → 내 PC 임시 파일 경로(한 번 받으면 재사용)
    if (!meta || !meta.n) return null;
    fs.mkdirSync(clipDir(), { recursive: true });
    const f = path.join(clipDir(), `${String(meta.gameId).replace(/[^\w-]/g, '')}.${extOf(meta.mime)}`);
    try { if (fs.statSync(f).size === meta.size) return f; } catch (_) {}
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
    try { for (const f of fs.readdirSync(clipDir())) { const p = path.join(clipDir(), f); if (Date.now() - fs.statSync(p).mtimeMs > KEEP_DAYS * 86400000) fs.unlinkSync(p); } } catch (_) {}
  }

  return { startCollect, stopCollect, pickPotg, readRaws, uploadClip, getClip, cleanup, extOf, _pick: pickPotg };
};
