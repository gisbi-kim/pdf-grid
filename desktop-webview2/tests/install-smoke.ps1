$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinDialog {
 public delegate bool EnumProc(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc p, IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h,int id);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 public static string Text(IntPtr h){var s=new StringBuilder(4096);GetWindowText(h,s,4096);return s.ToString();}
 public static IntPtr Find(int pid,int id){IntPtr found=IntPtr.Zero;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid && GetDlgItem(h,id)!=IntPtr.Zero){found=h;return false;}return true;},IntPtr.Zero);return found;}
 public static string Children(IntPtr h){var s=new StringBuilder();EnumChildWindows(h,(c,l)=>{s.Append(Text(c));s.Append("\n");return true;},IntPtr.Zero);return s.ToString();}
 public static IntPtr ChildByText(IntPtr h,string text){IntPtr found=IntPtr.Zero;EnumChildWindows(h,(c,l)=>{if(Text(c).Contains(text)){found=c;return false;}return true;},IntPtr.Zero);return found;}
 public static void Click(IntPtr h,int id){PostMessage(GetDlgItem(h,id),0xF5,IntPtr.Zero,IntPtr.Zero);}
 public static void ClickHandle(IntPtr h){PostMessage(h,0xF5,IntPtr.Zero,IntPtr.Zero);}
 public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,int flags);
}
'@
function Answer($process,$id,$text){
 for($i=0;$i -lt 300;$i++){
  $h=[WinDialog]::Find($process.Id,$id)
  if($h -ne [IntPtr]::Zero){
   $content=[WinDialog]::Children($h)
   if($content.Contains($text)){Write-Host "Dialog: $content";[WinDialog]::Click($h,$id);return}
  }
  if($process.HasExited){throw "Setup exited before expected dialog: $text"}
  Start-Sleep -Milliseconds 100
 }
 $dialog=[WinDialog]::Find($process.Id,1)
 if($dialog -ne [IntPtr]::Zero){Write-Host ([WinDialog]::Children($dialog))}
 throw "Dialog timeout: $text"
}
function ChooseMode($process,[bool]$force){
 for($i=0;$i -lt 300;$i++){
  $h=[WinDialog]::Find($process.Id,1)
  if($h -ne [IntPtr]::Zero -and [WinDialog]::Children($h).Contains('일반 업데이트 / 재설치')){
   $label=if($force){'기존 프로그램 강제 정리 후 재설치'}else{'일반 업데이트 / 재설치'}
   $radio=[WinDialog]::ChildByText($h,$label)
   if($radio -eq [IntPtr]::Zero){throw "Missing installation option: $label"}
   [WinDialog]::ClickHandle($radio)
   Start-Sleep -Milliseconds 150
   if($force){
    Add-Type -AssemblyName System.Drawing
    $rect=[WinDialog+Rect]::new();[WinDialog]::GetWindowRect($h,[ref]$rect)|Out-Null
    $bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top)
    $graphics=[Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
    try{[WinDialog]::PrintWindow($h,$dc,0)|Out-Null}finally{$graphics.ReleaseHdc($dc);$graphics.Dispose()}
    $bitmap.Save((Join-Path $PWD 'tests/maintenance-force.png'),[Drawing.Imaging.ImageFormat]::Png);$bitmap.Dispose()
   }
   [WinDialog]::Click($h,1)
   return
  }
  if($process.HasExited){throw 'Setup exited before maintenance page'}
  Start-Sleep -Milliseconds 100
 }
 throw 'Maintenance page timeout'
}
$setup=(Resolve-Path './PDF-Grid-Desktop-Setup-1.4.2.exe').Path
$target=Join-Path $env:LOCALAPPDATA 'Programs/pdf-grid-desktop'
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\88d3b172-4c13-5732-a92d-3c1735225b00'
$p=Start-Process $setup -ArgumentList '/S' -PassThru
for($i=0;$i -lt 120;$i++){
 if($p.HasExited){break}
 $dialog=[WinDialog]::Find($p.Id,1)
 if($dialog -ne [IntPtr]::Zero){$content=[WinDialog]::Children($dialog);if($content){Write-Host "Unexpected silent-install dialog: $content"}}
 Start-Sleep -Milliseconds 250
}
if(!$p.HasExited -or $p.ExitCode -ne 0){throw 'First install failed'}
if(!(Test-Path "$target/PDF-Grid.exe")){throw 'Missing installed executable'}
$before=(Get-FileHash "$target/PDF-Grid.exe").Hash
# Existing versions require an explicit maintenance choice.
Set-ItemProperty $key DisplayVersion '1.3.3'
Move-Item "$target/Uninstall.exe" "$target/Uninstall PDF Grid.exe"
$p=Start-Process $setup -PassThru
Answer $p 7 '경량 버전 1.4.2으로 교체'
if(!$p.WaitForExit(30000)){throw 'Cancelled upgrade did not exit'}
if((Get-FileHash "$target/PDF-Grid.exe").Hash -ne $before){throw 'No changed existing app'}
if((Get-ItemProperty $key).DisplayVersion -ne '1.3.3'){throw 'No changed version'}
$p=Start-Process $setup -PassThru
Answer $p 6 '경량 버전 1.4.2으로 교체'
ChooseMode $p $false
Answer $p 7 '설치가 완료'
if(!$p.WaitForExit(60000) -or $p.ExitCode -ne 0){throw 'Upgrade failed'}
if((Get-ItemProperty $key).DisplayVersion -ne '1.4.2'){throw 'Upgrade did not record version'}
Remove-Item "$target/Uninstall PDF Grid.exe" -ErrorAction SilentlyContinue
$p=Start-Process $setup -PassThru
Answer $p 7 '다시 설치할까요'
if(!$p.WaitForExit(30000)){throw 'Same version cancel failed'}
# Do not force close an installed viewer; show a retry/cancel prompt.
$viewer=Start-Process "$target/PDF-Grid.exe" -PassThru
try{
 Start-Sleep -Seconds 3
 $p=Start-Process $setup -PassThru
 Answer $p 6 '다시 설치할까요'
 ChooseMode $p $false
 Answer $p 2 '실행 중입니다'
 if(!$p.WaitForExit(30000)){throw 'Running-app cancel failed'}
 if($viewer.HasExited){throw 'Setup terminated running viewer'}
} finally {Stop-Process -Id $viewer.Id -ErrorAction SilentlyContinue}
Write-Host 'PASS: fresh install, decline upgrade, accept replacement, same-version prompt, and running-app retry/cancel'

# Regression: the actual supplied 1.1.0 uninstaller has an invalid CRC. Force
# mode must never execute it, must remove Electron files, and must keep PDFs.
Set-ItemProperty $key DisplayVersion '1.1.0'
Set-ItemProperty $key QuietUninstallString 'old-stale-uninstall-command'
Remove-Item "$target/Uninstall.exe"
Copy-Item fixtures/uninstall-1.1.0-original.bin "$target/Uninstall PDF Grid.exe"
Copy-Item ./PDF-Grid.exe "$target/PDF Grid.exe"
New-Item "$target/resources" -ItemType Directory -Force|Out-Null
New-Item "$target/locales" -ItemType Directory -Force|Out-Null
Set-Content "$target/resources/app.asar" 'obsolete-electron-code'
Set-Content "$target/locales/ko.pak" 'obsolete-electron-locale'
Set-Content "$target/chrome_100_percent.pak" 'obsolete-electron-runtime'
Set-Content "$target/keep-original.pdf" '%PDF-preserve-root'
Set-Content "$target/resources/keep-original.pdf" '%PDF-preserve-subdirectory'
$profile=Join-Path $env:APPDATA 'pdf-grid-desktop'
New-Item $profile -ItemType Directory -Force|Out-Null
Set-Content "$profile/force-test-session.json" '{"keep":true}'
$rootHash=(Get-FileHash "$target/keep-original.pdf").Hash
$nestedHash=(Get-FileHash "$target/resources/keep-original.pdf").Hash
$profileHash=(Get-FileHash "$profile/force-test-session.json").Hash
$p=Start-Process $setup -PassThru
Answer $p 6 '경량 버전 1.4.2으로 교체'
ChooseMode $p $true
Answer $p 7 '설치가 완료'
if(!$p.WaitForExit(30000) -or $p.ExitCode -ne 0){throw 'Force replacement failed'}
foreach($obsolete in @('Uninstall PDF Grid.exe','PDF Grid.exe','resources/app.asar','locales/ko.pak','chrome_100_percent.pak')){
 if(Test-Path (Join-Path $target $obsolete)){throw "Force cleanup left owned file: $obsolete"}
}
if((Get-FileHash "$target/keep-original.pdf").Hash -ne $rootHash -or (Get-FileHash "$target/resources/keep-original.pdf").Hash -ne $nestedHash -or (Get-FileHash "$profile/force-test-session.json").Hash -ne $profileHash){throw 'Force cleanup modified user files or profile'}
if((Get-ItemProperty $key).DisplayVersion -ne '1.4.2'){throw 'Force update version missing'}
if((Get-ItemProperty $key).PSObject.Properties.Name -contains 'QuietUninstallString'){throw 'Stale legacy uninstall command remains'}
Write-Host 'PASS: force replacement bypasses the actual broken 1.1.0 uninstaller and preserves root PDFs, nested PDFs, and the old user profile'
