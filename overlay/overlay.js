// ── 투데이 내전 · 왼쪽 오버레이 ───────────────────────────────────────────
// 뷰: 🚪 대기실(모두 같이 봄) · 드래프트 · 팀 배정(phase teams) · 투표(phase vote) · 결과(phase result) · 게임 중 명단
// 데이터 = 메인이 IPC로: session(today/session) · lobby(대기실 {members, mode, captains, hostName, isHost}) · players(인게임 명단) · state(게임 여부)
const nn = s => String(s || '').trim().replace(/\s+/g, ' ');           // normName(공백 1칸)
const fbKeyOf = name => nn(name).replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_');
const el = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let sessionData = null, myName = '', roster = [], inGame = false, myIsHost = false, lobbyData = null;
let _gamePlayed = false, _lastFormedSeen = 0;   // 이번 팀 결성으로 게임을 이미 했는지(게임 후엔 '팀 배정' 대신 '결과 대기')

el('close').addEventListener('click', () => window.api.hideOverlay());
el('ov-min').addEventListener('click', () => window.api.overlayMinimize());

window.api.onState(({ inGame: ig }) => { const was = inGame; inGame = !!ig; if (inGame && !was) _gamePlayed = true; render(); });
window.api.onPlayers(({ players }) => { roster = players || []; render(); });
window.api.onSession(({ session, myName: mn, isHost }) => {
  const prevPhase = sessionData && sessionData.phase;
  sessionData = session || null;
  const f = (session && session.teamsFormedAt) || 0;
  if (f && f !== _lastFormedSeen) { _lastFormedSeen = f; _gamePlayed = false; }
  if (mn !== undefined) myName = mn || '';
  if (isHost !== undefined) myIsHost = !!isHost;
  if (session && session.phase !== prevPhase) _todayAt = 0;   // 단계 바뀜(경기 기록됨 등) → 오늘 순위 새로
  render();
});
window.api.onMyName(name => { myName = name || ''; render(); });
window.api.onLobby(d => { lobbyData = d || null; if (d) myIsHost = !!d.isHost; render(); });
window.api.onDocked(v => { document.body.classList.toggle('docked', !!v); });

function showView(v) {
  for (const k of ['lobby', 'rec', 'team', 'draft', 'vote', 'result', 'roster']) el('view-' + k).style.display = v === k ? (k === 'team' ? 'flex' : 'block') : 'none';
}
function myTeam() {
  const s = sessionData; if (!s) return 0;
  const me = nn(myName); if (!me) return 0;
  if ((s.teamA || []).some(x => nn(x) === me)) return 1;
  if ((s.teamB || []).some(x => nn(x) === me)) return 2;
  return 0;
}
const hasTeams = () => !!(sessionData && ((sessionData.teamA || []).length || (sessionData.teamB || []).length));

// ── 팀 배정 ──────────────────────────────────────────────────────────────
function playerRow(name, i) {
  const me = (myName && nn(name) === nn(myName)) ? ' class="me"' : '';
  const st = _standing(name);
  const rec = st ? `<span class="lp">${st.wins}승 ${st.losses}패</span>` : '';
  return `<li${me}><span class="num">${i + 1}</span><span class="nm">${esc(name)}</span>${rec}</li>`;
}
function renderTeam() {
  const s = sessionData, A = s.teamA || [], B = s.teamB || [], mt = myTeam();
  const band = el('tv-band');
  band.className = 'tv-band' + (mt === 1 ? ' t1' : mt === 2 ? ' t2' : '');
  band.innerHTML = mt === 1 ? '<span class="tv-lead">내가 들어갈 팀</span><b class="tv-team">1팀</b>'
    : mt === 2 ? '<span class="tv-lead">내가 들어갈 팀</span><b class="tv-team">2팀</b>'
    : (s.spectators || []).some(x => nn(x) === nn(myName)) ? '이번 판은 <b>관전</b>이에요' : '이번 판 팀 배정';
  el('team1').className = 'ta-team blue' + (mt === 1 ? ' mine' : mt === 2 ? ' dim' : '');
  el('team2').className = 'ta-team red' + (mt === 2 ? ' mine' : mt === 1 ? ' dim' : '');
  el('t1-count').textContent = A.length + '명';
  el('t2-count').textContent = B.length + '명';
  el('t1-players').innerHTML = A.map(playerRow).join('');
  el('t2-players').innerHTML = B.map(playerRow).join('');
  const pend = el('tv-pending');
  if (s.pendingEog) { pend.style.display = ''; pend.textContent = '경기가 끝났어요 · 방장이 승리팀을 확인하는 중'; }
  else if (_gamePlayed) { pend.style.display = ''; pend.textContent = '경기 결과 기록 대기 중…'; }
  else pend.style.display = 'none';
}

// ── 🎯 드래프트 픽 ─────────────────────────────────────────────────────────
// 팀장이 번갈아 팀원을 고름(스네이크). 내 차례 팀장 = 남은 사람 칩을 눌러 뽑기 · 방장 = 대신 뽑기 가능 · 30초 지나면 무작위
let _drBusy = false;
function draftTurn() { const s = sessionData; return s && s.order ? s.order[s.pickIdx || 0] : null; }
function renderDraft() {
  const s = sessionData, team = draftTurn(), caps = s.captains || {};
  const cap = team ? caps[team] : null;
  const myTurn = !!(cap && nn(cap) === nn(myName));
  const canPick = myTurn || myIsHost;
  const band = el('dr-band');
  band.className = 'dr-band ' + (team === 'teamA' ? 't1' : 't2');
  const left = Math.max(0, Math.ceil(((s.turnEndsAt || 0) - Date.now()) / 1000));
  band.innerHTML = myTurn
    ? `<b>내 차례!</b> 팀원을 골라주세요 <span class="dr-sec">${left}초</span>`
    : `<b>${team === 'teamA' ? '1팀' : '2팀'} 팀장 ${esc(cap || '')}</b> 고르는 중 <span class="dr-sec">${left}초</span>`;
  const col = (tm, label) => {
    const arr = s[tm] || [], size = s.teamSize || arr.length;
    const rows = arr.map((n, i) => `<li class="${nn(n) === nn(myName) ? 'me' : ''}${s.lastPick && nn(s.lastPick.name) === nn(n) ? ' just' : ''}">${i === 0 ? '<span class="dr-cap">팀장</span>' : ''}<span class="nm">${esc(n)}</span></li>`).join('');
    const empty = Array.from({ length: Math.max(0, size - arr.length) }, () => '<li class="empty">—</li>').join('');
    return `<div class="dr-th${team === tm ? ' on' : ''}">${label}<span>${arr.length}/${size}</span></div><ul>${rows}${empty}</ul>`;
  };
  el('dr-a').innerHTML = col('teamA', '1팀');
  el('dr-b').innerHTML = col('teamB', '2팀');
  el('dr-a').classList.toggle('turn', team === 'teamA');
  el('dr-b').classList.toggle('turn', team === 'teamB');
  const pool = s.pool || [];
  el('dr-pool-h').textContent = canPick ? (myTurn ? `남은 ${pool.length}명 — 눌러서 뽑기` : `남은 ${pool.length}명 — 방장: 눌러서 대신 뽑기`) : `남은 ${pool.length}명`;
  el('dr-pool').innerHTML = pool.map(n => `<button class="dr-p${nn(n) === nn(myName) ? ' me' : ''}" data-name="${esc(n)}" ${canPick ? '' : 'disabled'}>${esc(n)}${_standing(n) ? `<small>${_standing(n).wins}승 ${_standing(n).losses}패</small>` : ''}</button>`).join('');
  el('dr-pool').querySelectorAll('.dr-p').forEach(b => b.onclick = async () => {
    if (_drBusy || b.disabled) return;
    _drBusy = true; b.classList.add('busy');
    const r = await window.api.draftPick(b.dataset.name);
    _drBusy = false;
    const err = el('dr-err');
    if (!r || !r.ok) { err.textContent = '⚠️ ' + ((r && r.err) || '실패'); err.style.display = ''; setTimeout(() => { err.style.display = 'none'; }, 2500); b.classList.remove('busy'); }
  });
}
function updateDraftTimer() {
  const s = sessionData; if (!s || s.phase !== 'draft') return;
  const ms = Math.max(0, (s.turnEndsAt || 0) - Date.now());
  const bar = el('dr-bar'); if (bar) { bar.style.width = (ms / 300) + '%'; bar.classList.toggle('low', ms < 8000); }
  const sec = document.querySelector('#dr-band .dr-sec'); if (sec) sec.textContent = Math.ceil(ms / 1000) + '초';
}
setInterval(updateDraftTimer, 250);

// ── 📼 기록 저장 중 — 게임 끝나고 결과가 오늘 기록에 들어갈 때까지 단계별로 ─────────────
// ⚠️ 도는 로딩 아이콘 금지(투명 창 무한 애니메이션 = CPU 폭증). 단계 체크 + 1초마다 경과 시간만 바꿈.
let recData = null;
window.api.onRec(d => { recData = d || null; render(); });
window.api.getRec().then(d => { recData = d || null; render(); }).catch(() => {});
const REC_STEPS = [['end', '게임 종료 확인'], ['get', '게임 결과 가져오기'], ['save', '서버에 저장'], ['rec', '오늘 기록에 반영']];
const REC_IDX = { end: 0, get: 1, save: 2, rec: 3, done: 4 };
function recElapsed() { return recData ? Math.max(0, Math.floor((Date.now() - recData.since) / 1000)) : 0; }
function renderRec() {
  const r = recData, cur = REC_IDX[r.stage] ?? 1, bad = r.problem === 'missed' || r.problem === 'closed' || r.problem === 'pick';
  const done = r.stage === 'done';
  el('rc-head').className = 'rc-head' + (done ? ' ok' : bad ? ' warn' : '');
  el('rc-head').innerHTML = done ? '<b>✓ 기록 완료</b><span>투표로 넘어가요</span>'
    : bad ? '<b>확인이 필요해요</b><span id="rc-sec"></span>'
    : `<b>기록 저장 중</b><span id="rc-sec">${recElapsed()}초</span>`;
  const sub = {
    get: r.src === '전적' ? `정산 화면을 못 잡아서 전적에서 찾는 중${r.tries ? ` (${r.tries}/${r.max || 36})` : ''}` : '정산 화면에서 가져오는 중',
    save: r.src ? `${r.src}에서 받음` : '',
    rec: r.src === '다른 PC' ? '다른 사람 PC가 먼저 저장했어요' : '방장 앱이 승패를 판정하는 중',
  };
  el('rc-steps').innerHTML = REC_STEPS.map(([k, label], i) => {
    const st = i < cur || done ? 'done' : i === cur ? (bad ? 'bad' : 'now') : 'todo';
    const mark = st === 'done' ? '✓' : st === 'bad' ? '!' : st === 'now' ? '●' : '';
    return `<li class="${st}"><i>${mark}</i><span>${label}${st === 'now' && sub[k] ? `<small>${esc(sub[k])}</small>` : ''}</span></li>`;
  }).join('');
  const note = el('rc-note');
  note.className = 'rc-note' + (bad ? ' warn' : '');
  note.innerHTML = r.problem === 'pick' ? '인게임 이름이 등록 이름과 달라 자동 판정을 못 했어요.<br>방장이 이긴 팀을 골라주세요.'
    : r.problem === 'missed' ? '게임 결과를 찾지 못했어요.<br>방장이 이긴 팀을 직접 기록해주세요.'
    : r.problem === 'closed' ? '결과 저장 전에 롤이 꺼졌어요.<br>롤을 다시 켜면 전적에서 가져와요. 급하면 방장이 직접 기록해도 돼요.'
    : r.problem ? esc(r.problem)
    : done ? '' : '정산 화면은 바로 나가도 괜찮아요 · 전적에서도 가져와요';
  const hb = el('rc-host');
  if (myIsHost && (bad || recElapsed() > 60) && !done) {
    hb.style.display = '';
    hb.innerHTML = '<div class="rc-host-h">방장: 이긴 팀 직접 기록</div><div class="rc-acts"><button class="ui-btn-ghost" data-w="teamA">1팀 승리</button><button class="ui-btn-ghost" data-w="teamB">2팀 승리</button></div>';
    hb.querySelectorAll('button').forEach(b => b.onclick = async () => {
      if (b.disabled) return; hb.querySelectorAll('button').forEach(x => { x.disabled = true; });
      const res = await window.api.hostResult(b.dataset.w).catch(() => null);
      if (!res || !res.ok) { hb.querySelectorAll('button').forEach(x => { x.disabled = false; }); note.textContent = '⚠️ ' + ((res && res.err) || '기록 실패'); }
    });
  } else hb.style.display = 'none';
}
setInterval(() => { const e = document.getElementById('rc-sec'); if (e && recData && recData.stage !== 'done' && !recData.problem) e.textContent = recElapsed() + '초'; }, 1000);   // 텍스트만 1초에 한 번

// ── 🗳️ 투표 ──────────────────────────────────────────────────────────────
let _pendMvp = null, _pendManner = null, _voteBusy = false, _voteSig = '';
function voteCardHtml(name, kind, picked) {
  return `<button class="vt-cand ${kind}${picked ? ' on' : ''}" data-kind="${kind}" data-name="${esc(name)}"><span class="vt-badge">${kind === 'mvp' ? '🏆' : '💎'}</span><span class="vt-nm">${esc(name)}</span></button>`;
}
function renderVote() {
  const s = sessionData, A = s.teamA || [], B = s.teamB || [], mt = myTeam();
  const wt = s.game && s.game.winner === 'teamA' ? 1 : 2;
  el('vt-banner').className = 'vt-banner ' + (wt === 1 ? 't1' : 't2');
  el('vt-banner').innerHTML = `<b>${wt}팀 승리</b> · MVP·매너왕을 뽑아주세요`;
  const body = el('vt-body');
  if (mt === 0) { body.innerHTML = '<div class="vt-note">관전자는 투표하지 않아요.<br>결과가 나오면 여기에 떠요.</div>'; renderVoteProgress(); return; }
  const mine = (s.votes || {})[fbKeyOf(myName)];
  if (mine) {
    body.innerHTML = `<div class="vt-done"><div class="vt-done-h">투표 완료</div>`
      + `<div class="vt-done-row"><span>🏆 MVP</span><b>${esc(mine.mvp)}</b></div>`
      + `<div class="vt-done-row"><span>💎 매너왕</span><b>${esc(mine.manner)}</b></div>`
      + `<button id="vt-redo" class="ui-btn-ghost">다시 선택</button></div>`;
    el('vt-redo').onclick = async () => { if (_voteBusy) return; _voteBusy = true; _pendMvp = _pendManner = null; await window.api.voteClear(); _voteBusy = false; };
    renderVoteProgress(); return;
  }
  const opp = mt === 1 ? B : A;
  const ours = (mt === 1 ? A : B).filter(x => nn(x) !== nn(myName));
  const ready = _pendMvp && _pendManner;
  body.innerHTML =
    `<div class="vt-sec"><div class="vt-sec-h t-red">🏆 MVP — 상대 팀 최고의 활약</div><div class="vt-cands">${opp.map(x => voteCardHtml(x, 'mvp', nn(x) === nn(_pendMvp))).join('')}</div></div>`
    + `<div class="vt-sec"><div class="vt-sec-h t-blue">💎 매너왕 — 우리 팀 매너</div><div class="vt-cands">${ours.map(x => voteCardHtml(x, 'manner', nn(x) === nn(_pendManner))).join('') || '<div class="vt-note">후보 없음</div>'}</div></div>`
    + `<button id="vt-cast" class="ui-btn-gold" ${ready ? '' : 'disabled'}>${ready ? '투표 확정' : 'MVP·매너왕을 각각 골라주세요'}</button>`;
  body.querySelectorAll('.vt-cand').forEach(btn => btn.onclick = () => {
    const name = btn.dataset.name;
    if (btn.dataset.kind === 'mvp') _pendMvp = nn(_pendMvp) === nn(name) ? null : name;
    else _pendManner = nn(_pendManner) === nn(name) ? null : name;
    renderVote();
  });
  const cast = el('vt-cast');
  if (cast) cast.onclick = async () => {
    if (_voteBusy || !_pendMvp || !_pendManner) return;
    _voteBusy = true; cast.disabled = true; cast.textContent = '전송 중…';
    const r = await window.api.voteCast(_pendMvp, _pendManner);
    _voteBusy = false;
    if (!r || !r.ok) { cast.disabled = false; cast.textContent = '⚠️ ' + ((r && r.err) || '전송 실패 · 다시'); }
    else { _pendMvp = _pendManner = null; }
  };
  renderVoteProgress();
}
function renderVoteProgress() {
  const s = sessionData, A = s.teamA || [], B = s.teamB || [], votes = s.votes || {};
  const chip = n => { const ok = !!votes[fbKeyOf(n)]; return `<span class="vt-chip ${ok ? 'ok' : ''}">${ok ? '✓' : '…'} ${esc(n)}</span>`; };
  const pending = [...A, ...B].filter(n => !votes[fbKeyOf(n)]).length;
  el('vt-progress').innerHTML =
    `<div class="vt-prow"><span class="t-blue">1팀</span>${A.map(chip).join('')}</div>`
    + `<div class="vt-prow"><span class="t-red">2팀</span>${B.map(chip).join('')}</div>`
    + (myIsHost ? `<button id="vt-force" class="ui-btn-ghost vt-force">투표 마감${pending ? ` · 미투표 ${pending}명 제외` : ''}</button><div class="vt-force-hint">방장 전용 · 다 모이면 자동으로 마감돼요</div>` : '');
  const fb = el('vt-force');
  if (fb) fb.onclick = async () => {
    if (fb.disabled) return;
    const t0 = fb.textContent; fb.disabled = true; fb.textContent = '마감 중…';
    const r = await window.api.voteClose();
    if (!r || !r.ok) { fb.textContent = '⚠️ ' + ((r && r.err) || '실패'); setTimeout(() => { fb.disabled = false; fb.textContent = t0; }, 2500); }
  };
}

// ── 🏁 결과 ──────────────────────────────────────────────────────────────
const seenKey = () => sessionData && sessionData.game ? 'tdSeen:' + sessionData.game.id : '';
function resultSeen() { try { return !!localStorage.getItem(seenKey()); } catch (_) { return false; } }
function renderResult() {
  const s = sessionData, r = s.result || {}, g = s.game || {};
  const winA = g.winner === 'teamA';
  el('st-banner').className = 'st-banner ' + (winA ? 't1' : 't2');
  el('st-banner').innerHTML = `<b>${winA ? '1팀' : '2팀'} 승리</b> · 오늘 ${(_today && _today.matches.length) || ''}${_today ? '번째 판' : ''}`;
  const aw = [];
  if (r.mvp) aw.push(`<span class="st-aw"><b>🏆 MVP</b> ${esc(r.mvp)}</span>`);
  if (r.svp) aw.push(`<span class="st-aw"><b>⭐ SVP</b> ${esc(r.svp)}</span>`);
  if (r.manner) aw.push(`<span class="st-aw"><b>💎 매너</b> ${esc(r.manner)}</span>`);
  el('st-awards').innerHTML = aw.join('') || '<span class="st-aw">투표 없음</span>';
  const match = _today && _today.matches.find(m => String(m.gameId) === String(g.id));
  const kda = name => {
    const st = match && (match.stats || []).find(p => nn(p.summonerName).replace(/\s/g, '').toLowerCase() === nn(name).replace(/\s/g, '').toLowerCase());
    return st ? `<span class="st-lp">${st.kills}/${st.deaths}/${st.assists}</span>` : '';
  };
  const badge = n => (nn(n) === nn(r.mvp) ? ' 🏆' : '') + (nn(n) === nn(r.svp) ? ' ⭐' : '') + (nn(n) === nn(r.manner) ? ' 💎' : '');
  const team = (names, isWin) => `<div class="st-team ${isWin ? 'win' : 'lose'}"><div class="st-team-h">${isWin ? '승리' : '패배'}</div><ul>${(names || []).map(n =>
    `<li class="${nn(n) === nn(myName) ? 'me' : ''}"><span class="st-nm">${esc(n)}${badge(n)}</span>${kda(n)}</li>`).join('')}</ul></div>`;
  el('st-teams').innerHTML = winA ? team(s.teamA, true) + team(s.teamB, false) : team(s.teamB, true) + team(s.teamA, false);
  el('st-close').onclick = () => { try { localStorage.setItem(seenKey(), '1'); } catch (_) {} render(); };
}

// ── 대기 화면: 방장 준비 배너 · 오늘 순위 · 인게임 명단 ───────────────────────
let _today = null, _todayAt = 0, _todayLoading = false;
function _standing(name) { return _today ? _today.standings.find(p => nn(p.name) === nn(name)) : null; }
async function loadToday() {
  if (_todayLoading || (_today && Date.now() - _todayAt < 30000)) return;
  _todayLoading = true;
  const t = await window.api.getToday().catch(() => null);
  _todayLoading = false;
  if (t && t.ok) { _today = t; _todayAt = Date.now(); render(); }
}
// ── 🚪 대기실 ─────────────────────────────────────────────────────────────
// 접속한 사람 전원이 같은 목록을 봄 · 각자 참가/관전 · 방장이 방식(랜덤/드래프트)·팀장 정하고 시작
let _lbBusy = false;
function lbErr(msg) { const e = el('lb-err'); e.textContent = '⚠️ ' + msg; e.style.display = ''; clearTimeout(lbErr._t); lbErr._t = setTimeout(() => { e.style.display = 'none'; }, 2600); }
async function lbAct(fn) {
  if (_lbBusy) return;
  _lbBusy = true;
  try { const r = await fn(); if (r && r.ok === false && r.err) lbErr(r.err); } catch (_) { lbErr('실패했어요'); }
  _lbBusy = false;
}
function renderLobby() {
  const L = lobbyData || { members: [], mode: 'random', captains: {} };
  const M = L.members || [], caps = L.captains || {}, draft = L.mode === 'draft';
  const ins = M.filter(m => m.st === 'in'), specs = M.filter(m => m.st === 'spec'), none = M.filter(m => !m.st);
  const me = M.find(m => m.me);
  el('lb-head').innerHTML = !myName ? '<span class="lobby-pulse"></span>롤 클라이언트에 로그인하면 자동으로 입장돼요'
    : `<b>대기실</b><span class="lb-cnt">참가 ${ins.length} · 관전 ${specs.length}${none.length ? ` · 고르는 중 ${none.length}` : ''}</span>`
      + `<span class="lb-host">${L.hostName ? `👑 ${esc(L.hostName)}` : '방장 없음'}</span>`;
  document.querySelectorAll('.lb-seg').forEach(b => {
    b.classList.toggle('on', b.dataset.mode === L.mode);
    b.disabled = !myIsHost;
    b.onclick = () => { if (myIsHost && b.dataset.mode !== L.mode) lbAct(() => window.api.lobbyMode(b.dataset.mode)); };
  });
  const cb = el('lb-caps');
  cb.style.display = draft ? '' : 'none';
  if (draft) cb.innerHTML = `<span class="lb-cap t1">1팀 팀장 <b>${caps.teamA ? esc(caps.teamA) : '—'}</b></span><span class="lb-cap t2">2팀 팀장 <b>${caps.teamB ? esc(caps.teamB) : '—'}</b></span>`
    + (myIsHost ? '<button id="lb-caprand" class="lb-mini">랜덤 팀장</button>' : '');
  const cr = el('lb-caprand'); if (cr) cr.onclick = () => lbAct(() => window.api.lobbyCaptain(null, true));
  el('lb-me').style.display = myName ? '' : 'none';
  document.querySelectorAll('.lb-mebtn').forEach(b => {
    const on = !!(me && me.st === b.dataset.st);
    b.classList.toggle('on', on);
    b.textContent = b.dataset.st === 'in' ? (on ? '✓ 참가' : '참가할게요') : (on ? '✓ 관전' : '관전할게요');
    b.onclick = () => lbAct(() => window.api.lobbyMe(on ? null : b.dataset.st));
  });
  const capOf = n => nn(n) === nn(caps.teamA) ? 1 : nn(n) === nn(caps.teamB) ? 2 : 0;
  const row = m => {
    const st = _standing(m.name), cap = capOf(m.name);
    const stLabel = m.st === 'in' ? '참가' : m.st === 'spec' ? '관전' : '고르는 중';
    const pill = myIsHost && !m.me ? `<button class="lb-pill ${m.st || 'none'}" data-k="${esc(m.key)}" title="눌러서 바꾸기(참가 → 관전 → 빼기)">${stLabel}</button>` : `<span class="lb-pill ${m.st || 'none'}">${stLabel}</span>`;
    const capBtn = draft && myIsHost && m.st === 'in' ? `<button class="lb-mini lb-capbtn${cap ? ' on' : ''}" data-n="${esc(m.name)}">${cap ? cap + '팀 팀장' : '팀장'}</button>` : (cap ? `<span class="lb-capb t${cap}">${cap}팀 팀장</span>` : '');
    return `<div class="lb-row ${m.st || 'none'}${m.me ? ' me' : ''}"><i class="lb-dot${m.online ? ' on' : ''}" title="${m.online ? '앱 접속 중' : '앱 없음(방장이 추가)'}"></i>`
      + `<span class="lb-nm" data-pk="${esc(m.key)}" title="프로필 보기">${esc(m.name)}${m.tag ? `<small>#${esc(m.tag)}</small>` : ''}${m.host ? ' <span class="lb-crown">👑</span>' : ''}</span>`
      + (st ? `<span class="lb-rec">${st.wins}승 ${st.losses}패</span>` : '') + capBtn + pill
      + (myIsHost && m.guest ? `<button class="lb-x" data-g="${esc(m.key)}" title="목록에서 빼기">✕</button>` : '') + '</div>';
  };
  el('lb-list').innerHTML = M.length ? M.map(row).join('')
    : '<div class="lb-empty">아직 아무도 없어요<br><small>팀원이 앱을 켜고 롤에 로그인하면 여기에 떠요</small></div>';
  const next = { in: 'spec', spec: null, none: 'in' };
  el('lb-list').querySelectorAll('button.lb-pill').forEach(b => b.onclick = () => {
    const m = M.find(x => x.key === b.dataset.k); if (!m) return;
    lbAct(() => window.api.lobbySet(m.key, next[m.st || 'none']));
  });
  el('lb-list').querySelectorAll('.lb-capbtn').forEach(b => b.onclick = () => lbAct(() => window.api.lobbyCaptain(b.dataset.n, false)));
  el('lb-list').querySelectorAll('.lb-nm').forEach(n => n.onclick = () => {
    const m = M.find(x => x.key === n.dataset.pk); if (!m) return;
    window.api.openProfile(m.guest ? { name: m.name } : { puuid: m.key, name: m.name });
  });
  el('lb-list').querySelectorAll('.lb-x').forEach(b => b.onclick = () => lbAct(() => window.api.lobbyGuestRm(b.dataset.g)));
  // 👑 방장: 추가·시작 / 나머지: 안내
  el('lb-hostbox').style.display = myIsHost ? '' : 'none';
  const n = ins.length, capsOk = !draft || (caps.teamA && caps.teamB);
  const go = el('lb-start');
  go.disabled = n < 4 || !capsOk;
  go.textContent = n < 4 ? `참가 ${n}명 · 4명부터 시작할 수 있어요` : !capsOk ? '팀장 2명을 정해주세요' : draft ? `드래프트 시작 · ${n}명` : `랜덤 팀 구성 · ${n}명`;
  el('lb-foot').innerHTML = myIsHost ? (n > 10 || n % 2 ? '<span>11명 이상·홀수면 남는 사람은 관전으로 빠져요</span>' : '')
    : !myName ? '' : L.hostName ? `<span class="lobby-pulse"></span>${esc(L.hostName)}님이 시작하면 바로 팀이 떠요` : '방장이 없어요 · 오른쪽 창 위 「👑 방장 하기」로 맡을 수 있어요';
  // 오늘 순위(짧게)
  loadToday();
  const t = el('lb-today');
  if (!_today || !_today.standings.length) { t.innerHTML = ''; return; }
  t.innerHTML = `<div class="wi-sec-h">오늘 순위 · ${_today.matches.length}판</div><div class="wi-rk">` + _today.standings.slice(0, 5).map(p => {
    const medal = p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : `<b>${p.rank}</b>`;
    return `<div class="wi-rk-row${nn(p.name) === nn(myName) ? ' me' : ''}"><span class="wi-rk-r">${medal}</span><span class="wi-rk-nm">${esc(p.name)}</span><span class="wi-rk-lp">${p.wins}승 ${p.losses}패</span></div>`;
  }).join('') + '</div>';
}
el('lb-start').onclick = () => lbAct(() => window.api.lobbyStart());
function lbAddGuest() { const i = el('lb-add'), v = i.value.trim(); if (!v) return; i.value = ''; lbAct(() => window.api.lobbyGuest(v)); }
el('lb-add-go').onclick = lbAddGuest;
el('lb-add').addEventListener('keydown', e => { if (e.key === 'Enter') lbAddGuest(); });
function renderRoster() {
  const has = roster.length > 0;
  el('roster-h').style.display = has ? 'block' : 'none';
  el('pcount').textContent = has ? `${roster.length}명` : '';
  el('status').style.display = has ? 'none' : 'block';
  const lob = null;
  el('status').classList.toggle('lobby', false);
  if (!has && !myName) { el('status').innerHTML = '롤 클라이언트에 로그인하면<br>자동으로 입장돼요'; el('waiting-info').style.display = 'none'; return; }
  if (!has) el('status').innerHTML = lob || (_gamePlayed
    ? '경기 종료<br><span class="status-sub">결과 기록을 기다리는 중이에요.</span>'
    : '오늘의 내전 대기 중<br><span class="status-sub">방장이 팀을 짜면 여기에 자동으로 떠요.</span>');
  el('players').innerHTML = roster.map(p => `<li class="team-${p.teamId || 0}"><span class="name">${esc(p.name)}</span><span class="champ">${esc(p.champ || '')}</span></li>`).join('');
  const wi = el('waiting-info');
  if (has) { wi.style.display = 'none'; return; }
  wi.style.display = 'block';
  loadToday();
  if (!_today) { wi.innerHTML = ''; return; }
  if (!_today.standings.length) { wi.innerHTML = '<div class="wi-dim" style="text-align:center;padding:10px;">오늘은 아직 경기가 없어요</div>'; return; }
  const rows = _today.standings.slice(0, 8).map(p => {
    const medal = p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : `<b>${p.rank}</b>`;
    const extra = [p.mvp ? `🏆${p.mvp}` : '', p.manner ? `💎${p.manner}` : ''].filter(Boolean).join(' ');
    return `<div class="wi-rk-row${nn(p.name) === nn(myName) ? ' me' : ''}"><span class="wi-rk-r">${medal}</span><span class="wi-rk-nm">${esc(p.name)}</span><span class="wi-rk-lp">${p.wins}승 ${p.losses}패${extra ? ' · ' + extra : ''}</span></div>`;
  }).join('');
  wi.innerHTML = `<div class="wi-sec-h">오늘 순위 · ${_today.matches.length}판</div><div class="wi-rk">${rows}</div>`;
}

function render() {
  const s = sessionData, ph = s && s.phase;
  if (ph === 'draft' && !inGame) { loadToday(); renderDraft(); updateDraftTimer(); showView('draft'); el('phase').textContent = '드래프트'; return; }
  if (ph === 'vote' && hasTeams() && s.game) {
    const sig = s.game.id;
    if (sig !== _voteSig) { _voteSig = sig; _pendMvp = _pendManner = null; }
    renderVote(); showView('vote'); el('phase').textContent = '투표'; return;
  }
  if (ph === 'result' && hasTeams() && s.game && !resultSeen()) { loadToday(); renderResult(); showView('result'); el('phase').textContent = '결과'; return; }
  if (recData && !inGame && ph === 'teams') { renderRec(); showView('rec'); el('phase').textContent = '기록 저장 중'; return; }
  if (!inGame && ph === 'teams' && hasTeams()) { loadToday(); renderTeam(); showView('team'); el('phase').textContent = _gamePlayed ? '결과 대기' : '팀 배정'; return; }
  if (inGame || roster.length) { renderRoster(); showView('roster'); el('phase').textContent = '게임 중'; return; }
  renderLobby(); showView('lobby'); el('phase').textContent = '대기실';
}
window.api.getLobby().then(d => { if (d) { lobbyData = d; myIsHost = !!d.isHost; render(); } }).catch(() => {});
render();
