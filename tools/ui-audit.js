// 🔍 화면 글자 겹침·잘림 검사(v0.1.10) — 디자인을 바꾸면 배포 전에 꼭 돌릴 것
// 사용: 앱을 TN_HIDDEN=1 --remote-debugging-port=9333으로 띄우고, 렌더러(overlay/sidepanel)에 이 파일 내용을 CDP Runtime.evaluate로 넣은 뒤 __audit() 호출
//   → { overlap:[겹친 글자쌍], clipped:[…처리 없이 잘린 글자], ellipsis:…로 줄인 곳 수 }. overlap·clipped가 0이어야 통과
// 최악 조건 = 롤 닉네임 최대 16자(한글 16자·WWWW…)로도 돌릴 것. 떠 있는 메뉴(#s-hostmenu)가 아래를 덮는 건 제외
// ⚠️ 창 크기가 0이거나 화면 전환 중엔 아무것도 못 재고 0건이 나옴 → 일부러 겹치게 만든 화면으로 한 번 잡히는지 확인
// 글자 겹침·잘림 검사 — 렌더러에 주입해 window.__audit() 호출
// 실제로 그려진 글자(텍스트 노드)의 사각형을 재서: ① 서로 다른 글자끼리 겹침 ② 가로로 칸 밖으로 넘쳐 잘림(…처리 안 된 것)
window.__audit = function () {
  const view = [...document.querySelectorAll('.view, .cat-view, #s-login, header, #sbar, #s-hostmenu')].filter(v => v.offsetParent !== null || getComputedStyle(v).position === 'fixed');
  const out = { overlap: [], clipped: [], ellipsis: 0 };
  const texts = [];
  const visible = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const label = el => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase());
  for (const root of view) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    for (let n; (n = tw.nextNode());) {
      const el = n.parentElement; if (!el || !visible(el)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      // 화면에 보이는 부분만: 넘침을 자르는 조상(overflow·clip-path)의 사각형으로 잘라냄(…으로 줄인 글자는 줄인 만큼만)
      let clip = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
      for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.overflowX !== 'visible' || cs.clipPath !== 'none') { const c = e.getBoundingClientRect(); clip = { left: Math.max(clip.left, c.left), top: Math.max(clip.top, c.top), right: Math.min(clip.right, c.right), bottom: Math.min(clip.bottom, c.bottom) }; } }
      for (const r0 of rg.getClientRects()) { const r = { left: Math.max(r0.left, clip.left), top: Math.max(r0.top, clip.top), right: Math.min(r0.right, clip.right), bottom: Math.min(r0.bottom, clip.bottom), raw: r0 }; if (r.right - r.left > 1 && r.bottom - r.top > 1) texts.push({ r, el, t: n.textContent.trim().slice(0, 24) }); }
    }
  }
  // ① 겹침: 다른 요소에 속한 글자끼리 2px 넘게 겹치면
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (!!a.el.closest('#s-hostmenu') !== !!b.el.closest('#s-hostmenu')) continue;   // 떠 있는 메뉴가 아래를 덮는 건 겹침 아님
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 2 && h > 2) out.overlap.push(`「${a.t}」(${label(a.el)}) ↔ 「${b.t}」(${label(b.el)})`);
  }
  // ② 잘림: 글자가 가로로 잘리는 조상(overflow hidden/clip) 밖으로 나감
  const seen = new Set();
  for (const x of texts) {
    for (let e = x.el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflowX === 'visible' && cs.clipPath === 'none') continue;
      const c = e.getBoundingClientRect();
      if (x.r.raw.right > c.right + 1 || x.r.raw.left < c.left - 1) {
        const key = x.el;
        if (seen.has(key)) break; seen.add(key);
        // …은 블록 상자에서만 실제로 붙음(flex·grid 상자 바로 안의 글자엔 안 붙고 양쪽이 그냥 잘림)
        const ellOk = n => { const cs = getComputedStyle(n); return cs.textOverflow === 'ellipsis' && !/flex|grid/.test(cs.display) && cs.whiteSpace.startsWith('nowrap'); };
        const ell = ellOk(x.el) || ellOk(e);
        if (ell) out.ellipsis++; else out.clipped.push(`「${x.t}」(${label(x.el)}) — ${label(e)} 밖으로 ${Math.round(Math.max(x.r.raw.right - c.right, c.left - x.r.raw.left))}px`);
      }
      break;
    }
  }
  // 「…」으로 줄인 곳(의도) 개수도 같이: scrollWidth > clientWidth + ellipsis
  for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && visible(el) && !seen.has(el)) { if (/flex|grid/.test(cs.display) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) out.clipped.push('「' + el.textContent.trim().slice(0, 24) + '」(.' + String(el.className).split(' ')[0] + ') — flex 상자라 …이 안 붙고 잘림'); else out.ellipsis++; } }
  out.overlap = [...new Set(out.overlap)]; out.clipped = [...new Set(out.clipped)];
  return out;
};
