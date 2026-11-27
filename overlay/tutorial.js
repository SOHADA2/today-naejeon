// 📘 사용법 튜토리얼(v0.1.83) — 화면 곳곳에 줄줄이 붙어 있던 설명 글(사장님: 디자인을 해침)을 처음 설치했을 때 한 번 보는 것으로 모음
//   처음 켜면(설정 tutorialSeen 없음) 왼쪽 창에 자동으로 · 다 보거나 「그만 보기」 = 다시 안 뜸 · ⚙ 설정 「사용법 다시 보기」(main 'tutorial')로 다시
// 🧭 v0.1.228 **따라 하기**(사장님: 글 카드를 하나씩 읽는 건 튜토리얼 같지 않고 힘듦 → 그 버튼을 보여 주면서 설명하거나 직접 눌러 보는 형태 · 실제로 작동하는 게 아니라 예시로 보여 주는 화면)
//   = 왼쪽 창에 **예시 화면**(가짜 방·가짜 사람)을 실제 화면 그리는 코드 그대로 띄우고, 지금 설명하는 버튼만 밝게 남긴 채(둘레는 어둡게) 그 옆에 한두 줄 · 「눌러 보세요」 단계는 그 버튼을 누르면 다음 장면으로
//   순서(GUIDE 8단계 + 끝 카드): 방 목록 「들어가기」 → 내 자리 → (방장이라면) 롤 로비 만들기 → 방식 버튼 → 방식 고르는 창 → 팀 짜기 → 팀 화면 → 투표 → 끝(자세한 사용법 보기 / 시작하기)
//   ⚠️ 예시 화면 동안: 서버·롤에 아무것도 안 보냄 — 창 안의 클릭·키는 맨 앞에서 가로채 실제 버튼 동작을 막음(통과 = 튜토리얼 말풍선 · 창 ✕/–) · overlay.js `render()`는 `tnDemo.on`이면 실제 상태로 다시 안 그림
//     끝나면 실제 상태(판·대기실·방 목록)를 main에서 다시 받아 그림 · 실제로 팀이 짜이거나 게임이 시작되면 스스로 끝남 · 판이 진행 중일 때 「사용법 다시 보기」 = 예시 대신 글 카드(MORE)
//   자세한 사용법(MORE 7쪽) = 예전 글 카드 그대로(v0.1.227 · 끝 카드와 ⚙ 설정에서) · tnTutorial(단계, 'more'|undefined) · 디스코드 안내만 못 본 예전 사용자 = MORE의 디스코드 쪽
(function () {
  const api = window.api || {};
  const $ = c => document.querySelector(c);

  // ── 자세한 사용법(글 카드) ─────────────────────────────────────────────
  const MORE = [
    { en: 'ROOM', t: '방과 대기실', l: [
      '이번 판을 쉬려면 내 자리의 <b>관전</b> · 방을 나가려면 <b>방 이름 ▾</b> → 방에서 나가기',
      '채팅 = 아래 「한마디」 칸에 쓰고 Enter · 이모티콘은 <b>내 자리에서</b> 뜹니다',
      '<b>Alt + 끌기 = 핑</b> — 준비 완료·가자!·잠깐만 같은 8방향 · 찍은 곳에 뜹니다(같은 핑은 6초에 3번까지)',
      '방장 넘겨주기·신고 = <b>방 이름 ▾</b>를 눌러 여는 방 메뉴',
      '같은 PC에서 다른 사람이 롤에 로그인하면 그 사람으로 바뀝니다'] },
    { en: 'HOST', t: '방장', l: [
      '방장은 한 명 — <b>팀 짜기 · 경기 기록 · 투표 마감</b>을 맡습니다',
      '방 이름 ▾ 메뉴에서 방장을 넘겨주거나 그만둡니다',
      '방장이 방을 나가거나 응답이 없으면 방에 남은 사람이 <b>자동으로 이어받습니다</b>'] },
    { en: 'MODE', t: '이번 판 · 내전 / 일반', l: [
      '방장은 맨 아래 <b>⚔ 방식 ▾</b>에서 방식을 고릅니다',
      '<b>내전</b> 우리끼리 1팀 vs 2팀 — <b>랜덤</b> 무작위 · <b>밸런스</b> 아수라장 티어 점수로 비슷하게 · <b>드래프트</b> 팀장 둘이 번갈아(30초 지나면 무작위) · <b>직접</b> 방장이 1팀·2팀에',
      '팀이 정해지면 들어가 있는 롤 로비에서 그 판 다리만 바꿉니다 · <b>게임</b>에서 <b>소환사의 협곡</b>을 고르면 협곡 내전(챔피언 = 밴픽·블라인드)',
      '<b>일반</b> 같은 팀으로 아수라장·칼바람 나락·자유 랭크 — 아래 버튼으로 <b>롤 파티 만들고 초대 → 큐 시작</b>(롤 파티는 5명까지)',
      '홀수거나 11명 이상이면 남는 사람은 관전입니다'] },
    { en: 'AFTER THE GAME', t: '게임이 끝나면', l: [
      '결과가 <b>자동으로 기록</b>되고 MVP·매너왕 투표가 열립니다',
      '자동 기록이 안 되면 방장이 오른쪽 창 「홈」에서 이긴 팀을 누릅니다',
      '팀을 다시 짜려면 「팀 취소하고 대기실로」',
      '기록은 홈페이지 시즌 LP·골드와 <b>따로</b> 쌓입니다'] },
    { en: 'PLAY OF THE GAME', t: '팟지(하이라이트)', l: [
      '판이 끝나면 <b>방장 PC</b>가 리플레이로 최고 장면을 찍어 모두에게 보여 줍니다',
      '방장도 그 판에 <b>직접 참가</b>해야 찍힙니다(관전한 판은 리플레이가 없습니다)',
      '찍는 1분쯤 리플레이가 돕니다(소리는 끕니다) — 그동안은 큐를 잡지 마세요',
      '일반판은 앱 켠 사람 <b>2명 이상</b>이 같은 팀이면 기록·하이라이트'] },
    { en: 'DISCORD', t: '디스코드 연동', dc: true, act: '⚙ 디스코드 설정 열기', l: [
      'PC <b>디스코드 앱</b>을 켜 두면 프로필에 「투데이 내전 · 대기실 · 6명」처럼 <b>지금 상태</b>가 뜹니다',
      '방장이 ⚙ 설정 → 디스코드 → <b>「서버 연결」</b>로 봇을 서버에 넣고 <b>초대 링크</b>를 넣어 두면 서버에 없는 친구에게 「들어가기」가 뜹니다',
      '팀이 정해질 때 음성 채널 <b>「1팀」「2팀」으로 자동 이동</b> · 게임이 끝나면 원래 채널로',
      '대기실 자리의 헤드셋 표시 = 디스코드 켠 사람 · 웹 브라우저 디스코드는 안 됩니다'] },
    { en: 'SETTINGS', t: '단축키·설정', l: [
      '<b>Shift+F7</b> 왼쪽 창 보이기/숨기기',
      '⚙ 설정 — 디스코드 · 소리 · 롤 화면 핑',
      '이 사용법은 ⚙ 설정 → <b>「사용법 다시 보기」</b>'] },
  ];
  let box = null, mi = 0, mView = 'more';   // 글 카드: mView = 'more'(자세한 사용법 mi쪽) | 'end'(따라 하기 끝 카드)
  function card() {
    if (!box) { box = document.createElement('div'); box.className = 'tut'; document.body.appendChild(box); }
    box.style.display = '';
    const q = c => box.querySelector(c);
    if (mView === 'end') {
      box.innerHTML = `<div class="tut-card">
        <div class="tut-hd"><span class="tut-en lb-sec-en">TUTORIAL</span></div>
        <b class="tut-t">여기까지입니다</b>
        <ul class="tut-l"><li>판이 끝나면 방장 PC가 그 판 최고 장면(<b>팟지</b>)을 찍어 모두에게 보여 줍니다</li><li><b>Shift+F7</b> = 이 창 보이기/숨기기</li><li>다시 보려면 ⚙ 설정 → <b>「사용법 다시 보기」</b></li></ul>
        <button class="tut-more">자세한 사용법 보기</button>
        <div class="tut-btns"><button class="tut-prev tut-again">처음부터 다시</button><button class="tut-next ui-btn-gold">시작하기</button></div>
      </div>`;
      q('.tut-more').onclick = () => { mView = 'more'; mi = 0; card(); };
      q('.tut-again').onclick = () => { hideCard(); start(0); };
      q('.tut-next').onclick = done;
      return;
    }
    const s = MORE[mi], last = mi === MORE.length - 1;
    box.innerHTML = `<div class="tut-card">
      <div class="tut-hd"><span class="tut-en lb-sec-en">${s.en}</span><span class="tut-no num">${mi + 1}/${MORE.length}</span></div>
      <b class="tut-t">${s.t}</b>
      <ul class="tut-l">${s.l.map(x => `<li>${x}</li>`).join('')}</ul>
      ${s.act ? `<button class="tut-act">${s.act}</button>` : ''}
      <div class="tut-dots">${MORE.map((_, k) => `<i class="${k === mi ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tut-btns">${last ? '' : '<button class="tut-skip">닫기</button>'}${mi ? '<button class="tut-prev">이전</button>' : ''}<button class="tut-next ui-btn-gold">${last ? '닫기' : '다음'}</button></div>
    </div>`;
    if (q('.tut-skip')) q('.tut-skip').onclick = done;
    if (q('.tut-act')) q('.tut-act').onclick = () => { done(); setTimeout(() => { if (window.tnSettingsOpen) window.tnSettingsOpen('dc'); }, 50); };   // 🎧 설정의 디스코드 칸으로
    if (q('.tut-prev')) q('.tut-prev').onclick = () => { mi--; card(); };
    q('.tut-next').onclick = () => { if (last) done(); else { mi++; card(); } };
  }
  function hideCard() { if (box) box.style.display = 'none'; }
  function seen() { try { api.setSetting('tutorialSeen', true); api.setSetting('tutorialDc', true); } catch (_) {} }
  function done() { hideCard(); seen(); try { if (api.tutorialDone) api.tutorialDone(); } catch (_) {} }

  // ── 따라 하기(예시 화면) ───────────────────────────────────────────────
  const NM = ['칼바람장인', '포로간식', '눈덩이명중', '우물다이브', '다리위의왕'];   // 예시 사람(가짜)
  const ROOM = { id: 'tn-tut', name: '오늘 내전', priv: false };
  let ME = '나';   // 예시 화면 속 내 이름 = 롤 로그인한 이름(없으면 「나」)
  const mems = hostMe => {
    const a = NM.map((name, k) => ({ key: 'tut' + k, name, tag: 'KR1', icon: null, ver: '1', online: true, host: !hostMe && k === 0, me: false, dc: false, st: 'in' }));
    a.splice(2, 0, { key: 'tutme', name: ME, tag: '', icon: null, ver: '1', online: true, host: !!hostMe, me: true, dc: false, st: 'in' });
    return a;
  };
  const LOL_OFF = { inCustom: false, phase: 'None', invite: null, party: null, ids: null, invs: null, nq: 2400 };
  const LOL_IN = () => ({ inCustom: true, phase: 'Lobby', invite: null, party: null, ids: mems(true).map(m => m.key), invs: {}, nq: 2400 });
  const lob = (hostMe, lol) => ({ members: mems(hostMe), sides: {}, mode: 'random', captains: { teamA: null, teamB: null }, dcGuild: 'g', dcInv: true, dcJoin: null, hostName: hostMe ? ME : NM[0], hostStale: null, isHost: !!hostMe, latest: '1', room: ROOM, lol });
  const IN_ROOM = { rooms: [], room: ROOM, ready: true, slow: false, full: null };
  const sess = phase => ({ phase, mode: 'random', teamA: [NM[0], ME, NM[3]], teamB: [NM[1], NM[2], NM[4]], spectators: [], teamsFormedAt: 1, votes: {}, game: phase === 'vote' ? { id: 'tn-tut', winner: 'teamA' } : null });
  const STAT = [[NM[0], 22, '애쉬', 9, 4, 14, 31200], ['', 99, '럭스', 7, 5, 18, 28400], [NM[3], 86, '가렌', 5, 6, 11, 17900], [NM[1], 222, '징크스', 11, 6, 9, 33100], [NM[2], 81, '이즈리얼', 6, 7, 12, 25600], [NM[4], 37, '소나', 2, 8, 19, 12300]];
  const today = () => ({ ok: true, standings: [], matches: [{ gameId: 'tn-tut', ids: {}, stats: STAT.map(s => ({ summonerName: s[0] || ME, championId: s[1], championName: s[2], kills: s[3], deaths: s[4], assists: s[5], damage: s[6], augments: [] })) }] });
  // 단계: st() = 예시 화면 상태 · q = 밝게 남길 곳 · hit = 그곳을 눌러서 넘어가는 단계(「눌러 보세요」) · t/d/sub = 말풍선
  const GUIDE = [
    { st: () => ({ rooms: { rooms: [{ id: ROOM.id, name: ROOM.name, host: NM[0], members: NM.slice(0, 3), n: 3, priv: false, mine: false }], room: null, ready: true, slow: false, full: null } }),
      q: '#rm-list .rm-join', hit: true, t: '방에 들어가기', d: '친구가 만든 방이 여기에 뜹니다. <b>들어가기</b>를 눌러 보세요.', sub: '방이 없으면 위의 「＋ 방 만들기」 · 만든 사람이 방장입니다' },
    { st: () => ({ rooms: IN_ROOM, lobby: lob(false, null) }),
      q: '#lb-seats .seat.me', t: '자리에 앉았습니다', d: '방에 들어오면 바로 자리에 앉습니다. 게임은 <b>방장</b>이 시작하니 기다리면 됩니다.', sub: '이번 판을 쉬려면 내 자리의 「관전」' },
    { st: () => ({ rooms: IN_ROOM, lobby: lob(true, LOL_OFF), host: true }),
      q: '#lb-start', hit: true, t: '내가 방장이라면 — 롤 로비 만들기', d: '이 버튼을 누르면 방 사람 모두에게 롤 초대가 가고, 친구 앱이 <b>자동으로 수락</b>합니다. 눌러 보세요.' },
    { st: () => ({ rooms: IN_ROOM, lobby: lob(true, LOL_IN()), host: true }),
      q: '#lb-mchip', hit: true, t: '팀 짜는 방식', d: '모두 롤 로비에 들어왔습니다. 방식은 여기서 고릅니다. 눌러 보세요.' },
    { st: () => ({ rooms: IN_ROOM, lobby: lob(true, LOL_IN()), host: true, mpop: true }),
      q: '#lb-mpop', t: '랜덤 · 밸런스 · 드래프트 · 직접', d: '고른 방식이 무엇인지는 맨 아래 한 줄에 나옵니다.', sub: '「게임」 = 아수라장 / 소환사의 협곡 · 「일반」 = 같은 팀으로 아수라장·칼바람 나락·자유 랭크를 돌릴 때' },
    { st: () => ({ rooms: IN_ROOM, lobby: lob(true, LOL_IN()), host: true }),
      q: '#lb-start', hit: true, t: '팀 짜기', d: '다 모이면 같은 버튼이 <b>팀 짜기</b>로 바뀌어 있습니다. 눌러 보세요.' },
    { st: () => ({ rooms: IN_ROOM, lobby: lob(true, LOL_IN()), host: true, session: sess('teams') }),
      q: '#tv-band', t: '팀이 정해졌습니다', d: '롤 로비의 자리도 이 팀대로 자동으로 옮겨집니다. 방장이 롤에서 게임을 시작하면 됩니다.' },
    { st: c => ({ rooms: IN_ROOM, lobby: lob(true, LOL_IN()), host: true, session: sess('vote'), mvp: c.mvp ? NM[1] : null }),
      q: '#vt-body .vt-cand.mvp', hit: true, onHit: c => { c.mvp = true; }, t: '게임이 끝나면 투표', d: '결과는 자동으로 기록됩니다. <b>MVP</b>와 <b>매너왕</b>을 한 명씩 고릅니다. 한 명을 눌러 보세요.' },
  ];
  const D = window.tnDemo = { on: false, rendering: false, blocked };   // overlay.js render()가 봄
  let gi = 0, layer = null, hole = null, tip = null, ctx = {}, keep = null, pokeAt = 0, holdT = null;
  const busy = () => { try { const s = sessionData, ph = s && s.phase; return !!(inGame || (roster || []).length || recData || ph === 'draft' || ph === 'teams' || ph === 'vote' || (ph === 'result' && !resultSeen())); } catch (_) { return true; } };   // 실제 판이 진행 중 = 예시 화면을 띄우지 않음
  function apply(v) {   // 예시 상태를 넣고 실제 화면 그리는 코드로 그림
    D.rendering = true;
    try {
      myName = ME; myIsHost = !!v.host; roomData = v.rooms || IN_ROOM; lobbyData = v.lobby || null; sessionData = v.session || null;
      _today = today(); _todayAt = Date.now(); _gamePlayed = false; _mpop = !!v.mpop;
      render();
      if (v.session && v.session.phase === 'vote') { _pendMvp = v.mvp || null; _pendManner = null; renderVote(); }
    } catch (e) { console.error('tutorial', e); }
    D.rendering = false;
  }
  function blocked() {   // 예시 화면 동안 실제 상태가 바뀜(overlay.js render가 막고 알려 줌) → 실제로 팀이 짜이거나 게임이 시작됐으면 예시를 끝냄
    if (!D.on) return;
    if (inGame || (roster || []).length) { stop(); return; }
    if (Date.now() - pokeAt < 1500) return;
    pokeAt = Date.now();
    api.getPlayers().then(d => { const ph = d && d.session && d.session.phase; if (D.on && (ph === 'draft' || ph === 'teams' || ph === 'vote')) stop(); }).catch(() => {});
  }
  async function restore() {   // 실제 상태를 다시 받아 그림
    const [p, l, r] = await Promise.all([api.getPlayers().catch(() => null), api.getLobby().catch(() => null), api.getRooms().catch(() => null)]);
    _today = null; _todayAt = 0; _mpop = false; _pendMvp = _pendManner = null; if (keep) _gamePlayed = keep.gamePlayed;
    lobbyData = l || null; myIsHost = !!(l && l.isHost);
    if (r) applyRooms(r); else roomData = null;
    applySession({ session: p ? p.session : null, myName: p ? (p.myName || '') : '', isHost: p ? p.isHost : false });
  }
  const EVS = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu', 'keydown', 'keyup', 'keypress', 'wheel'];
  function guard(e) {   // 창 안의 클릭·키를 맨 앞에서 가로챔 — 실제 버튼 동작(서버·롤로 보내는 것)이 실행되지 않게
    if (!D.on) return;
    const t = e.target, inside = c => !!(t && t.closest && t.closest(c));
    if (inside('.tg-tip') || inside('#close, #ov-min')) return;   // 말풍선 버튼 · 창 닫기/내리기는 그대로
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'keydown') {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') go(gi + 1);
      else if (e.key === 'ArrowLeft') go(gi - 1);
      return;
    }
    if (e.type !== 'click') return;
    const S = GUIDE[gi], el = S && S.q && $(S.q);
    if (el && (el === t || el.contains(t))) {
      if (holdT) return;
      if (S.onHit) { S.onHit(ctx); apply(S.st(ctx)); place(); holdT = setTimeout(() => { holdT = null; go(gi + 1); }, 750); }   // 누른 결과(고른 표시)를 잠깐 보여 주고 다음으로
      else go(gi + 1);
    }
    else if (tip) { tip.classList.remove('nudge'); void tip.offsetWidth; tip.classList.add('nudge'); }   // 다른 곳을 누름 → 말풍선 테두리가 한 번 밝아짐
  }
  function place() {   // 밝게 남길 곳 둘레에 구멍 + 그 위나 아래에 말풍선
    if (!D.on || !layer) return;
    const S = GUIDE[gi], el = S.q && $(S.q), W = innerWidth, H = innerHeight;
    const tw = Math.min(340, W - 20); tip.style.width = tw + 'px';
    if (!el || !el.getClientRects().length) {   // 못 찾음 = 가운데 말풍선만
      hole.style.display = 'none'; layer.classList.add('nohole');
      tip.style.left = Math.round((W - tw) / 2) + 'px'; tip.style.top = Math.round((H - tip.offsetHeight) / 2) + 'px'; tip.dataset.side = '';
      return;
    }
    try { el.scrollIntoView({ block: 'nearest' }); } catch (_) {}
    const r = el.getBoundingClientRect(), pad = 5;
    const x = Math.max(3, r.left - pad), y = Math.max(3, r.top - pad), w = Math.min(W - 3, r.right + pad) - x, h = Math.min(H - 3, r.bottom + pad) - y;
    layer.classList.remove('nohole'); hole.style.display = '';
    Object.assign(hole.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    hole.classList.toggle('hit', !!S.hit);
    const th = tip.offsetHeight, gap = 14, gapUp = S.hit ? 28 : 14;   // 위에 놓을 땐 구멍 위 「눌러 보세요」 표를 안 가리게 더 띄움
    const below = y + h + gap + th <= H - 8, above = y - gapUp - th >= 8;
    const top = below ? y + h + gap : above ? y - gapUp - th : (H - (y + h) >= y ? H - th - 8 : 8);
    const left = Math.max(10, Math.min(W - tw - 10, Math.round(x + w / 2 - tw / 2)));
    tip.style.top = Math.round(top) + 'px'; tip.style.left = left + 'px';
    tip.dataset.side = below ? 'up' : above ? 'down' : '';
    tip.style.setProperty('--ax', Math.max(18, Math.min(tw - 18, Math.round(x + w / 2 - left))) + 'px');
  }
  function show() {
    const S = GUIDE[gi];
    try { if (myName && myName !== ME) ME = myName; } catch (_) {}   // 예시 도중 롤에 로그인함 → 예시 속 내 이름도 그 이름으로(myName은 예시가 ME로 덮어쓰니 다르면 실제로 바뀐 것)
    apply(S.st(ctx));
    tip.innerHTML = `<div class="tg-hd"><span class="tg-en lb-sec-en">TUTORIAL · 예시 화면</span><span class="tg-no num">${gi + 1}/${GUIDE.length}</span></div>
      <b class="tg-t">${S.t}</b><p class="tg-d">${S.d}</p>${S.sub ? `<small class="tg-sub">${S.sub}</small>` : ''}
      <div class="tg-btns"><button class="tg-skip">그만 보기</button>${gi ? '<button class="tg-prev">이전</button>' : ''}<button class="tg-next${S.hit ? '' : ' ui-btn-gold'}">${S.hit ? '건너뛰기' : '다음'}</button></div>`;
    tip.querySelector('.tg-skip').onclick = finish;
    if (tip.querySelector('.tg-prev')) tip.querySelector('.tg-prev').onclick = () => go(gi - 1);
    tip.querySelector('.tg-next').onclick = () => go(gi + 1);
    tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in');
    place(); requestAnimationFrame(place); setTimeout(place, 120); setTimeout(place, 400);   // 그림·글꼴이 늦게 자리 잡는 경우
  }
  function go(k) {
    if (!D.on) return;
    clearTimeout(holdT); holdT = null;
    if (k < 0) k = 0;
    if (k < gi) ctx = {};   // 뒤로 가면 고른 것 지움
    if (k >= GUIDE.length) { stop(); mView = 'end'; card(); return; }   // 끝 카드(실제 화면 위)
    gi = k; show();
  }
  function start(k) {
    if (D.on) { gi = Math.max(0, Math.min(GUIDE.length - 1, k || 0)); show(); return; }
    if (typeof render !== 'function' || busy()) { mView = 'more'; mi = 0; card(); return; }   // 실제 판이 진행 중 = 예시 대신 글 카드
    hideCard();
    try { ME = myName || '나'; keep = { gamePlayed: _gamePlayed }; } catch (_) { ME = '나'; keep = null; }
    ctx = {}; gi = Math.max(0, Math.min(GUIDE.length - 1, k || 0));
    if (!layer) {
      layer = document.createElement('div'); layer.className = 'tg';
      layer.innerHTML = '<i class="tg-hole"></i><div class="tg-tip"></div>';
      document.body.appendChild(layer); hole = layer.firstChild; tip = layer.lastChild;
    }
    layer.style.display = ''; hole.style.display = 'none';
    D.on = true;
    document.body.classList.add('tg-on');
    for (const ev of EVS) window.addEventListener(ev, guard, { capture: true, passive: false });
    window.addEventListener('resize', place);
    show();
  }
  function stop() {   // 예시 화면 끝 → 실제 화면으로
    if (!D.on) return;
    clearTimeout(holdT); holdT = null;
    D.on = false;
    for (const ev of EVS) window.removeEventListener(ev, guard, { capture: true });
    window.removeEventListener('resize', place);
    document.body.classList.remove('tg-on');
    if (layer) layer.style.display = 'none';
    restore().catch(() => {});
    setTimeout(() => { if (!D.on) restore().catch(() => {}); }, 600);   // 그사이 바뀐 것까지 한 번 더
  }
  function finish() { stop(); done(); }

  function open(step, mode) {
    if (mode === 'more') { if (D.on) stop(); mView = 'more'; mi = Math.max(0, Math.min(MORE.length - 1, step || 0)); card(); return; }
    start(step || 0);
  }
  window.tnTutorial = open;
  if (api.onTutorial) api.onTutorial(d => { if (d && d.end) { if (D.on) stop(); hideCard(); return; } open(d && d.step, d && d.more ? 'more' : undefined); });
  if (api.getSettings) api.getSettings().then(s => {
    if (s && !s.tutorialSeen) { const tryOpen = n => { if (!busy()) start(0); else if (n < 60) setTimeout(() => tryOpen(n + 1), 5000); }; setTimeout(() => tryOpen(0), 600); }   // 처음 켠 사람 = 따라 하기(판이 진행 중이면 끝난 뒤)
    else if (s && !s.tutorialDc) setTimeout(() => open(MORE.findIndex(x => x.dc), 'more'), 600);   // 🎧 v0.1.134: 이미 본 사람에겐 디스코드 쪽만
  }).catch(() => {});
})();
