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
// 🧲 v0.1.163 두 창이 맞닿을 때 이음매 금빛(사장님: 합쳐질 때 살짝 효과) — 왼쪽 창은 오른쪽 끝 · 오른쪽 창은 왼쪽 끝에 반쪽씩 → 합쳐 보면 한 줄 · 한 번만(0.55초)
window.tnSeamFx = (panel, side) => {
  if (panel) { panel.getAnimations().forEach(a => { if (a.id === 'door') a.cancel(); }); panel.style.transform = ''; }
  const g = document.createElement('i'); g.className = 'tn-seam-fx ' + (side === 'left' ? 'r' : 'l'); document.body.appendChild(g);
  g.animate([{ opacity: 0, transform: 'scaleY(.15)' }, { opacity: 1, transform: 'scaleY(1)', offset: 0.35 }, { opacity: 0, transform: 'scaleY(1)' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => g.remove();
  if (panel) panel.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.16)', offset: 0.3 }, { filter: 'brightness(1)' }], { duration: 420 });
};
// 🤐 v0.1.167 지퍼(사장님: 금빛 이음매만 반짝 = 두 상자가 붙은 느낌 → 하나의 상자로) — 좌우 창이 반쪽씩 같은 박자로 그림:
//   가운데 이음매 빛(곧 사라짐) → 위·아래 테두리를 따라 바깥 모서리로 달림(0~0.26초) → 바깥 세로변을 위·아래에서 가운데로(0.2~0.4초) = 둘이 합쳐 상자 하나를 감싸는 금빛 테두리 · 숨길 때까지 켜 둠(홈 창이 같은 테두리로 이어받음)
// 🚪 v0.1.176 문짝 틈 바탕 — 왼쪽 창은 투명 창이라 문짝이 기울면 틈으로 뒤 화면이 비치고, 오른쪽 창은 불투명(#010A13)이라 어두운 바탕이 보였음 → 문짝이 도는 동안만 같은 어두운 바탕
window.tnDoorBg = (an) => {
  const b = document.body, was = b.style.background;
  b.style.background = '#010A13';
  const off = () => { b.style.background = was; };
  an.onfinish = off; an.oncancel = off;
};
// 🔓 v0.1.176 분리 짝 효과(합체 지퍼의 반대 · v0.1.168처럼 갈라지기 전에 기다리지 않음) — 갈라지는 동안 안쪽 가장자리 금빛 선이 옅어지고, 위·아래 금빛 선이 바깥 모서리 쪽으로 걷힘
window.tnUnseamFx = (side) => {
  document.querySelectorAll('.tn-zip').forEach(e => e.remove());
  const L = side === 'left', inner = L ? 'right' : 'left', outer = L ? 'left' : 'right';
  const mk = (css) => { const e = document.createElement('i'); e.className = 'tn-zip'; e.style.cssText = css; document.body.appendChild(e); return e; };
  const seam = mk(`top:0;bottom:0;${inner}:0;width:3px`);
  const top = mk(`top:0;left:0;right:0;height:2px;transform-origin:${outer} 50%`), bot = mk(`bottom:0;left:0;right:0;height:2px;transform-origin:${outer} 50%`);
  seam.animate([{ opacity: 1 }, { opacity: .9, offset: 0.3 }, { opacity: 0 }], { duration: 460, easing: 'ease-out', fill: 'forwards' }).onfinish = () => seam.remove();
  for (const e of [top, bot]) e.animate([{ transform: 'scaleX(1)', opacity: .9 }, { transform: 'scaleX(0)', opacity: .5 }], { duration: 340, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).onfinish = () => e.remove();
};
window.tnZipFx = (panel, side, keep) => {   // keep(v0.1.176) = 문짝이 아직 닫히는 중 → 그대로 두고 테두리만 겹쳐 그림
  if (panel && !keep) { panel.getAnimations().forEach(a => { if (a.id === 'door') a.cancel(); }); panel.style.transform = ''; }
  document.querySelectorAll('.tn-zip').forEach(e => e.remove());
  const L = side === 'left', inner = L ? 'right' : 'left', outer = L ? 'left' : 'right', E = 'cubic-bezier(.45,0,.25,1)';
  const mk = (css) => { const e = document.createElement('i'); e.className = 'tn-zip'; e.style.cssText = css; document.body.appendChild(e); return e; };
  const seam = mk(`top:0;bottom:0;${inner}:0;width:3px`);
  const top = mk(`top:0;left:0;right:0;height:2px;transform-origin:${inner} 50%`), bot = mk(`bottom:0;left:0;right:0;height:2px;transform-origin:${inner} 50%`);
  const ot = mk(`top:0;height:50%;${outer}:0;width:2px;transform-origin:50% 0%`), ob = mk(`bottom:0;height:50%;${outer}:0;width:2px;transform-origin:50% 100%`);
  seam.animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
  for (const e of [top, bot]) e.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 260, easing: E, fill: 'forwards' });
  for (const e of [ot, ob]) e.animate([{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 200, delay: 200, easing: E, fill: 'both' });
  setTimeout(() => { for (const e of [seam, top, bot, ot, ob]) if (e.isConnected) e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' }).onfinish = () => e.remove(); }, 750);   // 홈으로 안 넘어가는 합침(도킹 끔 등)은 테두리가 남지 않게
};
// 🪟 v0.1.192 확인·알림 창 = 앱 안에 그림(사장님: 윈도우 기본 확인 창이 톤앤매너가 안 맞음 · 투명한 왼쪽 창에서는 기본 확인 창이 안 보이고 창이 멈춘 것처럼 됨)
//   window.tnConfirm(글, {title, ok, cancel, danger}) → Promise<true|false> · window.tnAlert(글, {title}) → Promise · Enter = 확인 · Esc·바깥 누름 = 취소 · 줄바꿈(\n) 그대로
(() => {
  if (window.tnConfirm) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let queue = Promise.resolve();
  const open = (msg, o, two) => new Promise(done => {
    const wrap = document.createElement('div');
    wrap.className = 'tn-mb';
    wrap.innerHTML = `<div class="tn-mb-card${o.danger ? ' danger' : ''}" role="dialog" aria-modal="true"><span class="tn-mb-en">${esc(o.en || (two ? 'CONFIRM' : 'NOTICE'))}</span>`
      + (o.title ? `<b class="tn-mb-t">${esc(o.title)}</b>` : '') + `<p class="tn-mb-m">${esc(msg)}</p><div class="tn-mb-btns">`
      + (two ? `<button class="ui-btn-ghost tn-mb-no">${esc(o.cancel || '취소')}</button>` : '') + `<button class="ui-btn-gold tn-mb-ok">${esc(o.ok || '확인')}</button></div></div>`;
    const end = v => { document.removeEventListener('keydown', key, true); wrap.remove(); done(v); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); end(true); } };
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) end(false); });
    wrap.querySelector('.tn-mb-ok').onclick = () => end(true);
    const no = wrap.querySelector('.tn-mb-no'); if (no) no.onclick = () => end(false);
    document.addEventListener('keydown', key, true);
    (document.body || document.documentElement).appendChild(wrap);
    try { wrap.querySelector('.tn-mb-ok').focus(); } catch (_) {}
  });
  const q = (msg, o, two) => (queue = queue.then(() => open(msg, o || {}, two)));   // 여러 개면 차례로
  window.tnConfirm = (msg, o) => q(msg, o, true);
  window.tnAlert = (msg, o) => q(msg, o, false).then(() => undefined);
})();
