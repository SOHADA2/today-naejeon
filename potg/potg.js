// 🎬 팟지 창(렌더러) — 메인이 'potg' {card, manual, myName}을 보내면: 소개 3초 → 장면(영상 있으면 영상, 없으면 킬 타임라인) → 저장/다시 보기/닫기
// 모두 같은 시각(card.showAt)에 시작 · 효과는 전부 한 번만(무한 애니메이션 금지) · 영상 재생 동안만 requestAnimationFrame(줌·속도)
const el = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const champUrl = id => id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png` : '';
const av = (id, cls) => `<span class="${cls || 'pg-av'}">${id ? `<img src="${champUrl(id)}" alt="" onerror="this.remove()">` : ''}</span>`;
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  bgmStart();
  setTimeout(() => { if (my === run) sfx(c.team === 'teamB' ? 2 : 1); }, 650);
  await sleep(3200); if (my !== run) return;
  // ② 장면
  el('pg-stage').style.display = '';
  go(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
  setTimeout(() => { if (my === run) intro.style.display = 'none'; }, 300);
  if (c.clip) {
    if (!clipPath) { el('pg-wait').style.display = ''; await Promise.race([clipP, sleep(20000)]); if (my !== run) return; el('pg-wait').style.display = 'none'; }
    if (clipPath && await playVideo(my)) return end(my);
  }
  await showCard(my);
  end(my);
}

// 🎬 팟지 편집(v0.1.35) — 오버워치 팟지 공식: 시네마 띠+이름표로 시작 → 킬 직전 확대(줌 인)·슬로모션 → 킬 순간 섬광·흔들림·킬 피드·「더블킬」
//   → 마지막 킬은 더 느리게 + 0.45초 뒤 정지 화면(1.5초, 큰 글자) → 다시 재생하며 줌 아웃 → 끝. 시각은 전부 영상 기준(킬 시각 - clipFrom)
const MULTI = ['처치', '더블킬', '트리플킬', '쿼드라킬', '펜타킬'];
const MULTI_EN = { 처치: 'KILL', 더블킬: 'DOUBLE KILL', 트리플킬: 'TRIPLE KILL', 쿼드라킬: 'QUADRA KILL', 펜타킬: 'PENTA KILL', 솔로킬: 'SOLO KILL' };
const kbHtml = (ko, final) => `<div class="pg-kbt${final ? ' final' : ''}"><i class="en">${MULTI_EN[ko] || (/스틸$/.test(ko) ? 'STEAL' : 'PLAY OF THE GAME')}</i><b>${esc(ko)}</b></div>`;

// 🎵 BGM(v0.1.37) — 「레전드 장면」 오케스트라(assets/bgm, VSCO-2 실제 악기 녹음): 소개부터 8초 반복 bed → 정지 화면 순간에 climax의 「쾅」(2.5초 지점)이 꽂히게 미리 시작
const BGM_HIT = 2.5, BGM_VOL = 0.32;
const bgm = { bed: null, cl: null, timers: [] };
function bgmFade(a, to, ms) { if (!a) return; const from = a.volume, t0 = performance.now(); const id = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k >= 1) { clearInterval(id); if (to === 0) a.pause(); } }, 30); bgm.timers.push(id); }
function bgmStop() { bgm.timers.forEach(clearInterval); bgm.timers.forEach(clearTimeout); bgm.timers = []; for (const a of [bgm.bed, bgm.cl]) if (a) { a.pause(); a.currentTime = 0; } bgm.climaxed = false; }
function bgmStart() {
  bgmStop();
  try {
    bgm.bed = bgm.bed || Object.assign(new Audio('../assets/bgm/potg-bed.ogg'), { loop: true });
    bgm.cl = bgm.cl || new Audio('../assets/bgm/potg-climax.ogg');
    bgm.bed.volume = 0; bgm.bed.play().catch(() => {}); bgmFade(bgm.bed, BGM_VOL, 600);
  } catch (_) {}
}
function bgmClimax(inSec) {   // inSec초 뒤에 「쾅」
  if (bgm.climaxed || !bgm.cl) return; bgm.climaxed = true;
  const go2 = () => { try { bgm.cl.currentTime = Math.max(0, BGM_HIT - inSec); bgm.cl.volume = BGM_VOL * 1.15; bgm.cl.play().catch(() => {}); } catch (_) {} };
  const wait = Math.max(0, inSec - BGM_HIT);
  if (wait) bgm.timers.push(setTimeout(go2, wait * 1000)); else go2();
  bgm.timers.push(setTimeout(() => bgmFade(bgm.bed, 0, 250), Math.max(0, inSec - 0.2) * 1000));   // 반복 반주는 「쾅」 직전에 빠짐
}
function bgmEnd(ms) { bgmFade(bgm.bed, 0, ms); bgmFade(bgm.cl, 0, ms); }

const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
function playVideo(my) {
  return new Promise(resolve => {
    const v = el('pg-video'), c = card, fx = el('pg-fx'), wrap = el('pg-vwrap');
    const ms = (c.kills && c.kills.length ? c.kills.map(k => k.t) : [c.obj ? c.obj.t : c.t1]).map(t => t - c.clipFrom);
    const last = ms[ms.length - 1], fired = new Set();
    let frozen = 0, raf = 0, rate = 1, done = false;
    resetFx();
    fx.style.display = '';
    el('pg-tag').innerHTML = `${av(c.championId)}<div><small>PLAY OF THE GAME</small><b>${esc(c.name)}${c.champ ? ' · ' + esc(c.champ) : ''}</b></div>`;
    fx.querySelectorAll('.pg-bar').forEach(b => go(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 450 }));
    go(fx.querySelector('.pg-vig'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
    go(el('pg-tag'), [{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 420, delay: 300 });
    const zoomAt = t => {   // 킬 1.2초 전부터 확대 → 킬 0.3초 뒤까지 유지 → 0.9초에 걸쳐 원래대로 · 마지막 킬은 정지 끝날 때까지 유지
      let z = 0;
      for (const m of ms) {
        const x = t - m, outEnd = m === last ? (frozen === 2 ? 0.45 + 1.2 : 99) : 0.9, hold = m === last ? 0.45 : 0.3;
        const up = smooth((x + 1.2) / 0.9), down = x <= hold ? 1 : 1 - smooth((x - hold) / Math.max(0.01, outEnd - hold));
        z = Math.max(z, Math.min(up, down));
      }
      for (let i = 0; i < ms.length - 1; i++) if (ms[i + 1] - ms[i] < 3 && t >= ms[i] && t <= ms[i + 1]) z = 1;   // 킬 사이가 3초 안이면 확대 유지(들썩이지 않게)
      return 1 + 0.32 * z;
    };
    const rateAt = t => {
      for (const m of ms) { if (m === last ? t >= m - 0.7 && t <= m + 0.45 : t >= m - 0.45 && t <= m + 0.3) return m === last ? 0.3 : 0.4; }
      return 1;
    };
    const finish = ok => { if (done) return; done = true; cancelAnimationFrame(raf); v.playbackRate = 1; if (ok) bgmClimax(0); resolve(ok && my === run); };
    const tick = () => {
      if (my !== run) return finish(false);
      const t = v.currentTime;
      if (!frozen) { const r = rateAt(t); if (r !== rate) { rate = r; v.playbackRate = r; } }
      v.style.transform = `scale(${zoomAt(t).toFixed(4)})`;
      ms.forEach((m, i) => { if (!fired.has(i) && t >= m) { fired.add(i); onKill(i); } });
      if (!frozen) {   // 정지 화면까지 남은 실제 시간(슬로모션 감안) ≤ 2.5초면 climax 시작 → 「쾅」이 정지 순간에
        let w = 0; for (let x = t; x < last + 0.45 && w <= BGM_HIT + 0.1; x += 0.02) w += 0.02 / rateAt(x);
        if (!bgm.climaxed && w <= BGM_HIT + 0.05) bgmClimax(w);
        else if (bgm.climaxed && bgm.cl && !bgm.cl.paused && w <= BGM_HIT) {   // 영상 재생이 조금 밀리면 상승 구간 속도를 살짝 조절해 「쾅」을 정지 순간에 맞춤
          const diff = (BGM_HIT - w) - bgm.cl.currentTime, r = Math.abs(diff) < 0.05 ? 1 : Math.max(0.88, Math.min(1.15, 1 + diff * 0.8)); if (Math.abs(r - bgm.cl.playbackRate) > 0.02) bgm.cl.playbackRate = r;
        }
      }
      if (!frozen && t >= last + 0.45) {   // 마지막 킬 = 정지 화면
        frozen = 1; v.pause();
        if (bgm.cl) { if (bgm.climaxed && bgm.cl.currentTime < BGM_HIT - 0.12) bgm.cl.currentTime = BGM_HIT - 0.02; bgm.cl.playbackRate = 1; }
        v.animate([{ filter: 'none' }, { filter: 'saturate(1.5) contrast(1.15) brightness(1.08)' }], { duration: 200, fill: 'forwards' });
        const lab = c.label || MULTI[Math.min(ms.length, 5) - 1];
        el('pg-kb').innerHTML = `<div class="pg-kbf">${kbHtml(lab, true)}${c.tags && c.tags.length ? `<div class="pg-kbs">${c.tags.map(esc).join(' · ')}</div>` : ''}</div>`;
        go(el('pg-kb').firstChild, [{ opacity: 0, transform: 'translateX(-60px)', clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, transform: 'translateX(0)', clipPath: 'inset(0 0 0 0)' }], { duration: 300, easing: 'cubic-bezier(.15,.9,.3,1)' });
        setTimeout(() => {
          if (my !== run) return;
          frozen = 2; rate = 1; v.playbackRate = 1;
          v.getAnimations().forEach(a => a.cancel());
          go(el('pg-kb').firstChild || document.createElement('i'), [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
          v.play().catch(() => {});
        }, 1500);
      }
      raf = requestAnimationFrame(tick);
    };
    function onKill(i) {
      const k = (c.kills || [])[i];
      go(el('pg-flash'), [{ opacity: 0.55 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
      go(wrap, [{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(-2px,2px)' }, { transform: 'translate(0,0)' }], { duration: 260, easing: 'linear' });
      if (k) {
        const row = document.createElement('div'); row.className = 'pg-fk';
        row.innerHTML = `${av(c.championId)}<i class="sw">⚔</i>${av(k.championId, 'pg-av vic')}<span>${esc(k.victim)}</span>`;
        el('pg-feed').appendChild(row);
        go(row, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 260 });
      }
      if (i !== ms.length - 1 && ms.length > 1) {   // 중간 킬 = 「처치」「더블킬」… (마지막은 정지 화면에서 크게)
        el('pg-kb').innerHTML = kbHtml(MULTI[Math.min(i, 4)], false);
        go(el('pg-kb').firstChild, [{ opacity: 0, transform: 'translateX(-40px)', clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, transform: 'translateX(0)', clipPath: 'inset(0 0 0 0)', offset: 0.18 }, { opacity: 1, transform: 'translateX(6px)', offset: 0.8 }, { opacity: 0, transform: 'translateX(30px)', clipPath: 'inset(0 0 0 0)' }], { duration: 1300, easing: 'linear' });
      }
    }
    v.preservesPitch = false;   // 슬로모션 때 소리도 낮고 무겁게
    v.volume = 0.6;   // 게임 소리는 BGM 밑으로
    v.src = clipPath;
    v.onended = () => finish(true);
    v.onerror = () => finish(false);
    v.play().then(() => { raf = requestAnimationFrame(tick); }).catch(() => { v.muted = true; v.play().then(() => { raf = requestAnimationFrame(tick); }).catch(() => finish(false)); });
  });
}
function resetFx() {
  const fx = el('pg-fx'), v = el('pg-video');
  fx.style.display = 'none';
  fx.querySelectorAll('*').forEach(n => n.getAnimations().forEach(a => a.cancel()));
  el('pg-feed').innerHTML = ''; el('pg-kb').innerHTML = '';
  v.getAnimations().forEach(a => a.cancel()); v.style.transform = ''; v.playbackRate = 1;
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
  bgmClimax((400 + Math.max(0, ks.length - 1) * 380) / 1000);   // 마지막 킬 칸이 찍힐 때 「쾅」
  await sleep(400 + ks.length * 380 + 2600);
}

function end(my) {
  if (my !== run) return;
  const c = card;
  el('pg-sum').innerHTML = `<b>${esc(c.name)}</b>${c.champ ? ' · ' + esc(c.champ) : ''} · ${esc(c.label)} · <span class="num">${mmss(c.t0)}</span>`;
  el('pg-save').style.display = clipPath ? '' : 'none';
  el('pg-end').style.display = '';
  bgm.timers.push(setTimeout(() => bgmEnd(2500), 2500));   // 「쾅」 울림을 조금 들려주고 서서히
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
