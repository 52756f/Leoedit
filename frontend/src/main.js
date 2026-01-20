import { APP_CONFIG } from './constants.js';
import { EventsOn } from "../wailsjs/runtime/runtime.js";
import { GetOpenedFilePath, QueryOpenRouter, CloseApp, ReadFileContent } from '../wailsjs/go/main/App.js';
import { createNewTab } from './tabManager.js';
import { editorManager } from './editor.js';
import { initMenu } from './menu.js';
import { appState } from './state.js';
import { updateStatus } from './ui.js';
import { loadFileFromPath } from './fileOperations.js';
import { FileExplorer } from './clsFileExplorer.js';
import { CodeMirrorOutliner } from './clsOutliner.js';
import { UnsavedChangesModal } from './dialogs/clsUnsavedModal.js';
import "./assets/css/style.css";
import "./assets/css/app.css";
import "./assets/css/aside_toolbar.css";

// Prevent browser from navigating away when files are dropped outside editor panes
window.addEventListener("dragover", (event) => {
    const isEditorArea = event.target instanceof Element && event.target.closest('.editor-container');
    if (!isEditorArea) {
        event.preventDefault();
    }
}, false);

window.addEventListener("drop", (event) => {
    const isEditorArea = event.target instanceof Element && event.target.closest('.editor-container');
    if (!isEditorArea) {
        event.preventDefault();
    }
}, false);

window.runtime.EventsOn('show-unsaved-modal', () => {
    console.log('Showing unsaved changes modal');
    // Zeige das Modal an
    // Das sollte Ihre showUnsavedChangesModal() Funktion aufrufen
    const modal = new UnsavedChangesModal();
    modal.show();
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const outliner = new CodeMirrorOutliner('outliner');
        initMenu();

        // await editorManager.initializePane('left');

        // window.aiAssistant = new OpenRouterAIAssistant();
        // window.aiAssistant.initialize();
        // window.aiPanelResizer = new AIPanelResizer();

        // //Gespeicherte Breite beim Laden wiederherstellen
        // window.addEventListener('load', () => {
        //     aiPanelResizer.loadWidthFromStorage();
        // });

        // // Bei Fenstergrößenänderung maximale Breite anpassen
        // window.addEventListener('resize', () => {
        //     const currentWidth = parseInt(getComputedStyle(aiPanelResizer.panel).width, 10);
        //     const maxWidth = window.innerWidth * 0.8;

        //     if (currentWidth > maxWidth) {
        //         aiPanelResizer.panel.style.width = `${maxWidth}px`;
        //         aiPanelResizer.saveWidthToStorage();
        //     }
        // });

        const fileExplorer = new FileExplorer('folderlist', (filePath) => {
            console.log('User double-clicked file:', filePath);

            let fileData = null;
            let fileName = fileExplorer.getFilenameFromPath(filePath);

            // Call your Go function to read file:
            ReadFileContent(filePath).then(content => {
                fileData = {
                    name: fileName,
                    content: content,
                    path: filePath
                };

                if (fileData) {
                    const targetPane = appState.activePane || 'left';
                    // Tab erstellen
                    const tabId = createNewTab(fileData.name, fileData.content, targetPane);
                    const tab = appState.openTabs.get(tabId);

                    if (tab) {
                        tab.filePath = filePath || "";
                        tab.savedContent = fileData.content;
                        tab.dirty = false;
                        appState.setDirty(false);

                        updateStatus(`${fileData.name} geladen!`);
                        // Tab wirklich anzeigen
                        editorManager.switchToTabInPane(tabId);
                    }
                }
            });
        });

        fileExplorer.attachKeyboardShortcuts();

        // Initialize outliner with active editor
        outliner.setEditor({
            dom: editorManager.getActiveView(),
            getValue: () => {
                const view = editorManager.getActiveView();
                return view ? view.state.doc.toString() : '';
            },
            view: editorManager.getActiveView()
        });

        // Update outliner when switching tabs
        const originalSwitchToTab = editorManager.switchToTabInPane.bind(editorManager);
        editorManager.switchToTabInPane = function (tabId, targetPane) {
            const result = originalSwitchToTab(tabId, targetPane);

            // Update outliner with new active editor
            setTimeout(() => {
                outliner.setEditor({
                    dom: editorManager.getActiveView(),
                    getValue: () => {
                        const view = editorManager.getActiveView();
                        return view ? view.state.doc.toString() : '';
                    },
                    view: editorManager.getActiveView()
                });
                outliner.refreshOutline();
            }, 100);

            return result;
        };

        // Optional: Add keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' &&
                fileExplorer.container.contains(document.activeElement) &&
                !document.activeElement.closest('.cm-editor')) {
                fileExplorer.openSelectedFile();
                fileExplorer.clearSelection();
            }
        });
        await fileExplorer.init();
        // Optional: Add hotkey (e.g., Ctrl+Shift+A)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                window.aiPanel.toggle();
            }
        });

        // ✅ DRAG & DROP Handler zuweisen
        // In main.js innerhalb von DOMContentLoaded
        editorManager.setFileDropHandler(async (filePath, fileObject) => {
            console.log("DRAG & DROP Pfad erhalten:", filePath);

            let fileData = null;

            if (filePath) {
                // Der Idealfall: Wails hat uns den nativen Pfad gegeben
                fileData = await loadFileFromPath(filePath);
            } else if (fileObject) {
                // Fallback: Falls filePath leer ist, lesen wir den Inhalt direkt
                console.warn("Kein nativer Pfad gefunden, nutze FileReader Fallback");
                const content = await fileObject.text();
                fileData = {
                    name: fileObject.name,
                    content: content,
                    path: "" // Hier haben wir dann leider keinen Pfad für "Speichern"
                };
            }

            if (fileData) {
                const targetPane = appState.activePane || 'left';
                // Tab erstellen
                const tabId = createNewTab(fileData.name, fileData.content, targetPane);
                const tab = appState.openTabs.get(tabId);

                if (tab) {
                    tab.filePath = filePath || "";
                    tab.savedContent = fileData.content;
                    tab.dirty = false;
                    appState.setDirty(false);

                    updateStatus(`${fileData.name} geladen!`);
                    // Tab wirklich anzeigen
                    editorManager.switchToTabInPane(tabId);
                }
            }
        });

        // On startup, check for an opened file path from backend
        const targetPaneDefault = appState.activePane || 'left';
        const initialPath = await GetOpenedFilePath();
        if (initialPath && initialPath !== "") {
            const fileData = await loadFileFromPath(initialPath);
            if (fileData) {

                const tabId = createNewTab(fileData.name, fileData.content, targetPaneDefault);
                const tab = appState.openTabs.get(tabId);

                tab.filePath = initialPath;
                tab.savedContent = fileData.content;
                tab.lastContent = fileData.content;
                updateStatus(`${fileData.name} geladen (via Startup)!`);

                editorManager.switchToTabInPane(tabId, targetPaneDefault);
                return; // Datei wurde geladen
            } else {
                createNewTab(APP_CONFIG.DEFAULT_TAB_NAME, '', 'left');
            }
        }

    } catch (error) {
        handleError(error);
    }
});

EventsOn("file-opened", (filePath) => {
});

// HMR support
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        editorManager.dispose();
    });
}

// Wails error events
EventsOn("error", (msg) => {
    console.error("Backend error:", msg);
    document.getElementById('status').textContent = `Backend-Fehler: ${msg}`;
});

function handleError(error) {
    console.error("Fehler:", error);
    alert("Es tut uns leid, aber es gab einen Fehler bei der Anfrage. Bitte versuchen Sie es erneut.");
}



