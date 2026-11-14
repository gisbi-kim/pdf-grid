//go:build windows

package main

import "strconv"

// Restoring an already-maximized window changes it to its normal/default size.
// Touch its show state only when it really is minimized; SW_RESTORE then uses
// Windows' saved placement, including the restore-to-maximized flag.
func revealPDFWindow(hwnd uintptr) {
	minimized, _, _ := user32.NewProc("IsIconic").Call(hwnd)
	if minimized != 0 {
		user32.NewProc("ShowWindow").Call(hwnd, 9) // SW_RESTORE
	}
	user32.NewProc("SetForegroundWindow").Call(hwnd)
}

// Explorer's new launcher may transfer its foreground privilege to the existing
// viewer before forwarding a PDF. Windows still enforces its activation policy.
func allowPDFWindowActivation(pid string) {
	value, err := strconv.ParseUint(pid, 10, 32)
	if err == nil && value != 0 {
		user32.NewProc("AllowSetForegroundWindow").Call(uintptr(value))
	}
}
