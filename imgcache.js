// 🖼️ 그림 빨리 띄우기(v0.1.205 · 사장님: 프로필 챔피언 그림 등이 한참 지나야 뜸)
//   원인(실측 2026-11-13 · 이 PC): CommunityDragon(raw.communitydragon.org) 그림 한 장 = 첫 응답까지 약 21초 · 라이엇 Data Dragon = 0.02~0.4초
//   (v0.1.205 둘째) 챔피언 아이콘·아수라장 증강은 프로그램에 넣어 둠(assets/imgpack · tools/img-pack.cjs) → 인터넷 없이 바로
//   → 모든 창의 CommunityDragon 그림 요청을 앱 안 주소 tnimg://cd/… 로 돌려(webRequest) 여기서 처리:
//     ① 챔피언 아이콘(v1/champion-icons/{번호}.png)·소환사 아이콘(v1/profile-icons/{번호}.jpg) = Data Dragon에서(번호 → 영문 이름 = champion.json)
//     ② 그 밖(증강·아이템·티어 문장 등) = CommunityDragon 그대로 받되
//     ③ 받은 그림은 userData/imgcache 에 저장 → 다음부터는(앱을 다시 켜도) 바로 · 7일 지나면 다시 받음(새 패치 그림) · 받다 실패하면 옛 파일이라도
//   그림 받기는 따로 만든 세션(partition)으로 — 기본 세션의 돌리기 규칙에 다시 걸리지 않게 · json 등 그림 아닌 요청은 안 건드림
const { app, protocol, session } = require('electron');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const CD = 'https://raw.communitydragon.org/';
const DD = 'https://ddragon.leagueoflegends.com/';
const MAX_AGE = 7 * 24 * 3600e3;
const IMG_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
let _dd = null, _ddAt = 0, _ddBusy = null, _fetchSes = null;
const inflight = new Map(), failed = new Map();   // failed = 다 실패한 그림 → 3분 동안 다시 안 받음(서버가 죽어 있을 때 같은 그림마다 20초씩 기다리지 않게)
const log = (...a) => { try { console.log('[img]', ...a); } catch (_) {} };

// 앱 준비 전에 불러야 함(main.js 맨 위쪽)
function registerScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: 'tnimg', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
}
const ses = () => _fetchSes || (_fetchSes = session.fromPartition('tnimg-fetch'));
async function fetchBuf(url, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 60000);
  try {
    const r = await ses().fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
  } finally { clearTimeout(t); }
}
async function ddInfo() {   // Data Dragon 최신 버전 + 챔피언 번호 → 영문 이름(12시간)
  if (_dd && Date.now() - _ddAt < 12 * 3600e3) return _dd;
  if (_ddBusy) return _ddBusy;
  _ddBusy = (async () => {
    try {
      const v = JSON.parse((await fetchBuf(DD + 'api/versions.json', 15000)).buf.toString('utf8'))[0];
      const d = JSON.parse((await fetchBuf(`${DD}cdn/${v}/data/en_US/champion.json`, 20000)).buf.toString('utf8'));
      const alias = {}; for (const c of Object.values(d.data || {})) alias[Number(c.key)] = c.id;
      if (v && Object.keys(alias).length) { _dd = { v, alias }; _ddAt = Date.now(); }
    } catch (e) { log('Data Dragon 정보 실패', e.message); }
    _ddBusy = null;
    return _dd;
  })();
  return _ddBusy;
}
async function sourcesFor(rest) {   // rest = raw.communitydragon.org/ 뒤 경로 → 받을 주소들(앞에서부터 시도)
  const out = [], dd = await ddInfo().catch(() => null);
  let m;
  if (dd && (m = rest.match(/\/v1\/champion-icons\/(\d+)\.png$/i)) && dd.alias[Number(m[1])]) out.push(`${DD}cdn/${dd.v}/img/champion/${dd.alias[Number(m[1])]}.png`);
  if (dd && (m = rest.match(/\/v1\/profile-icons\/(\d+)\.jpg$/i))) out.push(`${DD}cdn/${dd.v}/img/profileicon/${m[1]}.png`);
  out.push(CD + rest);
  return out;
}
const typeOf = f => /\.png$/i.test(f) ? 'image/png' : /\.jpe?g$/i.test(f) ? 'image/jpeg' : /\.webp$/i.test(f) ? 'image/webp' : /\.gif$/i.test(f) ? 'image/gif' : /\.svg$/i.test(f) ? 'image/svg+xml' : 'application/octet-stream';
function cachePaths(rest) {
  const dir = path.join(app.getPath('userData'), 'imgcache');
  const h = crypto.createHash('sha1').update(rest.toLowerCase()).digest('hex').slice(0, 24);
  const ext = (rest.match(IMG_EXT) || ['.img'])[0].toLowerCase();
  return { dir, file: path.join(dir, h + ext), meta: path.join(dir, h + '.type') };
}
// 📦 프로그램에 넣어 둔 그림(assets/imgpack · tools/img-pack.cjs = 챔피언 아이콘 + 아수라장 증강) — 이름 규칙 = 경로 소문자 sha1 앞 24자 + 확장자(⚠️ img-pack.cjs와 같게)
const packName = rest => crypto.createHash('sha1').update(rest.toLowerCase()).digest('hex').slice(0, 24) + ((rest.match(IMG_EXT) || ['.img'])[0].toLowerCase());
const PACK_DIR = path.join(__dirname, 'assets', 'imgpack');
function fromPack(rest) { try { const f = path.join(PACK_DIR, packName(rest)); return { buf: fs.readFileSync(f), type: typeOf(f) }; } catch (_) { return null; } }
async function getImage(rest) {
  const pk = fromPack(rest); if (pk && pk.buf.length) return pk;   // ① 넣어 둔 그림(인터넷 없이) → ② PC에 저장해 둔 것 → ③ 인터넷
  const { dir, file, meta } = cachePaths(rest);
  let st = null; try { st = fs.statSync(file); } catch (_) {}
  const read = () => ({ buf: fs.readFileSync(file), type: (() => { try { return fs.readFileSync(meta, 'utf8'); } catch (_) { return typeOf(rest); } })() });
  if (st && st.size > 0 && Date.now() - st.mtimeMs < MAX_AGE) return read();
  if (inflight.has(rest)) return inflight.get(rest);
  if (Date.now() - (failed.get(rest) || 0) < 180000) return st && st.size > 0 ? read() : null;
  const job = (async () => {
    for (const u of await sourcesFor(rest)) {
      try {
        const r = await fetchBuf(u, u.startsWith(DD) ? 15000 : 60000);
        if (!r.buf.length) continue;
        const type = /^image\//i.test(r.type) ? r.type.split(';')[0] : typeOf(u);
        try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, r.buf); fs.writeFileSync(meta, type); } catch (_) {}
        return { buf: r.buf, type };
      } catch (e) { log('받기 실패', u.replace(/^https:\/\/[^/]+\//, ''), e.message); }
    }
    failed.set(rest, Date.now());
    if (st && st.size > 0) return read();   // 다 실패 → 옛 파일이라도
    return null;
  })().finally(() => inflight.delete(rest));
  inflight.set(rest, job);
  return job;
}
// 앱 준비 뒤에 부름
function install() {
  protocol.handle('tnimg', async req => {
    try {
      const u = new URL(req.url);   // tnimg://cd/<경로>
      const rest = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
      if (u.host !== 'cd' || !rest || rest.includes('..')) return new Response('bad', { status: 400 });
      const r = await getImage(rest);
      if (!r) return new Response('not found', { status: 404 });
      return new Response(r.buf, { status: 200, headers: { 'content-type': r.type, 'cache-control': 'max-age=86400', 'access-control-allow-origin': '*' } });
    } catch (e) { return new Response('error', { status: 500 }); }
  });
  session.defaultSession.webRequest.onBeforeRequest({ urls: [CD + '*'] }, (d, cb) => {
    try {
      const u = new URL(d.url);
      if (d.method === 'GET' && (d.resourceType === 'image' || IMG_EXT.test(u.pathname))) return cb({ redirectURL: 'tnimg://cd' + u.pathname });
    } catch (_) {}
    cb({});
  });
  ddInfo().catch(() => {});   // 미리 받아 둠
  setTimeout(prune, 60000);
}
function prune() {   // 30일 넘게 안 바뀐 파일 정리(그림이 계속 쌓이지 않게)
  try {
    const dir = path.join(app.getPath('userData'), 'imgcache'), now = Date.now();
    for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); try { if (now - fs.statSync(p).mtimeMs > 30 * 24 * 3600e3) fs.unlinkSync(p); } catch (_) {} }
  } catch (_) {}
}
module.exports = { registerScheme, install, packName, _getImage: getImage, _ddInfo: ddInfo };
