# PDF Grid

PDF 여러 페이지를 마지막 페이지까지 연속 격자로 펼쳐 보는 브라우저 뷰어입니다.

**실행:** https://gisbi-kim.github.io/pdf-grid/

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
`index.html`을 다운로드해 Edge 또는 Chrome으로 열면 오프라인에서도 사용할 수 있습니다.

## Windows app

[Windows 설치 파일](https://github.com/gisbi-kim/pdf-grid/releases/latest/download/PDF-Grid-Setup.exe) · [설치 없이 실행하는 EXE](https://github.com/gisbi-kim/pdf-grid/releases/latest/download/PDF-Grid-Portable.exe) · [소스 및 빌드 안내](desktop-webview2/README.md)

Windows 10/11 x64에서 별도 앱 창으로 실행합니다. 공유 WebView2 Runtime을 사용해 설치 파일은 약 3.4MB, 실행 파일은 약 10MB입니다. WebView2가 없으면 설치 안내가 표시됩니다. 기존 설치 확인과 손상된 제거 프로그램을 건너뛰는 강제 정리 후 재설치를 지원하며, PDF 원본과 사용자 데이터는 유지합니다. 웹 버전은 위 실행 주소에서 계속 사용할 수 있습니다.

같은 Windows VM의 반복 실행 비교에서 창 표시는 빨라졌으나 격자 뷰어 준비는 약 0.09초 느렸습니다. 용량 감소와 전체 시작 속도 개선을 구분합니다. 자세한 측정 조건과 기록은 [Windows 앱 안내](desktop-webview2/README.md)를 참고하세요.

## Third-party software

Includes PDF.js 3.11.174, Copyright 2023 Mozilla Foundation, licensed under the Apache License 2.0. See `LICENSE-PDFJS.txt`. The original license notices are retained in the embedded library and worker.
