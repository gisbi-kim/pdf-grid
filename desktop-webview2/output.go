package main

import (
	"path/filepath"
	"strings"
)

func validOutputName(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".pdf" && ext != ".zip" {
		return false
	}
	if len(name) == 0 || len(name) > 240 || strings.TrimSpace(name) != name {
		return false
	}
	for _, r := range name {
		if r < 32 || strings.ContainsRune(`<>:"/\|?*`, r) {
			return false
		}
	}
	return true
}
