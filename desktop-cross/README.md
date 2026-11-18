# PDF Grid for macOS and Ubuntu

This Electron host packages the same generated PDF UI used by the Windows WebView2 app. It ships offline assets and uses a local `pdfgrid://app` origin with a sandboxed renderer. PDF files and open-tab snapshots stay on the device. External HTTP(S) links open in the default browser.

Install from the [downloads table](../README.md#설치). The Mac app supports Apple Silicon and Intel on macOS 13+. The Ubuntu package targets 24.04 LTS on amd64. PDF Grid registers as an available viewer for PDF files. The installed app accepts local PDFs up to 100 MB via the native picker and OS open events.

macOS supports Command+W to close the active tab, Command+Shift+T to restore a closed tab and Command+R to reread the PDF. Ctrl equivalents also work. Ubuntu uses the existing Ctrl shortcuts. Window placement, source-path mappings and open PDF snapshots are stored in the PDF Grid application profile. OS window-manager policy can affect position restoration. Updates are installed manually from a new DMG or DEB.

Use Node.js 24 on the target operating system. From the repository root:

```sh
python3 scripts/sync-ui.py --check
cd desktop-cross
npm ci
npm run start
```

Build installers with `npm run package -- --mac --arm64` or `npm run package -- --mac --x64` on macOS, and `npm run package -- --linux --x64` on Ubuntu. Outputs go to `dist/`. Mac builds use an ad hoc signature and are not notarized.

The [workflow](../.github/workflows/desktop-cross.yml) runs the app from each installed package and checks file forwarding, native path copying, tab shortcuts, source refresh and workspace restoration. Set `PDF_GRID_EXECUTABLE` to an installed binary and run `npm run smoke` to repeat the checks. To publish a subsequent release, update the package version and lockfile, release notes and download links. GitHub Actions publishes a separate macOS/Ubuntu release with a SHA-256 manifest after both Mac builds and the Ubuntu build pass.
