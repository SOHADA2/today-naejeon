# 투데이 내전 (today-naejeon)

하루 안에 끝나는 **인스턴트 내전** 데스크톱 앱(Electron). 기존 `aram-overlay`(사이트 프로그램 버전·시즌 LP/골드 연동)를 **그대로 두고 따로 만든 두 번째 앱**이다. 사장님 의도 = "새로 만들다 별로면 다시 돌아간다" → **사이트 데이터와 완전 분리**가 최우선 원칙.

- 리포: `SOHADA2/today-naejeon`(public — 사이트 다운로드·자동 업데이트용) · 로컬 `Desktop/today-naejeon`
- 배포: 사이트(sohada2.github.io/aram) **최하단**에 「투데이 내전 다운로드」 버튼(기존 「내전 오버레이 다운로드」 옆)
- 출발점: aram-overlay v0.1.55 코드에서 도킹·창·트레이·자동 업데이트·내장 브릿지·팀짜기 알고리즘만 가져오고, 복권·대장간·상점·가챠·패스·프로필·LP·막고라·아이템 페이즈·숨은 라이브 계정은 전부 걷어냄

## 🔒 데이터 분리 원칙 (절대 규칙)
- **쓰기는 전부 Firebase `today/` 아래만.** 사이트 노드(`session`·`lobby`·`bridge`·`matches`·`gold`·`season2`·`normal_matches`…)에 쓰는 코드를 추가하지 말 것.
- **v0.1.2부터 사이트 데이터를 읽지도 않음**(완전 독립). 입장 = 라이엇 계정, 밸런스 = 새 로직 설계 전까지 비활성.
- 내장 브릿지(`bridge.js`)도 `today/bridge/*`에만 기록. 일반게임(비커스텀)은 기록 안 함.
- 두 앱을 같은 PC에 같이 깔아도 충돌 없음: appId `gg.aram.today` · userData `%APPDATA%\today-naejeon` · 업데이트 캐시 `today-naejeon-updater` · 단축키 **Shift+F7**(기존 앱은 Shift+F5) · 파란 아이콘(기존은 금색).

## ⚡ 성능 규칙 (v0.1.5 실측 근거)
- **무한 애니메이션 금지**(`animation: ... infinite`·숨쉬는 빛·깜빡이는 점). 왼쪽 오버레이·내 팀 마커는 **투명 창**이라 점 하나만 움직여도 창 전체를 매 프레임 다시 그림 → 9px 점 깜빡임 하나가 **CPU 코어 1개의 33%**(끄면 0.4%). 「버벅거림」의 주원인이었음. 한 번만 재생되는 짧은 효과는 OK.
- **같은 내용은 다시 안 보냄**: `broadcast`가 session·lobby를 직전과 비교해 바뀐 것만 렌더러로(3초 폴링마다 화면 전체 다시 그리던 것 제거).
- **누르면 내 화면 먼저**(낙관적 반영): 대기실 참가/관전·방식·팀장은 `lobbyLocal`로 즉시 화면 반영 후 서버에 쓰고, 실패하면 `refreshLobby`로 되돌림. 실측 내 클릭→화면 256ms → 6ms.
- 다른 PC 변경은 SSE 스트림(`today/lobby`·`today/presence`)으로 **그 노드만** 다시 읽음(`refreshLobby`/`refreshPresence`). 실측 ~180ms = 서버 쓰기 75ms + 전달 왕복(싱가포르 서버라 더 줄이기 어려움).
- 측정법: TN_HIDDEN 실행 → 메인 인스펙터로 창을 x=-3000에 `BrowserWindow.prototype.showInactive.call(w)`(화면 밖에 실제로 그리게) → PowerShell로 today-naejeon electron 프로세스 CPU 20초 차이. 반응 시간은 렌더러에서 `setTimeout(f,5)` 폴링(⚠️ 숨긴 창은 requestAnimationFrame이 ~1초마다라 측정이 뭉개짐).

## 🎨 디자인 시스템 (v0.1.9 리디자인 — shared.css 머리 주석이 기준)
- 방향 = 롤 클라 옆 「헥스텍 매치 로비」: 짙은 남색 바탕 · 금색 가는 선 · **비스듬히 자른 모서리**(`--cut`/`--cut-sm` clip-path). 둥근 모서리+색 그림자 쓰지 말 것.
- **색 역할(겹치지 말 것)**: 파랑 `--t1`=1팀 · 빨강 `--t2`=2팀(롤과 같음) · 금색=방장·강조·주 버튼·나 · 청록=참가·완료 · 초록 점=접속 중. (v0.1.8까지 1팀 청록/2팀 금색이라 방장 금색과 헷갈렸음)
- **글꼴 = 앱에 내장**(assets/fonts, OFL): Pretendard Variable(모든 한글) + Barlow Condensed 600/700(숫자·짧은 영문 라벨 `.num`·`.lb-sec-en`). 구글 글꼴 링크 없음. ⚠️ v0.1.8까지 왼쪽 창은 Pretendard가 없어 **맑은 고딕으로 떨어지고 있었음**.
- 대기실 = **자리 10칸(5:5)** `SEATS`: 참가한 사람 순서대로 소환사 아이콘(LCU profileIconId → presence.icon → CommunityDragon profile-icons/{id}.jpg)과 앉고 빈 자리는 점선. 방장 조작(팀장·관전으로)은 자리에 마우스 올릴 때만. 고르는 중/관전은 아래 칩 줄.
- 투표 후보 = 그 판 챔피언 아이콘·이름·K/D/A·피해량(`gameStat`: 오늘 기록의 경기 stats, ids→puuid 우선). 결과 화면도 챔피언 아이콘.
- **글자 겹침 금지(사장님 지적 2026-10-27)**: 이름 위에 표시를 겹쳐 띄우지 말 것(absolute 배치 금지) — 대기실 자리의 나·방장·팀장 표시는 이름 아래 줄. 디자인 바꾸면 `tools/ui-audit.js`로 전 화면 검사(정상 이름 + 16자 이름 둘 다 겹침·잘림 0).
- 캡처 함정: 숨긴 창 `capturePage`가 다시 그리기 전 화면을 줄 때가 있음(같은 크기 연속 캡처) → 크기를 1px 바꾸거나 다시 찍기.

## 데이터 구조 (`today/`)
| 경로 | 내용 |
|---|---|
| `today/session` | 현재 판: `{phase:'draft'|'teams'|'vote'|'result', teamA, teamB, spectators, mode, teamsFormedAt, day, by, game:{id,day,winner,at}, votes:{fbKey:{mvp,manner,team,at}}, result:{mvp,svp,manner,voteCount,closedAt}, lastGameId, pendingEog}` |
| `today/presence/{puuid}` | 지금 접속 중: `{name, tag, at, host, app}` · 20초마다 갱신 · 60초 지나면 오프라인 취급 · 계정 바뀜/종료 시 삭제 |
| `today/accounts/{puuid}` | 한 번이라도 접속한 라이엇 계정 `{name, tag, lastSeen}` |
| `today/host` | 👑 지금 방장 `{puuid, name, at, from?}` · 방장 앱이 20초마다 `at` 갱신 · 60초 넘게 끊기면 다른 사람이 이어받기 가능 · `from`=넘겨준 사람(받는 쪽 알림용, 첫 하트비트에서 지움) |
| `today/lobby` | 🚪 대기실(v0.1.4) `{mode:'random'|'draft', captains:{teamA,teamB}, join:{key:{name, st:'in'|'spec', at, day, guest?}}}` · key=puuid(본인이 누름) 또는 `g_이름`(방장이 추가한 앱 없는 사람) · 참가 표시는 그날(`day`)만 유효 |
| `today/bridge/*` | 내장 브릿지: `eogStats`(gameId·winSide·players[KDA…]·savedAt, ETag CAS) · `gamePhase` · `inGame` · `champSelect` · `operators/{id}` · `connected` |
| `today/days/{YYYY-MM-DD}/matches/{gameId}` | 경기 기록(조건부 PUT으로 1회만 생성·**지우지 않음=영구 보관**): 팀·winner·gameTime·stats(선수별 챔프·KDA·피해량·골드·CS·아이템·증강·멀티킬·퍼블·puuid)·mvp/svp/manner·votes·source(auto/manual)·**ids(이름→puuid, v0.1.6~)** |

- **하루 = 새벽 6시 기준**(`DAY_START_HOUR`) — 밤샘 내전이 자정 넘어도 같은 날.
- fbKey = normName 후 공백→`_`, Firebase 금지문자(`.#$[]/`)→`_`.

## 흐름
1. **입장 = 롤에 로그인된 라이엇 계정으로 자동**(v0.1.2). 브릿지 `pollAccount`가 LCU `/lol-summoner/v1/current-summoner`를 연결 시+5초마다 읽어 `onAccount` → main `setAccount`. 같은 PC에서 다른 계정으로 로그인하면 자동 전환(방장 해제). 롤 안 켜면 「롤을 켜면 자동 입장」 대기 화면. 표시 이름 = 라이엇 게임 이름, 키 = puuid. 헤더 「👑 방장 하기」 토글.
   - 개발/테스트: `TN_FAKE_ACCOUNT="이름#태그"`(배포본 무시)
   - **👑 방장 = 한 번에 한 명(v0.1.3)**: `today/host`를 `fbCas`로 잡음(`claimHost`). 다른 사람이 살아있는 방장이면 버튼이 「👑 ○○」(점선·누르면 안내)로 잠김, 60초 넘게 응답 없으면 「👑 방장 이어받기」. 방장은 「👑 방장 ▾」 메뉴에서 **지금 접속 중인 사람에게 넘겨주기**(`handHost`) 또는 「방장 그만하기」. 모든 앱은 `today/host`를 스트림으로 보다가(`onHostRec`) 내 puuid가 적히면 자동으로 방장이 되고(넘겨받음·재시작 1분 안 복귀), 남이 적히면 자동으로 내려옴. 진행 중인 판(`today/session`)은 그대로라 방장이 바뀌어도 기록·투표가 이어짐. 정상 종료(`before-quit`)는 최대 3초 기다려 방장 자리·접속 표시를 지우고 끝냄(강제 종료면 60초 뒤 이어받기).
2. **🚪 대기실(v0.1.4) = 왼쪽 오버레이 기본 화면, 모두가 같은 화면을 봄**(사장님: "같이 반응하는 화면을 봐야 진행되는지 안다"). 목록 = 지금 접속 중(`today/presence`) + 방장이 추가한 앱 없는 사람. 각자 「참가할게요/관전할게요」(`lobbySetMine`) · 방장은 남의 상태 알약 눌러 참가→관전→빼기 순환, 이름 추가, 방식(랜덤/드래프트) 선택, 드래프트면 팀장 지정(줄마다 「팀장」 또는 「랜덤 팀장」) → 「시작」(`lobbyStart`, 참가 4명+) → **팀 구성 즉시 확정**(랜덤 · 밸런스는 새 로직 준비 중). 오른쪽 패널 「진행」 탭 = 진행 중인 판 조작만(승리 기록·투표 마감·한 판 더·「대기실로 돌아가기」=`lobbyReopen`→session phase `lobby`, 팀은 남겨 「한 판 더」 가능). 대기실 화면은 pollSession(3초)+`today/lobby` 스트림으로 갱신. 메인이 presence·host·join을 합쳐 `lobbyView()`로 보냄 → `today/session` phase `teams` → 팀원 오버레이에 자동 표시 + 클라 위 「내 팀」 마커
3. 게임 종료 → 참가자 누구든 앱의 브릿지가 `today/bridge/eogStats` 기록(v0.1.2부터 선수별 `puuid` 포함) → **방장 앱**(`hostTick`)이 1팀/2팀 판정 = 팀 결성 때 저장한 `session.ids`(이름→puuid)로 **계정 ID 우선**, 없으면 이름 → `today/days/.../matches/{gameId}` 저장 → phase `vote`
   - 이름 매칭 실패(인게임 이름≠등록 이름) → `pendingEog` → 방장 패널에 「이긴 팀을 골라주세요」
   - 롤 클라 연결 없음 등 → 방장이 「1팀/2팀 승리 기록」 수동(`source:'manual'`, gameId `m{ts}`)
4. 투표: MVP는 상대 팀에서, 매너왕은 우리 팀(본인 제외)에서. **전원 투표 시 방장 앱이 자동 마감**, 아니면 방장 「투표 마감」
   - MVP = 이긴 팀 중 진 팀 표 1위 · SVP = 진 팀 중 이긴 팀 표 1위 · 매너왕 = 전체 매너표 1위 · 동표는 KDA 높은 쪽
5. phase `result` → 오버레이 결과 화면(확인 누르면 대기 화면=오늘 순위) → 방장 「같은 팀으로 한 판 더」 또는 「새로 팀 짜기」
- **🎯 드래프트 픽(v0.1.1)**: 팀짜기 모드 라디오에 「드래프트」 → 참가자 선택 → 팀장 2명 선택(또는 랜덤 팀장) → phase `draft`(`captains{teamA,teamB}`·`pool`·`order`·`pickIdx`·`turnEndsAt`·`firstPick`·`lastPick`).
  - 선픽 = 동전 던지기 · 순서 = **스네이크**(`draftOrder`: 선픽,후,후,선,선…) · 팀 크기 = min(5, ⌊인원/2⌋) · 다 뽑고 남은 사람 = 관전.
  - 픽 = 왼쪽 오버레이 남은 사람 칩 클릭. **내 차례 팀장 또는 방장(대신 뽑기)**만 가능. 차례당 **30초**(`DRAFT_TURN_MS`), 지나면 방장 앱 `hostTick`이 무작위 픽.
  - 동시성: `fbCas`(ETag 조건부 PUT·412면 최신으로 재시도) — 팀장 픽과 방장 자동 픽이 겹쳐도 한 번만 반영.
  - 다 뽑으면 phase `teams`(mode `draft`·teamsFormedAt)로 바뀌어 기존 기록·투표 흐름 그대로.
- 오른쪽 패널 「오늘」 탭 = 날짜별 순위표(전적·승률·MVP·매너·KDA) + 경기 목록(‹ › 날짜 이동)

## 파일
- `main.js` — 창·도킹·트레이·업데이트(aram-overlay 이식) + **📅 투데이 섹션**(dayKey·pollSession·hostTick·recordGame·closeVote·startTeamBuild·computeToday)
- `bridge.js` — LCU EOG 캡처(today/bridge) · `teams.js` — 홈페이지 makeTeams 1:1(밸런스 상수 바꾸지 말 것)
- `overlay/` — 왼쪽: 팀 배정 / 투표 / 결과 / 대기(오늘 순위·인게임 명단)
- `sidepanel/` — 오른쪽: 입장 / ⚔️팀짜기(방장·진행 중 판 조작) / 📅오늘 · `today.css`=이 앱 전용 스타일
- `slot/` 내 팀 마커 · `desktop/` 업데이트 토스트·클라 종료 확인창·공용 CSS
- 콘텐츠를 넣을 자리: 「오늘」 탭·대기 화면·결과 화면(하루 안에 끝나는 인스턴트 콘텐츠를 여기에 얹는다)

## 실행 / 배포
```bash
npm install
npm start      # ⚠️ 이 PC 셸은 ELECTRON_RUN_AS_NODE=1 → env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe .
```
- 배포 = package.json version↑ → commit → `git tag vX.Y.Z && git push --tags` → Actions(windows)가 빌드해 Releases 업로드(자동 업데이트 소스). 로컬 electron-builder 빌드는 개발자모드 없으면 실패 → CI에서만.
- **⚠️ 테스트할 때 창을 화면에 띄우지 말 것(사장님 요청: "화면을 자꾸 가려")** → `TN_HIDDEN=1`(개발 실행만)이면 모든 창의 show/showInactive/focus를 막고 백그라운드 스로틀링 끔. 조작=렌더러 CDP(9333), 캡처=`--inspect=9334`로 메인 프로세스에 붙어 `BrowserWindow.getAllWindows()` → 화면 밖(x=-3000)으로 옮긴 뒤 `webContents.capturePage()` base64로 받아 Temp에 저장. 메인 인스펙터 eval은 `includeCommandLineAPI:true`여야 `require` 됨. 종료 테스트는 `app._quitting=true` 후 `app.quit()`.
- **롤 없이 게임 종료 시험** = `node tools/mock-lcu.cjs fastexit|skip|closed` + 앱 `TN_HIDDEN=1 TN_FAKE_LCU=27999:testpw`(가짜 LCU가 페이즈·정산·전적을 시나리오대로 흉내, 저장되면 출처와 함께 출력).
- 검증법(2026-10-27 v0.1.0에서 사용): `--remote-debugging-port=9333`으로 띄우고 CDP로 렌더러 조작 + Firebase REST로 `today/bridge/eogStats`·타인 투표 시뮬레이션 → 끝나면 `today/` 테스트 데이터 삭제. 화면 확인 = 렌더러 HTML에 `window.api` 스텁 넣어 Edge 헤드리스(file:///·Temp 출력). CDP `Page.captureScreenshot`은 이 앱 창에선 멈춤(쓰지 말 것).

## 상태
- **v0.1.0 (2026-10-27)**: 첫 버전. 입장·방장·팀짜기·EOG 자동 기록·수동 기록·투표·결과·오늘 순위·한 판 더. E2E(팀짜기→가짜 EOG→자동 기록→6명 투표→자동 마감→결과/순위·수동 2팀 승→마감) 통과.
- ⚠️ **실기 미검증**: 실제 롤 클라이언트로 EOG 캡처·이름 매칭·도킹/마커 위치는 아직 못 돌려봄(개발 PC에 롤 없음).
- **v0.1.1 (2026-10-27)**: 🎯 드래프트 픽. E2E(7명 → 팀장 지정 → 방장 대신 픽 → 30초 초과 자동 픽 → 3:3+관전1 확정 → 팀 화면) 통과.
- **v0.1.2 (2026-10-27)**: 👤 라이엇 계정 자동 입장 · 접속 중 표시 · 직접 추가 · puuid 승리 판정 · 밸런스 모드 제거(새 로직 대기) · 사이트 데이터 읽기 중단. E2E(가짜 계정 자동 입장 → 방장 → 접속 4명 목록 → 직접 추가 → 랜덤 팀 → 인게임 이름이 전부 달라도 puuid로 1팀 승 판정) 통과. ⚠️ 실제 롤 계정 감지·계정 전환·EOG puuid 존재는 실기 확인 필요.
- **v0.1.3 (2026-10-27)**: 👑 방장 한 명만 · 넘겨주기 · 응답 없으면 이어받기 · 정상 종료 시 방장 자리 정리. E2E(방장 하기 → 접속 중인 B에게 넘김 → B 방장일 때 잠김 → B 응답 없음 → 이어받기 → 외부에서 B가 가져가면 자동으로 내려옴 → B가 넘겨주면 자동으로 방장+알림 → 하트비트가 from 지움 → 그만하기 → 정상 종료 시 host·presence 삭제) 통과.
- **v0.1.4 (2026-10-27)**: 🚪 모두 같이 보는 대기실. E2E(TN_HIDDEN, 화면 안 띄움: 방장 없음 안내 → A 참가 · 다른 PC B 참가/C 관전/D 고르는 중 → A 방장 → 드래프트 · D 참가로 · 손님1 추가 → 랜덤 팀장 → 드래프트 시작(4명) → 대기실로 돌아가기 → 랜덤 시작 → 2:2 팀 화면) 통과 + 대기실 캡처 확인.
- **v0.1.5 (2026-10-27)**: ⚡ 버벅임·반응 개선 — 무한 애니메이션 3곳 제거(대기실 점·입장 대기 점·내 팀 마커 숨쉬는 빛) · 같은 내용 재전송 차단 · 대기실 낙관적 반영 · 스트림이 바뀐 노드만 읽기. 실측 CPU 33%→0.4%, 내 클릭 반영 256→6ms, 다른 PC ~180ms(변화 없음=네트워크 한계). ⚠️ 기존 aram-overlay에도 무한 애니메이션 4파일(desktop.css·overlay.css·sidepanel.css·slot.html) 남아 있음(사장님 결정 대기).
- **v0.1.6 (2026-10-27)**: 👤 개인 내전 프로필 — 오른쪽 창 「프로필」 탭(`getProfile`): 모든 날 기록을 사람별로(전적·승률·지금 연승/연패·최고 연승·MVP/SVP/매너·평균 KDA·피해량(분당)·골드·CS·멀티킬·퍼블·많이 한 챔피언 5·최고 기록(킬·피해량·KDA·어시)·찰떡 팀원/천적(2판 이상)·최근 10판). 사람 키 = `p:puuid`(경기 기록 ids → stats puuid → accounts 이름 순으로 판별, **닉변해도 합쳐짐**) / `n:이름`(앱 없는 사람). 「오늘」 순위표 이름·대기실 이름·찰떡/천적 이름 누르면 그 사람 프로필. 챔피언 아이콘 = CommunityDragon champion-icons/{id}.png. `today/days` 전체를 받아 30초 캐시(경기 기록·투표 마감 시 무효화) — ⚠️ 기록이 수천 판 쌓이면 사람별 요약 노드로 바꿀 것. E2E(이틀치 4판 시드·옛 닉네임 판 포함 → A 4판 3승1패 2연승·챔프/최고기록/찰떡/천적/손님 n:키 전부 기대값 일치, 순위표 이름→B 프로필) 통과.
- **v0.1.7 (2026-10-27)**: 🛟 정산 화면 바로 나가도 결과 수집 — 옛 버그 원인 = 3초 폴링 사이에 정산 화면(EndOfGame)을 나가면 `eog-stats-block`이 사라져 놓침. ① 게임 중 1초마다 정산 결과 확인(`startEogWatch`, 이번 gameId 블록만) → 받는 즉시 메모리 확보 후 저장 ② 끝내 못 잡으면 LCU 전적 `/lol-match-history/v1/games/{gameId}`에서 복구(`scheduleHistoryBackfill`, 5초 간격 최대 3분, 챔프 이름은 champion-summary.json, eogStats.source='history') ③ 결과 저장 전에 클라를 끄면 `_missedGame` 기억 → 다음 연결 때 전적에서 복구. 덤: bridge fbSet이 문자열을 JSON 인코딩 안 해 `gamePhase` 쓰기가 늘 HTTP 400이던 것 수정. E2E = **`tools/mock-lcu.cjs` 가짜 LCU**(TN_FAKE_LCU) 3시나리오(1.2초 만에 나감→2.4초에 저장 / 정산 못 잡음→전적에서 복구 / 클라 종료 20초 후 재실행→전적에서 복구) 통과. ⚠️ 실제 롤에서 전적 API가 커스텀 게임을 얼마나 빨리 보여주는지·응답 형식은 실기 확인 필요. ⚠️ 기존 aram-overlay는 같은 버그 그대로.
- **v0.1.8 (2026-10-27)**: 📼 게임 끝난 뒤 왼쪽 창(롤 클라 옆)에 「기록 저장 중」 화면 — 단계 4개(게임 종료 확인 → 게임 결과 가져오기[정산 화면/전적 n/36] → 서버에 저장 → 오늘 기록에 반영[방장 판정]) 체크 + 경과 초. 도는 로딩 아이콘 없음(성능 규칙, 실측 0.4%). 시작 = 2999 인게임 사라짐(`recGameEnded`) 또는 브릿지 페이즈 변화(`onEog` ended) 중 먼저 온 쪽, 진행 = 브릿지 `emitEog`(captured/saved/history/retry/missed/closed/skip) + 서버(eogStats·session.pendingEog·phase vote). 문제 시 빨간 「확인이 필요해요」+방장에겐 1팀/2팀 승리 버튼(문제거나 60초 넘으면). session이 vote가 되면 사라지고 투표 화면. **덤: 롤 클라를 끄면 방장이 바로 풀리던 것 → 같은 계정 2분 안에 돌아오면 방장·참가 유지(`_away`, `AWAY_GRACE_MS`)** — 이게 없으면 「끄고 다시 켜서 전적 복구」해도 기록할 방장이 없었음. E2E(mock-lcu skip·closed → 단계 순서대로 → 투표) 통과.
- **v0.1.9 (2026-10-27)**: 🎨 리디자인 — 글꼴 내장(Pretendard·Barlow Condensed)·1팀 파랑/2팀 빨강·비스듬한 모서리 패널·브랜드 머리, 대기실 자리 10칸(5:5)+소환사 아이콘+빈 자리, 투표 후보에 챔피언·KDA·피해량, 결과에 챔피언 아이콘, overlay.css 전면 재작성(옛 앱 아이템·LP 스타일 제거). CPU 실측 1.6%(움직이는 효과 없음). 화면 레퍼런스 = Artifact MYtQN3ZCnonPkUt3akubEj.
- **v0.1.10 (2026-10-27)**: 대기실 자리 표시(나·방장·팀장)가 이름에 겹치던 것 → 이름 아래 줄로. 글자 겹침·잘림 자동 검사 `tools/ui-audit.js` 추가 — 15개 화면 × (보통 이름·16자 이름) 모두 겹침·잘림 0, 일부러 겹치게 만든 화면은 잡아냄.
- ⏭️ 다음: **밸런스 팀짜기 새 로직(사장님 설계)** · 하루 안에 끝나는 인스턴트 콘텐츠(사장님 기획) · 인게임 화면
