package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	file,err := os.ReadFile(path)
	if err != nil {
		fmt.Println("Error reading file:", err)
		workingDir, _ := os.Getwd()
		fullPath := filepath.Join(workingDir, path)
		fmt.Println("Trying full path:", fullPath)
		return "",errors.Join(err, errors.New("tried to read file at: "+fullPath))
	}

	formatedData := base64.StdEncoding.EncodeToString(file)

	return (formatedData), nil
}

func (a * App) RequestFileWithMime(path string)(string,error){
	fmt.Println("Leyendo: " + path)
	file,err := os.ReadFile(path)
	if err != nil {
		fmt.Println("Error reading file:", err)
		workingDir, _ := os.Getwd()
		fullPath := filepath.Join(workingDir, path)
		fmt.Println("Trying full path:", fullPath)
		return "", errors.Join(err, errors.New("tried to read file at: "+fullPath))
	}
	//data:<MIME-type>;base64,<data>
	mime := getMime(path)
	formatedData := fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(file))


	return formatedData, nil
}

func writeBase64(data string, filepath string) error {
	fmt.Println("Escribiendo: " + filepath)
	decodedData, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		fmt.Println(data)
		fmt.Println("Error decoding base64 data:", err)
		return err
	}

	err = os.WriteFile(filepath, decodedData, 0644)
	if err != nil {
		return err
	}

	return nil
}

type FileInfo struct {
	Name    string      `json:"name"`
	Type    string      `json:"type"`
	Route   string      `json:"route"`
	Mime    string      `json:"mime,omitempty"`
	Size    int64       `json:"size,omitempty"`
	Content []FileInfo  `json:"content,omitempty"`
	Index   int         `json:"index"`
}

// getMime detects MIME type of a file
func getMime(path string) string {
	file, err := os.Open(path)
	if err != nil {
		fmt.Println("Error opening file for MIME detection:", err, path)
		return "application/octet-stream"
	}
	defer file.Close()

	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		fmt.Println("Error reading file for MIME detection:", err, path)
		return "application/octet-stream"
	}
	contentType := http.DetectContentType(buffer[:n])
	if contentType == "application/octet-stream" {
        // Fall back to extension-based detection if sniffing fails
        ext := filepath.Ext(path)
        if ext != "" {
            if mimeType := mime.TypeByExtension(ext); mimeType != "" {
                return mimeType
            }
        }
    }

	return contentType
}

// getHierarchy recursively builds directory structure
func getHierarchy(dir string) ([]FileInfo, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var result []FileInfo
	var dirs []FileInfo

	for _, entry := range entries {
		fullPath := "./" + filepath.Join(dir, entry.Name())
		frontendPath := strings.ReplaceAll(fullPath, "\\", "/")
		info, err := entry.Info()
		if err != nil {
			continue
		}

		if entry.IsDir() {
			content, _ := getHierarchy(fullPath)
			dirInfo := FileInfo{
				Name:    entry.Name(),
				Type:    "dir",
				Route:   frontendPath,
				Content: content,
			}
			dirs = append(dirs, dirInfo)
		} else {
			mime := "text/plain"
			if info.Size() > 0 {
				mime = getMime(fullPath)
			}
			fileInfo := FileInfo{
				Name:  entry.Name(),
				Type:  "file",
				Mime:  mime,
				Size:  info.Size(),
				Route: frontendPath,
			}
			result = append(result, fileInfo)
		}
	}

	// Add directories at the beginning
	result = append(dirs, result...)

	// Set indices
	for i := range result {
		result[i].Index = i
	}

	return result, nil
}

// createFile creates an empty file
func createFile(dir, filename string) bool {
	path := filepath.Join(dir, filename)
	file, err := os.Create(path)
	if err != nil {
		return false
	}
	file.Close()
	return true
}

// removeAll recursively removes directory
func removeAll(path string) error {
	return os.RemoveAll(path)
}

func (a *App) Request(request map[string]string) (any) {
	// Create game directory if it doesn't exist
	if _, err := os.Stat("./game"); os.IsNotExist(err) {
		os.Mkdir("./game", 0755)
	}

	action := request["action"]
	fmt.Println("Action:", action)

	switch action {
		case "getHierarchy":
			content, err := getHierarchy("./game")
			if err != nil {
				return map[string]any{"error": err.Error()}
			}
			result := FileInfo{
				Name:    "game",
				Type:    "dir",
				Route:   "./game",
				Content: content,
				Index:   0,
			}
			return result

		case "createFile":
			dir := request["dir"]
			filename := request["filename"]

			success := createFile(dir, filename)
			
			return success

		case "createDir":
			dir := request["dir"]
			name := request["folderName"]
			path := "./" + filepath.Join(dir, name)
			err := os.Mkdir(path, 0755)
			
			return err == nil

		case "delete":
			dir := request["dir"]
			fileType := request["type"]

			var err error
			if fileType == "dir" {
				err = removeAll(dir)
			} else if fileType == "file" {
				err = os.Remove(dir)
			}
			return err == nil

		case "rename":
			oldRoute := request["oldRoute"]
			newRoute := request["newRoute"]

			err := os.Rename(oldRoute, newRoute)
			return err == nil

		case "upload":
			targetDir := request["dir"]
			base64File := request["file"]
			filename := request["filename"]
			
			targetPath := ".\\" + filepath.Join(targetDir, filename)
			
			return writeBase64(base64File,targetPath)

		case "update":
			targetRoute := request["route"]
			content := request["content"]
			err := os.WriteFile(targetRoute, []byte(content), 0644)
			return err == nil

		default:
			return (map[string]string{"error": "unknown action"})
	}
}