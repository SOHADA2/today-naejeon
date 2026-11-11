// 🧪 증강 연구(2026-11-11 · 사장님: 오른쪽 창에서 롤 아수라장처럼 증강 3장을 뽑아 보기 · 실버·골드·프리즘)
//   한 판 = 증강 4번 고르기 · 매번 3장(카드마다 등급을 따로 뽑음 · 판이 갈수록 높은 등급이 잘 나옴) · 다시 뽑기 2번(카드 한 장씩)
//   고르면 세 장의 「연구 결과」 공개 = aramgg 등급(T1~T5)·승률·우리 기록 → 셋 중 가장 좋은 카드 표시 · 4번 끝나면 「최고 선택 n/4」
//   ⚠️ 등급 확률은 라이엇이 공개하지 않아 근사치(AL_ODDS) · 효과는 전부 한 번만(성능 규칙 · 무한 애니메이션 금지)
//   ⚠️ 이 창의 다른 스크립트와 최상위 이름이 겹치지 않게 al 접두사
const AL_ODDS = [   // [실버, 골드, 프리즘] — 1~4번째 고르기
  [0.55, 0.35, 0.10],
  [0.35, 0.45, 0.20],
  [0.20, 0.45, 0.35],
  [0.10, 0.40, 0.50],
];
const AL_RAR = ['silver', 'gold', 'prismatic'];
const AL_RNAME = { silver: '실버', gold: '골드', prismatic: '프리즘' };
const AL_REROLLS = 2, AL_ROUNDS = 4;
const AL = { pool: null, patch: '', round: 0, picks: [], best: 0, rerolls: AL_REROLLS, offer: null, picked: -1 };

function alRarity(round) {
  const o = AL_ODDS[Math.min(round, AL_ODDS.length - 1)];
  let r = Math.random();
  for (let i = 0; i < 3; i++) { if ((r -= o[i]) < 0) return AL_RAR[i]; }
  return 'gold';
}
// 아직 안 나온 증강 하나(이번 판에 고른 것·지금 떠 있는 카드는 빼고) · 그 등급이 다 떨어지면 다른 등급
function alDraw(rar, taken) {
  const left = r => AL.pool.filter(a => a.rarity === r && !taken.has(a.id));
  let c = left(rar);
  if (!c.length) c = AL.pool.filter(a => !taken.has(a.id));
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}
function alTaken(skip) {
  const s = new Set(AL.picks.map(a => a.id));
  (AL.offer || []).forEach((a, i) => { if (a && i !== skip) s.add(a.id); });
  return s;
}
// 셋 중 가장 좋은 카드 = aramgg 등급이 낮을수록(T1 최고) → 같으면 승률 · 등급 자료가 없는 카드는 뒤로
function alBestIdx(offer) {
  let bi = -1, bs = -1;
  offer.forEach((a, i) => { const s = a.t ? (6 - a.t) * 10 + a.wr : 0; if (s > bs) { bs = s; bi = i; } });
  return bs > 0 ? bi : -1;
}
function alSfx() {
  const v = (window.__tnVol == null ? 0.5 : window.__tnVol) * 0.35;
  if (!(v > 0)) return;
  try { const s = new Audio('../assets/sfx/potg-hit.ogg'); s.volume = Math.min(1, v); s.play().catch(() => {}); } catch (_) {}
}

async function renderAugLab() {
  const body = $('al-body');
  if (!AL.pool) {
    body.innerHTML = '<div class="td-state">불러오는 중…</div>';
    const d = await window.api.getAugLab().catch(() => null);
    if (!d || !(d.list || []).length) { body.innerHTML = '<div class="td-state">증강 정보를 불러오지 못했습니다 — 인터넷 연결을 확인해 주세요</div>'; return; }
    AL.pool = d.list; AL.patch = d.patch || '';
  }
  alDraw0();
}

function alNewOffer() {
  AL.offer = [null, null, null]; AL.picked = -1;
  for (let i = 0; i < 3; i++) AL.offer[i] = alDraw(alRarity(AL.round), alTaken(i));
  alDraw0(true);
}

// 화면 그리기 — anim: 카드가 뒤집히며 나타남(새로 뽑았을 때만)
function alDraw0(anim, onlyIdx) {
  const body = $('al-body');
  const slots = Array.from({ length: AL_ROUNDS }, (_, i) => {
    const a = AL.picks[i];
    return `<div class="al-slot${a ? ' ' + a.rarity : ''}${i === AL.round && !a && AL.offer ? ' cur' : ''}">${a ? `<img src="${a.icon}" alt="" onerror="this.remove()">` : `<span class="num">${i + 1}</span>`}</div>`;
  }).join('');
  const head = `<div class="al-top"><div class="al-slots">${slots}</div><div class="al-meta">${AL.offer || AL.picks.length ? `<span>최고 선택 <b class="num">${AL.best}</b>/${AL.picks.length}</span>` : ''}<span>다시 뽑기 <b class="num">${AL.rerolls}</b></span></div></div>`;

  if (AL.picks.length >= AL_ROUNDS && !AL.offer) { body.innerHTML = head + alDone(); alBind(); return; }
  if (!AL.offer) {
    body.innerHTML = head + `<div class="al-idle"><div class="al-en">AUGMENT LAB</div><b>롤 아수라장처럼 증강 3장을 뽑아 봅니다</b>`
      + `<p>네 번 고르고, 고를 때마다 세 장의 등급·승률을 공개합니다. 셋 중 가장 좋은 카드를 몇 번 골랐는지 겨뤄 보세요.</p>`
      + `<button class="ui-btn-gold al-go" data-al="start">증강 선택해 보기</button>`
      + `<div class="al-src">패치 ${escH(AL.patch || '-')} · 증강 ${AL.pool.length}개 · 등급·승률 aramgg.com · 등급 확률은 근사치</div></div>`;
    alBind(); return;
  }
  const best = AL.picked >= 0 ? alBestIdx(AL.offer) : -1;
  const cards = AL.offer.map((a, i) => {
    if (!a) return '<div class="al-card empty"></div>';
    const st = AL.picked < 0 ? '' : (i === AL.picked ? ' picked' : ' off');
    const res = AL.picked >= 0 ? `<div class="al-res">${a.t ? `<b class="al-t t${a.t}">T${a.t}</b><span class="num">${(a.wr * 100).toFixed(1)}%</span>` : '<span class="al-nod">등급 자료 없음</span>'}${a.g ? `<small>우리 ${a.g}판 ${a.w}승</small>` : ''}${i === best ? '<em>셋 중 최고</em>' : ''}</div>` : '';
    const fx = anim && (onlyIdx == null || onlyIdx === i) ? ` style="animation-delay:${onlyIdx == null ? i * 0.13 : 0}s" data-fx="1"` : '';
    return `<div class="al-cw${st}"><button class="al-card ${a.rarity}${fx ? ' flip' : ''}"${fx} data-al="pick" data-i="${i}"${AL.picked >= 0 ? ' disabled' : ''}>`
      + `<span class="al-rar">${AL_RNAME[a.rarity]}</span><span class="al-ic"><img src="${a.icon}" alt="" onerror="this.remove()"></span><span class="al-nm">${escH(a.name)}</span></button>`
      + (AL.picked < 0 ? `<button class="al-rr" data-al="reroll" data-i="${i}"${AL.rerolls > 0 ? '' : ' disabled'} title="이 카드만 다시 뽑기">↻ 다시 뽑기</button>` : res) + '</div>';
  }).join('');
  let foot = `<div class="al-q">${AL.round + 1}번째 증강 · 하나를 고르세요</div>`;
  if (AL.picked >= 0) {
    const ok = AL.picked === best;
    foot = `<div class="al-q ${ok ? 'ok' : ''}">${best < 0 ? '세 장 모두 등급 자료가 없습니다' : ok ? '셋 중 가장 좋은 카드를 골랐습니다' : `가장 좋은 카드는 「${escH(AL.offer[best].name)}」였습니다`}</div>`
      + `<button class="ui-btn-gold al-go" data-al="next">${AL.round + 1 >= AL_ROUNDS ? '결과 보기' : `${AL.round + 2}번째 증강 뽑기`}</button>`;
  }
  body.innerHTML = head + `<div class="al-cards">${cards}</div>` + foot;
  alBind();
  if (anim && AL.offer.some((a, i) => a && a.rarity === 'prismatic' && (onlyIdx == null || onlyIdx === i))) alSfx();
}

function alDone() {
  const ts = AL.picks.filter(a => a.t).map(a => a.t), avg = ts.length ? ts.reduce((s, t) => s + t, 0) / ts.length : 0;
  const cnt = r => AL.picks.filter(a => a.rarity === r).length;
  return `<div class="al-done"><div class="al-en">RESULT</div><b>최고 선택 <span class="num">${AL.best}</span> / ${AL_ROUNDS}</b>`
    + `<p>평균 등급 ${avg ? 'T' + avg.toFixed(1) : '-'} · 프리즘 ${cnt('prismatic')} · 골드 ${cnt('gold')} · 실버 ${cnt('silver')}</p>`
    + `<div class="al-list">${AL.picks.map((a, i) => `<div class="al-li"><span class="num">${i + 1}</span><i class="aug ${a.rarity}"><img src="${a.icon}" alt="" onerror="this.remove()"></i><b>${escH(a.name)}</b>${a.t ? `<em class="al-t t${a.t}">T${a.t}</em>` : ''}</div>`).join('')}</div>`
    + `<button class="ui-btn-gold al-go" data-al="again">다시 하기</button></div>`;
}

function alBind() {
  $('al-body').querySelectorAll('[data-al]').forEach(b => b.onclick = () => {
    const k = b.dataset.al, i = +b.dataset.i;
    if (k === 'start') { AL.round = 0; AL.picks = []; AL.best = 0; AL.rerolls = AL_REROLLS; alNewOffer(); }
    else if (k === 'reroll') {
      if (AL.rerolls <= 0 || AL.picked >= 0) return;
      AL.rerolls--; AL.offer[i] = alDraw(alRarity(AL.round), alTaken(i)); alDraw0(true, i);
    } else if (k === 'pick') {
      if (AL.picked >= 0 || !AL.offer[i]) return;
      AL.picked = i; AL.picks.push(AL.offer[i]);
      if (alBestIdx(AL.offer) === i) AL.best++;
      alDraw0(false);
    } else if (k === 'next') {
      AL.round++; AL.offer = null; AL.picked = -1;
      if (AL.picks.length >= AL_ROUNDS) alDraw0(false); else alNewOffer();
    } else if (k === 'again') { AL.round = 0; AL.picks = []; AL.best = 0; AL.rerolls = AL_REROLLS; alNewOffer(); }
  });
}
