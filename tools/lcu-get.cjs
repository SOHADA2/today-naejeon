// 🔎 롤 클라이언트(LCU) 읽기 전용 조회 — GET만 보냄(방 만들기·초대·수락 같은 바꾸는 요청은 못 함 = 사장님 롤 화면을 안 건드림)
// 쓰는 곳: 설치된 앱은 콘솔 기록을 파일로 안 남겨서, 실기 확인을 롤 쪽 상태로 함(v0.1.189 초대 문제를 이걸로 찾음 — 롤 초대 목록에 올라갔는지)
// 사용(롤이 켜진 PC · 리포 루트):
//   node tools/lcu-get.cjs /lol-gameflow/v1/gameflow-phase            지금 롤 단계(None·Lobby·Matchmaking·ReadyCheck·ChampSelect·InProgress…)
//   node tools/lcu-get.cjs /lol-lobby/v2/lobby/invitations            내가 보낸 초대(toPuuid·toSummonerId·state Pending/Accepted/Declined) ← 「파티 만들고 초대」·팀 확정 뒤 확인
//   node tools/lcu-get.cjs /lol-lobby/v2/received-invitations         내가 받은 초대(친구 PC에서 = 방장 초대가 왔는지)
//   node tools/lcu-get.cjs /lol-lobby/v2/lobby                        지금 대기방(gameConfig.isCustom·queueId·customTeam100/200 · members · localMember.isLeader)
//   node tools/lcu-get.cjs /lol-summoner/v2/summoners/puuid/<puuid>   puuid → 소환사 번호(summonerId)
//   여러 주소를 한 번에 줘도 됨 · 긴 답은 앞 4000자(전부 = 끝에 --all)
// 롤 위치: 기본 C:\Riot Games\League of Legends · 다르면 env LOL_DIR 또는 실행 중인 LeagueClientUx.exe에서 찾음
// ⚠️ 답에 친구 이름·puuid가 들어 있음 → 출력을 공개 리포·홈페이지에 붙이지 말 것
const fs = require('fs'), path = require('path'), https = require('https'), { execFileSync } = require('child_process');
// ⚠️ Git Bash는 「/lol-…」로 시작하는 인자를 윈도우 경로(C:/Program Files/Git/lol-…)로 바꿔 넘김 → 그렇게 바뀐 것도 「/플러그인/v숫자/…」 부분만 다시 뽑아 씀
const fixPath = a => { if (a.startsWith('--')) return null; if (a.startsWith('/')) return a; const m = a.replace(/\\/g, '/').match(/\/[a-z][a-z0-9-]*\/v\d+\/.*$/i); return m ? m[0] : null; };
const args = process.argv.slice(2), all = args.includes('--all'), paths = args.map(fixPath).filter(Boolean);
if (!paths.length) { console.error('사용: node tools/lcu-get.cjs </lol-…주소> [주소 …] [--all]   (GET만 · 머리 주석에 자주 쓰는 주소)'); process.exit(1); }
function lockfile() {
  const dirs = [process.env.LOL_DIR, 'C:\\Riot Games\\League of Legends'].filter(Boolean);
  for (const d of dirs) { const f = path.join(d, 'lockfile'); if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); }
  try {   // 설치 위치가 다르면 실행 중인 클라이언트에서
    const cmd = execFileSync('powershell', ['-NoProfile', '-Command', "(Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -First 1).CommandLine"], { encoding: 'utf8' });
    const port = (cmd.match(/--app-port=(\d+)/) || [])[1], tok = (cmd.match(/--remoting-auth-token=([\w-]+)/) || [])[1];
    if (port && tok) return `LeagueClient:0:${port}:${tok}:https`;
  } catch (_) {}
  return null;
}
const lf = lockfile();
if (!lf) { console.error('롤 클라이언트가 꺼져 있어요(lockfile 없음 · 설치 위치가 다르면 env LOL_DIR)'); process.exit(2); }
const [, , port, pw] = lf.trim().split(':');
const get = p => new Promise(res => {
  const req = https.request({ host: '127.0.0.1', port, path: p, method: 'GET', rejectUnauthorized: false, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + pw).toString('base64'), Accept: 'application/json' } }, r => {
    let b = ''; r.setEncoding('utf8'); r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b }));
  });
  req.on('error', e => res({ status: 0, body: String(e.message) })); req.setTimeout(6000, () => req.destroy(new Error('시간 초과'))); req.end();
});
(async () => {
  for (const p of paths) {
    const r = await get(p); let out = r.body;
    try { out = JSON.stringify(JSON.parse(r.body), null, 1); } catch (_) {}
    console.log(`== GET ${p} → ${r.status}`);
    console.log(all || out.length <= 4000 ? out : out.slice(0, 4000) + `\n… (${out.length}자 중 앞 4000자 · 전부 보려면 --all)`);
  }
})();
