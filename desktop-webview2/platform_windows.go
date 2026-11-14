//go:build windows

package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	webview "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
	"image/png"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
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
	if err := w.Bind("nativeSave", func(token, requestID, name string, data []byte) error {
		if token != a.token {
			return fmt.Errorf("Unauthorized")
		}
		if len(requestID) == 0 || len(requestID) > 80 || !validOutputName(name) || len(data) > 200*1024*1024 {
			return fmt.Errorf("저장할 파일 형식이 올바르지 않습니다.")
		}
		// WebView2 forbids synchronous modal UI inside WebMessageReceived. Post the
		// dialog until after the callback returns; the JS promise is already registered.
		// https://learn.microsoft.com/microsoft-edge/webview2/concepts/threading-model
		w.Dispatch(func() {
			saved, err := saveWithDialog(hwnd, name, data)
			message := ""
			if err != nil {
				message = err.Error()
			}
			idJSON, _ := json.Marshal(requestID)
			errorJSON, _ := json.Marshal(message)
			w.Eval(fmt.Sprintf("window.__pdfGridSaveResult(%s,%t,%s)", idJSON, saved, errorJSON))
		})
		return nil
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
	if err := w.Bind("nativeOpenExternal", func(token, address string) error {
		if token != a.token {
			return fmt.Errorf("Unauthorized")
		}
		if err := validateExternalURL(address); err != nil {
			return err
		}
		if a.externalOpener != nil {
			return a.externalOpener(address)
		}
		return openExternalBrowser(address)
	}); err != nil {
		return err
	}
	updates := a.updateSource
	if updates == nil {
		updates = defaultUpdateClient()
	}
	var latestMu sync.Mutex
	var latestChecked *updateRelease
	installingUpdate := false
	completeTask := func(id string, result any, err error) {
		message := ""
		if err != nil {
			message = err.Error()
		}
		idJSON, _ := json.Marshal(id)
		resultJSON, _ := json.Marshal(result)
		errorJSON, _ := json.Marshal(message)
		w.Dispatch(func() { w.Eval(fmt.Sprintf("window.__pdfGridTaskResult(%s,%s,%s)", idJSON, resultJSON, errorJSON)) })
	}
	validTask := func(token, id string) error {
		if token != a.token || len(id) == 0 || len(id) > 80 {
			return fmt.Errorf("Unauthorized")
		}
		return nil
	}
	if err := w.Bind("nativeCheckUpdates", func(token, id string) error {
		if err := validTask(token, id); err != nil {
			return err
		}
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
			defer cancel()
			r, err := updates.latest(ctx)
			if err == nil {
				latestMu.Lock()
				latestChecked = &r
				latestMu.Unlock()
			}
			completeTask(id, r, err)
		}()
		return nil
	}); err != nil {
		return err
	}
	if err := w.Bind("nativeInstallUpdate", func(token, id, tag string) error {
		if err := validTask(token, id); err != nil {
			return err
		}
		latestMu.Lock()
		if installingUpdate {
			latestMu.Unlock()
			return fmt.Errorf("이미 설치 파일을 준비하고 있습니다.")
		}
		var release updateRelease
		if latestChecked != nil {
			release = *latestChecked
		}
		if !release.CanInstall || release.Tag != tag {
			latestMu.Unlock()
			return fmt.Errorf("최신 버전을 다시 확인해 주세요.")
		}
		installingUpdate = true
		latestMu.Unlock()
		resetInstall := func() { latestMu.Lock(); installingUpdate = false; latestMu.Unlock() }
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()
			target, err := updates.download(ctx, release, filepath.Join(profile, "Updates"))
			if err != nil {
				resetInstall()
				completeTask(id, nil, err)
				return
			}
			w.Dispatch(func() {
				launcher := a.installerLauncher
				if launcher == nil {
					launcher = launchUpdateInstaller
				}
				if err := launcher(target); err != nil {
					resetInstall()
					completeTask(id, nil, fmt.Errorf("설치 프로그램을 실행하지 못했습니다: %w", err))
					return
				}
				completeTask(id, true, nil)
				w.Terminate()
			})
		}()
		return nil
	}); err != nil {
		return err
	}
	if err := w.Bind("nativeRefreshPDF", a.refreshPDF); err != nil {
		return err
	}
	if err := w.Bind("nativePickPDFs", func(token, id string) error {
		if err := validTask(token, id); err != nil {
			return err
		}
		w.Dispatch(func() {
			paths, err := chooseOpenPDFs(hwnd)
			var files []any
			if err == nil {
				for _, path := range paths {
					file, e := a.readPDFPath(path)
					if e != nil {
						err = e
						break
					}
					files = append(files, file)
				}
			}
			revealPDFWindow(hwnd)
			completeTask(id, files, err)
		})
		return nil
	}); err != nil {
		return err
	}
	if err := w.Bind("nativeNext", a.nextPDF); err != nil {
		return err
	}
	a.mu.Lock()
	a.notify = func() {
		w.Dispatch(func() {
			revealPDFWindow(hwnd)
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

func saveWithDialog(hwnd uintptr, name string, data []byte) (bool, error) {
	dest, err := chooseSave(hwnd, name)
	if err != nil || dest == "" {
		return false, err
	}
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
	if err := os.Rename(temp.Name(), dest); err != nil {
		return false, err
	}
	return true, nil
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

func openExternalBrowser(address string) error {
	if err := validateExternalURL(address); err != nil {
		return err
	}
	verb, _ := syscall.UTF16PtrFromString("open")
	target, _ := syscall.UTF16PtrFromString(address)
	result, _, _ := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW").Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(target)), 0, 0, 1)
	if result <= 32 {
		return fmt.Errorf("기본 브라우저에서 링크를 열지 못했습니다.")
	}
	return nil
}

func launchUpdateInstaller(target string) error {
	cmd := exec.Command(target)
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}

// Native picking preserves the original path so F5 can reopen replaced build outputs.
func chooseOpenPDFs(hwnd uintptr) ([]string, error) {
	buffer := make([]uint16, 65536)
	filter := syscall.StringToUTF16("PDF")
	filter = append(filter, syscall.StringToUTF16("*.pdf")...)
	filter = append(filter, 0)
	title, _ := syscall.UTF16PtrFromString("PDF Grid — PDF 열기")
	dialog := openFileName{Owner: hwnd, Filter: &filter[0], FilterIndex: 1, File: &buffer[0], MaxFile: uint32(len(buffer)), Title: title,
		Flags: 0x00080000 | 0x00001000 | 0x00000800 | 0x00000200 | 0x00000008}
	dialog.Size = uint32(unsafe.Sizeof(dialog))
	ok, _, _ := syscall.NewLazyDLL("comdlg32.dll").NewProc("GetOpenFileNameW").Call(uintptr(unsafe.Pointer(&dialog)))
	if ok == 0 {
		code, _, _ := syscall.NewLazyDLL("comdlg32.dll").NewProc("CommDlgExtendedError").Call()
		if code != 0 {
			return nil, fmt.Errorf("열기 대화상자 오류: %x", code)
		}
		return nil, nil
	}
	var parts []string
	start := 0
	for i, ch := range buffer {
		if ch != 0 {
			continue
		}
		if i == start {
			break
		}
		parts = append(parts, syscall.UTF16ToString(buffer[start:i]))
		start = i + 1
	}
	if len(parts) < 2 {
		return parts, nil
	}
	paths := make([]string, 0, len(parts)-1)
	for _, name := range parts[1:] {
		paths = append(paths, filepath.Join(parts[0], name))
	}
	return paths, nil
}
