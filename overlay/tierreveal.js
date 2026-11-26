// 🏅 아수라장 등급 공개(v0.1.113 · 사장님: 처음 내전 켜고 내 등급가 정해질 때 애니메이션으로 · ?에 간단한 근거 + 최신 아수라장 판 기준이라고)
//   main tierReveal → 'tier-reveal' {kind, tier, div, rank(아이언 0~챌린저 9), s, n, w, wr, kda, prev, dir: first|up|down}
//   카드 한 번: 문장이 위에서 떨어져 박힘 → 빛이 한 번 훑음 → 등급 이름·점수 → 9초 뒤 저절로 닫힘(「?」를 열면 「확인」 누를 때까지)
//   애니메이션은 전부 한 번만(WAAPI · 성능 규칙: 무한 반복 금지)
//   🏅 v0.1.146(사장님: 실제 롤 등급 문장·모션으로) — 처음·승급·다시 보기 = 롤 클라이언트 승급 모션 영상(CommunityDragon videos/ranked/tier-promotion-to-{등급}.webm · 투명 · 6.7초 · 한 번) → 문장이 완성될 즈음(2.4초) 글자
//     강등 = 실제 문장 그림(ranked-emblem)이 위에서 떨어져 박히는 예전 연출 · 영상을 못 받으면 문장 그림으로 · 「우리끼리 점수(공식 랭크 아님)」 표시는 그대로
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 🔤 v0.1.255 내전 등급(사장님: 「우리끼리 등급」를 우리 식으로 — 이름·디자인·「등급」라는 말까지 · 라이엇 정책 「공식 랭크 대체 금지」)
  //   내부 값(BRONZE~CHALLENGER · 점수 기준 그대로)은 그대로 두고 화면만 D~SSS 글자 등급 + 직접 그린 각진 방패(롤 문장 그림·승급 영상은 안 씀)
  const GR = { IRON: 'D', BRONZE: 'D', SILVER: 'C', GOLD: 'B', PLATINUM: 'A', EMERALD: 'A+', DIAMOND: 'S', MASTER: 'S+', GRANDMASTER: 'SS', CHALLENGER: 'SSS' };
  const GC = { IRON: '#8d939c', BRONZE: '#8d939c', SILVER: '#b9c6d2', GOLD: '#5fb0e8', PLATINUM: '#3fc8b4', EMERALD: '#5bd67e', DIAMOND: '#e6bf62', MASTER: '#f1974a', GRANDMASTER: '#ff6464', CHALLENGER: '#c79bff' };
  const STEP = { D: 0, C: 1, B: 2, A: 3, 'A+': 4, S: 5, 'S+': 6, SS: 7, SSS: 8 };
  window.tnGrade = tier => GR[String(tier || '').toUpperCase()] || '';
  window.tnGradeColor = tier => GC[String(tier || '').toUpperCase()] || '#8d939c';
  // 방패 = 위아래 뾰족한 육각형(비스듬히 자른 모서리 = 앱 디자인) · 등급 색 테두리 + 옅은 바탕 · S부터 안쪽 테두리 한 줄 더 · SS부터 위 눈금 · 글자 = Barlow Condensed
  window.tnEmblem = (tier, W, H) => {
    const T = String(tier || '').toUpperCase(), g = GR[T]; if (!g) return '';
    const c = GC[T], st = STEP[g] || 0, sz = Math.max(16, Math.min(W / 100, H / 112) * 100);
    const fs = g.length >= 3 ? 34 : g.length === 2 ? 42 : 54;
    const inner = st >= 5 ? `<polygon points="50,13 84,29 84,70 50,97 16,70 16,29" fill="none" stroke="${c}" stroke-opacity="0.55" stroke-width="1.6"/>` : '';
    const ticks = st >= 7 ? Array.from({ length: st - 6 }, (_, i) => `<rect x="${44 - (st - 7) * 7 + i * 14}" y="0" width="12" height="4" fill="${c}"/>`).join('') : '';
    return `<svg class="tn-emb tn-grade" viewBox="0 -4 100 116" width="${sz.toFixed(1)}" height="${(sz * 1.16).toFixed(1)}" aria-label="등급 ${g}">`
      + `<polygon points="50,4 93,23 93,76 50,108 7,76 7,23" fill="${c}" fill-opacity="0.13" stroke="${c}" stroke-width="3.2"/>${inner}${ticks}`
      + `<text x="50" y="${g.length >= 3 ? 68 : g.length === 2 ? 71 : 75}" text-anchor="middle" font-family="'Barlow Condensed', sans-serif" font-weight="700" font-style="italic" font-size="${fs}" fill="${c}" letter-spacing="${g.length >= 3 ? -1 : 0}">${g}</text></svg>`;
  };
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
    const G = t => window.tnGrade(t) || t, name = `${G(d.tier)} 등급`, head = d.dir === 'up' ? 'GRADE UP' : d.dir === 'down' ? 'GRADE UPDATE' : 'IN-HOUSE GRADE';
    // v0.1.116: 프로필 등급 칸을 누르면 다시 보기(dir 'replay' · who = 남의 프로필이면 그 사람 이름)
    const sub = d.dir === 'up' ? `${what} 등급 · ${G(d.prev)}에서 올랐습니다` : d.dir === 'down' ? `${what} 등급 · ${G(d.prev)}에서 내려왔습니다`
      : d.dir === 'replay' ? (d.who ? `${esc(d.who)}님의 ${what} 등급` : `내 ${what} 등급`) : `내 ${what} 등급이 정해졌습니다`;
    box.className = `trv t-${String(d.tier).toLowerCase()}`;
    box.innerHTML = `<div class="trv-card">
      <button class="trv-q" title="근거">?</button>
      <span class="trv-en lb-sec-en">${head}</span>
      <div class="trv-emb rk">${window.tnEmblem(d.tier, 92, 104)}<i></i></div>
      <b class="trv-name">${name}</b>
      <span class="trv-sub">${sub}</span>
      <span class="trv-stat num">${d.s}점 · ${d.n}판 ${d.w}승 · 승률 ${Math.round((d.wr || 0) * 100)}%</span>
      <div class="trv-why" hidden>${custom ? `투데이 내전으로 기록된 아수라장 <b>내전 ${d.n}판</b>(아수라장 ${d.season || '시즌 3 · 26.21~'} · 기록 전부)` : `아수라장 <b>일반 판 ${d.n}판</b>(${d.season || '시즌 3 · 26.21~'} · 롤 전적 + 투데이 내전으로 같이 한 판 · 내전 제외)`} 기준으로 매겼어요<br>점수 = 승률 + 경기력(팀 안 딜 순위·킬 관여·KDA) · 최근 판일수록 크게<br>8점마다 한 등급 · <b>우리끼리 점수</b>(공식 랭크 아님) · 판을 할수록 다시 매겨져요</div>
      <div class="trv-btns"><button class="trv-ok ui-btn-gold">확인</button></div>
    </div>`;
    box.style.display = '';
    const q = c => box.querySelector(c);
    q('.trv-ok').onclick = close;
    q('.trv-q').onclick = () => { const w = q('.trv-why'); w.hidden = !w.hidden; q('.trv-q').classList.toggle('on', !w.hidden); clearTimeout(timer); timer = null; };   // 근거를 열면 저절로 안 닫힘
    // 🎬 한 번만: 배경 → 카드 → 문장 떨어져 박힘(살짝 튐) → 빛 훑음 → 글자
    const late = 0;   // v0.1.255 롤 승급 영상 안 씀(직접 그린 방패가 떨어져 박힘)
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
