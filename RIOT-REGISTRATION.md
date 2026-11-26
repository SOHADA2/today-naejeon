# 라이엇 개발자 포털 — 투데이 내전 새 제품 등록 준비 (2026-11-26)

사장님 결정(2026-11-26): 예전 aram 사이트 등록(2026-04 · `riot.txt` · 웹 API 키)과 따로 **투데이 내전을 새 제품으로 등록**.
이 문서 = 신청서에 붙여 넣을 영어 문안 + 내기 전에 정리할 것. 다른 PC에서 이어 하려면 이 문서와 CLAUDE.md 「남은 일」 🚀 항목을 볼 것.

## 왜 새로 등록하나
| | 예전 aram 사이트 | 투데이 내전 |
|---|---|---|
| 형태 | 웹사이트 | 윈도우 설치 프로그램(Electron) |
| 라이엇 연결 | 웹 API(account-v1·spectator·match-v5) + API 키 | **각자 PC의 롤 클라이언트(LCU)·게임 중 정보(2999)·리플레이** · API 키 안 씀 |
| 범위 | 우리끼리 | 「큐」 커뮤니티 공개 사용 → 나중에 유료(구독) |

라이엇 문서에서 확인한 것(2026-11-26):
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
- [ ] ② **우리끼리 티어** = 브론즈~챌린저 이름 + 롤 랭크 문장 그림 → 공식 랭크 대체처럼 보임(「cannot create alternatives for official skill ranking systems」) → 이름·그림을 우리 것으로
- [x] ③ **이름 숨긴 사람 찾아내기**(v0.1.122 팟지 기록 바로잡기 · 「cannot identify or analyze players who are deliberately hidden」) → v0.1.254: 우리 앱에 들어온 사람만 바로잡고, 모르는 사람은 챔피언 이름 그대로
- [ ] ⑧ **게임 파일에서 꺼낸 자료**(핑 그림·핑 소리·감정표현·랭크 문장) → Data Dragon·프레스 킷 자료나 직접 만든 것으로
- [ ] ⑨ **롤 화면과 너무 닮은 디자인**(핑 바퀴 · 「cannot closely resemble Riot's games or products」)
- [ ] ⑦ **롤 클라 조작**(방 만들기·초대·자동 수락·자리 이동·내보내기·큐 시작·리플레이 열기·game.cfg·리플레이 창 숨기기·Alt+클릭 핑용 마우스 훅) → 신청서에 목록으로 적고 허용되는지 질문
- [ ] ④ **롤 로그인 증표를 우리 중계로 보냄**(LCU `/entitlements/v1/token` → Cloudflare에서 서명만 확인 · 저장 안 함) → 적고 질문(공식 방법 = RSO는 Production 승인 뒤)
- [ ] ⑤ aramgg 자료(패치 노트·증강 설명·꿀팁) → 허락 받거나 빼기
- [ ] ⑥ Suno 음악 → 만들 때 유료 플랜이었는지(사장님 확인)
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
