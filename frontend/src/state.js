// Centralized application state - eliminates circular dependencies
import { APP_CONFIG } from './constants.js';
import { editorManager } from './editor.js';
import { updateStatus, setAppTitle } from './ui.js';
import { updateTabTitle } from './tabManager.js';

class AppState {
    constructor() {
        this.openTabs = new Map();
        this.activeTabId = null;
        this.editorInstance = null;
        this.editorContainer = null;

        // Cache für Menu-Elemente
        this.menuElements = new Map();
        this.debounceTimer = null;

        this.isVSplitActive = false;
        this.isHSplitActive = false;
        this.activePane = 'left'; // 'left' oder 'right'
    }

    setSplitActive(active) {
        this.isSplitActive = active;
        if (!active) {
            this.activePane = 'left';
        }
        this.updateMenuState();
    }

    setEditorInstance(editor) {
        this.editorInstance = editor;
        console.log("AppState: Editor instance has been set.");
        this.cacheMenuElements(); // Cache Menu-Elemente nach Editor-Initialisierung
    }

    /**
     * Cache aller Menu-Elemente für bessere Performance
     */
    cacheMenuElements() {
        const menuIds = [
            'menu-save', 'menu-save-under', 'menu-close-file',
            'menu-cut', 'menu-copy', 'menu-paste',
            'menu-undo', 'menu-redo', 'menu-split-vertical',
            'menu-split-horizontal', 'menu-close-all'
        ];

        menuIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.menuElements.set(id, element);
            }
        });
    }

    /**
     * Hilfsmethode zum Abrufen von Menu-Elementen
     */
    getMenuElement(id) {
        // Aus Cache holen oder neu suchen
        if (!this.menuElements.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.menuElements.set(id, element);
            }
            return element;
        }
        return this.menuElements.get(id);
    }

    /**
     * Hilfsmethode zum Aktualisieren eines Menu-Elements
     */
    updateMenuElement(id, isEnabled) {
        const element = this.getMenuElement(id);
        if (!element) return;

        if (isEnabled) {
            element.removeAttribute('aria-disabled');
            element.classList.remove('disabled');
            element.classList.remove('force-disabled');
        } else {
            element.setAttribute('aria-disabled', 'true');
            element.classList.add('disabled');
        }
    }

    getActiveTab() {
        return this.activeTabId ? this.openTabs.get(this.activeTabId) : null;
    }

    /**
     * Optimierte Methode zum Prüfen des Dirty-Status
     */
    isDirty() {
        const tab = this.getActiveTab();
        if (!tab) return false;

        try {
            // Content-Quellen in Reihenfolge der Priorität
            const currentContent = this.editorInstance?.getValue?.()
                ?? editorManager.getTabContent?.(this.activeTabId)
                ?? tab.lastContent
                ?? tab.savedContent
                ?? '';

            const savedContent = tab.savedContent ?? '';

            return currentContent !== savedContent;
        } catch (error) {
            console.error('Error checking dirty state:', error);
            return false;
        }
    }

    /**
     * Dirty-Status setzen mit optionalem Content-Update
     */
    setDirty(dirty = true, updateContent = false) {
        const tab = this.getActiveTab();
        if (!tab) return false;

        tab.dirty = dirty;

        if (updateContent && dirty) {
            // Aktuellen Content speichern für spätere Vergleiche
            tab.lastContent = this.editorInstance?.getValue?.()
                ?? editorManager.getTabContent?.(this.activeTabId)
                ?? tab.lastContent
                ?? tab.savedContent
                ?? '';
        }

        // Update tab title to show/hide asterisk
        updateTabTitle(this.activeTabId);

        // Debounced Menu-Update
        this.debouncedUpdateMenuState();

        return true;
    }

    /**
     * Tab als sauber markieren (gespeichert)
     */
    markAsClean() {
        const tab = this.getActiveTab();
        if (!tab) return false;

        const currentContent = this.editorInstance?.getValue?.()
            ?? editorManager.getTabContent?.(this.activeTabId)
            ?? tab.lastContent
            ?? tab.savedContent
            ?? '';

        tab.savedContent = currentContent;
        tab.dirty = false;
        tab.lastContent = currentContent;

        // Update tab title to remove asterisk
        updateTabTitle(this.activeTabId);

        this.debouncedUpdateMenuState();
        return true;
    }

    /**
     * Debounced Menu-Update für bessere Performance
     */
    debouncedUpdateMenuState() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.updateMenuState();
        }, 100); // 100ms Debounce
    }

    /**
     * Optimierte Menu-State-Update-Methode
     */
    updateMenuState() {
        const hasOpenTabs = this.openTabs.size > 0;
        const openTabsCount = this.openTabs.size;
        const isDirty = this.isDirty();
        const hasSelection = this.hasSelection;
        const canUndo = this.editorInstance?.canUndo?.() || false;
        const canRedo = this.editorInstance?.canRedo?.() || false;
        const canSplit = hasOpenTabs && !this.isSplitActive;

        // Debug-Log nur wenn sich etwas ändert
        if (this.lastMenuState?.hasOpenTabs !== hasOpenTabs ||
            this.lastMenuState?.isDirty !== isDirty ||
            this.lastMenuState?.hasSelection !== hasSelection ||
            this.lastMenuState?.canUndo !== canUndo ||
            this.lastMenuState?.canRedo !== canRedo) {

            console.log(`Menu State - Tabs: ${openTabsCount}, Dirty: ${isDirty}, ` +
                `Selection: ${hasSelection}, Undo: ${canUndo}, Redo: ${canRedo}`);

            // Cache des letzten Zustands
            this.lastMenuState = {
                hasOpenTabs,
                openTabsCount,
                isDirty,
                hasSelection,
                canUndo,
                canRedo,
                canSplit
            };
        }

        // Menu-Elemente aktualisieren
        this.updateAllMenuElements({
            hasOpenTabs,
            openTabsCount,
            isDirty,
            hasSelection,
            canUndo,
            canRedo,
            canSplit
        });
    }

    /**
     * Zentrale Methode zum Aktualisieren aller Menu-Elemente
     */
    updateAllMenuElements(state) {
        const hasOpenTabs = state.hasOpenTabs;
        const openTabsCount = state.openTabsCount;
        const isDirty = state.isDirty;
        const hasSelection = state.hasSelection;
        const canUndo = state.canUndo;
        const canRedo = state.canRedo;
        const canSplit = state.canSplit;


        // File Menu  updateMenuElement(id, isEnabled, action = 'enable') {
        this.updateMenuElement('menu-save', isDirty && hasOpenTabs);
        this.updateMenuElement('menu-save-under', isDirty && hasOpenTabs);
        this.updateMenuElement('menu-close-file', hasOpenTabs);
        this.updateMenuElement('menu-close-all', hasOpenTabs && openTabsCount > 1);

        // Edit Menu
        this.updateMenuElement('menu-cut', hasSelection && hasOpenTabs);
        this.updateMenuElement('menu-copy', hasSelection && hasOpenTabs);
        this.updateMenuElement('menu-paste', hasOpenTabs); // Paste immer wenn Tab offen
        this.updateMenuElement('menu-undo', canUndo && hasOpenTabs);
        this.updateMenuElement('menu-redo', canRedo && hasOpenTabs);

        // View Menu
        this.updateMenuElement('menu-split-vertical', canSplit);
        this.updateMenuElement('menu-split-horizontal', hasOpenTabs && openTabsCount > 1);

        // Zusätzliche Methoden für spezielle Fälle
        this.updateFindReplaceMenu(hasOpenTabs);
        this.updateFormatMenu(hasOpenTabs, hasSelection);
    }

    /**
     * Beispiel für zusätzliche Menu-Gruppen
     */
    updateFindReplaceMenu(hasOpenTabs) {
        const findElement = this.getMenuElement('menu-find');
        const replaceElement = this.getMenuElement('menu-replace');

        if (findElement) {
            this.updateMenuElement('menu-find', hasOpenTabs);
        }
        if (replaceElement) {
            this.updateMenuElement('menu-replace', hasOpenTabs);
        }
    }

    updateFormatMenu(hasOpenTabs, hasSelection) {
        // Format-Menu-Elemente (nur wenn Text ausgewählt)
        const formatElements = ['menu-format-bold', 'menu-format-italic', 'menu-format-code'];

        formatElements.forEach(id => {
            const element = this.getMenuElement(id);
            if (element) {
                this.updateMenuElement(id, hasOpenTabs && hasSelection);
            }
        });
    }

    /**
     * Cleanup-Methode
     */
    dispose() {
        if (this.contentChangeDisposable) {
            this.contentChangeDisposable.dispose();
            this.contentChangeDisposable = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.menuElements.clear();
        this.openTabs.clear();
        this.editorInstance = null;
        this.activeTabId = null;
    }

}

// Singleton instance
export const appState = new AppState();

export function updateCurrentTabOnSave(filePath, newContent) {
    const tabId = appState.activeTabId;
    if (!tabId) return;

    const tab = appState.openTabs.get(tabId);
    if (tab) {
        if (filePath) {
            tab.filePath = filePath;
            console.log("filepath nach speichern gesetzt:", filePath);
            const fileName = filePath.split(/[\\/]/).pop();
            tab.fileName = fileName;
        }

        tab.savedContent = newContent;
        tab.dirty = false;

        // Update tab title to remove asterisk and show new filename
        updateTabTitle(tabId);

        appState.updateMenuState();
        updateStatus(`${tab.fileName} gespeichert`);
        setAppTitle(`${APP_CONFIG.NAME} - ${tab.fileName}`);
    }
}