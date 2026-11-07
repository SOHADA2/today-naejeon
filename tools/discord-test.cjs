// 🎧 디스코드 연동 시험(v0.1.130) — node tools/discord-test.cjs
//  A. discord.js ↔ 가짜 디스코드 앱(이름 있는 파이프 tn-fake-discord-N): 빈 번호 건너뛰기 · 인사(client_id) · READY 사용자 · 상태 보내기 5초 제한·같은 내용 안 보냄 · 핑/퐁 · 잘못된 앱 번호 · 종료 때 지움
//  B. 중계 worker/clips-proxy.js의 /discord/move ↔ 가짜 디스코드 API(http): 같은 카테고리 1팀/2팀 · 음성 채널 없음 · 이미 그 채널 · 429 한 번 기다렸다 다시 · 모으기(원래 채널·대기 채널·팀 채널에 없는 사람은 안 끌어옴) · 표식 없음 401 · 봇 없음 501
//  실제 디스코드·실제 봇은 안 건드림(B의 로그인 표식만 진짜 Firebase 익명 표식)
const net = require('net'), http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const makeDiscord = require('../discord');
let fails = 0; const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PIPE = i => `\\\\?\\pipe\\tn-fake-discord-${i}`;

function fakeDiscord(i, { reject } = {}) {
  const got = []; let sock = null, buf = Buffer.alloc(0);
  const frame = (op, o) => { const j = Buffer.from(JSON.stringify(o)); const h = Buffer.alloc(8); h.writeUInt32LE(op, 0); h.writeUInt32LE(j.length, 4); return Buffer.concat([h, j]); };
  const srv = net.createServer(s => {
    sock = s;
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8) {
        const op = buf.readUInt32LE(0), len = buf.readUInt32LE(4); if (buf.length < 8 + len) break;
        const msg = JSON.parse(buf.slice(8, 8 + len).toString()); buf = buf.slice(8 + len);
        got.push({ op, msg, t: Date.now() });
        if (op === 0) {
          if (reject) s.write(frame(2, { code: 4000, message: 'Invalid Client ID' }));
          else s.write(frame(1, { cmd: 'DISPATCH', evt: 'READY', data: { v: 1, user: { id: '123456789012345678', username: 'tester', global_name: '테스터' } } }));
        }
      }
    });
    s.on('error', () => {});
  });
  srv.listen(PIPE(i));
  return { got, srv, ping: () => sock.write(frame(3, { hi: 1 })), kill: () => { try { sock.destroy(); } catch (_) {} } };
}

async function partA() {
  console.log('── A. discord.js ↔ 가짜 디스코드 앱');
  const D = fakeDiscord(1);   // 0번은 없음 → 1번으로 붙어야
  const users = [];
  const dc = makeDiscord({ pipe: PIPE, log: () => {}, onUser: u => users.push(u) });
  dc.setApp('1436000000000000001');
  await sleep(400);
  ok(D.got[0] && D.got[0].op === 0 && D.got[0].msg.client_id === '1436000000000000001' && D.got[0].msg.v === 1, '빈 파이프 번호 건너뛰고 인사(client_id·v 1)');
  ok(dc.ready && dc.user && dc.user.id === '123456789012345678' && dc.user.name === '테스터', `READY 사용자 = ${JSON.stringify(dc.user)}`);
  ok(users.length === 1 && users[0].id === '123456789012345678', 'onUser 한 번');
  const t0 = Date.now();
  dc.setActivity({ details: '대기실 · 테스트 방', state: '3명 모임' });
  await sleep(200);
  dc.setActivity({ details: '대기실 · 테스트 방', state: '3명 모임' });   // 같은 내용
  dc.setActivity({ details: '팀 확정 · 테스트 방', state: '1팀 · 3:3' });
  await sleep(300);
  let acts = D.got.filter(g => g.op === 1 && g.msg.cmd === 'SET_ACTIVITY');
  ok(acts.length === 1 && acts[0].msg.args.pid === process.pid && acts[0].msg.args.activity.details === '대기실 · 테스트 방', '첫 상태 바로 보냄(pid·activity)');
  await sleep(5000);
  acts = D.got.filter(g => g.op === 1 && g.msg.cmd === 'SET_ACTIVITY');
  ok(acts.length === 2 && acts[1].msg.args.activity.details === '팀 확정 · 테스트 방' && acts[1].t - acts[0].t >= 4900, `두 번째는 5초 뒤(${acts[1] ? acts[1].t - acts[0].t : '-'}ms) · 중간 같은 내용 안 보냄`);
  D.ping(); await sleep(200);
  ok(D.got.some(g => g.op === 4 && g.msg.hi === 1), '핑 → 퐁');
  dc.stop(); await sleep(300);
  acts = D.got.filter(g => g.op === 1 && g.msg.cmd === 'SET_ACTIVITY');
  ok(acts.length === 3 && !acts[2].msg.args.activity, '종료 때 상태 지움(activity 없음)');
  D.srv.close();

  const R = fakeDiscord(0, { reject: true });
  const logs = [];
  const dc2 = makeDiscord({ pipe: PIPE, log: m => logs.push(m), onUser: () => {} });
  dc2.setApp('999999999999999999');
  await sleep(400);
  ok(!dc2.ready && logs.some(m => /4000/.test(m)), '잘못된 앱 번호 = 연결 안 됨(디스코드가 닫음)');
  dc2.stop(); R.srv.close();
  const dc3 = makeDiscord({ pipe: PIPE, log: () => {}, onUser: () => {} });
  dc3.setApp('abc'); ok(dc3.appId === null, '숫자 아닌 앱 번호 무시');
  dc3.setApp('1436000000000000001'); await sleep(500); ok(!dc3.ready, '디스코드 없음 = 조용히 기다림'); dc3.stop();
}

async function partB() {
  console.log('── B. 중계 /discord/move ↔ 가짜 디스코드 API');
  const CH = [
    { id: '900000000000000001', type: 4, name: '내전' }, { id: '900000000000000002', type: 4, name: '수다' },
    { id: '910000000000000001', type: 2, name: '🎮 내전 대기실', parent_id: '900000000000000001', position: 0 },
    { id: '910000000000000002', type: 2, name: '1팀', parent_id: '900000000000000001', position: 1 },
    { id: '910000000000000003', type: 2, name: '2팀', parent_id: '900000000000000001', position: 2 },
    { id: '910000000000000004', type: 2, name: '잡담', parent_id: '900000000000000002', position: 0 },
    { id: '910000000000000005', type: 2, name: '팀 1', parent_id: '900000000000000002', position: 1 },
    { id: '910000000000000006', type: 0, name: '1팀-채팅', parent_id: '900000000000000001', position: 3 },
  ];
  const U = { a: '800000000000000001', b: '800000000000000002', c: '800000000000000003', d: '800000000000000004', e: '800000000000000005' };
  const voice = { [U.a]: '910000000000000001', [U.b]: '910000000000000004', [U.d]: '910000000000000002', [U.e]: '910000000000000004' };
  const patches = []; let tooMany = 1, authOk = true;
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      if (req.headers.authorization !== 'Bot fake-bot') authOk = false;
      const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
      let m;
      if (req.url === '/users/@me/guilds') return send(200, [{ id: '700000000000000001', name: '우리 서버' }]);
      if (req.url === '/guilds/700000000000000001/channels') return send(200, CH);
      if (req.url === '/guilds/700000000000000001') return send(200, { id: '700000000000000001', name: '우리 서버' });
      if ((m = /^\/guilds\/700000000000000001\/members\/(\d+)$/.exec(req.url)) && req.method === 'GET') return m[1] === U.c ? send(404, { message: 'Unknown Member', code: 10007 }) : send(200, { user: { id: m[1] } });
      if (req.url.startsWith('/guilds/7999')) return send(403, { message: 'Missing Access', code: 50001 });
      if ((m = /^\/guilds\/700000000000000001\/voice-states\/(\d+)$/.exec(req.url))) return voice[m[1]] ? send(200, { channel_id: voice[m[1]], user_id: m[1] }) : send(404, { message: 'Unknown Voice State', code: 10065 });
      if (req.method === 'PATCH' && (m = /^\/guilds\/700000000000000001\/members\/(\d+)$/.exec(req.url))) {
        if (m[1] === U.a && tooMany-- > 0) return send(429, { retry_after: 0.3, global: false });
        const cid = JSON.parse(body).channel_id; patches.push([m[1], cid]); voice[m[1]] = cid; return send(204);
      }
      send(404, { message: 'nope' });
    });
  }).listen(0);
  await new Promise(r => srv.once('listening', r));
  const api = `http://127.0.0.1:${srv.address().port}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tn-dc-')), mjs = path.join(tmp, 'w.mjs');
  fs.copyFileSync(path.join(__dirname, '..', 'worker', 'clips-proxy.js'), mjs);
  const W = await import('file:///' + mjs.replace(/\\/g, '/'));
  const tok = (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyDhVbSzNQ306LUTcPo44Ru9G4_RqV9Dl_E', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' })).json()).idToken;
  const env = { DISCORD_BOT_TOKEN: 'fake-bot', DISCORD_API: api, REQUIRE_AUTH: '1' };
  const call = async (body, e = env, auth = true) => {
    const r = await W.route(new Request('https://x/discord/move', { method: 'POST', body: JSON.stringify(body), headers: Object.assign({ 'x-tn-app': 'today-naejeon', 'content-type': 'application/json' }, auth ? { authorization: `Bearer ${tok}` } : {}) }), e);
    return { st: r.status, j: await r.json() };
  };
  let r = await call({ moves: [{ id: U.a, to: 't1' }, { id: U.b, to: 't2' }, { id: U.c, to: 't1' }, { id: U.d, to: 't1' }, { id: U.e, to: 't1' }] });
  const by = id => (r.j.moved || []).find(x => x.id === id) || {};
  ok(r.st === 200, `나누기 응답 ${r.st}`);
  ok(by(U.a).ok && by(U.a).to === '910000000000000002' && by(U.a).from === '910000000000000001', 'A 대기실 → 같은 카테고리 「1팀」 · 429 한 번 뒤 성공');
  ok(!by(U.b).ok && by(U.b).why === 'not near', 'B 잡담(다른 카테고리 · 2팀은 내전 카테고리) → 안 끌어옴(내전 자리 아님)');
  ok(!by(U.c).ok && by(U.c).why === 'not in voice', 'C 음성 채널 없음 → 건너뜀');
  ok(by(U.d).ok && by(U.d).same, 'D 이미 1팀 → 그대로');
  ok(by(U.e).ok && by(U.e).to === '910000000000000005', 'E 잡담 → 같은 카테고리 「팀 1」');
  ok(!patches.some(p => p[1] === '910000000000000006'), '글 채널(1팀-채팅)로는 안 옮김');
  voice[U.b] = '910000000000000003';   // B가 스스로 2팀에 들어감
  r = await call({ moves: [{ id: U.a, to: 'lobby', back: '910000000000000001' }, { id: U.b, to: 'lobby', back: '910000000000000004' }, { id: U.d, to: 'lobby' }, { id: U.c, to: 'lobby' }] });
  ok(by(U.a).ok && by(U.a).to === '910000000000000001', '모으기 A → 원래 채널(대기실)');
  ok(by(U.b).ok && by(U.b).to === '910000000000000004', '모으기 B → 원래 채널(잡담)');
  ok(by(U.d).ok && by(U.d).to === '910000000000000001', '모으기 D(원래 채널 모름) → 같은 카테고리 「대기」 채널');
  voice[U.e] = '910000000000000004';
  r = await call({ moves: [{ id: U.e, to: 'lobby' }] });
  ok(!by(U.e).ok && by(U.e).why === 'not in team channel', '팀 채널에 없는 사람은 안 끌어옴');
  ok(authOk, '봇 토큰 = Authorization: Bot …');
  r = await call({ moves: [{ id: U.a, to: 't1' }] }, env, false); ok(r.st === 401, `표식 없음 → ${r.st}`);
  r = await call({ moves: [{ id: U.a, to: 't1' }] }, { DISCORD_API: api, REQUIRE_AUTH: '1' }); ok(r.st === 501 && r.j.err === 'no bot', `봇 없음 → ${r.st}`);
  r = await call({ moves: [{ id: 'x', to: 't1' }, { id: U.a, to: 'roof' }] }); ok(r.st === 400, `잘못된 요청 → ${r.st}`);
  r = await call({ guild: '700000000000000001', moves: [{ id: U.a, to: 't1' }] }); ok(by(U.a).ok && by(U.a).to === '910000000000000002', '서버 지정 → 그 서버에서 옮김');
  r = await call({ guild: '799900000000000001', moves: [{ id: U.a, to: 't1' }] }); ok(r.j.err && !(r.j.moved || []).length, `봇 없는 서버 지정 → ${r.j.err}`);
  const gq = async g => { const x = await W.route(new Request('https://x/discord/guild', { method: 'POST', body: JSON.stringify({ guild: g }), headers: { 'x-tn-app': 'today-naejeon', 'content-type': 'application/json', authorization: `Bearer ${tok}` } }), env); return { st: x.status, j: await x.json() }; };
  r = await gq('700000000000000001'); ok(r.st === 200 && r.j.name === '우리 서버' && r.j.t1 && r.j.t2 && r.j.lobby, `서버 확인 = ${JSON.stringify(r.j)}`);
  r = await gq('799900000000000001'); ok(r.st === 404, `봇 없는 서버 확인 → ${r.st}`);
  const mq = async (g, id) => { const x = await W.route(new Request('https://x/discord/member', { method: 'POST', body: JSON.stringify({ guild: g, id }), headers: { 'x-tn-app': 'today-naejeon', 'content-type': 'application/json', authorization: `Bearer ${tok}` } }), env); return { st: x.status, j: await x.json() }; };
  r = await mq('700000000000000001', U.a); ok(r.st === 200 && r.j.in === true, '서버에 있는 사람 → in true');
  r = await mq('700000000000000001', U.c); ok(r.st === 200 && r.j.in === false, '서버에 없는 사람 → in false');
  r = await mq('799900000000000001', U.a); ok(r.st === 502, `봇 없는 서버 → ${r.st}`);
  srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  await partA(); await partB();
  console.log(fails ? `❌ 실패 ${fails}건` : '✅ 전부 통과');
  process.exit(fails ? 1 : 0);
})();
