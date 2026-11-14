# PDF Grid shared UI

The release at https://gisbi-kim.github.io/pdf-grid/ and the existing `/dev/` URL now use the same UI as the Windows app. Both default to the grid viewer with multiple PDF tabs, merge/split tools, embedded PDF links and bookmarks, text selection, and area image copying.

`dev/` contains the shared shell, tools and local vendor dependencies. `viewer/index.html` contains the embedded grid viewer (including PDF.js). The DEV control displays a nearby version-status popover on hover, focus or click; it no longer navigates to a separate edition. GitHub opens the source repository in a new browser tab or the desktop default browser.

Edit these shared sources, then run `python scripts/sync-ui.py`. This generates the root release entry (using `dev/` as its base URL) and the bundled `desktop-webview2/web/` assets. Native builds run `python scripts/sync-ui.py --check` to reject drift. Do not edit generated UI files directly.

Browser output uses PDF/ZIP downloads and the browser clipboard API. Windows uses native save dialogs and the native image clipboard. Browser clipboard permission and a secure context are required for area copying. Native update controls and OS file associations are available only in the installed app. Local documents are never uploaded; browser storage and the installed app profile remain separate.

Run checks: `node --test dev/tests/*.test.cjs` and `python scripts/sync-ui.py --check`.

Dependencies: pdf-lib 1.17.1, JSZip 3.10.1 and PDF.js 3.11.174, bundled locally with their licenses. Editing inputs are held in memory, limited to 100 MB per split file / merge batch. Encrypted editing inputs are rejected. Page content, size and rotation are copied; document bookmarks, signatures and interactive forms may not survive copying.
