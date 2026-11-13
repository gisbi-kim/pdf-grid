PDF Grid 1.4.2 for Windows 10/11 x64

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
