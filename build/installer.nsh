; v0.1.154: remove the Windows startup entry on uninstall (main.js applyAutoLaunch name = TodayNaejeon)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TodayNaejeon"
!macroend

; v0.1.267: 켜져 있는 앱 끄기를 우리 순서로(기본 순서는 두 번만 시도하고 영어 창 「… cannot be closed」를 띄웠음)
;   일반 종료(창 닫기 요청) → 강제 종료를 약 12초 동안 되풀이(보조 프로세스도 이름이 같아 /im으로 한 번에)
;   ⚠️ /t(자식까지)는 넣지 말 것 — USERNAME 필터와 같이 쓰면 taskkill이 137초 걸림(2026-11-27 실측 · 따로 쓰면 0.4초) → 그래도 남으면 한국어 안내 + 다시 시도
;   못 끄는 흔한 경우 = 앱이 관리자 권한으로 켜져 있음(일반 권한 설치 프로그램은 윈도우 규칙상 끌 수 없음) → 안내대로 트레이에서 종료
;   설치 프로그램 자신(PID)은 빼고 · 같은 윈도우 사용자 것만(다른 사용자 계정의 앱은 건드리지 않음)
;   ⚠️ 이 매크로가 있으면 electron-builder 기본 _CHECK_APP_RUNNING($pid · GetProcessInfo)은 안 쓰임 → 여기서 그 변수를 쓰지 말 것
!macro customCheckAppRunning
  System::Call 'kernel32::GetCurrentProcessId() i .R2'
  StrCpy $R1 0
  tn_check:
    nsExec::Exec `"$SYSDIR\cmd.exe" /c tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO csv | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    ${if} $R0 == 0
      IntOp $R1 $R1 + 1
      ${if} $R1 == 1
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
