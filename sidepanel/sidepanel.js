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
  $('thm-stop').onclick = async () => { closeHostMenu(); window.api.lobbyClear(); await window.api.setHost(false); };
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
  if (_curCat === 'team' && cat !== 'team') window.api.lobbyClear();   // 팀짜기 탭 벗어남 → 준비 중 배너 제거
  _curCat = cat;
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
  document.querySelectorAll('.cat-view').forEach(v => { v.style.display = (v.id === 'cat-' + cat) ? 'flex' : 'none'; });
  if (cat === 'team') { tbRenderList(); renderLive(); loadRoster(); }
  else renderToday();
}
document.querySelectorAll('.rail-btn').forEach(b => b.addEventListener('click', () => switchCat(b.dataset.cat)));

// ── ⚔️ 팀짜기(방장) ─────────────────────────────────────────────────────
const _tbChecked = new Set((() => { try { return JSON.parse(localStorage.getItem('tbChecked') || '[]'); } catch (_) { return []; } })());
let _standing = {};   // 이름 → 오늘 전적(칩 표시용)
// 👥 참가자 후보 = 지금 접속 중(초록 점) + 오늘 뛴 사람 + 직접 추가(앱 없는 사람)
let _roster = { online: [], recent: [] };
const _manual = new Set((() => { try { return JSON.parse(localStorage.getItem('tbManual') || '[]'); } catch (_) { return []; } })());
const saveManual = () => localStorage.setItem('tbManual', JSON.stringify([..._manual]));
async function loadRoster() {
  const r = await window.api.getRoster().catch(() => null);
  if (r && r.ok) { _roster = r; if (_curCat === 'team') tbRenderList(); }
}
setInterval(() => { if (_curCat === 'team' && _isHost) loadRoster(); }, 10000);
function tbRenderList() {
  const onSet = new Set(_roster.online.map(o => nn(o.name)));
  const names = [..._roster.online.map(o => nn(o.name))];
  for (const n of [..._roster.recent, ..._manual]) if (!names.some(x => x === nn(n))) names.push(nn(n));
  for (const n of _tbChecked) if (!names.includes(n)) names.push(n);   // 체크했던 사람은 접속이 끊겨도 목록에 유지
  const sorted = names.sort((a, b) => (onSet.has(b) - onSet.has(a)) || a.localeCompare(b, 'ko'));
  $('tb-list').innerHTML = sorted.length ? sorted.map(n => {
    const st = _standing[n];
    const badge = st ? `<span class="tb-badge">${st.wins}승 ${st.losses}패</span>` : '';
    const rm = !onSet.has(n) && _manual.has(n) ? `<button class="tn-rm" data-rm="${escH(n)}" title="목록에서 빼기">✕</button>` : '';
    return `<div class="tb-item${_tbChecked.has(n) ? ' on' : ''}" data-name="${escH(n)}" title="${escH(n)}"><div class="tb-check"></div><span class="tb-nm">${escH(n)}</span>${badge}${rm}<i class="tn-dot${onSet.has(n) ? ' on' : ''}"></i></div>`;
  }).join('') : '<div class="td-empty">아직 접속한 사람이 없어요<br><small>팀원이 앱을 켜고 롤에 로그인하면 여기에 떠요</small></div>';
  $('tb-list').querySelectorAll('.tn-rm').forEach(b => b.onmousedown = e => {
    e.stopPropagation(); e.preventDefault();
    const n = b.closest('.tb-item').title; _manual.delete(n); _tbChecked.delete(n); saveManual();
    localStorage.setItem('tbChecked', JSON.stringify([..._tbChecked])); tbRenderList();
  });
  tbSync();
}
function addManual() {
  const n = nn($('tb-add-name').value);
  if (!n) return;
  _manual.add(n); _tbChecked.add(n); saveManual();
  localStorage.setItem('tbChecked', JSON.stringify([..._tbChecked]));
  $('tb-add-name').value = ''; tbRenderList();
}
$('tb-add-go').onclick = addManual;
$('tb-add-name').addEventListener('keydown', e => { if (e.key === 'Enter') addManual(); });
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
  const draft = tbMode() === 'draft';
  $('tb-go').textContent = n < 4 ? `${draft ? '드래프트' : '팀 구성'} (최소 4명 · 현재 ${n}명)` : draft ? `팀장 고르기 — ${n}명` : `팀 구성 — ${n}명`;
  clearTimeout(_lobbyT);   // 고르는 중 → 팀원에게 "준비 중" 안내(디바운스)
  _lobbyT = setTimeout(() => { if (_curCat === 'team' && $('tb-pick').style.display !== 'none') window.api.lobbyPrep([..._tbChecked]); }, 300);
}
const tbMode = () => document.querySelector('input[name=tb-mode]:checked')?.value || 'random';   // 밸런스는 새 로직 준비 중
document.querySelectorAll('input[name=tb-mode]').forEach(r => r.addEventListener('change', tbSync));
// 🎯 드래프트 팀장 고르기(선택한 참가자 중 2명)
let _caps = [];
function capRender() {
  const list = [..._tbChecked].sort((a, b) => a.localeCompare(b, 'ko'));
  _caps = _caps.filter(n => _tbChecked.has(n));
  $('tb-cap-list').innerHTML = list.map(n => `<div class="tb-item${_caps.includes(n) ? ' on' : ''}" data-name="${escH(n)}" title="${escH(n)}"><div class="tb-check"></div><span class="tb-nm">${escH(n)}</span>${_caps.includes(n) ? `<span class="tb-badge">${_caps.indexOf(n) === 0 ? '1팀 팀장' : '2팀 팀장'}</span>` : ''}</div>`).join('');
  $('tb-cap-list').querySelectorAll('.tb-item').forEach(c => c.onclick = () => {
    const n = list.find(x => escH(x) === c.dataset.name) || c.title;
    if (_caps.includes(n)) _caps = _caps.filter(x => x !== n);
    else { if (_caps.length >= 2) _caps.shift(); _caps.push(n); }
    capRender();
  });
  $('tb-cap-go').disabled = _caps.length !== 2;
}
function showCapStep(on) { $('tb-cap').style.display = on ? '' : 'none'; $('tb-pick').style.display = on ? 'none' : ''; if (on) capRender(); }
$('tb-cap-back').onclick = () => showCapStep(false);
$('tb-cap-rand').onclick = () => { _caps = [..._tbChecked].sort(() => Math.random() - 0.5).slice(0, 2); capRender(); };
$('tb-cap-go').onclick = async () => {
  $('tb-cap-go').disabled = true; showErr(null);
  const r = await window.api.draftStart([..._tbChecked], _caps);
  if (!r || !r.ok) { showErr((r && r.err) || '드래프트 시작 실패'); $('tb-cap-go').disabled = false; return; }
  _pickOpen = false; showCapStep(false); renderLive();
};
function showErr(msg) { const e = $('tb-err'); if (!msg) { e.style.display = 'none'; return; } e.textContent = '⚠️ ' + msg; e.style.display = ''; }
$('tb-go').addEventListener('click', async () => {
  $('tb-go').disabled = true; showErr(null);
  const mode = tbMode();
  if (mode === 'draft') { tbSync(); showCapStep(true); return; }   // 🎯 드래프트 = 팀장 고르기 단계로
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
  const active = s && s.teamA && s.teamB && ['draft', 'teams', 'vote', 'result'].includes(s.phase);
  const showPick = !active || _pickOpen;
  if ($('tb-cap').style.display === 'none') $('tb-pick').style.display = showPick ? '' : 'none';
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
  showWaiting();
  const d = await window.api.getPlayers().catch(() => null);
  if (!d) return;
  _session = d.session || null;
  $('s-ver').textContent = d.appVer ? '투데이 내전 v' + d.appVer : '';
  if (d.account) applyAccount(d.account, d.isHost);
  applyHost(await window.api.getHost().catch(() => null));
})();
