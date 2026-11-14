# PDF Grid shared UI

The release at https://gisbi-kim.github.io/pdf-grid/ and the existing `/dev/` URL now use the same UI as the Windows app. Both default to the grid viewer with multiple PDF tabs, merge/split tools, embedded PDF links and bookmarks, text selection, and area image copying.

`dev/` contains the shared shell, tools and local vendor dependencies. `viewer/index.html` contains the embedded grid viewer (including PDF.js). The DEV control displays a nearby version-status popover on hover, focus or click; it no longer navigates to a separate edition. GitHub opens the source repository in a new browser tab or the desktop default browser.

Edit these shared sources, then run `python scripts/sync-ui.py`. This generates the root release entry (using `dev/` as its base URL) and the bundled `desktop-webview2/web/` assets. Native builds run `python scripts/sync-ui.py --check` to reject drift. Do not edit generated UI files directly.

Browser output uses PDF/ZIP downloads and the browser clipboard API. Windows uses native save dialogs and the native image clipboard. Browser clipboard permission and a secure context are required for area copying. Native update controls and OS file associations are available only in the installed app. Local documents are never uploaded; browser storage and the installed app profile remain separate.

Run checks: `node --test dev/tests/*.test.cjs` and `python scripts/sync-ui.py --check`.

Dependencies: pdf-lib 1.17.1, JSZip 3.10.1 and PDF.js 3.11.174, bundled locally with their licenses. Editing inputs are held in memory, limited to 100 MB per split file / merge batch. Encrypted editing inputs are rejected. Page content, size and rotation are copied; document bookmarks, signatures and interactive forms may not survive copying.

Installed app 1.4.4: Ctrl+R / F5 rereads the active PDF from disk while preserving tabs, grid layout, zoom and scroll position. Native-opened PDFs use an opaque source ID; file paths are retained only by the native host. Dragged files use file-system handles where supported. Generated in-memory PDFs are rendered again. With no open PDF the app UI reloads. The web keeps normal browser refresh behavior. A missing, locked or invalid build output keeps the previous document and reports the failure. Reload does not install a new application binary; use the update button for that.

Version 1.4.5 adds a visible **↻ 새로고침** button next to 격자 보기. The installed button shares the shortcut handler and disables while refreshing; the web button performs a normal page reload.

Version 1.5.0 adds `session.js` for installed-app PDF tab/view/history restoration, with IndexedDB snapshots and local-storage metadata. The native host persists source-ID/path mappings and window placement. `viewer/history.js`, `reading-tools.js`, `citations.js`, and `reading.css` provide bounded per-PDF back/forward history, footer labels and offline citation previews; the generator also copies these viewer assets to the native bundle. The web retains its existing last-document storage; full multi-tab persistence is native-only. Native close flushes session state before destruction. No passwords or remote metadata queries are stored/sent. First-time upgrades from 1.4.x require reopening PDFs once.

Version 1.5.1 replaces citation popovers with light, structured paper cards, grouped-citation navigation and explicit DOI/arXiv actions. Extraction excludes aligned review line numbers and accounts for top-of-line destinations. It uses local text and entry-scoped URL annotations only; no metadata service requests. Shared tests cover identifier normalization, entry boundaries and multi-citation groups.
