# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
wails dev              # Live development with hot reload (main development mode)
wails build            # Production build (outputs to ./build/bin/)
npm run build          # Frontend build only (auto-increments version)
```

For browser-based frontend debugging during `wails dev`, connect to http://localhost:34115 to access Go methods from devtools.

## Architecture Overview

Leoedit is a German-language desktop text editor built with:
- **Backend**: Go 1.23 with Wails v2.11.0 (desktop framework)
- **Frontend**: Vanilla JavaScript with Vite bundler

### Backend (Go)

`app.go` contains the main `App` struct handling:
- File operations (Load, Save, SaveUnder, ReadFile, ListDir)
- Recent files and config persistence (JSON in user home directory)
- OpenRouter AI streaming integration (`QueryOpenRouter`)
- Native file dialogs via Wails runtime
- Window lifecycle and unsaved changes tracking

`main.go` is the entry point initializing Wails with embedded assets.

### Frontend (JavaScript)

Key modules in `frontend/src/`:
- `state.js` - Centralized AppState class (prevents circular dependencies)
- `editor.js` - CodeMirror 6 editor instantiation and language support
- `tabManager.js` - Multi-tab editing with split pane support
- `clsFileExplorer.js` - Directory tree UI
- `clsOutliner.js` - Document outline/structure view
- `aipanel.js` - AI chat panel (OpenRouter streaming)
- `fileOperations.js` - Wrappers for Go file I/O calls
- `constants.js` - App configuration and settings

### Frontend-Backend Communication

Go methods are exposed to JavaScript via Wails auto-generated bindings in `frontend/wailsjs/go/main/App.js`. Events use `runtime.EventsEmit()` / `runtime.EventsOn()`.

## Code Conventions

- Go code uses method receivers on `*App` pointer
- Frontend uses ES6 modules with class-based architecture
- Comments and UI text are in German
- Lucide icons via `data-lucide` attributes
- Version in `frontend/src/version.json` auto-increments on build
