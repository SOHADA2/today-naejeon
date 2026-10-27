// ── 투데이 내전 · 왼쪽 오버레이 ───────────────────────────────────────────
// 뷰: 팀 배정(phase teams) · 투표(phase vote) · 결과(phase result) · 대기(오늘 순위·인게임 명단)
// 데이터 = 메인이 IPC로: session(today/session) · lobby · players(인게임 명단) · state(게임 여부)
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
window.api.onLobby(d => { lobbyData = d || null; render(); });
window.api.onDocked(v => { document.body.classList.toggle('docked', !!v); });

function showView(v) {
  for (const k of ['team', 'vote', 'result', 'roster']) el('view-' + k).style.display = v === k ? (k === 'team' ? 'flex' : 'block') : 'none';
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
function lobbyBanner() {
  const L = lobbyData;
  if (!L || !L.at || myIsHost || L.state !== 'preparing' || Date.now() - L.at > 30 * 60 * 1000) return null;
  const parts = Array.isArray(L.participants) ? L.participants : [];
  const meIn = myName && parts.some(n => nn(n) === nn(myName));
  return `<span class="lobby-pulse"></span>${esc(L.by || '방장')}님이 팀을 짜는 중이에요<br><span class="status-sub">${meIn ? '<b style="color:#0AC8B9">나를 선택했어요</b> · 잠시만 기다려주세요' : `${parts.length}명 선택됨`}</span>`;
}
function renderRoster() {
  const has = roster.length > 0;
  el('roster-h').style.display = has ? 'block' : 'none';
  el('pcount').textContent = has ? `${roster.length}명` : '';
  el('status').style.display = has ? 'none' : 'block';
  const lob = has ? null : lobbyBanner();
  el('status').classList.toggle('lobby', !!lob);
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
  if (ph === 'vote' && hasTeams() && s.game) {
    const sig = s.game.id;
    if (sig !== _voteSig) { _voteSig = sig; _pendMvp = _pendManner = null; }
    renderVote(); showView('vote'); el('phase').textContent = '투표'; return;
  }
  if (ph === 'result' && hasTeams() && s.game && !resultSeen()) { loadToday(); renderResult(); showView('result'); el('phase').textContent = '결과'; return; }
  if (!inGame && ph === 'teams' && hasTeams()) { loadToday(); renderTeam(); showView('team'); el('phase').textContent = _gamePlayed ? '결과 대기' : '팀 배정'; return; }
  renderRoster(); showView('roster'); el('phase').textContent = inGame ? '게임 중' : '대기';
}
render();
