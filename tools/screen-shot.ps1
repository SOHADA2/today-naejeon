# 🖼️ 화면 캡처(실제 픽셀) + 롤 창 위치 — docs/screen-layout.md 측정용
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File tools\screen-shot.ps1 <저장할 png 경로>
#   출력 = 화면 크기 + 롤 클라("League of Legends")·게임("League of Legends (TM) Client") 창의 보이는 실제 경계·DPI + 모니터 목록
param([string]$out)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public class TnShot {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string n);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out R r, int s);
  [DllImport("user32.dll")] public static extern int GetDpiForWindow(IntPtr h);
  public struct R { public int L, T, Rt, B; }
}
'@
[void][TnShot]::SetProcessDPIAware()
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
if ($out) {
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $g.Dispose()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
"화면 $($b.Width)x$($b.Height)"
foreach ($t in @('League of Legends', 'League of Legends (TM) Client')) {
  $h = [TnShot]::FindWindow([NullString]::Value, $t); if ($h -eq [IntPtr]::Zero) { "${t}: 없음"; continue }
  $r = New-Object TnShot+R; [void][TnShot]::DwmGetWindowAttribute($h, 9, [ref]$r, 16)
  "${t}: x=$($r.L) y=$($r.T) w=$($r.Rt - $r.L) h=$($r.B - $r.T) dpi=$([TnShot]::GetDpiForWindow($h))"
}
foreach ($s in [System.Windows.Forms.Screen]::AllScreens) { "모니터 $($s.DeviceName) $($s.Bounds) primary=$($s.Primary)" }
