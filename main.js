// ── 투데이 내전 (Electron 메인 프로세스) ─────────────────────────────────
// 하루 안에 끝나는 인스턴트 내전 앱. 사이트(시즌2 LP·골드)와 **완전 분리** — 모든 쓰기는 Firebase today/ 아래.
//   · 사이트 데이터는 읽기만: players(이름 목록) · matches(팀 밸런스용 승률)
//   · 흐름: 입장 → 방장 팀짜기 → 게임(내장 브릿지가 EOG 캡처 → today/bridge/eogStats)
//          → 방장 앱이 오늘 기록에 저장(today/days/{날짜}/matches/{gameId}) → MVP·매너 투표 → 결과
//   · 기존 aram-overlay(사이트 프로그램 버전)는 그대로 둠. 이 앱은 별도 설치·별도 업데이트.
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage, screen, dialog } = require('electron');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');   // 🔄 GitHub Releases 자동 업데이트(SOHADA2/today-naejeon)
const path = require('path');
const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');

const WEB_URL = 'https://sohada2.github.io/aram/';
const FIREBASE_DB = 'https://aramchaos-ca022-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_API_KEY = 'AIzaSyAzRirJzvaqu6jelqUUjV_Tik1MgsALEE4';   // aram/index.html firebaseConfig와 동일(홈페이지에 공개된 값)
const TOGGLE_HOTKEY = 'Shift+F7';   // 기존 오버레이(Shift+F5)와 겹치지 않게
const T = 'today';                  // ⚠️ 이 앱의 모든 쓰기 루트 — 사이트 노드(session·lobby·bridge·matches…)에 절대 쓰지 않음
const { buildTeams, normName } = require('./teams');   // ⚔️ 홈페이지 makeTeams 1:1 이식(밸런스 계산)
const bridge = require('./bridge');                    // 🔌 내장 브릿지(LCU EOG 캡처 → today/bridge)
const makeReplayRec = require('./replayrec');           // 🎬 팟지 영상 = 방장 PC가 리플레이를 열어 그 장면만 녹화(v0.1.33)
const makePotg = require('./potg');                    // 🎬 팟지(게임 중 킬·체력 수집 → 방장이 최고 장면 고름 → 가운데 창)
let potg = null, replayRec = null, replayBusy = false;   // replayBusy = 리플레이 녹화 중(그동안 2999가 열려도 「게임 시작」으로 보지 않음)                                        // app ready 뒤 생성(userData 경로 필요)

let overlayWin = null, tray = null;
let inGame = false, userHid = false, latestPlayers = [];
let overlayMinimized = false, leftMinimized = false;   // ◀ 최소화(작업표시줄로 내림) 상태 — show 루프가 다시 띄우지 않게
let sampleActive = false;   // (미리보기 없음 — 도킹 코드 호환용)
let sessionData = null, lastFormed = 0;   // 🧩 today/session(팀 배정·투표·결과)
let config = {};            // { myName, dock, sidePanel, slot, deviceId }

// 설정 파일(userData) — 내 이름 저장
let CONFIG_PATH = '';
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) { return {}; } }
function saveConfig() { try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config)); } catch (_) {} }

// 🖥️ 롤 클라이언트 창에 도킹 — SetWinEventHook(LOCATIONCHANGE)로 이동 즉시 추종(찰싹·덜렁임 없음)
// 이벤트 기반이라 클라를 드래그하면 프레임 단위로 따라옴 + 90ms 폴백(놓친 이벤트·켜짐/꺼짐 감지)
let dockedBounds = null;   // 마지막 적용 좌표(중복 setBounds 방지)
let dockedNow = false, dockProc = null, _dockBuf = '';
let leftWin = null, leftDockedBounds = null, leftUserHid = false;   // 🖥️ 오른쪽 패널(입장·팀짜기·오늘 기록)
let slotWin = null, _slotSig = '', _slotTeam = 0, _slotDoneFormed = 0;   // 📍 클라 로비 위 '내 팀 여기' 마커 (_slotDoneFormed=게임이 시작된 팀결성 시각 → 그 판 끝나도 재등장 안 함)
let _floating = false;   // 클라 없음 = 패널을 독립 창으로 띄운 상태
let _lastRect = null;    // 마지막 감지된 클라 창 좌표(팀 마커 갱신용)
let _clientPresent = false, _goneTimer = null, _quitPromptOpen = false;   // 🚪 클라 창 존재 추적(종료 시 "같이 끌까요?" 확인창)
let _startTs = 0;        // 시작 시각(시작 직후 잠깐은 패널 안 숨김)
const _dockScript = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @'
using System;using System.Runtime.InteropServices;
public class Win{
 [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c,string n);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h,int a,out RECT r,int s);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern IntPtr SetWinEventHook(uint a,uint b,IntPtr m,WinEventProc cb,uint p,uint t,uint f);
 [DllImport("user32.dll")] public static extern IntPtr SetTimer(IntPtr h,IntPtr id,uint ms,IntPtr fn);
 [DllImport("user32.dll")] public static extern int GetMessage(out MSG m,IntPtr h,uint a,uint b);
 [DllImport("user32.dll")] public static extern bool TranslateMessage(ref MSG m);
 [DllImport("user32.dll")] public static extern IntPtr DispatchMessage(ref MSG m);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h,int i);
 [DllImport("user32.dll")] public static extern IntPtr GetTopWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h,uint c);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int cx,int cy,uint f);
 public delegate void WinEventProc(IntPtr hook,uint ev,IntPtr hwnd,int idO,int idC,uint th,uint tm);
 public struct RECT{public int L,T,R,B;}
 public struct POINT{public int X,Y;}
 public struct MSG{public IntPtr hwnd;public uint msg;public IntPtr wp;public IntPtr lp;public uint time;public POINT pt;}
 static IntPtr target=IntPtr.Zero;
 static string last=null;
 static WinEventProc cb;
 static uint ourPid=__OUR_PID__;          // 이 앱 메인 프로세스(패널 창 주인)
 static bool withClient=__WITH_CLIENT__;  // 도킹 켬 = 롤 클라도 묶음에 넣음
 static bool Ours(IntPtr h){ uint p; GetWindowThreadProcessId(h,out p); return p==ourPid; }
 static bool Topmost(IntPtr h){ return (GetWindowLong(h,-20)&8)!=0; }   // WS_EX_TOPMOST(마커·팟지·확인창)
 static bool InGroup(IntPtr h){ return h!=IntPtr.Zero && ((withClient && h==target) || Ours(h)); }
 static string Snap(){
  IntPtr h=FindWindow(null,"League of Legends");
  target=h;
  if(h==IntPtr.Zero) return "gone";                // 클라 창 자체가 없음(=종료) — 최소화와 구분
  if(!IsWindowVisible(h)||IsIconic(h)) return "";  // 최소화/숨김(=종료 아님·플로팅)
  RECT r; if(DwmGetWindowAttribute(h,9,out r,16)!=0 && !GetWindowRect(h,out r)) return "";  // 9=DWMWA_EXTENDED_FRAME_BOUNDS(보이는 실제 경계·투명 테두리 제외)
  IntPtr f=GetForegroundWindow();
  int fg=(f==h || Ours(f))?1:0;                    // 클라 '또는 우리 창'이 활성 = 한 묶음이 활성(클라↔패널 오갈 때 마커 안 깜빡임)
  return r.L+" "+r.T+" "+r.R+" "+r.B+" "+fg;
 }
 // 🪟 한 묶음 올리기 — 클라·왼쪽 창·오른쪽 창 중 하나가 활성이 되면 나머지를 그 바로 아래로(활성은 안 뺏음)
 //   ⚠️ 항상 위(topmost) 창은 빼야 함: 그 아래로 끼우면 끼운 창도 항상 위가 됨
 static void Restack(){
  IntPtr f=GetForegroundWindow();
  if(!InGroup(f) || Topmost(f) || IsIconic(f)) return;
  IntPtr prev=f;
  for(IntPtr h=GetTopWindow(IntPtr.Zero); h!=IntPtr.Zero; h=GetWindow(h,2)){   // 위에서부터(지금 순서 유지)
   if(h==f || !InGroup(h) || !IsWindowVisible(h) || IsIconic(h) || Topmost(h)) continue;
   SetWindowPos(h,prev,0,0,0,0,0x0213);            // NOSIZE|NOMOVE|NOACTIVATE|NOOWNERZORDER
   prev=h;
  }
 }
 static void Emit(){ string s=Snap(); if(s!=last){ last=s; Console.Out.WriteLine(s); Console.Out.Flush(); } }
 static void OnEvent(IntPtr hook,uint ev,IntPtr hwnd,int idO,int idC,uint th,uint tm){
  if(ev==0x800B){ if(idO!=0 || hwnd!=target) return; }   // 위치변경=대상 창 본체만(오버헤드 최소)
  Emit();
  if(ev==0x0003) Restack();
 }
 public static void Run(){
  cb=new WinEventProc(OnEvent);
  SetWinEventHook(0x0003,0x0003,IntPtr.Zero,cb,0,0,0);   // FOREGROUND(전경 전환)
  SetWinEventHook(0x0016,0x0017,IntPtr.Zero,cb,0,0,0);   // MINIMIZE START/END
  SetWinEventHook(0x800B,0x800B,IntPtr.Zero,cb,0,0,0);   // LOCATIONCHANGE(이동/크기=실시간 추종)
  SetTimer(IntPtr.Zero,IntPtr.Zero,90,IntPtr.Zero);      // 폴백 90ms(놓친 이벤트·클라 켜짐/꺼짐)
  Emit();
  MSG m;
  while(GetMessage(out m,IntPtr.Zero,0,0)>0){ if(m.msg==0x0113) Emit(); TranslateMessage(ref m); DispatchMessage(ref m); }
 }
}
'@
[Win]::Run()`;
const _dockB64 = (withClient) => Buffer.from(_dockScript.replace('__OUR_PID__', String(process.pid)).replace('__WITH_CLIENT__', withClient ? 'true' : 'false'), 'utf16le').toString('base64');

function setDockedFlag(v) {                    // 도킹 상태 → 오버레이에 알려 모서리 각지게(각/둥금 전환)
  if (v === dockedNow) return; dockedNow = v;
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('docked', v);
}
function applyDock(pb) {                       // 팀/명단 오버레이 = 클라 '왼쪽' 바깥에 붙임
  if (!overlayWin || !pb) return;
  const sf = (screen.getPrimaryDisplay().scaleFactor) || 1;
  const cx = pb.x / sf, cy = pb.y / sf, cw = pb.w / sf, ch = pb.h / sf;
  const disp = screen.getDisplayMatching({ x: Math.round(cx), y: Math.round(cy), width: Math.round(cw), height: Math.round(ch) });
  const dispLeft = disp.workArea.x;
  let W = Math.min(400, Math.round(cx - dispLeft));   // 클라 왼쪽 바깥 남은 공간(최대 400)
  if (W < 300) W = 300;
  let x = Math.round(cx - W);
  if (x < dispLeft) x = dispLeft;                     // 화면 밖이면 붙임(살짝 겹칠 수 있음)
  overlayWin.setBounds({ x, y: Math.round(cy), width: W + 2, height: Math.round(ch) });   // +2 클라 쪽으로 겹쳐 틈 제거
}
function applyDockLeft(pb) {                    // 내 정보 패널 = 클라 '오른쪽' 바깥에 붙임
  if (!leftWin || leftWin.isDestroyed()) return;
  const sf = (screen.getPrimaryDisplay().scaleFactor) || 1;
  const cx = pb.x / sf, cy = pb.y / sf, cw = pb.w / sf, ch = pb.h / sf;
  const disp = screen.getDisplayMatching({ x: Math.round(cx), y: Math.round(cy), width: Math.round(cw), height: Math.round(ch) });
  const dispRight = disp.workArea.x + disp.workArea.width;
  let x = Math.round(cx + cw) - 2;                            // -2 클라 쪽으로 겹쳐 틈 제거
  let W = Math.min(400, Math.round(dispRight - x));           // 클라 오른쪽 바깥 남은 공간
  if (W < 300) W = 300;
  if (x + W > dispRight) x = Math.max(disp.workArea.x, dispRight - W);   // 화면 밖이면 안으로 당김
  leftWin.setBounds({ x, y: Math.round(cy), width: W, height: Math.round(ch) });
}
function hideLeftPanel() { if (leftWin && !leftWin.isDestroyed() && leftWin.isVisible()) leftWin.hide(); leftDockedBounds = null; }
// 🪟 Win11 창 모서리 둥글림 강제 해제 (roundedCorners:false가 안 먹는 환경 대비 · DWMWA_WINDOW_CORNER_PREFERENCE=33·DONOTROUND=1)
function forceSquareCorners(win) {
  if (!win || win.isDestroyed()) return;
  let hwnd;
  try { const b = win.getNativeWindowHandle(); hwnd = b.length >= 8 ? b.readBigUInt64LE(0).toString() : String(b.readUInt32LE(0)); } catch (_) { return; }
  const ps = `Add-Type -Namespace Sq -Name W -MemberDefinition '[DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h,int a,ref int v,int s);'; $v=1; [Sq.W]::DwmSetWindowAttribute([IntPtr]${hwnd},33,[ref]$v,4)`;
  try { spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }); } catch (_) {}
}
function squareAllPanels() { for (const w of [overlayWin, leftWin, slotWin]) forceSquareCorners(w); }
// 📍 클라 로비 위 '내 팀 여기' 마커 — 팀 컬럼을 네모 테두리로 강조(클릭 통과)
let _slotReady = false;
function createSlotWin() {
  slotWin = new BrowserWindow({
    width: 300, height: 300, show: false, frame: false, transparent: true, hasShadow: false,
    backgroundColor: '#00000000',   // 완전 투명(흰 배경 렌더 방지)
    resizable: false, focusable: false, skipTaskbar: true, alwaysOnTop: false, roundedCorners: false, paintWhenInitiallyHidden: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  slotWin.setIgnoreMouseEvents(true, { forward: true });   // 클릭 통과 → 클라 조작 방해 X
  slotWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  _slotReady = false;
  slotWin.webContents.on('did-finish-load', () => { _slotReady = true; _slotMsg = ''; _slotSig = ''; });   // _slotSig 비움 → 다음 updateSlotMarker가 크기·zoom 다시 맞춤   // 내용은 처음 보일 때 updateSlotMarker가 보냄
  slotWin.loadFile('slot/slot.html');
  slotWin.on('closed', () => { slotWin = null; _slotReady = false; });
}
function hideSlotMarker() { if (slotWin && !slotWin.isDestroyed() && slotWin.isVisible()) slotWin.hide(); _slotSig = ''; _slotMsg = ''; }
function _repaintSlot() {   // 투명창이 흰 박스로 안 그려지는 Win 버그 → 1px 넛지로 강제 리페인트
  if (!slotWin || slotWin.isDestroyed()) return;
  try { const b = slotWin.getBounds(); slotWin.setBounds({ x: b.x, y: b.y, width: b.width + 1, height: b.height }); slotWin.setBounds(b); } catch (_) {}
}
let lobbySeat = null, lobbyPhase = null, lobbyCustom = null, _slotMsg = '';   // 🪑 브릿지 pollSeat(1초): 롤 페이즈 · 커스텀 로비에서 내가 앉은 쪽(1·2·'spec'·null) · 커스텀 방인지
function onLobbySeat(d) {
  lobbyPhase = d && d.phase || null; lobbySeat = d ? d.seat : null; lobbyCustom = d ? d.custom : null;
  if (!_floating && clientFg && _lastRect) updateSlotMarker(_lastRect); else hideSlotMarker();
}
function updateSlotMarker(p) {   // p=[L,T,R,B] 원시 px(클라 감지됨)
  const t = teamOf(sessionData, config.myName);
  const side = t === 'teamA' ? 1 : t === 'teamB' ? 2 : 0;
  // 로비 + 내 팀 있고 + 클라 또는 우리 창이 활성일 때만(다른 앱 위엔 안 뜨게) · 이번 팀결성으로 게임이 이미 시작됐으면 숨김(게임 후 재등장 방지 — 다음 팀결성 때만 다시)
  const startedThisFormation = !!(lastFormed && _slotDoneFormed === lastFormed);
  // v0.1.51: 롤 대기방(Lobby·커스텀)일 때만 — 「게임 시작」 뒤 챔피언 선택(프로필 나오는 화면)·홈 화면·일반 큐 로비엔 안 뜸
  const inLobby = lobbyPhase === 'Lobby' && lobbyCustom !== false;
  if (config.slot === false || inGame || !side || !clientFg || startedThisFormation || !inLobby) { hideSlotMarker(); return; }
  if (!slotWin || slotWin.isDestroyed()) createSlotWin();
  const sf = (screen.getPrimaryDisplay().scaleFactor) || 1;
  const cx = p[0] / sf, cy = p[1] / sf, cw = (p[2] - p[0]) / sf, ch = (p[3] - p[1]) / sf;
  // 상태: go=로비 자리 모름(아직 대기방 아님) · ok=맞는 쪽에 앉음 · move=반대 팀에 앉음 · spec=관전석
  const state = lobbySeat == null ? 'go' : lobbySeat === side ? 'ok' : lobbySeat === 'spec' ? 'spec' : 'move';
  // 마커 위치 = 롤 클라 화면 파일(rcp-fe-lol-parties 16.21 CSS, CommunityDragon)로 계산한 사용자 설정 게임 방 배치 — 클라는 1280×720 기준을 통째로 늘림
  //   팀 칸: 1팀 x 35~523 · 2팀 x 531~1019(.parties-lower-section 좌우 35 + .custom-game-team 488 + 사이 16) · 「TEAM 1」 글자 y 197 · 자리 y 218부터 48px씩
  //   그 위 y 151~197은 빈 칸(.empty-header-spacer 72 + .custom-root 위 10 + .custom-game-teams top 36) → 칩을 여기, 화살표가 팀 글자 줄 오른쪽(비어 있음)을 지나 첫 자리를 가리킴
  //   친구 목록은 오른쪽 사이드바라 펼침/접힘과 무관 · 창 크기만큼 마커도 같이 커짐(zoom)
  const k = Math.max(0.75, Math.min(1.6, cw / 1280));
  // v0.1.54 단순화: 태그 한 줄 + 화살표(창 150×58, 화살표 = 창 가운데) → 화살표가 첫 자리 「참가」 버튼 가운데(팀 칸 오른쪽 끝 −80)를 가리킴
  const bw = Math.round(150 * k), bh = Math.round(58 * k);
  const colRight = cx + cw * ((side === 1 ? 523 : 1019) / 1280);
  const x = Math.round(colRight - bw - 5 * k);
  const y = Math.round(cy + ch * (154 / 720));
  const sig = `${x},${y},${bw}`;
  if (sig !== _slotSig) { _slotSig = sig; slotWin.setBounds({ x, y, width: bw, height: bh }); try { slotWin.webContents.setZoomFactor(k); } catch (_) {} }
  if (!_slotReady) return;                               // 콘텐츠 로드 후에 표시(흰 박스 방지)
  const msg = side + '|' + state;
  const appear = !slotWin.isVisible();
  if (appear || msg !== _slotMsg) {   // 처음 뜰 때·상태 바뀔 때만 보냄(그때만 짧은 등장 효과 1번 — 무한 애니메이션 없음)
    _slotMsg = msg; _slotTeam = side;
    try { slotWin.webContents.send('slot-team', { side, state, appear }); } catch (_) {}
  }
  if (appear) { slotWin.showInactive(); try { slotWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {} _repaintSlot(); }
}
// 🪟 클라와 같은 층위 — 롤 클라(또는 우리 패널)가 활성일 때만 패널을 위로, 아니면 뒤로(다른 앱에 안 가림)
let clientFg = false, panelFg = false, _lastRaise = null, _dropTimer = null;
let _ovFocus = false, _lfFocus = false;
function applyRaise() {
  if (inGame) return;   // 게임 중엔 pollGame이 오버레이 관리
  // 🪟 도킹/플로팅 모두: 패널은 항상 보임(숨기지 않음)·일반 z-order로.
  //   → 다른 앱을 클릭하면 그 창 뒤로 자연스럽게 가고(사라지지 않음), 클라를 다시 눌러도 억지로 튀어나오지(pop) 않음.
  //   (사장님 요청: "그냥 그 창 뒤로만 가면 되니까 안 사라져도 됨")
  const show = (win, allowed) => {
    if (!win || win.isDestroyed()) return;
    try { if (win.isAlwaysOnTop()) win.setAlwaysOnTop(false, 'normal'); } catch (_) {}   // 바뀔 때만(매 이벤트 재설정=z-order 깜빡임·v0.1.55)
    if (allowed) { if (!win.isVisible()) win.showInactive(); }
    else if (win.isVisible()) win.hide();   // 사용자가 직접 숨긴(userHid/leftUserHid) 경우만 숨김
  };
  show(overlayWin, !userHid && !sampleActive && !overlayMinimized);
  show(leftWin, config.sidePanel !== false && !leftUserHid && !leftMinimized);
  // 📍 마커는 클라 또는 우리 창이 활성일 때만(도킹 중·다른 앱 위엔 안 뜨게 · v0.1.53: 우리 창 눌러도 유지)
  if (!_floating && clientFg && _lastRect) updateSlotMarker(_lastRect); else hideSlotMarker();
}
function evalRaise() {   // 올릴 땐 즉시, 내릴 땐 살짝 텀(클라↔패널 클릭 전환 깜빡임 방지)
  if (clientFg || panelFg) { if (_dropTimer) { clearTimeout(_dropTimer); _dropTimer = null; } applyRaise(); }
  else if (!_dropTimer) _dropTimer = setTimeout(() => { _dropTimer = null; applyRaise(); }, 300);
}
function setPanelFg() { const v = _ovFocus || _lfFocus; if (v !== panelFg) { panelFg = v; evalRaise(); } }
// 🚪 클라 종료 시 "같이 끌까요?" — OS 기본 다이얼로그 대신 앱 톤(블랙+골드) 커스텀 창
let quitConfirmWin = null;
function closeQuitConfirm() { _quitPromptOpen = false; if (quitConfirmWin && !quitConfirmWin.isDestroyed()) { try { quitConfirmWin.close(); } catch (_) {} } quitConfirmWin = null; }
let _quitMode = 'client';   // 'client'=클라 종료 따라 묻기 · 'close'=오른쪽 창 ✕(숨기기/종료)
function maybePromptQuitOnClientClose() {
  if (app._quitting || _quitPromptOpen || _clientPresent || inGame) return;   // 그새 다시 켜졌거나 게임 중이면 안 띄움
  openQuitConfirm('client');
}
function openQuitConfirm(mode) {
  _quitPromptOpen = true; _quitMode = mode;
  const W = 360, H = mode === 'close' ? 204 : 182;
  const wa = screen.getPrimaryDisplay().workArea;
  const x = mode === 'close' ? wa.x + wa.width - W - 16 : Math.round(wa.x + (wa.width - W) / 2);   // ✕ = 오른쪽 아래(트레이 아이콘 근처)
  const y = mode === 'close' ? wa.y + wa.height - H - 16 : Math.round(wa.y + (wa.height - H) / 2.5);   // 클라 종료 = 화면 중앙(살짝 위)
  quitConfirmWin = new BrowserWindow({
    width: W, height: H, x, y, frame: false, transparent: true, resizable: false, movable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, focusable: true, roundedCorners: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  quitConfirmWin.setAlwaysOnTop(true, 'screen-saver');
  quitConfirmWin.loadFile('desktop/quit-confirm.html', { query: { mode } });
  quitConfirmWin.once('ready-to-show', () => { if (quitConfirmWin && !quitConfirmWin.isDestroyed()) quitConfirmWin.show(); });
  quitConfirmWin.on('closed', () => { quitConfirmWin = null; _quitPromptOpen = false; });
}
function handleDockLine(line) {
  const raw = String(line).trim();
  if (raw === 'gone') {   // 🚪 클라 창 자체가 사라짐(종료) — 최소화(빈 줄)와 구분
    hideSlotMarker(); floatPanels();
    if (clientFg) { clientFg = false; evalRaise(); }
    if (_clientPresent) {   // 있었다가 사라짐 = 방금 종료 → 잠깐 뒤에도 없으면 "같이 끌까요?" (오탐 방지 디바운스)
      _clientPresent = false;
      if (!_goneTimer && !app._quitting) _goneTimer = setTimeout(() => { _goneTimer = null; maybePromptQuitOnClientClose(); }, 2500);
    }
    return;
  }
  const p = raw.split(/\s+/).map(Number);
  const valid = p.length >= 4 && p.slice(0, 4).every(Number.isFinite) && (p[2] - p[0]) >= 700 && (p[3] - p[1]) >= 400;
  if (config.dock === false || !valid) {   // 도킹 끔 or 최소화/숨김 → 독립 창(플로팅)으로 (종료 아님)
    hideSlotMarker(); floatPanels();
    if (clientFg) { clientFg = false; evalRaise(); }
    return;
  }
  if (_goneTimer) { clearTimeout(_goneTimer); _goneTimer = null; }   // 클라 다시 나타남 → 종료 확인 취소
  if (quitConfirmWin) closeQuitConfirm();   // 종료 확인창 떠 있으면 닫음(클라 복귀)
  _clientPresent = true;
  // 플로팅 → 도킹 전환: 가운데로 옮겨진 창을 '같은 클라 위치'라도 반드시 다시 붙임
  //   (마지막 좌표 기억 때문에 왼쪽 창만 클라를 움직여야 붙던 문제 — 오른쪽은 게임 중 숨기며 기억이 지워져 괜찮았음)
  if (_floating) { _floating = false; _lastRaise = null; dockedBounds = null; leftDockedBounds = null; }
  _lastRect = p;
  const fg = p[4] === 1;                            // 클라 또는 우리 창이 지금 활성인가(한 묶음 — 도킹 스크립트 Snap)
  if (fg !== clientFg) { clientFg = fg; }
  const w = p[2] - p[0], h = p[3] - p[1], sig = `${p[0]},${p[1]},${w},${h}`;
  // ◀ 팀·명단 오버레이 = 클라 왼쪽 (숨김 상태여도 위치는 갱신)
  if (sig !== dockedBounds) { dockedBounds = sig; applyDock({ x: p[0], y: p[1], w, h }); }
  setDockedFlag(true);
  // ▶ 내 정보 = 클라 오른쪽
  if (config.sidePanel !== false && !leftUserHid && sig !== leftDockedBounds) { leftDockedBounds = sig; applyDockLeft({ x: p[0], y: p[1], w, h }); }
  evalRaise();          // 표시/숨김·위로 = 클라 활성 여부에 따라(다른 창 위에 안 뜨게)
  updateSlotMarker(p);  // 📍 내 팀 마커
}
// 🪟 클라 창을 끄는 동안 위치 이벤트가 프레임보다 잦게 쏟아짐 → 줄마다 패널을 옮기면 투명창 재그리기가 밀려 끊김.
//   각 줄은 '현재 상태 전체'(위치·활성)라 최신 1줄만 처리해도 의미 동일 → 최대 60fps로 묶어 처리(v0.1.55)
let _dockPending = null, _dockTimer = null, _dockLastAt = 0;
function queueDockLine(line) {
  _dockPending = line;
  if (_dockTimer) return;
  const wait = Math.max(0, 16 - (Date.now() - _dockLastAt));
  _dockTimer = setTimeout(() => {
    _dockTimer = null; _dockLastAt = Date.now();
    const ln = _dockPending; _dockPending = null;
    if (ln !== null) handleDockLine(ln);
  }, wait);
}
function startDockStream() {
  if (dockProc) return;
  try {
    const proc = dockProc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', _dockB64(config.dock !== false)], { windowsHide: true });
    proc.stdout.on('data', chunk => {
      if (dockProc !== proc) return;
      _dockBuf += chunk.toString(); let i, latest = null;
      while ((i = _dockBuf.indexOf('\n')) >= 0) { latest = _dockBuf.slice(0, i).trim(); _dockBuf = _dockBuf.slice(i + 1); }
      if (latest !== null) queueDockLine(latest);
    });
    proc.on('exit', () => { if (dockProc !== proc) return; dockProc = null; if (!app._quitting) setTimeout(startDockStream, 2000); });  // 죽으면 재기동(stopDockStream으로 끈 건 제외)
    proc.on('error', () => { if (dockProc === proc) dockProc = null; });
  } catch (_) { dockProc = null; }
}
function stopDockStream() { if (dockProc) { try { dockProc.kill(); } catch (_) {} dockProc = null; } }

// ── HTTPS GET (JSON) ────────────────────────────────────────────────────
function getJson(opts) {
  return new Promise(resolve => {
    const req = https.get(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
// ⚡ Firebase 실시간 스트림(REST SSE) — 노드가 바뀌는 즉시 onChange 호출(3초 폴링 지연 제거·v0.1.55).
//   끊기면 자동 재연결(1→30초 백오프). 폴링은 안전망으로 그대로 유지.
function fbStream(pathStr, onChange) {
  let retry = 1000;
  const open = (url, hops) => {
    if (app._quitting) return;
    let lastBeat = Date.now(), buf = '', done = false;
    const again = () => { if (done) return; done = true; clearInterval(idle); setTimeout(() => open(`${FIREBASE_DB}/${pathStr}.json`, 0), retry); retry = Math.min(retry * 2, 30000); };
    const req = https.get(url, { headers: { Accept: 'text/event-stream' } }, res => {
      if ((res.statusCode === 307 || res.statusCode === 302) && res.headers.location && hops < 3) {   // 샤드 호스트로 리다이렉트
        done = true; clearInterval(idle); res.resume(); open(res.headers.location, hops + 1); return;
      }
      if (res.statusCode !== 200) { res.resume(); again(); return; }
      res.setEncoding('utf8');
      res.on('data', chunk => {
        lastBeat = Date.now(); buf += chunk; let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = (block.match(/^event: *(.*)$/m) || [])[1];
          if (ev === 'put' || ev === 'patch') { retry = 1000; try { onChange(); } catch (_) {} }
          else if (ev === 'cancel' || ev === 'auth_revoked') { req.destroy(); again(); return; }
        }
      });
      res.on('end', again);
      res.on('error', again);
    });
    req.on('error', again);
    const idle = setInterval(() => { if (Date.now() - lastBeat > 90000) { req.destroy(); again(); } }, 30000);   // keep-alive(30초) 끊김 감지
  };
  open(`${FIREBASE_DB}/${pathStr}.json`, 0);
}
// 같은 폴러가 겹쳐 돌지 않게(스트림 이벤트+타이머 동시 호출) — 실행 중이면 끝난 뒤 1번만 다시
function coalesce(fn) {
  let running = false, again = false;
  return async function run() {
    if (running) { again = true; return; }
    running = true;
    try { await fn(); } catch (_) {}
    finally { running = false; if (again) { again = false; run(); } }
  };
}
const liveClientPlayerList = () => getJson({ host: '127.0.0.1', port: 2999, path: '/liveclientdata/playerlist', rejectUnauthorized: false, timeout: 2000 });

// ── HTTPS 요청(JSON body) — 익명 인증·Firebase 쓰기용 ─────────────────────
function reqJson(method, url, body) {
  return new Promise(resolve => {
    const u = new URL(url);
    const data = body === undefined ? null : JSON.stringify(body);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch (_) { resolve({ status: res.statusCode, json: null }); } });
    });
    req.on('error', () => resolve({ status: 0, json: null }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, json: null }); });
    if (data) req.write(data);
    req.end();
  });
}

// 🔑 Firebase 익명 인증 — 쓰기 규칙(auth != null)용. 홈페이지 signInAnonymously와 동일한 신뢰모델.
let _fbTok = null, _fbTokAt = 0;
async function fbToken() {
  if (_fbTok && Date.now() - _fbTokAt < 50 * 60 * 1000) return _fbTok;   // idToken 수명 1h → 50분 캐시
  const r = await reqJson('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, { returnSecureToken: true });
  if (r.json && r.json.idToken) { _fbTok = r.json.idToken; _fbTokAt = Date.now(); return _fbTok; }
  return null;
}
// session 등 노드 전체 교체(set) — 홈페이지 set(ref(db,'session'), ...)과 동일 시맨틱
async function fbSet(pathStr, value) {
  const tok = await fbToken();
  if (!tok) return { ok: false, err: '인증 실패(네트워크 확인)' };
  const r = await reqJson('PUT', `${FIREBASE_DB}/${pathStr}.json?auth=${tok}`, value);
  if (r.status === 200) return { ok: true };
  if (r.status === 401 || r.status === 403) { _fbTok = null; }   // 토큰 만료/거부 → 다음 시도에 재발급
  return { ok: false, err: `쓰기 실패(HTTP ${r.status})` };
}
async function fbDelete(pathStr) {   // 특정 키 삭제 — 홈페이지 remove()와 동일(투표 취소용)
  const tok = await fbToken();
  if (!tok) return { ok: false };
  const r = await reqJson('DELETE', `${FIREBASE_DB}/${pathStr}.json?auth=${tok}`);
  if (r.status === 401 || r.status === 403) { _fbTok = null; }
  return { ok: r.status === 200 };
}
async function fbUpdate(pathStr, value) {   // 노드 일부 필드만 갱신(PATCH) — 홈페이지 update()와 동일. items_s2만 덮어씀(다른 필드 유실 방지).
  const tok = await fbToken();
  if (!tok) return { ok: false, err: '인증 실패' };
  const r = await reqJson('PATCH', `${FIREBASE_DB}/${pathStr}.json?auth=${tok}`, value);
  if (r.status === 401 || r.status === 403) { _fbTok = null; }
  return { ok: r.status === 200, err: r.status === 200 ? null : `쓰기 실패(HTTP ${r.status})` };
}

// ── 창 생성 ──────────────────────────────────────────────────────────────
function createOverlay() {
  overlayWin = new BrowserWindow({
    width: 456, height: 452, x: 24, y: 84, minWidth: 260, minHeight: 220,
    transparent: true, frame: false, resizable: true, movable: true,   // 크기 조절 가능(반응형)
    alwaysOnTop: false, skipTaskbar: true, show: false, focusable: true,   // 로비=클라와 같은 층위, 게임 중만 위로(pollGame)
    roundedCorners: false,   // 🪟 Win11 창 모서리 둥글림 끄기 → 클라에 각지게 딱 맞음
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.loadFile('overlay/overlay.html');
  overlayWin.on('focus', () => { _ovFocus = true; setPanelFg(); });   // 패널 클릭=활성 유지
  overlayWin.on('blur', () => { _ovFocus = false; setPanelFg(); });
  overlayWin.on('closed', () => { overlayWin = null; _ovFocus = false; setPanelFg(); });
  overlayWin.on('restore', () => { overlayMinimized = false; try { overlayWin.setSkipTaskbar(true); } catch (_) {} });   // 작업표시줄서 복원 → 다시 오버레이 층위로
}
// ▶ 오른쪽 패널(입장·팀짜기·오늘 기록) — 메인 창
function createLeftPanel() {
  leftWin = new BrowserWindow({
    width: 360, height: 600, x: 24, y: 84, minWidth: 260, minHeight: 300,
    frame: false, backgroundColor: '#010A13', show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    alwaysOnTop: false, skipTaskbar: true, resizable: true, focusable: true,   // 클라와 같은 층위(로비 정보 패널)
    roundedCorners: false,   // 🪟 Win11 창 모서리 둥글림 끄기 → 클라에 각지게 딱 맞음
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  leftWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  leftWin.loadFile('sidepanel/sidepanel.html');
  leftWin.on('focus', () => { _lfFocus = true; setPanelFg(); });   // 패널 클릭=활성 유지
  leftWin.on('blur', () => { _lfFocus = false; setPanelFg(); });
  leftWin.on('closed', () => { leftWin = null; _lfFocus = false; setPanelFg(); });
  leftWin.on('restore', () => { leftMinimized = false; try { leftWin.setSkipTaskbar(true); } catch (_) {} });   // 작업표시줄서 복원
}
// ── 독립 창(플로팅) 배치 — 클라 없을 때 좌우에 띄움 ──────────────────────
function standaloneBounds(which) {
  // 클라 없음 = 좌우 끝에 벌리지 않고 두 패널을 화면 가운데에 나란히 모음
  const wa = screen.getPrimaryDisplay().workArea;
  const h = Math.min(760, wa.height - 100);
  const y = Math.round(wa.y + (wa.height - h) / 2);
  const LW = 430, RW = 380, GAP = 10;                          // 좌(팀·명단) · 우(내 정보) · 사이 간격
  const startX = Math.round(wa.x + (wa.width - (LW + GAP + RW)) / 2);
  return which === 'left'
    ? { x: startX, y, width: LW, height: h }                   // ◀ 팀·명단 오버레이(가운데 왼쪽)
    : { x: startX + LW + GAP, y, width: RW, height: h };       // ▶ 내 정보(가운데 오른쪽)
}
function floatPanels() {   // 클라 없음/도킹 끔 → 독립 창으로 표시(첫 전환 때만 위치 세팅)
  if (inGame) { hideLeftPanel(); return; }   // 게임 중엔 내 정보 패널 숨김(오버레이는 pollGame이 관리)
  const reposition = !_floating;
  _floating = true; _lastRaise = null;
  if (reposition) { dockedBounds = null; leftDockedBounds = null; }   // 가운데로 옮겼으니 다음 도킹 때 무조건 다시 붙이기
  for (const [win, allowed, side] of [[overlayWin, !userHid && !sampleActive, 'left'], [leftWin, config.sidePanel !== false && !leftUserHid, 'right']]) {
    if (!win || win.isDestroyed() || !allowed) continue;
    if (reposition) win.setBounds(standaloneBounds(side));
    try { if (win.isAlwaysOnTop()) win.setAlwaysOnTop(false, 'normal'); } catch (_) {}   // 바뀔 때만(매 이벤트 재설정=z-order 깜빡임·v0.1.55)
    if (!win.isVisible()) win.showInactive();
  }
  setDockedFlag(false);
}
function showMainPanel() {   // 트레이/재실행 → 내 정보 패널(메인)을 앞으로
  if (!leftWin || leftWin.isDestroyed()) createLeftPanel();
  if (config.sidePanel === false) { config.sidePanel = true; saveConfig(); refreshTrayMenu(); }
  leftUserHid = false; leftMinimized = false; try { leftWin.setSkipTaskbar(true); } catch (_) {}
  if (!leftWin.isVisible() && _floating) leftWin.setBounds(standaloneBounds('right'));   // 플로팅일 때만 위치 리셋
  leftWin.show(); leftWin.moveTop(); leftWin.focus();
}

// ── 오버레이 표시/숨김 ────────────────────────────────────────────────────
function showOverlay() { overlayMinimized = false; if (overlayWin) { try { overlayWin.setSkipTaskbar(true); } catch (_) {} if (!overlayWin.isVisible()) overlayWin.showInactive(); } } // 게임 포커스 뺏지 않게
function hideOverlay() { if (overlayWin && overlayWin.isVisible()) overlayWin.hide(); }
function toggleOverlay() {
  if (!overlayWin) return;
  if (overlayWin.isVisible()) { hideOverlay(); userHid = true; }
  else { showOverlay(); userHid = false; }
}

const _lastSent = {};
function broadcast(channel, payload) {
  if (channel === 'session' && payload && typeof payload === 'object') payload.isHost = !!config.isHost;   // 👑 방장 여부 동봉(투표 마감 버튼용)
  if (channel === 'session' || channel === 'lobby') {   // ⚡ 바뀐 게 없으면 안 보냄 → 화면을 괜히 다시 그리지 않음
    const sig = JSON.stringify(payload);
    if (_lastSent[channel] === sig) return;
    _lastSent[channel] = sig;
  }
  for (const w of [overlayWin, leftWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

// ── 폴링 루프 ──────────────────────────────────────────────────────────────
async function pollGame() {
  if (replayBusy) return;   // 🎬 팟지 리플레이 녹화 중 = 리플레이 게임 창이라 실제 게임 아님(패널 숨김·「기록 저장 중」·수집이 잘못 켜지지 않게)
  const list = await liveClientPlayerList();
  const nowIn = Array.isArray(list);
  if (nowIn) sampleActive = false;          // 실게임 시작 → 미리보기 해제
  else if (sampleActive) return;            // 미리보기 유지 중(실게임 아님) → 건드리지 않음
  if (nowIn) {
    latestPlayers = list.filter(p => !p.isBot).map(p => ({
      name: (p.riotIdGameName || p.summonerName || (typeof p.riotId === 'string' ? p.riotId.split('#')[0] : '') || '').trim(),
      champ: p.championName || '',
      teamId: p.team === 'ORDER' ? 100 : p.team === 'CHAOS' ? 200 : 0,
      skin: Number.isFinite(p.skinID) ? p.skinID : null,   // 🖼️ 낀 스킨 번호(팟지 소개 배경 일러스트)
    })).filter(p => p.name);
  }
  if (nowIn !== inGame) {              // 상태 전환
    inGame = nowIn;
    // 게임 중(전체화면)만 위로, 로비/클라에선 같은 층위(클라 활성 시에만 evalRaise가 올림)
    try { if (overlayWin && !overlayWin.isDestroyed()) overlayWin.setAlwaysOnTop(inGame, inGame ? 'screen-saver' : 'normal'); } catch (_) {}
    if (inGame) { hideOverlay(); hideLeftPanel(); _slotDoneFormed = lastFormed; hideSlotMarker(); closePotg(); if (potg) potg.startCollect(bridge.getGameId()); }   // 🎬 팟지 수집 시작   // 게임 시작 → 양쪽 패널 완전히 숨김(전투 중 정보 미노출, 새 폼 재설계 예정) · 좌측 내 정보 패널도 숨김(클라 창 사라지며 floatPanels가 잠깐 띄우는 레이스 차단) · applyRaise/floatPanels가 inGame return이라 재등장 없음
    else { hideOverlay(); userHid = false; latestPlayers = []; _lastRaise = null; evalRaise(); recGameEnded(); if (potg) potg.stopCollect(bridge.getGameId()).catch(() => {}); }   // 🎬 수집 올림   // 게임 종료 → 로비 층위 재적용 · 📼 「기록 저장 중」 시작
    broadcast('state', { inGame, label: inGame ? '게임 중' : '대기' });
  }
  broadcast('players', { players: latestPlayers });
}

// ══════════════════════════════════════════════════════════════════════════
// 📅 투데이 내전 — 데이터(today/)·팀짜기·경기 기록·투표·오늘 순위
// ══════════════════════════════════════════════════════════════════════════
// 하루 = 새벽 6시 기준(밤샘 내전이 자정을 넘겨도 같은 날로 묶임)
const DAY_START_HOUR = 6;
function dayKey(ts) {
  const d = new Date((ts || Date.now()) - DAY_START_HOUR * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fbKeyOf = name => normName(name).replace(/\s+/g, '_').replace(/[.#$\[\]\/]/g, '_');   // Firebase 키 금지문자 제거
const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();   // 인게임 이름↔등록 이름 느슨한 매칭용
function teamOf(s, name) {
  if (!s || !name) return null;
  const n = normName(name);
  if ((s.teamA || []).some(x => normName(x) === n)) return 'teamA';
  if ((s.teamB || []).some(x => normName(x) === n)) return 'teamB';
  return null;
}

const fetchSession   = () => getJson(`${FIREBASE_DB}/${T}/session.json`);
const fetchLobby     = () => getJson(`${FIREBASE_DB}/${T}/lobby.json`);
const fetchEog       = () => getJson(`${FIREBASE_DB}/${T}/bridge/eogStats.json`);
const fetchDay       = (day) => getJson(`${FIREBASE_DB}/${T}/days/${day}/matches.json`);
const fetchPresence  = () => getJson(`${FIREBASE_DB}/${T}/presence.json`);        // 👤 지금 앱 켜고 롤 로그인한 사람들

// ── 👤 라이엇 계정 = 나 (롤 클라에 로그인된 계정으로 자동 입장 · 사이트 닉네임 안 씀) ──
// 표시 이름 = 라이엇 게임 이름. 저장 키 = puuid(계정 고유 ID·닉변해도 유지).
// 친구가 같은 PC에서 자기 계정으로 바꿔 로그인하면 브릿지가 감지 → 자동 전환(방장은 해제).
let account = null;   // { puuid, gameName, tagLine }
const PRESENCE_MS = 20000, ONLINE_MS = 60000;
let _presenceTimer = null;
async function beatPresence() {
  if (!account) {   // 클라 잠깐 꺼짐 — 방장 자리만 살아있게(2분)
    if (_away && config.isHost) fbCas(`${T}/host`, cur => cur && cur.puuid === _away.puuid ? { value: { puuid: cur.puuid, name: cur.name, at: Date.now() } } : { err: 'not mine' }).catch(() => {});
    return;
  }
  await fbSet(`${T}/presence/${account.puuid}`, { name: account.gameName, tag: account.tagLine || null, icon: account.iconId || null, at: Date.now(), host: !!config.isHost, app: app.getVersion() }).catch(() => {});
  if (config.isHost) fbCas(`${T}/host`, cur => cur && cur.puuid === account.puuid ? { value: { puuid: cur.puuid, name: cur.name, at: Date.now() } } : { err: 'not mine' }).catch(() => {});   // 👑 방장 살아있음 표시
}
// 🔌 롤 클라를 잠깐 끈 것(게임 끝나고 껐다 켜기 등)은 로그아웃으로 치지 않음 — 같은 계정이 2분 안에 돌아오면 방장·참가 그대로
//    (전엔 클라를 끄는 순간 방장이 풀려서, 롤을 다시 켜 전적에서 결과를 복구해도 기록해 줄 방장이 없었음)
const AWAY_GRACE_MS = 2 * 60 * 1000;
let _away = null, _awayTimer = null;   // 클라 꺼짐으로 잠깐 없는 내 계정
function releaseAccount(prev) {   // 이전 계정의 접속 표시·방장·대기실 참가 정리
  fbSet(`${T}/presence/${prev.puuid}`, null).catch(() => {});
  if (config.isHost) { config.isHost = false; fbSet(`${T}/host`, null).catch(() => {}); broadcast('account', { account, isHost: false }); broadcast('host', hostView()); }
  fbSet(`${T}/lobby/join/${prev.puuid}`, null).catch(() => {});
}
function setAccount(acc) {
  const prev = account;
  if (acc && !acc.gameName) acc = null;
  if ((prev && prev.puuid) === (acc && acc.puuid) && (prev && prev.gameName) === (acc && acc.gameName) && (prev && prev.iconId) === (acc && acc.iconId)) return;
  if (prev && !acc) {   // 클라 꺼짐 → 2분 기다림
    _away = prev; clearTimeout(_awayTimer);
    _awayTimer = setTimeout(() => { const a = _away; _away = null; if (a && !account) releaseAccount(a); }, AWAY_GRACE_MS);
  } else if (prev && acc && prev.puuid !== acc.puuid) releaseAccount(prev);   // 다른 계정으로 바뀜 → 바로 정리
  if (acc && _away) {   // 돌아옴: 같은 계정이면 그대로 이어감, 다른 계정이면 이전 계정 정리
    clearTimeout(_awayTimer);
    if (_away.puuid !== acc.puuid) releaseAccount(_away);
    _away = null;
  }
  account = acc;
  config.myName = acc ? acc.gameName : '';
  if (acc) {
    beatPresence();
    fbUpdate(`${T}/accounts/${acc.puuid}`, { name: acc.gameName, tag: acc.tagLine || null, icon: acc.iconId || null, lastSeen: Date.now() }).catch(() => {});
    if (!_presenceTimer) _presenceTimer = setInterval(beatPresence, PRESENCE_MS);
  }
  broadcast('account', { account, isHost: !!config.isHost, switched: !!(prev && acc && prev.puuid !== acc.puuid) });
  broadcast('myname', config.myName);
  broadcast('session', { session: sessionData, myName: config.myName });
  onHostRec(hostRec);
}
async function getRoster() {   // 방장 참가자 목록 = 지금 접속 중 + 오늘 뛴 사람
  const [pres, t] = await Promise.all([fetchPresence(), getToday()]);
  const now = Date.now(), online = [];
  for (const [puuid, p] of Object.entries(pres || {})) if (p && p.name && now - (p.at || 0) < ONLINE_MS) online.push({ puuid, name: normName(p.name), tag: p.tag || '', host: !!p.host });
  online.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const onSet = new Set(online.map(o => o.name));
  const recent = (t.standings || []).map(p => p.name).filter(n => !onSet.has(n));
  return { ok: true, online, recent, me: account ? account.gameName : '' };
}
async function teamIds(names) {   // 이름 → puuid(경기 결과를 계정 ID로 정확히 판정하기 위해 팀에 같이 저장)
  const pres = await fetchPresence(), ids = {};
  for (const [puuid, p] of Object.entries(pres || {})) if (p && p.name && names.includes(normName(p.name))) ids[fbKeyOf(p.name)] = puuid;
  return Object.keys(ids).length ? ids : null;
}

// ── 📼 게임 끝난 뒤 「기록 저장 중」 진행 상태 — 왼쪽 창(롤 클라 옆)에 단계별로 보여줌 ─────────
// 단계: end(게임 종료 확인) → get(결과 가져오기: 정산 화면/전적) → save(서버 저장) → rec(방장이 오늘 기록에 반영) → done
// 출처: 내 브릿지(onEog) + 서버(eogStats·session) — 다른 사람 PC가 결과를 잡아도 같이 진행됨
let recState = null;   // { stage, since, gameId, src, tries, max, problem }
const REC_GIVEUP_MS = 4 * 60 * 1000;
function recSet(patch) {
  if (patch === null) { if (recState) { recState = null; broadcast('rec', null); } return; }
  recState = Object.assign({}, recState || { since: Date.now() }, patch);
  broadcast('rec', recState);
}
const REC_ORDER = { end: 0, get: 1, save: 2, rec: 3, done: 4 };
function recAdvance(stage, patch) {   // 뒤로 가지 않게(늦게 온 알림 무시)
  if (!recState) return;
  if (REC_ORDER[stage] < REC_ORDER[recState.stage]) return;
  recSet(Object.assign({ stage }, patch || {}));
}
function recGameEnded() {
  const s = sessionData;
  if (!s || s.phase !== 'teams' || !s.teamsFormedAt) return;   // 진행 중인 내전 판이 없으면(일반 게임 등) 안 띄움
  if (recState && Date.now() - recState.since < 5 * 60 * 1000) return;   // 이미 진행 중(브릿지가 먼저 알림) → 처음으로 되돌리지 않음
  recState = null;
  recSet({ stage: 'get', since: Date.now(), problem: null });
  setTimeout(() => { if (recState && !inGame) { userHid = false; showOverlay(); } }, 1500);   // 클라 화면이 돌아올 즈음 왼쪽 창 띄움
}
function onBridgeEog(e) {
  if (!e) return;
  if (e.stage === 'skip') return recSet(null);   // 일반 게임
  if (e.stage === 'ended') return recGameEnded();
  if (!recState) { if (!sessionData || sessionData.phase !== 'teams') return; recSet({ stage: 'get', since: Date.now() }); if (!inGame) { userHid = false; showOverlay(); } }   // 롤이 꺼졌거나 다음 실행 때 전적 복구 등
  if (e.stage === 'history') recSet({ stage: 'get', src: '전적', tries: e.tries || 0, max: e.max || 36, problem: null, gameId: e.gameId });
  else if (e.stage === 'captured') recAdvance('save', { src: e.src, gameId: e.gameId, problem: null });
  else if (e.stage === 'saved') recAdvance('rec', { src: e.src, gameId: e.gameId, problem: null });
  else if (e.stage === 'retry') recSet({ problem: '저장이 늦어지고 있어요 · 다시 시도 중' });
  else if (e.stage === 'missed') recSet({ problem: 'missed' });
  else if (e.stage === 'closed') recSet({ problem: 'closed' });
}
async function recTick(s) {   // pollSession마다: 서버 상태로 단계 맞추기
  if (!recState) return;
  if (!s || s.phase === 'lobby' || !s.teamsFormedAt) return recSet(null);
  if (s.phase === 'vote' || s.phase === 'result') return recSet(null);   // 기록 완료 → 투표 화면(「1팀 승리」 띠)이 완료 표시
  if (s.pendingEog) return recSet({ stage: 'rec', problem: 'pick' });   // 이름이 안 맞아 방장이 직접 골라야 함
  if (REC_ORDER[recState.stage] < REC_ORDER.rec) {
    const e = await fetchEog();
    if (e && e.gameId && (e.savedAt || 0) >= (s.teamsFormedAt || 0) && (e.savedAt || 0) >= recState.since - 120000) recAdvance('rec', { src: recState.src || (e.source === 'history' ? '전적' : '정산 화면'), gameId: e.gameId });
  }
  if (Date.now() - recState.since > REC_GIVEUP_MS && !recState.problem) recSet({ problem: 'missed' });
}

// ── 👑 방장 = 한 번에 한 명(today/host) · 넘겨주기 · 응답 없으면 이어받기 ──────────
// 방장 앱이 20초마다 at 갱신. 60초 넘게 끊기면 다른 사람이 「방장 이어받기」 가능.
// 내 계정이 방장으로 적혀 있으면(넘겨받음·재시작) 자동으로 방장이 되고, 남의 이름이면 자동으로 내려옴.
let hostRec = null;   // { puuid, name, at, from }
const fetchHost = () => getJson(`${FIREBASE_DB}/${T}/host.json`);
const hostAlive = h => !!(h && h.puuid && Date.now() - (h.at || 0) < ONLINE_MS);
function hostView(note) {
  const me = account || _away;
  const h = hostRec && hostRec.puuid ? { name: hostRec.name || '', alive: hostAlive(hostRec), mine: !!(me && hostRec.puuid === me.puuid) } : null;
  return { host: h, isHost: !!config.isHost, note: note || null };
}
function setHostLocal(v, note) {
  v = !!v;
  if (!!config.isHost !== v) {
    config.isHost = v;
    beatPresence();
    broadcast('account', { account, isHost: v });
    broadcast('session', { session: sessionData, myName: config.myName || '' });
    if (v) { runHost(); try { showMainPanel(); } catch (_) {} }
  }
  broadcast('host', hostView(note));
  broadcast('lobby', lobbyView());   // 🚪 대기실 방장 표시·조작 버튼
}
function onHostRec(h) {
  const prev = hostRec;
  hostRec = h && h.puuid ? h : null;
  const me = account || _away;   // 클라 잠깐 꺼져도 나
  const mine = !!(me && hostRec && hostRec.puuid === me.puuid);
  if (mine && !config.isHost && hostAlive(hostRec)) return setHostLocal(true, hostRec.from ? `${hostRec.from}님이 방장을 넘겨줬어요` : null);
  if (!mine && config.isHost) return setHostLocal(false, hostRec ? `${hostRec.name}님이 방장이 됐어요` : null);
  if (JSON.stringify(prev) !== JSON.stringify(hostRec) || !hostAlive(hostRec)) broadcast('host', hostView());
}
async function claimHost() {
  if (!account) return { ok: false, err: '롤에 로그인해야 방장을 할 수 있어요' };
  const me = account;
  const r = await fbCas(`${T}/host`, cur => {
    if (cur && cur.puuid && cur.puuid !== me.puuid && hostAlive(cur)) return { err: `${cur.name}님이 이미 방장이에요` };
    return { value: { puuid: me.puuid, name: me.gameName, at: Date.now() } };
  });
  if (!r.ok) return r;
  hostRec = r.value; setHostLocal(true);
  return { ok: true };
}
async function releaseHost() {
  if (account) await fbCas(`${T}/host`, cur => cur && cur.puuid === account.puuid ? { value: null } : { err: 'not mine' }).catch(() => {});
  hostRec = null; setHostLocal(false);
  return { ok: true };
}
async function handHost(puuid) {
  if (!config.isHost || !account) return { ok: false, err: '방장만 넘겨줄 수 있어요' };
  const p = ((await fetchPresence()) || {})[puuid];
  if (!p || !p.name || Date.now() - (p.at || 0) >= ONLINE_MS) return { ok: false, err: '지금 접속 중인 사람에게만 넘길 수 있어요' };
  const me = account;
  const r = await fbCas(`${T}/host`, cur => cur && cur.puuid === me.puuid
    ? { value: { puuid, name: normName(p.name), at: Date.now(), from: me.gameName } } : { err: '방장이 아니에요' });
  if (!r.ok) return r;
  hostRec = r.value; setHostLocal(false, `${normName(p.name)}님에게 방장을 넘겼어요`);
  return { ok: true };
}

// ── 🚪 대기실 — 접속한 사람 모두가 같은 화면을 봄 ─────────────────────────────
// today/lobby = { mode:'random'|'draft'|'manual', captains:{teamA,teamB}, sides:{fbKey(이름): 'teamA'|'teamB'}, join:{ key:{name, st:'in'|'spec', at, day, guest?} } }
// v0.1.47 🧩 직접(manual) = 방장이 한 명씩 1팀/2팀에 넣음 · sides는 판이 끝나도 남아서 「다음 판 그대로」가 됨
// 각자 자기 참가/관전을 누름(key=puuid) · 방장은 남의 상태도 바꾸고 앱 없는 사람(key='g_'+이름)을 추가 · 방식·팀장은 방장만
// 사람 목록 = 지금 접속 중(presence) + 방장이 추가한 사람. 참가 표시는 그날만 유효(새벽 6시 기준).
// v0.1.16~: 접속 = 기본 참가(아무것도 안 눌러도 자리에 앉음) · 저장된 'spec'만 관전
let lobbyRaw = null, presenceRaw = null;
function lobbyView() {
  const L = lobbyRaw || {}, join = L.join || {}, today = dayKey(), now = Date.now();
  const stOf = k => { const j = join[k]; return j && j.day === today && (j.st === 'in' || j.st === 'spec') ? j.st : null; };
  const members = [];
  for (const [puuid, p] of Object.entries(presenceRaw || {})) {
    if (!p || !p.name || now - (p.at || 0) >= ONLINE_MS) continue;
    members.push({ key: puuid, name: normName(p.name), tag: p.tag || '', icon: p.icon || null, online: true, host: !!(hostRec && hostRec.puuid === puuid && hostAlive(hostRec)), me: !!(account && account.puuid === puuid), st: stOf(puuid) || 'in' });   // 접속하면 바로 자리에(고르는 중 없음) · 관전은 본인/방장이 바꿈
  }
  for (const [k, j] of Object.entries(join)) if (j && j.guest && j.day === today && !members.some(m => m.name === normName(j.name))) members.push({ key: k, name: normName(j.name), guest: true, online: false, st: stOf(k) });
  const ord = { in: 0, null: 1, spec: 2 };
  members.sort((a, b) => (ord[a.st] - ord[b.st]) || (b.online - a.online) || a.name.localeCompare(b.name, 'ko'));
  const caps = L.captains || {};
  const inNames = members.filter(m => m.st === 'in').map(m => m.name);
  const sd = L.sides || {}, sides = {};
  for (const n of inNames) { const t = sd[fbKeyOf(n)]; if (t === 'teamA' || t === 'teamB') sides[n] = t; }
  return { members, sides, mode: ['draft', 'manual'].includes(L.mode) ? L.mode : 'random', captains: { teamA: inNames.includes(caps.teamA) ? caps.teamA : null, teamB: inNames.includes(caps.teamB) ? caps.teamB : null },
    hostName: hostRec && hostAlive(hostRec) ? hostRec.name : null, hostStale: hostRec && !hostAlive(hostRec) ? hostRec.name : null, isHost: !!config.isHost };
}
function lobbyLocal(mut) {   // ⚡ 내 화면 먼저(서버 왕복 ~0.1~0.3초 안 기다림)
  lobbyRaw = JSON.parse(JSON.stringify(lobbyRaw || {}));
  mut(lobbyRaw);
  broadcast('lobby', lobbyView());
}
async function lobbyWrite(p) {   // 쓰기 실패하면 서버 값으로 되돌림
  const r = await p;
  if (!r || !r.ok) refreshLobby();
  return r;
}
function lobbyJoin(key, st, extra) {
  const k = String(key || '').replace(/[.#$\[\]\/]/g, '_');
  if (!k) return Promise.resolve({ ok: false, err: '잘못된 사람' });
  const val = st ? { ...(extra || {}), st, at: Date.now(), day: dayKey() } : null;
  lobbyLocal(L => { L.join = L.join || {}; if (val) L.join[k] = val; else delete L.join[k]; });
  return lobbyWrite(fbSet(`${T}/lobby/join/${k}`, val));
}
// ⚡ 대기실 스트림 → 바뀐 노드만 다시 읽음(세션·방장까지 4개 다 읽던 것 대신)
const refreshLobby = coalesce(async () => { const L = await fetchLobby(); if (L !== undefined) { lobbyRaw = L || null; broadcast('lobby', lobbyView()); } });
const refreshPresence = coalesce(async () => { const P = await fetchPresence(); if (P !== undefined) { presenceRaw = P || null; broadcast('lobby', lobbyView()); } });
async function lobbySetMine(st) {
  if (!account) return { ok: false, err: '롤에 로그인하면 참가할 수 있어요' };
  return lobbyJoin(account.puuid, st, { name: account.gameName });
}
async function lobbySetFor(key, st) {   // 👑 방장: 다른 사람 상태 바꾸기
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  const m = lobbyView().members.find(x => x.key === key);
  if (!m) return { ok: false, err: '목록에 없는 사람이에요' };
  return lobbyJoin(key, st, m.guest ? { name: m.name, guest: true } : { name: m.name });
}
async function lobbyAddGuest(name) {   // 👑 방장: 앱 없는 사람 추가(바로 참가)
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  const n = normName(String(name || '')).slice(0, 24);
  if (!n) return { ok: false, err: '이름을 적어주세요' };
  if (lobbyView().members.some(m => m.name === n)) return { ok: false, err: '이미 목록에 있어요' };
  return lobbyJoin('g_' + fbKeyOf(n), 'in', { name: n, guest: true });
}
async function lobbyRemoveGuest(key) {
  if (!config.isHost || !String(key).startsWith('g_')) return { ok: false };
  return lobbyJoin(key, null);
}
async function lobbySetMode(mode) {
  if (!config.isHost) return { ok: false, err: '방장만 방식을 정할 수 있어요' };
  const m = ['draft', 'manual'].includes(mode) ? mode : 'random';
  lobbyLocal(L => { L.mode = m; });
  return lobbyWrite(fbUpdate(`${T}/lobby`, { mode: m }));
}
async function lobbyCaptain(name, rand) {   // 🎯 팀장 지정/해제(누르면 빈 자리에, 다시 누르면 해제) · rand=무작위 2명
  if (!config.isHost) return { ok: false, err: '방장만 팀장을 정할 수 있어요' };
  const v = lobbyView(), inNames = v.members.filter(m => m.st === 'in').map(m => m.name);
  let { teamA, teamB } = v.captains;
  if (rand) { const sh = inNames.slice().sort(() => Math.random() - 0.5); teamA = sh[0] || null; teamB = sh[1] || null; }
  else {
    const n = normName(name || '');
    if (!inNames.includes(n)) return { ok: false, err: '참가자 중에서 골라주세요' };
    if (teamA === n) teamA = null; else if (teamB === n) teamB = null;
    else if (!teamA) teamA = n; else if (!teamB) teamB = n; else teamB = n;
  }
  const caps = (teamA || teamB) ? { teamA, teamB } : null;
  lobbyLocal(L => { L.captains = caps; });
  return lobbyWrite(fbSet(`${T}/lobby/captains`, caps));
}
// 🧩 직접 팀 짜기(v0.1.47) — 방장이 한 명씩 1팀/2팀/빼기(team=null) · 한 팀 5명까지
async function lobbySide(name, team) {
  if (!config.isHost) return { ok: false, err: '방장만 팀을 정할 수 있어요' };
  const n = normName(name || ''), v = lobbyView();
  if (!v.members.some(m => m.st === 'in' && m.name === n)) return { ok: false, err: '참가자 중에서 골라주세요' };
  const t = team === 'teamA' || team === 'teamB' ? team : null;
  if (t && v.sides[n] !== t && Object.values(v.sides).filter(x => x === t).length >= 5) return { ok: false, err: `${t === 'teamA' ? '1' : '2'}팀은 5명까지예요` };
  const k = fbKeyOf(n);
  lobbyLocal(L => { L.sides = L.sides || {}; if (t) L.sides[k] = t; else delete L.sides[k]; });
  return lobbyWrite(fbSet(`${T}/lobby/sides/${k}`, t));
}
async function lobbySidesPrev() {   // 지난 판 팀 그대로(지금 판 → 없으면 오늘 마지막 경기 기록)
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  let A = sessionData && sessionData.teamA, B = sessionData && sessionData.teamB;
  if (!(A && A.length && B && B.length)) {
    const ms = await getJson(`${FIREBASE_DB}/${T}/days/${dayKey()}/matches.json`);
    const last = Object.values(ms || {}).filter(m => m && m.teamA && m.teamB).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
    if (last) { A = last.teamA; B = last.teamB; }
  }
  if (!(A && A.length && B && B.length)) return { ok: false, err: '오늘 지난 판 팀이 없어요' };
  const sides = {}; for (const n of A) sides[fbKeyOf(n)] = 'teamA'; for (const n of B) sides[fbKeyOf(n)] = 'teamB';
  lobbyLocal(L => { L.sides = sides; L.mode = 'manual'; });
  return lobbyWrite(fbUpdate(`${T}/lobby`, { sides, mode: 'manual' }));
}
async function lobbySidesClear() {
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  lobbyLocal(L => { L.sides = null; });
  return lobbyWrite(fbSet(`${T}/lobby/sides`, null));
}
async function lobbyStart() {   // ▶ 방장: 참가자로 팀 짜기 시작(대기실에서 정한 방식)
  if (!config.isHost) return { ok: false, err: '방장만 시작할 수 있어요' };
  const [L, P] = await Promise.all([fetchLobby(), fetchPresence()]);
  lobbyRaw = L || null; presenceRaw = P || null;
  const v = lobbyView(), names = v.members.filter(m => m.st === 'in').map(m => m.name);
  if (names.length < 4) return { ok: false, err: `참가자가 4명 이상이어야 해요 (지금 ${names.length}명)` };
  if (v.mode === 'draft') {
    if (!v.captains.teamA || !v.captains.teamB) return { ok: false, err: '팀장 2명을 정해주세요' };
    return startDraft(names, [v.captains.teamA, v.captains.teamB]);
  }
  if (v.mode === 'manual') {
    const A = names.filter(n => v.sides[n] === 'teamA'), B = names.filter(n => v.sides[n] === 'teamB'), none = names.length - A.length - B.length;
    if (none) return { ok: false, err: `아직 팀을 안 정한 사람이 ${none}명 있어요` };
    if (!A.length || !B.length) return { ok: false, err: '두 팀에 한 명 이상씩 넣어주세요' };
    return writeTeams(A, B, [], 'manual');
  }
  return startTeamBuild(names, 'random');
}
async function lobbyReopen() {   // 👑 지금 판을 접고 대기실로(팀은 남겨둬서 「같은 팀으로 한 판 더」 가능)
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  if (!sessionData) return { ok: true };
  const r = await fbUpdate(`${T}/session`, { phase: 'lobby', pendingEog: null });
  pollSession();
  return r;
}

// 없을 때만 생성(조건부 PUT) — 같은 경기를 두 기기가 동시에 기록해도 한 번만 저장(412=이미 있음)
async function fbPutIfAbsent(pathStr, value) {
  const tok = await fbToken();
  if (!tok) return { ok: false, err: '인증 실패(네트워크 확인)' };
  const u = new URL(`${FIREBASE_DB}/${pathStr}.json?auth=${tok}`);
  const data = JSON.stringify(value);
  const status = await new Promise(resolve => {
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'if-match': 'null_etag' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', () => resolve(0));
    req.setTimeout(15000, () => { req.destroy(); resolve(0); });
    req.write(data); req.end();
  });
  if (status === 200) return { ok: true };
  if (status === 412) return { ok: false, conflict: true };
  if (status === 401 || status === 403) _fbTok = null;
  return { ok: false, err: `쓰기 실패(HTTP ${status})` };
}

// ── 🧩 세션 폴링 — 팀 배정·투표·결과를 오버레이/패널로 ──────────────────────
async function pollSession() {
  const [s, lob, h, pres, np] = await Promise.all([fetchSession(), fetchLobby(), fetchHost(), fetchPresence(), getJson(`${FIREBASE_DB}/${T}/normalLive.json`)]);
  normalLive = np || null;
  sessionData = s || null;
  lobbyRaw = lob || null; presenceRaw = pres || null;
  onHostRec(h);
  const formed = (s && s.teamsFormedAt) || 0;
  if (formed && formed !== lastFormed) {          // 새 팀 배정 → 오버레이 자동 표시
    const first = lastFormed === 0;
    lastFormed = formed;
    if (!first || (s.phase === 'teams' && Date.now() - formed < 30 * 60 * 1000)) { userHid = false; showOverlay(); }
  }
  if (s && s.phase === 'vote' && !inGame && !userHid && teamOf(s, config.myName)) showOverlay();   // 🗳️ 투표 = 참가자에게 자동 표시
  if (s && s.phase === 'draft' && !inGame && !userHid && (s.players || []).some(n => normName(n) === normName(config.myName))) showOverlay();   // 🎯 드래프트 = 참가자에게 자동 표시
  broadcast('lobby', lobbyView());
  broadcast('session', { session: sessionData, myName: config.myName || '' });
  if (_lastRect && !inGame && !_floating) updateSlotMarker(_lastRect);   // 📍 팀 상태 변경 → 마커 갱신
  recTick(s).catch(() => {});
  const P = s && s.potg;   // 🎬 팟지 = 모두 같은 시각에 가운데 창(늦게 켠 앱은 20초 지나면 건너뜀 · 결과 화면 「팟지 다시 보기」로 볼 수 있음)
  if (P && P.showAt && !P.none && !inGame && _potgSeen !== P.gameId && Date.now() - P.showAt < 20000) { _potgSeen = P.gameId; openPotg(P, false); }
  const NP = normalLive;   // 🎮 같이 한 일반 판 팟지 = 그 판에 있던 사람만
  if (NP && NP.showAt && NP.normal && !inGame && _potgSeen !== NP.gameId && Date.now() - NP.showAt < 20000 && (NP.normal.us || []).some(n => norm(n) === norm(config.myName))) { _potgSeen = NP.gameId; openPotg(NP, false); }
  if (config.isHost) runHost();
}

// ── 🎬 팟지 창 — 롤 클라 가운데(클라 없으면 화면 가운데) · 영상 재생이라 투명 창 아님 ─────────
let potgWin = null, _potgSeen = null, normalLive = null;
function potgBounds() {
  let cx, cy, cw, ch;
  if (_lastRect && !_floating) { const sf = screen.getPrimaryDisplay().scaleFactor || 1; cx = _lastRect[0] / sf; cy = _lastRect[1] / sf; cw = (_lastRect[2] - _lastRect[0]) / sf; ch = (_lastRect[3] - _lastRect[1]) / sf; }
  else { const wa = screen.getPrimaryDisplay().workArea; cx = wa.x; cy = wa.y; cw = wa.width; ch = wa.height; }
  const W = Math.round(Math.max(560, Math.min(960, cw * 0.66))), H = Math.round(Math.min(ch * 0.92, W * 9 / 16 + 136));
  return { x: Math.round(cx + (cw - W) / 2), y: Math.round(cy + (ch - H) / 2), width: W, height: H };
}
function openPotg(card, manual) {
  if (inGame || !card || card.none) return;
  const send = () => { try { potgWin.webContents.send('potg', { card, manual: !!manual }); } catch (_) {} };
  if (potgWin && !potgWin.isDestroyed()) { potgWin.setBounds(potgBounds()); send(); potgWin.showInactive(); return; }
  potgWin = new BrowserWindow(Object.assign(potgBounds(), {
    show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, roundedCorners: false, backgroundColor: '#060b10',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' },
  }));
  try { potgWin.setAlwaysOnTop(true, 'floating'); } catch (_) {}
  potgWin.webContents.on('did-finish-load', () => { send(); if (potgWin) potgWin.showInactive(); });
  potgWin.loadFile('potg/potg.html');
  potgWin.on('closed', () => { potgWin = null; });
}
function closePotg() { if (potgWin && !potgWin.isDestroyed()) { try { potgWin.destroy(); } catch (_) {} } potgWin = null; }

// ── 👑 방장 담당: EOG → 오늘 기록 저장 / 전원 투표 → 결과 확정 ─────────────────
let _hostBusy = false;
async function hostTick() {
  const s = sessionData;
  if (!s) return;
  if (s.phase === 'teams') {
    const eog = await fetchEog();
    if (!eog || !eog.gameId || !Array.isArray(eog.players)) return;
    if ((eog.savedAt || 0) < (s.teamsFormedAt || 0)) return;          // 이번 팀 결성 이전 경기
    if (String(eog.gameId) === String(s.lastGameId || '')) return;      // 이미 기록함
    if (s.pendingEog && String(s.pendingEog.gameId) === String(eog.gameId)) return;   // 승리팀 선택 대기 중
    const winner = matchWinner(s, eog);
    if (winner) await recordGame(winner, eog);
    else await fbUpdate(`${T}/session`, { pendingEog: { gameId: eog.gameId, winSide: eog.winSide || null, at: Date.now() } });   // 이름 매칭 실패 → 방장이 승리팀 직접 선택
    return;
  }
  if (s.phase === 'draft') {
    if (s.turnEndsAt && Date.now() > s.turnEndsAt + 1000) await draftPick(null, true);   // ⏱️ 시간 초과 → 남은 사람 중 무작위
    return;
  }
  if ((s.phase === 'vote' || s.phase === 'result') && s.game && (!s.potg || s.potg.gameId !== String(s.game.id))) hostPotg(s).catch(() => {});   // 🎬
  if (s.potg && s.potg.pending && !replayBusy && Date.now() - (s.potg.pendingAt || 0) > (s.potg.hero ? 340000 : 260000)) {   // 🎬 녹화하던 방장 앱이 꺼졌거나 넘겨받음 → 카드로라도 보여줌
    const c = Object.assign({}, s.potg, { pending: null, pendingAt: null, showAt: Date.now() + 1500 });
    await fbUpdate(`${T}/session`, { potg: c }); if (s.game) await fbUpdate(`${T}/days/${s.game.day}/matches/${s.game.id}`, { potg: c });
  }
  if (s.phase === 'vote' && s.game) {
    const voters = [...(s.teamA || []), ...(s.teamB || [])];
    const votes = s.votes || {};
    if (voters.length && voters.every(n => votes[fbKeyOf(n)])) await closeVote();   // 전원 투표 → 자동 확정
  }
}
// 🎬 팟지 고르기(방장) — 모든 PC의 수집이 모이면(최대 25초 기다림) 점수 1위 장면 → session.potg(showAt=모두 같이 시작할 시각)
let _potgBusy = false, _potgFor = null;
async function hostPotg(s) {
  if (!potg || _potgBusy || _potgFor === String(s.game.id) || String(s.game.id).startsWith('m')) return;   // 수동 기록 판은 게임 번호가 없어 수집과 못 이음
  _potgBusy = true;
  try {
    const raws = await potg.readRaws(s.game.id);
    const n = raws ? Object.keys(raws).length : 0, age = Date.now() - (s.game.at || 0);
    const expect = (s.teamA || []).length + (s.teamB || []).length;
    if ((n === 0 && age < 60000) || (n > 0 && n < expect && age < 25000)) return;   // 다른 PC 수집 기다림
    _potgFor = String(s.game.id);
    const rec = await getJson(`${FIREBASE_DB}/${T}/days/${s.game.day}/matches/${s.game.id}.json`);
    const card = n ? potg.pickPotg(raws, s, rec && rec.stats) : null;
    if (!card) { await fbUpdate(`${T}/session`, { potg: { none: true, gameId: String(s.game.id) } }); return; }
    card.gameId = String(s.game.id);
    try { card.splash = await potg.splashFor(card.championId, card.skin); } catch (_) {}   // 🖼️ 소개 배경 = 그 사람이 낀 스킨 일러스트
    try {   // 🛡️ 숨은 영웅(v0.1.44) — 팟지 주인공 말고, 킬 아닌 장면(광역 이니시·버티기·세이브·한타 설계) 하나 더
      const hero = potg.pickHero(raws, s, rec && rec.stats, card.name);
      if (hero) { try { hero.splash = await potg.splashFor(hero.championId, hero.skin); } catch (_) {} card.hero = hero; }
    } catch (e) { console.log('[potg] 숨은 영웅 고르기 오류', e && e.message); }
    const publish = async () => {   // 모두에게 보여주기(showAt = 다 같이 시작할 시각)
      card.pending = null; card.pendingAt = null; card.showAt = Date.now() + 1500;
      await fbUpdate(`${T}/days/${s.game.day}/matches/${s.game.id}`, { potg: card });
      const cur = sessionData && sessionData.game;   // 녹화하는 사이 다음 판이 기록됐으면 지금 판 팟지를 덮지 않음(경기 기록에만 남김)
      if (!cur || String(cur.id) === card.gameId) await fbUpdate(`${T}/session`, { potg: card });
    };
    if (!app.isPackaged && process.env.TN_FAKE_CLIP) {   // 🧪 개발용: 리플레이 녹화 대신 이 파일을 영상으로 올림
      try { card.clip = await potg.uploadClip(s.game.id, fs.readFileSync(process.env.TN_FAKE_CLIP), /\.mp4$/i.test(process.env.TN_FAKE_CLIP) ? 'video/mp4' : 'video/webm'); } catch (_) {}
      if (card.hero && process.env.TN_FAKE_CLIP2) try { card.hero.clip = await potg.uploadClip(s.game.id + 'h', fs.readFileSync(process.env.TN_FAKE_CLIP2), /\.mp4$/i.test(process.env.TN_FAKE_CLIP2) ? 'video/mp4' : 'video/webm'); } catch (_) {}
      return publish();
    }
    if (!replayRec || process.platform !== 'win32') return publish();
    // 🎬 리플레이 녹화(방장 PC) — 그동안은 「준비 중」(showAt 없음 → 아무 창도 안 뜸) · 3분 넘거나 실패하면 카드로
    await fbUpdate(`${T}/session`, { potg: Object.assign({}, card, { pending: true, pendingAt: Date.now() }) });
    recordPotgClip(card, { id: s.game.id, path: `${T}/days/${s.game.day}/matches/${s.game.id}` }).then(([clip, hclip]) => { if (clip) card.clip = clip; if (hclip && card.hero) card.hero.clip = hclip; }).catch(() => {}).finally(() => publish().catch(() => {}));
  } finally { _potgBusy = false; }
}
// ── 🎮 같이 한 일반 판(v0.1.48) — 내전이 아닌 일반 게임(칼바람 등)에 앱 켠 친구가 2명+ 같은 팀이면 ──────────────
//   기록 = today/days/{day}/normals/{gameId}(내전 순위와 따로 · 조건부 PUT으로 1번만) · 저장에 성공한 앱이 팟지·숨은 영웅을 맡음(우리 팀만 주인공 후보)
//   보기 = today/normalLive(가장 최근 일반 판 팟지 카드) → 그 판에 있던 사람 앱만 가운데 창을 띄움 · 「오늘」 탭에서 다시 보기
const NORMAL_MIN = 2;
const QUEUE_NAME = { 400: '일반', 430: '일반', 490: '빠른 대전', 420: '솔로 랭크', 440: '자유 랭크', 450: '칼바람', 2400: '칼바람 대혼란', 900: 'URF', 1900: 'URF', 1700: '아레나', 1710: '아레나' };
const MODE_NAME = { ARAM: '칼바람', CLASSIC: '소환사의 협곡', CHERRY: '아레나', URF: 'URF', KIWI: '칼바람 대혼란' };
const queueName = (id, mode) => QUEUE_NAME[id] || MODE_NAME[String(mode || '').toUpperCase()] || '일반 게임';
const _normDone = new Set();
async function recordNormal(e) {
  if (!e || !e.gameId || !Array.isArray(e.players) || _normDone.has(String(e.gameId))) return;
  _normDone.add(String(e.gameId));
  const acc = (await fetchAccounts()) || {};
  const byTeam = {};
  for (const p of e.players) if (p.puuid && acc[p.puuid] && p.summonerName) (byTeam[p.teamId] = byTeam[p.teamId] || []).push(p);
  const side = Object.keys(byTeam).sort((a, b) => byTeam[b].length - byTeam[a].length)[0];
  const us = side ? byTeam[side] : [];
  if (us.length < NORMAL_MIN) { console.log(`[normal] 앱 켠 친구 ${us.length}명 — 같이 한 판 아님`); return; }
  const gid = String(e.gameId), day = dayKey(), win = us[0].isWin != null ? !!us[0].isWin : (e.winSide === 'blue') === (Number(side) === 100);
  const ids = {}; for (const p of us) ids[fbKeyOf(p.summonerName)] = p.puuid;
  const rec = { gameId: gid, day, ts: Date.now(), source: e.source || 'eog', queueId: e.queueId == null ? null : e.queueId, gameMode: e.gameMode || null, queue: queueName(e.queueId, e.gameMode),
    side: Number(side), win, us: us.map(p => p.summonerName), ids, gameTime: e.gameTime || 0, stats: e.players, by: config.myName || '' };
  const w = await fbPutIfAbsent(`${T}/days/${day}/normals/${gid}`, rec);
  if (w.ok) { console.log(`[normal] 같이 한 판 저장 ${rec.queue} ${win ? '승' : '패'} · ${rec.us.join(', ')}`); _profIdx = null; }
  else console.log('[normal] ' + (w.conflict ? '다른 친구 앱이 먼저 저장' : w.err));
  // 🎬 팟지 담당 = 내전처럼 **방장 PC**(그 판에 방장이 있으면) · 방장이 그 판에 없거나 방장이 없으면 기록을 먼저 저장한 앱
  const hostIn = !!(hostRec && hostAlive(hostRec) && Object.values(ids).includes(hostRec.puuid));
  const mine = hostIn ? !!(config.isHost && account && hostRec.puuid === account.puuid) : w.ok;
  if (!mine) return;
  let use = rec;
  if (!w.ok) { const cur = await getJson(`${FIREBASE_DB}/${T}/days/${day}/normals/${gid}.json`); if (!cur || !Array.isArray(cur.us)) return; if (cur.potg) return; use = cur; }   // 다른 앱이 저장한 기록으로(같은 판)
  console.log(`[normal] 팟지 담당 = 이 앱(${hostIn ? '방장' : '먼저 저장'})`);
  normalPotg(use).catch(err => console.log('[normal] 팟지 오류', err && err.message));
}
async function normalPotg(rec) {
  if (!potg) return;
  const path = `${T}/days/${rec.day}/normals/${rec.gameId}`, t0 = Date.now();
  let raws = null, n = 0;
  for (;;) {   // 우리 팀 각자 수집이 다 모일 때까지(최대 25초 · 하나도 없으면 60초)
    raws = await potg.readRaws(rec.gameId); n = raws ? Object.keys(raws).length : 0;
    const age = Date.now() - t0;
    if (n >= rec.us.length || (n > 0 && age > 25000) || age > 60000) break;
    await new Promise(r => setTimeout(r, 4000));
  }
  const s = { teamA: rec.us, teamB: [] }, opt = { only: rec.us };
  const card = n ? potg.pickPotg(raws, s, rec.stats, opt) : null;
  if (!card) { await fbUpdate(path, { potg: { none: true, gameId: rec.gameId } }); return; }
  card.gameId = rec.gameId; card.normal = { queue: rec.queue, win: rec.win, us: rec.us, day: rec.day };
  try { card.splash = await potg.splashFor(card.championId, card.skin); } catch (_) {}
  try {
    const hero = potg.pickHero(raws, s, rec.stats, card.name, opt);
    if (hero) { hero.normal = card.normal; try { hero.splash = await potg.splashFor(hero.championId, hero.skin); } catch (_) {} card.hero = hero; }
  } catch (err) { console.log('[normal] 숨은 영웅 고르기 오류', err && err.message); }
  const publish = async () => {
    card.pending = null; card.pendingAt = null; card.showAt = Date.now() + 1500;
    await fbUpdate(path, { potg: card });
    await fbSet(`${T}/normalLive`, card);
  };
  if (!app.isPackaged && process.env.TN_FAKE_CLIP) {
    try { card.clip = await potg.uploadClip(rec.gameId, fs.readFileSync(process.env.TN_FAKE_CLIP), /\.mp4$/i.test(process.env.TN_FAKE_CLIP) ? 'video/mp4' : 'video/webm'); } catch (_) {}
    return publish();
  }
  if (!replayRec || process.platform !== 'win32' || replayBusy) return publish();
  const [clip, hclip] = await recordPotgClip(card, { id: rec.gameId, path }).catch(() => [null, null]);
  if (clip) card.clip = clip; if (hclip && card.hero) card.hero.clip = hclip;
  await publish();
}
function normalFun(m) {   // 🎉 우리 팀 안 재미 지표 한 줄(캐리·버스·최다 데스·탱커·힐러·멀티킬)
  const us = (m.stats || []).filter(p => (m.us || []).some(n => norm(n) === norm(p.summonerName)));
  if (us.length < 2) return [];
  const all = (m.stats || []).slice().sort((a, b) => (b.damage || 0) - (a.damage || 0));
  const top = (f, min) => { const xs = us.filter(p => f(p) > (min || 0)).sort((a, b) => f(b) - f(a)); return xs[0] && (!xs[1] || f(xs[0]) > f(xs[1])) ? xs[0] : null; };
  const out = [], nm = p => p.summonerName;
  const carry = top(p => p.damage || 0);
  if (carry) out.push({ k: 'carry', label: '캐리', name: nm(carry), champId: carry.championId, v: `딜 ${Math.round(carry.damage).toLocaleString('en-US')}${all.indexOf(carry) === 0 ? ' · 전체 1위' : ''}` });
  const multi = us.map(p => ({ p, n: p.pentaKills ? 5 : p.quadraKills ? 4 : p.tripleKills ? 3 : 0 })).filter(x => x.n).sort((a, b) => b.n - a.n)[0];
  if (multi) out.push({ k: 'multi', label: ({ 3: '트리플킬', 4: '쿼드라킬', 5: '펜타킬' })[multi.n], name: nm(multi.p), champId: multi.p.championId, v: '' });
  const tank = top(p => (p.taken || 0) + (p.mitig || 0));
  if (tank && tank !== carry) out.push({ k: 'tank', label: '탱커', name: nm(tank), champId: tank.championId, v: `받은 피해 ${Math.round((tank.taken || 0) + (tank.mitig || 0)).toLocaleString('en-US')}` });
  const heal = top(p => (p.healMates || 0) + (p.shieldMates || 0), 2000);
  if (heal) out.push({ k: 'heal', label: '힐러', name: nm(heal), champId: heal.championId, v: `힐·보호막 ${Math.round((heal.healMates || 0) + (heal.shieldMates || 0)).toLocaleString('en-US')}` });
  const bus = us.slice().sort((a, b) => (a.damage || 0) - (b.damage || 0))[0];
  if (m.win && bus && bus !== carry && bus !== tank && bus !== heal) out.push({ k: 'bus', label: '버스 탑승', name: nm(bus), champId: bus.championId, v: `딜 ${Math.round(bus.damage || 0).toLocaleString('en-US')}` });
  const dead = top(p => p.deaths || 0, 4);
  if (dead) out.push({ k: 'dead', label: '최다 데스', name: nm(dead), champId: dead.championId, v: `${dead.deaths}데스` });
  return out;
}
const CLIP_MAX = 12 * 1048576;   // 이보다 크면 안 올림(서버 용량·팀원 내려받기) → 카드
let _recLog = [];   // 🎬 녹화 기록(경기 기록 potgRec에 남김 → tools/potg-report.cjs로 어디서 멈췄는지 확인)
async function recordPotgClip(card, g) {   // g = { id: 게임 번호, path: 녹화 기록 남길 경기 기록 경로 } → [팟지 영상 meta, 숨은 영웅 영상 meta] (실패한 쪽은 null)
  replayBusy = true; _recLog = [];
  const H = card.hero;   // v0.1.44: 숨은 영웅이 있으면 리플레이 한 번 열어 두 장면을 이어서 녹화
  const parts = [{ from: card.clipFrom, to: card.clipTo, focus: card.name, champ: card.champ }].concat(H ? [{ from: H.clipFrom, to: H.clipTo, focus: H.name, champ: H.champ }] : []);
  const t0 = Date.now(), recP = replayRec.record({ gameId: g.id, parts });
  recP.catch(() => {}).finally(() => setTimeout(() => { replayBusy = false; }, 6000));   // 리플레이가 실제로 끝나고(닫히고) 조금 더 지나야 풀림(시간 초과로 먼저 카드를 보여줘도)
  const metas = [null, null], whys = [], LIMIT = H ? 260000 : 180000;
  try {
    const files = await Promise.race([recP, new Promise(r => setTimeout(() => r(null), LIMIT))]);
    if (!files) whys.push(Date.now() - t0 >= LIMIT - 1000 ? `${LIMIT / 60000}분 초과` : '녹화 안 됨');
    for (let i = 0; files && i < parts.length; i++) {
      const file = files[i], tag = i ? '숨은 영웅' : '팟지';
      if (!file) { whys.push(tag + ' 녹화 안 됨'); continue; }
      let buf = fs.readFileSync(file);
      const small = await shrinkClip(file).catch(e => { _recLog.push(tag + ' 줄이기 실패 ' + (e && e.message)); return null; });   // 롤이 모니터 크기(예: 3440×1440)로 저장 → 가운데 16:9를 1.15배로 잘라 1280×720
      if (small && small.length > 100000 && small.length < buf.length) { _recLog.push(`${tag} 줄임 ${(buf.length / 1048576).toFixed(1)}→${(small.length / 1048576).toFixed(1)}MB`); buf = small; }
      if (buf.length > CLIP_MAX) whys.push(`${tag} 너무 큼 ${(buf.length / 1048576).toFixed(1)}MB`);
      else { metas[i] = await potg.uploadClip(i ? g.id + 'h' : g.id, buf, 'video/webm'); if (!metas[i]) whys.push(tag + ' 올리기 실패'); }
      try { fs.unlinkSync(file); } catch (_) {}
    }
  } catch (e) { whys.push('오류 ' + (e && e.message)); }
  const sec = Math.round((Date.now() - t0) / 1000), mb = m => m ? +(m.size / 1048576).toFixed(1) : null;
  fbUpdate(g.path, { potgRec: { ok: !!metas[0], hero: H ? !!metas[1] : null, why: whys.join(' · ') || null, sec, mb: mb(metas[0]), mbHero: mb(metas[1]), lines: _recLog.slice(-40), at: Date.now() } }).catch(() => {});
  return metas;
}
// 🎬 녹화 영상 줄이기(v0.1.34~35) — 숨은 창에서 다시 재생하며 가운데 16:9를 1.15배로 잘라 1280×720·3.5Mbps로 다시 녹화(소리 포함) · 영상 길이만큼 걸림
async function shrinkClip(file) {
  const w = new BrowserWindow({ show: false, width: 320, height: 200, skipTaskbar: true, webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', contextIsolation: true } });
  try {
    await w.loadFile('potg/shrink.html');
    const r = await Promise.race([w.webContents.executeJavaScript(`shrink(${JSON.stringify(pathToFileURL(file).href)}, 1280, 3500, 1.15)`), new Promise((_, no) => setTimeout(() => no(new Error('시간 초과')), 90000))]);
    return r && r.b64 ? Buffer.from(r.b64, 'base64') : null;
  } finally { try { w.destroy(); } catch (_) {} }
}
// 🎬 리플레이 창 숨기기(v0.1.37) — 리플레이 게임 창(League of Legends.exe)이 뜨면 0.1초마다 확인해 화면 밖(-4000,-4000)으로 옮기고
//    작업 표시줄에서 빼고(도구 창), 포커스를 가져갔으면 원래 창(롤 클라 등)에 돌려줌 · show() = 숨기기 멈추고 화면 안으로(화면 밖에서 롤이 멈출 때 대비)
const HIDE_PS = String.raw`
Add-Type @'
using System; using System.Runtime.InteropServices;
public class TNW {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  public struct RECT { public int L, T, R, B; }
}
'@
$mode = $args[0]; $prev = [TNW]::GetForegroundWindow(); $end = (Get-Date).AddSeconds([int]$args[1]); $n = 0
while ((Get-Date) -lt $end) {
  foreach ($p in Get-Process -Name 'League of Legends' -ErrorAction SilentlyContinue) {
    $h = $p.MainWindowHandle; if ($h -eq [IntPtr]::Zero) { continue }
    $r = New-Object TNW+RECT; [void][TNW]::GetWindowRect($h, [ref]$r)
    if ($mode -eq 'show') { [void][TNW]::SetWindowPos($h, [IntPtr]::Zero, 80, 80, 0, 0, 0x15); Write-Output 'shown'; exit }
    if ($r.L -gt -3000) {
      $ex = [TNW]::GetWindowLong($h, -20); [void][TNW]::SetWindowLong($h, -20, (($ex -bor 0x80) -band (-bnot 0x40000)))
      [void][TNW]::SetWindowPos($h, [IntPtr]::Zero, -4000, -4000, 0, 0, 0x15); $n++; Write-Output "moved $n"
      if ($prev -ne [IntPtr]::Zero -and [TNW]::GetForegroundWindow() -eq $h) { [void][TNW]::SetForegroundWindow($prev) }
    }
  }
  Start-Sleep -Milliseconds 100
}`;
function hideReplayWindow() {
  const { spawn } = require('child_process');
  const run = (mode, sec) => spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(`& {${HIDE_PS}} ${mode} ${sec}`, 'utf16le').toString('base64')], { windowsHide: true });   // 여러 줄 스크립트는 인코딩해서 넘김
  let moved = 0, ps = run('hide', 300);
  ps.stdout.on('data', b => { const m = String(b).match(/moved (\d+)/g); if (m) moved = +m[m.length - 1].split(' ')[1]; });
  ps.on('error', () => {});
  const stop = () => { try { ps.kill(); } catch (_) {} return moved; };
  return { stop, show: () => { stop(); try { run('show', 10).on('error', () => {}); } catch (_) {} } };
}
const runHost = coalesce(async () => { if (_hostBusy) return; _hostBusy = true; try { await hostTick(); } finally { _hostBusy = false; } });

// EOG 승리 진영 → 1팀/2팀 판정(인게임 이름 ↔ 등록 이름 매칭). 애매하면 null(방장이 직접 선택)
function matchWinner(s, eog) {
  const winNames = new Set(eog.players.filter(p => p.isWin).map(p => norm(p.summonerName)));
  const loseNames = new Set(eog.players.filter(p => !p.isWin).map(p => norm(p.summonerName)));
  const winIds = new Set(eog.players.filter(p => p.isWin && p.puuid).map(p => p.puuid));
  const loseIds = new Set(eog.players.filter(p => !p.isWin && p.puuid).map(p => p.puuid));
  const ids = s.ids || {};
  const side = n => {   // 👤 계정 ID로 먼저, 없으면 이름으로
    const id = ids[fbKeyOf(n)];
    if (id && (winIds.has(id) || loseIds.has(id))) return winIds.has(id) ? 1 : -1;
    return winNames.has(norm(n)) ? 1 : loseNames.has(norm(n)) ? -1 : 0;
  };
  const score = team => (s[team] || []).reduce((acc, n) => acc + side(n), 0);
  const a = score('teamA'), b = score('teamB');
  if (a > 0 && a > b) return 'teamA';
  if (b > 0 && b > a) return 'teamB';
  return null;
}

// 경기 기록 저장(오늘 날짜) → 투표 단계로. eog 없으면 수동 기록.
async function recordGame(winner, eog) {
  const s = sessionData;
  if (!s || !s.teamA || !s.teamB) return { ok: false, err: '진행 중인 팀이 없어요' };
  if (winner !== 'teamA' && winner !== 'teamB') return { ok: false, err: '승리팀을 골라주세요' };
  const gid = String((eog && eog.gameId) || ('m' + Date.now()));
  const day = dayKey(s.teamsFormedAt);
  const rec = {
    gameId: gid, ts: Date.now(), day, source: eog ? 'auto' : 'manual', by: config.myName || null,
    teamA: s.teamA, teamB: s.teamB, spectators: s.spectators || null, mode: s.mode || null,
    winner, winSide: (eog && eog.winSide) || null, gameTime: (eog && eog.gameTime) || 0,
    stats: (eog && eog.players) || null, teamsFormedAt: s.teamsFormedAt || null,
    ids: s.ids || null,   // 👤 이름→puuid(프로필이 닉변해도 같은 사람으로 묶음)
  };
  const w = await fbPutIfAbsent(`${T}/days/${day}/matches/${gid}`, rec);
  _profIdx = null;
  if (!w.ok && !w.conflict) return { ok: false, err: w.err };
  const u = await fbUpdate(`${T}/session`, { phase: 'vote', game: { id: gid, day, winner, at: Date.now() }, votes: null, result: null, lastGameId: gid, pendingEog: null, potg: null });
  return { ok: u.ok, err: u.err };
}

// 투표 집계 → 결과 확정(MVP=이긴 팀 중 진 팀이 뽑은 1위 · SVP=진 팀 중 이긴 팀이 뽑은 1위 · 매너왕=전체 매너표 1위)
function tally(list, statsByName) {
  const c = {};
  for (const n of list) if (n) c[normName(n)] = (c[normName(n)] || 0) + 1;
  const keys = Object.keys(c);
  if (!keys.length) return null;
  const kda = n => { const st = statsByName[norm(n)]; return st ? (st.kills + st.assists) / Math.max(1, st.deaths) : 0; };
  keys.sort((x, y) => c[y] - c[x] || kda(y) - kda(x) || x.localeCompare(y, 'ko'));   // 동표 = KDA 높은 쪽
  return keys[0];
}
async function closeVote() {
  const s = await fetchSession();   // 최신으로 다시 읽고 확정(중복 확정 방지)
  if (!s || s.phase !== 'vote' || !s.game) return { ok: false, err: '투표 중이 아니에요' };
  const votes = s.votes || {};
  const win = s.game.winner, lose = win === 'teamA' ? 'teamB' : 'teamA';
  const inTeam = (team, name) => (s[team] || []).some(x => normName(x) === normName(name));
  const byTeam = team => (s[team] || []).map(n => votes[fbKeyOf(n)]).filter(Boolean);
  let statsByName = {};
  try {
    const rec = await getJson(`${FIREBASE_DB}/${T}/days/${s.game.day}/matches/${s.game.id}.json`);
    for (const p of (rec && rec.stats) || []) statsByName[norm(p.summonerName)] = p;
  } catch (_) {}
  const mvp = tally(byTeam(lose).map(v => v.mvp).filter(n => inTeam(win, n)), statsByName);
  const svp = tally(byTeam(win).map(v => v.mvp).filter(n => inTeam(lose, n)), statsByName);
  const manner = tally([...byTeam('teamA'), ...byTeam('teamB')].map(v => v.manner), statsByName);
  const result = { mvp: mvp || null, svp: svp || null, manner: manner || null, voteCount: Object.keys(votes).length, closedAt: Date.now() };
  _profIdx = null;
  await fbUpdate(`${T}/days/${s.game.day}/matches/${s.game.id}`, { mvp: result.mvp, svp: result.svp, manner: result.manner, votes: s.votes || null });
  const u = await fbUpdate(`${T}/session`, { phase: 'result', result });
  return { ok: u.ok, err: u.err };
}

// ── ⚔️ 팀 짜기(방장) — 바로 확정(아이템 시간 없음) ───────────────────────────
let _tbBusy = false;
function sendTb(payload) { if (leftWin && !leftWin.isDestroyed()) leftWin.webContents.send('teambuild', payload); }
async function startTeamBuild(names, mode) {
  if (!config.isHost) return { ok: false, err: '방장만 팀을 짤 수 있어요' };
  if (_tbBusy) return { ok: false, err: '팀을 짜는 중이에요' };
  names = [...new Set((names || []).map(n => normName(String(n))).filter(Boolean))];
  if (names.length < 4) return { ok: false, err: `최소 4명이 필요해요 (현재 ${names.length}명)` };
  _tbBusy = true;
  sendTb({ state: 'building' });
  try {
    // ⚠️ 밸런스 모드는 새 로직 설계 전까지 비활성 — 지금은 랜덤만(사이트 승률 데이터도 더 이상 안 읽음)
    const prev = await fetchSession();
    const r = buildTeams({
      names, mode: 'random', matches: {}, season: 0,
      prevTeamA: (prev && prev.teamA) || [], prevTeamB: (prev && prev.teamB) || [],
      spectatorExclude: [],
    });
    const res = await writeTeams(r.teamA, r.teamB, r.spectators, 'random');
    if (!res.ok) { sendTb({ state: 'error', err: '팀 저장 실패 — ' + res.err }); return res; }
    sendTb({ state: 'done', teamA: r.teamA, teamB: r.teamB, spectators: r.spectators });
    return { ok: true };
  } catch (e) {
    const err = String((e && e.message) || e);
    sendTb({ state: 'error', err });
    return { ok: false, err };
  } finally { _tbBusy = false; }
}
// ── 🎯 드래프트 픽 — 팀장 2명이 번갈아 팀원을 고름(스네이크 A,B,B,A,A…·차례당 30초·시간 초과=무작위) ──
const DRAFT_TURN_MS = 30000;
// ETag 조건부 갱신(읽고→바꾸고→그 사이 아무도 안 바꿨을 때만 저장) — 팀장 픽과 방장 자동 픽이 동시에 들어와도 한 번만 반영
async function fbCas(pathStr, mutate, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const tok = await fbToken();
    if (!tok) return { ok: false, err: '인증 실패(네트워크 확인)' };
    const url = new URL(`${FIREBASE_DB}/${pathStr}.json?auth=${tok}`);
    const cur = await new Promise(resolve => {
      const req = https.get({ hostname: url.hostname, path: url.pathname + url.search, headers: { 'X-Firebase-ETag': 'true' } }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (_) {} resolve({ status: res.statusCode, etag: res.headers.etag, data: j }); });
      });
      req.on('error', () => resolve({ status: 0 }));
      req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0 }); });
    });
    if (cur.status !== 200 || !cur.etag) return { ok: false, err: `읽기 실패(HTTP ${cur.status})` };
    const m = mutate(cur.data);
    if (!m || m.err) return { ok: false, err: (m && m.err) || '변경 없음' };
    const body = JSON.stringify(m.value);
    const status = await new Promise(resolve => {
      const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'if-match': cur.etag } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', () => resolve(0));
      req.setTimeout(15000, () => { req.destroy(); resolve(0); });
      req.write(body); req.end();
    });
    if (status === 200) return { ok: true, value: m.value, info: m.info };
    if (status !== 412) { if (status === 401 || status === 403) _fbTok = null; return { ok: false, err: `쓰기 실패(HTTP ${status})` }; }
    // 412 = 그 사이 다른 기기가 바꿈 → 최신으로 다시 시도
  }
  return { ok: false, err: '다른 기기와 동시에 바뀌어서 실패했어요 — 다시 눌러주세요' };
}
const COIN_MS = 6000;   // 🪙 선픽 동전 연출 길이(overlay.js COIN_MS와 같게)
function draftOrder(first, picks) {   // 스네이크: first, other, other, first, first, other…
  const other = first === 'teamA' ? 'teamB' : 'teamA', out = [];
  for (let i = 0; i < picks; i++) out.push(((i + 1) >> 1) % 2 === 0 ? first : other);
  return out;
}
async function startDraft(names, captains) {
  if (!config.isHost) return { ok: false, err: '방장만 드래프트를 시작할 수 있어요' };
  names = [...new Set((names || []).map(n => normName(String(n))).filter(Boolean))];
  if (names.length < 4) return { ok: false, err: `최소 4명이 필요해요 (현재 ${names.length}명)` };
  let caps = [...new Set((captains || []).map(n => normName(String(n))).filter(n => names.includes(n)))];
  if (caps.length !== 2) caps = names.slice().sort(() => Math.random() - 0.5).slice(0, 2);   // 팀장 미지정 → 무작위 2명
  const first = Math.random() < 0.5 ? 'teamA' : 'teamB';   // 🪙 선픽 = 동전 던지기
  const teamSize = Math.min(5, Math.floor(names.length / 2));
  const now = Date.now(), ids = await teamIds(names);
  const w = await fbSet(`${T}/session`, {
    phase: 'draft', ids, active: true, mode: 'draft', by: config.myName || null, day: dayKey(now),
    players: names, captains: { teamA: caps[0], teamB: caps[1] }, teamA: [caps[0]], teamB: [caps[1]],
    pool: names.filter(n => !caps.includes(n)), order: draftOrder(first, (teamSize - 1) * 2), pickIdx: 0,
    teamSize, firstPick: first, draftStartedAt: now, turnEndsAt: now + COIN_MS + DRAFT_TURN_MS,   // 첫 차례 = 동전 연출이 끝난 뒤부터 30초
  });
  if (w.ok) fbSet(`${T}/lobby/captains`, null).catch(() => {});
  return w;
}
// 한 명 뽑기 — name=null+auto=true면 무작위(시간 초과). 내 차례 팀장 또는 방장만.
async function draftPick(name, auto) {
  const me = normName(config.myName || '');
  const r = await fbCas(`${T}/session`, s => {
    if (!s || s.phase !== 'draft') return { err: '드래프트 중이 아니에요' };
    const team = (s.order || [])[s.pickIdx || 0];
    if (!team) return { err: '이미 끝났어요' };
    if (auto) { if (!(s.turnEndsAt && Date.now() > s.turnEndsAt)) return { err: '아직 시간이 남았어요' }; }
    else if (!s.pickIdx && Date.now() < (s.draftStartedAt || 0) + COIN_MS) return { err: '동전 던지는 중이에요 — 잠깐만요' };
    else if (!config.isHost && normName((s.captains || {})[team] || '') !== me) return { err: '지금은 내 차례가 아니에요' };
    const pool = s.pool || [];
    const idx = auto ? Math.floor(Math.random() * pool.length) : pool.findIndex(x => normName(x) === normName(name || ''));
    if (idx < 0 || !pool.length) return { err: '이미 뽑혔거나 없는 사람이에요' };
    const picked = pool[idx], now = Date.now();
    const next = Object.assign({}, s, { pool: pool.filter((_, i) => i !== idx), [team]: [...(s[team] || []), picked], pickIdx: (s.pickIdx || 0) + 1,
      lastPick: { name: picked, team, at: now, auto: !!auto, byHost: !auto && config.isHost && normName((s.captains || {})[team] || '') !== me } });
    if (next.pickIdx >= next.order.length || !next.pool.length) {   // 🏁 다 뽑음 → 팀 확정(남은 사람=관전)
      Object.assign(next, { phase: 'teams', teamsFormedAt: now, spectators: next.pool.length ? next.pool : null, teamSize: Math.max(next.teamA.length, next.teamB.length),
        pool: null, order: null, pickIdx: null, turnEndsAt: null });
    } else next.turnEndsAt = now + DRAFT_TURN_MS;
    return { value: next };
  });
  return r.ok ? { ok: true } : r;
}

async function writeTeams(teamA, teamB, spectators, mode) {
  const now = Date.now();
  const ids = await teamIds([...teamA, ...teamB]);
  const w = await fbSet(`${T}/session`, {
    phase: 'teams', active: true, teamA, teamB, ids,
    spectators: (spectators && spectators.length) ? spectators : null,
    teamSize: Math.max(teamA.length, teamB.length), mode: mode || 'balance',
    teamsFormedAt: now, day: dayKey(now), by: config.myName || null,
  });
  if (w.ok) fbSet(`${T}/lobby/captains`, null).catch(() => {});
  return w;
}

// ── 📊 오늘 기록·순위 ─────────────────────────────────────────────────────
function computeToday(matchesObj) {
  const list = Object.values(matchesObj || {}).filter(m => m && m.teamA && m.teamB).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const P = {};
  const get = n => (P[normName(n)] = P[normName(n)] || { name: normName(n), games: 0, wins: 0, losses: 0, mvp: 0, svp: 0, manner: 0, k: 0, d: 0, a: 0, streak: 0, best: 0 });
  for (const m of list.slice().reverse()) {   // 시간순으로 돌며 연승 계산
    const stats = {}; for (const p of (m.stats || [])) stats[norm(p.summonerName)] = p;
    for (const team of ['teamA', 'teamB']) for (const n of m[team]) {
      const p = get(n), won = m.winner === team;
      p.games++; if (won) { p.wins++; p.streak = Math.max(0, p.streak) + 1; } else { p.losses++; p.streak = Math.min(0, p.streak) - 1; }
      p.best = Math.max(p.best, p.streak);
      const st = stats[norm(n)]; if (st) { p.k += st.kills || 0; p.d += st.deaths || 0; p.a += st.assists || 0; }
    }
    if (m.mvp) get(m.mvp).mvp++;
    if (m.svp) get(m.svp).svp++;
    if (m.manner) get(m.manner).manner++;
  }
  const standings = Object.values(P).sort((x, y) => y.wins - x.wins || (y.wins / y.games) - (x.wins / x.games) || y.mvp - x.mvp || x.name.localeCompare(y.name, 'ko'));
  standings.forEach((p, i) => { p.rank = i + 1; });
  return { matches: list, standings };
}
async function getToday(day) {
  const d = day || dayKey();
  const [raw, nraw] = await Promise.all([fetchDay(d), getJson(`${FIREBASE_DB}/${T}/days/${d}/normals.json`)]);
  const normals = Object.values(nraw || {}).filter(m => m && Array.isArray(m.us)).sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(m => Object.assign({}, m, {
    fun: normalFun(m), players: (m.stats || []).filter(p => m.us.some(n => norm(n) === norm(p.summonerName))).map(p => ({ name: p.summonerName, champId: p.championId, champ: p.championName, k: p.kills, d: p.deaths, a: p.assists, damage: p.damage })),
    stats: undefined, potg: m.potg && !m.potg.none ? m.potg : null }));
  return Object.assign({ ok: true, day: d, today: dayKey(), normals }, computeToday(raw));
}

// ── 🧩 증강 정보 — CommunityDragon latest(사이트와 같은 출처)를 받아 12시간 캐시 + 디스크 보관(오프라인·CDN 장애 대비) ──
// 증강 번호 자체는 게임 결과(EOG)에 그 판 그대로 담겨 오므로, 여기선 번호 → 이름·아이콘·등급만 붙임
const AUG_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/cherry-augments.json';
const AUG_ICON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
let _aug = null, _augAt = 0, _augBusy = null;
function augCachePath() { return path.join(app.getPath('userData'), 'augments-cache.json'); }
async function getAugments() {
  if (_aug && Date.now() - _augAt < 12 * 3600e3) return _aug;
  if (_augBusy) return _augBusy;
  _augBusy = (async () => {
    const list = await getJson(AUG_URL);
    if (Array.isArray(list) && list.length) {
      const map = {};
      for (const a of list) if (a && a.id) map[a.id] = {
        name: a.nameTRA || '#' + a.id,
        icon: a.augmentSmallIconPath ? AUG_ICON_BASE + a.augmentSmallIconPath.replace('/lol-game-data/assets', '').toLowerCase() : '',
        rarity: String(a.rarity || '').replace(/^k/, '').toLowerCase(),   // silver / gold / prismatic
      };
      _aug = map; _augAt = Date.now();
      try { fs.writeFileSync(augCachePath(), JSON.stringify({ at: _augAt, map })); } catch (_) {}
    } else if (!_aug) {   // 받기 실패 → 지난번 받아둔 것
      try { const c = JSON.parse(fs.readFileSync(augCachePath(), 'utf8')); _aug = c.map || {}; _augAt = Date.now() - 11 * 3600e3; } catch (_) { _aug = {}; }
    }
    _augBusy = null;
    return _aug || {};
  })();
  return _augBusy;
}

// ── 👤 개인 내전 프로필 — 지금까지의 모든 날 기록을 사람별로 모음 ─────────────────
// 사람 키 = 'p:'+puuid(앱으로 들어온 사람) 또는 'n:'+이름(앱 없이 방장이 추가한 사람·옛 기록)
// 판별 순서: 경기 기록의 ids(이름→puuid) → 게임 결과(stats)의 puuid(이름 매칭) → 계정 목록 이름 → 이름
const fetchAllDays = () => getJson(`${FIREBASE_DB}/${T}/days.json`);
const fetchAccounts = () => getJson(`${FIREBASE_DB}/${T}/accounts.json`);
let _profIdx = null, _profAt = 0;
async function profileIndex() {
  if (_profIdx && Date.now() - _profAt < 30000) return _profIdx;   // 30초 캐시(탭 오갈 때마다 전체를 다시 받지 않게)
  const [days, accounts] = await Promise.all([fetchAllDays(), fetchAccounts()]);
  const matches = [];
  for (const [day, d] of Object.entries(days || {})) for (const m of Object.values((d && d.matches) || {})) if (m && m.teamA && m.teamB) matches.push({ ...m, day: m.day || day });
  matches.sort((a, b) => (a.ts || 0) - (b.ts || 0));   // 시간순
  const nameToPuuid = {};
  for (const [puuid, a] of Object.entries(accounts || {})) if (a && a.name) { const n = normName(a.name); nameToPuuid[n] = nameToPuuid[n] === undefined ? puuid : null; }   // 같은 이름 둘이면 못 씀(null)
  _profIdx = { matches, accounts: accounts || {}, nameToPuuid }; _profAt = Date.now();
  return _profIdx;
}
function matchKeyOf(idx, m, name) {
  const n = normName(name);
  const id = (m.ids || {})[fbKeyOf(n)];
  if (id) return 'p:' + id;
  const st = (m.stats || []).find(p => p.puuid && norm(p.summonerName) === norm(n));
  if (st) return 'p:' + st.puuid;
  if (idx.nameToPuuid[n]) return 'p:' + idx.nameToPuuid[n];
  return 'n:' + n;
}
function statOf(m, name, key) {
  const list = m.stats || [];
  return (key.startsWith('p:') && list.find(p => p.puuid === key.slice(2))) || list.find(p => norm(p.summonerName) === norm(name)) || null;
}
async function getProfile(arg) {
  const idx = await profileIndex();
  let key = null;
  if (arg && arg.me) key = account ? 'p:' + account.puuid : null;
  else if (arg && arg.puuid && !String(arg.puuid).startsWith('g_')) key = 'p:' + arg.puuid;
  else if (arg && arg.name) { const n = normName(arg.name); key = idx.nameToPuuid[n] ? 'p:' + idx.nameToPuuid[n] : 'n:' + n; }
  if (!key) return { ok: false, err: '롤에 로그인하면 내 프로필을 볼 수 있어요' };
  const acc = key.startsWith('p:') ? idx.accounts[key.slice(2)] : null;
  const P = { ok: true, key, name: (acc && acc.name) || (arg && arg.name) || key.slice(2), tag: (acc && acc.tag) || '', me: !!(account && key === 'p:' + account.puuid),
    games: 0, wins: 0, losses: 0, mvp: 0, svp: 0, manner: 0, k: 0, d: 0, a: 0, statGames: 0, damage: 0, gold: 0, cs: 0, time: 0,
    double: 0, triple: 0, quadra: 0, penta: 0, firstBlood: 0, streak: 0, bestStreak: 0, worstStreak: 0, days: 0, first: null, last: null,
    champs: [], recent: [], best: {}, mates: [], rivals: [] };
  const champs = {}, mates = {}, rivals = {}, days = new Set(), augs = {};
  for (const m of idx.matches) {
    const names = [...m.teamA, ...m.teamB];
    const me = names.find(n => matchKeyOf(idx, m, n) === key);
    if (!me) continue;
    const team = m.teamA.some(x => normName(x) === normName(me)) ? 'teamA' : 'teamB', opp = team === 'teamA' ? 'teamB' : 'teamA';
    const win = m.winner === team;
    P.games++; days.add(m.day); if (!P.first) P.first = m.day; P.last = m.day;
    if (win) { P.wins++; P.streak = Math.max(0, P.streak) + 1; } else { P.losses++; P.streak = Math.min(0, P.streak) - 1; }
    P.bestStreak = Math.max(P.bestStreak, P.streak); P.worstStreak = Math.min(P.worstStreak, P.streak);
    const aw = [];
    if (m.mvp && normName(m.mvp) === normName(me)) { P.mvp++; aw.push('mvp'); }
    if (m.svp && normName(m.svp) === normName(me)) { P.svp++; aw.push('svp'); }
    if (m.manner && normName(m.manner) === normName(me)) { P.manner++; aw.push('manner'); }
    const st = statOf(m, me, key);
    if (st) {
      P.statGames++; P.k += st.kills || 0; P.d += st.deaths || 0; P.a += st.assists || 0;
      P.damage += st.damage || 0; P.gold += st.gold || 0; P.cs += st.cs || 0; P.time += m.gameTime || 0;
      P.double += st.doubleKills || 0; P.triple += st.tripleKills || 0; P.quadra += st.quadraKills || 0; P.penta += st.pentaKills || 0;
      if (st.firstBlood) P.firstBlood++;
      for (const id of new Set(st.augments || [])) { const x = augs[id] = augs[id] || { id, games: 0, wins: 0 }; x.games++; if (win) x.wins++; }   // 🧩
      const ck = st.championId || st.championName || '?';
      const c = champs[ck] = champs[ck] || { id: st.championId || null, name: st.championName || '', games: 0, wins: 0, k: 0, d: 0, a: 0 };
      c.games++; if (win) c.wins++; c.k += st.kills || 0; c.d += st.deaths || 0; c.a += st.assists || 0;
      const rec = (field, v) => { if (v > 0 && (!P.best[field] || v > P.best[field].v)) P.best[field] = { v, champ: st.championName || '', champId: st.championId || null, day: m.day, win }; };
      rec('kills', st.kills || 0); rec('damage', st.damage || 0); rec('assists', st.assists || 0);
      const kda = ((st.kills || 0) + (st.assists || 0)) / Math.max(1, st.deaths || 0); rec('kda', Math.round(kda * 10) / 10);
    }
    P.recent.push({ day: m.day, ts: m.ts, win, champ: st ? st.championName || '' : '', champId: st ? st.championId || null : null, k: st ? st.kills : null, d: st ? st.deaths : null, a: st ? st.assists : null, aw, mode: m.mode || null });
    for (const n of m[team]) { if (normName(n) === normName(me)) continue; const k = matchKeyOf(idx, m, n); const x = mates[k] = mates[k] || { name: normName(n), games: 0, wins: 0 }; x.games++; if (win) x.wins++; }
    for (const n of m[opp]) { const k = matchKeyOf(idx, m, n); const x = rivals[k] = rivals[k] || { name: normName(n), games: 0, wins: 0 }; x.games++; if (win) x.wins++; }
  }
  P.days = days.size;
  P.champs = Object.values(champs).sort((x, y) => y.games - x.games || y.wins - x.wins).slice(0, 5);
  P.augs = Object.values(augs).sort((x, y) => y.games - x.games || y.wins - x.wins).slice(0, 6);   // 🧩 많이 고른 증강
  P.recent = P.recent.slice(-10).reverse();
  const rate = x => x.wins / x.games;
  const MIN = 2;   // 2판 이상 같이(또는 상대로) 한 사람만
  P.mates = Object.values(mates).filter(x => x.games >= MIN).sort((x, y) => rate(y) - rate(x) || y.games - x.games).slice(0, 3);
  P.rivals = Object.values(rivals).filter(x => x.games >= MIN).sort((x, y) => rate(x) - rate(y) || y.games - x.games).slice(0, 3);
  for (const x of [...Object.values(mates), ...Object.values(rivals)]) { const pk = idx.nameToPuuid[x.name]; const a = pk && idx.accounts[pk]; if (a && a.name) x.name = normName(a.name); }   // 닉변한 사람은 지금 이름으로
  return P;
}

// ── 트레이 ──────────────────────────────────────────────────────────────
function toggleDock() {
  config.dock = (config.dock === false);   // 뒤집기(기본 켜짐)
  saveConfig();
  if (config.dock !== false) { dockedBounds = null; }
  stopDockStream(); _dockBuf = ''; startDockStream();   // 🪟 묶음 올리기에 클라를 넣을지(도킹 켬/끔)가 스크립트에 들어가 있어 다시 띄움
  refreshTrayMenu(); try { broadcastSettings(); } catch (_) {}
}
function toggleSidePanel() {                // ▶ 내 정보 패널 on/off
  config.sidePanel = (config.sidePanel === false);
  saveConfig();
  if (config.sidePanel !== false) { leftUserHid = false; leftDockedBounds = null; }
  else hideLeftPanel();
  refreshTrayMenu(); try { broadcastSettings(); } catch (_) {}
}
let _updateReady = false;
function refreshTrayMenu(updateReady) {
  if (!tray) return;
  if (updateReady) _updateReady = true;
  const items = [
    { label: '롤 클라이언트에 붙이기(도킹)', type: 'checkbox', checked: config.dock !== false, click: toggleDock },
    { type: 'separator' },
    { label: `팀·투표 창 토글 (${TOGGLE_HOTKEY})`, click: toggleOverlay },
    { label: '오른쪽 패널', type: 'checkbox', checked: config.sidePanel !== false, click: toggleSidePanel },
    { label: '오른쪽 패널 열기', click: showMainPanel },
    { type: 'separator' },
    { label: '내전 홈페이지 (기본 브라우저)', click: () => shell.openExternal(WEB_URL) },
    { type: 'separator' },
    { label: '✕ 닫을 때 「숨기기/종료」 묻기', type: 'checkbox', checked: config.closeAsk !== false, click: () => { config.closeAsk = (config.closeAsk === false); saveConfig(); refreshTrayMenu(); try { broadcastSettings(); } catch (_) {} } },
    { type: 'separator' },
    { label: '투데이 내전 종료', click: () => { app._quitting = true; app.quit(); } },
  ];
  if (_updateReady) items.unshift(
    { label: '🔄 지금 업데이트 (재시작)', click: () => { app._quitting = true; try { autoUpdater.quitAndInstall(); } catch (_) { app.quit(); } } },
    { type: 'separator' },
  );
  tray.setContextMenu(Menu.buildFromTemplate(items));
}
function makeTray() {
  let icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  if (!icon.isEmpty()) icon = icon.resize({ width: 18, height: 18 });
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('투데이 내전 · 실행 중 — 클릭: 패널 열기 · 우클릭: 종료');
  refreshTrayMenu();
  tray.on('click', showMainPanel);
  tray.on('double-click', showMainPanel);
}

// ── IPC ──────────────────────────────────────────────────────────────────
ipcMain.on('overlay-hide', () => { hideOverlay(); userHid = true; });
ipcMain.on('overlay-min', () => {
  if (overlayWin && !overlayWin.isDestroyed()) { overlayMinimized = true; try { overlayWin.setSkipTaskbar(false); overlayWin.minimize(); } catch (_) {} }
});
ipcMain.on('side-min', () => {
  if (leftWin && !leftWin.isDestroyed()) { leftMinimized = true; try { leftWin.setSkipTaskbar(false); leftWin.minimize(); } catch (_) {} }
});
// ✕ = 숨기기만 하면 트레이에서 계속 돌아 모르고 켜져 있던 문제 → 「숨기기 / 완전히 종료」를 물음(다음부터 묻지 않기 가능)
ipcMain.on('side-hide', () => {
  leftUserHid = true; hideLeftPanel();
  if (config.closeAsk !== false && !app._quitting) { closeQuitConfirm(); openQuitConfirm('close'); }
});
ipcMain.on('quit-confirm', (_e, yes, noAsk) => {
  const mode = _quitMode;
  closeQuitConfirm();
  if (mode === 'close') {
    if (noAsk && !yes) { config.closeAsk = false; saveConfig(); try { broadcastSettings(); } catch (_) {} }
    if (yes) { app._quitting = true; app.quit(); }
    else if (tray && process.platform === 'win32') try { tray.displayBalloon({ title: '투데이 내전은 계속 켜져 있어요', content: '작업 표시줄 오른쪽 아래 숨은 아이콘(^)에서 아이콘을 우클릭 → 「투데이 내전 종료」', iconType: 'info' }); } catch (_) {}
    return;
  }
  if (yes && !_clientPresent) { app._quitting = true; app.quit(); }
});
ipcMain.on('update-now', () => { app._quitting = true; try { autoUpdater.quitAndInstall(); } catch (_) { app.quit(); } });
ipcMain.handle('update-info', () => updView());
ipcMain.on('update-check', () => checkUpdate());
// ⚙️ 설정(v0.1.39) — 왼쪽·오른쪽 창의 ⚙ 버튼 · 효과음(켜기·크기)·클라 옆에 붙이기·오른쪽 패널·✕ 닫을 때 묻기
const settingsView = () => ({ sfxOn: config.sfxOn !== false, sfxVol: typeof config.sfxVol === 'number' ? config.sfxVol : 1, dock: config.dock !== false, sidePanel: config.sidePanel !== false, closeAsk: config.closeAsk !== false, hotkey: TOGGLE_HOTKEY });
function broadcastSettings() { const v = settingsView(); for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('settings', v); }
ipcMain.handle('settings-get', () => settingsView());
ipcMain.handle('settings-set', (_e, { key, value }) => {
  if (key === 'sfxOn') config.sfxOn = !!value;
  else if (key === 'sfxVol') config.sfxVol = Math.max(0, Math.min(1, +value || 0));
  else if (key === 'dock') { if ((config.dock !== false) !== !!value) toggleDock(); }
  else if (key === 'sidePanel') { if ((config.sidePanel !== false) !== !!value) toggleSidePanel(); }
  else if (key === 'closeAsk') { config.closeAsk = !!value; refreshTrayMenu(); }
  else return settingsView();
  saveConfig(); broadcastSettings();
  return settingsView();
});
ipcMain.on('app-quit', () => { app._quitting = true; app.quit(); });
ipcMain.on('open-web', () => shell.openExternal(WEB_URL));
ipcMain.handle('set-host', (_e, v) => v ? claimHost() : releaseHost());   // 👑 방장 하기/그만하기(한 명만)
ipcMain.handle('hand-host', (_e, { puuid }) => handHost(puuid));            // 👑 방장 넘겨주기
ipcMain.handle('host-info', () => hostView());
// 🚪 대기실
ipcMain.handle('lobby-data', () => lobbyView());
ipcMain.handle('lobby-me', (_e, { st }) => lobbySetMine(st));
ipcMain.handle('lobby-set', (_e, { key, st }) => lobbySetFor(key, st));
ipcMain.handle('lobby-guest', (_e, { name }) => lobbyAddGuest(name));
ipcMain.handle('lobby-guest-rm', (_e, { key }) => lobbyRemoveGuest(key));
ipcMain.handle('lobby-mode', (_e, { mode }) => lobbySetMode(mode));
ipcMain.handle('lobby-captain', (_e, { name, rand }) => lobbyCaptain(name, rand));
ipcMain.handle('lobby-start', () => lobbyStart());
ipcMain.handle('lobby-side', (_e, { name, team }) => lobbySide(name, team));
ipcMain.handle('lobby-sides-prev', () => lobbySidesPrev());
ipcMain.handle('lobby-sides-clear', () => lobbySidesClear());
ipcMain.handle('lobby-reopen', () => lobbyReopen());
ipcMain.on('overlay-show', () => { userHid = false; showOverlay(); });
ipcMain.handle('get-players', async () => ({ account, myName: config.myName || '', isHost: !!config.isHost, appVer: app.getVersion(), session: sessionData }));
ipcMain.handle('roster-data', () => getRoster());
ipcMain.handle('tb-start', (_e, { names, mode }) => startTeamBuild(names, mode));
ipcMain.handle('draft-start', (_e, { names, captains }) => startDraft(names, captains));   // 🎯 드래프트 시작(방장)
ipcMain.handle('draft-pick', (_e, { name }) => draftPick(name, false));                  // 🎯 팀장(또는 방장) 픽
ipcMain.handle('tb-again', async () => {   // 🔁 같은 팀으로 한 판 더
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  const s = sessionData;
  if (!s || !s.teamA || !s.teamB) return { ok: false, err: '직전 팀이 없어요' };
  return writeTeams(s.teamA, s.teamB, s.spectators || [], s.mode);
});
ipcMain.handle('host-result', async (_e, { winner }) => {   // 🏁 방장 수동 결과(EOG 못 잡았거나 이름 매칭 실패)
  if (!config.isHost) return { ok: false, err: '방장만 결과를 기록할 수 있어요' };
  const s = sessionData;
  if (!s || s.phase !== 'teams') return { ok: false, err: '팀이 정해진 상태에서만 기록할 수 있어요' };
  let eog = null;
  if (s.pendingEog) { const e = await fetchEog(); if (e && String(e.gameId) === String(s.pendingEog.gameId)) eog = e; }
  return recordGame(winner, eog);
});
ipcMain.handle('vote-cast', async (_e, { mvpPick, mannerPick }) => {
  const s = sessionData, me = config.myName;
  if (!s || s.phase !== 'vote') return { ok: false, err: '지금은 투표 시간이 아니에요' };
  const team = teamOf(s, me);
  if (!team) return { ok: false, err: '이 경기에 참가하지 않았어요' };
  const opp = team === 'teamA' ? 'teamB' : 'teamA';
  if (!teamOf(s, mvpPick) || teamOf(s, mvpPick) !== opp) return { ok: false, err: 'MVP는 상대 팀에서 골라요' };
  if (teamOf(s, mannerPick) !== team || normName(mannerPick) === normName(me)) return { ok: false, err: '매너왕은 우리 팀(본인 제외)에서 골라요' };
  const r = await fbSet(`${T}/session/votes/${fbKeyOf(me)}`, { mvp: normName(mvpPick), manner: normName(mannerPick), team, at: Date.now() });
  if (r.ok && config.isHost) runHost();
  return r;
});
ipcMain.handle('vote-clear', async () => {
  if (!sessionData || sessionData.phase !== 'vote' || !config.myName) return { ok: false };
  return fbDelete(`${T}/session/votes/${fbKeyOf(config.myName)}`);
});
ipcMain.handle('vote-close', async () => {   // ⏭️ 방장: 미투표자 있어도 지금까지의 표로 결과 확정
  if (!config.isHost) return { ok: false, err: '방장만 마감할 수 있어요' };
  return closeVote();
});
ipcMain.handle('today-data', async (_e, arg) => getToday(arg && arg.day));
ipcMain.handle('profile', (_e, arg) => getProfile(arg || { me: true }));
ipcMain.handle('augments', () => getAugments());   // 🧩 증강 번호 → {name, icon, rarity}
ipcMain.handle('potg-clip', async (_e, meta) => { const p = potg && await potg.getClip(meta); return p ? { url: pathToFileURL(p).href } : null; });   // 🎬 영상 → 내 PC 임시 파일
ipcMain.handle('potg-save', async (_e, { meta, name, hero }) => {   // 🎬 「내 컴퓨터에 저장」
  const p = potg && await potg.getClip(meta); if (!p) return { ok: false };
  const safe = String(name || '팟지').replace(/[\\/:*?"<>|]/g, '_');
  const ext = potg.extOf(meta.mime);
  const r = await dialog.showSaveDialog(potgWin && !potgWin.isDestroyed() ? potgWin : undefined, { title: '팟지 영상 저장', defaultPath: path.join(app.getPath('videos'), `투데이내전_${hero ? '숨은영웅' : '팟지'}_${meta.day}_${safe}.${ext}`), filters: [{ name: '영상', extensions: [ext] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  try { fs.copyFileSync(p, r.filePath); return { ok: true, path: r.filePath }; } catch (_) { return { ok: false }; }
});
ipcMain.on('potg-close', () => closePotg());
ipcMain.on('potg-open', (_e, card) => { if (card && !card.none) openPotg(card, true); });   // 「오늘」 탭 일반 판 「팟지」
ipcMain.on('potg-replay', () => { const P = sessionData && sessionData.potg; if (P && !P.none) openPotg(P, true); });   // 결과 화면 「팟지 다시 보기」
ipcMain.handle('rec-state', () => recState);   // 📼 기록 저장 진행 상태   // 👤 개인 내전 프로필
ipcMain.on('open-profile', (_e, arg) => {   // 왼쪽 대기실에서 이름 누름 → 오른쪽 창 프로필 탭
  try { showMainPanel(); } catch (_) {}
  if (leftWin && !leftWin.isDestroyed()) leftWin.webContents.send('open-profile', arg);
});

// ── 앱 시작 ──────────────────────────────────────────────────────────────
const _gotLock = app.requestSingleInstanceLock();
if (!_gotLock) { app.quit(); }
else {
  app.on('second-instance', () => showMainPanel());
  app.whenReady().then(() => {
    CONFIG_PATH = path.join(app.getPath('userData'), 'today-naejeon-config.json');
    config = loadConfig();
    // 🧪 개발용: TN_HIDDEN=1 → 창을 화면에 한 번도 안 띄우고 테스트(CDP로만 조작 · 배포본에선 무시)
    if (!app.isPackaged && process.env.TN_HIDDEN) app.on('browser-window-created', (_e, w) => {
      w.show = w.showInactive = w.focus = w.moveTop = () => {};
      try { w.webContents.setBackgroundThrottling(false); } catch (_) {}
    });
    config.isHost = false;   // 🔒 방장은 실행마다 초기화
    config.myName = '';      // 👤 이름은 롤 로그인 계정에서만(옛 버전 저장값 무시)
    if (!config.deviceId) { config.deviceId = 'td_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36); saveConfig(); }
    createOverlay();
    createLeftPanel();
    createSlotWin();
    _startTs = Date.now();
    floatPanels();
    squareAllPanels(); setTimeout(squareAllPanels, 1500);
    makeTray();
    globalShortcut.register(TOGGLE_HOTKEY, toggleOverlay);
    pollGame(); pollSession(); startDockStream();
    setInterval(pollGame, 2500);
    const runSession = coalesce(pollSession);
    setInterval(runSession, 3000);                       // 안전망(스트림 끊겼을 때)
    fbStream(`${T}/session`, runSession);                // ⚡ 팀 배정·투표·결과 = 바뀌는 즉시
    fbStream(`${T}/lobby`, refreshLobby);                 // ⚡ 대기실(참가·방식·팀장) = 이 노드만 다시 읽음
    fbStream(`${T}/presence`, refreshPresence);           // ⚡ 누가 들어오고 나감
    fbStream(`${T}/host`, runSession);                   // ⚡ 방장 바뀜(넘겨받음·이어받음)                  // ⚡ 방장 준비 중 배너
    fbStream(`${T}/bridge/eogStats`, () => { if (config.isHost) runHost(); });   // ⚡ 경기 종료 → 방장 앱이 바로 기록
    setupAutoUpdate();
    replayRec = makeReplayRec(Object.assign(makeReplayRec.defaults(), {   // 🎬 방장 PC가 팟지 장면을 리플레이로 녹화
      lcuRaw: bridge.lcuRaw, lolDir: bridge.lolDir, outDir: path.join(app.getPath('userData'), 'replay-rec'),
      kill: () => new Promise(r => require('child_process').execFile('taskkill', ['/IM', 'League of Legends.exe', '/F'], () => r())),
      log: (m) => { _recLog.push(`${new Date().toTimeString().slice(0, 8)} ${m}`); try { console.log(m); } catch (_) {} },
      restoreFile: path.join(app.getPath('userData'), 'replay-cfg-restore.json'),
      hideWindow: process.platform === 'win32' ? hideReplayWindow : null,
    }));
    try { replayRec.restorePending(); } catch (_) {}   // 지난번에 녹화하다 앱이 꺼졌으면 game.cfg 창 설정 되돌림
    potg = makePotg({ T, FIREBASE_DB, fbSet, fbDelete, getJson, dayKey, normName, userData: app.getPath('userData'), getPlayers: () => latestPlayers, log: (m) => { try { console.log(m); } catch (_) {} } });
    setTimeout(() => potg.cleanup().catch(() => {}), 8000); setInterval(() => potg.cleanup().catch(() => {}), 30 * 60 * 1000);   // 🎬 3일 지난 영상·수집 지우기
    bridge.start({ getOperatorName: () => config.myName || null, isHost: () => !!config.isHost, appVer: app.getVersion(), onAccount: setAccount, onEog: onBridgeEog, onLobbySeat, onNormal: (e) => recordNormal(e).catch(err => console.log('[normal] 오류', err && err.message)), fakeLcu: (!app.isPackaged && process.env.TN_FAKE_LCU) || null, log: (m) => { try { console.log(m); } catch (_) {} } });
    // 🧪 개발용: 롤 없이 테스트 — TN_FAKE_ACCOUNT="이름#태그" (배포본에선 안 씀) · TN_FAKE_DELAY=ms(기본 1500 · 50이면 창 로딩 도중 계정이 잡히는 경우 재현)
    if (!app.isPackaged && process.env.TN_FAKE_ACCOUNT) { const [g, t] = process.env.TN_FAKE_ACCOUNT.split('#'); setTimeout(() => setAccount({ puuid: 'fake-' + g, gameName: g, tagLine: t || 'KR1', iconId: 29 }), +(process.env.TN_FAKE_DELAY || 1500)); }
  });
}

// 🔄 자동 업데이트 — GitHub Releases(SOHADA2/today-naejeon)
// v0.1.39: 업데이트 알림 = 오른쪽 아래 따로 뜨는 창(게임 중에도 튀어나옴) 대신 왼쪽·오른쪽 창 안에(머리 아래 알림 줄 + ⚙ 점 + 설정의 버전 칸)
const upd = { state: 'idle', version: null, pct: 0 };   // idle·checking·downloading·ready·latest·error·dev
const updView = () => Object.assign({ cur: app.getVersion() }, upd);
function setUpd(p) { Object.assign(upd, p); broadcast('update', updView()); }
function checkUpdate() {
  if (!app.isPackaged) { setUpd({ state: 'dev' }); return; }
  if (upd.state === 'downloading' || upd.state === 'ready') return;
  setUpd({ state: 'checking' });
  autoUpdater.checkForUpdates().catch(() => setUpd({ state: 'error' }));
}
function setupAutoUpdate() {
  if (!app.isPackaged) { upd.state = 'dev'; return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => setUpd({ state: 'downloading', version: info && info.version, pct: 0 }));
  autoUpdater.on('download-progress', (p) => { const pct = Math.round((p && p.percent) || 0); if (pct !== upd.pct) setUpd({ pct }); });
  autoUpdater.on('update-not-available', () => setUpd({ state: 'latest' }));
  autoUpdater.on('update-downloaded', (info) => { setUpd({ state: 'ready', version: info && info.version, pct: 100 }); refreshTrayMenu(true); });
  autoUpdater.on('error', () => { if (upd.state !== 'ready') setUpd({ state: 'error' }); });
  checkUpdate();
  setInterval(checkUpdate, 30 * 60 * 1000);
}
let _cleanedUp = false;
app.on('before-quit', (e) => {
  app._quitting = true;
  try { bridge.stop(); } catch (_) {}
  try { stopDockStream(); } catch (_) {}
  if (_cleanedUp) return;
  // 접속 표시·방장 자리를 지우고 끝냄(안 지우면 다른 사람이 1분 기다려야 방장을 이어받음) — 최대 3초
  _cleanedUp = true;
  const jobs = [];
  if (account) jobs.push(fbSet(`${T}/presence/${account.puuid}`, null));
  if (account) jobs.push(fbSet(`${T}/lobby/join/${account.puuid}`, null));
  if (config.isHost) jobs.push(fbCas(`${T}/host`, cur => cur && account && cur.puuid === account.puuid ? { value: null } : { err: 'not mine' }));
  if (!jobs.length) return;
  e.preventDefault();
  Promise.race([Promise.allSettled(jobs), new Promise(r => setTimeout(r, 3000))]).then(() => app.quit());
});
app.on('window-all-closed', () => { /* 트레이 상주 */ });
app.on('will-quit', () => globalShortcut.unregisterAll());
