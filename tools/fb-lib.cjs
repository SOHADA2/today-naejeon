// 🔐 개발 도구 공용 Firebase 접속(2026-11-09) — 서버 2단계 규칙(모든 읽기·쓰기 auth != null)이라 표식 없이 붙으면 401
//   익명 로그인 표식을 받아 붙임(앱과 같은 방식) · 표식은 임시 폴더에 보관하고 50분 지나면 갱신 토큰으로 새로 → 돌릴 때마다 익명 계정을 새로 만들지 않음
//   쓰는 법: const fb = require('./fb-lib.cjs');  await fb.get('days?shallow=true')  (경로는 today/ 아래 기준)
//   방 경로: await fb.room() = env TN_ROOM 또는 방 목록에서 가장 최근에 소식 있는 방 번호 → `rooms/${id}/session` 등
//   ⚠️ 관리자 권한이 필요한 일(규칙 무시 · 기록 고치기)은 이걸로 안 됨 → tools/gapi.cjs
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app', T = 'today';
const KEY = 'AIzaSyDhVbSzNQ306LUTcPo44Ru9G4_RqV9Dl_E';   // 웹 API 키(공개값 · 앱 main.js와 같음)
const CACHE = path.join(os.tmpdir(), 'tn-tools-token.json');
let _tok = null;
const save = (id, refresh) => { try { fs.writeFileSync(CACHE, JSON.stringify({ id, refresh, exp: Date.now() + 50 * 60e3 })); } catch (_) {} };
async function token() {
  if (_tok) return _tok;
  try {
    const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    if (c.exp > Date.now()) return (_tok = c.id);
    if (c.refresh) {
      const r = await (await fetch(`https://securetoken.googleapis.com/v1/token?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(c.refresh) })).json();
      if (r.id_token) { save(r.id_token, r.refresh_token); return (_tok = r.id_token); }
    }
  } catch (_) {}
  const j = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' })).json();
  if (!j.idToken) throw new Error('익명 로그인 실패 ' + JSON.stringify(j).slice(0, 200));
  save(j.idToken, j.refreshToken);
  return (_tok = j.idToken);
}
async function req(method, p, body) {
  const [a, q] = String(p).split('?');
  const r = await fetch(`${ROOT}/${T}/${a}.json?auth=${await token()}${q ? '&' + q : ''}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (method === 'GET') return r.ok ? r.json() : null;
  return r.status;
}
const get = p => req('GET', p), put = (p, v) => req('PUT', p, v), patch = (p, v) => req('PATCH', p, v), del = p => req('DELETE', p);
async function room() {   // 🚪 시험할 방(v0.1.94~ 판 데이터는 rooms/{방}/…)
  if (process.env.TN_ROOM) return process.env.TN_ROOM;
  const L = await get('roomList') || {};
  const best = Object.entries(L).sort((a, b) => Math.max(b[1].seen || 0, b[1].at || 0) - Math.max(a[1].seen || 0, a[1].at || 0))[0];
  return best ? best[0] : null;
}
async function clipBytes(meta) {   // 🎬 팟지 영상 받기 — GitHub(meta.gh · 영상 중계 통과) 또는 옛 Firebase 조각(meta.n)
  if (meta && meta.gh) {
    const base = await get('config/clipProxy');
    if (!base) throw new Error('영상 중계 주소 없음(today/config/clipProxy)');
    const h = { 'x-tn-app': 'today-naejeon', authorization: `Bearer ${await token()}` };
    let r = await fetch(`${base}/clip/${Number(meta.gh)}`, { headers: h, redirect: 'manual' });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) r = await fetch(r.headers.get('location'));   // 서명된 임시 주소는 표식 없이
    if (!r.ok) throw new Error('영상 받기 ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  }
  const parts = [];
  for (let i = 0; i < ((meta && meta.n) || 0); i++) parts.push(Buffer.from(await get(`clips/${meta.day}/${meta.gameId}/c/${i}`) || '', 'base64'));
  return Buffer.concat(parts);
}
module.exports = { ROOT, T, DB: `${ROOT}/${T}`, KEY, token, get, put, patch, del, room, clipBytes };
