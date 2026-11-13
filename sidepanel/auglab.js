// 🧪 증강 연구(2026-11-11 · 사장님: 롤 아수라장처럼 증강 3장을 뽑아 보기 · 실버·골드·프리즘)
//   v0.1.175: 뽑기는 가운데 창(auglab/)에서 · v0.1.197: 증강 탭 안 「뽑아 보기」 갈래(홈의 바로 가기는 가운데 창을 바로 엶)
//   이 갈래 = 시작 버튼 + 방금 한 판 결과(가운데 창이 auglab-result로 보냄 · 앱을 끄면 사라짐)
//   ⚠️ 이 창의 다른 스크립트와 최상위 이름이 겹치지 않게 al 접두사
let _alLast = null;
function renderAugLab() {
  const body = $('al-body'), r = _alLast;
  let h = `<div class="al-idle"><span class="sp-en">AUGMENT DRAW</span><b>증강 뽑아 보기</b>`
    + `<p>화면 가운데에 카드 3장이 뜹니다. 네 번 고르고 등급·승률을 확인합니다.</p>`
    + `<button class="ui-btn-gold al-go" id="al-open">${r ? '다시 하기' : '시작'}</button></div>`;
  if (r && Array.isArray(r.picks)) {
    h += `<div class="al-done"><span class="sp-en">LAST RESULT</span><b>최고 선택 <span class="num">${+r.best || 0}</span> / ${+r.rounds || r.picks.length}</b>`
      + `<div class="al-list">${r.picks.map((a, i) => `<div class="al-li"><span class="num">${i + 1}</span><i class="aug ${escH(a.rarity)}"><img src="${escH(a.icon)}" alt="" onerror="this.remove()"></i><b>${escH(a.name)}</b>${a.t ? `<em class="al-t t${+a.t}">T${+a.t}</em>` : ''}</div>`).join('')}</div></div>`;
  }
  body.innerHTML = h;
  $('al-open').onclick = () => window.api.auglabOpen();
}
if (window.api && window.api.onAuglabResult) window.api.onAuglabResult(r => { _alLast = r; if (typeof _curCat !== 'undefined' && _curCat === 'lab') renderAugLab(); });
