// 🧪 1시간 넘게 켜 둬도 정상인지(2단계 인증 · 출입증 1시간마다 교체) — 숨김 앱 하나를 켜 둔 채(tools/cdp.cjs 머리 주석 · 계정 「한시간A#T」)
// 사용: node tools/hour-test.cjs [분=70] [포트=9333] · 5분마다 접속 신호(쓰기)·대기실 · 끝에 다른 사람이 들어오면 대기실에 바로 보이는지
// ⚠️ v0.1.110~ 방 사람 = rooms/{방}/members · 끝나면 시험 방·presence·accounts의 fake-한시간A 정리(관리자 tools/gapi.cjs)
const { execFileSync } = require('child_process');
const CDP = require('path').join(__dirname, 'cdp.cjs'), MIN = +(process.argv[2] || 70), PORT = process.argv[3] || '9333';
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app', K = 'AIzaSyDhVbSzNQ306LUTcPo44Ru9G4_RqV9Dl_E';
const cdp = expr => { try { return JSON.parse(JSON.parse(execFileSync('node', [CDP, PORT, 'overlay.html', expr]).toString().trim())); } catch (e) { return { err: String(e.message).slice(0, 120) }; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
let TOK = '';
const token = async () => { TOK = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${K}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' })).json()).idToken; };
const get = async p => (await fetch(`${DB}/${p}.json?auth=${TOK}`)).json();
const put = (p, v) => fetch(`${DB}/${p}.json?auth=${TOK}`, { method: 'PUT', body: JSON.stringify(v) });
(async () => {
  await token();
  const r = cdp("window.api.roomCreate('1시간시험방',false,'').then(r=>JSON.stringify(r))"); console.log(now(), '방 만들기', JSON.stringify(r));
  await sleep(4000);
  const rid = cdp("window.api.getRooms().then(d=>JSON.stringify(d.room&&d.room.id))"); console.log(now(), '방', rid);
  const KA = encodeURIComponent('fake-한시간A'), KB = encodeURIComponent('fake-한시간B');
  const t0 = Date.now(); let bad = 0;
  while (Date.now() - t0 < MIN * 60e3) {
    await sleep(5 * 60e3); await token();   // 시험 쪽 표식도 1시간마다 바뀌니 매번 새로
    const p = await get(`today/rooms/${String(rid).replace(/"/g, '')}/members/${KA}`), c = await get('today/conns');
    const age = p && p.at ? Math.round((Date.now() - p.at) / 1000) : null;
    const lob = cdp("window.api.getLobby().then(d=>JSON.stringify((d.members||[]).map(m=>m.name)))");
    const ok = age != null && age < 45;
    if (!ok) bad++;
    console.log(now(), `${Math.round((Date.now() - t0) / 60e3)}분`, ok ? '✅' : '❌', '접속 신호', age, '초 전 · 자리 신호', Object.keys(c || {}).length, '개 · 대기실', JSON.stringify(lob));
  }
  // 마지막: 다른 사람이 들어오면 실시간으로 받는지(스트림이 새 표식으로 다시 붙었는지)
  await token();
  await put(`today/rooms/${String(rid).replace(/"/g, '')}/members/${KB}`, { name: '한시간B', tag: 'T', at: Date.now(), app: '0.1.109', room: String(rid).replace(/"/g, '') });
  await sleep(4000);
  const lob = cdp("window.api.getLobby().then(d=>JSON.stringify((d.members||[]).map(m=>m.name)))");
  const got = String(lob).includes('한시간B');
  console.log(now(), got ? '✅' : '❌', `${MIN}분 뒤 실시간 받기(B 들어옴)`, JSON.stringify(lob), '· 접속 신호 실패', bad, '번');
  await put(`today/rooms/${String(rid).replace(/"/g, '')}/members/${KB}`, null);
  console.log('끝', JSON.stringify({ rid, got, bad }));
})();
