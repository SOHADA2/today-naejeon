// 📌 v0.1.276 접기 손잡이 — 왼쪽(대기실 · overlay)·오른쪽(sidepanel) 창 공용
//   사장님: 왼쪽 창을 ✕로 끄면 다시 여는 게 불편(Shift+F7·트레이만) → 「접기 손잡이」 선택
//   롤 클라에 붙어 있을 때(main canFold) = 머리의 —·✕ 대신 「접기」 하나 → 창이 클라 옆 얇은 손잡이로 접힘 · 손잡이를 누르면 다시 펼침
//   클라가 없을 때(홈·합친 창·도킹 끔) = 예전 —·✕ 그대로 · 종료는 ⚙ 설정 「완전히 종료」·트레이
//   body[data-side] = 'L'(왼쪽 창) | 'R'(오른쪽 창) · main → 'fold' {can, fold} · 누르면 window.api.winFold(side, 접기?)
(function () {
  const side = document.body.dataset.side === 'R' ? 'R' : 'L';
  const head = document.getElementById(side === 'L' ? 'bar' : 'sbar');
  if (!head || !window.api || !window.api.winFold) return;
  // 접는 방향 = 롤 클라 쪽(왼쪽 창은 오른쪽으로 · 오른쪽 창은 왼쪽으로) · 손잡이 화살표 = 펼쳐지는 쪽
  const chev = dir => `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="${dir === 'r' ? 'M4.5 2l4 4-4 4' : 'M7.5 2 3.5 6l4 4'}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const btn = document.createElement('button');
  btn.className = 'tn-wb tn-fold-btn ' + (side === 'L' ? 'win-btn' : 's-winbtn');
  btn.title = side === 'L' ? '접기 · 롤 클라이언트 옆에 손잡이로 남습니다 (Shift+F7)' : '접기 · 롤 클라이언트 옆에 손잡이로 남습니다';
  btn.innerHTML = chev(side === 'L' ? 'r' : 'l');
  btn.addEventListener('click', () => window.api.winFold(side, true));
  const before = document.getElementById(side === 'L' ? 'ov-min' : 's-min');
  head.insertBefore(btn, before || null);
  const tab = document.createElement('div');
  tab.className = 'tn-fold-tab ' + (side === 'L' ? 'tn-fold-l' : 'tn-fold-r');
  tab.title = side === 'L' ? '펼치기 · 대기실 (Shift+F7)' : '펼치기 · 홈·기록';
  tab.innerHTML = `<img src="../assets/mark.png" alt="" draggable="false"><span class="tn-fold-ch">${chev(side === 'L' ? 'l' : 'r')}</span><span class="tn-fold-tx">${side === 'L' ? '대기실' : '홈 · 기록'}</span>`;
  tab.addEventListener('click', () => window.api.winFold(side, false));
  document.body.appendChild(tab);
  if (window.api.onFold) window.api.onFold(d => {
    document.body.classList.toggle('can-fold', !!(d && d.can));
    document.body.classList.toggle('folded', !!(d && d.fold));
  });
})();
