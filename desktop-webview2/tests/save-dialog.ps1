param([int]$AppPid,[string]$Destination)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SaveDialog {
 public delegate bool EnumProc(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p,IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,EnumProc p,IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h,int id);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern bool SetWindowText(IntPtr h,string s);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 public static string Text(IntPtr h){var s=new StringBuilder(4096);GetWindowText(h,s,4096);return s.ToString();}
 public static string Class(IntPtr h){var s=new StringBuilder(256);GetClassName(h,s,256);return s.ToString();}
 public static IntPtr Find(int pid){IntPtr found=IntPtr.Zero;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid && Class(h)=="#32770" && GetDlgItem(h,1)!=IntPtr.Zero){found=h;return false;}return true;},IntPtr.Zero);return found;}
 public static IntPtr Edit(IntPtr h){IntPtr edit=IntPtr.Zero;EnumChildWindows(h,(c,l)=>{if(Class(c)=="Edit" && IsWindowVisible(c) && IsWindowEnabled(c)){edit=c;}return true;},IntPtr.Zero);return edit;}
 public static string Windows(int pid){var s=new StringBuilder();EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid){s.Append(Class(h)+": "+Text(h)+"\n");}return true;},IntPtr.Zero);return s.ToString();}
}
'@
for($n=0;$n -lt 300;$n++){
 $dialog=[SaveDialog]::Find($AppPid)
 if($dialog -ne [IntPtr]::Zero){
  Write-Host "Native save dialog: $([SaveDialog]::Text($dialog))"
  $edit=[SaveDialog]::Edit($dialog)
  if($edit -ne [IntPtr]::Zero){
   [SaveDialog]::SetWindowText($edit,$Destination)|Out-Null
   [SaveDialog]::PostMessage([SaveDialog]::GetDlgItem($dialog,1),0xF5,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null
   Write-Host "Selected save path: $Destination"
   exit 0
  }
 }
 if($n -eq 50){Write-Host ([SaveDialog]::Windows($AppPid))}
 Start-Sleep -Milliseconds 100
}
Write-Host ([SaveDialog]::Windows($AppPid))
throw 'Native save dialog was not found'
