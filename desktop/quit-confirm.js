// quit-confirm.html 화면 스크립트(v0.1.293 보안 점검: 화면 안 인라인 스크립트를 파일로 뺌 = CSP가 인라인 실행을 막게)
const $ = (id) => document.getElementById(id);
if (new URLSearchParams(location.search).get('mode') === 'close') {   // 오른쪽 창 ✕
  document.querySelector('.ttl').textContent = '창을 닫을까요?'; $('en').textContent = 'CLOSE WINDOW';
  document.querySelector('.body').innerHTML = '숨기기만 하면 투데이 내전은 <b>계속 켜져 있습니다</b>.<small>나중에 끄려면 작업 표시줄 오른쪽 아래 숨은 아이콘(^) → 우클릭 → 「투데이 내전 종료」</small>';
  $('keep').textContent = '숨기기'; $('quit').textContent = '완전히 종료';
  $('noask-row').style.display = 'flex';
}
$('quit').onclick = () => window.api.quitConfirm(true, false);
$('keep').onclick = () => window.api.quitConfirm(false, $('noask').checked);

