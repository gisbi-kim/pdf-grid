package main

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

func writeProfileJSON(path string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".pdfgrid-state-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(data); err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return os.Rename(name, path)
}

func (a *app) loadPDFSources() {
	if a.sourceFile == "" {
		return
	}
	data, err := os.ReadFile(a.sourceFile)
	if err != nil || len(data) > 4*1024*1024 {
		return
	}
	var saved map[string]string
	if json.Unmarshal(data, &saved) != nil || len(saved) > 10000 {
		return
	}
	a.sources = make(map[string]string)
	for id, path := range saved {
		if _, err := hex.DecodeString(id); err == nil && len(id) == 64 && filepath.IsAbs(path) && strings.EqualFold(filepath.Ext(path), ".pdf") {
			a.sources[id] = path
		}
	}
}
