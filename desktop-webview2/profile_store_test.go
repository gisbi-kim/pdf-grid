package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPDFSourcesSurviveRestart(t *testing.T) {
	profile := t.TempDir()
	source := filepath.Join(profile, "paper.pdf")
	if err := os.WriteFile(source, []byte("%PDF-test"), 0600); err != nil {
		t.Fatal(err)
	}
	store := filepath.Join(profile, "sources.json")
	first := &app{token: "first", sourceFile: store}
	value, err := first.readPDFPath(source)
	if err != nil {
		t.Fatal(err)
	}
	id := value.(map[string]any)["sourceID"].(string)
	second := &app{token: "second", sourceFile: store}
	second.loadPDFSources()
	value, err = second.refreshPDF(second.token, id)
	if err != nil {
		t.Fatal(err)
	}
	if string(value.(map[string]any)["bytes"].([]byte)) != "%PDF-test" {
		t.Fatal("Wrong restored source")
	}
	if err = writeProfileJSON(store, map[string]string{id: source}); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(store, []byte("broken state"), 0600); err != nil {
		t.Fatal(err)
	}
	third := &app{sourceFile: store}
	third.loadPDFSources()
	if len(third.sources) != 0 {
		t.Fatal("Corrupt source state accepted")
	}
}
