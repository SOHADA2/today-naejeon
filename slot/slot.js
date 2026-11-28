// slot.html 화면 스크립트(v0.1.293 보안 점검: 화면 안 인라인 스크립트를 파일로 뺌 = CSP가 인라인 실행을 막게)
const CROWN = '<svg viewBox="0 0 15 12"><path d="M1 3l3.2 3L7.5 1l3.3 5L14 3l-1.4 8H2.4z" fill="#f0d79a"/></svg>';
const col = c => `<div class="col c${c}"><div class="ln"></div>${[0, 1, 2, 3, 4].map(i => `<div class="tk" style="top:${27 + 48 * i}px;animation-delay:${0.12 + i * 0.04}s"></div>`).join('')}<div class="chip">TEAM ${c}<b>· 내 팀</b></div></div>`;
document.getElementById('st').innerHTML = col(1) + col(2) + `<div id="hr"><span>${CROWN}<em>HOST</em>투데이 방장</span></div>`;
function draw(d) {
  d = d || {};
  const st = document.getElementById('st'), hr = document.getElementById('hr');
  const me = d.me === 1 || d.me === 2 ? d.me : 0;
  st.className = (me ? 'm' + me : '') + (d.appear ? ' in' : '');
  const h = d.host && (d.host.team === 1 || d.host.team === 2) && d.host.row >= 0 && d.host.row < 5 ? d.host : null;
  hr.className = h ? 'on' + (d.appear ? ' in' : '') : '';
  if (h) { hr.style.left = (h.team === 1 ? 6 : 510) + 'px'; hr.style.top = (217 - 186 + 48 * h.row) + 'px'; }
}
if (window.api) { window.api.onSlotTeam(draw); }
else {   // 🎨 목업(브라우저 직접 열기) — ?me=1&team=1&row=0
  const q = new URLSearchParams(location.search);
  draw({ me: +(q.get('me') || 0), host: q.get('team') ? { team: +q.get('team'), row: +(q.get('row') || 0) } : null, appear: false });
}

