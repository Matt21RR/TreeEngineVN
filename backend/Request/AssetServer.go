package Request

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"sync"
)

// Servidor local de solo lectura para los assets del juego (./game).
//
// Motivo: los bindings de Wails serializan todo como JSON, asi que un .glb
// binario viaja como base64 (+33% de tamano, picos de memoria y segundos de
// atob+loops en JS para archivos de decenas de MB). Sirviendo ./game por
// HTTP en 127.0.0.1, el frontend usa fetch().arrayBuffer() directo.
//
// Seguridad: escucha solo en loopback, solo GET/HEAD de archivos existentes
// (sin listado de directorios) y bajo un prefijo aleatorio por sesion: CORS
// es abierto (*) porque el frontend corre en otro origen (wails dev server),
// asi que el token evita que otra pagina abierta en el navegador lea ./game
// con solo escanear puertos de loopback.

var (
	assetServerURL  string
	assetServerOnce sync.Once
	assetServerErr  error
)

// noDirFS rechaza directorios: http.FileServer los listaria.
type noDirFS struct{ http.FileSystem }

func (n noDirFS) Open(name string) (http.File, error) {
	f, err := n.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		f.Close()
		return nil, fs.ErrNotExist
	}
	return f, nil
}

func assetMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		switch r.Method {
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
			return
		case http.MethodGet, http.MethodHead:
			next.ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func randomToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// StartGameFileServer arranca (una sola vez) el servidor de ./game y
// devuelve su URL base, p.ej. http://127.0.0.1:54321/<token> (sirve
// /<token>/models/x, /<token>/textures/x, ...). Si falla, devuelve el error
// y el frontend usa la via lenta (base64 por binding).
func StartGameFileServer() (string, error) {
	assetServerOnce.Do(func() {
		token, err := randomToken()
		if err != nil {
			assetServerErr = err
			return
		}
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			assetServerErr = err
			return
		}
		prefix := "/" + token
		mux := http.NewServeMux()
		mux.Handle(prefix+"/", http.StripPrefix(prefix, http.FileServer(noDirFS{http.Dir("./game")})))
		go func() {
			serveErr := http.Serve(ln, assetMiddleware(mux))
			fmt.Fprintln(os.Stderr, "Asset server terminado:", serveErr)
		}()
		assetServerURL = fmt.Sprintf("http://%s%s", ln.Addr().String(), prefix)
		fmt.Println("Sirviendo ./game en:", ln.Addr().String())
	})
	return assetServerURL, assetServerErr
}
