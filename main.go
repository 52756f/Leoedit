package main

import (
	"embed"
	"os"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed build/appicon.png
var icon []byte

//go:embed all:frontend/dist
//go:embed build/*/*
var assets embed.FS

func main() {

	// 🔑 Aktiviere Context-Menü unter Linux
	if runtime.GOOS == "linux" {
		if os.Getenv("WEBKIT_DISABLE_CONTEXT_MENU") == "" {
			os.Setenv("WEBKIT_DISABLE_CONTEXT_MENU", "0")
		}
	}
	// App-Instanz erstellen (aus app.go)
	app := NewApp()

	// App mit Menü und Assets starten
	err := wails.Run(&options.App{
		Title:                    "Leoedit",
		Width:                    1024,
		Height:                   768,
		EnableDefaultContextMenu: true,
		AssetServer: &assetserver.Options{
			Assets: assets, // Haupt-Frontend aus dist
		},
		Linux: &linux.Options{
			Icon:                icon,
			WindowIsTranslucent: false,
			WebviewGpuPolicy:    linux.WebviewGpuPolicyAlways,
			ProgramName:         "Leoedit",
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: false,
		},
		OnStartup:     app.startup,
		OnBeforeClose: app.onWindowClose,
		Bind: []interface{}{
			app,
		},
		Debug: options.Debug{
			OpenInspectorOnStartup: false,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
