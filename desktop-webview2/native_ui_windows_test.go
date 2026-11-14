//go:build windows

package main

import (
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	webview "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

//go:embed tests/native-smoke.js
var nativeSmokeJS string

//go:embed tests/pdf-fixtures.js
var nativePDFFixturesJS string

func TestNativeUI(t *testing.T) {
	if os.Getenv("PDFGRID_NATIVE_TEST") != "1" {
		t.Skip("Run after building PDF-Grid.exe with PDFGRID_NATIVE_TEST=1 on Windows")
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	hr, _, _ := syscall.NewLazyDLL("ole32.dll").NewProc("CoInitializeEx").Call(0, 2)
	if int32(hr) < 0 {
		t.Fatalf("COM init: %x", hr)
	}
	defer syscall.NewLazyDLL("ole32.dll").NewProc("CoUninitialize").Call()
	t.Setenv("LOCALAPPDATA", t.TempDir())
	profile := profilePath()
	t.Cleanup(func() {
		// The embedded controller is still COM-referenced by the test host. Stop
		// only the runtime processes that use this test's unique temporary profile.
		cleanup := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -and $_.CommandLine.Contains($env:PDFGRID_TEST_PROFILE) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`)
		cleanup.Env = append(os.Environ(), "PDFGRID_TEST_PROFILE="+profile)
		cleanup.Run()
		time.Sleep(300 * time.Millisecond)
	})
	os.MkdirAll(profile, 0700)
	a := &app{token: randomToken(), instanceToken: randomToken()}
	setupBytes, err := os.ReadFile("PDF-Grid-Desktop-Setup-1.4.5.exe")
	if err != nil {
		t.Fatal(err)
	}
	updates, _ := fakeUpdates(t, setupBytes, false)
	a.updateSource = updates
	externalSeen := false
	a.externalOpener = func(address string) error {
		if address != "https://example.com/pdf-link" {
			return fmt.Errorf("Unexpected external link: %s", address)
		}
		externalSeen = true
		return nil
	}
	os.WriteFile(filepath.Join(profile, "instance-token"), []byte(a.instanceToken), 0600)
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: a.handler()}
	go server.Serve(listener)
	defer server.Close()
	downloads, err := windows.KnownFolderPath(windows.FOLDERID_Downloads, 0)
	if err != nil {
		t.Fatal(err)
	}
	filename := "pdfgrid-native-test-" + a.token[:8] + ".pdf"
	dest := filepath.Join(downloads, filename)
	t.Cleanup(func() { os.Remove(dest) })
	driver := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "tests/save-dialog.ps1", "-AppPid", strconv.Itoa(os.Getpid()), "-Destination", dest)
	driver.Stdout = os.Stdout
	driver.Stderr = os.Stderr
	if err := driver.Start(); err != nil {
		t.Fatal(err)
	}
	defer driver.Process.Kill()
	started := time.Now()
	result := make(chan string, 1)
	finished := make(chan struct{})
	defer close(finished)
	a.installerLauncher = func(target string) error {
		b, err := os.ReadFile(target)
		if err != nil || string(b) != string(setupBytes) {
			return fmt.Errorf("Updater did not verify and download the expected installer")
		}
		if !externalSeen {
			return fmt.Errorf("External-link bridge was not exercised")
		}
		result <- "ok"
		return nil
	}
	var reloadSample string
	windowTestHook = func(w webview.WebView) {
		w.Bind("nativeTestStage", func(stage string) error {
			if stage == "ready" {
				t.Logf("Native viewer fully loaded: %s (CI host, not an Electron comparison)", time.Since(started))
				return nil
			}
			if strings.HasPrefix(stage, "reload-f5:") || strings.HasPrefix(stage, "reload-ctrl-r:") || strings.HasPrefix(stage, "reload-button:") {
				parts := strings.SplitN(stage, ":", 2)
				data, e := base64.StdEncoding.DecodeString(parts[1])
				if e != nil {
					return e
				}
				if e = os.Remove(reloadSample); e != nil {
					return e
				}
				if e = os.WriteFile(reloadSample, data, 0600); e != nil {
					return e
				}
				if parts[0] == "reload-button" {
					return nil
				}
				// Actual OS keystrokes exercise WebView2 defaults and focused iframes.
				w.Dispatch(func() {
					user32.NewProc("SetForegroundWindow").Call(uintptr(w.Window()))
					if parts[0] == "reload-ctrl-r" {
						user32.NewProc("keybd_event").Call(0x11, 0, 0, 0)
					}
					key := uintptr(0x74)
					if parts[0] == "reload-ctrl-r" {
						key = 0x52
					}
					user32.NewProc("keybd_event").Call(key, 0, 0, 0)
					user32.NewProc("keybd_event").Call(key, 0, 2, 0)
					if parts[0] == "reload-ctrl-r" {
						user32.NewProc("keybd_event").Call(0x11, 0, 2, 0)
					}
				})
				return nil
			}
			if strings.HasPrefix(stage, "second:") {
				data, e := base64.StdEncoding.DecodeString(strings.TrimPrefix(stage, "second:"))
				if e != nil {
					return e
				}
				sample := filepath.Join(t.TempDir(), "startup-test.pdf")
				reloadSample = sample
				if e = os.WriteFile(sample, data, 0600); e != nil {
					return e
				}
				exe, e := filepath.Abs("PDF-Grid.exe")
				if e != nil {
					return e
				}
				return exec.Command(exe, sample).Run()
			}
			return fmt.Errorf("Unknown stage")
		})
		w.Bind("nativeTestDone", func(message string) { result <- message; w.Terminate() })
		nameJSON, _ := json.Marshal(filename)
		w.Init("window.nativeTestFilename=" + string(nameJSON))
		w.Init(nativePDFFixturesJS)
		w.Init(nativeSmokeJS)
		go func() {
			select {
			case <-time.After(90 * time.Second):
				w.Dispatch(func() {
					select {
					case result <- "Native UI timed out":
					default:
					}
					w.Terminate()
				})
			case <-finished:
			}
		}()
	}
	defer func() { windowTestHook = nil }()
	if err := runWindow(a, profile, "http://"+address+"/dev/"); err != nil {
		t.Fatal(err)
	}
	select {
	case message := <-result:
		if message != "ok" {
			t.Fatal(message)
		}
	default:
		t.Fatal("Window closed without test result")
	}
	if err := driver.Wait(); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(dest)
	if err != nil || !strings.HasPrefix(string(b), "%PDF-") {
		t.Fatalf("Native save: %v", err)
	}
	t.Log("PASS actual WebView2: merge, save, split, clipboard, PDF forwarding, rebuilt PDF reload via actual F5/Ctrl+R and the visible refresh button, keyboard navigation, PDF links/outline, external-link bridge, update UI and verified installer launch handoff")
}
