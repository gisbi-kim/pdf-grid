# PDF Grid 1.5.1 — Windows 경량 버전

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

## 1.4.2 viewer and update controls

Left/right navigation handles fractional row positions and the last-row remainder. Embedded PDF hyperlinks and the 목차 button support internal destinations, document bookmarks and external web links. PDFs without link annotations/bookmarks do not gain links automatically.

The blue circular 최신 버전 확인 button checks the public GitHub release on demand. It offers an update or same-version reinstall, downloads the canonical installer, verifies SHA256, then launches setup and closes the app after confirmation. It does not check the network during startup. Offline checks leave the app running.

## 1.4.3 shared web and desktop UI

The root web release and `/dev/` now share the installed app UI: multiple PDF tabs, merge/split, text selection and area copy. DEV displays a nearby status message without navigation; GitHub opens in the default browser. Browser downloads and clipboard use browser APIs; desktop save dialogs, image clipboard, file associations and update checking keep their native implementation. Profiles remain separate.

Edit `../dev/` and `../viewer/index.html`, then run `python scripts/sync-ui.py` from the repository root. `web/` is generated. CI checks shared assets before building. 1.4.2 remains the preceding published release; 1.4.3 adds UI synchronization and source controls without changing the native host architecture.

## 1.4.4 PDF refresh shortcuts

Ctrl+R and F5 reread the active PDF from its original disk path, preserving open tabs and the current view. Native PDF picking keeps opaque source identifiers; JavaScript cannot supply arbitrary refresh paths. File-association/command-line PDFs use the same source tracking. Drag/drop uses file-system handles when available. In-memory merge/split results redraw from their retained bytes. Missing, locked or invalid files leave the old PDF visible; retry after the build finishes. An empty viewer reloads the app UI. These shortcuts refresh document contents, not the installed executable; the blue update button still installs app releases.

Native integration testing replaces a PDF on disk, sends actual F5 with the iframe focused and Ctrl+R with the ribbon focused, and verifies new page counts, unchanged tab count and reading position.

## 1.4.5 visible refresh button

The ribbon shows **↻ 새로고침** beside 격자 보기 while the viewer is selected. It runs the same installed-app PDF reread as Ctrl+R/F5; it is disabled while refreshing. In the web edition it performs a normal browser page reload. The Windows native test also replaces the on-disk PDF and clicks the button, verifying new content and unchanged tabs/position.

## 1.4.6 preserve the current window when opening PDFs

Opening a PDF in another tab leaves a visible viewer at its current size, position and maximized state. Only a genuinely minimized viewer is restored, using Windows' saved placement. File picker completion also returns focus without resetting the window. A second launcher can grant foreground activation to the existing viewer before forwarding its files; Windows activation restrictions still apply.

Native regression coverage opens PDFs through both a second executable and the actual file dialog. It checks manually sized and maximized windows, plus normal/maximized windows reopened from minimization, using exact window rectangles and show-state checks.

## 1.5.0 persistent reading workspace

The native window saves/restores its WINDOWPLACEMENT, including normal geometry and maximization. Minimized exits reopen visibly in the preceding normal/maximized state, and missing-monitor placements fall back to the current screen. A window subclass handles close by flushing the tab session first, with a timeout for an unresponsive page. Mouse browser commands are routed to the active PDF's reading history.

WebView2 IndexedDB stores opened PDF snapshots; local storage stores tab order, active tab, each grid view and navigation history. Native source IDs/path mappings are persisted in `pdf-sources.json` in the existing profile directory, so restored native PDFs reread their current disk bytes. Missing or temporarily invalid originals fall back to the cached snapshot with a notice. Closing a tab removes its PDF cache. Generated PDFs are also restorable. Passwords are not saved. Existing 1.4.x tabs cannot be imported because those versions never persisted them: reopen PDFs once after the initial upgrade.

Internal PDF links, bookmarks and explicit page-number jumps enter a bounded per-tab history. `[` / `]`, mouse back/forward and footer controls move between exact prior views. Footer controls name the previous/next pages. Editing inputs retain normal bracket typing. Citation hover/focus previews reference text from the PDF without network metadata requests; unsupported/ambiguous links do not invent paper details.

Validation includes separate native process phases for normal/maximized close and restart, native browser-command navigation, citation extraction, browser profile restart, cached missing-file recovery, and existing installer/refresh/window-state checks.

## 1.5.1 citation cards

Citation previews use a light card with title, authors, venue, original-reference details, grouped-citation pagination and a reference-location action. DOI and arXiv identifiers from reference text or overlapping PDF URL annotations open the paper in the default browser through the existing native bridge. Previewing makes no external requests. Review line-number gutters and adjacent references are excluded. Metadata is parsed locally and may be incomplete for unusual bibliography formats; abstracts and citation counts are not inferred.
