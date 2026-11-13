package main

import (
	"bytes"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

//go:embed web
var assets embed.FS

const version = "1.4.0"
const identity = "pdf-grid-webview2-v1"
const address = "127.0.0.1:49383"

type app struct {
	token, instanceToken string
	mu                   sync.Mutex
	pending              []string
	notify               func()
}

func randomToken() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func (a *app) enqueue(paths []string) {
	a.mu.Lock()
	for _, p := range paths {
		if filepath.IsAbs(p) && strings.EqualFold(filepath.Ext(p), ".pdf") {
			a.pending = append(a.pending, p)
		}
	}
	notify := a.notify
	a.mu.Unlock()
	if notify != nil {
		notify()
	}
}
func (a *app) nextPDF(token string) (any, error) {
	if token != a.token {
		return nil, fmt.Errorf("Unauthorized")
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(a.pending) == 0 {
		return nil, nil
	}
	name := a.pending[0]
	a.pending = a.pending[1:]
	b, e := os.ReadFile(name)
	if e != nil {
		return nil, fmt.Errorf("PDF 파일을 읽을 수 없습니다: %w", e)
	}
	return map[string]any{"name": filepath.Base(name), "bytes": b}, nil
}
func (a *app) handler() http.Handler {
	web, _ := fs.Sub(assets, "web")
	static := http.FileServer(http.FS(web))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != address || (r.Header.Get("Origin") != "" && r.Header.Get("Origin") != "http://"+address) {
			http.Error(w, "Forbidden", 403)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self' blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'")
		w.Header().Set("Cache-Control", "no-store")
		switch r.URL.Path {
		case "/_desktop/info":
			if r.Method != "GET" {
				http.Error(w, "Method", 405)
				return
			}
			json.NewEncoder(w).Encode(map[string]string{"app": identity, "version": version})
		case "/_desktop/open":
			if r.Method != "POST" || r.Header.Get("X-Instance-Token") != a.instanceToken {
				http.Error(w, "Forbidden", 403)
				return
			}
			var paths []string
			if e := json.NewDecoder(io.LimitReader(r.Body, 65536)).Decode(&paths); e != nil {
				http.Error(w, "Bad request", 400)
				return
			}
			a.enqueue(paths)
			w.WriteHeader(204)
		case "/_desktop/bridge.js":
			if r.Method != "GET" {
				http.Error(w, "Method", 405)
				return
			}
			w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
			fmt.Fprintf(w, bridgeJS, a.token)
		default:
			if r.Method != "GET" && r.Method != "HEAD" {
				http.Error(w, "Method", 405)
				return
			}
			name := strings.TrimPrefix(r.URL.Path, "/")
			if name == "" || strings.HasSuffix(name, "/") {
				name += "index.html"
			}
			entry, e := fs.Stat(web, name)
			if e != nil || entry.IsDir() {
				http.NotFound(w, r)
				return
			}
			static.ServeHTTP(w, r)
		}
	})
}

const bridgeJS = `(function(){
 if(window.top!==window)return;
 const token='%s';
 const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)};
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const saves=new Map();
 window.__pdfGridSaveResult=(id,saved,error)=>{const p=saves.get(id);if(!p)return;saves.delete(id);if(error)p.reject(new Error(error));else p.resolve(saved)};
 window.pdfGridDesktop=Object.freeze({
 saveResult:(name,bytes)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();saves.set(id,{resolve,reject});window.nativeSave(token,id,name,encode(bytes)).catch(error=>{saves.delete(id);reject(error)})}),
 copyPDFImage:bytes=>window.nativeCopy(token,encode(bytes)),
 getStartupPDF:async()=>{const f=await window.nativeNext(token);return f?{name:f.name,bytes:decode(f.bytes)}:null},
 onPDFOpenRequested:callback=>window.addEventListener('pdf-open-requested',callback)
 });
})();`

func profilePath() string {
	if local := os.Getenv("LOCALAPPDATA"); local != "" {
		return filepath.Join(local, "PDFGridWebView")
	}
	p, _ := os.UserCacheDir()
	return filepath.Join(p, "PDFGridWebView")
}
func main() {
	runtime.LockOSThread()
	headless := flag.Bool("headless", false, "Serve embedded assets without a window (verification)")
	showVersion := flag.Bool("version", false, "Print version")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}
	paths := []string{}
	for _, p := range flag.Args() {
		if abs, e := filepath.Abs(p); e == nil {
			paths = append(paths, abs)
		}
	}
	profile := profilePath()
	if e := os.MkdirAll(profile, 0700); e != nil {
		showError(e.Error())
		return
	}
	logFile, logErr := os.OpenFile(filepath.Join(profile, "startup.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if logErr == nil {
		defer logFile.Close()
		log.SetOutput(logFile)
	}
	log.Printf("Starting PDF Grid %s", version)
	listener, e := net.Listen("tcp4", address)
	if e != nil {
		client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}}
		res, err := client.Get("http://" + address + "/_desktop/info")
		if err == nil {
			defer res.Body.Close()
			var info map[string]string
			json.NewDecoder(io.LimitReader(res.Body, 4096)).Decode(&info)
			if info["app"] == identity {
				secret, err := os.ReadFile(filepath.Join(profile, "instance-token"))
				if err == nil {
					b, _ := json.Marshal(paths)
					req, _ := http.NewRequest("POST", "http://"+address+"/_desktop/open", bytes.NewReader(b))
					req.Header.Set("X-Instance-Token", string(secret))
					response, err := client.Do(req)
					if err == nil {
						response.Body.Close()
						if response.StatusCode == 204 {
							return
						}
					}
				}
			}
		}
		showError("PDF Grid를 시작하지 못했습니다. 다른 PDF Grid 창을 닫고 다시 실행해 주세요.")
		return
	}
	defer listener.Close()
	a := &app{token: randomToken(), instanceToken: randomToken()}
	a.enqueue(paths)
	if e := os.WriteFile(filepath.Join(profile, "instance-token"), []byte(a.instanceToken), 0600); e != nil {
		showError(e.Error())
		return
	}
	defer os.Remove(filepath.Join(profile, "instance-token"))
	server := &http.Server{Handler: a.handler(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: time.Minute, MaxHeaderBytes: 16384}
	go server.Serve(listener)
	defer server.Close()
	if *headless {
		fmt.Println("http://" + address + "/dev/")
		select {}
	}
	if err := runWindow(a, profile, "http://"+address+"/dev/"); err != nil {
		showError(err.Error())
	}
}
