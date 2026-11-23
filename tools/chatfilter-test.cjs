// 💬 채팅 거르기 시험 — node tools/chatfilter-test.cjs · 가려야 하는 말 / 그대로 둬야 하는 말(오탐)
const { clean, has } = require('../overlay/chatfilter.js');
const BAD = ['아 시발', '씨발 진짜', 'ㅅㅂ', 'ㅆㅂ 뭐함', '시1발', '시 발', '병신아', '븅신', 'ㅂㅅ', '좆같네', 'ㅈ같다', '존나 못하네', '졸라', 'ㅈㄴ', '개새끼', '개색기야', '이 새끼', 'ㄱㅅㄲ', 'ㅅㄲ',
  '느금마', '느개비', '니애미', '니엄마', '니미', '애미없냐', '엠창', '지랄하네', 'ㅈㄹ', '염병', '미친놈', 'ㅁㅊ', '닥쳐', '등신', '찐따', '틀딱', '고아새끼', 'fuck you', 'FUUUCK', 'shit', 'tlqkf', 'qudtls', 'ㅗ', 'ㅗㅗㅗ', '병.신', '씹새', '개같이 이겼다'];
const OK = ['안녕하세요', '시바견 귀엽다', '롤 꺼져 있어', '닥치는 대로 사자', '와 미쳤다 잘하네', '한남동 가자', '2026년 11월', '좋아요', '방장님 시작해요', '신발 샀어', '발 빠르다', '새로 시작', '가자 가자', '오늘 몇 판?', '고마워', 'ㅋㅋㅋㅋ', 'ㅠㅠ', '정글 가요', '시작할게요', '시간 됐어', '병원 다녀옴', '존재감', '졸려', '니가 해'];
let f = 0;
for (const t of BAD) { const c = clean(t); const ok = c !== t && has(t); if (!ok) f++; console.log(ok ? '✅' : '❌', '가림', JSON.stringify(t), '→', JSON.stringify(c)); }
for (const t of OK) { const c = clean(t); const ok = c === t; if (!ok) f++; console.log(ok ? '✅' : '⚠️', '둠  ', JSON.stringify(t), ok ? '' : '→ ' + JSON.stringify(c)); }
console.log(`\n${BAD.length + OK.length}건 · 어긋남 ${f}`);
