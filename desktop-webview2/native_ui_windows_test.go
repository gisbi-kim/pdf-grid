//go:build windows

package main

import (
	_ "embed"
	"encoding/base64"
	"fmt"
	webview "github.com/jchv/go-webview2"
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
	os.MkdirAll(profile, 0700)
	a := &app{token: randomToken(), instanceToken: randomToken()}
	os.WriteFile(filepath.Join(profile, "instance-token"), []byte(a.instanceToken), 0600)
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: a.handler()}
	go server.Serve(listener)
	defer server.Close()
	dest := filepath.Join(t.TempDir(), "saved-test.pdf")
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
	windowTestHook = func(w webview.WebView) {
		w.Bind("nativeTestStage", func(stage string) error {
			if stage == "ready" {
				t.Logf("Native viewer fully loaded: %s (CI host, not an Electron comparison)", time.Since(started))
				return nil
			}
			if strings.HasPrefix(stage, "second:") {
				data, e := base64.StdEncoding.DecodeString(strings.TrimPrefix(stage, "second:"))
				if e != nil {
					return e
				}
				sample := filepath.Join(t.TempDir(), "startup-test.pdf")
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
	t.Log("PASS actual WebView2 viewer, merge, native save, split, clipboard and second-instance PDF open")
}
