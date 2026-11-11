package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOfflineAssets(t *testing.T) {
	a := newLocalApp("127.0.0.1:49381")
	for _, path := range []string{"/", "/dev/", "/dev/app.js", "/dev/core.js", "/dev/vendor/pdf-lib.min.js", "/dev/vendor/jszip.min.js", "/_local/runtime.js"} {
		r := httptest.NewRequest("GET", "http://"+a.host+path, nil)
		w := httptest.NewRecorder()
		a.handler().ServeHTTP(w, r)
		if w.Code != 200 || w.Body.Len() == 0 {
			t.Fatalf("%s: %d", path, w.Code)
		}
		if path == "/dev/" && !strings.Contains(w.Body.String(), "/_local/runtime.js") {
			t.Fatal("missing local UI")
		}
	}
}
func TestHostOriginAndMutations(t *testing.T) {
	a := newLocalApp("127.0.0.1:49381")
	cases := []struct {
		host, origin, path, method, token string
		status                            int
	}{{"evil.test", "", "/", "GET", "", 403}, {a.host, "https://evil.test", "/", "GET", "", 403}, {a.host, "", "/_local/quit", "POST", "", 403}, {a.host, "", "/_local/quit", "GET", a.token, 403}, {a.host, "", "/dev/", "POST", "", 405}, {a.host, "", "/does-not-exist", "GET", "", 404}, {a.host, "", "/_local/ping", "POST", a.token, 204}, {a.host, "http://" + a.host, "/_local/quit", "POST", a.token, 204}}
	for _, c := range cases {
		r := httptest.NewRequest(c.method, "http://"+c.host+c.path, nil)
		r.Header.Set("Origin", c.origin)
		r.Header.Set("X-PDF-Grid-Token", c.token)
		w := httptest.NewRecorder()
		a.handler().ServeHTTP(w, r)
		if w.Code != c.status {
			t.Fatalf("%+v: %d", c, w.Code)
		}
	}
	select {
	case <-a.quit:
	default:
		t.Fatal("quit did not signal")
	}
}
func TestNoRemoteAssetURLs(t *testing.T) {
	r := httptest.NewRequest("GET", "http://127.0.0.1:49381/dev/", nil)
	w := httptest.NewRecorder()
	newLocalApp(r.Host).handler().ServeHTTP(w, r)
	if !strings.Contains(w.Header().Get("Content-Security-Policy"), "connect-src 'self' blob:") {
		t.Fatal("network isolation missing")
	}
	if w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("nosniff missing")
	}
	_ = http.StatusOK
}
