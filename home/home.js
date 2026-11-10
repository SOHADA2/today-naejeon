// 🏠 홈 화면(v0.1.127) — 롤 클라 없이 투데이 내전만 켰을 때 한 창 · 게스트는 보기만 · 게임 시작 때는 로고만
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _last = '';

function render(d) {
  if (!d) return;
  const sig = JSON.stringify(d); if (sig === _last) return; _last = sig;   // 같은 내용이면 다시 안 그림
  document.body.classList.toggle('logo', d.mode === 'logo');
  $('h-ver').textContent = d.ver ? 'v' + d.ver : '';
  // 나
  const me = $('me');
  me.classList.toggle('guest', !d.me);
  me.innerHTML = d.me
    ? `<i class="dot"></i><span><b>${esc(d.me.name)}</b> <span class="tag">#${esc(d.me.tag)}</span></span><span class="st">${d.room ? `「${esc(d.room.name)}」에 들어가 있음` : '롤 클라이언트가 내려가 있습니다'}</span>`
    : `<i class="dot"></i><span><b>게스트</b></span><span class="st">롤에 로그인하면 그 계정으로 바뀝니다</span>`;
  // 방 목록
  const rooms = d.rooms || [];
  $('rooms-n').textContent = rooms.length ? rooms.length : '';
  $('rooms').innerHTML = !d.ready ? `<div class="empty">방 목록을 불러오는 중입니다</div>`
    : rooms.length ? rooms.map(r => `<div class="rm${r.mine ? ' mine' : ''}">
        <div class="rm-top"><span class="rm-nm">${esc(r.name)}</span>${r.mine ? '<span class="rm-tag me">내 방</span>' : ''}${r.priv ? '<span class="rm-tag">비공개</span>' : ''}<span class="rm-n"><b>${r.n}</b>/10</span></div>
        <div class="rm-mem">${(r.members || []).length ? (r.members || []).map(m => `<span>${esc(m)}</span>`).join(' · ') : '아직 아무도 없습니다'}</div>
      </div>`).join('')
    : `<div class="empty">아직 만들어진 방이 없습니다</div>`;
  // 접속 중(앱 켠 사람 전체)
  const on = d.online || [];
  $('online-n').textContent = on.length;
  $('online').innerHTML = on.map(p => `<div class="on${p.guest ? ' guest' : ''}"><i class="dot"></i>
      <span class="nm">${esc(p.name)}${p.tag ? `<small>#${esc(p.tag)}</small>` : ''}</span>
      ${p.me ? '<span class="me-tag">나</span>' : `<span class="where">${p.room ? esc(p.room) : (p.guest ? '' : '방 밖')}</span>`}
    </div>`).join('');
  // 아래 줄
  $('foot').innerHTML = d.me
    ? `<span>롤 클라이언트를 켜면 창이 좌우로 붙습니다.</span><button class="ui-btn-ghost" id="f-panels">대기실 창 열기</button>`
    : `<span>게스트는 보기만 할 수 있습니다. 롤 클라이언트를 켜고 로그인하면 방에 들어갈 수 있습니다.</span>`;
  const fp = $('f-panels'); if (fp) fp.onclick = () => window.api.homePanels();
}

// ✨ v0.1.160 게임 시작 로고(사장님: 더 멋있게 · 영문 TODAY IN-HOUSE · 효과음) — 전부 한 번만
//   0초 팀 색 빛(왼쪽 파랑·오른쪽 빨강) + 이음선 위아래로 빛이 달림 → 0.45초 「쾅」 = 섬광·충격파 고리·금빛 불티·살짝 흔들림·팀 빛이 가운데 금빛으로
//   → 로고가 피어남 → 0.8초 「TODAY IN-HOUSE」 밀려 들어오며 금빛이 스침 → 「투데이 내전」 → 「GAME START」 · 소리 = ⚙ 효과음 켜기·크기
let _vol = 1;
const setVol = s => { if (s) _vol = s.sfxOn === false ? 0 : (typeof s.sfxVol === 'number' ? s.sfxVol : 1); };
if (window.api.getSettings) window.api.getSettings().then(setVol).catch(() => {});
if (window.api.onSettings) window.api.onSettings(setVol);
function slamSound() {
  if (_vol <= 0) return;
  try {
    const a = new Audio('../assets/sfx/potg-slam.ogg'); a.volume = Math.min(1, 0.45 * _vol); a.play().catch(() => {});
    setTimeout(() => { const v0 = a.volume, t0 = performance.now(); const f = () => { const k = (performance.now() - t0) / 600; a.volume = Math.max(0, v0 * (1 - k)); if (k < 1) requestAnimationFrame(f); else a.pause(); }; f(); }, 900);   // 긴 꼬리는 0.9초 뒤 0.6초에 걸쳐 줄임
  } catch (_) {}
}
function sparks(cv) {   // 금빛 불티 — 가운데에서 튀었다 떨어지며 사라짐(약 1초 · 한 번)
  if (!cv) return;
  const W = cv.width = cv.clientWidth, H = cv.height = cv.clientHeight, x = cv.getContext('2d'), cx = W / 2, cy = H * 0.42, ps = [];
  for (let i = 0; i < 46; i++) { const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9; ps.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, l: 0.55 + Math.random() * 0.45, r: 1 + Math.random() * 2 }); }
  const t0 = performance.now();
  const step = () => {
    const t = (performance.now() - t0) / 1000; x.clearRect(0, 0, W, H); if (t > 1) return;
    for (const p of ps) { const k = t / p.l; if (k >= 1) continue; const px = p.x + p.vx * t * 60, py = p.y + p.vy * t * 60 + 120 * t * t;
      x.globalAlpha = 1 - k; x.fillStyle = k < 0.3 ? '#fff6d8' : '#f0d79a'; x.beginPath(); x.arc(px, py, p.r * (1 - k * 0.5), 0, Math.PI * 2); x.fill(); }
    requestAnimationFrame(step);
  };
  step();
}
function logoFx(E, pop) {
  const q = s => document.querySelector(s), A = (el, kf, o) => el && el.animate(kf, Object.assign({ fill: 'both' }, o));
  for (const el of document.querySelectorAll('#lfx i, #hero .mk, .lg-en, .tt h1, #go, .seam, body')) el.getAnimations().forEach(a => a.cancel());
  const HIT = 450;
  A(q('.lg-glow.l'), [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none', offset: 0.55 }, { opacity: 0, transform: 'translateX(120px)' }], { duration: HIT + 450, easing: 'ease-out' });
  A(q('.lg-glow.r'), [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none', offset: 0.55 }, { opacity: 0, transform: 'translateX(-120px)' }], { duration: HIT + 450, easing: 'ease-out' });
  A(q('.lg-gold'), [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.55 }], { duration: 900, delay: HIT - 60, easing: 'ease-out' });
  A(q('.seam'), [{ opacity: 0.9, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)', offset: 0.6 }, { opacity: 0, transform: 'scaleY(1)' }], { duration: HIT + 320, easing: 'cubic-bezier(.4,0,.2,1)' });
  A(q('.lg-run.up'), [{ opacity: 0, transform: 'translateY(-50%) scaleY(.2)' }, { opacity: 1, transform: 'translateY(-110%) scaleY(1)', offset: 0.45 }, { opacity: 0, transform: 'translateY(-160%) scaleY(.6)' }], { duration: HIT, easing: 'ease-in' });   // 빛이 위로 달림
  A(q('.lg-run.dn'), [{ opacity: 0, transform: 'translateY(-50%) scaleY(.2)' }, { opacity: 1, transform: 'translateY(10%) scaleY(1)', offset: 0.45 }, { opacity: 0, transform: 'translateY(60%) scaleY(.6)' }], { duration: HIT, easing: 'ease-in' });       // 아래로
  A(q('.lg-flash'), [{ opacity: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0 }], { duration: 420, delay: HIT, easing: 'ease-out' });
  A(q('.lg-ring'), [{ opacity: 0.9, transform: 'scale(.2)' }, { opacity: 0, transform: 'scale(2.6)' }], { duration: 650, delay: HIT, easing: 'cubic-bezier(.2,.8,.2,1)' });
  A(document.body, [{ transform: 'none' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(2px,1px)' }, { transform: 'none' }], { duration: 160, delay: HIT, fill: 'none' });
  setTimeout(() => { sparks(document.getElementById('lg-sp')); slamSound(); }, HIT);
  A($('hero').querySelector('.mk'), [{ opacity: 0, transform: 'scale(.6)', filter: 'brightness(2)' }, { opacity: 1, transform: 'scale(1.08)', filter: 'brightness(1.4)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 520, delay: HIT - 40, easing: E });
  A(q('.lg-en'), [{ opacity: 0, transform: 'skewX(-9deg) translateX(-50px)' }, { opacity: 1, transform: 'skewX(-9deg) translateX(0)' }], { duration: 400, delay: 800, easing: E });
  A(q('.lg-en'), [{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }], { duration: 700, delay: 1000, easing: 'ease-out' });   // 금빛이 왼쪽→오른쪽으로 스침
  pop(q('.tt h1'), 1000, 6); pop($('go'), 1150, 4);
}
// 처음 나타날 때·게임 시작 로고 = 한 번만 움직임(무한 애니메이션 없음)
function intro(mode) {
  const E = 'cubic-bezier(.2,.8,.2,1)';
  const pop = (el, d, dy) => el && el.animate([{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: d, easing: E, fill: 'both' });
  if (mode === 'logo') { logoFx(E, pop); return; }
  if (false) {   // (예전 로고 — v0.1.160 logoFx로 바뀜)
    document.querySelector('.seam').animate([{ opacity: .9, transform: 'scaleY(0)' }, { opacity: .9, transform: 'scaleY(1)', offset: .45 }, { opacity: 0, transform: 'scaleY(1)' }], { duration: 760, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    $('hero').querySelector('.mk').animate([{ opacity: 0, transform: 'scale(.6)', filter: 'brightness(1.6)' }, { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 560, delay: 260, easing: E, fill: 'both' });
    pop(document.querySelector('.tt'), 420, 10); pop($('go'), 560, 6);
    return;
  }
  $('hero').querySelector('.mk').animate([{ opacity: 0, transform: 'rotate(-30deg) scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: E, fill: 'both' });
  pop(document.querySelector('.tt'), 80, 10); pop($('me'), 200, 10); pop($('c-rooms'), 280, 14); pop($('c-online'), 360, 14); pop($('foot'), 440, 6);
}

$('h-min').onclick = () => window.api.homeMin();
$('h-close').onclick = () => window.api.homeClose();
window.api.onHome(render);
window.api.onHomeIntro(intro);
window.api.getHome().then(render);
