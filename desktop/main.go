package main

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed web
var files embed.FS
var version = "dev"
var installMode = "portable"

const identity = "pdf-grid-desktop-v1"

type localApp struct {
	host, token string
	lastSeen    atomic.Int64
	quit        chan struct{}
}

func newLocalApp(host string) *localApp {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		panic(err)
	}
	app := &localApp{host: host, token: hex.EncodeToString(key), quit: make(chan struct{}, 1)}
	app.lastSeen.Store(time.Now().Unix())
	return app
}
func (a *localApp) handler() http.Handler {
	web, _ := fs.Sub(files, "web")
	static := http.FileServer(http.FS(web))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Bind to loopback and reject foreign hosts/origins, including DNS rebinding.
		if r.Host != a.host {
			http.Error(w, "Local access only", http.StatusForbidden)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+a.host {
			http.Error(w, "Foreign origin", http.StatusForbidden)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' blob:; frame-src 'self' blob:; frame-ancestors 'self'; object-src 'none'")
		w.Header().Set("Cache-Control", "no-store")
		if r.URL.Path == "/_local/ping" || r.URL.Path == "/_local/quit" {
			if r.Method != http.MethodPost || r.Header.Get("X-PDF-Grid-Token") != a.token {
				http.Error(w, "Unauthorized", http.StatusForbidden)
				return
			}
			a.lastSeen.Store(time.Now().Unix())
			w.WriteHeader(http.StatusNoContent)
			if r.URL.Path == "/_local/quit" {
				select {
				case a.quit <- struct{}{}:
				default:
				}
			}
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "Read-only local server", http.StatusMethodNotAllowed)
			return
		}
		switch r.URL.Path {
		case "/_local/info":
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"app": identity, "version": version})
		case "/_local/runtime.js":
			w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
			fmt.Fprintf(w, runtimeJS, strconv.Quote(a.token), strconv.Quote(version))
		default:
			// Do not expose directory listings or any local filesystem APIs.
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" || strings.HasSuffix(path, "/") {
				path += "index.html"
			}
			if entry, err := fs.Stat(web, path); err == nil && entry.IsDir() {
				http.Redirect(w, r, r.URL.Path+"/", http.StatusMovedPermanently)
				return
			}
			if _, err := fs.Stat(web, path); err != nil {
				http.NotFound(w, r)
				return
			}
			static.ServeHTTP(w, r)
		}
	})
}

const runtimeJS = `(function(){
 const token=%s, version=%s;
 const send=(path)=>fetch('/_local/'+path,{method:'POST',headers:{'X-PDF-Grid-Token':token}});
 send('ping'); const heartbeat=setInterval(()=>send('ping').catch(()=>{}),30000);
 if(window.top!==window)return;
 const bar=document.createElement('div');bar.id='localRuntimeBar';bar.style.cssText='position:fixed;bottom:12px;right:16px;z-index:1000;display:flex;align-items:center;gap:12px;background:#202b21;color:#c7f481;border:1px solid #64794d;padding:10px 14px;border-radius:10px;font:12px sans-serif;box-shadow:0 3px 16px #0005';
 const label=document.createElement('span');label.textContent='● 로컬 실행 중 · '+version+' · 인터넷 불필요';
 const quit=document.createElement('button');quit.textContent='앱 종료';quit.style.cssText='font:inherit;color:inherit;border:1px solid #64794d;background:transparent;border-radius:5px;padding:6px 9px;cursor:pointer';
 quit.onclick=async()=>{if(!confirm('PDF Grid를 종료할까요? 아직 받지 않은 결과 파일은 먼저 저장해 주세요.'))return;try{await send('quit');clearInterval(heartbeat);document.body.replaceChildren();const message=document.createElement('p');message.style.cssText='padding:50px;font:18px sans-serif';message.textContent='PDF Grid를 종료했습니다. 이 탭을 닫아도 됩니다. 다시 쓰려면 바탕화면의 PDF Grid 아이콘을 실행하세요.';document.body.append(message);}catch{label.textContent='이미 종료되었습니다. 아이콘을 다시 실행하세요.'}};
 bar.append(label,quit);document.body.append(bar);
})();`

func main() {
	headless := flag.Bool("headless", false, "Run without opening a browser (for tests)")
	port := flag.Int("port", 49381, "Loopback port; 0 chooses an available port")
	flag.Parse()
	if !*headless && installMode == "setup" {
		handled, err := install()
		if err != nil {
			showError(err.Error())
			os.Exit(1)
		}
		if handled {
			return
		}
	}
	address := net.JoinHostPort("127.0.0.1", strconv.Itoa(*port))
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		client := &http.Client{Timeout: time.Second, Transport: &http.Transport{Proxy: nil}}
		response, e := client.Get("http://" + address + "/_local/info")
		if e == nil {
			defer response.Body.Close()
			var info map[string]string
			json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&info)
			if info["app"] == identity {
				if !*headless {
					if e := openBrowser("http://" + address + "/dev/"); e != nil {
						showError(e.Error())
					}
				}
				return
			}
		}
		showError("PDF Grid could not start. Port " + strconv.Itoa(*port) + " is in use. Close the other application and try again.")
		os.Exit(1)
	}
	app := newLocalApp(listener.Addr().String())
	server := &http.Server{Handler: app.handler(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	url := "http://" + listener.Addr().String() + "/dev/"
	if *headless {
		fmt.Println(url)
	} else if err := openBrowser(url); err != nil {
		showError("Open this address in your browser: " + url + "\n" + err.Error())
	}
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	defer signal.Stop(interrupt)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	running := true
	for running {
		select {
		case <-app.quit:
			running = false
		case <-interrupt:
			running = false
		case <-ticker.C:
			if time.Now().Unix()-app.lastSeen.Load() > 1800 {
				running = false
			}
		case err := <-done:
			if err != nil && err != http.ErrServerClosed {
				showError(err.Error())
			}
			return
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	server.Shutdown(ctx)
}
