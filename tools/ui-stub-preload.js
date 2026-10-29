// 🧪 화면 캡처용 가짜 window.api(서버·롤 연결 없음) — tools/ui-shot.cjs가 contextIsolation 끄고 preload로 씀
//   on*(cb) = 콜백 모아 둠 → 페이지에서 __emit('lobby', 데이터)로 부름 · 나머지 함수 = window.__stub[이름] 값(없으면 null)을 Promise로
window.__cbs = {}; window.__stub = {};
window.__emit = (name, data) => { for (const cb of window.__cbs[name] || []) try { cb(data); } catch (e) { console.error(e); } };
window.api = new Proxy({}, { get: (_t, k) => {
  const key = String(k);
  if (/^on[A-Z]/.test(key)) { const ch = key.slice(2).replace(/^./, c => c.toLowerCase()); return cb => { (window.__cbs[ch] = window.__cbs[ch] || []).push(cb); }; }
  return (...args) => { const v = window.__stub[key]; return Promise.resolve(typeof v === 'function' ? v(...args) : v == null ? null : v); };
} });
