// ── 투데이 내전 · 오른쪽 패널 — 입장 · 팀짜기(방장) · 오늘 기록 ───────────────
const $ = id => document.getElementById(id);
const nn = s => String(s || '').trim().replace(/\s+/g, ' ');
const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 🌌 헥스텍 배경(aram-overlay sidepanel 이식)
(function buildHexfield() {
  const NS = 'http://www.w3.org/2000/svg';
  const VB_W = 900, VB_H = 1300, R = 30, w = R * 0.8660254, dy = 1.5 * R, dx = 2 * w;
  const cols = Math.ceil(VB_W / dx) + 2, rows = Math.ceil(VB_H / dy) + 2;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'hexfield'); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  let d = '';
  for (let j = -1; j < rows; j++) for (let i = -1; i < cols; i++) {
    const cx = i * dx + ((j & 1) ? w : 0), cy = j * dy;
    d += `M${cx},${cy - R}L${cx + w},${cy - R / 2}L${cx + w},${cy + R / 2}L${cx},${cy + R}L${cx - w},${cy + R / 2}L${cx - w},${cy - R / 2}Z`;
  }
  const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'hex-grid-path'); p.setAttribute('d', d); svg.appendChild(p);
  const bg = document.querySelector('.bg'); if (bg) bg.appendChild(svg);
})();

$('s-close').addEventListener('click', () => window.api.sideClose());
$('s-min').addEventListener('click', () => window.api.sideMinimize());

let _account = null, _myName = '', _isHost = false, _session = null, _curCat = 'today';

// ── 👤 입장 = 롤에 로그인된 라이엇 계정(자동) ─────────────────────────────────
function showWaiting() {
  $('s-login').style.display = 'flex'; $('s-app').style.display = 'none';
  $('s-me').style.display = 'none'; $('s-hostbtn').style.display = 'none';
}
function showLogged() {
  $('s-login').style.display = 'none'; $('s-app').style.display = 'flex';
  const me = $('s-me'); me.style.display = '';
  me.innerHTML = escH(_account.gameName) + (_account.tagLine ? `<small>#${escH(_account.tagLine)}</small>` : '');
  renderHostBtn();
  $('s-rail-team').style.display = _isHost ? '' : 'none';
  if (!_isHost && _curCat === 'team') switchCat('today');
}
function applyAccount(acc, isHost) {
  const changed = (_account && _account.puuid) !== (acc && acc.puuid);
  _account = acc || null; _myName = acc ? acc.gameName : '';
  if (isHost !== undefined) _isHost = !!isHost;
  if (!_account) { _isHost = false; showWaiting(); return; }
  showLogged();
  if (changed) switchCat(_isHost ? 'team' : 'today');
}
window.api.onAccount(d => applyAccount(d && d.account, d && d.isHost));
// ── 👑 방장 = 한 명 · 넘겨주기 · 응답 없으면 이어받기 ────────────────────────
let _hostInfo = { host: null, isHost: false };
function toast(msg) {
  const t = $('sp-toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3200);
}
function renderHostBtn() {
  const hb = $('s-hostbtn'), h = _hostInfo.host;
  hb.style.display = _account ? '' : 'none';
  hb.classList.toggle('on', _isHost);
  hb.classList.toggle('busy', !_isHost && !!(h && h.alive && !h.mine));
  if (_isHost) { hb.textContent = '👑 방장 ▾'; hb.title = '방장 넘겨주기 · 그만하기'; }
  else if (h && h.alive && !h.mine) { hb.textContent = `👑 ${h.name}`; hb.title = `${h.name}님이 방장이에요 — 방장이 넘겨주거나, 1분 넘게 응답이 없으면 이어받을 수 있어요`; }
  else if (h && !h.alive && !h.mine) { hb.textContent = '👑 방장 이어받기'; hb.title = `${h.name}님(방장)이 응답이 없어요 — 이어받으면 진행 중인 판 그대로 이어서 해요`; }
  else { hb.textContent = '👑 방장 하기'; hb.title = '방장 = 팀짜기·경기 기록·투표 마감 담당(한 명만)'; }
}
function applyHost(d) {
  if (!d) return;
  _hostInfo = d;
  const was = _isHost;
  _isHost = !!d.isHost;
  if (d.note) toast('👑 ' + d.note);
  if (!_isHost) closeHostMenu();
  if (_account) { showLogged(); if (was !== _isHost) switchCat(_isHost ? 'team' : 'today'); }
}
window.api.onHost(applyHost);
function closeHostMenu() { $('s-hostmenu').style.display = 'none'; }
async function openHostMenu() {
  const m = $('s-hostmenu');
  m.innerHTML = '<div class="thm-hd">불러오는 중…</div>'; m.style.display = '';
  const r = await window.api.getRoster().catch(() => null);
  const others = ((r && r.online) || []).filter(o => !_account || o.puuid !== _account.puuid);
  m.innerHTML = '<div class="thm-hd">방장 넘겨주기</div>'
    + (others.length ? others.map(o => `<button class="thm-item" data-p="${escH(o.puuid)}">${escH(o.name)}<small>${o.tag ? '#' + escH(o.tag) : ''}</small></button>`).join('')
                     : '<div class="thm-empty">앱을 켜고 롤에 로그인한 사람이 없어요</div>')
    + '<button class="thm-item thm-stop" id="thm-stop">방장 그만하기</button>';
  m.querySelectorAll('.thm-item[data-p]').forEach(b => b.onclick = async () => {
    const name = b.firstChild.textContent;
    if (!confirm(`${name}님에게 방장을 넘길까요?
진행 중인 판은 그대로 이어져요.`)) return;
    closeHostMenu();
    const res = await window.api.handHost(b.dataset.p).catch(() => null);
    if (!res || !res.ok) toast((res && res.err) || '넘겨주지 못했어요');
  });
  $('thm-stop').onclick = async () => { closeHostMenu(); await window.api.setHost(false); };
}
$('s-hostbtn').addEventListener('click', async () => {
  if (_isHost) { $('s-hostmenu').style.display === 'none' ? openHostMenu() : closeHostMenu(); return; }
  const h = _hostInfo.host;
  if (h && h.alive && !h.mine) { toast(`👑 ${h.name}님이 방장이에요`); return; }
  if (h && !h.alive && !h.mine && !confirm(`${h.name}님(방장)이 1분 넘게 응답이 없어요.
방장을 이어받을까요?`)) return;
  const res = await window.api.setHost(true).catch(() => null);
  if (!res || !res.ok) toast((res && res.err) || '방장을 맡지 못했어요');
});
document.addEventListener('mousedown', e => { if (!e.target.closest('#s-hostmenu, #s-hostbtn')) closeHostMenu(); });

// ── 레일 ────────────────────────────────────────────────────────────────
function switchCat(cat) {
  _curCat = cat;
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
  document.querySelectorAll('.cat-view').forEach(v => { v.style.display = (v.id === 'cat-' + cat) ? 'flex' : 'none'; });
  if (cat === 'team') renderLive();
  else if (cat === 'profile') renderProfile();
  else renderToday();
}
document.querySelectorAll('.rail-btn').forEach(b => b.addEventListener('click', () => switchCat(b.dataset.cat)));

// ── ⚔️ 진행(방장) ─────────────────────────────────────────────────────────
// 참가자·방식(랜덤/드래프트)·팀장·시작은 모두 왼쪽 🚪 대기실에서(모두가 같은 화면을 봄). 여기는 진행 중인 판 조작만.
let _standing = {};   // 이름 → 오늘 전적
function showErr(msg) { const e = $('tb-err'); if (!msg) { e.style.display = 'none'; return; } e.textContent = '⚠️ ' + msg; e.style.display = ''; }
$('tb-open-lobby').onclick = () => window.api.showOverlay();
window.api.onTeamBuild(d => { if (d && d.state === 'error') showErr(d.err); else if (d && d.state === 'done') renderLive(); });

// 진행 중인 판 — 방장 조작(승리팀 기록·투표 마감·한 판 더)
let _liveBusy = false;
function renderLive() {
  const s = _session, box = $('tb-live');
  const active = s && s.teamA && s.teamB && ['draft', 'teams', 'vote', 'result'].includes(s.phase);
  $('tb-idle').style.display = active ? 'none' : '';
  if (!active) { box.style.display = 'none'; return; }
  box.style.display = '';
  const row = (label, arr, cls) => `<div class="tbr ${cls}"><b>${label}</b><span>${(arr || []).map(escH).join(' · ')}</span></div>`;
  let st = '', acts = '';
  if (s.phase === 'draft') {
    const team = (s.order || [])[s.pickIdx || 0], caps = s.captains || {};
    st = `<div class="td-state">드래프트 진행 중 · ${(s.pickIdx || 0)}/${(s.order || []).length} 뽑음 · 지금 <b>${team === 'teamA' ? '1팀' : '2팀'} 팀장 ${escH(caps[team] || '')}</b> 차례</div>`;
    acts = `<div class="foot-hint">팀장이 왼쪽 창에서 뽑아요 · 팀장이 앱이 없으면 방장이 왼쪽 창에서 대신 뽑을 수 있어요 · 30초 지나면 무작위</div>`;
  } else if (s.phase === 'teams') {
    if (s.pendingEog) {
      st = `<div class="td-alert">경기가 끝났는데 인게임 이름과 등록 이름이 달라 자동 판정을 못 했어요.<br>이긴 팀을 골라주세요${s.pendingEog.winSide ? ` (게임상 승리 진영: ${s.pendingEog.winSide === 'blue' ? '블루' : '레드'})` : ''}</div>`;
    } else st = `<div class="td-state">게임 중이거나 시작 전이에요 · 끝나면 자동으로 기록돼요</div>`;
    acts = `<div class="td-acts"><button class="btn-ghost td-win" data-w="teamA">1팀 승리 기록</button><button class="btn-ghost td-win" data-w="teamB">2팀 승리 기록</button></div>`
      + `<div class="foot-hint">자동 기록이 안 될 때만 눌러요(롤 클라 연결 없음 등)</div>`;
  } else if (s.phase === 'vote') {
    const voters = [...s.teamA, ...s.teamB], votes = s.votes || {};
    const done = voters.filter(n => votes[nn(n).replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_')]).length;
    st = `<div class="td-state"><b>${s.game && s.game.winner === 'teamA' ? '1팀' : '2팀'} 승리</b> 기록됨 · 투표 ${done}/${voters.length}</div>`;
    acts = `<div class="td-acts"><button class="btn-ghost" id="td-close">투표 마감</button></div>`;
  } else {
    const r = s.result || {};
    st = `<div class="td-state"><b>${s.game && s.game.winner === 'teamA' ? '1팀' : '2팀'} 승리</b>${r.mvp ? ` · 🏆 ${escH(r.mvp)}` : ''}${r.svp ? ` · ⭐ ${escH(r.svp)}` : ''}${r.manner ? ` · 💎 ${escH(r.manner)}` : ''}</div>`;
    acts = `<div class="td-acts"><button class="btn-gold" id="td-again">같은 팀으로 한 판 더</button></div>`;
  }
  box.innerHTML = `<div class="tb-result">${row('1팀', s.teamA, 'a')}${row('2팀', s.teamB, 'b')}${s.spectators && s.spectators.length ? row('관전', s.spectators, 's') : ''}</div>`
    + st + acts
    + `<button class="btn-ghost td-new" id="td-new">대기실로 돌아가기</button><div class="foot-hint">지금 판을 접고 모두 대기실로 · 참가자·방식을 다시 정해요</div>`;
  box.querySelectorAll('.td-win').forEach(b => b.onclick = () => liveAct(() => window.api.hostResult(b.dataset.w)));
  const c = $('td-close'); if (c) c.onclick = () => liveAct(() => window.api.voteClose());
  const a = $('td-again'); if (a) a.onclick = () => liveAct(() => window.api.tbAgain());
  $('td-new').onclick = () => liveAct(() => window.api.lobbyReopen());
}
async function liveAct(fn) {
  if (_liveBusy) return;
  _liveBusy = true; showErr(null);
  $('tb-live').querySelectorAll('button').forEach(b => { b.disabled = true; });
  const r = await fn().catch(e => ({ ok: false, err: String(e) }));
  _liveBusy = false;
  if (!r || !r.ok) showErr((r && r.err) || '실패');
  renderLive();
}

// ── 📅 오늘 기록 ────────────────────────────────────────────────────────
let _day = null, _todayKey = null, _todayData = null;
function shiftDay(key, n) { const [y, m, d] = key.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
$('td-prev').onclick = () => { if (_day) { _day = shiftDay(_day, -1); renderToday(); } };
$('td-next').onclick = () => { if (_day && _day < _todayKey) { _day = shiftDay(_day, 1); renderToday(); } };
async function renderToday() {
  const body = $('td-body');
  if (!_todayData) body.innerHTML = '<div class="td-empty">불러오는 중…</div>';
  const t = await window.api.getToday(_day).catch(() => null);
  if (!t || !t.ok) { body.innerHTML = '<div class="td-empty">기록을 불러오지 못했어요</div>'; return; }
  _todayKey = t.today; _day = t.day;
  if (t.day === t.today) { _todayData = t; _standing = {}; t.standings.forEach(p => { _standing[nn(p.name)] = p; }); }
  const [, mm, dd] = t.day.split('-');
  $('td-day').textContent = (t.day === t.today ? '오늘 · ' : '') + `${Number(mm)}월 ${Number(dd)}일`;
  $('td-next').disabled = t.day >= t.today;
  if (!t.matches.length) { body.innerHTML = `<div class="td-empty">${t.day === t.today ? '오늘은 아직 경기가 없어요<br><small>방장이 팀을 짜고 게임이 끝나면 자동으로 쌓여요</small>' : '이 날은 경기가 없어요'}</div>`; return; }
  const rows = t.standings.map(p => {
    const kda = p.d || p.k || p.a ? ((p.k + p.a) / Math.max(1, p.d)).toFixed(1) : '-';
    return `<tr class="${nn(p.name) === nn(_myName) ? 'me' : ''}"><td class="r">${p.rank}</td><td class="n"><a class="pf-link" data-name="${escH(p.name)}">${escH(p.name)}</a></td><td>${p.wins}-${p.losses}</td><td>${Math.round(p.wins / p.games * 100)}%</td><td>${p.mvp || ''}</td><td>${p.manner || ''}</td><td>${kda}</td></tr>`;
  }).join('');
  const fmt = ts => { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const games = t.matches.map((m, i) => {
    const winA = m.winner === 'teamA';
    const tm = (arr, win) => `<span class="${win ? 'w' : 'l'}">${(arr || []).map(escH).join(', ')}</span>`;
    const aw = [m.mvp ? `🏆 ${escH(m.mvp)}` : '', m.svp ? `⭐ ${escH(m.svp)}` : '', m.manner ? `💎 ${escH(m.manner)}` : ''].filter(Boolean).join(' · ');
    return `<div class="td-game"><div class="td-gh"><b>${t.matches.length - i}판</b><span>${fmt(m.ts)}</span>${m.source === 'manual' ? '<span class="td-tag">수동</span>' : ''}</div>`
      + `<div class="td-gt">${tm(m.teamA, winA)}<i>vs</i>${tm(m.teamB, !winA)}</div>${aw ? `<div class="td-ga">${aw}</div>` : ''}</div>`;
  }).join('');
  body.innerHTML = `<div class="td-sec">순위 · ${t.matches.length}판</div>`
    + `<table class="td-table"><thead><tr><th>#</th><th class="n">이름</th><th>전적</th><th>승률</th><th>🏆</th><th>💎</th><th>KDA</th></tr></thead><tbody>${rows}</tbody></table>`
    + `<div class="td-sec">경기</div>${games}`;
  body.querySelectorAll('.pf-link').forEach(a => a.onclick = () => openProfile({ name: a.textContent }));
}

// ── 👤 개인 내전 프로필 ─────────────────────────────────────────────────────
// 지금까지 모든 날의 기록을 사람별로 모음: 전적·연승·수상·KDA·챔피언·최고 기록·찰떡 팀원·천적·최근 10판
let _pfArg = { me: true };
function openProfile(arg) { _pfArg = arg || { me: true }; switchCat('profile'); }
window.api.onOpenProfile(arg => openProfile(arg));
$('pf-back').onclick = () => openProfile({ me: true });
const champIcon = id => id ? `<img class="pf-ci" src="https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png" onerror="this.style.visibility='hidden'" alt="">` : '<span class="pf-ci"></span>';
const md = day => { if (!day) return ''; const [, m, d] = day.split('-'); return `${Number(m)}/${Number(d)}`; };
const pct = (w, g) => g ? Math.round(w / g * 100) : 0;
const kdaOf = (k, d, a) => ((k + a) / Math.max(1, d)).toFixed(2);
let _augMapP = null;
const augMapP = async () => _augMapP || (_augMapP = await window.api.getAugments().catch(() => ({})) || {});
async function renderProfile() {
  const body = $('pf-body'), arg = _pfArg;
  body.innerHTML = '<div class="td-empty">불러오는 중…</div>';
  const [P, AUG] = await Promise.all([window.api.getProfile(arg).catch(() => null), augMapP()]);
  if (arg !== _pfArg) return;   // 그사이 다른 사람을 눌렀으면 버림
  $('pf-back').style.display = arg.me ? 'none' : '';
  $('pf-title').textContent = arg.me ? '내 프로필' : '프로필';
  if (!P || !P.ok) { body.innerHTML = `<div class="td-empty">${escH((P && P.err) || '프로필을 불러오지 못했어요')}</div>`; return; }
  const head = `<div class="pf-head"><div class="pf-nm">${escH(P.name)}${P.tag ? `<small>#${escH(P.tag)}</small>` : ''}${P.me ? '<span class="pf-me">나</span>' : ''}</div>`
    + `<div class="pf-sub">${P.games ? `첫 내전 ${md(P.first)} · 내전 ${P.days}일 · 마지막 ${md(P.last)}` : '아직 내전 기록이 없어요'}</div></div>`;
  if (!P.games) { body.innerHTML = head + '<div class="td-empty">내전을 한 판 하면 여기에 기록이 쌓여요</div>'; return; }
  const streak = P.streak > 0 ? `<b class="w">${P.streak}연승</b>` : `<b class="l">${-P.streak}연패</b>`;
  const big = `<div class="pf-big">`
    + `<div><span>전적</span><b>${P.wins}승 ${P.losses}패</b><em>승률 ${pct(P.wins, P.games)}%</em></div>`
    + `<div><span>지금</span>${streak}<em>최고 ${P.bestStreak}연승</em></div>`
    + `<div><span>수상</span><b class="aw">🏆${P.mvp} ⭐${P.svp} 💎${P.manner}</b><em>MVP · SVP · 매너</em></div></div>`;
  let play = '';
  if (P.statGames) {
    const n = P.statGames, min = P.time / 60;
    const multi = [P.penta ? `펜타 ${P.penta}` : '', P.quadra ? `쿼드라 ${P.quadra}` : '', P.triple ? `트리플 ${P.triple}` : '', P.double ? `더블 ${P.double}` : ''].filter(Boolean).join(' · ') || '없음';
    play = `<div class="td-sec">플레이 · 기록 있는 ${n}판 평균</div><div class="pf-grid">`
      + `<div><span>KDA</span><b>${(P.k / n).toFixed(1)} / ${(P.d / n).toFixed(1)} / ${(P.a / n).toFixed(1)}</b><em>${kdaOf(P.k, P.d, P.a)}</em></div>`
      + `<div><span>피해량</span><b>${Math.round(P.damage / n).toLocaleString()}</b><em>${min ? `분당 ${Math.round(P.damage / min).toLocaleString()}` : ''}</em></div>`
      + `<div><span>골드</span><b>${Math.round(P.gold / n).toLocaleString()}</b><em>CS ${Math.round(P.cs / n)}</em></div>`
      + `<div><span>멀티킬</span><b class="sm">${multi}</b><em>퍼블 ${P.firstBlood}번</em></div></div>`;
  }
  const champs = P.champs.length ? `<div class="td-sec">많이 한 챔피언</div>` + P.champs.map(c =>
    `<div class="pf-row">${champIcon(c.id)}<span class="pf-rn">${escH(c.name || '?')}</span><span class="pf-rv">${c.games}판 ${pct(c.wins, c.games)}%</span><span class="pf-rk">${kdaOf(c.k, c.d, c.a)}</span></div>`).join('') : '';
  const augs = (P.augs || []).length ? `<div class="td-sec">많이 고른 증강</div>` + P.augs.map(x => { const a = AUG[x.id] || {};
    return `<div class="pf-row"><i class="pf-aug ${a.rarity || ''}">${a.icon ? `<img src="${a.icon}" alt="" onerror="this.remove()">` : ''}<b>?</b></i><span class="pf-rn">${escH(a.name || '증강 #' + x.id)}</span><span class="pf-rv">${x.games}번 ${pct(x.wins, x.games)}%</span></div>`; }).join('') : '';
  const B = P.best, bestRow = (label, b, fmt) => b ? `<div class="pf-row">${champIcon(b.champId)}<span class="pf-rn">${label}</span><span class="pf-rv">${fmt(b.v)}</span><span class="pf-rk">${escH(b.champ || '')} · ${md(b.day)}</span></div>` : '';
  const best = (B.kills || B.damage || B.kda) ? `<div class="td-sec">최고 기록</div>` + bestRow('최다 킬', B.kills, v => v + '킬') + bestRow('최고 피해량', B.damage, v => v.toLocaleString()) + bestRow('최고 KDA', B.kda, v => v) + bestRow('최다 어시', B.assists, v => v + '어시') : '';
  const pals = (label, list, hint) => list.length ? `<div class="td-sec">${label} <small>${hint}</small></div>` + list.map(x =>
    `<div class="pf-row"><a class="pf-rn pf-link">${escH(x.name)}</a><span class="pf-rv">${x.games}판 ${x.wins}승</span><span class="pf-rk">${pct(x.wins, x.games)}%</span></div>`).join('') : '';
  const recent = `<div class="td-sec">최근 ${P.recent.length}판</div>` + P.recent.map(g =>
    `<div class="pf-row pf-g ${g.win ? 'w' : 'l'}"><span class="pf-wl">${g.win ? '승' : '패'}</span>${champIcon(g.champId)}<span class="pf-rn">${escH(g.champ || '결과만 기록')}</span>`
    + `<span class="pf-rv">${g.k != null ? `${g.k}/${g.d}/${g.a}` : ''}</span><span class="pf-rk">${g.aw.map(a => ({ mvp: '🏆', svp: '⭐', manner: '💎' })[a]).join('')} ${md(g.day)}</span></div>`).join('');
  body.innerHTML = head + big + play + champs + augs + best
    + pals('찰떡 팀원', P.mates, '같은 팀일 때 승률 · 2판 이상') + pals('천적', P.rivals, '상대로 만났을 때 승률 · 2판 이상') + recent;
  body.querySelectorAll('.pf-link').forEach(a => a.onclick = () => openProfile({ name: a.textContent }));
}

// ── 세션 실시간 ─────────────────────────────────────────────────────────
let _lastPhaseSig = '';
window.api.onSession(({ session }) => {
  _session = session || null;
  if (_curCat === 'team') renderLive();
  const sig = session ? `${session.phase}:${session.lastGameId || ''}:${session.result ? 1 : 0}` : '';
  if (sig !== _lastPhaseSig) { _lastPhaseSig = sig; if (_curCat === 'today' && _day === _todayKey) renderToday(); else _todayData = null; }
});

// ── 시작 ────────────────────────────────────────────────────────────────
(async () => {
  showWaiting();
  const d = await window.api.getPlayers().catch(() => null);
  if (!d) return;
  _session = d.session || null;
  $('s-ver').textContent = d.appVer ? '투데이 내전 v' + d.appVer : '';
  if (d.account) applyAccount(d.account, d.isHost);
  applyHost(await window.api.getHost().catch(() => null));
})();
