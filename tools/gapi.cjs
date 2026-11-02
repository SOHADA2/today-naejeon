// 🔑 관리자 Google API 호출 — 이 PC의 firebase CLI 로그인(사장님 계정)으로 · 서버 규칙 적용·시험 데이터 정리·결제/사용량 조회
//   준비(PC마다 한 번): npm i -g firebase-tools → firebase login(사장님 계정 shm2644)
//   사용: node tools/gapi.cjs <GET|PUT|PATCH|DELETE|POST> <URL> [JSON 본문]   · 응답 앞부분만 출력(GLEN=글자 수로 늘림) · 토큰은 출력 안 함
//   예) 규칙 적용: node tools/gapi.cjs PUT https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app/.settings/rules.json "$(cat database.rules.json)"
//   ⚠️ 관리자 권한이라 규칙을 무시함 — 지우기·덮어쓰기는 경로를 읽어 확인한 뒤에만
//   firebase CLI의 공개 클라이언트 값은 코드에 적지 않고 설치된 firebase-tools(lib/api.js)에서 읽음
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
function cliApi() {
  const roots = [process.env.FIREBASE_TOOLS_DIR, (() => { try { return path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'firebase-tools'); } catch (_) { return null; } })()].filter(Boolean);
  for (const r of roots) { try { return require(path.join(r, 'lib', 'api.js')); } catch (_) {} }
  throw new Error('firebase-tools를 못 찾음 — npm i -g firebase-tools 후 firebase login');
}
(async () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE || process.env.HOME, '.config/configstore/firebase-tools.json'), 'utf8'));
  const rt = cfg.tokens && cfg.tokens.refresh_token; if (!rt) { console.log('firebase login 필요'); process.exit(1); }
  const api = cliApi();
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: rt, grant_type: 'refresh_token' }) })).json();
  if (!t.access_token) { console.log('토큰 실패', JSON.stringify(t).slice(0, 200)); process.exit(1); }
  const [m, url, body] = process.argv.slice(2);
  const r = await fetch(url, { method: m, headers: { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json', 'X-Goog-User-Project': process.env.GP || 'today-naejeon-sohada' }, body: body || undefined });
  console.log(r.status, (await r.text()).slice(0, +(process.env.GLEN || 1500)));
})();
