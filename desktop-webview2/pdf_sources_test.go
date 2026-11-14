package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRefreshReadsRebuiltPDFAndProtectsSources(t *testing.T) {
	a := &app{token: "test"}
	path := filepath.Join(t.TempDir(), "rebuilt.pdf")
	if err := os.WriteFile(path, []byte("%PDF-first"), 0600); err != nil {
		t.Fatal(err)
	}
	value, err := a.readPDFPath(path)
	if err != nil {
		t.Fatal(err)
	}
	id := value.(map[string]any)["sourceID"].(string)
	// Build tools commonly replace the file rather than updating its old handle.
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if _, err := a.refreshPDF(a.token, id); err == nil {
		t.Fatal("Missing source was reported as refreshed")
	}
	if err := os.WriteFile(path, []byte("%PDF-second"), 0600); err != nil {
		t.Fatal(err)
	}
	value, err = a.refreshPDF(a.token, id)
	if err != nil {
		t.Fatal(err)
	}
	refreshed := value.(map[string]any)
	if string(refreshed["bytes"].([]byte)) != "%PDF-second" || refreshed["sourceID"] != id {
		t.Fatal("Did not reopen the rebuilt file")
	}
	for _, pair := range [][2]string{{"wrong", id}, {a.token, path}, {a.token, "unknown"}} {
		if _, err := a.refreshPDF(pair[0], pair[1]); err == nil {
			t.Fatal("Unauthorized file read")
		}
	}
	if _, err := a.readPDFPath("relative.pdf"); err == nil {
		t.Fatal("Relative source accepted")
	}
}
