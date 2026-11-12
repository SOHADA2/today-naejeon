// 🧪 증강 연구 가운데 창(v0.1.175 · 사장님: 오른쪽 창이 아니라 가운데에서 진짜 아수라장처럼 카드 3장이 뜨게)
//   한 판 = 증강 4번 고르기 · 매번 3장 모두 같은 등급(v0.1.173 · 판이 갈수록 높은 등급이 잘 나옴) · 다시 뽑기 2번(카드 한 장씩 · 같은 등급 안에서)
//   고르면 세 장의 연구 결과(aramgg T1~T5·승률·우리 기록) 공개 → 4번 끝나면 「최고 선택 n/4」 · 결과는 오른쪽 창 「연구」 탭에도 남김(auglabDone)
//   ⚠️ 등급 확률은 라이엇이 공개하지 않아 근사치(ODDS) · 효과는 전부 한 번만(무한 애니메이션 금지)
const ODDS = [   // [실버, 골드, 프리즘] — 1~4번째 고르기
  [0.55, 0.35, 0.10],
  [0.35, 0.45, 0.20],
  [0.20, 0.45, 0.35],
  [0.10, 0.40, 0.50],
];
const RAR = ['silver', 'gold', 'prismatic'];
const RNAME = { silver: '실버', gold: '골드', prismatic: '프리즘' };
const REN = { silver: 'SILVER', gold: 'GOLD', prismatic: 'PRISMATIC' };
const REROLLS = 2, ROUNDS = 4;
const G = { pool: null, patch: '', rar: null, round: 0, picks: [], best: 0, rerolls: REROLLS, offer: null, picked: -1, vol: 0.5 };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.2L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.2L20 15"/><path d="M20 20v-5h-5"/></svg>';

function rarity(round) {
  const o = ODDS[Math.min(round, ODDS.length - 1)];
  let r = Math.random();
  for (let i = 0; i < 3; i++) { if ((r -= o[i]) < 0) return RAR[i]; }
  return 'gold';
}
// 아직 안 나온 증강 하나(이번 판에 고른 것·지금 떠 있는 카드는 빼고) · 그 등급이 다 떨어지면 다른 등급
function draw(rar, taken) {
  let c = G.pool.filter(a => a.rarity === rar && !taken.has(a.id));
  if (!c.length) c = G.pool.filter(a => !taken.has(a.id));
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}
function taken(skip) {
  const s = new Set(G.picks.map(a => a.id));
  (G.offer || []).forEach((a, i) => { if (a && i !== skip) s.add(a.id); });
  return s;
}
// 셋 중 가장 좋은 카드 = aramgg 등급이 낮을수록(T1 최고) → 같으면 승률 · 등급 자료가 없는 카드는 뒤로
function bestIdx(offer) {
  let bi = -1, bs = -1;
  offer.forEach((a, i) => { const s = a && a.t ? (6 - a.t) * 10 + a.wr : 0; if (s > bs) { bs = s; bi = i; } });
  return bs > 0 ? bi : -1;
}
function sfx() {
  const v = G.vol * 0.35;
  if (!(v > 0)) return;
  try { const s = new Audio('../assets/sfx/potg-hit.ogg'); s.volume = Math.min(1, v); s.play().catch(() => {}); } catch (_) {}
}

function newGame() { G.round = 0; G.picks = []; G.best = 0; G.rerolls = REROLLS; newOffer(); }
function newOffer() {
  G.offer = [null, null, null]; G.picked = -1; G.rar = rarity(G.round);
  for (let i = 0; i < 3; i++) G.offer[i] = draw(G.rar, taken(i));
  render(true);
}

function cardHtml(a, i, anim, onlyIdx, best) {
  if (!a) return '';
  const st = G.picked < 0 ? '' : (i === G.picked ? ' picked' : ' off');
  const fx = anim && (onlyIdx == null || onlyIdx === i);
  const body = G.picked < 0 ? '<span class="c-hint">고르면 등급·승률을<br>공개합니다</span>'
    : `<span class="c-res">${a.t ? `<b class="c-t t${a.t}">T${a.t}</b><span class="c-wr">승률 <b>${(a.wr * 100).toFixed(1)}%</b></span>` : '<span class="c-nod">등급 자료 없음</span>'}${a.g ? `<span class="c-our">우리 ${a.g}판 ${a.w}승</span>` : ''}${i === best ? '<span class="c-best">셋 중 최고</span>' : ''}</span>`;
  return `<div class="cw i${i}${st}"><button class="card ${a.rarity}${fx ? ' flip' : ''}"${fx ? ` style="animation-delay:${onlyIdx == null ? i * 0.14 : 0}s"` : ''} data-k="pick" data-i="${i}"${G.picked >= 0 ? ' disabled' : ''}>`
    + `<span class="card-in"><span class="c-rar">${REN[a.rarity]}</span><span class="c-ic"><img src="${esc(a.icon)}" alt="" onerror="this.remove()"></span><span class="c-nm">${esc(a.name)}</span><span class="c-bar"></span><span class="c-body">${body}</span></span></button>`
    + (G.picked < 0 ? `<button class="rr" data-k="reroll" data-i="${i}"${G.rerolls > 0 ? '' : ' disabled'} title="이 카드만 다시 뽑기 · ${G.rerolls}번 남음">${RR_SVG}<b>${G.rerolls}</b></button>` : '') + '</div>';
}
function slotsHtml() {
  return Array.from({ length: ROUNDS }, (_, i) => {
    const a = G.picks[i];
    return `<div class="f-slot${a ? ' ' + a.rarity : ''}${i === G.picks.length && G.offer && G.picked < 0 ? ' cur' : ''}"${a ? ` title="${esc(a.name)}"` : ''}>${a ? `<img src="${esc(a.icon)}" alt="" onerror="this.remove()">` : i + 1}</div>`;
  }).join('');
}

// 화면 그리기 — anim: 카드가 뒤집히며 나타남(새로 뽑았을 때만) · onlyIdx: 그 한 장만
function render(anim, onlyIdx) {
  $('lab-state').textContent = '';
  $('lab-src').textContent = `패치 ${G.patch || '-'} · 증강 ${G.pool.length}개 · 등급·승률 aramgg.com · 등급 확률은 근사치`;
  if (!G.offer) return renderDone();
  const best = G.picked >= 0 ? bestIdx(G.offer) : -1;
  $('lab-title').innerHTML = `${G.round + 1}번째 증강 · <i class="${G.rar}">${RNAME[G.rar]}</i>`;
  $('lab-cards').innerHTML = G.offer.map((a, i) => cardHtml(a, i, anim, onlyIdx, best)).join('');
  let foot = `<div class="f-row"><div class="f-slots">${slotsHtml()}</div><span class="f-meta">최고 선택 <b>${G.best}</b>/${G.picks.length}</span></div>`;
  if (G.picked >= 0) {
    const ok = G.picked === best;
    foot += `<div class="f-msg${ok ? ' ok' : ''}">${best < 0 ? '세 장 모두 등급 자료가 없습니다' : ok ? '셋 중 가장 좋은 카드를 골랐습니다' : `가장 좋은 카드는 「${esc(G.offer[best].name)}」였습니다`}</div>`
      + `<button class="ui-btn-gold f-go" data-k="next">${G.round + 1 >= ROUNDS ? '결과 보기' : `${G.round + 2}번째 증강 뽑기`}</button>`;
  }
  $('lab-foot').innerHTML = foot;
  bind();
  if (anim && G.offer.some((a, i) => a && a.rarity === 'prismatic' && (onlyIdx == null || onlyIdx === i))) sfx();
}
function renderDone() {
  const ts = G.picks.filter(a => a.t).map(a => a.t), avg = ts.length ? ts.reduce((s, t) => s + t, 0) / ts.length : 0;
  const cnt = r => G.picks.filter(a => a.rarity === r).length;
  $('lab-title').textContent = '연구 결과';
  $('lab-foot').innerHTML = '';
  $('lab-cards').innerHTML = `<div class="done"><span class="lab-en">RESULT</span><b>최고 선택 <span class="num">${G.best}</span> / ${ROUNDS}</b>`
    + `<p>평균 등급 ${avg ? 'T' + avg.toFixed(1) : '-'} · 프리즘 ${cnt('prismatic')} · 골드 ${cnt('gold')} · 실버 ${cnt('silver')}</p>`
    + `<div class="d-list">${G.picks.map((a, i) => `<div class="d-li"><span class="num">${i + 1}</span><i class="${a.rarity}"><img src="${esc(a.icon)}" alt="" onerror="this.remove()"></i><b>${esc(a.name)}</b>${a.best ? '<em>최고</em>' : ''}${a.t ? `<span class="c-t t${a.t}">T${a.t}</span>` : ''}</div>`).join('')}</div>`
    + `<div class="d-btns"><button class="ui-btn-ghost" data-k="close">닫기</button><button class="ui-btn-gold" data-k="again">다시 하기</button></div></div>`;
  bind();
}

function bind() {
  document.querySelectorAll('#lab [data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k, i = +b.dataset.i;
    if (k === 'reroll') {
      if (G.rerolls <= 0 || G.picked >= 0) return;
      G.rerolls--; G.offer[i] = draw(G.rar, taken(i)); render(true, i);
    } else if (k === 'pick') {
      if (G.picked >= 0 || !G.offer[i]) return;
      const isBest = bestIdx(G.offer) === i;
      G.picked = i; G.picks.push(Object.assign({}, G.offer[i], { best: isBest }));
      if (isBest) G.best++;
      render(false);
    } else if (k === 'next') {
      G.round++; G.offer = null; G.picked = -1;
      if (G.picks.length >= ROUNDS) {
        try { window.api.auglabDone({ best: G.best, rounds: ROUNDS, picks: G.picks.map(a => ({ id: a.id, name: a.name, icon: a.icon, rarity: a.rarity, t: a.t, best: !!a.best })) }); } catch (_) {}
        render(false);
      } else newOffer();
    } else if (k === 'again') newGame();
    else if (k === 'close') window.api.auglabClose();
  });
}

$('lab-x').onclick = () => window.api.auglabClose();
document.addEventListener('keydown', e => { if (e.key === 'Escape') window.api.auglabClose(); });
if (window.api.onAuglabStart) window.api.onAuglabStart(() => { if (G.pool) newGame(); });   // 오른쪽 창에서 다시 누르면 새 판
(async () => {
  try { const S = await window.api.getSettings(); G.vol = S && S.sfxOn === false ? 0 : (S && typeof S.sfxVol === 'number' ? S.sfxVol : 1) * 0.5; } catch (_) {}
  const d = await window.api.getAugLab().catch(() => null);
  if (!d || !(d.list || []).length) { $('lab-state').textContent = '증강 정보를 불러오지 못했습니다 — 인터넷 연결을 확인해 주세요'; return; }
  G.pool = d.list; G.patch = d.patch || '';
  newGame();
})();
