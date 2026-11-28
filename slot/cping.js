// cping.html 화면 스크립트(v0.1.293 보안 점검: 화면 안 인라인 스크립트를 파일로 뺌 = CSP가 인라인 실행을 막게)
const PING = {
  look: { t: '여기 봐요', c: '#7cc6ff', img: 'look' },
  ready: { t: '준비 완료', c: '#7be0b0', img: 'ready' },
  go: { t: '가자!', c: '#ff9f5a', img: 'go' },
  good: { t: '좋아요', c: '#a7e36b', img: 'good' },
  lol: { t: 'ㅋㅋ', c: '#ffd56b', img: 'lol' },
  wait: { t: '잠깐만', c: '#b9a4ff', img: 'wait' },
  sorry: { t: '미안', c: '#9fd8ff', img: 'sorry' },
  ask: { t: '?', c: '#ffc24d', img: 'ask' },
  thanks: { t: '고마워', c: '#ff9ccc', img: 'thanks' },
};
const DIR = ['ready', 'go', 'good', 'lol', 'wait', 'sorry', 'ask', 'thanks'], R = 116, MS = 2600, MUTE = [];   // ✏️ v0.1.256 대기실용 스케치 핑(overlay.js PING과 같음)
const img = k => `../assets/ping/${(PING[k] || PING.look).img}.png`;
const root = document.getElementById('root');
for (const k of Object.keys(PING)) { const i = new Image(); i.src = img(k); }   // 미리 읽어 둠(첫 핑이 늦게 안 뜨게)
let pw = null;
function wheel() {
  if (pw) return pw;
  pw = document.createElement('div'); pw.className = 'pw';
  pw.innerHTML = '<div class="bg"></div>' + DIR.map((k, i) => `<div class="s" data-k="${k}" style="--r:${i * 45}deg;--pc:${PING[k].c}"></div>`).join('')
    + DIR.map((k, i) => { const a = (i * 45 - 90) * Math.PI / 180; return `<img class="i${MUTE.includes(k) ? ' mute' : ''}" data-k="${k}" src="${img(k)}" style="left:${(Math.cos(a) * R).toFixed(1)}px;top:${(Math.sin(a) * R).toFixed(1)}px" alt="">`; }).join('')
    + `<div class="ctr"><img class="ci" src="${img('look')}" alt=""><b class="t"></b><small><svg class="ms" viewBox="0 0 10 14"><rect x=".7" y=".7" width="8.6" height="12.6" rx="4.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 .7v5.2h4.3V5A4.3 4.3 0 0 0 5 .7z" fill="currentColor"/></svg>뒤로</small></div>`;
  root.appendChild(pw); return pw;
}
let ox = 0, oy = 0;
function sel(k) {
  const w = wheel();
  w.querySelectorAll('[data-k]').forEach(s => s.classList.toggle('on', s.dataset.k === k));
  w.style.setProperty('--pc', (PING[k] || PING.look).c);
  w.querySelector('.ci').src = img(k);
  w.querySelector('.t').textContent = (PING[k] || PING.look).t;
}
function show(d) {
  const P = PING[d.k]; if (!P) return;
  const e = document.createElement('div'); e.className = 'wp'; e.style.setProperty('--pc', P.c);
  e.style.left = (d.fx * 1280) + 'px'; e.style.top = (d.fy * 720) + 'px';
  e.innerHTML = `<i class="g"></i><i class="g g2"></i><i class="sb"></i><img class="ic" src="${img(d.k)}" alt=""><b class="nm"></b>`;
  e.querySelector('.nm').textContent = (d.name ? d.name + ' · ' : '') + P.t;
  root.appendChild(e);
  e.animate([{ opacity: 1 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], { duration: MS, fill: 'forwards' });
  setTimeout(() => e.remove(), MS + 100);
  if (d.vol > 0) try { const a = new Audio(`../assets/ping/sfx/${d.k}.ogg`); a.volume = Math.min(1, 0.14 * d.vol);   /* ≈ −32 LUFS · overlay PING_VOL과 같게 */ a.play().catch(() => {}); } catch (_) {}   // 🔊 롤 핑 소리(v0.1.224)
  const all = root.querySelectorAll('.wp'); if (all.length > 14) all[0].remove();
}
function onMsg(d) {
  if (!d) return;
  if (d.type === 'wheel') { const w = wheel(); ox = d.x; oy = d.y; w.style.left = d.x + 'px'; w.style.top = d.y + 'px'; w.classList.add('open'); sel('look'); }
  else if (d.type === 'move' && pw) sel(d.sel);
  else if (d.type === 'end' && pw) pw.classList.remove('open');
  else if (d.type === 'show') show(d);
  else if (d.type === 'err') { const e = document.createElement('div'); e.className = 'er'; e.textContent = d.text || ''; e.style.left = d.x + 'px'; e.style.top = d.y + 'px'; root.appendChild(e); setTimeout(() => e.remove(), 1800); }
}
if (window.api && window.api.onCping) window.api.onCping(onMsg);
else {   // 🎨 목업(브라우저 직접 열기)
  document.body.style.background = '#0a1712';
  onMsg({ type: 'show', k: 'ask', fx: .3, fy: .45, name: '애긔반달곰' });
  onMsg({ type: 'wheel', x: 800, y: 380 }); onMsg({ type: 'move', sel: 'ask', x: 750, y: 382 });
}

