// 🧪 증강 뽑아 보기 가운데 창(v0.1.175 → v0.1.209 실제 아수라장 규칙대로 다시 짬)
//   사장님: 정답을 맞히는 곳이 아니라 「증강이 어떻게 떠서 어떤 조합이 되는지」 해 보는 곳 · 뜨는 방식이 실제 게임과 달랐음 → 규칙을 실제대로 · 등급(T)·승률·「셋 중 최고」 채점은 뺌
//   실제 규칙(롤 위키 「ARAM: Mayhem」 · 26.21 패치 노트 · 우리 경기 기록 78판으로 확인 · 2026-11-16):
//    · 선택 화면 = 게임 시작(3레벨) · 7 · 11 · 15레벨 = 4번 · 3장 중 1장 · 세 장은 같은 등급(그 판 모든 사람이 같은 등급) · 등급은 화면마다 무작위(뒤로 갈수록 오르지 않음) · 1·2번째가 둘 다 실버일 수는 없음
//    · 다시 뽑기 = 카드마다 한 번(화면마다 새로) · 한 번 뜬 증강은 그 판에서 다시 안 뜸
//    · 헤드라이너(26.21~ · 판마다 무작위 하나): K/DA = 카드 4장을 모으면 증강 한 번 더 · 커맨드 라인 = 실버·골드만 나오고 화면마다 다시 뽑기 한 번이 한 등급 위로 · 펜타킬 = 게임 시작·18레벨에 스킬 하나 강화
//      나머지(HEARTSTEEL·True Damage·디스코·귀염둥이 카페·꿀벌)는 증강을 고르는 방식과 상관없어 이름·설명만 띄움
//    · 「전환: 골드/프리즘/혼돈」 = 고르면 무작위 증강을 더 얻음(그 증강도 내 증강 칸에)
//   카드 설명 = aramgg 증강 목록의 설명 글(docs/data/aramgg/desc.json · main auglab-pool)
//   ⚠️ 등급 확률은 라이엇 비공개 → 우리 경기 기록 실측(ODDS · 다시 재기 = node tools/aug-flow-report.cjs) · 펜타킬 18레벨 선택지는 추정(아직 안 고른 스킬 + 둠)
//   ⚠️ 효과는 전부 한 번만(무한 애니메이션 금지)
const LV = [3, 7, 11, 15];
const ODDS = [   // [실버, 골드, 프리즘] — 1~4번째 화면 · 우리 경기 기록 78판(2026-10-28 ~ 11-15)에서 그 판 사람들의 n번째 증강 등급
  [0.12, 0.53, 0.36],
  [0.31, 0.51, 0.18],
  [0.19, 0.53, 0.27],
  [0.26, 0.49, 0.25],
];
const ODDS_X = [0.30, 0.65, 0.05];   // K/DA 추가 증강(기록에서 5번째 증강 = 실버·골드가 대부분)
const ODDS_ANY = [0.22, 0.52, 0.26];   // 「전환: 혼돈」의 무작위 증강
const RAR = ['silver', 'gold', 'prismatic'];
const RNAME = { silver: '실버', gold: '골드', prismatic: '프리즘' };
const REN = { silver: 'SILVER', gold: 'GOLD', prismatic: 'PRISMATIC', penta: 'PENTAKILL' };
const UP = { silver: 'gold', gold: 'prismatic' };
const HEAD = [   // 헤드라이너 = 판마다 하나 · info = 증강 고르는 방식은 그대로(표시만)
  { k: 'kda', name: 'K/DA', line: '카드 4장을 모으면 증강을 한 번 더 고릅니다' },
  { k: 'cmd', name: '커맨드 라인', line: '실버·골드 증강만 나오고, 화면마다 다시 뽑기 한 번은 한 등급 위 증강으로 바꿔 줍니다' },
  { k: 'penta', name: '펜타킬', line: '게임 시작과 18레벨에 스킬 하나를 골라 강화합니다' },
  { k: 'heart', name: 'HEARTSTEEL', line: '일부 증강 카드에 추가 효과가 붙어 나옵니다', info: 1 },
  { k: 'true', name: 'True Damage', line: '처치 관여나 포탑 파괴 때 모루가 떨어집니다', info: 1 },
  { k: 'disco', name: '디스코', line: '디스코 볼 아래에서 춤추면 모두가 골드를 얻습니다', info: 1 },
  { k: 'cafe', name: '귀염둥이 카페', line: '체력 유물이 더 강해집니다', info: 1 },
  { k: 'bee', name: '꿀벌', line: '맵을 가로지르는 꿀벌을 피해 꿀단지를 모읍니다', info: 1 },
];
const TRANS = { 1237: ['gold'], 1238: ['prismatic'], 1243: ['any', 'any'] };   // 전환: 골드 · 프리즘 · 혼돈 → 더 얻는 증강의 등급
const PENTA_DESC = '스킬 가속 20 · 이 스킬의 피해·회복·보호막 10% 증가';
const G = { pool: null, penta: [], patch: '', head: null, steps: [], si: 0, seen: null, picks: [], offer: null, rr: null, hack: false, picked: -1, vol: 0.5, tm: 0 };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.2L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.2L20 15"/><path d="M20 20v-5h-5"/></svg>';
const UP_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V5"/><path d="M5 12l7-7 7 7"/></svg>';

function roll(o, only) {   // only = 나올 수 있는 등급만(커맨드 라인 = 실버·골드 · 1·2번째 둘 다 실버 금지)
  const w = RAR.map((r, i) => (!only || only.includes(r) ? o[i] : 0)), sum = w.reduce((a, b) => a + b, 0);
  let x = Math.random() * sum;
  for (let i = 0; i < 3; i++) { if ((x -= w[i]) < 0) return RAR[i]; }
  return 'gold';
}
// 아직 이번 판에 한 번도 안 뜬 증강 하나(실제 규칙: 한 번 뜬 증강은 다시 안 뜸) · 그 등급이 다 떨어지면 다른 등급
function draw(rar) {
  let c = G.pool.filter(a => a.rarity === rar && !G.seen.has(a.id));
  if (!c.length) c = G.pool.filter(a => !G.seen.has(a.id));
  if (!c.length) c = G.pool.slice();
  const a = c[Math.floor(Math.random() * c.length)];
  if (a) G.seen.add(a.id);
  return a || null;
}
function sfx() {
  const v = G.vol * 0.35;
  if (!(v > 0)) return;
  try { const s = new Audio('../assets/sfx/potg-hit.ogg'); s.volume = Math.min(1, v); s.play().catch(() => {}); } catch (_) {}
}

// 새 판 — opt(시험용): {head: 'kda'|'cmd'|…, tiers: ['gold', …]}
function newGame(opt) {
  opt = opt || {};
  clearTimeout(G.tm);
  G.head = HEAD.find(h => h.k === opt.head) || HEAD[Math.floor(Math.random() * HEAD.length)];
  const cmd = G.head.k === 'cmd', only = cmd ? ['silver', 'gold'] : null;
  const t = ODDS.map(o => roll(o, only));
  if (t[0] === 'silver' && t[1] === 'silver') t[1] = roll(ODDS[1], cmd ? ['gold'] : ['gold', 'prismatic']);   // 1·2번째가 둘 다 실버일 수는 없음
  (opt.tiers || []).forEach((x, i) => { if (RAR.includes(x) && i < 4) t[i] = x; });
  G.steps = LV.map((lv, i) => ({ type: 'aug', lv, tier: t[i], label: i ? `${lv}레벨` : '게임 시작 · 3레벨', short: `${lv}레벨` }));
  if (G.head.k === 'penta') { G.steps.splice(1, 0, { type: 'penta', label: '게임 시작 · 펜타킬', short: '시작' }); G.steps.push({ type: 'penta', late: true, label: '18레벨 · 펜타킬', short: '18레벨' }); }
  if (G.head.k === 'kda') G.steps.splice(2 + Math.floor(Math.random() * 3), 0, { type: 'aug', extra: true, tier: roll(ODDS_X), label: 'K/DA 카드 4장', short: 'K/DA' });   // 2번째 화면 뒤 아무 때나(실제는 카드 4장을 모으고 죽은 뒤)
  G.si = 0; G.seen = new Set(); G.picks = [];
  startStep();
}
function startStep() {
  const st = G.steps[G.si];
  G.picked = -1; G.rr = [false, false, false];
  if (st.type === 'penta') {
    const had = new Set(G.picks.filter(p => p.penta).map(p => p.id));
    G.offer = G.penta.filter(p => !had.has(p.id) && (st.late || p.key !== 'R')).slice(0, 4);   // 시작 = Q·W·E(3레벨엔 궁극기가 없음 · 기록에서도 시작 때 둠을 고른 사람 없음) · 18레벨 = 남은 것 + 둠
    G.hack = false;
  } else {
    G.offer = [0, 1, 2].map(() => draw(st.tier));
    G.hack = G.head.k === 'cmd' && !!UP[st.tier];   // 커맨드 라인: 이 화면에서 아직 「한 등급 위」를 안 씀
  }
  render(true);
}
function pick(i) {
  const st = G.steps[G.si], a = G.offer[i];
  if (G.picked >= 0 || !a) return;
  G.picked = i;
  if (st.type === 'penta') G.picks.push({ id: a.id, name: a.name, icon: a.icon, rarity: 'penta', desc: `${a.key} 스킬 강화 · ${PENTA_DESC}`, at: st.short, si: G.si, penta: true });
  else {
    G.picks.push(Object.assign({}, a, { at: st.short, si: G.si }));
    for (const r of TRANS[a.id] || []) { const b = draw(r === 'any' ? roll(ODDS_ANY) : r); if (b) G.picks.push(Object.assign({}, b, { at: a.name, si: G.si, bonus: true })); }   // 전환 = 무작위 증강을 더 얻음
  }
  render(false);
  G.tm = setTimeout(() => { G.si++; if (G.si >= G.steps.length) finish(); else startStep(); }, 1000);   // 실제처럼 고르면 바로 넘어감(다음 레벨)
}
function reroll(i) {
  const st = G.steps[G.si];
  if (G.picked >= 0 || st.type !== 'aug' || G.rr[i]) return;
  G.rr[i] = true;
  if (G.hack) { G.hack = false; G.offer[i] = draw(UP[st.tier]); }   // 커맨드 라인: 한 등급 위 증강으로 · 쓰면 나머지 두 장은 보통 다시 뽑기
  else G.offer[i] = draw(st.tier);
  render(true, i);
}
function finish() {
  G.offer = null;
  try { window.api.auglabDone({ head: G.head.name, picks: G.picks.map(a => ({ id: a.id, name: a.name, icon: a.icon, rarity: a.rarity, at: a.at, bonus: !!a.bonus })) }); } catch (_) {}
  render(false);
}

const descCls = d => (d.length > 128 ? ' xl' : d.length > 92 ? ' long' : '');
function cardHtml(a, i, anim, onlyIdx) {
  if (!a) return '';
  const st = G.steps[G.si], penta = st.type === 'penta';
  const rar = penta ? 'penta' : a.rarity, desc = penta ? `${a.key} 스킬 강화\n${PENTA_DESC}` : (a.desc || '');
  const cls = G.picked < 0 ? '' : (i === G.picked ? ' picked' : ' off');
  const fx = anim && (onlyIdx == null || onlyIdx === i);
  const up = !penta && G.hack && !G.rr[i];
  return `<div class="cw i${i}${cls}"><button class="card ${rar}${fx ? ' flip' : ''}"${fx ? ` style="animation-delay:${onlyIdx == null ? i * 0.14 : 0}s"` : ''} data-k="pick" data-i="${i}"${G.picked >= 0 ? ' disabled' : ''}>`
    + `<span class="card-in"><span class="c-rar">${REN[rar]}</span><span class="c-ic"><img src="${esc(a.icon)}" alt="" onerror="this.remove()"></span><span class="c-nm">${esc(a.name)}</span><span class="c-bar"></span>`
    + `<span class="c-body"><span class="c-desc${descCls(desc)}">${esc(desc).replace(/\n/g, '<br>')}</span></span></span></button>`
    + (G.picked < 0 && !penta ? `<button class="rr${up ? ' up' : ''}" data-k="reroll" data-i="${i}"${G.rr[i] ? ' disabled' : ''} title="${G.rr[i] ? '이 카드는 이미 다시 뽑았습니다' : up ? '한 등급 위 증강으로 바꾸기 · 커맨드 라인 · 화면마다 한 번' : '이 카드만 다시 뽑기 · 카드마다 한 번'}">${up ? UP_SVG + '<b>상위</b>' : RR_SVG}</button>` : '') + '</div>';
}
function slotsHtml() {
  return G.steps.map((st, i) => {
    const mine = G.picks.filter(a => a.si === i);   // 그 화면에서 고른 것 + 전환으로 더 얻은 것
    if (!mine.length) return `<div class="f-slot${i === G.si ? ' cur' : ''}" title="${esc(st.label)}"><small>${esc(st.short)}</small></div>`;
    return mine.map(a => `<div class="f-slot ${a.rarity}" title="${esc(a.name)}${a.bonus ? ' · 전환으로 얻음' : ''}"><img src="${esc(a.icon)}" alt="" onerror="this.remove()"></div>`).join('');
  }).join('');
}
function headHtml() { const h = G.head; return `<span class="lh-k">헤드라이너</span><b>${esc(h.name)}</b><span>${esc(h.line)}${h.info ? ' · 증강 선택은 그대로입니다' : ''}</span>`; }

// 화면 그리기 — anim: 카드가 뒤집히며 나타남(새로 떴을 때만) · onlyIdx: 그 한 장만
function render(anim, onlyIdx) {
  $('lab-state').textContent = '';
  $('lab-src').textContent = `패치 ${G.patch || '-'} · 증강 ${G.pool.length}개 · 실제 아수라장 규칙(3·7·11·15레벨 · 카드마다 다시 뽑기 한 번) · 등급 확률은 우리 경기 기록 기준 · 설명 aramgg.com`;
  $('lab-head').innerHTML = headHtml();
  if (!G.offer) return renderDone();
  const st = G.steps[G.si];
  $('lab-title').innerHTML = st.type === 'penta' ? `${esc(st.label)} · 강화할 스킬` : `${esc(st.label)}${st.extra ? ' · 증강 한 번 더' : ' 증강'} · <i class="${st.tier}">${RNAME[st.tier]}</i>`;
  $('lab-cards').className = 'lab-cards n' + G.offer.length;
  $('lab-cards').innerHTML = G.offer.map((a, i) => cardHtml(a, i, anim, onlyIdx)).join('');
  $('lab-foot').innerHTML = `<div class="f-row"><span class="f-lab">내 증강</span><div class="f-slots">${slotsHtml()}</div></div>`;
  bind();
  if (anim && st.type === 'aug' && G.offer.some((a, i) => a && a.rarity === 'prismatic' && (onlyIdx == null || onlyIdx === i))) sfx();
}
function renderDone() {
  const cnt = r => G.picks.filter(a => a.rarity === r).length;
  $('lab-title').textContent = '이번 판 증강';
  $('lab-foot').innerHTML = '';
  $('lab-cards').className = 'lab-cards';
  $('lab-cards').innerHTML = `<div class="done"><span class="lab-en">MY AUGMENTS</span>`
    + `<p>프리즘 ${cnt('prismatic')} · 골드 ${cnt('gold')} · 실버 ${cnt('silver')}${cnt('penta') ? ` · 스킬 강화 ${cnt('penta')}` : ''}</p>`
    + `<div class="d-list">${G.picks.map(a => `<div class="d-li"><i class="${a.rarity}"><img src="${esc(a.icon)}" alt="" onerror="this.remove()"></i><span class="d-tx"><b>${esc(a.name)}<small>${esc(a.bonus ? '전환으로 얻음' : a.at)}</small></b><span>${esc(a.desc || '').replace(/\n/g, ' ')}</span></span></div>`).join('')}</div>`
    + `<div class="d-btns"><button class="ui-btn-ghost" data-k="close">닫기</button><button class="ui-btn-gold" data-k="again">다시 하기</button></div></div>`;
  bind();
}

function bind() {
  document.querySelectorAll('#lab [data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k, i = +b.dataset.i;
    if (k === 'reroll') reroll(i);
    else if (k === 'pick') pick(i);
    else if (k === 'again') newGame();
    else if (k === 'close') window.api.auglabClose();
  });
}

$('lab-x').onclick = () => window.api.auglabClose();
document.addEventListener('keydown', e => { if (e.key === 'Escape') window.api.auglabClose(); });
if (window.api.onAuglabStart) window.api.onAuglabStart(() => { if (G.pool) newGame(); });   // 오른쪽 창에서 다시 누르면 새 판
function load(d, opt) {
  G.pool = d.list; G.patch = d.patch || '';
  G.penta = (d.penta || []).length ? d.penta : [{ id: 3170, name: '헤비', key: 'Q', icon: '' }, { id: 3171, name: '파워', key: 'W', icon: '' }, { id: 3172, name: '스래시', key: 'E', icon: '' }, { id: 3173, name: '둠', key: 'R', icon: '' }];
  newGame(opt);
}
window.__labLoad = load;   // 화면 검사용(tools/ui-scenes-auglab.cjs) — 증강 목록을 넣고 헤드라이너·등급을 정해 새 판
window.__labNew = o => { if (G.pool) newGame(o); };   // 화면 검사용 — 같은 증강 목록으로 헤드라이너·등급만 정해 새 판
window.__labPick = i => pick(i); window.__labReroll = i => reroll(i);
(async () => {
  try { const S = await window.api.getSettings(); G.vol = S && S.sfxOn === false ? 0 : (S && typeof S.sfxVol === 'number' ? S.sfxVol : 1) * 0.5; } catch (_) {}
  const d = await window.api.getAugLab().catch(() => null);
  if (!d || !(d.list || []).length) { $('lab-state').textContent = '증강 정보를 불러오지 못했습니다 — 인터넷 연결을 확인해 주세요'; return; }
  load(d);
})();
