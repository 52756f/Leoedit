// Menu and tab management
import { CloseApp, SetUnsavedChanges, HasUnsavedChanges, RequestClose } from "../wailsjs/go/main/App.js";
import { renderIcon } from './lib/icons.js';
import { closeActiveTab, closeAllTabs, closeTab, createNewTab, resetSplitWindow, closeSplitWindow } from './tabManager.js';
import { appState, updateCurrentTabOnSave } from './state.js';
import { editorManager, editorCommands } from './editor.js';
import { openFile, saveFile, saveFileUnder, loadFileFromPath } from './fileOperations.js';
import { updateStatus, setAppTitle, SidepanelCloser } from './ui.js';
import { APP_CONFIG } from './constants.js';
import { showAboutDialog } from './dialogs/aboutDialog.js';
import { LeftToolbar } from './clsLefttoolbar.js';

// Initialize left toolbar
const verticalToolbar = new LeftToolbar('asideToolbar');
// Menu action handlers 
const menuActions = {
    'menu-new': () => createNewTab(),
    'menu-open': () => handleOpenFile(),
    'menu-save': () => saveFile(),
    'menu-save-under': () => saveFileUnder(),
    'menu-close-file': () => closeActiveTab(),
    'menu-close-all': () => {
        resetSplitWindow();
        closeAllTabs();
    },
    'menu-quit': () => { confirmUnsavedChangesBeforeQuit(); },
    'menu-undo': () => {
        const view = editorManager.getActiveView();
        if (!view) {
            console.log('Undo: No active editor');
            return;
        }

        const success = editorManager.undo();
        if (!success) {
            console.log('Nothing to undo');
        }

        // Re-focus editor after undo
        view.focus();
    },

    'menu-redo': () => {
        const view = editorManager.getActiveView();
        if (!view) {
            console.log('Redo: No active editor');
            return;
        }

        const success = editorManager.redo();
        if (!success) {
            console.log('Nothing to redo');
        }

        view.focus();
    },
    'menu-cut': function () {
        return editorCommands.cut(editorManager.view);
    },
    'menu-copy': () => editorCommands.copy(editorManager.view),
    'menu-paste': () => editorCommands.paste(editorManager.view),
    'menu-select-all': () => {
        const view = editorManager.view;
        if (view) {
            view.dispatch({
                selection: { anchor: 0, head: view.state.doc.length }
            });
        }
    },
    'menu-split-vertical': () => {
        editorManager.toggleSplit();
    },
    'menu-ai-panel': () => {
        createNewTab('openrouter.ai', 'StarteAI');
    },
    'menu-split-horizontal': () => {
        console.log("Split Horizontal ausgewählt (noch nicht implementiert)");
        alert("Split Horizontal ist noch nicht implementiert.");
    },
    'menu-reset-split': () => {
        resetSplitWindow();
    },
    'menu-close-split': () => {
        closeSplitWindow();
    },
    'menu-about': () => showAboutDialog(),
    'menu-web-test': () => webtest(),

};

export function initMenu() {
    const menubar = document.getElementById('menubar');
    if (!menubar) return;

    // Single delegated event listener
    menubar.addEventListener('click', handleMenuClick);

    // Keep editor selection by preventing menu clicks from stealing focus
    menubar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.menu-item') || e.target.closest('.submenu-item')) {
            e.preventDefault();
        }
    });

    // Global click to close menus
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menubar')) {
            menubar.querySelectorAll('.menu-item.active').forEach(item => {
                item.classList.remove('active');
            });
        }
        if (e.target.tagName === 'A') { // wird für webtabs verwendet
            e.preventDefault();
            createNewTab(e.target.href, e.target.href);
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
            e.preventDefault();
            saveFile();
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
            e.preventDefault();
            saveFileUnder();
        } else if (e.ctrlKey && e.key === 'q') {
            e.preventDefault();
            confirmUnsavedChangesBeforeQuit();
        }
    });

    generateMenuIcons();
    initToolbarLeft();
}

function generateIcon(iconName) {
    const icon = renderIcon(iconName);
    return icon;
}

function generateMenuIcons() {
    const menubar = document.getElementById('menubar');
    menubar.querySelectorAll('.submenu-item').forEach(item => {
        const iconSpan = item.querySelector('.menu-icon');
        if (iconSpan) {
            const iconName = iconSpan.getAttribute('data-icon');
            if (iconName) {
                const icon = generateIcon(iconName);
                if (icon) {
                    iconSpan.appendChild(icon);
                }
            }
        }
    });
}

/**
 * Checks for unsaved changes in open tabs and prompts the user to confirm before quitting.
 */
async function confirmUnsavedChangesBeforeQuit() {
    let hasDirtyTabs = false;
    const dirtyTabs = [];

    // Check all open tabs for dirty state
    for (const [tabId, tab] of appState.openTabs) {
        if (tab.dirty) {
            hasDirtyTabs = true;
            dirtyTabs.push(tab.fileName || 'Unbenannt');
        }
    }

    if (hasDirtyTabs) {
        const message = `Ungesicherte Änderungen in:\n${dirtyTabs.join('\n')}\n\nTrotzdem beenden?`;
        if (!confirm(message)) {
            return false; // User cancelled
        }
    }

    await SetUnsavedChanges(false);
    CloseApp()
    return true;
}


function handleMenuClick(e) {

    const submenuItem = e.target.closest('.submenu-item');
    if (submenuItem) {
        e.stopPropagation();

        const action = menuActions[submenuItem.id];

        if (action) {
            Promise.resolve(action()).finally(() => {
                document.querySelectorAll('.menu-item.active').forEach(item => {
                    item.classList.remove('active');
                });
                editorManager.focus();
            });
        } else {
            console.warn("No action defined for menu item:", submenuItem.id);
        }
        return;
    }

    const menuItem = e.target.closest('.menu-item');
    if (menuItem) {
        e.stopPropagation();

        document.querySelectorAll('.menu-item.active').forEach(item => {
            if (item !== menuItem) item.classList.remove('active');
        });

        menuItem.classList.toggle('active');
    }
}

async function handleOpenFile() {
    const fileData = await openFile();
    if (!fileData) return;

    const activeTab = appState.getActiveTab();

    // Wenn aktiver Tab im rechten Pane und ungespeichert: direkt laden
    if (activeTab && activeTab.pane === 'right' && !activeTab.dirty) {
        // Inhalt direkt in den aktiven Tab laden
        const tabId = appState.activeTabId;
        const tab = appState.openTabs.get(tabId);
        tab.filePath = fileData.path;
        tab.fileName = fileData.name;
        tab.savedContent = fileData.content;
        tab.lastContent = fileData.content;
        tab.dirty = false;
        console.log(); ("Lade Datei in bestehenden rechten Tab:", tabId);
        // Editor-Inhalt aktualisieren
        editorManager.setValue(fileData.content, 'right');

        // Tab-Titel aktualisieren
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
        if (tabElement) {
            tabElement.textContent = fileData.name;
        }

        appState.setDirty(false);
        updateStatus(`${fileData.name} geladen!`);
        return;
    }

    // Sonst neuen Tab erstellen
    const tabId = createNewTab(fileData.name, fileData.content);
    const tab = appState.openTabs.get(tabId);
    tab.filePath = fileData.path;
    tab.savedContent = fileData.content;
    tab.dirty = false;
    appState.setDirty(false);

    updateStatus(`${fileData.name} geladen!`);
}

function initToolbarLeft() {

    // Register actions
    verticalToolbar.registerAction('Explorer', () => {
        console.log('Explorer');
        const folderList = document.getElementById('folderlist');
        if (folderList.classList.contains('hidden')) {
            folderList.classList.remove('hidden');
            SidepanelCloser('Explorer');
            folderList.classList.add('visible');
        } else {
            folderList.classList.remove('visible');
            folderList.classList.add('hidden');
        }
    });

    verticalToolbar.registerAction('Recent Files', () => {
        SidepanelCloser('Recent Files');
        document.getElementById('recent-files-panel').classList.toggle('hidden');
    });

    verticalToolbar.registerAction('AI Fenster', () => {
        createNewTab("Openrouter.ai", "StarteAI");
    });

    verticalToolbar.registerAction('Outliner', () => {
        const outliner = document.getElementById('outliner');
        if (outliner.classList.contains('hidden')) {
            outliner.classList.remove('hidden');
            SidepanelCloser('Outliner');
            outliner.classList.add('visible');
            document.querySelector('.btn-refresh')?.click();
        } else {
            outliner.classList.remove('visible');
            outliner.classList.add('hidden');
        }
    });

}