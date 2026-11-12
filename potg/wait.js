// ⏳ 팟지 기다림 화면(2026-11-01 · 사장님: 팟지 녹화하는 1~2분이 붕 뜸) — 녹화하는 동안 가운데 창에서
//   맨 위 = 진행 막대(퍼센트·남은 시간·단계) · 아래 = 탭(자동으로 9초마다 넘어감 · 누르면 20초 멈춤)
//   🔮 예측(누가 팟지일까? 후보 2~3 · 한 표 · 실시간 표 수) · 📊 기록(피해량·받은 피해·힐·CC 상위 5) · 🎉 재미(캐리·탱커·힐러·CC·버스·최다 데스·퍼블·멀티킬·골드·KDA·천적)
//   🗺️ 킬 지도(칼바람 다리 + 킬 자리 + 시간 줄) · 🧩 증강(10명이 고른 증강) · 🏆 오늘(순위 변화·연승·오늘의 예측왕·투표 현황)
//   데이터 = main waitView(today/potgWait + 경기 기록) 'potg-wait' 3초마다·표 바뀔 때 · 진행 막대 'potg-wait-prog' 0.5초마다(녹화하는 앱)
//   팟지가 공개되면('potg') 이 화면은 숨고 바로 소개로 · 무한 애니메이션 없음(값이 바뀔 때만 transition)
(() => {
  const $ = id => document.getElementById(id);
  const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = id => id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${Number(id)}.png` : '';
  const face = (id, cls, name) => `<span class="wr-av ${cls || ''}" data-n="${E(String(name || '').slice(0, 1))}">${id ? `<img src="${ICON(id)}" alt="" onerror="this.remove()">` : ''}</span>`;
  const num = n => Math.round(n || 0).toLocaleString('en-US');
  const mmss = s => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
  const room = $('pg-room');
  let V = null, tab = null, autoAt = 0, holdUntil = 0, sigs = {}, timer = null;

  const TABS = [
    { k: 'guess', t: '예측', ok: v => v.cands && v.cands.length >= 2 },
    { k: 'stats', t: '기록', ok: v => v.stats && v.stats.length },
    { k: 'fun', t: '재미', ok: v => v.stats && v.stats.length },
    { k: 'map', t: '킬 지도', ok: v => v.kills && v.kills.length },
    { k: 'aug', t: '증강', ok: v => v.stats && v.stats.some(p => p.aug && p.aug.length) },
    { k: 'today', t: '오늘', ok: v => v.today && (v.today.rows.length || v.today.kings.length || v.today.normal) },
  ];
  const teamName = (tm, v) => v.kind === 'normal' ? (tm === 100 ? '블루' : '레드') : (tm === 100 ? '1팀' : '2팀');

  // ── 맨 위: 진행 막대 ──
  const STEPS = v => ['리플레이', v.hero ? '팟지 장면' : '장면 녹화'].concat(v.hero ? ['숨은 영웅'] : []).concat(['올리기']);
  function stepOf(sub, v) {
    const s = String(sub || '');
    if (/올리는 중|정리/.test(s)) return STEPS(v).length - 1;
    if (/장면 2\/2/.test(s)) return 2;
    if (/장면/.test(s)) return 1;
    return 0;
  }
  function prog(p) {
    if (!V) return;
    p = p || V.prog || {};
    const pct = p.pct == null ? null : p.pct;
    $('wr-pct').innerHTML = pct == null ? '' : `${pct}<small>%</small>`;
    $('wr-left').textContent = pct == null ? '' : `약 ${p.left}초 남음`;
    $('wr-bar').style.width = (pct || 2) + '%';
    const st = stepOf(p.sub, V);
    [...$('wr-steps').children].forEach((n, i) => { n.classList.toggle('done', i < st); n.classList.toggle('on', i === st); });
  }

  // ── 탭 ──
  function tabs() {
    const list = TABS.filter(x => x.ok(V));
    if (!list.some(x => x.k === tab)) tab = list[0] ? list[0].k : null;
    const html = list.map(x => `<button data-k="${x.k}" class="${x.k === tab ? 'on' : ''}">${E(x.t)}${x.k === 'guess' && V.mine == null ? '<i class="dot"></i>' : ''}</button>`).join('');
    if ($('wr-tabs').innerHTML !== html) $('wr-tabs').innerHTML = html;
    return list;
  }
  $('wr-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.k; holdUntil = Date.now() + 20000; autoAt = Date.now(); render(true); });

  // ── 🔮 예측 ──
  function guess(v) {
    const tot = Object.values(v.counts || {}).reduce((a, b) => a + b, 0);
    return `<div class="wr-h"><b>이번 판 팟지는 누구일까요?</b><span>영상이 뜨면 정답 공개 · 맞히면 오늘의 예측왕</span></div>
      <div class="wr-cands n${v.cands.length}">${v.cands.map((c, i) => {
        const n = (v.counts || {})[i] || 0, me = v.mine === i;
        return `<button class="wr-cand t${c.team === 'teamB' ? 2 : 1}${me ? ' me' : ''}" data-i="${i}">
          ${face(c.championId, 'big', c.champ)}<b class="nm">${E(c.name)}</b><span class="ch">${E(c.champ)}</span><em class="lb">${E(c.label)}</em>
          <span class="cnt"><i style="width:${tot ? Math.round(n / tot * 100) : 0}%"></i></span><small class="num">${n}표</small>${me ? '<span class="mine">내 선택</span>' : ''}</button>`;
      }).join('')}</div>
      <div class="wr-foot">${v.mine == null ? '눌러서 한 표 · 바꿀 수 있어요' : `투표 완료 · ${v.voters}명 참여`}</div>`;
  }
  room.addEventListener('click', e => { const b = e.target.closest('.wr-cand'); if (!b || !window.api.potgGuess) return; window.api.potgGuess(+b.dataset.i); holdUntil = Date.now() + 6000; });

  // ── 📊 이번 판 기록 ──
  function stats(v) {
    const box = (title, f, unit) => {
      const xs = v.stats.slice().sort((a, b) => f(b) - f(a)).filter(p => f(p) > 0).slice(0, 5), top = xs.length ? f(xs[0]) : 1;
      return `<div class="wr-chart"><h4>${E(title)}</h4>${xs.map(p => `<div class="row tm${p.tm === 200 ? 2 : 1}">${face(p.c, 'sm', p.cn)}<span class="nm">${E(p.n)}</span>
        <span class="bar"><i style="width:${Math.max(3, f(p) / top * 100)}%"></i></span><b class="num">${num(f(p))}${unit || ''}</b></div>`).join('') || '<div class="none">기록 없음</div>'}</div>`;
    };
    return `<div class="wr-grid4">${box('피해량', p => p.dmg)}${box('받은 피해', p => p.tk)}${box('아군 힐·보호막', p => p.heal || p.selfHeal)}${box('CC 건 시간', p => p.cc, '초')}</div>`;
  }

  // ── 🎉 재미 지표 ──
  function fun(v) {
    const S = v.stats, by = f => S.slice().sort((a, b) => f(b) - f(a))[0], out = [];
    const add = (ic, t, p, val) => { if (p) out.push({ ic, t, p, val }); };
    const carry = by(p => p.dmg); add('⚔️', '캐리', carry, `피해량 ${num(carry.dmg)}`);
    const tank = by(p => p.tk); if (tank !== carry) add('🛡️', '탱커', tank, `받은 피해 ${num(tank.tk)}`);
    const heal = by(p => p.heal); if (heal && heal.heal >= 2000) add('💚', '힐러', heal, `힐·보호막 ${num(heal.heal)}`);
    const cc = by(p => p.cc); if (cc && cc.cc >= 20) add('🌀', 'CC 장인', cc, `CC ${num(cc.cc)}초`);
    const multi = by(p => p.multi); if (multi && multi.multi >= 2) add('🔥', ['', '', '더블킬', '트리플킬', '쿼드라킬', '펜타킬'][multi.multi], multi, '이번 판 최고 연속 처치');
    const kda = by(p => (p.k + p.a) / Math.max(1, p.d)); add('🎯', 'KDA 왕', kda, `${kda.k}/${kda.d}/${kda.a}`);
    const fb = S.find(p => p.fb); add('🩸', '퍼스트 블러드', fb, '첫 킬');
    const gold = by(p => p.gold); add('💰', '골드왕', gold, `${num(gold.gold)} 골드`);
    const win = S.filter(p => p.win), bus = win.slice().sort((a, b) => a.dmg - b.dmg)[0];
    if (bus && bus !== carry && bus !== tank && bus !== heal) add('🚌', '버스 탑승', bus, `이긴 팀 피해량 꼴찌 ${num(bus.dmg)}`);
    const dead = by(p => p.d); if (dead && dead.d >= 5) add('💀', '최다 데스', dead, `${dead.d}번`);
    // 천적 = 킬 지도 기록에서 같은 사람이 같은 사람을 2번 이상(챔피언 기준)
    const pair = {}; for (const k of (v.kills || [])) if (k.k && k.v) pair[k.k + '>' + k.v] = (pair[k.k + '>' + k.v] || 0) + 1;
    const best = Object.entries(pair).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2) { const [kc, vc] = best[0].split('>').map(Number), kp = S.find(p => p.c === kc), vp = S.find(p => p.c === vc); if (kp && vp) out.push({ ic: '😈', t: '천적', p: kp, val: `${vp.n}(${vp.cn})을 ${best[1]}번`, vs: vp }); }
    return `<div class="wr-fun">${out.slice(0, 10).map(x => `<div class="wr-card tm${x.p.tm === 200 ? 2 : 1}"><span class="ic">${x.ic}</span><div class="tx"><em>${E(x.t)}</em><b>${E(x.p.n)}</b><small>${E(x.p.cn)} · ${E(x.val)}</small></div>${face(x.p.c, 'md', x.p.cn)}</div>`).join('')}</div>`;
  }

  // ── 🗺️ 킬 지도 — 칼바람 다리(replayrec.js LANE12·TOWERS12와 같은 지도: 이 PC 전적 20판 위치) 가로로 펼침 · 블루 기지 왼쪽 ──
  const LANE = [[-7200,-840,334],[-6600,-1121,1344],[-6000,-1040,935],[-5400,-1251,1085],[-4800,-1308,872],[-4200,-691,779],[-3600,-621,845],[-3000,-544,819],[-2400,-608,791],[-1800,-623,793],[-1200,-559,763],[-600,-583,658],[0,-603,544],[600,-540,722],[1200,-569,771],[1800,-579,741],[2400,-530,825],[3000,-589,617],[3600,-486,678],[4200,-698,701],[4800,-1071,969],[5400,-1143,1005],[6000,-1058,837],[6600,-1138,400],[7200,-607,256]];
  const TOWERS = [[4950, 4950], [3850, 3850], [3100, 3200], [2050, 2600], [2500, 2100], [7900, 7750], [9000, 8850], [9700, 9550], [10350, 10550], [10800, 10100]];
  const A = 43.7 * Math.PI / 180, toSP = (x, y) => { const dx = x - 6534, dy = y - 6335; return [dx * Math.cos(A) + dy * Math.sin(A), -dx * Math.sin(A) + dy * Math.cos(A)]; };
  function map(v) {
    const W = 1000, H = 260, X = s => (s + 7600) / 15200 * W, Y = p => H / 2 - p * (H / 2 - 12) / 1400;
    const band = 'M' + LANE.map(([s, , hi]) => `${X(s).toFixed(1)},${Y(hi).toFixed(1)}`).join(' L') + ' L' + LANE.slice().reverse().map(([s, lo]) => `${X(s).toFixed(1)},${Y(lo).toFixed(1)}`).join(' L') + ' Z';
    const towers = TOWERS.map(([x, y]) => { const [s, p] = toSP(x, y); return `<rect x="${(X(s) - 5).toFixed(1)}" y="${(Y(p) - 5).toFixed(1)}" width="10" height="10" transform="rotate(45 ${X(s).toFixed(1)} ${Y(p).toFixed(1)})" class="${s < 0 ? 'tb' : 'tr'}"/>`; }).join('');
    const ks = v.kills.slice().sort((a, b) => a.t - b.t);
    const dots = ks.map((k, i) => { const [s, p] = toSP(k.x, k.y); return `<circle cx="${X(s).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="7" class="${k.tm === 200 ? 'kr' : 'kb'}" style="animation-delay:${(i * 0.04).toFixed(2)}s"/>`; }).join('');
    const T = Math.max(v.gameTime || 0, ks.length ? ks[ks.length - 1].t + 30 : 60);
    const ticks = ks.map(k => `<i class="${k.tm === 200 ? 'kr' : 'kb'}" style="left:${(k.t / T * 100).toFixed(2)}%"></i>`).join('');
    const nb = ks.filter(k => k.tm !== 200).length, nr = ks.length - nb;
    return `<div class="wr-h"><b>킬 지도</b><span><em class="kb">●</em> ${teamName(100, v)} ${nb}킬 · <em class="kr">●</em> ${teamName(200, v)} ${nr}킬 · 왼쪽 = 블루 기지</span></div>
      <svg class="wr-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><path d="${band}" class="band"/><line x1="${X(0)}" y1="14" x2="${X(0)}" y2="${H - 14}" class="mid"/>${towers}${dots}</svg>
      <div class="wr-time"><div class="ax">${ticks}</div><span class="num">0:00</span><span class="num">${mmss(T)}</span></div>`;
  }

  // ── 🧩 증강 ──
  function aug(v) {
    const col = tm => v.stats.filter(p => p.tm === tm).map(p => `<div class="wr-arow">${face(p.c, 'sm', p.cn)}<span class="nm">${E(p.n)}</span><span class="augs">${(p.aug || []).map(id => { const a = v.augs[id] || {}; return `<span class="ag ${E(a.rarity || '')}" title="${E(a.name || '#' + id)}">${a.icon ? `<img src="${E(a.icon)}" alt="">` : '?'}</span>`; }).join('')}</span></div>`).join('');
    const cnt = {}; for (const p of v.stats) for (const id of (p.aug || [])) cnt[id] = (cnt[id] || 0) + 1;
    const pop = Object.entries(cnt).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${E((v.augs[id] || {}).name || '#' + id)} ×${n}`).join(' · ');
    return `<div class="wr-h"><b>이번 판 증강</b><span>${pop ? '여럿이 고른 증강 · ' + pop : '아이콘에 마우스를 올리면 이름'}</span></div>
      <div class="wr-aug"><div class="col tm1"><h4>${teamName(100, v)}</h4>${col(100)}</div><div class="col tm2"><h4>${teamName(200, v)}</h4>${col(200)}</div></div>`;
  }

  // ── 🏆 오늘 ──
  function today(v) {
    const T = v.today || { rows: [], kings: [] };
    const rows = T.rows.filter(r => r.here).concat(T.rows.filter(r => !r.here)).slice(0, 8).sort((a, b) => a.rank - b.rank);
    const ch = r => r.prev == null ? '<i class="new">NEW</i>' : r.prev > r.rank ? `<i class="up">▲${r.prev - r.rank}</i>` : r.prev < r.rank ? `<i class="dn">▼${r.rank - r.prev}</i>` : '<i class="eq">–</i>';
    const left = v.kind === 'match' && rows.length ? `<div class="wr-rank"><h4>오늘 순위 · 이번 판 반영</h4>${rows.map(r => `<div class="row${r.here ? ' here' : ''}${r.name === v.me ? ' me' : ''}"><b class="num rk">${r.rank}</b>${ch(r)}<span class="nm">${E(r.name)}</span><span class="num wl">${r.w}승 ${r.l}패</span>${r.streak >= 2 ? `<em class="st">${r.streak}연승</em>` : r.streak <= -2 ? `<em class="st cold">${-r.streak}연패</em>` : ''}</div>`).join('')}</div>`
      : T.normal ? `<div class="wr-rank"><h4>오늘 같이 한 일반 판</h4><div class="big num">${T.normal.w}승 ${T.normal.l}패</div></div>` : '';
    const kings = `<div class="wr-kings"><h4>🔮 오늘의 예측왕</h4>${T.kings.length ? T.kings.map((k, i) => `<div class="row"><b class="num">${i + 1}</b><span class="nm">${E(k.name)}</span><em class="num">${k.n}번 맞힘</em></div>`).join('') : '<div class="none">아직 없어요 · 이번 판이 첫 기회!</div>'}
      ${v.votes ? `<h4 class="vt">MVP·매너 투표</h4><div class="vbar"><i style="width:${v.votes.all ? Math.round(v.votes.done / v.votes.all * 100) : 0}%"></i></div><small>${v.votes.done}/${v.votes.all}명 완료</small>` : ''}</div>`;
    return `<div class="wr-today">${left}${kings}</div>`;
  }

  const BODY = { guess, stats, fun, map, aug, today };
  function render(force) {
    if (!V) return;
    const list = tabs();
    if (!tab) { $('wr-body').innerHTML = '<div class="none">이번 판 기록을 불러오는 중…</div>'; return; }
    // 자동 넘김 — 예측은 아직 안 찍었으면 조금 더(12초) 머묾
    const stay = tab === 'guess' && V.mine == null ? 12000 : 9000;
    if (!force && Date.now() > holdUntil && Date.now() - autoAt > stay && list.length > 1) { const i = list.findIndex(x => x.k === tab); tab = list[(i + 1) % list.length].k; autoAt = Date.now(); tabs(); force = true; }
    const html = BODY[tab](V), sig = tab + '|' + html.length + '|' + html.slice(-200) + '|' + html.slice(0, 200);
    if (!force && sigs.body === sig) return;
    const changedTab = sigs.tab !== tab; sigs.body = sig; sigs.tab = tab;
    $('wr-body').innerHTML = html; $('wr-body').className = 'wr-body k-' + tab + (changedTab ? ' fresh' : '');
  }

  function show(v) {
    const first = !V;
    V = v; room.style.display = '';
    if (first) { autoAt = Date.now(); $('wr-steps').innerHTML = STEPS(v).map(s => `<span>${E(s)}</span>`).join(''); }
    $('wr-who').textContent = v.skipped ? `${v.skipped === v.me ? '내가' : v.skipped + '님이'} 이번 판 팟지를 건너뛰었어요`   // 🚫 v0.1.118
      : v.who && v.me && v.who === v.me ? '내 PC에서 리플레이로 찍는 중' : v.who ? `${v.who}님 PC에서 리플레이로 찍는 중` : '리플레이로 찍는 중';   // v0.1.92: 방장 본인은 자기 PC가 찍는 걸 알게
    room.classList.toggle('skipped', !!v.skipped);
    { // 🚫 v0.1.190 건너뛰면 모두에게 가운데 큰 안내(사장님: 팀원도 건너뛴 걸 알게 — 예전엔 위 작은 글 한 줄뿐)
      const sk = $('wr-skipped');
      if (sk) { const was = !sk.hidden; sk.hidden = !v.skipped; if (v.skipped && !was) { $('wr-sk-who').textContent = v.skipped === v.me ? '내가 이번 판 팟지를 건너뛰었어요' : `${v.skipped}님이 이번 판 팟지를 건너뛰었어요`; } }
      const t = room.querySelector('.wr-ttl b'); if (t) t.textContent = v.skipped ? '팟지 건너뜀' : '팟지 준비 중';
    }
    skipBtn(v);
    prog(); render();
    clearInterval(timer); timer = setInterval(() => render(), 1000);   // 자동 넘김 확인(그리는 건 바뀔 때만)
  }
  // 🚫 v0.1.118 팟지 건너뛰기(사장님: 노잼판) — 녹화하는 PC에만(v.canSkip) · 실수 방지로 두 번 눌러야(3초 안) · 누르면 main 'potg-cancel'
  let armT = null;
  function skipBtn(v) {
    const b = $('wr-skip'); if (!b) return;
    b.hidden = !v.canSkip || !!v.skipped;
    if (b.hidden) { b.classList.remove('arm'); return; }
    b.onclick = () => {
      if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '한 번 더 누르면 건너뛰어요'; clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('arm'); b.textContent = '팟지 건너뛰기'; }, 3000); return; }
      clearTimeout(armT); b.disabled = true; b.textContent = '건너뛰는 중…';
      try { window.api.potgCancel(); } catch (_) {}
    };
  }
  function hide() { room.style.display = 'none'; V = null; { const sk = $('wr-skipped'); if (sk) sk.hidden = true; } sigs = {}; tab = null; clearInterval(timer); const b = $('wr-skip'); if (b) { b.hidden = true; b.disabled = false; b.classList.remove('arm'); b.textContent = '팟지 건너뛰기'; } }
  if (window.api && window.api.onPotgWait) {
    window.api.onPotgWait(show);
    window.api.onPotgWaitProg(p => { if (V) prog(p); });
    window.api.onPotg(() => hide());
  }
})();
