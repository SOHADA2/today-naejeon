// 📰 패치 노트(v0.1.144 · 사장님: aramgg 「새 증강」 페이지에 최신 패치가 잘 정리돼 있음 → 우리식으로 증강 아래 「패치」 탭)
//   자료 = tools/aramgg-fetch.cjs가 하루 한 번 받은 docs/data/aramgg/patches.json(main 'aug-patches') · 아이콘·등급 = 우리 증강 자료(getAugments) · 「우리 n판 m승」 = 투데이 내전 기록
//   맨 위 패치만 펼침 · 출처 aramgg.com + 그 패치 전체 노트 링크 · ⚠️ 이 창의 다른 스크립트와 최상위 이름이 겹치지 않게 pn 접두사
async function renderPatch() {
  const body = $('pn-body');
  body.innerHTML = '<div class="td-state">불러오는 중…</div>';
  const [P, AUG] = await Promise.all([window.api.getAugPatches().catch(() => null), augMapP()]);
  if (!P || !(P.patches || []).length) { body.innerHTML = '<div class="td-state">패치 노트를 불러오지 못했어요 — 인터넷 연결을 확인해 주세요</div>'; return; }
  const pnIc = (id, rar) => { const a = AUG[id] || {}; return `<i class="aug ${a.rarity || rar || ''}">${a.icon ? `<img src="${a.icon}" alt="" onerror="this.remove()">` : ''}</i>`; };
  const pnOur = id => { const o = P.ours && P.ours[id]; return o && o.g ? `<span class="pn-our">우리 ${o.g}판 ${o.w}승</span>` : ''; };
  const pnDay = d => { const m = /^\d{4}-(\d\d)-(\d\d)/.exec(d || ''); return m ? `${+m[1]}/${+m[2]}` : ''; };
  body.innerHTML = P.patches.map((p, i) => `<details class="pn-p"${i === 0 ? ' open' : ''}>`
    + `<summary><b class="pn-v">패치 <span class="num">${escH(p.patch)}</span></b><span class="pn-d num">${pnDay(p.date)}</span><span class="pn-chips">${p.added.length ? `<em class="new">신규 ${p.added.length}</em>` : ''}${p.changes.length ? `<em>조정 ${p.changes.length}</em>` : ''}${(p.notes || []).length ? `<em class="etc">기타 ${p.notes.length}</em>` : ''}</span><span class="pn-car">⌄</span></summary>`
    + (p.added.length ? `<div class="pn-sec">신규 증강</div><div class="pn-new">${p.added.map(a => `<div class="pn-na">${pnIc(a.id, a.rarity)}<div class="pn-nt"><b>${escH(a.name)}</b>${a.desc ? `<small>${escH(a.desc)}</small>` : ''}${pnOur(a.id)}</div></div>`).join('')}</div>` : '')
    + (p.changes.length ? `<div class="pn-sec">조정</div>${p.changes.map(c => `<div class="pn-ch"><div class="pn-ch-hd">${pnIc(c.id)}<b>${escH(c.name)}</b>${pnOur(c.id)}</div>${c.lines.map(l => `<div class="pn-l">${l.k ? `<span class="k">${escH(l.k)}</span>` : ''}${!l.from ? `<b>${escH(l.to)}</b>` : (l.from.length + l.to.length <= 28 ? `<span class="pn-v2"><s>${escH(l.from)}</s><i>→</i><b>${escH(l.to)}</b></span>` : `<span class="pn-bf"><s>${escH(l.from)}</s></span><span class="pn-af"><i>→</i><b>${escH(l.to)}</b></span>`)}</div>`).join('')}</div>`).join('')}` : '')
    + (p.notes || []).map(n => `<div class="pn-sec">${escH(n.title)}</div><ul class="pn-ul">${n.items.map(x => `<li>${escH(x)}</li>`).join('')}</ul>`).join('')
    + `<div class="ag-src pn-src">출처 aramgg.com${p.link ? ` · <button class="pn-link" data-u="${escH(p.link)}">패치 ${escH(p.patch)} 전체 노트 ↗</button>` : ''}</div></details>`).join('');
  body.querySelectorAll('.pn-link').forEach(b => b.onclick = () => window.api.openAugLink(b.dataset.u));
}
