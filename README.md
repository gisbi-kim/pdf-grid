# PDF Grid

PDF 여러 페이지를 마지막 페이지까지 연속 격자로 펼쳐 보는 브라우저 뷰어입니다.

**실행:** https://gisbi-kim.github.io/pdf-grid/

- PDF 파일 선택 또는 끌어 놓기
- 기본 2열 (1–10열 변경 가능), 행 수는 마지막 페이지까지 자동 계산
- 화면 근처 페이지만 지연 로딩·렌더링하고, 멀어진 캔버스는 해제
- 마우스 휠: 스크롤
- Ctrl/⌘ + 휠: 커서 위치 기준 확대·축소
- 마우스 드래그: 화면 이동
- 더블클릭: 해당 페이지 확대
- 좌우 방향키: 이전/다음 행 이동
- 0: 화면 맞춤

PDF 파일은 브라우저 안에서 처리되며 서버로 업로드되지 않습니다.
`index.html`을 다운로드해 Edge 또는 Chrome으로 열면 오프라인에서도 사용할 수 있습니다.

## Third-party software

Includes PDF.js 3.11.174, Copyright 2023 Mozilla Foundation, licensed under the Apache License 2.0. See `LICENSE-PDFJS.txt`. The original license notices are retained in the embedded library and worker.
