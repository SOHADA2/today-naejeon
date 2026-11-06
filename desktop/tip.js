// 💬 말풍선(2026-11-06 · 사장님: 윈도우 기본 말풍선(흰 바탕·검은 글자)이 앱 톤과 안 맞음) — 모든 창 공용
//   title 속성을 마우스 올리는 순간 data-tt로 옮겨 기본 말풍선을 막고, 앱 디자인 말풍선(.tn-tt · shared.css)을 띄움
//   요소 아래(자리 없으면 위) · 창 밖으로 안 나가게 · 0.38초 뒤 · 누르거나 스크롤하면 숨김 · 나중에 코드가 title을 다시 바꿔도 다음에 올릴 때 읽음
(() => {
  if (window.__tnTip) return; window.__tnTip = true;
  let box = null, cur = null, timer = 0;
  const hide = () => { clearTimeout(timer); cur = null; if (box) box.classList.remove('on'); };
  const place = el => {
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const x = Math.max(6, Math.min(W - b.width - 6, r.left + r.width / 2 - b.width / 2));
    let y = r.bottom + 7; if (y + b.height > H - 6) y = r.top - b.height - 7; if (y < 6) y = 6;
    box.style.left = `${Math.round(x)}px`; box.style.top = `${Math.round(y)}px`;
  };
  document.addEventListener('mouseover', e => {
    const el = e.target && e.target.closest ? e.target.closest('[title],[data-tt]') : null;
    if (!el) return;
    if (el.hasAttribute('title')) { const t = el.getAttribute('title'); el.removeAttribute('title'); if (t) el.dataset.tt = t; else delete el.dataset.tt; }
    if (el === cur) return;
    hide();
    const t = el.dataset.tt; if (!t) return;
    cur = el;
    timer = setTimeout(() => {
      if (cur !== el || !el.isConnected) return;
      if (!box) { box = document.createElement('div'); box.className = 'tn-tt'; box.setAttribute('role', 'tooltip'); document.body.appendChild(box); }
      box.textContent = t; box.style.left = '0px'; box.style.top = '0px';
      place(el); box.classList.add('on');
    }, 380);
  }, true);
  document.addEventListener('mouseout', e => { if (cur && !(e.relatedTarget && cur.contains(e.relatedTarget))) hide(); }, true);
  for (const ev of ['mousedown', 'wheel', 'keydown']) document.addEventListener(ev, hide, true);
  window.addEventListener('blur', hide);
})();
