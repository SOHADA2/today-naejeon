// 🧪 숨김으로 켠 앱 창(렌더러)에서 JS 실행 — node tools/cdp.cjs <포트> <페이지 일부(overlay.html|sidepanel.html)> "<JS 식(Promise 가능)>"
//   앱 켜기(창 안 띄움): env -u ELECTRON_RUN_AS_NODE TN_HIDDEN=1 TN_USERDATA=<임시 폴더> TN_FAKE_ACCOUNT="이름#태그" ./node_modules/electron/dist/electron.exe . --remote-debugging-port=9333
//   예) node tools/cdp.cjs 9333 overlay.html "window.api.getRooms().then(d=>JSON.stringify(d.room))" · 끄기 = "window.api.quitApp(),'q'"
const [port, page, expr] = process.argv.slice(2);
(async () => {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const t = list.find(x => x.type === 'page' && x.url.includes(page));
  if (!t) { console.log('페이지 없음', list.map(x => x.url).join(' | ')); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) { const r = d.result && d.result.result; console.log(JSON.stringify(r && (r.value !== undefined ? r.value : r.description || r))); ws.close(); process.exit(0); } };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  setTimeout(() => { console.log('시간 초과'); process.exit(1); }, 20000);
})();
