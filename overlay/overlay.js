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
let _sessInit = false;
function applySession({ session, myName: mn, isHost }) {
  const prevPhase = sessionData && sessionData.phase;
  sessionData = session || null;
  const f = (session && session.teamsFormedAt) || 0;
  const newTeams = !!(f && f !== _lastFormedSeen && _sessInit);   // 켜고 처음 받은 판 상태(옛 팀)는 소리 안 냄
  _sessInit = true;
  if (f && f !== _lastFormedSeen) { _lastFormedSeen = f; _gamePlayed = false; }
  if (mn !== undefined) myName = mn || '';
  // 🔊 v0.1.139 팀 확정 효과음(사장님: 팀 바뀔 때 짧게) — 내 팀 색 「둥–툭–둥」(픽 효과음과 같은 파일) · 막 짜진 팀만(1분 안 · PC 시계 차이 여유) · 관전은 없음
  //   드래프트는 마지막 픽 때 이미 같은 소리가 나서 건너뜀 · 크기 = ⚙ 효과음 설정
  if (newTeams && session.phase === 'teams' && session.mode !== 'draft' && Date.now() - f < 60000 && myName) {
    const me = nn(myName), A = (session.teamA || []).some(x => nn(x) === me), B = (session.teamB || []).some(x => nn(x) === me);
    if (A || B) pickSound(A);
  }
  if (isHost !== undefined) myIsHost = !!isHost;
  if (session && session.phase !== prevPhase) _todayAt = 0;   // 단계 바뀜(경기 기록됨 등) → 오늘 순위 새로
  render();
}
window.api.onSession(applySession);
window.api.onMyName(name => { myName = name || ''; render(); });
window.api.onLobby(d => { lobbyData = d || null; if (d) myIsHost = !!d.isHost; render(); });
let _set = null;   // ⚙ 설정(디스코드 안내용)
window.api.getSettings && window.api.getSettings().then(v => { _set = v; render(); }).catch(() => {});
window.api.onSettings && window.api.onSettings(v => { _set = v; render(); });
window.api.onDocked(v => { document.body.classList.toggle('docked', !!v); });
if (window.api.onMerged) window.api.onMerged(v => { document.body.classList.toggle('merged', !!v); });
// 🚪 문 연출(v0.1.127 · 사장님: 창이 진짜 문처럼 · 튕기는 느낌) — 창 자체는 못 기울여서 안쪽 화면(#panel)을 경첩(바깥쪽 모서리) 기준으로 살짝 돌림 · 한 번만(무한 애니메이션 아님)
if (window.api.onDoorFx) window.api.onDoorFx(d => {
  const p = document.getElementById('panel'); if (!p || !d) return;
  if (d.act === 'reset') document.querySelectorAll('.tn-zip').forEach(e => e.remove());
  if (d.act === 'dim' || d.act === 'reset') {   // 🚪 맞닿은 뒤 서서히 어두워짐(로고·홈으로 넘어가기 전) · reset = 되돌림
    p.getAnimations().forEach(a => { if (a.id === 'dim') a.cancel(); });
    if (d.act === 'dim') { const an = p.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(.25)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' }); an.id = 'dim'; }
    return;
  }
  if (d.act === 'seam') { window.tnSeamFx && window.tnSeamFx(p, d.side); return; }
  if (d.act === 'zip') { window.tnZipFx && window.tnZipFx(p, d.side, d.keep); return; }
  if (d.act === 'unseam') { window.tnUnseamFx && window.tnUnseamFx(d.side); return; }   // v0.1.176 분리 짝 효과   // 🤐 v0.1.167 지퍼 테두리   // 🧲 v0.1.163 합쳐진 이음매 금빛(shared.css · tip.js)
  const s = d.side === 'left' ? 1 : -1, r = a => `perspective(1100px) rotateY(${(s * a).toFixed(2)}deg)`;
  p.style.transformOrigin = d.side === 'left' ? '0% 50%' : '100% 50%';
  // 🚪 v0.1.166 shut = 클라 내려서 합쳐질 때 문짝(사장님: 문 닫히던 효과가 사라짐) — 맞닿는 순간 딱 0°(바깥으로 튕김 없음 = 틈 없음) · 창 움직임(merge 감속)과 같은 박자
  const kf = d.act === 'shut' ? [{ transform: r(18) }, { transform: r(11), offset: 0.35 }, { transform: r(4), offset: 0.7 }, { transform: r(0) }]
    : d.act === 'close'
    ? [{ transform: r(16) }, { transform: r(9), offset: 0.5 }, { transform: r(0), offset: 0.72 }, { transform: r(-4), offset: 0.84 }, { transform: r(0) }]
    : [{ transform: r(0) }, { transform: r(14), offset: 0.35 }, { transform: r(6), offset: 0.72 }, { transform: r(-3), offset: 0.88 }, { transform: r(0) }];
  p.getAnimations().forEach(a => { if (a.id === 'door' || a.id === 'dim') a.cancel(); });
  const an = p.animate(kf, { duration: d.ms || 520, easing: d.act === 'shut' ? 'cubic-bezier(.3,.55,.35,1)' : 'linear' }); an.id = 'door';
  if (d.v2 && window.tnDoorBg) window.tnDoorBg(an);   // v0.1.176 문짝이 기운 틈 바탕을 좌우 같게
});

function showView(v) {
  for (const k of ['rooms', 'lobby', 'rec', 'team', 'draft', 'vote', 'result', 'roster']) el('view-' + k).style.display = v === k ? (k === 'team' || k === 'lobby' ? 'flex' : 'block') : 'none';   // lobby = 위 내용 + 아래 고정 구역(v0.1.196)
}

// ── 🚪 방 목록(v0.1.94) — 방에 들어가기 전 화면 · 방 만들기(만든 사람 = 방장) · 비공개 방 = 비밀번호 ─────────
let roomData = null, _roomId = null, _rmSig = '', _pwFor = null, _rmPriv = false;
window.api.onRooms(applyRooms);
function applyRooms(d) {
  roomData = d || null;
  const id = d && d.room ? d.room.id : null;
  if (id !== _roomId) { _roomId = id; _today = null; _todayAt = 0; _pwFor = null; _rmSig = ''; }   // 방 바뀜 → 오늘 순위(방 이름별) 새로
  render();
}
function rmErr(msg) { const e = el('rm-err'); e.textContent = msg || ''; e.style.display = msg ? '' : 'none'; }
async function rmAct(fn) {
  rmErr('');
  const r = await fn().catch(e => ({ ok: false, err: String(e && e.message || e) }));
  if (r && !r.ok) { if (r.needPw) return r; rmErr(r.err || '잠깐 문제가 생겼어요'); }
  return r;
}
function rmForm(open) {
  el('rm-form').style.display = open ? '' : 'none';
  if (open) { el('rm-name').value = ''; el('rm-name').placeholder = myName ? `${myName}의 방` : '방 이름'; el('rm-pw').value = ''; setPriv(false); setTimeout(() => el('rm-name').focus(), 0); }
}
function setPriv(p) { _rmPriv = !!p; document.querySelectorAll('.rm-seg').forEach(b => b.classList.toggle('on', (b.dataset.priv === '1') === _rmPriv)); el('rm-pw').style.display = _rmPriv ? '' : 'none'; }
document.querySelectorAll('.rm-seg').forEach(b => b.onclick = () => { setPriv(b.dataset.priv === '1'); if (_rmPriv) el('rm-pw').focus(); });
el('rm-new').onclick = () => rmForm(el('rm-form').style.display === 'none');
el('rm-cancel').onclick = () => { rmForm(false); rmErr(''); };
async function rmCreate() {
  const go = el('rm-go'); if (go.disabled) return;
  go.disabled = true;
  const r = await rmAct(() => window.api.roomCreate(el('rm-name').value.trim(), _rmPriv, el('rm-pw').value));
  go.disabled = false;
  if (r && r.ok) rmForm(false);
}
el('rm-go').onclick = rmCreate;
['rm-name', 'rm-pw'].forEach(id => el(id).addEventListener('keydown', e => { if (e.key === 'Enter') rmCreate(); }));
async function rmJoin(id, pw) {
  const r = await rmAct(() => window.api.roomJoin(id, pw));
  if (r && r.needPw) {
    if (_pwFor === id && pw !== undefined) rmErr(r.err);
    _pwFor = id; _rmSig = ''; renderRooms();
    setTimeout(() => { const i = el('rm-pw-in'); if (i) i.focus(); }, 0);
  }
}
function renderFull() {   // 🚦 v0.1.96: 자리 꽉 참(무료 서버 동시 연결 한도) — 실시간 연결 안 열고 기다림 · 자리 나면 앱이 알아서 들어감
  const F = roomData.full;
  el('rm-new').style.display = 'none'; rmForm(false); rmErr('');
  const sig = 'full:' + F.cap;
  if (sig === _rmSig) return;
  _rmSig = sig;
  el('rm-list').innerHTML = `<div class="rm-empty"><b class="rm-full-t">지금은 자리가 꽉 찼어요</b><span>무료 서버라 한 번에 ${F.cap}명까지 쓸 수 있어요<br>누가 나가면 자동으로 들어가요</span><span class="lb-wait">자리 확인 중</span></div>`;
}
function renderRooms() {
  const D = roomData || { rooms: [] }, R = D.rooms || [];
  el('rm-new').style.display = myName && R.length ? '' : 'none';
  const sig = JSON.stringify([myName, R, _pwFor, D.ready]);
  if (sig === _rmSig) return;   // 같은 내용이면 다시 안 그림(입력 중인 비밀번호가 지워지지 않게)
  _rmSig = sig;
  const list = el('rm-list');
  if (!myName) { list.innerHTML = '<div class="rm-empty"><span class="lb-wait">롤 클라이언트에 로그인하면 방에 들어갈 수 있어요</span></div>'; return; }
  if (!R.length) {
    list.innerHTML = D.ready === false ? '<div class="rm-empty">방 목록을 불러오는 중이에요</div>'
      : '<div class="rm-empty"><b class="rm-empty-t">아직 만들어진 방이 없어요</b><span>방을 만들면 친구들 앱의 방 목록에 떠요<br>만든 사람이 방장이에요</span><button id="rm-new2" class="ui-btn-gold">＋ 방 만들기</button></div>';   // v0.1.196 처음 온 사람: 방을 만들면 어떻게 되는지 한 줄
    const b = el('rm-new2'); if (b) b.onclick = () => rmForm(true);
    return;
  }
  list.innerHTML = R.map(r => `<div class="rm-card${r.mine ? ' mine' : ''}"><div class="rm-row" data-rid="${esc(r.id)}" title="이 방에 들어가기">`
    + `<span class="rm-main"><b class="rm-nm" title="${esc(r.name)}">${esc(r.name)}</b><small class="rm-sub">${r.host ? `방장 <b>${esc(r.host)}</b>` : '방장 없음'}${r.members.length ? ' · ' + esc(r.members.join(', ')) : ''}</small></span>`
    + (r.priv ? '<span class="rm-tag">비공개</span>' : '')
    + `<span class="rm-n"><b>${r.n}</b>명</span><button class="rm-join" data-room="${esc(r.id)}">들어가기</button></div>`
    + (_pwFor === r.id ? `<div class="rm-pwrow"><input id="rm-pw-in" class="rm-in" type="password" maxlength="20" placeholder="비밀번호"><button class="rm-join" data-pwgo="${esc(r.id)}">확인</button></div>` : '')
    + '</div>').join('');
  list.querySelectorAll('[data-room]').forEach(b => b.onclick = e => { e.stopPropagation(); rmJoin(b.dataset.room); });
  list.querySelectorAll('.rm-row[data-rid]').forEach(r => r.onclick = () => rmJoin(r.dataset.rid));   // v0.1.196 방 카드 어디를 눌러도 들어감(누를 곳이 넓게)
  const pg = list.querySelector('[data-pwgo]');
  if (pg) { const go = () => rmJoin(pg.dataset.pwgo, el('rm-pw-in').value); pg.onclick = go; el('rm-pw-in').addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
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
  const rec = st ? `<span class="lp"><span class="num">${st.wins}</span>승 <span class="num">${st.losses}</span>패</span>` : '';
  return `<li${me}><span class="no num">${i + 1}</span><span class="nm">${esc(name)}</span>${rec}</li>`;
}
const DC_LOGO = '<svg class="dc-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.1.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.42 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.086-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419z"/></svg>';   // 🎧 v0.1.194 디스코드 로고(방 카드 아이콘)
let _dcHintUntil = 0;
const DC_ICO = '<svg class="dc-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 9V8a5 5 0 0 1 10 0v1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="9" width="3" height="5" rx="0.6" fill="currentColor"/><rect x="11" y="9" width="3" height="5" rx="0.6" fill="currentColor"/></svg>';   // 🎧 v0.1.131 디스코드(헤드셋)
function renderTeam() {
  const s = sessionData, A = s.teamA || [], B = s.teamB || [], mt = myTeam();
  const band = el('tv-band');
  band.className = 'tv-band' + (mt === 1 ? ' t1' : mt === 2 ? ' t2' : '');
  band.innerHTML = mt === 1 ? '<span class="tv-lead">내가 들어갈 팀</span><b class="tv-team">1팀 <span class="lb-sec-en">BLUE</span></b>'
    : mt === 2 ? '<span class="tv-lead">내가 들어갈 팀</span><b class="tv-team">2팀 <span class="lb-sec-en">RED</span></b>'
    : (s.spectators || []).some(x => nn(x) === nn(myName)) ? '이번 판은 <b>관전</b>이에요' : '이번 판 팀 배정';
  el('team1').className = 'ta-team blue' + (mt === 1 ? ' mine' : mt === 2 ? ' dim' : '');
  el('team2').className = 'ta-team red' + (mt === 2 ? ' mine' : mt === 1 ? ' dim' : '');
  el('t1-count').textContent = A.length + '명';
  el('t2-count').textContent = B.length + '명';
  el('t1-players').innerHTML = A.map(playerRow).join('');
  el('t2-players').innerHTML = B.map(playerRow).join('');
  { // 🎮 v0.1.188 이번 판 다리(팀 정할 때 정함 · 드래프트 = 후픽 팀장이 고름) — 방장이 롤 사용자 설정 방에 있으면 이 다리로 방을 다시 만들어 초대
    const m = s.lolMap && LOL_MAP_KO[s.lolMap], b = el('tv-map');
    b.style.display = m && s.mode !== 'normal' ? '' : 'none';
    if (m) b.innerHTML = `<span class="tv-map-h">🗺 이번 판 다리</span><b>${m}</b><small>${s.lolMapBy ? esc(s.lolMapBy) + ' 팀장이 고름' : '무작위'}</small>`;
  }
  { // 🎧 v0.1.131 디스코드 음성 채널 나누기 결과(방장 앱이 session.dcMove에 남김) — 못 옮긴 사람과 이유
    const D = s.dcMove, b = el('tv-dc'), on = D && D.at >= (s.teamsFormedAt || 0);
    b.style.display = on ? '' : 'none';
    if (on) b.innerHTML = `<span class="tv-dc-h">${DC_ICO}<em>디스코드</em></span><span class="tv-dc-t">${D.err && !D.n ? (/403|404/.test(D.err) ? '봇이 연결된 서버에 없어요' : '음성 채널을 못 찾았어요') : D.n ? `<b class="num">${D.n}</b>명 1팀·2팀 음성 채널로 옮겼어요` : '아무도 못 옮겼어요'}</span>`
      + ((D.miss || []).length ? `<small class="tv-dc-miss">${D.miss.map(x => `<span><b>${esc(x.n || '')}</b> ${esc(x.w || '')}</span>`).join('')}</small>` : '');
  }
  { // ⚖️ v0.1.174 밸런스로 짠 팀이면 두 팀 평균 점수(아수라장 티어 점수) · 점수 없는 사람은 50점으로 계산했다고 알림
    const Q = s.mode === 'balance' ? s.bal : null, b = el('tv-bal');
    b.style.display = Q ? '' : 'none';
    if (Q) b.innerHTML = `<span class="tv-bal-h">밸런스</span><span class="tv-bal-s"><em class="t1">1팀 평균 <b class="num">${Number(Q.a).toFixed(1)}</b></em><em class="t2">2팀 평균 <b class="num">${Number(Q.b).toFixed(1)}</b></em></span>`
      + (Q.n - Q.known > 0 ? `<small data-tip="${esc((Q.miss || []).join(', '))}">티어 점수 없는 ${Q.n - Q.known}명은 50점으로 계산</small>` : '');
  }
  hostSpecNote(el('tv-hspec'), myIsHost && !mt, [...A, ...B], false);
  const pend = el('tv-pending');
  if (s.pendingEog) { pend.style.display = ''; pend.textContent = '경기가 끝났어요 · 방장이 승리팀을 확인하는 중'; }
  else if (_gamePlayed) { pend.style.display = ''; pend.textContent = '경기 결과 기록 대기 중…'; }
  else pend.style.display = 'none';
  showCancel('tv-cancel', '팀 배정을 취소하고 모두 대기실로 돌아갈까요?' + (_gamePlayed || s.pendingEog ? '\n⚠️ 방금 끝난 경기 결과가 아직 기록 전이에요 — 취소하면 이 판은 기록되지 않아요.' : ''));
}
// 👑 팀 배정·드래프트 취소(v0.1.59) — 원래 오른쪽 창 「진행」 탭 맨 아래에만 있어 못 찾음(사장님) → 왼쪽 팀 화면에 방장만
function showCancel(id, ask) {
  const b = el(id); b.style.display = myIsHost ? '' : 'none';
  b.onclick = async () => {
    if (b.disabled || !(await tnConfirm(ask))) return;
    b.disabled = true;
    const r = await window.api.lobbyReopen().catch(e => ({ ok: false, err: String(e) }));
    b.disabled = false;
    if (!r || !r.ok) tnAlert('취소 실패 · ' + ((r && r.err) || '다시 눌러주세요'));
  };
}

const LOL_MAP_KO = { NONE: '칼바람 나락', MapSkin_Map12_Bloom: '코신 다리', MapSkin_HA_Bilgewater: '도살자의 다리' };   // 🎮 v0.1.188 롤 아수라장 사용자 설정 방 다리(main LOL_MAP_KO와 같게)
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
    : `<b>${team === 'teamA' ? '1팀' : '2팀'} 팀장 <span class="dr-capn">${esc(cap || '')}</span></b> <span class="dr-nw">고르는 중</span> <span class="dr-sec">${left}초</span>`;
  const col = (tm, label) => {
    const arr = s[tm] || [], size = s.teamSize || arr.length;
    const rows = arr.map((n, i) => `<li class="${nn(n) === nn(myName) ? 'me' : ''}${_pickWait && nn(_pickWait) === nn(n) ? ' pk-wait' : ''}">${i === 0 ? '<span class="dr-cap">팀장</span>' : ''}<span class="nm">${esc(n)}</span></li>`).join('');
    const empty = Array.from({ length: Math.max(0, size - arr.length) }, () => '<li class="empty">—</li>').join('');
    return `<div class="dr-th${team === tm ? ' on' : ''}">${label}<span>${arr.length}/${size}</span></div><ul>${rows}${empty}</ul>`;
  };
  el('dr-order').innerHTML = orderBar(s.order || [], s.pickIdx || 0);
  { // 🎮 v0.1.188 다리 = 선픽이 아닌 팀장이 고름(사장님) · 방장도 대신 · 다 뽑을 때까지 안 고르면 무작위 · 팀이 정해지면 방장 앱이 이 다리로 롤 방을 다시 만듦
    const box = el('dr-map'), by = s.mapBy ? caps[s.mapBy] : null;
    if (!by) box.style.display = 'none';
    else {
      const can = nn(by) === nn(myName) || myIsHost, cur = s.lolMap;
      const h = `<div class="dr-map-h"><span class="dr-map-t">🗺 다리</span><em>${s.mapBy === 'teamA' ? '1팀' : '2팀'} 팀장 <b>${esc(by)}</b>(후픽)이 골라요${cur ? '' : ' · 안 고르면 무작위'}</em></div>`
        + `<div class="dr-map-b">${Object.keys(LOL_MAP_KO).map(k => `<button class="dr-mp${cur === k ? ' on' : ''}" data-map="${k}" ${can ? '' : 'disabled'}>${LOL_MAP_KO[k]}</button>`).join('')}</div>`;
      box.style.display = '';
      if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
      box.querySelectorAll('.dr-mp').forEach(b => b.onclick = async () => { if (b.disabled || !can) return; const r = await window.api.draftMap(b.dataset.map); if (!r || !r.ok) tnAlert((r && r.err) || '다리를 못 골랐어요'); });
    }
  }
  el('dr-a').innerHTML = col('teamA', '1팀');
  el('dr-b').innerHTML = col('teamB', '2팀');
  el('dr-a').classList.toggle('turn', team === 'teamA');
  el('dr-b').classList.toggle('turn', team === 'teamB');
  showCancel('dr-cancel', '드래프트를 취소하고 모두 대기실로 돌아갈까요?');
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
// 🎯 픽 연출 — lastPick이 새로 바뀌면 모두의 화면에 한 번: 팀 색 띠가 사선으로 그어지고 → 뽑힌 사람 아이콘·이름이 「쾅」 → 빛이 훑고 → 그 팀 칸으로
const PICK_MS = 1700;
let _pickSeen = null, _pickTimer = null, _pickWait = null;   // _pickWait = 연출 중인 사람(팀 칸엔 연출 끝나고 들어감)
function maybePick(s) {
  const lp = s && s.lastPick; if (!lp || !lp.at) return;
  const key = lp.at + '|' + lp.name;
  if (_pickSeen === key) return;
  const first = _pickSeen === null; _pickSeen = key;
  if (first && Date.now() - lp.at > 2500) return;   // 켜자마자 옛 픽은 건너뜀
  if (Date.now() - lp.at > 4000 || Date.now() - lp.at < -3000) return;
  _pickWait = lp.name;
  playPick(s, lp);
}
function playPick(s, lp) {
  const A = lp.team === 'teamA', caps = s.captains || {}, cap = caps[lp.team] || '';
  const nPick = s.pickIdx || 1;
  const layer = el('pk');
  layer.style.setProperty('--bar-h', (el('bar') ? el('bar').offsetHeight : 80) + 'px');
  layer.style.setProperty('--pk-c', A ? 'var(--t1)' : 'var(--t2)');
  layer.style.setProperty('--pk-soft', A ? 'rgba(74,168,255,0.28)' : 'rgba(255,90,110,0.26)');
  const m = ((lobbyData && lobbyData.members) || []).find(x => nn(x.name) === nn(lp.name)) || { name: lp.name };
  const by = lp.auto ? '시간 초과 · <b>자동 픽</b>' : lp.byHost ? `방장이 대신 · <b>${A ? '1팀' : '2팀'}</b>` : `<b>${esc(cap)}</b> 팀장의 선택`;
  el('pk-card').innerHTML = `<span class="pk-en">${A ? 'TEAM 1' : 'TEAM 2'} · PICK ${nPick}</span>${avatar(m, 'pk-av')}<b class="pk-nm">${esc(lp.name)}</b><span class="pk-by">${by}</span>`;
  clearTimeout(_pickTimer);
  layer.getAnimations({ subtree: true }).forEach(a => a.cancel());
  layer.style.display = 'flex';
  const band = el('pk-band'), card = el('pk-card'), shine = el('pk-shine'), from = A ? '-110%' : '110%';
  const go = (node, kf, opt) => node.animate(kf, Object.assign({ fill: 'both' }, opt));
  go(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
  go(band, [{ transform: `skewY(-7deg) translateX(${from}) scaleY(0.5)` }, { transform: 'skewY(-7deg) translateX(0) scaleY(1)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' });
  go(card, [
    { opacity: 0, transform: 'scale(1.7)', filter: 'blur(6px) brightness(2)' },
    { opacity: 1, transform: 'scale(0.94)', filter: 'blur(0) brightness(1.4)', offset: 0.58 },
    { opacity: 1, transform: 'scale(1)', filter: 'blur(0) brightness(1)' },
  ], { duration: 240, delay: 60, easing: 'cubic-bezier(.5,0,.3,1)' });   // 이름이 꽂히는 순간 = 「둥」(0.2초)
  go(shine, [{ transform: 'translateX(0)' }, { transform: 'translateX(380%)' }], { duration: 520, delay: 420, easing: 'ease-in-out' });
  // 「둥–툭–둥」 박자마다 화면이 짧게 흔들림(툭은 살짝)
  go(el('pk-card').parentElement, [{ translate: '0 0' }, { translate: '-5px 3px' }, { translate: '4px -2px' }, { translate: '-2px 1px' }, { translate: '0 0' }], { duration: 260, delay: 200, easing: 'ease-out', fill: 'none' });
  go(el('pk-card').parentElement, [{ translate: '0 0' }, { translate: '2px -1px' }, { translate: '-1px 0' }, { translate: '0 0' }], { duration: 160, delay: 370, easing: 'ease-out', fill: 'none' });   // 「툭」
  go(el('pk-card').parentElement, [{ translate: '0 0' }, { translate: '-4px 2px' }, { translate: '3px -1px' }, { translate: '0 0' }], { duration: 220, delay: 540, easing: 'ease-out', fill: 'none' });   // 마지막 「둥」
  // 끝 = 띠와 이름이 그 팀 쪽으로 빠지며 사라짐
  go(card, [{ opacity: 1, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: `translateX(${A ? '-40%' : '40%'}) scale(0.7)` }], { duration: 280, delay: PICK_MS - 300, easing: 'ease-in', composite: 'replace' });
  go(band, [{ opacity: 1 }, { opacity: 0 }], { duration: 280, delay: PICK_MS - 300 });
  go(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: PICK_MS - 200 });
  pickSound(A);
  _pickTimer = setTimeout(() => {
    layer.style.display = 'none'; layer.getAnimations({ subtree: true }).forEach(a => a.cancel());
    const li = [...document.querySelectorAll('#dr-' + (A ? 'a' : 'b') + ' li')].find(x => nn(x.textContent.replace(/^팀장/, '')) === nn(lp.name));
    _pickWait = null;
    if (li) { li.style.setProperty('--pk-from', A ? '-30px' : '30px'); li.style.setProperty('--pk-soft2', A ? 'rgba(74,168,255,0.35)' : 'rgba(255,90,110,0.33)'); li.classList.remove('pk-wait'); li.classList.add('pk-land'); }
  }, PICK_MS);
}
// 🔊 픽 효과음 = 실제 악기 녹음(VSCO-2 CE·CC0)으로 미리 섞은 「둥–툭–둥」 베이스: 콘트라베이스+첼로 피치카토(1팀 레→라 · 2팀 도→솔)
//   0.2초 「둥」 = 화면에서 이름이 꽂히는 순간 · 0.37 「툭」 · 0.54 「둥」(화면 흔들림 세 번과 같은 박자). 재료·방법 = assets/sfx/CREDITS.txt
const VOL = () => (window.__tnVol == null ? 1 : window.__tnVol);   // ⚙️ 설정의 효과음 크기(desktop/settings.js)
const PICK_SFX = { A: new Audio('../assets/sfx/pick-t1.ogg'), B: new Audio('../assets/sfx/pick-t2.ogg') };
Object.values(PICK_SFX).forEach(a => { a.preload = 'auto'; a.volume = 0.2; });   // 사장님: 0.7에서 10~11dB 더 작게
function pickSound(A) { try { const a = PICK_SFX[A ? 'A' : 'B']; a.volume = 0.2 * VOL(); if (!a.volume) return; a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
// 🎯 뽑는 순서 막대: 같은 팀이 연달아 뽑는 칸은 한 묶음 · 뽑은 칸=흐리게 · 지금 차례=꽉 채워 튀어 오름
function orderBar(order, idx, labels) {
  const groups = [];
  order.forEach((t, i) => { const g = groups[groups.length - 1]; if (g && g.t === t) g.i.push(i); else groups.push({ t, i: [i] }); });
  return '<span class="ogs">' + groups.map(g => `<span class="og">${g.i.map(i => {
    const cls = labels ? (g.t === 'teamA' ? 'f' : 's') : (g.t === 'teamA' ? 't1' : 't2');
    const st = labels ? '' : i < idx ? ' done' : i === idx ? ' now' : '';
    const tx = labels ? (g.t === 'teamA' ? '선' : '후') : (g.t === 'teamA' ? '1' : '2');
    return `<i class="op ${cls}${st}">${tx}</i>`; }).join('')}</span>`).join('') + '</span>';
}
function updateDraftTimer() {
  const s = sessionData; if (!s || s.phase !== 'draft') return;
  const ms = Math.max(0, (s.turnEndsAt || 0) - Date.now());
  const bar = el('dr-bar'); if (bar) { bar.style.width = (ms / 300) + '%'; bar.classList.toggle('low', ms < 8000); }
  const sec = document.querySelector('#dr-band .dr-sec'); if (sec) sec.textContent = Math.ceil(ms / 1000) + '초';
}
setInterval(updateDraftTimer, 250);

// ── 🪙 선픽 동전 던지기 — 드래프트가 막 시작됐으면 모두에게 한 번 재생(main COIN_MS 동안 픽 잠김) ──────────
// 동전이 「띵!」 튀어 오름 → 빙글빙글 돌다 떨어짐 → 착지(짤랑) → 결과 면 확대 → 「1팀 선픽!」. 면 = assets/coin-t1·t2.webp. 결과 면은 서버의 firstPick 그대로.
const COIN_MS = 6000;   // main.js COIN_MS와 같게(이 시간 동안 픽 잠김) — 3D 사미라 Taunt(약 5초)에 맞춤
let _coinShown = null, _ac = null;
// 🔊 동전 효과음 전체(WebAudio 합성·에셋 없음) — 연출 시작 시각 t0 기준으로 한 번에 예약(setTimeout보다 정확)
// 튕김(엄지 딱+묵직한 금속 울림) → 회전 바람 소리(돌수록 느려짐) → 착지 쿵·쨍·통통 → 누운 채 다르륵(점점 빨라지다 멈춤) → 결과 쾅+팀 화음
// 타이밍 = playCoin과 같은 값(FLY·LAND·ZOOM). 미리보기는 같은 함수를 OfflineAudioContext로 그려 파일로 만듦
const COIN_SFX_T = { FLY: 0.44, LAND: 1.84, ZOOM: 2.79 };
// 🔊 효과음 부품(마스터·압축·리미터·잔향 + 소리 조각) — 동전·드래프트 픽이 같이 씀
function sfxKit(ac) {
  const sr = ac.sampleRate;
  const master = ac.createGain(); master.gain.value = 0.42 * (ac instanceof OfflineAudioContext ? 1 : VOL());
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;   // 찢어지는 소리 방지
  master.connect(comp); comp.connect(lim); lim.connect(ac.destination);
  // 공간감(짧은 홀 잔향) — 감쇠하는 잡음으로 만든 임펄스
  const rv = ac.createConvolver(), irLen = Math.floor(sr * 1.6), ir = ac.createBuffer(2, irLen, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
  rv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.32; rv.connect(wet); wet.connect(master);
  const bus = (send) => { const g = ac.createGain(); g.connect(master); if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(rv); } return g; };
  const noiseBuf = (sec) => { const n = Math.floor(sr * sec), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
  const env = (g, at, peak, atk, dur) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + atk); g.gain.exponentialRampToValueAtTime(0.0001, at + atk + dur); };
  const tone = (out, f, at, peak, dur, type, f2) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur * 0.6);
    env(g, at, peak, 0.003, dur); o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.1); };
  const noise = (out, at, peak, dur, ftype, f, q, f2) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf(dur + 0.05);
    fl.type = ftype; fl.frequency.setValueAtTime(f, at); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, at + dur); fl.Q.value = q || 0.8;
    env(g, at, peak, 0.002, dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(at); s.stop(at + dur + 0.05); };
  // 두꺼운 금화 울림 = 비정수 배음 + 살짝 어긋난 쌍(맥놀이로 「우웅~」)
  const ring = (out, f0, at, k, len) => [[1, 0.5, 1], [2.32, 0.34, 0.75], [4.25, 0.2, 0.5], [6.63, 0.1, 0.32]].forEach(([r, g, d]) => {
    tone(out, f0 * r, at, g * k, len * d); tone(out, f0 * r + 2.5 + r, at, g * k * 0.6, len * d * 0.9); });
  const thud = (out, at, k, f) => { tone(out, f || 130, at, 0.9 * k, 0.22, 'sine', (f || 130) * 0.38); noise(out, at, 0.5 * k, 0.08, 'lowpass', 700); };
  return { fx: bus(0.45), dry: bus(0), tone, noise, ring, thud, noiseBuf };
}
function coinScore(ac, t0, A) {
  const T = COIN_SFX_T, { fx, dry, tone, noise, ring, thud, noiseBuf } = sfxKit(ac);
  // ① 튕김: 엄지 「딱」 + 묵직한 「쨍~」
  const f = t0 + T.FLY;
  noise(dry, f, 0.7, 0.018, 'bandpass', 3200, 1.4); thud(dry, f, 0.35, 180);
  ring(fx, 1180, f + 0.004, 1, 2.6);
  // ② 회전 바람: 동전이 공기를 가르는 「우웅웅」 — 돌수록 느려짐(LFO 14→5Hz)·올라갈 땐 높게 내려올 땐 낮게
  { const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(), am = ac.createGain(), lfo = ac.createOscillator(), dep = ac.createGain();
    const a = f + 0.05, e = t0 + T.LAND, mid = a + (e - a) * 0.5;
    s.buffer = noiseBuf(e - a + 0.1); bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(650, a); bp.frequency.exponentialRampToValueAtTime(1500, mid); bp.frequency.exponentialRampToValueAtTime(560, e);
    lfo.frequency.setValueAtTime(14, a); lfo.frequency.exponentialRampToValueAtTime(5, e); dep.gain.value = 0.5; am.gain.value = 0.5;
    lfo.connect(dep); dep.connect(am.gain);
    g.gain.setValueAtTime(0.0001, a); g.gain.exponentialRampToValueAtTime(0.32, a + 0.18); g.gain.setValueAtTime(0.32, e - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, e);
    s.connect(bp); bp.connect(am); am.connect(g); g.connect(dry); s.start(a); s.stop(e + 0.05); lfo.start(a); lfo.stop(e + 0.05); }
  // ③ 착지: 「쿵·쨍」 + 낮게 두 번 통통
  const l = t0 + T.LAND;
  [[0, 1], [0.12, 0.5], [0.21, 0.26]].forEach(([dt, k]) => { thud(dry, l + dt, k, 120); ring(fx, 1020 * (1 - dt * 0.12), l + dt, 0.75 * k, 0.9); noise(dry, l + dt, 0.35 * k, 0.03, 'highpass', 3000); });
  // ④ 누운 채 흔들림: 바닥에서 도는 동전 「다르르륵」 — 간격이 점점 짧아지다 멈춤
  { let t = l + 0.3, gap = 0.11, k = 0.55; while (t < l + 0.92 && gap > 0.012) { noise(dry, t, 0.3 * k, 0.012, 'bandpass', 2600, 2); tone(fx, 2900 + Math.random() * 400, t, 0.05 * k, 0.05); t += gap; gap *= 0.8; k *= 0.93; }
    tone(fx, 1020, t, 0.12, 0.5); }
  coinReveal(ac, { fx, dry, tone, noise, noiseBuf }, t0 + T.ZOOM, A);
}
// ⑤ 결과: 빨려 드는 바람 → 「쾅」 + 팀 화음(1팀 밝게·2팀 단단하게) + 반짝이 — 2D·3D 동전이 같이 씀
function coinReveal(ac, K, z, A) {
  const { fx, dry, tone, noise, noiseBuf } = K;
  { const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain(), a = z - 0.35;
    s.buffer = noiseBuf(0.45); hp.type = 'highpass'; hp.frequency.setValueAtTime(400, a); hp.frequency.exponentialRampToValueAtTime(5000, z);
    g.gain.setValueAtTime(0.0001, a); g.gain.exponentialRampToValueAtTime(0.35, z - 0.01); g.gain.exponentialRampToValueAtTime(0.0001, z + 0.03);
    s.connect(hp); hp.connect(g); g.connect(dry); s.start(a); s.stop(z + 0.1); }
  tone(dry, 78, z, 1, 1.1, 'sine', 34); noise(dry, z, 0.6, 0.35, 'lowpass', 260);
  const chord = A ? [440, 554.37, 659.25, 880, 1318.5] : [392, 493.88, 587.33, 783.99, 1174.66];
  chord.forEach((fr, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = i < 2 ? 'triangle' : 'sine'; o.frequency.value = fr;
    g.gain.setValueAtTime(0.0001, z); g.gain.exponentialRampToValueAtTime(0.16 - i * 0.02, z + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, z + 1.9);
    o.connect(g); g.connect(fx); o.start(z); o.stop(z + 2); });
  for (let i = 0; i < 7; i++) tone(fx, 3200 + Math.random() * 3200, z + 0.06 + i * 0.045, 0.06, 0.25);
}
// 🔊 3D 사미라 장면 소리 = 실제 녹음을 미리 섞은 파일 하나(assets/sfx/coin-samira.ogg · 합성음 아님 — 사장님: 합성음 안 어울림)
// v0.1.26: 모델의 실제 움직임(뼈 속도·동전-손 거리, 60fps)에 맞춰 배치 — 시각은 Taunt 기준(+INTRO 0.4): 0.03 몸 비틀 때 옷자락 · 0.16 튕김 「틱」+맑은 「띵~」(v0.1.32: 동전 부딪힘+3.9kHz 울림 하나, 받는 순간 0.64에 끊김) · 0.64 장갑 손에 받는 「탁」
// · 0.76 리볼버 돌리는 「휙」 · 1.16/2.33 몸 돌릴 때 옷자락 · 2.91 정면 튕김 「팅·휙」 · 3.38 꽂힘 「쿵+와장창」 · 4.08 총 뽑는 「철컥」 · 4.43 「찰칵」 (전엔 받는 소리가 0.15초 늦고 움직임에 소리가 없었음)
// 시각 = coin3d INTRO(0.4)+Taunt 시각과 맞춤 · 재료·섞는 법 = assets/sfx/CREDITS.txt
const _coinSfx = (() => { try { const a = new Audio('../assets/sfx/coin-samira.ogg'); a.preload = 'auto'; return a; } catch (_) { return null; } })();
function coinSamiraSound() { try { if (!_coinSfx) return; _coinSfx.pause(); _coinSfx.currentTime = 0; _coinSfx.volume = 0.3 * VOL(); _coinSfx.play().catch(() => {}); } catch (_) {} }
function coinSound(A) {   // 앱에서 재생 = 지금 시각 기준으로 전체 예약
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    coinScore(_ac, _ac.currentTime + 0.02, A);
  } catch (_) {}
}
function maybeCoin(s) {
  if (!s || s.phase !== 'draft' || !s.draftStartedAt || !s.firstPick || s.pickIdx) return;
  const key = s.draftStartedAt; if (_coinShown === key) return;
  const age = Date.now() - key;
  _coinShown = key;
  if (age > 1800 || age < -3000) return;   // 늦게 켰으면(이미 지난 연출) 건너뜀
  playCoin(s);
}
function playCoin(s) {
  const layer = el('coin'), A = s.firstPick === 'teamA', caps = s.captains || {};
  layer.style.setProperty('--bar-h', (el('bar') ? el('bar').offsetHeight : 80) + 'px');
  el('cn-vs').innerHTML = `<span class="cv t1"><em>1팀 팀장</em><b>${esc(caps.teamA || '')}</b></span><span class="cn-x">VS</span><span class="cv t2"><em>2팀 팀장</em><b>${esc(caps.teamB || '')}</b></span>`;
  const res = el('cn-res'); res.className = 'cn-res ' + (A ? 't1' : 't2');
  res.innerHTML = `<b>${A ? '1팀' : '2팀'} 선픽!</b><span>${esc((A ? caps.teamA : caps.teamB) || '')}</span><small>팀장이 먼저 골라요</small>`;
  res.style.opacity = 0;
  layer.style.display = 'flex';
  if (window.coin3d && window.coin3d.ok && window.coin3d.ready()) return playCoin3d(layer, res, A);   // 🎯 사미라 3D(모델이 준비됐을 때) · 아니면 아래 2D 동전
  const UP = 720, DOWN = 680, H = 140, SPINS = 7;
  const endRot = SPINS * 360 + (A ? 0 : 180);
  const dx = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 12);   // 매번 조금씩 다른 방향으로 흘러감
  const tiltY = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 10);
  const LIE = 58;   // 착지 때 뒤로 누운 각도(면이 비스듬히 보이게)
  const pos = el('cn-pos'), spin = el('cn-spin'), shadow = el('cn-shadow'), glow = el('cn-glow'), wob = el('cn-wob');
  const anims = [];
  const go = (node, kf, opt) => { const a = node.animate(kf, Object.assign({ fill: 'forwards' }, opt)); anims.push(a); return a; };
  go(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  // 바닥에 누운 동전이 살짝 들썩 → 「띵!」 하고 튀어 오름
  go(wob, [{ transform: `rotateX(${LIE}deg)` }, { transform: `rotateX(${LIE}deg)` }], { duration: 1 });
  go(pos, [{ transform: 'translate(0,0)' }, { transform: 'translate(0,3px)' }], { duration: 160, delay: 260, easing: 'ease-in' });
  const fly = 440, mid = UP / (UP + DOWN);
  coinSound(A);   // 효과음 전체(COIN_SFX_T = fly·land·zoom과 같은 시각)
  go(pos, [
    { transform: 'translate(0,0)', easing: 'cubic-bezier(.15,.7,.35,1)' },
    { transform: `translate(${dx * 0.55}px,-${H}px)`, offset: mid, easing: 'cubic-bezier(.6,0,.85,.4)' },
    { transform: `translate(${dx}px,0)` },
  ], { duration: UP + DOWN, delay: fly });
  go(spin, [{ transform: 'rotateX(0deg)' }, { transform: `rotateX(${endRot}deg)` }], { duration: UP + DOWN, delay: fly, easing: 'cubic-bezier(.2,.55,.35,1)' });   // 처음엔 빠르게 · 떨어질수록 느려짐
  // 회전축이 비스듬히 흔들리며 날아감 → 떨어지면서 뒤로 눕기 시작
  go(wob, [
    { transform: `rotateX(${LIE}deg) rotateY(0deg) rotateZ(0deg)` },
    { transform: `rotateX(8deg) rotateY(${tiltY * 0.4}deg) rotateZ(${-tiltY * 0.3}deg)`, offset: 0.18 },
    { transform: `rotateX(-6deg) rotateY(${tiltY}deg) rotateZ(${-tiltY * 0.5}deg)`, offset: mid },
    { transform: `rotateX(${LIE * 0.6}deg) rotateY(${-tiltY * 0.5}deg) rotateZ(${tiltY * 0.3}deg)`, offset: 0.85 },
    { transform: `rotateX(${LIE}deg) rotateY(${-tiltY * 0.3}deg) rotateZ(${tiltY * 0.2}deg)` },
  ], { duration: UP + DOWN, delay: fly, easing: 'ease-in-out' });
  go(shadow, [
    { transform: 'translateX(0) scale(1.15,1.2)', opacity: 1 },
    { transform: `translateX(${dx * 0.55}px) scale(0.4)`, opacity: 0.3, offset: mid },
    { transform: `translateX(${dx}px) scale(1.15,1.2)`, opacity: 1 },
  ], { duration: UP + DOWN, delay: fly });
  const land = fly + UP + DOWN;
  // 착지 = 낮게 통통 → 누운 채로 빙글 흔들리다(바닥에서 도는 동전처럼) 멈춤
  go(pos, [{ transform: `translate(${dx}px,0)` }, { transform: `translate(${dx}px,-9px)`, offset: 0.3 }, { transform: `translate(${dx}px,0)`, offset: 0.6 }, { transform: `translate(${dx}px,-2px)`, offset: 0.8 }, { transform: `translate(${dx}px,0)` }], { duration: 380, delay: land, easing: 'ease-out' });
  const wy = -tiltY * 0.3, wz = tiltY * 0.2;
  go(wob, [
    { transform: `rotateX(${LIE}deg) rotateY(${wy}deg) rotateZ(${wz}deg)` },
    { transform: `rotateX(${LIE - 13}deg) rotateY(${-wy * 1.6}deg) rotateZ(${-wz}deg)`, offset: 0.2 },
    { transform: `rotateX(${LIE + 5}deg) rotateY(${wy * 1.1}deg) rotateZ(${wz * 0.6}deg)`, offset: 0.42 },
    { transform: `rotateX(${LIE - 5}deg) rotateY(${-wy * 0.6}deg) rotateZ(0deg)`, offset: 0.64 },
    { transform: `rotateX(${LIE + 2}deg) rotateY(${wy * 0.25}deg) rotateZ(0deg)`, offset: 0.84 },
    { transform: `rotateX(${LIE}deg) rotateY(0deg) rotateZ(0deg)` },
  ], { duration: 900, delay: land, easing: 'ease-out' });
  // 결과 = 누운 동전이 일어나며 커지고 팀 색으로 빛남
  const zoom = land + 950;
  go(wob, [{ transform: `rotateX(${LIE}deg) rotateY(0deg) rotateZ(0deg)` }, { transform: 'rotateX(10deg) rotateY(0deg) rotateZ(0deg)' }], { duration: 650, delay: zoom, easing: 'cubic-bezier(.2,.8,.3,1)' });
  go(glow, [
    { filter: 'brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0))', scale: '1', translate: '0 0' },
    { filter: `brightness(1.6) drop-shadow(0 0 22px ${A ? 'rgba(74,168,255,0.9)' : 'rgba(255,90,110,0.9)'})`, scale: '1.75', translate: `${-dx}px -34px`, offset: 0.5 },
    { filter: `brightness(1.05) drop-shadow(0 0 14px ${A ? 'rgba(74,168,255,0.6)' : 'rgba(255,90,110,0.6)'})`, scale: '1.6', translate: `${-dx}px -30px` },
  ], { duration: 750, delay: zoom, easing: 'cubic-bezier(.2,.8,.3,1)' });   // 회전과 따로(같은 transform에 섞으면 면이 뒤집혀 보임)
  go(shadow, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: zoom });
  go(res, [{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, delay: zoom + 300, easing: 'ease-out' });
  go(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 350, delay: COIN_MS - 350 });
  setTimeout(() => { layer.style.display = 'none'; anims.forEach(a => { try { a.cancel(); } catch (_) {} }); }, COIN_MS + 30);
}

// 🪙 3D: 사미라가 Taunt로 동전을 튕겨 화면 쪽으로 날림 → 카메라 앞에 멈춰 결과 면 → 「N팀 선픽!」
function playCoin3d(layer, res, A) {
  layer.classList.add('cn3d');
  const stage = layer.querySelector('.cn-stage');
  const anims = [];
  const go = (node, kf, opt) => { const a = node.animate(kf, Object.assign({ fill: 'forwards' }, opt)); anims.push(a); return a; };
  go(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  stage.querySelectorAll('.cn-fx').forEach(n => n.remove());   // 혹시 남은 지난 연출 조각(금·파편·연기) 먼저 치움
  coinSamiraSound();
  window.coin3d.play({ stage, A, dur: COIN_MS - 250,
    onShow: (at) => {
      if (at) coinImpactFx(stage, at.x, at.y, at.r, go);   // 💥 꽂힌 자리에 금·섬광·파편·연기·흔들림
      go(res, [{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, delay: 220, easing: 'ease-out' });
    },
  }).catch(() => {});
  go(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 350, delay: COIN_MS - 350 });
  setTimeout(() => { layer.style.display = 'none'; layer.classList.remove('cn3d'); anims.forEach(a => { try { a.cancel(); } catch (_) {} }); stage.querySelectorAll('.cn-fx').forEach(n => n.remove()); }, COIN_MS + 30);
}
// 💥 동전이 화면에 꽂히는 순간 — 짧은 섬광 + 투명한 유리 금(가늘고 반투명·빛 번짐 없음) + 유리 면(조각마다 빛이 살짝 다르게 꺾임) + 투명 파편 + 화면 흔들림
// v0.1.25: 굵고 하얗게 빛나는 금·푸른 번짐·연기가 「얼음/서리」처럼 보였음(사장님) → 투명 유리로. 전부 한 번만 재생 · 연출 끝날 때 레이어와 함께 사라짐
function coinImpactFx(stage, x, y, r, go) {
  const W = stage.clientWidth, H = stage.clientHeight, rnd = (a, b) => a + Math.random() * (b - a);
  const fx = document.createElement('div'); fx.className = 'cn-fx'; stage.appendChild(fx);
  const at = (node, px, py) => { node.style.left = px + 'px'; node.style.top = py + 'px'; fx.appendChild(node); return node; };
  // 섬광
  const fl = at(document.createElement('i'), x, y); fl.className = 'cn-flash';
  go(fl, [{ opacity: 0.6, transform: 'translate(-50%,-50%) scale(0.35)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }], { duration: 200, easing: 'ease-out' });
  // 유리 금 — 바퀴살(울퉁불퉁하게 꺾이며 뻗음, 가끔 갈라짐) + 바퀴살 사이를 잇는 둥근 금
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'cn-crack'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  const maxR = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
  const n = 11 + Math.floor(Math.random() * 5), spokes = [], paths = [];
  const walk = (px, py, a, from, len) => { const pts = [[px, py]]; let d = from; while (d < len) { const st = rnd(12, 30); a += rnd(-0.24, 0.24); d += st; px += Math.cos(a) * st; py += Math.sin(a) * st; pts.push([px, py]);
    if (Math.random() < 0.09 && d < len * 0.75) paths.push({ pts: walk(px, py, a + (Math.random() < 0.5 ? -1 : 1) * rnd(0.4, 0.8), d, d + rnd(25, 70)), w: 0.6, delay: 70 }); } return pts; };
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(-0.17, 0.17), len = rnd(0.42, 0.95) * maxR;
    const pts = walk(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, a, r * 0.9, len); spokes.push(pts); paths.push({ pts, w: 0.9, delay: 0 }); }
  const near = (pts, d) => pts.reduce((b, p) => Math.abs(Math.hypot(p[0] - x, p[1] - y) - d) < Math.abs(Math.hypot(b[0] - x, b[1] - y) - d) ? p : b, pts[0]);
  for (const k of [1.55, 2.5, 3.6]) for (let i = 0; i < n; i++) { if (Math.random() < 0.38) continue;
    const p = near(spokes[i], r * k * rnd(0.9, 1.1)), q = near(spokes[(i + 1) % n], r * k * rnd(0.9, 1.1));
    if (Math.hypot(p[0] - x, p[1] - y) < r * k * 0.7 || Math.hypot(q[0] - x, q[1] - y) < r * k * 0.7) continue;
    const m = [(p[0] + q[0]) / 2 + rnd(-6, 6), (p[1] + q[1]) / 2 + rnd(-6, 6)];
    paths.push({ pts: [p, m, q], w: 0.7, delay: 90 }); }
  for (let i = 0; i < n; i++) {
    const A = spokes[i], B = spokes[(i + 1) % n], R1 = r * rnd(1.4, 2.0), R2 = r * rnd(2.3, 3.4);
    const inner = [A[0], near(A, R1), near(B, R1), B[0]], outer = [near(A, R1), near(A, R2), near(B, R2), near(B, R1)];
    for (const [poly, k] of [[inner, 1], [outer, 0.6]]) {
      const el = document.createElementNS(NS, 'polygon'); el.setAttribute('points', poly.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
      const lit = Math.random() < 0.55; el.setAttribute('class', 'facet');
      el.setAttribute('fill', lit ? `rgba(255,255,255,${(rnd(0.015, 0.045) * k).toFixed(3)})` : `rgba(0,0,0,${(rnd(0.02, 0.06) * k).toFixed(3)})`);
      svg.appendChild(el); go(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 40 });
    }
  }
  for (const pa of paths) for (const [cls, w] of [['dk', pa.w + 1.2], ['lt', pa.w]]) {
    const el = document.createElementNS(NS, 'path'); el.setAttribute('d', 'M' + pa.pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'));
    el.setAttribute('class', cls); el.setAttribute('stroke-width', w); el.setAttribute('pathLength', '1'); svg.appendChild(el);
    go(el, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 170, delay: pa.delay, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  for (let i = 0; i < 4; i++) { const sp = spokes[Math.floor(Math.random() * n)], p = sp[Math.min(sp.length - 1, 1 + Math.floor(Math.random() * Math.min(6, sp.length - 1)))];
    const g = at(document.createElement('i'), p[0], p[1]); g.className = 'cn-glint';
    go(g, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(0.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.3 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(0.6)' }], { duration: rnd(380, 620), delay: rnd(60, 260) }); }
  fx.appendChild(svg);
  // 파편: 동전 가장자리에서 튀어 나갔다 떨어짐
  for (let i = 0; i < 10; i++) { const a = rnd(0, Math.PI * 2), sp = rnd(50, 130), s = rnd(0.6, 1.4);
    const el = at(document.createElement('i'), x + Math.cos(a) * r, y + Math.sin(a) * r); el.className = 'cn-shard';
    const dx = Math.cos(a) * sp, dy = Math.sin(a) * sp, rot = rnd(-540, 540);
    go(el, [{ opacity: 1, transform: `translate(-50%,-50%) scale(${s}) rotate(0deg)` }, { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 120}px)) scale(${s}) rotate(${rot}deg)` }], { duration: rnd(650, 950), easing: 'cubic-bezier(.25,.6,.6,1)' }); }
  // 화면 흔들림
  go(stage, [{ transform: 'translate(0,0)' }, { transform: 'translate(-7px,4px)', offset: 0.12 }, { transform: 'translate(6px,-5px)', offset: 0.28 }, { transform: 'translate(-4px,2px)', offset: 0.46 }, { transform: 'translate(2px,-1px)', offset: 0.66 }, { transform: 'translate(0,0)' }], { duration: 340, easing: 'ease-out' });
}

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
// 이번 판 게임 결과(챔피언·KDA·피해량) — 오늘 기록에서 찾음(계정 ID 우선, 없으면 이름)
function gameStat(name) {
  const g = sessionData && sessionData.game; if (!g || !_today) return null;
  const m = _today.matches.find(x => String(x.gameId) === String(g.id)); if (!m || !m.stats) return null;
  const id = (m.ids || {})[fbKeyOf(name)], k = s => nn(s).replace(/\s/g, '').toLowerCase();
  return (id && m.stats.find(p => p.puuid === id)) || m.stats.find(p => k(p.summonerName) === k(name)) || null;
}
// 🧩 증강 아이콘 줄(등급 테두리 · 마우스 올리면 이름)
let _augMap = null;
window.api.getAugments().then(m => { _augMap = m || {}; render(); }).catch(() => {});
function augsHtml(st, cls) {
  const ids = (st && st.augments) || [];
  if (!ids.length) return '';
  return `<span class="${cls}">` + ids.map(id => { const a = (_augMap || {})[id] || {};
    return `<i class="aug ${a.rarity || ''}" title="${esc(a.name || '증강 #' + id)}">${a.icon ? `<img src="${a.icon}" alt="" onerror="this.remove()">` : ''}<b>?</b></i>`; }).join('') + '</span>';
}
function champHtml(st, cls) {
  return `<span class="${cls}">${st && st.championId ? `<img src="${champUrl(st.championId)}" alt="" onerror="this.remove()">` : ''}</span>`;
}
function voteCardHtml(name, kind, picked) {
  const st = gameStat(name);
  const line = st ? `${esc(st.championName || '')}<span class="num">${st.kills}/${st.deaths}/${st.assists}</span>${st.damage ? `<span class="num dmg">${Math.round(st.damage / 1000)}k</span>` : ''}` : '<span class="vt-nostat">게임 기록 없음</span>';
  return `<button class="vt-cand ${kind}${picked ? ' on' : ''}" data-kind="${kind}" data-name="${esc(name)}">${champHtml(st, 'vt-ch')}<span class="vt-info"><b class="vt-nm">${esc(name)}</b><small>${line}</small>${augsHtml(st, 'vt-augs')}</span><span class="vt-check">${picked ? '✓' : ''}</span></button>`;
}
function renderVote() {
  const s = sessionData, A = s.teamA || [], B = s.teamB || [], mt = myTeam();
  const wt = s.game && s.game.winner === 'teamA' ? 1 : 2;
  el('vt-banner').className = 'vt-banner ' + (wt === 1 ? 't1' : 't2');
  el('vt-banner').innerHTML = `<span class="lb-sec-en">TEAM ${wt} WIN</span><b>${wt}팀 승리</b><span>MVP와 매너왕을 뽑아주세요</span>`;
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
  const ready = _pendMvp && (_pendManner || !ours.length);   // 우리 팀이 나 혼자(1:1 등)면 매너왕 없이
  if (!_today || !_today.matches.some(x => s.game && String(x.gameId) === String(s.game.id))) { _todayAt = 0; loadToday(); }   // 방금 기록된 판의 챔피언 정보
  body.innerHTML =
    `<div class="vt-sec"><div class="vt-sec-h mvp"><span class="lb-sec-en">MVP</span>상대 팀에서 제일 잘한 사람</div><div class="vt-cands">${opp.map(x => voteCardHtml(x, 'mvp', nn(x) === nn(_pendMvp))).join('')}</div></div>`
    + `<div class="vt-sec"><div class="vt-sec-h manner"><span class="lb-sec-en">MANNER</span>우리 팀 매너왕</div><div class="vt-cands">${ours.map(x => voteCardHtml(x, 'manner', nn(x) === nn(_pendManner))).join('') || '<div class="vt-note">우리 팀이 나 혼자라 매너왕 투표는 없어요</div>'}</div></div>`
    + `<button id="vt-cast" class="ui-btn-gold" ${ready ? '' : 'disabled'}>${ready ? '투표 확정' : ours.length ? 'MVP·매너왕을 각각 골라주세요' : 'MVP를 골라주세요'}</button>`;
  body.querySelectorAll('.vt-cand').forEach(btn => btn.onclick = () => {
    const name = btn.dataset.name;
    if (btn.dataset.kind === 'mvp') _pendMvp = nn(_pendMvp) === nn(name) ? null : name;
    else _pendManner = nn(_pendManner) === nn(name) ? null : name;
    renderVote();
  });
  const cast = el('vt-cast');
  if (cast) cast.onclick = async () => {
    if (_voteBusy || !_pendMvp || (!_pendManner && ours.length)) return;
    _voteBusy = true; cast.disabled = true; cast.textContent = '전송 중…';
    const r = await window.api.voteCast(_pendMvp, ours.length ? _pendManner : null);
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
  el('st-banner').innerHTML = `<span class="lb-sec-en">RESULT</span><b>${winA ? '1팀' : '2팀'} 승리</b>${_today ? `<span>오늘 <span class="num">${_today.matches.length}</span>번째 판</span>` : ''}`;
  const aw = [];
  if (r.mvp) aw.push(`<span class="st-aw"><b>MVP</b><span class="st-awn">${esc(r.mvp)}</span></span>`);
  if (r.svp) aw.push(`<span class="st-aw"><b>SVP</b><span class="st-awn">${esc(r.svp)}</span></span>`);
  if (r.manner) aw.push(`<span class="st-aw"><b>MANNER</b><span class="st-awn">${esc(r.manner)}</span></span>`);
  el('st-awards').innerHTML = aw.join('') || '<span class="st-aw">투표 없음</span>';
  const match = _today && _today.matches.find(m => String(m.gameId) === String(g.id));
  const kda = name => { const st = gameStat(name); return st ? `<span class="st-lp num">${st.kills}/${st.deaths}/${st.assists}</span>` : ''; };
  const badge = n => (nn(n) === nn(r.mvp) ? ' 🏆' : '') + (nn(n) === nn(r.svp) ? ' ⭐' : '') + (nn(n) === nn(r.manner) ? ' 💎' : '');
  const team = (names, isWin) => `<div class="st-team ${isWin ? 'win' : 'lose'}"><div class="st-team-h">${isWin ? '승리' : '패배'}</div><ul>${(names || []).map(n =>
    `<li class="${nn(n) === nn(myName) ? 'me' : ''}">${champHtml(gameStat(n), 'st-ch')}<span class="st-nm">${esc(n)}${badge(n)}</span>${augsHtml(gameStat(n), 'st-augs')}${kda(n)}</li>`).join('')}</ul></div>`;
  el('st-teams').innerHTML = winA ? team(s.teamA, true) + team(s.teamB, false) : team(s.teamB, true) + team(s.teamA, false);
  const P = s.potg, pb = el('st-potg');   // 🎬 팟지 다시 보기(가운데 창)
  const skipped = !!(P && P.none && P.skipped && P.gameId === String(g.id));   // 🚫 v0.1.190 건너뛴 판 = 결과 화면에 「팟지 건너뜀 · 누가」(누를 수 없음)
  pb.style.display = (P && !P.none && !P.pending && P.gameId === String(g.id)) || skipped ? '' : 'none';   // pending = 방장 PC가 리플레이 녹화 중
  pb.disabled = skipped; pb.classList.toggle('skipped', skipped);
  if (skipped) pb.textContent = `🚫 팟지 건너뜀${P.by ? ` · ${P.by}님이 건너뛰었어요` : ''}`;
  else if (P && !P.none) pb.textContent = `팟지 다시 보기 · ${P.name} ${P.label}`;
  pb.onclick = () => { if (!skipped) window.api.potgReplay(); };
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
let _lbBusy = false, _mpop = false;   // _mpop = ⚔ v0.1.193 방식 고르는 창 열림(대기실이 다시 그려져도 유지)
document.addEventListener('click', e => {   // 고르는 창 밖을 누르면 닫음
  if (!_mpop || (e.target.closest && e.target.closest('#lb-mpop, #lb-mchip'))) return;
  _mpop = false; const p = document.getElementById('lb-mpop'), c = document.getElementById('lb-mchip'); if (p) p.style.display = 'none'; if (c) c.classList.remove('open');
});
function lbErr(msg) { const e = el('lb-err'); e.textContent = '⚠️ ' + msg; e.style.display = ''; clearTimeout(lbErr._t); lbErr._t = setTimeout(() => { e.style.display = 'none'; }, 2600); }
async function lbAct(fn) {
  if (_lbBusy) return;
  _lbBusy = true;
  try { const r = await fn(); if (r && r.ok === false && r.err) lbErr(r.err); } catch (_) { lbErr('실패했어요'); }
  _lbBusy = false;
}
// 🎮 v0.1.191 일반판 롤 파티 만들기·초대 — 남의 파티에 있으면 나가도 되는지 묻고 · 자리 없어 못 부른 사람은 알려 줌
async function lolPartyGo() {
  let r = await window.api.lolParty({});
  if (r && r.need === 'leave') { if (!(await tnConfirm('지금 다른 사람이 파티장인 롤 파티에 있어요.\n나가고 내 파티를 새로 만들까요?', { ok: '나가고 만들기' }))) return null; r = await window.api.lolParty({ force: true }); }
  if (!r || !r.ok) { lbErr((r && r.err) || '롤 파티를 만들지 못했어요'); return r; }
  if (r.left && r.left.length) lbErr(`롤 파티는 5명까지라 ${r.left.join(', ')}님은 초대 안 했어요`);
  return r;
}
const SEATS = 10;   // 최대 5:5
const iconUrl = id => id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${Number(id)}.jpg` : '';
const champUrl = id => id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png` : '';
function avatar(m, cls) {
  const ini = esc(String(m.name || '?').trim().charAt(0) || '?');
  return `<span class="${cls}">${m.icon ? `<img src="${iconUrl(m.icon)}" alt="" onerror="this.remove()">` : ''}<i>${ini}</i></span>`;
}
const verLt = (a, b) => { const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0; } return false; };   // 🔄 a가 b보다 옛 버전(v0.1.56)
// 🧭 v0.1.196 대기실 = 두 구역(사장님: 효율·직관·시인성 · 자주 쓰는 기능이 손쉽게 · 처음 온 사람도 바로)
//   위(lb-body) = 방과 사람: 방 줄([방 이름 ▾ = 방 메뉴] [디스코드] [PLAYERS n/10]) · 자리 · 관전
//   아래(lb-dock · 늘 창 아래 고정) = 이번 판:
//     방장  = 안내 한 줄(무엇이 모자란지·어떻게 하는지 + 그 일을 하는 작은 버튼) + [방식 ▾][시작] — 가장 자주 누르는 둘을 붙여 둠 · 방식 고르는 창은 버튼 바로 위로 열림(고른 방식 설명 한 줄)
//     팀원  = 지금 방식 · 방장 이름 · 무엇을 기다리는지 한 줄(v0.1.83에서 뺀 설명 글 대신 = 상태에 맞는 한 줄만)
//     방장 없음 = 「👑 방장 하기」(예전엔 맨 위 lb-hostcta)
//   처음 온 사람이 막히던 곳: 드래프트 팀장 = 마우스를 올려야 보이던 「팀장」 버튼을 팀장이 다 정해질 때까지 늘 보이게(lb-seats.pick) · 빈 자리를 누르면 앱 없는 사람 추가(방장) · 롤 로그인 전 = 빈 자리 대신 시작하는 법 3단계
const MODE_KO = { random: '랜덤', balance: '밸런스', draft: '드래프트', manual: '직접' };
const MODE_DESC = {   // 방식 고르는 창 맨 아래 한 줄(방장)
  random: '무작위로 두 팀을 나눠요',
  balance: '아수라장 티어 점수로 두 팀을 비슷하게 나눠요',
  draft: '팀장 둘이 번갈아 한 명씩 뽑아요 · 선픽은 동전으로 정해요',
  manual: '방장이 1팀·2팀을 직접 정해요',
  normal: '같은 팀으로 일반 게임을 해요 · 롤 파티는 5명까지',
};
const MODE_WAIT = { random: '무작위로 팀이 정해져요', balance: '티어 점수로 비슷하게 팀이 정해져요', draft: '팀장 둘이 번갈아 뽑아요' };   // 팀원: 「방장이 시작하면 …」
const GAME_PHASES = ['ReadyCheck', 'ChampSelect', 'GameStart', 'InProgress', 'Reconnect'];
async function addGuestAsk() {   // 방장: 롤 앱이 없는 사람을 이름으로 자리에(방 메뉴 · 빈 자리 누름)
  const v = await tnPrompt('롤 앱이 없는 사람도 자리에 앉혀 팀에 넣을 수 있어요', { title: '앱 없는 사람 추가', placeholder: '이름', ok: '추가', max: 24 });
  if (v) lbAct(() => window.api.lobbyGuest(v));
}
function renderLobby() {
  const L = lobbyData || { members: [], mode: 'random', captains: {} };
  const M = L.members || [], caps = L.captains || {}, draft = L.mode === 'draft', manual = L.mode === 'manual', normal = L.mode === 'normal', sides = L.sides || {};
  const ins = M.filter(m => m.st === 'in'), specs = M.filter(m => m.st === 'spec');
  const sA = ins.filter(m => sides[m.name] === 'teamA'), sB = ins.filter(m => sides[m.name] === 'teamB'), sNone = ins.filter(m => !sides[m.name]);   // 🧩 직접
  const me = M.find(m => m.me), login = !!myName;
  const G = L.lol || {}, nq = G.nq || 2400, P = G.party, QN = nq === 450 ? '칼바람 나락' : '아수라장';
  const n = ins.length, capN = (caps.teamA ? 1 : 0) + (caps.teamB ? 1 : 0), seatCap = normal ? 5 : SEATS;
  const ts = Math.min(5, Math.floor(n / 2)), left = n - ts * 2;   // 팀 크기 · 남는 사람(관전)

  // 🎧 디스코드 = 방 줄의 작은 아이콘 하나(v0.1.194) — 음성 채널 밖 = 누르면 대기 채널 + 「디스코드 참가하기」 9초 / 서버에 없음 = 초대 링크 / 방장 연결 안 됨 = 흐린 아이콘 · 음성 채널 안이면 없음
  const S = _set || {}, J = L.dcJoin;
  let dcKind = '', dcTip = '', dcGo = null;
  if (L.room && J && J.kind === 'voice') {
    dcKind = 'act'; dcTip = `디스코드 음성 채널 참가 · 「${J.name}」 대기 채널이 열려요`;
    dcGo = () => { window.api.discordJoin({ gid: J.gid, ch: J.ch }); _dcHintUntil = Date.now() + 9000; setTimeout(() => { if (lobbyData) render(); }, 9100); if (lobbyData) render(); };
  } else if (L.room && J) {
    dcKind = 'act'; dcTip = `디스코드 「${J.name}」 서버 들어가기`;
    dcGo = () => window.api.discordJoin({ code: J.code, gid: J.gid });
  } else if (myIsHost && L.room && S.discord && S.discord.app && !S.dcNudgeOff && (!L.dcGuild || !L.dcInv)) {
    const inv = !!L.dcGuild;
    dcKind = 'dim'; dcTip = inv ? '디스코드 초대 링크 넣기 · 서버에 없는 친구에게 「들어가기」가 떠요' : '디스코드 서버 연결 · 팀이 정해지면 1팀·2팀 음성 채널로 나눠요';
    dcGo = inv ? () => { const g = document.querySelector('.tn-gear'); if (g) g.click(); setTimeout(() => { const bd = document.querySelector('.tn-set-body'), t = bd && [...bd.querySelectorAll('.tn-sec')].find(e => e.textContent === '디스코드'); if (t) bd.scrollTop = t.offsetTop - 50; const ib = document.querySelector('.tn-set [data-act=dcinv]'); if (ib) ib.click(); }, 80); }
      : () => window.api.discordConnect && window.api.discordConnect().then(r => { if (r && !r.ok && r.err) tnAlert('디스코드 서버 연결 · ' + r.err); }).catch(() => {});
  }
  const dcHint = dcKind === 'act' && J && J.kind === 'voice' && Date.now() < _dcHintUntil;

  // ① 방 줄 — [방 이름 ▾ = 방 메뉴(방장 넘겨주기·앱 없는 사람 추가·그만하기·나가기)] [디스코드] [PLAYERS n/10] · 방장 = 자리의 왕관
  const head = el('lb-head');
  head.style.display = login ? '' : 'none';
  const cntTip = normal ? '롤 파티에 들어갈 사람 · 5명까지(6번째부터는 초대 안 해요)' : '참가 인원(관전은 빼고) · 한 판에 10명까지';
  head.innerHTML = !login ? ''
    : `<button id="lb-rbtn" class="lb-rbtn${_rmenu ? ' open' : ''}" title="방 메뉴${myIsHost ? ' · 방장 넘겨주기·앱 없는 사람 추가·나가기' : ' · 나가기'}"><span class="lb-en">${L.room && L.room.priv ? 'PRIVATE ROOM' : 'ROOM'}</span><span class="lb-rrow"><b class="lb-rname">${esc(L.room ? L.room.name : '대기실')}</b><i>▾</i></span></button>`
      + (dcKind ? `<button id="lb-dci" class="lb-dci-b ${dcKind}" title="${esc(dcTip)}" aria-label="${esc(dcTip)}">${DC_LOGO}${dcKind === 'act' ? '<i class="lb-dci-dot"></i>' : ''}</button>` : '')
      + (dcHint ? '<span class="lb-dci-hint" title="디스코드 대기 채널 화면에서 「음성 채널 참가하기」를 눌러 주세요">디스코드 「참가하기」</span>'
        : `<span class="lb-cnt" title="${cntTip}"><span class="lb-en">${normal ? 'PARTY' : 'PLAYERS'}</span><span class="lb-cnt-n"><b>${Math.min(n, seatCap)}</b><i>/${seatCap}</i>${n > seatCap ? `<em>+${n - seatCap}</em>` : ''}</span></span>`);
  { const rb = el('lb-rbtn'); if (rb) rb.onclick = e => { e.stopPropagation(); toggleRoomMenu(L); };
    const db = el('lb-dci'); if (db) db.onclick = e => { e.stopPropagation(); if (dcGo) dcGo(); };
    if (!login) closeRoomMenu(); else if (_rmenu) fillRoomMenu(L); }

  // ② 롤 로그인 전 = 빈 자리 대신 시작하는 법 3단계(처음 온 사람)
  const lg = el('lb-login');
  lg.style.display = login ? 'none' : '';
  if (!login && !lg.dataset.h) {
    lg.dataset.h = '1';
    lg.innerHTML = '<span class="lb-en">START</span><b class="lb-lg-t">이렇게 시작해요</b>'
      + '<ol class="lb-lg-steps"><li class="now"><i>1</i><span><b>롤 클라이언트에 로그인</b><small>그 계정으로 자동 입장해요</small></span></li>'
      + '<li><i>2</i><span><b>방을 만들거나 들어가기</b><small>만든 사람이 방장이에요</small></span></li>'
      + '<li><i>3</i><span><b>방장이 팀을 짜면 게임 시작</b><small>결과 기록·투표·하이라이트는 자동이에요</small></span></li></ol>'
      + '<span class="lb-wait"><span class="lobby-pulse"></span>롤 로그인을 기다리는 중</span>';
  }

  // ③ 자리 — 참가한 사람 순서대로 · 빈 자리는 한 줄까지만(v0.1.195) · 드래프트 팀장 고르는 중(pick)엔 「팀장」 버튼이 늘 보임
  const capOf = nm => nn(nm) === nn(caps.teamA) ? 1 : nn(nm) === nn(caps.teamB) ? 2 : 0;
  const pick = myIsHost && draft && capN < 2 && n >= 2, canAdd = myIsHost && !manual;
  const seat = (m, i, side, over) => {   // side = 직접 방식의 팀 열(왼쪽 1팀 · 오른쪽 2팀) · over = 일반판 6번째부터(롤 파티는 5명까지 → 초대 안 됨)
    const no = String(i + 1).padStart(2, '0'), sn = side === 'teamA' ? 1 : side === 'teamB' ? 2 : 0;
    if (!m) return `<div class="seat empty${sn ? ' side' + sn : ''}${canAdd ? ' add' : ''}"${canAdd ? ' data-addguest="1" title="앱 없는 사람 추가 · 롤 앱이 없는 친구도 이름으로 자리에 앉혀 팀에 넣어요"' : ''}><span class="seat-no">${no}</span><span class="seat-av">${canAdd ? '<i>＋</i>' : ''}</span>`
      + `<span class="seat-main"><b class="e1">${sn ? sn + '팀 빈 자리' : '빈 자리'}</b>${canAdd ? '<b class="e2">앱 없는 사람 추가</b>' : ''}</span></div>`;
    const st = _standing(m.name), cap = capOf(m.name);
    const tags = cap ? `<span class="seat-tag c${cap}" title="${cap}팀 팀장">팀장</span>` : '';
    const spec1 = m.me ? '<button class="seat-spec" data-mespec="1" title="이번 판은 쉬고 관전할게요(자리에서 빠짐 · 아래 「다시 참가하기」로 돌아와요)">관전</button>' : '';
    const ctl = myIsHost ? ((draft ? `<button class="seat-btn cap${cap ? ' on' : ''}" data-cap="${esc(m.name)}" title="${cap ? '팀장 해제' : '이 사람을 팀장으로'}">팀장</button>` : '')
      + (sn ? `<button class="seat-btn" data-side="${esc(m.name)}" data-t="${sn === 1 ? 'teamB' : 'teamA'}" title="${sn === 1 ? 2 : 1}팀으로 옮기기">⇄</button><button class="seat-btn" data-side="${esc(m.name)}" data-t="" title="팀에서 빼기(미정)">↩</button>` : '')
      + (!m.me ? `<button class="seat-btn out" data-out="${esc(m.key)}" title="${m.guest ? '목록에서 빼기' : '관전으로 보내기'}">${m.guest ? '✕' : '↓'}</button>` : '') + spec1) : '';
    // 버튼은 이름 줄 옆이 아니라 아랫줄 자리(v0.1.194) — 올렸을 때 아랫줄 대신 보임 → 이름 폭 그대로
    return `<div class="seat filled${ctl ? ' has-ctl' : ''}${over ? ' over' : ''}${m.me ? ' me' : ''}${cap ? ' cap' + cap : ''}${sn ? ' side' + sn : ''}">`
      + `<span class="seat-no">${no}</span>${avatar(m, 'seat-av')}`
      + `<span class="seat-main"><span class="seat-nmrow">${m.host ? '<i class="seat-crown" title="방장">👑</i>' : ''}<b class="lb-nm" data-pk="${esc(m.key)}" title="${m.me ? '나 · ' : ''}프로필 보기">${esc(m.name)}</b></span><small>${over ? '<span class="seat-ov">파티 자리 없음</span>' : ''}${tags}${m.dc ? `<span class="seat-dc" title="디스코드 연결됨 · 팀이 정해지면 음성 채널로 옮겨져요">${DC_ICO}</span>` : ''}${m.guest ? '<span>앱 없음</span>' : m.online ? '' : '<span>오프라인</span>'}${st ? `<span><span class="num">${st.wins}</span>승 <span class="num">${st.losses}</span>패</span>` : ''}${spec1}</small>${ctl ? `<span class="seat-ctl">${ctl}</span>` : ''}</span>`
      + '</div>';
  };
  const fit = (k, cap) => k >= cap ? k : Math.min(cap, k + 1 + ((k + 1) % 2));   // 사람 수 + 빈 자리 한 줄까지
  const seats = el('lb-seats');
  seats.style.display = login ? '' : 'none';
  seats.className = 'lb-seats' + (pick ? ' pick' : '');
  seats.innerHTML = manual ? Array.from({ length: Math.min(5, Math.max(sA.length, sB.length) + 1) }, (_, i) => seat(sA[i], i, 'teamA') + seat(sB[i], i, 'teamB')).join('')   // 🧩 직접: 왼쪽 열 1팀 · 오른쪽 열 2팀
    : normal ? Array.from({ length: fit(n, 5) }, (_, i) => seat(ins[i], i, null, i >= 5)).join('')   // 🎮 일반판 = 롤 파티 5자리
    : Array.from({ length: n >= SEATS ? SEATS : fit(n, SEATS) }, (_, i) => seat(ins[i], i)).join('');

  // ④ 자리에 없는 사람 = 팀 미정(직접) · 관전
  const chip = m => `<span class="lb-chip ${m.st || 'none'}${m.me ? ' me' : ''}">${avatar(m, 'chip-av')}<b class="lb-nm" data-pk="${esc(m.key)}">${esc(m.name)}</b>`
    + (myIsHost && !m.me ? `<button class="seat-btn in" data-in="${esc(m.key)}" title="참가로">＋</button>` : '')
    + (myIsHost && m.guest ? `<button class="seat-btn out" data-rm="${esc(m.key)}" title="목록에서 빼기">✕</button>` : '') + '</span>';
  const others = [];
  if (manual && sNone.length) others.push(`<div class="lb-others none"><span class="lb-ol">팀 미정 <b>${sNone.length}</b></span>${sNone.map(m => `<span class="lb-chip in${m.me ? ' me' : ''}">${avatar(m, 'chip-av')}<b class="lb-nm" data-pk="${esc(m.key)}">${esc(m.name)}</b>`
    + (myIsHost ? `<button class="seat-btn t1" data-side="${esc(m.name)}" data-t="teamA" title="1팀에 넣기">1팀</button><button class="seat-btn t2" data-side="${esc(m.name)}" data-t="teamB" title="2팀에 넣기">2팀</button>` + (!m.me ? `<button class="seat-btn out" data-out="${esc(m.key)}" title="관전으로 보내기">↓</button>` : '') : '') + '</span>').join('')}</div>`);
  if (specs.length) others.push(`<div class="lb-others"><span class="lb-ol">관전 <b>${specs.length}</b></span>${specs.map(chip).join('')}</div>`);
  el('lb-list').style.display = login && others.length ? '' : 'none';
  el('lb-list').innerHTML = others.join('');

  // ⑤ 관전 중이면 「다시 참가하기」 · 방장 관전 경고 · 내 앱 옛 버전
  { const b = el('lb-mebtn'), spec = !!(me && me.st === 'spec');
    el('lb-me').style.display = login && spec ? '' : 'none';
    b.className = 'lb-mebtn rejoin'; b.textContent = '다시 참가하기';
    b.onclick = () => lbAct(() => window.api.lobbyMe('in'));
    hostSpecNote(el('lb-hspec'), myIsHost && spec && !normal, ins.map(m => m.name), true); }
  { // 🔄 내 앱이 옛 버전이면 나에게만(v0.1.62) · 새 버전을 이미 받았으면 머리 아래 업데이트 줄이 같은 말을 하니 안 띄움(v0.1.148)
    const ub = el('lb-upd'), mv = me && me.ver, old = !!(mv && L.latest && verLt(mv, L.latest)) && !(_upd && _upd.state === 'ready');
    ub.style.display = old ? '' : 'none';
    if (old) {
      const ready = _upd && _upd.state === 'ready', busy = _upd && (_upd.state === 'downloading' || _upd.state === 'checking');
      ub.innerHTML = `<span>내 앱이 옛 버전이에요 · v${esc(mv)} → 최신 v${esc(L.latest)}</span>`
        + (ready ? '<button id="lb-upd-go" class="lb-mini" title="앱이 잠깐 꺼졌다가 새 버전으로 다시 켜져요">지금 업데이트</button>'
          : busy ? `<span class="lb-upd-st">${_upd.state === 'downloading' ? `받는 중 ${_upd.pct || 0}%` : '확인 중'}</span>`
          : '<button id="lb-upd-go" class="lb-mini" title="새 버전을 받아요 · 다 받으면 「지금 업데이트」">새 버전 받기</button>');
      const go = el('lb-upd-go'); if (go) go.onclick = () => { if (ready) window.api.updateNow(); else window.api.checkUpdate(); };
    }
  }
  const root = el('view-lobby');
  root.querySelectorAll('[data-side]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbySide(b.dataset.side, b.dataset.t || null)));
  root.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbyCaptain(b.dataset.cap, false)));
  root.querySelectorAll('[data-out]').forEach(b => b.onclick = () => { const m = M.find(x => x.key === b.dataset.out); if (m) lbAct(() => m.guest ? window.api.lobbyGuestRm(m.key) : window.api.lobbySet(m.key, 'spec')); });
  root.querySelectorAll('[data-mespec]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (myIsHost && !normal && !(await tnConfirm(HSPEC_ASK))) return; lbAct(() => window.api.lobbyMe('spec')); });
  root.querySelectorAll('[data-in]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbySet(b.dataset.in, 'in')));
  root.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbyGuestRm(b.dataset.rm)));
  root.querySelectorAll('[data-addguest]').forEach(b => b.onclick = () => addGuestAsk());
  root.querySelectorAll('.lb-nm').forEach(el2 => el2.onclick = () => {
    const m = M.find(x => x.key === el2.dataset.pk); if (!m) return;
    window.api.openProfile(m.guest ? { name: m.name } : { puuid: m.key, name: m.name });
  });

  // ⑥ 아래 고정 구역 = 이번 판
  el('lb-dock').style.display = login ? '' : 'none';
  const hostNm = L.hostName, noHost = login && !myIsHost && !hostNm;
  { // 방식 버튼(방장 · 시작 버튼 왼쪽) + 고르는 창(버튼 위로 열림)
    const chipB = el('lb-mchip'), pop = el('lb-mpop');
    if (!myIsHost) _mpop = false;
    chipB.innerHTML = (normal ? `<i>🎮</i><span><span class="mk">일반 · </span>${nq === 450 ? '칼바람' : '아수라장'}</span>` : `<i>⚔</i><span><span class="mk">내전 · </span>${MODE_KO[L.mode] || '랜덤'}</span>`) + '<em>▾</em>';
    chipB.className = 'lb-mchip host' + (_mpop ? ' open' : '');
    chipB.title = '이번 판 방식 바꾸기 — 내전(랜덤·밸런스·드래프트·직접) / 일반(아수라장·칼바람)';
    chipB.onclick = e => { e.stopPropagation(); if (!myIsHost) return; _mpop = !_mpop; pop.style.display = _mpop ? '' : 'none'; chipB.classList.toggle('open', _mpop); };
    pop.style.display = _mpop ? '' : 'none';
    pop.querySelectorAll('.lb-kind').forEach(b => {
      const on = (b.dataset.kind === 'normal') === normal; b.classList.toggle('on', on);
      b.onclick = () => { if (myIsHost && !on) lbAct(() => window.api.lobbyMode(b.dataset.kind)); };   // 내전 = main이 마지막에 고른 방식으로 · 창은 열어 둠(이어서 팀 짜기·큐 고르게)
    });
    el('lb-sub').style.display = normal ? 'none' : '';
    el('lb-nq').style.display = normal ? '' : 'none';
    pop.querySelectorAll('.lb-seg').forEach(b => {
      b.classList.toggle('on', b.dataset.mode === L.mode);
      b.onclick = () => { if (!myIsHost) return; _mpop = false; pop.style.display = 'none'; chipB.classList.remove('open'); if (b.dataset.mode !== L.mode) lbAct(() => window.api.lobbyMode(b.dataset.mode)); };
    });
    pop.querySelectorAll('.lb-qb').forEach(b => { const q = Number(b.dataset.q); b.classList.toggle('on', q === nq); b.onclick = () => { if (q !== nq) window.api.lolNormalQ(q); }; });
    el('lb-mdesc').textContent = MODE_DESC[normal ? 'normal' : MODE_KO[L.mode] ? L.mode : 'random'];
  }
  { // 🎮 롤 초대 수락 = 방장 아님 · 방장 초대가 왔는데 자동 수락을 꺼 둔 사람만
    const box = el('lb-lol');
    const h = G.invite && !myIsHost ? `<span class="lb-lol-t"><b>👑 ${esc(G.invite.from)}</b>님이 롤 ${normal ? '파티' : '방'}에 초대했어요</span><button class="lb-mini" data-lol="accept">수락</button>` : '';
    box.style.display = h ? '' : 'none';
    if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
    box.querySelectorAll('[data-lol]').forEach(b => b.onclick = async () => {
      if (b.disabled) return; b.disabled = true;
      try { const r = await window.api.lolAccept(); if (!r || !r.ok) tnAlert((r && r.err) || '수락하지 못했어요'); } finally { b.disabled = false; }
    });
  }
  const capsOk = !draft || capN === 2, sideOk = !manual || (!sNone.length && sA.length && sB.length);
  const myParty = !!(P && P.leader && P.q === nq);
  const qState = !normal ? null : GAME_PHASES.includes(G.phase) ? 'game' : G.phase === 'Matchmaking' && P && P.leader ? 'search' : myParty && G.phase === 'Lobby' ? 'party' : 'none';
  { // 방장 안내 한 줄 — 지금 모자란 것·알아 둘 것 하나 + 그 일을 하는 작은 버튼(없으면 줄 자체가 없음)
    const cb = el('lb-caps'); let h = '';
    if (myIsHost) {
      if (normal) {
        if (qState === 'party') h = `<span class="lb-hint"><b>롤 파티 ${P.n}/${P.max || 5}명</b> · 다 들어오면 큐를 시작해요</span><button id="lb-reinv" class="lb-mini">다시 초대</button>`;
        else if (qState === 'none' && n > 5) h = '<span class="lb-hint">롤 파티는 <b>5명까지</b>예요 · 앞에 앉은 5명만 초대해요</span>';
      } else if (n < 2) h = '<span class="lb-hint">친구가 앱을 켜고 <b>방 목록에서 이 방에 들어오면</b> 자리에 앉아요</span>';
      else if (draft) {
        const picks = Math.max(0, (ts - 1) * 2), ord = [];
        for (let i = 0; i < picks; i++) ord.push(((i + 1) >> 1) % 2 === 0 ? 'teamA' : 'teamB');   // main draftOrder와 같은 스네이크
        h = (capN < 2 ? `<span class="lb-hint"><b>팀장 ${capN}/2</b> · 자리의 「팀장」을 눌러 정해요</span>`
          : '<span class="lb-cap ok"><em>팀장</em><b class="num">2/2</b></span>' + (picks ? `<span class="lb-ordmini" title="뽑는 순서 · 선 = 동전으로 정해지는 선픽 팀 · 후 = 다른 팀">${orderBar(ord, 0, true)}</span>` : '<span class="lb-hint"></span>'))
          + '<button id="lb-caprand" class="lb-mini" title="참가한 사람 중 무작위로 팀장 둘">랜덤 팀장</button>';
      } else if (manual) h = `<span class="lb-cap t1"><em>1팀</em><b class="num">${sA.length}</b></span><span class="lb-cap t2"><em>2팀</em><b class="num">${sB.length}</b></span>`
        + (sNone.length ? `<span class="lb-cap"><em>미정</em><b class="num">${sNone.length}</b></span>` : '') + '<span class="lb-hint"></span>'
        + '<button id="lb-sprev" class="lb-mini" title="지난 판과 같은 1팀·2팀으로">지난 판 그대로</button>' + (sA.length + sB.length ? '<button id="lb-sclr" class="lb-mini plain">비우기</button>' : '');
      else if (left > 0) h = `<span class="lb-hint">${n}명 → <b>${ts} : ${ts}</b> · 남는 ${left}명은 관전이에요</span>`;
    }
    cb.style.display = h ? '' : 'none';
    if (cb.dataset.h !== h) { cb.innerHTML = h; cb.dataset.h = h; }
    const cr = el('lb-caprand'); if (cr) cr.onclick = () => lbAct(() => window.api.lobbyCaptain(null, true));
    const sp = el('lb-sprev'); if (sp) sp.onclick = () => lbAct(() => window.api.lobbySidesPrev());
    const sc = el('lb-sclr'); if (sc) sc.onclick = () => lbAct(() => window.api.lobbySidesClear());
    const rb = el('lb-reinv'); if (rb) rb.onclick = async () => { if (rb.disabled) return; rb.disabled = true; rb.textContent = '초대 중…'; try { const r = await lolPartyGo(); rb.textContent = r && r.ok ? (r.total ? `${r.invited}명 초대함` : '초대할 사람 없음') : '다시 초대'; setTimeout(() => { rb.textContent = '다시 초대'; }, 2500); } finally { rb.disabled = false; } };
  }
  { // 방장 = [방식 ▾][시작] — 시작 버튼 글 = 누르면 일어날 일(못 누르면 모자란 것)
    el('lb-gobar').style.display = myIsHost ? '' : 'none';
    const go = el('lb-start');
    go.dataset.q = normal && L.lol ? qState : '';   // 🎮 일반판: none 파티 만들고 초대 → party 큐 시작 → search 취소 → game
    go.disabled = normal ? !go.dataset.q || qState === 'game' : n < 2 || !capsOk || !sideOk;
    go.classList.toggle('normal', normal && (!go.dataset.q || qState === 'game'));
    go.classList.toggle('qcancel', qState === 'search' && !!go.dataset.q);
    go.textContent = normal ? (!go.dataset.q ? '일반판 진행 중' : qState === 'game' ? '게임 진행 중' : qState === 'search' ? '큐 잡는 중 · 취소' : qState === 'party' ? `큐 시작 · ${P.n}/${P.max || 5}` : '파티 만들고 초대')
      : n < 2 ? '2명부터 시작' : !capsOk ? '팀장 2명 필요'
      : manual ? (sNone.length ? `팀 미정 ${sNone.length}명` : !sideOk ? '두 팀에 1명 이상' : `시작 · ${sA.length} : ${sB.length}`)
      : draft ? '드래프트 시작' : `팀 짜기 · ${ts} : ${ts}`;
    go.title = go.disabled ? '' : normal ? '' : draft ? '동전으로 선픽을 정하고 팀장이 번갈아 뽑아요' : manual ? '이 팀으로 확정해요' : `${MODE_DESC[L.mode] || MODE_DESC.random} · 팀이 정해지면 롤 방을 만들고 모두 초대해요`;
  }
  { // 팀원 = 지금 방식 · 방장 · 무엇을 기다리는지 / 방장 없음 = 방장 하기
    const st = el('lb-stat'); let h = '';
    if (noHost) h = `<div class="lb-stat-tx"><b>${L.hostStale ? `방장 ${esc(L.hostStale)}님이 1분 넘게 응답이 없어요` : '아직 방장이 없어요'}</b><small>방장이 방식을 고르고 팀을 짜요 · 경기 기록·투표 마감도 방장 앱이 해요</small></div>`
      + `<button id="lb-hc-go" class="ui-btn-gold lb-hc-go">👑 ${L.hostStale ? '방장 이어받기' : '방장 하기'}</button>`;
    else if (login && !myIsHost) {
      const sub = me && me.st === 'spec' ? '관전 중이에요 · 「다시 참가하기」를 누르면 자리에 앉아요'
        : normal ? (qState === 'game' ? '게임 진행 중이에요' : G.phase === 'Matchmaking' ? '큐를 잡는 중이에요' : P ? `롤 파티 ${P.n}/${P.max || 5}명 · 방장이 큐를 시작해요` : '방장이 초대하면 자동으로 롤 파티에 들어가요')
        : manual ? '방장이 1팀·2팀을 직접 정하고 있어요'
        : `방장이 시작하면 ${MODE_WAIT[L.mode] || MODE_WAIT.random}`;
      h = `<div class="lb-stat-tx"><span class="lb-stat-top"><b class="lb-stat-m">${normal ? `<i>🎮</i>일반 · ${QN}` : `<i>⚔</i>내전 · ${MODE_KO[L.mode] || '랜덤'}`}</b><span class="lb-stat-h" title="방장">👑 ${esc(hostNm)}</span></span><small>${sub}</small></div>`;
    }
    st.style.display = h ? '' : 'none';
    st.className = 'lb-stat' + (noHost ? ' cta' : '');
    if (st.dataset.h !== h) { st.innerHTML = h; st.dataset.h = h; }
    const hc = el('lb-hc-go'); if (hc) hc.onclick = () => lbAct(() => window.api.setHost(true));
  }

  // ⑦ 오늘 순위(짧게)
  loadToday();
  const t = el('lb-today');
  if (!login || !_today || !_today.standings.length) { t.innerHTML = ''; t.style.display = 'none'; return; }
  t.style.display = '';
  t.innerHTML = `<div class="lb-sec"><span class="lb-sec-en">TODAY</span><span>오늘 순위 · <span class="num">${_today.matches.length}</span>판</span></div><div class="wi-rk">` + _today.standings.slice(0, 5).map(p =>
    `<div class="wi-rk-row${nn(p.name) === nn(myName) ? ' me' : ''}"><span class="wi-rk-r num">${p.rank}</span><span class="wi-rk-nm">${esc(p.name)}</span><span class="wi-rk-lp"><span class="num">${p.wins}</span>승 <span class="num">${p.losses}</span>패</span></div>`).join('') + '</div>';
}
el('lb-start').onclick = () => {
  const q = el('lb-start').dataset.q;   // 🎮 일반판 큰 버튼
  if (q === 'none') return lbAct(() => lolPartyGo().then(() => null));
  if (q === 'party') return lbAct(() => window.api.lolQueue(true));
  if (q === 'search') return lbAct(() => window.api.lolQueue(false));
  if (q) return;
  lbAct(() => window.api.lobbyStart());
};
// 👀 v0.1.150 방장이 관전 = 롤은 관전한 판의 리플레이를 안 남겨 방장 PC가 팟지 영상을 못 찍음 → 방장에게만 미리 안내 + 경기에 나가는 사람에게 넘기기
const HSPEC_ASK = '방장이 관전하면 이번 판 팟지 영상을 찍을 수 없습니다.\n롤은 관전한 판의 리플레이를 남기지 않습니다.\n\n경기에 나가는 사람에게 방장을 넘기면 그 사람 PC가 찍습니다.\n그래도 관전으로 바꿀까요?';
function hostSpecNote(box, on, names, inLobby) {
  box.style.display = on ? '' : 'none';
  if (!on) { box.innerHTML = ''; delete box.dataset.sig; return; }
  const M = (lobbyData && lobbyData.members) || [], want = new Set(names.map(nn));
  const cand = M.filter(m => m.online && !m.guest && !m.me && want.has(nn(m.name)));
  const sig = (inLobby ? 'L' : 'T') + cand.map(m => m.key).join(',');
  if (box.dataset.sig === sig) return;   // 같은 내용이면 다시 안 그림
  box.dataset.sig = sig;
  box.innerHTML = `<span><b>방장이 관전하면 이번 판 팟지 영상을 찍을 수 없습니다</b></span>
    <small>롤은 관전한 판의 리플레이를 남기지 않습니다. 경기에 나가는 사람에게 방장을 넘기면 그 사람 PC가 찍습니다.</small>
    <div class="hs-row">${cand.length ? '<span class="hs-lb">방장 넘기기</span>' + cand.map(m => `<button class="hs-pick" data-hs="${esc(m.key)}" title="${esc(m.name)}님에게 방장 넘기기">${avatar(m, 'chip-av')}<span>${esc(m.name)}</span></button>`).join('') : '<span class="hs-none">방장을 넘길 사람(앱 켠 참가자)이 없습니다</span>'}</div>`;
  box.querySelectorAll('[data-hs]').forEach(b => b.onclick = async () => {
    const m = cand.find(x => x.key === b.dataset.hs); if (!m) return;
    if (!await tnConfirm(`${m.name}님에게 방장을 넘길까요?\n이번 판 팟지는 ${m.name}님 PC가 찍습니다.`)) return;
    lbAct(() => window.api.handHost(m.key));
  });
}
// 👑 v0.1.151 방장이 나에게 넘어옴(자동으로 이어받음 · 넘겨받음) → 창 맨 위 금색 줄 · 이전 방장이 방에 돌아와 있으면 「돌려주기」
let _hostNote = null;
window.api.onHostNotice(d => { _hostNote = d || null; renderHostNote(); });
window.api.getHostNotice().then(d => { _hostNote = d || null; renderHostNote(); }).catch(() => {});
function renderHostNote() {
  const box = el('hn'), n = myIsHost ? _hostNote : null;
  box.style.display = n ? '' : 'none';
  if (!n) { box.innerHTML = ''; delete box.dataset.sig; return; }
  const M = (lobbyData && lobbyData.members) || [];
  const back = n.fromKey ? M.find(m => m.key === n.fromKey && m.online && !m.me) : null;
  const sig = JSON.stringify([n.at, !!back]);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  const who = n.from ? `<b>${esc(n.from)}</b>님` : '방장';
  box.innerHTML = `<span class="hn-crown" aria-hidden="true">👑</span><div class="hn-tx"><b class="hn-h">이제 내가 방장입니다</b>`
    + `<small>${n.why === 'hand' ? `${who}이 방장을 넘겨줬습니다` : `${who}이 방을 나가서 자동으로 넘어왔습니다`}${n.from && n.why !== 'hand' && !back ? ' · 다시 들어오면 돌려줄 수 있습니다' : ''}</small></div>`
    + '<span class="hn-btns">' + (back ? `<button class="lb-mini hn-back" id="hn-back" title="${esc(back.name)}님에게 방장 넘기기">돌려주기</button>` : '')
    + '<button class="lb-mini hn-ok" id="hn-ok">확인</button></span>';
  el('hn-ok').onclick = () => { _hostNote = null; renderHostNote(); window.api.hostNoticeOk(); };
  const b = el('hn-back'); if (b) b.onclick = () => lbAct(() => window.api.handHost(back.key));
}
// 🧱 v0.1.195 방 메뉴(방 이름 ▾) — 방장: 넘겨주기(접속 중인 사람)·그만하기·앱 없는 사람 추가 · 모두: 나가기 (예전 「👑 내가 방장 ▾」 메뉴 + 「나가기」 버튼 + 손님 추가 입력칸을 한곳에)
let _rmenu = false;
function closeRoomMenu() { _rmenu = false; const m = el('lb-hostmenu'); if (m) m.style.display = 'none'; const b = el('lb-rbtn'); if (b) b.classList.remove('open'); }
function toggleRoomMenu(L) { if (_rmenu) { closeRoomMenu(); return; } _rmenu = true; const b = el('lb-rbtn'); if (b) b.classList.add('open'); fillRoomMenu(L); }
function fillRoomMenu(L) {
  const m = el('lb-hostmenu');
  const others = (L.members || []).filter(x => x.online && !x.guest && !x.me);
  const hn = L.hostName;
  m.innerHTML = (myIsHost
    ? '<div class="lb-hm-hd">👑 방장 넘겨주기</div>'
      + (others.length ? others.map(o => `<button class="lb-hm-item" data-p="${esc(o.key)}">${avatar(o, 'chip-av')}<span>${esc(o.name)}</span></button>`).join('') : '<div class="lb-hm-empty">앱을 켠 다른 사람이 없어요</div>')
      + '<button class="lb-hm-item" id="lb-hm-guest"><span>＋ 앱 없는 사람 추가</span></button>'
      + '<button class="lb-hm-item stop" id="lb-hm-stop"><span>방장 그만하기</span></button>'
    : `<div class="lb-hm-hd">${hn ? `👑 방장 <b>${esc(hn)}</b>` : '방장 없음'}</div>`)
    + (L.room ? '<button class="lb-hm-item leave" id="lb-hm-leave"><span>방에서 나가기</span></button>' : '');
  m.style.display = '';
  m.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
    const o = others.find(x => x.key === b.dataset.p); if (!o) return;
    closeRoomMenu();
    if (!await tnConfirm(`${o.name}님에게 방장을 넘길까요?\n진행 중인 판은 그대로 이어져요.`)) return;
    lbAct(() => window.api.handHost(o.key));
  });
  const st = el('lb-hm-stop'); if (st) st.onclick = () => { closeRoomMenu(); lbAct(() => window.api.setHost(false)); };
  const gs = el('lb-hm-guest'); if (gs) gs.onclick = () => { closeRoomMenu(); addGuestAsk(); };
  const lv = el('lb-hm-leave'); if (lv) lv.onclick = async () => { closeRoomMenu(); if (myIsHost && !(await tnConfirm('방에서 나갈까요?\n방장은 방에 남은 사람에게 넘어가요.', { ok: '나가기' }))) return; lbAct(() => window.api.roomLeave()); };
}
document.addEventListener('mousedown', e => { if (_rmenu && !(e.target.closest && e.target.closest('#lb-hostmenu, #lb-rbtn'))) closeRoomMenu(); });
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
  try { renderHostNote(); } catch (_) {}   // 👑 방장 넘어옴 줄(이전 방장 돌아오면 「돌려주기」)
  if (roomData && roomData.full) { renderFull(); showView('rooms'); el('phase').textContent = '자리 없음'; return; }   // 🚦 서버 자리 꽉 참
  const s = sessionData, ph = s && s.phase;
  if (ph === 'draft' && !inGame) { maybePick(s); loadToday(); renderDraft(); updateDraftTimer(); showView('draft'); el('phase').textContent = '드래프트'; maybeCoin(s); return; }   // 픽 먼저(뽑힌 칸을 연출 끝까지 비워둠)
  if (ph === 'vote' && hasTeams() && s.game) {
    const sig = s.game.id;
    if (sig !== _voteSig) { _voteSig = sig; _pendMvp = _pendManner = null; }
    renderVote(); showView('vote'); el('phase').textContent = '투표'; return;
  }
  if (ph === 'result' && hasTeams() && s.game && !resultSeen()) { loadToday(); renderResult(); showView('result'); el('phase').textContent = '결과'; return; }
  if (recData && !inGame && ph === 'teams') { renderRec(); showView('rec'); el('phase').textContent = '기록 저장 중'; return; }
  if (!inGame && ph === 'teams' && hasTeams()) { loadToday(); renderTeam(); showView('team'); el('phase').textContent = _gamePlayed ? '결과 대기' : '팀 배정'; if (sessionData.mode === 'draft') maybePick(sessionData); return; }   // 마지막 픽은 바로 팀 화면이 되므로 여기서도
  if (inGame || roster.length) { renderRoster(); showView('roster'); el('phase').textContent = '게임 중'; return; }
  if (myName && roomData && !roomData.room) { renderRooms(); showView('rooms'); el('phase').textContent = '방 목록'; return; }   // 🚪 방에 들어가기 전
  renderLobby(); showView('lobby'); el('phase').textContent = myName ? '대기실' : '시작하기';   // 롤 로그인 전 = 시작하는 법(v0.1.196)
}
// 🩹 v0.1.28: 켤 때 내 이름·판 상태를 직접 받아옴 — 롤이 이미 켜져 있으면 계정이 창 로딩 중(듣기 전)에 잡혀 이름 알림을 놓치고,
// 같은 내용은 다시 안 보내서(broadcast 중복 차단) 이름이 끝까지 비어 「관전할게요」 버튼·안내가 사라지던 버그(특정 사람만 = 롤 먼저 켠 사람·느린 PC)
window.api.getPlayers().then(d => { if (d) applySession({ session: d.session, myName: d.myName, isHost: d.isHost }); }).catch(() => {});
window.api.getLobby().then(d => { if (d) { lobbyData = d; myIsHost = !!d.isHost; render(); } }).catch(() => {});
window.api.getRooms().then(d => { if (d) applyRooms(d); }).catch(() => {});
render();

// 🔄 업데이트 상태(내 안내 줄 「새 버전 받기 / 받는 중 n% / 지금 업데이트」)
let _upd = null;
window.api.getUpdate().then(u => { _upd = u; if (lobbyData) render(); }).catch(() => {});
window.api.onUpdate(u => { _upd = u; if (lobbyData) render(); });
