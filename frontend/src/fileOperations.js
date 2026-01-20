// File operations - depends only on state and editor
import { SaveFile, LoadFile, SaveFileUnder, ReadFile } from "../wailsjs/go/main/App.js";
import { APP_CONFIG } from './constants.js';
import { appState, updateCurrentTabOnSave } from './state.js';
import { editorManager } from './editor.js';
import { updateStatus, setAppTitle } from './ui.js';

// Konstanten für Standardwerte
const DEFAULT_TAB_NAME = APP_CONFIG.DEFAULT_TAB_NAME;
const ERROR_MESSAGES = {
  NO_CONTENT: "Kein Text zum Speichern!",
  SAVE_FAILED: "Datei konnte nicht gespeichert werden!",
  GENERIC_ERROR: "Fehler beim Speichern: "
};

export async function openFile() {
    try {
        const result = await LoadFile();
        if (!result.filename || result.content === undefined) {
            updateStatus("Fehler: Keine Datei ausgewählt", "error");
            return null;
        }

        if (typeof result.content === 'string' && result.content.startsWith("Fehler")) {
            updateStatus(result.content, "error");
            return null;
        }

        return {
            name: result.filename.split(/[/\\]/).pop() || APP_CONFIG.DEFAULT_TAB_NAME,
            path: result.filename,
            content: result.content
        };
    } catch (e) {
        console.error('OpenFile error:', e);
        updateStatus(`Fehler beim Laden: ${e.message || e}`, "error");
        return null;
    }
}

// Hilfsfunktion zur Validierung des Inhalts
function validateContent(content) {
  if (!content || !content.trim()) {
    updateStatus(ERROR_MESSAGES.NO_CONTENT, "error");
    return false;
  }
  return true;
}

// Hilfsfunktion zur Validierung des Dateinamens und -pfads
function validateFilePaths(fname, fnamepath) {
  if (!fname || !fnamepath) {
    updateStatus("Ungültiger Dateiname oder -pfad!", "error");
    return false;
  }
  return true;
}

// Hauptfunktion zum Speichern der Datei
export async function saveFile() {
  try {
    const content = editorManager.getValue();

    // Validierung des Inhalts
    if (!validateContent(content)) {
      return false;
    }

    // Dateiname und -pfad abrufen
    const fname = appState.getActiveTab().fileName || DEFAULT_TAB_NAME;
    const fnamepath = appState.getActiveTab().filePath || fname;

    // Validierung des Dateinamens und -pfads
    if (!validateFilePaths(fname, fnamepath)) {
      return false;
    }

    // Direktspeicherung, wenn der Dateiname nicht der Standardname ist
    const directSave = fname !== DEFAULT_TAB_NAME;
    const result = await SaveFile(content, fnamepath, directSave);

    if (!result) {
      updateStatus(ERROR_MESSAGES.SAVE_FAILED, "error");
      return false;
    }

    // Erfolgreiches Speichern
    updateCurrentTabOnSave(fname, content);
    updateStatus("Datei erfolgreich gespeichert!", "success");
    return true;
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    updateStatus(`${ERROR_MESSAGES.GENERIC_ERROR}${error.message}`, "error");
    return false;
  }
}

export async function saveFileUnder() {
    const content = editorManager.getValue();
    const oldFname = appState.getActiveTab().fileName;
    if (!content.trim()) {
        updateStatus("Kein Text zum Speichern!", "error");
        return false;
    }
    
    try {
        const result = await SaveFileUnder(content,oldFname);
        if (result.startsWith("Fehler")) {
            updateStatus(result, "error");
            return false;
        }
        
        // ✅ Update tab state with saved content
        updateCurrentTabOnSave(result, content);
        return true;
    } catch (e) {
        updateStatus(`Fehler beim Speichern: ${e}`, "error");
        return false;
    }
}

export async function loadFileFromPath(path) {
    try {
        const content = await ReadFile(path);
        if (typeof content !== 'string') {
            updateStatus("Fehler: Ungültiger Dateiinhalt", "error");
            return null;
        }
        return {
            name: path.split(/[/\\]/).pop() || path,
            path: path,
            content: content
        };
    } catch (e) {
        console.error("Failed to read file:", e);
        updateStatus(`Fehler beim Lesen: ${e.message || e}`, "error");
        return null;
    }
}