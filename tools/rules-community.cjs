// 🏘️ 커뮤니티 공간 규칙(v0.1.258 · A안 = 같은 서버 안에서 칸만 나눔) — 지금 규칙(database.rules.json)을 받아 커뮤니티 칸 규칙을 붙여 stdout으로
//   node tools/rules-community.cjs < database.rules.json > rules.new.json   (이미 붙어 있으면 지우고 다시 만듦 = 멱등)
//   ⚠️ 규칙을 바꿀 땐 순서 = rules-riot.cjs(본래 칸) → 이 도구(커뮤니티 칸이 본래 칸을 그대로 따라감)
//   today/c/{커뮤니티}/… = 본래 칸(presence·roomList·rooms·days·notice·reports·warns·mutes·bans·modlog)의 규칙을 그대로 복사하고 경로만 바꿈
//     'today/rooms/' → 'today/c/' + $cid + '/rooms/' 식(방 사람 확인·방 목록 확인·채팅 금지 확인이 그 커뮤니티 칸을 봄)
//     운영자 = 전체 운영자(today/admins) 또는 그 커뮤니티 운영자(today/c/{커뮤니티}/admins/{uid})
//     정지 = 기본 커뮤니티 정지(today/bans · 모든 커뮤니티에 적용)와 그 커뮤니티 정지 둘 다 봄
//   today/c/{커뮤니티}/admins/{uid} = 주인 운영자(today/admins/{uid}.owner)만 쓰기 · 본인만 읽기(운영 보드가 「내가 이 커뮤니티 운영자인지」)
//   today/communities/{커뮤니티} = {name, at, by} · 읽기 = 로그인한 누구나(그 칸만 · 목록은 못 읽음) · 쓰기 = 주인 운영자
//   today/communityCodes/{초대 코드} = 커뮤니티 이름표(id) · 읽기 = 그 코드를 아는 사람만(목록 못 읽음) · 쓰기 = 주인 운영자
const fs = require('fs');
const src = JSON.parse(fs.readFileSync(0, 'utf8'));
const t = src.rules.today;
const SCOPED = ['presence', 'roomList', 'rooms', 'days', 'notice', 'reports', 'warns', 'mutes', 'bans', 'modlog', 'tourneys'];   // 🏆 v0.1.291 tourneys
const AUTH = 'auth != null';
const ADMIN = "(auth != null && root.child('today/admins/' + auth.uid).exists())";
const CADMIN = "(auth != null && (root.child('today/admins/' + auth.uid).exists() || root.child('today/c/' + $cid + '/admins/' + auth.uid).exists()))";
const NOTBAN = "(!root.child('today/bans/' + auth.uid).exists() || root.child('today/bans/' + auth.uid + '/until').val() < now)";
const NOTBAN_C = `(${NOTBAN} && (!root.child('today/c/' + $cid + '/bans/' + auth.uid).exists() || root.child('today/c/' + $cid + '/bans/' + auth.uid + '/until').val() < now))`;
const OWNER = "auth != null && root.child('today/admins/' + auth.uid + '/owner').val() === true";
const ID_RE = '/^[a-z0-9_-]{2,24}$/', CODE_RE = '/^[A-Z0-9]{4,12}$/';
// 규칙 글 한 줄 바꾸기 — 전체 운영자·전체 정지 확인을 먼저 자리표로 빼 두고(경로 바꾸기에 안 걸리게) 커뮤니티 칸 경로를 바꾼 뒤 되돌림
function tr(x) {
  if (typeof x !== 'string') return x;
  let y = x.split(ADMIN).join('\u0001').split(NOTBAN).join('\u0002');
  for (const k of SCOPED) y = y.split(`'today/${k}/`).join(`'today/c/' + $cid + '/${k}/`).split(`'today/${k}'`).join(`'today/c/' + $cid + '/${k}'`);
  if (/'today\/(presence|roomList|rooms|days|notice|reports|warns|mutes|bans|modlog|tourneys)\b/.test(y)) throw new Error('못 바꾼 경로: ' + y.slice(0, 120));
  return y.split('\u0001').join(CADMIN).split('\u0002').join(NOTBAN_C);
}
const copy = o => { if (o === null || typeof o !== 'object') return o; const r = {}; for (const [k, v] of Object.entries(o)) r[k] = k.startsWith('.') ? tr(v) : copy(v); return r; };
delete t.c; delete t.communities; delete t.communityCodes;
const C = { '.read': CADMIN, '.validate': `$cid.matches(${ID_RE})` };
for (const k of SCOPED) if (t[k]) C[k] = copy(t[k]);
C.admins = { $uid: { '.read': `auth != null && auth.uid === $uid`, '.write': OWNER, '.validate': "newData.hasChildren(['name']) && newData.child('name').isString() && newData.child('name').val().length <= 40" } };
t.c = { $cid: C };
t.communities = { $cid: { '.read': AUTH, '.write': OWNER, '.validate': `$cid.matches(${ID_RE}) && newData.hasChildren(['name']) && newData.child('name').isString() && newData.child('name').val().length >= 1 && newData.child('name').val().length <= 20` } };
t.communityCodes = { $code: { '.read': AUTH, '.write': OWNER, '.validate': `$code.matches(${CODE_RE}) && newData.isString() && newData.val().matches(${ID_RE})` } };
process.stdout.write(JSON.stringify(src, null, 2) + '\n');
