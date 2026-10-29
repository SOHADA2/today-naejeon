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

// 🎵 BGM·효과음(v0.1.40) — 사장님이 수노로 만든 원곡에서 잘라냄(tools/potg-audio.py)
//   BGM = 「Victory Strike」 일부(assets/bgm/potg-bgm.ogg) · 파일 38.9초 = 곡이 크게 터지는 곳 → **정지 화면(마지막 킬) 순간에 오게** 시작 위치를 계산하고 재생 중에 조금씩 맞춤
//   효과음 = 「Impact Sequence」에서 4개: intro(소개 글자) · hit(중간 킬) · slow(점점 느려지는 떨림 → 마지막 킬에 타격) · slam(정지 화면 「쾅」)
//   소리 크기 = ⚙️ 설정의 효과음 크기(window.__tnVol)를 곱함 · 영상 속 게임 소리는 BGM 밑으로(0.6)
const BGM_DROP = 38.9, BGM_VOL = 0.3;
const SFX = { intro: { hit: 0.17, vol: 0.55 }, hit: { hit: 0.12, vol: 0.45 }, slow: { hit: 1.03, vol: 0.5 }, slam: { hit: 0.07, vol: 0.65 } };
const VOL = () => (window.__tnVol == null ? 1 : window.__tnVol);
const bgm = { a: new Audio('../assets/bgm/potg-bgm.ogg'), target: null, timers: [], fadeId: 0 };
bgm.a.preload = 'auto'; bgm.a.preservesPitch = true;   // 박자 맞추느라 속도를 ±10% 바꿔도 음높이는 그대로
for (const k of Object.keys(SFX)) { const a = new Audio(`../assets/sfx/potg-${k}.ogg`); a.preload = 'auto'; }   // 미리 불러 둠(캐시)
function playSfx(name, gain) {
  try { const a = new Audio(`../assets/sfx/potg-${name}.ogg`); a.volume = Math.min(1, SFX[name].vol * (gain || 1) * VOL()); if (a.volume > 0) a.play().catch(() => {}); } catch (_) {}
}
function seekPlay(a, t) { const go2 = () => { try { a.currentTime = Math.max(0, t); } catch (_) {} a.play().catch(() => {}); }; if (a.readyState >= 1) go2(); else a.addEventListener('loadedmetadata', go2, { once: true }); }
function bgmFade(to, ms) {
  const a = bgm.a, from = a.volume, t0 = performance.now(), id = ++bgm.fadeId;
  const step = () => { if (id !== bgm.fadeId) return; const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else if (to === 0) a.pause(); };
  step();
}
function bgmStop() { bgm.timers.forEach(clearTimeout); bgm.timers = []; bgm.fadeId++; bgm.target = null; try { bgm.a.pause(); bgm.a.playbackRate = 1; } catch (_) {} }
function bgmStart(secToDrop) {   // 지금부터 secToDrop초 뒤에 「터짐」
  bgmStop();
  if (VOL() <= 0) return;
  bgm.target = performance.now() + secToDrop * 1000;
  const pos = BGM_DROP - secToDrop;
  bgm.a.volume = 0;
  const begin = () => { seekPlay(bgm.a, BGM_DROP - (bgm.target - performance.now()) / 1000); bgmFade(BGM_VOL * VOL(), 1500); };
  if (pos >= 0) begin(); else bgm.timers.push(setTimeout(begin, -pos * 1000));   // 정지 화면이 아주 멀면(긴 영상) 조금 늦게 시작
}
function bgmRetarget(secToDrop, normal) {   // 영상 재생 중 매 프레임: 남은 시간대로 맞춤
  // v0.1.41: BGM은 늘 원래 속도(사장님: 슬로우 때 노래까지 이상하게 들림 — 속도를 ±10% 바꿔 맞추던 것 뺌)
  //   → 보통 속도 구간에서만, 0.3초 넘게 어긋났을 때 한 번 건너뜀 · 남은 작은 차이는 정지 화면 「쾅」 때 bgmDropNow가 맞춤
  if (bgm.target == null) return;
  bgm.target = performance.now() + secToDrop * 1000;
  const a = bgm.a; if (a.paused || a.readyState < 1) return;
  if (a.playbackRate !== 1) a.playbackRate = 1;
  if (normal && Math.abs((BGM_DROP - secToDrop) - a.currentTime) > 0.3) { try { a.currentTime = BGM_DROP - secToDrop; } catch (_) {} }
}
function bgmDropNow() { bgm.target = null; try { bgm.a.playbackRate = 1; if (!bgm.a.paused && Math.abs(bgm.a.currentTime - BGM_DROP) > 0.12) bgm.a.currentTime = BGM_DROP - 0.02; } catch (_) {} }
function bgmEnd(ms) { bgm.target = null; if (!bgm.a.paused) bgmFade(0, ms); }

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
  const team = c.team === 'teamA' ? '1팀' : c.team === 'teamB' ? '2팀' : '';
  el('pg-sub').innerHTML = [team ? `<span class="tm">${team}</span>` : '', esc(c.champ || '')].filter(Boolean).join(' · ');
  el('pg-label').innerHTML = `<i class="en">${esc(enLabel(c.label))}</i><div class="ko"><b>${esc(c.label)}</b>${(c.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>`;
  // 🖼️ v0.1.43: 그 사람이 낀 스킨 일러스트(card.splash · 방장 앱이 CommunityDragon에서 찾아 줌) — 없거나 못 받으면 어두운 바탕 그대로
  const sp = el('pg-splash'); sp.getAnimations().forEach(a => a.cancel()); sp.style.opacity = '0';
  if (c.splash) { if (sp.getAttribute('src') !== c.splash) sp.src = c.splash; } else sp.removeAttribute('src');
  const en = intro.querySelector('.pg-intro-en'), hero = intro.querySelector('.pg-hero'), lab = el('pg-label'), slash = intro.querySelector('.pg-slash');
  [en, hero, lab, slash, el('pg-iflash')].forEach(n => n.getAnimations().forEach(a => a.cancel()));
  if (c.splash) go(sp, [{ opacity: 0, transform: 'scale(1.14)', filter: 'brightness(1.6) blur(3px)' }, { opacity: 1, transform: 'scale(1.06)', filter: 'brightness(1) blur(0)', offset: 0.18 }, { opacity: 1, transform: 'scale(1)', filter: 'brightness(1) blur(0)' }], { duration: 3500, easing: 'cubic-bezier(.2,.7,.3,1)' });   // 천천히 다가오는 줌(한 번만)
  go(slash, [{ opacity: 0, transform: 'skewX(-18deg) translateX(-60%)' }, { opacity: 1, transform: 'skewX(-18deg) translateX(0)' }], { duration: 520, delay: 80, easing: 'cubic-bezier(.15,.9,.25,1)' });
  go(en, [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 420, delay: 120 });   // 「쿵」(효과음 0.17초)에 맞춰
  go(hero, [{ opacity: 0, transform: 'translateY(18px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }], { duration: 420, delay: 480, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  go(lab, rgbIn('translateX(-30px)'), { duration: 460, delay: 950, easing: 'cubic-bezier(.15,.9,.3,1)' });
  playSfx('intro');   // 「PLAY OF THE GAME」 글자가 들어올 때 「쿵」(파일 0.17초)
  bgmStart(3.2 + (c.clip ? 0.25 + realToFreeze(c) : cardDropAt(c)));   // 영상이면 정지 화면, 카드면 마지막 킬 칸에서 「터짐」
  await sleep(3200); if (my !== run) return;
  // ② 장면 — 일러스트가 살짝 더 다가오며 섬광과 함께 빠짐
  el('pg-stage').style.display = '';
  go(el('pg-iflash'), [{ opacity: 0 }, { opacity: 0.55, offset: 0.25 }, { opacity: 0 }], { duration: 360, easing: 'ease-out' });
  go(intro, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.05)' }], { duration: 360, easing: 'ease-in' });
  setTimeout(() => { if (my === run) { intro.style.display = 'none'; intro.getAnimations().forEach(a => a.cancel()); } }, 360);
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
// 큰 영문 자막(v0.1.43) — e스포츠 하이라이트식 · 한글은 아래 팀 색 띠
const EN = { 처치: 'KILL', 킬: 'KILL', 솔로킬: 'SOLO KILL', 더블킬: 'DOUBLE KILL', 트리플킬: 'TRIPLE KILL', 쿼드라킬: 'QUADRA KILL', 펜타킬: 'PENTA KILL',
  '바론 스틸': 'BARON STEAL', '드래곤 스틸': 'DRAGON STEAL', '전령 스틸': 'HERALD STEAL', '공허 유충 스틸': 'VOIDGRUB STEAL', '아타칸 스틸': 'ATAKHAN STEAL' };
const enLabel = ko => EN[ko] || 'PLAY OF THE GAME';
const rgbIn = from => [   // 들어올 때만 빨강·청록으로 한 번 갈라졌다 붙음
  { opacity: 0, transform: from, textShadow: '-7px 0 rgba(255,40,80,0.9), 7px 0 rgba(0,230,255,0.9)' },
  { opacity: 1, transform: 'none', textShadow: '-3px 0 rgba(255,40,80,0.6), 3px 0 rgba(0,230,255,0.6)', offset: 0.45 },
  { opacity: 1, transform: 'none', textShadow: '0 0 transparent, 0 0 transparent' }];
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const killsAt = c => (c.kills && c.kills.length ? c.kills.map(k => k.t) : [c.obj ? c.obj.t : c.t1]).map(t => t - c.clipFrom);   // 영상 기준 킬 시각
const rateFor = ms => { const last = ms[ms.length - 1]; return t => { for (const m of ms) { if (m === last ? t >= m - 0.7 && t <= m + 0.45 : t >= m - 0.45 && t <= m + 0.3) return m === last ? 0.3 : 0.4; } return 1; }; };
function realBetween(rateAt, a, b) { let w = 0; for (let x = a; x < b; x += 0.02) w += 0.02 / rateAt(x); return w; }   // 영상 a→b초가 실제로 걸리는 시간(슬로모션 감안)
function realToFreeze(c) { const ms = killsAt(c); return realBetween(rateFor(ms), 0, ms[ms.length - 1] + 0.45); }
const cardDropAt = c => (400 + Math.max(0, ((c.kills || []).length || 1) - 1) * 380) / 1000;   // 카드: 마지막 킬 칸이 찍히는 시각(소개 뒤)
function playVideo(my) {
  return new Promise(resolve => {
    const v = el('pg-video'), c = card, fx = el('pg-fx'), wrap = el('pg-vwrap');
    const ms = killsAt(c);
    const last = ms[ms.length - 1], fired = new Set();
    let frozen = 0, raf = 0, rate = 1, done = false, slowFired = false;
    resetFx();
    fx.style.display = '';
    el('pg-tag').innerHTML = `${av(c.championId)}<div><small>PLAY OF THE GAME</small><b>${esc(c.name)}${c.champ ? ' · ' + esc(c.champ) : ''}</b>`
      + `<span class="pg-pips">${ms.map(() => '<i></i>').join('')}</span></div>`;   // 킬 칸 — 킬마다 하나씩 팀 색으로
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
    const rateAt = rateFor(ms);
    const finish = ok => { if (done) return; done = true; cancelAnimationFrame(raf); v.playbackRate = 1; resolve(ok && my === run); };
    const tick = () => {
      if (my !== run) return finish(false);
      const t = v.currentTime;
      if (!frozen) { const r = rateAt(t); if (r !== rate) { rate = r; v.playbackRate = r; } }
      { const gv = frozen === 1 ? 0 : rate < 1 ? 0.15 : 0.6; v.volume += (gv - v.volume) * 0.25; }   // 🎵 슬로모션 땐 게임 소리를 확 줄임(느리고 낮아진 게임 소리가 이상한 음악처럼 들렸음) — BGM·효과음이 이끔
      v.style.transform = `scale(${zoomAt(t).toFixed(4)})`;
      ms.forEach((m, i) => { if (!fired.has(i) && t >= m) { fired.add(i); onKill(i); } });
      if (!frozen) {   // 🎵 BGM 「터짐」을 정지 화면에 맞추고, 「느려지는 떨림」의 타격을 마지막 킬에 맞춤
        bgmRetarget(realBetween(rateAt, t, last + 0.45), rate === 1);
        if (!slowFired && t < last && realBetween(rateAt, t, last) <= SFX.slow.hit) { slowFired = true; playSfx('slow'); }
      }
      if (!frozen && t >= last + 0.45) {   // 마지막 킬 = 정지 화면
        frozen = 1; v.pause();
        playSfx('slam'); bgmDropNow();
        v.animate([{ filter: 'none' }, { filter: 'saturate(1.5) contrast(1.15) brightness(1.08)' }], { duration: 200, fill: 'forwards' });
        const lab = c.label || MULTI[Math.min(ms.length, 5) - 1];
        el('pg-kb').className = 'pg-kb final';
        el('pg-kb').innerHTML = `<div class="pg-kbt final"><i class="en">${esc(enLabel(lab))}</i><div class="ko"><b>${esc(lab)}</b>${(c.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div></div>`;
        go(el('pg-kb').firstChild, [{ opacity: 0, transform: 'scale(1.6)', filter: 'blur(8px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }], { duration: 320, easing: 'cubic-bezier(.2,1.3,.4,1)' });
        go(el('pg-kb').querySelector('.en'), rgbIn('none'), { duration: 420 });
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
        row.innerHTML = `${av(c.championId)}<i class="sw"></i>${av(k.championId, 'pg-av vic')}<span>${esc(k.victim)}</span>`;
        el('pg-feed').appendChild(row);
        go(row, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 260 });
      }
      const pip = el('pg-tag').querySelectorAll('.pg-pips i')[i];   // 이름표 킬 칸 채움
      if (pip) { pip.classList.add('on'); go(pip, [{ transform: 'skewX(-20deg) scaleY(2.4)' }, { transform: 'skewX(-20deg) scaleY(1)' }], { duration: 300 }); }
      if (i !== ms.length - 1) playSfx('hit');   // 중간 킬 「쾅」(마지막 킬은 「느려지는 떨림」의 타격 → 정지 화면 「쾅」)
      if (i !== ms.length - 1 && ms.length > 1) {   // 중간 킬 = 큰 영문 「KILL」「DOUBLE KILL」… + 한글 띠(잡힌 상대) · 마지막은 정지 화면에서 크게
        const ko = MULTI[Math.min(i, 4)];
        el('pg-kb').className = 'pg-kb';
        el('pg-kb').innerHTML = `<div class="pg-kbt"><i class="en">${esc(enLabel(ko))}</i><div class="ko"><b>${esc(ko)}</b>${k ? `<span>${av(k.championId)}<em>${esc(k.victim)}</em></span>` : ''}</div></div>`;
        const box = el('pg-kb').firstChild;
        go(box, [{ opacity: 0, transform: 'translateX(-40px)', clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, transform: 'translateX(0)', clipPath: 'inset(0 0 0 0)', offset: 0.16 },
          { opacity: 1, transform: 'translateX(6px)', clipPath: 'inset(0 0 0 0)', offset: 0.8 }, { opacity: 0, transform: 'translateX(30px)', clipPath: 'inset(0 0 0 0)' }], { duration: 1400, easing: 'linear' });
        go(box.querySelector('.en'), rgbIn('none'), { duration: 380 });
      }
    }
    v.preservesPitch = false;   // 슬로모션 때 소리도 낮고 무겁게
    v.volume = 0.6;             // 게임 소리는 BGM 밑으로
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
  el('pg-feed').innerHTML = ''; el('pg-kb').innerHTML = ''; el('pg-kb').className = 'pg-kb';
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
  box.classList.toggle('has-sp', !!c.splash); box.style.setProperty('--sp', c.splash ? `url("${c.splash}")` : 'none');   // 스킨 일러스트를 어둡게 깔아 줌
  box.style.display = '';
  const ks = [...box.querySelectorAll('.pg-kill')];
  ks.forEach((k, i) => go(k, [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, delay: 400 + i * 380, easing: 'cubic-bezier(.3,1.4,.5,1)' }));
  const my2 = run;   // 🎵 킬 칸마다 「쾅」 · 마지막 칸 = 정지 「쾅」+BGM 터짐
  ks.forEach((_, i) => bgm.timers.push(setTimeout(() => { if (my2 !== run) return; if (i === ks.length - 1) { playSfx('slam'); bgmDropNow(); } else playSfx('hit'); }, 400 + i * 380)));
  if (!ks.length) bgm.timers.push(setTimeout(() => { if (my2 === run) { playSfx('slam'); bgmDropNow(); } }, 400));
  await sleep(400 + ks.length * 380 + 2600);
}

function end(my) {
  if (my !== run) return;
  const c = card;
  el('pg-sum').innerHTML = `<b>${esc(c.name)}</b>${c.champ ? ' · ' + esc(c.champ) : ''} · ${esc(c.label)} · <span class="num">${mmss(c.t0)}</span>`;
  el('pg-save').style.display = clipPath ? '' : 'none';
  el('pg-end').style.display = '';
  bgm.timers.push(setTimeout(() => bgmEnd(2500), 2500));   // 터진 뒤 조금 더 들려주고 서서히
  if (!touched) idleTimer = setTimeout(() => window.api.potgClose(), 15000);   // 아무도 안 누르면 15초 뒤 닫힘
}

document.addEventListener('pointerdown', () => { touched = true; clearTimeout(idleTimer); });
el('pg-x').onclick = el('pg-close').onclick = () => { bgmStop(); window.api.potgClose(); };
el('pg-again').onclick = () => play();
el('pg-save').onclick = async () => {
  const r = await window.api.potgSave(card.clip, card.name).catch(() => null);
  el('pg-msg').textContent = r && r.ok ? `저장했어요 · ${r.path}` : r && r.canceled ? '' : '저장하지 못했어요';
};
