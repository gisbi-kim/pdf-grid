Unicode true
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"
Name "PDF Grid 1.4.4"
OutFile "PDF-Grid-Desktop-Setup-1.4.4.exe"
InstallDir "$LOCALAPPDATA\Programs\pdf-grid-desktop"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 16
BrandingText "PDF Grid"
AutoCloseWindow true
Icon "app.ico"
UninstallIcon "app.ico"
VIProductVersion "1.4.4.0"
VIAddVersionKey "LegalCopyright" "PDF Grid contributors"
VIAddVersionKey "ProductName" "PDF Grid"
VIAddVersionKey "FileDescription" "PDF Grid lightweight setup"
VIAddVersionKey "FileVersion" "1.4.4"
VIAddVersionKey "ProductVersion" "1.4.4"
!define KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\88d3b172-4c13-5732-a92d-3c1735225b00"
!define LOCATIONKEY "Software\88d3b172-4c13-5732-a92d-3c1735225b00"
Var OldVersion
Var OldLocation
Var OldUninstaller
Var OldType
Var Mutex
Var IsExisting
Var ForceMode
Var ModeDialog
Var NormalRadio
Var ForceRadio
Page custom MaintenanceCreate MaintenanceLeave
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Function .onInit
 SetShellVarContext current
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "Windows 10/11 64비트용 프로그램입니다."
  Abort
 ${EndIf}
 System::Call 'kernel32::CreateMutex(p0,i0,t"PDFGridLightSetupMutex")p.r0 ?e'
 Pop $1
 StrCpy $Mutex $0
 ${If} $1 == 183
  MessageBox MB_ICONINFORMATION "다른 PDF Grid 설치 프로그램이 실행 중입니다."
  Abort
 ${EndIf}
 StrCpy $IsExisting 0
 StrCpy $ForceMode 0
 StrCpy $OldType ""
 ReadRegStr $OldVersion HKCU "${KEY}" "DisplayVersion"
 ReadRegStr $OldLocation HKCU "${LOCATIONKEY}" "InstallLocation"
 ${If} $OldLocation == ""
  ReadRegStr $OldLocation HKCU "${KEY}" "InstallLocation"
 ${EndIf}
 ${If} $OldLocation == ""
  StrCpy $OldLocation "$INSTDIR"
 ${EndIf}
 IfFileExists "$OldLocation\Uninstall PDF Grid.exe" 0 +3
  StrCpy $OldUninstaller "$OldLocation\Uninstall PDF Grid.exe"
  StrCpy $OldType "electron"
 IfFileExists "$OldLocation\Uninstall.exe" 0 +3
  StrCpy $OldUninstaller "$OldLocation\Uninstall.exe"
  StrCpy $OldType "webview"
 ${If} $OldVersion == ""
 ${AndIf} $OldType == ""
 ${AndIf} ${FileExists} "$LOCALAPPDATA\PDFGrid\PDF-Grid.exe"
  StrCpy $OldLocation "$LOCALAPPDATA\PDFGrid"
  StrCpy $OldType "go"
 ${EndIf}
 ${If} $OldVersion != ""
 ${OrIf} $OldType != ""
 ${OrIf} ${FileExists} "$OldLocation\PDF Grid.exe"
  StrCpy $IsExisting 1
  IfSilent 0 +3
   MessageBox MB_ICONSTOP "기존 설치가 있습니다. 설치 방식 확인을 위해 /S 없이 실행해 주세요."
   Abort
  ${If} $OldVersion == "1.1.0"
   StrCpy $ForceMode 1
  ${EndIf}
  ${If} $OldVersion == ""
   StrCpy $OldVersion "버전 정보 없음"
  ${EndIf}
  ${If} $OldVersion == "1.4.4"
   MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "PDF Grid $OldVersion 버전이 이미 설치되어 있습니다.$\r$\n$\r$\n기존 프로그램을 제거하고 1.4.4 버전을 다시 설치할까요?$\r$\nPDF 원본과 기존 사용자 데이터 폴더는 삭제하지 않습니다.$\r$\n작업 중인 결과를 저장하고 PDF Grid 창을 닫은 뒤 진행해 주세요." IDYES confirmed
  ${Else}
   MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "PDF Grid $OldVersion 버전이 설치되어 있습니다.$\r$\n$\r$\n기존 프로그램을 제거하고 경량 버전 1.4.4으로 교체할까요?$\r$\nPDF 원본과 기존 사용자 데이터 폴더는 삭제하지 않습니다.$\r$\n작업 중인 결과를 저장하고 PDF Grid 창을 닫은 뒤 진행해 주세요." IDYES confirmed
  ${EndIf}
  Abort
 confirmed:
  StrCpy $INSTDIR $OldLocation
 ${EndIf}
 ; Legacy per-machine installs require their own administrator uninstaller.
 SetRegView 64
 ReadRegStr $0 HKLM "${KEY}" "UninstallString"
 SetRegView 32
 ${If} $0 == ""
  ReadRegStr $0 HKLM "${KEY}" "UninstallString"
 ${EndIf}
 ${If} $0 != ""
  MessageBox MB_ICONSTOP "관리자 권한으로 설치된 이전 PDF Grid가 있습니다. Windows 설정의 '설치된 앱'에서 이전 버전을 제거한 뒤 이 설치 프로그램을 다시 실행해 주세요."
  Abort
 ${EndIf}
FunctionEnd


Function MaintenanceCreate
 ${If} $IsExisting != 1
  Abort
 ${EndIf}
 nsDialogs::Create 1018
 Pop $ModeDialog
 ${If} $ModeDialog == error
  Abort
 ${EndIf}
 ${NSD_CreateLabel} 0 0 100% 18u "PDF Grid $OldVersion — 설치 방식을 선택하세요."
 Pop $0
 ${NSD_CreateRadioButton} 0 24u 100% 20u "일반 업데이트 / 재설치"
 Pop $NormalRadio
 ${NSD_CreateRadioButton} 0 48u 100% 28u "기존 프로그램 강제 정리 후 재설치 (제거 오류 시 권장)"
 Pop $ForceRadio
 ${If} $ForceMode == 1
  ${NSD_Check} $ForceRadio
 ${Else}
  ${NSD_Check} $NormalRadio
 ${EndIf}
 ${NSD_CreateLabel} 0 80u 100% 28u "강제 정리는 기존 제거 프로그램을 실행하지 않고 PDF Grid 프로그램 파일과 등록 정보만 정리합니다. PDF 원본과 사용자 데이터는 유지합니다."
 Pop $0
 ${NSD_CreateLabel} 0 112u 100% 20u "$INSTDIR"
 Pop $0
 nsDialogs::Show
FunctionEnd

Function MaintenanceLeave
 ${NSD_GetState} $ForceRadio $0
 StrCpy $ForceMode 0
 ${If} $0 == ${BST_CHECKED}
  StrCpy $ForceMode 1
 ${EndIf}
FunctionEnd

Function ForceCleanup
 ; Refuse drive roots and personal/system base directories. Only exact owned
 ; filenames are removed, and any other files (including PDFs) remain in place.
 GetFullPathName $0 "$INSTDIR"
 ${GetRoot} "$0" $1
 ${If} $0 == "$1\"
 ${OrIf} $0 == "$1"
 ${OrIf} $0 == "$PROFILE"
 ${OrIf} $0 == "$DESKTOP"
 ${OrIf} $0 == "$DOCUMENTS"
 ${OrIf} $0 == "$APPDATA"
 ${OrIf} $0 == "$LOCALAPPDATA"
 ${OrIf} $0 == "$PROGRAMFILES"
 ${OrIf} $0 == "$PROGRAMFILES64"
 ${OrIf} $0 == "$WINDIR"
  MessageBox MB_ICONSTOP "설치 경로를 확인할 수 없어 강제 정리를 중단했습니다. 프로그램 전용 폴더인지 확인해 주세요."
  SetErrorLevel 2
  Quit
 ${EndIf}
 StrCpy $INSTDIR $0
 ; No deletion through directory junctions/symbolic links.
 StrCpy $2 "$INSTDIR"
 Call RejectReparse
 StrCpy $2 "$INSTDIR\resources"
 Call RejectReparse
 StrCpy $2 "$INSTDIR\locales"
 Call RejectReparse
 !include "force-cleanup.nsh"
 RMDir "$INSTDIR\resources"
 RMDir "$INSTDIR\locales"
 DeleteRegKey HKCU "${KEY}"
 DeleteRegKey HKCU "${LOCATIONKEY}"
 Delete "$SMPROGRAMS\PDF Grid.lnk"
 Return
 cleanupFailed:
 MessageBox MB_ICONSTOP "PDF Grid 프로그램 파일을 정리하지 못했습니다. PDF Grid와 이전 오류 창을 닫고 다시 시도해 주세요."
 SetErrorLevel 2
 Quit
FunctionEnd

Function RejectReparse
 System::Call 'kernel32::GetFileAttributes(t r2)i.r0'
 ${If} $0 != -1
  IntOp $0 $0 & 0x400
  ${If} $0 != 0
   MessageBox MB_ICONSTOP "설치 경로가 연결 폴더여서 자동 강제 정리를 중단했습니다."
   SetErrorLevel 2
   Quit
  ${EndIf}
 ${EndIf}
FunctionEnd

Function CheckClosed
 retry:
 ; Only inspect processes in this user's installation directory. Never terminate
 ; a running viewer, which could contain unsaved merge/split results.
 System::Call 'kernel32::SetEnvironmentVariable(t"PDFGRID_INSTALL_DIR",t"$INSTDIR")'
 ${DisableX64FSRedirection}
 nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "$$p=Get-Process -Name 'PDF Grid','PDF-Grid' -ErrorAction SilentlyContinue | Where-Object { $$_.Path -and ([IO.Path]::GetDirectoryName($$_.Path) -eq $$env:PDFGRID_INSTALL_DIR) }; if ($$p) { exit 10 } else { exit 0 }"`
 ${EnableX64FSRedirection}
 Pop $0
 Pop $1
 ${If} $0 == 10
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "PDF Grid가 실행 중입니다. 결과 파일을 저장하고 앱을 종료한 뒤 '다시 시도'를 눌러 주세요.$\r$\n브라우저에서 쓰던 이전 버전은 화면의 '앱 종료' 버튼을 눌러 주세요." IDRETRY retry
  SetErrorLevel 2
  Quit
 ${ElseIf} $0 != 0
  MessageBox MB_ICONSTOP "실행 중인 앱을 확인하지 못했습니다. PowerShell 실행이 가능한지 확인해 주세요."
  Abort
 ${EndIf}
FunctionEnd

Section "Install"
 Call CheckClosed
 ; Verify the shared runtime BEFORE removing the old application.
 InitPluginsDir
 File /oname=$PLUGINSDIR\WebView2Loader.dll "WebView2Loader.dll"
 System::Call 'kernel32::LoadLibrary(t"$PLUGINSDIR\WebView2Loader.dll")p.r0'
 ${If} $0 == 0
  MessageBox MB_ICONSTOP "WebView2 Runtime 확인에 실패했습니다. 기존 앱은 유지됩니다."
  Abort
 ${EndIf}
 System::Call 'kernel32::GetProcAddress(p r0,m"GetAvailableCoreWebView2BrowserVersionString")p.r1'
 System::Call '::$1(p0,*p.r2)i.r3'
 System::Call 'kernel32::FreeLibrary(p r0)'
 ${If} $3 < 0
 ${OrIf} $2 == 0
  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "Microsoft Edge WebView2 Runtime이 필요합니다. 기존 앱은 유지됩니다.$\r$\n확인을 누르면 Microsoft 다운로드 페이지가 열립니다. Evergreen Runtime을 설치한 뒤 다시 실행해 주세요." IDCANCEL runtimeDone
  ExecShell "open" "https://developer.microsoft.com/microsoft-edge/webview2/"
 runtimeDone:
  Abort
 ${EndIf}
 System::Call 'ole32::CoTaskMemFree(p r2)'
 ${If} $ForceMode == 1
  Call ForceCleanup
 ${ElseIf} $OldUninstaller != ""
  CopyFiles /SILENT "$OldUninstaller" "$PLUGINSDIR\previous-uninstall.exe"
  ExecWait '"$PLUGINSDIR\previous-uninstall.exe" /S /KEEP_APP_DATA _?=$INSTDIR' $0
  ${If} $0 != 0
   MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "이전 제거 프로그램이 실패했습니다.$\r$\nPDF Grid 프로그램 파일을 직접 정리하고 재설치할까요?$\r$\nPDF 원본과 사용자 데이터는 유지합니다." IDYES fallbackCleanup
   SetErrorLevel 2
   Quit
   fallbackCleanup:
   Call ForceCleanup
  ${EndIf}
 ${EndIf}
 SetOutPath "$INSTDIR"
 ClearErrors
 File "PDF-Grid.exe"
 IfErrors installFailed
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "${LOCATIONKEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${KEY}" "DisplayName" "PDF Grid"
 WriteRegStr HKCU "${KEY}" "DisplayVersion" "1.4.4"
 WriteRegStr HKCU "${KEY}" "Publisher" "PDF Grid contributors"
 WriteRegStr HKCU "${KEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${KEY}" "DisplayIcon" '$\"$INSTDIR\PDF-Grid.exe$\",0'
 WriteRegStr HKCU "${KEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
 WriteRegDWORD HKCU "${KEY}" "NoModify" 1
 WriteRegDWORD HKCU "${KEY}" "NoRepair" 1
 WriteRegDWORD HKCU "${KEY}" "EstimatedSize" 12000
 CreateShortcut "$DESKTOP\PDF Grid.lnk" "$INSTDIR\PDF-Grid.exe"
 CreateDirectory "$SMPROGRAMS\PDF Grid"
 CreateShortcut "$SMPROGRAMS\PDF Grid\PDF Grid.lnk" "$INSTDIR\PDF-Grid.exe"
 CreateShortcut "$SMPROGRAMS\PDF Grid\제거.lnk" "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "Software\Classes\PDFGridDesktop.PDF" "" "PDF Grid PDF"
 WriteRegStr HKCU "Software\Classes\PDFGridDesktop.PDF\DefaultIcon" "" '$\"$INSTDIR\PDF-Grid.exe$\",0'
 WriteRegStr HKCU "Software\Classes\PDFGridDesktop.PDF\shell\open\command" "" '$\"$INSTDIR\PDF-Grid.exe$\" $\"%1$\"'
 WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "PDFGridDesktop.PDF" ""
 WriteRegStr HKCU "Software\PDFGridDesktop\Capabilities" "ApplicationName" "PDF Grid"
 WriteRegStr HKCU "Software\PDFGridDesktop\Capabilities" "ApplicationDescription" "PDF viewer, merger and splitter"
 WriteRegStr HKCU "Software\PDFGridDesktop\Capabilities\FileAssociations" ".pdf" "PDFGridDesktop.PDF"
 WriteRegStr HKCU "Software\RegisteredApplications" "PDF Grid" "Software\PDFGridDesktop\Capabilities"
 System::Call 'shell32::SHChangeNotify(i 0x08000000,i0,p0,p0)'
 IfSilent done
 MessageBox MB_YESNO|MB_ICONINFORMATION "PDF Grid 1.4.4 설치가 완료되었습니다.$\r$\n지금 실행할까요?" IDNO done
 Exec '"$INSTDIR\PDF-Grid.exe"'
 Goto done
 installFailed:
 MessageBox MB_ICONSTOP "프로그램 파일을 설치하지 못했습니다. PDF Grid를 닫고 다시 설치해 주세요."
 Abort
 done:
SectionEnd

Section "Uninstall"
 SetShellVarContext current
 ; Delete only application-owned files; preserve profiles and user PDFs.
 Delete "$INSTDIR\PDF-Grid.exe"
 IfFileExists "$INSTDIR\PDF-Grid.exe" 0 closed
  MessageBox MB_ICONSTOP "PDF Grid 창을 닫은 뒤 제거 프로그램을 다시 실행해 주세요."
  Abort
 closed:
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 Delete "$DESKTOP\PDF Grid.lnk"
 Delete "$SMPROGRAMS\PDF Grid\PDF Grid.lnk"
 Delete "$SMPROGRAMS\PDF Grid\제거.lnk"
 RMDir "$SMPROGRAMS\PDF Grid"
 DeleteRegKey HKCU "${KEY}"
 DeleteRegKey HKCU "${LOCATIONKEY}"
 DeleteRegKey HKCU "Software\Classes\PDFGridDesktop.PDF"
 DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "PDFGridDesktop.PDF"
 DeleteRegKey HKCU "Software\PDFGridDesktop"
 DeleteRegValue HKCU "Software\RegisteredApplications" "PDF Grid"
 System::Call 'shell32::SHChangeNotify(i 0x08000000,i0,p0,p0)'
SectionEnd
