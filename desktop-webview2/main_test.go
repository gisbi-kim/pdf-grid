package main

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAssetsAndBoundary(t *testing.T) {
	a := &app{token: "test", instanceToken: "instance"}
	h := a.handler()
	for _, p := range []string{"/dev/", "/", "/dev/app.js", "/dev/style.css", "/dev/core.js", "/dev/vendor/pdf-lib.min.js", "/dev/vendor/jszip.min.js", "/_desktop/bridge.js"} {
		r := httptest.NewRequest("GET", "http://"+address+p, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 200 || w.Body.Len() == 0 {
			t.Fatalf("%s: %d", p, w.Code)
		}
		if p == "/dev/" && !strings.Contains(w.Body.String(), "/_desktop/bridge.js") {
			t.Fatal("Missing bridge")
		}
	}
	for _, c := range []struct {
		method, path, host, origin, token string
		want                              int
	}{
		{"GET", "/dev/", "evil.test", "", "", 403}, {"GET", "/dev/", address, "https://evil.test", "", 403},
		{"POST", "/_desktop/open", address, "", "", 403}, {"POST", "/_desktop/open", address, "", "instance", 400},
		{"GET", "/dev/vendor/", address, "", "", 404}, {"GET", "/missing", address, "", "", 404}, {"POST", "/dev/", address, "", "", 405},
	} {
		r := httptest.NewRequest(c.method, "http://"+c.host+c.path, nil)
		r.Header.Set("Origin", c.origin)
		r.Header.Set("X-Instance-Token", c.token)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != c.want {
			t.Fatalf("%+v: %d", c, w.Code)
		}
	}
}
func TestQueuedPDFAndAuth(t *testing.T) {
	a := &app{token: "secret", instanceToken: "instance"}
	dir := t.TempDir()
	p := filepath.Join(dir, "한글.pdf")
	os.WriteFile(p, []byte("%PDF-test"), 0600)
	b, _ := json.Marshal([]string{p, filepath.Join(dir, "not.txt"), "relative.pdf"})
	r := httptest.NewRequest("POST", "http://"+address+"/_desktop/open", strings.NewReader(string(b)))
	r.Header.Set("X-Instance-Token", a.instanceToken)
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	if w.Code != 204 {
		t.Fatal(w.Code)
	}
	if _, err := a.nextPDF("wrong"); err == nil {
		t.Fatal("Unauthorized native read")
	}
	result, err := a.nextPDF(a.token)
	if err != nil {
		t.Fatal(err)
	}
	f := result.(map[string]any)
	if f["name"] != "한글.pdf" || string(f["bytes"].([]byte)) != "%PDF-test" {
		t.Fatal(result)
	}
	if v, err := a.nextPDF(a.token); v != nil || err != nil {
		t.Fatal("Queue should be empty")
	}
}
func TestSaveNames(t *testing.T) {
	for _, s := range []string{"x.pdf", "한국어.zip", strings.Repeat("가", 100) + ".pdf"} {
		if !validOutputName(s) {
			t.Fatal(s)
		}
	}
	for _, s := range []string{"../x.pdf", "x.exe", "x:stream.pdf", "x\\a.zip", "x.pdf ", "\x00.pdf"} {
		if validOutputName(s) {
			t.Fatal(s)
		}
	}
}
