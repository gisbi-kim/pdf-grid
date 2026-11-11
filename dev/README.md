# PDF Grid Dev

Live: https://gisbi-kim.github.io/pdf-grid/dev/

An isolated merge/split workspace. The root viewer is reused in an iframe and its source remains unchanged.

- Merge PDFs, reorder files, and select each file's page ranges.
- Extract selected pages or split into ranges separated by semicolons.
- Split every page and download individual PDFs or a single ZIP.
- Generate sample PDFs locally to try both tools without uploading files.
- Open results in the existing grid viewer.

Files are processed entirely in the browser. Dependencies are vendored (pdf-lib 1.17.1, JSZip 3.10.1); no third-party network requests are required. Editing inputs are held in memory. Opening results in the viewer uses the viewer's existing IndexedDB persistence. Encrypted PDFs are rejected. Input size is limited to 100 MB per split file / merge batch. Page content, size and rotation are copied; document-level bookmarks, signatures and interactive forms are not guaranteed to survive page copying.

Run core checks: `node dev/tests/core.test.cjs`

Manual QA: sample merge, reorder and select a range, verify the resulting grid; sample split by ranges and one page per file; ZIP download; invalid ranges; narrow viewport layout.

Dependency licenses are in `vendor/`.
