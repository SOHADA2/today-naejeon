// 📘 사용법 튜토리얼(v0.1.83) — 화면 곳곳에 줄줄이 붙어 있던 설명 글(사장님: 디자인을 해침)을 처음 설치했을 때 한 번 보는 카드로 모음
//   처음 켜면(설정 tutorialSeen 없음) 왼쪽 창에 자동으로 · 다 보거나 「건너뛰기」 = 다시 안 뜸 · ⚙ 설정 「사용법 다시 보기」(main 'tutorial')로 다시
(function () {
  const STEPS = [
    { ic: '👋', en: 'WELCOME', t: '투데이 내전에 온 걸 환영해요', l: [
      '롤에 로그인하면 그 계정으로 <b>자동 입장</b>해요',
      '같은 PC에서 다른 사람이 로그인하면 그 사람으로 바뀌어요',
      '기록은 홈페이지 시즌 LP·골드와 <b>따로</b> 쌓여요'] },
    { ic: '🚪', en: 'ROOM', t: '방과 대기실', l: [
      '방 목록에서 <b>들어가거나 방을 만들어요</b> — 만든 사람이 방장 · 비공개 방은 비밀번호',
      '방에 들어오면 <b>자동으로 자리에 앉아요</b>',
      '이번 판을 쉬려면 내 자리의 「관전」 · 방 이름 ▾ 를 누르면 방 메뉴(나가기 등)',
      '앱이 없는 친구는 방장이 <b>빈 자리를 눌러 이름으로 추가</b>해요'] },
    { ic: '👑', en: 'HOST', t: '방장', l: [
      '방장은 한 명 — <b>팀짜기·경기 기록·투표 마감</b>을 맡아요',
      '방 이름 ▾ 메뉴에서 방장을 넘겨주거나 그만하고, 앱 없는 사람도 추가해요',
      '방장이 방을 나가거나 응답이 없으면 방에 남은 사람이 <b>자동으로 이어받아요</b>'] },
    { ic: '🎲', en: 'MODE', t: '이번 판 · 내전 / 일반', l: [
      '방장은 맨 아래 <b>⚔ 방식 ▾</b> 버튼으로 방식을 고르고, 바로 옆 금색 버튼으로 시작해요',
      '<b>내전</b> 우리끼리 1팀 vs 2팀 · 팀 짜기: <b>랜덤</b> 바로 무작위 · <b>밸런스</b> 아수라장 티어 점수로 비슷하게 · <b>드래프트</b> 팀장 둘이 번갈아(30초 지나면 무작위) · <b>직접</b> 방장이 1팀·2팀에',
      '내전 팀이 정해지면 방장 앱이 <b>롤 사용자 설정 방을 만들고 모두 초대</b>해요(친구 앱이 자동 수락)',
      '<b>일반</b> 같은 팀으로 아수라장·칼바람 · 아래 버튼으로 <b>롤 파티 만들고 초대 → 큐 시작</b>(롤 파티는 5명까지)',
      '홀수거나 11명 이상이면 남는 사람은 관전이에요'] },
    { ic: '🏆', en: 'AFTER THE GAME', t: '게임이 끝나면', l: [
      '결과가 <b>자동으로 기록</b>되고 MVP·매너왕 투표가 열려요',
      '자동 기록이 안 되면 방장이 오른쪽 창 「홈」에서 이긴 팀을 눌러요',
      '팀을 다시 짜려면 「팀 취소하고 대기실로」'] },
    { ic: '🎬', en: 'PLAY OF THE GAME', t: '팟지(하이라이트)', l: [
      '판이 끝나면 <b>방장 PC</b>가 리플레이로 최고 장면을 찍어 모두에게 보여줘요',
      '방장도 그 판에 <b>직접 참가</b>해야 찍혀요(관전한 판은 리플레이가 없어요)',
      '찍는 1분쯤 리플레이가 돌아요(소리는 꺼요) — 그동안은 큐를 잡지 마세요',
      '일반판은 앱 켠 사람 <b>2명+</b>이 같은 팀이면 기록·하이라이트'] },
    { ic: '🎧', en: 'DISCORD', t: '디스코드 연동', dc: true, act: '⚙ 디스코드 설정 열기', l: [
      'PC <b>디스코드 앱</b>을 켜 두면 프로필에 「투데이 내전 · 대기실 · 6명」처럼 <b>지금 상태</b>가 떠요',
      '방장이 ⚙ 설정 → 디스코드 → <b>「서버 연결」</b>로 봇을 우리 서버에 넣고 <b>초대 링크</b>를 넣어 두면 서버에 없는 친구에게 「들어가기」가 떠요',
      '팀이 정해질 때 음성 채널 <b>「1팀」「2팀」으로 자동 이동</b> · 게임이 끝나면 원래 채널로',
      '대기실 자리 🎧 = 디스코드 켠 사람 · 웹 브라우저 디스코드는 안 돼요'] },
    { ic: '⚙️', en: 'SETTINGS', t: '단축키·설정', l: [
      '<b>Shift+F7</b> 왼쪽 창 보이기/숨기기',
      '⚙ 설정 — 증강 순위(베타) · 디스코드 · 소리',
      '이 사용법은 ⚙ 설정 → <b>「사용법 다시 보기」</b>'] },
  ];
  let i = 0, box = null;
  function render() {
    const s = STEPS[i], last = i === STEPS.length - 1;
    box.innerHTML = `<div class="tut-card">
      <div class="tut-hd"><span class="tut-ic">${s.ic}</span><span class="tut-en lb-sec-en">${s.en}</span><span class="tut-no num">${i + 1}/${STEPS.length}</span></div>
      <b class="tut-t">${s.t}</b>
      <ul class="tut-l">${s.l.map(x => `<li>${x}</li>`).join('')}</ul>
      ${s.act ? `<button class="tut-act">${s.act}</button>` : ''}
      <div class="tut-dots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tut-btns">${last ? '' : '<button class="tut-skip">건너뛰기</button>'}${i ? '<button class="tut-prev">이전</button>' : ''}<button class="tut-next ui-btn-gold">${last ? '시작하기' : '다음'}</button></div>
    </div>`;
    const q = c => box.querySelector(c);
    if (q('.tut-skip')) q('.tut-skip').onclick = done;
    if (q('.tut-act')) q('.tut-act').onclick = () => { done(); setTimeout(() => { const g = document.querySelector('.tn-gear'); if (g) g.click(); setTimeout(() => { const b = document.querySelector('.tn-set-body'), t = b && [...b.querySelectorAll('.tn-sec')].find(x => x.textContent === '디스코드'); if (t) b.scrollTop = t.offsetTop - 50; }, 80); }, 50); };   // 🎧 설정의 디스코드 칸으로
    if (q('.tut-prev')) q('.tut-prev').onclick = () => { i--; render(); };
    q('.tut-next').onclick = () => { if (last) done(); else { i++; render(); } };
  }
  function open(step) {
    if (!box) { box = document.createElement('div'); box.className = 'tut'; document.body.appendChild(box); }
    i = Math.max(0, Math.min(STEPS.length - 1, step || 0)); box.style.display = ''; render();
  }
  function done() { if (box) box.style.display = 'none'; try { window.api.setSetting('tutorialSeen', true); window.api.setSetting('tutorialDc', true); } catch (_) {} }
  window.tnTutorial = open;
  if (window.api && window.api.onTutorial) window.api.onTutorial(d => open(d && d.step));
  if (window.api && window.api.getSettings) window.api.getSettings().then(s => { if (s && !s.tutorialSeen) setTimeout(() => open(0), 600); else if (s && !s.tutorialDc) setTimeout(() => open(STEPS.findIndex(x => x.dc)), 600); }).catch(() => {});   // 🎧 v0.1.134: 이미 본 사람에겐 디스코드 단계만(다음 = 설정 단계 → 끝)
})();
