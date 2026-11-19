// 📘 사용법 튜토리얼(v0.1.83) — 화면 곳곳에 줄줄이 붙어 있던 설명 글(사장님: 디자인을 해침)을 처음 설치했을 때 한 번 보는 카드로 모음
//   처음 켜면(설정 tutorialSeen 없음) 왼쪽 창에 자동으로 · 다 보거나 「건너뛰기」 = 다시 안 뜸 · ⚙ 설정 「사용법 다시 보기」(main 'tutorial')로 다시
// 🚀 v0.1.227(사장님: 처음 들어와도 문제없이·직관적으로) — 8쪽에 기능마다 줄이 붙어 처음 온 사람이 읽기엔 너무 길었음(쪽마다 4~5줄 · 핑 제한 같은 세부까지)
//   → 처음엔 **빠른 시작 3쪽**(QUICK: 방에 들어감 → 방장이 시작 → 끝나면 자동)만 · 나머지는 마지막 쪽 「자세한 사용법 보기」로 이어지는 **자세한 사용법 7쪽**(MORE · 예전 내용 그대로 줄만 다듬음)
//   머리 = 그림 글자 대신 단계 번호(빠른 시작) · 말투 = 「~합니다」 · tnTutorial(쪽, 'quick'|'more') · 디스코드 안내만 못 본 예전 사용자 = MORE의 디스코드 쪽
(function () {
  const QUICK = [
    { en: 'QUICK START', t: '방에 들어갑니다', l: [
      '방 목록에서 친구가 만든 방을 누르면 <b>바로 자리에 앉습니다</b>',
      '방이 없으면 <b>방 만들기</b> — 만든 사람이 방장입니다',
      '이름은 롤에 로그인한 계정 그대로입니다'] },
    { en: 'QUICK START', t: '방장이 게임을 시작합니다', l: [
      '방장이 아래 금색 버튼 <b>롤 내전 방 만들기</b>를 누르면 방 사람에게 롤 초대가 가고 <b>자동으로 수락</b>됩니다',
      '다 모이면 같은 버튼이 <b>팀 짜기 시작</b>으로 바뀝니다',
      '방장이 아니면 기다리면 됩니다'] },
    { en: 'QUICK START', t: '끝나면 자동으로 기록됩니다', l: [
      '경기 결과가 기록되고 <b>MVP · 매너왕 투표</b>가 열립니다',
      '방장 PC가 그 판 최고 장면(<b>팟지</b>)을 찍어 모두에게 보여 줍니다',
      '<b>Shift+F7</b> = 이 창 보이기/숨기기'] },
  ];
  const MORE = [
    { en: 'ROOM', t: '방과 대기실', l: [
      '이번 판을 쉬려면 내 자리의 <b>관전</b> · 방 이름 ▾ = 방 메뉴(나가기 등)',
      '채팅 = 아래 「한마디」 칸에 쓰고 Enter · 이모티콘은 <b>내 자리에서</b> 뜹니다',
      '<b>Alt + 끌기 = 핑</b> — 롤과 같은 8방향 · 찍은 곳에 뜹니다(같은 핑은 6초에 3번까지)',
      '앱이 없는 친구는 방장이 <b>빈 자리를 눌러 이름으로 추가</b>합니다',
      '같은 PC에서 다른 사람이 롤에 로그인하면 그 사람으로 바뀝니다'] },
    { en: 'HOST', t: '방장', l: [
      '방장은 한 명 — <b>팀 짜기 · 경기 기록 · 투표 마감</b>을 맡습니다',
      '방 이름 ▾ 메뉴에서 방장을 넘겨주거나 그만둡니다',
      '방장이 방을 나가거나 응답이 없으면 방에 남은 사람이 <b>자동으로 이어받습니다</b>'] },
    { en: 'MODE', t: '이번 판 · 내전 / 일반', l: [
      '방장은 맨 아래 <b>⚔ 방식 ▾</b>에서 방식을 고릅니다',
      '<b>내전</b> 우리끼리 1팀 vs 2팀 — <b>랜덤</b> 무작위 · <b>밸런스</b> 아수라장 티어 점수로 비슷하게 · <b>드래프트</b> 팀장 둘이 번갈아(30초 지나면 무작위) · <b>직접</b> 방장이 1팀·2팀에',
      '팀이 정해지면 들어가 있는 롤 방에서 그 판 다리만 바꿉니다',
      '<b>일반</b> 같은 팀으로 아수라장·칼바람 — 아래 버튼으로 <b>롤 파티 만들고 초대 → 큐 시작</b>(롤 파티는 5명까지)',
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
      '⚙ 설정 — 증강 순위(베타) · 디스코드 · 소리',
      '이 사용법은 ⚙ 설정 → <b>「사용법 다시 보기」</b>'] },
  ];
  let i = 0, mode = 'quick', box = null;
  const list = () => (mode === 'more' ? MORE : QUICK);
  function render() {
    const S = list(), s = S[i], last = i === S.length - 1, quick = mode === 'quick';
    box.innerHTML = `<div class="tut-card">
      <div class="tut-hd">${quick ? `<i class="tut-n num">${i + 1}</i>` : ''}<span class="tut-en lb-sec-en">${s.en}</span><span class="tut-no num">${i + 1}/${S.length}</span></div>
      <b class="tut-t">${s.t}</b>
      <ul class="tut-l">${s.l.map(x => `<li>${x}</li>`).join('')}</ul>
      ${s.act ? `<button class="tut-act">${s.act}</button>` : ''}
      ${quick && last ? '<button class="tut-more">자세한 사용법 보기</button>' : ''}
      <div class="tut-dots">${S.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tut-btns">${last ? '' : `<button class="tut-skip">${quick ? '건너뛰기' : '닫기'}</button>`}${i || !quick ? '<button class="tut-prev">이전</button>' : ''}<button class="tut-next ui-btn-gold">${last ? (quick ? '시작하기' : '닫기') : '다음'}</button></div>
    </div>`;
    const q = c => box.querySelector(c);
    if (q('.tut-skip')) q('.tut-skip').onclick = done;
    if (q('.tut-act')) q('.tut-act').onclick = () => { done(); setTimeout(() => { const g = document.querySelector('.tn-gear'); if (g) g.click(); setTimeout(() => { const b = document.querySelector('.tn-set-body'), t = b && [...b.querySelectorAll('.tn-sec')].find(x => x.textContent === '디스코드'); if (t) b.scrollTop = t.offsetTop - 50; }, 80); }, 50); };   // 🎧 설정의 디스코드 칸으로
    if (q('.tut-more')) q('.tut-more').onclick = () => { seen(); mode = 'more'; i = 0; render(); };   // 빠른 시작을 다 본 것으로 치고 자세한 사용법으로
    if (q('.tut-prev')) q('.tut-prev').onclick = () => { if (i) i--; else { mode = 'quick'; i = QUICK.length - 1; } render(); };   // 자세한 사용법 첫 쪽의 「이전」 = 빠른 시작 마지막 쪽
    q('.tut-next').onclick = () => { if (last) done(); else { i++; render(); } };
  }
  function open(step, m) {
    if (!box) { box = document.createElement('div'); box.className = 'tut'; document.body.appendChild(box); }
    mode = m === 'more' ? 'more' : 'quick';
    i = Math.max(0, Math.min(list().length - 1, step || 0)); box.style.display = ''; render();
  }
  function seen() { try { window.api.setSetting('tutorialSeen', true); window.api.setSetting('tutorialDc', true); } catch (_) {} }
  function done() { if (box) box.style.display = 'none'; seen(); }
  window.tnTutorial = open;
  if (window.api && window.api.onTutorial) window.api.onTutorial(d => open(d && d.step, d && d.more ? 'more' : 'quick'));
  if (window.api && window.api.getSettings) window.api.getSettings().then(s => { if (s && !s.tutorialSeen) setTimeout(() => open(0), 600); else if (s && !s.tutorialDc) setTimeout(() => open(MORE.findIndex(x => x.dc), 'more'), 600); }).catch(() => {});   // 🎧 v0.1.134: 이미 본 사람에겐 디스코드 쪽만
})();
