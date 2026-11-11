PDF Grid Offline 1.0.0

- Download `PDF-Grid-Setup.exe` and run it once. It installs into `%LOCALAPPDATA%\PDFGrid`, creates a **PDF Grid** desktop shortcut, and opens your default browser.
- Later, double-click the desktop icon. All assets are embedded; no internet, Python, Node, or extra downloads are required.
- `PDF-Grid-Portable.exe` is the installation-free alternative. Keep it in any folder and double-click it.
- PDF viewing, merge, split and ZIP export run in your browser. The local executable only serves embedded UI files at `127.0.0.1`. PDFs are not uploaded, even to the local server.
- Use **앱 종료** to stop the local app. After all tabs close, it also stops after 30 minutes without a heartbeat.
- Windows 10/11 x64; no administrator rights requested. The executables are unsigned, so Windows may show an unknown-publisher or SmartScreen notice.
- To uninstall, close the app, delete `%LOCALAPPDATA%\PDFGrid` and the desktop shortcut. The viewer's remembered PDF remains in browser site storage until you clear it.
- SHA256SUMS.txt provides checksums. Third-party PDF.js, pdf-lib, JSZip and Go runtime licenses are bundled.
