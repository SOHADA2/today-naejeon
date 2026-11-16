// 🧪 증강 연구(2026-11-11 · 사장님: 롤 아수라장처럼 증강 3장을 뽑아 보기 · 실버·골드·프리즘)
//   v0.1.175: 뽑기는 가운데 창(auglab/)에서 · v0.1.197: 증강 탭 안 「뽑아 보기」 갈래(홈의 바로 가기는 가운데 창을 바로 엶)
//   이 갈래 = 시작 버튼 + 방금 고른 증강(가운데 창이 auglab-result로 보냄 · 앱을 끄면 사라짐) · v0.1.209: 실제 규칙대로 · 채점(최고 선택·T 등급) 뺌
//   ⚠️ 이 창의 다른 스크립트와 최상위 이름이 겹치지 않게 al 접두사
let _alLast = null;
function renderAugLab() {
  const body = $('al-body'), r = _alLast;
  let h = `<div class="al-idle"><span class="sp-en">AUGMENT DRAW</span><b>증강 뽑아 보기</b>`
    + `<p>화면 가운데에 실제 아수라장처럼 증강 카드 3장이 뜹니다. 3·7·11·15레벨에 한 번씩 고르고, 카드마다 한 번 다시 뽑을 수 있습니다.</p>`
    + `<button class="ui-btn-gold al-go" id="al-open">${r ? '다시 하기' : '시작'}</button></div>`;
  if (r && Array.isArray(r.picks)) {
    h += `<div class="al-done"><span class="sp-en">LAST DRAW</span><b>방금 고른 증강</b>${r.head ? `<p>헤드라이너 ${escH(r.head)}</p>` : ''}`
      + `<div class="al-list">${r.picks.map(a => `<div class="al-li"><i class="aug ${escH(a.rarity)}"><img src="${escH(a.icon)}" alt="" onerror="this.remove()"></i><b>${escH(a.name)}</b><em class="al-at">${escH(a.bonus ? '전환' : a.at || '')}</em></div>`).join('')}</div></div>`;
  }
  body.innerHTML = h;
  $('al-open').onclick = () => window.api.auglabOpen();
}
if (window.api && window.api.onAuglabResult) window.api.onAuglabResult(r => { _alLast = r; if (typeof _curCat !== 'undefined' && _curCat === 'lab') renderAugLab(); });
