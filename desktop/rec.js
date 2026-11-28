// rec.html 화면 스크립트(v0.1.293 보안 점검: 화면 안 인라인 스크립트를 파일로 뺌 = CSP가 인라인 실행을 막게)
const set = d => {
  if (!d) return; if (d.title) document.getElementById('t').textContent = d.title; if (d.sub != null) document.getElementById('s').textContent = d.sub;
  const on = d.pct != null; document.getElementById('pg').classList.toggle('on', on);
  if (on) { document.querySelector('#bar i').style.width = d.pct + '%'; document.getElementById('pc').innerHTML = `${d.pct}%<small>약 ${d.left}초 남음</small>`; }
};
if (window.api && window.api.onRecToast) window.api.onRecToast(set);

