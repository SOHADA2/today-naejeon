// 🏆 「대회」 탭(v0.1.291) — 오른쪽 창 · 대진표(싱글 토너먼트) / 순위·경기(풀리그) · 팀 · 방장은 경기 줄에서 「이 방에서 시작」
//   자료 = window.api.tourneyData(force) (main tourneyView) · 대회는 운영자가 운영 보드에서 만듦 · 앱은 보기 + 경기 시작만
//   탭은 보여 줄 대회(진행 중·끝남)가 있을 때만 나옴 — 10분마다 있는지 확인 · 탭을 보고 있는 동안은 30초마다 새로(전송량 아끼기)
//   ⚖️ 라이엇 커뮤니티 대회 지침(2026-08-03): 공식 대회가 아님을 분명히 → 맨 아래 한 줄
(function () {
  const BO = bo => bo === 5 ? '5판 3선승' : bo === 3 ? '3판 2선승' : '단판';
  const T = { data: null, sel: null, html: '', busy: false, open: {}, err: '' };
  const tab = $('sp-tab-tour'), body = $('tr-body');
  if (!tab || !body || !window.api.tourneyData) return;
  async function load(force) {
    const d = await window.api.tourneyData(!!force).catch(() => null);
    if (!d || !d.ok) return;
    T.data = d;
    const has = d.list.length > 0;
    tab.style.display = has ? '' : 'none';
    if (!has && _curCat === 'tour') switchCat('home');
    if (!T.sel || !d.list.some(x => x.id === T.sel)) T.sel = has ? d.list[0].id : null;
    if (_curCat === 'tour') draw();
  }
  const stTag = m => m.how === 'bye' ? '<span class="tr-st">부전승</span>' : m.cur ? '<span class="tr-st cur">대기실에 올라감</span>'
    : m.state === 'live' ? '<span class="tr-st live">진행 중</span>' : m.state === 'done' ? (m.how === 'admin' ? '<span class="tr-st">운영자 판정</span>' : '') : m.state === 'ready' ? '<span class="tr-st">대기</span>' : '';
  function matchH(t, m, title) {
    const row = (tm, sc, side) => { const win = m.win && tm && m.win === tm.id, lose = m.win && tm && m.win !== tm.id;
      return `<div class="tr-row${win ? ' win' : ''}${lose ? ' lose' : ''}${tm && t.myTeam === tm.id ? ' me' : ''}"><i class="${side}"></i><span class="tr-n">${tm ? escH(tm.name) : '<em>미정</em>'}</span>${tm && tm.tag ? `<small>${escH(tm.tag)}</small>` : ''}<b class="num">${m.how === 'bye' || !m.a || !m.b ? '' : sc}</b></div>`; };
    if (m.how === 'bye') { const tm = m.a || m.b;   // 부전승 = 한 줄로
      return `<div class="tr-m bye${m.mine ? ' mine' : ''}"><div class="tr-row${tm && t.myTeam === tm.id ? ' me' : ''}"><i class="t1"></i><span class="tr-n">${tm ? escH(tm.name) : ''}</span><span class="tr-st">${title} · 부전승</span></div></div>`; }
    const can = T.data.canStart && t.st === 'live' && m.a && m.b && m.state !== 'done';
    const act = m.cur ? (T.data.canStart ? `<button class="tr-go plain" data-cancel="1">취소</button>` : '') : can ? `<button class="tr-go" data-go="${escH(m.id)}">이 방에서 시작</button>` : '';
    return `<div class="tr-m${m.mine ? ' mine' : ''}${m.state === 'live' || m.cur ? ' live' : ''}"><div class="tr-mh"><span>${title}</span><small>${BO(m.bo)}</small>${stTag(m)}${act}</div>${row(m.a, m.sa, 't1')}${row(m.b, m.sb, 't2')}</div>`;
  }
  function draw() {
    const d = T.data; if (!d) { body.innerHTML = '<div class="td-empty">불러오는 중</div>'; return; }
    const t = d.list.find(x => x.id === T.sel);
    if (!t) { body.innerHTML = '<div class="td-empty"><b>진행 중인 대회가 없습니다</b></div>'; return; }
    const pick = d.list.length > 1 ? `<div class="tr-pick">${d.list.map(x => `<button class="${x.id === t.id ? 'on' : ''}" data-sel="${escH(x.id)}">${escH(x.name)}${x.st === 'done' ? '<small>끝</small>' : ''}</button>`).join('')}</div>` : '';
    const fmtTx = (t.fmt === 'rr' ? '풀리그' : '싱글 토너먼트') + ' · ' + BO(t.bo) + (t.fmt !== 'rr' && t.boF && t.boF !== t.bo ? ` · 결승 ${BO(t.boF)}` : '');
    const my = t.teams.find(x => x.id === t.myTeam);
    const head = `<div class="sp-card tr-head${t.champ ? ' done' : ''}"><div class="sp-hd"><div class="sp-hd-tx"><span class="sp-en">TOURNAMENT</span><b class="sp-t">${escH(t.name)}</b></div><span class="tr-live ${t.st}">${t.st === 'done' ? '끝남' : '진행 중'}</span></div>`
      + `<span class="sp-note">${fmtTx} · ${t.teams.length}팀${my ? ` · 내 팀 <b>${escH(my.name)}</b>` : ''}</span>`
      + (t.champ ? `<div class="tr-champ"><span class="sp-en">CHAMPION</span><b>🏆 ${escH(t.champ.name)}</b></div>` : '')
      + (d.canStart && t.st === 'live' ? '<span class="tr-hint">방장 · 경기의 「이 방에서 시작」을 누르면 대기실에 두 팀이 올라갑니다</span>' : '')
      + (T.err ? `<span class="hm-err">${escH(T.err)}</span>` : '') + '</div>';
    let mid = '';
    if (t.fmt === 'rr' && t.standings) mid += '<div class="td-sec">순위<small>시리즈 승 → 판 득실</small></div><table class="td-table tr-tb"><thead><tr><th>#</th><th class="n">팀</th><th>승</th><th>패</th><th>판</th></tr></thead><tbody>'
      + t.standings.map(p => `<tr class="${p.id === t.myTeam ? 'me' : ''}"><td class="r">${p.rank}</td><td class="n">${escH(p.name)}</td><td>${p.w}</td><td>${p.l}</td><td>${p.gw}-${p.gl}</td></tr>`).join('') + '</tbody></table>';
    for (const r of t.rounds) { if (!r.matches.length) continue;
      mid += `<div class="td-sec">${escH(r.name)}<small>${r.matches.filter(m => m.state === 'done').length}/${r.matches.length}</small></div>` + r.matches.map(m => matchH(t, m, r.matches.length > 1 ? `${m.no}경기` : escH(r.name))).join(''); }
    const ROLE = { cap: '팀장', sub: '후보' };
    const teams = '<div class="td-sec">팀<small>누르면 선수</small></div>' + t.teams.map(tm => { const op = T.open[tm.id] || (tm.mine && T.open[tm.id] !== false);
      return `<div class="tr-team${tm.mine ? ' mine' : ''}${op ? ' open' : ''}"><button class="tr-th" data-team="${escH(tm.id)}"><b>${escH(tm.name)}</b>${tm.tag ? `<small>${escH(tm.tag)}</small>` : ''}<span>${tm.mem.length}명</span><em>${op ? '▴' : '▾'}</em></button>`
        + (op ? `<div class="tr-mem">${tm.mem.map(x => `<span class="${x.r}"><a class="pf-link" data-name="${escH(x.n)}">${escH(x.n)}</a>${ROLE[x.r] ? `<small>${ROLE[x.r]}</small>` : ''}</span>`).join('') || '<span>등록된 선수가 없습니다</span>'}</div>` : '') + '</div>'; }).join('');
    const h = pick + head + mid + teams + '<p class="tr-legal">커뮤니티가 여는 대회입니다 · 라이엇 게임즈·LoL e스포츠의 공식 대회가 아닙니다</p>';
    if (h === T.html) return; T.html = h; body.innerHTML = h;
    body.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { T.sel = b.dataset.sel; T.err = ''; draw(); });
    body.querySelectorAll('[data-team]').forEach(b => b.onclick = () => { const k = b.dataset.team, tm = t.teams.find(x => x.id === k); const cur = T.open[k] || (tm && tm.mine && T.open[k] !== false); T.open[k] = !cur; draw(); });
    body.querySelectorAll('.pf-link').forEach(a => a.onclick = () => openProfile({ name: a.dataset.name }));
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => act(() => window.api.tourneyStart(t.id, b.dataset.go), `「${t.name}」 ${b.closest('.tr-m').querySelector('.tr-mh span').textContent} 을(를) 이 방에서 시작할까요?\n대기실에 두 팀 등록 선수가 올라가고, 다른 사람은 관전이 됩니다.`));
    body.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => act(() => window.api.tourneyCancel()));
  }
  async function act(fn, ask) {
    if (T.busy) return; if (ask && !await tnConfirm(ask, { ok: '시작' })) return;
    T.busy = true; T.err = '';
    const r = await fn().catch(e => ({ ok: false, err: String(e) }));
    T.busy = false; if (!r || !r.ok) T.err = (r && r.err) || '실패했습니다 · 다시 눌러 주세요';
    await load(true); draw();
  }
  window.renderTourney = () => { draw(); load(false); };
  window.tourneyReload = load;
  setTimeout(() => load(false), 4000);
  setInterval(() => { if (document.hidden) return; if (_curCat === 'tour') load(false); }, 30000);
  setInterval(() => { if (!document.hidden && _curCat !== 'tour') load(false); }, 600000);
})();
