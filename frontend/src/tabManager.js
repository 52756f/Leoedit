import { APP_CONFIG } from './constants.js';
import { appState } from './state.js';
import { renderIcon } from './lib/icons.js';
import { updateStatus, setAppTitle } from './ui.js';
import { editorManager, editorCommands, detectLanguage } from './editor.js';
import { EditorState } from "@codemirror/state";
import { MarkFileAsSaved } from '../wailsjs/go/main/App.js';

export function closeTab(tabId) {
    const tabInfo = appState.openTabs.get(tabId);
    if (!tabInfo) return;

    // Check if tab has unsaved changes
    if (tabInfo.dirty && tabInfo.type === 'editor') {
        const confirmed = confirm("Datei hat ungespeicherte Änderungen. Trotzdem schließen?");
        if (!confirmed) {
            return;
        }
    }

    // Clean up resources based on tab type
    switch (tabInfo.type) {
        case 'editor':
            // Dispose CodeMirror state
            if (editorManager.tabStates.has(tabId)) {
                editorManager.tabStates.delete(tabId);
            }
            // Only mark as saved for editor files
            if (tabInfo.filePath) {
                MarkFileAsSaved(tabInfo.filePath);
            }
            break;

        case 'web':
            // Clean up iframe
            const frame = document.getElementById('web-tab-view' + tabId);
            if (frame) {
                frame.remove();
            }
            break;

        case 'ai':
            // AI tab specific cleanup if needed
            break;
    }

    // Remove tab from DOM
    const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.remove();
    }

    // Remove from state
    appState.openTabs.delete(tabId);

    // Reset dirty state if this was the active tab
    if (appState.activeTabId === tabId) {
        appState.setDirty(false);
        appState.activeTabId = null;
    }

    // Handle split pane cleanup
    cleanupEmptyPane(tabInfo.pane);

    // Switch to another tab if available
    if (appState.activeTabId === tabId || !appState.activeTabId) {
        const remainingTabs = document.querySelectorAll('.tab');
        if (remainingTabs.length > 0) {
            const nextTab = remainingTabs[remainingTabs.length - 1];
            const nextTabId = nextTab.dataset.tabId;
            const nextTabPane = nextTab.classList.contains('pane-right') ? 'right' : 'left';
            editorManager.switchToTabInPane(nextTabId, nextTabPane);
        }
        // Don't create a new tab automatically - let the user decide
    }

    appState.updateMenuState();
}

export function closeAllTabs() {
    if (appState.openTabs.size === 0) {
        createNewTab();
        return;
    }

    // Check for dirty tabs
    const dirtyEditorTabs = Array.from(appState.openTabs.values())
        .filter(tab => tab.type === 'editor' && tab.dirty);

    if (dirtyEditorTabs.length > 0) {
        const confirmed = confirm(`${dirtyEditorTabs.length} Tab(s) haben ungespeicherte Änderungen. Alle trotzdem schließen?`);
        if (!confirmed) {
            return;
        }
    }

    // Create a copy of tab IDs before closing
    const tabIds = Array.from(appState.openTabs.keys());

    // Close all tabs
    tabIds.forEach(tabId => {
        // Skip confirmation for individual tabs since we already confirmed
        const tabInfo = appState.openTabs.get(tabId);
        if (tabInfo) {
            // Perform cleanup without confirmation
            closeTabWithoutConfirmation(tabId);
        }
    });

    // Always ensure at least one tab exists
    if (appState.openTabs.size === 0) {
        createNewTab(APP_CONFIG.DEFAULT_TAB_NAME);
    }

    appState.updateMenuState();
}

function closeTabWithoutConfirmation(tabId) {
    // Simplified version of closeTab that skips confirmation
    const tabInfo = appState.openTabs.get(tabId);
    if (!tabInfo) return;

    // ... rest of cleanup logic without confirm dialog
}

function cleanupEmptyPane(pane) {
    if (pane === 'right') {
        const remainingRightPaneTabs = Array.from(appState.openTabs.values())
            .filter(tab => tab.pane === 'right');

        if (remainingRightPaneTabs.length === 0 && appState.isVSplitActive) {
            // Clean up right pane content
            const rightPane = document.getElementById('editor-pane-right');

            // Remove all AI panels in right pane
            rightPane.querySelectorAll('[id^="ai-panel-"]').forEach(panel => {
                panel.remove();
            });

            // Remove all iframes in right pane
            rightPane.querySelectorAll('iframe').forEach(frame => {
                frame.remove();
            });

            // Clear the editor content in right pane
            const rightPaneEditor = rightPane.querySelector('.cm-editor');
            if (rightPaneEditor) {
                rightPaneEditor.remove();
            }

            // Hide the right pane and divider
            document.getElementById('editor-pane-right').classList.add('hidden');
            document.getElementById('editor-divider').classList.add('hidden');
            appState.isVSplitActive = false;
            appState.isHSplitActive = false;
            appState.activePane = 'left';
        }
    }

    // Hide editor panes when no tabs exist
    if (appState.openTabs.size === 0) {
        const leftPane = document.getElementById('editor-pane-left');
        const rightPane = document.getElementById('editor-pane-right');
        const divider = document.getElementById('editor-divider');

        if (leftPane) leftPane.classList.add('hidden');
        if (rightPane) rightPane.classList.add('hidden');
        if (divider) divider.classList.add('hidden');
    }
}

export function createNewTab(filename = APP_CONFIG.DEFAULT_TAB_NAME, initialContent = '', paneId = null) {
    // Check if file is already open (exclude default untitled file)
    if (filename !== APP_CONFIG.DEFAULT_TAB_NAME) {
        const existingTab = Array.from(appState.openTabs.entries()).find(([id, tab]) =>
            tab.fileName === filename && tab.filePath
        );

        if (existingTab) {
            const [existingTabId, existingTabInfo] = existingTab;
            console.log("File already open:", filename, "switching to tab:", existingTabId);

            // Switch to existing tab and focus
            const targetPane = existingTabInfo.pane || 'left';
            editorManager.switchToTabInPane(existingTabId, targetPane);

            // Ensure tab title shows dirty state correctly
            updateTabTitle(existingTabId);

            editorManager.focus(targetPane);
            return existingTabId;
        }
    }

    // Determine target pane with fallback
    let targetPane;
    if (paneId) {
        targetPane = paneId;
    } else if (appState.isVSplitActive || appState.isHSplitActive) {
        targetPane = appState.activePane || 'left';
    } else {
        targetPane = 'left';
    }

    // Ensure pane is initialized
    try {
        const paneView = editorManager.initializePane(targetPane);
        if (!paneView) {
            console.error("Failed to initialize pane:", targetPane);
            // Fallback to left pane
            targetPane = 'left';
            editorManager.initializePane('left');
        }
    } catch (error) {
        console.error("Error initializing pane:", error);
        targetPane = 'left';
        editorManager.initializePane('left');
    }

    const tabId = `tab-${Date.now()}-${targetPane}`;
    const isWeb = initialContent.startsWith('http://') || initialContent.startsWith('https://');
    const isAi = initialContent.startsWith('StarteAI');

    // Create tab based on type
    if (isWeb) {
        createWebTab(tabId, filename, initialContent, targetPane);
    } else if (isAi) {
        createAiTab(tabId, filename, targetPane);
    } else {
        createEditorTab(tabId, filename, initialContent, targetPane);
    }

    // Create and setup tab element
    setupTabElement(tabId, filename, targetPane, !isWeb && !isAi);

    // Activate the new tab
    editorManager.switchToTabInPane(tabId, targetPane);
    editorManager.focus(targetPane);

    // Show editor panes when tabs exist
    const leftPane = document.getElementById('editor-pane-left');
    if (leftPane) leftPane.classList.remove('hidden');

    return tabId;
}

function createWebTab(tabId, filename, url, pane) {
    appState.openTabs.set(tabId, {
        fileName: filename,
        type: 'web',
        url: url,
        dirty: false,
        filePath: null,
        savedContent: '',
        lastContent: '',
        pane: pane
    });
}

function createAiTab(tabId, filename, pane) {
    appState.openTabs.set(tabId, {
        fileName: filename,
        type: 'ai',
        url: '',
        dirty: false,
        filePath: null,
        savedContent: '',
        lastContent: '',
        pane: pane
    });
}

function createEditorTab(tabId, filename, content, pane) {
    const language = detectLanguage(filename);
    const langExtension = editorManager.getLanguageExtension(language);

    const initialState = EditorState.create({
        doc: content,
        extensions: [...editorManager.baseExtensions, ...(langExtension ? [langExtension] : [])]
    });

    appState.openTabs.set(tabId, {
        fileName: filename,
        type: 'editor',
        dirty: false,
        filePath: null,
        savedContent: content,
        lastContent: content,
        pane: pane
    });

    editorManager.tabStates.set(tabId, {
        state: initialState,
        pane: pane
    });
}

function setupTabElement(tabId, filename, pane, showAiButton = false) {
    const tabElement = document.createElement('div');
    tabElement.className = `tab pane-${pane}`;
    tabElement.setAttribute('data-tab-id', tabId);

    const aiButtonHtml = showAiButton ?
        `<span class="tab-ai" data-tab-id="${tabId}" title="Öffne AI Assistant"><i data-lucide="Sparkle"></i></span>` : '';

    tabElement.innerHTML = `
        <span class="tab-title">${filename}</span>
        ${aiButtonHtml}
        <span class="tab-close">&times;</span>
    `;

    tabElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) {
            e.stopPropagation();
            closeTab(tabId);
        } else if (e.target.classList.contains('tab-ai') || e.target.closest('.tab-ai')) {
            e.stopPropagation();
            openAiSplitForTab(tabId);
        } else {
            editorManager.switchToTabInPane(tabId, pane);
        }
    });

    document.getElementById('tab-container').appendChild(tabElement);

    // Render Lucide icon if present
    const aiIcon = tabElement.querySelector('[data-lucide="Sparkle"]');
    if (aiIcon) {
        const icon = renderIcon('Sparkle');
        if (icon) {
            aiIcon.replaceWith(icon);
        }
    }
}

export function updateTabTitle(tabId) {
    const tab = appState.openTabs.get(tabId);
    if (!tab) return;

    const tabElement = document.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
    if (!tabElement) return;

    const baseTitle = tab.fileName || APP_CONFIG.DEFAULT_TAB_NAME;
    const displayTitle = tab.dirty ? `${baseTitle}*` : baseTitle;
    tabElement.textContent = displayTitle;
}

export function resetSplitWindow() {
    const rightPane = document.getElementById('editor-pane-right');
    const divider = document.getElementById('editor-divider');

    // Hide right pane and divider
    rightPane.classList.add('hidden');
    divider.classList.add('hidden');

    // Move all right pane tabs to left pane
    for (const [tabId, state] of editorManager.tabStates) {
        if (state.pane === 'right') {
            state.pane = 'left';
            // Update tab element class
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabElement) {
                tabElement.classList.remove('pane-right');
                tabElement.classList.add('pane-left');
            }
        }
    }

    // Update app state
    appState.isVSplitActive = false;
    appState.isHSplitActive = false;
    appState.activePane = 'left';

    // Update menu state
    appState.updateMenuState();

    console.log("Split window reset - all tabs moved to left pane");
}

export function closeActiveTab() {
    if (appState.activeTabId) {
        closeTab(appState.activeTabId);
    }
}

export function closeSplitWindow() {
    const rightPane = document.getElementById('editor-pane-right');
    const divider = document.getElementById('editor-divider');

    // Close all tabs in right pane
    const rightPaneTabs = Array.from(appState.openTabs.values())
        .filter(tab => tab.pane === 'right');

    if (rightPaneTabs.length > 0) {
        const confirmed = confirm(`${rightPaneTabs.length} Tab(s) im rechten Bereich schließen?`);
        if (!confirmed) {
            return;
        }

        // Close right pane tabs
        const rightPaneTabIds = rightPaneTabs.map(tab =>
            Array.from(appState.openTabs.entries())
                .find(([id, t]) => t === tab)?.[0]
        ).filter(Boolean);

        rightPaneTabIds.forEach(tabId => closeTab(tabId));
    }

    // Hide right pane and divider
    rightPane.classList.add('hidden');
    divider.classList.add('hidden');

    // Update app state
    appState.isVSplitActive = false;
    appState.isHSplitActive = false;
    appState.activePane = 'left';

    // Update menu state
    appState.updateMenuState();

    console.log("Split window closed - right pane tabs removed");
}

export function openAiSplitForTab(tabId) {
    const tab = appState.openTabs.get(tabId);
    if (!tab || tab.type !== 'editor') return;

    console.log("Opening AI split for tab:", tabId, "file:", tab.fileName);

    // Enable split if not already active (without creating extra tab)
    if (!appState.isVSplitActive) {
        const rightPane = document.getElementById('editor-pane-right');
        const divider = document.getElementById('editor-divider');

        // Show right pane and divider
        rightPane.classList.remove('hidden');
        divider.classList.remove('hidden');

        // Update app state
        appState.isVSplitActive = true;
        appState.isHSplitActive = false;
        appState.activePane = 'left';

        // Update menu state
        appState.updateMenuState();
    }

    // Create AI tab in right pane only
    createNewTab('Openrouter.ai', 'StarteAI', 'right');
}



