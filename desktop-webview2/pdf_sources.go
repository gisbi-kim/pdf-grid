package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// Source identifiers authorize rereading only PDFs explicitly opened by the user.
// Keep paths in the native host, rather than accepting arbitrary paths from JS.
func (a *app) readPDFPath(path string) (any, error) {
	if !filepath.IsAbs(path) || !strings.EqualFold(filepath.Ext(path), ".pdf") {
		return nil, fmt.Errorf("PDF 파일만 열 수 있습니다.")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("PDF 파일을 읽을 수 없습니다. 빌드가 끝난 뒤 다시 시도해 주세요: %w", err)
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.sources == nil {
		a.sources = make(map[string]string)
	}
	id := ""
	for key, source := range a.sources {
		if source == path {
			id = key
			break
		}
	}
	if id == "" {
		id = randomToken()
		a.sources[id] = path
		if a.sourceFile != "" {
			if err := writeProfileJSON(a.sourceFile, a.sources); err != nil {
				log.Printf("PDF source state: %v", err)
			}
		}
	}
	return map[string]any{"name": filepath.Base(path), "bytes": data, "sourceID": id}, nil
}

func (a *app) refreshPDF(token, id string) (any, error) {
	if token != a.token {
		return nil, fmt.Errorf("Unauthorized")
	}
	a.mu.Lock()
	path, ok := a.sources[id]
	a.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("원본 PDF를 다시 열어 주세요.")
	}
	return a.readPDFPath(path)
}
