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
  // 🏅 v0.1.295 등급 문장 = 「인장」 메달(사장님: 예전 방패가 밋밋 → 시안 A·B·C 중 C 인장 → 발전형 C1 왕관)
  //   금속 베젤(새김 눈금·빛 반사) · 바깥 9칸 = 등급만큼 채워짐(지금 등급 칸이 가장 밝음) · 어두운 안판(빛살 새김) · 금속 글자
  //   장식 = A부터 베젤 징 4개 → S 톱니+위 보석 → S+ 톱니 촘촘 → SS 옆 칼날 → SSS 무지갯빛 베젤+보석 왕관+반짝임 · 전부 멈춘 그림(애니메이션 없음)
  //   viewBox 0 0 100 112(가로:세로 = 예전 방패 자리와 같은 비율) · 그라데이션 id는 그릴 때마다 새로(한 화면에 여러 개)
  const MT = {   // [밝음, 가운데, 어두움, 빛]
    D: ['#d2b39a', '#8c6a52', '#3b2a1f', '#b8937a'], C: ['#f4f8fc', '#b3c1cf', '#4e5a66', '#dfe8f1'],
    B: ['#cdeeff', '#5fb0e8', '#174872', '#8fd0ff'], A: ['#c9fff5', '#3fc8b4', '#0d5249', '#7ef0dd'],
    'A+': ['#d6ffe0', '#5bd67e', '#135a2b', '#93f0ae'], S: ['#fff3cc', '#e6bf62', '#6f4c12', '#ffe08a'],
    'S+': ['#ffe6c9', '#f1974a', '#74340b', '#ffbf80'], SS: ['#ffdada', '#ff6464', '#6e141c', '#ff9a9a'],
    SSS: ['#fbe8ff', '#c79bff', '#3a2078', '#e5ccff'] };
  let EID = 0;
  const CX = 50, CY = 60, f2 = v => (+v).toFixed(2);
  const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const PT = (r, deg) => [CX + r * Math.cos(deg * Math.PI / 180), CY + r * Math.sin(deg * Math.PI / 180)];
  const pts = a => a.map(p => p.map(f2).join(',')).join(' ');
  const arc = (r0, r1, a0, a1) => { const [x0, y0] = PT(r1, a0), [x1, y1] = PT(r1, a1), [x2, y2] = PT(r0, a1), [x3, y3] = PT(r0, a0); return `M${f2(x0)} ${f2(y0)}A${r1} ${r1} 0 0 1 ${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}A${r0} ${r0} 0 0 0 ${f2(x3)} ${f2(y3)}Z`; };
  const gem = (x, y, s, id, c) => `<polygon points="${pts([[x, y - s], [x + s * 0.72, y], [x, y + s * 1.05], [x - s * 0.72, y]])}" fill="url(#${id}g)" stroke="${c[2]}" stroke-width="0.8"/><polygon points="${pts([[x, y - s], [x + s * 0.72, y], [x, y - s * 0.1], [x - s * 0.72, y]])}" fill="#fff" fill-opacity="0.35"/>`;
  const spark = (x, y, r, col) => `<path d="M${x} ${y - r}L${f2(x + r * 0.22)} ${f2(y - r * 0.22)}L${x + r} ${y}L${f2(x + r * 0.22)} ${f2(y + r * 0.22)}L${x} ${y + r}L${f2(x - r * 0.22)} ${f2(y + r * 0.22)}L${x - r} ${y}L${f2(x - r * 0.22)} ${f2(y - r * 0.22)}Z" fill="${col}"/>`;
  window.tnEmblem = (tier, W, H) => {
    const T = String(tier || '').toUpperCase(), g = GR[T]; if (!g) return '';
    const s = STEP[g] || 0, c = MT[g], id = 'tne' + (++EID), metal = s >= 8 ? id + 'p' : id + 'f';
    const sz = Math.max(16, Math.min(W / 100, H / 112) * 100);
    const defs = `<defs>${lg(id + 'f', [[0, c[0]], [0.42, c[1]], [1, c[2]]], 0.1, 0, 0.75, 1)}${lg(id + 'p', [[0, '#ffc6ef'], [0.25, '#c79bff'], [0.5, '#8fcbff'], [0.75, '#9dffd6'], [1, '#ffe39a']], 0, 0, 1, 1)}`
      + `${lg(id + 'g', [[0, '#ffffff'], [0.45, c[3]], [1, c[1]]])}<radialGradient id="${id}d" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stop-color="#25313d"/><stop offset="0.65" stop-color="#0b1117"/><stop offset="1" stop-color="#05080c"/></radialGradient>`
      + `${lg(id + 't', [[0, '#ffffff'], [0.5, c[0]], [1, c[1]]])}</defs>`;
    let back = '', front = '';
    if (s >= 5) { const n = s >= 6 ? 16 : 12, len = s >= 6 ? 5.5 : 4.5; for (let k = 0; k < n; k++) { const a = k * 360 / n - 90 + 180 / n, w = 180 / n * 0.42; back += `<polygon points="${pts([PT(42.6, a - w), PT(43.4 + len, a), PT(42.6, a + w)])}" fill="url(#${id}f)" stroke="#000" stroke-opacity="0.25" stroke-width="0.4"/>`; } }   // S~ 톱니
    if (s >= 7) for (const d of [-1, 1]) back += `<polygon points="${pts([[CX + d * 30, CY - 10], [CX + d * 50, CY - 22], [CX + d * 44, CY + 2], [CX + d * 50, CY + 18], [CX + d * 30, CY + 10]])}" fill="url(#${metal})" stroke="${c[2]}" stroke-width="0.8"/>`;   // SS~ 옆 칼날
    let ticks = '';
    for (let k = 0; k < 36; k++) { const [x0, y0] = PT(39.2, k * 10), [x1, y1] = PT(41.6, k * 10); ticks += `<line x1="${f2(x0)}" y1="${f2(y0)}" x2="${f2(x1)}" y2="${f2(y1)}" stroke="${c[2]}" stroke-opacity="0.75" stroke-width="0.7"/>`; }
    let ring = '';
    for (let k = 0; k < 9; k++) {   // 9칸 = D C B A A+ S S+ SS SSS · 지금 등급까지 채움
      const a0 = -90 + k * 40 + 2.2, a1 = -90 + (k + 1) * 40 - 2.2, on = k <= s;
      ring += `<path d="${arc(30.6, 37.2, a0, a1)}" fill="${on ? `url(#${metal})` : '#0f161d'}" stroke="${on ? c[2] : '#222b34'}" stroke-width="0.6"/>`;
      if (on) ring += `<path d="${arc(35.4, 37.2, a0 + 1, a1 - 1)}" fill="#fff" fill-opacity="${k === s ? 0.55 : 0.22}"/>`;
    }
    const [g0x, g0y] = PT(42.6, 200), [g1x, g1y] = PT(42.6, 262);
    let eng = ''; for (let k = 0; k < 12; k++) { const [x0, y0] = PT(10, k * 30), [x1, y1] = PT(27.5, k * 30); eng += `<line x1="${f2(x0)}" y1="${f2(y0)}" x2="${f2(x1)}" y2="${f2(y1)}" stroke="${c[1]}" stroke-opacity="${s >= 5 ? 0.16 : 0.08}" stroke-width="0.8"/>`; }
    const studs = s >= 3 ? [0, 90, 180, 270].map(a => { const [x, y] = PT(40.3, a - 90); return `<circle cx="${f2(x)}" cy="${f2(y)}" r="2.1" fill="url(#${id}g)" stroke="${c[2]}" stroke-width="0.6"/>`; }).join('') : '';
    const fs = g.length >= 3 ? 27 : g.length === 2 ? 33 : 40, txt = g.replace('+', '<tspan dy="-0.34em" font-size="0.6em">+</tspan>');
    const tb = `x="${CX}" y="${CY + 1}" text-anchor="middle" dominant-baseline="central" font-family="'Barlow Condensed', sans-serif" font-weight="700" font-style="italic" font-size="${fs}" letter-spacing="${g.length >= 3 ? -1.6 : g.length === 2 ? -0.6 : 0}"`;
    if (s >= 5) front += gem(CX, 13, s >= 8 ? 8 : 7, id, c);   // S~ 위 보석
    if (s >= 8) front += gem(CX - 15, 19, 5, id, c) + gem(CX + 15, 19, 5, id, c) + spark(10, 14, 4.5, '#fff') + spark(91, 24, 3.5, c[0]) + spark(88, 100, 3, '#fff');   // SSS 왕관
    return `<svg class="tn-emb tn-grade" viewBox="0 0 100 112" width="${f2(sz)}" height="${f2(sz * 1.12)}" aria-label="등급 ${g}">${defs}${back}`
      + `<circle cx="${CX}" cy="${CY}" r="43.4" fill="url(#${metal})"/><circle cx="${CX}" cy="${CY}" r="43.4" fill="none" stroke="${c[2]}" stroke-width="1.2"/>${ticks}`
      + `<path d="M${f2(g0x)} ${f2(g0y)}A42.6 42.6 0 0 1 ${f2(g1x)} ${f2(g1y)}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round"/>`
      + `<circle cx="${CX}" cy="${CY}" r="38.4" fill="#05080c"/>${ring}<circle cx="${CX}" cy="${CY}" r="29.6" fill="url(#${id}d)" stroke="${c[1]}" stroke-opacity="0.7" stroke-width="0.9"/>${eng}`
      + `<circle cx="${CX}" cy="${CY}" r="24.6" fill="none" stroke="${c[1]}" stroke-opacity="0.18" stroke-width="0.7"/>${studs}`
      + `<text ${tb} fill="#000" fill-opacity="0.55" transform="translate(0 1.6)">${txt}</text><text ${tb} fill="url(#${id}t)" stroke="#06090d" stroke-width="${f2(fs * 0.06)}" paint-order="stroke" stroke-linejoin="round">${txt}</text>${front}</svg>`;
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
      <div class="trv-emb rk">${window.tnEmblem(d.tier, 104, 116)}<span class="trv-shine"><i></i></span></div>
      <b class="trv-name">${name}</b>
      <span class="trv-sub">${sub}</span>
      <span class="trv-stat num">${d.s}점 · ${d.n}판 ${d.w}승 · 승률 ${Math.round((d.wr || 0) * 100)}%</span>
      <div class="trv-why" hidden>${custom ? `투데이 내전으로 기록된 아수라장 <b>내전 ${d.n}판</b>(아수라장 ${d.season || '시즌 3 · 26.21~'} · 기록 전부)` : `아수라장 <b>일반 판 ${d.n}판</b>(${d.season || '시즌 3 · 26.21~'} · 롤 전적 + 투데이 내전으로 같이 한 판 · 내전 제외)`} 기준으로 매겼습니다<br>점수 = 승률 + 경기력(팀 안 딜 순위·킬 관여·KDA) · 최근 판일수록 크게<br>8점마다 한 등급 · <b>우리끼리 점수</b>(공식 랭크 아님) · 판을 할수록 다시 매겨져요</div>
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
