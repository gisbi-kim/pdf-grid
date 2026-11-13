//go:build windows && startupbenchmark

package main

import (
	_ "embed"
	"encoding/json"
	webview "github.com/jchv/go-webview2"
	"os"
	"time"
)

// This instrumentation is excluded from the distributed application.
//
//go:embed benchmark/probe.js
var startupProbe string

func init() {
	windowTestHook = func(w webview.WebView) {
		var uiAt int64
		w.Bind("__pdfGridBenchSignal", func(stage string) {
			if stage == "ui" {
				uiAt = time.Now().UnixMilli()
				return
			}
			if stage != "ready" {
				return
			}
			b, _ := json.Marshal(map[string]int64{"uiAt": uiAt, "readyAt": time.Now().UnixMilli()})
			os.WriteFile(os.Getenv("PDFGRID_BENCHMARK_RESULT"), b, 0600)
			w.SetTitle("PDF Grid [BENCH READY]")
		})
		w.Init(startupProbe)
	}
}
