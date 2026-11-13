param([int]$AppPid,[string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$pidCondition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$AppPid)
for($n=0;$n -lt 300;$n++){
 $windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,$pidCondition)
 foreach($window in $windows){
  if($window.Current.Name -ne 'PDF Grid — 파일 저장'){continue}
  $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
  $edits=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
  foreach($edit in $edits){
   Write-Host "Edit: $($edit.Current.Name) / $($edit.Current.AutomationId)"
   if($edit.Current.Name -like '*File name*'){
    $value=$edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $value.SetValue($Destination)
    $save=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1'))
    $save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Write-Host "Selected save path: $Destination"
    exit 0
   }
  }
 }
 Start-Sleep -Milliseconds 100
}
throw 'Native save dialog was not found'
