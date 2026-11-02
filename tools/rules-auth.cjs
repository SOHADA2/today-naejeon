// 🔐 2단계 규칙 만들기(v0.1.98) — database.rules.json의 모든 쓰기·읽기에 「로그인 표식 있어야(auth != null)」를 덧붙여 출력
//   node tools/rules-auth.cjs > rules.auth.json → 적용은 CLAUDE.md 「서버 규칙」(gapi PUT .settings/rules.json)
//   ⚠️ 친구들 앱이 전부 v0.1.98 이상(표식 붙임)일 때만 적용 — 옛 앱은 읽기·쓰기 전부 401
const fs = require('fs'), path = require('path');
const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
(function walk(o) {
  for (const k of Object.keys(o)) {
    if (k === '.write') o[k] = o[k] === true ? 'auth != null' : o[k] === false ? false : `auth != null && (${o[k]})`;
    else if (k === '.read') o[k] = 'auth != null';
    else if (o[k] && typeof o[k] === 'object') walk(o[k]);
  }
})(j);
process.stdout.write(JSON.stringify(j, null, 2) + '\n');
