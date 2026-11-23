// 💬 채팅 욕설·비속어 가리기(v0.1.245 · 대략적인 목록 — 사장님: 채팅에서 욕설·비속어를 대략 걸러 줘)
//   보내는 쪽(main chat-send) = 서버에 쓰기 전에 ●로 바꿈(옛 앱·「욕설 가리기」를 끈 사람에게도 가려져 감) · 보는 쪽(overlay chatClean) = 예전 앱이 보낸 말도 가림(⚙ 설정으로 끌 수 있음)
//   글자 사이에 띄어쓰기·숫자·점 같은 걸 끼워도 잡음(시1발 · 병.신 · ㅅ ㅂ) · 영문·자판 그대로 친 것(tlqkf) 포함
//   ⚠️ 오탐 줄이려고 뺀 것: 시바(견) · 꺼져(「롤 꺼져 있어」) · 닥치는 대로 · 미쳤다(칭찬) · 한남(동) — 더할 땐 node tools/chatfilter-test.cjs로 확인
//   main.js(require)와 왼쪽 창(<script> → window.tnChatFilter)이 같이 씀
(function (root) {
  const SEP = '[\\s.,_~!?*·\\-0-9]*';
  const KO = [
    ['씨시ㅆㅅ', '발빨팔벌ㅂ'], ['씹', '새쌔색할년놈'], ['병븅빙', '신싄딱'], ['ㅂ', 'ㅅ'], ['좆좃'], ['존', '나'], ['졸', '라'], ['ㅈ', 'ㄴ'],
    ['ㅈ좆족개', '같'], ['개', '새색섀세쌔', '끼기키'], ['새섀쌔', '끼'], ['ㄱ', 'ㅅ', 'ㄲ'], ['ㅅ', 'ㄲ'], ['느', '금'], ['느', '개', '비'],
    ['니', '애엄', '미마비'], ['니', '미'], ['애', '미비'], ['엠', '창'], ['지', '랄'], ['ㅈ', 'ㄹ'], ['염', '병'], ['미', '친', '놈년새넘'],
    ['ㅁ', 'ㅊ'], ['닥', '쳐'], ['등', '신'], ['찐', '따'], ['틀', '딱'], ['고', '아', '새섀', '끼'], ['애', '자'],
  ];
  const EN = ['fuck', 'fck', 'fuk', 'shit', 'bitch', 'asshole', 'nigga', 'nigger', 'sibal', 'ssibal', 'tlqkf', 'qudtls'];
  const one = cs => cs.length === 1 ? cs : `[${cs}]`;
  const src = KO.map(w => w.map(one).join(SEP)).concat(EN.map(w => w.split('').map(c => c + '+').join(SEP)));
  const BAD = new RegExp(src.join('|') + '|(?:^|(?<=\\s))ㅗ+(?=\\s|$)', 'gi');
  const clean = t => String(t == null ? '' : t).replace(BAD, w => '●'.repeat(Math.min(4, Math.max(2, w.replace(/[^가-힣ㄱ-ㅎa-z]/gi, '').length))));
  const has = t => { BAD.lastIndex = 0; const r = BAD.test(String(t == null ? '' : t)); BAD.lastIndex = 0; return r; };
  const api = { BAD, clean, has };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.tnChatFilter = api;
})(typeof window !== 'undefined' ? window : globalThis);
