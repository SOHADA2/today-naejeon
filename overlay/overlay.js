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
function applySession({ session, myName: mn, isHost }) {
  const prevPhase = sessionData && sessionData.phase;
  sessionData = session || null;
  const f = (session && session.teamsFormedAt) || 0;
  if (f && f !== _lastFormedSeen) { _lastFormedSeen = f; _gamePlayed = false; }
  if (mn !== undefined) myName = mn || '';
  if (isHost !== undefined) myIsHost = !!isHost;
  if (session && session.phase !== prevPhase) _todayAt = 0;   // 단계 바뀜(경기 기록됨 등) → 오늘 순위 새로
  render();
}
window.api.onSession(applySession);
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
  const rec = st ? `<span class="lp"><span class="num">${st.wins}</span>승 <span class="num">${st.losses}</span>패</span>` : '';
  return `<li${me}><span class="no num">${i + 1}</span><span class="nm">${esc(name)}</span>${rec}</li>`;
}
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
    if (b.disabled || !confirm(ask)) return;
    b.disabled = true;
    const r = await window.api.lobbyReopen().catch(e => ({ ok: false, err: String(e) }));
    b.disabled = false;
    if (!r || !r.ok) alert('취소 실패 · ' + ((r && r.err) || '다시 눌러주세요'));
  };
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
    : `<b>${team === 'teamA' ? '1팀' : '2팀'} 팀장 <span class="dr-capn">${esc(cap || '')}</span></b> <span class="dr-nw">고르는 중</span> <span class="dr-sec">${left}초</span>`;
  const col = (tm, label) => {
    const arr = s[tm] || [], size = s.teamSize || arr.length;
    const rows = arr.map((n, i) => `<li class="${nn(n) === nn(myName) ? 'me' : ''}${_pickWait && nn(_pickWait) === nn(n) ? ' pk-wait' : ''}">${i === 0 ? '<span class="dr-cap">팀장</span>' : ''}<span class="nm">${esc(n)}</span></li>`).join('');
    const empty = Array.from({ length: Math.max(0, size - arr.length) }, () => '<li class="empty">—</li>').join('');
    return `<div class="dr-th${team === tm ? ' on' : ''}">${label}<span>${arr.length}/${size}</span></div><ul>${rows}${empty}</ul>`;
  };
  el('dr-order').innerHTML = orderBar(s.order || [], s.pickIdx || 0);
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
  pb.style.display = P && !P.none && !P.pending && P.gameId === String(g.id) ? '' : 'none';   // pending = 방장 PC가 리플레이 녹화 중
  if (P && !P.none) pb.textContent = `팟지 다시 보기 · ${P.name} ${P.label}`;
  pb.onclick = () => window.api.potgReplay();
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
const SEATS = 10;   // 최대 5:5
const iconUrl = id => id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${Number(id)}.jpg` : '';
const champUrl = id => id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png` : '';
function avatar(m, cls) {
  const ini = esc(String(m.name || '?').trim().charAt(0) || '?');
  return `<span class="${cls}">${m.icon ? `<img src="${iconUrl(m.icon)}" alt="" onerror="this.remove()">` : ''}<i>${ini}</i></span>`;
}
const verLt = (a, b) => { const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0; } return false; };   // 🔄 a가 b보다 옛 버전(v0.1.56)
function renderLobby() {
  const L = lobbyData || { members: [], mode: 'random', captains: {} };
  const M = L.members || [], caps = L.captains || {}, draft = L.mode === 'draft', manual = L.mode === 'manual', sides = L.sides || {};
  const ins = M.filter(m => m.st === 'in'), specs = M.filter(m => m.st === 'spec');
  const sA = ins.filter(m => sides[m.name] === 'teamA'), sB = ins.filter(m => sides[m.name] === 'teamB'), sNone = ins.filter(m => !sides[m.name]);   // 🧩 직접
  const me = M.find(m => m.me);
  el('lb-head').innerHTML = !myName ? '<span class="lb-wait"><span class="lobby-pulse"></span>롤 클라이언트에 로그인하면 자동으로 입장돼요</span>'
    : `<span class="lb-title"><span class="lb-en">LOBBY</span><b>대기실</b></span>`
      + (myIsHost ? '<button id="lb-hostme" class="lb-hostme">👑 내가 방장 <i>▾</i></button>'
        : `<span class="lb-host">${L.hostName ? `<em>방장</em><span class="lb-hn">${esc(L.hostName)}</span>` : '<em class="no">방장 없음</em>'}</span>`);
  { // 👑 방장 자리 — 아무도 없으면(또는 응답 없으면) 대기실 맨 위에 큰 버튼
    const cta = el('lb-hostcta'), need = myName && !myIsHost && !L.hostName;
    cta.style.display = need ? '' : 'none';
    if (need) {
      // v0.1.39: 설명 글 대신 버튼만 — 설명은 마우스를 올리면(tn-tip)
      cta.dataset.tip = (L.hostStale ? `방장 ${L.hostStale}님이 1분 넘게 응답이 없어요.\n` : '') + '방장은 방식을 고르고 「시작」을 눌러 팀을 짜요.\n경기 기록·투표 마감도 방장 앱이 해요.';
      cta.innerHTML = `<button id="lb-hc-go" class="ui-btn-gold lb-hc-go">👑 ${L.hostStale ? '방장 이어받기' : '방장 하기'}</button>`;
      el('lb-hc-go').onclick = () => lbAct(() => window.api.setHost(true));
    }
    const hm = el('lb-hostme'); if (hm) hm.onclick = e => { e.stopPropagation(); toggleHostMenu(L); };
    if (!myIsHost) el('lb-hostmenu').style.display = 'none';
  }
  document.querySelectorAll('.lb-seg').forEach(b => {
    b.classList.toggle('on', b.dataset.mode === L.mode);
    b.disabled = !myIsHost;
    b.onclick = () => { if (myIsHost && b.dataset.mode !== L.mode) lbAct(() => window.api.lobbyMode(b.dataset.mode)); };
  });
  const cb = el('lb-caps');
  cb.style.display = draft || manual ? '' : 'none';
  if (draft) cb.innerHTML = `<span class="lb-cap t1"><em>1팀 팀장</em><b>${caps.teamA ? esc(caps.teamA) : '미정'}</b></span><span class="lb-cap t2"><em>2팀 팀장</em><b>${caps.teamB ? esc(caps.teamB) : '미정'}</b></span>`
    + (myIsHost ? '<button id="lb-caprand" class="lb-mini">랜덤 팀장</button>' : '');
  if (manual) cb.innerHTML = `<span class="lb-cap t1"><em>1팀</em><b class="num">${sA.length}</b></span><span class="lb-cap t2"><em>2팀</em><b class="num">${sB.length}</b></span>`
    + (sNone.length ? `<span class="lb-cap"><em>미정</em><b class="num">${sNone.length}</b></span>` : '')
    + (myIsHost ? '<button id="lb-sprev" class="lb-mini">지난 판 팀 그대로</button>' + (sA.length + sB.length ? '<button id="lb-sclr" class="lb-mini plain">비우기</button>' : '') : '');
  const cr = el('lb-caprand'); if (cr) cr.onclick = () => lbAct(() => window.api.lobbyCaptain(null, true));
  const sp = el('lb-sprev'); if (sp) sp.onclick = () => lbAct(() => window.api.lobbySidesPrev());
  const sc = el('lb-sclr'); if (sc) sc.onclick = () => lbAct(() => window.api.lobbySidesClear());
  { // 🎯 드래프트면 뽑는 순서 미리보기(선픽은 동전으로 정해짐 → 선/후로 표시)
    const n = M.filter(m => m.st === 'in').length, ts = Math.min(5, Math.floor(n / 2)), picks = Math.max(0, (ts - 1) * 2);
    const ob = el('lb-order'), ord = [];
    for (let i = 0; i < picks; i++) ord.push(((i + 1) >> 1) % 2 === 0 ? 'teamA' : 'teamB');   // main draftOrder와 같은 스네이크
    ob.style.display = draft && picks ? '' : 'none';
    if (draft && picks) ob.innerHTML = `<span class="ord-l">PICK ORDER</span>` + orderBar(ord, 0, true);
  }
  // 🪑 자리 10칸 — 참가한 사람 순서대로 앉고 나머지는 빈 자리
  const capOf = n => nn(n) === nn(caps.teamA) ? 1 : nn(n) === nn(caps.teamB) ? 2 : 0;
  el('lb-seat-cnt').innerHTML = manual ? `<b>${sA.length}</b> : <b>${sB.length}</b>` : `<b>${Math.min(ins.length, SEATS)}</b> / ${SEATS}${ins.length > SEATS ? ` <em>+${ins.length - SEATS}명 대기</em>` : ''}`;
  const seat = (m, i, side) => {   // side = 직접 방식의 팀 열(왼쪽 1팀 · 오른쪽 2팀)
    const no = String(i + 1).padStart(2, '0'), sn = side === 'teamA' ? 1 : side === 'teamB' ? 2 : 0;
    if (!m) return `<div class="seat empty${sn ? ' side' + sn : ''}"><span class="seat-no">${no}</span><span class="seat-av"></span><span class="seat-main"><b>${sn ? sn + '팀 빈 자리' : '빈 자리'}</b></span></div>`;
    const st = _standing(m.name), cap = capOf(m.name);
    const tags = (m.me ? '<span class="seat-tag me">나</span>' : '') + (m.host ? '<span class="seat-tag host">방장</span>' : '') + (cap ? `<span class="seat-tag c${cap}" title="${cap}팀 팀장">팀장</span>` : '');
    const ctl = myIsHost ? ((draft ? `<button class="seat-btn cap${cap ? ' on' : ''}" data-cap="${esc(m.name)}" title="팀장 지정/해제">팀장</button>` : '')
      + (sn ? `<button class="seat-btn" data-side="${esc(m.name)}" data-t="${sn === 1 ? 'teamB' : 'teamA'}" title="${sn === 1 ? 2 : 1}팀으로 옮기기">⇄</button><button class="seat-btn" data-side="${esc(m.name)}" data-t="" title="팀에서 빼기(미정)">↩</button>` : '')
      + (!m.me ? `<button class="seat-btn out" data-out="${esc(m.key)}" title="${m.guest ? '목록에서 빼기' : '관전으로 보내기'}">${m.guest ? '✕' : '↓'}</button>` : '')) : '';
    return `<div class="seat filled${m.me ? ' me' : ''}${cap ? ' cap' + cap : ''}${sn ? ' side' + sn : ''}">`
      + `<span class="seat-no">${no}</span>${avatar(m, 'seat-av')}`
      + `<span class="seat-main"><b class="lb-nm" data-pk="${esc(m.key)}" title="프로필 보기">${esc(m.name)}</b><small>${tags}${m.ver && verLt(m.ver, L.latest) ? `<span class="seat-old" title="지금 v${esc(m.ver)} · 최신 v${esc(L.latest)}">업데이트 필요</span>` : ''}${m.guest ? '<span>앱 없음</span>' : m.online ? '' : '<span>오프라인</span>'}${st ? `<span><span class="num">${st.wins}</span>승 <span class="num">${st.losses}</span>패</span>` : ''}</small></span>`
      + (ctl ? `<span class="seat-ctl">${ctl}</span>` : '') + '</div>';
  };
  el('lb-seats').innerHTML = manual ? Array.from({ length: 5 }, (_, i) => seat(sA[i], i, 'teamA') + seat(sB[i], i, 'teamB')).join('')   // 🧩 직접: 왼쪽 열 1팀 · 오른쪽 열 2팀
    : Array.from({ length: SEATS }, (_, i) => seat(ins[i], i)).join('');
  el('lb-me').style.display = myName ? '' : 'none';
  { // 🔄 방장: 옛 버전 앱이 있으면 「업데이트 시키기」(v0.1.56 이상 앱만 알아들음 — 그 전 버전은 직접 다시 켜야 함)
    const old = M.filter(m => m.online && m.ver && verLt(m.ver, L.latest)), ub = el('lb-upd');
    ub.style.display = myIsHost && old.length ? '' : 'none';
    if (myIsHost && old.length) {
      ub.innerHTML = `<span>옛 버전 <b class="num">${old.length}</b>명 · 최신 v${esc(L.latest)}</span><button id="lb-upd-go" class="lb-mini" title="그 사람들 앱이 잠깐 꺼졌다가 새 버전으로 다시 켜져요(게임 중이면 끝난 뒤).
v0.1.56 전 버전은 이 요청을 못 알아들어서 직접 트레이에서 종료 후 다시 켜야 해요.">업데이트 시키기</button>`;
      el('lb-upd-go').onclick = () => lbAct(async () => { const r = await window.api.lobbyUpdateReq(); if (r && r.ok) { const b = el('lb-upd-go'); if (b) { b.textContent = '요청 보냄'; b.disabled = true; } } return r; });
    }
  }
  { // 접속하면 바로 자리에 앉음 → 버튼은 하나: 앉아 있으면 「관전으로 빠지기」, 관전 중이면 「다시 참가하기」
    const b = el('lb-mebtn'), spec = !!(me && me.st === 'spec');
    b.className = 'lb-mebtn ' + (spec ? 'rejoin' : 'leave');
    b.textContent = spec ? '다시 참가하기' : '이번 판은 관전할게요';
    b.onclick = () => lbAct(() => window.api.lobbyMe(spec ? 'in' : 'spec'));
  }
  // 자리에 없는 사람 = 관전
  const chip = m => `<span class="lb-chip ${m.st || 'none'}${m.me ? ' me' : ''}">${avatar(m, 'chip-av')}<b class="lb-nm" data-pk="${esc(m.key)}">${esc(m.name)}</b>`
    + (myIsHost && !m.me ? `<button class="seat-btn in" data-in="${esc(m.key)}" title="참가로">＋</button>` : '')
    + (myIsHost && m.guest ? `<button class="seat-btn out" data-rm="${esc(m.key)}" title="목록에서 빼기">✕</button>` : '') + '</span>';
  const others = [];
  if (manual && sNone.length) others.push(`<div class="lb-others none"><span class="lb-ol">팀 미정 <b>${sNone.length}</b></span>${sNone.map(m => `<span class="lb-chip in${m.me ? ' me' : ''}">${avatar(m, 'chip-av')}<b class="lb-nm" data-pk="${esc(m.key)}">${esc(m.name)}</b>`
    + (myIsHost ? `<button class="seat-btn t1" data-side="${esc(m.name)}" data-t="teamA" title="1팀에 넣기">1팀</button><button class="seat-btn t2" data-side="${esc(m.name)}" data-t="teamB" title="2팀에 넣기">2팀</button>` + (!m.me ? `<button class="seat-btn out" data-out="${esc(m.key)}" title="관전으로 보내기">↓</button>` : '') : '') + '</span>').join('')}</div>`);
  if (specs.length) others.push(`<div class="lb-others"><span class="lb-ol">관전 <b>${specs.length}</b></span>${specs.map(chip).join('')}</div>`);
  el('lb-list').innerHTML = others.join('') || (M.length ? '' : '<div class="lb-empty">아직 아무도 없어요<br><small>팀원이 앱을 켜고 롤에 로그인하면 여기에 떠요</small></div>');
  const root = el('view-lobby');
  root.querySelectorAll('[data-side]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbySide(b.dataset.side, b.dataset.t || null)));
  root.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbyCaptain(b.dataset.cap, false)));
  root.querySelectorAll('[data-out]').forEach(b => b.onclick = () => { const m = M.find(x => x.key === b.dataset.out); if (m) lbAct(() => m.guest ? window.api.lobbyGuestRm(m.key) : window.api.lobbySet(m.key, 'spec')); });
  root.querySelectorAll('[data-in]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbySet(b.dataset.in, 'in')));
  root.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => lbAct(() => window.api.lobbyGuestRm(b.dataset.rm)));
  root.querySelectorAll('.lb-nm').forEach(n => n.onclick = () => {
    const m = M.find(x => x.key === n.dataset.pk); if (!m) return;
    window.api.openProfile(m.guest ? { name: m.name } : { puuid: m.key, name: m.name });
  });
  // 👑 방장: 추가·시작 / 나머지: 안내
  el('lb-hostbox').style.display = myIsHost ? '' : 'none';
  el('lb-gobar').style.display = myIsHost ? '' : 'none';
  const n = ins.length, capsOk = !draft || (caps.teamA && caps.teamB), sideOk = !manual || (!sNone.length && sA.length && sB.length);
  const go = el('lb-start');
  go.disabled = n < 2 || !capsOk || !sideOk;
  go.textContent = n < 2 ? `2명부터 시작할 수 있어요 · 지금 ${n}명` : !capsOk ? '팀장 2명을 정해주세요'
    : manual ? (sNone.length ? `팀 안 정한 사람 ${sNone.length}명` : !sideOk ? '두 팀에 한 명 이상씩' : `이 팀으로 시작 · ${sA.length}:${sB.length}`)
    : draft ? `드래프트 시작 · ${n}명` : `랜덤으로 팀 짜기 · ${n}명`;
  el('lb-foot').innerHTML = myIsHost ? (manual ? (sNone.length ? '<span>아래 「팀 미정」에서 1팀·2팀을 눌러 넣어요 · 자리에 마우스를 올리면 ⇄ 옮기기 · ↩ 빼기</span>' : '') : n > 10 || n % 2 ? '<span>11명 이상이거나 홀수면 남는 사람은 관전으로 빠져요</span>' : '')
    : !myName ? '' : L.hostName ? `<span class="lobby-pulse"></span>${esc(L.hostName)}님이 시작하면 바로 팀이 떠요` : '';
  // 오늘 순위(짧게)
  loadToday();
  const t = el('lb-today');
  if (!_today || !_today.standings.length) { t.innerHTML = ''; return; }
  t.innerHTML = `<div class="lb-sec"><span class="lb-sec-en">TODAY</span><span>오늘 순위 · <span class="num">${_today.matches.length}</span>판</span></div><div class="wi-rk">` + _today.standings.slice(0, 5).map(p =>
    `<div class="wi-rk-row${nn(p.name) === nn(myName) ? ' me' : ''}"><span class="wi-rk-r num">${p.rank}</span><span class="wi-rk-nm">${esc(p.name)}</span><span class="wi-rk-lp"><span class="num">${p.wins}</span>승 <span class="num">${p.losses}</span>패</span></div>`).join('') + '</div>';
}
el('lb-start').onclick = () => lbAct(() => window.api.lobbyStart());
function toggleHostMenu(L) {   // 👑 내가 방장 ▾ = 접속 중인 사람에게 넘겨주기 · 그만하기 (오른쪽 창 메뉴와 같은 기능)
  const m = el('lb-hostmenu');
  if (m.style.display !== 'none') { m.style.display = 'none'; return; }
  const others = (L.members || []).filter(x => x.online && !x.guest && !x.me);
  m.innerHTML = '<div class="lb-hm-hd">방장 넘겨주기</div>'
    + (others.length ? others.map(o => `<button class="lb-hm-item" data-p="${esc(o.key)}">${avatar(o, 'chip-av')}<span>${esc(o.name)}</span></button>`).join('') : '<div class="lb-hm-empty">앱을 켠 다른 사람이 없어요</div>')
    + '<button class="lb-hm-item stop" id="lb-hm-stop">방장 그만하기</button>';
  m.style.display = '';
  m.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    const o = others.find(x => x.key === b.dataset.p); if (!o) return;
    if (!confirm(`${o.name}님에게 방장을 넘길까요?\n진행 중인 판은 그대로 이어져요.`)) return;
    m.style.display = 'none'; lbAct(() => window.api.handHost(o.key));
  });
  el('lb-hm-stop').onclick = () => { m.style.display = 'none'; lbAct(() => window.api.setHost(false)); };
}
document.addEventListener('mousedown', e => { if (!e.target.closest('#lb-hostmenu, #lb-hostme')) el('lb-hostmenu').style.display = 'none'; });
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
  renderLobby(); showView('lobby'); el('phase').textContent = '대기실';
}
// 🩹 v0.1.28: 켤 때 내 이름·판 상태를 직접 받아옴 — 롤이 이미 켜져 있으면 계정이 창 로딩 중(듣기 전)에 잡혀 이름 알림을 놓치고,
// 같은 내용은 다시 안 보내서(broadcast 중복 차단) 이름이 끝까지 비어 「관전할게요」 버튼·안내가 사라지던 버그(특정 사람만 = 롤 먼저 켠 사람·느린 PC)
window.api.getPlayers().then(d => { if (d) applySession({ session: d.session, myName: d.myName, isHost: d.isHost }); }).catch(() => {});
window.api.getLobby().then(d => { if (d) { lobbyData = d; myIsHost = !!d.isHost; render(); } }).catch(() => {});
render();
