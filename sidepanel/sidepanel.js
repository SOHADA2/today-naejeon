// ── 투데이 내전 · 오른쪽 창 — 홈(첫 화면) · 기록 · 프로필 · 증강(가이드·패치 노트·뽑아 보기) ───────────────
//   v0.1.197 다시 설계(사장님: 왼쪽 창의 새 레이아웃·디자인을 오른쪽에도 · 시인성 · 처음 켰을 때 보여 줄 화면 · 글 줄이기)
//   · 왼쪽 레일(이모지 6칸) → 위쪽 글자 탭 4개 · 「진행」(방장 조작) 탭 → 홈의 「이번 판」 카드 · 「패치」「연구」 → 증강 탭 안 갈래
//   · 롤 로그인 전에도 탭은 그대로(홈 = 시작 안내 · 증강·패치는 로그인 없이 봄)
//   ⚠️ 이 창의 다른 스크립트(settings.js·augguide.js·patchnotes.js·auglab.js)와 최상위 이름이 겹치지 않게
const $ = id => document.getElementById(id);
const nn = s => String(s || '').trim().replace(/\s+/g, ' ');
const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('s-close').addEventListener('click', () => window.api.sideClose());
$('s-min').addEventListener('click', () => window.api.sideMinimize());

let _account = null, _myName = '', _isHost = false, _session = null, _curCat = 'home';
let _hostInfo = { host: null, isHost: false };

// ── 👤 계정 = 롤에 로그인된 라이엇 계정(자동) ─────────────────────────────────
function applyAccount(acc, isHost) {
  const changed = (_account && _account.puuid) !== (acc && acc.puuid);
  _account = acc || null; _myName = acc ? acc.gameName : '';
  if (isHost !== undefined) _isHost = !!isHost;
  if (!_account) _isHost = false;
  if (changed) { _hm.P = null; _hm.T = null; _hm.loaded = false; _pfArg = { me: true }; _todayData = null; switchCat('home'); }
  else if (_curCat === 'home') renderHome();
}
window.api.onAccount(d => applyAccount(d && d.account, d && d.isHost));
if (window.api.onMerged) window.api.onMerged(v => { document.body.classList.toggle('merged', !!v); });   // 🚪 합친 창 = 제목은 왼쪽 창 것만
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

// ── 👑 방장 — 맡기·넘겨주기·그만하기는 왼쪽 대기실(방 메뉴·아래 「방장 하기」)에서 · 여기는 누가 방장인지만 받아 「이번 판」 조작 버튼을 보여 줌 ──
function toast(msg) {
  const t = $('sp-toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3200);
}
function applyHost(d) {
  if (!d) return;
  _hostInfo = d;
  _isHost = !!d.isHost;
  if (d.note) toast(d.note);
  tabDot();
  if (_curCat === 'home') drawHome();
}
window.api.onHost(applyHost);

// ── 탭 ──────────────────────────────────────────────────────────────────
//   탭 = home · today · profile · aug(묶음: aug 가이드 · patch 패치 노트 · lab 뽑아 보기) — 다른 스크립트는 switchCat('aug') 등 예전 이름 그대로 부름
const CAT_GROUP = { aug: 'aug', patch: 'aug', lab: 'aug' };
let _augSub = 'aug';   // 증강 탭에서 마지막으로 본 갈래
function tabDot() {   // 방장이 이긴 팀을 골라야 하는데 홈이 아닌 탭을 보고 있으면 「홈」에 점
  const t = document.querySelector('.sp-tab[data-cat="home"]');
  if (t) t.classList.toggle('dot', !!(_isHost && _session && _session.phase === 'teams' && _session.pendingEog) && _curCat !== 'home');
}
function switchCat(cat) {
  _curCat = cat;
  const grp = CAT_GROUP[cat] || cat;
  if (grp === 'aug') _augSub = cat;
  document.querySelectorAll('.sp-tab').forEach(b => b.classList.toggle('on', b.dataset.cat === grp));
  $('sp-seg').style.display = grp === 'aug' ? '' : 'none';
  document.querySelectorAll('#sp-seg button').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
  document.querySelectorAll('.cat-view').forEach(v => { v.style.display = (v.id === 'cat-' + cat) ? 'flex' : 'none'; });
  tabDot();
  if (cat === 'home') renderHome();
  else if (cat === 'profile') renderProfile();
  else if (cat === 'aug') renderAugEdit();
  else if (cat === 'patch') renderPatch();   // 📰 v0.1.144 (patchnotes.js)
  else if (cat === 'lab') renderAugLab();    // 🧪 증강 연구 (auglab.js)
  else renderToday();
}
document.querySelectorAll('.sp-tab').forEach(b => b.addEventListener('click', () => {
  const c = b.dataset.cat;
  if (c === 'profile') _pfArg = { me: true };   // 탭을 누르면 늘 내 프로필(남의 프로필은 이름을 눌러서)
  switchCat(c === 'aug' ? _augSub : c);
}));
document.querySelectorAll('#sp-seg button').forEach(b => b.addEventListener('click', () => switchCat(b.dataset.cat)));

// ── 공용 ────────────────────────────────────────────────────────────────
const champIcon = id => id ? `<img class="pf-ci" src="https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png" onerror="this.style.visibility='hidden'" alt="">` : '<span class="pf-ci"></span>';
const md = day => { if (!day) return ''; const [, m, d] = day.split('-'); return `${Number(m)}/${Number(d)}`; };
const pct = (w, g) => g ? Math.round(w / g * 100) : 0;
const kdaOf = (k, d, a) => ((k + a) / Math.max(1, d)).toFixed(2);
const hhmm = ts => { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const AW_KO = { mvp: 'MVP', svp: 'SVP', manner: '매너' };
// 🏅 티어 문장(홈 「나」 카드·프로필 티어 칸 공용) — 롤 문장 그림 = 앱 안 파일(v0.1.199 · assets/rank · 바로 뜸) · tier = 소문자 티어 이름 · 티어가 없으면(배치 중·기록 없음) 흐린 자리 표시만
const spEmb = tier => `<i class="pf-emb">${tier && window.tnEmblem ? `<span class="rk-c">${window.tnEmblem(tier, 62, 54)}</span>` : '<i class="rk-fb"></i>'}</i>`;
// 한 판의 두 팀 줄(1팀 파랑 · 2팀 빨강 · 이긴 팀 = 청록 「승」) — 홈 「이번 판」·기록의 경기 카드가 같이 씀
function teamRows(m, win) {
  const row = (k, label) => `<div class="hm-team ${k === 'teamA' ? 't1' : 't2'}${win === k ? ' win' : ''}"><i>${label}</i><span>${(m[k] || []).map(escH).join(' · ')}</span>${win === k ? '<em>승</em>' : ''}</div>`;
  return `<div class="hm-teams">${row('teamA', '1팀')}${row('teamB', '2팀')}</div>`;
}
const awardRow = o => { const a = ['mvp', 'svp', 'manner'].filter(k => o && o[k]).map(k => `<span><em>${AW_KO[k]}</em><b>${escH(o[k])}</b></span>`).join(''); return a ? `<div class="hm-aw">${a}</div>` : ''; };

// ── 🏠 홈(첫 화면) — 나(티어) · 이번 판(진행 중일 때 · 방장 조작) · 오늘 · 바로 가기 ─────────────────
//   글은 카드마다 한두 줄만 · 자세한 것은 카드를 누르면 그 탭으로
const _hm = { P: null, T: null, patch: null, patchAsked: false, loaded: false, seq: 0, html: '', busy: false, err: '' };
async function renderHome() {
  const seq = ++_hm.seq;
  drawHome();
  const [P, T] = _account ? await Promise.all([window.api.getProfile({ me: true }).catch(() => null), window.api.getToday().catch(() => null)]) : [null, null];
  if (seq !== _hm.seq) return;
  _hm.P = P && P.ok ? P : null; _hm.T = T && T.ok ? T : null; _hm.loaded = true;
  drawHome();
  if (!_hm.patch && !_hm.patchAsked) {   // 바로 가기 「패치 노트」 칸의 최신 패치 번호(받을 때까지 · 메인이 3시간 보관)
    _hm.patchAsked = true;
    window.api.getAugPatches().then(p => { _hm.patch = (p && (p.patches || [])[0]) || null; if (_curCat === 'home') drawHome(); }).catch(() => {}).finally(() => { _hm.patchAsked = false; });
  }
}
// 보여 줄 티어 하나: 내전(티어 있음) → 일반(티어 있음) → 배치 중(내전 → 일반)
function hmTierPick(R) {
  const c = R && R.custom, m = R && R.mayhem, has = x => x && x.s != null && x.n >= 5;
  if (has(c)) return { x: c, label: '내전 티어' };
  if (has(m)) return { x: m, label: '일반 티어' };
  if (c && c.n) return { x: c, label: '내전 티어', pl: true };
  if (m && m.n) return { x: m, label: '일반 티어', pl: true };
  return null;
}
function hmMe() {
  const P = _hm.P, a = _account;
  const name = (P && P.name) || a.gameName, tag = (P && P.tag) || a.tagLine || '';
  const t = hmTierPick(P && P.rating), st = t && !t.pl ? scoreTier(t.x.s) : null;
  const sub = P ? (P.games ? `내전 ${P.games}판 <b>${P.wins}승</b> ${P.losses}패 · 승률 ${pct(P.wins, P.games)}%` : '아직 내전 기록이 없습니다') : (_hm.loaded ? '기록을 불러오지 못했습니다' : '불러오는 중');
  const tier = st ? `<span class="hm-tier">${spEmb(st.tier.toLowerCase())}<b>${tierLabel(st.tier, st.div)}</b><small>${t.label}</small></span>`
    : t ? `<span class="hm-tier none"><b>배치 <span class="num">${t.x.pl || t.x.n}/5</span></b><small>${t.label}</small></span>` : '';
  return `<button class="sp-card hm-me${st ? ' t t-' + st.tier.toLowerCase() : ''}" data-go="profile" title="내 프로필 보기">`
    + `<span class="hm-me-l"><span class="sp-en">PLAYER</span><b class="hm-nm"><span>${escH(name)}</span>${tag ? `<small>#${escH(tag)}</small>` : ''}</b><span class="hm-sub">${sub}</span></span>${tier}</button>`;
}
function hmStart() {   // 롤 로그인 전
  return `<div class="sp-card hm-start"><div class="sp-hd"><div class="sp-hd-tx"><span class="sp-en">START</span><b class="sp-t">롤에 로그인하면 시작됩니다</b></div></div>`
    + `<span class="sp-note">내 티어와 오늘 기록이 여기에 표시됩니다</span><span class="hm-wait"><i></i>롤 로그인을 기다리는 중</span></div>`;
}
// 이번 판 — 드래프트·게임·투표·결과 동안만 · 방장에게는 조작 버튼(예전 「진행」 탭)
function hmNow() {
  const s = _session;
  if (!s || !s.teamA || !s.teamB || !['draft', 'teams', 'vote', 'result'].includes(s.phase)) return '';
  const win = (s.phase === 'vote' || s.phase === 'result') && s.game ? s.game.winner : null;
  const dis = _hm.busy ? ' disabled' : '';
  let title, note = '', acts = '', extra = '', alert = false;
  if (s.phase === 'draft') {
    const tm = (s.order || [])[s.pickIdx || 0], caps = s.captains || {};
    title = '드래프트 중';
    note = `<b class="num">${s.pickIdx || 0}/${(s.order || []).length}</b>명 뽑음${tm ? ` · 지금 <b>${tm === 'teamA' ? '1팀' : '2팀'} ${escH(caps[tm] || '')}</b> 차례` : ''}`;
  } else if (s.phase === 'teams') {
    if (s.pendingEog) {
      alert = true; title = '이긴 팀을 골라 주세요';
      note = _isHost ? `게임 속 이름이 달라 자동으로 판정하지 못했습니다${s.pendingEog.winSide ? ` · 게임상 승리 <b>${s.pendingEog.winSide === 'blue' ? '블루' : '레드'}</b> 진영` : ''}` : '방장이 이긴 팀을 고르면 기록됩니다';
    } else { title = '이번 판 진행 중'; note = '게임이 끝나면 자동으로 기록됩니다'; }
    if (_isHost) acts = `<div class="hm-acts"><button class="ui-btn-ghost" data-act="win" data-w="teamA"${dis}>1팀 승리 기록</button><button class="ui-btn-ghost" data-act="win" data-w="teamB"${dis}>2팀 승리 기록</button></div>`;
  } else if (s.phase === 'vote') {
    const voters = [...s.teamA, ...s.teamB], votes = s.votes || {};
    const done = voters.filter(n => votes[nn(n).replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_')]).length;
    title = '투표 중'; note = `<b class="num">${done}/${voters.length}</b>명 투표`;
    if (_isHost) acts = `<div class="hm-acts"><button class="ui-btn-ghost" data-act="close"${dis}>투표 마감</button></div>`;
  } else {
    title = `${win === 'teamA' ? '1팀' : '2팀'} 승리`; extra = awardRow(s.result);
    if (_isHost) acts = `<div class="hm-acts"><button class="ui-btn-ghost" data-act="lobby"${dis}>대기실로</button><button class="ui-btn-gold" data-act="again"${dis}>같은 팀으로 한 판 더</button></div>`;
  }
  const h = _hostInfo.host;
  return `<div class="sp-card hm-now${alert ? ' alert' : ''}"><div class="sp-hd"><div class="sp-hd-tx"><span class="sp-en">NOW</span><b class="sp-t">${title}</b></div>${h && h.name ? `<span class="hm-host">방장 <b>${escH(h.name)}</b></span>` : ''}</div>`
    + teamRows(s, win) + extra + (note ? `<span class="sp-note">${note}</span>` : '') + acts + (_hm.err ? `<span class="hm-err">${escH(_hm.err)}</span>` : '') + `</div>`;
}
function hmToday() {
  const T = _hm.T, hd = (t, more) => `<div class="sp-hd"><div class="sp-hd-tx"><span class="sp-en">TODAY</span><b class="sp-t">${t}</b></div>${more ? '<button class="sp-more" data-go="today">전체 보기</button>' : ''}</div>`;
  if (!T) return `<div class="sp-card hm-today">${hd('오늘')}<span class="hm-none">${_hm.loaded ? '기록을 불러오지 못했습니다' : '불러오는 중'}</span></div>`;
  const n = T.matches.length, normals = T.normals || [], nm = normals.length, nwin = normals.filter(m => m.win).length;
  const me = T.standings.find(p => nn(p.name) === nn(_myName));
  if (!n && !nm) return `<div class="sp-card hm-today">${hd('오늘')}<span class="hm-none">오늘은 아직 경기가 없습니다</span></div>`;
  const stats = me ? `<div class="hm-stats"><div><span>내 전적</span><b><i>${me.wins}승</i> ${me.losses}패</b></div><div><span>순위</span><b>${me.rank}위</b></div><div><span>승률</span><b>${pct(me.wins, me.games)}%</b></div></div>` : '';
  const rank = n ? `<div class="hm-rank">${T.standings.slice(0, 3).map(p => `<div class="hm-rk${p === me ? ' me' : ''}"><i>${p.rank}</i><span>${escH(p.name)}</span><b>${p.wins}승 ${p.losses}패</b></div>`).join('')}</div>` : '';
  const norm = nm ? `<span class="hm-none">같이 한 일반 판 ${nwin}승 ${nm - nwin}패</span>` : '';
  return `<div class="sp-card hm-today">${hd(n ? `오늘 <span class="num">${n}</span>판` : '오늘', true)}${stats}${rank}${n ? '' : norm}</div>`;
}
function hmTiles() {
  const p = _hm.patch;
  const tiles = [
    ['aug', 'GUIDE', '증강 가이드', '챔피언별 추천'],
    ['patch', 'PATCH', '패치 노트', p ? `<b>${escH(p.patch)}</b>${(p.added || []).length ? ` · 신규 ${p.added.length}` : (p.changes || []).length ? ` · 조정 ${p.changes.length}` : ''}` : '증강 변경점'],
    ['draw', 'DRAW', '증강 뽑아 보기', '카드 3장 고르기'],
    ['help', 'HELP', '사용법', '처음이라면'],
  ];
  return `<div class="hm-grid">${tiles.map(([k, en, t, sub]) => `<button class="hm-tile" data-tile="${k}"><span class="sp-en">${en}</span><b>${t}</b><small>${sub}</small></button>`).join('')}</div>`;
}
function drawHome() {
  const body = $('hm-body'); if (!body) return;
  const h = (_account ? hmMe() + hmNow() + hmToday() : hmStart()) + hmTiles();
  if (h === _hm.html) return;   // 같은 내용이면 다시 안 그림
  _hm.html = h; body.innerHTML = h;
  body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === 'profile') _pfArg = { me: true }; switchCat(b.dataset.go); });
  body.querySelectorAll('[data-tile]').forEach(b => b.onclick = () => {
    const k = b.dataset.tile;
    if (k === 'draw') window.api.auglabOpen(); else if (k === 'help') window.api.openTutorial(); else switchCat(k);
  });
  body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const k = b.dataset.act, w = b.dataset.w;
    if (k === 'win') liveAct(() => window.api.hostResult(w), `${w === 'teamA' ? '1팀' : '2팀'} 승리로 기록할까요?`, '기록');
    else if (k === 'close') liveAct(() => window.api.voteClose());
    else if (k === 'again') liveAct(() => window.api.tbAgain());
    else if (k === 'lobby') liveAct(() => window.api.lobbyReopen());
  });
}
// 방장 조작(승리 기록·투표 마감·한 판 더·대기실로) — 누르는 동안 버튼 잠금 · 실패하면 카드 안에 이유
async function liveAct(fn, ask, okLabel) {
  if (_hm.busy) return;
  if (ask && !await tnConfirm(ask, { ok: okLabel })) return;
  _hm.busy = true; _hm.err = ''; drawHome();
  const r = await fn().catch(e => ({ ok: false, err: String(e) }));
  _hm.busy = false;
  if (!r || !r.ok) _hm.err = (r && r.err) || '실패했습니다 · 다시 눌러 주세요';
  drawHome();
}
window.api.onTeamBuild(d => { if (d && d.state === 'error') { _hm.err = d.err || ''; if (_curCat === 'home') drawHome(); } });

// ── 📅 기록(날짜별) — 순위 · 경기 · 같이 한 일반 판 ───────────────────────────────
let _day = null, _todayKey = null, _todayData = null, _standing = {};   // _standing = 이름 → 오늘 전적
function shiftDay(key, n) { const [y, m, d] = key.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
$('td-prev').onclick = () => { if (_day) { _day = shiftDay(_day, -1); renderToday(); } };
$('td-next').onclick = () => { if (_day && _day < _todayKey) { _day = shiftDay(_day, 1); renderToday(); } };
async function renderToday() {
  const body = $('td-body');
  if (!_todayData) body.innerHTML = '<div class="td-empty">불러오는 중</div>';
  const t = await window.api.getToday(_day).catch(() => null);
  if (!t || !t.ok) { body.innerHTML = '<div class="td-empty"><b>기록을 불러오지 못했습니다</b>인터넷 연결을 확인해 주세요</div>'; return; }
  _todayKey = t.today; _day = t.day;
  if (t.day === t.today) { _todayData = t; _standing = {}; t.standings.forEach(p => { _standing[nn(p.name)] = p; }); }
  const [, mm, dd] = t.day.split('-');
  $('td-day').textContent = (t.day === t.today ? '오늘 · ' : '') + `${Number(mm)}월 ${Number(dd)}일`;
  $('td-next').disabled = t.day >= t.today;
  const normals = t.normals || [];
  if (!t.matches.length && !normals.length) { body.innerHTML = `<div class="td-empty"><b>${t.day === t.today ? '오늘은 아직 경기가 없습니다' : '이 날은 경기가 없습니다'}</b>${t.day === t.today ? '한 판이 끝나면 순위가 여기에 쌓입니다' : ''}</div>`; return; }
  const zero = v => v ? `<td>${v}</td>` : '<td class="z">·</td>';
  const rows = t.standings.map(p => {
    const kda = p.d || p.k || p.a ? ((p.k + p.a) / Math.max(1, p.d)).toFixed(1) : '-';
    return `<tr class="${nn(p.name) === nn(_myName) ? 'me' : ''}"><td class="r">${p.rank}</td><td class="n"><a class="pf-link" data-name="${escH(p.name)}">${escH(p.name)}</a></td><td>${p.wins}-${p.losses}</td><td>${pct(p.wins, p.games)}%</td>${zero(p.mvp)}${zero(p.manner)}<td>${kda}</td></tr>`;
  }).join('');
  const games = t.matches.map((m, i) => `<div class="rc-g"><div class="rc-gh"><b>${t.matches.length - i}판</b><span class="num">${hhmm(m.ts)}</span>${m.source === 'manual' ? '<span class="rc-tag">직접 기록</span>' : ''}`
    + `${m.potg && !m.potg.none ? `<button class="rc-pg" data-pg="m${i}" title="팟지 다시 보기">팟지</button>` : ''}</div>${teamRows(m, m.winner)}${awardRow(m)}</div>`).join('');
  // 🎮 같이 한 일반 판(v0.1.48) — 내전 순위와 따로 · 우리 팀(앱 켠 사람)만 · 재미 지표 · 팟지 다시 보기
  const nwin = normals.filter(m => m.win).length;
  const ngames = normals.map((m, i) => {
    const ps = (m.players || []).map(p => `<span class="nm-p">${champIcon(p.champId)}<span class="nm-pn"><a class="pf-link" data-name="${escH(p.name)}">${escH(p.name)}</a><small>${p.k}/${p.d}/${p.a}</small></span></span>`).join('');
    const fun = (m.fun || []).map(x => `<span class="nm-f ${x.k}"><em>${escH(x.label)}</em><span class="nm-fn">${escH(x.name)}</span>${x.v ? `<small>${escH(x.v)}</small>` : ''}</span>`).join('');
    return `<div class="rc-g nm"><div class="rc-gh"><span class="nm-res ${m.win ? 'w' : 'l'}">${m.win ? '승' : '패'}</span><b>${escH(m.queue || '일반 게임')}</b><span class="num">${hhmm(m.ts)}</span>${m.gameTime ? `<span class="nm-len num">${Math.round(m.gameTime / 60)}분</span>` : ''}${m.potg && !m.potg.none ? `<button class="rc-pg" data-pg="n${i}" title="팟지·숨은 영웅 다시 보기">팟지</button>` : ''}</div>`
      + `<div class="nm-ps">${ps}</div>${fun ? `<div class="nm-fun">${fun}</div>` : ''}</div>`;
  }).join('');
  body.innerHTML = (t.matches.length ? `<div class="td-sec">순위<small>${t.matches.length}판</small></div>`
    + `<table class="td-table"><thead><tr><th>#</th><th class="n">이름</th><th>전적</th><th>승률</th><th>MVP</th><th>매너</th><th>KDA</th></tr></thead><tbody>${rows}</tbody></table>`
    + `<div class="td-sec">경기</div>${games}` : '')
    + (normals.length ? `<div class="td-sec">같이 한 일반 판<small>${nwin}승 ${normals.length - nwin}패 · 내전 순위와 따로</small></div>${ngames}` : '');
  body.querySelectorAll('.pf-link').forEach(a => a.onclick = () => openProfile({ name: a.textContent }));
  body.querySelectorAll('.rc-pg').forEach(b => b.onclick = () => { const k = b.dataset.pg, m = (k[0] === 'm' ? t.matches : normals)[+k.slice(1)]; if (m && m.potg) window.api.potgOpen(m.potg); });
}

// ── 👤 개인 내전 프로필 ─────────────────────────────────────────────────────
// 지금까지 모든 날의 기록을 사람별로 모음: 전적·연승·수상·KDA·챔피언·최고 기록·찰떡 팀원·천적·최근 10판
let _pfArg = { me: true };
function openProfile(arg) { _pfArg = arg || { me: true }; switchCat('profile'); }
window.api.onOpenProfile(arg => openProfile(arg));
let _augMapP = null;
const augMapP = async () => _augMapP || (_augMapP = await window.api.getAugments().catch(() => ({})) || {});
// 🏅 전적 기반 점수(v0.1.111) → 롤 티어 이름: 8점마다 한 티어 · 2점마다 한 단계(4 → 1) · 마스터부터 단계 없음(우리끼리 점수 · 공식 랭크 아님)
//   ⚠️ rating.js `tierOf`와 같은 표(메인은 이 파일을 못 불러서 두 군데 · 바꾸면 둘 다)
const TIER_KO = { IRON: '아이언', BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘', EMERALD: '에메랄드', DIAMOND: '다이아', MASTER: '마스터', GRANDMASTER: '그마', CHALLENGER: '챌린저' };
const SCORE_TIERS = [[90, 'CHALLENGER'], [84, 'GRANDMASTER'], [78, 'MASTER'], [70, 'DIAMOND'], [62, 'EMERALD'], [54, 'PLATINUM'], [46, 'GOLD'], [38, 'SILVER'], [30, 'BRONZE']];   // 가장 낮은 티어 = 브론즈(v0.1.200 아이언 없앰 · rating.js와 같은 표)
function scoreTier(s) {
  const i = SCORE_TIERS.findIndex(([lo]) => s >= lo), [lo, tier] = SCORE_TIERS[i < 0 ? SCORE_TIERS.length - 1 : i];
  return { tier, div: ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? null : Math.max(1, 4 - Math.max(0, Math.floor((s - lo) / 2))) };
}
const tierLabel = (tier, div) => `${TIER_KO[tier] || tier}${div ? ' ' + div : ''}`;
//   v0.1.114(사장님): **아수라장 내전**(이 앱으로 기록한 판) · **아수라장 일반**(내전 제외) 두 줄
// 🎬 v0.1.116(사장님: 프로필 티어 칸을 누르면 그 공개 애니메이션 — 본인 거 보게) — 티어가 나온 칸만 · 이 창 안에서 overlay/tierreveal.js 카드(dir 'replay')
let _pfTiers = [];
function pfTierReplay(i) { const d = _pfTiers[i]; if (d && window.tnTierReveal) window.tnTierReveal(d); }
function ratingRow(R, me, who) {
  // 🏅 티어 칸(`.pf-mh` · v0.1.198 새 카드 모양) · 「?」 = 근거 펼치기(평소엔 접혀 있음 — 글 줄이기)
  _pfTiers = [];
  const season = (R && R.season) || '시즌 3 · 26.21~';   // 🗓️ 아수라장 큰 업데이트(시즌)부터 계속 누적 — 값은 main(rating.SEASON)
  const row = (x, en, label, src, from, none, kind) => {
    const st = x && x.s != null && x.n >= 5 ? scoreTier(x.s) : null;
    const why = x && x.n ? `${src} <b>${x.n}판</b>(${from}) 기준 · 점수 = 승률 + 경기력(팀 안 딜 순위·킬 관여·KDA) · 최근 판일수록 크게 · 8점마다 한 티어 · <b>우리끼리 점수</b>(공식 랭크 아님)` : `${none} · 우리끼리 점수(공식 랭크 아님)`;
    const tap = st ? _pfTiers.push({ kind, season, tier: st.tier, div: st.div, s: x.s, n: x.n, w: x.w, wr: x.wr, kda: x.kda, dir: 'replay', who: me ? null : who }) - 1 : -1;
    // 카드 한 장 = [문장] [영문 라벨 + 작은 한글 / 티어 이름 / 점수·판·승률] [?]
    const card = (cls, tier, main, sub) => `<div class="pf-mh ${cls}${tap >= 0 ? ' tap' : ''}"${tap >= 0 ? ` onclick="pfTierReplay(${tap})" title="눌러서 티어 공개 다시 보기"` : ''}>${spEmb(tier)}`
      + `<div class="pf-mh-tx"><span class="pf-mh-lb"><span class="sp-en">${en}</span><i>${label}</i></span><b>${main}</b><em>${sub}</em></div>`
      + `<button class="pf-mh-q" title="어떻게 매긴 티어인지" onclick="event.stopPropagation();this.classList.toggle('on');this.parentNode.nextElementSibling.hidden=!this.classList.contains('on')">?</button></div><div class="pf-mh-why" hidden>${why}</div>`;
    return !x ? card('none', '', '아직 없음', '5판부터 티어가 나옵니다')
      : st ? card('t-' + st.tier.toLowerCase(), st.tier.toLowerCase(), tierLabel(st.tier, st.div), `<b>${x.s}점</b> · ${x.n}판 ${x.w}승 · 승률 ${Math.round(x.wr * 100)}%`)
      : card('none', '', `배치 ${x.pl || x.n}/5`, `${x.n}판 ${x.w}승 · 5판부터 티어`);
  };
  return `<div class="pf-tiers">${row(R && R.custom, 'IN-HOUSE TIER', '아수라장 내전', '투데이 내전으로 기록된 아수라장 내전', `아수라장 ${season} · 투데이 내전 기록 전부`, '투데이 내전으로 아수라장 내전을 5판 하면 티어가 나옵니다', 'custom')}`
    + `${row(R && R.mayhem, 'NORMAL TIER', '아수라장 일반', '아수라장 일반 판(내전 제외)', R && R.mhSrv ? `아수라장 ${season} · 투데이 내전으로 같이 한 판 · 친구들 기록에서 셈` : `아수라장 ${season} · 롤 전적 + 투데이 내전으로 같이 한 판 · 계속 쌓임`, `롤을 켜 두면 아수라장 ${season} 일반 판(5판부터)으로 티어를 매깁니다`, 'mayhem')}</div>`;
}
async function renderProfile() {
  const body = $('pf-body'), arg = _pfArg;
  body.innerHTML = '<div class="td-empty">불러오는 중</div>';
  const [P, AUG] = await Promise.all([window.api.getProfile(arg).catch(() => null), augMapP()]);
  if (arg !== _pfArg) return;   // 그사이 다른 사람을 눌렀으면 버림
  if (!P || !P.ok) { body.innerHTML = `<div class="td-empty"><b>${arg.me && !_account ? '롤에 로그인하면 내 프로필이 표시됩니다' : '프로필을 불러오지 못했습니다'}</b></div>`; return; }
  const head = `<div class="sp-card pf-head"><div class="sp-hd-tx"><span class="sp-en">${P.me ? 'MY PROFILE' : 'PLAYER'}</span><b class="pf-nm"><span>${escH(P.name)}</span>${P.tag ? `<small>#${escH(P.tag)}</small>` : ''}</b>`
    + `<span class="pf-sub">${P.games ? `첫 내전 ${md(P.first)} · 내전 ${P.days}일 · 마지막 ${md(P.last)}` : '아직 내전 기록이 없습니다'}</span></div>${P.me ? '' : '<button class="sp-mini" id="pf-back">내 프로필</button>'}</div>`
    + (P.key && String(P.key).startsWith('p:') ? ratingRow(P.rating, P.me, P.name) : '');   // 🏅 계정이 확인된 사람만(이름만 있는 손님은 전적을 못 읽음)
  const bindHead = () => { const bk = $('pf-back'); if (bk) bk.onclick = () => openProfile({ me: true }); };
  if (!P.games) { body.innerHTML = head + '<div class="td-empty">내전을 한 판 하면 여기에 기록이 쌓입니다</div>'; bindHead(); return; }
  const streak = P.streak > 0 ? `<b class="w">${P.streak}연승</b>` : `<b class="l">${-P.streak}연패</b>`;
  const big = `<div class="pf-big">`
    + `<div><span>전적</span><b>${P.wins}승 ${P.losses}패</b><em>승률 ${pct(P.wins, P.games)}%</em></div>`
    + `<div><span>지금</span>${streak}<em>최고 ${P.bestStreak}연승</em></div></div>`
    + `<div class="pf-aw">${[['MVP', P.mvp], ['SVP', P.svp], ['매너왕', P.manner]].map(([k, v]) => `<div class="${v ? '' : 'zero'}"><span>${k}</span><b class="num">${v}</b></div>`).join('')}</div>`;
  const sec = (t, sm) => `<div class="td-sec">${t}${sm ? `<small>${sm}</small>` : ''}</div>`, list = rows => `<div class="pf-list">${rows}</div>`;
  let play = '';
  if (P.statGames) {
    const n = P.statGames, min = P.time / 60;
    const multi = [P.penta ? `펜타 ${P.penta}` : '', P.quadra ? `쿼드라 ${P.quadra}` : '', P.triple ? `트리플 ${P.triple}` : '', P.double ? `더블 ${P.double}` : ''].filter(Boolean).join(' · ') || '없음';
    play = sec('플레이', `${n}판 평균`) + `<div class="pf-grid">`
      + `<div><span>KDA</span><b>${(P.k / n).toFixed(1)} / ${(P.d / n).toFixed(1)} / ${(P.a / n).toFixed(1)}</b><em>${kdaOf(P.k, P.d, P.a)}</em></div>`
      + `<div><span>피해량</span><b>${Math.round(P.damage / n).toLocaleString()}</b><em>${min ? `분당 ${Math.round(P.damage / min).toLocaleString()}` : ''}</em></div>`
      + `<div><span>골드</span><b>${Math.round(P.gold / n).toLocaleString()}</b><em>CS ${Math.round(P.cs / n)}</em></div>`
      + `<div><span>멀티킬</span><b class="sm">${multi}</b><em>퍼블 ${P.firstBlood}번</em></div></div>`;
  }
  const champs = P.champs.length ? sec('많이 한 챔피언') + list(P.champs.map(c =>
    `<div class="pf-row">${champIcon(c.id)}<span class="pf-rn">${escH(c.name || '?')}</span><span class="pf-rv">${c.games}판 ${pct(c.wins, c.games)}%</span><span class="pf-rk">${kdaOf(c.k, c.d, c.a)}</span></div>`).join('')) : '';
  const augs = (P.augs || []).length ? sec('많이 고른 증강') + list(P.augs.map(x => { const a = AUG[x.id] || {};
    return `<div class="pf-row"><i class="pf-aug ${a.rarity || ''}">${a.icon ? `<img src="${a.icon}" alt="" onerror="this.remove()">` : ''}<b>?</b></i><span class="pf-rn">${escH(a.name || '증강 #' + x.id)}</span><span class="pf-rv">${x.games}번 ${pct(x.wins, x.games)}%</span></div>`; }).join('')) : '';
  const B = P.best, bestRow = (label, b, fmt) => b ? `<div class="pf-row">${champIcon(b.champId)}<span class="pf-rn">${label}</span><span class="pf-rv">${fmt(b.v)}</span><span class="pf-rk">${escH(b.champ || '')} · ${md(b.day)}</span></div>` : '';
  const best = (B.kills || B.damage || B.kda) ? sec('최고 기록') + list(bestRow('최다 킬', B.kills, v => v + '킬') + bestRow('최고 피해량', B.damage, v => v.toLocaleString()) + bestRow('최고 KDA', B.kda, v => v) + bestRow('최다 어시', B.assists, v => v + '어시')) : '';
  const pals = (label, rows, hint) => rows.length ? sec(label, hint) + list(rows.map(x =>
    `<div class="pf-row"><a class="pf-rn pf-link">${escH(x.name)}</a><span class="pf-rv">${x.games}판 ${x.wins}승</span><span class="pf-rk">${pct(x.wins, x.games)}%</span></div>`).join('')) : '';
  const recent = sec(`최근 ${P.recent.length}판`) + list(P.recent.map(g =>
    `<div class="pf-row pf-g ${g.win ? 'w' : 'l'}"><span class="pf-wl">${g.win ? '승' : '패'}</span>${champIcon(g.champId)}<span class="pf-rn">${escH(g.champ || '결과만 기록')}</span>`
    + `<span class="pf-rv">${g.k != null ? `${g.k}/${g.d}/${g.a}` : ''}</span><span class="pf-rk">${(g.aw || []).map(a => `<i class="pf-awc">${AW_KO[a] || ''}</i>`).join('')}${md(g.day)}</span></div>`).join(''));
  body.innerHTML = head + big + play + champs + augs + best
    + pals('찰떡 팀원', P.mates, '같은 팀 승률 · 2판 이상') + pals('천적', P.rivals, '상대로 만난 승률 · 2판 이상') + recent;
  bindHead();
  body.querySelectorAll('.pf-link').forEach(a => a.onclick = () => openProfile({ name: a.textContent }));
}

// ── 세션 실시간 ─────────────────────────────────────────────────────────
let _lastPhaseSig = '';
window.api.onSession(({ session }) => {
  _session = session || null;
  tabDot();
  const sig = session ? `${session.phase}:${session.lastGameId || ''}:${session.result ? 1 : 0}` : '';
  const changed = sig !== _lastPhaseSig; _lastPhaseSig = sig;
  if (changed) _todayData = null;
  if (_curCat === 'home') { if (changed) renderHome(); else drawHome(); }   // 판 단계가 바뀌면 오늘 기록·전적도 다시 받음
  else if (changed && _curCat === 'today' && _day === _todayKey) renderToday();
});

// ── 시작 ────────────────────────────────────────────────────────────────
(async () => {
  switchCat('home');
  const d = await window.api.getPlayers().catch(() => null);
  if (d) {
    _session = d.session || null;
    $('s-ver').textContent = d.appVer ? 'TODAY IN-HOUSE · v' + d.appVer : '';
    if (d.account) applyAccount(d.account, d.isHost);
  }
  applyHost(await window.api.getHost().catch(() => null));
})();
