// 📌 v0.1.276 접기 버튼 — 왼쪽(대기실 · overlay)·오른쪽(sidepanel) 창 공용
//   사장님: 왼쪽 창을 ✕로 끄면 다시 여는 게 불편(Shift+F7·트레이만) → 「접기 손잡이」 선택
//   롤 클라에 붙어 있을 때(main canFold) = 머리의 —·✕ 대신 「접기」 하나 · 클라가 없을 때(홈·합친 창·도킹 끔) = 예전 —·✕ 그대로
//   ✨ v0.1.277 접힌 모습 = 이 창은 숨고 클라 가장자리에 빛이 새어 나오는 손잡이 창(desktop/foldtab.html)이 따로 뜸
//   body[data-side] = 'L'(왼쪽 창) | 'R'(오른쪽 창) · main → 'fold' {can, fold} · 누르면 window.api.winFold(side, true)
(function () {
  const side = document.body.dataset.side === 'R' ? 'R' : 'L';
  const head = document.getElementById(side === 'L' ? 'bar' : 'sbar');
  if (!head || !window.api || !window.api.winFold) return;
  // 접는 방향 = 롤 클라 쪽(왼쪽 창은 오른쪽으로 · 오른쪽 창은 왼쪽으로)
  const btn = document.createElement('button');
  btn.className = 'tn-wb tn-fold-btn ' + (side === 'L' ? 'win-btn' : 's-winbtn');
  btn.title = side === 'L' ? '접기 · 롤 클라이언트 옆에 빛 손잡이로 남습니다 (Shift+F7)' : '접기 · 롤 클라이언트 옆에 빛 손잡이로 남습니다';
  btn.innerHTML = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="${side === 'L' ? 'M4.5 2l4 4-4 4' : 'M7.5 2 3.5 6l4 4'}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  btn.addEventListener('click', () => window.api.winFold(side, true));
  const before = document.getElementById(side === 'L' ? 'ov-min' : 's-min');
  head.insertBefore(btn, before || null);
  if (window.api.onFold) window.api.onFold(d => { document.body.classList.toggle('can-fold', !!(d && d.can)); });
  // ✨ v0.1.279 접기·펼치기 움직임 = 창은 제자리 · 화면(#panel)만 클라 쪽 가장자리 밖으로 미끄러짐(잘림) → 클라 뒤로 들어가고 나오는 것처럼
  //   main → 'fold-anim' {act: 'out'(접힘) | 'pre'(펼치기 직전 = 바깥에 둠) | 'in'(펼침) | 'reset', ms}
  if (window.api.onFoldAnim) window.api.onFoldAnim(d => {
    const p = document.getElementById('panel'); if (!p || !d) return;
    const off = `translateX(${side === 'L' ? '100%' : '-100%'})`;
    for (const a of p.getAnimations()) if (a.id === 'tn-fold') a.cancel();
    if (d.act === 'pre') { p.style.transform = off; return; }
    if (d.act === 'reset') { p.style.transform = ''; return; }
    p.style.transform = '';
    const a = d.act === 'out'
      ? p.animate([{ transform: 'none' }, { transform: off }], { duration: d.ms || 260, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' })
      : p.animate([{ transform: off }, { transform: 'none' }], { duration: d.ms || 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
    a.id = 'tn-fold';
  });
})();
