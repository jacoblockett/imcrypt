package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Imcrypt",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown: func(ctx context.Context) {
			app.shutdown()
		},
		Bind: []interface{}{
			app,
		},
		// File dropping is deferred until migration to Wails v3.
		// Wails v2's WebView drop-disabling API breaks file callbacks:
		// https://github.com/wailsapp/wails/issues/3563
		// https://github.com/wailsapp/wails/issues/3782
		// Previous configuration:
		// DragAndDrop: &options.DragAndDrop{
		//     EnableFileDrop:     true,
		//     DisableWebViewDrop: false,
		// },
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     false,
			DisableWebViewDrop: true,
		},
		LogLevel: logger.ERROR,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
