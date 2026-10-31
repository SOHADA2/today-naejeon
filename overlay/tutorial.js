// 📘 사용법 튜토리얼(v0.1.83) — 화면 곳곳에 줄줄이 붙어 있던 설명 글(사장님: 디자인을 해침)을 처음 설치했을 때 한 번 보는 카드로 모음
//   처음 켜면(설정 tutorialSeen 없음) 왼쪽 창에 자동으로 · 다 보거나 「건너뛰기」 = 다시 안 뜸 · ⚙ 설정 「사용법 다시 보기」(main 'tutorial')로 다시
(function () {
  const STEPS = [
    { ic: '👋', en: 'WELCOME', t: '투데이 내전에 온 걸 환영해요', l: [
      '롤에 로그인하면 그 계정으로 <b>자동 입장</b>해요',
      '같은 PC에서 다른 사람이 로그인하면 그 사람으로 바뀌어요',
      '기록은 홈페이지 시즌 LP·골드와 <b>따로</b> 쌓여요'] },
    { ic: '🚪', en: 'LOBBY', t: '대기실', l: [
      '앱을 켠 사람은 <b>자동으로 자리에 앉아요</b>',
      '이번 판을 쉬려면 「이번 판은 관전할게요」',
      '앱이 없는 친구는 방장이 <b>이름으로 추가</b>해요'] },
    { ic: '👑', en: 'HOST', t: '방장', l: [
      '방장은 한 명 — <b>팀짜기·경기 기록·투표 마감</b>을 맡아요',
      '「방장 ▾」에서 넘겨주거나 그만할 수 있어요',
      '방장이 1분 넘게 응답이 없으면 누구나 <b>이어받기</b>'] },
    { ic: '🎲', en: 'MODE', t: '이번 판 방식', l: [
      '<b>랜덤</b> 바로 무작위로 팀 · <b>드래프트</b> 팀장 둘이 번갈아 뽑기(30초 지나면 무작위)',
      '<b>직접</b> 방장이 1팀·2팀에 한 명씩 · <b>일반판</b> 내전 대신 같은 팀으로 일반 게임',
      '롤 대기방이 <b>일반 큐면 일반판</b>, <b>사용자 설정 방이면 내전 방식</b>으로 저절로 바뀌어요',
      '홀수거나 11명 이상이면 남는 사람은 관전이에요'] },
    { ic: '🏆', en: 'AFTER THE GAME', t: '게임이 끝나면', l: [
      '결과가 <b>자동으로 기록</b>되고 MVP·매너왕 투표가 열려요',
      '자동 기록이 안 되면 방장이 오른쪽 「진행」에서 이긴 팀을 눌러요',
      '팀을 다시 짜려면 「팀 취소하고 대기실로」'] },
    { ic: '🎬', en: 'PLAY OF THE GAME', t: '팟지(하이라이트)', l: [
      '판이 끝나면 <b>방장 PC</b>가 리플레이로 최고 장면을 찍어 모두에게 보여줘요',
      '방장도 그 판에 <b>직접 참가</b>해야 찍혀요(관전한 판은 리플레이가 없어요)',
      '찍는 1분쯤은 리플레이 소리가 나요 — 그동안은 큐를 잡지 마세요',
      '일반판은 앱 켠 사람 <b>2명+</b>이 같은 팀이면 기록·하이라이트'] },
    { ic: '⚙️', en: 'SETTINGS', t: '단축키·설정', l: [
      '<b>Shift+F7</b> 왼쪽 창 보이기/숨기기(게임 중엔 정보 창)',
      '⚙ 설정 — 게임 중 정보 창 · 증강 순위(베타) · 소리',
      '이 사용법은 ⚙ 설정 → <b>「사용법 다시 보기」</b>'] },
  ];
  let i = 0, box = null;
  function render() {
    const s = STEPS[i], last = i === STEPS.length - 1;
    box.innerHTML = `<div class="tut-card">
      <div class="tut-hd"><span class="tut-ic">${s.ic}</span><span class="tut-en lb-sec-en">${s.en}</span><span class="tut-no num">${i + 1}/${STEPS.length}</span></div>
      <b class="tut-t">${s.t}</b>
      <ul class="tut-l">${s.l.map(x => `<li>${x}</li>`).join('')}</ul>
      <div class="tut-dots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tut-btns">${last ? '' : '<button class="tut-skip">건너뛰기</button>'}${i ? '<button class="tut-prev">이전</button>' : ''}<button class="tut-next ui-btn-gold">${last ? '시작하기' : '다음'}</button></div>
    </div>`;
    const q = c => box.querySelector(c);
    if (q('.tut-skip')) q('.tut-skip').onclick = done;
    if (q('.tut-prev')) q('.tut-prev').onclick = () => { i--; render(); };
    q('.tut-next').onclick = () => { if (last) done(); else { i++; render(); } };
  }
  function open(step) {
    if (!box) { box = document.createElement('div'); box.className = 'tut'; document.body.appendChild(box); }
    i = Math.max(0, Math.min(STEPS.length - 1, step || 0)); box.style.display = ''; render();
  }
  function done() { if (box) box.style.display = 'none'; try { window.api.setSetting('tutorialSeen', true); } catch (_) {} }
  window.tnTutorial = open;
  if (window.api && window.api.onTutorial) window.api.onTutorial(d => open(d && d.step));
  if (window.api && window.api.getSettings) window.api.getSettings().then(s => { if (s && !s.tutorialSeen) setTimeout(() => open(0), 600); }).catch(() => {});
})();
