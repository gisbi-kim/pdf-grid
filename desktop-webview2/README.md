# PDF Grid 1.4.1 — Windows 경량 버전

1.4.1은 설치 방식 화면에 **기존 프로그램 강제 정리 후 재설치**를 추가합니다. 제공받은 1.1.0 설치 파일 자체의 CRC는 정상이나, 포함된 제거 프로그램의 저장 CRC는 `0e68a969`, 실제 계산값은 `456ea5df`로 불일치합니다. 강제 모드는 이 제거 프로그램을 실행하지 않고 `force-cleanup.nsh`의 정확한 프로그램 파일 81개와 해당 앱의 등록 정보만 정리합니다. 폴더를 재귀적으로 삭제하거나 확장자 와일드카드로 지우지 않습니다. 드라이브 루트·개인/시스템 기본 폴더·연결 폴더는 거부합니다. PDF 파일과 사용자 프로필 보존은 실제 손상된 1.1.0 제거 파일을 넣은 Windows 테스트에서 확인했습니다.

기존 설치 확인에 동의한 다음 설치 방식 화면에서 일반 업데이트 또는 강제 정리를 선택합니다. 1.1.0에서는 강제 정리가 기본 선택됩니다. 실행 중인 앱은 사용자가 먼저 종료해야 합니다.

같은 Windows Server 2025 VM에서 원본 Electron 실행 파일과 PDF 자산을 유지한 1.1.0/1.3.3, 계측 태그만 추가한 새 실행기를 번갈아 측정했습니다. 재사용 프로필 6회 중앙값은 창 표시가 각각 136.35/141.7/40.2ms, 동일한 격자 뷰어 준비가 각각 381.5/384.5/470ms였습니다. 새 실행기는 창을 먼저 표시하지만 뷰어 준비는 약 0.09초 느렸습니다. 따라서 전체 기동 속도 개선을 주장하지 않습니다. 1.1.0은 기본 합치기 화면 준비 후 격자 탭을 자동 선택했고, PDF 문서는 열지 않았습니다. 모든 프로세스를 실행 사이에 종료했으며 OS 디스크 캐시는 비우지 않았습니다. 새 프로필 첫 1회는 완전한 OS 콜드 부팅 측정이 아닙니다.

계측 코드는 `startupbenchmark` 빌드 태그에만 포함되며 배포 실행 파일에는 포함되지 않습니다. 검증 및 비교 실행: https://github.com/gisbi-kim/pdf-grid/actions/runs/43354517096

`PDFGrid.zip`의 Electron 1.3.3 설치 파일에서 `resources/app.asar`를 추출해 복원한 화면과 PDF 기능을 사용합니다. PDF 처리 코드를 유지하고, Electron 실행기만 Go + 공유 WebView2 Runtime을 사용하는 실행기로 교체했습니다. 기존 `desktop/` 브라우저 실행 버전과 별개입니다.

- 별도 앱 창, 여러 PDF 탭, PDF 합치기/분리, PDF/ZIP 저장 대화상자, 선택 영역 이미지 복사, PDF 연결 열기와 두 번째 실행의 파일 전달을 지원합니다.
- 웹 화면은 실행 파일에 포함되며 PDF를 외부로 전송하지 않습니다. 로컬 HTTP 서버는 `127.0.0.1:49383`에만 바인딩됩니다. 창을 닫으면 서버도 종료됩니다.
- **Windows 10/11 x64 + Microsoft Edge WebView2 Evergreen Runtime**이 필요합니다. 런타임을 설치 파일에 포함하지 않습니다. 설치 시 런타임이 없으면 Microsoft 다운로드 페이지를 안내하고 기존 앱을 제거하지 않습니다.
- 최초 설치는 사용자 계정에 설치합니다. 관리자 권한이 필요하지 않습니다.
- 기존 Electron 설치(레지스트리의 실제 제품 GUID)와 이전 `%LOCALAPPDATA%\PDFGrid` Go 설치를 감지합니다. 기존 설치가 있으면 버전과 교체/재설치 확인창을 표시합니다. 기본 선택은 **아니요**입니다. 취소하면 기존 파일과 버전은 유지됩니다. 같은 버전도 재설치 여부를 묻습니다.
- 실행 중인 설치본을 강제로 종료하지 않습니다. 결과를 저장하고 창을 닫은 뒤 다시 시도하도록 안내합니다.
- 이전 Electron 앱의 제거 프로그램을 실행할 때 사용자 데이터 삭제 플래그를 사용하지 않습니다. PDF 원본과 이전 프로필 폴더를 유지합니다. 새 WebView2 프로필은 `%LOCALAPPDATA%\PDFGridWebView\Profile`에 따로 만들어지므로 **이전 Electron의 마지막 문서·보기 상태는 자동 이전되지 않습니다.** PDF를 다시 열어 주세요.
- PDF 연결 프로그램 후보로 등록하며 Windows의 기본 PDF 앱을 강제로 바꾸지 않습니다.
- `main` 반영 시 Windows 테스트를 통과한 빌드를 GitHub Releases에 공개합니다. 웹 버전은 GitHub Pages에서 별도로 계속 제공됩니다.

## 재빌드

Go 1.26.1과 NSIS(로컬 3.12, Windows CI 3.13)를 사용했습니다. `WebView2Loader.dll`은 설치 시 런타임 확인용 **x86 SDK 로더**입니다. 앱 자체는 x64이며 Go 패키지가 x64 로더를 포함합니다. 런타임 자체와는 다른 파일입니다. 관련 라이선스는 `web/LICENSE-*`에 포함했습니다.

```sh
go test ./...
node --test web/dev/tests/core.test.cjs web/dev/tests/touch.test.cjs
go run github.com/tc-hib/go-winres@v0.3.3 make --in winres.json
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w -H=windowsgui' -o PDF-Grid.exe .
makensis installer.nsi
```

Windows PowerShell에서는 빌드 전에 `$env:GOOS='windows'; $env:GOARCH='amd64'; $env:CGO_ENABLED='0'`을 설정하고 `go build -trimpath '-ldflags=-s -w -H=windowsgui' -o PDF-Grid.exe .`을 실행합니다.

`PDFGRID_NATIVE_TEST=1 go test -run TestNativeUI -v`는 실제 Windows WebView2 창에서 PDF 기능, 네이티브 저장 대화상자, 클립보드, 두 번째 실행 파일 전달을 확인합니다. `tests/native-smoke.js`는 테스트 실행 파일에만 포함되며 제품 실행 파일에는 포함되지 않습니다. `tests/install-smoke.ps1`은 설치 확인창·취소·재설치·실행 중 앱 보호를 확인합니다. CI 시작 시간은 해당 CI 호스트의 수치이며 원래 Electron 버전과 동일 PC에서 비교한 성능 결과는 아닙니다.
