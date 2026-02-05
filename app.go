package main

import (
	"context"

	"fmt"
	"os"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"TreeEngineVN/backend/ScanFiles" 
	"TreeEngineVN/backend/Request"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) ToggleFullscreen() {
	if runtime.WindowIsFullscreen(a.ctx) {
		runtime.WindowUnfullscreen(a.ctx)
		return
	}else{
		runtime.WindowFullscreen(a.ctx)
		return
	}
}

func (a * App) RequestFile(path string)(string,error){
	fmt.Println("Leyendo: " + path)
	return Request.RequestFile(path)
}

func (a * App) RequestFileWithMime(path string)(string,error){
	fmt.Println("Leyendo: " + path)
	return Request.RequestFileWithMime(path)
}

func (a * App) ScanFiles(rootPath string, typeFile string) (map[string]string, error) {
	fmt.Println("Scanning files in:", rootPath, "of type:", typeFile)
	return ScanFiles.ScanFiles(rootPath, typeFile)
}

func (a * App) FileExists(path string) bool {
	_, err := os.Stat(path)
	result := !os.IsNotExist(err)
	fmt.Println("Checking existence of:", path, "Exists:", result)
	return result
}

func (a *App) Request(request map[string]string) (any) {
	fmt.Println("Action:", request["action"])
	return Request.Request(request)
}