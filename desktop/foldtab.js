// foldtab.html 화면 스크립트(v0.1.293 보안 점검: 화면 안 인라인 스크립트를 파일로 뺌 = CSP가 인라인 실행을 막게)
const side = new URLSearchParams(location.search).get('side') === 'R' ? 'R' : 'L';
document.body.classList.add(side);
const hit = document.getElementById('hit');
// v0.1.281~284 힌트 소리 → v0.1.285 없앰(사장님: 화살표 소리는 안 줘도 됨)
hit.addEventListener('click', () => { if (window.api && window.api.winFold) window.api.winFold(side, false); });
const replay = () => { document.body.classList.remove('in'); void document.body.offsetWidth; document.body.classList.add('in'); };
if (window.api && window.api.onFoldTabIn) window.api.onFoldTabIn(replay);
replay();

