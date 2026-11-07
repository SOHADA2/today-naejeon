// 🎧 디스코드 연동(v0.1.130) — 각자 PC에서 켜져 있는 디스코드 앱과 직접 이야기함(로컬 파이프 · 인터넷·토큰 없음)
//  ① 프로필 상태(Rich Presence): 「투데이 내전 플레이 중 · 대기실 · ○○의 방 · 6명」 — main dcPresence가 상황을 계산해 setActivity
//  ② 내 디스코드 계정 번호: 연결되면 디스코드가 READY에 사용자(id·이름)를 알려 줌 → main이 today/discord/{puuid}에 적음
//     → 방장 앱이 팀이 짜지면 그 번호로 음성 채널 1팀/2팀 이동을 중계(worker /discord/move · 봇)에 부탁
//  통신 = \\?\pipe\discord-ipc-0~9 · 프레임 = [op uint32 LE][길이 uint32 LE][JSON] · op 0 인사(v·client_id) · 1 명령/응답 · 2 닫힘 · 3 핑 → 4 퐁
//  디스코드가 꺼져 있으면 20초마다 다시(잘못된 앱 번호면 5분) · 상태 보내기는 디스코드 제한(20초에 5번) 때문에 5초에 한 번까지 · 같은 내용은 안 보냄
const net = require('net');

function makeDiscord(o) {
  const log = o.log || (() => {});
  let sock = null, buf = Buffer.alloc(0), ready = false, user = null, appId = null;
  let want = null, sentSig = 'null', lastSend = 0, sendTimer = null, retryTimer = null, slow = false, nonce = 0;
  const frame = (op, obj) => { const j = Buffer.from(JSON.stringify(obj), 'utf8'); const h = Buffer.alloc(8); h.writeUInt32LE(op, 0); h.writeUInt32LE(j.length, 4); return Buffer.concat([h, j]); };
  const pipe = o.pipe || (i => process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${i}` : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp'}/discord-ipc-${i}`);   // o.pipe = 시험용

  function drop(why) {
    if (sock) { try { sock.destroy(); } catch (_) {} }
    const was = ready;
    sock = null; buf = Buffer.alloc(0); ready = false; sentSig = 'null';   // 처음 연결 땐 빈 상태를 따로 안 보냄
    if (was) { log(`🎧 디스코드 연결 끊김(${why})`); if (o.onUser) o.onUser(null); }
    user = null;
    if (appId && !retryTimer) retryTimer = setTimeout(() => { retryTimer = null; connect(0); }, slow ? 300000 : 20000);
  }
  function connect(i) {
    if (!appId || sock) return;
    if (i > 9) return drop('디스코드 꺼짐');
    const s = net.createConnection(pipe(i));
    let opened = false;
    s.once('error', () => { if (!opened) { try { s.destroy(); } catch (_) {} connect(i + 1); } else if (sock === s) drop('오류'); });
    s.on('connect', () => {
      opened = true; sock = s; buf = Buffer.alloc(0);
      s.write(frame(0, { v: 1, client_id: appId }));
    });
    s.on('data', d => { if (sock === s) onData(d); });
    s.on('close', () => { if (sock === s) drop('닫힘'); });
  }
  function onData(d) {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 8) {
      const op = buf.readUInt32LE(0), len = buf.readUInt32LE(4);
      if (buf.length < 8 + len) break;
      let msg = null; try { msg = JSON.parse(buf.slice(8, 8 + len).toString('utf8')); } catch (_) {}
      buf = buf.slice(8 + len);
      if (op === 3) { try { sock.write(frame(4, msg)); } catch (_) {} continue; }
      if (op === 2) { slow = !!(msg && (msg.code === 4000 || /client id/i.test(msg.message || ''))); log(`🎧 디스코드가 연결을 닫음 ${JSON.stringify(msg || {}).slice(0, 120)}`); drop('거절'); return; }
      if (!msg) continue;
      if (msg.cmd === 'DISPATCH' && msg.evt === 'READY') {
        ready = true; slow = false;
        const u = (msg.data && msg.data.user) || {};
        user = u.id ? { id: String(u.id), name: String(u.global_name || u.username || '').slice(0, 40), username: String(u.username || '').slice(0, 40) } : null;
        log(`🎧 디스코드 연결됨 · ${user ? `${user.name}(${user.id})` : '사용자 모름'}`);
        if (o.onUser) o.onUser(user);
        flush();
      } else if (msg.evt === 'ERROR') log(`🎧 디스코드 오류 ${JSON.stringify(msg.data || {}).slice(0, 160)}`);
    }
  }
  function flush() {
    if (!ready || !sock) return;
    const sig = JSON.stringify(want);
    if (sig === sentSig) return;
    const wait = lastSend + 5000 - Date.now();
    if (wait > 0) { if (!sendTimer) sendTimer = setTimeout(() => { sendTimer = null; flush(); }, wait); return; }
    const args = { pid: process.pid }; if (want) args.activity = want;
    try { sock.write(frame(1, { cmd: 'SET_ACTIVITY', args, nonce: `tn${Date.now()}-${++nonce}` })); sentSig = sig; lastSend = Date.now(); } catch (_) { drop('보내기 실패'); }
  }
  return {
    setApp(id) {   // 디스코드 개발자 사이트 앱 번호(공개값) — 바뀌면 다시 연결
      id = id && /^\d{15,21}$/.test(String(id)) ? String(id) : null;
      if (id === appId) return;
      appId = id; slow = false;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      if (sock) drop('앱 번호 바뀜');
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      if (appId) connect(0);
    },
    setActivity(a) { want = a || null; flush(); },
    get user() { return user; },
    get ready() { return ready; },
    get appId() { return appId; },
    stop() {   // 앱 종료 — 상태 지우고 닫음
      appId = null;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
      if (sock && ready) { try { sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: 'tn-bye' })); } catch (_) {} }
      if (sock) { try { sock.end(); } catch (_) {} }
      sock = null; ready = false; user = null;
    },
    _frame: frame,
  };
}
module.exports = makeDiscord;
