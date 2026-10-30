// ── 🧭 증강 가이드 편집(v0.1.72) — 오른쪽 창 「증강」 탭 ─────────────────────────
// 챔피언 고르기 → 카테고리(성능·꿀잼·조합·함정)마다 증강 + 한 줄 설명 → 저장 = today/augGuide/champs/{id}
// 저장하면 모두의 챔피언 선택 화면에 바로 반영 · 누구나 고칠 수 있음(마지막 저장이 이김)
// v0.1.73: 챔피언 선택 동안엔 이 탭이 저절로 열려 「보는 화면」(내 챔피언·벤치별 추천) — 왼쪽 창은 팀 화면 그대로
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
function ageList() {   // 챔피언 목록(이름 검색 · 채운 챔피언은 금색 점)
  const { champs, guide } = AGE.all, q = AGE.q.trim().toLowerCase();
  const ids = Object.keys(champs).map(Number).filter(id => !q || champs[id].name.toLowerCase().includes(q) || champs[id].alias.toLowerCase().includes(q))
    .sort((a, b) => (guide[b] ? 1 : 0) - (guide[a] ? 1 : 0) || champs[a].name.localeCompare(champs[b].name, 'ko'));
  const done = Object.keys(guide || {}).length;
  $('ag-ed').innerHTML = `<div class="age-intro">챔피언 선택 화면에서 내 챔피언과 벤치 챔피언의 추천 증강을 보여줘요.<br>채운 챔피언 <b class="num">${done}</b>개 · 저장하면 모두에게 바로 반영돼요.</div>
    <input id="age-q" class="age-q" placeholder="챔피언 이름으로 찾기" value="${escH(AGE.q)}">
    <div class="age-grid">${ids.map(id => `<button class="age-ch${guide[id] ? ' has' : ''}" data-id="${id}" title="${escH(champs[id].name)}"><img src="${ageIc(id)}" alt="" onerror="this.style.visibility='hidden'"><span>${escH(champs[id].name)}</span></button>`).join('') || '<div class="td-state">찾는 챔피언이 없어요</div>'}</div>`;
  const qi = $('age-q'); qi.oninput = () => { AGE.q = qi.value; ageList(); const n = $('age-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $('ag-ed').querySelectorAll('.age-ch').forEach(b => b.onclick = () => ageOpen(Number(b.dataset.id)));
}
function ageOpen(id) {
  AGE.champ = id; AGE.pick = null; AGE.dirty = false;
  const g = (AGE.all.guide || {})[id] || {};
  AGE.draft = {}; for (const c of AGE.all.cats) AGE.draft[c.k] = (g[c.k] || []).map(e => ({ id: e.id, why: e.why || '', with: (e.with || []).slice() }));
  ageChamp();
}
function ageChamp() {
  const id = AGE.champ, ch = AGE.all.champs[id] || { name: '' }, d = AGE.draft;
  const by = (AGE.all.guide[id] || {}).by;
  $('ag-ed').innerHTML = `<div class="age-top"><button class="pf-back" id="age-back">‹ 목록</button><img src="${ageIc(id)}" alt=""><b>${escH(ch.name)}</b>${by ? `<small>마지막 저장 ${escH(by)}</small>` : ''}</div>` +
    AGE.all.cats.map(c => `<div class="age-sec ag-${c.k}"><div class="age-sh"><span class="ag-tag">${escH(c.label)}</span><small>${escH(c.tip)}</small></div>` +
      d[c.k].map((e, i) => `<div class="age-row">${ageAug(e.id, 'ag-ic')}<div class="age-rc"><b>${escH(ageName(e.id))}</b>` +
        (c.k === 'combo' ? `<div class="age-with"><span class="age-wl">짝꿍</span>${(e.with || []).map((w, j) => `<button class="age-w" data-c="${c.k}" data-i="${i}" data-j="${j}" title="빼기">${ageAug(w, 'ag-ic-s')}${escH(ageName(w))} ✕</button>`).join('')}${(e.with || []).length < 3 ? `<button class="age-add-w" data-c="${c.k}" data-i="${i}">＋ 짝꿍 증강</button>` : ''}</div>` : '') +
        `</div><button class="age-del" data-c="${c.k}" data-i="${i}" title="빼기">✕</button>` +
        `<input class="age-why" data-c="${c.k}" data-i="${i}" maxlength="${AGE.all.whyMax}" placeholder="한 줄 설명(왜 좋은지·언제 고르는지)" value="${escH(e.why)}"></div>`).join('') +
      (d[c.k].length < AGE.all.max ? `<button class="age-add" data-c="${c.k}">＋ 증강 추가</button>` : '') + '</div>').join('') +
    `<div class="age-pick" id="age-pick" style="display:none;"></div>
     <div class="age-save"><button class="ui-btn-gold" id="age-save"${AGE.dirty ? '' : ' disabled'}>저장 · 모두에게 반영</button></div>`;
  $('age-back').onclick = () => { if (AGE.dirty && !confirm('저장하지 않은 내용이 있어요. 버릴까요?')) return; AGE.champ = 0; AGE.dirty = false; AGE.editing = false; renderAugEdit(); };
  const mark = () => { AGE.dirty = true; $('age-save').disabled = false; };
  $('ag-ed').querySelectorAll('.age-why').forEach(x => x.oninput = () => { d[x.dataset.c][+x.dataset.i].why = x.value; mark(); });
  $('ag-ed').querySelectorAll('.age-del').forEach(x => x.onclick = () => { d[x.dataset.c].splice(+x.dataset.i, 1); AGE.dirty = true; ageChamp(); });
  $('ag-ed').querySelectorAll('.age-w').forEach(x => x.onclick = () => { d[x.dataset.c][+x.dataset.i].with.splice(+x.dataset.j, 1); AGE.dirty = true; ageChamp(); });
  $('ag-ed').querySelectorAll('.age-add').forEach(x => x.onclick = () => agePick({ c: x.dataset.c }));
  $('ag-ed').querySelectorAll('.age-add-w').forEach(x => x.onclick = () => agePick({ c: x.dataset.c, i: +x.dataset.i }));
  $('age-save').onclick = ageSave;
}
function agePick(target) {   // 증강 고르기(우리 기록에 자주 나온 증강 먼저 · 이름 검색)
  AGE.pick = target;
  const box = $('age-pick'); box.style.display = '';
  const sec = document.querySelector('#ag-ed .age-sec.ag-' + target.c); if (sec) sec.insertAdjacentElement('afterend', box);   // 누른 카테고리 바로 아래에
  box.innerHTML = `<div class="age-pk-hd"><input id="age-pq" class="age-q" placeholder="증강 이름으로 찾기"><button class="age-del" id="age-pclose">✕</button></div><div class="age-pk-list" id="age-pl"></div>`;
  const list = () => {
    const q = $('age-pq').value.trim().toLowerCase(), { augs, seen } = AGE.all;
    const ids = Object.keys(augs).map(Number).filter(id => !q || (augs[id].name || '').toLowerCase().includes(q))
      .sort((a, b) => (seen[b] || 0) - (seen[a] || 0) || (augs[a].name || '').localeCompare(augs[b].name || '', 'ko')).slice(0, 80);
    $('age-pl').innerHTML = ids.map(id => `<button class="age-pk" data-id="${id}" title="${escH(augs[id].desc || '')}">${ageAug(id, 'ag-ic')}<span><b>${escH(augs[id].name)}</b>${seen[id] ? `<small>우리 기록 ${seen[id]}번</small>` : ''}</span></button>`).join('') || '<div class="td-state">찾는 증강이 없어요</div>';
    $('age-pl').querySelectorAll('.age-pk').forEach(b => b.onclick = () => {
      const id = Number(b.dataset.id), t = AGE.pick, arr = AGE.draft[t.c];
      if (t.i == null) { if (!arr.some(e => e.id === id)) arr.push({ id, why: '', with: [] }); }
      else { const e = arr[t.i]; if (id !== e.id && !e.with.includes(id)) e.with.push(id); }
      AGE.dirty = true; ageChamp();
    });
  };
  $('age-pq').oninput = list; $('age-pclose').onclick = () => { box.style.display = 'none'; };
  list(); $('age-pq').focus(); box.scrollIntoView({ block: 'nearest' });
}
async function ageSave() {
  const b = $('age-save'); b.disabled = true; b.textContent = '저장 중…';
  const r = await window.api.saveAugGuide(AGE.champ, AGE.draft).catch(e => ({ ok: false, err: String(e) }));
  if (r && r.ok) { toast('🧭 저장했어요 — 모두의 챔피언 선택 화면에 반영돼요'); AGE.dirty = false; await renderAugEdit(true); }
  else { toast('저장 실패 — ' + ((r && r.err) || '다시 시도해 주세요')); b.disabled = false; b.textContent = '저장 · 모두에게 반영'; }
}

// ── 챔피언 선택 동안 보는 화면(내 챔피언 + 벤치 챔피언) ──
function ageLive() {
  const v = AGE.live, list = v.list || [];
  if (!list.some(c => c.id === AGE.liveSel)) AGE.liveSel = (list.find(c => c.mine) || list[0] || {}).id || 0;
  const c = list.find(x => x.id === AGE.liveSel);
  const tabs = list.length > 1 ? `<div class="ag-tabs">${list.map(x => `<button class="ag-tab${x.id === AGE.liveSel ? ' on' : ''}${x.mine ? ' mine' : ''}" data-id="${x.id}" title="${escH(x.name)}${x.mine ? ' · 내 챔피언' : ' · 벤치'}"><img src="${ageIc(x.id)}" alt="" onerror="this.remove()">${Object.keys(x.guide || {}).length ? '' : '<s></s>'}</button>`).join('')}</div>` : '';
  const hd = `<div class="ag-live-hd"><span class="lb-sec-en">AUGMENT GUIDE</span><span class="ag-sub">게임 전에 미리 보는 추천</span>${c ? `<button class="ag-editbtn" id="ag-editbtn">✎ 채우기</button>` : ''}</div>`;
  let body;
  if (!c) body = '<div class="ag-empty">챔피언을 고르면 여기에 증강 추천이 떠요</div>';
  else {
    const g = c.guide || {}, rec = c.rec || {};
    const recTx = id => { const r = rec[id]; return r && r.g ? `<span class="ag-rec">우리 기록 <b class="num">${r.g}</b>판 <b class="num">${r.w}</b>승</span>` : ''; };
    const cats = (v.cats || []).filter(k => (g[k.k] || []).length);
    const head = `<div class="ag-champ"><img src="${ageIc(c.id)}" alt="" onerror="this.remove()"><span class="ag-cn"><b>${escH(c.name || '')}</b><small>${c.mine ? '내 챔피언' : '벤치 · 바꾸면 이런 증강'}</small></span></div>`;
    body = head + (!cats.length ? '<div class="ag-empty">이 챔피언은 아직 준비 중이에요<small>위 「✎ 채우기」로 채우면 모두에게 바로 보여요</small></div>'
      : cats.map(k => `<div class="ag-sec ag-${k.k}"><div class="ag-sh"><span class="ag-tag">${escH(k.label)}</span><span class="lb-sec-en">${escH(k.en)}</span></div>` +
        g[k.k].map(e => `<div class="ag-row">${ageAug(e.id, 'ag-ic')}<span class="ag-tx"><b class="ag-nm">${k.k === 'trap' ? '✕ ' : ''}${escH(ageName(e.id))}</b>` +
          (e.with && e.with.length ? `<span class="ag-with">＋ ${e.with.map(w => `${ageAug(w, 'ag-ic-s')}<span>${escH(ageName(w))}</span>`).join('<i class="ag-or">·</i>')}</span>` : '') +
          (e.why ? `<span class="ag-why">${escH(e.why)}</span>` : '') + recTx(e.id) + '</span></div>').join('') + '</div>').join(''));
  }
  $('ag-ed').innerHTML = hd + tabs + body;
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
