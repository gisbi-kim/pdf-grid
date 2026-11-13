# PDF Grid 1.4.1 — Windows 경량 버전

`PDFGrid.zip`의 Electron 1.3.3 설치 파일에서 `resources/app.asar`를 추출해 복원한 화면과 PDF 기능을 사용합니다. PDF 처리 코드를 유지하고, Electron 실행기만 Go + 공유 WebView2 Runtime을 사용하는 실행기로 교체했습니다. 기존 `desktop/` 브라우저 실행 버전과 별개입니다.

- 별도 앱 창, 여러 PDF 탭, PDF 합치기/분리, PDF/ZIP 저장 대화상자, 선택 영역 이미지 복사, PDF 연결 열기와 두 번째 실행의 파일 전달을 지원합니다.
- 웹 화면은 실행 파일에 포함되며 PDF를 외부로 전송하지 않습니다. 로컬 HTTP 서버는 `127.0.0.1:49383`에만 바인딩됩니다. 창을 닫으면 서버도 종료됩니다.
- **Windows 10/11 x64 + Microsoft Edge WebView2 Evergreen Runtime**이 필요합니다. 런타임을 설치 파일에 포함하지 않습니다. 설치 시 런타임이 없으면 Microsoft 다운로드 페이지를 안내하고 기존 앱을 제거하지 않습니다.
- 최초 설치는 사용자 계정에 설치합니다. 관리자 권한이 필요하지 않습니다.
- 기존 Electron 설치(레지스트리의 실제 제품 GUID)와 이전 `%LOCALAPPDATA%\PDFGrid` Go 설치를 감지합니다. 기존 설치가 있으면 버전과 교체/재설치 확인창을 표시합니다. 기본 선택은 **아니요**입니다. 취소하면 기존 파일과 버전은 유지됩니다. 같은 버전도 재설치 여부를 묻습니다.
- 실행 중인 설치본을 강제로 종료하지 않습니다. 결과를 저장하고 창을 닫은 뒤 다시 시도하도록 안내합니다.
- 이전 Electron 앱의 제거 프로그램을 실행할 때 사용자 데이터 삭제 플래그를 사용하지 않습니다. PDF 원본과 이전 프로필 폴더를 유지합니다. 새 WebView2 프로필은 `%LOCALAPPDATA%\PDFGridWebView\Profile`에 따로 만들어지므로 **이전 Electron의 마지막 문서·보기 상태는 자동 이전되지 않습니다.** PDF를 다시 열어 주세요.
- PDF 연결 프로그램 후보로 등록하며 Windows의 기본 PDF 앱을 강제로 바꾸지 않습니다.
- 소스 브랜치는 기존 공개 배포물을 교체하지 않으며 CI도 정식 릴리스를 발행하지 않습니다.

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
