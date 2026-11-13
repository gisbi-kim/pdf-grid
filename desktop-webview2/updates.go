package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"
	"time"
)

var buildNumber string
var buildCommit string

const releaseAPI = "https://api.github.com/repos/gisbi-kim/pdf-grid/releases/latest"
const releaseAssetPrefix = "https://github.com/gisbi-kim/pdf-grid/releases/download/"

func parseReleaseTag(tag string) (string, string, bool) {
	if !strings.HasPrefix(tag, "desktop-v") || len(tag) > 80 {
		return "", "", false
	}
	parts := strings.Split(strings.TrimPrefix(tag, "desktop-v"), "-build.")
	if len(parts) > 2 {
		return "", "", false
	}
	if _, err := compareVersions(parts[0], parts[0]); err != nil {
		return "", "", false
	}
	build := ""
	if len(parts) == 2 {
		build = parts[1]
		if build == "" {
			return "", "", false
		}
		for _, r := range build {
			if r < '0' || r > '9' {
				return "", "", false
			}
		}
		if _, err := strconv.Atoi(build); err != nil {
			return "", "", false
		}
	}
	return parts[0], build, true
}

type updateRelease struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	CurrentBuild   string `json:"currentBuild"`
	LatestBuild    string `json:"latestBuild"`
	Tag            string `json:"tag"`
	PageURL        string `json:"pageURL"`
	Available      bool   `json:"available"`
	CanInstall     bool   `json:"canInstall"`
	InstallerURL   string `json:"-"`
	ChecksumsURL   string `json:"-"`
}
type updateClient struct {
	client *http.Client
	api    string
}

func defaultUpdateClient() *updateClient {
	return &updateClient{api: releaseAPI, client: &http.Client{Timeout: 2 * time.Minute, CheckRedirect: func(r *http.Request, via []*http.Request) error {
		if len(via) > 10 || r.URL.Scheme != "https" {
			return fmt.Errorf("다운로드 주소를 확인하지 못했습니다.")
		}
		return nil
	}}}
}
func installedCommit() string {
	if buildCommit != "" {
		return buildCommit
	}
	if b, ok := debug.ReadBuildInfo(); ok {
		for _, s := range b.Settings {
			if s.Key == "vcs.revision" {
				return s.Value
			}
		}
	}
	return ""
}
func compareVersions(a, b string) (int, error) {
	aa, bb := strings.Split(a, "."), strings.Split(b, ".")
	if len(aa) != 3 || len(bb) != 3 {
		return 0, errors.New("잘못된 버전 정보")
	}
	for i := range aa {
		for _, part := range []string{aa[i], bb[i]} {
			if part == "" {
				return 0, errors.New("잘못된 버전 정보")
			}
			for _, r := range part {
				if r < '0' || r > '9' {
					return 0, errors.New("잘못된 버전 정보")
				}
			}
		}
		x, e := strconv.Atoi(aa[i])
		if e != nil || x < 0 {
			return 0, errors.New("잘못된 버전 정보")
		}
		y, e := strconv.Atoi(bb[i])
		if e != nil || y < 0 {
			return 0, errors.New("잘못된 버전 정보")
		}
		if x < y {
			return -1, nil
		}
		if x > y {
			return 1, nil
		}
	}
	return 0, nil
}
func (c *updateClient) get(ctx context.Context, address string) (*http.Response, error) {
	req, e := http.NewRequestWithContext(ctx, "GET", address, nil)
	if e != nil {
		return nil, e
	}
	req.Header.Set("User-Agent", "PDF-Grid/"+version)
	if strings.HasPrefix(address, "https://api.github.com/") {
		req.Header.Set("Accept", "application/vnd.github+json")
	} else {
		req.Header.Set("Accept", "application/octet-stream")
	}
	res, e := c.client.Do(req)
	if e != nil {
		return nil, fmt.Errorf("인터넷에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.")
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		if res.StatusCode == 403 || res.StatusCode == 429 {
			return nil, errors.New("버전 확인 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.")
		}
		return nil, fmt.Errorf("다운로드 서버 응답 오류 (%d)", res.StatusCode)
	}
	return res, nil
}
func (c *updateClient) latest(ctx context.Context) (updateRelease, error) {
	res, e := c.get(ctx, c.api)
	if e != nil {
		return updateRelease{}, e
	}
	defer res.Body.Close()
	var data struct {
		Tag        string `json:"tag_name"`
		URL        string `json:"html_url"`
		Commit     string `json:"target_commitish"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
		Assets     []struct {
			Name string `json:"name"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if e = json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(&data); e != nil {
		return updateRelease{}, errors.New("최신 버전 정보를 읽지 못했습니다.")
	}
	latestVersion, latestBuild, valid := parseReleaseTag(data.Tag)
	if !valid || data.Draft || data.Prerelease {
		return updateRelease{}, errors.New("공개된 최신 버전을 확인하지 못했습니다.")
	}
	r := updateRelease{CurrentVersion: version, LatestVersion: latestVersion, CurrentBuild: buildNumber, LatestBuild: latestBuild, Tag: data.Tag, PageURL: "https://github.com/gisbi-kim/pdf-grid/releases/tag/" + data.Tag}
	prefix := releaseAssetPrefix + data.Tag + "/"
	for _, asset := range data.Assets {
		if !strings.HasPrefix(asset.URL, prefix) {
			continue
		}
		if asset.Name == "PDF-Grid-Setup.exe" && asset.URL == prefix+asset.Name {
			r.InstallerURL = asset.URL
		}
		if asset.Name == "SHA256SUMS.txt" && asset.URL == prefix+asset.Name {
			r.ChecksumsURL = asset.URL
		}
	}
	if r.InstallerURL == "" || r.ChecksumsURL == "" {
		return updateRelease{}, errors.New("설치 파일과 검증 정보를 찾지 못했습니다.")
	}
	order, e := compareVersions(r.LatestVersion, version)
	if e != nil {
		return updateRelease{}, e
	}
	r.CanInstall = order >= 0
	r.Available = order > 0
	if order == 0 {
		latest, _ := strconv.Atoi(r.LatestBuild)
		current, _ := strconv.Atoi(buildNumber)
		r.Available = latest > current
		if buildNumber == "" && installedCommit() == data.Commit {
			r.Available = false
		}
	}
	return r, nil
}
func (c *updateClient) download(ctx context.Context, r updateRelease, directory string) (string, error) {
	expectedPrefix := releaseAssetPrefix + r.Tag + "/"
	if _, _, valid := parseReleaseTag(r.Tag); !valid || r.InstallerURL != expectedPrefix+"PDF-Grid-Setup.exe" || r.ChecksumsURL != expectedPrefix+"SHA256SUMS.txt" {
		return "", errors.New("설치 파일 주소를 확인하지 못했습니다.")
	}
	sums, e := c.get(ctx, r.ChecksumsURL)
	if e != nil {
		return "", e
	}
	var expected string
	scanner := bufio.NewScanner(io.LimitReader(sums.Body, 1<<20))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 2 && strings.TrimPrefix(fields[1], "*") == "PDF-Grid-Setup.exe" {
			expected = strings.ToLower(fields[0])
			break
		}
	}
	scanErr := scanner.Err()
	sums.Body.Close()
	if scanErr != nil {
		return "", scanErr
	}
	digest, e := hex.DecodeString(expected)
	if e != nil || len(digest) != sha256.Size {
		return "", errors.New("설치 파일 검증 정보를 읽지 못했습니다.")
	}
	if e = os.MkdirAll(directory, 0700); e != nil {
		return "", e
	}
	target := filepath.Join(directory, "PDF-Grid-Update.exe")
	if f, e := os.Open(target); e == nil {
		var magic [2]byte
		_, headErr := io.ReadFull(f, magic[:])
		f.Seek(0, io.SeekStart)
		h := sha256.New()
		n, err := io.Copy(h, io.LimitReader(f, (64<<20)+1))
		f.Close()
		if headErr == nil && string(magic[:]) == "MZ" && err == nil && n <= 64<<20 && hex.EncodeToString(h.Sum(nil)) == expected {
			return target, nil
		}
	}
	res, e := c.get(ctx, r.InstallerURL)
	if e != nil {
		return "", e
	}
	defer res.Body.Close()
	if res.ContentLength > 64<<20 {
		return "", errors.New("설치 파일 크기를 확인하지 못했습니다.")
	}
	f, e := os.CreateTemp(directory, "download-*.tmp")
	if e != nil {
		return "", e
	}
	defer os.Remove(f.Name())
	h := sha256.New()
	n, copyErr := io.Copy(io.MultiWriter(f, h), io.LimitReader(res.Body, (64<<20)+1))
	closeErr := f.Close()
	if copyErr != nil {
		return "", copyErr
	}
	if closeErr != nil {
		return "", closeErr
	}
	if n > 64<<20 || n < 2 || hex.EncodeToString(h.Sum(nil)) != expected {
		return "", errors.New("설치 파일 검증에 실패했습니다. 다시 다운로드해 주세요.")
	}
	// Never launch a download unless both its hash and executable file header match.
	header, e := os.Open(f.Name())
	if e != nil {
		return "", e
	}
	var magic [2]byte
	_, e = io.ReadFull(header, magic[:])
	header.Close()
	if e != nil || string(magic[:]) != "MZ" {
		return "", errors.New("올바른 Windows 설치 파일이 아닙니다.")
	}
	if e = os.Rename(f.Name(), target); e != nil {
		return "", e
	}
	return target, nil
}
