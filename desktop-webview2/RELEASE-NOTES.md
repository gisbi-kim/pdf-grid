PDF Grid 1.6.2 for Windows 10/11 x64

- Matched the update icon to the size and colors of the toolbar controls next to GitHub.

- Grouped PDF merge and split under ‘유틸’ on the right side of the ribbon.
- The PDF open dialog focuses the file name field so a full path can be pasted and opened with Enter.
- In side-by-side view, dropping a PDF opens it in the pane where it was dropped and keeps the previous PDF available in its tab.

- Close the active tab immediately with Ctrl+W or the × button while opening, refreshing or restoring a PDF. Results from closed tabs are ignored.

- Open a PDF passed to the app before reading old tabs. Saved background tabs display their titles and restore their reading position on selection. Starting the app directly loads only the last visible tab or split pair.

- Restore the last 20 closed PDF tabs with Ctrl+Shift+T, the ↶ icon or tab menu, including original order, reading view and link history. Source files reread when available and cached closed snapshots recover missing/invalid sources. Closed history lasts for the current app/page session only.
- Compare two PDFs side by side with independent scroll/zoom, document headings and an adjustable divider. Pane interaction selects the active PDF for shortcuts; selecting another tab replaces that pane. The native app restores the split pair, ratio and both reading views on restart. Web toolbar/menu controls support both features; reserved browser shortcuts stay unchanged.
- Added a tab-title context menu with **절대경로 복사** (copy absolute path). The native host copies the clicked PDF source path as Unicode text without changing the active tab. Keyboard menu opening/dismissal is supported. Web, empty and pathless generated tabs explain why the command is unavailable.
- Added Ctrl+W to close the active PDF tab from the PDF, search field or ribbon in the installed app. Closing the last PDF retains one empty tab and keeps the window open. The web edition preserves browser-reserved Ctrl+W.
- Replaced the separate ribbon refresh button with a small icon on the left of each PDF tab. Refresh targets that tab, preserves the active tab and reading positions, and indicates progress locally. Native Ctrl+R/F5 still refresh the active PDF. The web icon refreshes only that document; without a file-system handle it redraws retained PDF bytes.
- Fixed Ctrl+wheel/manual zoom jumping from the current reading position to an older search match. Manual zoom cancels deferred search centering and preserves its anchor; explicit search-result navigation still centers the result.
- Fixed word-selection double clicks unexpectedly fitting the PDF page and shifting the reading position. Text/area modes and PDF links no longer trigger page-fit zoom; hand mode retains it.
- Redesigned citation previews as light paper cards with title, authors, venue, expandable reference text, grouped-citation paging and a reference-location button.
- DOI/arXiv buttons open the selected paper in the default browser; identifiers come only from local reference text or its PDF URL annotation. Hover makes no external metadata requests.
- Fixed review manuscript line numbers and neighboring bibliography entries contaminating previews.
- Restore window position/size/maximization, PDF tabs/order/active tab and each tab's view/history after closing and restarting. Native PDFs reread their sources; missing originals use cached snapshots with a notice. Generated PDFs are cached too; passwords are not stored.
- Add per-tab reading history: `[` / `]`, mouse back/forward and visible footer controls return to previous/next PDF link positions, with destination page labels.
- Hover/focus embedded citation links for an in-place reference card extracted locally from the PDF. No paper text or titles are sent to external metadata services.
- On the first upgrade from 1.4.x, reopen PDFs once because the prior version did not save multiple tabs.
- Fixed opening PDFs resetting a maximized viewer to its normal/default size. Existing visible windows keep their size/position/maximization; minimized windows restore their saved placement. Native picker completion returns focus, and second-instance forwarding grants foreground permission where Windows allows it.
- Added a visible ↻ 새로고침 button beside 격자 보기 in the ribbon. It rereads the active PDF with the same behavior as Ctrl+R/F5 and is disabled during refresh. The web edition reloads the browser page.
- Ctrl+R / F5 rereads the active PDF after a rebuild, preserving tabs and view position. Native file picking and file-association opens retain a refreshable source; generated PDFs redraw from memory. Missing/invalid outputs keep the old document. Empty windows reload the app UI. App upgrades still use the update button.
- Web release and existing /dev/ now share the same multiple-PDF-tab, merge/split and selection UI as the installed app.
- DEV shows a nearby “현재 dev 버전과 release 버전이 같습니다.” status instead of navigating; GitHub opens the source repository in the default browser.
- Shared source generation and a CI parity check prevent web/native UI drift. Browser downloads/clipboard and native save/update integration remain platform-specific.
- Fixed left/right navigation getting stuck at fractional row boundaries and near the last page.
- PDF links now work: internal page destinations, named destinations, document outline (목차), and external web links opened in the default browser. This requires embedded links/bookmarks in the PDF.
- Added a blue circular 최신 버전 확인 button. Check online, then confirm download/reinstall; setup is launched only after SHA256 verification. Offline errors leave the current app usable.
- `PDF-Grid-Setup.exe`: installs the standalone-window app and creates a desktop shortcut. The versioned installer is identical.
- `PDF-Grid-Portable.exe`: the same app without installation or automatic shortcut creation.
- Uses the shared Microsoft Edge WebView2 Evergreen Runtime. If missing, setup provides installation guidance before modifying the old installation.
- Setup detects existing versions and offers normal reinstall or force cleanup and reinstall. Force mode bypasses broken uninstallers, removes only allowlisted program files and app registration, and preserves PDFs and user profiles. The actual broken 1.1.0 uninstaller fixture is covered by Windows tests.
- The web version remains available at https://gisbi-kim.github.io/pdf-grid/ .
- Compared with the supplied Electron package, setup shrank from about 117.5MB to 3.4MB, and the app executable is about 10MB. This is a size reduction, not a claim of faster overall startup: repeated same-VM testing showed earlier window visibility but approximately 0.09 seconds slower grid readiness.
- Previous Electron profile folders are preserved; their last document/view state is not automatically imported into the new WebView2 profile. Reopen the PDF once.
- SHA256SUMS.txt lists checksums. Third-party notices are bundled in the application and source.
