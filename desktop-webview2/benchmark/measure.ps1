$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class BenchWindow {
 public delegate bool EnumProc(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p,IntPtr l);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 public static string Text(IntPtr h){var s=new StringBuilder(4096);GetWindowText(h,s,4096);return s.ToString();}
 public static IntPtr Find(int pid){IntPtr found=IntPtr.Zero;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid && IsWindowVisible(h) && Text(h).Contains("PDF Grid")){found=h;return false;}return true;},IntPtr.Zero);return found;}
}
'@
$base=Join-Path $PWD 'benchmark'
$results=Join-Path $base 'results'
New-Item $results -ItemType Directory -Force|Out-Null
$versions=@('1.1.0','1.3.3','1.4.1')
$rows=[Collections.Generic.List[object]]::new()
$originalLocal=$env:LOCALAPPDATA
function Run-Sample([string]$version,[string]$phase,[int]$round){
 $runName="$phase-$round-$version"
 $signal=Join-Path $results "$runName.signal.json"
 $env:PDFGRID_BENCHMARK_RESULT=$signal
 $env:PDFGRID_BENCHMARK_PROFILE=Join-Path $base "profiles/electron-$version"
 New-Item $env:PDFGRID_BENCHMARK_PROFILE -ItemType Directory -Force|Out-Null
 if($version -eq '1.4.1'){
  $env:LOCALAPPDATA=Join-Path $base 'profiles/webview2'
  $exe=Join-Path $base 'apps/1.4.1/PDF-Grid.exe'
 }else{$env:LOCALAPPDATA=$originalLocal;$exe=Join-Path $base "apps/$version/PDF Grid.exe"}
 $startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 $watch=[Diagnostics.Stopwatch]::StartNew()
 $p=Start-Process $exe -PassThru -RedirectStandardOutput (Join-Path $results "$runName.stdout.txt") -RedirectStandardError (Join-Path $results "$runName.stderr.txt")
 $env:LOCALAPPDATA=$originalLocal
 $visible=$null;$window=[IntPtr]::Zero
 try{
  while($watch.Elapsed.TotalSeconds -lt 45){
   $window=[BenchWindow]::Find($p.Id)
   if($window -ne [IntPtr]::Zero){
    if($null -eq $visible){$visible=$watch.Elapsed.TotalMilliseconds}
    if([BenchWindow]::Text($window) -eq 'PDF Grid [BENCH READY]'){break}
   }
   if($p.HasExited){throw "Version $version exited before readiness: $($p.ExitCode)"}
   Start-Sleep -Milliseconds 10
  }
  if(!(Test-Path $signal)){throw "Version $version readiness timed out"}
  $times=Get-Content $signal -Raw|ConvertFrom-Json
  $row=[pscustomobject]@{version=$version;phase=$phase;round=$round;windowVisibleMs=[Math]::Round($visible,1);defaultUiMs=$times.uiAt-$startedAt;gridReadyMs=$times.readyAt-$startedAt;startedAtUtcMs=$startedAt;pid=$p.Id}
  if($row.gridReadyMs -le 0 -or $row.defaultUiMs -le 0){throw 'Invalid shared-clock timestamps'}
  $rows.Add($row)
  Write-Host ($row|ConvertTo-Json -Compress)
 }finally{
  # Record descendants after measurement, close the app normally, then ensure
  # no owned renderer survives into the next sample. Profiles remain on disk.
  $all=Get-CimInstance Win32_Process
  $owned=[Collections.Generic.HashSet[int]]::new();$owned.Add($p.Id)|Out-Null
  do{$changed=$false;foreach($proc in $all){if($owned.Contains([int]$proc.ParentProcessId) -and $owned.Add([int]$proc.ProcessId)){$changed=$true}}}while($changed)
  if($window -ne [IntPtr]::Zero){[BenchWindow]::PostMessage($window,0x10,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null}
  if(!$p.WaitForExit(10000)){Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue}
  Start-Sleep -Milliseconds 700
  foreach($ownedId in $owned){Stop-Process -Id $ownedId -Force -ErrorAction SilentlyContinue}
  $rows|ConvertTo-Json -Depth 5|Set-Content (Join-Path $results 'samples.json') -Encoding utf8
  $rows|Export-Csv (Join-Path $results 'samples.csv') -NoTypeInformation -Encoding utf8
  Start-Sleep -Milliseconds 1000
 }
}
# Fresh user profiles: one observation per app. OS disk caches are not flushed.
foreach($version in $versions){Run-Sample $version 'fresh-profile' 0}
# Balanced cyclic orders, then reverse orders, prevent one app always going first.
$orders=@(@('1.1.0','1.3.3','1.4.1'),@('1.3.3','1.4.1','1.1.0'),@('1.4.1','1.1.0','1.3.3'),@('1.4.1','1.3.3','1.1.0'),@('1.1.0','1.4.1','1.3.3'),@('1.3.3','1.1.0','1.4.1'))
for($round=0;$round -lt $orders.Count;$round++){foreach($version in $orders[$round]){Run-Sample $version 'reused-profile' ($round+1)}}
$cpu=Get-CimInstance Win32_Processor|Select-Object -First 1 Name,NumberOfCores,NumberOfLogicalProcessors
$os=Get-CimInstance Win32_OperatingSystem|Select-Object Caption,Version,BuildNumber,TotalVisibleMemorySize
$runtime=Get-ChildItem 'C:/Program Files (x86)/Microsoft/EdgeWebView/Application' -Directory|Where-Object {$_.Name -match '^\d+\.'}|Select-Object -ExpandProperty Name
[pscustomobject]@{cpu=$cpu;os=$os;webview2Runtime=$runtime;method='Same Windows VM, actual original Electron 42.0.0 executables and PDF assets, only readiness hooks added; current build has an instrumentation-only tag; no PDF document loaded; 1 fresh profile and 6 reused-profile launches per version; processes closed between launches; OS caches not flushed; identical Grid target after default UI initialized; 1.1.0 default Merge is switched to Grid automatically, without human delay.'}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $results 'environment.json') -Encoding utf8
Write-Host 'PASS: 21 same-machine startup samples completed'
