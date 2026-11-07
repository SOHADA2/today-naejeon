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
    return json(await discordMove(env, moves));
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
async function dcGuilds(env) {   // 봇이 들어가 있는 서버마다 음성 채널(1분 보관)
  if (_dg && Date.now() - _dg.at < 60e3) return _dg.list;
  const r = await dc(env, 'GET', '/users/@me/guilds'); if (!r.ok) { _dgErr = `guilds ${r.status}`; return []; }
  _dgErr = null;
  const list = await Promise.all((await r.json()).slice(0, 10).map(async g => {
    const c = await dc(env, 'GET', `/guilds/${g.id}/channels`);
    const chans = c.ok ? (await c.json()).filter(x => x.type === 2).map(x => ({ id: x.id, name: x.name || '', parent: x.parent_id || null, pos: x.position || 0 })).sort((a, b) => a.pos - b.pos) : [];
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
async function discordMove(env, moves) {
  const G = await dcGuilds(env);
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
