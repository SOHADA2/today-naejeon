; v0.1.154: remove the Windows startup entry on uninstall (main.js applyAutoLaunch name = TodayNaejeon)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TodayNaejeon"
!macroend

; v0.1.268: 투데이 내전이 켜져 있는지 = ① 설치 폴더의 exe가 잠겨 있는가(켜져 있으면 윈도우가 쓰기를 막음 · 언어·cmd와 상관없음)
;   ② 같은 윈도우 사용자의 실행 목록(tasklist)에 있는가 — 둘 중 하나라도면 켜져 있음
;   (②만 쓰면 한국어가 아닌 윈도우에서 한글 exe 이름이 깨져 못 찾고 · cmd가 막힌 PC에서도 못 찾아 → 파일 잠김 영어 오류 창이 떴음)
;   결과 = ${_OUT}에 1(켜짐)/0 · $R4를 씀
!macro TN_RUNNING _OUT
  StrCpy ${_OUT} 0
  ${if} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ClearErrors
    FileOpen $R4 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" a
    ${if} ${Errors}
      StrCpy ${_OUT} 1
    ${else}
      FileClose $R4
    ${endIf}
  ${endIf}
  ${if} ${_OUT} == 0
    nsExec::Exec `"$SYSDIR\cmd.exe" /c tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO csv | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
    Pop $R4
    ${if} $R4 == 0
      StrCpy ${_OUT} 1
    ${endIf}
  ${endIf}
!macroend

; v0.1.267: 켜져 있는 앱 끄기를 우리 순서로(기본 순서는 두 번만 시도하고 영어 창 「… cannot be closed」를 띄웠음)
;   일반 종료(창 닫기 요청) → 강제 종료를 약 12초 동안 되풀이 → 그래도 남으면 한국어 안내 + 다시 시도
;   ⚠️ /t(자식까지)는 넣지 말 것 — USERNAME 필터와 같이 쓰면 taskkill이 137초 걸림(2026-11-27 실측 · 따로 쓰면 0.4초 · 일렉트론 보조 프로세스는 이름이 같아 /im으로 다 꺼짐)
;   못 끄는 흔한 경우 = 앱이 관리자 권한으로 켜져 있음(일반 권한 설치 프로그램은 윈도우 규칙상 끌 수 없음) → 안내대로 트레이에서 종료
;   설치 프로그램 자신(PID)은 빼고 · 같은 윈도우 사용자 것만(다른 사용자 계정의 앱은 건드리지 않음)
; v0.1.268: ① 자동 업데이트(--updated)면 앱이 스스로 꺼지기를 최대 5초 기다림(꺼지기 전 방장 자리·접속 표시 정리 최대 3초 — 먼저 끄면 잘림)
;   ② 직접 설치인데 롤 게임(또는 팟지 리플레이 = 같은 League of Legends.exe)이 켜져 있으면 끄기 전에 한 번 물음(그 밖에는 묻지 않고 바로 끔)
;   ⚠️ 이 매크로가 있으면 electron-builder 기본 _CHECK_APP_RUNNING($pid · GetProcessInfo)은 안 쓰임 → 여기서 그 변수를 쓰지 말 것
!macro customCheckAppRunning
  System::Call 'kernel32::GetCurrentProcessId() i .R2'
  StrCpy $R1 0
  ${if} ${isUpdated}
    StrCpy $R3 0
    tn_wait:
      !insertmacro TN_RUNNING $R0
      ${if} $R0 == 1
      ${andIf} $R3 < 10
        IntOp $R3 $R3 + 1
        Sleep 500
        Goto tn_wait
      ${endIf}
  ${endIf}
  tn_check:
    !insertmacro TN_RUNNING $R0
    ${if} $R0 == 1
      IntOp $R1 $R1 + 1
      ${if} $R1 == 1
        ${ifNot} ${isUpdated}
          nsExec::Exec `"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq League of Legends.exe" /FO csv | "$SYSDIR\find.exe" /I "League of Legends.exe"`
          Pop $R3
          ${if} $R3 == 0
            MessageBox MB_OKCANCEL|MB_ICONQUESTION "롤 게임(또는 팟지 리플레이)이 진행 중입니다.$\r$\n$\r$\n지금 설치하면 투데이 내전이 꺼져 이번 판 기록이나 팟지가 빠질 수 있습니다. 게임이 끝난 뒤 설치하는 것을 권합니다.$\r$\n$\r$\n지금 투데이 내전을 끄고 설치할까요?" /SD IDOK IDOK tn_go
            Quit
          ${endIf}
        ${endIf}
        tn_go:
        DetailPrint `Closing running "${PRODUCT_NAME}"...`
        nsExec::Exec `"$SYSDIR\cmd.exe" /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $R2" /fi "USERNAME eq %USERNAME%"`
        Sleep 1500
      ${else}
        nsExec::Exec `"$SYSDIR\cmd.exe" /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $R2" /fi "USERNAME eq %USERNAME%"`
        Sleep 1000
      ${endIf}
      ${if} $R1 < 10
        Goto tn_check
      ${endIf}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "투데이 내전이 켜져 있어 끄지 못했습니다.$\r$\n$\r$\n작업 표시줄 오른쪽(시계 옆 ^)의 투데이 내전 아이콘을 오른쪽 클릭해 「투데이 내전 종료」를 누른 뒤 「다시 시도」를 눌러 주세요.$\r$\n$\r$\n그래도 안 되면 앱이 관리자 권한으로 켜져 있는 것입니다. PC를 다시 시작한 뒤 설치해 주세요." /SD IDCANCEL IDRETRY tn_retry
      Quit
      tn_retry:
        StrCpy $R1 1
        Goto tn_check
    ${endIf}
!macroend
