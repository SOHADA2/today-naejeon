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

## 데이터 구조 (`today/`)
| 경로 | 내용 |
|---|---|
| `today/session` | 현재 판: `{phase:'draft'|'teams'|'vote'|'result', teamA, teamB, spectators, mode, teamsFormedAt, day, by, game:{id,day,winner,at}, votes:{fbKey:{mvp,manner,team,at}}, result:{mvp,svp,manner,voteCount,closedAt}, lastGameId, pendingEog}` |
| `today/presence/{puuid}` | 지금 접속 중: `{name, tag, at, host, app}` · 20초마다 갱신 · 60초 지나면 오프라인 취급 · 계정 바뀜/종료 시 삭제 |
| `today/accounts/{puuid}` | 한 번이라도 접속한 라이엇 계정 `{name, tag, lastSeen}` |
| `today/host` | 👑 지금 방장 `{puuid, name, at, from?}` · 방장 앱이 20초마다 `at` 갱신 · 60초 넘게 끊기면 다른 사람이 이어받기 가능 · `from`=넘겨준 사람(받는 쪽 알림용, 첫 하트비트에서 지움) |
| `today/lobby` | 방장이 참가자 고르는 중 배너 `{state:'preparing', by, at, participants}` |
| `today/bridge/*` | 내장 브릿지: `eogStats`(gameId·winSide·players[KDA…]·savedAt, ETag CAS) · `gamePhase` · `inGame` · `champSelect` · `operators/{id}` · `connected` |
| `today/days/{YYYY-MM-DD}/matches/{gameId}` | 오늘 경기 기록(조건부 PUT으로 1회만 생성): 팀·winner·stats·mvp/svp/manner·votes·source(auto/manual) |

- **하루 = 새벽 6시 기준**(`DAY_START_HOUR`) — 밤샘 내전이 자정 넘어도 같은 날.
- fbKey = normName 후 공백→`_`, Firebase 금지문자(`.#$[]/`)→`_`.

## 흐름
1. **입장 = 롤에 로그인된 라이엇 계정으로 자동**(v0.1.2). 브릿지 `pollAccount`가 LCU `/lol-summoner/v1/current-summoner`를 연결 시+5초마다 읽어 `onAccount` → main `setAccount`. 같은 PC에서 다른 계정으로 로그인하면 자동 전환(방장 해제). 롤 안 켜면 「롤을 켜면 자동 입장」 대기 화면. 표시 이름 = 라이엇 게임 이름, 키 = puuid. 헤더 「👑 방장 하기」 토글.
   - 개발/테스트: `TN_FAKE_ACCOUNT="이름#태그"`(배포본 무시)
   - **👑 방장 = 한 번에 한 명(v0.1.3)**: `today/host`를 `fbCas`로 잡음(`claimHost`). 다른 사람이 살아있는 방장이면 버튼이 「👑 ○○」(점선·누르면 안내)로 잠김, 60초 넘게 응답 없으면 「👑 방장 이어받기」. 방장은 「👑 방장 ▾」 메뉴에서 **지금 접속 중인 사람에게 넘겨주기**(`handHost`) 또는 「방장 그만하기」. 모든 앱은 `today/host`를 스트림으로 보다가(`onHostRec`) 내 puuid가 적히면 자동으로 방장이 되고(넘겨받음·재시작 1분 안 복귀), 남이 적히면 자동으로 내려옴. 진행 중인 판(`today/session`)은 그대로라 방장이 바뀌어도 기록·투표가 이어짐. 정상 종료(`before-quit`)는 최대 3초 기다려 방장 자리·접속 표시를 지우고 끝냄(강제 종료면 60초 뒤 이어받기).
2. 방장: 참가자 선택(드래그) — 후보 = 지금 접속 중(초록 점·`today/presence`) + 오늘 뛴 사람 + 직접 추가(앱 없는 사람·localStorage `tbManual`) → **팀 구성 즉시 확정**(랜덤 · 밸런스는 새 로직 준비 중) → `today/session` phase `teams` → 팀원 오버레이에 자동 표시 + 클라 위 「내 팀」 마커
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
- 검증법(2026-10-27 v0.1.0에서 사용): `--remote-debugging-port=9333`으로 띄우고 CDP로 렌더러 조작 + Firebase REST로 `today/bridge/eogStats`·타인 투표 시뮬레이션 → 끝나면 `today/` 테스트 데이터 삭제. 화면 확인 = 렌더러 HTML에 `window.api` 스텁 넣어 Edge 헤드리스(file:///·Temp 출력). CDP `Page.captureScreenshot`은 이 앱 창에선 멈춤(쓰지 말 것).

## 상태
- **v0.1.0 (2026-10-27)**: 첫 버전. 입장·방장·팀짜기·EOG 자동 기록·수동 기록·투표·결과·오늘 순위·한 판 더. E2E(팀짜기→가짜 EOG→자동 기록→6명 투표→자동 마감→결과/순위·수동 2팀 승→마감) 통과.
- ⚠️ **실기 미검증**: 실제 롤 클라이언트로 EOG 캡처·이름 매칭·도킹/마커 위치는 아직 못 돌려봄(개발 PC에 롤 없음).
- **v0.1.1 (2026-10-27)**: 🎯 드래프트 픽. E2E(7명 → 팀장 지정 → 방장 대신 픽 → 30초 초과 자동 픽 → 3:3+관전1 확정 → 팀 화면) 통과.
- **v0.1.2 (2026-10-27)**: 👤 라이엇 계정 자동 입장 · 접속 중 표시 · 직접 추가 · puuid 승리 판정 · 밸런스 모드 제거(새 로직 대기) · 사이트 데이터 읽기 중단. E2E(가짜 계정 자동 입장 → 방장 → 접속 4명 목록 → 직접 추가 → 랜덤 팀 → 인게임 이름이 전부 달라도 puuid로 1팀 승 판정) 통과. ⚠️ 실제 롤 계정 감지·계정 전환·EOG puuid 존재는 실기 확인 필요.
- **v0.1.3 (2026-10-27)**: 👑 방장 한 명만 · 넘겨주기 · 응답 없으면 이어받기 · 정상 종료 시 방장 자리 정리. E2E(방장 하기 → 접속 중인 B에게 넘김 → B 방장일 때 잠김 → B 응답 없음 → 이어받기 → 외부에서 B가 가져가면 자동으로 내려옴 → B가 넘겨주면 자동으로 방장+알림 → 하트비트가 from 지움 → 그만하기 → 정상 종료 시 host·presence 삭제) 통과.
- ⏭️ 다음: **밸런스 팀짜기 새 로직(사장님 설계)** · 하루 안에 끝나는 인스턴트 콘텐츠(사장님 기획) · 인게임 화면
