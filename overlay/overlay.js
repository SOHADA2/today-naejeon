// ── 투데이 내전 · 왼쪽 오버레이 ───────────────────────────────────────────
// 뷰: 🚪 대기실(모두 같이 봄) · 드래프트 · 팀 배정(phase teams) · 투표(phase vote) · 결과(phase result) · 게임 중 명단
// 데이터 = 메인이 IPC로: session(today/session) · lobby(대기실 {members, mode, captains, hostName, isHost}) · players(인게임 명단) · state(게임 여부)
const nn = s => String(s || '').trim().replace(/\s+/g, ' ');           // normName(공백 1칸)
const fbKeyOf = name => nn(name).replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_');
const el = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let sessionData = null, myName = '', roster = [], inGame = false, myIsHost = false, lobbyData = null, _start = null;
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
  document.body.classList.toggle('in-lobby', v === 'lobby');   // 짧은 창(높이 600 이하)에서 대기실일 때만 맨 아래 안내 줄을 접음(overlay.css · 채팅 줄 자리)
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
  let r = await fn().catch(e => ({ ok: false, err: String(e && e.message || e) }));
  if (r && r.needPub) {   // 🔒 v0.1.253 기록 공개 동의 → 동의하면 그대로 이어서
    if (!(await window.tnPubAsk())) { rmErr('기록 공개에 동의하면 내전에 참가할 수 있습니다'); return r; }
    const w = await window.api.pubSet(true).catch(() => null);
    if (!w || !w.ok) { rmErr('동의를 저장하지 못했습니다 · 잠시 뒤 다시 눌러 주세요'); return r; }
    r = await fn().catch(e => ({ ok: false, err: String(e && e.message || e) }));
  }
  if (r && !r.ok) { if (r.needPw) return r; rmErr(r.err || '잠깐 문제가 생겼습니다'); }
  return r;
}
function rmForm(open) {
  el('rm-form').style.display = open ? '' : 'none';
  document.body.classList.toggle('rm-forming', !!open);   // v0.1.227 만드는 칸이 열려 있는 동안 빈 화면의 같은 버튼은 숨김
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
if (window.api.onRoomPick) window.api.onRoomPick(id => { if (id === '+new') { if (myName && roomData && !roomData.room) rmForm(true); } else if (id) rmJoin(id); });
// 🚫 v0.1.244 운영 정지 안내(사유 · 풀리는 시각) — 방 목록 자리에
const banWhen = B => { if (B.perm) return '기간 없이 정지되었습니다'; const d = new Date(B.until); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}에 풀립니다`; };
function renderBan() {
  const B = roomData.ban;
  el('rm-new').style.display = 'none'; rmForm(false); rmErr('');
  const sig = 'ban:' + B.until + B.reason;
  if (sig === _rmSig) return;
  _rmSig = sig;
  el('rm-list').innerHTML = `<div class="rm-empty rm-ban"><span class="rm-ban-en">SUSPENDED</span><b class="rm-full-t">이용이 정지되었습니다</b>${B.reason ? `<span class="rm-ban-why">사유 · ${esc(B.reason)}</span>` : ''}<span>${banWhen(B)}</span><small>기록 보기·증강 가이드는 그대로 쓸 수 있습니다</small></div>`;
}
function renderFull() {   // 🚦 v0.1.96: 자리 꽉 참(무료 서버 동시 연결 한도) — 실시간 연결 안 열고 기다림 · 자리 나면 앱이 알아서 들어감
  const F = roomData.full;
  el('rm-new').style.display = 'none'; rmForm(false); rmErr('');
  const sig = 'full:' + F.cap;
  if (sig === _rmSig) return;
  _rmSig = sig;
  el('rm-list').innerHTML = `<div class="rm-empty"><b class="rm-full-t">지금은 자리가 꽉 찼습니다</b><span>무료 서버라 한 번에 ${F.cap}명까지 쓸 수 있습니다<br>누가 나가면 자동으로 들어갑니다</span><span class="lb-wait">자리 확인 중</span></div>`;
}
// 🏘️ v0.1.258 커뮤니티 — 방 목록 머리 「ROOMS · 큐」 · 새로 설치한 사람은 맨 위에 한 번 고르기(초대 코드 / 기본으로 시작)
function commHead(C) { const e = el('rm-comm'); if (e) { e.textContent = C && C.name ? ' · ' + C.name : ''; e.title = C && C.name ? `지금 커뮤니티 · ${C.name}(⚙ 설정에서 바꿈)` : ''; } }
function commCard() {
  const list = el('rm-list'); if (!list || list.querySelector('.rm-cm')) return;
  list.insertAdjacentHTML('afterbegin', '<div class="rm-cm"><span class="rm-pub-en">COMMUNITY</span><b>어느 커뮤니티에서 내전하나요?</b>'
    + '<span>운영진에게 받은 초대 코드를 넣으면 그 커뮤니티의 방·기록·순위만 보입니다</span>'
    + '<div class="rm-cm-row"><input id="rm-cm-in" class="rm-in" maxlength="12" placeholder="초대 코드" autocomplete="off" spellcheck="false"><button class="ui-btn-gold" id="rm-cm-go">들어가기</button></div>'
    + '<button class="rm-cm-skip" id="rm-cm-skip">초대 코드 없이 시작</button></div>');
  const go = async code => { const b = el('rm-cm-go'); if (b) b.disabled = true; const r = await window.api.communityJoin(code).catch(() => null); if (b) b.disabled = false;
    if (!r || !r.ok) { rmErr((r && r.err) || '잠깐 문제가 생겼습니다'); return; } rmErr(r.restart ? `${r.community ? r.community.name : '기본'} 커뮤니티로 다시 켜는 중입니다` : ''); };
  el('rm-cm-go').onclick = () => go(el('rm-cm-in').value);
  el('rm-cm-in').addEventListener('keydown', e => { if (e.key === 'Enter') go(el('rm-cm-in').value); });
  el('rm-cm-skip').onclick = () => go('');
}
function pubCard() {   // 🔒 v0.1.253 내전 기록 공개 동의 안 함 = 보기만 · 방 목록 맨 위 카드
  const list = el('rm-list'); if (!list || list.querySelector('.rm-pub')) return;
  list.insertAdjacentHTML('afterbegin', '<div class="rm-pub"><span class="rm-pub-en">RECORD SHARING</span><b>내전 기록 공개 동의가 필요합니다</b>'
    + '<span>동의하면 내전 전적이 앱을 쓰는 다른 사람에게 보이고 내전에 참가할 수 있습니다 · 지금은 보기만</span><button class="ui-btn-gold" id="rm-pubgo">동의하고 참가하기</button></div>');
  el('rm-pubgo').onclick = async () => { if (await window.tnPubAsk()) { const w = await window.api.pubSet(true).catch(() => null); if (!w || !w.ok) rmErr('동의를 저장하지 못했습니다 · 잠시 뒤 다시 눌러 주세요'); } };
}
function renderRooms() {
  const D = roomData || { rooms: [] }, R = D.rooms || [];
  el('rm-new').style.display = myName && R.length ? '' : 'none';
  const needPub = !!(myName && D.pub && D.pub.need), C = D.comm || null;
  commHead(C);
  const sig = JSON.stringify([myName, R, _pwFor, D.ready, D.slow, needPub, C]);
  if (sig === _rmSig) return;   // 같은 내용이면 다시 안 그림(입력 중인 비밀번호가 지워지지 않게)
  _rmSig = sig;
  const list = el('rm-list');
  if (needPub) setTimeout(pubCard, 0);   // 🔒 v0.1.253 목록 맨 위 동의 카드(아래 그리기가 끝난 뒤)
  if (C && C.ask) setTimeout(commCard, 0);   // 🏘️ v0.1.258 새로 설치 = 커뮤니티 고르기(동의 카드보다 위)
  if (!myName) { list.innerHTML = '<div class="rm-empty"><span class="lb-wait">롤 클라이언트에 로그인하면 방에 들어갈 수 있습니다</span></div>'; return; }
  if (!R.length) {
    list.innerHTML = D.ready === false ? (D.slow ? '<div class="rm-empty"><b class="rm-empty-t">서버에 연결하지 못했습니다</b><span>인터넷 연결을 확인해 주세요<br>연결되면 자동으로 이어집니다</span></div>' : '<div class="rm-empty">방 목록을 불러오는 중입니다</div>')
      : '<div class="rm-empty"><b class="rm-empty-t">아직 만들어진 방이 없습니다</b><span>방을 만들면 친구들 앱의 방 목록에 떠요<br>만든 사람이 방장입니다</span><button id="rm-new2" class="ui-btn-gold">＋ 방 만들기</button></div>';   // v0.1.196 처음 온 사람: 방을 만들면 어떻게 되는지 한 줄
    const b = el('rm-new2'); if (b) b.onclick = () => rmForm(true);
    return;
  }
  list.innerHTML = R.map(r => `<div class="rm-card${r.mine ? ' mine' : ''}"><div class="rm-row" data-rid="${esc(r.id)}">`
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
// 🏆 v0.1.288 시리즈·팀 이름 — session.series {bo, need, names, wins, n, done} (main newSeries)
const TN = (s, t) => (s && s.series && s.series.names && s.series.names[t]) || (t === 'teamA' ? '1팀' : '2팀');
const BO_KO = bo => bo === 5 ? '5판 3선승' : bo === 3 ? '3판 2선승' : '';
function serBar(box, s, after) {   // 팀·결과 화면 위 점수 띠 · after = 판이 기록된 뒤(결과 화면 = 이번 판 포함 · 팀 화면 = 다음 판 번호)
  const S = s && s.series; box = el(box); if (!box) return;
  if (!S || !(S.bo > 1)) { box.style.display = 'none'; return; }
  const w = S.wins || {}, a = w.teamA || 0, b = w.teamB || 0;
  const head = S.done ? 'SERIES' : `${BO_KO(S.bo)} · ${after ? (S.n || 0) : (S.n || 0) + 1}번째 판`;
  box.className = 'tv-ser' + (S.done ? ' done' : '');
  box.style.display = '';
  box.innerHTML = `<span class="ts-bo">${head}</span><span class="ts-sc"><b class="ts-n t1">${esc(TN(s, 'teamA'))}</b><span class="ts-w">${a} : ${b}</span><b class="ts-n t2">${esc(TN(s, 'teamB'))}</b></span>`
    + (S.done ? `<span class="ts-win">🏆 ${esc(TN(s, S.done))} 시리즈 승리</span>` : '');
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
  band.innerHTML = mt === 1 ? `<span class="tv-lead">내가 들어갈 팀</span><b class="tv-team">${esc(TN(s, 'teamA'))} <span class="lb-sec-en">BLUE</span></b>`
    : mt === 2 ? `<span class="tv-lead">내가 들어갈 팀</span><b class="tv-team">${esc(TN(s, 'teamB'))} <span class="lb-sec-en">RED</span></b>`
    : (s.spectators || []).some(x => nn(x) === nn(myName)) ? '이번 판은 <b>관전</b>입니다' : '이번 판 팀 배정';
  el('team1').className = 'ta-team blue' + (mt === 1 ? ' mine' : mt === 2 ? ' dim' : '');
  el('team2').className = 'ta-team red' + (mt === 2 ? ' mine' : mt === 1 ? ' dim' : '');
  serBar('tv-ser', s, false); el('t1-label').textContent = TN(s, 'teamA'); el('t2-label').textContent = TN(s, 'teamB');   // 🏆 v0.1.288
  el('t1-count').textContent = A.length + '명';
  el('t2-count').textContent = B.length + '명';
  el('t1-players').innerHTML = A.map(playerRow).join('');
  el('t2-players').innerHTML = B.map(playerRow).join('');
  { // 🎮 v0.1.188 이번 판 다리(팀 정할 때 정함 · 드래프트 = 후픽 팀장이 고름) — 방장이 롤 로비(사용자 설정 게임)에 있으면 이 다리로 방을 다시 만들어 초대
    const srG = s.lolGame === 'sr', m = srG ? '소환사의 협곡' : s.lolMap && LOL_MAP_KO[s.lolMap], b = el('tv-map');   // 🗺️ v0.1.232 협곡 = 맵 + 픽 방식
    b.style.display = m && s.mode !== 'normal' ? '' : 'none';
    if (m && srG) b.innerHTML = `<span class="tv-map-h">🗺 이번 판 맵</span><b>${m}</b><small>${SR_PICK_KO[s.srPick] || SR_PICK_KO[3130]}</small>`;
    else if (m) b.innerHTML = `<span class="tv-map-h">🗺 이번 판 다리</span><b>${m}</b><small>${s.lolMapBy ? esc(s.lolMapBy) + ' 팀장이 고름' : '무작위'}</small>`;
  }
  { // 🎧 v0.1.131 디스코드 음성 채널 나누기 결과(방장 앱이 session.dcMove에 남김) — 못 옮긴 사람과 이유
    const D = s.dcMove, b = el('tv-dc'), on = D && D.at >= (s.teamsFormedAt || 0);
    b.style.display = on ? '' : 'none';
    if (on) b.innerHTML = `<span class="tv-dc-h">${DC_ICO}<em>디스코드</em></span><span class="tv-dc-t">${D.err && !D.n ? (/403|404/.test(D.err) ? '봇이 연결된 서버에 없습니다' : '음성 채널을 못 찾았습니다') : D.n ? `<b class="num">${D.n}</b>명 1팀·2팀 음성 채널로 옮겼습니다` : '아무도 못 옮겼습니다'}</span>`
      + ((D.miss || []).length ? `<small class="tv-dc-miss">${D.miss.map(x => `<span><b>${esc(x.n || '')}</b> ${esc(x.w || '')}</span>`).join('')}</small>` : '');
  }
  { // ⚖️ v0.1.174 밸런스로 짠 팀이면 두 팀 평균 점수(아수라장 티어 점수) · 점수 없는 사람은 50점으로 계산했다고 알림
    const Q = s.mode === 'balance' ? s.bal : null, b = el('tv-bal');
    b.style.display = Q ? '' : 'none';
    if (Q) b.innerHTML = `<span class="tv-bal-h">밸런스</span><span class="tv-bal-s"><em class="t1">1팀 평균 <b class="num">${Number(Q.a).toFixed(1)}</b></em><em class="t2">2팀 평균 <b class="num">${Number(Q.b).toFixed(1)}</b></em></span>`
      + (Q.n - Q.known > 0 ? `<small data-tip="${esc((Q.miss || []).join(', '))}">${Q.sr ? '랭크 티어·협곡 기록 없는' : '점수 없는'} ${Q.n - Q.known}명은 50점으로 계산</small>` : '');
  }
  hostSpecNote(el('tv-hspec'), myIsHost && !mt, [...A, ...B], false);
  const pend = el('tv-pending');
  if (s.pendingEog) { pend.style.display = ''; pend.textContent = '경기가 끝났습니다 · 방장이 승리팀을 확인하는 중'; }
  else if (_gamePlayed) { pend.style.display = ''; pend.textContent = '경기 결과 기록 대기 중…'; }
  else pend.style.display = 'none';
  showCancel('tv-cancel', '팀 배정을 취소하고 모두 대기실로 돌아갈까요?' + (_gamePlayed || s.pendingEog ? '\n⚠️ 방금 끝난 경기 결과가 아직 기록 전입니다 — 취소하면 이 판은 기록되지 않습니다.' : ''));
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

const LOL_MAP_KO = { NONE: '칼바람 나락', MapSkin_Map12_Bloom: '코신 다리', MapSkin_HA_Bilgewater: '도살자의 다리' };   // 🎮 v0.1.188 롤 아수라장 로비 다리(main LOL_MAP_KO와 같게)
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
  { // 🎮 v0.1.188 다리 = 선픽이 아닌 팀장이 고름(사장님) · 방장도 대신 · 다 뽑을 때까지 안 고르면 무작위 · 팀이 정해지면 방장 앱이 이 다리로 롤 로비를 다시 만듦
    const box = el('dr-map'), by = s.mapBy && s.lolGame !== 'sr' ? caps[s.mapBy] : null;   // 🗺️ v0.1.232 협곡 = 다리 없음
    if (!by) box.style.display = 'none';
    else {
      const can = nn(by) === nn(myName) || myIsHost, cur = s.lolMap;
      const h = `<div class="dr-map-h"><span class="dr-map-t">🗺 다리</span><em>${s.mapBy === 'teamA' ? '1팀' : '2팀'} 팀장 <b>${esc(by)}</b>(후픽)이 고릅니다${cur ? '' : ' · 안 고르면 무작위'}</em></div>`
        + `<div class="dr-map-b">${Object.keys(LOL_MAP_KO).map(k => `<button class="dr-mp${cur === k ? ' on' : ''}" data-map="${k}" ${can ? '' : 'disabled'}>${LOL_MAP_KO[k]}</button>`).join('')}</div>`;
      box.style.display = '';
      if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
      box.querySelectorAll('.dr-mp').forEach(b => b.onclick = async () => { if (b.disabled || !can) return; const r = await window.api.draftMap(b.dataset.map); if (!r || !r.ok) tnAlert((r && r.err) || '다리를 못 골랐습니다'); });
    }
  }
  el('dr-a').innerHTML = col('teamA', esc(TN(s, 'teamA')));
  el('dr-b').innerHTML = col('teamB', esc(TN(s, 'teamB')));
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

// ── ⚔ 선픽 줄다리기 — 드래프트가 막 시작됐으면 모두에게 한 번 재생(main FP_MS 동안 픽 잠김) ──────────
// v0.1.230(사장님: 동전 모양이 톤앤매너에 안 맞음 → 동전 말고 다른 방식 → 「대각선 VS에서 서로 줄다리기하듯 밀고 당기다 선공자가 차지하는 느낌」 · 시안 5번째에서 정함)
//   화면이 대각선으로 갈려 왼쪽 = 1팀 팀장(파랑) · 오른쪽 = 2팀 팀장(빨강)이 양옆에서 들어와 맞붙음
//   → 서로 당기고(살짝 물러섰다 → 당김 → 버팀) · 미는 쪽 경계가 팀 색으로 달아오르고 빛줄기가 경계로 몰림 · 경계선이 미는 쪽으로 살짝 기욺 · 위 막대(퍼센트)가 밀고 당김
//   → 버틸수록 화면이 다가오고 가장자리가 어두워짐 → 선픽 팀이 단번에 밀어내 화면을 차지 → 화면 정가운데 제목 카드(금색 선 사이 FIRST PICK)
//   모양: 판 = 깊은 팀 색 + 가는 결 + 큰 팀 숫자 · 경계 = 밝은 심 + 번짐 + 가는 겹선 · VS = 마름모 문장 · 팀장 = 겹테 얼굴 + 이름 + 팀 색 줄 · 위쪽 어두운 띠에 제목·막대
//   사장님이 싫다 한 것(다시 넣지 말 것): 떨리며 바뀌는 점수 숫자 · 불꽃 · 팀장 칸 기울기 · 잦은 흔들림(「경박스럽다」) · 북소리(오케스트라)·카드/클릭 소리(「안 어울림」)
//   움직임 = 시계(ms) 하나로 모든 것을 계산해 그림(paint) — transform·opacity만 바꿈(합성만 · 다시 그리기 없음 · 한 번만 재생)
//   흐름 = 서버의 firstPick + draftStartedAt(seed)로만 정해짐 → 모든 PC가 같은 그림 · 시각(ms)은 소리 파일(tools/firstpick-sfx.py)과 같은 값(바꾸면 두 곳 같이)
//   예전: 동전(v0.1.14~229 · 사미라 3D → 동전만) — coin3d.js·three.js·동전 그림은 v0.1.230에서 지움
const FP_MS = 4700;   // main.js FP_MS와 같게(이 시간 동안 픽 잠김) — 차지 2.7초 + 결과를 읽을 시간
let _fpShown = null;
// 🔊 소리 = 실제 녹음을 미리 섞은 파일 하나(assets/sfx/firstpick.ogg · 합성음 아님): 맞붙을 때 깊은 「쿵」(작게) → 당길 때 바람 「휙」 → 버틸 때 차오름 → 밀어낼 때 깊은 「쿵」 + 맑은 「띵」
//   재료 = 팟지 타격음(사장님 Suno) + 거꾸로 튼 심벌 + ding · 섞는 법 = assets/sfx/CREDITS.txt · tools/firstpick-sfx.py · 크기 = ⚙ 효과음 설정
const _fpSfx = (() => { try { const a = new Audio('../assets/sfx/firstpick.ogg'); a.preload = 'auto'; return a; } catch (_) { return null; } })();
function firstPickSound() { try { if (!_fpSfx) return; _fpSfx.pause(); _fpSfx.currentTime = 0; _fpSfx.volume = 0.3 * VOL(); if (!_fpSfx.volume) return; _fpSfx.play().catch(() => {}); } catch (_) {} }
function maybeFirstPick(s) {
  if (!s || s.phase !== 'draft' || !s.draftStartedAt || !s.firstPick || s.pickIdx) return;
  const key = s.draftStartedAt; if (_fpShown === key) return;
  const age = Date.now() - key;
  _fpShown = key;
  if (age > 1800 || age < -3000) return;   // 늦게 켰으면(이미 지난 연출) 건너뜀
  playFirstPick(s);
}
function playFirstPick(s) {
  const layer = el('fp'), box = el('fp-box'), anims = [];
  layer.style.setProperty('--bar-h', (el('bar') ? el('bar').offsetHeight : 80) + 'px');
  layer.style.display = 'block';
  const go = (kf, opt) => { const a = layer.animate(kf, Object.assign({ fill: 'forwards' }, opt)); anims.push(a); };
  go([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  go([{ opacity: 1 }, { opacity: 0 }], { duration: 350, delay: FP_MS - 350 });
  let stop = null;
  try { stop = playTug(layer, box, s, s.firstPick === 'teamA' ? 1 : 2); } catch (e) { console.error('firstpick', e); }
  setTimeout(() => { layer.style.display = 'none'; anims.forEach(a => { try { a.cancel(); } catch (_) {} }); if (stop) stop(); box.innerHTML = ''; }, FP_MS + 30);
}
const TW = { ENTER: 320, TUG: 460, STRAIN: 1760, SHOVE: 2300, COVER: 2700, RES: 2700 };
// 주고받기 = [시각, 경계 위치(폭의 %, + = 선픽 팀 쪽)] · 마지막 점부터 SHOVE까지 = 버팀(선픽 팀이 조금씩 되찾음)
//   flip(뒤집기) = 마지막 큰 당김이 상대 쪽 → 버티다 선픽 팀이 뒤집음 · hold(밀어붙이기) = 마지막 큰 당김이 선픽 팀 쪽 → 버티다 그대로
const TW_PULLS = {
  flip: [[460, 0], [720, 8], [980, -6], [1240, 12], [1500, -9], [1760, -16]],
  hold: [[460, 0], [720, -8], [980, 6], [1240, -11], [1500, 9], [1760, 15]],
};
const TW_SEG = { PRE: 0.2, SNAP: 0.56 };   // 한 번 당기기 = 앞 20% 살짝 물러섬 · 20~56% 당김(아주 조금 넘침) · 나머지 버팀
function playTug(layer, box, s, W) {   // → 멈추는 함수
  const caps = s.captains || {}, names = [caps.teamA || '', caps.teamB || ''];
  const seed = Number(window.__fpSeed != null ? window.__fpSeed : s.draftStartedAt || 0);
  const mem = n => ((lobbyData && lobbyData.members) || []).find(x => nn(x.name) === nn(n)) || { name: n };
  const blk = t => `<div class="tw-in t${t}"><span class="tw-en">TEAM ${t} · ${t === 1 ? 'BLUE' : 'RED'}</span>${avatar(mem(names[t - 1]), 'tw-av')}<b class="tw-nm" title="${esc(names[t - 1])}">${esc(names[t - 1])}</b><i class="tw-ul"></i><small class="tw-ko">${t}팀 팀장</small></div>`;
  const slab = t => `<div class="tw-s t${t}"><i class="tw-stk"></i><i class="tw-stk"></i><i class="tw-stk"></i></div>`;   // 큰 팀 숫자 = CSS(::before)
  const pulls = TW_PULLS[seed % 2 ? 'hold' : 'flip'].map(([t, d]) => [t, d * (W === 1 ? 1 : -1)]);   // + = 1팀 쪽(경계가 오른쪽으로)
  const surges = [];   // 당길 때마다 = 미는 쪽 빛이 번지고 빛줄기가 경계로 몰림
  for (let i = 1; i < pulls.length; i++) { const [t0, d0] = pulls[i - 1], [t1, d1] = pulls[i]; surges.push({ at: t0 + (t1 - t0) * TW_SEG.PRE, dir: d1 > d0 ? 1 : -1, big: Math.min(1, Math.abs(d1 - d0) / 16) }); }
  box.innerHTML = `<div class="tw"><div class="tw-cam">${slab(1)}${slab(2)}`
    + `<i class="tw-glow t1"></i><i class="tw-glow t2"></i><i class="tw-line"></i><i class="tw-flash"></i>`
    + `${blk(1)}${blk(2)}<span class="tw-vs"><b>VS</b></span></div>`
    + `<i class="tw-vig"></i><i class="tw-top"></i>`
    + `<div class="tw-meter"><span class="tw-pc t1">50%</span><span class="tw-bar"><i class="t1"></i><i class="t2"></i><b></b></span><span class="tw-pc t2">50%</span></div>`
    + `<div class="tw-res t${W}" data-n="${W}"><i class="tw-rl"></i><span class="tw-ren">TEAM ${W} · ${W === 1 ? 'BLUE' : 'RED'}</span>${avatar(mem(names[W - 1]), 'tw-av')}<b class="tw-nm">${esc(names[W - 1])}</b><b class="tw-fp">FIRST PICK</b><small class="tw-sub">${W}팀 선픽 · 팀장이 먼저 고릅니다</small><i class="tw-rl"></i></div></div>`;
  const tw = box.firstChild, $ = c => tw.querySelector(c), $$ = c => [...tw.querySelectorAll(c)];
  const cam = $('.tw-cam'), S = [$('.tw-s.t1'), $('.tw-s.t2')], STK = S.map(e => [...e.querySelectorAll('.tw-stk')]), IN = [$('.tw-in.t1'), $('.tw-in.t2')], GL = [$('.tw-glow.t1'), $('.tw-glow.t2')];
  const line = $('.tw-line'), flash = $('.tw-flash'), vs = $('.tw-vs'), vig = $('.tw-vig'), meter = $('.tw-meter'), PC = $$('.tw-pc'), BF = $$('.tw-bar i'), BK = $('.tw-bar b'), res = $('.tw-res'), head = layer.querySelector('.fp-head');
  const RL = $$('.tw-rl'), R_EN = $('.tw-ren'), R_AV = res.querySelector('.tw-av'), R_NM = res.querySelector('.tw-nm'), R_FP = $('.tw-fp'), R_SUB = $('.tw-sub');
  const ease3 = u => 1 - Math.pow(1 - u, 3), ease5 = u => 1 - Math.pow(1 - u, 5), clamp = v => Math.max(0, Math.min(1, v)), lerp = (a, b, u) => a + (b - a) * u;
  const backOut = u => { const c = 1.15; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };   // 당김 — 아주 조금 넘쳤다 돌아옴
  const jit = ms => Math.sin(ms * 0.107) * 0.5 + Math.sin(ms * 0.161 + 1.3) * 0.32 + Math.sin(ms * 0.229 + 2.1) * 0.18;   // 버틸 때 떨림(시계로만 정해짐)
  let Wd = 0, Ht = 0, A = 0, slabW = 0, inW = [0, 0], inH = [0, 0], barW = 0;
  const measure = () => {
    Wd = tw.clientWidth || 1; Ht = tw.clientHeight || 1; A = Math.atan2(2 * Wd * 0.09, Ht); slabW = Wd * 1.8;
    S.forEach(e => { e.style.width = slabW + 'px'; });
    inW = IN.map(e => e.offsetWidth); inH = IN.map(e => e.offsetHeight); barW = $('.tw-bar').offsetWidth;
  };
  const tension = ms => clamp((ms - TW.TUG) / (TW.SHOVE - TW.TUG));
  const base = ms => {   // 떨림 빼고 경계 위치(%)
    if (ms <= TW.TUG) return 0;
    if (ms < TW.STRAIN) {
      let i = 0; while (i + 1 < pulls.length && pulls[i + 1][0] <= ms) i++;
      const [t0, d0] = pulls[i], [t1, d1] = pulls[Math.min(i + 1, pulls.length - 1)];
      if (t1 === t0) return d1;
      const u = (ms - t0) / (t1 - t0), dd = d1 - d0;
      if (u < TW_SEG.PRE) return d0 - dd * 0.12 * Math.sin(Math.PI / 2 * u / TW_SEG.PRE);                            // 살짝 물러섬(힘 모으기)
      if (u < TW_SEG.SNAP) return lerp(d0 - dd * 0.12, d1, backOut((u - TW_SEG.PRE) / (TW_SEG.SNAP - TW_SEG.PRE)));      // 당김
      return d1;                                                                                                       // 버팀
    }
    const dS = pulls[pulls.length - 1][1], sg = W === 1 ? 1 : -1;
    if (ms < TW.SHOVE) return dS + sg * 4 * ease3((ms - TW.STRAIN) / (TW.SHOVE - TW.STRAIN));   // 버티며 선픽 팀이 조금씩 되찾음
    const u = clamp((ms - TW.SHOVE) / (TW.COVER - TW.SHOVE)), from = dS + sg * 4, back = from - sg * 3, target = sg * (50 + 9 + 52);   // 판의 큰 숫자까지 화면 밖으로
    return u < 0.22 ? lerp(from, back, Math.sin(Math.PI / 2 * u / 0.22)) : lerp(back, target, Math.pow(clamp((u - 0.22) / 0.78), 0.45));   // 한 번 더 모았다 단번에(처음이 가장 빠르게)
  };
  const BLAST = TW.SHOVE + (TW.COVER - TW.SHOVE) * 0.22;
  const paint = ms => {
    if (!Wd) measure();
    const e = ease5(clamp(ms / TW.ENTER)), ten = tension(ms), cov = clamp((ms - TW.SHOVE) / (TW.COVER - TW.SHOVE));
    const trem = ms > TW.STRAIN - 200 && ms < TW.SHOVE + 40 ? jit(ms) * 0.55 * clamp((ms - TW.STRAIN + 200) / 300) : 0;   // 떨림 = 마지막 버틸 때만 · 작게
    const bx = Wd / 2 + (base(ms) + trem) / 100 * Wd;
    const push = Math.max(-1, Math.min(1, (base(ms + 12) - base(ms - 12)) / 24 * 1000 / 60));   // 경계가 움직이는 빠르기(+ = 1팀이 미는 중)
    const ang = A + 0.05 * push * (1 - cov);   // 경계선이 미는 쪽으로 살짝 기욺
    const xL = ms < TW.ENTER ? lerp(-Wd * 0.2, bx, e) : bx, xR = ms < TW.ENTER ? lerp(Wd * 1.2, bx, e) : bx;
    // 화면: 버틸수록 다가옴 · 맞붙음·밀어냄 때만 아주 작게 흔들림
    let shake = 0; const kick = (t, amp, dur) => { const k = ms - t; if (k > 0 && k < dur) shake += amp * Math.exp(-k / (dur / 4)); };
    kick(TW.ENTER, 3, 260); kick(BLAST, 4, 320);
    cam.style.transform = `translate3d(${(Math.sin(ms / 7.3) * shake).toFixed(2)}px,${(Math.cos(ms / 9.1) * shake * 0.6).toFixed(2)}px,0) scale(${(1 + 0.035 * ease3(ten) * (1 - cov)).toFixed(4)})`;
    vig.style.opacity = (0.3 + 0.55 * ten * (1 - cov)).toFixed(3);
    S[0].style.transform = `translate3d(${(xL - slabW).toFixed(2)}px,0,0) skewX(${-ang}rad)`;
    S[1].style.transform = `translate3d(${xR.toFixed(2)}px,0,0) skewX(${-ang}rad)`;
    // 경계선: 밝은 심 + 번짐 · 밀어낼 때 굵어짐
    const lo = clamp((ms - TW.ENTER + 30) / 90) * (1 - clamp((ms - TW.COVER + 120) / 120)), kb = ms - BLAST, sweep = kb > 0 && kb < 400 ? Math.exp(-kb / 130) : 0;
    const rot = `rotate(${ang}rad)`;
    line.style.opacity = lo.toFixed(3); line.style.transform = `translate3d(${bx.toFixed(2)}px,0,0) translate(-50%,-50%) ${rot} scaleX(${(1 + 2.2 * sweep).toFixed(3)})`;
    // 미는 쪽 경계가 팀 색으로 달아오름 + 당길 때 상대 쪽으로 번짐
    const su = [0, 0];
    for (const g of surges) { const k = ms - g.at; if (k > 0 && k < 900) su[g.dir > 0 ? 0 : 1] += g.big * Math.exp(-k / 260); }
    const holdG = 0.2 + 0.4 * ten;
    for (const t of [0, 1]) {
      const p = t === 0 ? Math.max(0, push) : Math.max(0, -push);
      GL[t].style.opacity = (lo * Math.min(1, holdG + p * 0.5 + su[t] * 0.5)).toFixed(3);
      GL[t].style.transform = `translate3d(${(t === 0 ? bx - 220 : bx).toFixed(2)}px,-50%,0) ${rot} scaleX(${(1 + 1.1 * Math.min(1, su[t])).toFixed(3)})`;
    }
    // 빛줄기: 당기는 쪽 판 안에서 경계로 몰려듦(판과 같이 비스듬함)
    for (const t of [0, 1]) for (let i = 0; i < 3; i++) {
      let o = 0, x = 0;
      for (const g of surges) { if ((g.dir > 0 ? 0 : 1) !== t) continue; const u = (ms - g.at - i * 28) / 300; if (u > 0 && u < 1) { o = Math.sin(Math.PI * u) * (0.35 + 0.5 * g.big) * (1 - i * 0.22); x = lerp(150 + i * 46, 10 + i * 30, ease3(u)); } }
      const el = STK[t][i]; el.style.opacity = o.toFixed(3); if (o) el.style.transform = `translate3d(${(t === 0 ? -x : x).toFixed(1)}px,0,0)`;
    }
    const kc = ms - TW.ENTER, clash = kc > 0 && kc < 300 ? Math.exp(-kc / 80) : 0;
    flash.style.opacity = Math.min(1, 0.75 * clash + 0.7 * sweep).toFixed(3); flash.style.transform = `translate3d(${bx.toFixed(2)}px,0,0) translate(-50%,-50%) ${rot} scaleX(${(1 + 1.5 * sweep).toFixed(3)})`;
    // VS 문장(마름모) — 경계 위 · 맞붙을 때 튀어나와 자리 잡고 · 밀어내기 직전 사라짐
    const vp = clamp((ms - TW.ENTER + 40) / 220), vx = bx - (0.54 * Ht - 20 - Ht / 2) * Math.tan(ang);   // 얼굴 높이(이름 줄보다 위)
    vs.style.opacity = (vp * (1 - clamp((ms - TW.SHOVE) / 110))).toFixed(3);
    vs.style.transform = `translate3d(${vx.toFixed(2)}px,0,0) translate(-50%,-50%) rotate(45deg) scale(${(1 + 0.7 * (1 - ease3(vp))).toFixed(3)})`;
    // 팀장 — 보이는 쪽의 가운데 · 미는 쪽만 살짝 앞으로 나오며 커짐 · 밀려나면 사라짐
    const lx = Math.max(0, Math.min(Wd, bx)), cx = [ms < TW.ENTER ? xL / 2 : lx / 2, ms < TW.ENTER ? (xR + Wd) / 2 : (lx + Wd) / 2];
    for (const t of [0, 1]) {
      const sg = t === 0 ? 1 : -1, p = Math.max(-1, Math.min(1, push * sg)), win = t === W - 1;
      const off = sg * 5 * p + (!win ? -sg * 50 * cov * cov : 0), fade = win ? 1 - clamp((ms - TW.COVER + 140) / 140) : 1 - clamp(cov * 1.5);
      IN[t].style.opacity = (Math.max(0, fade) * clamp((ms - 60) / 200)).toFixed(3);
      const fit = Math.max(0.74, Math.min(1, ((t === 0 ? lx : Wd - lx) - 30) / inW[t]));   // 밀려서 자리가 좁아지면 그만큼 작아짐(이름이 경계를 넘지 않게)
      IN[t].style.transform = `translate3d(${(cx[t] - inW[t] / 2 + off).toFixed(2)}px,${(-inH[t] / 2).toFixed(2)}px,0) scale(${(fit * (1 + 0.035 * Math.max(0, p) - 0.02 * Math.max(0, -p))).toFixed(3)})`;
    }
    // 퍼센트 막대 = 경계 위치(떨림 뺀 값 · 왼쪽 = 1팀 몫)
    const f1 = Math.max(0, Math.min(1, 0.5 + (ms < TW.ENTER ? 0 : base(ms)) / 100));
    BF[0].style.transform = `scaleX(${f1.toFixed(4)})`; BF[1].style.transform = `scaleX(${(1 - f1).toFixed(4)})`; BK.style.transform = `translate3d(${(f1 * barW).toFixed(2)}px,0,0) rotate(45deg)`;
    const pct = Math.round(f1 * 100);
    if (PC[0].textContent !== pct + '%') { PC[0].textContent = pct + '%'; PC[1].textContent = (100 - pct) + '%'; }
    meter.style.opacity = (clamp((ms - TW.ENTER) / 240) * (1 - clamp((ms - TW.COVER + 100) / 160))).toFixed(3);
    if (head) head.style.opacity = (1 - clamp((ms - TW.COVER + 100) / 160)).toFixed(3);
    // 결과 = 화면 정가운데 제목 카드: 금색 선이 가운데서 벌어짐 → 팀 표 → 얼굴 → 이름 → FIRST PICK → 한 줄
    const k = ms - TW.RES, on = (a, d) => clamp((k - a) / d);
    res.style.opacity = on(0, 120).toFixed(3);
    RL[0].style.transform = RL[1].style.transform = `scaleX(${ease5(on(0, 420)).toFixed(4)})`;
    const pop = (el, a, d, dy, sc) => { const u = on(a, d), q = ease3(u); el.style.opacity = u.toFixed(3); el.style.transform = `translate3d(0,${(dy * (1 - q)).toFixed(2)}px,0) scale(${(sc + (1 - sc) * q).toFixed(4)})`; };
    pop(R_EN, 60, 240, 6, 1); pop(R_AV, 90, 300, 0, 0.82); pop(R_NM, 150, 260, 8, 1); pop(R_FP, 190, 360, 0, 1.16); pop(R_SUB, 330, 260, 6, 1);
  };
  window.__fpPaint = paint;   // 🎥 캡처·녹화용(시각을 정해 한 장씩 그림 · tools/fp-rec.cjs)
  measure(); paint(0);
  firstPickSound();
  const t0 = performance.now();
  let raf = 0;
  const loop = () => { const ms = window.__fpClock ? window.__fpClock() * 1000 : performance.now() - t0; paint(ms); if (ms < TW.RES + 800) raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  window.addEventListener('resize', measure);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); if (head) head.style.opacity = ''; if (window.__fpPaint === paint) window.__fpPaint = null; };
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
  el('rc-head').innerHTML = done ? '<b>✓ 기록 완료</b><span>투표로 넘어갑니다</span>'
    : bad ? '<b>확인이 필요합니다</b><span id="rc-sec"></span>'
    : `<b>기록 저장 중</b><span id="rc-sec">${recElapsed()}초</span>`;
  const sub = {
    get: r.src === '전적' ? `정산 화면을 못 잡아서 전적에서 찾는 중${r.tries ? ` (${r.tries}/${r.max || 36})` : ''}` : '정산 화면에서 가져오는 중',
    save: r.src ? `${r.src}에서 받음` : '',
    rec: r.src === '다른 PC' ? '다른 사람 PC가 먼저 저장했습니다' : '방장 앱이 승패를 판정하는 중',
  };
  el('rc-steps').innerHTML = REC_STEPS.map(([k, label], i) => {
    const st = i < cur || done ? 'done' : i === cur ? (bad ? 'bad' : 'now') : 'todo';
    const mark = st === 'done' ? '✓' : st === 'bad' ? '!' : st === 'now' ? '●' : '';
    return `<li class="${st}"><i>${mark}</i><span>${label}${st === 'now' && sub[k] ? `<small>${esc(sub[k])}</small>` : ''}</span></li>`;
  }).join('');
  const note = el('rc-note');
  note.className = 'rc-note' + (bad ? ' warn' : '');
  note.innerHTML = r.problem === 'pick' ? '인게임 이름이 등록 이름과 달라 자동 판정을 못 했습니다.<br>방장이 이긴 팀을 골라주세요.'
    : r.problem === 'missed' ? '게임 결과를 찾지 못했습니다.<br>방장이 이긴 팀을 직접 기록해주세요.'
    : r.problem === 'closed' ? '결과 저장 전에 롤이 꺼졌습니다.<br>롤을 다시 켜면 전적에서 가져옵니다. 급하면 방장이 직접 기록해도 됩니다.'
    : r.problem ? esc(r.problem)
    : done ? '' : '정산 화면은 바로 나가도 괜찮습니다 · 전적에서도 가져옵니다';
  const hb = el('rc-host');
  if (myIsHost && (bad || recElapsed() > 60) && !done) {
    hb.style.display = '';
    hb.innerHTML = '<div class="rc-host-h">방장: 이긴 팀 직접 기록</div><div class="rc-acts"><button class="ui-btn-ghost" data-w="teamA">' + esc(TN(sessionData, 'teamA')) + ' 승리</button><button class="ui-btn-ghost" data-w="teamB">' + esc(TN(sessionData, 'teamB')) + ' 승리</button></div>';
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
  el('vt-banner').innerHTML = `<span class="lb-sec-en">TEAM ${wt} WIN</span><b><span class="tn-cut">${esc(TN(s, wt === 1 ? 'teamA' : 'teamB'))}</span> 승리</b><span>MVP와 매너왕을 뽑아주세요</span>`;
  const body = el('vt-body');
  if (mt === 0) { body.innerHTML = '<div class="vt-note">관전자는 투표하지 않습니다.<br>결과가 나오면 여기에 떠요.</div>'; renderVoteProgress(); return; }
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
    + `<div class="vt-sec"><div class="vt-sec-h manner"><span class="lb-sec-en">MANNER</span>우리 팀 매너왕</div><div class="vt-cands">${ours.map(x => voteCardHtml(x, 'manner', nn(x) === nn(_pendManner))).join('') || '<div class="vt-note">우리 팀이 나 혼자라 매너왕 투표는 없습니다</div>'}</div></div>`
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
    `<div class="vt-prow"><span class="t-blue">${esc(TN(s, 'teamA'))}</span>${A.map(chip).join('')}</div>`
    + `<div class="vt-prow"><span class="t-red">${esc(TN(s, 'teamB'))}</span>${B.map(chip).join('')}</div>`
    + (myIsHost ? `<button id="vt-force" class="ui-btn-ghost vt-force">투표 마감${pending ? ` · 미투표 ${pending}명 제외` : ''}</button><div class="vt-force-hint">방장 전용 · 다 모이면 자동으로 마감됩니다</div>` : '');
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
  el('st-banner').innerHTML = `<span class="lb-sec-en">RESULT</span><b><span class="tn-cut">${esc(TN(s, winA ? 'teamA' : 'teamB'))}</span> 승리</b>${_today ? `<span>오늘 <span class="num">${_today.matches.length}</span>번째 판</span>` : ''}`;
  serBar('st-ser', s, true);   // 🏆 v0.1.288
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
  if (skipped) pb.textContent = `🚫 팟지 건너뜀${P.by ? ` · ${P.by}님이 건너뛰었습니다` : ''}`;
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
// 🎞️ v0.1.235 창이 열리고 닫힐 때 움직임(사장님: 큐를 누르면 그냥 뚝 나와서 없어 보임) — 방식 고르는 창·방 메뉴·이모티콘 창
//   열기 = 높이가 0에서 펼쳐지며 살짝 올라오고(0.22초) 안의 줄이 차례로 나타남 · 닫기 = 접히며 사라짐(0.15초) · 다시 그려도 같은 상태면 아무것도 안 함
//   float = 다른 것을 밀지 않고 떠 있는 창(이모티콘) → 높이 대신 아래에서 떠오름
function popAnim(p, on, float) {
  if (!p) return;
  on = !!on;
  if ((p.dataset.on === '1') === on) { if (on) p.style.display = ''; else if (!p._closing) p.style.display = 'none'; return; }
  p.dataset.on = on ? '1' : '';
  p.getAnimations().forEach(a => a.cancel()); p.querySelectorAll(':scope > *').forEach(c => c.getAnimations().forEach(a => a.cancel()));
  const cs = () => getComputedStyle(p), ease = 'cubic-bezier(.2,.9,.3,1)';
  if (on) {
    p._closing = false; p.style.display = '';
    if (float) p.animate([{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: ease });
    else {
      const c = cs(), h = p.offsetHeight;
      p.animate([{ height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0, overflow: 'hidden', transform: 'translateY(6px)' },
        { height: h + 'px', paddingTop: c.paddingTop, paddingBottom: c.paddingBottom, opacity: 1, overflow: 'hidden', transform: 'none' }], { duration: 220, easing: ease });
    }
    p.querySelectorAll(':scope > *').forEach((k, i) => { if (k.style.display !== 'none') k.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay: 50 + i * 35, easing: 'ease-out', fill: 'backwards' }); });
  } else {
    if (p.style.display === 'none') return;
    p._closing = true;
    const c = cs(), h = p.offsetHeight;
    const a = float ? p.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px) scale(.97)' }], { duration: 140, easing: 'ease-in' })
      : p.animate([{ height: h + 'px', paddingTop: c.paddingTop, paddingBottom: c.paddingBottom, opacity: 1, overflow: 'hidden' }, { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0, overflow: 'hidden', transform: 'translateY(6px)' }], { duration: 150, easing: 'ease-in' });
    const end = () => { p._closing = false; if (p.dataset.on !== '1') p.style.display = 'none'; };
    a.onfinish = end; a.oncancel = () => { p._closing = false; };
  }
}
let _lbBusy = false, _mpop = false;   // _mpop = ⚔ v0.1.193 방식 고르는 창 열림(대기실이 다시 그려져도 유지)
document.addEventListener('click', e => {   // 고르는 창 밖을 누르면 닫음
  if (!_mpop || (e.target.closest && e.target.closest('#lb-mpop, #lb-mchip'))) return;
  _mpop = false; const p = document.getElementById('lb-mpop'), c = document.getElementById('lb-mchip'); popAnim(p, false); if (c) c.classList.remove('open');
});
function lbErr(msg) { const e = el('lb-err'); e.textContent = '⚠️ ' + msg; e.style.display = ''; clearTimeout(lbErr._t); lbErr._t = setTimeout(() => { e.style.display = 'none'; }, 2600); }
async function lbAct(fn) {
  if (_lbBusy) return;
  _lbBusy = true;
  try { const r = await fn(); if (r && r.ok === false && r.err) lbErr(r.err); } catch (_) { lbErr('실패했습니다'); }
  _lbBusy = false;
}
// 🪜 v0.1.216 내전 롤 로비 만들기·초대(큰 버튼 · 방 줄 공용) — 일반 큐 대기방이면 나가도 되는지 묻고 · 실패는 아래 줄에
let _roomStepSkip = null;   // [나중에] 누른 방 번호(이 방에선 「롤 로비 만들기」 단계 건너뜀)
// 🎮 v0.1.217(사장님: 만들기를 누르면 한 번에 다 초대하니 「방 사람 초대」를 늘 띄울 필요 없음 → 롤 로비에 없는 사람만)
//   롤 로비에 있을 때 = 앱 켠 방 사람 중 롤 로비에 없는 사람만 이름(+거절·초대 중) + [초대](그 사람들만) · 다 있으면 「모두 들어와 있습니다」(버튼 없음)
function lolMissRow(M, G) {
  const tip = ' title="팀이 정해지면 그 판 다리로 이 방 설정만 바꿔요(아무도 안 나가짐)"';
  if (!Array.isArray(G.ids)) return `<span class="lb-lol-t"${tip}><span class="lb-lol-ic">🎮</span>롤 로비에 있습니다</span><button class="lb-mini" data-lol="make">방 사람 초대</button>`;
  const miss = M.filter(m => m.online && !m.me && !m.guest && !G.ids.includes(m.key));
  if (!miss.length) return `<span class="lb-lol-t"${tip}><span class="lb-lol-ic">🎮</span>롤 로비에 <b>모두</b> 들어와 있습니다</span>`;
  const inv = G.invs || {}, stK = { Declined: '거절', Pending: '초대 중' };
  const names = miss.map(m => esc(m.name) + (stK[inv[m.key]] ? `<small class="lb-lol-st${inv[m.key] === 'Declined' ? ' no' : ''}">${stK[inv[m.key]]}</small>` : '')).join(', ');
  const all = miss.every(m => inv[m.key]);
  const full = miss.map(m => m.name + (stK[inv[m.key]] ? ` (${stK[inv[m.key]]})` : '')).join(', ');
  return `<span class="lb-lol-t" title="롤 로비에 없는 사람: ${esc(full)} · 거절했으면 다시 초대할 수 있습니다"><span class="lb-lol-ic">🎮</span>롤 로비에 없음 <b>${miss.length}</b> · ${names}</span><button class="lb-mini" data-lol="make">${all ? '다시 초대' : '초대'}</button>`;
}
async function lolRoomGo() {
  let r = await window.api.lolLobby({});
  if (r && r.need === 'leave') { if (!(await tnConfirm(`지금 롤 대기방(일반 큐)에 있습니다.\n나가고 ${lobbyData && lobbyData.game === 'sr' ? '소환사의 협곡' : '아수라장'} 내전 방을 만들까요?`, { ok: '나가고 만들기' }))) return null; r = await window.api.lolLobby({ force: true }); }
  if (!r || !r.ok) { lbErr((r && r.err) || '롤 로비를 만들지 못했습니다'); return r; }
  return r;
}
// 🎮 v0.1.191 일반판 롤 파티 만들기·초대 — 남의 파티에 있으면 나가도 되는지 묻고 · 자리 없어 못 부른 사람은 알려 줌
async function lolPartyGo() {
  let r = await window.api.lolParty({});
  if (r && r.need === 'leave') { if (!(await tnConfirm('지금 다른 사람이 파티장인 롤 파티에 있습니다.\n나가고 내 파티를 새로 만들까요?', { ok: '나가고 만들기' }))) return null; r = await window.api.lolParty({ force: true }); }
  if (!r || !r.ok) { lbErr((r && r.err) || '롤 파티를 만들지 못했습니다'); return r; }
  if (r.left && r.left.length) lbErr(`롤 파티는 5명까지라 ${r.left.join(', ')}님은 초대 안 했습니다`);
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
// 🗺️ v0.1.232 소환사의 협곡 — 내전 게임(아수라장 | 협곡 + 픽 방식) · 일반 큐(협곡 교차 선택·신속 대전·자유 랭크) · main SR_PICKS·LOL_NQ_KO와 같게
const SR_PICK_KO = { 3130: '토너먼트 교차 선택', 3110: '교차 선택', 3100: '비공개 선택', 3120: '모두 무작위' };
const NQ_KO = { 2400: '아수라장', 450: '칼바람 나락', 440: '자유 랭크' }, NQ_SHORT = { 2400: '아수라장', 450: '칼바람', 440: '자유 랭크' };   // v0.1.235 많이 하는 큐만(사장님)
const MODE_DESC = {   // 방식 고르는 창 맨 아래 한 줄(방장)
  random: '무작위로 두 팀을 나눠요',
  balance: '아수라장 점수(내전 등급·일반 판 기록)로 두 팀을 비슷하게 나눠요',
  balanceSr: '롤 랭크 티어(솔로 · 없으면 자유)와 협곡 내전 기록으로 두 팀을 비슷하게 나눠요',
  draft: '팀장 둘이 번갈아 한 명씩 뽑습니다 · 선픽은 줄다리기로 정합니다',
  manual: '방장이 1팀·2팀을 직접 정합니다',
  normal: '같은 팀으로 일반 게임을 합니다 · 롤 파티는 5명까지',
};
const MODE_WAIT = { random: '무작위로 팀이 정해집니다', balance: '점수로 비슷하게 팀이 정해집니다', draft: '팀장 둘이 번갈아 뽑습니다' };   // 팀원: 「방장이 시작하면 …」
const GAME_PHASES = ['ReadyCheck', 'ChampSelect', 'GameStart', 'InProgress', 'Reconnect'];
function renderLobby() {
  setTimeout(() => { chatRoom(); chatMark(); chatPlace(); pingPlace(); }, 0);   // 💬 자리를 다시 그린 뒤 방 바뀜 확인·말한 사람 테두리·이모티콘 자리 맞춤(v0.1.202 · ⚠️ 바로 부르면 안 됨 — 켤 때는 아래 CHAT이 아직 안 만들어진 채로 여기가 먼저 돎)
  const L = lobbyData || { members: [], mode: 'random', captains: {} };
  const M = L.members || [], caps = L.captains || {}, draft = L.mode === 'draft', manual = L.mode === 'manual', normal = L.mode === 'normal', sides = L.sides || {};
  const ins = M.filter(m => m.st === 'in'), specs = M.filter(m => m.st === 'spec');
  const sA = ins.filter(m => sides[m.name] === 'teamA'), sB = ins.filter(m => sides[m.name] === 'teamB'), sNone = ins.filter(m => !sides[m.name]);   // 🧩 직접
  const me = M.find(m => m.me), login = !!myName;
  const G = L.lol || {}, nq = G.nq || 2400, P = G.party, QN = NQ_KO[nq] || '아수라장';
  const sr = L.game === 'sr', GN = sr ? '소환사의 협곡' : '아수라장', srPick = L.srPick || 3130;   // 🗺️ v0.1.232 내전 게임
  const n = ins.length, capN = (caps.teamA ? 1 : 0) + (caps.teamB ? 1 : 0), seatCap = normal ? 5 : SEATS;
  const ts = Math.min(5, Math.floor(n / 2)), left = n - ts * 2;   // 팀 크기 · 남는 사람(관전)

  // 🎧 디스코드 = 방 줄의 작은 아이콘 하나(v0.1.194) — 음성 채널 밖 = 누르면 대기 채널 + 「디스코드 참가하기」 9초 / 서버에 없음 = 초대 링크 / 방장 연결 안 됨 = 흐린 아이콘 · 음성 채널 안이면 없음
  const S = _set || {}, J = L.dcJoin;
  let dcKind = '', dcTip = '', dcGo = null;
  if (L.room && J && J.kind === 'voice') {
    dcKind = 'act'; dcTip = `디스코드 음성 채널 참가 · 「${J.name}」 대기 채널이 열립니다`;
    dcGo = () => { window.api.discordJoin({ gid: J.gid, ch: J.ch }); _dcHintUntil = Date.now() + 9000; setTimeout(() => { if (lobbyData) render(); }, 9100); if (lobbyData) render(); };
  } else if (L.room && J) {
    dcKind = 'act'; dcTip = `디스코드 「${J.name}」 서버 들어가기`;
    dcGo = () => window.api.discordJoin({ code: J.code, gid: J.gid });
  } else if (myIsHost && L.room && S.discord && S.discord.app && !S.dcNudgeOff && (!L.dcGuild || !L.dcInv)) {
    const inv = !!L.dcGuild;
    dcKind = 'dim'; dcTip = inv ? '디스코드 초대 링크 넣기 · 서버에 없는 친구에게 「들어가기」가 떠요' : '디스코드 서버 연결 · 팀이 정해지면 1팀·2팀 음성 채널로 나눠요';
    dcGo = inv ? () => { if (window.tnSettingsOpen) window.tnSettingsOpen('dc'); setTimeout(() => { const ib = document.querySelector('.tn-set [data-act=dcinv]'); if (ib) ib.click(); }, 80); }
      : () => window.api.discordConnect && window.api.discordConnect().then(r => { if (r && !r.ok && r.err) tnAlert('디스코드 서버 연결 · ' + r.err); }).catch(() => {});
  }
  const dcHint = dcKind === 'act' && J && J.kind === 'voice' && Date.now() < _dcHintUntil;

  // ① 방 줄 — [방 이름 ▾ = 방 메뉴(방장 넘겨주기·신고·나가기)] [디스코드] [PLAYERS n/10] · 방장 = 자리의 왕관
  const head = el('lb-head');
  head.style.display = login ? '' : 'none';
  const cntTip = normal ? '롤 파티에 들어갈 사람 · 5명까지(6번째부터는 초대 안 합니다)' : '참가 인원(관전은 빼고) · 한 판에 10명까지';
  head.innerHTML = !login ? ''
    : `<button id="lb-rbtn" class="lb-rbtn${_rmenu ? ' open' : ''}" title="방 메뉴 열기 · ${myIsHost ? '방장 넘겨주기·신고·나가기' : '신고·나가기'}"><span class="lb-en">${L.room && L.room.priv ? 'PRIVATE ROOM' : 'ROOM'}</span><span class="lb-rrow"><b class="lb-rname">${esc(L.room ? L.room.name : '대기실')}</b><i>▾</i></span></button>`
      + (dcHint ? '<span class="lb-dci-hint" title="디스코드 대기 채널 화면에서 「음성 채널 참가하기」를 눌러 주세요">디스코드 「참가하기」</span>'
        : `<span class="lb-cnt"><span class="lb-en" title="${cntTip}">${normal ? 'PARTY' : 'PLAYERS'}</span><span class="lb-cnt-n">${dcKind ? `<button id="lb-dci" class="lb-dci-b ${dcKind}" title="${esc(dcTip)}" aria-label="${esc(dcTip)}">${DC_LOGO}${dcKind === 'act' ? '<i class="lb-dci-dot"></i>' : ''}</button>` : ''}<span class="lb-cnt-v" title="${cntTip}"><b>${Math.min(n, seatCap)}</b><i>/${seatCap}</i>${n > seatCap ? `<em>+${n - seatCap}</em>` : ''}</span></span></span>`);
  { const rb = el('lb-rbtn'); if (rb) rb.onclick = e => { e.stopPropagation(); toggleRoomMenu(L); };
    const db = el('lb-dci'); if (db) db.onclick = e => { e.stopPropagation(); if (dcGo) dcGo(); };
    if (!login) closeRoomMenu(); else if (_rmenu) fillRoomMenu(L); }

  // ② 롤 로그인 전 = 빈 자리 대신 시작하는 법 3단계(처음 온 사람)
  const lg = el('lb-login');
  lg.style.display = login ? 'none' : '';
  const stSig = login ? '' : JSON.stringify(_start || 0);
  if (!login && lg.dataset.h !== stSig) {   // v0.1.227 롤이 꺼져 있고 라이엇 클라이언트를 찾았으면 「롤 클라이언트 켜기」 버튼(main startView)
    lg.dataset.h = stSig;
    const st = _start || {};
    lg.innerHTML = '<span class="lb-en">START</span><b class="lb-lg-t">이렇게 시작합니다</b>'
      + '<ol class="lb-lg-steps"><li class="now"><i>1</i><span><b>롤 클라이언트에 로그인</b><small>그 계정으로 자동 입장합니다</small></span></li>'
      + '<li><i>2</i><span><b>방을 만들거나 들어가기</b><small>만든 사람이 방장입니다</small></span></li>'
      + '<li><i>3</i><span><b>방장이 팀을 짜면 게임 시작</b><small>결과 기록·투표·하이라이트는 자동입니다</small></span></li></ol>'
      + (st.launching ? '<button class="ui-btn-gold lb-lg-go" disabled>롤 클라이언트를 켜는 중</button>'
        : st.launch ? '<button class="ui-btn-gold lb-lg-go" id="lb-lg-go">롤 클라이언트 켜기</button>'
        : `<span class="lb-wait"><span class="lobby-pulse"></span>${st.lol === 'login' ? '롤 계정을 확인하는 중' : '롤 로그인을 기다리는 중'}</span>`);
    const go = el('lb-lg-go');
    if (go) go.onclick = () => { go.disabled = true; window.api.lolLaunch().then(r => { if (r && !r.ok) { go.disabled = false; if (r.err) lbErr(r.err); } }).catch(() => { go.disabled = false; }); };
  }

  // ③ 자리 — 참가한 사람 순서대로 · 빈 자리는 한 줄까지만(v0.1.195) · 드래프트 팀장 고르는 중(pick)엔 「팀장」 버튼이 늘 보임
  const capOf = nm => nn(nm) === nn(caps.teamA) ? 1 : nn(nm) === nn(caps.teamB) ? 2 : 0;
  const pick = myIsHost && draft && capN < 2 && n >= 2, canAdd = false;   // 🔒 v0.1.253 앱 없는 사람 추가 없앰(기록 공개 동의를 받을 수 없음)
  const seat = (m, i, side, over) => {   // side = 직접 방식의 팀 열(왼쪽 1팀 · 오른쪽 2팀) · over = 일반판 6번째부터(롤 파티는 5명까지 → 초대 안 됨)
    const no = String(i + 1).padStart(2, '0'), sn = side === 'teamA' ? 1 : side === 'teamB' ? 2 : 0;
    if (!m) return `<div class="seat empty${sn ? ' side' + sn : ''}${canAdd ? ' add' : ''}"${canAdd ? ' data-addguest="1" title="앱 없는 사람 추가 · 롤 앱이 없는 친구도 이름으로 자리에 앉혀 팀에 넣습니다"' : ''}><span class="seat-no">${no}</span><span class="seat-av">${canAdd ? '<i>＋</i>' : ''}</span>`
      + `<span class="seat-main"><b class="e1">${sn ? sn + '팀 빈 자리' : '빈 자리'}</b>${canAdd ? '<b class="e2">앱 없는 사람 추가</b>' : ''}</span></div>`;
    const st = _standing(m.name), cap = capOf(m.name);
    const tags = cap ? `<span class="seat-tag c${cap}" title="${cap}팀 팀장">팀장</span>` : '';
    const spec1 = m.me ? '<button class="seat-spec" data-mespec="1" title="이번 판은 쉬고 관전할게요(자리에서 빠짐 · 아래 「다시 참가하기」로 돌아옵니다)">관전</button>' : '';
    const ctl = myIsHost ? ((draft ? `<button class="seat-btn cap${cap ? ' on' : ''}" data-cap="${esc(m.name)}" title="${cap ? '팀장 해제' : '이 사람을 팀장으로'}">팀장</button>` : '')
      + (sn ? `<button class="seat-btn" data-side="${esc(m.name)}" data-t="${sn === 1 ? 'teamB' : 'teamA'}" title="${sn === 1 ? 2 : 1}팀으로 옮기기">⇄</button><button class="seat-btn" data-side="${esc(m.name)}" data-t="" title="팀에서 빼기(미정)">↩</button>` : '')
      + (!m.me ? `<button class="seat-btn out" data-out="${esc(m.key)}" title="${m.guest ? '목록에서 빼기' : '관전으로 보내기'}">${m.guest ? '✕' : '↓'}</button>` : '')
      + (!m.me && !m.guest ? `<button class="seat-btn kick" data-kick="${esc(m.key)}" title="방에서 내보내기 · 롤 로비에 있으면 거기서도">✕</button>` : '') + spec1) : '';   // 🚪 v0.1.217 강퇴
    // 버튼은 이름 줄 옆이 아니라 아랫줄 자리(v0.1.194) — 올렸을 때 아랫줄 대신 보임 → 이름 폭 그대로
    return `<div class="seat filled${ctl ? ' has-ctl' : ''}${over ? ' over' : ''}${m.me ? ' me' : ''}${cap ? ' cap' + cap : ''}${sn ? ' side' + sn : ''}">`
      + `<span class="seat-no">${no}</span>${avatar(m, 'seat-av')}`
      + `<span class="seat-main"><span class="seat-nmrow">${m.host ? '<i class="seat-crown" title="방장">👑</i>' : ''}<b class="lb-nm" data-pk="${esc(m.key)}" title="${m.me ? '나 · ' : ''}프로필 보기">${esc(m.name)}</b></span><small>${over ? '<span class="seat-ov">파티 자리 없음</span>' : ''}${tags}${m.dc ? `<span class="seat-dc" title="디스코드 연결됨 · 팀이 정해지면 음성 채널로 옮겨집니다">${DC_ICO}</span>` : ''}${m.guest ? '<span>앱 없음</span>' : m.online ? '' : '<span>오프라인</span>'}${st ? `<span><span class="num">${st.wins}</span>승 <span class="num">${st.losses}</span>패</span>` : ''}${spec1}</small>${ctl ? `<span class="seat-ctl">${ctl}</span>` : ''}</span>`
      + '</div>';
  };
  const fit = (k, cap) => k >= cap ? k : Math.min(cap, k + 1 + ((k + 1) % 2));   // 사람 수 + 빈 자리 한 줄까지
  const seats = el('lb-seats');
  seats.style.display = login ? '' : 'none';
  seats.className = 'lb-seats' + (pick ? ' pick' : '');
  seats.innerHTML = manual ? Array.from({ length: Math.min(5, Math.max(sA.length, sB.length) + 1) }, (_, i) => seat(sA[i], i, 'teamA') + seat(sB[i], i, 'teamB')).join('')   // 🧩 직접: 왼쪽 열 1팀 · 오른쪽 열 2팀
    : normal ? Array.from({ length: n >= 5 ? 5 : fit(n, 5) }, (_, i) => seat(ins[i], i)).join('')   // 🎮 일반판 = 롤 파티 5자리(🪑 v0.1.264 6번째부터 = 아래 「대기」 줄)
    : Array.from({ length: n >= SEATS ? SEATS : fit(n, SEATS) }, (_, i) => seat(ins[i], i)).join('');

  // ④ 자리에 없는 사람 = 팀 미정(직접) · 관전
  const chip = m => `<span class="lb-chip ${m.st || 'none'}${m.me ? ' me' : ''}">${avatar(m, 'chip-av')}<b class="lb-nm" data-pk="${esc(m.key)}">${esc(m.name)}</b>`
    + (myIsHost && !m.me ? `<button class="seat-btn in" data-in="${esc(m.key)}" title="참가로">＋</button>` : '')
    + (myIsHost && m.guest ? `<button class="seat-btn out" data-rm="${esc(m.key)}" title="목록에서 빼기">✕</button>` : '')
    + (myIsHost && !m.me && !m.guest ? `<button class="seat-btn kick" data-kick="${esc(m.key)}" title="방에서 내보내기">✕</button>` : '') + '</span>';
  const others = [];
  // 🪑 v0.1.264 자리 밖 = 「대기」(방식마다 자리만 제한 · 사장님) — 일반 6번째부터(롤 파티 5명) · 내전 11번째부터(10명 · 시작하면 이번 판 관전) · 앉은 순서 = 들어온 순서 · 방장이 앉은 사람을 ↓(관전)로 빼면 대기 첫 사람이 자리로
  const waitL = manual ? [] : ins.slice(seatCap);
  if (waitL.length) others.push(`<div class="lb-others wait"><span class="lb-ol" title="${normal ? '롤 파티는 5명까지 · 자리가 나면 앞사람부터 들어갑니다' : '한 판 10명까지 · 시작하면 이번 판은 관전 · 자리가 나면 앞사람부터 들어갑니다'}">대기 <b>${waitL.length}</b></span>${waitL.map(m => `<span class="lb-chip in${m.me ? ' me' : ''}">${avatar(m, 'chip-av')}<b class="lb-nm" data-pk="${esc(m.key)}">${esc(m.name)}</b>`
    + (myIsHost && !m.me ? `<button class="seat-btn out" data-out="${esc(m.key)}" title="관전으로 보내기">↓</button><button class="seat-btn kick" data-kick="${esc(m.key)}" title="방에서 내보내기">✕</button>` : '') + '</span>').join('')}</div>`);
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
      ub.innerHTML = `<span>내 앱이 옛 버전입니다 · v${esc(mv)} → 최신 v${esc(L.latest)}</span>`
        + (ready ? '<button id="lb-upd-go" class="lb-mini" title="앱이 잠깐 꺼졌다가 새 버전으로 다시 켜집니다">지금 업데이트</button>'
          : busy ? `<span class="lb-upd-st">${_upd.state === 'downloading' ? `받는 중 ${_upd.pct || 0}%` : '확인 중'}</span>`
          : '<button id="lb-upd-go" class="lb-mini" title="새 버전을 받습니다 · 다 받으면 「지금 업데이트」">새 버전 받기</button>');
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
  root.querySelectorAll('[data-kick]').forEach(b => b.onclick = async e => { e.stopPropagation(); const m = M.find(x => x.key === b.dataset.kick); if (!m) return; if (!(await tnConfirm(`${m.name}님을 방에서 내보낼까요?\n롤 로비에 있으면 롤 로비에서도 내보냅니다. 다시 들어오는 건 자유입니다.`, { title: '방에서 내보내기', ok: '내보내기', danger: true }))) return; lbAct(() => window.api.lobbyKick(m.key)); });
  root.querySelectorAll('.lb-nm').forEach(el2 => el2.onclick = () => {
    const m = M.find(x => x.key === el2.dataset.pk); if (!m) return;
    window.api.openProfile(m.guest ? { name: m.name } : { puuid: m.key, name: m.name });
  });

  // ⑥ 아래 고정 구역 = 이번 판
  el('lb-dock').style.display = login ? '' : 'none';
  el('lb-chat').style.display = me && !me.guest ? '' : 'none';   // 💬 채팅(방에 들어온 앱 켠 사람만)
  chatMuteMark(L);   // 💬 v0.1.245 채팅 금지
  const hostNm = L.hostName, noHost = login && !myIsHost && !hostNm;
  { // 방식 버튼(방장 · 시작 버튼 왼쪽) + 고르는 창(버튼 위로 열림)
    const chipB = el('lb-mchip'), pop = el('lb-mpop');
    if (!myIsHost) _mpop = false;
    // v0.1.216(사장님: 「⚔ 내전 · 드래프트」가 버튼처럼 보여 직관적이지 않음) — 설정 칸처럼: 작은 제목(내전 · 팀 짜기 / 일반 · 큐) + 고른 값 ▾
    chipB.innerHTML = `<span class="mc"><small>${normal ? '일반 · 큐' : (sr ? '협곡 내전' : '내전') + ((L.series && L.series.bo > 1) ? ' · ' + BO_KO(L.series.bo) : ' · 팀 짜기')}</small><b>${normal ? (NQ_SHORT[nq] || '아수라장') : (MODE_KO[L.mode] || '랜덤')}</b></span><em>▾</em>`;
    chipB.className = 'lb-mchip host' + (_mpop ? ' open' : '');
    chipB.title = '이번 판 방식 바꾸기 — 내전(아수라장·소환사의 협곡 · 랜덤·밸런스·드래프트·직접) / 일반(아수라장·칼바람·협곡 큐)';
    chipB.onclick = e => { e.stopPropagation(); if (!myIsHost) return; _mpop = !_mpop; popAnim(pop, _mpop); chipB.classList.toggle('open', _mpop); };
    pop.querySelectorAll('.lb-kind').forEach(b => {
      const on = (b.dataset.kind === 'normal') === normal; b.classList.toggle('on', on);
      b.onclick = () => { if (myIsHost && !on) lbAct(() => window.api.lobbyMode(b.dataset.kind)); };   // 내전 = main이 마지막에 고른 방식으로 · 창은 열어 둠(이어서 팀 짜기·큐 고르게)
    });
    el('lb-sub').style.display = normal ? 'none' : '';
    el('lb-game').style.display = normal ? 'none' : '';
    el('lb-srp').style.display = normal || !sr ? 'none' : '';
    pop.querySelectorAll('.lb-gm').forEach(b => { const on = (b.dataset.game === 'sr') === sr; b.classList.toggle('on', on); b.onclick = () => { if (myIsHost && !on) lbAct(() => window.api.lobbyGame(b.dataset.game === 'sr' ? 'sr' : null, srPick)); }; });
    pop.querySelectorAll('.lb-sp').forEach(b => { const q = Number(b.dataset.pick), on = q === srPick; b.classList.toggle('on', on); b.onclick = () => { if (myIsHost && !on) lbAct(() => window.api.lobbyGame('sr', q)); }; });
    el('lb-nq').style.display = normal ? '' : 'none';
    { // 🏆 v0.1.288 시리즈·팀 이름(내전만) — 입력 중인 칸은 안 덮어씀 · 칸을 벗어나거나 Enter = 저장
      const SC = L.series || { bo: 1, a: '', b: '' };
      el('lb-ser').style.display = el('lb-tn').style.display = normal ? 'none' : '';
      pop.querySelectorAll('.lb-bo').forEach(b => { const bo = Number(b.dataset.bo), on = bo === (SC.bo || 1); b.classList.toggle('on', on); b.onclick = () => { if (myIsHost && !on) lbAct(() => window.api.lobbySeries({ bo, a: el('lb-tna').value, b: el('lb-tnb').value })); }; });
      for (const [id, k] of [['lb-tna', 'a'], ['lb-tnb', 'b']]) {
        const inp = el(id); inp.disabled = !myIsHost;
        if (document.activeElement !== inp && inp.value !== (SC[k] || '')) inp.value = SC[k] || '';
        const save = () => { const a = el('lb-tna').value.trim(), b2 = el('lb-tnb').value.trim(); if (myIsHost && (a !== (SC.a || '') || b2 !== (SC.b || ''))) lbAct(() => window.api.lobbySeries({ bo: SC.bo || 1, a, b: b2 })); };
        inp.onchange = save; inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
      }
    }
    pop.querySelectorAll('.lb-seg').forEach(b => {
      b.classList.toggle('on', b.dataset.mode === L.mode);
      b.onclick = () => { if (!myIsHost) return; _mpop = false; popAnim(pop, false); chipB.classList.remove('open'); if (b.dataset.mode !== L.mode) lbAct(() => window.api.lobbyMode(b.dataset.mode)); };
    });
    pop.querySelectorAll('.lb-qb').forEach(b => { const q = Number(b.dataset.q); b.classList.toggle('on', q === nq); b.onclick = () => { if (q !== nq) window.api.lolNormalQ(q); }; });
    popAnim(pop, _mpop);   // 🎞️ 상태가 바뀌었을 때만 움직임
    el('lb-mdesc').textContent = normal ? MODE_DESC.normal + (nq === 440 ? ' · 자유 랭크는 1·2·3·5명 파티만 · 각자 롤에서 포지션을 골라야 시작됩니다' : '') : sr && L.mode === 'balance' ? MODE_DESC.balanceSr : MODE_DESC[MODE_KO[L.mode] ? L.mode : 'random'];
  }
  const lolIdle = !G.phase || G.phase === 'None' || G.phase === 'Lobby';
  const roomStep = !!(myIsHost && !normal && L.room && G.phase && lolIdle && !G.inCustom && _roomStepSkip !== L.room.id);   // 🪜 v0.1.216 ① 롤 로비 만들기 단계(롤이 켜져 있고 롤 로비에 없음)
  { // 🎮 롤 초대 수락 = 방장 아님 · 방장 초대가 왔는데 자동 수락을 꺼 둔 사람만
    //   🎮 v0.1.213 방장 · 내전 = 롤 아수라장 로비를 지금 바로 만들고 초대(사장님: 일반 방 만드는 키는 있는데 내전 아수라장 키가 사라짐 — v0.1.193에서 「팀 정해지면 자동」으로 뺐던 것)
    //   팀을 짜기 전에 미리 롤 로비에 모여 있을 때 · 팀이 정해지면 그 판 다리로 다시 만들고 다시 초대하는 건 그대로(v0.1.188)
    //   🪜 v0.1.216(사장님: 실제 순서 = 방장이 「내가 방 만들게」 → 모이기 → 팀 짜기인데 큰 버튼이 바로 「팀장 2명 필요」라 거꾸로 보임) — 내전 방장 = 단계대로:
    //   ① 롤 로비가 없으면(롤 홈·일반 큐 대기방) 큰 버튼 = 「🎮 롤 로비 만들기」 · 이 줄 = 「먼저 롤 로비를 만들어 모입니다 [나중에]」 ② 방에 있으면 큰 버튼 = 팀 짜기 · 이 줄 = 「롤 로비에 있습니다 [방 사람 초대]」
    //   [나중에] = 이 방에선 ① 건너뜀(팀이 정해질 때 앱이 방을 만듦 · 이 줄은 「롤 로비는 팀이 정해질 때 만듭니다 [지금 만들기]」)
    const box = el('lb-lol');
    const h = G.invite && !myIsHost ? `<span class="lb-lol-t"><b>👑 ${esc(G.invite.from)}</b>님이 롤 ${normal ? '파티' : '방'}에 초대했습니다</span><button class="lb-mini" data-lol="accept">수락</button>`
      : roomStep ? '<span class="lb-lol-t" title="롤에 ' + GN + ' 로비(사용자 설정 게임)를 이 방 이름으로 만들고(공개 목록엔 안 뜸) 앱 켠 방 사람들을 초대합니다"><span class="lb-lol-ic">🎮</span><b>먼저 롤 로비</b>를 만들어 모입니다</span><button class="lb-mini plain" data-lol="skip" title="롤 로비 없이 팀부터 짜기 · 팀이 정해질 때 앱이 롤 로비를 만듭니다">나중에</button>'
      : myIsHost && !normal && L.room && lolIdle && G.phase
        ? (G.inCustom ? (G.cmap === 11 || G.cmap === 12) && (G.cmap === 11) !== sr || (sr && G.cmap === 11 && G.cq && SR_PICK_KO[G.cq] && G.cq !== srPick)
            ? `<span class="lb-lol-t" title="롤 로비는 그대로(나가지 않음) · 게임 설정만 바꿔요"><span class="lb-lol-ic">🎮</span>롤 로비가 <b>${G.cmap === 11 ? '협곡' + (SR_PICK_KO[G.cq] ? ' · ' + SR_PICK_KO[G.cq] : '') : '아수라장'}</b>입니다</span><button class="lb-mini" data-lol="make">${sr ? (G.cmap === 11 ? '픽 방식 바꾸기' : '협곡으로 바꾸기') : '아수라장으로 바꾸기'}</button>`
            : lolMissRow(M, G)
          : '<span class="lb-lol-t"><span class="lb-lol-ic">🎮</span>롤 로비는 팀이 정해질 때 만듭니다</span><button class="lb-mini" data-lol="make">지금 만들기</button>')
        : '';
    box.style.display = h ? '' : 'none';
    if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
    box.querySelectorAll('[data-lol]').forEach(b => b.onclick = async () => {
      if (b.disabled) return; b.disabled = true; const t0 = b.textContent;
      try {
        if (b.dataset.lol === 'accept') { const r = await window.api.lolAccept(); if (!r || !r.ok) tnAlert((r && r.err) || '수락하지 못했습니다'); return; }
        if (b.dataset.lol === 'skip') { _roomStepSkip = L.room && L.room.id; render(); return; }
        b.textContent = '만드는 중…';
        const r = await lolRoomGo();
        b.textContent = r && r.ok ? (r.total ? `${r.invited}명 초대함` : '초대할 사람 없음') : t0; if (r && r.ok) setTimeout(() => { b.textContent = t0; }, 2500);
      } finally { b.disabled = false; }
    });
  }
  const capsOk = !draft || capN === 2, sideOk = !manual || (!sNone.length && sA.length && sB.length);
  const myParty = !!(P && P.leader && P.q === nq);
  const qState = !normal ? null : GAME_PHASES.includes(G.phase) ? 'game' : G.phase === 'Matchmaking' && P && P.leader ? 'search' : myParty && G.phase === 'Lobby' ? 'party' : 'none';
  { // 방장 안내 한 줄 — 지금 모자란 것·알아 둘 것 하나 + 그 일을 하는 작은 버튼(없으면 줄 자체가 없음)
    const cb = el('lb-caps'); let h = '';
    if (myIsHost && !roomStep) {
      if (normal) {
        if (qState === 'party') h = `<span class="lb-hint"><b>롤 파티 ${P.n}/${P.max || 5}명</b> · 다 들어오면 큐를 시작합니다</span><button id="lb-reinv" class="lb-mini">다시 초대</button>`;
        else if (qState === 'none' && n > 5) h = '<span class="lb-hint">롤 파티는 <b>5명까지</b>입니다 · 앞에 앉은 5명만 초대합니다</span>';
      } else if (n < 2) h = '';   // v0.1.204 사장님: 「친구가 앱을 켜고 … 자리에 앉습니다」 문구 뺌
      else if (draft) {
        const picks = Math.max(0, (ts - 1) * 2), ord = [];
        for (let i = 0; i < picks; i++) ord.push(((i + 1) >> 1) % 2 === 0 ? 'teamA' : 'teamB');   // main draftOrder와 같은 스네이크
        h = (capN < 2 ? `<span class="lb-hint"><b>팀장 ${capN}/2</b> · 자리의 「팀장」을 눌러 정합니다</span>`
          : '<span class="lb-cap ok"><em>팀장</em><b class="num">2/2</b></span>' + (picks ? `<span class="lb-ordmini" title="뽑는 순서 · 선 = 줄다리기로 정해지는 선픽 팀 · 후 = 다른 팀">${orderBar(ord, 0, true)}</span>` : '<span class="lb-hint"></span>'))
          + '<button id="lb-caprand" class="lb-mini" title="참가한 사람 중 무작위로 팀장 둘">랜덤 팀장</button>';
      } else if (manual) h = `<span class="lb-cap t1"><em>1팀</em><b class="num">${sA.length}</b></span><span class="lb-cap t2"><em>2팀</em><b class="num">${sB.length}</b></span>`
        + (sNone.length ? `<span class="lb-cap"><em>미정</em><b class="num">${sNone.length}</b></span>` : '') + '<span class="lb-hint"></span>'
        + '<button id="lb-sprev" class="lb-mini" title="지난 판과 같은 1팀·2팀으로">지난 판 그대로</button>' + (sA.length + sB.length ? '<button id="lb-sclr" class="lb-mini plain">비우기</button>' : '');
      else if (left > 0) h = `<span class="lb-hint">${n}명 → <b>${ts} : ${ts}</b> · 남는 ${left}명은 관전입니다</span>`;
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
    go.dataset.q = normal && L.lol ? qState : roomStep ? 'room' : '';   // 🎮 일반판: none 파티 만들고 초대 → party 큐 시작 → search 취소 → game · 🪜 내전 ① room = 롤 로비 만들기
    go.disabled = roomStep ? false : normal ? !go.dataset.q || qState === 'game' : n < 2 || !capsOk || !sideOk;
    go.classList.toggle('normal', normal && (!go.dataset.q || qState === 'game'));
    go.classList.toggle('qcancel', qState === 'search' && !!go.dataset.q);
    go.textContent = roomStep ? '롤 로비 만들기' : normal ? (!go.dataset.q ? '일반판 진행 중' : qState === 'game' ? '게임 진행 중' : qState === 'search' ? '큐 잡는 중 · 취소' : qState === 'party' ? `큐 시작 · ${P.n}/${P.max || 5}` : '파티 만들고 초대')
      : n < 2 ? '2명부터 시작' : !capsOk ? '팀장 2명 필요'
      : manual ? (sNone.length ? `팀 미정 ${sNone.length}명` : !sideOk ? '두 팀에 1명 이상' : `시작 · ${sA.length} : ${sB.length}`)
      : draft ? '드래프트 시작' : `팀 짜기 · ${ts} : ${ts}`;
    go.title = roomStep ? `롤에 ${GN} 로비(사용자 설정 게임)를 만들고 방 사람들을 초대합니다 · 모이면 팀을 짜요` : go.disabled ? '' : normal ? '' : draft ? '줄다리기로 선픽을 정하고 팀장이 번갈아 뽑습니다' : manual ? '이 팀으로 확정합니다' : `${MODE_DESC[L.mode] || MODE_DESC.random} · 팀이 정해지면 롤 로비를 만들고 모두 초대합니다`;
  }
  { // 팀원 = 지금 방식 · 방장 · 무엇을 기다리는지 / 방장 없음 = 방장 하기
    const st = el('lb-stat'); let h = '';
    if (noHost) h = `<div class="lb-stat-tx"><b>${L.hostStale ? `방장 ${esc(L.hostStale)}님이 1분 넘게 응답이 없습니다` : '아직 방장이 없습니다'}</b><small>방장이 방식을 고르고 팀을 짜요 · 경기 기록·투표 마감도 방장 앱이 합니다</small></div>`
      + `<button id="lb-hc-go" class="ui-btn-gold lb-hc-go">👑 ${L.hostStale ? '방장 이어받기' : '방장 하기'}</button>`;
    else if (login && !myIsHost) {
      const sub = me && me.st === 'spec' ? '관전 중입니다 · 「다시 참가하기」를 누르면 자리에 앉습니다'
        : normal ? (qState === 'game' ? '게임 진행 중입니다' : G.phase === 'Matchmaking' ? '큐를 잡는 중입니다' : P ? `롤 파티 ${P.n}/${P.max || 5}명 · 방장이 큐를 시작합니다` : '방장이 초대하면 자동으로 롤 파티에 들어갑니다')
        : manual ? '방장이 1팀·2팀을 직접 정하고 있습니다'
        : `방장이 시작하면 ${MODE_WAIT[L.mode] || MODE_WAIT.random}`;
      h = `<div class="lb-stat-tx"><span class="lb-stat-top"><b class="lb-stat-m">${normal ? `<i>🎮</i>일반 · ${QN}` : `<i>⚔</i>${sr ? '협곡 내전' : '내전'} · ${MODE_KO[L.mode] || '랜덤'}${L.series && L.series.bo > 1 ? ' · ' + BO_KO(L.series.bo) : ''}`}</b><span class="lb-stat-h" title="방장">👑 ${esc(hostNm)}</span></span><small>${sub}</small></div>`;
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
  if (q === 'room') return lbAct(() => lolRoomGo().then(() => null));   // 🪜 v0.1.216 내전 ① 롤 로비 만들기
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
if (window.api.onKicked) window.api.onKicked(d => {   // 🚪 v0.1.217 · 🛡️ v0.1.244 운영자가 내보냄 / 방이 지워짐
  const nm = d && d.room || '방';
  const msg = d && d.gone ? `「${nm}」 방이 운영자에 의해 닫혔습니다.\n다른 방에 들어가거나 새로 만들 수 있습니다.`
    : d && d.admin ? `운영자가 「${nm}」 방에서 내보냈습니다.\n다른 방에 들어가거나 다시 들어갈 수 있습니다.`
    : `${d && d.by || '방장'}님(방장)이 「${nm}」 방에서 내보냈습니다.\n다른 방에 들어가거나 다시 들어갈 수 있습니다.`;
  tnAlert(msg, { title: '방에서 나왔습니다' });
});
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
function closeRoomMenu() { _rmenu = false; const m = el('lb-hostmenu'); popAnim(m, false); const b = el('lb-rbtn'); if (b) b.classList.remove('open'); }
function toggleRoomMenu(L) { if (_rmenu) { closeRoomMenu(); return; } _rmenu = true; const b = el('lb-rbtn'); if (b) b.classList.add('open'); fillRoomMenu(L); }
function fillRoomMenu(L) {
  const m = el('lb-hostmenu');
  const others = (L.members || []).filter(x => x.online && !x.guest && !x.me);
  const hn = L.hostName;
  // 🧱 v0.1.265 줄마다 오른쪽에 하는 일(「넘기기」·「그만하기」·「신고」·「나가기」) 버튼 모양 표시 + 구역 제목에 한 줄 설명(사장님: 누르는 건지 아닌지 모르겠음)
  const act = (t, c) => `<em class="lb-hm-act${c ? ' ' + c : ''}">${t}</em>`;
  m.innerHTML = (myIsHost
    ? '<div class="lb-hm-hd">👑 방장 넘겨주기<small>누르면 그 사람이 방장이 됩니다</small></div>'
      + (others.length ? others.map(o => `<button class="lb-hm-item" data-p="${esc(o.key)}">${avatar(o, 'chip-av')}<span>${esc(o.name)}</span>${act('넘기기')}</button>`).join('') : '<div class="lb-hm-empty">앱을 켠 다른 사람이 없습니다</div>')
    : `<div class="lb-hm-hd">${hn ? `👑 지금 방장 <b>${esc(hn)}</b>` : '방장 없음'}</div>`)
    + (L.room && others.length ? `<button class="lb-hm-item sep" id="lb-hm-rep"><span>🚨 신고하기<small>운영자에게만 전달됩니다</small></span>${act('신고 ›', 'dim')}</button>` : '')
    + (L.room ? `<button class="lb-hm-item leave" id="lb-hm-leave"><span>방에서 나가기<small>방 목록으로 돌아갑니다</small></span>${act('나가기', 'red')}</button>` : '');
  popAnim(m, true);   // 🎞️ v0.1.235 열 때 펼쳐짐(이미 열려 있으면 그대로)
  m.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
    const o = others.find(x => x.key === b.dataset.p); if (!o) return;
    closeRoomMenu();
    if (!await tnConfirm(`${o.name}님에게 방장을 넘길까요?\n진행 중인 판은 그대로 이어집니다.`)) return;
    lbAct(() => window.api.handHost(o.key));
  });
  const rp = el('lb-hm-rep'); if (rp) rp.onclick = e => {   // 🚨 v0.1.245 신고할 사람 고르기
    e.stopPropagation();
    m.innerHTML = '<div class="lb-hm-hd">🚨 누구를 신고할까요?<small>고른 뒤 무슨 일이 있었는지 한 줄 적습니다</small></div>' + others.map(x => `<button class="lb-hm-item" data-rk="${esc(x.key)}">${avatar(x, 'chip-av')}<span>${esc(x.name)}</span><em class="lb-hm-act dim">신고</em></button>`).join('') + '<button class="lb-hm-item" id="lb-hm-back"><span>‹ 뒤로</span></button>';
    m.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => { const x = others.find(y => y.key === b.dataset.rk); closeRoomMenu(); if (x) reportAsk(x); });
    el('lb-hm-back').onclick = ev => { ev.stopPropagation(); fillRoomMenu(L); };
  };
  const lv = el('lb-hm-leave'); if (lv) lv.onclick = () => { closeRoomMenu(); leaveRoom(others.length); };
}
// 🚪 v0.1.271 방 나가기 = 방 메뉴(▾) 안에만(사장님: 방 줄에 따로 붙인 「나가기」 버튼은 뺌 · 「방장 그만하기」도 뺌 = 나가면 남은 사람에게 넘어감)
//   혼자 남은 방에서 나가면 방이 바로 닫힘(main roomLeave) · 방장만 확인 창
async function leaveRoom(others) {
  if (myIsHost && !(await tnConfirm(others ? '방에서 나갈까요?\n방장은 방에 남은 사람에게 넘어갑니다.' : '방에서 나갈까요?\n방에 아무도 없어서 방이 닫힙니다.', { ok: '나가기' }))) return;
  lbAct(() => window.api.roomLeave());
}
document.addEventListener('mousedown', e => { if (_rmenu && !(e.target.closest && e.target.closest('#lb-hostmenu, #lb-rbtn'))) closeRoomMenu(); });
function renderRoster() {
  const has = roster.length > 0;
  el('roster-h').style.display = has ? 'block' : 'none';
  el('pcount').textContent = has ? `${roster.length}명` : '';
  el('status').style.display = has ? 'none' : 'block';
  const lob = null;
  el('status').classList.toggle('lobby', false);
  if (!has && !myName) { el('status').innerHTML = '롤 클라이언트에 로그인하면<br>자동으로 입장됩니다'; el('waiting-info').style.display = 'none'; return; }
  if (!has) el('status').innerHTML = lob || (_gamePlayed
    ? '경기 종료<br><span class="status-sub">결과 기록을 기다리는 중입니다.</span>'
    : '오늘의 내전 대기 중<br><span class="status-sub">방장이 팀을 짜면 여기에 자동으로 떠요.</span>');
  el('players').innerHTML = roster.map(p => `<li class="team-${p.teamId || 0}"><span class="name">${esc(p.name)}</span><span class="champ">${esc(p.champ || '')}</span></li>`).join('');
  const wi = el('waiting-info');
  if (has) { wi.style.display = 'none'; return; }
  wi.style.display = 'block';
  loadToday();
  if (!_today) { wi.innerHTML = ''; return; }
  if (!_today.standings.length) { wi.innerHTML = '<div class="wi-dim" style="text-align:center;padding:10px;">오늘은 아직 경기가 없습니다</div>'; return; }
  const rows = _today.standings.slice(0, 8).map(p => {
    const medal = p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : `<b>${p.rank}</b>`;
    const extra = [p.mvp ? `🏆${p.mvp}` : '', p.manner ? `💎${p.manner}` : ''].filter(Boolean).join(' ');
    return `<div class="wi-rk-row${nn(p.name) === nn(myName) ? ' me' : ''}"><span class="wi-rk-r">${medal}</span><span class="wi-rk-nm">${esc(p.name)}</span><span class="wi-rk-lp">${p.wins}승 ${p.losses}패${extra ? ' · ' + extra : ''}</span></div>`;
  }).join('');
  wi.innerHTML = `<div class="wi-sec-h">오늘 순위 · ${_today.matches.length}판</div><div class="wi-rk">${rows}</div>`;
}

function render() {
  if (window.tnDemo && window.tnDemo.on && !window.tnDemo.rendering) { window.tnDemo.blocked(); return; }   // 🧭 v0.1.228 사용법 예시 화면이 떠 있는 동안은 실제 상태로 다시 안 그림(끝나면 실제 상태를 다시 받아 그림 · overlay/tutorial.js)
  try { renderHostNote(); } catch (_) {}   // 👑 방장 넘어옴 줄(이전 방장 돌아오면 「돌려주기」)
  if (roomData && roomData.ban) { renderBan(); showView('rooms'); el('phase').textContent = '이용 정지'; return; }   // 🚫 v0.1.244 운영 정지
  if (roomData && roomData.full) { renderFull(); showView('rooms'); el('phase').textContent = '자리 없음'; return; }   // 🚦 서버 자리 꽉 참
  const s = sessionData, ph = s && s.phase;
  if (ph === 'draft' && !inGame) { maybePick(s); loadToday(); renderDraft(); updateDraftTimer(); showView('draft'); el('phase').textContent = '드래프트'; maybeFirstPick(s); return; }   // 픽 먼저(뽑힌 칸을 연출 끝까지 비워둠)
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

// 🚀 v0.1.227 롤 로그인 전 상태({lol, launch, launching}) — 「시작하기」 카드의 「롤 클라이언트 켜기」 버튼
if (window.api.getStart) window.api.getStart().then(d => { _start = d; if (!myName) render(); }).catch(() => {});
if (window.api.onStart) window.api.onStart(d => { _start = d; if (!myName) render(); });

// 🔄 업데이트 상태(내 안내 줄 「새 버전 받기 / 받는 중 n% / 지금 업데이트」)
let _upd = null;
window.api.getUpdate().then(u => { _upd = u; if (lobbyData) render(); }).catch(() => {});
window.api.onUpdate(u => { _upd = u; if (lobbyData) render(); });

// ── 💬 대기실 채팅(v0.1.202 · 사장님: 말풍선이 창 안에 우겨 넣어져 닉네임을 가림 → 글은 입력 칸 위 줄 · 말풍선 대신 이모티콘이 그 사람 자리에서) ──────────
//   글 = 아래 고정 구역 입력 칸 바로 위에 「얼굴 · 이름 · 글」로 최근 CHAT_ROWS줄(2분 지나면 사라짐 · 기록은 안 남음) — 자리·닉네임을 덮지 않음
//   이모티콘 = 입력 칸 위 버튼 줄 → 누르면 그 사람 자리의 얼굴에서 한 번 톡 떴다 사라짐(모두에게) · 그 이모티콘 하나만 글로 써서 보내도 같음(서버엔 글과 같은 칸 · 규칙 그대로)
//   그림 = v0.1.256부터 핑과 같은 스케치 그림(assets/ping/{이름}.png · tools/ping-sketch.cjs · 예전 롤 감정표현 그림은 지움) · 서버로 보내는 글자는 그대로 그림 글자(👍 …)라
//     옛 앱(v0.1.202 = 그림 글자가 뜸 · v0.1.201 = 말풍선)과도 통하고 규칙도 그대로 · 그림을 못 읽으면 그 글자로
//   채팅을 접으면(▾) 한 줄만 남음 — 창이 낮고 사람이 많아 자리가 밀릴 때 · 접힌 동안 누가 쓰면 그 줄이 반짝이고 「새 말 n」 · 접힘은 이 PC에 기억
//   말한 사람 자리는 몇 초 테두리가 밝아짐 · 움직임은 전부 한 번만(무한 애니메이션 없음) · 글은 textContent로만 넣음(태그·스크립트가 와도 글자 그대로)
const EMO = [['👋', '인사', 'hi'], ['👍', '좋아요', 'good'], ['✅', '준비 완료', 'ready'], ['⏳', '잠깐만요', 'wait'], ['😂', 'ㅋㅋ', 'lol'], ['😭', 'ㅠㅠ', 'cry'], ['🔥', '가자', 'go'], ['❓', '?', 'ask']];   // [보내는 글자(옛 윈도우에도 있는 그림 글자만) · 뜻 · 롤 감정표현 번호] — M'Pengu · Nice · Okay · Snoozy Poro · Wahaha · Bee Sad · Let's Do This · Does Not Compute
const EMO_IMG = Object.fromEntries(EMO.map(e => [e[0], '../assets/ping/' + e[2] + '.png']));   // ✏️ v0.1.256 핑과 같은 스케치 그림(롤 감정표현 그림 안 씀)
const EMO_SET = new Set(EMO.map(e => e[0]));
const CHAT_ROWS = 3, CHAT_ROW_MS = 120000, CHAT_TALK_MS = 3500, CHAT_POP_MS = 2200;
const CHAT = { seen: {}, rows: [], pops: {}, talk: {}, fold: false, unread: 0, room: null };   // seen = 사람 키 → 마지막으로 띄운 {at, text} · rows = 최근 말 줄 · pops = 떠 있는 이모티콘 · talk = 테두리 밝힐 때까지
try { CHAT.fold = localStorage.getItem('tnChatFold') === '1'; } catch (_) {}
const chatMember = k => ((lobbyData && lobbyData.members) || []).find(m => m.key === k);
const chatAnchor = k => { const nm = [...el('view-lobby').querySelectorAll('.lb-nm[data-pk]')].find(x => x.dataset.pk === k); return nm ? nm.closest('.seat, .lb-chip') : null; };
function chatLayer() {
  let l = el('lb-bub');
  if (!l) { l = document.createElement('div'); l.id = 'lb-bub'; l.className = 'lb-bub'; el('view-lobby').appendChild(l); }
  return l;
}
// 💬 v0.1.236 채팅 욕설 가리기(내 화면만 · ⚙ 「채팅 욕설 가리기」 · 기본 켬) + 「이 사람 말 숨기기」(⚙에서 모두 다시 보기)
//   가리기 = 흔한 욕설·초성·띄어 쓴 변형을 ●로 · 서버엔 원문 그대로(가리는 건 보는 쪽)
// 💬 v0.1.245 욕설·비속어 목록 = overlay/chatfilter.js(보내는 쪽 main과 같은 목록 · 보는 쪽은 옛 앱이 보낸 말도 가림)
const chatClean = t => (_set && _set.chatFilter === false) || !window.tnChatFilter ? String(t) : window.tnChatFilter.clean(t);
const chatMuted = k => !!(_set && Array.isArray(_set.chatMute) && _set.chatMute.includes(k));
function chatShow(d) {
  if (window.tnDemo && window.tnDemo.on) return;   // 사용법 예시 화면 위에는 실제 채팅을 안 띄움
  if (!d || !d.key || typeof d.text !== 'string' || !d.text) return;
  const text = d.text.slice(0, 50), cur = CHAT.seen[d.key];
  if (cur && cur.at === d.at && cur.text === text) return;   // 내가 보낸 것 = 이미 띄움
  CHAT.seen[d.key] = { at: d.at, text };
  const m = chatMember(d.key);
  if (!m) return;   // 이 방 사람이 아니면 안 띄움
  if (!m.me && chatMuted(d.key)) return;   // 💬 숨긴 사람
  CHAT.talk[d.key] = Date.now() + CHAT_TALK_MS; chatMark(); setTimeout(chatMark, CHAT_TALK_MS + 40);
  if (EMO_SET.has(text)) chatPop(d.key, text); else chatSay(m, text);
}
function chatSay(m, text) {   // 최근 말 줄에 한 줄
  const row = document.createElement('div');
  row.className = 'lb-say' + (m.me ? ' me' : '');
  row.innerHTML = avatar(m, 'chip-av') + '<p><b></b><span></span></p>' + (m.me ? '' : '<button class="lb-say-mute" title="이 사람 말·이모티콘 숨기기(내 화면만 · ⚙ 설정에서 다시 볼 수 있습니다)">숨기기</button><button class="lb-say-mute lb-say-rep" title="운영자에게 신고(이 사람의 최근 말이 같이 전달됩니다)">신고</button>');
  row.querySelector('p b').textContent = m.name; row.querySelector('p span').textContent = chatClean(text);
  const rb = row.querySelector('.lb-say-rep'); if (rb) rb.onclick = e => { e.stopPropagation(); reportAsk(m); };   // 🚨 v0.1.245
  const mb = row.querySelector('.lb-say-mute:not(.lb-say-rep)');
  if (mb) mb.onclick = async e => { e.stopPropagation(); if (!(await tnConfirm(`${m.name}님의 말과 이모티콘을 숨길까요?\n내 화면에서만 안 보이고, ⚙ 설정에서 다시 볼 수 있습니다.`, { title: '말 숨기기', ok: '숨기기' }))) return; await window.api.chatMute(m.key, true); for (const r of CHAT.rows.filter(x => x.key === m.key)) chatDrop(r, true); };   // ⚠️ 'span'만 쓰면 얼굴 칸(chip-av)이 먼저 잡힘
  el('lb-chat-feed').appendChild(row);
  const o = { el: row, name: m.name, text: chatClean(text), key: m.key };
  CHAT.rows.push(o);
  while (CHAT.rows.length > CHAT_ROWS) chatDrop(CHAT.rows[0], true);
  o.tm = setTimeout(() => chatDrop(o), CHAT_ROW_MS);
  if (!m.me && CHAT.fold) CHAT.unread++;
  chatBar();
  if (m.me) return;
  if (CHAT.fold) el('lb-chat-fold').animate([{ backgroundColor: 'rgba(240,215,154,0.6)', borderColor: '#F0D79A' }, { backgroundColor: 'rgba(200,170,110,0.12)', borderColor: 'rgba(200,170,110,0.42)' }], { duration: 460, iterations: 2, easing: 'ease-out' });   // 접힌 줄 = 두 번 반짝
  else row.animate([{ backgroundColor: 'rgba(240,215,154,0.32)' }, { backgroundColor: 'rgba(240,215,154,0)' }], { duration: 900, easing: 'ease-out' });   // 새 줄 = 한 번 밝았다 가라앉음
}
function chatDrop(o, now) {
  const i = CHAT.rows.indexOf(o);
  if (i < 0) return;
  CHAT.rows.splice(i, 1); clearTimeout(o.tm);
  if (now) o.el.remove(); else { const a = o.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }); a.onfinish = () => o.el.remove(); setTimeout(() => o.el.remove(), 600); }
  CHAT.unread = Math.min(CHAT.unread, CHAT.rows.length); chatBar();
}
function chatBar() {   // 접힌 한 줄 = 마지막 말 미리 보기 + 새 말 수
  const last = CHAT.rows[CHAT.rows.length - 1], n = el('lb-chat-new');
  el('lb-chat-pv').textContent = last ? last.name + ' · ' + last.text : '누르면 펴집니다';
  n.style.display = CHAT.unread ? '' : 'none'; n.textContent = CHAT.unread ? '새 말 ' + CHAT.unread : '';
  el('lb-chat-fold').classList.toggle('new', CHAT.unread > 0);
}
function chatFold(on) {
  CHAT.fold = !!on;
  if (!on) CHAT.unread = 0;
  el('lb-chat-box').style.display = on ? 'none' : ''; el('lb-chat-fold').style.display = on ? '' : 'none';
  try { localStorage.setItem('tnChatFold', on ? '1' : '0'); } catch (_) {}
  chatBar(); chatPlace();
}
function chatPop(k, emo) {   // 그 사람 자리(얼굴)에서 이모티콘이 한 번 뜸
  const cur = CHAT.pops[k];
  if (cur) cur.el.remove();
  const e = document.createElement('div');
  e.className = 'lb-emj';
  const im = document.createElement('img');
  im.alt = emo; im.draggable = false; im.onerror = () => { e.textContent = emo; };   // 그림을 못 읽으면 그림 글자로
  im.src = EMO_IMG[emo]; e.appendChild(im);
  chatLayer().appendChild(e);
  const o = CHAT.pops[k] = { el: e }, done = () => { e.remove(); if (CHAT.pops[k] === o) delete CHAT.pops[k]; };
  chatPlace();
  const C = 'translate(-50%, -50%) ';
  e.animate([{ opacity: 0, transform: C + 'scale(.3)' }, { opacity: 1, transform: C + 'translateY(-3px) scale(1.5)', offset: 0.14 }, { opacity: 1, transform: C + 'translateY(-2px) scale(1.12)', offset: 0.28 }, { opacity: 1, transform: C + 'translateY(-4px) scale(1.12)', offset: 0.78 }, { opacity: 0, transform: C + 'translateY(-16px) scale(.95)' }], { duration: CHAT_POP_MS, easing: 'ease-out', fill: 'forwards' }).onfinish = done;
  setTimeout(done, CHAT_POP_MS + 400);   // 숨긴 창에선 애니메이션 끝 알림이 늦을 수 있음
}
function chatPlace() {   // 떠 있는 이모티콘을 그 사람 얼굴 가운데로(다시 그리기·스크롤·창 크기)
  const view = el('view-lobby'), body = view && view.querySelector('.lb-body');
  if (!view || !body) return;
  const vr = view.getBoundingClientRect(), br = body.getBoundingClientRect();
  for (const [k, o] of Object.entries(CHAT.pops)) {
    const a = chatAnchor(k), av = a && a.querySelector('.seat-av, .chip-av'), r = av && av.getBoundingClientRect();
    if (!r || !r.width || r.bottom < br.top + 4 || r.top > br.bottom - 4) { o.el.style.display = 'none'; continue; }   // 자리가 없거나 스크롤 밖
    const sz = a.classList.contains('seat') ? 46 : 32;   // 자리 = 46px(얼굴 30px을 덮고 조금 넘침 — 그림 가장자리는 빛이라 닉네임은 안 가림) · 관전 칩 = 32px
    o.el.style.display = ''; o.el.style.width = o.el.style.height = o.el.style.lineHeight = sz + 'px'; o.el.style.fontSize = Math.round(sz * 0.65) + 'px';
    o.el.style.left = (r.left + r.width / 2 - vr.left) + 'px'; o.el.style.top = (r.top + r.height / 2 - vr.top) + 'px';
  }
}
function chatMark() {   // 방금 말한 사람 자리 테두리(자리를 다시 그려도 남게 여기서 다시 붙임)
  const now = Date.now();
  for (const k of Object.keys(CHAT.talk)) if (CHAT.talk[k] <= now) delete CHAT.talk[k];
  for (const nm of el('view-lobby').querySelectorAll('.lb-nm[data-pk]')) { const a = nm.closest('.seat, .lb-chip'); if (a) a.classList.toggle('talk', !!CHAT.talk[nm.dataset.pk]); }
}
function chatRoom() {   // 방이 바뀌면 지난 방에서 본 말은 지움
  const id = (lobbyData && lobbyData.room && lobbyData.room.id) || null;
  if (id === CHAT.room) return;
  CHAT.room = id; CHAT.seen = {};
  for (const o of CHAT.rows.slice()) chatDrop(o, true);
}
// 🚨 v0.1.245 신고 — 무슨 일인지 한 줄 + 그 사람의 최근 말(이 앱이 받은 것)이 운영자에게 감 · 신고한 사실은 그 사람에게 안 보임
async function reportAsk(m) {
  const memo = await tnPrompt(`${m.name}님을 운영자에게 신고할까요?\n무슨 일이 있었는지 짧게 적어 주세요.\n이 사람의 최근 말이 같이 전달되고, 신고한 건 상대에게 보이지 않습니다.`, { title: '신고하기', ok: '신고', placeholder: '예) 계속 욕설을 해요', max: 200 });
  if (memo === null || memo === undefined) return;
  const r = await window.api.reportSend({ key: m.key, name: m.name, memo: String(memo).trim() }).catch(() => null);
  if (r && r.ok) tnAlert('신고했습니다. 운영자가 확인합니다.', { title: '신고 완료' }); else lbErr((r && r.err) || '신고를 보내지 못했습니다');
}
// ⚠️ v0.1.245 운영자 경고 — 처음 볼 때 한 번(확인을 누르면 다시 안 뜸)
if (window.api.onModWarn) window.api.onModWarn(d => {
  if (!d) return;
  tnAlert(`운영자에게 경고를 받았습니다${d.n > 1 ? ` (지금까지 ${d.n}번)` : ''}.\n사유 · ${d.reason || '—'}\n계속되면 채팅 금지나 이용 정지가 될 수 있습니다.`, { title: '운영자 경고', en: 'WARNING' }).then(() => window.api.warnSeen(d.at)).catch(() => {});
});
function chatMuteMark(L) {   // 💬 v0.1.245 채팅 금지면 입력 칸을 막고 언제까지인지
  const inp = el('lb-chat-in'), mm = L && L.myMute; if (!inp) return;
  inp.disabled = !!mm; inp.placeholder = mm ? `채팅 금지 · ${mm.txt}` : '한마디 · Enter';
  for (const id of ['lb-emo-btn', 'lb-chat-go']) { const b = el(id); if (b) b.disabled = !!mm; }
  el('lb-chat').classList.toggle('muted', !!mm);
}
async function chatSend(emo) {
  const inp = el('lb-chat-in'), t = emo || inp.value.replace(/\s+/g, ' ').trim();
  if (!t) return;
  if (!emo) inp.value = '';
  const r = await window.api.chatSend(t).catch(() => null);
  if (r && r.ok) chatShow({ key: r.key, text: r.text, at: r.at });   // 내 화면엔 바로
  else if (r && r.err && !(emo && r.slow)) lbErr(r.err);              // 이모티콘을 너무 빨리 누른 건 조용히 넘김
}
el('lb-chat-emo').innerHTML = EMO.map(e => '<button class="lb-emo" data-emo="' + e[0] + '" title="' + esc(e[1]) + '"><img src="' + EMO_IMG[e[0]] + '" alt="' + e[0] + '" draggable="false"></button>').join('');
el('lb-chat-emo').addEventListener('click', e => { const b = e.target.closest('[data-emo]'); if (b) { b.blur(); emoPop(false); chatSend(b.dataset.emo); } });
// 😊 v0.1.204 이모티콘 고르는 창 — 입력 줄 버튼으로 열고 닫음 · 고르면 보내고 닫힘 · 밖을 누르거나 Esc = 닫힘
function emoPop(on) { const p = el('lb-emo-pop'), b = el('lb-emo-btn'); if (!p) return; const v = on === undefined ? p.dataset.on !== '1' : !!on; popAnim(p, v, true); if (b) b.classList.toggle('on', v); }
el('lb-emo-btn').onclick = e => { e.stopPropagation(); emoPop(); };
document.addEventListener('mousedown', e => { const p = el('lb-emo-pop'); if (p && p.dataset.on === '1' && !(e.target.closest && e.target.closest('#lb-emo-pop, #lb-emo-btn'))) emoPop(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') emoPop(false); });
el('lb-chat-dn').onclick = () => { emoPop(false); chatFold(true); };
el('lb-chat-fold').onclick = () => { chatFold(false); el('lb-chat-in').focus(); };
chatFold(CHAT.fold);
// 한글을 조합하는 중에 Enter를 누르면(isComposing) 조합이 끝난 직후에 보냄 — 조합 중에 바로 보내면 마지막 글자가 빠지거나 두 번 감 · 조합이 끝난 뒤 Enter가 한 번 더 와도 입력 칸이 비어 있어 안 보냄
let _chatImeAt = 0;
el('lb-chat-in').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.target.blur(); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (e.isComposing) { _chatImeAt = Date.now(); return; }
  chatSend();
});
el('lb-chat-in').addEventListener('compositionend', () => { if (Date.now() - _chatImeAt < 400) { _chatImeAt = 0; setTimeout(chatSend, 0); } });
el('lb-chat-go').onclick = () => { chatSend(); el('lb-chat-in').focus(); };
document.addEventListener('keydown', e => {   // 대기실에서 그냥 Enter = 입력 줄로(접혀 있으면 펴고 · 다른 입력 칸·확인 창이 떠 있을 땐 그대로)
  if (e.key !== 'Enter' || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
  const t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT' || document.querySelector('.tn-mb')) return;
  const box = el('lb-chat');
  if (el('view-lobby').style.display === 'none' || !box || box.style.display === 'none') return;
  e.preventDefault();
  if (CHAT.fold) chatFold(false);
  el('lb-chat-in').focus();
});
{ const lbBody = document.querySelector('#view-lobby .lb-body'); if (lbBody) lbBody.addEventListener('scroll', () => { chatPlace(); pingPlace(); }, { passive: true }); }
window.addEventListener('resize', () => { chatPlace(); pingPlace(); });
if (window.api.onChat) window.api.onChat(chatShow);

// 📍 v0.1.220 대기실 핑 = 롤 핑 그대로(사장님: 내 얼굴이 아니라 마우스로 찍은 곳에 · 롤처럼 도배 제한 · 생김새도 최대한 롤처럼)
//   ✏️ v0.1.256(사장님: 스케치 느낌으로 귀엽게 · 대기실용 뜻으로) — 롤 핑 그림·소리·뜻 안 씀 · 그림 = tools/ping-sketch.cjs가 그린 분필 스케치 PNG(assets/ping) · 소리 = 실제 악기 녹음 VSCO-2 CC0(tools/ping-sfx.py · v0.1.257)
//   바퀴 = 가운데 여기 봐요 + 위에서 시계 방향 준비 완료 · 가자! · 좋아요 · ㅋㅋ · 잠깐만 · 미안 · ? · 고마워 · 판 = 손그림 원(assets/ping/wheel.png)
//   찍는 곳 = 마우스 자리 → 다른 PC 창 크기가 달라도 같은 곳에 뜨게 「무엇 위에 찍었는지」로 보냄: 자리 칸(s · 몇 번째 칸 + 칸 안 비율) · 관전 칩(c · 사람 + 비율) · 그 밖(v · 대기실 창 비율)
//   모양 = 찍은 곳에 핑 그림이 위에서 떨어져 박히고 바닥에 물결(타원) 두 번 + 아래 작게 보낸 사람 · 2.6초 · 여러 개 동시에 · 무한 애니메이션 없음
//   도배 제한(롤과 비슷하게) = 같은 핑 6초에 3번 · 모든 핑 5초에 6번 넘으면 10초 못 찍음 → main ping-send가 막고 남은 초를 알려 줌
const PING = {
  look: { t: '여기 봐요', c: '#7cc6ff', img: 'look' },
  ready: { t: '준비 완료', c: '#7be0b0', img: 'ready' },
  go: { t: '가자!', c: '#ff9f5a', img: 'go' },
  good: { t: '좋아요', c: '#a7e36b', img: 'good' },
  lol: { t: 'ㅋㅋ', c: '#ffd56b', img: 'lol' },
  wait: { t: '잠깐만', c: '#b9a4ff', img: 'wait' },
  sorry: { t: '미안', c: '#9fd8ff', img: 'sorry' },
  ask: { t: '?', c: '#ffc24d', img: 'ask' },
  thanks: { t: '고마워', c: '#ff9ccc', img: 'thanks' },
};
const PING_DIR = ['ready', 'go', 'good', 'lol', 'wait', 'sorry', 'ask', 'thanks'];   // 위에서 시계 방향 45°씩
const PING_MS = 2600, PW_R = 68;
const pingImg = k => `../assets/ping/${(PING[k] || PING.look).img}.png`;
const PINGS = [];   // 떠 있는 핑 {el, a, until}
function pingSeats() { return [...el('view-lobby').querySelectorAll('.lb-body .seat')]; }
function pingAnchorAt(x, y, target) {   // 찍은 곳 → 다른 PC에서도 같은 곳을 가리키는 표시
  const fr = (r) => ({ fx: +((x - r.left) / r.width).toFixed(3), fy: +((y - r.top) / r.height).toFixed(3) });
  const seat = target && target.closest && target.closest('.lb-body .seat');
  if (seat) { const i = pingSeats().indexOf(seat); if (i >= 0) return Object.assign({ t: 's', i }, fr(seat.getBoundingClientRect())); }
  const chip = target && target.closest && target.closest('.lb-chip'), nm = chip && chip.querySelector('.lb-nm[data-pk]');
  if (nm) return Object.assign({ t: 'c', pk: nm.dataset.pk }, fr(chip.getBoundingClientRect()));
  return Object.assign({ t: 'v' }, fr(el('view-lobby').getBoundingClientRect()));
}
function pingPoint(a) {   // 표시 → 지금 내 창의 좌표(대기실 창 기준) · 못 찾으면 null
  const vr = el('view-lobby').getBoundingClientRect();
  let r = null;
  if (a.t === 's') r = (pingSeats()[a.i] || null); else if (a.t === 'c') { const nm = [...el('view-lobby').querySelectorAll('.lb-chip .lb-nm[data-pk]')].find(x => x.dataset.pk === a.pk); r = nm ? nm.closest('.lb-chip') : null; }
  const rr = a.t === 'v' ? vr : r && r.getBoundingClientRect();
  if (!rr || !rr.width) return null;
  const x = rr.left + Math.max(0, Math.min(1, a.fx)) * rr.width - vr.left, y = rr.top + Math.max(0, Math.min(1, a.fy)) * rr.height - vr.top;
  if (a.t !== 'v') { const body = el('view-lobby').querySelector('.lb-body'), br = body && body.getBoundingClientRect(); if (br && (y + vr.top < br.top - 6 || y + vr.top > br.bottom + 6)) return null; }   // 스크롤 밖
  return { x, y };
}
function pingPlace() {
  const now = Date.now();
  for (let i = PINGS.length - 1; i >= 0; i--) {
    const p = PINGS[i];
    if (p.until <= now) { p.el.remove(); PINGS.splice(i, 1); continue; }
    const pt = pingPoint(p.a);
    p.el.style.display = pt ? '' : 'none';
    if (pt) { p.el.style.left = pt.x + 'px'; p.el.style.top = pt.y + 'px'; }
  }
}
// 🔊 핑 소리 = v0.1.257부터 실제 악기 녹음(VSCO-2 CC0 · 마림바·실로폰·글로켄·피치카토·나무 블록 · tools/ping-sfx.py · assets/ping/sfx · 약 -16 LUFS) · ⚙ 효과음 크기
// 크기(v0.1.226 실측): 핑 파일 평균 −14.7 LUFS(라이엇 원래 비율 그대로 — 신호는 조용하고 후퇴는 큼) × 0.14 ≈ −32 LUFS = 드래프트 픽 소리(−16 LUFS × 0.2 ≈ −30)보다 살짝 작게(자주 울려서) · 예전 0.55는 픽 소리보다 13dB 컸음
const PING_SFX = {}, PING_VOL = 0.14;
function pingSound(k) {
  try {
    const v = VOL(); if (!v) return;
    const a = PING_SFX[k] || (PING_SFX[k] = new Audio(`../assets/ping/sfx/${k}.ogg`));
    const c = a.cloneNode(); c.volume = Math.min(1, PING_VOL * v); c.play().catch(() => {});
  } catch (_) {}
}
function pingShow(d) {
  if (window.tnDemo && window.tnDemo.on) return;   // 사용법 예시 화면 위에는 실제 핑을 안 띄움
  if (!d || !PING[d.k] || !d.a || !/^[svc]$/.test(d.a.t)) return;
  const P = PING[d.k], fm = chatMember(d.from);
  const e = document.createElement('div');
  e.className = 'lb-wp'; e.style.setProperty('--pc', P.c);
  e.innerHTML = `<i class="g"></i><i class="g g2"></i><i class="s"></i><img class="ic" src="${pingImg(d.k)}" alt="" draggable="false"><b class="nm"></b>`;
  e.querySelector('.nm').textContent = (fm ? fm.name : '') + (fm ? ' · ' : '') + P.t;
  chatLayer().appendChild(e);
  PINGS.push({ el: e, a: d.a, until: Date.now() + PING_MS });
  pingSound(d.k);
  while (PINGS.length > 12) PINGS.shift().el.remove();
  pingPlace();
  e.animate([{ opacity: 1 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], { duration: PING_MS, fill: 'forwards' });
  setTimeout(pingPlace, PING_MS + 40);
}
if (window.api.onPing) window.api.onPing(pingShow);
// 바퀴 — 롤처럼: 어두운 원 + 8칸 · 끄는 쪽 칸이 핑 색으로 밝아짐 · 가운데 = 기본 핑 · 아래에 고른 이름
const PW = { on: false, x: 0, y: 0, a: null, sel: 'look' };
const PING_MUTE = [], PW_CR = 38;   // 가운데 원 반지름(이 안 = 신호)
function pingWheel() {   // 인게임 바퀴 모양(사장님 캡처): 큰 반투명 원판을 가는 선 8개가 나눔 · 가운데 금색 테두리 어두운 원 = 고른 핑 그림·이름 + 「🖱 뒤로」
  let w = el('lb-pw');
  if (!w) {
    w = document.createElement('div'); w.id = 'lb-pw'; w.className = 'lb-pw';
    const seg = PING_DIR.map((k, i) => `<div class="pw-s" data-k="${k}" style="--r:${i * 45}deg;--pc:${PING[k].c}"></div>`).join('');
    const ico = PING_DIR.map((k, i) => { const an = (i * 45 - 90) * Math.PI / 180; return `<img class="pw-i${PING_MUTE.includes(k) ? ' mute' : ''}" data-k="${k}" src="${pingImg(k)}" style="left:${(Math.cos(an) * PW_R).toFixed(1)}px;top:${(Math.sin(an) * PW_R).toFixed(1)}px" alt="" draggable="false">`; }).join('');
    w.innerHTML = `<div class="pw-bg"></div>${seg}${ico}<div class="pw-ctr"><img class="pw-ci" src="${pingImg('look')}" alt="" draggable="false"><b class="pw-t"></b><small><svg class="ms" viewBox="0 0 10 14"><rect x=".7" y=".7" width="8.6" height="12.6" rx="4.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 .7v5.2h4.3V5A4.3 4.3 0 0 0 5 .7z" fill="currentColor"/></svg>뒤로</small></div>`;
    el('view-lobby').appendChild(w);
  }
  return w;
}
function pingSel(mx, my) {
  const dx = mx - PW.x, dy = my - PW.y, d = Math.hypot(dx, dy);
  let sel = 'look';
  if (d > PW_CR * 0.8) { const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360 + 22.5) % 360; sel = PING_DIR[Math.floor(deg / 45) % 8]; }
  if (sel === PW.sel && el('lb-pw').dataset.sel === sel) return;
  PW.sel = sel;
  const w = el('lb-pw'); w.dataset.sel = sel;
  w.querySelectorAll('[data-k]').forEach(s => s.classList.toggle('on', s.dataset.k === sel));
  w.style.setProperty('--pc', PING[sel].c);
  w.querySelector('.pw-ci').src = pingImg(sel);
  w.querySelector('.pw-t').textContent = PING[sel].t;
}
function pingEnd(send) {
  if (!PW.on) return;
  PW.on = false;
  const w = el('lb-pw'); if (w) w.classList.remove('open');
  document.body.classList.remove('pw-drag');
  if (!send) return;
  const k = PW.sel, a = PW.a;
  window.api.pingSend(k, a).then(r => { if (r && r.ok) pingShow({ from: r.key, k: r.k, a: r.a, at: r.at }); else if (r && r.err) lbErr(r.err); }).catch(() => {});
}
el('view-lobby').addEventListener('mousedown', e => {
  if (PW.on && e.button === 2) { e.preventDefault(); pingEnd(false); return; }   // 오른쪽 클릭 = 취소(롤과 같음)
  if (!e.altKey || e.button !== 0 || !window.api.pingSend) return;
  const L = lobbyData, me = L && L.room && (L.members || []).find(m => m.me);
  if (!me) return;
  e.preventDefault(); e.stopPropagation();
  PW.a = pingAnchorAt(e.clientX, e.clientY, e.target);
  const vr = el('view-lobby').getBoundingClientRect(), w = pingWheel();
  PW.x = e.clientX; PW.y = e.clientY;   // 바퀴는 찍은 곳 가운데(롤과 같음) · 창 가장자리에서 조금 잘려도 됨
  w.style.left = (PW.x - vr.left) + 'px'; w.style.top = (PW.y - vr.top) + 'px';
  PW.on = true; w.classList.add('open'); document.body.classList.add('pw-drag');
  pingSel(e.clientX, e.clientY);
}, true);
el('view-lobby').addEventListener('contextmenu', e => { if (PW.on) e.preventDefault(); });
window.addEventListener('mousemove', e => { if (PW.on) pingSel(e.clientX, e.clientY); });
window.addEventListener('mouseup', e => { if (PW.on && e.button === 0) pingEnd(true); });
window.addEventListener('keydown', e => { if (PW.on && e.key === 'Escape') pingEnd(false); if (e.key === 'Alt') e.preventDefault(); });
window.addEventListener('blur', () => pingEnd(false));
