// 🚪 창 연출 시험(v0.1.126) — 숨김 앱(TN_HIDDEN·TN_DOCK_SIM)을 띄워 메인 프로세스에서 클라 위치·롤 단계·게임 중을 흉내 내고 창 좌표를 50ms마다 기록
//   ⚠️ 실제 서버에 가짜 계정 접속 기록이 남음 → 끝나면 today/accounts·presence/fake-문시험 · conns/<시험 기기> 지울 것(tools/gapi.cjs DELETE)
// node tools/door-sim.cjs <시나리오 boot-client|boot-none|quiet-client|quiet-tray> <출력 json>   (quiet- = 윈도우 시작 자동 실행 --autostart · v0.1.154)
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');
const [scen, out] = process.argv.slice(2);
const env = { ...process.env, TN_HIDDEN: '1', TN_DOCK_SIM: '1', TN_USERDATA: path.join(require('os').tmpdir(), 'tn-doorsim'), TN_FAKE_ACCOUNT: '문시험#KR1' };
delete env.ELECTRON_RUN_AS_NODE;
const app = spawn(REPO + '/node_modules/electron/dist/electron.exe', ['.', '--inspect=9341'].concat(scen.startsWith('quiet') ? ['--autostart'] : []), { cwd: REPO, env });
let ws, id = 0; const pend = {};
const ev = (expr) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true } })); });
(async () => {
  let list;
  for (let i = 0; i < 60; i++) { try { list = await (await fetch('http://127.0.0.1:9341/json')).json(); if (list.length) break; } catch (_) {} await new Promise(r => setTimeout(r, 250)); }
  ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pend[d.id]) { const r = d.result && d.result.result; pend[d.id](r && r.value !== undefined ? r.value : (d.result && d.result.exceptionDetails ? 'ERR ' + JSON.stringify(d.result.exceptionDetails).slice(0, 400) : r)); delete pend[d.id]; } };
  for (let i = 0; i < 40; i++) { if (await ev('!!global.__dockSim')) break; await new Promise(r => setTimeout(r, 250)); }
  const script = `(async () => {
    const EL = require('electron'), S = global.__dockSim, log = [], t0 = Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms));
    const rec = (tag) => log.push({ t: Date.now() - t0, tag, b: S.bounds(), s: S.state() });
    const watch = async (tag, ms) => { const e = Date.now() + ms; while (Date.now() < e) { rec(tag); await sleep(50); } };
    const CL = '400 200 1680 920 1';   // 클라 1280×720 (원시 px)
    ${scen === 'quiet-client' ? `
    await watch('자동 실행·클라 없음(조용히)', 2600);
    S.line(CL); await watch('클라 켬 → 붙음', 700);
    ` : scen === 'quiet-tray' ? `
    await watch('자동 실행·클라 없음(조용히)', 2600);
    EL.app.emit('second-instance'); await watch('트레이·다시 실행 → 홈', 900);
    ` : scen === 'boot-client' ? `
    S.line(CL); await watch('boot·클라 있음', 300);
    S.phase('InProgress'); await sleep(30); S.line(''); await watch('게임 시작 → 문 닫힘', 1100);
    S.game(true); await watch('게임 중', 200);
    S.game(false); S.phase('EndOfGame'); await sleep(200); S.line(CL); await watch('게임 끝 → 문 열림', 600);
    S.phase('None'); S.line('gone'); await watch('클라 끔 → 합침', 600);
    S.line(CL); await watch('클라 켬 → 갈라짐', 600);
    ` : `
    await watch('boot·클라 없음(대기)', 2400);
    S.line('400 200 1680 920 1'); await watch('클라 켬 → 갈라짐', 600);
    `}
    return JSON.stringify(log);
  })()`;
  const res = await ev(script);
  fs.writeFileSync(out, typeof res === 'string' ? res : JSON.stringify(res));
  console.log('기록', String(res).length, 'B');
  try { await ev('require("electron").app.exit(0)'); } catch (_) {}
  setTimeout(() => { try { app.kill(); } catch (_) {} process.exit(0); }, 800);
})().catch(e => { console.log('오류', e); app.kill(); process.exit(1); });
