; v0.1.154: remove the Windows startup entry on uninstall (main.js applyAutoLaunch name = TodayNaejeon)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TodayNaejeon"
!macroend
