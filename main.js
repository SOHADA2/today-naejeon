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
const os = require('os');
const { spawn } = require('child_process');

const WEB_URL = 'https://sohada2.github.io/aram/';
// 🗄️ v0.1.64: 투데이 내전 전용 Firebase 프로젝트(today-naejeon-sohada · 무료 Spark · 싱가포르) — 사이트 DB(aramchaos)와 한도(저장 1GB·내려받기 월 10GB) 분리
//   🔐 v0.1.98: 익명 로그인(사장님이 콘솔에서 켬 · 무료) — 모든 읽기·쓰기·실시간 연결·브릿지에 표식(?auth=) · 규칙은 아직 공개(옛 앱 업데이트 뒤 auth != null로)
const FIREBASE_DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_API_KEY = 'AIzaSyDhVbSzNQ306LUTcPo44Ru9G4_RqV9Dl_E';   // 웹 앱 키(공개용 식별자 — 비밀 아님)
const TOGGLE_HOTKEY = 'Shift+F7';   // 기존 오버레이(Shift+F5)와 겹치지 않게
const T = 'today';                  // ⚠️ 이 앱의 모든 쓰기 루트 — 사이트 노드(session·lobby·bridge·matches…)에 절대 쓰지 않음
const { buildTeams, normName } = require('./teams');   // ⚔️ 홈페이지 makeTeams 1:1 이식(밸런스 계산)
const bridge = require('./bridge');                    // 🔌 내장 브릿지(LCU EOG 캡처 → today/bridge)
const makeReplayRec = require('./replayrec');           // 🎬 팟지 영상 = 방장 PC가 리플레이를 열어 그 장면만 녹화(v0.1.33)
const makeRating = require('./rating');                // 🏅 전적 기반 점수(솔로 랭크·칼바람·아수라장)
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
// 🔀 대기실 방식 자동(v0.1.81 · 사장님) — 방장 롤 대기방이 일반 큐(커스텀 아님)면 「일반판」, 사용자 설정 방이면 마지막 내전 방식(랜덤·드래프트·직접)
//   바뀔 때만(롤 대기방 종류가 바뀐 순간) · 방장이 그 뒤에 직접 바꾸면 그대로 둠
let _autoModeKey = null;
function autoLobbyMode() {
  if (!config.isHost || lobbyPhase !== 'Lobby' || lobbyCustom == null) { if (lobbyPhase !== 'Lobby') _autoModeKey = null; return; }
  const key = lobbyCustom ? 'custom' : 'queue'; if (key === _autoModeKey) return; _autoModeKey = key;
  const cur = (lobbyRaw && lobbyRaw.mode) || 'random';
  const want = lobbyCustom ? (cur === 'normal' ? (config.lastTeamMode || 'random') : null) : (cur !== 'normal' ? 'normal' : null);
  if (want) { console.log('[lobby] 롤 대기방이', key === 'custom' ? '사용자 설정 방' : '일반 큐', '→ 방식', want); lobbySetMode(want, true).catch(() => {}); }
}
// 🪑 자동 자리 이동(2026-11-01 사장님: 팀이 정해지면 1팀/2팀으로 옮겨 줄 수 있나) — 롤 클라 「팀 참가/관전」 버튼과 같은 요청
//   POST /lol-lobby/v2/lobby/team/TEAM1|TEAM2|SPECTATOR(rcp-fe-lol-parties teamToStringQueue · 1팀=customTeam100=왼쪽) · 각자 앱이 「내 자리만」 옮김
//   조건: 사용자 설정 방(Lobby·커스텀) + 판 상태 teams + 내 팀이 정해짐 + 자리를 앎 · 팀 결성(lastFormed)마다 최대 5번(3초 간격 — 상대 팀 칸이 꽉 차 있으면 기다렸다 다시)
//   한 번 맞게 앉으면 그 결성 동안은 다시 안 옮김(그 뒤 손으로 옮긴 건 그대로) · ⚙️ 설정 「팀 자리로 자동 이동」(기본 켬)
//   ⚠️ 예전에 시험한 /lol-lobby/v1/lobby/custom/switch-teams는 404였음
let _seatKey = null, _seatTries = 0, _seatAt = 0, _seatDone = null;
function autoSeat() {
  const s = sessionData, me = config.myName;
  if (config.autoSeat === false || inGame || lobbyPhase !== 'Lobby' || lobbyCustom !== true || lobbySeat == null || !s || s.phase !== 'teams' || !lastFormed || !me) return;
  const t = teamOf(s, me), want = t === 'teamA' ? 1 : t === 'teamB' ? 2 : (s.spectators || []).some(n => norm(n) === norm(me)) ? 'spec' : null;
  if (want == null) return;
  const key = String(lastFormed);
  if (_seatDone === key) return;
  if (lobbySeat === want) { _seatDone = key; return; }
  if (_seatKey !== key) { _seatKey = key; _seatTries = 0; }
  if (_seatTries >= 5 || Date.now() - _seatAt < 3000) return;
  _seatTries++; _seatAt = Date.now();
  const team = want === 1 ? 'TEAM1' : want === 2 ? 'TEAM2' : 'SPECTATOR';
  bridge.lcuRaw('POST', `/lol-lobby/v2/lobby/team/${team}`).then(r => console.log('[seat] 자동 자리 이동', team, r && r.status)).catch(() => {});
}
function onLobbySeat(d) {
  const prevPhase = lobbyPhase;
  lobbyPhase = d && d.phase || null; lobbySeat = d ? d.seat : null; lobbyCustom = d ? d.custom : null;
  autoLobbyMode(); autoSeat();
  if ((prevPhase === 'ChampSelect') !== (lobbyPhase === 'ChampSelect')) { if (lobbyPhase !== 'ChampSelect') { champSel = null; _champSelSig = ''; } pushAugGuide().catch(() => {}); }   // 🧭 증강 가이드 켜고 끄기
  if (lobbyPhase === 'ChampSelect' && prevPhase !== 'ChampSelect') borderlessOn();   // 🖥️ 게임 중 정보 창 켠 사람 = 게임 뜨기 전에 테두리 없는 창으로
  else if (prevPhase === 'ChampSelect' && ['Lobby', 'None', 'Matchmaking', 'ReadyCheck'].includes(lobbyPhase) && !inGame) borderlessOff();   // 닷지·취소 → 원래대로
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
  const colRight = cx + cw * ((side === 1 ? 523 : 1027) / 1280)   /* v0.1.84: 2팀 끝은 실측 1027(클라 CSS 계산 1019보다 8px 오른쪽) — docs/screen-layout.md */;
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
  // 🎬 v0.1.92: 팟지 녹화(리플레이) 중엔 롤이 클라 창을 최소화함 → 예전엔 「클라 없음」으로 보고 좌우 창을 화면 가운데로 모아(플로팅)
  //   방장 화면만 배치가 뒤집혔음(사장님: 다른 사람이 방장이면 어리둥절) → 녹화 중 최소화는 무시하고 붙어 있던 자리 그대로(기다림 화면도 그 클라 자리 가운데)
  if (config.dock !== false && !valid && replayBusy && _lastRect && !_floating) { hideSlotMarker(); keepClientShown(); return; }
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
// 🔐 우리 Firebase 주소(문자열)면 로그인 표식을 붙여 읽음(v0.1.98)
function getJson(opts) {
  if (typeof opts === 'string' && opts.startsWith(FIREBASE_DB + '/')) return fbToken().then(tok => getJsonRaw(withAuth(opts, tok)));
  return getJsonRaw(opts);
}
const withAuth = (url, tok) => !tok || tok === NOAUTH ? url : `${url}${url.includes('?') ? '&' : '?'}auth=${tok}`;
function getJsonRaw(opts) {
  return new Promise(resolve => {
    const req = https.get(opts, res => {
      let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
// ⚡ Firebase 실시간 스트림(REST SSE) — 노드가 바뀌는 즉시 onChange 호출(3초 폴링 지연 제거·v0.1.55).
//   끊기면 자동 재연결(1→30초 백오프). 폴링은 안전망으로 그대로 유지.
function fbStream(pathStr, onChange, onDown) {   // onChange(ev, {path, data}) · onDown() = 끊김(다시 연결하면 처음에 전체가 'put /'로 다시 옴) · 반환 = { close() }(🚪 방 바꿀 때)
  let retry = 1000, closed = false, cur = null;
  const start = () => fbToken().then(tok => open(withAuth(`${FIREBASE_DB}/${pathStr}.json`, tok), 0));   // 🔐 표식 1시간 → 만료되면 서버가 auth_revoked → 다시 연결하며 새 표식
  const open = (url, hops) => {
    if (app._quitting || closed) return;
    let lastBeat = Date.now(), buf = '', done = false;
    const again = () => { if (done) return; done = true; clearInterval(idle); if (closed) return; try { if (onDown) onDown(); } catch (_) {} setTimeout(start, retry); retry = Math.min(retry * 2, 30000); };
    const req = cur = https.get(url, { headers: { Accept: 'text/event-stream' } }, res => {
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
          if (ev === 'put' || ev === 'patch') {
            retry = 1000; let msg = null;
            try { msg = JSON.parse((block.match(/^data: *(.*)$/m) || [])[1] || 'null'); } catch (_) {}
            if (!closed) try { onChange(ev, msg); } catch (_) {}
          }
          else if (ev === 'cancel' || ev === 'auth_revoked') { req.destroy(); again(); return; }
        }
      });
      res.on('end', again);
      res.on('error', again);
    });
    req.on('error', again);
    const idle = setInterval(() => { if (Date.now() - lastBeat > 90000) { req.destroy(); again(); } }, 30000);   // keep-alive(30초) 끊김 감지
  };
  start();
  return { close() { closed = true; try { if (cur) cur.destroy(); } catch (_) {} } };
}
// 📡 스트림 사본(v0.1.63 · 내려받기 절약) — 처음 연결 때 전체 1번 + 그 뒤엔 바뀐 부분만 받아 사본에 적용 · 다시 읽기(REST) 없음
//   예전 = 3초마다 session·lobby·host·presence·normalLive·potgRec를 통째로 다시 읽음(앱 하나 시간당 ~6MB · 무료 한도 월 10GB를 사이트와 나눠 씀)
//   끊겨 있는 동안(ready=false)은 pollSession이 그 노드만 예전처럼 REST로 읽음
const MIR = {};
function mirSet(root, ks, val) {
  if (!ks.length) return val === undefined ? null : val;
  const o = root && typeof root === 'object' ? (Array.isArray(root) ? root.slice() : Object.assign({}, root)) : {};
  const v = mirSet(o[ks[0]], ks.slice(1), val);
  if (v == null) delete o[ks[0]]; else o[ks[0]] = v;
  return Object.keys(o).length ? o : null;
}
function fbMirror(name, onData, pathStr) {   // pathStr 없으면 today/{name} · 🚪 방 노드는 rooms/{방}/{name}(방 바꾸면 close 후 다시)
  const m = MIR[name] = { ready: false, data: null };
  m.stream = fbStream(pathStr || `${T}/${name}`, (ev, msg) => {
    if (MIR[name] !== m || !msg || typeof msg.path !== 'string') return;
    const ks = msg.path.split('/').filter(Boolean);
    if (ev === 'put') { m.data = mirSet(m.data, ks, msg.data); if (!ks.length) m.ready = true; }
    else if (ev === 'patch' && msg.data && typeof msg.data === 'object') for (const [k, v] of Object.entries(msg.data)) m.data = mirSet(m.data, ks.concat(k.split('/').filter(Boolean)), v);
    if (m.ready) onData(m.data);
  }, () => { m.ready = false; });
  return m;
}
function mirClose(name) { const m = MIR[name]; if (m && m.stream) m.stream.close(); delete MIR[name]; }
const mirOr = (name, fetcher) => MIR[name] && MIR[name].ready ? Promise.resolve(MIR[name].data) : fetcher();
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
      let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch (_) { resolve({ status: res.statusCode, json: null }); } });
    });
    req.on('error', () => resolve({ status: 0, json: null }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, json: null }); });
    if (data) req.write(data);
    req.end();
  });
}

// 🔑 Firebase 익명 인증 — 쓰기 규칙(auth != null)용. 홈페이지 signInAnonymously와 동일한 신뢰모델.
let _fbTok = null, _fbTokAt = 0, _fbTokP = null;
const NOAUTH = 'noauth';
const authQ = tok => tok === NOAUTH ? '' : `?auth=${tok}`;
async function fbToken() {
  if (!FIREBASE_API_KEY) return NOAUTH;
  if (_fbTok && Date.now() - _fbTokAt < 50 * 60 * 1000) return _fbTok;   // idToken 수명 1h → 50분 캐시
  if (!_fbTokP) _fbTokP = (async () => {   // 🔐 v0.1.98: 처음 한 번만 익명 가입 → 갱신 토큰(config.fbRefresh)으로 계속 같은 사람(uid) · 동시에 불러도 한 번만
    let tok = null, rt = null;
    if (config.fbRefresh) { const r = await reqJson('POST', `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, { grant_type: 'refresh_token', refresh_token: config.fbRefresh }); tok = r.json && r.json.id_token; rt = r.json && r.json.refresh_token; }
    if (!tok) { const r = await reqJson('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, { returnSecureToken: true }); tok = r.json && r.json.idToken; rt = r.json && r.json.refreshToken; }
    if (tok) { _fbTok = tok; _fbTokAt = Date.now(); if (rt && rt !== config.fbRefresh) { config.fbRefresh = rt; saveConfig(); } }
    return tok;
  })().catch(() => null).finally(() => { _fbTokP = null; });
  return (await _fbTokP) || (_fbTok && Date.now() - _fbTokAt < 55 * 60 * 1000 ? _fbTok : NOAUTH);   // 실패하면 아직 안 끝난 옛 표식, 그것도 없으면 표식 없이(규칙이 공개인 동안 앱이 멈추지 않게 · 만료 표식은 공개 규칙에서도 401)
}
// session 등 노드 전체 교체(set) — 홈페이지 set(ref(db,'session'), ...)과 동일 시맨틱
async function fbSet(pathStr, value) {
  const tok = await fbToken();
  if (!tok) return { ok: false, err: '인증 실패(네트워크 확인)' };
  const r = await reqJson('PUT', `${FIREBASE_DB}/${pathStr}.json${authQ(tok)}`, value);
  if (r.status === 200) return { ok: true };
  if (r.status === 401 || r.status === 403) { _fbTok = null; }   // 토큰 만료/거부 → 다음 시도에 재발급
  return { ok: false, err: `쓰기 실패(HTTP ${r.status})` };
}
async function fbDelete(pathStr) {   // 특정 키 삭제 — 홈페이지 remove()와 동일(투표 취소용)
  const tok = await fbToken();
  if (!tok) return { ok: false };
  const r = await reqJson('DELETE', `${FIREBASE_DB}/${pathStr}.json${authQ(tok)}`);
  if (r.status === 401 || r.status === 403) { _fbTok = null; }
  return { ok: r.status === 200 };
}
async function fbUpdate(pathStr, value) {   // 노드 일부 필드만 갱신(PATCH) — 홈페이지 update()와 동일. items_s2만 덮어씀(다른 필드 유실 방지).
  const tok = await fbToken();
  if (!tok) return { ok: false, err: '인증 실패' };
  const r = await reqJson('PATCH', `${FIREBASE_DB}/${pathStr}.json${authQ(tok)}`, value);
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
  if (inGame && config.ingame) { ingameHidden = !ingameHidden; if (ingameHidden) hideIngame(); else ingameUpdate(_rawPlayers); return; }   // 🖥️ 게임 중엔 Shift+F7 = 게임 중 정보 창 켜기/끄기
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

// ── 🖥️ 게임 중 정보 창(v0.1.77 · 설정에서 켠 사람만) ─────────────────────────────
// 롤 화면 위쪽 가운데에 작은 띠 = 우리 팀/상대 팀 아이템 골드 합(=모은 골드 추정)·킬·평균 레벨 — 라이브 클라이언트(2999) playerlist, 2.5초마다
// ⚖️ 라이엇 정책: 게임 안 점수판(Tab)에 보이는 정보(아이템·킬·레벨)만 합쳐 보여줌 · 상대 쿨타임·안 보이는 정보 X · 클릭 통과(게임 조작 안 막음)
// 전체 화면(WindowMode=0)이면 어떤 창도 게임 위에 못 뜸 → 켜 두면 챔피언 선택 때 game.cfg를 「테두리 없는 창」(2)으로 바꾸고 게임 끝나면 원래대로
let ingameWin = null, ingameHidden = false, _rawPlayers = [], _itemPrice = null;
const ITEMS_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json';
async function itemPrices() {   // 아이템 번호 → 총 가격(priceTotal) · 12시간 · userData 보관
  if (_itemPrice && Date.now() - _itemPrice.at < 12 * 3600e3) return _itemPrice.map;
  const file = path.join(app.getPath('userData'), 'items-cache.json');
  try { const list = await getJson(ITEMS_URL); if (Array.isArray(list) && list.length) { const map = {}; for (const it of list) if (it && it.id) map[it.id] = it.priceTotal || 0; _itemPrice = { at: Date.now(), map }; try { fs.writeFileSync(file, JSON.stringify(map)); } catch (_) {} return map; } } catch (_) {}
  if (!_itemPrice) { try { _itemPrice = { at: Date.now() - 11 * 3600e3, map: JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (_) { _itemPrice = { at: Date.now() - 11.9 * 3600e3, map: {} }; } }
  return _itemPrice.map;
}
function ingameSummary(list, prices, me) {   // → {my:'ORDER'|'CHAOS'|null, t:{ORDER:{gold,kills,lv,n}, CHAOS:{…}}, label:{ORDER,CHAOS}}
  const t = { ORDER: { gold: 0, kills: 0, lv: 0, n: 0 }, CHAOS: { gold: 0, kills: 0, lv: 0, n: 0 } };
  let my = null;
  for (const p of list || []) {
    const x = t[p.team]; if (!x) continue;
    x.n++; x.lv += p.level || 0; x.kills += (p.scores && p.scores.kills) || 0;
    for (const it of p.items || []) x.gold += ((prices && prices[it.itemID]) || it.price || 0) * (it.count > 1 && it.consumable ? it.count : 1);
    const nm = norm(p.riotIdGameName || p.summonerName || (typeof p.riotId === 'string' ? p.riotId.split('#')[0] : ''));
    if (me && nm === norm(me)) my = p.team;
  }
  for (const k of ['ORDER', 'CHAOS']) t[k].lv = t[k].n ? Math.round(t[k].lv / t[k].n * 10) / 10 : 0;
  const s = sessionData && ['teams', 'vote', 'result'].includes(sessionData.phase) ? sessionData : null;   // 내전이면 1팀/2팀 이름(1팀 = 대기방 왼쪽 = ORDER)
  return { my, t, label: s ? { ORDER: '1팀', CHAOS: '2팀' } : null };
}
function ingameBounds() {
  const W = 420, H = 62;
  let d = screen.getPrimaryDisplay();
  if (_lastRect) { const sf = d.scaleFactor || 1; d = screen.getDisplayNearestPoint({ x: Math.round(_lastRect[0] / sf), y: Math.round(_lastRect[1] / sf) }) || d; }   // 롤 클라가 있던 모니터
  const b = d.bounds;
  return { x: Math.round(b.x + (b.width - W) / 2), y: b.y + 2, width: W, height: H };
}
async function ingameUpdate(list) {
  if (!config.ingame || !inGame || ingameHidden || replayBusy) return;
  const v = ingameSummary(list, await itemPrices(), (account && account.gameName) || config.myName);
  if (ingameWin && !ingameWin.isDestroyed()) { try { ingameWin.webContents.send('ingame', v); } catch (_) {} return; }
  ingameWin = new BrowserWindow(Object.assign(ingameBounds(), {
    frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, show: false, hasShadow: false, roundedCorners: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  }));
  ingameWin.setAlwaysOnTop(true, 'screen-saver'); ingameWin.setIgnoreMouseEvents(true);
  ingameWin.webContents.on('did-finish-load', () => { if (ingameWin && !ingameWin.isDestroyed()) { ingameWin.webContents.send('ingame', v); ingameWin.showInactive(); } });
  ingameWin.on('closed', () => { ingameWin = null; });
  ingameWin.loadFile('desktop/ingame.html');
}
function hideIngame() { if (ingameWin && !ingameWin.isDestroyed()) { try { ingameWin.destroy(); } catch (_) {} } ingameWin = null; }
function borderlessOn() { try { if (replayRec && (config.ingame || config.augRank)) replayRec.borderlessOn(); } catch (_) {} }   // 정보 창·증강 순위 둘 다 게임 위에 떠야 함
function borderlessOff() { try { if (replayRec) replayRec.borderlessOff(); } catch (_) {} }

// ── 🎯 증강 순위(v0.1.78 · 설정에서 켠 사람만 · 베타) ─────────────────────────────
// 사장님: 증강 3개가 뜨면 내 챔피언 기준 1·2·3위를 띄우고, 리롤로 바뀌면 순위도 바로 바뀌게
// 롤은 뜬 증강을 앱에 안 알려줌 → 게임 화면 가운데를 캡처(desktopCapturer) → Windows 내장 글자 읽기(OCR, 한국어)로 카드의 증강 이름 → augscan.findCards
//  · 언제 읽나: 게임 시작 2분 30초 · 내 레벨이 오른 뒤 60초 · 순위가 떠 있는 동안 = 1.2초마다 / 그 밖엔 5초마다(가볍게)
//  · 순위 = augscan.rankAugs(그 챔피언 이번 패치 등급 tiers·top > 전체 등급 today/augGuide/global > 모름 · 콤보 + · 함정 − · 우리 기록)
//  · 화면 = desktop/augrank.html(게임 화면 크기 · 투명 · 클릭 통과) 카드 이름 위에 「1위」 · 이름이 사라지면 2.5초 뒤 지움
//  · Shift+F8(게임 중) = 지금 화면과 읽은 글자를 개발용 비공개 저장소(today/config/clips의 저장소)로 보냄 → 위치·글자 맞추기용
// ⚠️ 실제 증강 화면으로 아직 못 맞춰 봄 · ⚖️ 화면을 보기만 함(게임 파일·메모리 안 건드림) · 라이엇 정책상 위험할 수 있어 기본 꺼짐
const augscan = require('./augscan');
const OCR_PS = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::InputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
Add-Type -Name Dpi -Namespace Tn -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
[void][Tn.Dpi]::SetProcessDPIAware()   # 화면 캡처 좌표 = 실제 픽셀(배율 쓰는 모니터에서도)
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]   # v0.1.79: 안 불러오면 Language를 못 만들어 한국어 OCR이 있어도 「no-korean-ocr」(실기에서 발견)
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$engine = $null
try { $lang = New-Object Windows.Globalization.Language('ko'); if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang) } } catch {}
if ($engine -eq $null) { [Console]::Out.WriteLine('{"ready":false,"err":"no-korean-ocr"}'); [Console]::Out.Flush(); exit }
[Console]::Out.WriteLine('{"ready":true,"max":' + [Windows.Media.Ocr.OcrEngine]::MaxImageDimension + '}'); [Console]::Out.Flush()
while ($true) {
  $p = [Console]::In.ReadLine(); if ($p -eq $null) { break }
  try {
    $sw = [Diagnostics.Stopwatch]::StartNew(); $capMs = 0
    if ($p.StartsWith('cap ') -or $p.StartsWith('img ')) {
      # v0.1.80: 「cap x y w h k」 = 화면의 그 영역만(실제 픽셀) 캡처해 k배로 키워 바로 읽음 · 「img x y w h k 경로」 = 파일에서 같은 영역(시험용)
      #   예전엔 앱이 desktopCapturer로 화면 전체(3440×1440)를 캡처 → 한 번 0.4~0.76초 · 앱 메인 스레드 최대 0.5초 멈춤 + PNG 0.19초 → 1.2초마다라 마우스까지 끊김
      $a = $p.Split(' '); $cx = [int]$a[1]; $cy = [int]$a[2]; $cw = [int]$a[3]; $chh = [int]$a[4]; $k = [double]$a[5]
      if ($a[0] -eq 'cap') { $img = New-Object System.Drawing.Bitmap $cw, $chh; $g = [System.Drawing.Graphics]::FromImage($img); $g.CopyFromScreen($cx, $cy, 0, 0, $img.Size); $g.Dispose() }
      else { $src = [System.Drawing.Bitmap]::FromFile(($a[6..($a.Length - 1)] -join ' ')); $img = $src.Clone((New-Object System.Drawing.Rectangle $cx, $cy, $cw, $chh), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $src.Dispose() }
      if ($k -gt 1) { $big = New-Object System.Drawing.Bitmap ([int]($cw * $k)), ([int]($chh * $k)); $g = [System.Drawing.Graphics]::FromImage($big); $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g.DrawImage($img, 0, 0, $big.Width, $big.Height); $g.Dispose(); $img.Dispose(); $img = $big }
      $ms = New-Object System.IO.MemoryStream; $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Bmp); $img.Dispose(); $ms.Position = 0
      $s = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms); $capMs = $sw.ElapsedMilliseconds
    } else {
      $f = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($p)) ([Windows.Storage.StorageFile])
      $s = Await ($f.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    }
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($s)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('{"ms":' + $sw.ElapsedMilliseconds + ',"cap":' + $capMs + ',"lines":[')
    $first = $true
    foreach ($ln in $res.Lines) {
      $x1 = 1e9; $y1 = 1e9; $x2 = 0; $y2 = 0
      foreach ($w in $ln.Words) { $r = $w.BoundingRect; if ($r.X -lt $x1) { $x1 = $r.X }; if ($r.Y -lt $y1) { $y1 = $r.Y }; if ($r.X + $r.Width -gt $x2) { $x2 = $r.X + $r.Width }; if ($r.Y + $r.Height -gt $y2) { $y2 = $r.Y + $r.Height } }
      $t = $ln.Text.Replace('\\', '\\\\').Replace('"', '\\"')
      if (-not $first) { [void]$sb.Append(',') }; $first = $false
      [void]$sb.Append('{"text":"' + $t + '","x":' + [int]$x1 + ',"y":' + [int]$y1 + ',"w":' + [int]($x2 - $x1) + ',"h":' + [int]($y2 - $y1) + '}')
    }
    [void]$sb.Append(']}')
    $s.Dispose()
    [Console]::Out.WriteLine($sb.ToString())
  } catch { [Console]::Out.WriteLine('{"err":"' + ($_.Exception.Message -replace '[\\\\"\\r\\n]', ' ') + '"}') }
  [Console]::Out.Flush()
}
`;
let _ocr = null;   // {proc, ready, max, queue:[resolve], buf, err}
function ocrStart() {
  if (_ocr || process.platform !== 'win32') return _ocr;
  const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(OCR_PS, 'utf16le').toString('base64')], { windowsHide: true });
  const o = _ocr = { proc, ready: null, max: 2600, q: [], buf: '' };
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (c) => {
    o.buf += c; let i;
    while ((i = o.buf.indexOf('\n')) >= 0) {
      const line = o.buf.slice(0, i).trim(); o.buf = o.buf.slice(i + 1); if (!line) continue;
      let j = null; try { j = JSON.parse(line); } catch (_) { j = { err: 'bad-json ' + line.slice(0, 80) }; }
      if (o.ready === null && 'ready' in j) { o.ready = !!j.ready; o.err = j.err || null; if (j.max) o.max = j.max; augLog('글자 읽기 ' + (o.ready ? `준비됨(최대 ${o.max}px)` : '못 씀: ' + o.err)); continue; }
      const r = o.q.shift(); if (r) r(j);
    }
  });
  proc.stderr.on('data', (c) => augLog('글자 읽기 오류 ' + String(c).slice(0, 200)));
  proc.on('exit', () => { for (const r of o.q) r({ err: 'exit' }); o.q = []; if (_ocr === o) _ocr = null; if (o.ready) augLog('글자 읽기 꺼짐'); });
  return o;
}
function ocrStop() { if (_ocr) { try { _ocr.proc.kill(); } catch (_) {} _ocr = null; } }
function ocrRead(file) {
  const o = ocrStart(); if (!o || o.ready === false) return Promise.resolve({ err: (o && o.err) || 'no-ocr' });
  return new Promise((resolve) => { const t = setTimeout(() => resolve({ err: 'timeout' }), 8000); o.q.push(j => { clearTimeout(t); resolve(j); }); try { o.proc.stdin.write(file + '\n'); } catch (e) { resolve({ err: e.message }); } });
}
const _augLog = [];
function augLog(m) { _augLog.push(`${new Date().toTimeString().slice(0, 8)} ${m}`); if (_augLog.length > 200) _augLog.shift(); try { console.log('[aug]', m); } catch (_) {} }

function gameDisplay() {
  let d = screen.getPrimaryDisplay();
  if (_lastRect) { const sf = d.scaleFactor || 1; d = screen.getDisplayNearestPoint({ x: Math.round(_lastRect[0] / sf), y: Math.round(_lastRect[1] / sf) }) || d; }
  return d;
}
async function captureDisplay(d, full) {   // → nativeImage(그 화면 · 실제 픽셀 크기)
  const { desktopCapturer } = require('electron');
  const W = Math.round(d.size.width * d.scaleFactor), H = Math.round(d.size.height * d.scaleFactor);
  const src = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: W, height: H } });
  const s = src.find(x => String(x.display_id) === String(d.id)) || src[0];
  return s ? s.thumbnail : null;
}
function augCrop(img) {   // 가운데(카드가 뜨는 곳)만 · 글자 읽기 최대 크기 안으로
  const { width: W, height: H } = img.getSize();
  const cw = Math.min(W, Math.round(H * 16 / 9)), x = Math.round((W - cw) / 2 + cw * 0.08), w = Math.round(cw * 0.84), y = Math.round(H * 0.12), h = Math.round(H * 0.66);
  let c = img.crop({ x, y, width: w, height: h }), k = 1;
  const max = (_ocr && _ocr.max) || 2600;
  if (w > max - 40) { k = (max - 40) / w; c = c.resize({ width: Math.round(w * k), quality: 'best' }); }
  return { img: c, x, y, k, H };
}
let _ingameAt = 0, augWin = null, augState = { lastScan: 0, hot: 0, lastLv: 0, busy: false, showing: null, lastSeen: 0, ix: null, ixAt: 0, global: null, globalAt: 0, champId: 0, n: 0 };
function myRaw() { const me = norm((account && account.gameName) || config.myName); return (_rawPlayers || []).find(p => norm(p.riotIdGameName || p.summonerName || (typeof p.riotId === 'string' ? p.riotId.split('#')[0] : '')) === me) || null; }
async function augNames() {
  if (augState.ix && Date.now() - augState.ixAt < 3600e3) return augState.ix;
  const augs = await getAugments();
  const names = Object.entries(augs || {}).map(([id, a]) => ({ id: Number(id), name: a.name })).filter(a => a.id >= 1000 && a.name && !a.name.startsWith('#'));
  if (names.length) { augState.ix = augscan.nameIndex(names); augState.ixAt = Date.now(); }
  return augState.ix;
}
async function augGlobal() {
  if (augState.global && Date.now() - augState.globalAt < 30 * 60e3) return augState.global;
  const g = await getJson(`${FIREBASE_DB}/${T}/augGuide/global.json`).catch(() => null);
  augState.global = (g && g.t) || augState.global || {}; augState.globalR = (g && g.r) || augState.globalR || {}; augState.globalAt = Date.now();
  return augState.global;
}
async function myChampId() {
  const me = myRaw(); if (!me) return 0;
  const alias = String(me.rawChampionName || '').replace(/^game_character_displayname_/i, '').toLowerCase();
  const champs = await getChamps();
  for (const [id, c] of Object.entries(champs || {})) if ((alias && String(c.alias).toLowerCase() === alias) || c.name === me.championName) return Number(id);
  return 0;
}
// 🎯 증강 이름 띠(v0.1.80) — 카드 제목 줄이 있는 가로 띠만(화면 높이 26~54% · 16:9 영역 가운데 84%) · 실기 3440×1440: 제목 줄 = 높이 40%
//   pr = 그 모니터의 실제 픽셀 사각형 → {x, y, w, h}(실제 픽셀) · 띠만 캡처(OCR 프로세스 「cap」)라 앱 메인 스레드는 안 멈춤
function augBand(pr) {
  const cw = Math.min(pr.width, Math.round(pr.height * 16 / 9));
  return { x: pr.x + Math.round((pr.width - cw) / 2 + cw * 0.08), y: pr.y + Math.round(pr.height * 0.26), w: Math.round(cw * 0.84), h: Math.round(pr.height * 0.28) };
}
const augCap = (x, y, w, h, k) => `cap ${Math.round(x)} ${Math.round(y)} ${Math.round(w)} ${Math.round(h)} ${k}`;
// 🎯 셋째 카드 다시 읽기(v0.1.79) — 띠 한 번에 읽으면 짧은 이름을 놓침(실기: 「무한 반복」→「口 하 B卜보」) → 찾은 두 장 간격으로
//   남은 자리(간격이 넓으면 가운데, 아니면 양옆)를 계산해 그 제목 줄만 2배로 키워 다시 읽음(실기: 「무한 반보」→ 무한 반복 0.75 · 한 번 65ms)
//   band = 띠(실제 픽셀) · 카드 좌표 = 띠 기준 · H = 화면 높이 · cmd = 읽기 명령 만들기(시험 땐 파일에서)
async function augThird(band, found, ix, H, cmd) {
  const [a, b] = found.cards, ca = a.x + a.w / 2, cb = b.x + b.w / 2, gap = cb - ca, y = Math.min(a.y, b.y), h = Math.max(a.h, b.h);
  for (const cx of gap > H * 0.5 ? [(ca + cb) / 2] : [cb + gap, ca - gap]) {
    const w = Math.round(H * 0.24), x = Math.round(cx - w / 2), yy = Math.round(y - h * 0.6), hh = Math.round(h * 2.4);
    if (x < 0 || x + w > band.w || yy < 0 || yy + hh > band.h) continue;
    const r = await ocrRead((cmd || augCap)(band.x + x, band.y + yy, w, hh, 2)); if (r.err) continue;
    for (const L of r.lines || []) {
      const m = augscan.matchLine(ix, L.text);
      if (m && !found.cards.some(c => c.id === m.id)) return Object.assign({ x: x + L.x / 2, y: yy + L.y / 2, w: L.w / 2, h: L.h / 2 }, m);
    }
  }
  return null;
}
async function augTick() {
  if (!config.augRank || !inGame || replayBusy || augState.busy || process.platform !== 'win32') return;
  const now = Date.now(), me = myRaw();
  if (me && me.level !== augState.lastLv) { if (augState.lastLv) augState.hot = now + 60000; augState.lastLv = me.level; }
  const hot = now < augState.hot || now - _ingameAt < 150000 || augState.showing;
  if (!hot && now - augState.lastScan < 5000) return;
  if (hot && now - augState.lastScan < (augState.showing ? 700 : 1200)) return;   // v0.1.108: 배지가 떠 있는 동안은 더 자주(고른 뒤 빨리 지우려고)
  augState.busy = true; augState.lastScan = now;
  try {
    const d = gameDisplay(), pr = screen.dipToScreenRect(null, d.bounds), band = augBand(pr);
    const r = await ocrRead(augCap(band.x, band.y, band.w, band.h, 1)); if (r.err) { if (augState.n++ < 5) augLog('읽기 실패 ' + r.err); return; }
    const ix = await augNames(); if (!ix) return;
    const found = augscan.findCards(ix, r.lines, pr.height);
    // v0.1.108: 카드가 안 보인 지 2.5초 → 1.5초(사장님: 이미 골랐는데 배지가 남아 있음 · 실제 지움은 대부분 아래 클릭 감지가 먼저)
    if (!found) { if (augState.showing && now - augState.lastSeen > 1500) augHide(); return; }
    if (found.cards.length === 2) { const c3 = await augThird(band, found, ix, pr.height).catch(() => null); if (c3) found.cards = found.cards.concat(c3).sort((p, q) => p.x - q.x); }
    augState.lastSeen = now;
    const ids = found.cards.map(c => c.id), sig = ids.join(',');
    if (augState.picked && now < augState.picked.until && ids.some(id => augState.picked.ids.includes(id))) return;   // 방금 고른 카드가 사라지는 중(애니메이션)에 다시 읽힘 → 다시 안 띄움
    if (augState.showing && augState.showing.sig === sig) return;   // 같은 카드면 그대로
    const champId = augState.champId || (augState.champId = await myChampId());
    const [guide, glob, rec, gg, ggi] = await Promise.all([getGuide(), augGlobal(), augRecords().catch(() => ({})), ggChamp(champId).catch(() => null), ggIndex().catch(() => null)]);
    const recMy = {}; for (const id of ids) { const x = rec[champId + ':' + id]; if (x) recMy[id] = x; }
    // 기준 이름 = 지금 하고 있는 챔피언(사장님: 「이 챔피언」 말고 실제 이름 · 신뢰성) — 라이브 클라 championName, 없으면 챔피언 번호로 찾은 이름
    let champName = (me && me.championName) || '';
    if (!champName && champId) { try { const ch = (await getChamps()) || {}; champName = (ch[champId] && ch[champId].name) || ''; } catch (_) {} }
    const ranks = augscan.rankAugs(ids, guideFor(champId, guide[champId], gg).guide, glob, recMy, augState.globalR, { champName, gg, ggG: ggi && ggi.g });   // 🧭 v0.1.100: aramgg 챔피언 등급 > aramgg 전체 > (없을 때만) arammayhem
    const sf = d.scaleFactor || 1, ox = band.x - pr.x, oy = band.y - pr.y;   // 띠 좌표(실제 픽셀) → 그 모니터 기준 화면 좌표(DIP)
    // v0.1.102: 배지 = 카드 **위쪽 빈 곳**(카드 위 끝 0.178H에 아래 끝을 0.015H 걸침 · 아이콘·이름·설명 안 가림) → 창 위 끝 = 화면 0.05H(게임 중 정보 띠 피함)
    //   ay = 배지 아래 끝(이름 줄 0.40H − 0.207H) · u = 화면 높이 1%(DIP) · cw = 카드 폭(0.296H)
    const top = Math.max(0, oy - Math.round(pr.height * 0.21)), lift = oy - top;
    const aug = await getAugments();
    // 📌 v0.1.109: 배지 자리 = 카드 **고정 칸**(사장님: 증강 뜰 때 배지가 이리저리 움직임) — 예전엔 읽은 이름 글자 위치로 매번 계산 → 카드가 미끄러져 들어오는 동안 읽히거나
    //   두 장 → 세 장으로 다시 그릴 때마다 위치가 달랐음 · 카드 칸 = 화면 가운데, 가운데 ± 0.340H(docs/screen-layout.md) · 이름 줄 = 0.40H → 읽기는 「몇 번째 칸의 어떤 증강」만 정함
    const mid = pr.width / 2 - ox, gap = pr.height * 0.340, slotX = c => mid + Math.max(-1, Math.min(1, Math.round((c.x + c.w / 2 - mid) / gap))) * gap;
    const ayFix = Math.max(60, lift + (pr.height * 0.40 - oy) - pr.height * 0.207);
    const cards = found.cards.map((c, i) => ({ x: c.x / sf, y: c.y / sf, w: c.w / sf, h: c.h / sf, ax: slotX(c) / sf, ay: ayFix / sf, u: pr.height / sf / 100, cw: pr.height * 0.296 / sf, rank: ranks[i].rank, why: ranks[i].why, tier: ranks[i].tier, scope: ranks[i].scope, extra: ranks[i].extra, wr: ranks[i].wr, pr: ranks[i].pr, name: (aug[c.id] || {}).name || '', combo: augCombo(c.id, gg, aug, ids, (guide[champId] && guide[champId].plans) || []) }));   // 띠 기준
    augState.showing = { sig, ids };
    // 🖱️ 카드 영역(실제 픽셀 · docs/screen-layout.md: 카드 너비 0.296H · 위 0.178H ~ 아래 0.66H · 리롤 버튼은 그 아래 0.69~0.73H라 안 겹침)
    augState.rects = found.cards.map(c => { const cx = band.x + slotX(c); return [cx - pr.height * 0.148, pr.y + pr.height * 0.178, cx + pr.height * 0.148, pr.y + pr.height * 0.66]; });
    augClickWatch();
    augLog(`증강 ${found.cards.map((c, i) => `${cards[i].name}(${c.score.toFixed(2)})=${ranks[i].rank}위`).join(' · ')} · 캡처 ${r.cap}ms · 읽기 ${r.ms}ms`);
    showAugRank(d, cards, { x: ox / sf, y: top / sf, width: band.w / sf, height: (lift + band.h) / sf });
  } catch (e) { augLog('오류 ' + e.message); } finally { augState.busy = false; }
}
// 🔗 v0.1.101: 이 카드와 조합이 좋은 증강(사장님: 실시간 추적 말고 「뜬 증강이 어떤 증강이랑 조합이 좋다」만 — 이미 뽑았으면 본인이 알고, 아니면 다음에 뜰 때 노림)
//   v0.1.104: 짝이 **지금 같이 뜬 다른 카드**인 조합은 뺌(사장님: 셋 중 하나만 고르니 의미 없음)
//   자료 두 곳(사장님: 정보가 부족하면 있는 데서 가져와야지) —
//     ① aramgg 3개 조합 승률(그 챔피언 · 사이트가 판 수 151+ 조합을 **챔피언당 5개만** 줌 = 2026-11-02 받기 기록으로 확인)
//     ② 그게 없으면 증강 가이드 플랜(arammayhem 편집 추천 조합 S~C · 사람이 고친 플랜 포함 · 증강 2개+) — 짝은 앞에서 2개, 나머지는 「+n」
function augCombo(id, gg, aug, ids, plans) {
  const meta = a => ({ id: a, name: (aug[a] || {}).name || '', icon: (aug[a] || {}).icon || '', rarity: (aug[a] || {}).rarity || '' });
  const onScreen = a => a !== id && ids.includes(a);
  const t = ((gg && gg.c) || []).find(c => c[0].includes(id) && !c[0].some(onScreen));
  if (t) return { src: 'aramgg', with: t[0].filter(a => a !== id).map(meta), wr: t[1], n: t[2], p: (gg && gg.p) || '' };
  const TSC = { 'S+': 10, S: 9, 'S-': 8, 'A+': 7, A: 6, 'A-': 5, 'B+': 4, B: 3, 'B-': 2, C: 1, D: 0 };
  const ps = (plans || []).filter(p => Array.isArray(p.augs) && p.augs.includes(id))
    .map(p => ({ p, rest: p.augs.filter(a => a !== id && !ids.includes(a)) })).filter(x => x.rest.length)
    .sort((x, y) => (TSC[y.p.tier] != null ? TSC[y.p.tier] : 5) - (TSC[x.p.tier] != null ? TSC[x.p.tier] : 5));
  if (!ps.length) return null;
  const x = ps[0], am = /arammayhem\.com/.test(String(x.p.link || ''));
  return { src: am ? 'arammayhem' : 'guide', with: x.rest.slice(0, 2).map(meta), more: Math.max(0, x.rest.length - 2), all: x.rest.map(a => (aug[a] || {}).name || '').filter(Boolean), date: x.p.date || '' };
}
function showAugRank(d, cards, area) {   // area = 띠(그 모니터 기준 DIP) — 투명 창을 띠 크기로만(v0.1.80: 예전엔 화면 전체 3440×1440 투명 창이 게임 위에 떠 합성 부담)
  const b = area ? { x: Math.round(d.bounds.x + area.x), y: Math.round(d.bounds.y + area.y), width: Math.round(area.width), height: Math.round(area.height) } : d.bounds;
  const send = () => { try { augWin.webContents.send('augrank', { cards: cards.map(c => Object.assign({}, c, { x: c.x, y: c.y })) }); } catch (_) {} };
  if (augWin && !augWin.isDestroyed()) { augWin.setBounds(b); send(); if (!augWin.isVisible()) augWin.showInactive(); return; }
  augWin = new BrowserWindow(Object.assign({}, b, {
    frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, show: false, hasShadow: false, roundedCorners: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  }));
  augWin.setAlwaysOnTop(true, 'screen-saver'); augWin.setIgnoreMouseEvents(true, { forward: true });   // v0.1.103: 클릭은 게임으로 · 마우스 움직임만 받아 배지에 올리면 설명
  augWin.webContents.on('did-finish-load', () => { if (augWin && !augWin.isDestroyed()) { send(); augWin.showInactive(); } });
  augWin.on('closed', () => { augWin = null; });
  augWin.loadFile('desktop/augrank.html');
}
function hideAugRank() { augClickStop(); if (augWin && !augWin.isDestroyed()) { try { augWin.destroy(); } catch (_) {} } augWin = null; }
function augHide() { augState.showing = null; hideAugRank(); }
// 🖱️ v0.1.108: 증강을 고르면 배지를 바로 지움(사장님: 고른 뒤에도 배지가 잠깐 남음 — 예전엔 화면 읽기 1.2초 간격 + 안 보인 지 2.5초라 최대 ~4초)
//   배지가 떠 있는 동안만 작은 PowerShell이 마우스 왼쪽 버튼을 25ms마다 봄(GetAsyncKeyState · 누르는 순간 「d x y」 = 실제 픽셀) → 카드 영역 안이면 고른 것
//   고른 카드 묶음은 4초 동안 다시 안 띄움(사라지는 애니메이션 중에 또 읽힘) · 리롤 버튼(카드 아래)·다른 곳 클릭은 무시 · 2분 지나면 스스로 끝남
const CLICK_PS = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
Add-Type -Name Ms -Namespace Tn -MemberDefinition '[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k); [DllImport("user32.dll")] public static extern bool GetCursorPos(out System.Drawing.Point p); [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -ReferencedAssemblies System.Drawing
[void][Tn.Ms]::SetProcessDPIAware()
$was = $true; $end = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $end) {
  $down = ([Tn.Ms]::GetAsyncKeyState(1) -band 0x8000) -ne 0
  if ($down -and -not $was) { $p = New-Object System.Drawing.Point; [void][Tn.Ms]::GetCursorPos([ref]$p); [Console]::Out.WriteLine("d $($p.X) $($p.Y)"); [Console]::Out.Flush() }
  $was = $down; Start-Sleep -Milliseconds 25
}`;
let _augClick = null;
function augClickWatch() {
  if (_augClick || process.platform !== 'win32') return;
  const p = _augClick = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(CLICK_PS, 'utf16le').toString('base64')], { windowsHide: true });
  let buf = '';
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', c => {
    buf += c; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const m = /d (-?\d+) (-?\d+)$/.exec(buf.slice(0, i).trim()); buf = buf.slice(i + 1); if (!m || !augState.showing) continue;   // 줄 끝 기준(PowerShell 진행 표시 #< CLIXML이 앞에 붙어도)
      const x = +m[1], y = +m[2], hit = (augState.rects || []).some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
      if (hit) { augState.picked = { ids: augState.showing.ids || [], until: Date.now() + 4000 }; augLog('카드 클릭 → 배지 지움'); augHide(); }
    }
  });
  p.on('error', () => {});
  p.on('exit', () => { if (_augClick === p) _augClick = null; });
}
function augClickStop() { if (_augClick) { try { _augClick.kill(); } catch (_) {} _augClick = null; } }
async function sendAugShot() {   // Shift+F8 — 지금 게임 화면 + 읽은 글자 → 개발용 비공개 저장소(위치·글자 맞추기)
  if (!inGame || !potg) return;
  try {
    const d = gameDisplay(), img = await captureDisplay(d); if (!img) return;
    const cr = augCrop(img), file = path.join(os.tmpdir(), 'tn-aug.png'); fs.writeFileSync(file, cr.img.toPNG());
    const r = config.augRank ? await ocrRead(file) : { err: 'off' };
    const sz = img.getSize(), name = `${dayKey()}-${Date.now().toString(36)}-${sz.width}x${sz.height}`;
    const jpg = img.toJPEG(88);
    const ok1 = await potg.uploadShot(`aug-shots/${name}.jpg`, jpg);
    const ok2 = await potg.uploadShot(`aug-shots/${name}.json`, Buffer.from(JSON.stringify({ app: app.getVersion(), who: config.myName, display: { w: sz.width, h: sz.height, sf: d.scaleFactor }, crop: { x: cr.x, y: cr.y, k: cr.k }, ocr: r, log: _augLog.slice(-40) }, null, 1)));
    showToast(ok1 && ok2 ? '증강 화면을 보냈어요' : '보내기 실패', ok1 && ok2 ? '개발용 저장소 · 위치 맞추는 데 써요' : '인터넷·저장소 설정 확인');
  } catch (e) { augLog('보내기 오류 ' + e.message); }
}

// ── 폴링 루프 ──────────────────────────────────────────────────────────────
async function pollGame() {
  if (replayBusy) return;   // 🎬 팟지 리플레이 녹화 중 = 리플레이 게임 창이라 실제 게임 아님(패널 숨김·「기록 저장 중」·수집이 잘못 켜지지 않게)
  const list = await liveClientPlayerList();
  const nowIn = Array.isArray(list);
  if (nowIn) { sampleActive = false; unmuteLeftover(); }   // 실게임 시작 → 미리보기 해제 · 🔇 지난 녹화에서 못 푼 리플레이 음소거가 있으면 풂
  else if (sampleActive) return;            // 미리보기 유지 중(실게임 아님) → 건드리지 않음
  if (nowIn) {
    _rawPlayers = list;
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
    else { setTimeout(tryInstallUpdate, 90000); hideOverlay(); userHid = false; latestPlayers = []; _lastRaise = null; evalRaise(); recGameEnded(); if (potg) potg.stopCollect(bridge.getGameId()).catch(() => {}); }   // 🎬 수집 올림   // 게임 종료 → 로비 층위 재적용 · 📼 「기록 저장 중」 시작
    broadcast('state', { inGame, label: inGame ? '게임 중' : '대기' });
    if (!inGame) { setTimeout(() => ratingUpdate(true), 90000);   // 🏅 판 끝 → 전적에 들어간 뒤 점수 다시
      _rawPlayers = []; ingameHidden = false; hideIngame(); hideAugRank(); ocrStop(); augState.showing = null; setTimeout(() => { if (!inGame) borderlessOff(); }, 4000); }
    else { _ingameAt = Date.now(); Object.assign(augState, { hot: 0, lastLv: 0, showing: null, champId: 0, n: 0 }); }   // 🎯 새 게임 → 증강 순위 처음부터   // 🖥️ 게임 끝 → 정보 창 닫고 화면 모드 원래대로
  }
  if (inGame && config.ingame && !ingameHidden) ingameUpdate(_rawPlayers);
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

// ── 🚪 방(v0.1.94 · 사장님: 방 만들기 = 만든 사람이 방장 · 방 목록에서 들어가기 · 공개/비공개(비밀번호) · 아무도 없으면 사라짐) ──────────
//   예전엔 대기실·판·방장이 서버 전체에 하나라 다른 무리가 앱을 깔면 같은 방에 섞였음(배포 위험 점검 3번)
//   today/roomList/{방} = { name, priv, pw(비공개 = sha256(방:비밀번호)), host(방장 이름), at(만든 시각), seen(방 사람 앱이 20초마다), by }
//   today/rooms/{방}/{session·lobby·host·normalLive·potgWait·potgRec·bridge} = 예전 today/ 아래 그 노드들 그대로(방마다)
//   방에 있는 사람 = presence.room · 기록(days)은 그대로 한곳 + roomName → 「오늘」 순위는 방 이름별(이름 없는 옛 기록은 모든 방에) · 프로필은 합침
//   📦 v0.1.110 방 단위 데이터(사장님: 다른 팀이 와도 섞이지 않고 서버가 사람 수 제곱으로 안 늘게):
//     · 방 사람 = rooms/{방}/members/{puuid}(방 스트림 안 → 그 방 사람만 받음) · 전역 presence는 쓰기만(아무도 실시간으로 안 받음 · 옛 앱 호환)
//     · 방 목록 스트림 = 방 밖(방 고르는 화면)일 때만 · 방장(방장이 40초 넘게 조용하면 남은 사람)이 roomList에 seen·n(인원)·mem(이름) 갱신
//     · 앱당 실시간 연결 1개(방 밖 = 방 목록 · 방 안 = 방) → 자리 기준 30 → 80
//     · 「오늘」 = 서버에서 방 이름으로 골라 받음(.indexOn roomName) + 같은 방 번호이거나, 이름만 같으면 지금 방 사람이 그 판에 있었을 때만(sameGroup)
//   ⚠️ 비공개 = 목록 자물쇠 + 앱의 비밀번호 확인까지(서버 읽기는 누구나 — 규칙 참고)
let room = null, roomListRaw = null, runSession = null, _autoHostAt = 0, _gcAt = 0;   // room = { id, name, priv, h }
const RP = () => `${T}/rooms/${room ? room.id : '_none'}`;   // 방 밖이면 쓰지 않음(각 함수가 room 확인 · _none은 규칙상 쓰기 거절)
const roomGet = name => room ? getJson(`${FIREBASE_DB}/${T}/rooms/${room.id}/${name}.json`) : Promise.resolve(null);
const ROOM_GONE_MS = 90000, ROOM_GRACE_MS = 120000;   // 방 사람 앱이 90초 넘게 소식 없으면 사라짐(업데이트로 다 같이 다시 켜는 30초는 버팀) · 막 만든 방은 2분 봐줌
const pwHash = (id, pw) => require('crypto').createHash('sha256').update(`${id}:${pw}`).digest('hex');
// 🚦 v0.1.96: 자리 — 무료 요금제 동시 연결 100개(앱당 실시간 연결 3개 = 약 33명 · 짧은 요청은 안 셈 · 실측) → 켤 때 자리부터 보고 꽉 찼으면 실시간 연결을 아예 안 엶
//   이미 들어와 있는 사람은 그대로(다시 확인 안 함) · 30초마다 다시 보고 자리 나면 들어감
//   세는 것 = today/conns/{기기} = 마지막 신호 시각(롤 로그인 안 한 앱도 연결은 쓰니 접속 표시 대신 기기 단위) · 기준 = config/connCap(기본 30 · 동시에 켜는 사람 여유)
const CONN_CAP = 80, CONN_MS = 20000, CONN_STALE_MS = 10 * 60 * 1000;   // v0.1.110: 앱당 실시간 연결 1개 → 80(동시에 켜는 여유 20)
let seatFull = null, _live = false, _connN = 0;   // seatFull = { n, cap } = 꽉 차서 기다리는 중
function connBeat() {
  fbSet(`${T}/conns/${config.deviceId}`, Date.now()).catch(() => {});
  if (++_connN % 15) return;   // 5분마다 오래된 기기 정리(앱이 갑자기 꺼진 것)
  getJson(`${FIREBASE_DB}/${T}/conns.json`).then(c => { for (const [k, v] of Object.entries(c || {})) if (!(Date.now() - v < CONN_STALE_MS)) fbSet(`${T}/conns/${k}`, null).catch(() => {}); }).catch(() => {});
}
function startLive() {   // v0.1.110: 실시간 연결 1개 = 방 밖이면 방 목록 · 방 안이면 그 방(roomStreams가 바꿔 끼움)
  _live = true;
  roomStreams();
  connBeat(); setInterval(connBeat, CONN_MS);
}
async function seatGate() {
  const [c, capRaw] = await Promise.all([getJson(`${FIREBASE_DB}/${T}/conns.json`), getJson(`${FIREBASE_DB}/${T}/config/connCap.json`)]);
  const cap = Number.isInteger(capRaw) && capRaw > 0 ? capRaw : CONN_CAP, now = Date.now();
  const n = Object.entries(c || {}).filter(([k, v]) => k !== config.deviceId && now - v < ONLINE_MS).length;   // 나는 빼고(업데이트로 다시 켠 건 내 자리 그대로)
  if (n >= cap) { seatFull = { n, cap }; broadcastRooms(); setTimeout(seatGate, 30000); return; }
  seatFull = null; startLive(); broadcastRooms();
}
function roomMembers(id) {
  const now = Date.now();
  return Object.entries(presenceRaw || {}).filter(([, p]) => p && p.room === id && p.name && now - (p.at || 0) < ONLINE_MS).map(([key, p]) => ({ key, name: normName(p.name), icon: p.icon || null }));
}
function roomsView() {
  const now = Date.now(), rooms = [];
  for (const [id, r] of Object.entries(roomListRaw || {})) {
    if (!r || !r.name) continue;
    const mine = !!(room && room.id === id);
    if (!mine && now - Math.max(r.seen || 0, r.at || 0) > ROOM_GONE_MS) continue;   // 사라지는 중(방 사람 앱이 90초 넘게 소식 없음)
    const mem = mine ? roomMembers(id).map(m => m.name) : String(r.mem || '').split('\n').filter(Boolean);   // 다른 방 = 방장이 적어 둔 인원·이름(v0.1.110)
    rooms.push({ id, name: r.name, priv: !!r.priv, host: r.host || null, n: mine ? mem.length : (Number(r.n) || mem.length), members: mem.slice(0, 10), at: r.at || 0, mine });
  }
  rooms.sort((a, b) => b.mine - a.mine || b.n - a.n || b.at - a.at);
  return { rooms, room: room ? { id: room.id, name: room.name, priv: room.priv } : null, me: config.myName || '', ready: !!(MIR.roomList && MIR.roomList.ready), full: seatFull };
}
const broadcastRooms = () => broadcast('rooms', roomsView());
// ⚡ v0.1.95: 방 노드 스트림 7개(session·lobby·host·normalLive·potgWait·potgRec·eogStats) → **방 하나에 스트림 1개**(rooms/{방})
//   무료 요금제 동시 연결 100개 — 앱당 9개(약 11명) → 3개(접속 표시·방 목록·방 · 약 33명) · 받는 건 똑같이 바뀐 칸만
//   바뀐 칸 가르기 = 사본은 바뀐 길만 새 객체(mirSet)라 안 바뀐 칸은 같은 객체 → 이전과 === 비교 · 큰 점검 기록·5초 하트비트는 브릿지 FIXED_ROOT(방 밖)로
let _roomPrev = null;
const roomPart = (name, fetcher) => MIR.room && MIR.room.ready ? Promise.resolve(((MIR.room.data || {})[name]) || null) : fetcher();
function roomStreams() {   // 방 바뀜 → 방 스트림 다시(예전 방 데이터는 버림)
  mirClose('room'); _roomPrev = null;
  sessionData = null; lobbyRaw = null; presenceRaw = null; lastFormed = 0; normalLive = null; potgRecRaw = null; potgWaitRaw = null;
  if (room) mirClose('roomList');   // 📦 v0.1.110: 방 안에선 방 목록을 실시간으로 안 받음(방 고르는 화면에서만)
  else if (_live && !MIR.roomList) fbMirror('roomList', d => { roomListRaw = d || null; broadcastRooms(); roomRejoin(); });   // 🚪 방 목록
  onHostRec(null);
  try { bridge.setRoot(room ? `${RP()}/bridge` : `${T}/bridge`); } catch (_) {}
  broadcast('lobby', lobbyView()); broadcast('session', { session: null, myName: config.myName || '' });
  if (!room || !runSession) return;
  fbMirror('room', d => {
    const p = _roomPrev || {}, c = d || {}; _roomPrev = c;
    if (p.lobby !== c.lobby) { lobbyRaw = c.lobby || null; broadcast('lobby', lobbyView()); }               // ⚡ 대기실(참가·방식·팀장)
    if (p.members !== c.members) { presenceRaw = c.members || null; broadcast('lobby', lobbyView()); broadcastRooms(); }   // 📦 v0.1.110: 방 사람(들어오고 나감)
    if (['session', 'host', 'normalLive', 'potgWait', 'potgRec'].some(k => p[k] !== c[k])) runSession();     // ⚡ 판·방장·팟지(일반 판·기다림·녹화 안내)
    if ((p.bridge && p.bridge.eogStats) !== (c.bridge && c.bridge.eogStats) && config.isHost) runHost();      // ⚡ 경기 종료 → 방장 앱이 바로 기록
  }, RP());
}
async function roomJoin(id, pw, hash) {
  if (!account) return { ok: false, err: '롤에 로그인하면 방에 들어갈 수 있어요' };
  if (!_live) return { ok: false, err: '지금은 자리가 꽉 찼어요' };
  const r = (roomListRaw || {})[id] || await getJson(`${FIREBASE_DB}/${T}/roomList/${id}.json`);
  if (!r || !r.name) return { ok: false, err: '없어진 방이에요' };
  let h = null;
  if (r.priv) {
    h = hash || (pw ? pwHash(id, String(pw).trim()) : null);
    if (h !== r.pw) return { ok: false, needPw: true, err: pw || hash ? '비밀번호가 틀렸어요' : '비밀번호를 넣어주세요' };
  }
  if (room && room.id === id) return { ok: true };
  if (room) await roomLeave(true);
  room = { id, name: r.name, priv: !!r.priv, h };
  config.lastRoom = { id, h }; saveConfig();
  roomStreams();
  await beatPresence();
  broadcastRooms(); if (runSession) runSession();
  return { ok: true };
}
async function roomCreate(name, priv, pw) {
  if (!account) return { ok: false, err: '롤에 로그인하면 방을 만들 수 있어요' };
  if (!_live) return { ok: false, err: '지금은 자리가 꽉 찼어요' };
  const nm = normName(String(name || '')).slice(0, 20) || `${account.gameName}의 방`, p = String(pw || '').trim();
  if (priv && !p) return { ok: false, err: '비밀번호를 정해주세요' };
  const id = 'r' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6), now = Date.now();
  const meta = { name: nm, priv: !!priv, pw: priv ? pwHash(id, p) : null, host: account.gameName, at: now, seen: now, by: account.gameName };
  const w = await fbSet(`${T}/roomList/${id}`, meta); if (!w.ok) return w;
  await fbSet(`${T}/rooms/${id}/host`, { puuid: account.puuid, name: account.gameName, at: now });   // 👑 만든 사람 = 방장(방 스트림이 받아 자동으로 방장이 됨)
  roomListRaw = Object.assign({}, roomListRaw, { [id]: meta });
  return roomJoin(id, null, meta.pw);
}
async function roomLeave(quiet) {
  if (!room) return { ok: true };
  const id = room.id;
  if (config.isHost) {   // 👑 남은 사람에게 넘김(없으면 비움)
    const next = roomMembers(id).filter(m => !account || m.key !== account.puuid).sort((a, b) => a.key.localeCompare(b.key))[0];
    if (next) await handHost(next.key).catch(() => {}); else await releaseHost().catch(() => {});
  }
  if (account) fbSet(`${T}/rooms/${id}/lobby/join/${account.puuid}`, null).catch(() => {});
  if (account) fbSet(`${T}/rooms/${id}/members/${account.puuid}`, null).catch(() => {});   // 📦 방 사람 칸
  room = null; config.lastRoom = null; saveConfig();
  roomStreams();
  await beatPresence();
  broadcastRooms();
  if (!quiet) try { showMainPanel(); } catch (_) {}
  return { ok: true };
}
function roomAutoHost() {   // 👑 방장이 없거나 1분 넘게 응답 없으면 → 방에 남은 사람 중 첫째(계정 번호순)가 자동으로 이어받음(사장님: 방장이 나가면 남은 사람에게)
  if (!room || !account || config.isHost || (hostRec && hostAlive(hostRec)) || Date.now() - _autoHostAt < 10000) return;
  const first = roomMembers(room.id).sort((a, b) => a.key.localeCompare(b.key))[0];
  if (first && first.key === account.puuid) { _autoHostAt = Date.now(); claimHost().catch(() => {}); }
}
async function roomGc() {   // 🧹 아무도 없는 방 지우기(아무 앱이나 · 30초마다)
  if (Date.now() - _gcAt < 30000 || !(MIR.roomList && MIR.roomList.ready)) return;   // 📦 v0.1.110: 방 목록을 보는 앱(방 밖)만
  _gcAt = Date.now();
  for (const [id, r] of Object.entries(roomListRaw || {})) {
    if (room && room.id === id) continue;
    if (r && r.name && Date.now() - Math.max(r.seen || 0, r.at || 0) < ROOM_GONE_MS) continue;   // 방 사람 앱이 90초 안에 소식 있으면 둠
    await fbSet(`${T}/roomList/${id}`, null).catch(() => {});
    await fbSet(`${T}/rooms/${id}`, null).catch(() => {});
  }
  if (Date.now() - _orphanAt < 300000) return;   // 🛡️ v0.1.97: 방 목록에 없는 방 데이터(목록 밖에 만든 쓰레기 등) 5분마다 정리
  _orphanAt = Date.now();
  const all = await getJson(`${FIREBASE_DB}/${T}/rooms.json?shallow=true`).catch(() => null);
  for (const id of Object.keys(all || {})) {
    if ((roomListRaw || {})[id] || (room && room.id === id)) continue;
    if (await getJson(`${FIREBASE_DB}/${T}/roomList/${id}.json`).catch(() => 1) !== null) continue;   // 막 만든 방(목록 스트림이 아직 안 옴)은 서버에서 한 번 더 확인
    await fbSet(`${T}/rooms/${id}`, null).catch(() => {});
  }
}
let _orphanAt = Date.now();
function roomRejoin() {   // 앱을 다시 켜면(업데이트 등) 있던 방으로 — 그 방이 아직 있으면
  const L = config.lastRoom;
  if (room || !account || !L || !L.id || !(MIR.roomList && MIR.roomList.ready)) return;
  const r = (roomListRaw || {})[L.id];
  if (!r || !r.name) { config.lastRoom = null; saveConfig(); return; }
  roomJoin(L.id, null, L.h).then(x => { if (!x.ok) { config.lastRoom = null; saveConfig(); } }).catch(() => {});
}
const fetchSession   = () => roomGet('session');
const fetchLobby     = () => roomGet('lobby');
const fetchEog       = () => roomGet('bridge/eogStats');
const fetchPresence  = () => room ? roomGet('members') : Promise.resolve(null);   // 👤 v0.1.110: 이 방 사람(rooms/{방}/members · 예전 = 전역 presence 전체)
// 📦 그날 기록 중 이 방 것만 — 서버에서 방 이름으로 골라 받음(.indexOn roomName · 방 생기기 전 날은 통째) · 이름만 같은 다른 모임은 sameGroup으로 거름
const ROOMS_SINCE = '2026-11-02';
async function fetchDayRoom(kind, day) {
  const base = `${FIREBASE_DB}/${T}/days/${day}/${kind}.json`;
  if (!room || day < ROOMS_SINCE) return getJson(base);
  const r = await getJson(`${base}?orderBy=${encodeURIComponent('"roomName"')}&equalTo=${encodeURIComponent(JSON.stringify(room.name))}`);
  return r && r.error ? getJson(base) : r;   // 서버 규칙에 색인이 없으면(옛 규칙) 통째
}
const fetchDay = day => fetchDayRoom('matches', day);
function sameGroup(m) {   // 이 방 기록인가(방 밖이면 전부 · 방 생기기 전 이름 없는 옛 기록은 모든 방에)
  if (!room || !m || !m.roomName) return true;
  if (m.roomId === room.id) return true;
  if (m.roomName !== room.name) return false;
  // 이름만 같은 다른 방(방을 다시 만들었거나 · 이름이 같은 다른 모임) → 지금 이 방 사람(나 포함)이 그 판에 있었으면 같은 모임
  const mine = new Set(Object.keys(presenceRaw || {}).concat(account ? [account.puuid] : []));
  for (const p of Object.values(m.ids || {}).concat((m.stats || []).map(x => x && x.puuid))) if (p && mine.has(p)) return true;
  return false;
}

// ── 👤 라이엇 계정 = 나 (롤 클라에 로그인된 계정으로 자동 입장 · 사이트 닉네임 안 씀) ──
// 표시 이름 = 라이엇 게임 이름. 저장 키 = puuid(계정 고유 ID·닉변해도 유지).
// 친구가 같은 PC에서 자기 계정으로 바꿔 로그인하면 브릿지가 감지 → 자동 전환(방장은 해제).
let account = null;   // { puuid, gameName, tagLine }
const PRESENCE_MS = 20000, ONLINE_MS = 60000;
let _presenceTimer = null;
async function beatPresence() {
  if (!account) {   // 클라 잠깐 꺼짐 — 방장 자리만 살아있게(2분)
    if (_away && config.isHost && room) fbCas(`${RP()}/host`, cur => cur && cur.puuid === _away.puuid ? { value: { puuid: cur.puuid, name: cur.name, at: Date.now() } } : { err: 'not mine' }).catch(() => {});
    return;
  }
  const pres = { name: account.gameName, tag: account.tagLine || null, icon: account.iconId || null, at: Date.now(), host: !!config.isHost, app: app.getVersion(), room: room ? room.id : null };
  await fbSet(`${T}/presence/${account.puuid}`, pres).catch(() => {});   // 전역(아무도 실시간으로 안 받음 · 옛 앱 호환·관리용)
  if (!room) return;
  fbSet(`${RP()}/members/${account.puuid}`, pres).catch(() => {});   // 📦 v0.1.110: 방 사람 = 방 스트림 안(그 방 사람만 받음)
  if (config.isHost || !hostRec || Date.now() - (hostRec.at || 0) > 40000) {   // 🚪 방 살아있음 + 인원·이름(방 목록에 보임) — 방장 한 명만(방장이 조용하면 남은 사람이)
    const mem = roomMembers(room.id).map(m => m.name); if (!mem.includes(normName(account.gameName))) mem.unshift(normName(account.gameName));
    fbUpdate(`${T}/roomList/${room.id}`, Object.assign({ name: room.name, priv: !!room.priv, pw: room.priv ? room.h : null, seen: Date.now(), n: mem.length, mem: mem.slice(0, 10).join('\n').slice(0, 400) }, config.isHost ? { host: account.gameName } : {})).catch(() => {});
  }
  if (config.isHost) fbCas(`${RP()}/host`, cur => cur && cur.puuid === account.puuid ? { value: { puuid: cur.puuid, name: cur.name, at: Date.now() } } : { err: 'not mine' }).catch(() => {});   // 👑 방장 살아있음 표시
}
// 🔌 롤 클라를 잠깐 끈 것(게임 끝나고 껐다 켜기 등)은 로그아웃으로 치지 않음 — 같은 계정이 2분 안에 돌아오면 방장·참가 그대로
//    (전엔 클라를 끄는 순간 방장이 풀려서, 롤을 다시 켜 전적에서 결과를 복구해도 기록해 줄 방장이 없었음)
const AWAY_GRACE_MS = 2 * 60 * 1000;
let _away = null, _awayTimer = null;   // 클라 꺼짐으로 잠깐 없는 내 계정
function releaseAccount(prev) {   // 이전 계정의 접속 표시·방장·대기실 참가 정리
  fbSet(`${T}/presence/${prev.puuid}`, null).catch(() => {});
  if (room) fbSet(`${RP()}/members/${prev.puuid}`, null).catch(() => {});
  if (config.isHost) { config.isHost = false; fbSet(`${RP()}/host`, null).catch(() => {}); broadcast('account', { account, isHost: false }); broadcast('host', hostView()); }
  fbSet(`${RP()}/lobby/join/${prev.puuid}`, null).catch(() => {});
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
    setTimeout(() => ratingUpdate(true), 20000);   // 🏅 롤 로그인 → 전적 점수
  }
  broadcast('account', { account, isHost: !!config.isHost, switched: !!(prev && acc && prev.puuid !== acc.puuid) });
  broadcast('myname', config.myName);
  broadcast('session', { session: sessionData, myName: config.myName });
  onHostRec(hostRec);
}
async function getRoster() {   // 방장 참가자 목록 = 지금 접속 중 + 오늘 뛴 사람
  const [pres, t] = await Promise.all([fetchPresence(), getToday()]);
  const now = Date.now(), online = [];
  for (const [puuid, p] of Object.entries(pres || {})) if (p && p.name && now - (p.at || 0) < ONLINE_MS && room && p.room === room.id) online.push({ puuid, name: normName(p.name), tag: p.tag || '', host: !!p.host });
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
const fetchHost = () => roomGet('host');
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
  if (!room) return { ok: false, err: '먼저 방에 들어가거나 방을 만들어요' };
  const me = account;
  const r = await fbCas(`${RP()}/host`, cur => {
    if (cur && cur.puuid && cur.puuid !== me.puuid && hostAlive(cur)) return { err: `${cur.name}님이 이미 방장이에요` };
    return { value: { puuid: me.puuid, name: me.gameName, at: Date.now() } };
  });
  if (!r.ok) return r;
  hostRec = r.value; setHostLocal(true);
  return { ok: true };
}
async function releaseHost() {
  if (account) await fbCas(`${RP()}/host`, cur => cur && cur.puuid === account.puuid ? { value: null } : { err: 'not mine' }).catch(() => {});
  hostRec = null; setHostLocal(false);
  return { ok: true };
}
async function handHost(puuid) {
  if (!config.isHost || !account) return { ok: false, err: '방장만 넘겨줄 수 있어요' };
  const p = ((await fetchPresence()) || {})[puuid];
  if (!p || !p.name || Date.now() - (p.at || 0) >= ONLINE_MS || !room || p.room !== room.id) return { ok: false, err: '지금 이 방에 있는 사람에게만 넘길 수 있어요' };
  const me = account;
  const r = await fbCas(`${RP()}/host`, cur => cur && cur.puuid === me.puuid
    ? { value: { puuid, name: normName(p.name), at: Date.now(), from: me.gameName } } : { err: '방장이 아니에요' });
  if (!r.ok) return r;
  hostRec = r.value; setHostLocal(false, `${normName(p.name)}님에게 방장을 넘겼어요`);
  fbUpdate(`${T}/roomList/${room.id}`, { host: normName(p.name) }).catch(() => {});   // 🚪 방 목록 방장 이름 바로
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
    if (!p || !p.name || now - (p.at || 0) >= ONLINE_MS || !room || p.room !== room.id) continue;   // 🚪 이 방 사람만
    members.push({ key: puuid, name: normName(p.name), tag: p.tag || '', icon: p.icon || null, ver: p.app || null, online: true, host: !!(hostRec && hostRec.puuid === puuid && hostAlive(hostRec)), me: !!(account && account.puuid === puuid), st: stOf(puuid) || 'in' });   // 접속하면 바로 자리에(고르는 중 없음) · 관전은 본인/방장이 바꿈
  }
  if (room) for (const [k, j] of Object.entries(join)) if (j && j.guest && j.day === today && !members.some(m => m.name === normName(j.name))) members.push({ key: k, name: normName(j.name), guest: true, online: false, st: stOf(k) });
  const ord = { in: 0, null: 1, spec: 2 };
  members.sort((a, b) => (ord[a.st] - ord[b.st]) || (b.online - a.online) || a.name.localeCompare(b.name, 'ko'));
  const caps = L.captains || {};
  const inNames = members.filter(m => m.st === 'in').map(m => m.name);
  const sd = L.sides || {}, sides = {};
  for (const n of inNames) { const t = sd[fbKeyOf(n)]; if (t === 'teamA' || t === 'teamB') sides[n] = t; }
  return { members, sides, mode: ['draft', 'manual', 'normal'].includes(L.mode) ? L.mode : 'random', captains: { teamA: inNames.includes(caps.teamA) ? caps.teamA : null, teamB: inNames.includes(caps.teamB) ? caps.teamB : null },
    hostName: hostRec && hostAlive(hostRec) ? hostRec.name : null, hostStale: hostRec && !hostAlive(hostRec) ? hostRec.name : null, isHost: !!config.isHost, latest: latestVer(members), room: room ? { id: room.id, name: room.name, priv: room.priv } : null };
}
// 🔄 버전 비교(v0.1.56) — 대기실 내 자리 「업데이트 필요」·내 안내 줄
const verCmp = (a, b) => { const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
function latestVer(members) {   // 내 앱 · 받는 중/받은 새 버전 · 접속한 사람들 앱 중 가장 높은 것
  let v = app.getVersion();
  if (upd.version && (upd.state === 'ready' || upd.state === 'downloading')) v = verCmp(upd.version, v) > 0 ? upd.version : v;
  for (const m of members || []) if (m.ver && verCmp(m.ver, v) > 0) v = m.ver;
  return v;
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
  return lobbyWrite(fbSet(`${RP()}/lobby/join/${k}`, val));
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
async function lobbySetMode(mode, auto) {
  if (!config.isHost) return { ok: false, err: '방장만 방식을 정할 수 있어요' };
  const m = ['draft', 'manual', 'normal'].includes(mode) ? mode : 'random';   // normal = 🎮 일반판 진행(v0.1.60 · 팀짜기 없음)
  if (!auto && m !== 'normal' && config.lastTeamMode !== m) { config.lastTeamMode = m; saveConfig(); }   // 일반판에서 내전으로 돌아올 때 쓸 방식
  lobbyLocal(L => { L.mode = m; });
  return lobbyWrite(fbUpdate(`${RP()}/lobby`, { mode: m }));
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
  return lobbyWrite(fbSet(`${RP()}/lobby/captains`, caps));
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
  return lobbyWrite(fbSet(`${RP()}/lobby/sides/${k}`, t));
}
async function lobbySidesPrev() {   // 지난 판 팀 그대로(지금 판 → 없으면 오늘 마지막 경기 기록)
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  let A = sessionData && sessionData.teamA, B = sessionData && sessionData.teamB;
  if (!(A && A.length && B && B.length)) {
    const ms = await fetchDay(dayKey());
    const last = Object.values(ms || {}).filter(m => m && m.teamA && m.teamB && sameGroup(m)).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
    if (last) { A = last.teamA; B = last.teamB; }
  }
  if (!(A && A.length && B && B.length)) return { ok: false, err: '오늘 지난 판 팀이 없어요' };
  const sides = {}; for (const n of A) sides[fbKeyOf(n)] = 'teamA'; for (const n of B) sides[fbKeyOf(n)] = 'teamB';
  lobbyLocal(L => { L.sides = sides; L.mode = 'manual'; });
  return lobbyWrite(fbUpdate(`${RP()}/lobby`, { sides, mode: 'manual' }));
}
async function lobbySidesClear() {
  if (!config.isHost) return { ok: false, err: '방장만 할 수 있어요' };
  lobbyLocal(L => { L.sides = null; });
  return lobbyWrite(fbSet(`${RP()}/lobby/sides`, null));
}
async function lobbyStart() {   // ▶ 방장: 참가자로 팀 짜기 시작(대기실에서 정한 방식)
  if (!config.isHost) return { ok: false, err: '방장만 시작할 수 있어요' };
  const [L, P] = await Promise.all([fetchLobby(), fetchPresence()]);
  lobbyRaw = L || null; presenceRaw = P || null;
  const v = lobbyView(), names = v.members.filter(m => m.st === 'in').map(m => m.name);
  if (names.length < 2) return { ok: false, err: `참가자가 2명 이상이어야 해요 (지금 ${names.length}명)` };
  if (v.mode === 'normal') return { ok: false, err: '일반판은 시작 버튼 없이 같은 팀으로 큐를 잡으면 돼요' };
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
  const r = await fbUpdate(`${RP()}/session`, { phase: 'lobby', pendingEog: null });
  pollSession();
  return r;
}

// 없을 때만 생성(조건부 PUT) — 같은 경기를 두 기기가 동시에 기록해도 한 번만 저장(412=이미 있음)
// 🛡️ v0.1.97: 새 경기 기록엔 서버 시각 sv — 규칙이 sv 6시간 안에만 투표·팟지 칸 쓰기 허용(지난 경기 결과 못 바꿈 · PC 시계가 틀려도 정확)
const withSv = rec => Object.assign({}, rec, { sv: { '.sv': 'timestamp' } });
async function fbPutIfAbsent(pathStr, value) {
  const tok = await fbToken();
  if (!tok) return { ok: false, err: '인증 실패(네트워크 확인)' };
  const u = new URL(`${FIREBASE_DB}/${pathStr}.json${authQ(tok)}`);
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
  if (!_live) return;   // 🚦 자리 기다리는 중(서버에서 읽지도 않음)
  const [s, lob, h, pres, np, pr, pw] = await Promise.all([roomPart('session', fetchSession), roomPart('lobby', fetchLobby), roomPart('host', fetchHost), roomPart('members', fetchPresence),
    roomPart('normalLive', () => roomGet('normalLive')), roomPart('potgRec', () => roomGet('potgRec')),
    roomPart('potgWait', () => roomGet('potgWait'))]);   // 📡 스트림 사본(끊겼을 때만 서버에서)
  normalLive = np || null; potgRecRaw = pr || null; potgWaitRaw = pw || null;
  sessionData = s || null;
  lobbyRaw = lob || null; presenceRaw = pres || null;
  onHostRec(h);
  roomRejoin(); roomAutoHost(); roomGc().catch(() => {});   // 🚪 다시 켰으면 있던 방으로 · 방장 없으면 남은 사람이 이어받음 · 빈 방 정리
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
  { // 🔴 팀원: 다른 PC가 내가 있던 판의 팟지를 녹화 중이면 같은 안내(2분 반 넘게 소식 없으면 끝난 걸로)
    const R = potgRecRaw, me = config.myName;
    const on = !_recLocal && R && R.who && me && norm(R.who) !== norm(me) && Date.now() - (R.at || 0) < 150000 && !inGame
      && (R.players || []).some(n => norm(n) === norm(me)) && !(potgWin && !potgWin.isDestroyed() && potgWin.isVisible());
    if (on) showRecToast(`${R.who}님 PC에서 리플레이로 찍는 중 · 곧 팟지가 떠요`, R.pct ? { pct: R.pct, left: R.left } : null);
    else if (!_recLocal && recToastWin) hideRecToast();
  }
  { // ⏳ 팟지 기다림 화면(2026-11-01) — 녹화하는 동안 그 판에 있던 사람(관전 포함)에게 가운데 창으로 예측 투표·이번 판 기록·킬 지도·증강·오늘 순위
    const W = potgWaitRaw, me = config.myName;
    const mine = W && W.gameId && me && Date.now() - (W.at || 0) < 300000 && !inGame && (W.players || []).some(n => norm(n) === norm(me));
    if (mine) { _waitSeen = Date.now(); if (_potgMode !== 'play' && _waitClosed !== W.gameId) openPotgWait(W).catch(() => {}); }
    else if (_potgMode === 'wait' && Date.now() - _waitSeen > 8000) closePotg();   // 팟지가 안 뜨고 끝났으면(카드 없음 등) 닫음 · 공개되면 openPotg가 이어받음
  }
  autoSeat();   // 🪑 팀이 정해진 순간·재시도(자리 감지는 바뀔 때만 와서 여기서도)
  if (config.isHost) runHost();
}

// ── 🎬 팟지 창 — 롤 클라 가운데(클라 없으면 화면 가운데) · 영상 재생이라 투명 창 아님 ─────────
let potgWin = null, _potgSeen = null, normalLive = null;
function potgBounds() {
  let cx, cy, cw, ch;
  if (_lastRect && !_floating) { const sf = screen.getPrimaryDisplay().scaleFactor || 1; cx = _lastRect[0] / sf; cy = _lastRect[1] / sf; cw = (_lastRect[2] - _lastRect[0]) / sf; ch = (_lastRect[3] - _lastRect[1]) / sf; }
  else { const wa = screen.getPrimaryDisplay().workArea; cx = wa.x; cy = wa.y; cw = wa.width; ch = wa.height; }
  const W = Math.round(Math.max(560, Math.min(960, cw * 0.66))), H = Math.round(Math.min(ch * 0.92, W * 9 / 16 + 36));   // 영상 칸 = 정확히 16:9(위 띠 34+테두리 2) · 2026-11-01: +136이라 칸이 1.51:1 → 영상이 1.17배 커지며 양옆 잘림
  return { x: Math.round(cx + (cw - W) / 2), y: Math.round(cy + (ch - H) / 2), width: W, height: H };
}
let _potgMode = null;   // 'wait'(⏳ 녹화 기다림 화면) · 'play'(팟지 재생)
function openPotg(card, manual) {
  if (inGame || !card || card.none) return;
  _potgMode = 'play';
  const send = () => { try { potgWin.webContents.send('potg', { card, manual: !!manual }); } catch (_) {} };
  if (potgWin && !potgWin.isDestroyed()) { potgWin.setBounds(potgBounds()); send(); potgWin.showInactive(); return; }
  makePotgWin(send);
}
function makePotgWin(send) {
  potgWin = new BrowserWindow(Object.assign(potgBounds(), {
    show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, roundedCorners: false, backgroundColor: '#060b10',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' },
  }));
  try { potgWin.setAlwaysOnTop(true, 'floating'); } catch (_) {}
  potgWin.webContents.on('did-finish-load', () => { send(); if (potgWin) potgWin.showInactive(); });
  potgWin.loadFile('potg/potg.html');
  potgWin.on("closed", () => { potgWin = null; _potgMode = null; });
}
function closePotg() { if (potgWin && !potgWin.isDestroyed()) { try { potgWin.destroy(); } catch (_) {} } potgWin = null; _potgMode = null; }
// ── ⏳ 팟지 기다림 화면(2026-11-01 사장님: 녹화하는 1~2분이 붕 뜸) ──────────────────────────────────────
//   녹화하는 앱이 today/potgWait {gameId, path, kind, at, who, players, cands(후보 2~3 · 이름순이라 정답을 안 드러냄), hero, kills(롤 전적 타임라인 킬 위치·시각), guess/{키}:{i,name}} 를 쓰고
//   공개할 때 맞힌 사람을 경기 기록 guess·카드 guess로 옮긴 뒤 지움 → 그 판 사람(관전 포함) 앱이 가운데 창에 기다림 화면 · ✕로 닫으면 그 판엔 다시 안 뜸(팟지는 그대로 뜸)
let potgWaitRaw = null, _waitClosed = null, _waitSeen = 0, _waitCache = null;
async function killTimeline(gameId) {   // 롤 전적 타임라인(게임 끝나고 바로 받아짐 · 실측 4판 모두 첫 시도) → 챔피언 킬 위치·시각
  if (!bridge || !bridge.lcuRaw) return null;
  const [tl, g] = await Promise.all([bridge.lcuRaw('GET', `/lol-match-history/v1/game-timelines/${gameId}`), bridge.lcuRaw('GET', `/lol-match-history/v1/games/${gameId}`)]);
  if (!(tl && tl.status === 200 && tl.data && Array.isArray(tl.data.frames))) return null;
  const part = {}; for (const p of ((g && g.data && g.data.participants) || [])) part[p.participantId] = { c: p.championId, tm: p.teamId };
  const out = [];
  for (const f of tl.data.frames) for (const e of (f.events || [])) if (e.type === 'CHAMPION_KILL' && e.position) {
    const k = part[e.killerId] || {}, v = part[e.victimId] || {};
    out.push({ t: Math.round((e.timestamp || 0) / 100) / 10, x: e.position.x, y: e.position.y, k: k.c || 0, v: v.c || 0, tm: k.tm || (v.tm === 100 ? 200 : 100) });
  }
  return out.slice(0, 120);
}
async function potgWaitStart(card, g) {   // 녹화하는 앱(방장) — 녹화 시작 때
  const players = card.normal ? (card.normal.us || []) : [...((sessionData && sessionData.teamA) || []), ...((sessionData && sessionData.teamB) || []), ...((sessionData && sessionData.spectators) || [])];
  const cands = [card].concat(card.alts || []).map(c => ({ name: c.name, champ: c.champ || '', championId: c.championId || 0, label: c.label || '', team: c.team || null }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));   // 이름순 = 정답 위치를 안 드러냄
  await fbSet(`${RP()}/potgWait`, { gameId: String(g.id), path: g.path, kind: card.normal ? 'normal' : 'match', at: Date.now(), who: config.myName || null, players, cands: cands.length >= 2 ? cands : null, hero: !!card.hero });
  const k = await killTimeline(g.id).catch(() => null);
  if (k && k.length) await fbSet(`${RP()}/potgWait/kills`, k).catch(() => {});
}
async function potgWaitFinish(card, recPath) {   // 공개 직전 — 예측 결과를 경기 기록·카드에 남기고 지움
  const W = await roomPart('potgWait', () => roomGet('potgWait')).catch(() => null);
  if (!W || String(W.gameId) !== String(card.gameId)) return;
  const picks = W.guess || {}, cands = W.cands || [];
  if (cands.length >= 2 && Object.keys(picks).length) {
    const ans = cands.findIndex(c => norm(c.name) === norm(card.name));
    const right = Object.values(picks).filter(v => v && v.i === ans).map(v => v.name);
    card.guess = { right, n: Object.keys(picks).length };
    const pk = {}; for (const [k, v] of Object.entries(picks)) if (v && cands[v.i]) pk[k] = cands[v.i].name;
    await fbUpdate(recPath, { guess: { answer: card.name, right, picks: pk } }).catch(() => {});
  }
  await fbSet(`${RP()}/potgWait`, null).catch(() => {});
}
async function waitToday(W) {   // 오늘 순위 변화(이 판 빼고 → 넣고) + 오늘의 예측왕 + (일반 판이면) 오늘 같이 한 일반 판
  const day = String(W.path || '').split('/')[2];
  const [raw0, nraw] = await Promise.all([fetchDay(day), fetchDayRoom('normals', day)]);
  const raw = {}; for (const [k, m] of Object.entries(raw0 || {})) if (m && sameGroup(m)) raw[k] = m;   // 📦 v0.1.110: 이 방 기록만(예전엔 그날 모든 방)
  const after = computeToday(raw).standings, rest = {};
  for (const [k, v] of Object.entries(raw || {})) if (String(k) !== String(W.gameId)) rest[k] = v;
  const before = computeToday(rest).standings, pre = {}; before.forEach(p => { pre[p.name] = p.rank; });
  const rows = after.map(p => ({ name: p.name, rank: p.rank, prev: pre[p.name] || null, w: p.wins, l: p.losses, streak: p.streak, mvp: p.mvp, here: (W.players || []).some(n => normName(n) === p.name) }));
  const kings = {};
  for (const m of [...Object.values(raw || {}), ...Object.values(nraw || {})]) for (const n of ((m && m.guess && m.guess.right) || [])) kings[n] = (kings[n] || 0) + 1;
  const ns = Object.values(nraw || {}).filter(m => m && Array.isArray(m.us));
  return { rows, kings: Object.entries(kings).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 5), normal: ns.length ? { w: ns.filter(m => m.win).length, l: ns.filter(m => !m.win).length } : null };
}
async function waitView(W) {
  if (!_waitCache || _waitCache.id !== W.gameId) _waitCache = { id: W.gameId, rec: null, today: null, augs: null, at: 0 };
  const C = _waitCache;
  if ((!C.rec || !C.today) && Date.now() - C.at > 6000) {
    C.at = Date.now();
    const [rec, today, augs] = await Promise.all([getJson(`${FIREBASE_DB}/${W.path}.json`).catch(() => null), waitToday(W).catch(() => null), getAugments().catch(() => ({}))]);
    if (rec) C.rec = rec; if (today) C.today = today; C.augs = augs;
  }
  const rec = C.rec || {}, used = {};
  const stats = (rec.stats || []).map(p => {
    for (const a of (p.augments || [])) if (C.augs && C.augs[a]) used[a] = { name: C.augs[a].name, icon: C.augs[a].icon, rarity: C.augs[a].rarity };
    return { n: p.summonerName, c: p.championId, cn: p.championName, tm: p.teamId, win: !!p.isWin, k: p.kills || 0, d: p.deaths || 0, a: p.assists || 0, dmg: p.damage || 0,
      tk: (p.taken || 0) + (p.mitig || 0), heal: (p.healMates || 0) + (p.shieldMates || 0), selfHeal: p.heal || 0, cc: p.cc || 0, gold: p.gold || 0, cs: p.cs || 0, fb: !!p.firstBlood,
      multi: p.pentaKills ? 5 : p.quadraKills ? 4 : p.tripleKills ? 3 : p.doubleKills ? 2 : 0, aug: p.augments || [] };
  });
  const me = config.myName || '', g = W.guess || {}, counts = {};
  for (const v of Object.values(g)) if (v && Number.isInteger(v.i)) counts[v.i] = (counts[v.i] || 0) + 1;
  const mine = g[fbKeyOf(me)];
  const P = _recLocal ? Object.assign({ sub: _recToastMsg.sub }, recProgNow() || {}) : potgRecRaw ? { pct: potgRecRaw.pct, left: potgRecRaw.left, sub: potgRecRaw.sub } : null;
  const votes = W.kind === 'match' && sessionData && sessionData.game && String(sessionData.game.id) === String(W.gameId) ? { done: Object.keys(sessionData.votes || {}).length, all: [...(sessionData.teamA || []), ...(sessionData.teamB || [])].length } : null;
  return { gameId: W.gameId, kind: W.kind, who: W.who, hero: !!W.hero, me, skipped: W.skipped || null, canSkip: !!_recLocal && !_potgSkip, cands: W.cands || [], counts, mine: mine ? mine.i : null, voters: Object.keys(g).length,
    kills: W.kills || [], gameTime: rec.gameTime || null, stats, augs: used, today: C.today, prog: P, votes, queue: rec.queue || null };
}
async function openPotgWait(W) {
  const v = await waitView(W);
  if (_potgMode === 'play' && potgWin && !potgWin.isDestroyed()) return;
  _potgMode = 'wait';
  const send = () => { try { potgWin.webContents.send('potg-wait', v); } catch (_) {} };
  if (potgWin && !potgWin.isDestroyed()) { send(); if (!potgWin.isVisible()) { potgWin.setBounds(potgBounds()); potgWin.showInactive(); } return; }
  makePotgWin(send);
}
function waitProgPush() {   // 0.5초마다(녹화하는 앱) — 진행 막대만
  if (_potgMode !== 'wait' || !potgWin || potgWin.isDestroyed()) return;
  const p = recProgNow(); try { potgWin.webContents.send('potg-wait-prog', Object.assign({ sub: _recToastMsg.sub }, p || {})); } catch (_) {}
}

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
    else await fbUpdate(`${RP()}/session`, { pendingEog: { gameId: eog.gameId, winSide: eog.winSide || null, at: Date.now() } });   // 이름 매칭 실패 → 방장이 승리팀 직접 선택
    return;
  }
  if (s.phase === 'draft') {
    if (s.turnEndsAt && Date.now() > s.turnEndsAt + 1000) await draftPick(null, true);   // ⏱️ 시간 초과 → 남은 사람 중 무작위
    return;
  }
  if ((s.phase === 'vote' || s.phase === 'result') && s.game && (!s.potg || s.potg.gameId !== String(s.game.id))) hostPotg(s).catch(() => {});   // 🎬
  if (s.potg && s.potg.pending && !replayBusy && Date.now() - (s.potg.pendingAt || 0) > (s.potg.hero ? 340000 : 260000)) {   // 🎬 녹화하던 방장 앱이 꺼졌거나 넘겨받음 → 카드로라도 보여줌
    const c = Object.assign({}, s.potg, { pending: null, pendingAt: null, showAt: Date.now() + 1500 });
    if (s.game) await potgWaitFinish(c, `${T}/days/${s.game.day}/matches/${s.game.id}`).catch(() => {});
    await fbUpdate(`${RP()}/session`, { potg: c }); if (s.game) await fbUpdate(`${T}/days/${s.game.day}/matches/${s.game.id}`, { potg: c });
  }
  if (s.phase === 'vote' && s.game) {
    const voters = [...(s.teamA || []), ...(s.teamB || [])];
    const votes = s.votes || {};
    if (voters.length && voters.every(n => votes[fbKeyOf(n)])) await closeVote();   // 전원 투표 → 자동 확정
  }
}
// 🎬 팟지 고르기(방장) — 모든 PC의 수집이 모이면(최대 25초 기다림) 점수 1위 장면 → session.potg(showAt=모두 같이 시작할 시각)
let _potgBusy = false, _potgFor = null;
// 🛡️ 숨은 영웅은 판이 클 때만(v0.1.81 · 사장님: 서브 팟지는 최소 6인 대전은 돼야) — 1:1·2:2는 한타라 부를 장면이 없어 평범한 장면이 뽑힘
const HERO_MIN_PLAYERS = 6;
const heroAllowed = n => n >= HERO_MIN_PLAYERS;
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
    if (!card) { await fbUpdate(`${RP()}/session`, { potg: { none: true, gameId: String(s.game.id) } }); return; }
    card.gameId = String(s.game.id);
    try { card.splash = await potg.splashFor(card.championId, card.skin); } catch (_) {}   // 🖼️ 소개 배경 = 그 사람이 낀 스킨 일러스트
    try {   // 🛡️ 숨은 영웅(v0.1.44) — 팟지 주인공 말고, 킬 아닌 장면(광역 이니시·버티기·세이브·한타 설계) 하나 더
      const hero = heroAllowed((s.teamA || []).length + (s.teamB || []).length) ? potg.pickHero(raws, s, rec && rec.stats, card.name, { avoid: [card.clipFrom, card.clipTo] }) : null;   // 팟지와 같은 한타는 숨은 영웅으로 안 고름 · 인원 적으면 없음
      if (hero) { try { hero.splash = await potg.splashFor(hero.championId, hero.skin); } catch (_) {} card.hero = hero; }
    } catch (e) { console.log('[potg] 숨은 영웅 고르기 오류', e && e.message); }
    const publish = async () => {   // 모두에게 보여주기(showAt = 다 같이 시작할 시각)
      if (card.skipped) {   // 🚫 녹화한 사람이 건너뜀 → 팟지 없음(카드도 안 띄움)
        const none = await skipPublish(card, `${T}/days/${s.game.day}/matches/${s.game.id}`), cur = sessionData && sessionData.game;
        if (!cur || String(cur.id) === card.gameId) await fbUpdate(`${RP()}/session`, { potg: none });
        return;
      }
      await potgWaitFinish(card, `${T}/days/${s.game.day}/matches/${s.game.id}`).catch(() => {});   // 🔮 예측 결과
      card.pending = null; card.pendingAt = null; card.showAt = Date.now() + 1500;
      await fbUpdate(`${T}/days/${s.game.day}/matches/${s.game.id}`, { potg: card });
      const cur = sessionData && sessionData.game;   // 녹화하는 사이 다음 판이 기록됐으면 지금 판 팟지를 덮지 않음(경기 기록에만 남김)
      if (!cur || String(cur.id) === card.gameId) await fbUpdate(`${RP()}/session`, { potg: card });
    };
    if (!app.isPackaged && process.env.TN_FAKE_CLIP) {   // 🧪 개발용: 리플레이 녹화 대신 이 파일을 영상으로 올림
      try { card.clip = await potg.uploadClip(s.game.id, fs.readFileSync(process.env.TN_FAKE_CLIP), /\.mp4$/i.test(process.env.TN_FAKE_CLIP) ? 'video/mp4' : 'video/webm'); } catch (_) {}
      if (card.hero && process.env.TN_FAKE_CLIP2) try { card.hero.clip = await potg.uploadClip(s.game.id + 'h', fs.readFileSync(process.env.TN_FAKE_CLIP2), /\.mp4$/i.test(process.env.TN_FAKE_CLIP2) ? 'video/mp4' : 'video/webm'); } catch (_) {}
      return publish();
    }
    if (!replayRec || process.platform !== 'win32') return publish();
    // 🎬 리플레이 녹화(방장 PC) — 그동안은 「준비 중」(showAt 없음 → 아무 창도 안 뜸) · 3분 넘거나 실패하면 카드로
    await fbUpdate(`${RP()}/session`, { potg: Object.assign({}, card, { pending: true, pendingAt: Date.now() }) });
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
  if (!room) { console.log('[normal] 방에 없음 — 같이 한 판 기록 안 함'); return; }
  const acc = {}; for (const m of roomMembers(room.id)) acc[m.key] = true;   // 🚪 v0.1.94: 같은 방 사람끼리만(예전 = 한 번이라도 앱 켠 사람 전부)
  const byTeam = {};
  for (const p of e.players) if (p.puuid && acc[p.puuid] && p.summonerName) (byTeam[p.teamId] = byTeam[p.teamId] || []).push(p);
  const side = Object.keys(byTeam).sort((a, b) => byTeam[b].length - byTeam[a].length)[0];
  const us = side ? byTeam[side] : [];
  if (us.length < NORMAL_MIN) { console.log(`[normal] 앱 켠 친구 ${us.length}명 — 같이 한 판 아님`); return; }
  const gid = String(e.gameId), day = dayKey(), win = us[0].isWin != null ? !!us[0].isWin : (e.winSide === 'blue') === (Number(side) === 100);
  const ids = {}; for (const p of us) ids[fbKeyOf(p.summonerName)] = p.puuid;
  const rec = { gameId: gid, day, ts: Date.now(), source: e.source || 'eog', queueId: e.queueId == null ? null : e.queueId, gameMode: e.gameMode || null, queue: queueName(e.queueId, e.gameMode),
    side: Number(side), win, us: us.map(p => p.summonerName), ids, gameTime: e.gameTime || 0, stats: e.players, by: config.myName || '', roomName: room.name, roomId: room.id };
  const w = await fbPutIfAbsent(`${T}/days/${day}/normals/${gid}`, withSv(rec));
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
    const hero = heroAllowed(rec.us.length * 2) ? potg.pickHero(raws, s, rec.stats, card.name, Object.assign({ avoid: [card.clipFrom, card.clipTo] }, opt)) : null;   // 팟지와 같은 한타는 숨은 영웅으로 안 고름 · 일반 판은 우리 팀 앱 인원 ×2로 셈(3명+)
    if (hero) { hero.normal = card.normal; try { hero.splash = await potg.splashFor(hero.championId, hero.skin); } catch (_) {} card.hero = hero; }
  } catch (err) { console.log('[normal] 숨은 영웅 고르기 오류', err && err.message); }
  const publish = async () => {
    if (card.skipped) { await skipPublish(card, path); return; }   // 🚫 녹화한 사람이 건너뜀 → 팟지 없음
    await potgWaitFinish(card, path).catch(() => {});   // 🔮 예측 결과
    card.pending = null; card.pendingAt = null; card.showAt = Date.now() + 1500;
    await fbUpdate(path, { potg: card });
    await fbSet(`${RP()}/normalLive`, card);
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
const CLIP_MAX = 40 * 1048576;   // 이보다 크면 안 올림 → 카드 · v0.1.71: 12→40MB(영상은 GitHub = 받는 양 제한 없음 · 화질 올림)
let _recLog = [];   // 🎬 녹화 기록(경기 기록 potgRec에 남김 → tools/potg-report.cjs로 어디서 멈췄는지 확인)
// 🎬 팟지 녹화 중 안내(v0.1.56 · 방장 PC) — 리플레이 창을 화면 밖에 숨기고 녹화해서 소리만 남(사장님: 방장이 녹화 중인 걸 알아야 함)
//   → 롤 클라 위쪽 가운데(클라 없으면 화면 위쪽 가운데)에 작은 창 · 클릭 통과 · 녹화 로그(onRecLog)에 맞춰 단계 글만 바뀜
let recToastWin = null, _recToastMsg = { title: '팟지 녹화 중', sub: '리플레이 준비 중…' }, _recParts = 1, _recCur = 1;
function recToastBounds() {
  const W = 400, H = 80, sf = (screen.getPrimaryDisplay().scaleFactor) || 1;   // 80 = 퍼센트 막대 줄(2026-11-01)
  if (_lastRect && !_floating) { const cx = _lastRect[0] / sf, cy = _lastRect[1] / sf, cw = (_lastRect[2] - _lastRect[0]) / sf; return { x: Math.round(cx + (cw - W) / 2), y: Math.round(cy + 14), width: W, height: H }; }
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: Math.round(wa.x + (wa.width - W) / 2), y: wa.y + 16, width: W, height: H };
}
function showRecToast(sub, prog) {
  if (sub != null) _recToastMsg = Object.assign({}, _recToastMsg, { title: '팟지 녹화 중', sub });
  if (prog !== undefined) Object.assign(_recToastMsg, { pct: prog ? prog.pct : null, left: prog ? prog.left : null });
  if (_potgMode === 'wait' && potgWin && !potgWin.isDestroyed() && potgWin.isVisible()) { hideRecToast(); return; }   // ⏳ 기다림 화면에 같은 막대가 있음
  if (recToastWin && !recToastWin.isDestroyed()) { try { recToastWin.webContents.send('rec-toast', _recToastMsg); } catch (_) {} return; }
  recToastWin = new BrowserWindow(Object.assign(recToastBounds(), {
    frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, show: false, hasShadow: false, roundedCorners: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  }));
  recToastWin.setAlwaysOnTop(true, 'screen-saver'); recToastWin.setIgnoreMouseEvents(true);
  recToastWin.webContents.on('did-finish-load', () => { if (recToastWin && !recToastWin.isDestroyed()) { recToastWin.webContents.send('rec-toast', _recToastMsg); recToastWin.showInactive(); } });
  recToastWin.on('closed', () => { recToastWin = null; });
  recToastWin.loadFile('desktop/rec.html');
}
function showToast(title, sub, ms) {   // 짧은 안내(녹화 안내 창 재사용 · 녹화 중이면 안 띄움)
  if (_recLocal) return;
  _recToastMsg = { title, sub, pct: null }; showRecToast();
  setTimeout(() => { if (!_recLocal) hideRecToast(); }, ms || 3000);
}
const AUG_SHOT_KEY = 'Shift+F8';
function regAugShot() { try { if (!globalShortcut.isRegistered(AUG_SHOT_KEY)) globalShortcut.register(AUG_SHOT_KEY, () => { sendAugShot().catch(() => {}); }); } catch (_) {} }
function hideRecToast() { if (recToastWin && !recToastWin.isDestroyed()) { try { recToastWin.destroy(); } catch (_) {} } recToastWin = null; }
// 🔴 팀원에게도(v0.1.57) — 녹화하는 앱이 단계마다 today/potgRec {at, who, players, sub}를 적고 끝나면 지움 → 그 판에 있던 사람 앱은 pollSession(3초)에서 읽어 같은 안내
let _recLocal = false, _recPlayers = [], potgRecRaw = null;
function recStage(sub) {   // 내 PC 녹화 단계 → 내 안내 + 서버
  showRecToast(sub, recProgNow());
  recPush();
}
function recPush() { const p = recProgNow(); fbSet(`${RP()}/potgRec`, { at: Date.now(), who: config.myName || null, players: _recPlayers, sub: _recToastMsg.sub, pct: p ? p.pct : null, left: p ? p.left : null }).catch(() => {}); }
function recEnd() { _recLocal = false; recProgStop(); hideRecToast(); fbSet(`${RP()}/potgRec`, null).catch(() => {}); }
// 📊 녹화 진행 퍼센트(2026-11-01 사장님: 얼마나 걸리는지 보이게) — 시작 때 장면마다 예상 시간(실측 로그 기준: 열기 ~10초 · 연출 카메라 미리 보기 = 구간/2 + 상대마다 2.2초
//   · 녹화 = 구간 실제 시간 + 2.5초 · 올리기 4초/영상)
//   실측 맞춤(자야: 미리 보기 끝 22.2초·녹화 끝 42.2초 → 예상 23.0·44.0 / 제이스: 23.5·45.5 → 24.2·47.6)을 더해 total → 지난 시간으로 차오르되 다음 단계 표시(열림·미리 보기 끝·장면 끝·닫음) 전에는 그 직전에서 기다리고,
//   단계가 실제로 오면 그 지점으로 맞춤(늦으면 멈춰 있다가 따라잡음 · 빠르면 건너뜀) · 0.5초마다 안내 창, 2초마다 서버(팀원 안내)
let _recProg = null, _recProgTimer = null;
function recProgStart(parts) {
  const PRE = makeReplayRec.PRE || 3, marks = [['open', 6]]; let t = 6;   // 리플레이를 새로 받아야 하면 ~8초 더(그동안은 6초 직전에서 기다림)
  parts.forEach((p, i) => {
    const warm = Math.max(0, p.from - PRE - 2); t += 0.5;
    if (p.direct) { t += (p.to + 0.6 - warm) / 2 + 0.5 + ((p.direct.victims || []).length) * 1.9; marks.push(['scout' + (i + 1), t]); }
    t += (p.to - warm) + 1 + slowExtra(p.speed, warm, p.to); marks.push(['rec' + (i + 1), t]);   // 🐢 슬로 구간을 느리게 찍는 만큼 더
  });
  t += 0.5; marks.push(['close', t]); t += 2 + 4 * parts.length;
  _recProg = { total: t, marks, sec: 0, at: Date.now(), cap: marks[0][1] - 0.5 };
  clearInterval(_recProgTimer); let n = 0;
  _recProgTimer = setInterval(() => { if (!_recLocal || !_recProg) return recProgStop(); showRecToast(null, recProgNow()); waitProgPush(); if (++n % 4 === 0) recPush(); }, 500);
}
function recProgNow() {
  const P = _recProg; if (!P) return null;
  const est = Math.min(P.sec + (Date.now() - P.at) / 1000, P.cap);
  return { pct: Math.max(1, Math.min(99, Math.round(est / P.total * 100))), left: Math.max(1, Math.round(P.total - est)) };
}
function recProgMark(key) {
  const P = _recProg; if (!P) return; const m = P.marks.find(x => x[0] === key); if (!m) return;
  const est = Math.min(P.sec + (Date.now() - P.at) / 1000, P.cap);
  P.sec = Math.max(est, m[1]); P.at = Date.now();
  const nx = P.marks.find(x => x[1] > P.sec + 0.01); P.cap = nx ? nx[1] - 0.5 : P.total - 0.5;
}
function recProgStop() { clearInterval(_recProgTimer); _recProgTimer = null; _recProg = null; }
function onRecLog(m) {   // replayrec 로그 → 안내 글
  if (!_recLocal) return;   // ⚠️ v0.1.90: 안내 창(recToastWin) 유무로 막으면 안 됨 — 기다림 화면(v0.1.89)이 뜨면 안내 창을 닫아서 단계 맞춤이 전부 빠져 막대가 첫 단계 직전(몇 %)에서 멈춰 있었음
  const sc =() => _recParts > 1 ? `장면 ${_recCur}/${_recParts}` : '장면';
  const mm = /── 장면 (\d+)/.exec(m); if (mm) _recCur = +mm[1];
  if (m.includes('리플레이 열림')) recProgMark('open');   // 📊 진행 퍼센트 단계 맞춤
  if (m.includes('연출 카메라: 주인공 위치') || m.includes('주인공 위치 기록 실패')) recProgMark('scout' + _recCur);
  if (m.includes('녹화 구간 끝')) recProgMark('rec' + _recCur);
  if (m.includes('리플레이 닫음')) recProgMark('close');
  if (m.includes('리플레이 받기')) recStage('리플레이 받는 중…');
  else if (m.includes('리플레이 준비됨')) recStage('리플레이 여는 중… (소리가 잠깐 나요)');
  else if (m.includes('되감기')) recStage(`${sc()} 준비 중…`);
  else if (m.includes('연출 카메라: 주인공 위치')) recStage(`${sc()} 녹화 준비 중…`);
  else if (m.includes('녹화 중') && !_recToastMsg.sub.startsWith(`${sc()} 녹화 중`)) recStage(`${sc()} 녹화 중 · 들리는 소리는 리플레이예요`);
  else if (m.includes('리플레이 닫음')) recStage('영상 정리하고 올리는 중… (곧 끝나요)');
}
// 🎥 팟지 카메라 시야(v0.1.80) — 리플레이 기본 50 + 위에서 비스듬히(56°) 내려다봐 주인공이 화면 아래쪽에 놓이고, 1.15배로 잘라내 아래가 잘렸음
//   (사장님: 본인이 잘 안 보일 때 · 먼 사거리) → 잘라내기 없앰 + 시야 60 · 사거리 500+(Data Dragon stats.attackrange)나 원거리로 바뀌는 챔피언은 68
//   실측(자야 트리플킬 880~893 · 50/55/70 비교): 50은 둘째 킬 때 자야가 화면 맨 아래 가장자리(잘라낸 영역 밖) · 70은 화면 안
const FOV_BASE = 60, FOV_RANGED = 68, RANGED_FORMS = new Set([126, 76, 10, 150, 60]);   // 제이스·니달리·케일·나르·엘리스(기본 사거리는 근접으로 나옴)
let _ranges = null, _rangesAt = 0;
async function champRanges() {
  if (_ranges && Date.now() - _rangesAt < 12 * 3600e3) return _ranges;
  try {
    const v = ((await getJson('https://ddragon.leagueoflegends.com/api/versions.json')) || [])[0];
    const d = v ? await getJson(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`) : null, m = {};
    for (const c of Object.values((d && d.data) || {})) m[Number(c.key)] = c.stats && c.stats.attackrange;
    if (Object.keys(m).length) { _ranges = m; _rangesAt = Date.now(); }
  } catch (_) {}
  return _ranges || {};
}
async function potgFov(championId) { const r = (await champRanges())[championId]; return RANGED_FORMS.has(Number(championId)) || r >= 500 ? FOV_RANGED : FOV_BASE; }
// 🐢 v0.1.120: 슬로 구간을 리플레이에서 **미리 느리게 재생하며** 녹화(사장님: 슬로가 버벅임 — 30장 영상을 팟지 화면이 0.3배로 틀어 1초 9장이었음)
//   롤 리플레이 /replay/sequence `playbackSpeed` 키프레임(게임 시각) → 그 구간도 실제 시간 1초 30장으로 찍힘 → 팟지 화면은 그 구간을 1배속으로(potg/potg.js timeMap·spdAt)
//   구간·속도 ⚠️ potg/potg.js와 같게: 팟지 = 마지막 킬 −0.7~+FREEZE_AFTER 0.3배 · 중간 킬 −0.45~+0.3 0.4배(rateFor) · 숨은 영웅 = 핵심 −0.6~+0.35 0.35배(playHeroVideo rateAt)
const FREEZE_AFTER = 0.15, SLOW_RAMP = 0.03;
const potgSlow = ms => { const last = ms[ms.length - 1]; return g => { for (const m of ms) { if (m === last ? g >= m - 0.7 && g <= m + FREEZE_AFTER : g >= m - 0.45 && g <= m + 0.3) return m === last ? 0.3 : 0.4; } return 1; }; };
const heroSlow = peak => g => (g >= peak - 0.6 && g <= peak + 0.35 ? 0.35 : 1);
function slowKeys(spAt, bounds) {   // 속도 함수 + 바뀌는 지점들 → [[게임 초, 속도], …](바뀌는 곳마다 SLOW_RAMP초 경사) · 슬로 없으면 null
  const bs = [...new Set(bounds.filter(Number.isFinite).map(b => +b.toFixed(3)))].sort((a, b) => a - b), keys = [];
  let prev = 1;
  for (const b of bs) {
    const nx = spAt(b + 1e-4); if (nx === prev) continue;
    const t0 = Math.max(b, keys.length ? keys[keys.length - 1][0] + 0.001 : b);
    keys.push([+t0.toFixed(3), prev], [+(t0 + SLOW_RAMP).toFixed(3), nx]); prev = nx;
  }
  return keys.length ? keys : null;
}
const spdAt = (K, g) => { if (!K || !K.length) return 1; if (g <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (g <= K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; return va + (vb - va) * ((g - a) / Math.max(1e-6, b - a)); } return K[K.length - 1][1]; };   // potg/potg.js와 같음
const slowExtra = (K, a, b) => { if (!K) return 0; let w = 0; for (let x = a; x < b; x += 0.01) w += Math.min(0.01, b - x) * (1 / Math.max(0.05, spdAt(K, x)) - 1); return w; };   // 게임 a→b초를 찍는 데 더 걸린 실제 시간(= 영상이 늘어난 만큼)
// 🚫 v0.1.118: 팟지 건너뛰기(사장님: 쓸만한 장면 없는 노잼판 — 「팟지 준비 중」일 때 녹화하는 PC가 취소) — 기다림 화면 버튼(녹화하는 사람에게만) → 'potg-cancel'
//   → replayRec.cancel()(녹화 멈춤·리플레이 닫기·소리 켜기) · 영상 안 올림 · potgWait.skipped(다른 사람 화면에 「○○님이 건너뛰었어요」) → 5초 뒤 지움 · 기록 potg = {none, skipped, by}
let _potgSkip = false;
ipcMain.on('potg-cancel', () => {
  if (!_recLocal || !replayRec || _potgSkip) return;
  _potgSkip = true; try { replayRec.cancel(); } catch (_) {}
  _recLog.push(`${new Date().toTimeString().slice(0, 8)} 🚫 팟지 건너뛰기(${config.myName || '녹화한 사람'})`);
  recStage('팟지 건너뛰는 중…');
  fbUpdate(`${RP()}/potgWait`, { skipped: config.myName || '녹화한 사람' }).catch(() => {});
});
async function skipPublish(card, path) {   // 건너뛴 판 = 팟지 없음으로 기록(카드도 안 띄움)
  await new Promise(r => setTimeout(r, 5000));   // 다른 사람 기다림 화면에 「건너뛰었어요」가 보일 시간
  await potgWaitFinish(card, path).catch(() => {});
  const none = { none: true, skipped: true, gameId: String(card.gameId), by: config.myName || null };
  await fbUpdate(path, { potg: none }).catch(() => {});
  return none;
}
async function recordPotgClip(card, g) {   // g = { id: 게임 번호, path: 녹화 기록 남길 경기 기록 경로 } → [팟지 영상 meta, 숨은 영웅 영상 meta] (실패한 쪽은 null)
  replayBusy = true; _recLog = []; _potgSkip = false;
  const H = card.hero;   // v0.1.44: 숨은 영웅이 있으면 리플레이 한 번 열어 두 장면을 이어서 녹화
  _recParts = H ? 2 : 1; _recCur = 1; _recLocal = true;   // 🎬 방장(과 그 판 팀원)에게 녹화 중 안내
  _recPlayers = card.normal ? (card.normal.us || []) : [...((sessionData && sessionData.teamA) || []), ...((sessionData && sessionData.teamB) || [])];
  recStage('리플레이 준비 중…');
  potgWaitStart(card, g).catch(() => {});   // ⏳ 기다림 화면
  const fov = async id => potgFov(id).catch(() => FOV_BASE);
  // 🎥 연출 카메라(2026-11-01 · replayrec direct): 처음 2.4초 주인공 정면(누구 팟지인지) → 교전은 주인공 + 잡힐 상대가 다 보이게 · 팟지는 소개 몫으로 2초 앞부터
  //   이름이 안 잡히면 영문 챔피언 이름(alias)으로 — 한글 챔피언 이름은 리플레이가 못 알아들음(실측)
  const champs = await getChamps().catch(() => ({})), alias = id => (champs[id] && champs[id].alias) || '';
  const victims = (card.kills || []).map(k => ({ name: k.victim, alias: alias(k.championId), t: k.t })).filter(v => v.name && Number.isFinite(v.t));
  const kts = (card.kills && card.kills.length ? card.kills.map(k => k.t) : [card.obj ? card.obj.t : card.t1]).filter(Number.isFinite);   // potg/potg.js killsAt과 같은 킬 시각
  const parts = [{ from: Math.max(0, card.clipFrom - 2), to: card.clipTo, focus: card.name, champ: alias(card.championId), fov: await fov(card.championId), direct: { victims }, speed: slowKeys(potgSlow(kts), kts.flatMap(m => [m - 0.7, m - 0.45, m + 0.3, m + FREEZE_AFTER])) }]
    .concat(H ? [{ from: H.clipFrom, to: H.clipTo, focus: H.name, champ: alias(H.championId), fov: await fov(H.championId), direct: { victims: [] }, speed: slowKeys(heroSlow(H.peak), [H.peak - 0.6, H.peak + 0.35]) }] : []);
  recProgStart(parts);
  const t0 = Date.now(), recP = replayRec.record({ gameId: g.id, parts });
  recP.catch(() => {}).finally(() => setTimeout(() => { replayBusy = false; }, 6000));   // 리플레이가 실제로 끝나고(닫히고) 조금 더 지나야 풀림(시간 초과로 먼저 카드를 보여줘도)
  const metas = [null, null], whys = [], secs = [null, null], ups = [], LIMIT = H ? 260000 : 180000;
  try {
    const files = await Promise.race([recP, new Promise(r => setTimeout(() => r(null), LIMIT))]);
    if (_potgSkip) { whys.push('건너뜀(녹화한 사람)'); card.skipped = true; }   // 🚫 v0.1.118 — 영상이 있어도 안 올림
    else if (!files) whys.push(Date.now() - t0 >= LIMIT - 1000 ? `${LIMIT / 60000}분 초과` : '녹화 안 됨');
    for (let i = 0; files && !_potgSkip && i < parts.length; i++) {
      const file = files[i], tag = i ? '숨은 영웅' : '팟지';
      if (!file) { whys.push(tag + ' 녹화 안 됨'); continue; }
      let buf = fs.readFileSync(file);
      // 🔍 2026-11-01(사장님: 화질이 아직도 떨어짐): 롤 원본(1920×1080·VP8 ~6.7Mbps)을 실시간으로 한 번 더 압축(VP9 8Mbps)하면 그만큼 뭉개짐 → 1920 폭 이하·40MB 이하면 **원본 그대로** 올림(길이만 읽음)
      const pr = buf.length <= CLIP_MAX ? await probeClip(file).catch(() => null) : null;
      const orig = pr && pr.w > 0 && pr.w <= 1920 && pr.sec > 0;
      if (orig) { secs[i] = pr.sec; _recLog.push(`${tag} 원본 그대로 ${(buf.length / 1048576).toFixed(1)}MB ${pr.w}×${pr.h} ${pr.sec.toFixed(2)}초`); }
      const small = orig ? null : await shrinkClip(file).catch(e => { _recLog.push(tag + ' 줄이기 실패 ' + (e && e.message)); return null; });   // 잘라내지 않고 1920×1080 그대로·8Mbps(v0.1.80: 1.15배로 자르면 화면 아래쪽 주인공이 잘림)
      if (small && Number.isFinite(small.sec)) secs[i] = small.sec;   // 롤 원본 영상 길이 → 영상 0초가 게임 몇 초인지 정확히(아래)
      // v0.1.71: 화질을 올려 원본보다 커질 수 있음 → 크기 비교 안 함(잘라 맞춘 화면 = 주인공 중심이 기준)
      if (small && small.buf.length > 100000 && small.buf.length <= CLIP_MAX) { _recLog.push(`${tag} 다시 녹화 ${(buf.length / 1048576).toFixed(1)}→${(small.buf.length / 1048576).toFixed(1)}MB ${small.w}×${small.h}`); buf = small.buf; }
      if (buf.length > CLIP_MAX) whys.push(`${tag} 너무 큼 ${(buf.length / 1048576).toFixed(1)}MB`);
      else ups.push(potg.uploadClip(i ? g.id + 'h' : g.id, buf, 'video/webm').then(m => { metas[i] = m; if (!m) whys.push(tag + ' 올리기 실패'); }, () => { whys.push(tag + ' 올리기 실패'); }));   // v0.1.117: 두 영상 동시에(예전엔 차례로)
      try { fs.unlinkSync(file); } catch (_) {}   // 내용은 이미 메모리(buf)에
    }
    await Promise.all(ups);
  } catch (e) { whys.push('오류 ' + (e && e.message)); }
  // 🎬 영상 0초 = 롤이 실제로 찍기 시작한 게임 시각 → 영상이 생긴 장면은 clipFrom을 거기로(안 하면 킬 자막·슬로가 어긋남 · v0.1.58)
  //   = 녹화 끝(clipTo) − 원본 영상 길이(실측 540~556 요청 → 18.94초 → 537.06) · 길이를 모르거나 이상하면 되감기 지점(clipFrom − 3)
  //   ⚠️ v0.1.90: 연출 카메라(키프레임) 녹화는 롤이 startTime(= from)부터 찍음(11/1 실기 9장면 모두 clipTo − 길이 = from ±0.11)
  //   → 옛 「되감기 지점 ±2초」 검사에 걸려(차이 3초) 되감기 지점으로 떨어져 킬 자막·슬로가 3초 늦었음 → 되감기 지점 −1 ~ from +1 사이면 실측을 믿음
  //   🐢 v0.1.120: 슬로 구간을 느리게 찍은 만큼 영상이 길어짐 → 길이에서 늘어난 몫(slowExtra · from~to)을 빼고 계산 · K = 그 장면 속도 표
  const vStart = (c, sec, K) => { const g = makeReplayRec.videoStart(c.clipFrom, c.clipTo), f = Math.max(0, Math.min(c.clipFrom, c.clipTo - 3)), m = sec != null ? c.clipTo - (sec - slowExtra(K, f, c.clipTo)) : null; return m != null && m >= g - 1 && m <= f + 1 ? +m.toFixed(2) : g; };
  //   🛡️ 롤이 속도 키프레임을 무시했으면(영상이 안 늘어남) 속도 표를 버리고 예전 방식 — 표만 믿으면 킬 자막이 몇 초씩 어긋남
  //   판단 = 원본 길이가 「늘어난 길이」(구간 + slowExtra)와 「안 늘어난 길이」 중 어디에 가까운가(연출 카메라 녹화는 from부터 찍힘)
  for (const i of [0, 1]) {
    const pt = parts[i], K = pt && pt.speed; if (!K || secs[i] == null) continue;
    const span = (i ? H.clipTo : card.clipTo) - pt.from, ex = slowExtra(K, pt.from, i ? H.clipTo : card.clipTo);
    if (Math.abs(secs[i] - (span + ex)) > Math.abs(secs[i] - span)) { pt.speed = null; _recLog.push(`${i ? '숨은 영웅' : '팟지'} 슬로 녹화 안 먹음(원본 ${secs[i].toFixed(2)}초 · 기대 ${(span + ex).toFixed(2)}초) → 예전 방식으로 재생`); }
    else _recLog.push(`${i ? '숨은 영웅' : '팟지'} 슬로 녹화 ✅ +${ex.toFixed(2)}초(원본 ${secs[i].toFixed(2)}초)`);
  }
  if (metas[0]) { const v0 = vStart({ clipFrom: parts[0].from, clipTo: card.clipTo }, secs[0], parts[0].speed); card.clipLead = +(card.clipFrom - v0).toFixed(2); card.clipFrom = v0; card.directed = true; if (parts[0].speed) card.spd = parts[0].speed; }   // directed = 연출 카메라 영상(팟지 창이 확대 안 함) · spd = 🐢 속도 표
  if (metas[1] && H) { const v0 = vStart(H, secs[1], parts[1].speed); H.clipLead = +(H.clipFrom - v0).toFixed(2); H.clipFrom = v0; H.directed = true; if (parts[1].speed) H.spd = parts[1].speed; }
  if (metas[0] || metas[1]) _recLog.push(`영상 시작 = 게임 ${metas[0] ? card.clipFrom : '-'}초${H && metas[1] ? ` · 숨은 영웅 ${H.clipFrom}초` : ''} (원본 길이 ${secs.map(x => x == null ? '?' : x.toFixed(2)).join('/')}초)`);
  const sec = Math.round((Date.now() - t0) / 1000), mb = m => m ? +(m.size / 1048576).toFixed(1) : null;
  recEnd(); setTimeout(tryInstallUpdate, 8000);   // 녹화 끝 → 안내 닫기 · 업데이트 기다리던 중이면 이제 설치
  fbUpdate(g.path, { potgRec: { ok: !!metas[0], hero: H ? !!metas[1] : null, why: whys.join(' · ') || null, sec, mb: mb(metas[0]), mbHero: mb(metas[1]), lines: _recLog.slice(-40), at: Date.now() } }).catch(() => {});
  return metas;
}
// 🎬 녹화 영상 줄이기(v0.1.34~35) — 숨은 창에서 다시 재생하며 다시 녹화(v0.1.80부터 잘라내기 없음)(소리 포함) · 영상 길이만큼 걸림
//   v0.1.71(사장님: 화질 때문에 잘 안 보임): 1280×720·3.5Mbps → **최대 1920 폭(잘라낸 해상도 그대로, 늘리지 않음)·8Mbps** — 영상은 GitHub라 받는 양 걱정 없음
async function probeClip(file) {   // 원본 영상 길이·크기(다시 녹화 없이)
  const w = new BrowserWindow({ show: false, width: 320, height: 200, skipTaskbar: true, webPreferences: { backgroundThrottling: false, contextIsolation: true } });
  try {
    await w.loadFile('potg/shrink.html');
    return await Promise.race([w.webContents.executeJavaScript(`probe(${JSON.stringify(pathToFileURL(file).href)})`), new Promise((_, no) => setTimeout(() => no(new Error('시간 초과')), 15000))]);
  } finally { try { w.destroy(); } catch (_) {} }
}
async function shrinkClip(file) {
  const w = new BrowserWindow({ show: false, width: 320, height: 200, skipTaskbar: true, webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', contextIsolation: true } });
  try {
    await w.loadFile('potg/shrink.html');
    const r = await Promise.race([w.webContents.executeJavaScript(`shrink(${JSON.stringify(pathToFileURL(file).href)}, 1920, 8000, 1)`), new Promise((_, no) => setTimeout(() => no(new Error('시간 초과')), 90000))]);
    return r && r.b64 ? { buf: Buffer.from(r.b64, 'base64'), sec: r.sec, w: r.w, h: r.h } : null;
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
// 🔇 v0.1.92: 녹화하는 동안 리플레이 소리를 방장 스피커에서만 끔(사장님: 소리가 계속 나서 별로) — 윈도우 볼륨 믹서의 그 프로세스 세션 음소거(Core Audio)
//   실측(2026-11-02 8442329573): 꺼도 롤이 녹화하는 영상엔 소리가 그대로(평균 −28.4dB · 음소거 안 한 어제 녹화 −30.5dB)
//   ⚠️ 윈도우가 앱별 음소거를 「League of Legends.exe」 전체로 기억함(시험 때 실제로 남아 다음 게임까지 음소거될 뻔) → 리플레이 닫기 전에 꼭 풀고,
//   그 전에 앱이 꺼졌으면(replay-mute.json 남음) 다음 실제 게임 중에 그 게임 프로세스 세션을 풂(unmuteLeftover)
const MUTE_PS = `
Add-Type @'
using System;using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class TNMMDE {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ITNMMDE { int N1(); [PreserveSig] int GetDefaultAudioEndpoint(int f, int r, out ITNMMD d); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ITNMMD { [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ITNASM2 { int N1(); int N2(); [PreserveSig] int GetSessionEnumerator(out ITNASE e); }
[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ITNASE { [PreserveSig] int GetCount(out int n); [PreserveSig] int GetSession(int i, out ITNASC2 s); }
[Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ITNASC2 { int N0(); int N1(); int N2(); int N3(); int N4(); int N5(); int N6(); int N7(); int N8(); int N9(); int N10(); [PreserveSig] int GetProcessId(out uint p); }
[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ITNSAV { [PreserveSig] int SetMasterVolume(float v, ref Guid g); [PreserveSig] int GetMasterVolume(out float v); [PreserveSig] int SetMute(bool m, ref Guid g); [PreserveSig] int GetMute(out bool m); }
public class TNMute {
  public static string Run(string pids, bool mute) {
    var want = new System.Collections.Generic.HashSet<uint>(); foreach (var x in pids.Split(',')) { uint v; if (uint.TryParse(x, out v)) want.Add(v); }
    var en = (ITNMMDE)(new TNMMDE()); int hit = 0, muted = 0;
    for (int role = 0; role < 3; role++) {
      ITNMMD d; if (en.GetDefaultAudioEndpoint(0, role, out d) != 0) continue;
      object m; var iid = typeof(ITNASM2).GUID; d.Activate(ref iid, 23, IntPtr.Zero, out m); ITNASE e; ((ITNASM2)m).GetSessionEnumerator(out e); int n; e.GetCount(out n);
      for (int i = 0; i < n; i++) { ITNASC2 s; e.GetSession(i, out s); uint p; s.GetProcessId(out p); if (!want.Contains(p)) continue; var g = Guid.Empty; ((ITNSAV)s).SetMute(mute, ref g); bool mm; ((ITNSAV)s).GetMute(out mm); hit++; if (mm) muted++; }
    }
    return "sessions=" + hit + " muted=" + muted;
  }
}
'@
[TNMute]::Run($args[0], $args[1] -eq '1')`;
const MUTE_FLAG = () => path.join(app.getPath('userData'), 'replay-mute.json');
function gameAudioMute(pids, on) {   // → {sessions, muted} · 실패면 null
  return new Promise(r => {
    const ids = [].concat(pids || []).filter(Boolean).join(','); if (!ids || process.platform !== 'win32') return r(null);
    if (on) try { fs.writeFileSync(MUTE_FLAG(), JSON.stringify({ at: Date.now(), pids: ids })); } catch (_) {}
    require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(`& {${MUTE_PS}} ${ids} ${on ? 1 : 0}`, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000 }, (e, out) => {
      const m = /sessions=(\d+) muted=(\d+)/.exec(String(out || '')); if (!m) return r(null);
      const res = { sessions: +m[1], muted: +m[2] };
      if (!on && res.muted === 0) try { fs.unlinkSync(MUTE_FLAG()); } catch (_) {}   // 다 풀림(세션이 없으면 애초에 안 걸린 것)
      r(res);
    });
  });
}
let _unmuteAt = 0;
function unmuteLeftover() {   // 실제 게임 중 · 지난번에 못 푼 음소거가 남았으면 그 게임 세션을 풂(세션이 생길 때까지 10초마다)
  if (Date.now() - _unmuteAt < 10000 || !fs.existsSync(MUTE_FLAG())) return; _unmuteAt = Date.now();
  require('child_process').execFile('tasklist', ['/FI', 'IMAGENAME eq League of Legends.exe', '/FO', 'CSV', '/NH'], { windowsHide: true }, (e, out) => {
    const pids = String(out || '').split(/\r?\n/).map(l => (l.match(/^"League of Legends\.exe","(\d+)"/) || [])[1]).filter(Boolean);
    gameAudioMute(pids, false).then(res => { if (res && res.sessions) console.log('[mute] 남은 리플레이 음소거 풂', JSON.stringify(res)); }).catch(() => {});
  });
}
// 🪟 v0.1.92: 리플레이가 열리면 롤이 클라 창을 최소화함(실측: RCLIENT 창이 −32000 · 같은 이름의 136×39 보조 창이 여럿이라 FindWindow는 보조 창을 잡음)
//   → 녹화 중엔 최소화된 클라를 포커스 없이 제자리로 되살림(SW_SHOWNOACTIVATE · 실측 20초 동안 다시 안 내려가고 리플레이도 1배속 그대로)
//   방장 화면도 팀원처럼 클라 + 좌우 창 + 가운데 기다림 화면 그대로 · ⚠️ 보이지 않는 보조 창은 절대 띄우지 말 것(왼쪽 위에 빈 창이 뜸 — 시험 때 겪음)
const RESTORE_PS = `
Add-Type @'
using System;using System.Runtime.InteropServices;using System.Text;
public class TNCR {
  public delegate bool P(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(P p, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  public static int Run() { int n = 0; EnumWindows((h, l) => { var s = new StringBuilder(64); GetWindowText(h, s, 64); var c = new StringBuilder(64); GetClassName(h, c, 64);
    if (s.ToString() == "League of Legends" && c.ToString() == "RCLIENT" && IsWindowVisible(h) && IsIconic(h)) { ShowWindow(h, 4); n++; } return true; }, IntPtr.Zero); return n; }
}
'@
[TNCR]::Run()`;
let _restoreBusy = false, _restoreN = 0, _restoreRec = null;
function keepClientShown() {   // 도킹 줄이 「클라 없음」으로 바뀔 때 1번 불림(줄은 바뀔 때만 옴) → 최소화 애니메이션이 끝날 때를 놓치지 않게 0.3·1.5·4초 뒤 확인
  if (!replayBusy || process.platform !== 'win32') return;
  for (const ms of [300, 1500, 4000]) setTimeout(restoreClientOnce, ms);
}
function restoreClientOnce() {   // 녹화 중에만 · 녹화 한 번에 최대 8번(롤이 계속 다시 내리면 그만)
  if (!replayBusy || _restoreBusy) return;
  if (_restoreRec !== _recLog) { _restoreRec = _recLog; _restoreN = 0; }
  if (_restoreN >= 8) return; _restoreBusy = true;
  require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(`& {${RESTORE_PS}}`, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000 }, (e, out) => {
    _restoreBusy = false;
    const n = +((/(\d+)\s*$/.exec(String(out || '')) || [])[1] || 0);   // ⚠️ 출력 앞에 PowerShell 진행 표시(#< CLIXML …)가 붙을 수 있음 → 끝 숫자만
    if (n > 0) { _restoreN++; _recLog.push(`${new Date().toTimeString().slice(0, 8)} [replay] 최소화된 롤 클라 되살림(${_restoreN})`); }
  });
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
    roomName: room ? room.name : null, roomId: room ? room.id : null,   // 🚪 「오늘」 순위 = 방 이름별
  };
  const w = await fbPutIfAbsent(`${T}/days/${day}/matches/${gid}`, withSv(rec));
  _profIdx = null;
  if (!w.ok && !w.conflict) return { ok: false, err: w.err };
  const u = await fbUpdate(`${RP()}/session`, { phase: 'vote', game: { id: gid, day, winner, at: Date.now() }, votes: null, result: null, lastGameId: gid, pendingEog: null, potg: null });
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
  const u = await fbUpdate(`${RP()}/session`, { phase: 'result', result });
  return { ok: u.ok, err: u.err };
}

// ── ⚔️ 팀 짜기(방장) — 바로 확정(아이템 시간 없음) ───────────────────────────
let _tbBusy = false;
function sendTb(payload) { if (leftWin && !leftWin.isDestroyed()) leftWin.webContents.send('teambuild', payload); }
async function startTeamBuild(names, mode) {
  if (!config.isHost) return { ok: false, err: '방장만 팀을 짤 수 있어요' };
  if (_tbBusy) return { ok: false, err: '팀을 짜는 중이에요' };
  names = [...new Set((names || []).map(n => normName(String(n))).filter(Boolean))];
  if (names.length < 2) return { ok: false, err: `최소 2명이 필요해요 (현재 ${names.length}명)` };
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
    const url = new URL(`${FIREBASE_DB}/${pathStr}.json${authQ(tok)}`);
    const cur = await new Promise(resolve => {
      const req = https.get({ hostname: url.hostname, path: url.pathname + url.search, headers: { 'X-Firebase-ETag': 'true' } }, res => {
        let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c);
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
  if (names.length < 2) return { ok: false, err: `최소 2명이 필요해요 (현재 ${names.length}명)` };
  let caps = [...new Set((captains || []).map(n => normName(String(n))).filter(n => names.includes(n)))];
  if (caps.length !== 2) caps = names.slice().sort(() => Math.random() - 0.5).slice(0, 2);   // 팀장 미지정 → 무작위 2명
  if (names.length < 4) return writeTeams([caps[0]], [caps[1]], names.filter(n => !caps.includes(n)), 'draft');   // 2~3명 = 1:1이라 뽑을 차례가 없음 → 팀장끼리 바로 확정(남은 1명=관전)
  const first = Math.random() < 0.5 ? 'teamA' : 'teamB';   // 🪙 선픽 = 동전 던지기
  const teamSize = Math.min(5, Math.floor(names.length / 2));
  const now = Date.now(), ids = await teamIds(names);
  const w = await fbSet(`${RP()}/session`, {
    phase: 'draft', ids, active: true, mode: 'draft', by: config.myName || null, day: dayKey(now),
    players: names, captains: { teamA: caps[0], teamB: caps[1] }, teamA: [caps[0]], teamB: [caps[1]],
    pool: names.filter(n => !caps.includes(n)), order: draftOrder(first, (teamSize - 1) * 2), pickIdx: 0,
    teamSize, firstPick: first, draftStartedAt: now, turnEndsAt: now + COIN_MS + DRAFT_TURN_MS,   // 첫 차례 = 동전 연출이 끝난 뒤부터 30초
  });
  if (w.ok) fbSet(`${RP()}/lobby/captains`, null).catch(() => {});
  return w;
}
// 한 명 뽑기 — name=null+auto=true면 무작위(시간 초과). 내 차례 팀장 또는 방장만.
async function draftPick(name, auto) {
  const me = normName(config.myName || '');
  const r = await fbCas(`${RP()}/session`, s => {
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
  const w = await fbSet(`${RP()}/session`, {
    phase: 'teams', active: true, teamA, teamB, ids,
    spectators: (spectators && spectators.length) ? spectators : null,
    teamSize: Math.max(teamA.length, teamB.length), mode: mode || 'balance',
    teamsFormedAt: now, day: dayKey(now), by: config.myName || null,
  });
  if (w.ok) fbSet(`${RP()}/lobby/captains`, null).catch(() => {});
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
  const [raw, nraw] = await Promise.all([fetchDay(d), fetchDayRoom('normals', d)]);
  const inRoom = sameGroup;   // 📦 v0.1.110: 같은 방 번호 또는 (같은 이름 + 지금 방 사람이 그 판에) · 이름 없는 옛 기록은 모든 방 · 방 밖이면 전부
  const raw2 = {}; for (const [k, m] of Object.entries(raw || {})) if (m && inRoom(m)) raw2[k] = m;
  const normals = Object.values(nraw || {}).filter(m => m && Array.isArray(m.us) && inRoom(m)).sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(m => Object.assign({}, m, {
    fun: normalFun(m), players: (m.stats || []).filter(p => m.us.some(n => norm(n) === norm(p.summonerName))).map(p => ({ name: p.summonerName, champId: p.championId, champ: p.championName, k: p.kills, d: p.deaths, a: p.assists, damage: p.damage })),
    stats: undefined, potg: m.potg && !m.potg.none ? m.potg : null }));
  return Object.assign({ ok: true, day: d, today: dayKey(), normals, roomName: room ? room.name : null }, computeToday(raw2));
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
        desc: String(a.descriptionTRA || a.desc || '').replace(/<[^>]+>/g, '').slice(0, 300),   // 설명(있으면 · 증강 가이드 편집 화면용)
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
// 📦 v0.1.110: 지난 날 기록은 한 번만 받아 둠(경기 6시간 뒤면 투표·팟지도 고정) · 오늘·어제만 매번 · 예전 = 열 때마다 모든 날 통째
const _pastDays = {};
async function fetchAllDays() {
  const keys = await getJson(`${FIREBASE_DB}/${T}/days.json?shallow=true`);
  if (!keys || typeof keys !== 'object' || keys.error) return getJson(`${FIREBASE_DB}/${T}/days.json`);
  const fresh = new Set([dayKey(), dayKey(Date.now() - 86400e3)]), out = {};
  await Promise.all(Object.keys(keys).map(async k => {
    if (!fresh.has(k) && _pastDays[k]) { out[k] = _pastDays[k]; return; }
    const v = await getJson(`${FIREBASE_DB}/${T}/days/${k}.json`);
    if (v && typeof v === 'object' && !v.error) { out[k] = v; if (!fresh.has(k)) _pastDays[k] = v; }
  }));
  return out;
}
// ── 🧭 증강 가이드(v0.1.72 · v0.1.74 플랜 방식) — 챔피언 선택 화면에서 「이 챔피언이면 이런 증강 노려보자」(게임 전 정해진 추천 = 라이엇 정책 허용 범위) ──
// 게임 중 증강 3개가 뜬 순간 등급을 매기는 방식(블리츠·OP.GG)은 안 함 — 정책상 게임 중 실시간 선택 도움은 막혀 있고, 롤이 그 정보를 주지도 않음.
// v0.1.74: 카테고리 4개(성능·꿀잼·조합·함정)는 나눠 채우기 어렵다(사장님) → 챔피언마다 「플랜」 몇 개 = 이름 + 노릴 증강 묶음 + 한 줄 설명
// 데이터 = today/augGuide/champs/{championId} = {plans:[{title, augs:[증강 id…], why, tier?, patch?, date?, link?}], top?:{patch, augs:[{id,tier}]}, avoid?:[증강 id], draft?(초안 표시), src?, at, by}
//   앱 업데이트 없이 오른쪽 창 「증강」 탭에서 채우면 모두에게 바로 반영 · 증강 이름·아이콘은 getAugments(패치되면 자동 최신)
const PLAN_MAX = 6, PLAN_AUGS = 6, TITLE_MAX = 20, WHY_MAX = 80;
const GUIDE_LINKS = ['https://aramgg.com/', 'https://arammayhem.com/'];   // 플랜 원문 링크로 열 수 있는 곳(이 주소로 시작할 때만)
const guideLinkOk = u => typeof u === 'string' && u.length < 200 && GUIDE_LINKS.some(p => u.startsWith(p));
const CHAMP_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/champion-summary.json';
let _champs = null, _champsAt = 0;
async function getChamps() {   // 챔피언 번호 → {name, alias} (편집 화면 목록·챔피언 선택 화면 이름)
  if (_champs && Date.now() - _champsAt < 12 * 3600e3) return _champs;
  const file = path.join(app.getPath('userData'), 'champs-cache.json');
  try {
    const list = await getJson(CHAMP_URL);
    if (Array.isArray(list) && list.length) {
      const map = {}; for (const c of list) if (c && c.id > 0) map[c.id] = { name: c.name || '', alias: c.alias || '' };
      _champs = map; _champsAt = Date.now();
      try { fs.writeFileSync(file, JSON.stringify(map)); } catch (_) {}
      return _champs;
    }
  } catch (_) {}
  if (!_champs) { try { _champs = JSON.parse(fs.readFileSync(file, 'utf8')); _champsAt = Date.now() - 11 * 3600e3; } catch (_) { _champs = {}; } }
  return _champs;
}
let _guide = null, _guideAt = 0;
async function getGuide(force) {   // 2분 캐시(챔피언 선택 1~2분 동안 한 번만 받음)
  if (!force && _guide && Date.now() - _guideAt < 120000) return _guide;
  try { const g = await getJson(`${FIREBASE_DB}/${T}/augGuide/champs.json`); _guide = g || {}; _guideAt = Date.now(); } catch (_) { if (!_guide) _guide = {}; }
  return _guide;
}
// 🧭 v0.1.100: aramgg.com 증강 통계 = 증강 가이드·증강 순위의 **기본 자료**(사장님: arammayhem보다 적절 · 칸은 따로 안 늘림)
//   매일 GitHub Actions(aramgg.yml → tools/aramgg-fetch.cjs)가 받아 홈페이지 docs/data/aramgg에 올린 파일을 읽음(Firebase 안 씀 · 3시간 캐시)
//   index.json = {p 패치, d 날짜, g:{증강:[등급 1~5, 승률]}} · c/{챔피언}.json = {p, d, t, a:{증강:[등급, 승률, 픽률, 사이트 순위]}, c:[[[증강 3개], 승률, 게임 수]]}
const GG_URL = 'https://sohada2.github.io/today-naejeon/data/aramgg', GG_PAGE = 'https://aramgg.com/ko/champion-stats/', GG_TTL = 3 * 3600e3;
const _gg = { idx: null, idxAt: 0, c: {} };
async function ggIndex() {
  if (_gg.idx && Date.now() - _gg.idxAt < GG_TTL) return _gg.idx;
  const j = await getJson(`${GG_URL}/index.json`).catch(() => null);
  if (j && j.g) { _gg.idx = j; _gg.idxAt = Date.now(); }
  return _gg.idx;
}
async function ggChamp(id) {
  id = Number(id); if (!(id > 0)) return null;
  const x = _gg.c[id]; if (x && Date.now() - x.at < GG_TTL) return x.v;
  const v = await getJson(`${GG_URL}/c/${id}.json`).catch(() => null);
  if (v && v.a) { _gg.c[id] = { v, at: Date.now() }; return v; }
  return (x && x.v) || null;
}
// 가이드 한 챔피언 = Firebase 칸(사람이 고친 플랜 · 옛 arammayhem 초안) + aramgg(있으면 위주)
//   「이번 패치 상위 증강」 = aramgg 이 챔피언 순위 1~6위 · 「추천 콤보」 = aramgg 3개 조합 승률 TOP 5(사람이 고친 플랜이 있으면 그것) · 「피하면 좋은」 = 많이 고르지만(픽률 2%+) T5
function guideFor(id, raw, gg) {
  const g = cleanGuideEntry(raw || {});
  if (!gg || !gg.a) return { guide: g, draft: !!(raw && raw.draft), src: (raw && raw.src) || '' };
  const human = !!(raw && !raw.draft && g.plans && g.plans.length);
  const A = Object.entries(gg.a);
  const out = Object.assign({}, g, { gg: { p: gg.p, d: gg.d }, top: { patch: gg.p, src: 'aramgg', augs: A.filter(([, v]) => v[3] > 0).sort((p, q) => p[1][3] - q[1][3]).slice(0, 6).map(([a, v]) => ({ id: +a, tier: 'T' + v[0], wr: v[1] })) } });
  if (!human) out.plans = (gg.c || []).slice(0, 5).map(c => ({ title: '', augs: c[0], why: '', wr: c[1], games: c[2], patch: gg.p, link: GG_PAGE + id, src: 'aramgg' }));
  const av = A.filter(([, v]) => v[0] === 5 && v[2] >= 0.02).sort((p, q) => q[1][2] - p[1][2]).slice(0, 3).map(([a]) => +a);
  if (av.length) out.avoid = av; else delete out.avoid;
  return { guide: out, draft: false, src: human ? (raw.src || '') : 'aramgg' };
}
function cleanGuideEntry(c) {   // 저장 전에 모양·길이 정리(누가 써도 같은 모양)
  const plans = [];
  for (const p of (Array.isArray(c && c.plans) ? c.plans : [])) {
    const augs = [...new Set((Array.isArray(p && p.augs) ? p.augs : []).map(Number).filter(x => x > 0))].slice(0, PLAN_AUGS);
    if (!augs.length) continue;
    const x = { title: String((p && p.title) || '').trim().slice(0, TITLE_MAX), augs, why: String((p && p.why) || '').trim().slice(0, WHY_MAX) };
    // 자료에서 가져온 플랜(v0.1.75) = 사이트가 매긴 등급·그 자료의 패치·원문 링크(설명은 원문에서 보기 — 남의 글을 옮겨 쓰지 않음)
    if (/^([SABCD][+-]?|T[1-5])$/.test(p && p.tier)) x.tier = p.tier;
    if (Number(p && p.wr) > 0 && Number(p.wr) < 1) x.wr = Math.round(Number(p.wr) * 10000) / 10000;   // aramgg 조합 승률·게임 수(v0.1.100)
    if (Number(p && p.games) > 0) x.games = Math.round(Number(p.games));
    if (/^\d{1,2}\.\d{1,2}$/.test(p && p.patch)) x.patch = p.patch;
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(p && p.date)) x.date = p.date;   // 패치 기록이 없는 자료 = 등록 날짜라도(얼마나 오래된 자료인지 보이게)
    if (guideLinkOk(p && p.link)) x.link = p.link;
    if (p && p.by) { x.by = String(p.by).slice(0, 24); if (Number(p.at) > 0) x.at = Number(p.at); }   // 이 플랜을 마지막으로 고친 사람(위키처럼 · v0.1.76)
    plans.push(x);
    if (plans.length >= PLAN_MAX) break;
  }
  const out = plans.length ? { plans } : {};
  const top = cleanTop(c && c.top); if (top) out.top = top;
  const avoid = cleanAvoid(c && c.avoid); if (avoid) out.avoid = avoid;
  const tiers = cleanTiers(c && c.tiers); if (tiers) out.tiers = tiers;
  return out;
}
function cleanTiers(t) {   // 🎯 그 챔피언 이번 패치 증강 등급 전부 {patch, t:{증강 id: 등급}}(증강 순위용 · 자료에서만)
  if (!t || !/^\d{1,2}\.\d{1,2}$/.test(t.patch) || !t.t || typeof t.t !== 'object') return null;
  const o = {}; let n = 0; for (const [k, v] of Object.entries(t.t)) if (Number(k) > 0 && /^[SABCD][+-]?$/.test(v) && n++ < 60) o[k] = v;
  return n ? { patch: t.patch, t: o } : null;
}
function cleanAvoid(v) { const a = [...new Set((Array.isArray(v) ? v : []).map(Number).filter(x => x > 0))].slice(0, 6); return a.length ? a : null; }   // 피하면 좋은 증강(자료 사이트 「함정」 표시)
// 이번 패치 잘 나오는 증강(v0.1.75) = 자료 사이트의 챔피언별 증강 등급(그 패치 승률 기준) {patch, augs:[{id, tier}]} — 사람이 고치는 칸 아님(저장할 때 그대로 둠)
function cleanTop(t) {
  if (!t || !/^\d{1,2}\.\d{1,2}$/.test(t.patch) || !Array.isArray(t.augs)) return null;
  const augs = []; for (const a of t.augs) { const id = Number(a && a.id); if (id > 0 && /^[SABCD][+-]?$/.test(a.tier) && !augs.some(x => x.id === id)) augs.push({ id, tier: a.tier }); if (augs.length >= 9) break; }
  return augs.length ? { patch: t.patch, augs } : null;
}
// 우리 기록 = 지금까지 내전·같이 한 일반 판에서 그 챔피언으로 그 증강을 고른 판 수·승 (프로필과 같은 30초 캐시)
let _augRec = null, _augRecAt = 0;
async function augRecords() {
  if (_augRec && Date.now() - _augRecAt < 30000) return _augRec;
  const days = await fetchAllDays().catch(() => null);
  const rec = {};
  for (const d of Object.values(days || {})) for (const kind of ['matches', 'normals']) for (const m of Object.values((d && d[kind]) || {})) {
    for (const st of (m && m.stats) || []) {
      if (!st || !st.championId) continue;
      for (const id of new Set(st.augments || [])) { const k = st.championId + ':' + id; const x = rec[k] = rec[k] || { g: 0, w: 0 }; x.g++; if (st.isWin) x.w++; }
    }
  }
  _augRec = rec; _augRecAt = Date.now();
  return rec;
}
// 챔피언 선택 화면 상태(브릿지 onChampSelect) → 오른쪽 창 「증강」 탭(v0.1.73: 왼쪽 창은 팀 화면 그대로)
let champSel = null, _champSelSig = '';
function onChampSelect(d) {
  const sig = d ? JSON.stringify([d.mine, d.bench]) : '';
  if (sig === _champSelSig) return;
  _champSelSig = sig; champSel = d;
  pushAugGuide().catch(() => {});
}
async function augGuideView() {
  if (!champSel || lobbyPhase !== 'ChampSelect') return { active: false };
  const [guide, champs, rec] = await Promise.all([getGuide(), getChamps(), augRecords().catch(() => ({}))]);
  const ids = [...new Set([champSel.mine, ...(champSel.bench || [])].filter(x => x > 0))];
  const ggs = await Promise.all(ids.map(id => ggChamp(id).catch(() => null)));
  const list = ids.map((id, i) => {
    const f = guideFor(id, guide[id], ggs[i]), guideC = f.guide, r = {};
    for (const a of [...(guideC.plans || []).flatMap(p => p.augs), ...((guideC.top && guideC.top.augs) || []).map(x => x.id), ...(guideC.avoid || [])]) { const x = rec[id + ':' + a]; if (x) r[a] = x; }
    return { id, name: (champs[id] && champs[id].name) || '', mine: id === champSel.mine, guide: guideC, draft: f.draft, src: f.src, rec: r };
  });
  return { active: true, list };
}
async function pushAugGuide() { const v = await augGuideView(); broadcast('augguide', v); }
ipcMain.handle('augguide', () => augGuideView());
ipcMain.handle('augguide-gg', async (_e, champId) => { const id = Number(champId) || 0; const [guide, gg] = await Promise.all([getGuide(), ggChamp(id).catch(() => null)]); return guideFor(id, guide[id], gg); });   // ✎ 편집 시작 = 보이는 것(aramgg 조합)부터
ipcMain.on('augguide-link', (_e, url) => { if (guideLinkOk(url)) shell.openExternal(url); });   // 플랜 원문 보기(기본 브라우저)
// 편집(오른쪽 창 「증강」 탭) — 누구나 채울 수 있음 · 저장 = 그 챔피언 칸 통째로 교체(마지막 저장이 이김)
ipcMain.handle('augguide-all', async () => {
  const [guide, champs, augs, rec] = await Promise.all([getGuide(true), getChamps(), getAugments(), augRecords().catch(() => ({}))]);
  const seen = {}; for (const k of Object.keys(rec)) { const a = k.split(':')[1]; seen[a] = (seen[a] || 0) + rec[k].g; }   // 우리 기록에 나온 증강(편집 목록 위로)
  return { guide, champs, augs, seen, planMax: PLAN_MAX, planAugs: PLAN_AUGS, titleMax: TITLE_MAX, whyMax: WHY_MAX };
});
// ✍️ 위키 방식 편집(v0.1.76) — 누구나 고침 · 고친 사람·시각이 플랜마다 남음 · 편집마다 기록(전/후) → 「되돌리기」 · 남이 먼저 고쳤으면 덮어쓰지 않고 알림(편집 충돌)
//   기록 = today/augGuide/hist/{championId}/{키} = {at, by, sum, before:[플랜], after:[플랜]} (챔피언당 최근 30개) · 최근 고친 것 = today/augGuide/recent/{키} = {champ, at, by, sum} (최근 50개)
const HIST_MAX = 30, RECENT_MAX = 50, SUM_MAX = 40;
const planSig = p => JSON.stringify([p.title || '', (p.augs || []).slice().sort((a, b) => a - b), p.why || '']);
const histKey = () => Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 6);   // 시간순으로 정렬되는 키
function planDiff(before, after) {   // 자동 요약(「무엇을 바꿨나요」를 안 썼을 때)
  const b = new Set(before.map(p => JSON.stringify((p.augs || []).slice().sort((x, y) => x - y)))), a = new Set(after.map(p => JSON.stringify((p.augs || []).slice().sort((x, y) => x - y))));
  const add = [...a].filter(x => !b.has(x)).length, del = [...b].filter(x => !a.has(x)).length;
  const bs = new Set(before.map(planSig)); const chg = after.filter(p => !bs.has(planSig(p))).length - add;
  return [add && `플랜 추가 ${add}`, del && `플랜 빼기 ${del}`, chg > 0 && `플랜 수정 ${chg}`].filter(Boolean).join(' · ') || '순서·자잘한 수정';
}
async function augGuideWrite(id, guide, opt) {   // opt = {baseAt?, sum?, force?, restore?}
  const me = (account && account.gameName) || config.myName || '';
  if (!me) return { ok: false, err: '롤에 로그인해야 고칠 수 있어요(누가 고쳤는지 남겨요)' };
  const want = cleanGuideEntry(guide || {}), now = Date.now();
  let before = [], after = [];
  const r = await fbCas(`${T}/augGuide/champs/${id}`, cur => {
    cur = cur || {};
    if (!opt.force && opt.baseAt != null && (cur.at || 0) !== opt.baseAt) return { err: 'conflict', info: { by: cur.by || '', at: cur.at || 0 } };
    before = (cleanGuideEntry(cur).plans) || [];
    const prevBySig = {}; for (const p of before) prevBySig[planSig(p)] = p;
    after = (want.plans || []).map(p => { const o = prevBySig[planSig(p)]; return o ? { ...p, by: o.by, at: o.at } : opt.restore ? { ...p } : { ...p, by: me, at: now }; });   // 안 바뀐 플랜은 원래 고친 사람 그대로 · 되돌리기는 그 버전의 고친 사람 그대로(되돌린 사람은 기록에)
    for (const p of after) if (!p.by) delete p.by;
    const v = { plans: after, at: now, by: me };
    const top = cleanTop(cur.top), av = cleanAvoid(cur.avoid), tiers = cleanTiers(cur.tiers);   // 이번 패치 등급·함정 표시는 자료에서만
    if (top) v.top = top; if (av) v.avoid = av; if (tiers) v.tiers = tiers;
    if (cur.src) v.src = cur.src;
    if (!opt.force && JSON.stringify(before) === JSON.stringify(after)) return { err: 'same' };
    return { value: after.length || top || av || tiers ? v : null };
  });
  if (!r.ok) {
    if (r.err === 'conflict') return { ok: false, conflict: true, by: (r.info && r.info.by) || '', err: '그사이 다른 사람이 먼저 고쳤어요' };
    if (r.err === 'same') return { ok: false, err: '바뀐 게 없어요' };
    return { ok: false, err: r.err || '저장 실패' };
  }
  const sum = String(opt.sum || '').trim().slice(0, SUM_MAX) || planDiff(before, after), k = histKey();
  await fbSet(`${T}/augGuide/hist/${id}/${k}`, { at: now, by: me, sum, before, after });
  await fbSet(`${T}/augGuide/recent/${k}`, { champ: id, at: now, by: me, sum });
  pruneKeys(`${T}/augGuide/hist/${id}`, HIST_MAX).catch(() => {}); pruneKeys(`${T}/augGuide/recent`, RECENT_MAX).catch(() => {});
  _guideAt = 0; if (champSel) pushAugGuide().catch(() => {});
  return { ok: true, at: now };
}
async function pruneKeys(pathStr, max) {   // 오래된 것부터 지워 max개만 남김
  const keys = await getJson(`${FIREBASE_DB}/${pathStr}.json?shallow=true`).catch(() => null);
  const ks = Object.keys(keys || {}).sort();
  for (const k of ks.slice(0, Math.max(0, ks.length - max))) await fbDelete(`${pathStr}/${k}`);
}
ipcMain.handle('augguide-save', async (_e, arg) => {
  const id = Number(arg && arg.champId); if (!(id > 0)) return { ok: false, err: '챔피언 번호가 이상해요' };
  return augGuideWrite(id, arg.guide, { baseAt: arg.baseAt, sum: arg.sum });
});
ipcMain.handle('augguide-hist', async (_e, champId) => {   // 그 챔피언 고친 기록(최신 먼저)
  const id = Number(champId); if (!(id > 0)) return [];
  const h = await getJson(`${FIREBASE_DB}/${T}/augGuide/hist/${id}.json`).catch(() => null);
  return Object.entries(h || {}).map(([k, v]) => ({ k, at: v.at, by: v.by, sum: v.sum, n: ((v.after || []).length), before: v.before || [], after: v.after || [] })).sort((a, b) => b.k.localeCompare(a.k));
});
ipcMain.handle('augguide-recent', async () => {   // 최근 고친 것(모든 챔피언)
  const h = await getJson(`${FIREBASE_DB}/${T}/augGuide/recent.json`).catch(() => null);
  return Object.entries(h || {}).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.k.localeCompare(a.k)).slice(0, 20);
});
ipcMain.handle('augguide-restore', async (_e, arg) => {   // 되돌리기 = 그 기록의 내용으로 다시 저장(이것도 기록에 남음)
  const id = Number(arg && arg.champId); if (!(id > 0)) return { ok: false, err: '챔피언 번호가 이상해요' };
  const v = await getJson(`${FIREBASE_DB}/${T}/augGuide/hist/${id}/${String(arg.k || '').replace(/[^0-9a-z]/g, '')}.json`).catch(() => null);
  if (!v) return { ok: false, err: '기록을 못 찾았어요' };
  const plans = arg.which === 'before' ? (v.before || []) : (v.after || []);
  return augGuideWrite(id, { plans }, { force: true, restore: true, sum: `되돌리기 — ${new Date(v.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ${v.by || ''} ${arg.which === 'before' ? '편집 전' : '버전'}`.slice(0, SUM_MAX) });
});

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
// 🏠 v0.1.115: 아수라장 내전 점수 = 서버 경기 기록 전부(이 앱으로 진행·기록한 판만 · 사장님) — 프로필과 같은 사람 찾기(matchKeyOf·statOf)로 그 사람 판을 모아 rating.inhouseScore
function inhouseOf(idx, key) {
  const recs = [];
  for (const m of idx.matches) {
    const me = [...m.teamA, ...m.teamB].find(n => matchKeyOf(idx, m, n) === key); if (!me) continue;
    const st = statOf(m, me, key); if (!st) continue;   // 수동 기록(선수 기록 없음)은 못 셈
    const team = m.teamA.some(x => normName(x) === normName(me)) ? 'teamA' : 'teamB';
    recs.push({ ts: m.ts, stats: m.stats, me: st, win: m.winner === team });
  }
  return makeRating.inhouseScore(recs);
}
// 🏅 전적 기반 점수(v0.1.111 · rating.js) — 내 롤 클라에서 읽어 today/ratings/{puuid}에 요약만 · 로그인 20초 뒤·판 끝 90초 뒤·30분마다(10분 안 다시 안 함) · 게임 중엔 안 함
let rating = null, _ratingAt = 0, _ratingBusy = false;
async function ratingUpdate(force) {
  if (!rating || !account || inGame || _ratingBusy || (!force && Date.now() - _ratingAt < 10 * 60e3) || (force && Date.now() - _ratingAt < 60e3)) return;
  _ratingBusy = true;
  try {
    const me = account.puuid, out = await rating.collect(me);
    if (!account || account.puuid !== me) return;
    _ratingAt = Date.now();   // 아수라장 일반 판이 없어도 10분 안엔 다시 안 함
    // 🏠 v0.1.115: 아수라장 내전 = 서버 경기 기록(이 앱으로 진행한 판 전부) → 공개만 여기서(올리지 않음 · 프로필도 기록에서 바로 계산)
    const idx = await profileIndex().catch(() => null); if (idx) tierReveal(me, inhouseOf(idx, 'p:' + me), 'custom');
    if (out.mayhem) {   // 아수라장 일반 = 롤 전적(매칭 큐 2400)
      const w = await fbSet(`${T}/ratings/${me}`, out); if (!w.ok) console.log('[rating] 올리기 실패 ' + w.err);
      _ratings[me] = { v: out, at: Date.now() }; tierReveal(me, out.mayhem, 'mayhem');
    }
  } catch (e) { console.log('[rating] ' + (e && e.message)); } finally { _ratingBusy = false; }
}
// 🏅 v0.1.113: 아수라장 티어 공개(사장님: 처음 티어가 정해질 때 애니메이션으로 · ?에 근거) — 내 아수라장 티어가 **처음 정해지거나 바뀌면**(승급·강등 · 단계만 바뀐 건 안 띄움)
//   왼쪽 창에 한 번(overlay/tierreveal.js) · 계정마다 마지막으로 본 티어 = config.mayhemTier / customTier {puuid: 티어} · 왼쪽 창이 안 보이면 다음 계산(30분) 때 다시 시도
//   v0.1.114: kind = 'custom'(아수라장 내전) | 'mayhem'(아수라장 일반) — 둘 다 새로 정해지면 카드가 차례로(내전 먼저)
function tierReveal(puuid, x, kind) {
  if (!x || x.s == null || !(x.n >= 5) || inGame || !overlayWin || overlayWin.isDestroyed() || !overlayWin.isVisible()) return;
  const key = kind === 'custom' ? 'customTier' : 'mayhemTier';
  const t = makeRating.tierOf(x.s), seen = config[key] || {}, prev = seen[puuid] || null;
  if (prev === t.tier) return;
  const order = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
  const dir = !prev ? 'first' : order.indexOf(t.tier) > order.indexOf(prev) ? 'up' : 'down';
  try { overlayWin.webContents.send('tier-reveal', { kind: kind || 'mayhem', tier: t.tier, div: t.div, rank: t.rank, s: x.s, n: x.n, w: x.w, wr: x.wr, kda: x.kda, prev, dir }); } catch (_) { return; }
  config[key] = Object.assign({}, seen, { [puuid]: t.tier }); saveConfig();
  console.log(`[rating] 🏅 ${kind === 'custom' ? '아수라장 내전' : '아수라장'} 티어 공개 ${prev || '처음'} → ${t.tier} ${t.div || ''} (${x.s}점 · ${x.n}판)`);
}
const _ratings = {};
async function getRating(puuid) {   // 프로필용(1분 캐시)
  const x = _ratings[puuid]; if (x && Date.now() - x.at < 60e3) return x.v;
  const v = await getJson(`${FIREBASE_DB}/${T}/ratings/${encodeURIComponent(puuid)}.json`).catch(() => null);
  _ratings[puuid] = { v: v && !v.error ? v : null, at: Date.now() };
  return _ratings[puuid].v;
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
  if (key.startsWith('p:')) {   // 🏅 아수라장 일반(서버 요약 = 그 사람 롤 전적) + 🏠 아수라장 내전(서버 경기 기록에서 바로 · v0.1.115 — 옛 v0.1.114 앱이 올린 custom은 무시)
    const R = await getRating(key.slice(2)).catch(() => null), ih = inhouseOf(idx, key);
    P.rating = R || ih ? Object.assign({}, R || {}, { custom: ih }) : null;
  }
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
const settingsView = () => ({ tutorialSeen: !!config.tutorialSeen, autoSeat: config.autoSeat !== false, ingame: !!config.ingame, augRank: !!config.augRank, sfxOn: config.sfxOn !== false, sfxVol: typeof config.sfxVol === 'number' ? config.sfxVol : 1, dock: config.dock !== false, sidePanel: config.sidePanel !== false, closeAsk: config.closeAsk !== false, hotkey: TOGGLE_HOTKEY });
function broadcastSettings() { const v = settingsView(); for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('settings', v); }
ipcMain.handle('settings-get', () => settingsView());
ipcMain.on('tutorial-open', () => {   // 📘 ⚙ 설정 「사용법 다시 보기」 → 왼쪽 창에 튜토리얼
  if (!overlayWin || overlayWin.isDestroyed()) return;
  userHid = false; showOverlay(); try { overlayWin.webContents.send('tutorial', { step: 0 }); } catch (_) {}
});
ipcMain.handle('settings-set', (_e, { key, value }) => {
  if (key === 'tutorialSeen') config.tutorialSeen = !!value;   // 📘 사용법 튜토리얼 다 봄(v0.1.83)
  else if (key === 'sfxOn') config.sfxOn = !!value;
  else if (key === 'sfxVol') config.sfxVol = Math.max(0, Math.min(1, +value || 0));
  else if (key === 'dock') { if ((config.dock !== false) !== !!value) toggleDock(); }
  else if (key === 'sidePanel') { if ((config.sidePanel !== false) !== !!value) toggleSidePanel(); }
  else if (key === 'closeAsk') { config.closeAsk = !!value; refreshTrayMenu(); }
  else if (key === 'autoSeat') { config.autoSeat = !!value; if (value) { _seatDone = null; _seatKey = null; autoSeat(); } }   // 🪑
  else if (key === 'augRank') {   // 🎯 증강 순위(베타) — 게임 위에 떠야 해서 테두리 없는 창도 같이
    config.augRank = !!value;
    if (!config.augRank) { hideAugRank(); ocrStop(); try { globalShortcut.unregister(AUG_SHOT_KEY); } catch (_) {} if (!inGame && !config.ingame) borderlessOff(); }
    else { regAugShot(); if (lobbyPhase === 'ChampSelect') borderlessOn(); }
  }
  else if (key === 'ingame') {   // 🖥️ 게임 중 정보 창 — 끄면 바꿔 둔 화면 모드도 원래대로(게임 중이면 끝나고)
    config.ingame = !!value;
    if (!config.ingame) { hideIngame(); if (!inGame && !config.augRank) borderlessOff(); }
    else if (lobbyPhase === 'ChampSelect') borderlessOn();
  }
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
ipcMain.handle('rooms-data', () => roomsView());   // 🚪 방 목록
ipcMain.handle('room-create', (_e, { name, priv, pw }) => roomCreate(name, priv, pw));
ipcMain.handle('room-join', (_e, { id, pw }) => roomJoin(id, pw));
ipcMain.handle('room-leave', () => roomLeave());
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
  const mates = (s[team] || []).filter(n => normName(n) !== normName(me));   // 우리 팀이 나 혼자(1:1 등)면 매너왕 없이 투표
  if (mates.length && (teamOf(s, mannerPick) !== team || normName(mannerPick) === normName(me))) return { ok: false, err: '매너왕은 우리 팀(본인 제외)에서 골라요' };
  const r = await fbSet(`${RP()}/session/votes/${fbKeyOf(me)}`, { mvp: normName(mvpPick), manner: mates.length ? normName(mannerPick) : null, team, at: Date.now() });
  if (r.ok && config.isHost) runHost();
  return r;
});
ipcMain.handle('vote-clear', async () => {
  if (!sessionData || sessionData.phase !== 'vote' || !config.myName) return { ok: false };
  return fbDelete(`${RP()}/session/votes/${fbKeyOf(config.myName)}`);
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
ipcMain.on('potg-close', () => { if (_potgMode === 'wait' && potgWaitRaw) _waitClosed = potgWaitRaw.gameId; closePotg(); });   // ⏳ 기다림 화면을 닫으면 그 판엔 다시 안 띄움
ipcMain.on('potg-guess', (_e, i) => {   // 🔮 팟지 예측 한 표(바꿀 수 있음)
  const W = potgWaitRaw, me = config.myName;
  if (!W || !me || !Array.isArray(W.cands) || !Number.isInteger(i) || i < 0 || i >= W.cands.length) return;
  W.guess = Object.assign({}, W.guess, { [fbKeyOf(me)]: { i, name: me, at: Date.now() } });   // 내 화면 먼저
  openPotgWait(W).catch(() => {});
  fbSet(`${RP()}/potgWait/guess/${fbKeyOf(me)}`, { i, name: me, at: Date.now() }).catch(() => {});
});
ipcMain.on('potg-open', (_e, card) => { if (card && !card.none) openPotg(card, true); });   // 「오늘」 탭 일반 판 「팟지」
ipcMain.on('potg-replay', () => { const P = sessionData && sessionData.potg; if (P && !P.none) openPotg(P, true); });   // 결과 화면 「팟지 다시 보기」
ipcMain.handle('rec-state', () => recState);   // 📼 기록 저장 진행 상태   // 👤 개인 내전 프로필
ipcMain.on('open-profile', (_e, arg) => {   // 왼쪽 대기실에서 이름 누름 → 오른쪽 창 프로필 탭
  try { showMainPanel(); } catch (_) {}
  if (leftWin && !leftWin.isDestroyed()) leftWin.webContents.send('open-profile', arg);
});

// ── 앱 시작 ──────────────────────────────────────────────────────────────
if (!app.isPackaged && process.env.TN_USERDATA) app.setPath('userData', process.env.TN_USERDATA);   // 🧪 개발용: 한 PC에서 앱 두 개(방 시험) — 배포본에선 무시
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
    setInterval(autoLobbyMode, 3000);   // 🔀 v0.1.82: 대기방을 먼저 감지하고 방장이 나중에 된 경우(앱 재시작·방장 이어받기)도 판단 — 대기방 종류가 바뀐 때만 실제로 바꿈
    setInterval(() => { augTick().catch(() => {}); }, 400);   // 🎯 증강 순위(켠 사람만 · 게임 중에만 실제로 읽음)
    if (config.augRank) regAugShot();
    runSession = coalesce(pollSession);
    setInterval(runSession, 3000);                       // 화면·방장 일 3초마다(📡 v0.1.63: 데이터는 스트림 사본 — 끊긴 노드만 서버에서 읽음)
    seatGate();                                          // 🚦 자리 있으면 실시간 연결(접속 표시·방 목록·방) · 꽉 찼으면 안내하고 30초마다 다시
    setupAutoUpdate();
    replayRec = makeReplayRec(Object.assign(makeReplayRec.defaults(), {   // 🎬 방장 PC가 팟지 장면을 리플레이로 녹화
      lcuRaw: bridge.lcuRaw, lolDir: bridge.lolDir, outDir: path.join(app.getPath('userData'), 'replay-rec'),
      kill: (pid) => new Promise(r => require('child_process').execFile('taskkill', pid ? ['/PID', String(pid), '/F'] : ['/IM', 'League of Legends.exe', '/F'], () => r())),   // v0.1.80: 리플레이 프로세스 번호만(실제 게임까지 끄던 것)
      log: (m) => { _recLog.push(`${new Date().toTimeString().slice(0, 8)} ${m}`); try { onRecLog(m); } catch (_) {} try { console.log(m); } catch (_) {} },
      restoreFile: path.join(app.getPath('userData'), 'replay-cfg-restore.json'),
      borderlessFile: path.join(app.getPath('userData'), 'ingame-cfg-restore.json'),
      hideWindow: process.platform === 'win32' ? hideReplayWindow : null,
      muteAudio: process.platform === 'win32' ? gameAudioMute : null,   // 🔇 v0.1.92
    }));
    try { replayRec.restorePending(); } catch (_) {}   // 지난번에 녹화하다 앱이 꺼졌으면 game.cfg 창 설정 되돌림
    setTimeout(() => { if (!inGame && lobbyPhase !== 'ChampSelect') borderlessOff(); }, 15000);   // 🖥️ 지난번 게임 중 앱이 꺼졌으면 화면 모드 원래대로(롤이 게임 중이면 기다림)
    rating = makeRating({ userData: app.getPath('userData'), log: m => { try { console.log(m); } catch (_) {} },
      lcuGet: async p => { const r = await bridge.lcuRaw('GET', p); return r && r.status >= 200 && r.status < 300 ? r.data : null; } });
    setInterval(() => ratingUpdate(false), 30 * 60e3);
    potg = makePotg({ T, FIREBASE_DB, fbSet, fbDelete, getJson, getToken: fbToken, dayKey, normName, userData: app.getPath('userData'), getPlayers: () => latestPlayers, log: (m) => { try { console.log(m); } catch (_) {} } });
    setTimeout(() => potg.cleanup().catch(() => {}), 8000); setInterval(() => potg.cleanup().catch(() => {}), 30 * 60 * 1000);   // 🎬 3일 지난 영상·수집 지우기
    bridge.start({ getToken: fbToken, getOperatorName: () => config.myName || null, isHost: () => !!config.isHost, appVer: app.getVersion(), onAccount: setAccount, onEog: onBridgeEog, onLobbySeat, onChampSelect, onNormal: (e) => recordNormal(e).catch(err => console.log('[normal] 오류', err && err.message)), fakeLcu: (!app.isPackaged && process.env.TN_FAKE_LCU) || null, log: (m) => { try { console.log(m); } catch (_) {} } });
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
// 🔄 업데이트 바로 설치(v0.1.56) — 팀원이 알림 줄을 못 찾아 옛 버전으로 남던 것(사장님)
//   _wantInstall = 켠 직후 받음 → 게임·녹화 중이 아닐 때 바로 재시작 설치 (방장 「업데이트 시키기」는 v0.1.62에서 뺌 — 옛 버전은 본인 대기실에 안내 줄)
//   게임 중이면 게임 끝나고 1분 30초 뒤(정산 수집 올린 뒤), 녹화 중이면 녹화 끝난 뒤 다시 시도
let _wantInstall = false;
function tryInstallUpdate() {
  if (!_wantInstall || upd.state !== 'ready' || inGame || replayBusy || !app.isPackaged) return;
  app._quitting = true;
  try { autoUpdater.quitAndInstall(true, true); } catch (_) { app.quit(); }   // 조용히 설치 + 설치 뒤 다시 켜기
}
function setupAutoUpdate() {
  if (!app.isPackaged) { upd.state = 'dev'; return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => setUpd({ state: 'downloading', version: info && info.version, pct: 0 }));
  autoUpdater.on('download-progress', (p) => { const pct = Math.round((p && p.percent) || 0); if (pct !== upd.pct) setUpd({ pct }); });
  autoUpdater.on('update-not-available', () => setUpd({ state: 'latest' }));
  autoUpdater.on('update-downloaded', (info) => {
    setUpd({ state: 'ready', version: info && info.version, pct: 100 }); refreshTrayMenu(true);
    if (Date.now() - _startTs < 3 * 60000) _wantInstall = true;   // 🔄 켠 지 3분 안에 받음 = 막 켠 참 → 바로 설치하고 다시 켜짐(옛 버전 팀원이 알림을 못 찾던 것 · v0.1.56)
    tryInstallUpdate();
  });
  autoUpdater.on('error', () => { if (upd.state !== 'ready') setUpd({ state: 'error' }); });
  checkUpdate();
  setInterval(checkUpdate, 30 * 60 * 1000);
}
let _cleanedUp = false;
app.on('before-quit', (e) => {
  app._quitting = true;
  if (!inGame) borderlessOff();   // 🖥️ 바꿔 둔 화면 모드 원래대로(게임 중이면 다음 실행 때)
  try { bridge.stop(); } catch (_) {}
  try { stopDockStream(); } catch (_) {}
  if (_cleanedUp) return;
  // 접속 표시·방장 자리를 지우고 끝냄(안 지우면 다른 사람이 1분 기다려야 방장을 이어받음) — 최대 3초
  _cleanedUp = true;
  const jobs = [];
  if (_live) jobs.push(fbSet(`${T}/conns/${config.deviceId}`, null));   // 🚦 내 자리 비움
  if (account) jobs.push(fbSet(`${T}/presence/${account.puuid}`, null));
  if (account && room) jobs.push(fbSet(`${RP()}/members/${account.puuid}`, null));   // 📦 방 사람 칸
  if (account) jobs.push(fbSet(`${RP()}/lobby/join/${account.puuid}`, null));
  if (config.isHost) jobs.push(fbCas(`${RP()}/host`, cur => cur && account && cur.puuid === account.puuid ? { value: null } : { err: 'not mine' }));
  if (!jobs.length) return;
  e.preventDefault();
  Promise.race([Promise.allSettled(jobs), new Promise(r => setTimeout(r, 3000))]).then(() => app.quit());
});
app.on('window-all-closed', () => { /* 트레이 상주 */ });
app.on('will-quit', () => globalShortcut.unregisterAll());
