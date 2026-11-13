Unicode true
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
Name "PDF Grid 1.4.0"
OutFile "PDF-Grid-Desktop-Setup-1.4.0.exe"
InstallDir "$LOCALAPPDATA\Programs\pdf-grid-desktop"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 16
BrandingText "PDF Grid"
AutoCloseWindow true
Icon "app.ico"
UninstallIcon "app.ico"
VIProductVersion "1.4.0.0"
VIAddVersionKey "LegalCopyright" "PDF Grid contributors"
VIAddVersionKey "ProductName" "PDF Grid"
VIAddVersionKey "FileDescription" "PDF Grid lightweight setup"
VIAddVersionKey "FileVersion" "1.4.0"
VIAddVersionKey "ProductVersion" "1.4.0"
!define KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\88d3b172-4c13-5732-a92d-3c1735225b00"
!define LOCATIONKEY "Software\88d3b172-4c13-5732-a92d-3c1735225b00"
Var OldVersion
Var OldLocation
Var OldUninstaller
Var OldType
Var Mutex
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
  ${If} $OldVersion == ""
   StrCpy $OldVersion "버전 정보 없음"
  ${EndIf}
  ${If} $OldVersion == "1.4.0"
   MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "PDF Grid $OldVersion 버전이 이미 설치되어 있습니다.$\r$\n$\r$\n기존 프로그램을 제거하고 1.4.0 버전을 다시 설치할까요?$\r$\nPDF 원본과 기존 사용자 데이터 폴더는 삭제하지 않습니다.$\r$\n작업 중인 결과를 저장하고 PDF Grid 창을 닫은 뒤 진행해 주세요." IDYES confirmed
  ${Else}
   MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "PDF Grid $OldVersion 버전이 설치되어 있습니다.$\r$\n$\r$\n기존 프로그램을 제거하고 경량 버전 1.4.0으로 교체할까요?$\r$\nPDF 원본과 기존 사용자 데이터 폴더는 삭제하지 않습니다.$\r$\n작업 중인 결과를 저장하고 PDF Grid 창을 닫은 뒤 진행해 주세요." IDYES confirmed
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
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "PDF Grid가 실행 중입니다. 결과 파일을 저장하고 모든 PDF Grid 창을 닫은 뒤 '다시 시도'를 눌러 주세요." IDRETRY retry
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
 ${If} $OldUninstaller != ""
  ; Explicit _?= keeps NSIS ExecWait synchronous. No /DELETE_APP_DATA flag.
  CopyFiles /SILENT "$OldUninstaller" "$PLUGINSDIR\previous-uninstall.exe"
  ExecWait '"$PLUGINSDIR\previous-uninstall.exe" /S /KEEP_APP_DATA _?=$INSTDIR' $0
  ${If} $0 != 0
   MessageBox MB_ICONSTOP "이전 버전 제거에 실패했습니다. Windows 설정에서 PDF Grid를 제거한 뒤 다시 설치해 주세요."
   Abort
  ${EndIf}
 ${EndIf}
 SetOutPath "$INSTDIR"
 ClearErrors
 File "PDF-Grid.exe"
 IfErrors installFailed
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "${LOCATIONKEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${KEY}" "DisplayName" "PDF Grid"
 WriteRegStr HKCU "${KEY}" "DisplayVersion" "1.4.0"
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
 MessageBox MB_YESNO|MB_ICONINFORMATION "PDF Grid 1.4.0 설치가 완료되었습니다.$\r$\n지금 실행할까요?" IDNO done
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
