package main

import (
	"embed"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "TreeEngineVN",
		Width:            800,
		Height:           600,
		AssetServer:      createAssetServer(),
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

func createAssetServer() *assetserver.Options {
	return &assetserver.Options{
		Assets:     assets,
		Middleware: fileServerMiddleware,
	}
}

func fileServerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("Requested URL:", r.URL.Path)
		if strings.HasPrefix(r.URL.Path, "/game/") {
			serveGameFile(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func serveGameFile(w http.ResponseWriter, r *http.Request) {
	requestedFile := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/game/"))
	fullPath := filepath.Join("./game", requestedFile)

	file, err := os.Open(fullPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	contentType := getContentType(filepath.Ext(requestedFile))
	w.Header().Set("Content-Type", contentType)

	http.ServeContent(w, r, requestedFile, stat.ModTime(), file)
}

func getContentType(ext string) string {
	types := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".svg":  "image/svg+xml",
	}

	if ct, ok := types[ext]; ok {
		return ct
	}
	return "application/octet-stream"
}