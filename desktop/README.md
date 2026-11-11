# PDF Grid Offline

A self-contained Windows application that serves embedded browser assets on loopback only. Setup copies itself to LocalAppData, creates a desktop shortcut via Windows Script Host COM, then launches the installed app. No services, autorun entries, telemetry, remote resource loads, PDF uploads or runtime downloads.

The portable executable skips installation. Both open the default browser. The same origin/port preserves the viewer's existing IndexedDB behavior. Quit is explicit, with a confirmation to avoid losing unsaved output; an idle server stops after 30 minutes without page heartbeats. Foreign Host and Origin requests are rejected, and control POSTs need a random per-process token. The server does not expose arbitrary filesystem reads/writes.

## Build

From the repository root, run `python desktop/prepare.py` to stage the allowlisted web assets. From `desktop`, run:

```
go test ./...
go run tools/icon.go
go run github.com/tc-hib/go-winres@v0.3.3 make --in winres.json
```

With `GOOS=windows GOARCH=amd64 CGO_ENABLED=0`, run:

```
go build -trimpath -ldflags="-s -w -H=windowsgui -X main.version=1.0.0" -o PDF-Grid-Portable.exe .
go build -trimpath -ldflags="-s -w -H=windowsgui -X main.version=1.0.0 -X main.installMode=setup" -o PDF-Grid-Setup.exe .
```

GitHub Actions runs core PDF tests and Windows Go tests, builds both executables, smoke-tests the loopback server, then publishes a versioned release. Release downloads contain the exact commit's browser assets. Publishing updates requires a new release; installed copies do not silently auto-update.
