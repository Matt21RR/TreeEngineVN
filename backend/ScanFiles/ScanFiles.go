package ScanFiles

import (
	"io/fs"
	"path/filepath"
	"strings"
)

var audioExtensions = map[string]bool{
	".mp3":  true,
	".wav":  true,
	".flac": true,
	".aac":  true,
	".ogg":  true,
	".m4a":  true,
	".wma":  true,
	".aiff": true,
	".ape":  true,
	".opus": true,
}

var imageExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".svg":  true,
}

var scriptExtensions = map[string]bool{
	".txt":  true,
}

func isFromFileType(filename string, typeFile string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch typeFile {
	case "sound":
		return audioExtensions[ext]
	case "texture":
		return imageExtensions[ext]
	case "script":
		return scriptExtensions[ext]
	default:
		return false
	}
}

func ScanFiles(rootPath string, typeFile string) (map[string]string, error) {
	audioMap := make(map[string]string)

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() && isFromFileType(d.Name(), typeFile) {
			relativePath, err := filepath.Rel(rootPath, path)
			if err != nil {
				return err
			}

			relativePath = filepath.ToSlash(relativePath)
			
			// Usar la ruta completa, relativa al rootPath sin extensión como clave
			keyWithoutExt := strings.TrimSuffix(relativePath, filepath.Ext(relativePath))
			// Cambiando las barras diagonales por raya al piso para la clave
			keyWithoutExt = strings.ReplaceAll(keyWithoutExt, "/", "_")
			
			audioMap[keyWithoutExt] = rootPath + "/" + relativePath
		}

		return nil
	})

	return audioMap, err
}
