// ── 🧭 증강 가이드 — 오른쪽 창 「증강」 탭(v0.1.72 · v0.1.74 플랜 방식) ─────────────
// 챔피언마다 「플랜」 몇 개 = 이름(예: 치명타 폭딜) + 노릴 증강 묶음 + 한 줄 설명 → 저장 = today/augGuide/champs/{id}
// 챔피언 선택 동안엔 이 탭이 저절로 열려 「보는 화면」(내 챔피언·벤치별 플랜) — 왼쪽 창은 팀 화면 그대로 · 끝나면 원래 탭으로
// ✍️ 위키처럼(v0.1.76): 누구나 고침 · 플랜마다 마지막으로 고친 사람 · 편집마다 기록(무엇을 바꿨는지) → 「기록」에서 되돌리기 · 남이 먼저 고쳤으면 충돌 알림
// ⚖️ v0.1.246: 증강 승률·등급(T1~T5)·상위 증강·피하기·자료 초안은 뺌(라이엇 정책: 증강 승률 표시 금지) → 사람이 쓴 플랜 · 없으면 우리 기록 짝(판 수만) · 꿀팁 · 운명의 무기
const AGE = { all: null, champ: 0, draft: null, pick: null, q: '', dirty: false, live: null, liveSel: 0, editing: false, autoFrom: null, baseAt: 0, sum: '', recent: null, hist: null };
const agWhen = t => { if (!t) return ''; const d = (Date.now() - t) / 60000; if (d < 1) return '방금'; if (d < 60) return Math.floor(d) + '분 전'; if (d < 1440) return Math.floor(d / 60) + '시간 전'; const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()}`; };
const ageIc = id => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png`;
function ageAug(id, cls) {
  const a = (AGE.all && AGE.all.augs[id]) || {};
  return `<i class="aug ${a.rarity || ''} ${cls || ''}" title="${escH(a.name || '증강 #' + id)}">${a.icon ? `<img src="${a.icon}" alt="" onerror="this.remove()">` : ''}<b>?</b></i>`;
}
const ageName = id => ((AGE.all && AGE.all.augs[id]) || {}).name || ('증강 #' + id);
async function renderAugEdit(force) {
  const body = $('ag-ed');
  if (!AGE.all || force) { body.innerHTML = '<div class="td-state">불러오는 중…</div>'; AGE.all = await window.api.getAugGuideAll().catch(() => null); AGE.recent = null; }
  if (!AGE.all) { body.innerHTML = '<div class="td-state">불러오지 못했습니다 — 인터넷 연결을 확인해 주세요</div>'; return; }
  if (AGE.live && AGE.live.active && !AGE.editing) return ageLive();
  if (AGE.champ) return ageChamp();
  ageList();
}
// ── 챔피언 목록(이름 검색 · 채운 챔피언은 금색 · 초안은 점선) ──
// 🧭 v0.1.135(사장님: 챔피언 고르기 전 화면이 비어 있음) — 우리가 많이 고른 증강(투데이 내전 기록 · v0.1.246부터 판 수만)
function ageOverview() {
  const A = AGE.all, O = A.ours || {};
  const ours = Object.entries(O).filter(([id, v]) => A.augs[id] && v.g >= 3).sort((a, b) => b[1].g - a[1].g).slice(0, 8);
  if (!ours.length) return '';
  return `<div class="ag-top"><div class="ag-top-hd"><b>우리가 많이 고른 증강</b></div><div class="ag-pa">${ours.map(([id, v]) => `<span class="ag-pchip">${ageAug(id, 'ag-ic')}<span class="ag-pt"><b>${escH(ageName(id))}</b><small>${v.g}판</small></span></span>`).join('')}</div><div class="ag-src">투데이 내전 기록(내전 + 같이 한 일반 판) · 3판 이상</div></div>`;
}
function ageList(pre) {
  const { champs, guide } = AGE.all, q = AGE.q.trim().toLowerCase();
  const has = id => guide[id] && guide[id].plans && guide[id].plans.length;
  const ids = Object.keys(champs).map(Number).filter(id => !q || champs[id].name.toLowerCase().includes(q) || champs[id].alias.toLowerCase().includes(q))
    .sort((a, b) => (has(b) ? 1 : 0) - (has(a) ? 1 : 0) || champs[a].name.localeCompare(champs[b].name, 'ko'));
  const done = Object.keys(guide || {}).filter(has).length;
  $('ag-ed').innerHTML = (pre || `<div class="age-intro">챔피언 선택 때 내 챔피언의 추천 증강이 여기에 뜹니다 · 채운 챔피언 <b class="num">${done}</b>개</div>`) + ageOverview() + `
    <div class="age-find">다른 챔피언 보기</div>
    <div id="age-recent">${recentH()}</div>
    <input id="age-q" class="age-q" placeholder="챔피언 이름으로 찾기" value="${escH(AGE.q)}">
    <div class="age-grid">${ids.map(id => `<button class="age-ch${has(id) ? ' has' : ''}${has(id) && guide[id].draft ? ' draft' : ''}" data-id="${id}" title="${escH(champs[id].name)}"><img src="${ageIc(id)}" alt="" onerror="this.style.visibility='hidden'"><span>${escH(champs[id].name)}</span></button>`).join('') || '<div class="td-state">찾는 챔피언이 없습니다</div>'}</div>`;
  const qi = $('age-q'); qi.oninput = () => { AGE.q = qi.value; ageList(pre); const n = $('age-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $('ag-ed').querySelectorAll('.age-ch').forEach(b => b.onclick = () => ageOpen(Number(b.dataset.id)));
  bindRecent();
  if (!AGE.recent) window.api.getAugGuideRecent().then(r => { AGE.recent = r || []; const box = $('age-recent'); if (box) { box.innerHTML = recentH(); bindRecent(); } }).catch(() => {});
}
// ✍️ 최근 고친 것(모든 챔피언 · 위키 「최근 바뀜」) — 누르면 그 챔피언 편집 화면
function recentH() {
  const r = AGE.recent; if (!r || !r.length) return '';
  const champs = AGE.all.champs;
  return `<div class="age-rc"><div class="age-rc-hd">최근 고친 것</div>${r.slice(0, 6).map(x => `<button class="age-rc-row" data-id="${x.champ}"><img src="${ageIc(x.champ)}" alt="" onerror="this.style.visibility='hidden'"><span class="age-rc-tx"><b>${escH((champs[x.champ] || {}).name || '')}</b><small>${escH(x.by || '')} · ${escH(x.sum || '')}</small></span><span class="age-rc-t">${agWhen(x.at)}</span></button>`).join('')}</div>`;
}
function bindRecent() { $('ag-ed').querySelectorAll('.age-rc-row').forEach(b => b.onclick = () => ageOpen(Number(b.dataset.id))); }
// ── 편집: 플랜(이름 · 노릴 증강 · 설명) ──
async function ageOpen(id) {
  AGE.champ = id; AGE.pick = null; AGE.dirty = false; AGE.sum = ''; AGE.hist = null;
  const g = (AGE.all.guide || {})[id] || {};
  AGE.baseAt = g.at || 0;   // 편집 시작 때 버전 — 저장할 때 그새 남이 고쳤는지 확인
  let plans = g.plans || [];
  if (!plans.length) { const f = await window.api.getAugGG(id).catch(() => null); if (f && f.guide && f.guide.plans && f.guide.plans.length) plans = f.guide.plans; }   // 🧭 사람이 안 고친 챔피언 = 화면에 보이는 우리 기록 짝부터 고침
  if (AGE.champ !== id) return;
  AGE.draft = plans.map(p => ({ title: p.title || '', augs: (p.augs || []).slice(), why: p.why || '', link: p.link, games: p.games, src: p.src, by: p.by, at: p.at }));
  if (!AGE.draft.length) AGE.draft.push({ title: '', augs: [], why: '' });
  ageChamp();
}
function ageChamp() {
  const A = AGE.all, id = AGE.champ, ch = A.champs[id] || { name: '' }, d = AGE.draft, g = A.guide[id] || {};
  $('ag-ed').innerHTML = `<div class="age-top"><button class="pf-back" id="age-back">‹ 목록</button><img src="${ageIc(id)}" alt="" onerror="this.style.visibility='hidden'"><b>${escH(ch.name)}</b>${g.by ? `<small>${escH(g.by) + ' · ' + agWhen(g.at)}</small>` : ''}<button class="age-histbtn" id="age-histbtn">기록</button></div>
    <div id="age-hist" style="display:none;"></div>
    <div class="age-hint">「이 챔피언이면 이 증강 노려보자」를 플랜으로 묶어 주세요. 예) 치명타 폭딜 · 버티는 탱커 · 스킬 난사</div>` +
    d.map((p, i) => `<div class="age-plan">
      <div class="age-ph"><span class="age-pn num">${i + 1}</span>${planSrc(p)}<input class="age-title" data-i="${i}" maxlength="${A.titleMax}" placeholder="플랜 이름(예: 치명타 폭딜)" value="${escH(p.title)}"><button class="age-del" data-i="${i}" title="이 플랜 빼기">✕</button></div>
      <div class="age-augs">${p.augs.map((a, j) => `<button class="age-w" data-i="${i}" data-j="${j}" title="빼기">${ageAug(a, 'ag-ic-s')}${escH(ageName(a))} ✕</button>`).join('')}${p.augs.length < A.planAugs ? `<button class="age-add-w" data-i="${i}">＋ 증강</button>` : ''}</div>
      <input class="age-why" data-i="${i}" maxlength="${A.whyMax}" placeholder="한 줄 설명(언제·왜 이 플랜인지)" value="${escH(p.why)}">
      ${planFoot(p)}
    </div>`).join('') +
    (d.length < A.planMax ? `<button class="age-add" id="age-addplan">＋ 플랜 추가</button>` : '') +
    `<div class="age-pick" id="age-pick" style="display:none;"></div>
     <div class="age-save"><input id="age-sum" class="age-sum" maxlength="40" placeholder="무엇을 바꿨나요? (선택)" title="적으면 「기록」에 같이 남습니다" value="${escH(AGE.sum)}"><button class="ui-btn-gold" id="age-save"${AGE.dirty ? '' : ' disabled'}>저장 · 모두에게 반영</button></div>`;
  $('age-sum').oninput = e => { AGE.sum = e.target.value; };
  $('age-histbtn').onclick = ageHist;
  $('age-back').onclick = async () => { if (AGE.dirty && !await tnConfirm('저장하지 않은 내용이 있습니다. 버릴까요?')) return; AGE.champ = 0; AGE.dirty = false; AGE.editing = false; renderAugEdit(); };
  const mark = () => { AGE.dirty = true; $('age-save').disabled = false; };
  const q = s => $('ag-ed').querySelectorAll(s);
  q('.age-title').forEach(x => x.oninput = () => { d[+x.dataset.i].title = x.value; mark(); });
  q('.age-why').forEach(x => x.oninput = () => { d[+x.dataset.i].why = x.value; mark(); });
  q('.age-plan .age-del').forEach(x => x.onclick = () => { d.splice(+x.dataset.i, 1); AGE.dirty = true; ageChamp(); });
  q('.age-w').forEach(x => x.onclick = () => { const p = d[+x.dataset.i]; p.augs.splice(+x.dataset.j, 1); unsrc(p); AGE.dirty = true; ageChamp(); });
  q('.age-add-w').forEach(x => x.onclick = () => agePick(+x.dataset.i));
  const ap = $('age-addplan'); if (ap) ap.onclick = () => { d.push({ title: '', augs: [], why: '' }); AGE.dirty = true; ageChamp(); };
  $('age-save').onclick = ageSave;
}
function unsrc(p) { delete p.link; delete p.games; delete p.src; }   // 증강을 바꾸면 더는 그 짝이 아님 → 판 수·원문 링크 뗌
function agePick(i) {   // 증강 고르기(우리 기록에 자주 나온 증강 먼저 · 이름 검색) — 누른 플랜 바로 아래에
  AGE.pick = i;
  const box = $('age-pick'); box.style.display = '';
  const plan = $('ag-ed').querySelectorAll('.age-plan')[i]; if (plan) plan.insertAdjacentElement('afterend', box);
  box.innerHTML = `<div class="age-pk-hd"><input id="age-pq" class="age-q" placeholder="증강 이름으로 찾기"><button class="age-del" id="age-pclose">✕</button></div><div class="age-pk-list" id="age-pl"></div>`;
  const list = () => {
    const qv = $('age-pq').value.trim().toLowerCase(), { augs, seen } = AGE.all;
    const ids = Object.keys(augs).map(Number).filter(id => !augs[id].trait && (id >= 1000)).filter(id => !qv || (augs[id].name || '').toLowerCase().includes(qv))
      .sort((a, b) => (seen[b] || 0) - (seen[a] || 0) || (augs[a].name || '').localeCompare(augs[b].name || '', 'ko')).slice(0, 80);
    $('age-pl').innerHTML = ids.map(id => `<button class="age-pk" data-id="${id}" title="${escH(augs[id].desc || '')}">${ageAug(id, 'ag-ic')}<span><b>${escH(augs[id].name)}</b>${seen[id] ? `<small>우리 기록 ${seen[id]}번</small>` : ''}</span></button>`).join('') || '<div class="td-state">찾는 증강이 없습니다</div>';
    $('age-pl').querySelectorAll('.age-pk').forEach(b => b.onclick = () => {
      const id = Number(b.dataset.id), p = AGE.draft[AGE.pick];
      if (p && !p.augs.includes(id) && p.augs.length < AGE.all.planAugs) { p.augs.push(id); unsrc(p); }
      AGE.dirty = true; ageChamp();
      if (p && p.augs.length < AGE.all.planAugs) agePick(AGE.pick);   // 이어서 더 고르기 편하게 다시 열어 둠
    });
  };
  $('age-pq').oninput = list; $('age-pclose').onclick = () => { box.style.display = 'none'; };
  list(); $('age-pq').focus(); box.scrollIntoView({ block: 'nearest' });
}
async function ageSave() {
  const b = $('age-save'); b.disabled = true; b.textContent = '저장 중…';
  const r = await window.api.saveAugGuide(AGE.champ, { plans: AGE.draft }, AGE.baseAt, AGE.sum).catch(e => ({ ok: false, err: String(e) }));
  if (r && r.ok) { toast('🧭 저장했습니다 — 모두의 챔피언 선택 화면에 반영됩니다 · 「기록」에 남습니다'); AGE.dirty = false; AGE.sum = ''; AGE.baseAt = r.at; await renderAugEdit(true); }
  else if (r && r.conflict) {   // 편집 충돌 — 덮어쓰지 않음(위키와 같음)
    b.disabled = false; b.textContent = '저장 · 모두에게 반영';
    if (await tnConfirm(`그사이 ${r.by || '다른 사람'}님이 이 챔피언을 먼저 고쳤습니다.\n\n[확인] 최신 내용 불러오기(내가 고친 건 사라집니다)\n[취소] 그대로 두기 — 「기록」에서 바뀐 걸 보고 다시 고쳐 주세요`)) { AGE.dirty = false; const id = AGE.champ; await renderAugEdit(true); ageOpen(id); }
  }
  else { toast('저장 실패 — ' + ((r && r.err) || '다시 시도해 주세요')); b.disabled = false; b.textContent = '저장 · 모두에게 반영'; }
}
// ✍️ 그 챔피언 고친 기록(최신 먼저) — 줄마다 「이 버전으로」 · 맨 아래 「처음 자료로」(첫 편집 전 내용)
async function ageHist() {
  const box = $('age-hist'); if (!box) return;
  if (box.style.display !== 'none') { box.style.display = 'none'; return; }
  box.style.display = ''; box.innerHTML = '<div class="td-state">불러오는 중…</div>';
  const h = AGE.hist = await window.api.getAugGuideHist(AGE.champ).catch(() => []);
  if (!h.length) { box.innerHTML = '<div class="age-hist"><div class="age-rc-hd">고친 기록</div><div class="td-state">아직 고친 사람이 없습니다</div></div>'; return; }
  const first = h[h.length - 1];
  box.innerHTML = `<div class="age-hist"><div class="age-rc-hd">고친 기록 <small>최근 ${h.length}개</small></div>${h.map((x, i) => `<div class="age-hrow"><span class="age-rc-tx"><b>${escH(x.by || '?')} <small>${agWhen(x.at)}</small></b><small>${escH(x.sum || '')} · 플랜 ${x.n}개</small></span>${i ? `<button class="age-hbtn" data-k="${x.k}" data-w="after">이 버전으로</button>` : '<span class="age-hnow">지금</span>'}</div>`).join('')}
    <div class="age-hrow"><span class="age-rc-tx"><b>처음 내용</b><small>${escH(first.by || '')}님이 처음 고치기 전 · 플랜 ${first.before.length}개</small></span><button class="age-hbtn" data-k="${first.k}" data-w="before">이 버전으로</button></div></div>`;
  box.querySelectorAll('.age-hbtn').forEach(b => b.onclick = async () => {
    if (AGE.dirty && !await tnConfirm('저장하지 않은 내용은 사라집니다. 되돌릴까요?')) return;
    if (!await tnConfirm('이 버전으로 되돌릴까요? 되돌린 것도 기록에 남아서 다시 바꿀 수 있습니다.')) return;
    b.disabled = true;
    const r = await window.api.restoreAugGuide(AGE.champ, b.dataset.k, b.dataset.w).catch(e => ({ ok: false, err: String(e) }));
    if (r && r.ok) { toast('↩ 되돌렸습니다 — 모두에게 반영됩니다'); AGE.dirty = false; const id = AGE.champ; await renderAugEdit(true); ageOpen(id); }
    else { toast('되돌리지 못했습니다 — ' + ((r && r.err) || '')); b.disabled = false; }
  });
}
// 플랜 아래 작은 줄 = 자료 날짜(패치 기록 없을 때) · 마지막으로 고친 사람
function planFoot(p) {
  const parts = [];
  if (p.by) parts.push(`✍️ ${escH(p.by)} ${agWhen(p.at)}`);
  return parts.length ? `<div class="ag-age">${parts.join(' · ')}</div>` : '';
}
// 플랜 옆 작은 표시 = 우리 기록 짝이면 판 수(v0.1.246: 승률·등급 없음)
function planSrc(p) { return p.src === 'ours' ? `<span class="ag-wr num" title="투데이 내전 기록 · 이 챔피언으로 두 증강을 같이 고른 판">우리 ${p.games}판 같이 고름</span>` : ''; }
function srcNote(plans) {
  if (plans.length && plans.every(p => p.src === 'ours')) return `<div class="ag-src">아직 사람이 쓴 플랜이 없어 <b>우리 기록</b>(이 챔피언으로 두 증강을 같이 고른 판 · 2판 이상)으로 보여 줍니다 · 「✎ 고치기」로 채워 주세요</div>`;
  return plans.some(p => p.link) ? `<div class="ag-src">「설명 ↗」= 원문(브라우저)</div>` : '';
}
// ── 챔피언 선택 동안 보는 화면(내 챔피언 + 벤치 챔피언) ──
function ageLive() {
  const v = AGE.live, list = v.list || [];
  if (!list.some(c => c.id === AGE.liveSel)) AGE.liveSel = (list.find(c => c.mine) || list[0] || {}).id || 0;
  const c = list.find(x => x.id === AGE.liveSel);
  const tabs = list.length > 1 ? `<div class="ag-tabs">${list.map(x => `<button class="ag-tab${x.id === AGE.liveSel ? ' on' : ''}${x.mine ? ' mine' : ''}" data-id="${x.id}" title="${escH(x.name)}${x.mine ? ' · 내 챔피언' : ' · 벤치'}"><img src="${ageIc(x.id)}" alt="" onerror="this.remove()">${(x.guide.plans || []).length ? "" : "<s></s>"}</button>`).join('')}</div>` : '';
  const hd = `<div class="ag-live-hd"><span class="lb-sec-en">AUGMENT GUIDE</span><span class="ag-sub">이 챔피언이면 노려볼 증강</span>${c ? `<button class="ag-editbtn" id="ag-editbtn">✎ 고치기</button>` : ''}</div>`;
  let body;
  if (!c) return ageList(hd + tabs + '<div class="ag-empty sm">챔피언을 고르면 여기에 그 챔피언 증강 추천이 떠요</div>');   // v0.1.135: 아래에 패치 순위·우리 기록·챔피언 찾기
  else {
    const plans = (c.guide && c.guide.plans) || [], rec = c.rec || {};
    const head = `<div class="ag-champ"><img src="${ageIc(c.id)}" alt="" onerror="this.remove()"><span class="ag-cn"><b>${escH(c.name || '')}</b><small>${c.mine ? '내 챔피언' : '벤치 · 바꾸면 이런 증강'}</small></span></div>`;
    body = head + (!plans.length ? '<div class="ag-empty">이 챔피언은 아직 준비 중입니다<small>위 「✎ 고치기」로 채우면 모두에게 바로 보입니다</small></div>'
      : plans.map((p, i) => `<div class="ag-plan"><div class="ag-ph"><span class="ag-pn num">${i + 1}</span><b>${escH(p.title || (p.src === 'ours' ? '우리가 같이 고른 짝' : '추천 플랜'))}</b>${planSrc(p)}${p.link ? `<button class="ag-link" data-u="${escH(p.link)}" title="원문에서 설명 보기(브라우저)">설명 ↗</button>` : ''}</div>` +
        `<div class="ag-pa">${p.augs.map(a => { const r = rec[a]; return `<span class="ag-pchip">${ageAug(a, 'ag-ic')}<span class="ag-pt"><b>${escH(ageName(a))}</b>${r && r.g ? `<small>우리 ${r.g}판</small>` : ''}</span></span>`; }).join('')}</div>` +
        (p.why ? `<div class="ag-why">${escH(p.why)}</div>` : '') + planFoot(p) + '</div>').join('')) + srcNote(plans);
  }
  $('ag-ed').innerHTML = hd + tabs + body;
  $('ag-ed').querySelectorAll('.ag-link').forEach(b => b.onclick = () => window.api.openAugLink(b.dataset.u));
  $('ag-ed').querySelectorAll('.ag-tab').forEach(b => b.onclick = () => { AGE.liveSel = Number(b.dataset.id); ageLive(); });
  const eb = $('ag-editbtn'); if (eb) eb.onclick = () => { AGE.editing = true; ageOpen(c.id); };
}
function applyLive(d) {
  const was = !!(AGE.live && AGE.live.active), now = !!(d && d.active);
  AGE.live = d || null;
  if (now && !was) {   // 챔피언 선택 시작 → 이 탭을 저절로 열기(편집 중이면 그대로 둠)
    AGE.liveSel = 0;
    if (!AGE.dirty) { AGE.editing = false; AGE.champ = 0; }
    if (_account && _curCat !== 'aug') { AGE.autoFrom = _curCat; switchCat('aug'); return; }
  }
  if (!now && was && AGE.autoFrom && !AGE.dirty) { const back = AGE.autoFrom; AGE.autoFrom = null; AGE.editing = false; switchCat(back); return; }   // 끝나면 원래 탭으로
  if (!now) AGE.autoFrom = null;
  if (_curCat === 'aug' && !(AGE.editing && AGE.dirty)) renderAugEdit();
}
window.api.getAugGuide().then(applyLive).catch(() => {});
window.api.onAugGuide(applyLive);
