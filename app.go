package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx               context.Context
	openedFilePath    string
	currentTitle      string
	hasUnsavedChanges bool
	unsavedFiles      []string
	configPath        string
	Config            AppConfig
	isClosing         bool // Neue Variable, um Schließvorgang zu verfolgen
}

// AppConfig holds persisted data
type AppConfig struct {
	RecentFiles    []string `json:"recent_files"`
	LastDirectory  string   `json:"last_directory"`
	MaxRecentFiles int      `json:"max_recent_files"`
}

// Result struct for file operations (JSON-tagged for JS)
type FileResult struct {
	Content  string `json:"content"`
	Filename string `json:"filename"`
	Error    string `json:"error"` // Empty on success
}

// NewApp creates a new App application struct
func NewApp() *App {
	app := &App{}
	app.openedFilePath = ""      // Initialize it as empty
	app.currentTitle = "Leoedit" // Default title
	app.configPath = app.getConfigPath()
	app.Config.MaxRecentFiles = 10
	app.loadConfig()
	app.isClosing = false // Initialisieren
	return app
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.currentTitle = "Leoedit"
	a.unsavedFiles = []string{}

	// Check for command-line args on startup (Windows/Linux)
	args := os.Args[1:]
	if len(args) > 0 {
		p := args[0]
		// Verify the path exists and is a file before setting it
		if info, err := os.Stat(p); err == nil {
			if !info.IsDir() {
				a.openedFilePath = p
				a.currentTitle = a.openedFilePath
				fmt.Println("Opened file via args:", a.openedFilePath)
				a.SetAppTitle(filepath.Base(a.openedFilePath))
			} else {
				fmt.Println("Argument is a directory, not a file:", p)
				runtime.EventsEmit(a.ctx, "error", fmt.Sprintf("Argument ist ein Verzeichnis: %s", p))
			}
		} else if os.IsNotExist(err) {
			fmt.Println("File does not exist:", p)
			runtime.EventsEmit(a.ctx, "error", fmt.Sprintf("Datei existiert nicht: %s", p))
		} else {
			fmt.Println("Error checking path:", p, "err:", err)
			runtime.EventsEmit(a.ctx, "error", fmt.Sprintf("Fehler beim Prüfen des Pfads: %s (%v)", p, err))
		}
	}

	// in startup or somewhere during initialization
	runtime.EventsOn(ctx, "title-changed", func(args ...any) {
		//fmt.Println("title-changed")
		if len(args) > 0 {
			if s, ok := args[0].(string); ok {
				// save it or act on it
				a.currentTitle = s
				// if you want the OS window title synced from Go too:
				runtime.WindowSetTitle(a.ctx, s)
			}
		}
	})

	// Höre auf das close-action-Event aus JS
	runtime.EventsOn(ctx, "close-action", func(payload ...interface{}) {
		if len(payload) == 0 {
			return
		}
		action, ok := payload[0].(string)
		if !ok {
			return
		}

		switch action {
		case "save":
			// Optional: Trigger save logic hier
			fmt.Println("User chose to save")
			// a.SaveAllFiles() // z. B. deine Speicherlogik
			fallthrough // danach trotzdem schließen
		case "dont-save":
			fmt.Println("Closing without saving")
			a.isClosing = true // Setze das Schließen-Flag
			go a.RequestClose()
		case "cancel":
			fmt.Println("Close canceled")
			a.isClosing = false // Setze das Flag zurück
			// Nichts tun – Fenster bleibt offen
		}
	})
}

// Wenn false zurückgegeben wird, wird das Fenster geschlossen
// Wenn true zurückgegeben wird, wird das Fenster nicht geschlossen auch nicht vom System
func (a *App) onWindowClose(ctx context.Context) (prevent bool) {
	fmt.Println("onWindowClose called")

	// Wenn bereits im Schließprozess, lasse das Fenster schließen
	if a.isClosing {
		fmt.Println("Already in closing process, allowing close")
		return false
	}

	// Prüfe auf ungespeicherte Änderungen
	if a.HasUnsavedChanges() {
		fmt.Println("Has unsaved changes, showing modal")
		// Sende Event an Frontend, um das Modal anzuzeigen
		runtime.EventsEmit(a.ctx, "show-unsaved-modal")
		// Verhindere das Schließen, bis der Benutzer entschieden hat
		return true
	}

	fmt.Println("No unsaved changes, allowing close")
	return false
}

func (a *App) RequestClose() {
	// Diese Methode wird von JS aufgerufen, nachdem der Benutzer entschieden hat
	fmt.Println("RequestClose called")

	// Warte kurz, damit das Modal verschwinden kann
	time.Sleep(100 * time.Millisecond)

	// Jetzt die App schließen
	if a.ctx != nil {
		fmt.Println("Quitting app")
		runtime.Quit(a.ctx)
	}
}

func (a *App) HasUnsavedChanges() bool {
	return len(a.unsavedFiles) > 0
}

// Rest der Methoden bleibt unverändert...

func (a *App) fileExists(path string) (bool, error) {
	info, err := os.Stat(path)
	if err == nil {
		return !info.IsDir(), nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (a *App) SaveFile(content string, default_filename string, directsave bool) bool {
	if default_filename == "" {
		return false
	}
	if directsave {
		if err := os.WriteFile(default_filename, []byte(content), 0644); err != nil {
			return false
		}
		a.SetAppTitle(default_filename)
		a.MarkFileAsSaved(default_filename) // Wichtig: Als gespeichert markieren
		return true
	}
	filename, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Datei speichern",
		ShowHiddenFiles: false,
		Filters: []runtime.FileFilter{
			{DisplayName: "Textdateien", Pattern: "*.txt;*.md;*.*"},
		},
		DefaultFilename: default_filename,
	})
	if err != nil {
		return false
	}
	if filename == "" {
		return false
	}
	if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
		return false
	}
	a.SetAppTitle(filename)
	a.MarkFileAsSaved(filename) // Wichtig: Als gespeichert markieren
	return true
}

func (a *App) SaveFileUnder(content string, oldfname string) string {
	filename, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Datei speichern",
		ShowHiddenFiles: false,
		Filters: []runtime.FileFilter{
			{DisplayName: "Textdateien", Pattern: "*.txt;*.md;*.*"},
		},
		DefaultFilename: "",
	})
	if err != nil {
		return fmt.Sprintf("Fehler beim Speichern-Dialog: %v", err)
	}
	if filename == "" {
		return "Fehler: Abgebrochen"
	}
	if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
		return fmt.Sprintf("Fehler beim Speichern: %v", err)
	}
	a.SetAppTitle(filepath.Base(filename))
	a.MarkFileAsSaved(oldfname)
	a.MarkFileAsSaved(filename)
	return filename
}

// Öffnet einen nativen Datei-Dialog und gibt den Dateiinhalt sowie den Dateinamen zurück
func (a *App) LoadFile() FileResult {
	filename, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Datei öffnen",
		Filters: []runtime.FileFilter{
			{DisplayName: "Textdateien", Pattern: "*.txt;*.md;*.log;*.*"},
		},
		CanCreateDirectories: true,
		ShowHiddenFiles:      false,
	})
	if err != nil {
		return FileResult{Error: fmt.Sprintf("Fehler beim Öffnen des Dialogs: %v", err)}
	}
	if filename == "" {
		// Nutzer hat abgebrochen
		return FileResult{Error: "Fehler: Abgebrochen"}
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return FileResult{Error: fmt.Sprintf("Fehler beim Lesen: %v", err)}
	}
	a.SetAppTitle(filepath.Base(filename))
	return FileResult{
		Content:  string(data),
		Filename: filename,
	}
}

// ReadFile reads content from a known path (e.g., for auto-open)
func (a *App) ReadFile(path string) string {
	exists, err := a.fileExists(path)
	if err != nil {
		runtime.EventsEmit(a.ctx, "error", fmt.Sprintf("Fehler beim Prüfen des Pfads: %v", err))
		return ""
	}
	if !exists {
		runtime.EventsEmit(a.ctx, "error", fmt.Sprintf("Datei existiert nicht oder ist ein Verzeichnis: %s", path))
		return ""
	}

	content, err := os.ReadFile(path)
	if err != nil {
		runtime.EventsEmit(a.ctx, "error", fmt.Sprintf("Fehler beim Lesen: %v", err))
		return ""
	}
	runtime.EventsEmit(a.ctx, "file-read", path)
	a.SetAppTitle(filepath.Base(path))
	return string(content)
}

func (a *App) GetOpenedFilePath() string {
	if a.openedFilePath == "" {
		return ""
	}
	return a.openedFilePath
}

// GetAppTitle returns the current window title
func (a *App) GetAppTitle() string {
	return a.currentTitle
}

// SetAppTitle sets the window title and stores it internally
func (a *App) SetAppTitle(title string) {
	fullTitle := "Leoedit | " + title
	a.currentTitle = fullTitle
	runtime.WindowSetTitle(a.ctx, fullTitle)
}

// Export functions to JavaScript
func (a *App) UndoAction() {
	fmt.Println("Undo action triggered from frontend")
}

func (a *App) RedoAction() {
	fmt.Println("Redo action triggered from frontend")
}

func (a *App) CutAction() {
	fmt.Println("Cut action triggered from frontend")
}

func (a *App) CopyAction() {
	fmt.Println("Copy action triggered from frontend")
}

func (a *App) PasteAction() {
	fmt.Println("Paste action triggered from frontend")
}

// HandleFileDrop processes dropped files (called by Wails runtime)
func (a *App) HandleFileDrop(posX, posY int, files []string) {
	fmt.Printf("Files dropped: %v\n", files)
	runtime.EventsEmit(a.ctx, "file-drop", map[string]interface{}{
		"x":     posX,
		"y":     posY,
		"files": files,
	})
}

// ProxyURL fetches a URL and modifies it for iframe embedding.
func (a *App) ProxyURL(targetURL string) (string, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Get(targetURL)
	if err != nil {
		return "", fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP request failed with status: %s", resp.Status)
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(contentType, "text/html") {
		return "", fmt.Errorf("expected HTML response but got: %s", contentType)
	}

	resp.Header.Del("X-Frame-Options")
	resp.Header.Del("Content-Security-Policy")
	resp.Header.Del("Content-Security-Policy-Report-Only")
	resp.Header.Set("Content-Security-Policy", "frame-ancestors *;")
	resp.Header.Set("Access-Control-Allow-Origin", "wails://wails.localhost")
	resp.Header.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	resp.Header.Set("Access-Control-Allow-Headers", "Content-Type")
	resp.Header.Set("Access-Control-Allow-Credentials", "true")

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

type OpenRouterRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenRouterResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (a *App) QueryOpenRouter(model, prompt string) error {
	apiKey := os.Getenv("OPENROUTER_API_KEY")

	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"stream": true,
	}

	log.Printf("🚀 OpenRouter Request: %s", prompt)

	jsonBody, _ := json.Marshal(reqBody)

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	client := &http.Client{Timeout: 300 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   10,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 60 * time.Second,
		}}
	httpReq, _ := http.NewRequestWithContext(ctx, "POST",
		"https://openrouter.ai/api/v1/chat/completions",
		bytes.NewBuffer(jsonBody))

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("HTTP-Referer", "http://localhost")
	httpReq.Header.Set("X-Title", "LeoeditApp")

	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("Request fehlgeschlagen: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API-Fehler (%d): %s", resp.StatusCode, string(body))
	}

	log.Println("📡 Streaming gestartet...")

	reader := bufio.NewReader(resp.Body)
	fullResponse := ""
	tokenCount := 0

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				log.Println("✅ Streaming beendet (EOF)")
				break
			}
			return fmt.Errorf("Lesefehler: %w", err)
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if after, ok := strings.CutPrefix(line, "data:"); ok {
			data := strings.TrimSpace(after)

			if data == "[DONE]" {
				log.Printf("✅ Streaming komplett - %d Token empfangen", tokenCount)
				log.Printf("📝 Vollständige Antwort: %s", fullResponse)

				if a.ctx != nil {
					runtime.EventsEmit(a.ctx, "stream_complete", map[string]interface{}{
						"full_response": fullResponse,
						"token_count":   tokenCount,
					})
				}
				break
			}

			var chunk struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
				Error *struct {
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}

			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				log.Printf("⚠️ JSON Parse Fehler: %v - Daten: %s", err, data)
				continue
			}

			if chunk.Error != nil {
				log.Printf("❌ Fehler im Stream: %s", chunk.Error.Message)
				continue
			}

			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				token := chunk.Choices[0].Delta.Content
				tokenCount++
				fullResponse += token

				if a.ctx != nil {
					runtime.EventsEmit(a.ctx, "stream_token", map[string]interface{}{
						"token": token,
						"count": tokenCount,
					})
				}
			}
		}
	}

	log.Println("✅ QueryOpenRouter erfolgreich abgeschlossen")
	return nil
}

// Methode zum Laden von HTML aus Datei
func (a *App) LoadHTMLFile(filepath string) (string, error) {
	content, err := os.ReadFile(filepath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// The GetStaticHTML method remains unchanged
func (a *App) GetStaticHTML() string {
	return `<div class="example">
        <h1>Beispiel HTML</h1>
        <p>Dies ist statisches HTML</p>
    </div>`
}

// PingFunction is a function that pings a given host
func (a *App) Ping(host string) (string, error) {
	cmd := exec.Command("ping", "-c", "1", "-W", "1", host)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ping failed: %v", err)
	}

	if strings.Contains(string(output), "1 received") || strings.Contains(string(output), "1 packets received") {
		return "Ping successful", nil
	}

	return "", fmt.Errorf("ping failed: no response")
}

func (a *App) CloseApp() {
	if a.ctx != nil {
		fmt.Println("Closing app")
		runtime.Quit(a.ctx)
	}
}

// Call this when files are saved/modified
func (a *App) SetUnsavedChanges(hasChanges bool) {
	a.hasUnsavedChanges = hasChanges
}

func (a *App) MarkFileAsUnsaved(filename string) {
	// Prüfe, ob die Datei bereits in der Liste ist
	for _, f := range a.unsavedFiles {
		if f == filename {
			return // Bereits in der Liste
		}
	}
	a.unsavedFiles = append(a.unsavedFiles, filename)
	fmt.Printf("File marked as unsaved: %s, total unsaved: %d\n", filename, len(a.unsavedFiles))
}

func (a *App) MarkFileAsSaved(filename string) {
	for i, f := range a.unsavedFiles {
		if f == filename {
			a.unsavedFiles = append(a.unsavedFiles[:i], a.unsavedFiles[i+1:]...)
			fmt.Printf("File marked as saved: %s, remaining unsaved: %d\n", filename, len(a.unsavedFiles))
			break
		}
	}
}

// In your Wails app Go code
func (a *App) ListDir(path string) ([]map[string]interface{}, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var result []map[string]interface{}
	for _, entry := range entries {
		info, _ := entry.Info()
		result = append(result, map[string]interface{}{
			"name":    entry.Name(),
			"isDir":   entry.IsDir(),
			"size":    info.Size(),
			"modTime": info.ModTime().Unix(),
		})
	}
	return result, nil
}

func (a *App) ReadFileContent(path string) (string, error) {
	content, err := os.ReadFile(path)
	return string(content), err
}

func (a *App) HomeDir() (string, error) {
	if dir, err := os.UserHomeDir(); err == nil && dir != "" {
		return dir, nil
	}

	u, err := user.Current()
	if err != nil {
		return "", err
	}
	return u.HomeDir, nil
}

// Get config file path
func (a *App) getConfigPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	appDir := filepath.Join(configDir, "Leoedit")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: Failed to create config directory %s: %v\n", appDir, err)
	}
	return filepath.Join(appDir, "config.json")
}

// Load configuration
func (a *App) loadConfig() {
	data, err := os.ReadFile(a.configPath)
	if err != nil {
		a.Config = AppConfig{
			RecentFiles:    []string{},
			MaxRecentFiles: 10,
		}
		return
	}

	err = json.Unmarshal(data, &a.Config)
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		a.Config = AppConfig{
			RecentFiles:    []string{},
			MaxRecentFiles: 10,
		}
	}
}

// Save configuration
func (a *App) saveConfig() error {
	data, err := json.MarshalIndent(a.Config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.configPath, data, 0644)
}

// ExtractFilePath extracts filepath from various string formats
func (a *App) ExtractFilePath(input string) (string, error) {
	if input == "" {
		return "", fmt.Errorf("empty input")
	}

	cleaned := filepath.Clean(input)

	if filepath.IsAbs(cleaned) {
		return cleaned, nil
	}

	absPath, err := filepath.Abs(cleaned)
	if err != nil {
		return "", fmt.Errorf("failed to resolve path: %v", err)
	}

	if _, err := os.Stat(absPath); err != nil {
		return absPath, nil
	}

	return absPath, nil
}

// Extract multiple filepaths from a string (e.g., dragged files)
func (a *App) ExtractFilePaths(input string) []string {
	var paths []string

	delimiters := []string{"\n", "\r\n", ",", ";", "|"}

	for _, delim := range delimiters {
		if strings.Contains(input, delim) {
			parts := strings.Split(input, delim)
			for _, part := range parts {
				if trimmed := strings.TrimSpace(part); trimmed != "" {
					if path, err := a.ExtractFilePath(trimmed); err == nil {
						paths = append(paths, path)
					}
				}
			}
			break
		}
	}

	if len(paths) == 0 {
		if path, err := a.ExtractFilePath(input); err == nil {
			paths = append(paths, path)
		}
	}

	return paths
}

// AddRecentFile adds a filepath to recent files list
func (a *App) AddRecentFile(filePath string) string {
	absPath, err := a.ExtractFilePath(filePath)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}

	for i, path := range a.Config.RecentFiles {
		if path == absPath {
			a.Config.RecentFiles = append(a.Config.RecentFiles[:i], a.Config.RecentFiles[i+1:]...)
			break
		}
	}

	a.Config.RecentFiles = append([]string{absPath}, a.Config.RecentFiles...)

	if len(a.Config.RecentFiles) > a.Config.MaxRecentFiles {
		a.Config.RecentFiles = a.Config.RecentFiles[:a.Config.MaxRecentFiles]
	}

	if dir := filepath.Dir(absPath); dir != "" {
		a.Config.LastDirectory = dir
	}

	if err := a.saveConfig(); err != nil {
		return fmt.Sprintf("Error saving config: %v", err)
	}

	return absPath
}

// GetRecentFiles returns list of recent files
func (a *App) GetRecentFiles() []string {
	return a.Config.RecentFiles
}

// GetLastDirectory returns last used directory
func (a *App) GetLastDirectory() string {
	return a.Config.LastDirectory
}

// ClearRecentFiles clears the recent files list
func (a *App) ClearRecentFiles() string {
	a.Config.RecentFiles = []string{}
	if err := a.saveConfig(); err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	return "Recent files cleared"
}

// RemoveRecentFile removes a specific file from recent list
func (a *App) RemoveRecentFile(filePath string) string {
	for i, path := range a.Config.RecentFiles {
		if path == filePath {
			a.Config.RecentFiles = append(a.Config.RecentFiles[:i], a.Config.RecentFiles[i+1:]...)
			if err := a.saveConfig(); err != nil {
				return fmt.Sprintf("Error: %v", err)
			}
			return fmt.Sprintf("Removed: %s", filePath)
		}
	}
	return "File not found in recent list"
}

// OpenFileDialog opens a system file dialog
func (a *App) OpenFileDialog(startDir string) string {
	if startDir == "" {
		startDir = a.Config.LastDirectory
	}

	if startDir == "" {
		if home, err := os.UserHomeDir(); err == nil {
			startDir = home
		}
	}

	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		DefaultDirectory: startDir,
		Title:            "Datei auswählen",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Alle Dateien (*.*)",
				Pattern:     "*.*",
			},
		},
	})

	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}

	if len(selection) > 0 {
		selectedFile := string(selection[0])
		a.AddRecentFile(selectedFile)
		return selectedFile
	}

	return ""
}
