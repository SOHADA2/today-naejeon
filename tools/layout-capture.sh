# 📐 롤 화면 자동 캡처(docs/screen-layout.md 「아직 못 잰 화면」 채우기) — 롤 상태가 바뀌면 그 화면을 한 번씩 찍음(파일이 생긴 것만 「찍음」)
# 사용(리포 루트 · Git Bash): bash tools/layout-capture.sh [저장 폴더]   (기본 = 내 문서\today-naejeon-layout · 최대 4시간 · 다 찍으면 끝)
#   찍는 것: home(None) · lobby-custom · lobby-queue · champselect(8초 뒤) · ingame(100초 뒤) · endofgame
#   ⚠️ 친구 이름·채팅이 찍힘 → 공개 리포에 올리지 말 것 · 이미 찍은 종류는 그 폴더에 파일이 있으면 건너뜀
#   게임 로딩 순간(챔피언 선택 → 게임)엔 캡처가 실패할 수 있음 → 실패면 다시 시도
OUT="${1:-$USERPROFILE/Documents/today-naejeon-layout}"; mkdir -p "$OUT"
TOOLS="$(cd "$(dirname "$0")" && pwd)"; LF="/c/Riot Games/League of Legends/lockfile"; W=$(cygpath -w "$OUT")
declare -A done; for k in home lobby-custom lobby-queue champselect ingame endofgame; do ls "$OUT/$k"_*.png >/dev/null 2>&1 && done[$k]=1; done
shot() {
  local f="$1_$(date +%m%d-%H%M%S)"
  powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$TOOLS/screen-shot.ps1")" "$W/$f.png" > "$OUT/$f.rect.txt" 2>/dev/null
  if [ -s "$OUT/$f.png" ]; then echo "[$(date +%T)] 찍음 $1"; done[$1]=1; else rm -f "$OUT/$f.rect.txt"; echo "[$(date +%T)] 실패 $1 · 다시 시도"; fi
}
t0=$(date +%s); last=""; seen=$(date +%s)
while [ $(( $(date +%s) - t0 )) -lt 14400 ]; do
  IFS=: read -r _ _ PORT PW _ < "$LF" 2>/dev/null
  ph=$(curl -sk -m 4 -u "riot:$PW" "https://127.0.0.1:$PORT/lol-gameflow/v1/gameflow-phase" 2>/dev/null | tr -d '"')
  kind=""
  case "$ph" in
    None) kind=home ;;
    Lobby) c=$(curl -sk -m 4 -u "riot:$PW" "https://127.0.0.1:$PORT/lol-lobby/v2/lobby" | grep -o '"isCustom":[a-z]*' | head -1); [ "$c" = '"isCustom":false' ] && kind=lobby-queue || kind=lobby-custom ;;
    ChampSelect) kind=champselect ;;
    InProgress) kind=ingame ;;
    EndOfGame) kind=endofgame ;;
  esac
  if [ "$kind" != "$last" ]; then last="$kind"; seen=$(date +%s); fi
  if [ -n "$kind" ] && [ -z "${done[$kind]}" ]; then
    wait=4; [ "$kind" = champselect ] && wait=8; [ "$kind" = ingame ] && wait=100
    [ $(( $(date +%s) - seen )) -ge $wait ] && shot "$kind"
  fi
  all=1; for k in home lobby-custom lobby-queue champselect ingame endofgame; do [ -z "${done[$k]}" ] && all=0; done
  [ $all = 1 ] && { echo "전부 찍음"; break; }
  sleep 3
done
ls "$OUT"
