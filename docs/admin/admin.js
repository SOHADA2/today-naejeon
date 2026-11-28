// 운영 보드 화면 스크립트(2026-11-28 보안 점검: 페이지 안 인라인 스크립트를 파일로 뺌 = CSP가 인라인 실행을 막게) · 대회 계산은 tourney.js(window.tnTourney)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app';
const fb = initializeApp({ apiKey: 'AIzaSyDhVbSzNQ306LUTcPo44Ru9G4_RqV9Dl_E', authDomain: 'today-naejeon-sohada.firebaseapp.com', projectId: 'today-naejeon-sohada' });
const auth = getAuth(fb);
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 🛡️ 2026-11-28 보안 점검 — 사람 키(계정 번호)는 이 모양만 · 신고의 「대상」은 신고한 사람이 적어 보내는 값이라 그대로 경로에 넣으면 안 됨(「../」로 다른 칸을 가리키게 할 수 있었음)
const PKEY = /^[A-Za-z0-9_-]{1,100}$/;
const PERM = 9e15, ONLINE_MS = 60000, DAY_START_HOUR = 6;
let ME = null, S = {};   // S = 받은 자료
// 🏘️ v0.1.258 커뮤니티 공간 — CT = 고른 커뮤니티 칸(기본 = today · 다른 커뮤니티 = today/c/{id}) · 같이 쓰는 칸(계정·점수·디스코드·자리·설정·전체 운영자)은 today 그대로
//   주인·전체 운영자 = 모든 커뮤니티 · 커뮤니티 운영자 = 주인이 준 링크(…/admin/?c={id})로만 들어옴(자기 커뮤니티만)
let CT = 'today', COMM = null, COMMS = {};
const CQ = (new URLSearchParams(location.search).get('c') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || null;
const ADM = () => COMM ? `${CT}/admins` : 'today/admins';
// 🏘️ v0.1.259 커뮤니티 전용 서버 — today/communities/{id}.db = {url, key, proj}면 그 커뮤니티 칸(CT 아래)·자리(today/conns·config/connCap)는 그 서버
//   그 서버 로그인은 따로(같은 구글 계정이어도 서버마다 운영자 번호가 다름) · 운영자 = 그 서버의 today/admins/{번호}(전체) 또는 today/c/{id}/admins/{번호}
let CDB = null, CAUTH = null; const CAPPS = {};
const cdbOf = id => { const d = id && COMMS[id] && COMMS[id].db; return d && d.url && d.key && d.proj ? d : null; };
const onC = p => !!CDB && (p === CT || p.startsWith(CT + '/') || p === 'today/conns' || p.startsWith('today/conns/') || p === 'today/config/connCap');
function useCdb(d) {
  CDB = d || null; CAUTH = null; if (!CDB) return;
  if (!CAPPS[CDB.proj]) CAPPS[CDB.proj] = initializeApp({ apiKey: CDB.key, authDomain: CDB.proj + '.firebaseapp.com', projectId: CDB.proj }, 'c_' + CDB.proj);
  CAUTH = getAuth(CAPPS[CDB.proj]);
}
function setComm(id) { COMM = id || null; CT = COMM ? `today/c/${COMM}` : 'today'; useCdb(cdbOf(COMM)); const sel = $('comm'); if (sel) sel.value = COMM || ''; document.title = `운영 보드${COMM ? ' · ' + ((COMMS[COMM] || {}).name || COMM) : ''}`; }

// ── 서버 읽기·쓰기(운영자 표식) ──
async function api(method, path, body, q) {
  // 🛡️ 경로 검사: 빈 칸·「.」·「..」·물음표 등이 든 경로는 안 보냄 + 칸마다 주소용으로 바꿔서 보냄(서버 값이 경로에 섞여도 다른 칸으로 못 새게)
  if (typeof path !== 'string' || /[?#\\\u0000-\u001f]/.test(path) || path.split('/').some(x => !x || /^(\.|%2e){1,2}$/i.test(x))) throw new Error('잘못된 경로');
  path = path.split('/').map(encodeURIComponent).join('/');
  const c = onC(path), a = c ? CAUTH : auth;   // 🏘️ 전용 서버 칸이면 그 서버 · 그 서버 표식
  if (!a || !a.currentUser) throw new Error(c ? '커뮤니티 서버에 로그인해 주세요' : '로그인해 주세요');
  const tok = await a.currentUser.getIdToken();
  const r = await fetch(`${c ? CDB.url : DB}/${path}.json?auth=${tok}${q ? '&' + q : ''}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
  return j;
}
const get = p => api('GET', p);
function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 3200); }

// ── 시간 글자 ──
const pad = n => String(n).padStart(2, '0');
const fmt = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function ago(ms) { if (!ms) return '—'; const s = (Date.now() - ms) / 1000; if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전'; if (s < 86400) return Math.floor(s / 3600) + '시간 전'; return Math.floor(s / 86400) + '일 전'; }
const until = b => b.until >= PERM ? '영구' : fmt(b.until) + (b.until > Date.now() ? ` (${ago(Date.now() - (b.until - Date.now())).replace(' 전', ' 남음')})` : '');
function dayKey(ms) { const d = new Date(ms - DAY_START_HOUR * 3600e3); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const vcmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

// ── 로그인 ──
$('login').onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => toast('로그인 실패 · ' + (e.code || e.message), true));
onAuthStateChanged(auth, u => onAuthUser(u));
async function onAuthUser(u) {
  if (!u) { gate('운영자로 등록된 구글 계정으로 들어갑니다', true); $('who').innerHTML = ''; return; }
  $('who').innerHTML = `<span>${esc(u.displayName || u.email || '')}</span><button class="btn sm" id="out">로그아웃</button>`;
  $('out').onclick = () => signOut(auth);
  let a = null, ca = null; try { a = await get(`today/admins/${u.uid}`); } catch (_) {}
  if (!a && CQ) {   // 🏘️ 커뮤니티 운영자
    const ci = await get(`today/communities/${CQ}`).catch(() => null);
    if (ci && ci.db) { COMMS = { [CQ]: ci }; CT = `today/c/${CQ}`; COMM = CQ; useCdb(cdbOf(CQ)); await CAUTH.authStateReady(); if (!CAUTH.currentUser) { cGate(ci.name || CQ, () => onAuthUser(u)); return; } }
    try { ca = await get(`today/c/${CQ}/admins/${CDB ? CAUTH.currentUser.uid : u.uid}`); } catch (_) {}
  }
  if (!a && !ca) {
    gate('');
    const nu = CDB && CAUTH && CAUTH.currentUser ? CAUTH.currentUser.uid : u.uid;   // 🏘️ 전용 서버 = 그 서버 번호
    $('gate').innerHTML = `<div class="en">NOT AN OPERATOR</div><h1>운영자로 등록되지 않은 계정입니다</h1><p>아래 운영자 번호를 관리자에게 전달하면 등록해 줍니다</p><div class="uid">${esc(nu)}</div><button class="btn" id="cp">번호 복사</button>`;
    $('cp').onclick = () => navigator.clipboard.writeText(nu).then(() => toast('복사했습니다'));
    return;
  }
  ME = { uid: u.uid, name: (a || ca).name || u.displayName || '운영자', owner: !!(a && a.owner === true), global: !!a };
  COMMS = {}; if (ME.global) { try { COMMS = (await get('today/communities')) || {}; } catch (_) {} } else COMMS = { [CQ]: (await get(`today/communities/${CQ}`).catch(() => null)) || { name: CQ } };
  $('comm').innerHTML = (ME.global ? '<option value="">기본 커뮤니티</option>' : '') + Object.entries(COMMS).map(([id, c]) => `<option value="${esc(id)}">${esc((c && c.name) || id)}</option>`).join('');
  $('comm').classList.toggle('hide', Object.keys(COMMS).length === 0);
  setComm(ME.global ? (CQ && COMMS[CQ] ? CQ : null) : CQ);
  $('gate').classList.add('hide'); $('app').classList.remove('hide'); $('tabs').classList.remove('hide');
  load();
}
// 🏘️ 전용 서버 로그인 화면(그 서버에 구글로 한 번 더 · 다음부터는 이 브라우저가 기억)
function cGate(name, then) {
  $('app').classList.add('hide'); $('tabs').classList.add('hide'); $('gate').classList.remove('hide');
  $('gate').innerHTML = `<div class="en">COMMUNITY SERVER</div><h1>${esc(name)} 전용 서버</h1><p>이 커뮤니티는 따로 쓰는 서버가 있습니다 · 그 서버에도 같은 구글 계정으로 한 번 로그인합니다</p><button class="btn gold" id="clogin">${esc(name)} 서버에 Google로 로그인</button>`;
  $('clogin').onclick = () => signInWithPopup(CAUTH, new GoogleAuthProvider()).then(() => then()).catch(e => toast('로그인 실패 · ' + (e.code || e.message), true));
}
function gate(msg, showBtn) {
  $('app').classList.add('hide'); $('tabs').classList.add('hide'); $('gate').classList.remove('hide');
  if (!showBtn) return;
  $('gate').innerHTML = `<div class="en">ADMIN</div><h1>운영 보드</h1><p>${esc(msg)}</p><button class="btn gold" id="login2">Google로 로그인</button>`;
  $('login2').onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => toast('로그인 실패 · ' + (e.code || e.message), true));
}

$('comm').onchange = () => { setComm($('comm').value || null); S = {}; load(); };   // 🏘️ 커뮤니티 바꾸면 다시 받음
// ── 탭 ──
$('tabs').onclick = e => { const b = e.target.closest('button[data-t]'); if (!b) return; for (const x of $('tabs').children) x.classList.toggle('on', x === b); for (const s of document.querySelectorAll('section[data-p]')) s.classList.toggle('hide', s.dataset.p !== b.dataset.t); };

// ── 자료 받기 ──
async function load() {
  if (CDB) {   // 🏘️ 전용 서버 = 그 서버 로그인 · 그 서버 운영자인지
    await CAUTH.authStateReady();
    if (!CAUTH.currentUser) { cGate((COMMS[COMM] || {}).name || COMM, () => { $('gate').classList.add('hide'); $('app').classList.remove('hide'); $('tabs').classList.remove('hide'); load(); }); return; }
    const cu = CAUTH.currentUser.uid; let ok = null;
    try { ok = (await api('GET', `${CT}/admins/${cu}`)); } catch (_) {}
    if (!ok) try { const r = await fetch(`${CDB.url}/today/admins/${cu}.json?auth=${await CAUTH.currentUser.getIdToken()}`); ok = r.ok ? await r.json() : null; } catch (_) {}
    if (!ok) { $('loaded').innerHTML = `이 커뮤니티 서버의 운영자로 등록되지 않았습니다 · 운영자 번호(이 서버) <b>${esc(cu)}</b>를 관리자에게 전달해 주세요`; return; }
  }
  $('loaded').textContent = '불러오는 중…';
  try {
    const [presence, accounts, roomList, rooms, bans, modlog, reports, warns, mutes, notice, conns, connCap, admins] = await Promise.all([`${CT}/presence`, 'today/accounts', `${CT}/roomList`, `${CT}/rooms`, `${CT}/bans`, `${CT}/modlog`, `${CT}/reports`, `${CT}/warns`, `${CT}/mutes`, `${CT}/notice`, 'today/conns', 'today/config/connCap', ADM()].map(p => get(p).catch(() => null)));
    Object.assign(S, { presence: presence || {}, accounts: accounts || {}, roomList: roomList || {}, rooms: rooms || {}, bans: bans || {}, modlog: modlog || {}, reports: reports || {}, warns: warns || {}, mutes: mutes || {}, notice: notice || null, conns: conns || {}, connCap: Number.isInteger(connCap) ? connCap : null, admins: admins || {} });
    S.allDays = null;   // 경기 기록은 다시 받음
    S.at = Date.now();
    renderAll();
    $('loaded').textContent = `불러온 시각 ${fmt(S.at)} · `;
    const rb = document.createElement('button'); rb.className = 'btn sm'; rb.textContent = '새로고침'; rb.onclick = load; $('loaded').appendChild(rb);
    loadDays().catch(() => {});
  } catch (e) { $('loaded').textContent = '불러오지 못했습니다 · ' + e.message; }
}
$('reload2').onclick = load;
async function loadDays() {   // 최근 14일 판 수(내전·일반) — 날짜 칸마다 얕게 읽어 셈
  const keys = []; for (let i = 13; i >= 0; i--) keys.push(dayKey(Date.now() - i * 86400e3));
  const cnt = async (d, k) => { const j = await api('GET', `${CT}/days/${d}/${k}`, undefined, 'shallow=true').catch(() => null); return j && !j.error ? Object.keys(j).length : 0; };
  S.days = await Promise.all(keys.map(async d => ({ d, m: await cnt(d, 'matches'), n: await cnt(d, 'normals') })));
  renderDays(); renderKpis();
}
async function loadAllDays(fresh) {   // 사람 카드용 — 기록 전체(한 번만 · 크면 몇 MB)
  if (S.allDays && !fresh) return S.allDays;
  S.allDays = (await get(`${CT}/days`).catch(() => null)) || {};
  return S.allDays;
}

// ── 사람 목록 ──
function people() {
  const out = new Map(), now = Date.now();
  for (const [k, a] of Object.entries(S.accounts)) if (a) out.set(k, { key: k, name: a.name || '?', tag: a.tag || '', last: a.lastSeen || 0 });
  for (const [k, p] of Object.entries(S.presence)) {
    if (!p || k.startsWith('g_')) continue;
    const o = out.get(k) || { key: k, name: p.name || '?', tag: p.tag || '', last: 0 };
    o.p = p; o.last = Math.max(o.last, p.at || 0); o.on = now - (p.at || 0) < ONLINE_MS; out.set(k, o);
  }
  for (const r of Object.values(S.reports || {})) if (r && r.target && PKEY.test(r.target) && !out.has(r.target)) out.set(r.target, { key: r.target, name: r.name || '?', tag: '', last: 0 });
  for (const [k, b] of Object.entries(S.bans)) { const o = out.get(k) || { key: k, name: b.name || '?', tag: '', last: 0 }; o.ban = b; out.set(k, o); }
  return [...out.values()];
}
const banOn = b => b && b.until > Date.now();
function roomOf(key) { for (const [id, r] of Object.entries(S.rooms)) if (r && r.uids && r.uids[key]) return id; return null; }
const latest = () => { let v = '0.0.0'; for (const p of Object.values(S.presence)) if (p && p.app && vcmp(p.app, v) > 0) v = p.app; return v; };

function renderAll() { loadTour().catch(() => {}); renderKpis(); renderRooms(); renderVers(); renderPeople(); renderBans(); renderLog(); renderReports(); renderNotice(); renderAdmin(); renderGameDays(); }
function renderKpis() {
  const P = people(), on = P.filter(x => x.on).length, guests = Object.entries(S.presence).filter(([k, p]) => k.startsWith('g_') && p && Date.now() - (p.at || 0) < ONLINE_MS).length;
  const open = Object.values(S.roomList).filter(r => r && r.name && Date.now() - Math.max(r.seen || 0, r.at || 0) < 90000).length;
  const td = S.days ? S.days[S.days.length - 1] : null, bans = Object.values(S.bans).filter(banOn).length, reps = openReports().length;
  const k = (l, v, s, cls) => `<div class="kpi ${cls || ''}"><div class="l">${l}</div><div class="v">${v}${s ? `<small>${s}</small>` : ''}</div></div>`;
  $('kpis').innerHTML = k('지금 접속', on, guests ? `게스트 ${guests}` : '') + k('열린 방', open) + k('오늘 판', td ? td.m + td.n : '…', td ? `내전 ${td.m} · 일반 ${td.n}` : '') + k('자리', seatsNow(), `/ ${S.connCap || 80}`, seatsNow() >= (S.connCap || 80) * 0.9 ? 'warn' : '') + k('계정', Object.keys(S.accounts).length) + k('정지 중', bans, '', bans ? 'warn' : '') + k('처리 안 한 신고', reps, '', reps ? 'warn' : '');
}
function renderRooms() {
  const list = Object.entries(S.roomList).filter(([, r]) => r && r.name).sort((a, b) => (b[1].seen || 0) - (a[1].seen || 0));
  $('rooms-n').textContent = list.length ? list.length + '개' : '';
  $('rooms').innerHTML = list.length ? list.map(([id, r]) => {
    const live = Date.now() - Math.max(r.seen || 0, r.at || 0) < 90000, mem = Object.values((S.rooms[id] || {}).members || {}).map(m => m.name);
    return `<div class="room"><div><div class="nm">${esc(r.name)}${r.priv ? '<span class="tag">비공개</span>' : ''}${live ? '' : '<span class="tag old">소식 없음</span>'}</div>
      <div class="mem">방장 ${esc(r.host || '?')} · ${mem.length ? mem.map(esc).join(', ') : esc(String(r.mem || '').split('\n').join(', ')) || '아무도 없음'}</div><div class="mem mute">만든 때 ${fmt(r.at || 0)} · 마지막 소식 ${ago(r.seen || r.at)}</div></div>
      <div class="r"><button class="btn sm red" data-rdel="${esc(id)}">방 지우기</button></div></div>`;
  }).join('') : '<div class="empty">열린 방이 없습니다</div>';
}
$('rooms').onclick = e => { const b = e.target.closest('[data-rdel]'); if (b) roomDelete(b.dataset.rdel); };
function renderVers() {
  const cnt = {}, L = latest(), since = Date.now() - 14 * 86400e3;
  for (const [k, p] of Object.entries(S.presence)) if (p && p.app && !k.startsWith('g_') && (p.at || 0) > since) cnt[p.app] = (cnt[p.app] || 0) + 1;
  const rows = Object.entries(cnt).sort((a, b) => vcmp(b[0], a[0])), max = Math.max(1, ...rows.map(r => r[1]));
  $('vers').innerHTML = rows.length ? rows.map(([v, n]) => `<div class="bar"><span>v${esc(v)}${v === L ? ' <span class="tag gold">최신</span>' : ''}</span><span class="t"><i class="${v === L ? '' : 'old'}" style="width:${n / max * 100}%"></i></span><span class="n">${n}명</span></div>`).join('') : '<div class="empty">최근 접속 기록이 없습니다</div>';
}
function renderDays() {
  const D = S.days || [], max = Math.max(1, ...D.map(x => x.m + x.n));
  $('days').innerHTML = D.map(x => `<div class="d" title="${x.d} · 내전 ${x.m} · 일반 ${x.n}"><span class="k">${x.m + x.n || ''}</span><div class="c"><i class="m" style="height:${x.m / max * 100}%"></i><i class="n" style="height:${x.n / max * 100}%"></i></div><span class="x">${x.d.slice(5).replace('-', '/')}</span></div>`).join('');
}
function renderPeople() {
  const q = $('q').value.trim().toLowerCase().replace(/\s/g, ''), L = latest();
  let P = people();
  if (q) P = P.filter(x => (x.name + '#' + x.tag).toLowerCase().replace(/\s/g, '').includes(q));
  P.sort((a, b) => (b.on - a.on) || (b.last - a.last));
  $('ppl').innerHTML = P.length ? P.map(x => {
    const v = x.p && x.p.app, room = x.p && x.p.room && S.roomList[x.p.room];
    return `<tr class="click" data-k="${esc(x.key)}"><td><b>${esc(x.name)}</b><span class="mute">#${esc(x.tag)}</span>${banOn(x.ban) ? '<span class="tag ban">정지</span>' : ''}${banOn(S.mutes[x.key]) ? '<span class="tag old">채팅 금지</span>' : ''}${warnN(x.key) ? `<span class="tag">경고 ${warnN(x.key)}</span>` : ''}${openReports().some(r => r.target === x.key) ? '<span class="tag ban">신고</span>' : ''}</td>
      <td><span class="dot ${x.on ? 'on' : ''}"></span>${x.on ? (room ? esc(room.name) + ' 방' : '접속 중') : '오프라인'}</td>
      <td>${v ? `v${esc(v)}${vcmp(v, L) < 0 ? ' <span class="tag old">옛 버전</span>' : ''}` : '<span class="mute">—</span>'}</td><td class="mute">${ago(x.last)}</td></tr>`;
  }).join('') : '<tr><td colspan="4" class="empty">찾는 사람이 없습니다</td></tr>';
}
$('q').oninput = renderPeople;
$('ppl').onclick = e => { const r = e.target.closest('tr[data-k]'); if (r) openPerson(r.dataset.k); };
function renderBans() {
  const all = Object.entries(S.bans).map(([k, b]) => ({ k, ...b })), on = all.filter(banOn).sort((a, b) => a.until - b.until), off = all.filter(b => !banOn(b));
  $('bans-n').textContent = on.length ? on.length + '명' : '';
  $('bans').innerHTML = on.length ? on.map(b => `<tr><td class="click" data-k="${esc(b.k)}"><b>${esc(b.name || b.k.slice(0, 8))}</b></td><td>${esc(b.reason || '—')}</td><td>${until(b)}</td><td class="mute">${esc(b.by || '')} · ${fmt(b.at || 0)}</td><td><button class="btn sm" data-unban="${esc(b.k)}">해제</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">정지 중인 사람이 없습니다</td></tr>';
  $('bans-old').innerHTML = off.length ? off.map(b => `<tr><td>${esc(b.name || b.k.slice(0, 8))}</td><td>${esc(b.reason || '—')}</td><td class="mute">${fmt(b.until)}에 끝남</td><td><button class="btn sm" data-clear="${esc(b.k)}">기록 지우기</button></td></tr>`).join('') : '<tr><td class="empty">없습니다</td></tr>';
}
document.querySelector('section[data-p="bans"]').onclick = e => {
  const u = e.target.closest('[data-unban]'), c = e.target.closest('[data-clear]'), p = e.target.closest('[data-k]');
  if (u) unban(u.dataset.unban); else if (c) unban(c.dataset.clear, true); else if (p) openPerson(p.dataset.k);
};
const ACT = { gamefix: '경기 기록 고침', gamedel: '경기 기록 지움', wipe: '개인정보 지움', cap: '자리 한도 바꿈', tnew: '대회 만듦', tdel: '대회 지움', tst: '대회 상태 바꿈', tgen: '대진 짬', twin: '대회 승자 정함', tres: '대회 결과 지움', opadd: '운영자 추가', opdel: '운영자 뺌', ban: '정지', unban: '정지 해제', kick: '방에서 내보냄', roomdel: '방 지움', warn: '경고', mute: '채팅 금지', unmute: '채팅 금지 해제', report: '신고 처리', notice: '공지', unnotice: '공지 내림' };
const warnN = k => Object.keys(S.warns[k] || {}).length;
const openReports = () => Object.entries(S.reports || {}).map(([id, r]) => ({ id, ...r })).filter(r => r && r.st !== 'done');
// ── 🏆 대회(v0.1.291) — `${CT}/tourneys/{대회}` = {name, fmt se|rr, bo, boF, st draft|live|done, at, by, teams{팀: {name, tag, seed, mem{puuid: {n, r cap|sub|''}}}}, matches{…}, res{경기: {게임: {w, day, at}}}}
//   계산(대진 만들기·점수·진출·순위) = tourney.js(앱과 같은 파일 · window.tnTourney) · res는 방장 앱이 판을 기록할 때 씀(규칙이 경기 기록과 대조) · 운영자는 승자 정하기(기권·부전승)·결과 지우기
const TNC = window.tnTourney;
let TSEL = null;
const TN_BAN = /(msi|worlds|월즈|롤드컵|first\s*stand|퍼스트\s*스탠드|\blcs\b|cblol|\blec\b|\blck\b|\blpl\b|\blcp\b|riot|라이엇|league\s*of\s*legends|리그\s*오브\s*레전드|lol\s*esports|공식|official)/i;
const TN_ST = { draft: '준비 중', live: '진행 중', done: '끝남' }, TN_FMT = { se: '싱글 토너먼트', rr: '풀리그' }, TN_ROLE = { cap: '팀장', '': '선수', sub: '후보' };
const tnP = (id, rest) => `${CT}/tourneys${id ? '/' + id : ''}${rest ? '/' + rest : ''}`;
const rid = pre => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const tnErr = e => /permission/i.test(e.message || '') ? '서버가 거절했습니다 · 대회 규칙이 아직 서버에 적용되지 않았을 수 있습니다' : (e.message || '실패');
async function loadTour() { try { S.tn = (await get(tnP())) || {}; } catch (e) { S.tn = {}; } renderTour(); }
async function tnDo(fn, okMsg) { try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(tnErr(e), true); } await loadTour(); }
let TVIEW = null, TMSEL = null, TNEW = false;   // v0.1.292 화면 = 'teams' | 'matches'(안 고르면 대진이 있으면 대진) · 고른 경기 · 새 대회 칸 열림
function renderTour() {
  const L = Object.entries(S.tn || {}).filter(([, t]) => t && t.name).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  if (TSEL && !(S.tn || {})[TSEL]) TSEL = null; if (!TSEL && L.length) TSEL = L[0][0];
  $('tn-list').innerHTML = L.length ? L.map(([id, t]) => `<button class="tnb${id === TSEL ? ' on' : ''}" data-tsel="${esc(id)}"><b>${esc(t.name)}</b><span class="tag${t.st === 'live' ? ' gold' : ''}">${TN_ST[t.st] || esc(t.st)}</span></button>`).join('') : '<span class="mute">아직 대회가 없습니다</span>';
  $('tn-list').querySelectorAll('[data-tsel]').forEach(b => b.onclick = () => { TSEL = b.dataset.tsel; TVIEW = null; TMSEL = null; renderTour(); });
  $('tn-form').classList.toggle('hide', !(TNEW || !L.length));
  $('tn-new-btn').textContent = TNEW && L.length ? '닫기' : '＋ 새 대회'; $('tn-new-btn').classList.toggle('hide', !L.length);
  renderTourDetail();
}
$('tn-new-btn').onclick = () => { TNEW = !TNEW; renderTour(); if (TNEW) $('tn-name').focus(); };
$('tn-fmt').onchange = () => { $('tn-bof').disabled = $('tn-fmt').value !== 'se'; };
$('tn-go').onclick = () => {
  const name = $('tn-name').value.trim().slice(0, 30); if (!name) return toast('대회 이름을 적어 주세요', true);
  if (TN_BAN.test(name)) return toast('라이엇 공식 대회 이름이나 「공식」·「라이엇」은 대회 이름에 쓸 수 없습니다', true);
  const fmt = $('tn-fmt').value === 'rr' ? 'rr' : 'se', bo = Number($('tn-bo').value) || 1, boF = fmt === 'se' ? Number($('tn-bof').value) || 0 : 0, id = rid('t');
  tnDo(async () => { await api('PUT', tnP(id), Object.assign({ name, fmt, bo, st: 'draft', at: Date.now(), by: ME.name }, boF ? { boF } : {})); await logIt({ act: 'tnew', target: id, name }); TSEL = id; TVIEW = null; TMSEL = null; TNEW = false; $('tn-name').value = ''; }, '대회를 만들었습니다 · 이제 팀을 등록하세요');
};
const tnTeams = t => Object.entries(t.teams || {}).map(([id, x]) => Object.assign({ id }, x)).sort((a, b) => (a.seed || 0) - (b.seed || 0) || String(a.name).localeCompare(String(b.name), 'ko'));
const tnResN = t => Object.values(t.res || {}).reduce((n, g) => n + Object.keys(g || {}).length, 0);
// 대진표 그림 — 라운드 = 열 · 칸 높이를 똑같이 나눠 선이 맞물림(앱 오른쪽 창과 같은 방식) · pre = 미리 보기(누를 수 없음)
function tnBracket(t, R, pre) {
  const row = (m, tm, sc) => `<div class="t${!tm ? ' tbd' : m.win ? (m.win === tm.id ? ' win' : ' lose') : ''}"><span>${tm ? esc(tm.name) : '미정'}</span>${tm && tm.tag ? `<small>${esc(tm.tag)}</small>` : ''}<em>${tm && m.ta && m.tb && m.games.length ? sc : ''}</em></div>`;
  return `<div class="tn-bk">${R.byRound.map((rd, ri) => `<div class="col"><div class="rn">${esc(rd.name)}</div><div class="cells">${rd.matches.map(m => m.how === 'bye' && ri === 0
    ? `<div class="cell"><div class="m bye"><div class="t"><span>${esc((m.ta || m.tb || {}).name || '')}</span><small>부전승</small></div></div></div>`
    : `<div class="cell"><div class="m${pre ? ' pre' : ''}${m.state === 'live' ? ' live' : ''}${!pre && TMSEL === m.id ? ' sel' : ''}"${pre ? '' : ` data-bm="${esc(m.id)}"`}>${row(m, m.ta, m.sa)}${row(m, m.tb, m.sb)}</div></div>`).join('')}</div></div>`).join('')}</div>`;
}
const tnStt = m => m.how === 'bye' ? '부전승' : m.how === 'admin' ? '운영자 판정' : { wait: '앞 경기 대기', ready: '대기', live: '진행 중', done: '끝', void: '' }[m.state];
// 고른 경기 상세 — 점수·기록된 판·승자 정하기(기권·몰수)·결과 지우기
function tnMatchDetail(t, R) {
  const m = R.matches[TMSEL]; if (!m) return '<div class="tn-det"><div class="mute">경기를 누르면 여기에 자세히 나옵니다</div></div>';
  const A = m.ta, B = m.tb, cls = x => m.win && x ? (m.win === x.id ? 'win' : 'lose') : '', multi = R.byRound[m.r - 1].matches.length > 1;
  return `<div class="tn-det"><div class="h"><b>${esc(m.rn)}${multi ? ' ' + m.no + '경기' : ''}</b><span>${TNC.BO_KO(m.bo)}</span><span class="tag${m.state === 'live' ? ' gold' : ''}">${tnStt(m)}</span></div>`
    + `<div class="vs"><b class="${cls(A)}">${A ? esc(A.name) : '미정'}</b><em>${A && B ? (m.games.length || m.state === 'done' ? m.sa + ' : ' + m.sb : 'VS') : '–'}</em><b class="${cls(B)}">${B ? esc(B.name) : '미정'}</b></div>`
    + (m.games.length ? `<ul class="gms">${m.games.map((g, i) => `<li>${i + 1}판 · ${esc((t.teams[g.w] || {}).name || '?')} 승${g.day ? ' · ' + esc(g.day.slice(5)) : ''}</li>`).join('')}</ul>` : `<p class="mute" style="margin:0 0 12px;font-size:12.5px">${A && B ? '아직 기록된 판이 없습니다 · 방장이 앱 「대회」 탭에서 이 경기를 시작하면 자동으로 들어옵니다' : '앞 경기가 끝나면 두 팀이 정해집니다'}</p>`)
    + (A && B && m.how !== 'bye' ? `<label>승자 정하기(기권·몰수일 때 · 「자동」 = 기록된 판으로)</label><select data-tw="${esc(m.id)}"><option value="">자동</option><option value="${esc(A.id)}"${t.matches[m.id].win === A.id ? ' selected' : ''}>${esc(A.name)} 승</option><option value="${esc(B.id)}"${t.matches[m.id].win === B.id ? ' selected' : ''}>${esc(B.name)} 승</option></select>` : '')
    + (m.games.length ? `<div class="row"><button class="btn sm red" data-ta="rclr" data-k="${esc(m.id)}">기록된 판 지우기</button></div>` : '') + '</div>';
}
function renderTourDetail() {
  const box = $('tn-detail'), t = TSEL && S.tn[TSEL]; if (!t) { box.innerHTML = ''; return; }
  const teams = tnTeams(t), hasM = !!t.matches && Object.keys(t.matches).length > 0, resN = tnResN(t), R = hasM ? TNC.resolve(t) : null;
  const view = TVIEW || (hasM ? 'matches' : 'teams'), nM = R ? Object.values(R.matches).filter(m => m.how !== 'bye' && m.state !== 'void').length : 0, nDone = R ? Object.values(R.matches).filter(m => m.how !== 'bye' && m.state === 'done').length : 0;
  const boTx = TNC.BO_KO(t.bo || 1) + (t.fmt === 'se' && t.boF && t.boF !== t.bo ? ` · 결승 ${TNC.BO_KO(t.boF)}` : '');
  if (R && (!TMSEL || !R.matches[TMSEL])) { const L = Object.values(R.matches).filter(m => m.how !== 'bye' && m.state !== 'void'); TMSEL = (L.find(m => m.state === 'live') || L.find(m => m.state === 'ready') || L[L.length - 1] || {}).id || null; }
  // ① 머리 = 이름·상태·할 일 버튼 + 단계(누르면 그 화면)
  let h = `<div class="sec card tn-hd"><div><h2><b>${esc(t.name)}</b><span class="tag${t.st === 'live' ? ' gold' : ''}">${TN_ST[t.st] || esc(t.st)}</span></h2><div class="meta">${TN_FMT[t.fmt]} · ${boTx}${R && R.champ ? ` · <b>🏆 우승 ${esc(R.champ.name)}</b>` : ''}</div></div><div class="acts">`
    + (t.st === 'draft' ? `<button class="btn gold" data-ta="st" data-v="live"${hasM ? '' : ' disabled title="먼저 대진을 짜 주세요"'}>대회 시작</button>` : '')
    + (t.st === 'live' ? `<button class="btn gold" data-ta="st" data-v="done">대회 끝내기</button><button class="btn" data-ta="st" data-v="draft" title="앱에서 숨기고 다시 준비">준비 중으로</button>` : '')
    + (t.st === 'done' ? `<button class="btn" data-ta="st" data-v="live">다시 진행 중으로</button>` : '')
    + `<button class="btn" data-ta="rename">이름</button><button class="btn red" data-ta="del">지우기</button></div>`
    + `<div class="tn-steps"><button class="tn-step${view === 'teams' ? ' on' : ''}${teams.length >= 2 ? ' ok' : ''}" data-tv="teams"><i>1</i><b>팀 등록</b><small>${teams.length}팀</small></button>`
    + `<button class="tn-step${view === 'matches' ? ' on' : ''}${hasM ? ' ok' : ''}" data-tv="matches"><i>2</i><b>${t.fmt === 'rr' ? '경기' : '대진'}</b><small>${hasM ? `${nDone}/${nM}경기 끝` : '아직 안 짬'}</small></button>`
    + `<div class="tn-step info${t.st !== 'draft' ? ' ok' : ''}"><i>3</i><b>${t.st === 'draft' ? '대회 시작 전' : t.st === 'live' ? '앱에 보이는 중' : '끝난 대회'}</b></div></div></div>`;
  if (view === 'teams') {   // ② 팀 = 카드 격자 · 카드 안에서 선수 추가
    h += `<div class="sec"><div class="tn-grid">` + teams.map((tm, i) => { const c = TNC.rosterCount(tm), mem = Object.entries(tm.mem || {}).map(([k, m]) => Object.assign({ k }, m)).sort((a, b) => ['cap', '', 'sub'].indexOf(a.r || '') - ['cap', '', 'sub'].indexOf(b.r || ''));
        return `<div class="tn-team"><div class="top"><span class="sd">${i + 1}</span><b>${esc(tm.name)}</b>${tm.tag ? `<span class="tag gold">${esc(tm.tag)}</span>` : ''}<span class="cnt${c.main >= TNC.MAIN_MAX ? ' full' : ''}">선수 ${c.main}/${TNC.MAIN_MAX} · 후보 ${c.sub}/${TNC.SUB_MAX}</span><button class="tn-ib" title="이름·태그 바꾸기" data-ta="trename" data-k="${esc(tm.id)}">✎</button><button class="tn-ib" title="${hasM ? '대진이 있으면 팀을 지울 수 없습니다 · 먼저 대진을 지우세요' : '팀 지우기'}" data-ta="tdel" data-k="${esc(tm.id)}"${hasM ? ' disabled' : ''}>🗑</button></div>
          <div class="tn-mem">${mem.map(m => `<span class="${m.r === 'cap' || m.r === 'sub' ? m.r : ''}">${esc(m.n || '?')}<small>${TN_ROLE[m.r || ''] || ''}</small><button class="tn-ib" title="역할 바꾸기(선수 → 팀장 → 후보)" data-ta="mrole" data-k="${esc(tm.id)}" data-p="${esc(m.k)}">⇄</button><button class="tn-ib" title="빼기" data-ta="mdel" data-k="${esc(tm.id)}" data-p="${esc(m.k)}">✕</button></span>`).join('') || '<span class="none">아직 선수가 없습니다 · 첫 선수가 팀장이 됩니다</span>'}</div>
          <div class="tn-addrow"><input class="in tn-add" list="tn-accts" data-k="${esc(tm.id)}" placeholder="이름#태그"><select class="tn-role" data-k="${esc(tm.id)}"><option value="">선수</option><option value="sub">후보</option></select><button class="btn sm" data-ta="madd" data-k="${esc(tm.id)}">추가</button></div></div>`; }).join('')
      + `<div class="tn-team new"><div class="row"><input id="tn-tname" class="in" maxlength="12" placeholder="새 팀 이름(12자)" style="flex:1"><input id="tn-ttag" class="in" maxlength="4" placeholder="태그" style="width:70px"><button class="btn gold" data-ta="tadd"${hasM ? ' disabled' : ''}>팀 추가</button></div><span class="mute" style="font-size:12.5px">${hasM ? '대진이 있으면 팀을 더하거나 지울 수 없습니다(선수 바꾸기는 언제든) · 대진을 지우면 다시 됩니다' : '선수 5명(팀장 포함) + 후보 2명까지 · 기록 공개에 동의한 계정만 · 대회 경기에는 등록 선수만 나갑니다'}</span></div>`
      + `</div><datalist id="tn-accts">${people().filter(x => !x.key.startsWith('g_')).sort((a, b) => b.last - a.last).slice(0, 400).map(x => `<option value="${esc(x.name + (x.tag ? '#' + x.tag : ''))}">`).join('')}</datalist></div>`;
  } else if (!hasM) {   // ③-가 대진 짜기 = 왼쪽 시드 순서 · 오른쪽 미리 보기
    if (teams.length < 2) h += '<div class="sec card"><div class="empty">팀을 2개 이상 등록하면 대진을 짤 수 있습니다</div></div>';
    else { const ids = teams.map(x => x.id), PM = t.fmt === 'rr' ? TNC.makeRR(ids, t.bo || 1) : TNC.makeSE(ids, t.bo || 1, t.boF || 0), PR = TNC.resolve(Object.assign({}, t, { matches: PM, res: {} }));
      h += `<div class="sec card"><div class="tn-two"><div><p class="tn-sub">시드 순서</p>${teams.map((tm, i) => `<div class="tn-seed"><i>${i + 1}</i><b>${esc(tm.name)}</b><button class="btn sm" data-ta="sup" data-k="${esc(tm.id)}"${i ? '' : ' disabled'}>▲</button><button class="btn sm" data-ta="sdn" data-k="${esc(tm.id)}"${i < teams.length - 1 ? '' : ' disabled'}>▼</button></div>`).join('')}
        <div class="row" style="margin-top:12px"><button class="btn" data-ta="shuf">무작위로 섞기</button><button class="btn gold" data-ta="gen">이대로 대진 만들기</button></div>
        <p class="tn-help">시드는 무작위나 손으로만 정합니다(라이엇 규정: 점수·랭크로 시드 금지)${t.fmt === 'se' ? ' · 1번 시드가 꼴찌 시드와 만나고, 팀 수가 안 맞으면 위 시드가 부전승' : ''}</p></div>
        <div><p class="tn-sub">미리 보기</p>${t.fmt === 'rr' ? PR.byRound.map(rd => `<p class="tn-sub" style="color:var(--ink-3);margin-top:10px">${esc(rd.name)}</p><div class="tn-rows">${rd.matches.map(m => `<div class="tn-row" style="cursor:default"><b>${esc(m.ta.name)}</b><em>vs</em><b>${esc(m.tb.name)}</b></div>`).join('')}</div>`).join('') : tnBracket(t, PR, true)}</div></div></div>`; }
  } else {   // ③-나 진행 = 대진표 그림(또는 풀리그 순위·경기 줄) + 고른 경기 상세
    const left = t.fmt === 'rr'
      ? `<div class="tw"><table><thead><tr><th>#</th><th>팀</th><th>승</th><th>패</th><th>판 득실</th></tr></thead><tbody>${R.standings.map(p2 => `<tr><td>${p2.rank}</td><td>${esc(p2.name)}</td><td>${p2.w}</td><td>${p2.l}</td><td>${p2.gw}-${p2.gl}</td></tr>`).join('')}</tbody></table></div>`
        + R.byRound.map(rd => `<p class="tn-sub" style="margin-top:14px">${esc(rd.name)}</p><div class="tn-rows">${rd.matches.map(m => { const c = x => m.win ? (m.win === x.id ? 'win' : 'lose') : ''; return `<div class="tn-row${TMSEL === m.id ? ' sel' : ''}" data-bm="${esc(m.id)}"><b class="${c(m.ta)}">${esc(m.ta.name)}</b><em>${m.games.length || m.state === 'done' ? m.sa + ' : ' + m.sb : 'vs'}</em><b class="${c(m.tb)}">${esc(m.tb.name)}</b></div>`; }).join('')}</div>`).join('')
      : tnBracket(t, R, false);
    h += `<div class="sec card"><div class="tn-view"><div>${left}</div>${tnMatchDetail(t, R)}</div>`
      + `<div class="tn-foot"><button class="btn sm red" data-ta="mclr">대진 지우고 다시 짜기</button><span>${resN ? '⚠️ 기록된 결과 ' + resN + '판도 대회에서 빠집니다(경기 기록 자체는 남음)' : '아직 기록된 판이 없습니다'} · 결과는 방장 앱이 자동으로 넣습니다</span></div></div>`;
  }
  box.innerHTML = h;
  box.querySelectorAll('[data-tv]').forEach(b => b.onclick = () => { TVIEW = b.dataset.tv; renderTourDetail(); });
  box.querySelectorAll('[data-bm]').forEach(b => b.onclick = () => { TMSEL = b.dataset.bm; renderTourDetail(); });
  box.querySelectorAll('[data-ta]').forEach(b => b.onclick = () => tnAct(b));
  box.querySelectorAll('select[data-tw]').forEach(sel => sel.onchange = () => { const mid = sel.dataset.tw, v = sel.value || null, nm = v ? (t.teams[v] || {}).name : '자동';
    if (!confirm(`이 경기 승자를 「${nm}」(으)로 정할까요?`)) { renderTourDetail(); return; }
    tnDo(async () => { await api('PUT', tnP(TSEL, `matches/${mid}/win`), v); await logIt({ act: 'twin', target: TSEL, name: t.name, reason: `${mid} → ${nm}`.slice(0, 200) }); }, '승자를 정했습니다'); });
  box.querySelectorAll('.tn-add').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { const b = box.querySelector(`[data-ta="madd"][data-k="${CSS.escape(i.dataset.k)}"]`); if (b) b.click(); } });
}
function tnAct(b) {
  const t = S.tn[TSEL], a = b.dataset.ta, k = b.dataset.k, teams = tnTeams(t); if (!t) return;
  if (a === 'st') { const v = b.dataset.v; if (v === 'done' && !confirm('대회를 끝낼까요? 앱에는 「끝남」으로 남습니다.')) return;
    return tnDo(async () => { await api('PUT', tnP(TSEL, 'st'), v); await logIt({ act: 'tst', target: TSEL, name: t.name, reason: TN_ST[v] }); }, `「${TN_ST[v]}」(으)로 바꿨습니다`); }
  if (a === 'rename') { const n = (prompt('대회 이름', t.name) || '').trim().slice(0, 30); if (!n || n === t.name) return; if (TN_BAN.test(n)) return toast('라이엇 공식 대회 이름이나 「공식」·「라이엇」은 쓸 수 없습니다', true);
    return tnDo(() => api('PUT', tnP(TSEL, 'name'), n), '이름을 바꿨습니다'); }
  if (a === 'del') { if (prompt(`「${t.name}」 대회를 지웁니다. 되돌릴 수 없습니다(경기 기록 자체는 남음).\n지우려면 대회 이름을 그대로 적어 주세요.`) !== t.name) return;
    return tnDo(async () => { await api('DELETE', tnP(TSEL)); await logIt({ act: 'tdel', target: TSEL, name: t.name }); TSEL = null; }, '대회를 지웠습니다'); }
  if (a === 'tadd') { const name = $('tn-tname').value.trim().slice(0, 12), tag = $('tn-ttag').value.trim().toUpperCase().slice(0, 4); if (!name) return toast('팀 이름을 적어 주세요', true);
    if (teams.some(x => x.name === name)) return toast('같은 이름의 팀이 있습니다', true);
    return tnDo(() => api('PUT', tnP(TSEL, 'teams/' + rid('m')), Object.assign({ name, seed: teams.length + 1 }, tag ? { tag } : {})), `「${name}」 팀을 추가했습니다`); }
  const tm = t.teams && t.teams[k];
  if (a === 'trename' && tm) { const n = (prompt('팀 이름(12자)', tm.name) || '').trim().slice(0, 12); if (!n) return; const g = (prompt('태그(4자 · 비우면 없음)', tm.tag || '') || '').trim().toUpperCase().slice(0, 4);
    return tnDo(() => api('PATCH', tnP(TSEL, 'teams/' + k), { name: n, tag: g || null }), '바꿨습니다'); }
  if (a === 'tdel' && tm) { if (!confirm(`「${tm.name}」 팀을 지울까요?`)) return; return tnDo(() => api('DELETE', tnP(TSEL, 'teams/' + k)), '팀을 지웠습니다'); }
  if (a === 'madd' && tm) { const inp = $('tn-detail').querySelector(`.tn-add[data-k="${CSS.escape(k)}"]`), q = (inp.value || '').trim(); if (!q) return toast('이름#태그를 적어 주세요', true);
    const low = q.toLowerCase(), P = people().filter(x => !x.key.startsWith('g_')), hit = P.filter(x => (x.name + (x.tag ? '#' + x.tag : '')).toLowerCase() === low), byName = hit.length ? hit : P.filter(x => x.name.toLowerCase() === low);
    if (!byName.length) return toast('그 이름의 계정이 없습니다 · 앱을 한 번이라도 켠 계정만 등록됩니다', true);
    if (byName.length > 1) return toast('같은 이름이 여러 명입니다 · 이름#태그로 적어 주세요', true);
    const rs = $('tn-detail').querySelector(`.tn-role[data-k="${CSS.escape(k)}"]`), u = byName[0], acc = S.accounts[u.key] || {}, role = (rs && rs.value) || '', c = TNC.rosterCount(tm);
    if (!(acc.pub > 0)) return toast(`${u.name}님은 아직 「내전 기록 공개」에 동의하지 않았습니다 · 앱에서 동의한 뒤 등록할 수 있습니다`, true);
    const other = teams.find(x => x.mem && x.mem[u.key]); if (other) return toast(`${u.name}님은 이미 「${other.name}」 팀에 있습니다`, true);
    if (role === 'sub' ? c.sub >= TNC.SUB_MAX : c.main >= TNC.MAIN_MAX) return toast(role === 'sub' ? `후보는 ${TNC.SUB_MAX}명까지입니다` : `선수는 ${TNC.MAIN_MAX}명까지입니다 · 후보로 추가하세요`, true);
    return tnDo(() => api('PUT', tnP(TSEL, `teams/${k}/mem/${u.key}`), { n: u.name, r: role === 'sub' ? 'sub' : (c.cap || c.main ? '' : 'cap') }), `${u.name}님을 추가했습니다`); }
  if (a === 'mdel' && tm) { const m = tm.mem[b.dataset.p]; if (!m || !confirm(`${m.n}님을 「${tm.name}」 팀에서 뺄까요?`)) return; return tnDo(() => api('DELETE', tnP(TSEL, `teams/${k}/mem/${b.dataset.p}`)), '뺐습니다'); }
  if (a === 'mrole' && tm) { const m = tm.mem[b.dataset.p], c = TNC.rosterCount(tm); if (!m) return; const cur = m.r || '', next = cur === '' ? 'cap' : cur === 'cap' ? 'sub' : '';
    if (next === 'sub' && c.sub >= TNC.SUB_MAX) return toast(`후보는 ${TNC.SUB_MAX}명까지입니다`, true);
    if (next === '' && cur === 'sub' && c.main >= TNC.MAIN_MAX) return toast(`선수는 ${TNC.MAIN_MAX}명까지입니다`, true);
    const up = { [`${b.dataset.p}/r`]: next }; if (next === 'cap') for (const [pk, x] of Object.entries(tm.mem)) if (x.r === 'cap' && pk !== b.dataset.p) up[`${pk}/r`] = '';   // 팀장은 한 명
    return tnDo(() => api('PATCH', tnP(TSEL, `teams/${k}/mem`), up)); }
  if (a === 'sup' || a === 'sdn' || a === 'shuf') { let ord = teams.map(x => x.id); const i = ord.indexOf(k);
    if (a === 'shuf') for (let j = ord.length - 1; j > 0; j--) { const r2 = Math.floor(Math.random() * (j + 1)); [ord[j], ord[r2]] = [ord[r2], ord[j]]; }
    else { const j = a === 'sup' ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; }
    const up = {}; ord.forEach((id2, n) => { up[`${id2}/seed`] = n + 1; });
    return tnDo(() => api('PATCH', tnP(TSEL, 'teams'), up)); }
  if (a === 'gen') { if (teams.length < 2) return; const empty = teams.filter(x => !Object.keys(x.mem || {}).length);
    if (empty.length && !confirm(`선수가 없는 팀이 있습니다(${empty.map(x => x.name).join(', ')}). 그래도 대진을 만들까요?`)) return;
    const ids = teams.map(x => x.id), M = t.fmt === 'rr' ? TNC.makeRR(ids, t.bo || 1) : TNC.makeSE(ids, t.bo || 1, t.boF || 0);
    return tnDo(async () => { TVIEW = 'matches'; TMSEL = null; await api('PUT', tnP(TSEL, 'matches'), M); await logIt({ act: 'tgen', target: TSEL, name: t.name, reason: `${teams.length}팀 · ${Object.keys(M).length}경기` }); }, '대진을 만들었습니다 · 확인한 뒤 「대회 시작」을 누르세요'); }
  if (a === 'mclr') { if (!confirm('대진을 지우고 다시 짤까요?' + (tnResN(t) ? '\n⚠️ 이 대회에 기록된 결과도 함께 빠집니다.' : ''))) return;
    return tnDo(async () => { await api('PATCH', tnP(TSEL), { matches: null, res: null }); await logIt({ act: 'tgen', target: TSEL, name: t.name, reason: '대진 지움' }); }, '대진을 지웠습니다'); }
  if (a === 'rclr') { if (!confirm('이 경기에 기록된 판을 대회에서 뺄까요? (경기 기록 자체는 남습니다 · 다시 하면 새로 쌓임)')) return;
    return tnDo(async () => { await api('DELETE', tnP(TSEL, 'res/' + k)); await logIt({ act: 'tres', target: TSEL, name: t.name, reason: k }); }, '결과를 지웠습니다'); }
}
// 🚨 신고함
function renderReports() {
  const all = Object.entries(S.reports || {}).map(([id, r]) => ({ id, ...r })).filter(r => r && r.at).sort((a, b) => (a.st === 'done') - (b.st === 'done') || b.at - a.at);
  const open = all.filter(r => r.st !== 'done').length; $('rep-n').textContent = open || '';
  $('reps').innerHTML = all.length ? all.map(r => {
    const L = Object.values(r.lines || {}).filter(l => l && l.text).sort((a, b) => a.at - b.at), ok = PKEY.test(String(r.target || '')), done = r.st === 'done';
    return `<div class="rep ${done ? 'done' : ''}"><div class="top"><span class="tag ${done ? '' : 'ban'}">${done ? '처리함' : '대기'}</span><span class="tag">${esc(r.why || '기타')}</span>`
      + (ok ? `<span class="tg" data-k="${esc(r.target)}" title="사람 카드 열기">${esc(r.name || '?')}</span>` : `<span class="tg bad">${esc(r.name || '?')}</span><span class="tag ban" title="대상 계정 번호가 정상 모양이 아닙니다 · 조작된 신고일 수 있어 사람 카드를 열지 않습니다">대상 번호 이상</span>`) + `</div>`
      + `<div class="meta">신고 <b>${esc(r.byName || '?')}</b> · 방 「${esc(r.roomName || '?')}」 · ${fmt(r.at)}</div>`
      + (r.memo ? `<div class="memo">${esc(r.memo)}</div>` : '')
      + (L.length ? `<div class="lines"><div class="lh"><span class="en">CHAT</span><span>신고한 사람 앱이 받은 최근 말 · 서버가 확인한 기록 아님</span></div>${L.map(l => `<div class="l"><small>${fmt(l.at)}</small><span>${esc(l.text)}</span></div>`).join('')}</div>` : '')
      + (done ? `<div class="res">처리 <b>${esc(r.res || '처리함')}</b> · ${esc(r.doneBy || '')} · ${fmt(r.doneAt || 0)}</div>`
        : `<div class="act">${ok ? `<button class="btn sm" data-open="${esc(r.target)}">사람 카드(경고·채팅 금지·정지)</button>` : ''}<button class="btn sm" data-done="${esc(r.id)}">처리함으로</button><button class="btn sm" data-skip="${esc(r.id)}">문제없음</button></div>`) + `</div>`;
  }).join('') : '<div class="empty">신고가 없습니다</div>';
}
document.querySelector('section[data-p="reports"]').onclick = async e => {
  const o = e.target.closest('[data-open],[data-k]'), d = e.target.closest('[data-done]'), sk = e.target.closest('[data-skip]');
  if (d || sk) { const id = (d || sk).dataset.done || (sk && sk.dataset.skip); const res = d ? (prompt('어떻게 처리했나요? (예: 경고 줌 · 채팅 금지 1일)', '') ?? null) : '문제없음'; if (res === null) return; await resolveReport(id, String(res).slice(0, 200) || '처리함'); }
  else if (o) openPerson(o.dataset.open || o.dataset.k);
};
async function resolveReport(id, res) {
  const r = S.reports[id] || {};
  try { await api('PATCH', `${CT}/reports/${id}`, { st: 'done', res, doneBy: ME.name.slice(0, 40), doneAt: Date.now() }); await logIt({ act: 'report', target: r.target || '', name: String(r.name || '').slice(0, 60), reason: res }); toast('처리했습니다'); await load(); }
  catch (e) { toast('처리하지 못했습니다 · ' + e.message, true); }
}
// 📢 공지
function renderNotice() {
  const n = S.notice, live = n && n.until > Date.now();
  $('ntc-now').innerHTML = live ? `<div class="box ${n.lv === 'warn' ? 'banbox' : ''}"><h4>지금 떠 있는 공지 · ${fmt(n.until)}까지</h4><div style="white-space:pre-wrap">${esc(n.text)}</div><div class="row" style="margin-top:10px"><button class="btn sm red" id="ntc-down">공지 내리기</button><span class="mute">${esc(n.by || '')} · ${fmt(n.at)}</span></div></div>` : '<div class="mute">지금 떠 있는 공지가 없습니다</div>';
  const dn = $('ntc-down'); if (dn) dn.onclick = noticeDown;
}
$('ntc-go').onclick = async () => {
  const text = $('ntc-tx').value.trim(), h = Number($('ntc-h').value), lv = $('ntc-lv').value;
  if (!text) { toast('공지 글을 적어 주세요', true); return; }
  if (!confirm(`모든 앱에 이 공지를 ${h >= 24 ? h / 24 + '일' : h + '시간'} 띄울까요?\n\n${text}`)) return;
  try { await api('PUT', `${CT}/notice`, { id: 'n' + Date.now().toString(36), text: text.slice(0, 200), at: Date.now(), until: Date.now() + h * 3600e3, by: ME.name.slice(0, 40), lv }); await logIt({ act: 'notice', reason: text.slice(0, 200), until: Date.now() + h * 3600e3 }); $('ntc-tx').value = ''; toast('공지를 올렸습니다 · 1분 안에 모든 앱에 뜹니다'); await load(); }
  catch (e) { toast('올리지 못했습니다 · ' + e.message, true); }
};
async function noticeDown() {
  if (!confirm('지금 공지를 내릴까요?')) return;
  try { await api('DELETE', `${CT}/notice`); await logIt({ act: 'unnotice' }); toast('공지를 내렸습니다'); await load(); }
  catch (e) { toast('내리지 못했습니다 · ' + e.message, true); }
}
function renderLog() {
  const L = Object.values(S.modlog).filter(Boolean).sort((a, b) => b.at - a.at);
  $('mlog').innerHTML = L.length ? L.map(x => `<li><b>${esc(x.by)}</b> · ${ACT[x.act] || esc(x.act)} · <b>${esc(x.name || x.room || x.target || '')}</b>${['ban', 'mute', 'notice'].includes(x.act) && x.until ? ` · ${x.until >= PERM ? '영구' : fmt(x.until) + '까지'}` : ''}${x.reason ? ` · <span class="mute">${esc(x.reason)}</span>` : ''}<span class="mute" style="float:right">${fmt(x.at)}</span></li>`).join('') : '<li class="empty">아직 기록이 없습니다</li>';
}

// ── 사람 카드 ──
async function openPerson(key) {
  if (!PKEY.test(String(key || ''))) { toast('계정 번호가 올바르지 않은 신고입니다(조작된 값일 수 있음)'); return; }
  const x = people().find(p => p.key === key) || { key, name: '?', tag: '' };
  const rid = roomOf(key), room = rid && S.roomList[rid], b = x.ban;
  const hist = Object.values(S.modlog).filter(l => l && l.target === key).sort((a, c) => c.at - a.at);
  $('pn').innerHTML = `<button class="x" data-close>×</button><div class="en">PLAYER</div><h3>${esc(x.name)}<span class="mute" style="font-size:15px">#${esc(x.tag)}</span></h3>
    <dl class="kv"><dt>상태</dt><dd><span class="dot ${x.on ? 'on' : ''}"></span>${x.on ? '접속 중' : '오프라인'} · 마지막 ${ago(x.last)}</dd>
      <dt>앱 버전</dt><dd>${x.p && x.p.app ? 'v' + esc(x.p.app) : '—'}</dd>
      <dt>지금 있는 방</dt><dd>${room ? esc(room.name) : '—'}</dd>
      <dt>계정 번호</dt><dd class="mute">${esc(key)}</dd>
      <dt>기록</dt><dd id="pn-games" class="mute">불러오는 중…</dd></dl>
    ${banOn(b) ? `<div class="box banbox"><h4>정지 중 · ${until(b)}</h4><div class="mute">사유 · ${esc(b.reason || '—')} · ${esc(b.by || '')} ${fmt(b.at || 0)}</div><div class="row" style="margin-top:10px"><button class="btn" data-unban="${esc(key)}">정지 해제</button></div></div>`
      : `<div class="box banbox"><h4>정지하기</h4>
        <div class="row"><select id="ban-d"><option value="1">1일</option><option value="3" selected>3일</option><option value="7">7일</option><option value="30">30일</option><option value="0">영구</option></select><span class="mute">정지하면 있던 방에서 바로 내보냅니다 · 기간이 끝나면 저절로 풀립니다</span></div>
        <div class="row"><textarea id="ban-r" maxlength="200" placeholder="사유(정지당한 사람 앱에 그대로 보입니다)"></textarea></div>
        <div class="row"><button class="btn red" id="ban-go">정지</button></div></div>`}
    <div class="box"><h4>경고 · 채팅 금지</h4>
      <div class="mute">경고 ${warnN(key)}번${banOn(S.mutes[key]) ? ` · <b style="color:#ff9ca8">채팅 금지 중 ${until(S.mutes[key])}</b>` : ''} · 받은 신고 ${Object.values(S.reports || {}).filter(r => r && r.target === key).length}건</div>
      <div class="row" style="margin-top:10px"><input class="in" id="wm-r" maxlength="200" placeholder="사유(그 사람 앱에 그대로 보입니다)" style="flex:1;min-width:0"></div>
      <div class="row"><button class="btn" id="warn-go">경고 주기</button>
        ${banOn(S.mutes[key]) ? '<button class="btn" id="unmute-go">채팅 금지 풀기</button>' : '<select id="mute-h"><option value="1">1시간</option><option value="24" selected>1일</option><option value="72">3일</option><option value="168">7일</option></select><button class="btn" id="mute-go">채팅 금지</button>'}</div>
      <div class="mute" style="margin-top:6px">경고 = 그 사람 앱에 한 번 안내 · 채팅 금지 = 한마디·이모티콘·핑만 막음(게임은 그대로)</div></div>
    ${rid ? `<div class="box"><h4>방에서 내보내기</h4><div class="row"><span class="mute">${esc(room ? room.name : rid)} 방에서만 내보냅니다(정지는 아님 · 다시 들어올 수 있음)</span><button class="btn" id="kick-go">내보내기</button></div></div>` : ''}
    <div class="box"><h4>개인정보 지우기(삭제 요청 처리)</h4><div class="mute">계정·전적 점수·디스코드 연결·접속 표시·기기 등록 칸을 지우고, 경기 기록 속 이름·계정 번호를 「지운 이름」으로 바꿉니다. 판 결과(승패·다른 사람 기록)는 그대로입니다. 앱을 다시 켜고 롤에 로그인하면 계정·접속 칸은 다시 생깁니다.</div><div class="row" style="margin-top:10px"><button class="btn red" id="wipe-go">개인정보 지우기</button></div></div>
    <div class="box log"><h4>운영 기록</h4><ul>${hist.length ? hist.map(l => `<li>${fmt(l.at)} · ${ACT[l.act] || esc(l.act)} · ${esc(l.by)}${l.reason ? ' · ' + esc(l.reason) : ''}</li>`).join('') : '<li class="mute">없음</li>'}</ul></div>`;
  $('dr').classList.add('on');
  const bg = $('ban-go'); if (bg) bg.onclick = () => ban(key, x.name, Number($('ban-d').value), $('ban-r').value.trim());
  const kg = $('kick-go'); if (kg) kg.onclick = () => kick(key, x.name, rid, true);
  const wr = () => $('wm-r').value.trim();
  $('warn-go').onclick = () => warn(key, x.name, wr());
  $('wipe-go').onclick = () => wipe(key, x.name);
  const mg = $('mute-go'); if (mg) mg.onclick = () => mute(key, x.name, Number($('mute-h').value), wr());
  const ug = $('unmute-go'); if (ug) ug.onclick = () => unmute(key, x.name);
  $('pn').querySelectorAll('[data-unban]').forEach(b2 => b2.onclick = () => unban(key));
  // 기록 요약(경기 기록 전체에서 이 계정 판)
  const all = await loadAllDays(); let m = 0, w = 0, n = 0, lastDay = '';
  for (const [day, kinds] of Object.entries(all)) {
    for (const g of Object.values((kinds || {}).matches || {})) { if (!g) continue; const ids = g.ids || {}, nm = Object.keys(ids).find(k => ids[k] === key); if (!nm) continue; m++; lastDay = day > lastDay ? day : lastDay; const inA = (g.teamA || []).includes(nm); if (g.winner && ((g.winner === 'teamA') === inA)) w++; }
    for (const g of Object.values((kinds || {}).normals || {})) { if (g && Object.values(g.ids || {}).includes(key)) { n++; lastDay = day > lastDay ? day : lastDay; } }
  }
  const el = $('pn-games'); if (el) el.textContent = m || n ? `내전 ${m}판 ${w}승 ${m - w}패${m ? ` · 승률 ${Math.round(w / m * 100)}%` : ''} · 같이 한 일반 판 ${n} · 마지막 판 ${lastDay || '—'}` : '기록 없음';
}
$('dr').onclick = e => { if (e.target.closest('[data-close]')) $('dr').classList.remove('on'); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('dr').classList.remove('on'); });

// ── 조작 ──
const logIt = o => api('POST', `${CT}/modlog`, Object.assign({ at: Date.now(), by: ME.name }, o));
async function kick(key, name, rid, alone) {   // ① 내보냄 표시(앱 v0.1.217+가 보고 스스로 방을 나가며 안내 · v0.1.244+는 방장이어도) ② 들어왔음·방 사람·참가 칸을 지움(옛 앱도 방 안 쓰기가 바로 막힘)
  if (alone && !confirm(`${name}님을 방에서 내보낼까요?`)) return;
  try {
    await api('PUT', `${CT}/rooms/${rid}/lobby/kick/${key}`, { at: Date.now(), by: '운영자', admin: true });
    await new Promise(r => setTimeout(r, 2500));   // 그 사람 앱이 표시를 보고 나갈 틈
    for (const p of [`uids/${key}`, `members/${key}`, `lobby/join/${key}`, `lobby/chat/${key}`]) await api('DELETE', `${CT}/rooms/${rid}/${p}`);
    if (alone) { await logIt({ act: 'kick', target: key, name, room: String((S.roomList[rid] || {}).name || rid).slice(0, 40) }); toast('내보냈습니다'); await load(); openPerson(key); }
  } catch (e) { toast('내보내지 못했습니다 · ' + e.message, true); }
}
async function ban(key, name, days, reason) {
  if (!reason) { toast('사유를 적어 주세요', true); return; }
  const u = days ? Date.now() + days * 86400e3 : PERM;
  if (!confirm(`${name}님을 ${days ? days + '일' : '영구'} 정지할까요?\n사유: ${reason}`)) return;
  try {
    await api('PUT', `${CT}/bans/${key}`, { until: u, at: Date.now(), reason: reason.slice(0, 200), by: ME.name.slice(0, 40), name: String(name).slice(0, 60) });
    const rid = roomOf(key); if (rid) await kick(key, name, rid, false);
    await api('DELETE', `${CT}/presence/${key}`).catch(() => {});
    await logIt({ act: 'ban', target: key, name: String(name).slice(0, 60), reason: reason.slice(0, 200), until: u });
    toast('정지했습니다'); await load(); openPerson(key);
  } catch (e) { toast('정지하지 못했습니다 · ' + e.message, true); }
}
async function warn(key, name, reason) {
  if (!reason) { toast('사유를 적어 주세요', true); return; }
  if (!confirm(`${name}님에게 경고를 줄까요?\n사유: ${reason}`)) return;
  try { await api('POST', `${CT}/warns/${key}`, { at: Date.now(), reason: reason.slice(0, 200), by: ME.name.slice(0, 40) }); await logIt({ act: 'warn', target: key, name: String(name).slice(0, 60), reason: reason.slice(0, 200) }); toast('경고했습니다 · 그 사람 앱에 1분 안에 뜹니다'); await load(); openPerson(key); }
  catch (e) { toast('경고하지 못했습니다 · ' + e.message, true); }
}
async function mute(key, name, hours, reason) {
  if (!reason) { toast('사유를 적어 주세요', true); return; }
  if (!confirm(`${name}님을 ${hours >= 24 ? hours / 24 + '일' : hours + '시간'} 채팅 금지할까요?\n사유: ${reason}`)) return;
  const u = Date.now() + hours * 3600e3;
  try { await api('PUT', `${CT}/mutes/${key}`, { until: u, at: Date.now(), reason: reason.slice(0, 200), by: ME.name.slice(0, 40), name: String(name).slice(0, 60) }); await logIt({ act: 'mute', target: key, name: String(name).slice(0, 60), reason: reason.slice(0, 200), until: u }); toast('채팅 금지했습니다'); await load(); openPerson(key); }
  catch (e) { toast('채팅 금지하지 못했습니다 · ' + e.message, true); }
}
async function unmute(key, name) {
  if (!confirm(`${name}님 채팅 금지를 풀까요?`)) return;
  try { await api('DELETE', `${CT}/mutes/${key}`); await logIt({ act: 'unmute', target: key, name: String(name).slice(0, 60) }); toast('채팅 금지를 풀었습니다'); await load(); openPerson(key); }
  catch (e) { toast('풀지 못했습니다 · ' + e.message, true); }
}
// 🧾 경기 기록(날짜별 · 이긴 팀 바꾸기 · 지우기)
let GD = null;
function renderGameDays() {
  const keys = []; for (let i = 0; i < 14; i++) keys.push(dayKey(Date.now() - i * 86400e3));
  $('gm-days').innerHTML = keys.map(d => { const c = (S.days || []).find(x => x.d === d); return `<button class="btn sm ${d === GD ? 'on' : ''}" data-d="${d}">${d.slice(5).replace('-', '/')}${c && c.m + c.n ? ` · ${c.m + c.n}` : ''}</button>`; }).join('');
}
$('gm-days').onclick = e => { const b = e.target.closest('[data-d]'); if (b) loadGames(b.dataset.d); };
async function loadGames(d) {
  GD = d; renderGameDays(); $('gm-h').textContent = d + ' 경기 기록'; $('gm-list').innerHTML = '<div class="empty">불러오는 중…</div>';
  const day = (await get(`${CT}/days/${d}`).catch(() => null)) || {};
  const rows = [];
  for (const [kind, set] of Object.entries(day)) for (const [gid, g] of Object.entries(set || {})) if (g) rows.push({ kind, gid, g });
  rows.sort((a, b) => (b.g.ts || 0) - (a.g.ts || 0));
  $('gm-list').innerHTML = rows.length ? rows.map(({ kind, gid, g }) => {
    const A = (g.teamA || []).map(esc).join(', '), B = (g.teamB || []).map(esc).join(', ');
    return `<div class="gm"><div class="top"><span class="tag ${kind === 'matches' ? 'gold' : ''}">${kind === 'matches' ? '내전' : '같이 한 일반 판'}</span><b>${fmt(g.ts || 0)}</b><span class="mute">${esc(g.roomName || '')}${g.queue ? ' · ' + esc(g.queue) : ''} · ${g.source === 'manual' ? '방장이 직접 기록' : '자동 기록'} · ${esc(gid)}</span></div>
      ${kind === 'matches' ? `<div class="tm"><div class="${g.winner === 'teamA' ? 'win' : ''}"><b>1팀</b>${g.winner === 'teamA' ? ' · 승' : ''}<br>${A || '—'}</div><div class="b ${g.winner === 'teamB' ? 'win' : ''}"><b>2팀</b>${g.winner === 'teamB' ? ' · 승' : ''}<br>${B || '—'}</div></div>` : `<div class="mute" style="margin-top:6px">${g.win ? '승' : '패'} · ${(g.us || []).map(esc).join(', ')}</div>`}
      ${g.mvp ? `<div class="mute" style="margin-top:6px">MVP ${esc(g.mvp)}${g.svp ? ' · SVP ' + esc(g.svp) : ''}${g.manner ? ' · 매너 ' + esc(g.manner) : ''}</div>` : ''}
      <div class="act">${kind === 'matches' && g.winner ? `<button class="btn sm" data-flip="${esc(gid)}">이긴 팀을 ${g.winner === 'teamA' ? '2팀' : '1팀'}으로 바꾸기</button>` : ''}<button class="btn sm red" data-gdel="${esc(kind + '/' + gid)}">기록 지우기</button></div></div>`;
  }).join('') : '<div class="empty">이 날 기록이 없습니다</div>';
  $('gm-list').onclick = async e => {
    const fl = e.target.closest('[data-flip]'), dl = e.target.closest('[data-gdel]');
    if (fl) { const g = (day.matches || {})[fl.dataset.flip]; if (!g) return; const to = g.winner === 'teamA' ? 'teamB' : 'teamA', why = prompt(`이긴 팀을 ${to === 'teamA' ? '1팀' : '2팀'}으로 바꿀까요?\nMVP·SVP는 그대로 남습니다. 이유를 적어 주세요`, ''); if (why === null) return;
      try { await api('PATCH', `${CT}/days/${d}/matches/${fl.dataset.flip}`, { winner: to }); await logIt({ act: 'gamefix', target: fl.dataset.flip, room: String(g.roomName || '').slice(0, 40), reason: `${d} 이긴 팀 → ${to === 'teamA' ? '1팀' : '2팀'}${why ? ' · ' + why : ''}`.slice(0, 200) }); toast('바꿨습니다'); loadGames(d); } catch (er) { toast('바꾸지 못했습니다 · ' + er.message, true); } }
    if (dl) { const [kind, gid] = dl.dataset.gdel.split('/'), g = (day[kind] || {})[gid] || {}; const why = prompt(`${d} ${fmt(g.ts || 0)} 기록을 지울까요? 되돌릴 수 없습니다.\n이유를 적어 주세요`, ''); if (why === null) return;
      try { await api('DELETE', `${CT}/days/${d}/${kind}/${gid}`); await logIt({ act: 'gamedel', target: gid, room: String(g.roomName || '').slice(0, 40), reason: `${d}${why ? ' · ' + why : ''}`.slice(0, 200) }); toast('지웠습니다'); loadGames(d); loadDays().catch(() => {}); } catch (er) { toast('지우지 못했습니다 · ' + er.message, true); } }
  };
}
// 🧹 개인정보 지우기 — 내 칸들 지우고 경기 기록 속 이름·계정 번호를 「지운 이름 ○○○○」으로(판 결과는 그대로)
const fbKey = n => String(n || '').trim().replace(/\s+/g, ' ').replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_');
async function wipe(key, name) {
  if (!confirm(`${name}님의 개인정보를 지울까요?\n계정·전적 점수·디스코드·접속·기기 칸을 지우고, 경기 기록 속 이름을 「지운 이름」으로 바꿉니다. 되돌릴 수 없습니다.`)) return;
  const label = '지운 이름 ' + key.replace(/-/g, '').slice(0, 4);
  try {
    toast('경기 기록을 살펴보는 중…');
    const all = await loadAllDays(true); let n = 0;
    for (const [day, kinds] of Object.entries(all)) for (const [kind, set] of Object.entries(kinds || {})) for (const [gid, g] of Object.entries(set || {})) {
      if (!g || !JSON.stringify(g).includes(key)) continue;
      const names = new Set([name]);
      for (const [nm, pu] of Object.entries(g.ids || {})) if (pu === key) names.add(nm);
      for (const p of Object.values(g.stats || {})) if (p && p.puuid === key && p.summonerName) names.add(p.summonerName);
      const hit = new Set([key]), keyed = new Set(); for (const nm of names) if (nm) { hit.add(nm); keyed.add(fbKey(nm)); }
      const subs = [...names].filter(x => x && x.length >= 2);
      const tr = v => typeof v === 'string' ? (hit.has(v) ? label : subs.reduce((t, x) => t.split(x).join(label), v)) : Array.isArray(v) ? v.map(tr) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [hit.has(k) ? label : keyed.has(k) ? fbKey(label) : k, tr(x)])) : v;
      await api('PUT', `${CT}/days/${day}/${kind}/${gid}`, tr(g)); n++;
    }
    for (const p of [`today/accounts/${key}`, `today/ratings/${key}`, `today/discord/${key}`, `${CT}/presence/${key}`, `today/owners/${key}`]) await api('DELETE', p);
    await logIt({ act: 'wipe', target: key, name: label, reason: `경기 기록 ${n}판 이름 바꿈` });
    toast(`지웠습니다 · 경기 기록 ${n}판`); $('dr').classList.remove('on'); await load();
  } catch (e) { toast('지우다 멈췄습니다 · ' + e.message + ' · 다시 누르면 이어서 합니다', true); }
}
// 🚦 자리 한도 · 👥 운영자
const seatsNow = () => Object.values(S.conns || {}).filter(t => Date.now() - t < 60000).length;
function renderAdmin() {
  $('cap').closest('.sec').classList.toggle('hide', !ME.global);   // 자리 한도 = 서버 전체(전체 운영자만)
  $('adm-h').textContent = COMM ? `운영자 · ${(COMMS[COMM] || {}).name || COMM}` : '운영자(전체)';
  renderComms();
  const cap = S.connCap || 80;
  $('cap').innerHTML = `<div class="row"><span style="font:700 26px var(--en)">${seatsNow()} <small class="mute" style="font:500 13px var(--sans)">/ ${cap}${S.connCap ? '' : ' (기본값)'}</small></span><span class="mute">지금 앱을 켠 기기 수 / 한도 · 한도가 차면 새로 켠 사람에게 「자리가 꽉 찼어요」</span></div>
    <div class="row" style="margin-top:10px"><input class="in" id="cap-in" type="number" min="10" max="100" value="${cap}" style="width:90px"><button class="btn" id="cap-go">한도 바꾸기</button><span class="mute">10~100 · 앱마다 연결 1개 + 켜는 순간 여유 · 무료 서버 한도 100</span></div>`;
  $('cap-go').onclick = async () => { const v = Math.round(Number($('cap-in').value)); if (!(v >= 10 && v <= 100)) { toast('10~100 사이로 적어 주세요', true); return; } if (!confirm(`동시 접속 한도를 ${v}로 바꿀까요?`)) return;
    try { await api('PUT', 'today/config/connCap', v); await logIt({ act: 'cap', reason: `${S.connCap || 80} → ${v}` }); toast('바꿨습니다'); load(); } catch (e) { toast('바꾸지 못했습니다 · ' + e.message, true); } };
  const L = Object.entries(S.admins || {});
  $('adm-sp').textContent = ME.owner ? '주인 운영자만 추가·뺄 수 있음' : '추가·빼기는 주인 운영자만';
  $('adms').innerHTML = L.map(([uid, a]) => `<tr><td><b>${esc(a.name || '?')}</b>${a.owner ? ' <span class="tag gold">주인</span>' : ''}${uid === ME.uid ? ' <span class="tag">나</span>' : ''}</td><td class="mute">${esc(uid)}</td><td class="mute">${a.at ? fmt(a.at) : ''}</td><td>${ME.owner && uid !== ME.uid ? `<button class="btn sm red" data-opdel="${esc(uid)}">빼기</button>` : ''}</td></tr>`).join('');
  $('adm-add').innerHTML = ME.owner ? `<div class="row" style="margin-top:12px"><input class="in" id="op-uid" placeholder="운영자 번호(그 사람이 보드에 로그인하면 보임)" style="flex:1;min-width:0"><input class="in" id="op-nm" maxlength="40" placeholder="이름" style="width:130px"><button class="btn" id="op-go">운영자 추가</button></div>` : '';
  const og = $('op-go'); if (og) og.onclick = async () => { const uid = $('op-uid').value.trim(), nm = $('op-nm').value.trim(); if (!/^[A-Za-z0-9]{20,40}$/.test(uid) || !nm) { toast('번호와 이름을 확인해 주세요', true); return; } if (!confirm(`${nm}님을 운영자로 추가할까요?\n정지·경고·기록 고치기를 할 수 있게 됩니다.`)) return;
    try { await api('PUT', `${ADM()}/${uid}`, { name: nm, at: Date.now() }); await logIt({ act: 'opadd', target: uid, name: nm }); toast('추가했습니다'); load(); } catch (e) { toast('추가하지 못했습니다 · ' + e.message, true); } };
  $('adms').onclick = async e => { const b = e.target.closest('[data-opdel]'); if (!b) return; const a = S.admins[b.dataset.opdel] || {}; if (!confirm(`${a.name || '이 운영자'}를 운영자에서 뺄까요?`)) return;
    try { await api('DELETE', `${ADM()}/${b.dataset.opdel}`); await logIt({ act: 'opdel', target: b.dataset.opdel, name: String(a.name || '').slice(0, 60) }); toast('뺐습니다'); load(); } catch (er) { toast('빼지 못했습니다 · ' + er.message, true); } };
}
// 🏘️ 커뮤니티 목록·만들기(주인만) — today/communities/{id} = {name, at, by} · today/communityCodes/{코드} = id
async function renderComms() {
  const sec = $('cm-sec'); sec.classList.toggle('hide', !ME.owner); if (!ME.owner) return;
  let codes = {}; try { codes = (await get('today/communityCodes')) || {}; } catch (_) {}
  const byId = {}; for (const [c, id] of Object.entries(codes)) (byId[id] = byId[id] || []).push(c);
  const link = id => `${location.origin}${location.pathname}?c=${encodeURIComponent(id)}`;
  $('cms').innerHTML = Object.entries(COMMS).map(([id, c]) => `<tr><td><b>${esc((c && c.name) || id)}</b> <span class="mute">${esc(id)}</span>${c && c.db ? ` <span class="tag">전용 서버 ${esc(c.db.proj)}</span>` : ''}</td><td>${(byId[id] || []).map(x => `<span class="tag gold">${esc(x)}</span>`).join(' ') || '<span class="mute">코드 없음</span>'}</td><td><button class="btn sm" data-cmlink="${esc(id)}">운영자 링크 복사</button> <button class="btn sm" data-cmcode="${esc(id)}">코드 새로</button></td></tr>`).join('') || '<tr><td class="mute">아직 없음 · 기본 커뮤니티만 있음</td></tr>';
  $('cm-add').innerHTML = `<div class="row" style="margin-top:12px"><input class="in" id="cm-nm" maxlength="20" placeholder="커뮤니티 이름(앱에 보임 · 예: 큐)" style="flex:1;min-width:0"><input class="in" id="cm-id" maxlength="24" placeholder="영문 이름표(예: que)" style="width:150px"><button class="btn gold" id="cm-go">만들기</button></div>`;
  const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let x = ''; const r = crypto.getRandomValues(new Uint8Array(6)); for (const v of r) x += A[v % A.length]; return x; };
  const addCode = async id => { const code = newCode(); await api('PUT', `today/communityCodes/${code}`, id); await logIt({ act: 'commcode', target: id, reason: code }); return code; };
  $('cm-go').onclick = async () => {
    const nm = $('cm-nm').value.trim(), id = $('cm-id').value.trim().toLowerCase();
    if (!nm || !/^[a-z0-9_-]{2,24}$/.test(id)) { toast('이름과 영문 이름표(소문자·숫자 2~24자)를 확인해 주세요', true); return; }
    if (COMMS[id]) { toast('이미 있는 이름표입니다', true); return; }
    if (!confirm(`「${nm}」 커뮤니티를 만들까요?\n이름표 ${id} · 초대 코드는 자동으로 만들어집니다`)) return;
    try { await api('PUT', `today/communities/${id}`, { name: nm, at: Date.now(), by: ME.name.slice(0, 40) }); const code = await addCode(id); await logIt({ act: 'commadd', target: id, name: nm });
      COMMS[id] = { name: nm }; const o = document.createElement('option'); o.value = id; o.textContent = nm; $('comm').appendChild(o); $('comm').classList.remove('hide');
      toast(`만들었습니다 · 초대 코드 ${code}`); renderComms(); } catch (e) { toast('만들지 못했습니다 · ' + e.message, true); }
  };
  $('cms').onclick = async e => {
    const l = e.target.closest('[data-cmlink]'), c = e.target.closest('[data-cmcode]');
    if (l) navigator.clipboard.writeText(link(l.dataset.cmlink)).then(() => toast('복사했습니다 · 그 커뮤니티 운영자에게 전달(운영자 번호는 아래 「운영자」에 추가)'));
    if (c) { if (!confirm('초대 코드를 하나 더 만들까요? (예전 코드도 그대로 쓸 수 있음)')) return; try { toast('새 코드 ' + await addCode(c.dataset.cmcode)); renderComms(); } catch (er) { toast('만들지 못했습니다 · ' + er.message, true); } }
  };
}
async function unban(key, quiet) {
  const b = S.bans[key] || {}, name = b.name || key.slice(0, 8);
  if (!quiet && !confirm(`${name}님 정지를 풀까요?`)) return;
  try {
    await api('DELETE', `${CT}/bans/${key}`);
    if (!quiet) await logIt({ act: 'unban', target: key, name: String(name).slice(0, 60) });
    toast(quiet ? '기록을 지웠습니다' : '정지를 풀었습니다'); await load(); if ($('dr').classList.contains('on')) openPerson(key);
  } catch (e) { toast('풀지 못했습니다 · ' + e.message, true); }
}
async function roomDelete(id) {
  const r = S.roomList[id] || {};
  if (!confirm(`「${r.name || id}」 방을 지울까요?\n안에 있는 사람은 방 밖으로 나가게 됩니다`)) return;
  try { await api('DELETE', `${CT}/roomList/${id}`); await api('DELETE', `${CT}/rooms/${id}`); await logIt({ act: 'roomdel', room: String(r.name || id).slice(0, 40) }); toast('방을 지웠습니다'); load(); }
  catch (e) { toast('지우지 못했습니다 · ' + e.message, true); }
}
