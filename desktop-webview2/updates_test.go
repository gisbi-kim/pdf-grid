package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

type testRoundTrip func(*http.Request) (*http.Response, error)

func (f testRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func fakeUpdates(t *testing.T, body []byte, corrupt bool) (*updateClient, *int) {
	t.Helper()
	calls := 0
	hash := sha256.Sum256(body)
	sum := hex.EncodeToString(hash[:])
	tag := "desktop-v9.9.9-build.999"
	prefix := releaseAssetPrefix + tag + "/"
	client := &http.Client{Transport: testRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.Method != "GET" {
			t.Fatal("Unexpected network mutation")
		}
		var data string
		switch r.URL.String() {
		case releaseAPI:
			data = fmt.Sprintf(`{"tag_name":%q,"html_url":"https://github.com/gisbi-kim/pdf-grid/releases/tag/%s","assets":[{"name":"PDF-Grid-Setup.exe","browser_download_url":%q},{"name":"SHA256SUMS.txt","browser_download_url":%q}]}`, tag, tag, prefix+"PDF-Grid-Setup.exe", prefix+"SHA256SUMS.txt")
		case prefix + "SHA256SUMS.txt":
			data = sum + "  PDF-Grid-Setup.exe\n"
		case prefix + "PDF-Grid-Setup.exe":
			calls++
			data = string(body)
			if corrupt {
				data += "corruption"
			}
		default:
			t.Fatal("Unexpected host or URL: " + r.URL.String())
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(data)), Header: make(http.Header), ContentLength: int64(len(data))}, nil
	})}
	return &updateClient{client: client, api: releaseAPI}, &calls
}
func TestVersionAndExternalURLs(t *testing.T) {
	for _, v := range []string{"desktop-v1.4.2-build.16", "desktop-v1.4.2"} {
		if _, _, ok := parseReleaseTag(v); !ok {
			t.Fatal(v)
		}
	}
	for _, v := range []string{"../file", "desktop-v1.2.3-build.1/evil", "desktop-v1.+2.3", "desktop-v1.2.3-build.", "desktop-v1.2.3-build.-1"} {
		if _, _, ok := parseReleaseTag(v); ok {
			t.Fatal(v)
		}
	}
	for _, v := range []string{"https://example.com/a?q=x#page", "http://example.com", "mailto:test@example.com"} {
		if e := validateExternalURL(v); e != nil {
			t.Fatal(e)
		}
	}
	for _, v := range []string{"javascript:alert(1)", "file:///C:/secret", "cmd.exe /c x", "https:///", "https://example.com/\x00"} {
		if validateExternalURL(v) == nil {
			t.Fatal(v)
		}
	}
	if v, e := compareVersions("1.4.10", "1.4.2"); e != nil || v != 1 {
		t.Fatal(v, e)
	}
}
func TestVerifiedUpdateDownloadAndCache(t *testing.T) {
	c, calls := fakeUpdates(t, []byte("MZ-test-installer"), false)
	r, e := c.latest(context.Background())
	if e != nil || !r.Available || !r.CanInstall {
		t.Fatal(r, e)
	}
	directory := t.TempDir()
	target, e := c.download(context.Background(), r, directory)
	if e != nil {
		t.Fatal(e)
	}
	b, _ := os.ReadFile(target)
	if string(b) != "MZ-test-installer" {
		t.Fatal("Wrong bytes")
	}
	if _, e = c.download(context.Background(), r, directory); e != nil {
		t.Fatal(e)
	}
	if *calls != 1 {
		t.Fatal("Did not reuse verified installer")
	}
	r.InstallerURL = "https://example.com/malicious.exe"
	if _, e = c.download(context.Background(), r, directory); e == nil {
		t.Fatal("Foreign installer URL accepted")
	}
}
func TestCorruptOrNonExecutableUpdateNeverInstalled(t *testing.T) {
	for _, tc := range []struct {
		data    string
		corrupt bool
	}{{"MZ-original", true}, {"not-an-executable", false}} {
		c, _ := fakeUpdates(t, []byte(tc.data), tc.corrupt)
		r, e := c.latest(context.Background())
		if e != nil {
			t.Fatal(e)
		}
		directory := t.TempDir()
		if _, e = c.download(context.Background(), r, directory); e == nil {
			t.Fatal("Invalid installer accepted")
		}
		entries, _ := os.ReadDir(directory)
		if len(entries) != 0 {
			t.Fatal("Invalid download retained")
		}
	}
}

// Opt-in smoke test of the real public API, HTTPS redirects and release checksums.
// It downloads to a test directory and never launches the installer.
func TestLiveReleaseDownload(t *testing.T) {
	if os.Getenv("PDFGRID_LIVE_UPDATES") != "1" {
		t.Skip("set PDFGRID_LIVE_UPDATES=1 for live release verification")
	}
	c := defaultUpdateClient()
	r, err := c.latest(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	target, err := c.download(context.Background(), r, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(target)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("Verified public release %s: %d-byte installer", r.Tag, info.Size())
}
