// 🎬 팟지 창(렌더러) — 메인이 'potg' {card, manual, myName}을 보내면: 소개 3초 → 장면(영상 있으면 영상, 없으면 킬 타임라인) → 저장/다시 보기/닫기
// 모두 같은 시각(card.showAt)에 시작 · 효과는 전부 한 번만(무한 애니메이션 금지) · 영상 재생 동안만 requestAnimationFrame(줌·속도)
const el = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const champUrl = id => id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png` : '';
const av = (id, cls) => `<span class="${cls || 'pg-av'}">${id ? `<img src="${champUrl(id)}" alt="" onerror="this.remove()">` : ''}</span>`;
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
// ⏱️ 시계 — 평소엔 실제 시간. 미리보기 녹화(시험 도구)만 window.__potgStepInit()으로 「한 프레임씩」 모드(가상 시계·영상도 프레임마다 맞춰 그림)
const CLK = { step: false, t: 0, q: [] };
const now = () => CLK.step ? CLK.t : performance.now();
const later = (fn, ms) => CLK.step ? CLK.q.push({ at: CLK.t + ms, fn }) : setTimeout(fn, ms);
const sleep = ms => new Promise(r => later(r, ms));
const go = (node, kf, opt) => node.animate(kf, Object.assign({ fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)' }, opt));

let card = null, clipPath = null, clipP = null, run = 0, idleTimer = null, touched = false;

window.api.onPotg(async ({ card: c, manual }) => {
  card = c; clipPath = null; touched = !!manual;
  document.title = `PLAY OF THE GAME · ${c.name}`;
  el('pg').className = 'pg' + (c.team === 'teamA' ? ' t1' : c.team === 'teamB' ? ' t2' : '');
  clipP = c.clip ? window.api.potgClip(c.clip).then(p => (clipPath = p && p.url)).catch(() => null) : Promise.resolve(null);   // 소개 동안 미리 받음
  const wait = manual ? 0 : Math.max(0, (c.showAt || 0) - Date.now());
  if (wait) await sleep(Math.min(wait, 5000));
  play();
});

async function play() {
  const my = ++run, c = card;
  clearTimeout(idleTimer);
  el('pg-end').style.display = 'none'; el('pg-msg').textContent = '';
  el('pg-stage').style.display = 'none'; el('pg-card').style.display = 'none'; el('pg-wait').style.display = 'none';
  const v = el('pg-video'); v.pause(); v.removeAttribute('src'); v.load(); resetFx();
  // ① 소개
  const intro = el('pg-intro'); intro.style.display = ''; intro.getAnimations().forEach(a => a.cancel()); intro.style.opacity = '1';
  el('pg-av').outerHTML = av(c.championId).replace('class="pg-av"', 'id="pg-av" class="pg-av"');
  el('pg-name').textContent = c.name;
  el('pg-sub').textContent = [c.team === 'teamA' ? '1팀' : c.team === 'teamB' ? '2팀' : '', c.champ].filter(Boolean).join(' · ');
  el('pg-label').innerHTML = esc(c.label) + (c.tags && c.tags.length ? '<br>' + c.tags.map(t => `<span class="tg">${esc(t)}</span>`).join('') : '');
  const en = intro.querySelector('.pg-intro-en'), hero = intro.querySelector('.pg-hero'), lab = el('pg-label');
  [en, hero, lab].forEach(n => n.getAnimations().forEach(a => a.cancel()));
  go(en, [{ opacity: 0, transform: 'scale(1.25)', filter: 'blur(6px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }], { duration: 520 });
  go(hero, [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 420, delay: 650 });
  go(lab, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 380, delay: 1150 });
  later(() => { if (my === run) sfx(c.team === 'teamB' ? 2 : 1); }, 650);
  await sleep(3200); if (my !== run) return;
  // ② 장면
  el('pg-stage').style.display = '';
  go(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
  later(() => { if (my === run) intro.style.display = 'none'; }, 300);
  if (c.clip) {
    if (!clipPath) { el('pg-wait').style.display = ''; await Promise.race([clipP, sleep(20000)]); if (my !== run) return; el('pg-wait').style.display = 'none'; }
    if (clipPath && await playVideo(my)) return end(my);
  }
  await showCard(my);
  end(my);
}

// 🎬 팟지 편집(v0.1.38 레퍼런스) — 유튜브 하이라이트 공식: 영상을 WebGL 캔버스에 그리며 프레임마다 효과
//   색 보정(대비·채도·틸/오렌지)·필름 그레인·비네트 · 천천히 밀고 들어가는 카메라 · 킬마다 「펀치 줌」(순간 확대+방사형 모션 블러+RGB 분리)
//   속도 램프(1배 → 부드럽게 0.4배 → 1배, 마지막 킬 0.25배) · 마지막 킬 = 임팩트 프레임(반전 2프레임) → 정지 화면(주인공 둘레만 흑백·스포트라이트) → 줌 아웃
//   WebGL이 안 되면 그냥 영상(CSS)으로. 시각은 전부 영상 기준(킬 시각 - clipFrom)
const MULTI = ['처치', '더블킬', '트리플킬', '쿼드라킬', '펜타킬'];
const MULTI_EN = { 처치: 'KILL', 더블킬: 'DOUBLE KILL', 트리플킬: 'TRIPLE KILL', 쿼드라킬: 'QUADRA KILL', 펜타킬: 'PENTA KILL', 솔로킬: 'SOLO KILL', 에이스: 'ACE' };
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const FS = `precision mediump float;
uniform sampler2D tex; uniform vec2 res; uniform float vasp, zoom, rblur, ca, sat, flash, desat, grain, tm, vig, inv;
varying vec2 uv;
vec3 grade(vec3 c) {
  c = (c - 0.5) * 1.14 + 0.5;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, sat);
  c += vec3(0.035, 0.012, -0.03) * smoothstep(0.45, 1.0, l) + vec3(-0.025, 0.006, 0.035) * (1.0 - smoothstep(0.0, 0.45, l));
  return c;
}
void main() {
  vec2 c = vec2(0.5), p = uv; float sa = res.x / res.y;
  if (sa < vasp) p.x = (p.x - 0.5) * sa / vasp + 0.5; else p.y = (p.y - 0.5) * vasp / sa + 0.5;   // 창 비율이 달라도 꽉 채움(가운데 기준 잘림)
  p = (p - c) / zoom + c;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float s = 1.0 - rblur * float(i) / 8.0; vec2 q = (p - c) * s + c;
    col.r += texture2D(tex, (q - c) * (1.0 - ca) + c).r;
    col.g += texture2D(tex, q).g;
    col.b += texture2D(tex, (q - c) * (1.0 + ca) + c).b;
  }
  col = grade(col / 8.0);
  float d = distance((uv - c) * vec2(res.x / res.y, 1.0), vec2(0.0));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l) * 0.8, desat * smoothstep(0.16, 0.42, d));
  col = mix(col, 1.0 - col, inv);
  col *= 1.0 - vig * smoothstep(0.45, 1.05, d);
  col += flash;
  float n = fract(sin(dot(uv * res + tm * 61.7, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * grain;
  gl_FragColor = vec4(col, 1.0);
}`;
function makeGL(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
  [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
  const U = {}; ['res', 'vasp', 'zoom', 'rblur', 'ca', 'sat', 'flash', 'desat', 'grain', 'tm', 'vig', 'inv'].forEach(k => U[k] = gl.getUniformLocation(pr, k));
  return (video, u) => {
    const w = canvas.clientWidth * devicePixelRatio | 0, h = canvas.clientHeight * devicePixelRatio | 0;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); } catch (_) { return; }
    gl.uniform2f(U.res, w, h); gl.uniform1f(U.vasp, video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9);
    for (const k of ['zoom', 'rblur', 'ca', 'sat', 'flash', 'desat', 'grain', 'tm', 'vig', 'inv']) gl.uniform1f(U[k], u[k]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}
const kbHtml = (ko, final, sub) => `<div class="pg-kbt${final ? ' final' : ''}"><b class="en">${MULTI_EN[ko] || (/스틸$/.test(ko) ? 'STEAL' : esc(ko))}</b><span class="ko">${esc(ko)}${sub ? `<em>${sub}</em>` : ''}</span></div>`;
function slam(node, big) {   // 글자 「쾅」: 크게·흐리게·색 갈라짐 → 제자리
  go(node, [{ opacity: 0, transform: `scale(${big ? 2.2 : 1.7})`, filter: 'blur(10px)' }, { opacity: 1, transform: 'scale(0.96)', filter: 'blur(0)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }], { duration: big ? 380 : 300, easing: 'cubic-bezier(.2,.9,.3,1)' });
  const en = node.querySelector('.en');
  if (en) go(en, [{ textShadow: '-7px 0 rgba(255,40,80,.85), 7px 0 rgba(40,220,255,.85)' }, { textShadow: '-1px 0 rgba(255,40,80,.5), 1px 0 rgba(40,220,255,.5)', offset: 0.6 }, { textShadow: '0 0 rgba(0,0,0,0)' }], { duration: 520, easing: 'ease-out' });
}
function playVideo(my) {
  return new Promise(resolve => {
    const v = el('pg-video'), c = card, fx = el('pg-fx'), wrap = el('pg-vwrap'), cv = el('pg-canvas');
    const ms = (c.kills && c.kills.length ? c.kills.map(k => k.t) : [c.obj ? c.obj.t : c.t1]).map(t => t - c.clipFrom);
    const last = ms[ms.length - 1], fired = new Set(), t0w = now();
    let frozen = 0, freezeAt = 0, raf = 0, rate = 1, done = false, draw = null;
    try { draw = makeGL(cv); } catch (e) { draw = null; }
    cv.style.display = draw ? '' : 'none'; v.style.opacity = draw ? '0' : '1';
    resetFx();
    fx.style.display = '';
    el('pg-tag').innerHTML = `${av(c.championId)}<div><small>PLAY OF THE GAME</small><b>${esc(c.name)}</b><i>${esc([c.champ, c.team === 'teamA' ? '1팀' : c.team === 'teamB' ? '2팀' : ''].filter(Boolean).join(' · '))}</i></div>`;
    fx.querySelectorAll('.pg-bar').forEach(b => go(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 450 }));
    go(el('pg-tag'), [{ opacity: 0, transform: 'translateX(-30px)', clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, transform: 'translateX(0)', clipPath: 'inset(0 0 0 0)' }], { duration: 480, delay: 250, easing: 'cubic-bezier(.15,.9,.3,1)' });
    const win = (x, pre, hold, post) => x < -pre ? 0 : x < 0 ? smooth((x + pre) / pre) : x < hold ? 1 : x < hold + post ? 1 - smooth((x - hold) / post) : 0;   // 킬 둘레 부드러운 창
    const rateAt = t => {   // 속도 램프: 킬 0.9초 전부터 0.45초에 걸쳐 느려졌다 0.35초에 걸쳐 돌아옴
      let w = 0, lo = 1;
      ms.forEach(m => { const isL = m === last, k = win(t - m, isL ? 0.9 : 0.6, isL ? 0.45 : 0.25, 0.35); if (k > w) { w = k; lo = isL ? 0.25 : 0.4; } });
      for (let i = 0; i < ms.length - 1; i++) if (ms[i + 1] - ms[i] < 2.2 && t > ms[i] && t < ms[i + 1]) { w = Math.max(w, 0.6); lo = Math.min(lo, 0.4); }   // 연속 킬 사이는 살짝 느리게 유지
      return 1 - (1 - lo) * w;
    };
    const punch = t => { let p = 0; ms.forEach(m => { const x = t - m; if (x >= 0 && x < 0.7) p = Math.max(p, Math.exp(-x * 7)); else if (x > -0.06 && x < 0) p = Math.max(p, (x + 0.06) / 0.06); }); return p; };
    const hold = t => { let z = 0; ms.forEach(m => { z = Math.max(z, win(t - m, 1.0, m === last ? 99 : 0.4, 0.8)); }); for (let i = 0; i < ms.length - 1; i++) if (ms[i + 1] - ms[i] < 3 && t > ms[i] && t < ms[i + 1]) z = 1; return z; };
    const finish = ok => { if (done) return; done = true; cancelAnimationFrame(raf); CLK.video = null; v.playbackRate = 1; resolve(ok && my === run); };
    const tick = (tv) => {
      if (my !== run) return finish(false);
      const t = tv == null ? v.currentTime : tv, nw = now();
      if (!frozen) { const r = rateAt(t); CLK.rate = r; if (Math.abs(r - rate) > 0.01) { rate = r; v.playbackRate = r; } }
      ms.forEach((m, i) => { if (!fired.has(i) && t >= m) { fired.add(i); onKill(i); } });
      if (!frozen && t >= Math.min(last + 0.45, (isFinite(v.duration) ? v.duration : 1e9) - 0.08)) {   // 마지막 킬 = 임팩트 프레임 → 정지 화면
        frozen = 1; freezeAt = nw; v.pause();
        const lab = c.label || MULTI[Math.min(ms.length, 5) - 1];
        el('pg-kb').innerHTML = kbHtml(lab, true, c.tags && c.tags.length ? c.tags.map(esc).join(' · ') : '');
        el('pg-kb').className = 'pg-kb final';
        slam(el('pg-kb').firstChild, true);
        later(() => {
          if (my !== run) return;
          frozen = 2; rate = 1; v.playbackRate = 1; el('pg-kb').className = 'pg-kb';
          go(el('pg-kb').firstChild || document.createElement('i'), [{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 380 });
          if (!CLK.step) v.play().catch(() => {});
        }, 1700);
      }
      const fz = frozen === 1 ? Math.min(1, (nw - freezeAt) / 160) : frozen === 2 ? Math.max(0, 1 - (nw - freezeAt - 1700) / 400) : 0;   // 정지 화면 정도
      const p = frozen ? 0 : punch(t), hz = hold(t) * (frozen === 2 ? Math.max(0, 1 - (nw - freezeAt - 1700) / 900) : 1);
      const u = {
        zoom: 1 + 0.025 * Math.min(1, (nw - t0w) / 6000) + 0.2 * hz + 0.09 * p,   // 천천히 밀기 + 킬 둘레 확대 + 펀치
        rblur: 0.05 * p, ca: 0.006 + 0.014 * p, sat: 1.18 + 0.15 * fz, flash: 0.22 * p + (frozen === 1 && nw - freezeAt < 90 ? 0.0 : 0),
        desat: 0.85 * fz, grain: 0.045, tm: (nw % 10000) / 1000, vig: 0.55 + 0.25 * fz,
        inv: frozen === 1 && nw - freezeAt < 70 ? 1 : 0,   // 임팩트 프레임(반전 2프레임)
      };
      if (draw) draw(v, u); else v.style.transform = `scale(${u.zoom.toFixed(4)})`;
      if (!CLK.step) raf = requestAnimationFrame(() => tick());
    };
    function onKill(i) {
      const k = (c.kills || [])[i];
      go(wrap, [{ transform: 'translate(0,0)' }, { transform: 'translate(-9px,5px) rotate(-0.4deg)' }, { transform: 'translate(7px,-4px) rotate(0.3deg)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }], { duration: 300, easing: 'linear' });
      if (k) {
        const row = document.createElement('div'); row.className = 'pg-fk';
        row.innerHTML = `${av(c.championId)}<i class="sw"></i>${av(k.championId, 'pg-av vic')}<span>${esc(k.victim)}</span>`;
        el('pg-feed').appendChild(row);
        go(row, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 240, easing: 'cubic-bezier(.15,.9,.3,1)' });
      }
      if (i !== ms.length - 1 && ms.length > 1) {   // 중간 킬 = KILL / DOUBLE KILL … (마지막은 정지 화면에서 크게)
        el('pg-kb').className = 'pg-kb';
        el('pg-kb').innerHTML = kbHtml(MULTI[Math.min(i, 4)], false);
        const n = el('pg-kb').firstChild; slam(n, false);
        later(() => { if (n.isConnected) go(n, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 260 }); }, 1100);
      }
    }
    v.preservesPitch = false;   // 슬로모션 때 소리도 낮고 무겁게
    v.src = clipPath;
    v.onended = () => finish(true);
    v.onerror = () => finish(false);
    if (CLK.step) {   // 한 프레임씩: __potgStep이 영상 시각을 직접 옮기고 tick 호출
      CLK.video = { v, mt: 0, tick, frozen: () => frozen === 1, finish };
      return;
    }
    v.play().then(() => { raf = requestAnimationFrame(() => tick()); }).catch(() => { v.muted = true; v.play().then(() => { raf = requestAnimationFrame(() => tick()); }).catch(() => finish(false)); });
  });
}
function resetFx() {
  const fx = el('pg-fx'), v = el('pg-video');
  fx.style.display = 'none';
  fx.querySelectorAll('*').forEach(n => n.getAnimations().forEach(a => a.cancel()));
  el('pg-feed').innerHTML = ''; el('pg-kb').innerHTML = '';
  v.getAnimations().forEach(a => a.cancel()); v.style.transform = ''; v.playbackRate = 1; el('pg-kb').className = 'pg-kb';
  el('pg-vwrap').getAnimations().forEach(a => a.cancel());
}

async function showCard(my) {   // 영상 없을 때: 킬 타임라인
  const c = card, box = el('pg-card'); resetFx();
  const t = c.kills && c.kills.length ? (c.t1 - c.t0 >= 1 ? `${mmss(c.t0)} – ${mmss(c.t1)} · ${Math.round(c.t1 - c.t0)}초 동안` : mmss(c.t0)) : mmss(c.t0);
  box.innerHTML = `<div class="pg-time num">${t}</div>`
    + `<div class="pg-killer">${av(c.championId)}<b>${esc(c.name)}</b></div>`
    + (c.kills && c.kills.length ? `<div class="pg-row">${c.kills.map(k => `<div class="pg-kill">${av(k.championId)}<span>${esc(k.victim)}</span><small class="num">${mmss(k.t)}</small></div>`).join('')}</div>` : '')
    + `<div class="pg-card-note">영상 없음 · 킬 기록으로 다시 그린 장면</div>`;
  box.style.display = '';
  const ks = [...box.querySelectorAll('.pg-kill')];
  ks.forEach((k, i) => go(k, [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, delay: 400 + i * 380, easing: 'cubic-bezier(.3,1.4,.5,1)' }));
  await sleep(400 + ks.length * 380 + 2600);
}

function end(my) {
  if (my !== run) return;
  const c = card;
  el('pg-sum').innerHTML = `<b>${esc(c.name)}</b>${c.champ ? ' · ' + esc(c.champ) : ''} · ${esc(c.label)} · <span class="num">${mmss(c.t0)}</span>`;
  el('pg-save').style.display = clipPath ? '' : 'none';
  el('pg-end').style.display = '';
  if (!touched) idleTimer = setTimeout(() => window.api.potgClose(), 15000);   // 아무도 안 누르면 15초 뒤 닫힘
}

function sfx(team) { try { const a = new Audio(`../assets/sfx/pick-t${team}.ogg`); a.volume = 0.2; a.play().catch(() => {}); } catch (_) {} }

document.addEventListener('pointerdown', () => { touched = true; clearTimeout(idleTimer); });
el('pg-x').onclick = el('pg-close').onclick = () => window.api.potgClose();
el('pg-again').onclick = () => play();
el('pg-save').onclick = async () => {
  const r = await window.api.potgSave(card.clip, card.name).catch(() => null);
  el('pg-msg').textContent = r && r.ok ? `저장했어요 · ${r.path}` : r && r.canceled ? '' : '저장하지 못했어요';
};

// 🧪 미리보기 녹화용(앱에선 안 씀): __potgStepInit() 후 onPotg → __potgStep(1/30)을 프레임마다 부르고 캡처
window.__potgStepInit = () => { CLK.step = true; CLK.t = 0; CLK.log = []; };
window.__potgLog = () => JSON.stringify(CLK.log);
window.__potgStep = async dt => {
  CLK.t += dt * 1000;
  for (const it of CLK.q.filter(x => x.at <= CLK.t)) { CLK.q.splice(CLK.q.indexOf(it), 1); it.fn(); }
  await Promise.resolve();
  const V = CLK.video;
  if (V) {
    if (!V.started) { V.started = true; await new Promise(r => V.v.readyState >= 2 ? r() : V.v.addEventListener('loadeddata', r, { once: true })); }
    else if (!V.frozen()) V.mt += dt * (CLK.rate || 1);
    const dur = V.v.duration;
    if (isFinite(dur) && V.mt >= dur - 0.02) { CLK.log.push([CLK.t, V.mt, 0]); V.finish(true); return; }
    if (Math.abs(V.v.currentTime - V.mt) > 0.001) { V.v.currentTime = V.mt; await new Promise(r => V.v.addEventListener('seeked', r, { once: true })); }
    V.tick(V.mt);
    CLK.log.push([CLK.t, V.mt, V.frozen() ? 1 : 0]);
  }
  for (const a of document.getAnimations()) { if (a._vs == null) { a._vs = CLK.t - (a.currentTime || 0); a.pause(); } a.currentTime = CLK.t - a._vs; }
  await new Promise(r => requestAnimationFrame(() => r()));
};
