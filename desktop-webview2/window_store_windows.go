//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	webview "github.com/jchv/go-webview2"
	"log"
	"os"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

type windowPoint struct{ X, Y int32 }
type windowRect struct{ Left, Top, Right, Bottom int32 }
type windowPlacement struct {
	Length, Flags, ShowCmd   uint32
	MinPosition, MaxPosition windowPoint
	NormalPosition           windowRect
}

func readWindowPlacement(hwnd uintptr) (windowPlacement, bool) {
	var value windowPlacement
	value.Length = uint32(unsafe.Sizeof(value))
	ok, _, _ := user32.NewProc("GetWindowPlacement").Call(hwnd, uintptr(unsafe.Pointer(&value)))
	return value, ok != 0
}
func normalizedPlacement(value windowPlacement) windowPlacement {
	if value.ShowCmd == 2 || value.ShowCmd == 6 || value.ShowCmd == 7 {
		if value.Flags&2 != 0 {
			value.ShowCmd = 3
		} else {
			value.ShowCmd = 1
		}
	}
	if value.ShowCmd != 3 {
		value.ShowCmd = 1
	}
	value.Flags = 0
	value.Length = uint32(unsafe.Sizeof(value))
	return value
}
func restoreWindowPlacement(hwnd uintptr, path string) {
	data, err := os.ReadFile(path)
	if err != nil || len(data) > 4096 {
		return
	}
	var value windowPlacement
	if json.Unmarshal(data, &value) != nil {
		return
	}
	value = normalizedPlacement(value)
	rect := value.NormalPosition
	width, height := rect.Right-rect.Left, rect.Bottom-rect.Top
	if width < 320 || height < 240 || width > 32768 || height > 32768 {
		return
	}
	monitor, _, _ := user32.NewProc("MonitorFromRect").Call(uintptr(unsafe.Pointer(&rect)), 0)
	if monitor == 0 {
		if value.ShowCmd == 3 {
			user32.NewProc("ShowWindow").Call(hwnd, 3)
		}
		return
	}
	user32.NewProc("SetWindowPlacement").Call(hwnd, uintptr(unsafe.Pointer(&value)))
}

// Flush local tab state before accepting WM_CLOSE. The fallback keeps an
// unresponsive page from preventing the user from closing their own window.
func installWindowPersistence(w webview.WebView, profile, token string) (func(), error) {
	hwnd := uintptr(w.Window())
	path := filepath.Join(profile, "window-placement.json")
	restoreWindowPlacement(hwnd, path)
	last, _ := readWindowPlacement(hwnd)
	save := func() {
		if current, ok := readWindowPlacement(hwnd); ok {
			last = current
		}
		if err := writeProfileJSON(path, normalizedPlacement(last)); err != nil {
			log.Printf("Window state: %v", err)
		}
	}
	requested, allowed := false, false
	done := make(chan struct{})
	finish := func() {
		if allowed {
			return
		}
		allowed = true
		save()
		w.Destroy()
	}
	if err := w.Bind("nativeSessionCloseReady", func(secret string) error {
		if secret != token || !requested {
			return fmt.Errorf("Unauthorized")
		}
		w.Dispatch(finish)
		return nil
	}); err != nil {
		return nil, err
	}
	comctl := syscall.NewLazyDLL("comctl32.dll")
	def := comctl.NewProc("DefSubclassProc")
	var callback uintptr
	callback = syscall.NewCallback(func(window, message, wp, lp, id, ref uintptr) uintptr {
		switch message {
		case 0x0003, 0x0005: // WM_MOVE / WM_SIZE
			if current, ok := readWindowPlacement(window); ok {
				last = current
			}
		case 0x0319: // WM_APPCOMMAND: browser mouse buttons / browser keys
			command := (lp >> 16) & 0xfff
			enabled, _, _ := user32.NewProc("IsWindowEnabled").Call(window)
			if enabled != 0 && (command == 1 || command == 2) {
				direction := -1
				if command == 2 {
					direction = 1
				}
				w.Dispatch(func() { w.Eval(fmt.Sprintf("window.PDFGridNavigation?.move(%d)", direction)) })
				return 1
			}
		case 0x0010: // WM_CLOSE
			save()
			if !allowed {
				if !requested {
					requested = true
					w.Eval("Promise.resolve(window.PDFGridSession?.flush()).catch(()=>{}).finally(()=>window.pdfGridDesktop?.closeReady())")
					go func() {
						select {
						case <-time.After(1800 * time.Millisecond):
							w.Dispatch(finish)
						case <-done:
						}
					}()
				}
				return 0
			}
		case 0x0082: // WM_NCDESTROY
			comctl.NewProc("RemoveWindowSubclass").Call(window, callback, id)
		}
		result, _, _ := def.Call(window, message, wp, lp)
		return result
	})
	ok, _, _ := comctl.NewProc("SetWindowSubclass").Call(hwnd, callback, 1, 0)
	if ok == 0 {
		return nil, fmt.Errorf("창 상태 저장을 준비하지 못했습니다.")
	}
	return func() { save(); close(done) }, nil
}
