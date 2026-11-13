//go:build windows

package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	webview "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
	"image/png"
	"log"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var user32 = syscall.NewLazyDLL("user32.dll")
var kernel32 = syscall.NewLazyDLL("kernel32.dll")

func showError(message string) {
	log.Print(message)
	title, _ := syscall.UTF16PtrFromString("PDF Grid")
	text, _ := syscall.UTF16PtrFromString(message)
	user32.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}

// Assigned only by native integration tests; production leaves it nil.
var windowTestHook func(webview.WebView)

func runWindow(a *app, profile, url string) error {
	log.Print("Creating WebView2 window")
	w := webview.NewWithOptions(webview.WebViewOptions{DataPath: filepath.Join(profile, "Profile"), Debug: os.Getenv("PDFGRID_DIAGNOSTICS") == "1", AutoFocus: true, WindowOptions: webview.WindowOptions{Title: "PDF Grid", Width: 1280, Height: 850, Center: true, IconId: 1}})
	if w == nil {
		return fmt.Errorf("Microsoft Edge WebView2 Runtime이 필요합니다. https://developer.microsoft.com/microsoft-edge/webview2 에서 Evergreen Runtime을 설치한 뒤 다시 실행해 주세요.")
	}
	log.Print("WebView2 window created")
	defer w.Destroy()
	w.SetSize(640, 450, webview.HintMin)
	hwnd := uintptr(w.Window())
	if err := w.Bind("nativeSave", func(token, name string, data []byte) (bool, error) {
		if token != a.token {
			return false, fmt.Errorf("Unauthorized")
		}
		if !validOutputName(name) || len(data) > 200*1024*1024 {
			return false, fmt.Errorf("저장할 파일 형식이 올바르지 않습니다.")
		}
		dest, err := chooseSave(hwnd, name)
		if err != nil || dest == "" {
			return false, err
		}
		// Write beside the chosen file, then replace only after every byte is written.
		temp, err := os.CreateTemp(filepath.Dir(dest), ".pdfgrid-*")
		if err != nil {
			return false, err
		}
		defer os.Remove(temp.Name())
		_, writeErr := temp.Write(data)
		closeErr := temp.Close()
		if writeErr != nil {
			return false, writeErr
		}
		if closeErr != nil {
			return false, closeErr
		}
		if err = os.Rename(temp.Name(), dest); err != nil {
			return false, err
		}
		return true, nil
	}); err != nil {
		return err
	}
	if err := w.Bind("nativeCopy", func(token string, data []byte) (bool, error) {
		if token != a.token {
			return false, fmt.Errorf("Unauthorized")
		}
		return copyPNG(hwnd, data)
	}); err != nil {
		return err
	}
	if err := w.Bind("nativeNext", a.nextPDF); err != nil {
		return err
	}
	a.mu.Lock()
	a.notify = func() {
		w.Dispatch(func() {
			user32.NewProc("ShowWindow").Call(hwnd, 9)
			user32.NewProc("SetForegroundWindow").Call(hwnd)
			w.Eval("window.dispatchEvent(new Event('pdf-open-requested'))")
		})
	}
	a.mu.Unlock()
	defer func() { a.mu.Lock(); a.notify = nil; a.mu.Unlock() }()
	if windowTestHook != nil {
		windowTestHook(w)
	}
	w.Navigate(url)
	w.Run()
	return nil
}

// OPENFILENAMEW (Windows x64 ABI).
type openFileName struct {
	Size             uint32
	Owner            uintptr
	Instance         uintptr
	Filter           *uint16
	CustomFilter     *uint16
	MaxCustomFilter  uint32
	FilterIndex      uint32
	File             *uint16
	MaxFile          uint32
	FileTitle        *uint16
	MaxFileTitle     uint32
	InitialDir       *uint16
	Title            *uint16
	Flags            uint32
	FileOffset       uint16
	FileExtension    uint16
	DefaultExtension *uint16
	CustomData       uintptr
	Hook             uintptr
	TemplateName     *uint16
	Reserved         uintptr
	ReservedSize     uint32
	FlagsEx          uint32
}

func chooseSave(hwnd uintptr, name string) (string, error) {
	buffer := make([]uint16, 32768)
	copy(buffer, syscall.StringToUTF16(name))
	filter := syscall.StringToUTF16("PDF / ZIP")
	filter = append(filter, syscall.StringToUTF16("*.pdf;*.zip")...)
	filter = append(filter, 0)
	title, _ := syscall.UTF16PtrFromString("PDF Grid — 파일 저장")
	ext, _ := syscall.UTF16PtrFromString(strings.TrimPrefix(filepath.Ext(name), "."))
	var initialDir *uint16
	if downloads, err := windows.KnownFolderPath(windows.FOLDERID_Downloads, 0); err == nil {
		initialDir, _ = syscall.UTF16PtrFromString(downloads)
	}
	dialog := openFileName{InitialDir: initialDir, Owner: hwnd, Filter: &filter[0], FilterIndex: 1, File: &buffer[0], MaxFile: uint32(len(buffer)), Title: title, DefaultExtension: ext, Flags: 0x00080000 | 0x00000002 | 0x00000800 | 0x00000008}
	dialog.Size = uint32(unsafe.Sizeof(dialog))
	ok, _, _ := syscall.NewLazyDLL("comdlg32.dll").NewProc("GetSaveFileNameW").Call(uintptr(unsafe.Pointer(&dialog)))
	if ok == 0 {
		code, _, _ := syscall.NewLazyDLL("comdlg32.dll").NewProc("CommDlgExtendedError").Call()
		if code != 0 {
			return "", fmt.Errorf("저장 대화상자 오류: %x", code)
		}
		return "", nil
	}
	return syscall.UTF16ToString(buffer), nil
}
func copyPNG(hwnd uintptr, data []byte) (bool, error) {
	if len(data) > 32*1024*1024 {
		return false, fmt.Errorf("이미지가 너무 큽니다.")
	}
	cfg, err := png.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return false, err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || int64(cfg.Width)*int64(cfg.Height) > 32*1024*1024 {
		return false, fmt.Errorf("이미지가 너무 큽니다.")
	}
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return false, err
	}
	width, height := cfg.Width, cfg.Height
	dib := make([]byte, 40+width*height*4)
	binary.LittleEndian.PutUint32(dib, 40)
	binary.LittleEndian.PutUint32(dib[4:], uint32(width))
	binary.LittleEndian.PutUint32(dib[8:], uint32(height))
	binary.LittleEndian.PutUint16(dib[12:], 1)
	binary.LittleEndian.PutUint16(dib[14:], 32)
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			i := 40 + ((height-1-y)*width+x)*4
			dib[i], dib[i+1], dib[i+2] = byte(b>>8), byte(g>>8), byte(r>>8)
		}
	}
	handle, _, _ := kernel32.NewProc("GlobalAlloc").Call(0x42, uintptr(len(dib)))
	if handle == 0 {
		return false, fmt.Errorf("클립보드 메모리 부족")
	}
	owned := true
	defer func() {
		if owned {
			kernel32.NewProc("GlobalFree").Call(handle)
		}
	}()
	ptr, _, _ := kernel32.NewProc("GlobalLock").Call(handle)
	if ptr == 0 {
		return false, fmt.Errorf("클립보드 메모리 오류")
	}
	copy(unsafe.Slice((*byte)(unsafe.Pointer(ptr)), len(dib)), dib)
	kernel32.NewProc("GlobalUnlock").Call(handle)
	opened, _, _ := user32.NewProc("OpenClipboard").Call(hwnd)
	if opened == 0 {
		return false, fmt.Errorf("다른 앱이 클립보드를 사용 중입니다.")
	}
	defer user32.NewProc("CloseClipboard").Call()
	user32.NewProc("EmptyClipboard").Call()
	result, _, _ := user32.NewProc("SetClipboardData").Call(8, handle)
	if result == 0 {
		return false, fmt.Errorf("클립보드 복사 실패")
	}
	owned = false
	return true, nil
}
