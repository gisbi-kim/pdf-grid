//go:build windows

package main

import (
	"fmt"
	"strings"
	"unsafe"
)

type testWindowRect struct{ Left, Top, Right, Bottom int32 }
type testWindowState struct {
	Rect      testWindowRect
	Maximized bool
}

func prepareTestWindowState(hwnd uintptr, mode string) (*testWindowState, error) {
	user32.NewProc("ShowWindow").Call(hwnd, 9)
	user32.NewProc("SetWindowPos").Call(hwnd, 0, 40, 45, 900, 550, 0x14) // retain Z order/activation
	maximized := strings.Contains(mode, "maximized")
	if maximized {
		user32.NewProc("ShowWindow").Call(hwnd, 3)
	}
	state := &testWindowState{Maximized: maximized}
	ok, _, _ := user32.NewProc("GetWindowRect").Call(hwnd, uintptr(unsafe.Pointer(&state.Rect)))
	if ok == 0 {
		return nil, fmt.Errorf("GetWindowRect failed")
	}
	if strings.HasPrefix(mode, "minimized-") {
		user32.NewProc("ShowWindow").Call(hwnd, 6)
	}
	return state, nil
}

func assertTestWindowState(hwnd uintptr, expected *testWindowState) error {
	if expected == nil {
		return fmt.Errorf("Window case was not prepared")
	}
	minimized, _, _ := user32.NewProc("IsIconic").Call(hwnd)
	maximized, _, _ := user32.NewProc("IsZoomed").Call(hwnd)
	var actual testWindowRect
	ok, _, _ := user32.NewProc("GetWindowRect").Call(hwnd, uintptr(unsafe.Pointer(&actual)))
	if ok == 0 || minimized != 0 || (maximized != 0) != expected.Maximized || actual != expected.Rect {
		return fmt.Errorf("PDF open changed window placement: minimized=%d maximized=%d rect=%+v expected=%+v", minimized, maximized, actual, expected)
	}
	return nil
}
