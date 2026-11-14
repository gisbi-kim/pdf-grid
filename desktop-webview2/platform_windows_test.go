//go:build windows

package main

import (
	"bytes"
	"image"
	"image/png"
	"testing"
	"unsafe"
)

func TestWindowsDialogABI(t *testing.T) {
	if size := unsafe.Sizeof(openFileName{}); size != 152 {
		t.Fatalf("OPENFILENAMEW size: %d", size)
	}
}
func TestNativeClipboard(t *testing.T) {
	var b bytes.Buffer
	png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 8, 6)))
	ok, e := copyPNG(0, b.Bytes())
	if e != nil || !ok {
		t.Fatalf("Clipboard: %v", e)
	}
}

func TestWindowPlacementPersistenceABI(t *testing.T) {
	if unsafe.Sizeof(windowPlacement{}) != 44 {
		t.Fatal("WINDOWPLACEMENT ABI mismatch")
	}
	for _, maximize := range []bool{false, true} {
		value := windowPlacement{ShowCmd: 2}
		if maximize {
			value.Flags = 2
		}
		restored := normalizedPlacement(value)
		if (restored.ShowCmd == 3) != maximize || restored.ShowCmd == 2 {
			t.Fatal("Minimized state did not normalize correctly")
		}
	}
}
