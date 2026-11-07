// 🏅 아수라장 티어 공개(v0.1.113 · 사장님: 처음 내전 켜고 내 티어가 정해질 때 애니메이션으로 · ?에 간단한 근거 + 최신 아수라장 판 기준이라고)
//   main tierReveal → 'tier-reveal' {kind, tier, div, rank(아이언 0~챌린저 9), s, n, w, wr, kda, prev, dir: first|up|down}
//   카드 한 번: 문장이 위에서 떨어져 박힘 → 빛이 한 번 훑음 → 티어 이름·점수 → 9초 뒤 저절로 닫힘(「?」를 열면 「확인」 누를 때까지)
//   애니메이션은 전부 한 번만(WAAPI · 성능 규칙: 무한 반복 금지)
//   🏅 v0.1.146(사장님: 실제 롤 티어 문장·모션으로) — 처음·승급·다시 보기 = 롤 클라이언트 승급 모션 영상(CommunityDragon videos/ranked/tier-promotion-to-{티어}.webm · 투명 · 6.7초 · 한 번) → 문장이 완성될 즈음(2.4초) 글자
//     강등 = 실제 문장 그림(ranked-emblem)이 위에서 떨어져 박히는 예전 연출 · 영상을 못 받으면 문장 그림으로 · 「우리끼리 점수(공식 랭크 아님)」 표시는 그대로
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KO = { IRON: '아이언', BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘', EMERALD: '에메랄드', DIAMOND: '다이아몬드', MASTER: '마스터', GRANDMASTER: '그랜드마스터', CHALLENGER: '챌린저' };
  //   v0.1.114: kind = 'custom'(아수라장 내전 · 사용자 설정 게임) | 'mayhem'(아수라장 일반) · 둘이 한꺼번에 오면 차례로(줄 세움)
  const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/';
  // 티어마다 문장 그림(16:9 투명)에서 문장이 차지하는 칸 [가운데 x, 가운데 y, 폭, 높이](그림 대비 비율 · 2026-11-07 실측 — 아이언은 작고 챌린저는 큼) → 상자에 꽉 맞게 자름
  const EMB = { iron: [0.5008, 0.4944, 0.1516, 0.1611], bronze: [0.5, 0.4889, 0.1781, 0.2111], silver: [0.5, 0.4708, 0.1938, 0.2417], gold: [0.4984, 0.4806, 0.1969, 0.2944], platinum: [0.5, 0.4646, 0.2031, 0.3014],
    emerald: [0.5004, 0.4688, 0.2242, 0.2931], diamond: [0.5, 0.4931, 0.2406, 0.2528], master: [0.5008, 0.4792, 0.2297, 0.2917], grandmaster: [0.5, 0.4861, 0.2406, 0.3], challenger: [0.5, 0.4736, 0.2469, 0.325] };
  window.tnEmblem = (tier, W, H, fill) => { const t = String(tier || '').toLowerCase(), b = EMB[t] || [0.5, 0.48, 0.2, 0.3], f = fill || 0.96, k = Math.min(W * f / b[2], H * f / (b[3] * 0.5625));
    return `<img class="tn-emb" src="${CD}ranked-emblem/emblem-${t}.png" alt="" style="width:${k.toFixed(1)}px;left:calc(50% - ${(b[0] * k).toFixed(1)}px);top:calc(50% - ${(b[1] * k * 0.5625).toFixed(1)}px)">`; };
  let box = null, timer = null, open = false;
  const queue = [];
  function close() {
    clearTimeout(timer); timer = null; if (!box || !open) return;
    open = false;
    const a = box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in' });
    a.onfinish = () => { if (open) return; box.style.display = 'none'; if (queue.length) setTimeout(() => show(queue.shift()), 250); };
  }
  function show(d) {
    if (!d || !d.tier) return;
    if (open) { if (d.dir !== 'replay') { queue.push(d); return; } open = false; }   // 다시 보기는 줄 안 서고 바로 바꿔 띄움
    if (!box) { box = document.createElement('div'); box.className = 'trv'; document.body.appendChild(box); }
    clearTimeout(timer); open = true;
    const custom = d.kind === 'custom', what = custom ? '아수라장 내전' : '아수라장';
    const name = KO[d.tier] || d.tier, head = d.dir === 'up' ? 'PROMOTED' : d.dir === 'down' ? 'TIER UPDATE' : custom ? 'IN-HOUSE MAYHEM TIER' : 'MAYHEM TIER';
    // v0.1.116: 프로필 티어 칸을 누르면 다시 보기(dir 'replay' · who = 남의 프로필이면 그 사람 이름)
    const sub = d.dir === 'up' ? `${what} · ${KO[d.prev] || d.prev}에서 승급했어요` : d.dir === 'down' ? `${what} · ${KO[d.prev] || d.prev}에서 내려왔어요`
      : d.dir === 'replay' ? (d.who ? `${esc(d.who)}님의 ${what} 티어` : `내 ${what} 티어`) : `내 ${what} 티어가 정해졌어요`;
    box.className = `trv t-${String(d.tier).toLowerCase()}`;
    box.innerHTML = `<div class="trv-card">
      <button class="trv-q" title="근거">?</button>
      <span class="trv-en lb-sec-en">${head}</span>
      ${d.dir === 'down' ? `<div class="trv-emb rk">${window.tnEmblem(d.tier, 120, 100)}<i></i></div>` : `<div class="trv-vid"><video src="${CD}videos/ranked/tier-promotion-to-${String(d.tier).toLowerCase()}.webm" muted playsinline preload="auto"></video>${window.tnEmblem(d.tier, 120, 104).replace('<img ', '<img hidden ')}</div>`}
      <b class="trv-name">${name}${d.div ? ` <span class="num">${d.div}</span>` : ''}</b>
      <span class="trv-sub">${sub}</span>
      <span class="trv-stat num">${d.s}점 · ${d.n}판 ${d.w}승 · 승률 ${Math.round((d.wr || 0) * 100)}%</span>
      <div class="trv-why" hidden>${custom ? `투데이 내전으로 기록된 아수라장 <b>내전 ${d.n}판</b>(아수라장 ${d.season || '시즌 3 · 26.21~'} · 기록 전부)` : `아수라장 <b>일반 판 ${d.n}판</b>(${d.season || '시즌 3 · 26.21~'} · 롤 전적 + 투데이 내전으로 같이 한 판 · 내전 제외)`} 기준으로 매겼어요<br>점수 = 승률 + 경기력(팀 안 딜 순위·킬 관여·KDA) · 최근 판일수록 크게<br>8점마다 한 티어 · <b>우리끼리 점수</b>(공식 랭크 아님) · 판을 할수록 다시 매겨져요</div>
      <div class="trv-btns"><button class="trv-ok ui-btn-gold">확인</button></div>
    </div>`;
    box.style.display = '';
    const q = c => box.querySelector(c);
    q('.trv-ok').onclick = close;
    q('.trv-q').onclick = () => { const w = q('.trv-why'); w.hidden = !w.hidden; q('.trv-q').classList.toggle('on', !w.hidden); clearTimeout(timer); timer = null; };   // 근거를 열면 저절로 안 닫힘
    // 🎬 한 번만: 배경 → 카드 → 문장 떨어져 박힘(살짝 튐) → 빛 훑음 → 글자
    const vid = q('.trv-vid video'), late = vid ? 2400 : 0;   // 영상이면 문장이 생길 때까지 글자를 늦춤
    if (vid) { vid.volume = 0; const fb = () => { vid.remove(); const im = q('.trv-vid img'); if (im) { im.hidden = false; im.animate([{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.3,.7,.3,1)' }); } };
      vid.onerror = fb; const p = vid.play(); if (p && p.catch) p.catch(fb); }
    box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    q('.trv-card').animate([{ opacity: 0, transform: 'translateY(10px) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
    if (q('.trv-emb')) q('.trv-emb').animate([{ opacity: 0, transform: 'translateY(-46px) scale(1.5)', filter: 'brightness(2.4) blur(3px)' }, { opacity: 1, transform: 'translateY(0) scale(0.94)', filter: 'brightness(1.6) blur(0)', offset: 0.62 }, { transform: 'scale(1.05)', filter: 'brightness(1.15)', offset: 0.82 }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 760, delay: 180, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
    if (q('.trv-emb i')) q('.trv-emb i').animate([{ transform: 'translateX(-120%) skewX(-18deg)', opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { transform: 'translateX(220%) skewX(-18deg)', opacity: 0 }], { duration: 620, delay: 760, easing: 'ease-out', fill: 'both' });
    let k = 0; for (const c of ['.trv-en', '.trv-name', '.trv-sub', '.trv-stat', '.trv-btns'])
      q(c).animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: (c === '.trv-en' ? 120 : late + 820 + 90 * k++), easing: 'ease-out', fill: 'backwards' });
    timer = setTimeout(close, 9000 + late);
  }
  window.tnTierReveal = show;
  if (window.api && window.api.onTierReveal) window.api.onTierReveal(show);
})();
