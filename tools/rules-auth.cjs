// 🔐 2단계 규칙 만들기(v0.1.98) — database.rules.json의 모든 쓰기·읽기에 「로그인 표식 있어야(auth != null)」를 덧붙여 출력
//   node tools/rules-auth.cjs > rules.auth.json → 적용은 CLAUDE.md 「서버 규칙」(gapi PUT .settings/rules.json)
//   ⚠️ 친구들 앱이 전부 v0.1.98 이상(표식 붙임)일 때만 적용 — 옛 앱은 읽기·쓰기 전부 401
//   ✅ 2026-11-04 적용함 → database.rules.json 자체가 2단계본(이 도구는 규칙을 새로 고친 뒤 auth를 빠짐없이 붙이는 용도 · 멱등)
const fs = require('fs'), path = require('path');
const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
(function walk(o) {
  for (const k of Object.keys(o)) {
    if (k === '.write') o[k] = o[k] === true ? 'auth != null' : o[k] === false ? false : String(o[k]).startsWith('auth != null') ? o[k] : `auth != null && (${o[k]})`;   // 이미 붙은 건 그대로(2026-11-04~ database.rules.json이 2단계 적용본)
    else if (k === '.read') o[k] = 'auth != null';
    else if (o[k] && typeof o[k] === 'object') walk(o[k]);
  }
})(j);
process.stdout.write(JSON.stringify(j, null, 2) + '\n');
