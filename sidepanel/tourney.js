// 🏆 「대회」 탭(v0.1.291 · v0.1.292 다시 짬) — 오른쪽 창
//   v0.1.292(사장님: 레이아웃·디자인이 별로 · 더 직관적이고 딱 맞게) = 경기 카드를 세로로 쌓던 것 →
//     ① 머리(대회 이름·형식·상태·우승) ② **경기 카드 하나**(내 경기 먼저 · 크게 「불꽃 1 : 0 번개」 · 방장 = 「이 방에서 시작」)
//     ③ **대진표 그림**(싱글 토너먼트 = 선으로 이어진 트리 · 창 폭에 딱 맞춤 · 칸을 누르면 ②가 그 경기로) / 풀리그 = 순위표 + 한 줄짜리 경기 줄 ④ 팀(2칸 격자 · 누르면 선수)
//   자료 = window.api.tourneyData(force) (main tourneyView) · 대회는 운영자가 운영 보드에서 만듦 · 앱은 보기 + 경기 시작만
//   탭은 보여 줄 대회(진행 중·끝남)가 있을 때만 나옴 — 10분마다 있는지 확인 · 탭을 보고 있는 동안은 30초마다 새로(전송량 아끼기)
//   ⚖️ 라이엇 커뮤니티 대회 지침(2026-08-03): 공식 대회가 아님을 분명히 → 맨 아래 한 줄
(function () {
  const BO = bo => bo === 5 ? '5판 3선승' : bo === 3 ? '3판 2선승' : '단판';
  const T = { data: null, sel: null, html: '', busy: false, team: null, pick: null, err: '' };
  const tab = $('sp-tab-tour'), body = $('tr-body');
  if (!tab || !body || !window.api.tourneyData) return;
  async function load(force) {
    const d = await window.api.tourneyData(!!force).catch(() => null);
    if (!d || !d.ok) return;
    T.data = d;
    const has = d.list.length > 0;
    tab.style.display = has ? '' : 'none';
    if (!has && _curCat === 'tour') switchCat('home');
    if (!T.sel || !d.list.some(x => x.id === T.sel)) { T.sel = has ? d.list[0].id : null; T.pick = null; T.team = null; }
    if (_curCat === 'tour') draw();
  }
  const ST = m => m.how === 'bye' ? '부전승' : m.how === 'admin' ? '운영자 판정' : m.cur ? '대기실에 올라감' : { wait: '앞 경기 대기', ready: '대기', live: '진행 중', done: '끝' }[m.state] || '';
  const all = t => t.rounds.flatMap(r => r.matches.map(m => Object.assign({ rn: r.name, multi: r.matches.length > 1 }, m)));
  const title = m => m.multi ? `${m.rn} ${m.no}경기` : m.rn;
  // 보여 줄 경기 = 누른 것 → 대기실에 올라간 것 → 내 팀의 안 끝난 경기 → 진행 중 → 대기 → 마지막(결승)
  function focusOf(t) {
    const L = all(t).filter(m => m.how !== 'bye'), open = m => m.state !== 'done';
    return L.find(m => m.id === T.pick) || L.find(m => m.cur) || L.find(m => m.mine && open(m) && m.a && m.b) || L.find(m => m.mine && open(m)) || L.find(m => m.state === 'live') || L.find(m => m.state === 'ready') || L[L.length - 1] || null;
  }
  function focusH(t, m, d) {
    if (!m) return '';
    const nm = (tm, cls) => `<b class="tf-n ${cls}${m.win && tm && m.win === tm.id ? ' win' : ''}${m.win && tm && m.win !== tm.id ? ' lose' : ''}">${tm ? escH(tm.name) : '미정'}</b>`;
    const can = d.canStart && t.st === 'live' && m.a && m.b && m.state !== 'done';
    const foot = m.cur ? `<div class="tf-foot"><span>대기실에 올라가 있습니다</span>${d.canStart ? '<button class="tr-go plain" data-cancel="1">취소</button>' : ''}</div>`
      : can ? `<button class="ui-btn-gold tf-go" data-go="${escH(m.id)}">이 방에서 시작</button>`
      : m.state === 'done' ? '' : m.mine && m.a && m.b ? '<div class="tf-foot"><span>방장이 방에서 이 경기를 시작하면 대기실에 올라옵니다</span></div>'
      : !m.a || !m.b ? '<div class="tf-foot"><span>앞 경기가 끝나면 상대가 정해집니다</span></div>' : '';
    return `<div class="tr-focus${m.mine ? ' mine' : ''}${m.state === 'live' || m.cur ? ' live' : ''}${m.state === 'done' ? ' done' : ''}"><div class="tf-h"><b>${m.mine ? '내 경기 · ' : ''}${escH(title(m))}</b><small>${BO(m.bo)}</small><span class="tr-st${m.state === 'live' || m.cur ? ' live' : ''}">${ST(m)}</span></div>`
      + `<div class="tf-vs">${nm(m.a, 't1')}<span class="tf-sc num${m.n > 0 ? '' : ' vs'}">${m.n > 0 ? `${m.sa} : ${m.sb}` : 'VS'}</span>${nm(m.b, 't2')}</div>${foot}</div>`;
  }
  // 싱글 토너먼트 대진표 = 라운드마다 한 열 · 칸 높이를 똑같이 나눠 선이 맞물림 · 부전승 칸은 비움(그 팀은 다음 열에 바로 보임)
  function bracketH(t, fm) {
    const n = t.rounds.length, short = n >= 3;
    const slot = (m, tm, sc) => `<span class="bk-t${m.win && tm && m.win === tm.id ? ' win' : ''}${m.win && tm && m.win !== tm.id ? ' lose' : ''}${tm && t.myTeam === tm.id ? ' me' : ''}"><i>${tm ? escH(short && tm.tag ? tm.tag : tm.name) : ''}</i><b class="num">${tm && m.a && m.b && m.n > 0 ? sc : ''}</b></span>`;
    return `<div class="bk r${Math.min(n, 4)}">${t.rounds.map((r, ri) => `<div class="bk-col"><div class="bk-rn">${escH(r.name)}</div><div class="bk-cells">${r.matches.map(m => m.how === 'bye' && ri === 0
      ? `<div class="bk-cell"><div class="bk-m bye" title="${escH(((m.a || m.b) || {}).name || '')} · 부전승"><span class="bk-t${(m.a || m.b) && t.myTeam === (m.a || m.b).id ? ' me' : ''}"><i>${(m.a || m.b) ? escH(short && (m.a || m.b).tag ? (m.a || m.b).tag : (m.a || m.b).name) : ''}</i><b>부전승</b></span></div></div>`
      : `<div class="bk-cell"><div role="button" tabindex="0" class="bk-m${fm && fm.id === m.id ? ' sel' : ''}${m.state === 'live' || m.cur ? ' live' : ''}${m.mine ? ' mine' : ''}" data-m="${escH(m.id)}" title="${escH((m.a ? m.a.name : '미정') + ' vs ' + (m.b ? m.b.name : '미정'))}">${slot(m, m.a, m.sa)}${slot(m, m.b, m.sb)}</div></div>`).join('')}</div></div>`).join('')}</div>`;
  }
  function leagueH(t, fm) {
    let h = '<div class="td-sec">순위<small>시리즈 승 → 판 득실</small></div><table class="td-table tr-tb"><thead><tr><th>#</th><th class="n">팀</th><th>승</th><th>패</th><th>판</th></tr></thead><tbody>'
      + (t.standings || []).map(p => `<tr class="${p.id === t.myTeam ? 'me' : ''}"><td class="r">${p.rank}</td><td class="n">${escH(p.name)}</td><td>${p.w}</td><td>${p.l}</td><td>${p.gw}-${p.gl}</td></tr>`).join('') + '</tbody></table>';
    for (const r of t.rounds) { if (!r.matches.length) continue;
      h += `<div class="td-sec">${escH(r.name)}<small>${r.matches.filter(m => m.state === 'done').length}/${r.matches.length}</small></div><div class="tr-lines">` + r.matches.map(m => {
        const c = tm => (m.win && tm && m.win === tm.id ? ' win' : '') + (m.win && tm && m.win !== tm.id ? ' lose' : '');
        return `<button class="tr-line${fm && fm.id === m.id ? ' sel' : ''}${m.mine ? ' mine' : ''}${m.state === 'live' || m.cur ? ' live' : ''}" data-m="${escH(m.id)}"><b class="a${c(m.a)}">${m.a ? escH(m.a.name) : '미정'}</b><em class="num${m.n > 0 ? '' : ' vs'}">${m.n > 0 ? `${m.sa} : ${m.sb}` : 'vs'}</em><b class="b${c(m.b)}">${m.b ? escH(m.b.name) : '미정'}</b></button>`; }).join('') + '</div>'; }
    return h;
  }
  function draw() {
    const d = T.data; if (!d) { body.innerHTML = '<div class="td-empty">불러오는 중</div>'; return; }
    const t = d.list.find(x => x.id === T.sel);
    if (!t) { body.innerHTML = '<div class="td-empty"><b>진행 중인 대회가 없습니다</b></div>'; return; }
    const pick = d.list.length > 1 ? `<div class="tr-pick">${d.list.map(x => `<button class="${x.id === t.id ? 'on' : ''}" data-sel="${escH(x.id)}">${escH(x.name)}${x.st === 'done' ? '<small>끝</small>' : ''}</button>`).join('')}</div>` : '';
    const fmtTx = (t.fmt === 'rr' ? '풀리그' : '싱글 토너먼트') + ' · ' + BO(t.bo) + (t.fmt !== 'rr' && t.boF && t.boF !== t.bo ? ` · 결승 ${BO(t.boF)}` : '') + ` · ${t.teams.length}팀`;
    const my = t.teams.find(x => x.id === t.myTeam), fm = focusOf(t);
    const head = `<div class="tr-head${t.champ ? ' done' : ''}"><div class="tr-hd"><span class="sp-en">TOURNAMENT</span><span class="tr-live ${t.st}">${t.st === 'done' ? '끝남' : '진행 중'}</span></div><b class="tr-nm">${escH(t.name)}</b>`
      + `<span class="tr-sub">${fmtTx}${my ? ` · 내 팀 <b>${escH(my.name)}</b>` : ''}</span>`
      + (t.champ ? `<div class="tr-champ"><span class="sp-en">CHAMPION</span><b>🏆 ${escH(t.champ.name)}</b></div>` : '') + '</div>';
    const ROLE = { cap: '팀장', sub: '후보' }, ot = t.teams.find(x => x.id === T.team) || null;
    const teams = '<div class="td-sec">팀<small>누르면 선수</small></div><div class="tr-teams">' + t.teams.map(tm => `<button class="tr-tm${tm.mine ? ' mine' : ''}${ot && ot.id === tm.id ? ' on' : ''}" data-team="${escH(tm.id)}"><b>${escH(tm.name)}</b>${tm.tag ? `<small>${escH(tm.tag)}</small>` : ''}<span>${tm.mem.length}</span></button>`).join('') + '</div>'
      + (ot ? `<div class="tr-mem"><div class="tr-mem-h"><b>${escH(ot.name)}</b><small>선수 ${ot.mem.filter(x => x.r !== 'sub').length} · 후보 ${ot.mem.filter(x => x.r === 'sub').length}</small></div>${ot.mem.map(x => `<span class="${x.r}"><a class="pf-link" data-name="${escH(x.n)}">${escH(x.n)}</a>${ROLE[x.r] ? `<small>${ROLE[x.r]}</small>` : ''}</span>`).join('') || '<span>등록된 선수가 없습니다</span>'}</div>` : '');
    const h = pick + head + (T.err ? `<span class="hm-err">${escH(T.err)}</span>` : '') + focusH(t, fm, d)
      + (t.fmt === 'rr' ? leagueH(t, fm) : '<div class="td-sec">대진표<small>칸을 누르면 위에 그 경기</small></div>' + bracketH(t, fm))
      + teams + '<p class="tr-legal">커뮤니티가 여는 대회입니다 · 라이엇 게임즈·LoL e스포츠의 공식 대회가 아닙니다</p>';
    if (h === T.html) return; T.html = h; body.innerHTML = h;
    body.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { T.sel = b.dataset.sel; T.pick = null; T.team = null; T.err = ''; draw(); });
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { T.pick = b.dataset.m; draw(); });
    body.querySelectorAll('[data-team]').forEach(b => b.onclick = () => { T.team = T.team === b.dataset.team ? null : b.dataset.team; draw(); });
    body.querySelectorAll('.pf-link').forEach(a => a.onclick = () => openProfile({ name: a.dataset.name }));
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => act(() => window.api.tourneyStart(t.id, b.dataset.go), `「${t.name}」 ${title(fm)} 을(를) 이 방에서 시작할까요?\n대기실에 두 팀 등록 선수가 올라가고, 다른 사람은 관전이 됩니다.`));
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
