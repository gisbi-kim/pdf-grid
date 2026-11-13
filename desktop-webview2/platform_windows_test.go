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
