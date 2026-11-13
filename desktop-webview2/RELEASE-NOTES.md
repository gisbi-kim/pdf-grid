PDF Grid 1.4.1 for Windows 10/11 x64

- `PDF-Grid-Setup.exe`: installs the standalone-window app and creates a desktop shortcut. The versioned installer is identical.
- `PDF-Grid-Portable.exe`: the same app without installation or automatic shortcut creation.
- Uses the shared Microsoft Edge WebView2 Evergreen Runtime. If missing, setup provides installation guidance before modifying the old installation.
- Setup detects existing versions and offers normal reinstall or force cleanup and reinstall. Force mode bypasses broken uninstallers, removes only allowlisted program files and app registration, and preserves PDFs and user profiles. The actual broken 1.1.0 uninstaller fixture is covered by Windows tests.
- The web version remains available at https://gisbi-kim.github.io/pdf-grid/ .
- Compared with the supplied Electron package, setup shrank from about 117.5MB to 3.4MB, and the app executable is about 10MB. This is a size reduction, not a claim of faster overall startup: repeated same-VM testing showed earlier window visibility but approximately 0.09 seconds slower grid readiness.
- Previous Electron profile folders are preserved; their last document/view state is not automatically imported into the new WebView2 profile. Reopen the PDF once.
- SHA256SUMS.txt lists checksums. Third-party notices are bundled in the application and source.
