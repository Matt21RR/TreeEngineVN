# Changelog: Wails 2 → Wails 3 (TreeEngineVN)

> Documento de referencia para migrar TreeEngineVN de `github.com/wailsapp/wails/v2 v2.11.0`
> a Wails v3. **No describe cambios ya aplicados**: es la guía de lo que hay que cambiar.
>
> Fuentes consultadas (2026-11-02, rama `master` del repo `wailsapp/wails`):
>
> - Guía oficial de migración: `docs/mpress/content/migration/v2-to-v3.md`
> - Bindings: `docs/mpress/content/features/bindings/methods.md` y `services.md`
> - Código fuente: `v3/pkg/application/{application_options,services,webview_window_options,window_manager,window}.go`
> - Plantilla: `v3/internal/templates/_common/main.go.tmpl`
> - Última versión estable: **v3.1.0** (publicada 2026-11-01). Hay nightlies `v3.2.0-nightly.*`.
>
> Los puntos marcados con **⚠ verificar** no se pudieron confirmar en la documentación.

---

## 1. Resumen de cambios conceptuales

| Wails 2 | Wails 3 |
|---|---|
| `wails.Run(&options.App{...})` crea app **y** ventana en una sola llamada | `application.New(...)` crea la app; las ventanas se crean aparte con `app.Window.NewWithOptions(...)`; luego `app.Run()` |
| Una sola ventana | Múltiples ventanas, system tray, menús por app |
| `Bind: []interface{}{app}` | `Services: []application.Service{application.NewService(app)}` |
| `OnStartup(ctx)` + guardar `ctx` para usar `runtime.*` | `ServiceStartup(ctx, options) error` (opcional); el runtime se usa a través de `*application.App` (`app.Window`, `app.Event`, `app.Dialog`, `app.Logger`) |
| Paquete `github.com/wailsapp/wails/v2/pkg/runtime` con funciones `runtime.X(ctx, ...)` | Métodos sobre objetos: `app.Window.Current().SetTitle(...)`, `app.Event.Emit(...)` |
| Bindings en `frontend/wailsjs/go/main/App.js` | Bindings en `frontend/bindings/<ruta-import-go>/<servicio>.js` generados con `wails3 generate bindings` |
| Runtime JS en `frontend/wailsjs/runtime` | Paquete npm `@wailsio/runtime` |
| CLI `wails` | CLI `wails3` |

---

## 2. Features nuevas de Wails 3

Fuente principal: `docs/mpress/content/whats-new.md` y las páginas de `features/*`.
La columna "Uso en TreeEngineVN" es una sugerencia; nada de esto es obligatorio para migrar.

### 2.1 Ventanas

| Feature | Qué ofrece | API principal | Uso en TreeEngineVN |
|---|---|---|---|
| **Múltiples ventanas** | Crear/cerrar ventanas independientes en runtime (v2 solo tenía una) | `app.Window.NewWithOptions(...)`, `New()`, `GetAll()`, `GetByName(name)`, `Current()`, `OnCreate(fn)`, `window.Close()`; modal hija `parent.AttachModal(child)` (solo macOS) | Separar el editor (`EngineTools`, explorador, texturas/modelos) de la ventana de preview del juego |
| **Ventanas sin marco** | Quitar la barra nativa y dibujar la propia | `WebviewWindowOptions{Frameless: true}`; CSS `--wails-draggable: drag`, `--wails-resize`, `--wails-non-client-region` (Windows); JS `Window.Minimise()/Maximise()/Close()` de `@wailsio/runtime` | Modo "juego" sin bordes / launcher personalizado |
| **Permisos por ventana** | Política declarativa de cámara, micrófono, geolocalización, notificaciones y lectura de portapapeles | `WebviewWindowOptions.Permissions` con `PermissionCamera`, `PermissionMicrophone`, ... y `PermissionAllow/Deny/Default` | Bloquear permisos innecesarios en la ventana del juego |
| **Hooks cancelables** | Interceptar eventos de ventana de forma síncrona y cancelarlos | `win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent){ e.Cancel() })` (vs. `OnWindowEvent`, no cancelable) | Preguntar "¿guardar cambios?" antes de cerrar el editor |
| **Pantallas** | Info de monitores, DPI y área de trabajo | `app.Screen.GetAll()`, `GetPrimary()`, `window.GetScreen()`; `Screen{ScaleFactor, Bounds, WorkArea, ...}` | Ajustar `RenderingDimentions` al DPI / monitor real |

### 2.2 Integración con el sistema operativo

| Feature | Qué ofrece | API principal | Uso en TreeEngineVN |
|---|---|---|---|
| **System tray** | Icono en la bandeja con menú, ventana adjunta y eventos de clic | `app.SystemTray.New()`, `SetIcon`, `SetLabel`, `SetTooltip`, `SetMenu`, `AttachWindow`, `OnClick`; ventana con `HideOnFocusLost`, `HideOnEscape` | Poco relevante |
| **Menús** | Menú de aplicación y contextual con API fluida | `app.NewMenu()`, `menu.Add(label).OnClick(...)`, `AddSubmenu`, `AddCheckbox`, `AddRole(application.AppMenu)`, `app.Menu.Set(menu)` | Menú Archivo/Proyecto nativo para el editor |
| **Diálogos** | Mensajes y selección de archivos con builder | `app.Dialog.Info()/Question()/Warning()/Error()/OpenFile()/SaveFile()`; `SetTitle`, `AddFilter`, `CanChooseDirectories`, `PromptForSingleSelection()` | Elegir carpeta de proyecto / importar assets en vez de rutas escritas a mano |
| **Atajos globales** | Hotkeys del sistema aunque la app no tenga foco | `app.GlobalShortcut.Register("CmdOrCtrl+Shift+G", fn)`, `Unregister`, `UnregisterAll` | Opcional |
| **Key bindings** | Atajos a nivel de app o ventana | `Options.KeyBindings` / `WebviewWindowOptions.KeyBindings` (`map[string]func(window Window)`) | `F11` → fullscreen sin pasar por el frontend |
| **Drag & drop de archivos del SO** | Recibir archivos soltados desde el explorador | `WebviewWindowOptions.EnableFileDrop` + elementos `data-file-drop-target` (evento `FilesDropped`) | Importar imágenes, audio y modelos `.glb` arrastrándolos al editor |
| **Portapapeles** | Leer/escribir texto | `app.Clipboard.SetText(s)`, `app.Clipboard.Text()` | Copiar rutas o fragmentos de script |
| **Navegador** | Abrir URLs/archivos con la app por defecto | `app.Browser.OpenURL(url)`, `app.Browser.OpenFile(path)` | Abrir documentación |
| **Entorno** | SO, arquitectura, modo debug, tema oscuro, gestor de archivos | `app.Env.Info()`, `app.Env.IsDarkMode()`, `app.Env.OpenFileManager(path, selectFile)` | **Reemplaza a `OpenFileExplorer`** (hoy implementado a mano con `exec.Command`) |
| **Notificaciones** | Notificaciones nativas con acciones, respuesta, sonido, programación | Servicio `notifications.New()` (`pkg/services/notifications`): `SendNotification(...)`, `OnNotificationResponse(...)` | Avisar fin de exportación/compilación |
| **Dock / barra de tareas** | Badges en el icono (macOS dock, overlay en barra de tareas de Windows) | Servicio `dock.New()` (`pkg/services/dock`): `SetBadge`, `RemoveBadge` | Poco relevante |
| **Autoarranque** | Iniciar con la sesión | `app.Autostart.Enable()`, `Disable()`, `IsEnabled()` | No aplica |
| **Asociación de archivos** | Abrir la app al hacer doble clic en una extensión | `Options.FileAssociations []string` (p. ej. una extensión propia del proyecto, `[".ext"]`) | Abrir proyectos/scripts del engine desde el explorador |
| **Instancia única** | Evitar varias instancias de la app | `Options.SingleInstance *SingleInstanceOptions` (⚠ verificar campos) | Evitar dos editores sobre el mismo proyecto |

### 2.3 Arquitectura y herramientas

| Feature | Qué ofrece | API principal | Uso en TreeEngineVN |
|---|---|---|---|
| **Services con ciclo de vida** | Structs registrados con arranque/apagado ordenado | `ServiceStartup(ctx, opts) error`, `ServiceShutdown() error`; `app.RegisterService(...)` para registro tardío | Separar `ScanFiles`, `Request`, etc. en servicios propios |
| **Rutas HTTP por servicio** | Un servicio que implementa `http.Handler` se monta en el asset server | `application.NewServiceWithOptions(svc, application.ServiceOptions{Route: "/game"})` → `http://wails.localhost/game` | **Podría reemplazar `StartGameFileServer`** (servidor aparte para `.glb`) y el middleware `/game/` |
| **Bindings mejorados** | Análisis estático que conserva comentarios y nombres de parámetros; salida TS opcional | `wails3 generate bindings -ts`; regeneración automática en `wails3 dev` | Tipos TS reales en lugar de `App.d.ts` genérico |
| **Eventos mejorados** | Bus de eventos Go ↔ JS con eventos de app/ventana tipados | Go `app.Event.On/Emit`, `app.Event.OnApplicationEvent(events.Common.ApplicationStarted, ...)`; JS `Events.On/Emit` | Notificar al frontend cambios en `./game` |
| **Build integrado** | Herramientas de iconos/manifest dentro del CLI; Taskfiles por plataforma personalizables (`build/Taskfile.<plataforma>.yml`) | `wails3 build` | Ver §7 |
| **Modo servidor** | Ejecutar la app sin ventana nativa, como servidor web | Compilar con `-tags server`; `Options.Server{Host, Port, TLS, ...}` | Versión web del player sin cambiar el backend |
| **Transporte IPC propio** | Reemplazar el transporte por defecto (fetch a `/wails/runtime`) | `Options.Transport` | No aplica |
| **WML (experimental)** | Llamar al runtime desde atributos HTML | `wml-event`, `wml-window="Fullscreen"`, `wml-confirm` | No recomendado (experimental) |
| **Móvil (experimental)** | Android e iOS | — | No aplica |

---

## 3. Dependencias y herramientas

**Go**: el módulo v3 declara `go 1.26.0` (toolchain `go1.26.10`). El proyecto hoy declara
`go 1.24.0` en `go.mod` → hay que subir la versión de Go.

**go.mod**:

```diff
- require github.com/wailsapp/wails/v2 v2.11.0
+ require github.com/wailsapp/wails/v3 v3.1.0
```

Luego `go mod tidy` (eliminará `labstack/echo`, `leaanthony/*`, etc. si ya no se usan).
Borrar también la línea comentada `// replace github.com/wailsapp/wails/v2 ...`.

**CLI** (fijar versión exacta, como recomiendan las release notes):

```sh
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.1.0
wails3 doctor
```

**Comandos equivalentes**:

| v2 | v3 |
|---|---|
| `wails dev` | `wails3 dev` (regenera bindings al cambiar Go) |
| `wails build` | `wails3 build` (salida en `build/`) |
| `wails generate module` | `wails3 generate bindings` (`-ts` para TypeScript, `-d <dir>` para otra carpeta) |

---

## 4. `main.go`

### Equivalencia de opciones

| v2 (`options.App`) | v3 |
|---|---|
| `Title: "TreeEngineVN"` | `Name` en `application.Options` + `Title` en `WebviewWindowOptions` |
| `Width: 800`, `Height: 600` | `WebviewWindowOptions{Width, Height}` |
| `BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1}` | `WebviewWindowOptions{BackgroundColour: application.NewRGBA(27, 38, 54, 1)}` (tipo `application.RGBA{Red, Green, Blue, Alpha uint8}`; ojo: `A: 1` era casi transparente, quizá se quería `application.NewRGB(27, 38, 54)`) |
| `OnStartup: app.startup` | Método `ServiceStartup` en el servicio (ver §5) |
| `Bind: []interface{}{app}` | `Services: []application.Service{application.NewService(app)}` |
| `AssetServer: &assetserver.Options{Assets: assets, Middleware: fileServerMiddleware}` | `Assets: application.AssetOptions{Handler: application.AssetFileServerFS(assets), Middleware: fileServerMiddleware}` |

`application.Middleware` es `func(next http.Handler) http.Handler`, **la misma firma** que
`fileServerMiddleware`, así que el middleware que sirve `/game/` (`serveGameFile`,
`getContentType`) se conserva sin cambios. Si se necesitan varios: `application.ChainMiddleware(...)`.

### Antes (v2)

```go
import (
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

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
```

### Después (v3)

```go
import (
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func main() {
	appService := NewApp()

	app := application.New(application.Options{
		Name: "TreeEngineVN",
		Services: []application.Service{
			application.NewService(appService),
		},
		Assets: application.AssetOptions{
			Handler:    application.AssetFileServerFS(assets),
			Middleware: fileServerMiddleware,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	appService.window = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "TreeEngineVN",
		Width:            800,
		Height:           600,
		URL:              "/",
		BackgroundColour: application.NewRGBA(27, 38, 54, 1),
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

- `//go:embed all:frontend/dist` se mantiene igual.
- `createAssetServer()` desaparece (o se adapta a devolver `application.AssetOptions`).

---

## 5. `app.go`

### Ciclo de vida

| v2 | v3 |
|---|---|
| `func (a *App) startup(ctx context.Context) { a.ctx = ctx }` | Opcional: `func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error` |
| — | Opcional: `func (a *App) ServiceShutdown() error` (se ejecuta en orden inverso al registro) |
| Campo `ctx context.Context` para llamar a `runtime.*` | Ya no hace falta; guardar `*application.App` o la ventana |

### `ToggleFullscreen`

v3 ya trae `ToggleFullscreen()` en la interfaz `Window` (además de `IsFullscreen()`,
`Fullscreen()`, `UnFullscreen()`).

Antes:
```go
import "github.com/wailsapp/wails/v2/pkg/runtime"

func (a *App) ToggleFullscreen() {
	if runtime.WindowIsFullscreen(a.ctx) {
		runtime.WindowUnfullscreen(a.ctx)
		return
	} else {
		runtime.WindowFullscreen(a.ctx)
		return
	}
}
```

Después (guardando la ventana creada en `main.go`):
```go
import "github.com/wailsapp/wails/v3/pkg/application"

type App struct {
	window *application.WebviewWindow
}

func (a *App) ToggleFullscreen() {
	if a.window != nil {
		a.window.ToggleFullscreen()
	}
}
```

Alternativa sin guardar la ventana: `application.Get().Window.Current()` — **puede devolver
`nil`** si ninguna ventana tiene el foco, por eso se recomienda guardar la referencia.

### Métodos vinculados sin cambios

`RequestFile`, `RequestFileWithMime`, `GetAssetBaseURL`, `ScanFiles`, `FileExists`, `Request`,
`OpenFileExplorer` no usan el runtime de Wails y siguen igual. El alias `osRuntime "runtime"`
puede volver a llamarse `runtime` al eliminar el import de Wails.

`backend/Request` (incluido `StartGameFileServer`) es independiente de Wails: sin cambios.

---

## 6. Frontend: bindings

### Generación

```sh
wails3 generate bindings        # JS + JSDoc, salida en frontend/bindings
wails3 generate bindings -ts    # TypeScript (recomendado: el frontend es TS)
```

Estructura generada: `frontend/bindings/<ruta-import-go>/<servicio>.js` + `index.js`.
Para el struct `App` del paquete `main` del módulo `TreeEngineVN` la ruta esperada es
`frontend/bindings/TreeEngineVN/app.(js|ts)` — **⚠ verificar** tras la primera generación
(la doc solo muestra el ejemplo `bindings/changeme/greetservice`).

Cada método es un **export con nombre** (`export function RequestFile(...)`), así que los
imports con llaves siguen funcionando; también existe `index.js` con
`export * as App from './app.js'`.

### Archivos a actualizar

Todos importan hoy desde `wailsjs/go/main/App.js`; solo hay que cambiar la ruta (los nombres
de las funciones se mantienen):

| Archivo | Import actual | Import nuevo (⚠ ruta a confirmar) |
|---|---|---|
| `src/engine/interpretators/ChaosInterpreter.ts` | `../../../wailsjs/go/main/App.js` | `../../../bindings/TreeEngineVN/app.js` |
| `src/engine/renderCore/RenderEngine.tsx` | `../../../wailsjs/go/main/App.js` | `../../../bindings/TreeEngineVN/app.js` |
| `src/engine/renderCore/ResourceLoader.ts` (estático **y** `import()` dinámico l.164) | `../../../wailsjs/go/main/App.js` | `../../../bindings/TreeEngineVN/app.js` |
| `src/tools/EngineTools.tsx` | `../../wailsjs/go/main/App.js` | `../../bindings/TreeEngineVN/app.js` |
| `src/tools/FileExplorer.tsx` | `../../wailsjs/go/main/App.js` | `../../bindings/TreeEngineVN/app.js` |
| `src/tools/Guide.tsx` | `../../wailsjs/go/main/App.js` | `../../bindings/TreeEngineVN/app.js` |
| `src/tools/ModelsE.tsx` | `../../wailsjs/go/main/App.js` | `../../bindings/TreeEngineVN/app.js` |
| `src/tools/Multimedia.tsx` | `../../wailsjs/go/main/App.js` | `../../bindings/TreeEngineVN/app.js` |
| `src/tools/TexturesE.tsx` | `../../wailsjs/go/main/App.js` | `../../bindings/TreeEngineVN/app.js` |
| `src/dev/modelSpikeMain.ts` (`import()` dinámico l.237) | `../../wailsjs/go/main/App.js` | `../../bindings/TreeEngineVN/app.js` |

Sugerencia: en vez de repetir la ruta relativa en 10 archivos, crear un alias de Vite/TS
(p. ej. `@bindings`) o un módulo puente `src/backend.ts` que reexporte los bindings.

El proyecto **no usa** `wailsjs/runtime` (eventos, ventana, etc.) desde el frontend, así que
`@wailsio/runtime` solo hace falta si en el futuro se usan `Events`, `Call.RuntimeError`, etc.
(los bindings generados importan su runtime desde `/wails/runtime.js`).
Al terminar, borrar `frontend/wailsjs/`.

### Tipos

| Go | TS generado (v3) |
|---|---|
| `map[string]string` (`ScanFiles`) | `{ [_: string]: string }` |
| `map[string]string` como parámetro (`Request`) | `{ [_: string]: string }` |
| `any` (retorno de `Request`) | `any` |
| `(string, error)` | `Promise<string>`; el error rechaza la promesa (`Call.RuntimeError`) |
| `bool` (`FileExists`) | `Promise<boolean>` |

Los retornos ya eran promesas en v2, así que el código que hace `await`/`.then` no cambia.

---

## 7. Configuración y build

### `wails.json`

Según la guía oficial, v3 mantiene `wails.json` pero agrupa las claves del frontend:

```diff
 {
-  "$schema": "https://wails.io/schemas/config.v2.json",
   "name": "TreeEngineVN",
   "outputfilename": "TreeEngineVN",
-  "frontend:install": "npm install",
-  "frontend:build": "npm run build",
-  "frontend:dev:watcher": "npm run dev",
-  "frontend:dev:serverUrl": "auto",
+  "frontend": {
+    "dir": "./frontend",
+    "install": "npm install",
+    "build": "npm run build",
+    "dev": "npm run dev",
+    "devServerUrl": "http://localhost:5173"
+  },
   "author": { "name": "Matt21RR", "email": "portal2matr@gmail.com" }
 }
```

`"auto"` ya no aparece en el ejemplo: hay que fijar la URL del dev server de Vite
(5173 por defecto; ajustar si `vite.config` usa otro puerto).

### Carpeta `build/`

- `build/windows/` (icon.ico, info.json, installer NSIS, `wails.exe.manifest`) y
  `build/darwin/` (Info.plist, Info.dev.plist) son formato v2. **⚠ verificar** el formato v3:
  lo más seguro es generar un proyecto vacío con `wails3 init -n tmp -t react-ts` en otra
  carpeta, comparar su `build/` (y si trae `Taskfile.yml`) y copiar `appicon.png`/`icon.ico`
  y los metadatos del proyecto.
- `build/bin/` (salida) puede limpiarse.

---

## 8. Riesgos y puntos a validar

- **Go 1.26** obligatorio para v3.1.0.
- **API cambiante**: v3 tuvo muchas alphas con nombres distintos (p. ej. el antiguo
  `app.NewWebviewWindowWithOptions` ya no existe; ahora es `app.Window.NewWithOptions`).
  Fijar la versión exacta en `go.mod` y en `go install`.
- **Middleware `/game/`**: misma firma, pero confirmar que el `Handler` de v3 no sirve antes
  rutas que el middleware debía interceptar (probar carga de imágenes de `./game`).
- **WebGPU / WebView2**: ambas versiones usan WebView2 en Windows; no se esperan cambios,
  pero probar el renderer WebGPU tras migrar.
- **Ruta de bindings** y **formato de `build/`**: confirmar tras generar (ver ⚠ arriba).
- **Móvil**: Android/iOS siguen siendo experimentales (no aplica a este proyecto).

---

## 9. Checklist de migración

- [ ] Instalar Go ≥ 1.26 y `wails3@v3.1.0`; ejecutar `wails3 doctor`.
- [ ] `go.mod`: cambiar a `github.com/wailsapp/wails/v3 v3.1.0`, `go 1.26`, quitar `replace` comentado.
- [ ] `main.go`: `application.New` + `Services` + `AssetOptions` (conservar `fileServerMiddleware`) + `app.Window.NewWithOptions` + `app.Run()`.
- [ ] `app.go`: quitar `ctx`/`startup` y el import `v2/pkg/runtime`; guardar `*application.WebviewWindow`; reescribir `ToggleFullscreen`.
- [ ] `go mod tidy` y `go build ./...`.
- [ ] `wails3 generate bindings -ts`; confirmar la carpeta generada.
- [ ] Actualizar los 10 imports del frontend (incluidos los 2 `import()` dinámicos); borrar `frontend/wailsjs/`.
- [ ] Actualizar `wails.json` al bloque `"frontend"`.
- [ ] Regenerar/adaptar `build/` (iconos, manifest, instalador, plist).
- [ ] Probar con `wails3 dev`: carga de scripts (`RequestFile`), `ScanFiles`, `FileExists`, `OpenFileExplorer`, fullscreen, assets de `/game/`, servidor de modelos (`GetAssetBaseURL`), render WebGPU.
- [ ] `wails3 build` y probar el ejecutable final.
