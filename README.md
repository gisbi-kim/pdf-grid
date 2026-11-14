# PDF Grid

PDF 여러 페이지를 연속 격자로 펼치고, 논문의 인용과 읽던 위치를 오가며 읽는 웹·Windows 뷰어입니다.

- 설치 앱을 껐다 켜도 마지막 창 위치·크기·최대화 상태, PDF 탭 순서·활성 탭·각 탭의 보기 위치 복원
- PDF 내부 링크·목차 이동 후 `[` / `]`, 마우스 뒤로/앞으로 버튼 또는 하단 버튼으로 이전·다음 읽기 위치 이동
- 하단에 이전·현재·다음 위치의 쪽 번호 표시 (탭별 최근 100개 이동)
- 논문 인용 링크에 호버하거나 키보드로 포커스하면 문서의 참고문헌 정보를 인플레이스 카드로 미리 보기

**실행:** https://gisbi-kim.github.io/pdf-grid/

- 상단 ‘격자 보기’ 옆 **↻ 새로고침** 버튼 (설치판에서는 Ctrl+R/F5와 동일)
- 설치판: Ctrl+R / F5로 다시 빌드된 현재 PDF를 불러오기 (탭·보기 위치 유지)
- 여러 PDF를 탭으로 열고 전환·닫기
- PDF 합치기·쪽 범위 추출·분리 및 PDF/ZIP 다운로드
- 텍스트 선택·영역 이미지 복사 (브라우저 클립보드 권한 필요)
- PDF 내부 링크·외부 링크·목차 이동 (원본 PDF에 포함된 경우)
- PDF 파일 선택 또는 끌어 놓기
- 마지막 PDF와 열 수·확대율·스크롤 위치를 브라우저에 저장하고 새로고침 시 복원
- 기본 2열 (1–10열 변경 가능), 행 수는 마지막 페이지까지 자동 계산
- 본문 검색: Ctrl/⌘+F로 검색창 선택, 한글·영문 검색 및 결과 강조 (영문 대소문자 구분 없음)
- Enter / Shift+Enter 또는 ↑ / ↓ 버튼으로 다음 / 이전 검색 결과 이동, Esc로 검색 지우기
- 검색은 전체 페이지를 대상으로 브라우저 안에서 수행하며, 텍스트가 없는 스캔 PDF는 OCR 없이 검색할 수 없음
- 화면 근처 페이지만 지연 로딩·렌더링하고, 멀어진 캔버스는 해제
- 마우스 휠: 스크롤
- Ctrl/⌘ + 휠: 커서 위치 기준 확대·축소
- 마우스 드래그: 화면 이동
- 더블클릭: 해당 페이지 확대
- 좌우 방향키: 이전/다음 행 이동
- 0: 화면 맞춤

PDF 파일은 브라우저 안에서 처리되며 서버로 업로드되지 않습니다. 마지막으로 연 PDF 원본은 IndexedDB에, 보기 설정은 로컬 저장소에 저장됩니다. 브라우저의 사이트 데이터를 지우면 저장된 PDF도 삭제됩니다. PDF 비밀번호는 저장하지 않습니다. 저장 공간 부족이나 브라우저의 저장 제한이 있으면 복원 불가 안내를 표시하며 현재 파일은 계속 볼 수 있습니다.
오프라인에서는 아래 Windows 앱을 사용하세요. 웹 소스를 직접 실행하려면 저장소 전체를 내려받고 `python -m http.server 8000`으로 실행한 다음 `http://localhost:8000/`을 여세요. 웹 화면은 `dev/`와 `viewer/`의 로컬 자산을 함께 사용합니다.

## 웹·설치판 동기화 (1.4.3)

웹 기본 주소와 기존 `/dev/` 주소는 설치판과 같은 화면·PDF 기능을 사용합니다. DEV 버튼은 이동 없이 “현재 dev 버전과 release 버전이 같습니다.” 안내를 버튼 근처에 표시합니다. GitHub 버튼으로 소스 저장소를 열고, 웹의 설치 버튼으로 Windows 설치 파일을 받을 수 있습니다.

공유 소스는 `dev/`와 `viewer/index.html`입니다. 수정 후 `python scripts/sync-ui.py`로 기본 웹 진입점과 설치 앱 내장 자산을 생성합니다. `python scripts/sync-ui.py --check`는 두 묶음이 같은지 검사하며 Windows 빌드에서도 실행됩니다. 검증: `node --test dev/tests/*.test.cjs`. 자세한 구조·제약은 [공유 UI 안내](dev/README.md)를 참고하세요.

웹에서는 브라우저 다운로드·클립보드를, 설치판에서는 Windows 저장 대화상자·클립보드와 업데이트 확인을 사용합니다. 문서와 보기 상태는 각 브라우저/앱에 따로 저장되며 서로 전송되지 않습니다.

| 버전 | 변경 | 호환성·제약 |
| --- | --- | --- |
| [1.4.2](https://github.com/gisbi-kim/pdf-grid/releases/tag/desktop-v1.4.2-build.16) | Windows 행 이동·PDF 링크·목차·업데이트 확인 | 기존 웹 기본 화면과 별도 UI |
| [1.4.3](https://github.com/gisbi-kim/pdf-grid/releases/tag/desktop-v1.4.3-build.18) | 설치판 UI를 웹 기본 화면에 통합, DEV 상태 안내·GitHub 버튼, 공유 UI 생성·검사 | 브라우저에는 OS 파일 연결·설치판 업데이트 기능 없음 |
| [1.4.4](https://github.com/gisbi-kim/pdf-grid/releases/tag/desktop-v1.4.4-build.23) | 설치판 Ctrl+R/F5로 PDF 원본 다시 읽기, 탭·보기 위치 유지 | 파일 없는 화면은 앱 UI 새로고침, 앱 바이너리 업데이트는 기존 업데이트 버튼 사용 |
| [1.4.5](https://github.com/gisbi-kim/pdf-grid/releases/tag/desktop-v1.4.5-build.25) | 상단 ↻ 새로고침 버튼 추가, 설치판 단축키와 동일한 PDF 다시 읽기 | 웹 버튼은 브라우저 페이지 새로고침 |
| [1.4.6](https://github.com/gisbi-kim/pdf-grid/releases/tag/desktop-v1.4.6-build.29) | 새 PDF 탭을 열 때 현재 창 크기·위치·최대화 상태 유지 | 최소화된 창만 이전 상태로 복원, Windows 활성화 정책 적용 |
| 1.5.0 | 종료 후 창·탭·읽던 위치 복원, 탭별 앞/뒤 이동 이력, 인용 참고문헌 호버 카드 | 복원은 설치판, 이력·호버는 웹/설치판 공통. PDF에 인용 목적지와 텍스트가 있어야 상세 미리보기 가능 |

## Windows app

[Windows 설치 파일](https://github.com/gisbi-kim/pdf-grid/releases/latest/download/PDF-Grid-Setup.exe) · [설치 없이 실행하는 EXE](https://github.com/gisbi-kim/pdf-grid/releases/latest/download/PDF-Grid-Portable.exe) · [소스 및 빌드 안내](desktop-webview2/README.md)

Windows 10/11 x64에서 별도 앱 창으로 실행합니다. 공유 WebView2 Runtime을 사용해 설치 파일은 약 3.4MB, 실행 파일은 약 10MB입니다. WebView2가 없으면 설치 안내가 표시됩니다. 기존 설치 확인과 손상된 제거 프로그램을 건너뛰는 강제 정리 후 재설치를 지원하며, PDF 원본과 사용자 데이터는 유지합니다. 웹 버전은 위 실행 주소에서 계속 사용할 수 있습니다.

같은 Windows VM의 반복 실행 비교에서 창 표시는 빨라졌으나 격자 뷰어 준비는 약 0.09초 느렸습니다. 용량 감소와 전체 시작 속도 개선을 구분합니다. 자세한 측정 조건과 기록은 [Windows 앱 안내](desktop-webview2/README.md)를 참고하세요.

## 읽기 작업 저장과 인용 미리보기

설치판의 창 배치는 `%LOCALAPPDATA%\PDFGridWebView\window-placement.json`, 다시 읽을 PDF 원본 경로 연결은 같은 폴더의 `pdf-sources.json`에 저장됩니다. 탭의 PDF 사본은 WebView2 프로필의 IndexedDB에, 탭 순서·선택·격자·확대율·스크롤·이동 이력은 로컬 저장소에 저장됩니다. 정상 종료 전에 저장을 마친 다음 창을 닫습니다. 설치 앱 업데이트는 이 프로필을 지우지 않습니다. 최소화 상태로 종료했다면 다음 실행에는 이전 일반/최대화 상태로 표시하고, 연결이 끊긴 모니터의 위치는 그대로 적용하지 않습니다.

원본이 있으면 재실행 시 디스크에서 새로 읽고, 없으면 저장된 PDF 사본으로 복원하면서 안내합니다. 탭을 닫으면 해당 탭의 PDF 캐시를 제거합니다. 비밀번호는 저장하지 않습니다. **1.4.x에는 여러 탭 저장 기능이 없으므로 1.5.0으로 처음 업데이트한 뒤 PDF를 한 번 다시 열어 두면 이후부터 복원됩니다.** 저장 공간 부족·사이트 데이터/프로필 삭제는 복원을 제한할 수 있습니다.

인용 카드는 PDF 안의 인용 목적지와 참고문헌 텍스트에서 추출합니다. PDF나 논문 제목을 외부 검색/API로 전송하지 않습니다. 스캔 PDF, 인용 목적지 없는 PDF, 텍스트 배치가 특이한 문서는 카드를 표시하지 않거나 추출 제한이 있을 수 있습니다. 카드가 보여도 링크 클릭은 기존 참고문헌 위치로 이동하며, 호버 자체는 읽기 위치와 이동 이력을 바꾸지 않습니다.

## Third-party software

Includes PDF.js 3.11.174, Copyright 2023 Mozilla Foundation, licensed under the Apache License 2.0. See `LICENSE-PDFJS.txt`. The original license notices are retained in the embedded library and worker.
