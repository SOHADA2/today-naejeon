// 🏠 홈 화면(v0.1.127) — 롤 클라 없이 투데이 내전만 켰을 때 한 창 · 게스트는 보기만 · 게임 시작 때는 로고만
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _last = '';

function render(d) {
  if (!d) return;
  const sig = JSON.stringify(d); if (sig === _last) return; _last = sig;   // 같은 내용이면 다시 안 그림
  document.body.classList.toggle('logo', d.mode === 'logo');
  if (d.mode !== 'logo') stopLogoVideo();
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

// 🎬 v0.1.155 게임 시작 로고 영상 — 문이 맞닿은 이음선에서 시작(드리미나) · 소리 = ⚙ 효과음 켜기·크기 · 글자는 테가 완성되는 3.1초에
let _vol = 1;
function setVol(s) { if (s) _vol = s.sfxOn === false ? 0 : (typeof s.sfxVol === 'number' ? s.sfxVol : 1); }
if (window.api.getSettings) window.api.getSettings().then(setVol).catch(() => {});
if (window.api.onSettings) window.api.onSettings(setVol);
function stopLogoVideo() { const v = $('lv-v'); if (v) try { v.pause(); } catch (_) {} document.body.classList.remove('vid'); FX.stop(); }
// ⏩ v0.1.156(사장님: 조금 느림 · 연기 같은 효과 더) — 1.3배속(소리 음높이 그대로) · 글자는 테가 완성되는 영상 3.05초에 맞춰 · 효과는 영상 시각을 보고 터짐
const LV_RATE = 1.3, LV_HIT = 1.08, LV_RING = 3.05;   // 영상 속 시각(초): 보석이 이음선에서 부딪힘 · 금 테가 다 맞물림
function playLogoVideo() {
  const v = $('lv-v'); if (!v) return false;
  document.body.classList.add('vid');
  const E = 'cubic-bezier(.2,.8,.2,1)', tt = document.querySelector('.lv-tt'), en = document.querySelector('.lv-en'), ko = document.querySelector('.lv-ko');
  for (const el of [tt, en, ko]) el.getAnimations().forEach(a => a.cancel());
  const tR = Math.round(LV_RING / LV_RATE * 1000);
  tt.animate([{ opacity: 0, transform: 'translateX(-50px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: tR, easing: E, fill: 'both' });
  en.animate([{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }], { duration: 650, delay: tR + 180, easing: 'ease-out', fill: 'both' });   // 금빛이 왼쪽→오른쪽으로 스침
  ko.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: tR + 340, easing: E, fill: 'both' });
  try { v.currentTime = 0; } catch (_) {}
  v.playbackRate = LV_RATE; v.preservesPitch = true;
  FX.start(v);
  v.volume = Math.max(0, Math.min(1, 0.8 * _vol)); v.muted = _vol <= 0;
  const p = v.play();
  if (p && p.catch) p.catch(() => { stopLogoVideo(); introLegacy('logo'); });   // 재생 못 하면 예전 로고
  return true;
}
// 💨 연기·불티(v0.1.156) — canvas 한 장 · 영상이 부딪힘(LV_HIT)·테 완성(LV_RING)을 지나는 순간 터뜨림 · 입자가 다 사라지면 그리기 멈춤(무한 애니메이션 없음)
//   연기 = 뭉게 그림(흐린 원 여러 개를 뭉쳐 미리 그림)을 색만 바꿔 씀 · 왼쪽 파랑 · 오른쪽 빨강 · 가운데 금빛 · 아래 깔리는 낮은 연기
const FX = (() => {
  let cv, c, W = 0, H = 0, ps = [], raf = 0, last = 0, vid = null, fired = {}, spr = null;
  const R = (a, b) => a + Math.random() * (b - a);
  function puff(tint) {
    const s = document.createElement('canvas'); s.width = s.height = 160; const g = s.getContext('2d');
    g.filter = 'blur(3px)';   // 작은 뭉치를 많이 · 덜 흐리게 = 둥근 덩어리 말고 결이 있는 연기
    for (let i = 0; i < 70; i++) {
      const a = R(0, 6.283), r = Math.sqrt(Math.random()) * 46, x = 80 + Math.cos(a) * r, y = 80 + Math.sin(a) * r * 0.7, rr = R(6, 20) * (1 - r / 70);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(255,255,255,${R(0.06, 0.16).toFixed(2)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
    }
    g.filter = 'none'; g.globalCompositeOperation = 'source-in'; g.fillStyle = tint; g.fillRect(0, 0, 160, 160);
    return s;
  }
  function sprites() {
    if (spr) return spr;
    spr = { n: [puff('rgb(160,168,186)'), puff('rgb(146,152,170)'), puff('rgb(170,174,186)')], b: [puff('rgb(112,146,232)'), puff('rgb(130,160,230)')], r: [puff('rgb(228,112,108)'), puff('rgb(226,134,120)')], w: [puff('rgb(236,198,138)')] };
    return spr;
  }
  // 영상(720×720 · cover · 아래 맞춤) 속 엠블럼 자리 → 창 좌표
  function geo() { const S = Math.max(W / 720, H / 720) * 720; return { cx: W / 2, cy: (H - S) + 0.43 * S, S }; }
  function smoke(x, y, vx, vy, size, life, alpha, kind) { const a = sprites()[kind]; ps.push({ t: 's', x, y, vx, vy, s: size, gr: R(0.55, 1.1) * size, rot: R(0, 6.283), vr: R(-0.5, 0.5), life, age: 0, a: alpha, img: a[(Math.random() * a.length) | 0] }); }
  function spark(x, y, sp, life) { const a = R(0, 6.283), v = R(sp * 0.35, sp); ps.push({ t: 'k', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.75 - R(0, 120), life, age: 0, w: R(1, 2.2) }); }
  function hit() {
    const { cx, cy, S } = geo(), k = S / 720;
    for (let i = 0; i < 44; i++) {   // 이음선에서 양옆으로 확 퍼지는 연기(왼쪽 파랑 기운 · 오른쪽 빨강 기운 · 처음 몇 개는 섬광에 비친 금빛) — 가운데 엠블럼 자리는 그릴 때 비움(clear)
      const side = i % 2 ? 1 : -1, a = (side < 0 ? Math.PI : 0) + R(-0.5, 0.5), sp = R(260, 620) * k;
      const kind = i < 6 ? 'w' : Math.random() < 0.45 ? (side < 0 ? 'b' : 'r') : 'n';
      smoke(cx + side * R(0, 30) * k, cy + R(-0.32, 0.36) * S, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - R(10, 50) * k, R(64, 124) * k, R(1.7, 2.8), R(0.8, 1), kind);
    }
    for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1; smoke(cx + side * R(60, 300) * k, H - R(0, 60) * k, side * R(40, 110) * k, R(-6, 2) * k, R(130, 200) * k, R(2.4, 3.4), R(0.38, 0.55), 'n'); }   // 바닥에 옅게 깔리는 연기
    for (let i = 0; i < 46; i++) spark(cx, cy, 720 * k, R(0.45, 1.15));
    shake(5 * k, 320);
  }
  function ring() {
    const { cx, cy, S } = geo(), k = S / 720, rr = 0.24 * S;
    for (let j = 0; j < 6; j++) { const a = -Math.PI / 2 + j * Math.PI / 3; for (let i = 0; i < 2; i++) smoke(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.cos(a) * R(60, 140) * k, Math.sin(a) * R(60, 140) * k - R(10, 30) * k, R(32, 54) * k, R(0.9, 1.4), R(0.6, 0.8), 'n'); }   // 테가 맞물린 모서리에서 작은 연기
    for (let i = 0; i < 14; i++) spark(cx + R(-rr, rr), cy + R(-rr, rr), 260 * k, R(0.3, 0.7));
    shake(2.5 * k, 200);
  }
  function shake(px, ms) {
    const el = $('lv'); if (!el) return;
    el.getAnimations().forEach(a => a.cancel());
    const f = []; for (let i = 0; i <= 8; i++) { const d = px * (1 - i / 8); f.push({ transform: i === 8 ? 'none' : `translate(${R(-d, d).toFixed(1)}px, ${R(-d, d).toFixed(1)}px)` }); }
    el.animate(f, { duration: ms, easing: 'linear' });
  }
  function size() {
    const dpr = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (vid) { const t = vid.currentTime; if (!fired.hit && t >= LV_HIT) { fired.hit = 1; hit(); } if (!fired.ring && t >= LV_RING) { fired.ring = 1; ring(); } }
    c.clearRect(0, 0, W, H);
    for (const p of ps) {   // ① 연기
      if (p.t !== 's') continue;
      p.age += dt; const u = p.age / p.life; if (u >= 1) continue;
      const dr = Math.exp(-2.2 * dt); p.vx *= dr; p.vy = p.vy * dr - 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.gr * dt; p.rot += p.vr * dt;
      const al = p.a * (u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9) ** 1.4;
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.max(0, al);
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.drawImage(p.img, -p.s, -p.s, p.s * 2, p.s * 2); c.restore();
    }
    // ② 엠블럼 자리는 연기를 걷어냄(로고가 흐려지지 않게) — 가운데 투명 → 바깥으로 갈수록 그대로
    if (ps.length) { const { cx, cy, S } = geo(), r0 = 0.17 * S, r1 = 0.3 * S, gr = c.createRadialGradient(cx, cy, r0, cx, cy, r1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 1; c.globalCompositeOperation = 'destination-out'; c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r1, 0, 6.283); c.fill(); }
    for (const p of ps) {   // ③ 불티(가운데에서도 보이게 걷어낸 뒤에)
      if (p.t !== 'k') continue;
      p.age += dt; const u = p.age / p.life; if (u >= 1) continue;
      p.vy += 420 * dt; p.vx *= Math.exp(-0.8 * dt); const ox = p.x, oy = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, 1 - u);
      c.strokeStyle = u < 0.4 ? '#fff4d6' : '#f2b660'; c.lineWidth = p.w; c.beginPath(); c.moveTo(ox - p.vx * 0.018, oy - p.vy * 0.018); c.lineTo(p.x, p.y); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    ps = ps.filter(p => p.age < p.life);
    const done = fired.ring && !ps.length;
    if (done || (vid && (vid.ended || vid.paused) && !ps.length && fired.hit)) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }
  function start(v) {
    cv = cv || $('lv-fx'); if (!cv) return; c = c || cv.getContext('2d');
    stop(); vid = v; fired = {}; ps = []; size(); sprites();
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; ps = []; if (c) c.clearRect(0, 0, W, H); }
  return { start, stop };
})();
function intro(mode) {
  if (mode === 'logo') { if (playLogoVideo()) return; } else stopLogoVideo();
  introLegacy(mode);
}
// 처음 나타날 때·게임 시작 로고(예전 · 영상이 안 될 때) = 한 번만 움직임(무한 애니메이션 없음)
function introLegacy(mode) {
  const E = 'cubic-bezier(.2,.8,.2,1)';
  const pop = (el, d, dy) => el && el.animate([{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: d, easing: E, fill: 'both' });
  if (mode === 'logo') {   // 문이 맞닿은 가운데 이음선이 위아래로 그어짐 → 선이 옅어지며 그 자리에서 로고가 피어남
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
