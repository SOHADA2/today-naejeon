// ── 🧭 증강 가이드 — 오른쪽 창 「증강」 탭(v0.1.72 · v0.1.74 플랜 방식) ─────────────
// 챔피언마다 「플랜」 몇 개 = 이름(예: 치명타 폭딜) + 노릴 증강 묶음 + 한 줄 설명 → 저장 = today/augGuide/champs/{id}
// 챔피언 선택 동안엔 이 탭이 저절로 열려 「보는 화면」(내 챔피언·벤치별 플랜) — 왼쪽 창은 팀 화면 그대로 · 끝나면 원래 탭으로
// 누구나 고칠 수 있음(마지막 저장이 이김) · 「초안」(draft) = 자료를 보고 미리 채운 것, 누가 저장하면 초안 표시가 사라짐
const AGE = { all: null, champ: 0, draft: null, pick: null, q: '', dirty: false, live: null, liveSel: 0, editing: false, autoFrom: null };
const ageIc = id => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png`;
function ageAug(id, cls) {
  const a = (AGE.all && AGE.all.augs[id]) || {};
  return `<i class="aug ${a.rarity || ''} ${cls || ''}" title="${escH(a.name || '증강 #' + id)}">${a.icon ? `<img src="${a.icon}" alt="" onerror="this.remove()">` : ''}<b>?</b></i>`;
}
const ageName = id => ((AGE.all && AGE.all.augs[id]) || {}).name || ('증강 #' + id);
async function renderAugEdit(force) {
  const body = $('ag-ed');
  if (!AGE.all || force) { body.innerHTML = '<div class="td-state">불러오는 중…</div>'; AGE.all = await window.api.getAugGuideAll().catch(() => null); }
  if (!AGE.all) { body.innerHTML = '<div class="td-state">불러오지 못했어요 — 인터넷 연결을 확인해 주세요</div>'; return; }
  if (AGE.live && AGE.live.active && !AGE.editing) return ageLive();
  if (AGE.champ) return ageChamp();
  ageList();
}
// ── 챔피언 목록(이름 검색 · 채운 챔피언은 금색 · 초안은 점선) ──
function ageList() {
  const { champs, guide } = AGE.all, q = AGE.q.trim().toLowerCase();
  const has = id => guide[id] && guide[id].plans && guide[id].plans.length;
  const ids = Object.keys(champs).map(Number).filter(id => !q || champs[id].name.toLowerCase().includes(q) || champs[id].alias.toLowerCase().includes(q))
    .sort((a, b) => (has(b) ? 1 : 0) - (has(a) ? 1 : 0) || champs[a].name.localeCompare(champs[b].name, 'ko'));
  const done = Object.keys(guide || {}).filter(has).length;
  $('ag-ed').innerHTML = `<div class="age-intro">챔피언 선택 화면에서 내 챔피언과 벤치 챔피언의 「노려볼 증강」을 보여줘요.<br>채운 챔피언 <b class="num">${done}</b>개 · 저장하면 모두에게 바로 반영돼요.</div>
    <input id="age-q" class="age-q" placeholder="챔피언 이름으로 찾기" value="${escH(AGE.q)}">
    <div class="age-grid">${ids.map(id => `<button class="age-ch${has(id) ? ' has' : ''}${has(id) && guide[id].draft ? ' draft' : ''}" data-id="${id}" title="${escH(champs[id].name)}"><img src="${ageIc(id)}" alt="" onerror="this.style.visibility='hidden'"><span>${escH(champs[id].name)}</span></button>`).join('') || '<div class="td-state">찾는 챔피언이 없어요</div>'}</div>`;
  const qi = $('age-q'); qi.oninput = () => { AGE.q = qi.value; ageList(); const n = $('age-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $('ag-ed').querySelectorAll('.age-ch').forEach(b => b.onclick = () => ageOpen(Number(b.dataset.id)));
}
// ── 편집: 플랜(이름 · 노릴 증강 · 설명) ──
function ageOpen(id) {
  AGE.champ = id; AGE.pick = null; AGE.dirty = false;
  const g = (AGE.all.guide || {})[id] || {};
  AGE.draft = (g.plans || []).map(p => ({ title: p.title || '', augs: (p.augs || []).slice(), why: p.why || '', tier: p.tier, patch: p.patch, date: p.date, link: p.link }));
  if (!AGE.draft.length) AGE.draft.push({ title: '', augs: [], why: '' });
  ageChamp();
}
function ageChamp() {
  const A = AGE.all, id = AGE.champ, ch = A.champs[id] || { name: '' }, d = AGE.draft, g = A.guide[id] || {};
  $('ag-ed').innerHTML = `<div class="age-top"><button class="pf-back" id="age-back">‹ 목록</button><img src="${ageIc(id)}" alt="" onerror="this.style.visibility='hidden'"><b>${escH(ch.name)}</b>${g.by ? `<small>${g.draft ? '초안' : '마지막 저장 ' + escH(g.by)}</small>` : ''}</div>
    <div class="age-hint">「이 챔피언이면 이 증강 노려보자」를 플랜으로 묶어 주세요. 예) 치명타 폭딜 · 버티는 탱커 · 스킬 난사</div>` +
    d.map((p, i) => `<div class="age-plan">
      <div class="age-ph"><span class="age-pn num">${i + 1}</span>${planSrc(p)}<input class="age-title" data-i="${i}" maxlength="${A.titleMax}" placeholder="플랜 이름(예: 치명타 폭딜)" value="${escH(p.title)}"><button class="age-del" data-i="${i}" title="이 플랜 빼기">✕</button></div>
      <div class="age-augs">${p.augs.map((a, j) => `<button class="age-w" data-i="${i}" data-j="${j}" title="빼기">${ageAug(a, 'ag-ic-s')}${escH(ageName(a))} ✕</button>`).join('')}${p.augs.length < A.planAugs ? `<button class="age-add-w" data-i="${i}">＋ 증강</button>` : ''}</div>
      <input class="age-why" data-i="${i}" maxlength="${A.whyMax}" placeholder="한 줄 설명(언제·왜 이 플랜인지)" value="${escH(p.why)}">
    </div>`).join('') +
    (d.length < A.planMax ? `<button class="age-add" id="age-addplan">＋ 플랜 추가</button>` : '') +
    `<div class="age-pick" id="age-pick" style="display:none;"></div>
     <div class="age-save"><button class="ui-btn-gold" id="age-save"${AGE.dirty ? '' : ' disabled'}>저장 · 모두에게 반영</button></div>`;
  $('age-back').onclick = () => { if (AGE.dirty && !confirm('저장하지 않은 내용이 있어요. 버릴까요?')) return; AGE.champ = 0; AGE.dirty = false; AGE.editing = false; renderAugEdit(); };
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
function unsrc(p) { delete p.tier; delete p.patch; delete p.date; delete p.link; }   // 증강을 바꾸면 더는 자료의 그 콤보가 아님 → 등급·패치·원문 링크 뗌
function agePick(i) {   // 증강 고르기(우리 기록에 자주 나온 증강 먼저 · 이름 검색) — 누른 플랜 바로 아래에
  AGE.pick = i;
  const box = $('age-pick'); box.style.display = '';
  const plan = $('ag-ed').querySelectorAll('.age-plan')[i]; if (plan) plan.insertAdjacentElement('afterend', box);
  box.innerHTML = `<div class="age-pk-hd"><input id="age-pq" class="age-q" placeholder="증강 이름으로 찾기"><button class="age-del" id="age-pclose">✕</button></div><div class="age-pk-list" id="age-pl"></div>`;
  const list = () => {
    const qv = $('age-pq').value.trim().toLowerCase(), { augs, seen } = AGE.all;
    const ids = Object.keys(augs).map(Number).filter(id => !qv || (augs[id].name || '').toLowerCase().includes(qv))
      .sort((a, b) => (seen[b] || 0) - (seen[a] || 0) || (augs[a].name || '').localeCompare(augs[b].name || '', 'ko')).slice(0, 80);
    $('age-pl').innerHTML = ids.map(id => `<button class="age-pk" data-id="${id}" title="${escH(augs[id].desc || '')}">${ageAug(id, 'ag-ic')}<span><b>${escH(augs[id].name)}</b>${seen[id] ? `<small>우리 기록 ${seen[id]}번</small>` : ''}</span></button>`).join('') || '<div class="td-state">찾는 증강이 없어요</div>';
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
  const r = await window.api.saveAugGuide(AGE.champ, { plans: AGE.draft }).catch(e => ({ ok: false, err: String(e) }));
  if (r && r.ok) { toast('🧭 저장했어요 — 모두의 챔피언 선택 화면에 반영돼요'); AGE.dirty = false; await renderAugEdit(true); }
  else { toast('저장 실패 — ' + ((r && r.err) || '다시 시도해 주세요')); b.disabled = false; b.textContent = '저장 · 모두에게 반영'; }
}
// 자료에서 가져온 플랜 표시 = 사이트 등급 + 그 자료의 패치(최신 패치면 금색, 지난 패치면 흐리게)
function tierCls(t) { return 'tr-' + String(t || '').charAt(0).toLowerCase(); }
function planSrc(p) { return (p.tier ? `<span class="ag-tier ${tierCls(p.tier)}">${escH(p.tier)}</span>` : '') + (p.patch ? `<span class="ag-patch num" title="이 자료의 패치">${escH(p.patch)}</span>` : ''); }
function avoidH(av, rec) {
  if (!av || !av.length) return '';
  return `<div class="ag-avoid"><div class="ag-top-hd"><b>피하면 좋은 증강</b></div><div class="ag-pa">${av.map(a => { const r = rec[a]; return `<span class="ag-pchip">${ageAug(a, 'ag-ic')}<span class="ag-pt"><b>${escH(ageName(a))}</b>${r && r.g ? `<small>우리 ${r.g}판 ${r.w}승</small>` : ''}</span></span>`; }).join('')}</div><div class="ag-src">사이트에서 이 챔피언에게 「함정」으로 표시한 증강</div></div>`;
}
function planAge(p) { return !p.patch && p.date ? `<div class="ag-age">패치 기록 없음 · ${escH(p.date.slice(0, 7).replace('-', '년 ').replace(/^(\d+년 )0?/, '$1'))}월 자료</div>` : ''; }
function srcNote(plans) {
  return plans.some(p => p.link) ? `<div class="ag-src">콤보·등급 출처 arammayhem.com(사이트 편집 평가 · 승률 아님) · 「설명 ↗」= 원문</div>` : '';
}
// ── 챔피언 선택 동안 보는 화면(내 챔피언 + 벤치 챔피언) ──
function ageLive() {
  const v = AGE.live, list = v.list || [];
  if (!list.some(c => c.id === AGE.liveSel)) AGE.liveSel = (list.find(c => c.mine) || list[0] || {}).id || 0;
  const c = list.find(x => x.id === AGE.liveSel);
  const tabs = list.length > 1 ? `<div class="ag-tabs">${list.map(x => `<button class="ag-tab${x.id === AGE.liveSel ? ' on' : ''}${x.mine ? ' mine' : ''}" data-id="${x.id}" title="${escH(x.name)}${x.mine ? ' · 내 챔피언' : ' · 벤치'}"><img src="${ageIc(x.id)}" alt="" onerror="this.remove()">${(x.guide.plans || []).length || x.guide.top ? "" : "<s></s>"}</button>`).join('')}</div>` : '';
  const hd = `<div class="ag-live-hd"><span class="lb-sec-en">AUGMENT GUIDE</span><span class="ag-sub">이 챔피언이면 노려볼 증강</span>${c ? `<button class="ag-editbtn" id="ag-editbtn">✎ 고치기</button>` : ''}</div>`;
  let body;
  if (!c) body = '<div class="ag-empty">챔피언을 고르면 여기에 증강 추천이 떠요</div>';
  else {
    const plans = (c.guide && c.guide.plans) || [], rec = c.rec || {};
    const head = `<div class="ag-champ"><img src="${ageIc(c.id)}" alt="" onerror="this.remove()"><span class="ag-cn"><b>${escH(c.name || '')}</b><small>${c.mine ? '내 챔피언' : '벤치 · 바꾸면 이런 증강'}</small></span>${c.draft && plans.length ? '<span class="ag-draft" title="자료를 보고 미리 채운 초안이에요 — 써 보고 고쳐 주세요">초안</span>' : ''}</div>`;
    const top = c.guide && c.guide.top;
    const topH = top ? `<div class="ag-top"><div class="ag-top-hd"><b>이번 패치 상위 증강</b><span class="ag-patch num cur">${escH(top.patch)}</span></div><div class="ag-pa">${top.augs.map(x => { const r = rec[x.id]; return `<span class="ag-pchip"><span class="ag-tier ${tierCls(x.tier)}">${escH(x.tier)}</span>${ageAug(x.id, 'ag-ic')}<span class="ag-pt"><b>${escH(ageName(x.id))}</b>${r && r.g ? `<small>우리 ${r.g}판 ${r.w}승</small>` : ''}</span></span>`; }).join('')}</div><div class="ag-src">패치 ${escH(top.patch)} 기준 등급 · arammayhem.com</div></div>` : '';
    body = head + topH + (!plans.length && !top && !(c.guide && c.guide.avoid) ? '<div class="ag-empty">이 챔피언은 아직 준비 중이에요<small>위 「✎ 고치기」로 채우면 모두에게 바로 보여요</small></div>'
      : plans.map((p, i) => `<div class="ag-plan"><div class="ag-ph"><span class="ag-pn num">${i + 1}</span><b>${escH(p.title || (p.link ? '추천 콤보' : '추천 플랜'))}</b>${planSrc(p)}${p.link ? `<button class="ag-link" data-u="${escH(p.link)}" title="원문에서 설명 보기(브라우저)">설명 ↗</button>` : ''}</div>` +
        `<div class="ag-pa">${p.augs.map(a => { const r = rec[a]; return `<span class="ag-pchip">${ageAug(a, 'ag-ic')}<span class="ag-pt"><b>${escH(ageName(a))}</b>${r && r.g ? `<small>우리 ${r.g}판 ${r.w}승</small>` : ''}</span></span>`; }).join('')}</div>` +
        (p.why ? `<div class="ag-why">${escH(p.why)}</div>` : '') + planAge(p) + '</div>').join('')) + avoidH(c.guide && c.guide.avoid, rec) + srcNote(plans);
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
