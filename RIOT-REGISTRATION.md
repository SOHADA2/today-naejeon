# 라이엇 개발자 포털 — 투데이 내전 새 제품 등록 준비 (2026-11-26)

사장님 결정(2026-11-26): 예전 aram 사이트 등록(2026-04 · `riot.txt` · 웹 API 키)과 따로 **투데이 내전을 새 제품으로 등록**.
이 문서 = 신청서에 붙여 넣을 영어 문안 + 내기 전에 정리할 것. 다른 PC에서 이어 하려면 이 문서와 CLAUDE.md 「남은 일」 🚀 항목을 볼 것.

## 왜 새로 등록하나
| | 예전 aram 사이트 | 투데이 내전 |
|---|---|---|
| 형태 | 웹사이트 | 윈도우 설치 프로그램(Electron) |
| 라이엇 연결 | 웹 API(account-v1·spectator·match-v5) + API 키 | **각자 PC의 롤 클라이언트(LCU)·게임 중 정보(2999)·리플레이** · API 키 안 씀 |
| 범위 | 우리끼리 | 「큐」 커뮤니티 공개 사용 → 나중에 유료(구독) |

## 📅 최신 규정 확인 (2026-11-26 · 원문을 그날 다시 읽음 — ⚠️ 신청서를 내기 직전·기능을 바꿀 때마다 다시 확인할 것 · 사장님: 예전 규정에 맞추면 절대 안 됨)
| 페이지 | 표시된 날짜 |
|---|---|
| https://developer.riotgames.com/policies/general (일반 정책) | **LAST UPDATED: MAY 29, 2025** (예전 메모의 2025-03-11은 옛 판) |
| https://developer.riotgames.com/policies/game-specific (게임별 정책 목록) | LAST UPDATED: AUGUST 21, 2026 · 링크만 있음 → 롤 = /docs/lol#game-policy |
| https://developer.riotgames.com/docs/lol (롤 Game Policy · LCU · Replay API · RSO) | 날짜 표시 없음 · 2026-11-26 원문 기준 |
| https://developer.riotgames.com/terms (API 약관) | LAST UPDATED: DECEMBER 9, 2013 · /policies/terms는 404 |

최신 원문과 우리 상태 대조:
- 증강 승률 = 「Products cannot display win rates for Augments or Arena Mode items. This applies to all websites, applications and overlays.」 → ✅ v0.1.248 뺌 · 아수라장(Mayhem) 이름은 어디에도 없음(증강이라 같은 규칙으로 봄)
- 공식 랭크 대체·MMR/ELO 계산기 금지 → ✅ v0.1.255 「내전 등급」 D~SSS
- 숨긴 플레이어 = 롤: 「cannot identify or analyze players who are deliberately hidden by the game」 · 일반(2025-05-29): 「cannot de-anonymize players who cannot reasonably be identified from visible information」 → ✅ v0.1.254
- 커스텀 전적 = 「may not publicly display a player's match history from the custom match queue unless the player opts in」 · 아니면 RSO로 본인에게만 → ✅ v0.1.253 동의(옵트인) · 같은 판 사람끼리 보는 판 화면은 공개 표시가 아니라고 봄
- LCU = 「not officially supported for use with third party applications」 · 「We need to know which endpoints you're using and how you're using them」 · LCU를 쓰면 등록 필수 → 신청서 「APIs used」 목록 · 클라 자동 조작(방 만들기·초대·수락·자리·큐)은 롤 문서에 따로 금지 문구 없음 → 질문으로 적음
- 리플레이 API = 공식 문서에 켜는 법(game.cfg EnableReplayApi=1)·녹화(/replay/recording)가 있음 · 녹화를 막는 문구 없음
- 자료 = Data Dragon·프레스 킷·게임별 정적 자료만 허용 목록 · 「cannot closely resemble Riot's games or products in style or function」 → ✅ v0.1.255·256(게임 파일 그림·소리 지움 · 손그림)
- 다른 자료 = 일반(2025-05-29) 「Products should use supported services from Riot Games for data ingestion」 · 롤 「No apps serving as a "data broker"」 → ✅ v0.1.260·261 aramgg·커뮤니티 가이드 글 뺌
- RSO = Production 키만 · 계정 주인 확인 = /riot/account/v1/accounts/me · LCU 증표로 확인하는 건 언급 없음 → 질문(④)
- 돈 = 무료 범위 필수 · 상태 Approved 또는 Acknowledged · 유료면 「transformative」 · 구독·후원·크라우드펀딩·참가비·현금 안 되는 화폐 · 도박 금지 · 광고 = 게임 안·로딩·라이엇 클라 금지 · **대회(일반 정책) = 참가비의 70% 이상 상금 · 참가자 20명 이상 · 도박 없음**(리그 계획 때 다시 확인)
- 등록 = 모든 제품 등록·심사 · 「If your product serves players, you must register it」 · Personal = 작은 개인 프로젝트 · Production = 큰 공개 프로젝트 · 승인 전 공개 사용(오픈 베타) 문구는 이번 원문에서 못 찾음 → 큐 시범은 등록 신청 뒤에
- 고지문 = 일반 정책 최신 문구와 우리 문구(홈페이지 꼬리·앱 ⚙)가 같음 · 「readily visible to players」

## 🖊️ 포털 등록 화면에서 동의한 창(2026-11-26 · 사장님 화면 · 이것도 최신 문구로 봄)
**General Policies**(Please Don't 중 우리와 겹치는 것):
- 「Shame players based on any metric」 → ✅ v0.1.262 「버스 탑승」·「최다 데스」 뺌(칭찬 = 캐리·멀티킬·탱커·힐러·MVP·매너는 「You may honor or glorify players」라 그대로)
- 「Provide alternate channels to report or evaluate other players」 → 대기실 채팅 **신고**(우리 앱 채팅 관리용) = **App Note로 질문**
- 「Charge money for your app or provide exclusive access … to specific users」 → 일반 정책(2025-05-29)은 승인 뒤 구독 허용이라 어긋남 + 초대 코드 커뮤니티(기본 커뮤니티는 누구나) = **App Note로 질문**
- 「Build or design any tools … designed to look like the native League of Legends … designs」 → 사장님: 앱 디자인(헥스텍 톤)은 우리 톤앤매너로 만든 것 = 그대로
- 「Utilize a Development or Interim API key to run a project accessible by the community」 → 큐 시범(공개 운영)은 **승인 뒤**
- 「Scrape data from undocumented endpoints …」 → LCU는 롤 문서에 있는 「지원 안 함」 도구 · 신청서 「APIs used」에 전부 적음
- Please Do: 「Feel free to use any of our art assets from the game (but NOT any official Logos)」 → 챔피언·아이템 그림 그대로 OK · 공식 로고 안 씀
**Tournament Policies**(Tournaments API 쓰는 제품 대상 · 우리는 안 씀 = 롤 클라에서 사용자 설정 방 · 나중에 리그를 열 때 기준): 공정한 매칭 · **대회 참가자에게 모든 기능 무료(= VIP 기능도 대회 참가자는 무료여야)** · **최소 20명** · 정식 대회 방식(토너먼트·리그전 · 도전·사다리 아님) · 내기·도박·명목 참가비 외 돈 금지 · 돈 가치 있는 자체 화폐 금지 · 참가비는 원화로 표시하고 순위대로 우승 팀에 나눔

라이엇 문서에서 확인한 것(2026-11-26 · 첫 정리):
- LCU를 쓰는 제품 = **개발자 포털에 등록** · 「어떤 주소를 어떻게 쓰는지 알려 달라」(docs/lol · League Client API)
- 모든 제품 = 포털에서 **등록 + 심사** · 새 기능도 심사(일반 정책) · 개인용(Personal)으로는 **공개 사용 금지(오픈 베타 포함)**
- 유료 = 상태 **Approved 또는 Acknowledged** · **무료 범위 필수** · 돈 받는 콘텐츠는 원작에 새 가치를 더한 것(transformative) · 도박·암호화폐 금지 · 롤 게임 안·로딩·라이엇 클라 광고 금지
- 정해진 **고지문**을 잘 보이는 곳에 → ✅ 홈페이지 꼬리 + 앱 ⚙ 설정 맨 아래(2026-11-26)
- 심사 기준: 「실력 향상·성장 기록을 돕는 제품」 환영 · 「게임을 대신 풀어 주는 제품」 거절 · 완성되지 않은 사이트는 승인 어려움 · 결과는 포털 메시지로 옴
- 못 찾은 것: 양식 칸(로그인 필요) · Approved/Acknowledged 차이 · 심사 기간 · 자동 수락·자리 이동 같은 클라 조작이 되는지 → **신청서에 숨김없이 적고 포털 메시지로 물어봄**

## 사장님이 할 일
1. https://developer.riotgames.com 로그인(롤 계정) → **Register Product**
2. 종류 = **Production**(큰 커뮤니티·공개용) — Personal은 공개 사용 금지
3. 아래 「신청서 문안」을 칸에 맞게 붙여 넣기(칸 이름이 다르면 화면을 캡처해서 보여 주시면 맞춰 드림)
4. **제품 확인(verify)** 단계에서 받는 코드/파일을 알려 주시면 → 홈페이지 `docs/riot.txt`에 올림(예전 aram 사이트와 같은 방식이면 https://sohada2.github.io/today-naejeon/riot.txt)
5. 결과는 포털 메시지 → 오면 알려 주기

## 내기 전에 정리할 것(회색 지대 — CLAUDE.md 「남은 일」 ⚖️ 번호)
심사에서 걸릴 수 있는 순. 고치거나, 고치지 않으면 신청서에 사실대로 적음.
- [x] ② **우리끼리 티어** = 브론즈~챌린저 이름 + 롤 랭크 문장 그림 → 공식 랭크 대체처럼 보임(「cannot create alternatives for official skill ranking systems」) → v0.1.255: **「내전 등급」 D~SSS + 직접 그린 방패**(롤 문장 그림·승급 영상 지움) · 아수라장 **일반 판(매칭 큐) 점수는 화면에서 뺌**(팀 밸런스 계산에만)
- [x] ③ **이름 숨긴 사람 찾아내기**(v0.1.122 팟지 기록 바로잡기 · 「cannot identify or analyze players who are deliberately hidden」) → v0.1.254: 우리 앱에 들어온 사람만 바로잡고, 모르는 사람은 챔피언 이름 그대로
- [x] ⑧ **게임 파일에서 꺼낸 자료**(핑 그림·핑 소리·감정표현·랭크 문장) → v0.1.255 랭크 문장 지움 · v0.1.256 핑 그림·소리·감정표현 지움 = 직접 그린 스케치 그림 + Kenney CC0 소리 · 꺼내던 도구(lol-wad·lol-bnk-pings·emote-img·rank-emblems)도 지움 · ℹ️ 남은 라이엇 그림 = 챔피언·스킨·아이템·증강 아이콘(Data Dragon·CommunityDragon = 허용 범위로 봄)
- [x] ⑨ **롤 화면과 너무 닮은 디자인**(핑 바퀴 · 「cannot closely resemble Riot's games or products」) → v0.1.256 손그림 바퀴 + 대기실용 뜻(준비 완료·가자!·좋아요·ㅋㅋ·잠깐만·미안·?·고마워 · 롤 핑 뜻 안 씀)
- [x] ⑦ **롤 클라 조작**(방 만들기·초대·자동 수락·자리 이동·내보내기·큐 시작·리플레이 열기·game.cfg·리플레이 창 숨기기·Alt+클릭 핑용 마우스 훅) → LCU 동작은 신청서 「APIs used」 목록 + 질문 · 2026-11-26 사장님: **롤 화면 위 핑(마우스 훅)은 우리 프로그램 자체 기능이라 그대로 · 따로 적지 않음**(Claude 의견 = 공개 리포라 심사자가 볼 수 있어 한 줄 적는 쪽을 권했음 · 결정은 사장님)
- [x] ④ **롤 로그인 증표를 우리 중계로 보냄**(LCU `/entitlements/v1/token` → Cloudflare에서 서명만 확인 · 저장 안 함) → 2026-11-26 사장님: **그대로 + 신청서 질문**(아래 「Questions for Riot」 둘째 · 승인 뒤 RSO로 옮길 수 있다고 적음) · v0.1.259부터 커뮤니티 전용 서버(Firebase 프로젝트)마다 같은 방식
- [x] ⑤ aramgg 자료(패치 노트·증강 설명·꿀팁) → 2026-11-26 사장님: **빼기** → v0.1.260: 패치 노트 탭 없앰(홈 「패치 노트」 칸 = 라이엇 공식 패치 노트 사이트 열기) · 증강 설명 글 없앰(뽑아 보기 카드 = 라이엇 게임 자료의 증강 분류) · 챔피언 꿀팁 없앰 · 매일 받던 GitHub 작업·도구·홈페이지 자료(docs/data/aramgg·tips.json) 지움 · 뽑아 보기 증강 목록 = 우리 파일 docs/data/augpool.json(번호만) + 우리 기록 · ℹ️ 남은 것 = 「운명의 무기」 첫 템 한 줄(출처 표시 「칼바람 갤러리 가이드 · aramgg 가이드」 · 사장님 확인 대기)
- [x] ⑥ Suno 음악 → 2026-11-26 사장님 확인: **만들 때 유료 플랜**(상업 이용 가능)
- [x] ① 증강 승률·등급 → v0.1.248에서 뺌
- [x] 커스텀 전적 공개 = 본인 동의(옵트인) → v0.1.253
- [x] 고지문 → 홈페이지·앱 설정
- [x] ⑩ 홈페이지 「비상업 팬 프로젝트」 문구 → 정해진 고지문으로 바꿈(2026-11-26)

---

## 신청서 문안(영어 · 붙여 넣기용)

**Product name**: Today In-House (투데이 내전)

**Product URL**: https://sohada2.github.io/today-naejeon/

**Game**: League of Legends (KR)

**Short description**
> A free Windows companion app for running same-day custom in-house games (내전) with friends and community members: rooms, team building (random / balanced / captain draft), automatic recording of custom-game results, MVP/manner voting, a daily leaderboard, and a short replay highlight ("Play of the Game") after each game.

**Detailed description / user flow**
> 1. A player installs the app and logs in to the League client as usual. The app identifies the player from the local League Client (current summoner) — no Riot password is ever handled.
> 2. Before joining any in-house, the player must explicitly opt in to sharing their custom-game history with other app users (records of players who have not opted in are never shown to others; opt-out is available in settings at any time).
> 3. Players join a room in the app. The room host chooses a team-building mode (random, balanced, or captain draft) and the app forms two teams.
> 4. The host creates a custom game lobby in the League client from the app and invites the room members; members' apps can accept the host's invite and move to their assigned team slot.
> 5. After the game, the app reads the end-of-game stats from the League client and saves the result (teams, winner, KDA, damage, champion, augments) to our own database. Players vote for MVP / manner; the daily leaderboard updates.
> 6. The host's app opens the game's replay locally and records one short highlight clip, which all participants can watch and save.
> The app does not provide any information that is not already visible to the player in the client or game, does not show augment or Arena item win rates, does not show in-game overlays with hidden information, and does not automate gameplay.

**APIs used** (no Riot Web API key is used)
- League Client API (LCU, local, read):
  `/lol-summoner/v1/current-summoner`, `/lol-summoner/v2/summoners/puuid/{puuid}`, `/lol-gameflow/v1/gameflow-phase`, `/lol-gameflow/v1/session`, `/lol-champ-select/v1/session`, `/lol-end-of-game/v1/eog-stats-block`, `/lol-match-history/v1/games/{gameId}`, `/lol-match-history/v1/game-timelines/{gameId}`, `/lol-match-history/v1/products/lol/current-summoner/matches`, `/lol-ranked/v1/current-ranked-stats`, `/lol-ranked/v1/ranked-stats/{puuid}`, `/lol-game-queues/v1/custom`, `/lol-lobby/v2/lobby`, `/lol-lobby/v2/lobby/invitations`, `/lol-lobby/v2/received-invitations`, `/lol-replays/v1/configuration`, `/lol-replays/v1/metadata/{gameId}`, `/lol-replays/v1/rofls/path`, `/lol-game-data/assets/...`, `/entitlements/v1/token`
- League Client API (LCU, actions — only on explicit user action or settings the user turned on):
  create/update a custom lobby (`POST /lol-lobby/v2/lobby`), invite room members (`POST /lol-lobby/v2/lobby/invitations`), accept an invite from the room host (`POST /lol-lobby/v2/received-invitations/{id}/accept`), move to the assigned team (`POST /lol-lobby/v2/lobby/team/{team}`, `/lol-lobby/v1/lobby/custom/switch-teams`), remove a member the host kicked from the room (`POST /lol-lobby/v2/lobby/members/{id}/kick`), start/cancel queue for a normal game party (`/lol-lobby/v2/lobby/matchmaking/search`), download and open a replay (`/lol-replays/v1/metadata/{gameId}/create/...`, `/lol-replays/v1/rofls/{gameId}/download/graceful`, `/lol-replays/v1/rofls/{gameId}/watch`)
- Live Client Data API (port 2999, local, read during the player's own game): `/liveclientdata/eventdata`, `/liveclientdata/playerlist`, `/liveclientdata/activeplayer`, `/liveclientdata/gamestats` — used only after the game to pick the highlight moment (kill times, own health); nothing is shown during the game.
- Replay API (port 2999, `EnableReplayApi=1` in game.cfg): `/replay/playback`, `/replay/render`, `/replay/sequence`, `/replay/recording` — to record a short highlight clip from the replay after the game.

**Questions for Riot** (send via portal messages if the form has no field)
> - Are the lobby actions above (creating a custom lobby, inviting, auto-accepting the room host's invite, moving to the assigned team slot) acceptable for a public product? All are opt-in settings or explicit user actions.
> - We verify that the player is the owner of the League account by checking the LCU entitlements access token signature against Riot's public JWKS on our server (the token is not stored). Is this acceptable, or should we move to RSO after approval?
> - We plan an optional paid tier later (free tier remains with all core features). Paid features would be cosmetic or convenience (e.g. longer highlight storage, season statistics pages), never gameplay advantage. Is a subscription acceptable for this product?

**Monetization plan**
> Free for all core features. Possible future optional subscription for extras (cosmetics, longer clip storage, season/league statistics pages). No ads inside the League client, game, or loading screens. No gambling or betting. Community tournament prizes, if any, are handled by the community and are not funded by app subscriptions.

**Data & privacy**
> Stored in our Firebase database: League game name/tag, puuid, custom-game results of players who opted in, votes, presence. Privacy policy: https://sohada2.github.io/today-naejeon/privacy.html — players can withdraw consent or delete their data in the app.

**Legal notice** (shown on the website footer and in the app settings)
> Today In-House isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

---
⚠️ 앱 기능이 바뀌면(특히 새 LCU 주소·새 클라 조작) 이 문서 「APIs used」도 같이 고치고, 승인 뒤에는 포털 제품 페이지에 변경 심사를 냄(일반 정책: 새 기능도 심사).
