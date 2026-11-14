//go:build windows

package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	webview "github.com/jchv/go-webview2"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestNativeUISessionRestart(t *testing.T) {
	if os.Getenv("PDFGRID_NATIVE_TEST") != "1" {
		t.Skip("native Windows verification")
	}
	root := t.TempDir()
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	for _, phase := range []string{"write-normal", "read-normal", "write-maximized", "read-maximized"} {
		cmd := exec.Command(self, "-test.run=^TestNativeUISessionPhase$", "-test.v", "-test.timeout=40s")
		cmd.Env = append(os.Environ(), "LOCALAPPDATA="+root, "PDFGRID_SESSION_PHASE="+phase)
		output, err := cmd.CombinedOutput()
		t.Logf("%s:\n%s", phase, output)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestNativeUISessionPhase(t *testing.T) {
	phase := os.Getenv("PDFGRID_SESSION_PHASE")
	if phase == "" {
		t.Skip("child phase only")
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	hr, _, _ := syscall.NewLazyDLL("ole32.dll").NewProc("CoInitializeEx").Call(0, 2)
	if int32(hr) < 0 {
		t.Fatal("COM initialization failed")
	}
	defer syscall.NewLazyDLL("ole32.dll").NewProc("CoUninitialize").Call()
	profile := profilePath()
	if err := os.MkdirAll(profile, 0700); err != nil {
		t.Fatal(err)
	}
	a := &app{token: randomToken(), instanceToken: randomToken(), sourceFile: filepath.Join(profile, "pdf-sources.json")}
	a.loadPDFSources()
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: a.handler()}
	go server.Serve(listener)
	defer server.Close()
	expectedPath := filepath.Join(profile, "expected-session.json")
	windowPath := filepath.Join(profile, "expected-window.json")
	var failure string
	finished := false
	windowTestHook = func(w webview.WebView) {
		if strings.HasPrefix(phase, "write-") {
			state, err := prepareTestWindowState(uintptr(w.Window()), strings.TrimPrefix(phase, "write-"))
			if err != nil {
				failure = err.Error()
			} else if err = writeProfileJSON(windowPath, state); err != nil {
				failure = err.Error()
			}
		}
		w.Bind("nativeSessionFixture", func(name, encoded string) (string, error) {
			if name != "Session-A.pdf" && name != "Session-B.pdf" {
				return "", fmt.Errorf("Invalid fixture")
			}
			data, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				return "", err
			}
			path := filepath.Join(profile, name)
			if err = os.WriteFile(path, data, 0600); err != nil {
				return "", err
			}
			value, err := a.readPDFPath(path)
			if err != nil {
				return "", err
			}
			return value.(map[string]any)["sourceID"].(string), nil
		})
		w.Bind("nativeSessionAssertWindow", func() error {
			data, err := os.ReadFile(windowPath)
			if err != nil {
				return err
			}
			var expected testWindowState
			if err = json.Unmarshal(data, &expected); err != nil {
				return err
			}
			return assertTestWindowState(uintptr(w.Window()), &expected)
		})
		w.Bind("nativeSessionFinish", func(expected string) error {
			if expected != "" {
				if err := os.WriteFile(expectedPath, []byte(expected), 0600); err != nil {
					return err
				}
			}
			finished = true
			w.Dispatch(func() {
				w.Destroy() // real WM_CLOSE: native flush handshake and saved placement
			})
			return nil
		})
		w.Bind("nativeSessionFailure", func(message string) { failure = message; finished = true; w.Terminate() })
		data, _ := os.ReadFile(expectedPath)
		if len(data) == 0 {
			data = []byte("null")
		}
		phaseJSON, _ := json.Marshal(phase)
		w.Init("window.sessionTestPhase=" + string(phaseJSON) + ";window.sessionTestExpected=" + string(data) + ";")
		w.Init(nativePDFFixturesJS)
		w.Init(`if(top===window)window.addEventListener('DOMContentLoaded',async()=>{
          const wait=async fn=>{const end=Date.now()+18000;while(!fn()){if(Date.now()>end)throw Error('Session restore timeout');await new Promise(r=>setTimeout(r,30))}};
          try{
            await PDFGridSession.ready;
            if(sessionTestPhase==='write-normal'){
              for(const [name,count] of [['Session-A.pdf',24],['Session-B.pdf',16]]){
                const bytes=await createPDFGridFixture(PDFLib,count),id=await nativeSessionFixture(name,btoa(String.fromCharCode(...bytes))),source=await pdfGridDesktop.refreshPDF(id),file=new File([source.bytes],name,{type:'application/pdf'});file.pdfGridSourceID=id;await openPdfTabs([file]);
              }
              const generated=await createPDFGridFixture(PDFLib,12);await openPdfTabs([new File([generated],'Generated.pdf',{type:'application/pdf'})]);
              document.querySelector('#pdfTabList [role=tab]').click();const frame=document.querySelector('.pdfTabPanel[aria-hidden=false] iframe').contentWindow;
              frame.setGridViewportRows(1);frame.go(1);await frame.followPDFDestination('cite.mapping');await new Promise(r=>setTimeout(r,180));
              const expected={names:[...document.querySelectorAll('#pdfTabList [role=tab]')].map(t=>t.textContent),active:'Session-A.pdf',state:frame.gridReloadState()};
              await PDFGridSession.flush();await nativeSessionFinish(JSON.stringify(expected));
            }else{
              await wait(()=>document.querySelectorAll('#pdfTabList [role=tab]').length===3);
              const names=[...document.querySelectorAll('#pdfTabList [role=tab]')].map(t=>t.textContent);if(JSON.stringify(names)!==JSON.stringify(sessionTestExpected.names))throw Error('Restored tab order');
              if(document.querySelector('#pdfTabList [aria-selected=true]').textContent!==sessionTestExpected.active)throw Error('Restored active tab');
              const frame=document.querySelector('.pdfTabPanel[aria-hidden=false] iframe').contentWindow;
              await wait(()=>frame.document.querySelectorAll('.sheet').length===24);
              await nativeSessionAssertWindow();await new Promise(r=>setTimeout(r,180));const state=frame.gridReloadState();if(sessionTestPhase.startsWith('read-')&&(Math.abs(state.view.top-sessionTestExpected.state.view.top)>4||Math.abs(state.view.scale-sessionTestExpected.state.view.scale)>.002))throw Error('Restored reading view '+JSON.stringify({expected:sessionTestExpected.state.view,actual:state.view}));
              if(state.navigation.entries.length<2||!frame.document.querySelector('#historyBack').textContent.includes('1쪽'))throw Error('Restored link history');
              await nativeSessionAssertWindow();await new Promise(r=>setTimeout(r,150));await nativeSessionFinish(sessionTestPhase==='write-maximized'?JSON.stringify({...sessionTestExpected,state:frame.gridReloadState()}):'');
            }
          }catch(error){await nativeSessionFailure(String(error.stack||error))}
        });`)
	}
	defer func() { windowTestHook = nil }()
	if err = runWindow(a, profile, "http://"+address+"/dev/"); err != nil {
		t.Fatal(err)
	}
	// Let Chromium flush storage, then stop only this child test's profile runtimes.
	time.Sleep(900 * time.Millisecond)
	cleanup := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -and $_.CommandLine.Contains($env:PDFGRID_TEST_PROFILE) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`)
	cleanup.Env = append(os.Environ(), "PDFGRID_TEST_PROFILE="+profile)
	cleanup.Run()
	if !finished || failure != "" {
		t.Fatalf("Session phase did not finish: %s", failure)
	}
	if _, err = os.Stat(filepath.Join(profile, "window-placement.json")); err != nil {
		t.Fatal(err)
	}
}
