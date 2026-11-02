// 🎞️ 투데이 내전 영상 중계(Cloudflare Workers · 무료) — 2026-11-02
// GitHub 토큰(비공개 저장소 today-naejeon-clips · Contents 읽기쓰기)은 **여기 비밀값 GH_TOKEN에만** 있음.
// 앱은 토큰 없이 이 중계에 「올리기·받기·화면 보내기」만 부탁 → 토큰이 앱·Firebase에 없으니 꺼내 갈 수 없음.
// 할 수 있는 것 = 그날 릴리스(clips-YYYY-MM-DD)에 영상 올리기 · 영상 받기(서명된 임시 주소로 넘김) · 증강 화면(aug-shots 릴리스) 올리기
// 못 하는 것 = 지우기·덮어쓰기·다른 파일 읽기(지우기는 매일 정리 cron만 · 3일 지난 clips- 릴리스)
// 경로: POST /upload?day=&name= (video/webm|mp4 · 45MB 이하) → {id} · GET /clip/{id} → 302 · POST /shot?name= (jpg·json 8MB 이하) → {id}
// x-tn-app 머리말은 지나가는 요청 거르기용일 뿐(앱 코드에 공개) — 보안 장치 아님
const DAY = /^\d{4}-\d\d-\d\d$/, CLIP = /^[\w-]{1,80}\.(webm|mp4)$/, SHOT = /^[\w.-]{1,120}\.(jpg|json)$/;
const MAX_CLIP = 45 * 1048576, MAX_SHOT = 8 * 1048576, KEEP_DAYS = 3;

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

async function route(req, env) {
  const u = new URL(req.url);
  if (req.headers.get('x-tn-app') !== 'today-naejeon') return json({ err: 'forbidden' }, 403);
  // 🛡️ 같은 IP 1분에 올리기 10번·받기 40번까지(Cloudflare 무료 rate limit · 남이 계속 올려 저장소를 채우는 것 막기)
  const lim = req.method === 'POST' ? env.UP_LIMIT : env.GET_LIMIT;
  if (lim && !(await lim.limit({ key: req.headers.get('cf-connecting-ip') || 'ip' })).success) return json({ err: 'too many' }, 429);
  const len = Number(req.headers.get('content-length')) || 0, type = (req.headers.get('content-type') || '').split(';')[0];
  if (req.method === 'POST' && u.pathname === '/upload') {
    const day = u.searchParams.get('day'), name = u.searchParams.get('name');
    if (!dayOk(day) || !CLIP.test(name || '') || !/^video\/(webm|mp4)$/.test(type) || !(len > 0 && len <= MAX_CLIP)) return json({ err: 'bad request' }, 400);
    const buf = await req.arrayBuffer(); if (buf.byteLength !== len) return json({ err: 'length' }, 400);
    const rel = await release(env, `clips-${day}`, `팟지 영상 ${day}`); if (!rel) return json({ err: 'release' }, 502);
    return upload(env, rel, name, type, buf);
  }
  if (req.method === 'POST' && u.pathname === '/shot') {
    const name = u.searchParams.get('name');
    if (!SHOT.test(name || '') || !/^(image\/jpeg|application\/json)$/.test(type) || !(len > 0 && len <= MAX_SHOT)) return json({ err: 'bad request' }, 400);
    const buf = await req.arrayBuffer(); if (buf.byteLength !== len) return json({ err: 'length' }, 400);
    const rel = await release(env, 'aug-shots', '증강 화면(Shift+F8)'); if (!rel) return json({ err: 'release' }, 502);
    return upload(env, rel, name, type, buf);
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
export { cleanup, route };
