// 🎞️ 투데이 내전 영상 중계(Cloudflare Workers · 무료) — 2026-11-02
// GitHub 토큰(비공개 저장소 today-naejeon-clips · Contents 읽기쓰기)은 **여기 비밀값 GH_TOKEN에만** 있음.
// 앱은 토큰 없이 이 중계에 「올리기·받기·화면 보내기」만 부탁 → 토큰이 앱·Firebase에 없으니 꺼내 갈 수 없음.
// 할 수 있는 것 = 그날 릴리스(clips-YYYY-MM-DD)에 영상 올리기 · 영상 받기(서명된 임시 주소로 넘김) · 증강 화면(aug-shots 릴리스) 올리기
// 못 하는 것 = 지우기·덮어쓰기·다른 파일 읽기(지우기는 매일 정리 cron만 · 3일 지난 clips- 릴리스)
// 경로: POST /upload?day=&name= (video/webm|mp4 · 45MB 이하) → {id} · GET /clip/{id} → 302 · POST /shot?name= (jpg·json 8MB 이하) → {id}
//       POST /upload-token?day= → {token, upload, exp}(2026-11-05 · 앱이 GitHub에 직접 올림 · 아래 appToken)
//       POST /discord/move {moves:[{id, to:'t1'|'t2'|'lobby', back?}]} → {moved:[…]}(2026-11-07 · 디스코드 음성 채널 이동 · 아래 discordMove · 봇 토큰 = 비밀값 DISCORD_BOT_TOKEN)
// x-tn-app 머리말은 지나가는 요청 거르기용일 뿐(앱 코드에 공개) — 보안 장치 아님
// 🔐 2026-11-02(앱 v0.1.99~): Authorization: Bearer <Firebase 익명 로그인 표식> 확인(구글 공개키로 서명·프로젝트·만료) — 표식이 있는데 가짜면 401
//   표식 없는 요청 = 옛 앱(전환 중) → vars REQUIRE_AUTH="1"이면 거절(친구들 업데이트 뒤 · DB 2단계 규칙과 같이)
const DAY = /^\d{4}-\d\d-\d\d$/, CLIP = /^[\w-]{1,80}\.(webm|mp4)$/, SHOT = /^[\w.-]{1,120}\.(jpg|json)$/;
const MAX_CLIP = 45 * 1048576, MAX_SHOT = 8 * 1048576, KEEP_DAYS = 3;
const PROJECT = 'today-naejeon-sohada';

export default {
  async fetch(req, env) {
    try { return await route(req, env); } catch (e) { return json({ err: String((e && e.message) || e) }, 500); }
  },
  async scheduled(_ev, env) { await cleanup(env); },
};

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
function gh(env, method, p, body, headers) {
  const url = /^https?:/.test(p) ? p : `${env.GH_API || 'https://api.github.com'}/repos/${env.REPO}${p}`;
  return fetch(url, { method, body, redirect: 'manual', headers: Object.assign({ Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'today-naejeon-clips' }, headers) });
}
const dayOk = day => DAY.test(day || '') && Math.abs(Date.now() - Date.parse(day + 'T00:00:00Z')) < 3 * 86400000;   // 앱 하루(새벽 6시 기준) ±여유

async function release(env, tag, title) {   // 그 태그 릴리스(없으면 만듦 · 동시에 만들어 422면 다시 찾음)
  let r = await gh(env, 'GET', `/releases/tags/${tag}`); if (r.ok) return r.json();
  r = await gh(env, 'POST', '/releases', JSON.stringify({ tag_name: tag, name: title, body: '투데이 내전 앱이 자동으로 올리고 지움' }), { 'Content-Type': 'application/json' }); if (r.ok) return r.json();
  r = await gh(env, 'GET', `/releases/tags/${tag}`); return r.ok ? r.json() : null;
}
async function upload(env, rel, name, type, buf) {
  const r = await gh(env, 'POST', `${rel.upload_url.replace(/\{.*$/, '')}?name=${encodeURIComponent(name)}`, buf, { 'Content-Type': type });
  const j = await r.json().catch(() => null);
  return r.ok && j && j.id ? json({ id: j.id }) : json({ err: 'upload', status: r.status }, 502);
}

// ⚡ 2026-11-05(앱 v0.1.124~): 앱이 GitHub에 **직접** 올리게 임시 토큰을 줌 — 이 중계는 Cloudflare 무료라 한국 요청이 미국 LA(colo=LAX)로 가서
//   큰 영상을 여기로 보내면 1~3분·자주 끊김(실측 9MB 65~178초) · 한국 → GitHub 직접은 9MB 2~4초 → 토큰만 여기서 받고 영상은 GitHub로 바로
//   토큰 = GitHub App(비공개 · 앱 id/설치 번호 = vars GH_APP_ID·GH_INSTALL_ID · 비밀 키 = 비밀값 GH_APP_KEY PKCS#8) 설치 토큰:
//   clips 저장소 하나 · Contents 쓰기만 · 1시간짜리(로그인 표식 있는 앱만 · 올리기 횟수 제한 같이) — 새도 1시간 뒤 못 쓰고 다른 저장소는 못 건드림
let _tok = null;
const b64uStr = s => btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function appToken(env) {
  if (_tok && _tok.exp - Date.now() > 10 * 60e3) return _tok;   // 10분 넘게 남은 건 같이 씀
  const now = Math.floor(Date.now() / 1000), head = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), pay = b64uStr(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(env.GH_APP_ID) }));
  const der = Uint8Array.from(atob(String(env.GH_APP_KEY).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${pay}`)));
  const jwt = `${head}.${pay}.${b64uStr(String.fromCharCode(...sig))}`;
  const r = await fetch(`https://api.github.com/app/installations/${env.GH_INSTALL_ID}/access_tokens`, { method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'User-Agent': 'today-naejeon-clips', 'Content-Type': 'application/json' },
    body: JSON.stringify({ repositories: [String(env.REPO).split('/')[1]], permissions: { contents: 'write' } }) });
  const j = await r.json().catch(() => null); if (!j || !j.token) return null;
  _tok = { token: j.token, exp: Date.parse(j.expires_at) }; return _tok;
}

let _jwk = null;
async function jwks() {   // 구글 표식 서명 공개키(1시간 보관)
  if (_jwk && Date.now() - _jwk.at < 3600e3) return _jwk.keys;
  const j = await (await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')).json();
  _jwk = { at: Date.now(), keys: j.keys || [] }; return _jwk.keys;
}
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
async function verifyIdToken(tok) {   // 맞으면 uid · 아니면 null
  const [h, p, sig] = String(tok || '').split('.'); if (!sig) return null;
  let H, P; try { H = JSON.parse(new TextDecoder().decode(b64u(h))); P = JSON.parse(new TextDecoder().decode(b64u(p))); } catch (_) { return null; }
  const now = Date.now() / 1000;
  if (H.alg !== 'RS256' || P.aud !== PROJECT || P.iss !== `https://securetoken.google.com/${PROJECT}` || !(P.exp > now) || !(P.iat <= now + 300) || !P.sub) return null;
  const jwk = (await jwks()).find(k => k.kid === H.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  return (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(`${h}.${p}`))) ? P.sub : null;
}

async function route(req, env) {
  const u = new URL(req.url);
  if (req.headers.get('x-tn-app') !== 'today-naejeon') return json({ err: 'forbidden' }, 403);
  const auth = req.headers.get('authorization') || '';
  const uid = auth.startsWith('Bearer ') ? await verifyIdToken(auth.slice(7)) : null;
  if (auth && !uid) return json({ err: 'bad token' }, 401);
  if (!uid && env.REQUIRE_AUTH === '1') return json({ err: 'login required' }, 401);
  // 🛡️ 1분에 올리기 10번·받기 40번까지(Cloudflare 무료 rate limit · 근사치) — 표식 있으면 사람(uid)별(같은 집·PC방 친구끼리 안 나눠 씀), 없으면 IP별
  const lim = req.method === 'POST' ? env.UP_LIMIT : env.GET_LIMIT;
  if (lim && !(await lim.limit({ key: uid ? `u:${uid}` : `ip:${req.headers.get('cf-connecting-ip') || ''}` })).success) return json({ err: 'too many' }, 429);
  const len = Number(req.headers.get('content-length')) || 0, type = (req.headers.get('content-type') || '').split(';')[0];
  if (req.method === 'POST' && u.pathname === '/upload') {
    const day = u.searchParams.get('day'), name = u.searchParams.get('name');
    if (!dayOk(day) || !CLIP.test(name || '') || !/^video\/(webm|mp4)$/.test(type) || !(len > 0 && len <= MAX_CLIP)) return json({ err: 'bad request' }, 400);
    const buf = await req.arrayBuffer(); if (buf.byteLength !== len) return json({ err: 'length' }, 400);
    const rel = await release(env, `clips-${day}`, `팟지 영상 ${day}`); if (!rel) return json({ err: 'release' }, 502);
    return upload(env, rel, name, type, buf);
  }
  if (req.method === 'POST' && u.pathname === '/upload-token') {   // ⚡ 직접 올리기용 임시 토큰 + 그날 릴리스 올리기 주소(로그인 표식 필수)
    if (!uid) return json({ err: 'login required' }, 401);
    const day = u.searchParams.get('day'); if (!dayOk(day)) return json({ err: 'bad request' }, 400);
    if (!env.GH_APP_KEY || !env.GH_APP_ID || !env.GH_INSTALL_ID) return json({ err: 'no app' }, 501);
    const t = await appToken(env); if (!t) return json({ err: 'token' }, 502);
    const rel = await release(env, `clips-${day}`, `팟지 영상 ${day}`); if (!rel) return json({ err: 'release' }, 502);
    return json({ token: t.token, upload: rel.upload_url.replace(/\{.*$/, ''), exp: t.exp });
  }
  if (req.method === 'POST' && u.pathname === '/shot') {
    const name = u.searchParams.get('name');
    if (!SHOT.test(name || '') || !/^(image\/jpeg|application\/json)$/.test(type) || !(len > 0 && len <= MAX_SHOT)) return json({ err: 'bad request' }, 400);
    const buf = await req.arrayBuffer(); if (buf.byteLength !== len) return json({ err: 'length' }, 400);
    const rel = await release(env, 'aug-shots', '증강 화면(Shift+F8)'); if (!rel) return json({ err: 'release' }, 502);
    return upload(env, rel, name, type, buf);
  }
  if (req.method === 'POST' && u.pathname === '/discord/move') {   // 🎧 v0.1.130 음성 채널 1팀/2팀 나누기·모으기(로그인 표식 필수 · 아래 discordMove)
    if (!uid) return json({ err: 'login required' }, 401);
    if (!env.DISCORD_BOT_TOKEN) return json({ err: 'no bot' }, 501);
    const b = await req.json().catch(() => null), ID = /^\d{15,21}$/;
    const moves = Array.isArray(b && b.moves) ? b.moves.filter(x => x && ID.test(x.id) && ['t1', 't2', 'lobby'].includes(x.to) && (!x.back || ID.test(x.back))).slice(0, 12) : [];
    if (!moves.length) return json({ err: 'bad request' }, 400);
    const gid = ID.test(String((b && b.guild) || '')) ? String(b.guild) : null;   // v0.1.131: 방장이 「서버 연결」한 서버만 봄(없으면 봇이 들어간 서버를 뒤짐)
    return json(await discordMove(env, moves, gid));
  }
  if (req.method === 'POST' && u.pathname === '/discord/guild') {   // 🎧 v0.1.131 「서버 연결」 확인 — 봇이 그 서버에 있는지 · 이름 · 1팀/2팀/대기 채널 있는지
    if (!uid) return json({ err: 'login required' }, 401);
    if (!env.DISCORD_BOT_TOKEN) return json({ err: 'no bot' }, 501);
    const b = await req.json().catch(() => null), gid = String((b && b.guild) || '');
    if (!/^\d{15,21}$/.test(gid)) return json({ err: 'bad request' }, 400);
    const g = await dcGuild(env, gid, true); if (!g) return json({ err: 'bot not in guild' }, 404);
    return json({ id: g.id, name: g.name, t1: g.chans.some(c => T1.test(c.name)), t2: g.chans.some(c => T2.test(c.name)), lobby: g.chans.some(c => LOBBY.test(c.name) && !isTeam(c)) });
  }
  if (req.method === 'POST' && u.pathname === '/discord/member') {   // 🎧 v0.1.138 이 사람이 그 서버에 들어와 있는지(대기실 「디스코드 서버 들어가기」를 띄울지)
    if (!uid) return json({ err: 'login required' }, 401);
    if (!env.DISCORD_BOT_TOKEN) return json({ err: 'no bot' }, 501);
    const b = await req.json().catch(() => null), gid = String((b && b.guild) || ''), id = String((b && b.id) || '');
    if (!/^\d{15,21}$/.test(gid) || !/^\d{15,21}$/.test(id)) return json({ err: 'bad request' }, 400);
    const r = await dc(env, 'GET', `/guilds/${gid}/members/${id}`);
    if (r.ok) return json({ in: true });
    if (r.status === 404) { const j = await r.json().catch(() => ({})); if (j.code !== 10004) return json({ in: false }); }   // 10007 서버에 없음 · 10013 그런 계정 없음 → 없음(10004 = 봇이 그 서버에 없음 → 오류)
    return json({ err: `member ${r.status}` }, 502);
  }
  if (req.method === 'POST' && u.pathname === '/discord/setup') {   // 🎨 서버 꾸미기(한 번씩 · 배포할 때 --var SETUP_KEY:무작위 를 준 동안만 열림 · 보통 배포엔 없음)
    if (!env.SETUP_KEY || String(env.SETUP_KEY).length < 20 || req.headers.get('x-setup-key') !== env.SETUP_KEY) return json({ err: 'not found' }, 404);
    if (!env.DISCORD_BOT_TOKEN) return json({ err: 'no bot' }, 501);
    const b = await req.json().catch(() => ({}));
    return json(await discordSetup(env, String(b.guild || ''), b.dry === 'drop' || b.dry === 'icon' ? b.dry : !!b.dry, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(b.icon || '') && b.icon.length < 1.4e6 ? b.icon : null));
  }
  const m = /^\/clip\/(\d{1,12})$/.exec(u.pathname);
  if (req.method === 'GET' && m) {
    const info = await gh(env, 'GET', `/releases/assets/${m[1]}`); if (!info.ok) return json({ err: 'not found' }, 404);
    const a = await info.json();
    if (!/\/releases\/download\/clips-\d{4}-\d\d-\d\d\//.test(a.browser_download_url || '')) return json({ err: 'not a clip' }, 404);   // 영상만(증강 화면 등은 안 넘김)
    const r = await gh(env, 'GET', `/releases/assets/${m[1]}`, undefined, { Accept: 'application/octet-stream' });
    const loc = r.headers.get('location'); if (!loc) return json({ err: 'no location', status: r.status }, 502);
    return Response.redirect(loc, 302);   // 서명된 임시 주소(몇 분짜리) — 토큰 없이 받음
  }
  return json({ err: 'not found' }, 404);
}

// 🎧 2026-11-07(앱 v0.1.130~): 디스코드 봇으로 음성 채널 이동 — 봇 토큰 = 비밀값 DISCORD_BOT_TOKEN(저장소·앱에 없음) · 봇은 「멤버 이동」 권한으로 서버에 초대
//   채널은 이름으로 찾음(설정 없음): 「1팀」「2팀」(team 1·팀1도) · 모을 곳 = 앱이 넘긴 원래 채널(back) → 없으면 이름에 「대기·로비·lobby」 · 같은 카테고리 먼저
//   이미 음성 채널에 들어와 있는 사람만 옮김(디스코드 규칙) · 모으기는 지금 1팀/2팀 채널에 있는 사람만(다른 데로 간 사람은 안 끌어옴)
//   앱은 각자 디스코드 앱에서 받은 자기 디스코드 번호를 today/discord/{puuid}에 적고, 방장 앱이 팀이 짜지면 이 경로를 부름
const DAPI = 'https://discord.com/api/v10';
const T1 = /(^|[^0-9])1\s*팀|팀\s*1(?![0-9])|team\s*1(?![0-9])/i, T2 = /(^|[^0-9])2\s*팀|팀\s*2(?![0-9])|team\s*2(?![0-9])/i, LOBBY = /대기|로비|lobby/i;
const isTeam = c => T1.test(c.name) || T2.test(c.name);
function dc(env, method, p, body) {
  return fetch(`${env.DISCORD_API || DAPI}${p}`, { method, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: `Bot ${String(env.DISCORD_BOT_TOKEN).trim().replace(/^Bot\s+/i, '')}`, 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (https://sohada2.github.io/today-naejeon/, 1)' } });
}
let _dg = null, _dgErr = null;
const _gc = {};   // 서버 번호 → {at, g}(1분)
const voiceChans = list => list.filter(x => x.type === 2).map(x => ({ id: x.id, name: x.name || '', parent: x.parent_id || null, pos: x.position || 0 })).sort((a, b) => a.pos - b.pos);
async function dcGuild(env, gid, fresh) {   // 그 서버 하나(봇이 없으면 null)
  const c = _gc[gid]; if (!fresh && c && Date.now() - c.at < 60e3) return c.g;
  const [gr, cr] = await Promise.all([dc(env, 'GET', `/guilds/${gid}`), dc(env, 'GET', `/guilds/${gid}/channels`)]);
  if (!gr.ok || !cr.ok) { delete _gc[gid]; _dgErr = `guild ${gr.status}`; return null; }
  const g = { id: gid, name: String((await gr.json()).name || '').slice(0, 60), chans: voiceChans(await cr.json()) };
  _gc[gid] = { at: Date.now(), g }; return g;
}
async function dcGuilds(env) {   // 봇이 들어가 있는 서버마다 음성 채널(1분 보관)
  if (_dg && Date.now() - _dg.at < 60e3) return _dg.list;
  const r = await dc(env, 'GET', '/users/@me/guilds'); if (!r.ok) { _dgErr = `guilds ${r.status}`; return []; }
  _dgErr = null;
  const list = await Promise.all((await r.json()).slice(0, 10).map(async g => {
    const c = await dc(env, 'GET', `/guilds/${g.id}/channels`);
    const chans = c.ok ? voiceChans(await c.json()) : [];
    return { id: g.id, chans };
  }));
  _dg = { at: Date.now(), list }; return list;
}
async function dcPatch(env, gid, uid, cid) {   // 429면 디스코드가 말한 만큼 한 번 기다렸다 다시
  for (let i = 0; i < 2; i++) {
    const r = await dc(env, 'PATCH', `/guilds/${gid}/members/${uid}`, { channel_id: cid });
    if (r.status !== 429) return r;
    const j = await r.json().catch(() => ({})); await new Promise(res => setTimeout(res, Math.min(3000, ((j.retry_after || 1) * 1000) | 0)));
  }
  return { ok: false, status: 429 };
}
async function discordMove(env, moves, gid) {
  const G = gid ? [await dcGuild(env, gid)].filter(Boolean) : await dcGuilds(env);
  if (!G.length) return { err: _dgErr || 'no guild', moved: [] };
  const plan = await Promise.all(moves.map(async m => {   // 지금 어느 서버·채널에 있는지(서버마다 물어봄)
    for (const g of G) {
      const r = await dc(env, 'GET', `/guilds/${g.id}/voice-states/${m.id}`);
      if (!r.ok) continue;
      const vs = await r.json().catch(() => null); if (!vs || !vs.channel_id) continue;
      const cur = g.chans.find(c => c.id === vs.channel_id) || { id: vs.channel_id, name: '', parent: null };
      const near = re => g.chans.find(c => c.parent === cur.parent && re.test(c.name)) || g.chans.find(c => re.test(c.name));
      let to = null;
      if (m.to === 'lobby') {
        if (!isTeam(cur)) return { id: m.id, ok: false, why: 'not in team channel' };
        to = (m.back && g.chans.find(c => c.id === m.back && !isTeam(c))) || g.chans.find(c => c.parent === cur.parent && LOBBY.test(c.name) && !isTeam(c)) || g.chans.find(c => LOBBY.test(c.name) && !isTeam(c));
        if (!to) return { id: m.id, ok: false, why: 'no lobby channel' };
      } else {
        to = near(m.to === 't1' ? T1 : T2);
        if (!to) return { id: m.id, ok: false, why: 'no team channel' };
        // 🛡️ v0.1.131(봇 공개): 내전 자리에 있는 사람만 — 대기 채널·팀 채널 · 또는 팀 채널과 같은 카테고리(다른 방에서 노는 사람은 안 끌어옴)
        if (!LOBBY.test(cur.name) && !isTeam(cur) && !(cur.parent && cur.parent === to.parent)) return { id: m.id, ok: false, why: 'not near' };
      }
      return { id: m.id, g: g.id, from: cur.id, to: to.id, name: to.name };
    }
    return { id: m.id, ok: false, why: 'not in voice' };
  }));
  const out = [];
  for (const p of plan) {   // 옮기기는 하나씩(디스코드 속도 제한)
    if (!p.g) { out.push(p); continue; }
    if (p.from === p.to) { out.push({ id: p.id, ok: true, same: true, from: p.from, to: p.to }); continue; }
    const r = await dcPatch(env, p.g, p.id, p.to);
    out.push(r.ok ? { id: p.id, ok: true, from: p.from, to: p.to, name: p.name } : { id: p.id, ok: false, why: `move ${r.status}` });
  }
  return { moved: out };
}

// 🎨 2026-11-07 우리 팀 디스코드 서버 꾸미기(관리자 권한을 잠깐 준 동안 한 번 · 다시 돌려도 같은 결과)
//   이름으로 찾아 고치고 없으면 만듦 · 지우는 것 없음(모르는 채널은 그대로 두고 알려 줌) · 1팀/2팀/대기실 이름은 음성 이동이 찾는 이름 그대로
const GOLD = 0xC8AA6E, SITE = 'https://sohada2.github.io/today-naejeon/';
const SETUP = [
  { cat: '📢 안내', chans: [
    { name: '📌┃공지', type: 0, ro: true, topic: '투데이 내전 소식 · 업데이트 안내', post: 'notice' },
    { name: '📖┃사용법', type: 0, ro: true, topic: '처음이면 여기부터 · 설치 · 내전 진행 · 디스코드 연동', post: 'guide' },
  ] },
  { cat: '⚔️ 내전', from: /음성/, chans: [
    { name: '🏠 내전 대기실', type: 2, match: c => LOBBY.test(c.name) || c.name === '일반' },
    { name: '🔵 1팀', type: 2, match: c => T1.test(c.name) },
    { name: '🔴 2팀', type: 2, match: c => T2.test(c.name) },
    { name: '👀 관전석', type: 2, match: c => /관전/.test(c.name) },
  ] },
  { cat: '💬 수다', from: /채팅/, chans: [
    { name: '💬┃잡담', type: 0, topic: '아무 얘기 · 내전 모집', match: c => /일반|잡담/.test(c.name), system: true },
    { name: '🎬┃팟지-자랑', type: 0, topic: '팟지·숨은 영웅 영상 저장해서 올리기', match: c => /팟지/.test(c.name) },
    { name: '🏆┃명예의-전당', type: 0, topic: '오늘의 MVP · 티어 승급 · 펜타킬 박제', match: c => /명예/.test(c.name) },
    { name: '🎮 일반 판', type: 2, match: c => /일반\s*판/.test(c.name) },
  ] },
];
const POSTS = {
  notice: { embeds: [{ color: GOLD, title: '⚔️ 투데이 내전 서버가 열렸어요',
    description: `하루 안에 끝나는 인스턴트 내전 · 롤 클라 옆에 붙는 앱으로 **팀 짜기부터 기록·투표·팟지까지 자동**.\n처음이면 <#GUIDE> 부터 봐 주세요.\n\n[📥 투데이 내전 받기](${SITE})` }] },
  guide: { embeds: [{ color: GOLD, title: '📖 투데이 내전 사용법', url: SITE,
    description: '롤 · 투데이 내전 · 디스코드 앱 **셋 다 켜 두면** 나머지는 앱이 알아서 해요.',
    fields: [
      { name: '① 설치', value: `[홈페이지](${SITE})에서 받기 · 켜 두면 새 버전은 저절로 받아요` },
      { name: '② 모이기', value: '<#LOBBY> 음성 채널에 들어와서 앱에서 방 만들기 · 들어가기' },
      { name: '③ 팀 짜기', value: '방장이 방식(랜덤·드래프트·직접)을 고르고 시작 → 팀이 정해지면 <#T1> · <#T2> 음성 채널로 **자동 이동**' },
      { name: '④ 게임 끝', value: '결과 자동 기록 → 대기실로 **자동 복귀** → MVP·매너왕 투표 → 팟지 영상' },
      { name: '🎧 디스코드 설정', value: '앱 ⚙ 설정 → 디스코드 · 「내 상태 보이기」 · 「음성 채널 자동 나누기」(방장일 때)' },
    ],
    footer: { text: '음성 채널 이름(대기실 · 1팀 · 2팀)을 바꾸면 자동 이동이 못 찾아요' } }] },
};
async function dcj(env, method, p, body) {   // → {ok, status, j} · 429면 한 번 기다렸다 다시
  for (let i = 0; i < 3; i++) {
    const r = await dc(env, method, p, body);
    const j = r.status === 204 ? null : await r.json().catch(() => null);
    if (r.status !== 429) return { ok: r.ok, status: r.status, j };
    await new Promise(res => setTimeout(res, Math.min(5000, (((j && j.retry_after) || 1) * 1000) | 0)));
  }
  return { ok: false, status: 429, j: null };
}
async function iconUri(url) { const b = new Uint8Array(await (await fetch(url)).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return `data:image/png;base64,${btoa(s)}`; }
async function discordSetup(env, gid, dry, icon) {   // icon = 서버 아이콘 data URI(없으면 앱 아이콘)
  if (!/^\d{15,21}$/.test(gid)) { const r = await dcj(env, 'GET', '/users/@me/guilds'); return { guilds: (r.j || []).map(x => ({ id: x.id, name: x.name, perm: x.permissions })) }; }   // 서버 번호 없으면 봇이 들어간 서버 목록
  const log = [], step = (what, r) => { log.push(`${r.ok ? '✅' : '❌'} ${what}${r.ok ? '' : ` ${r.status} ${JSON.stringify(r.j || {}).slice(0, 120)}`}`); return r; };
  const g = await dcj(env, 'GET', `/guilds/${gid}`); if (!g.ok) return { err: `guild ${g.status}` };
  if (dry === 'icon') {   // 🎨 2026-11-09 아이콘만 바꿈(서버 아이콘 + 봇 사진) — 채널·안내 글은 안 건드림 · 기본 = 홈페이지 discord-icon.png(512)
    const ic = icon || await iconUri(`${SITE}img/discord-icon.png`);
    step('서버 아이콘', await dcj(env, 'PATCH', `/guilds/${gid}`, { icon: ic }));
    step('봇 프로필 사진', await dcj(env, 'PATCH', '/users/@me', { avatar: ic }));
    return { guild: g.j.name, log };
  }
  const ch = await dcj(env, 'GET', `/guilds/${gid}/channels`); if (!ch.ok) return { err: `channels ${ch.status}` };
  let chans = ch.j;
  if (dry === 'drop') {   // 꾸미기 끝 → 봇 역할을 음성 이동에 필요한 권한만(채널 보기·연결·멤버 이동)으로
    const me = await dcj(env, 'GET', '/users/@me'), roles = await dcj(env, 'GET', `/guilds/${gid}/roles`);
    const mine = (roles.j || []).find(r => r.tags && r.tags.bot_id === (me.j && me.j.id));
    if (!mine) return { err: 'bot role not found' };
    const r = await dcj(env, 'PATCH', `/guilds/${gid}/roles/${mine.id}`, { permissions: '17826816' });
    return { role: mine.name, before: mine.permissions, ok: r.ok, status: r.status, after: r.j && r.j.permissions, msg: r.ok ? null : r.j };
  }
  if (dry) return { guild: g.j.name, chans: chans.map(c => ({ id: c.id, type: c.type, name: c.name, parent: c.parent_id, pos: c.position })) };
  const RO = [{ id: gid, type: 0, allow: '0', deny: '2048' }];   // @everyone 메시지 보내기 막음(읽기 전용)
  const used = new Set(), ids = {}, order = [];
  for (const [ci, S] of SETUP.entries()) {
    let cat = chans.find(c => c.type === 4 && !used.has(c.id) && (c.name === S.cat || (S.from && S.from.test(c.name))));
    if (cat) { if (cat.name !== S.cat) step(`카테고리 ${cat.name} → ${S.cat}`, await dcj(env, 'PATCH', `/channels/${cat.id}`, { name: S.cat })); }
    else { const r = step(`카테고리 ${S.cat} 만듦`, await dcj(env, 'POST', `/guilds/${gid}/channels`, { name: S.cat, type: 4 })); cat = r.j; }
    if (!cat || !cat.id) continue;
    used.add(cat.id); order.push({ id: cat.id, position: ci });
    for (const [k, C] of S.chans.entries()) {
      let c = chans.find(x => x.type === C.type && !used.has(x.id) && (x.name === C.name || (C.match && C.match(x))));
      const want = Object.assign({ name: C.name, parent_id: cat.id }, C.topic ? { topic: C.topic } : {}, C.ro ? { permission_overwrites: RO } : {});
      if (c) step(`${c.name} → ${C.name}`, await dcj(env, 'PATCH', `/channels/${c.id}`, want));
      else { const r = step(`${C.name} 만듦`, await dcj(env, 'POST', `/guilds/${gid}/channels`, Object.assign({ type: C.type }, want))); c = r.j; }
      if (!c || !c.id) continue;
      used.add(c.id); order.push({ id: c.id, position: k });   // 카테고리는 위 PATCH에서 이미 옮김(한꺼번에 순서 맞추기엔 카테고리 바꾸기를 못 넣음)
      ids[C.post || C.name] = c.id;
      if (C.system) ids.system = c.id;
      if (C.type === 2 && /대기실/.test(C.name)) ids.LOBBY = c.id;
      if (/1팀/.test(C.name)) ids.T1 = c.id; if (/2팀/.test(C.name)) ids.T2 = c.id;
    }
  }
  step('순서 맞춤', await dcj(env, 'PATCH', `/guilds/${gid}/channels`, order));
  step('서버 이름·아이콘·환영 메시지 채널', await dcj(env, 'PATCH', `/guilds/${gid}`, Object.assign({ name: '투데이 내전', icon: icon || await iconUri(`${SITE}img/icon.png`) }, ids.system ? { system_channel_id: ids.system } : {})));
  const me = await dcj(env, 'GET', '/users/@me');
  if (me.ok && !me.j.avatar) step('봇 프로필 사진', await dcj(env, 'PATCH', '/users/@me', { avatar: icon || await iconUri(`${SITE}img/icon.png`) }));
  for (const key of ['guide', 'notice']) {   // 안내 글(봇이 쓴 게 있으면 고침 · 없으면 새로)
    const cid = ids[key]; if (!cid) continue;
    const body = JSON.parse(JSON.stringify(POSTS[key]).replace(/<#(GUIDE|LOBBY|T1|T2)>/g, (m, k) => (k === 'GUIDE' ? ids.guide : ids[k]) ? `<#${k === 'GUIDE' ? ids.guide : ids[k]}>` : k === 'LOBBY' ? '내전 대기실' : k === 'T1' ? '1팀' : k === 'T2' ? '2팀' : '사용법'));
    const ms = await dcj(env, 'GET', `/channels/${cid}/messages?limit=20`);
    const mine = ms.ok && me.ok ? (ms.j || []).find(x => x.author && x.author.id === me.j.id) : null;
    step(`${key} 글 ${mine ? '고침' : '올림'}`, await dcj(env, mine ? 'PATCH' : 'POST', mine ? `/channels/${cid}/messages/${mine.id}` : `/channels/${cid}/messages`, body));
  }
  chans = (await dcj(env, 'GET', `/guilds/${gid}/channels`)).j || [];
  const left = chans.filter(c => !used.has(c.id)).map(c => c.name);
  _dg = null;   // 음성 이동이 바뀐 채널 이름을 바로 보게
  return { log, left };
}

async function cleanup(env) {   // 매일: 3일 지난 clips- 릴리스와 태그 지움(앱 KEEP_DAYS와 같음)
  const oldest = new Date(Date.now() + 9 * 3600000 - 6 * 3600000 - (KEEP_DAYS - 1) * 86400000).toISOString().slice(0, 10);   // 한국 새벽 6시 기준 하루
  const r = await gh(env, 'GET', '/releases?per_page=100'); if (!r.ok) return [];
  const gone = [];
  for (const rel of await r.json()) {
    const mm = /^clips-(\d{4}-\d\d-\d\d)$/.exec(rel.tag_name || ''); if (!mm || mm[1] >= oldest) continue;
    const del = await gh(env, 'DELETE', `/releases/${rel.id}`);
    if (del.ok || del.status === 404) { await gh(env, 'DELETE', `/git/refs/tags/${rel.tag_name}`); gone.push(mm[1]); }
  }
  return gone;
}
export { cleanup, route, discordMove };
