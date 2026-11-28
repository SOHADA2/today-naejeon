// 🛡️ v0.1.293 보안 점검 — 그림을 못 받았을 때 처리(예전 = 인라인 onerror="this.remove()")
//   화면 안 인라인 스크립트·onerror·onclick을 CSP로 전부 막으려고(남이 서버에 넣은 값이 화면에서 코드로 실행되는 것 차단) 속성 대신 한 곳에서 처리
//   <img data-err="rm"> = 지움 · <img data-err="hide"> = 자리만 남기고 숨김
document.addEventListener('error', e => {
  const t = e.target; if (!t || t.tagName !== 'IMG') return;
  const m = t.dataset ? t.dataset.err : null;
  if (m === 'rm') t.remove(); else if (m === 'hide') t.style.visibility = 'hidden';
}, true);
