// 🔐 보안 2단계(v0.1.243 · 2026-11-23) = 롤 계정 로그인 기준 잠금 — 지금 database.rules.json(1단계 · 익명 표식이면 거의 다 됨)을 받아 2단계본을 stdout으로
//   node tools/rules-riot.cjs < database.rules.json > rules.riot.json  (이미 2단계본이면 같은 결과 = 멱등)
//   롤 계정 로그인 = Firebase 커스텀 로그인 uid = puuid · 표식 claims riot:true(중계 /riot-auth · v0.1.242)
//   ① 본인 칸(presence·accounts·ratings·discord·방 members·lobby chat/ping/cping·방 dc) = auth.uid === 그 칸 열쇠(게스트 접속 표시 g_… 는 그대로)
//   ② 방 안 쓰기 = rooms/{방}/uids/{auth.uid}가 있는 사람만(앱이 들어올 때 맨 먼저 씀 · v0.1.243) · 그 칸은 본인 uid로만 · 방 목록에 있는 방만
//   ③ 내전 기록 만들기 = 기록의 roomId 방에 들어온 사람만 · 일반 판·붙는 칸(팟지·투표…)·증강·팟지 수집·영상 = 롤 로그인만
//   ④ 읽기 = today 통째 없앰 → 칸마다(방 안 = 롤 로그인만 · 디스코드 = 본인만 · owners·옛 칸 = 아무도) · 설정은 앱이 읽는 3칸만
//   ⑤ 빈 방 정리 = 롤 로그인 앱이 방 목록에서 90초 넘게 소식 없는 방 · 목록에 없는 방 데이터 통째
//   ⑥ 🛡️ 운영(v0.1.244) = today/admins/{uid}(운영 보드 구글 로그인 uid · 관리자 도구로만 넣음)가 있으면 운영자: 전부 읽기 · 정지 today/bans/{puuid} · 운영 기록 today/modlog · 아무 방·방 목록·접속 표시 지우기
//      정지된 롤 계정(bans/{puuid}.until > 서버 시각) = 롤 로그인으로 하는 쓰기·방 읽기가 전부 막힘(기간이 지나면 저절로 풀림) · 자기 칸 지우기만 됨 · 자기 정지 칸은 읽을 수 있음(앱이 사유·풀리는 시각을 보여 줌)
const fs = require('fs');
const src = JSON.parse(fs.readFileSync(0, 'utf8'));
const t = src.rules.today;
const AUTH = 'auth != null';
const NOTBAN = "(!root.child('today/bans/' + auth.uid).exists() || root.child('today/bans/' + auth.uid + '/until').val() < now)";
const ADMIN = "(auth != null && root.child('today/admins/' + auth.uid).exists())";
const RIOT = `auth != null && auth.token.riot === true && ${NOTBAN}`;
const MEM = "root.child('today/rooms/' + $rid + '/uids/' + auth.uid).exists()";
const SELF = k => `auth != null && auth.token.riot === true && auth.uid === ${k} && (${NOTBAN} || !newData.exists())`;   // 본인 칸 · 정지돼도 지우기는 됨
const OWN = k => `auth != null && auth.uid === ${k} && (${NOTBAN} || !newData.exists())`;
const W = (node, rule) => { node['.write'] = rule; return node; };

t['.read'] = ADMIN;   // 운영자만 통째 읽기(운영 보드)
// 접속 표시 · 자리 · 브릿지(방 밖) = 그대로 읽기 · 접속 표시 쓰기는 본인 칸 또는 게스트(롤 로그인 전 · 익명)
t.presence['.read'] = AUTH;
t.presence.$k['.write'] = `(auth != null && $k.beginsWith('g_')) || (${OWN('$k')}) || ${ADMIN}`;
t.conns['.read'] = AUTH;
t.bridge['.read'] = AUTH;
// 방 목록 = 누구나 읽기(게스트도 홈 화면에서 봄) · 만들기 = 롤 로그인 · 고치기 = 그 방 사람 · 지우기 = 그 방 사람 또는 90초 넘게 소식 없는 방
t.roomList['.read'] = AUTH;
t.roomList.$rid['.write'] = `${ADMIN} || ${RIOT} && (!data.exists() || ${MEM} || (!newData.exists() && (!data.child('seen').exists() || data.child('seen').val() < now - 90000) && (!data.child('at').exists() || data.child('at').val() < now - 90000)))`;
// 방 안
const R = t.rooms.$rid;
t.rooms['.read'] = RIOT;
R['.write'] = `${ADMIN} || (${RIOT} && !newData.exists() && !root.child('today/roomList/' + $rid).exists())`;   // 운영자 = 아무 방이나(내보내기·방 지우기)   // 통째 지우기 = 목록에서 없어진 방만(빈 방 정리)
for (const k of ['session', 'host', 'normalLive', 'potgWait', 'potgRec', 'bridge']) R[k] = W(R[k] || {}, `${RIOT} && ${MEM}`);
const L = R.lobby;
L.chat.$k['.write'] = SELF('$k');
L.ping = { $k: { '.write': SELF('$k') } };
L.cping = { $k: { '.write': SELF('$k') } };
L.$other = { '.write': `${RIOT} && ${MEM}` };   // 방식·참가·팀장·팀·강퇴… = 방 사람 누구나(방장이 남의 칸도 씀)
R.members.$k['.write'] = SELF('$k');
R.dc.$puuid['.write'] = SELF('$puuid');
R.uids.$uid['.write'] = `${SELF('$uid')} && (!newData.exists() || root.child('today/roomList/' + $rid).exists())`;
// 팟지 수집·영상
t.potg['.read'] = AUTH;
t.potg.raw.$day['.write'] = `${RIOT} && (!newData.exists())`;
t.potg.raw.$day.$gid.$k['.write'] = RIOT;
t.clips['.read'] = AUTH;
t.clips.$day['.write'] = `${RIOT} && (!newData.exists())`;
t.clips.$day.$gid['.write'] = RIOT;
// 본인 칸
t.accounts['.read'] = AUTH;
t.accounts.$puuid['.write'] = OWN('$puuid');
t.ratings['.read'] = AUTH;
t.ratings.$puuid['.write'] = OWN('$puuid');
t.discord.$puuid['.read'] = 'auth != null && auth.uid === $puuid';
t.discord.$puuid['.write'] = OWN('$puuid');
t.owners.$puuid.$uid['.write'] = 'auth != null && auth.uid === $uid && auth.uid === $puuid';
// 증강 가이드
t.augGuide['.read'] = AUTH;
t.augGuide.champs.$id['.write'] = RIOT;
t.augGuide.hist.$id.$k['.write'] = `${RIOT} && (!data.exists() || (!newData.exists() && data.child('at').val() < now - 259200000))`;
t.augGuide.recent.$k['.write'] = `${RIOT} && (!data.exists() || (!newData.exists() && data.child('at').val() < now - 259200000))`;
// 경기 기록
t.days['.read'] = AUTH;
const G = t.days.$day.$kind.$gid;
G['.write'] = `${RIOT} && (!data.exists() && newData.exists() && newData.child('sv').val() === now) && ($kind === 'normals' || (newData.child('roomId').isString() && root.child('today/rooms/' + newData.child('roomId').val() + '/uids/' + auth.uid).exists()))`;
for (const k of ['potg', 'potgRec', 'guess', 'mvp', 'svp', 'manner', 'votes']) G[k]['.write'] = `${RIOT} && (data.parent().child('sv').val() > now - 21600000)`;
// 설정 = 앱이 읽는 칸만
for (const k of ['connCap', 'clipProxy', 'discordApp']) t.config[k] = { '.read': AUTH };
// 🛡️ 운영자 목록 = 관리자 도구로만(쓰기 규칙 없음) · 본인만 「내가 운영자인지」 읽음
t.admins = { $uid: { '.read': 'auth != null && auth.uid === $uid', '.validate': "newData.hasChildren(['name'])", name: { '.validate': 'newData.isString() && newData.val().length <= 40' }, at: { '.validate': 'newData.isNumber()' }, $other: { '.validate': false } } };
// 🚫 정지 = 운영자만 씀 · 본인은 읽음(앱 안내) · until = 풀리는 시각(ms · 영구 = 9e15)
const STR = n => ({ '.validate': `newData.isString() && newData.val().length <= ${n}` }), NUM = { '.validate': 'newData.isNumber()' };
t.bans = { $puuid: { '.read': 'auth != null && auth.uid === $puuid', '.write': ADMIN, '.validate': "$puuid.length <= 80 && newData.hasChildren(['until', 'at'])", until: NUM, at: NUM, reason: STR(200), by: STR(40), name: STR(60), $other: { '.validate': false } } };
// 📜 운영 기록 = 운영자가 새로 쓰기만(고치기·지우기 X)
t.modlog = { $k: { '.write': `${ADMIN} && !data.exists()`, '.validate': "newData.hasChildren(['at', 'act', 'by'])", at: NUM, act: STR(20), by: STR(40), target: STR(80), name: STR(60), reason: STR(200), until: NUM, room: STR(40), $other: { '.validate': false } } };
process.stdout.write(JSON.stringify(src, null, 2) + '\n');
