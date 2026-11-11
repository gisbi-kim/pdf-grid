//go:build windows

package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

func showError(message string) {
	title, _ := syscall.UTF16PtrFromString("PDF Grid")
	text, _ := syscall.UTF16PtrFromString(message)
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}
func openBrowser(url string) error {
	verb, _ := syscall.UTF16PtrFromString("open")
	target, _ := syscall.UTF16PtrFromString(url)
	result, _, _ := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW").Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(target)), 0, 0, 1)
	if result <= 32 {
		return fmt.Errorf("default browser could not open (code %d)", result)
	}
	return nil
}
func install() (bool, error) {
	source, err := os.Executable()
	if err != nil {
		return true, err
	}
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return true, fmt.Errorf("LOCALAPPDATA is unavailable")
	}
	directory := filepath.Join(local, "PDFGrid")
	target := filepath.Join(directory, "PDF-Grid.exe")
	if strings.EqualFold(filepath.Clean(source), filepath.Clean(target)) {
		return false, nil
	}
	if err := os.MkdirAll(directory, 0700); err != nil {
		return true, err
	}
	input, err := os.Open(source)
	if err != nil {
		return true, err
	}
	defer input.Close()
	temp, err := os.CreateTemp(directory, "install-*.exe")
	if err != nil {
		return true, err
	}
	name := temp.Name()
	defer os.Remove(name)
	_, copyErr := io.Copy(temp, input)
	closeErr := temp.Close()
	if copyErr != nil {
		return true, copyErr
	}
	if closeErr != nil {
		return true, closeErr
	}
	if err := os.Rename(name, target); err != nil {
		return true, fmt.Errorf("Close PDF Grid with the App Exit button, then run setup again: %w", err)
	}
	// Known-folder lookup also supports OneDrive redirected desktops. Only the
	// target path is passed via a child environment variable, never interpolated.
	script := `$ErrorActionPreference='Stop'; $desktop=[Environment]::GetFolderPath('Desktop'); $shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut((Join-Path $desktop 'PDF Grid.lnk')); $shortcut.TargetPath=$env:PDFGRID_SHORTCUT_TARGET; $shortcut.WorkingDirectory=Split-Path $env:PDFGRID_SHORTCUT_TARGET; $shortcut.IconLocation=$env:PDFGRID_SHORTCUT_TARGET+',0'; $shortcut.Description='PDF Grid - Offline PDF viewer, merge and split'; $shortcut.Save()`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.Env = append(os.Environ(), "PDFGRID_SHORTCUT_TARGET="+target)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := cmd.CombinedOutput(); err != nil {
		showError("The app is installed, but a desktop shortcut could not be created. Open: " + target + "\n" + string(output))
	}
	cmd = exec.Command(target)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return true, cmd.Start()
}
