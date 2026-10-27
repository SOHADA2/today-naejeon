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

let _names = [], _myName = '', _isHost = false, _session = null, _curCat = 'today';

// ── 입장 ────────────────────────────────────────────────────────────────
function showLogin() {
  $('s-login').style.display = 'flex'; $('s-app').style.display = 'none'; $('s-me').style.display = 'none';
  $('s-host').checked = _isHost;
}
function showLogged() {
  $('s-login').style.display = 'none'; $('s-app').style.display = 'flex';
  const me = $('s-me'); me.style.display = ''; me.textContent = _myName + (_isHost ? ' · 방장' : '');
  $('s-rail-team').style.display = _isHost ? '' : 'none';
  switchCat(_isHost ? 'team' : 'today');
}
const esel = $('s-entry-name');
esel.addEventListener('change', () => { $('s-entry-go').disabled = !esel.value; });
$('s-entry-go').addEventListener('click', () => {
  if (!esel.value) return;
  _myName = esel.value; _isHost = $('s-host').checked;
  window.api.setMyName(_myName);
  window.api.setHost(_isHost);
  showLogged();
});
$('s-change').addEventListener('click', () => { if (_isHost) window.api.lobbyClear(); showLogin(); });

// ── 레일 ────────────────────────────────────────────────────────────────
function switchCat(cat) {
  if (_curCat === 'team' && cat !== 'team') window.api.lobbyClear();   // 팀짜기 탭 벗어남 → 준비 중 배너 제거
  _curCat = cat;
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
  document.querySelectorAll('.cat-view').forEach(v => { v.style.display = (v.id === 'cat-' + cat) ? 'flex' : 'none'; });
  if (cat === 'team') { tbRenderList(); renderLive(); }
  else renderToday();
}
document.querySelectorAll('.rail-btn').forEach(b => b.addEventListener('click', () => switchCat(b.dataset.cat)));

// ── ⚔️ 팀짜기(방장) ─────────────────────────────────────────────────────
const _tbChecked = new Set((() => { try { return JSON.parse(localStorage.getItem('tbChecked') || '[]'); } catch (_) { return []; } })());
let _standing = {};   // 이름 → 오늘 전적(칩 정렬·표시용)
function tbRenderList() {
  const sorted = [..._names].sort((a, b) => ((_standing[nn(b)] || {}).games || 0) - ((_standing[nn(a)] || {}).games || 0) || a.localeCompare(b, 'ko'));   // 오늘 뛴 사람 먼저
  $('tb-list').innerHTML = sorted.map(n => {
    const st = _standing[nn(n)];
    const badge = st ? `<span class="tb-badge">${st.wins}승 ${st.losses}패</span>` : '';
    return `<div class="tb-item${_tbChecked.has(n) ? ' on' : ''}" data-name="${escH(n)}" title="${escH(n)}"><div class="tb-check"></div><span class="tb-nm">${escH(n)}</span>${badge}</div>`;
  }).join('');
  tbSync();
}
$('tb-clear').onclick = () => { _tbChecked.clear(); localStorage.setItem('tbChecked', '[]'); tbRenderList(); };
(function tbDragSelect() {   // 드래그로 여러 명 선택(누른 칩의 반대 상태를 지나는 칩 전부에)
  const list = $('tb-list');
  let drag = null;
  const decode = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const apply = chip => {
    if (!chip || !drag || drag.done.has(chip)) return;
    drag.done.add(chip);
    const name = chip.dataset.name && decode(chip.dataset.name);
    if (!name) return;
    if (drag.target) _tbChecked.add(name); else _tbChecked.delete(name);
    chip.classList.toggle('on', drag.target);
  };
  list.addEventListener('mousedown', e => {
    const chip = e.target.closest('.tb-item'); if (!chip) return;
    e.preventDefault();
    drag = { target: !chip.classList.contains('on'), done: new Set() };
    apply(chip);
  });
  document.addEventListener('mousemove', e => { if (drag) apply(document.elementFromPoint(e.clientX, e.clientY)?.closest('.tb-item')); });
  document.addEventListener('mouseup', () => {
    if (!drag) return;
    drag = null;
    localStorage.setItem('tbChecked', JSON.stringify([..._tbChecked]));
    tbSync();
  });
})();
let _lobbyT = null;
function tbSync() {
  const n = _tbChecked.size;
  $('tb-num').textContent = n;
  $('tb-go').disabled = n < 4;
  $('tb-go').textContent = n < 4 ? `팀 구성 (최소 4명 · 현재 ${n}명)` : `팀 구성 — ${n}명`;
  clearTimeout(_lobbyT);   // 고르는 중 → 팀원에게 "준비 중" 안내(디바운스)
  _lobbyT = setTimeout(() => { if (_curCat === 'team' && $('tb-pick').style.display !== 'none') window.api.lobbyPrep([..._tbChecked]); }, 300);
}
function showErr(msg) { const e = $('tb-err'); if (!msg) { e.style.display = 'none'; return; } e.textContent = '⚠️ ' + msg; e.style.display = ''; }
$('tb-go').addEventListener('click', async () => {
  $('tb-go').disabled = true; showErr(null);
  const mode = document.querySelector('input[name=tb-mode]:checked')?.value || 'balance';
  const r = await window.api.tbStart([..._tbChecked], mode);
  if (!r || !r.ok) { showErr((r && r.err) || '팀 구성 실패'); tbSync(); }
});
window.api.onTeamBuild(d => {
  if (!d) return;
  if (d.state === 'building') { $('tb-go').disabled = true; $('tb-go').textContent = '팀 계산 중…'; }
  else if (d.state === 'error') { showErr(d.err); tbSync(); }
  else if (d.state === 'done') { _pickOpen = false; renderLive(); }
});

// 진행 중인 판 — 방장 조작(승리팀 기록·투표 마감·한 판 더)
let _pickOpen = false, _liveBusy = false;
function renderLive() {
  const s = _session, box = $('tb-live');
  const active = s && s.teamA && s.teamB && ['teams', 'vote', 'result'].includes(s.phase);
  const showPick = !active || _pickOpen;
  $('tb-pick').style.display = showPick ? '' : 'none';
  if (!active) { box.style.display = 'none'; return; }
  box.style.display = '';
  const row = (label, arr, cls) => `<div class="tbr ${cls}"><b>${label}</b><span>${(arr || []).map(escH).join(' · ')}</span></div>`;
  let st = '', acts = '';
  if (s.phase === 'teams') {
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
    + `<button class="btn-ghost td-new" id="td-new">${_pickOpen ? '참가자 선택 닫기' : '새로 팀 짜기'}</button>`;
  box.querySelectorAll('.td-win').forEach(b => b.onclick = () => liveAct(() => window.api.hostResult(b.dataset.w)));
  const c = $('td-close'); if (c) c.onclick = () => liveAct(() => window.api.voteClose());
  const a = $('td-again'); if (a) a.onclick = () => liveAct(() => window.api.tbAgain());
  $('td-new').onclick = () => { _pickOpen = !_pickOpen; renderLive(); if (_pickOpen) tbRenderList(); };
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
    return `<tr class="${nn(p.name) === nn(_myName) ? 'me' : ''}"><td class="r">${p.rank}</td><td class="n">${escH(p.name)}</td><td>${p.wins}-${p.losses}</td><td>${Math.round(p.wins / p.games * 100)}%</td><td>${p.mvp || ''}</td><td>${p.manner || ''}</td><td>${kda}</td></tr>`;
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
  if (_curCat === 'team') tbRenderList();
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
  const d = await window.api.getPlayers().catch(() => null);
  if (d) {
    _names = d.names || []; _myName = d.myName || ''; _session = d.session || null;
    esel.innerHTML = '<option value="">— 아이디 선택 —</option>' + _names.map(n => `<option value="${escH(n)}"${n === _myName ? ' selected' : ''}>${escH(n)}</option>`).join('');
    $('s-entry-go').disabled = !esel.value;
    $('s-ver').textContent = d.appVer ? '투데이 내전 v' + d.appVer : '';
  }
  showLogin();   // 매번 입장 화면(지난 아이디는 미리 선택)
})();
