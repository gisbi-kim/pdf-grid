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
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 public static string Text(IntPtr h){var s=new StringBuilder(4096);GetWindowText(h,s,4096);return s.ToString();}
 public static IntPtr Find(int pid,int id){IntPtr found=IntPtr.Zero;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid && GetDlgItem(h,id)!=IntPtr.Zero){found=h;return false;}return true;},IntPtr.Zero);return found;}
 public static string Children(IntPtr h){var s=new StringBuilder();EnumChildWindows(h,(c,l)=>{s.Append(Text(c));s.Append("\n");return true;},IntPtr.Zero);return s.ToString();}
 public static void Click(IntPtr h,int id){SendMessage(GetDlgItem(h,id),0xF5,IntPtr.Zero,IntPtr.Zero);}
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
 throw "Dialog timeout: $text"
}
$setup=(Resolve-Path './PDF-Grid-Desktop-Setup-1.4.0.exe').Path
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
# Existing version prompts even if setup is invoked with /S.
Set-ItemProperty $key DisplayVersion '1.3.3'
$p=Start-Process $setup -PassThru
Answer $p 7 '경량 버전 1.4.0으로 교체'
if(!$p.WaitForExit(30000)){throw 'Cancelled upgrade did not exit'}
if((Get-FileHash "$target/PDF-Grid.exe").Hash -ne $before){throw 'No changed existing app'}
if((Get-ItemProperty $key).DisplayVersion -ne '1.3.3'){throw 'No changed version'}
$p=Start-Process $setup -PassThru
Answer $p 6 '경량 버전 1.4.0으로 교체'
Answer $p 7 '설치가 완료'
if(!$p.WaitForExit(60000) -or $p.ExitCode -ne 0){throw 'Upgrade failed'}
if((Get-ItemProperty $key).DisplayVersion -ne '1.4.0'){throw 'Upgrade did not record version'}
$p=Start-Process $setup -PassThru
Answer $p 7 '다시 설치할까요'
if(!$p.WaitForExit(30000)){throw 'Same version cancel failed'}
# Do not force close an installed viewer; show a retry/cancel prompt.
$viewer=Start-Process "$target/PDF-Grid.exe" -PassThru
try{
 Start-Sleep -Seconds 3
 $p=Start-Process $setup -PassThru
 Answer $p 6 '다시 설치할까요'
 Answer $p 2 '실행 중입니다'
 if(!$p.WaitForExit(30000)){throw 'Running-app cancel failed'}
 if($viewer.HasExited){throw 'Setup terminated running viewer'}
} finally {Stop-Process -Id $viewer.Id -ErrorAction SilentlyContinue}
Write-Host 'PASS: fresh install, decline upgrade, accept replacement, same-version prompt, and running-app retry/cancel'
