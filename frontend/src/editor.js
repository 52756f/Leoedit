import { APP_CONFIG } from './constants.js';
import { highlightLineField } from './clsOutliner.js';
// CodeMirror Imports
import { EditorView, keymap, lineNumbers, dropCursor } from "@codemirror/view";
import { EditorState, EditorSelection, Compartment } from "@codemirror/state";
import {
    history,
    historyKeymap,
    indentWithTab,
    defaultKeymap,
    insertNewlineAndIndent,
    undo as cmUndo,
    redo as cmRedo,
    undoDepth,
    redoDepth
} from "@codemirror/commands";
import {
    indentOnInput,
    bracketMatching,
    syntaxHighlighting,
    defaultHighlightStyle,
    HighlightStyle,
    indentUnit,
    LRLanguage,
    LanguageSupport,
    StreamLanguage
} from "@codemirror/language";
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { styleTags, tags as t } from '@lezer/highlight';
import { parser } from '@lezer/go';
import {
    search,
    searchKeymap,
    openSearchPanel,
    highlightSelectionMatches,
} from "@codemirror/search";
import { renderIcon } from './lib/icons.js';
import { appState } from './state.js';
import { createNewTab } from './tabManager.js';
import { setAppTitle } from './ui.js';
import { AiPanel } from './aipanel.js';
import { SetUnsavedChanges, MarkFileAsUnsaved } from "../wailsjs/go/main/App.js";
import { formatWithCursor } from 'prettier';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';

// Go Language Support
export const goLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            styleTags({
                // Individual keywords (no asterisks in pattern names)
                "package": t.keyword,
                "import": t.keyword,
                "func": t.keyword,
                "var": t.keyword,
                "const": t.keyword,
                "type": t.keyword,
                "struct": t.keyword,
                "interface": t.keyword,
                "break": t.controlKeyword,
                "case": t.controlKeyword,
                "chan": t.controlKeyword,
                "continue": t.controlKeyword,
                "default": t.controlKeyword,
                "defer": t.controlKeyword,
                "else": t.controlKeyword,
                "fallthrough": t.controlKeyword,
                "for": t.controlKeyword,
                "goto": t.controlKeyword,
                "if": t.controlKeyword,
                "range": t.controlKeyword,
                "return": t.controlKeyword,
                "select": t.controlKeyword,
                "switch": t.controlKeyword,
                "map": t.keyword,
                "go": t.keyword,
                "nil": t.null,
                "true": t.bool,
                "false": t.bool,

                // Built-in types
                "int": t.typeName,
                "int8": t.typeName,
                "int16": t.typeName,
                "int32": t.typeName,
                "int64": t.typeName,
                "uint": t.typeName,
                "uint8": t.typeName,
                "uint16": t.typeName,
                "uint32": t.typeName,
                "uint64": t.typeName,
                "uintptr": t.typeName,
                "float32": t.typeName,
                "float64": t.typeName,
                "complex64": t.typeName,
                "complex128": t.typeName,
                "byte": t.typeName,
                "rune": t.typeName,
                "string": t.typeName,
                "bool": t.typeName,
                "error": t.typeName,

                // Built-in functions
                "append": t.standard(t.variableName),
                "cap": t.standard(t.variableName),
                "close": t.standard(t.variableName),
                "complex": t.standard(t.variableName),
                "copy": t.standard(t.variableName),
                "delete": t.standard(t.variableName),
                "imag": t.standard(t.variableName),
                "len": t.standard(t.variableName),
                "make": t.standard(t.variableName),
                "new": t.standard(t.variableName),
                "panic": t.standard(t.variableName),
                "print": t.standard(t.variableName),
                "println": t.standard(t.variableName),
                "real": t.standard(t.variableName),
                "recover": t.standard(t.variableName),

                // Use proper token names from the Go parser
                "String": t.string,
                "Number": t.number,
                "Comment": t.comment,
                "VariableName": t.variableName,
                "LabelName": t.labelName,
                "FieldName": t.propertyName,
                "TypeName": t.typeName,

            })
        ]
    })
});

// Go-specific indentation support
const goIndent = (context) => {
    const { state, pos, unit } = context;
    const line = state.doc.lineAt(pos);
    const lineText = line.text;

    // Get current line indentation
    const currentIndent = /^\s*/.exec(lineText)[0];
    const indentSize = currentIndent.length;

    // Go specific rules
    const prevLine = pos > 1 ? state.doc.lineAt(pos - 1) : null;

    if (prevLine) {
        const prevText = prevLine.text;

        // Increase indent after: {, (, [
        if (prevText.match(/[{(\[]\s*$/)) {
            return indentSize + unit;
        }

        // Decrease indent for closing braces
        if (lineText.match(/^\s*[})\]]/)) {
            return Math.max(0, indentSize - unit);
        }

        // Handle else, case, default
        if (lineText.match(/^\s*(else|case \w+|default):/)) {
            return Math.max(0, indentSize - unit);
        }
    }

    return indentSize;
};

// Plain Text Support (no syntax highlighting, but parser must advance the stream)
export function plainText() {
    return new LanguageSupport(StreamLanguage.define({
        token(stream) {
            if (stream.eatWhile(() => true)) {
                return null; // consume the whole line
            }
            stream.next(); // fallback to advance at least one char
            return null;
        }
    }));
}

function go() { return new LanguageSupport(goLanguage); }

// === Editor Commands ===
export const editorCommands = {
    /**
     * Copy selected text to clipboard
     * @param {EditorView|null} view - CodeMirror editor view instance
     * @returns {boolean} True if command executed (required for CodeMirror keymaps)
     */
    copy: (view) => {
        if (!view) return false;

        const { from, to } = view.state.selection.main;
        const text = view.state.sliceDoc(from, to);

        if (text && window.runtime?.ClipboardSetText) {
            window.runtime.ClipboardSetText(text).catch(err => {
                console.error('Clipboard copy failed:', err);
            });
        }
        return true;
    },

    /**
     * Cut selected text to clipboard
     * @param {EditorView|null} view - CodeMirror editor view instance
     * @returns {boolean} True if command executed
     */
    cut: (view) => {
        if (!view) {
            console.error("Cut command failed: No editor view available.");
            return false;
        }
        const { from, to } = view.state.selection.main;
        // Wenn nichts ausgewählt ist, beende früh und gib false zurück.
        if (from === to) {
            console.log("Cut command aborted: No text selected.");
            return false;
        }


        const text = view.state.sliceDoc(from, to);

        if (text && window.runtime?.ClipboardSetText) {
            window.runtime.ClipboardSetText(text).catch(err => {
                console.error('Clipboard cut failed:', err);
            });

            view.dispatch({
                changes: { from, to, insert: "" }
            });
        }
        return true;
    },

    /**
     * Paste text from clipboard (non-blocking)
     * @param {EditorView|null} view - CodeMirror editor view instance
     * @returns {boolean} True (async operation runs in background)
     */
    paste: (view) => {
        if (!view || !window.runtime?.ClipboardGetText) return false;

        // Async IIFE to avoid blocking the UI
        (async () => {
            try {
                const text = await window.runtime.ClipboardGetText();
                if (text != null) {
                    const { from, to } = view.state.selection.main;
                    view.dispatch({
                        changes: { from, to, insert: text }
                    });
                    view.focus();
                }
            } catch (err) {
                console.error('Clipboard paste failed:', err);
            }
        })();

        return true;
    }
};

const formatCode = async (code) => {
    try {
        return await formatWithCursor(code, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
            tabWidth: 2,
            semi: true,
            singleQuote: true,
        });
    } catch (err) {
        console.error('Format failed:', err);
        return { formatted: code }; // Fallback
    }
};

// Format on save
const formatOnSave = keymap.of([
    {
        key: 'Ctrl-s',
        run: async (view) => {
            const formatted = await formatCode(view.state.doc.toString());
            view.dispatch({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: formatted.formatted,
                },
            });
            return true;
        },
    },
]);

// === EditorManager ===
export class EditorManager {
    constructor() {
        this.panes = new Map();
        this.tabStates = new Map();
        this.selectionDebounceTimer = null;
        this.hasSelection = false;
        this.selectedText = '';
        this.languageCompartment = new Compartment();

        this.baseExtensions = [
            EditorView.lineWrapping,
            lineNumbers(),
            highlightLineField,
            history(),
            indentOnInput(),
            bracketMatching(),
            syntaxHighlighting(defaultHighlightStyle),
            dropCursor(),
            search(),
            highlightSelectionMatches(),
            this.languageCompartment.of([]),
            keymap.of([
                indentWithTab,
                { key: "Mod-f", run: openSearchPanel },
                ...searchKeymap,
                ...defaultKeymap,
                ...historyKeymap,
                { key: "Enter", run: insertNewlineAndIndent },
                { key: "Mod-Enter", run: insertNewlineAndIndent },
            ]),
            indentUnit.of("    "),
            EditorView.theme({
                "&": { fontSize: "14px", height: "100%" },
                ".cm-content": { caretColor: "black" },
                ".cm-scroller": { overflow: "auto" }
            }),

            // ✅ EINZIGER Ort für Event-Handler
            EditorView.domEventHandlers({
                mouseup: () => appState.updateMenuState(),
                keyup: () => appState.updateMenuState(),
                paste: () => appState.updateMenuState(),
                dragover: (event) => {
                    event.preventDefault();
                    return true; // Sagt CodeMirror: Wir haben das Event im Griff
                },

                drop: (event, view) => {
                    event.preventDefault();

                    // Wichtig: Wir holen uns die Dateien aus dem dataTransfer
                    const files = event.dataTransfer.files;

                    if (files && files.length > 0) {
                        // Wir setzen das aktive Pane auf das, in das gedroppt wurde
                        if (view.paneId) {
                            appState.activePane = view.paneId;
                        }

                        Array.from(files).forEach(file => {
                            // Wails/WebView2 spezifisch: 
                            // In manchen Umgebungen ist 'path' direkt auf dem File-Objekt.
                            // Wir loggen es zur Sicherheit einmal im Browser-Log (F12)
                            console.log("File Object dropped:", file);

                            const filePath = file.path || "";

                            if (this.onFileDrop) {
                                // Wir übergeben Pfad UND das File-Objekt als Fallback
                                this.onFileDrop(filePath, file);
                            }
                        });
                    }
                    return true; // Signalisiert CM6, dass das Event erledigt ist
                },
            }),

            EditorView.updateListener.of((update) => {
                // 💡 Content changes
                if (update.docChanged) {
                    this.handleContentChange(update.state.doc.toString());
                    const tab = appState.getActiveTab();
                    if (tab && !tab.dirty) {
                        tab.dirty = true;
                        appState.setDirty(true);
                        SetUnsavedChanges(true);
                        MarkFileAsUnsaved(tab.filename);
                    }
                }

                // 💡 Selection changes (debounced)
                if (update.selectionSet) {
                    this.debouncedSelectionHandler(update);
                }

                // 💡 Focus changes
                if (update.focusChanged && update.view.hasFocus) {
                    this.handleFocusChange(update.view);
                }
            })
        ];

        const formatCode = async (code) => {
            return await formatWithCursor(code, {
                parser: 'babel',
                plugins: [prettierPluginBabel, prettierPluginEstree],
                tabWidth: 2,
                semi: true,
                singleQuote: true,
            });
        };

        // Format on save
        const formatOnSave = keymap.of([
            {
                key: 'Ctrl-s',
                run: async (view) => {
                    const formatted = await formatCode(view.state.doc.toString());
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: formatted.formatted,
                        },
                    });
                    return true;
                },
            },
        ]);

    }

    // Hilfsmethode für Fokus
    handleFocusChange(view) {
        const paneId = view.paneId;
        if (paneId) {
            appState.activePane = paneId;
            appState.setEditorInstance(this);
            const paneData = this.panes.get(paneId);
            if (paneData?.activeTabId) {
                appState.activeTabId = paneData.activeTabId;
                const tab = appState.openTabs.get(paneData.activeTabId);
                if (tab?.fileName) {
                    setAppTitle(`${APP_CONFIG.NAME} - ${tab.fileName}`);
                }
            }
        }
    }

    // Hilfsmethode für Selection
    debouncedSelectionHandler(update) {
        clearTimeout(this.selectionDebounceTimer);
        this.selectionDebounceTimer = setTimeout(() => {
            const sel = update.state.selection.main;
            const hasSel = !sel.empty;
            const text = hasSel ? update.state.sliceDoc(sel.from, sel.to) : '';

            if (hasSel !== this.hasSelection || text !== this.selectedText) {
                this.hasSelection = hasSel;
                this.selectedText = text;
                appState.hasSelection = hasSel;
                this.notifySelectionChange(hasSel, text);
                this.emitSelectionEvent(hasSel, text);
            }
            appState.updateMenuState();
        }, 50);
    }
    initializePane(paneId = 'left') {
        if (this.panes.has(paneId)) return this.panes.get(paneId).view;

        const container = document.getElementById(
            paneId === 'left' ? 'monaco-editor-left' : 'monaco-editor-right'
        );

        const view = new EditorView({
            state: this.createState(),
            parent: container,
            extensions: [
                javascript(),
                formatOnSave,  // Hier wird es hinzugefügt
            ],
        });

        // WICHTIG: paneId direkt an die View hängen, damit domEventHandlers darauf zugreifen können
        view.paneId = paneId;

        this.panes.set(paneId, { view, container, activeTabId: null, dom: container });
        return view;
    }

    toggleSplit() {
        const rightPane = document.getElementById('editor-pane-right');
        const divider = document.getElementById('editor-divider');

        const wasActive = !rightPane.classList.contains('hidden');

        if (wasActive) {
            // Disable split
            rightPane.classList.add('hidden');
            divider.classList.add('hidden');
            for (const [tabId, state] of this.tabStates) {
                if (state.pane === 'right') state.pane = 'left';
            }
            appState.isVSplitActive = false;
            appState.activePane = 'left';
        } else {
            // Enable split
            this.initializePane('right');
            if (appState.activeTabId) {
                const tabState = this.tabStates.get(appState.activeTabId);
                if (tabState) tabState.pane = 'left';
            }
            createNewTab(APP_CONFIG.DEFAULT_TAB_NAME, '', 'right');
            rightPane.classList.remove('hidden');
            divider.classList.remove('hidden');
            appState.isVSplitActive = true;
            appState.isHSplitActive = false;
        }
        appState.updateMenuState();
    }

    toggleSplitAI() {
        const rightPane = document.getElementById('editor-pane-right');
        const divider = document.getElementById('editor-divider');

        const wasActive = !rightPane.classList.contains('hidden');

        if (wasActive) {
            // Disable split
            rightPane.classList.add('hidden');
            divider.classList.add('hidden');
            for (const [tabId, state] of this.tabStates) {
                if (state.pane === 'right') state.pane = 'left';
            }
            appState.isVSplitActive = false;
            appState.activePane = 'left';
        } else {
            // Enable split
            this.initializePane('right');
            if (appState.activeTabId) {
                const tabState = this.tabStates.get(appState.activeTabId);
                if (tabState) tabState.pane = 'left';
            }
            //createNewTab(APP_CONFIG.DEFAULT_TAB_NAME, '', 'right');
            createNewTab("Openrouter.ai", "StarteAI", 'right');
            rightPane.classList.remove('hidden');
            divider.classList.remove('hidden');
            appState.isVSplitActive = true;
            appState.isHSplitActive = false;
        }
        appState.updateMenuState();
    }

    getActiveView() {
        const pane = this.getActivePane();
        return pane?.view || null;
    }

    getActivePane() {
        const tabId = appState.activeTabId;
        if (!tabId) return this.panes.get('left');
        const state = this.tabStates.get(tabId);
        return state ? this.panes.get(state.pane) : this.panes.get('left');
    }

    async switchToTabInPane(tabId, paneId) {
        const tabInfo = appState.openTabs.get(tabId);
        const paneData = this.panes.get(paneId);
        if (!tabInfo || !paneData) return;

        // Prüfen ob der Tab bereits in einem Pane aktiv ist
        for (const [existingPaneId, existingPaneData] of this.panes) {
            if (existingPaneData.activeTabId === tabId) {
                console.log(`Tab ${tabId} is already active in pane ${existingPaneId}, switching to that pane`);
                // Fokus auf den bereits aktiven Tab setzen
                this.updateUIFocus(tabId, existingPaneId, tabInfo.type === 'web', tabInfo.type === 'ai');
                return;
            }
        }

        const isWeb = tabInfo.type === 'web';
        const isAi = tabInfo.type === 'ai';
        const currentTabId = paneData.activeTabId;

        // --- 1. STATE DER VORHERIGEN TAB SPEICHERN ---
        if (currentTabId && currentTabId !== tabId) {
            const prevTabInfo = appState.openTabs.get(currentTabId);
            if (prevTabInfo?.type !== 'web' && prevTabInfo?.type !== 'ai') {
                // Nur für Standard-Editor-Tabs den CM6 State speichern
                this.tabStates.set(currentTabId, {
                    state: paneData.view.state,
                    pane: paneId
                });
            }
        }

        // Hide all other AI panels
        document.querySelectorAll('[id^="ai-panel-"]').forEach(panel => {
            panel.style.display = 'none';
        });

        // --- 2. SICHTBARKEIT MANAGEN (Hiding everything first) ---
        // Wir verstecken den Editor-Container, nicht das View-DOM selbst
        if (paneData.view) paneData.view.dom.style.display = 'none';
        this.hideIframes(); // Versteckt alle existierenden Web-Iframes
        console.log("Switching to tab:", tabId, "in pane:", paneId);

        // --- 3. TAB-SPEZIFISCHE LOGIK ---
        if (isWeb) {
            this.handleWebTab(tabId, tabInfo, paneData);
        } else if (isAi) {
            this.handleAiTab(tabId, tabInfo, paneData);
        } else {
            this.handleEditorTab(tabId, tabInfo, paneData, paneId);
        }

        // --- 4. SHARED UI UPDATES ---
        this.updateUIFocus(tabId, paneId, isWeb, isAi);
    }

    async handleAiTab(tabId, tabInfo, paneData) {

        // Editor verstecken
        if (paneData.view) {
            paneData.view.dom.style.display = 'none';
        }

        // Prüfen ob AI-Panel für diesen Tab schon existiert
        let aiPanel = document.getElementById(`ai-panel-${tabId}`);
        if (!aiPanel) {
            console.log("Creating AI panel for tab:", tabId);
            // Neue AiPanel-Instanz erstellen
            const aiPanelInstance = new AiPanel(tabId, paneData);
            // Instanz speichern für späteren Zugriff
            if (!this.aiPanels) this.aiPanels = new Map();
            this.aiPanels.set(tabId, aiPanelInstance);
        } else {
            console.log("AI panel already exists for tab:", tabId);
            aiPanel.style.display = 'block';
        }
    }

    // Hilfsmethode für Web-Tabs (Lazy Loading + Persistenz)
    handleWebTab(tabId, tabInfo, paneData) {

        let iframeEl = document.getElementById(`web-tab-view${tabId}`);

        if (!iframeEl) {
            iframeEl = document.createElement('iframe');
            iframeEl.id = `web-tab-view${tabId}`;
            iframeEl.className = 'web-tab-iframe';
            iframeEl.style.cssText = "width:100%; height:100%; border:0; background:#fff; position: absolute; top: 0; left: 0; z-index: 10;";

            // Editor verstecken, aber nicht zerstören
            if (paneData.view) {
                paneData.view.dom.style.display = 'none';
            }

            // iframe zum Container hinzufügen (über dem Editor)
            paneData.dom.appendChild(iframeEl);

            window.go.main.App.ProxyURL(tabInfo.url).then(html => {
                const baseTag = `<base href="${tabInfo.url}">`;
                iframeEl.srcdoc = baseTag + html;
            }).catch(err => {
                iframeEl.srcdoc = `<h1>Error</h1><p>${err}</p>`;
            });
        } else {
            // Existierenden iframe anzeigen
            iframeEl.style.display = 'block';
            // Editor verstecken
            if (paneData.view) {
                paneData.view.dom.style.display = 'none';
            }
        }
    }

    // Hilfsmethode für Editor
    handleEditorTab(tabId, tabInfo, paneData, paneId) {
        if (!paneData.dom.contains(paneData.view.dom)) {
            paneData.dom.appendChild(paneData.view.dom);
        }
        paneData.view.dom.style.display = 'block';

        let savedData = this.tabStates.get(tabId);
        let editorState = savedData?.state;

        if (!editorState) {
            const content = tabInfo.lastContent ?? tabInfo.savedContent ?? '';
            const langExt = this.getLanguageExtension(detectLanguage(tabInfo.fileName));
            editorState = EditorState.create({
                doc: content,
                extensions: [...this.baseExtensions, ...(langExt ? [langExt] : [])]
            });
        }

        paneData.view.setState(editorState);
    }

    hideIframes() {
        // Verstecke alle Web-Iframes
        const iframes = document.querySelectorAll('.web-tab-iframe');
        iframes.forEach(iframe => {
            iframe.style.display = 'none';
        });

        // Verstecke alle AI-Panels
        const aiPanels = document.querySelectorAll('.ai-panel');
        aiPanels.forEach(panel => {
            panel.style.display = 'none';
        });

        // Editor wieder anzeigen (wenn vorhanden)
        const activePane = this.getActivePane();
        if (activePane && activePane.view) {
            activePane.view.dom.style.display = 'block';
        }
    }

    updateUIFocus(tabId, paneId, isWeb, isAi) {
        const tabInfo = appState.openTabs.get(tabId);
        const paneData = this.panes.get(paneId);

        // 1. State global & lokal im Pane setzen
        paneData.activeTabId = tabId;
        appState.activeTabId = tabId;
        appState.activePane = paneId;

        // 2. CSS-Klassen für die Tabs aktualisieren
        document.querySelectorAll('.tab_active').forEach(el => el.classList.remove('tab_active'));
        const activeTabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (activeTabEl) {
            activeTabEl.className = `tab pane-${paneId} tab_active`;
        }

        // 3. Titel der Anwendung aktualisieren (falls Dateiname vorhanden)
        if (tabInfo.fileName) {
            setAppTitle(`${APP_CONFIG.NAME} - ${tabInfo.fileName}`);
        }

        // 4. Den Fokus setzen (Wichtig für die Tastatur-Bedienung)
        if (isWeb) {
            const iframeEl = document.getElementById(`web-tab-view${tabId}`);
            if (iframeEl) iframeEl.focus();
        } else if (isAi) {
            // Fokus auf das spezifische Prompt-Eingabefeld des AI-Tabs
            const aiInput = document.getElementById(`ai-prompt-${tabId}`);
            if (aiInput) {
                aiInput.focus();
            }
        } else if (paneData.view) {
            // Fokus auf den CodeMirror 6 Editor
            // Wir nutzen ein minimales Timeout, um sicherzustellen, dass das DOM bereit ist
            setTimeout(() => {
                paneData.view.focus();
            }, 10);
        }
    }

    setFileDropHandler(handler) {
        this.onFileDrop = handler;
    }

    getLanguageExtension(language) {
        if (typeof language !== 'string') {
            throw new Error('Invalid argument: language must be a string');
        }

        const map = {
            js: javascript, javascript: javascript, md: markdown, markdown: markdown,
            html: html, css: css, json: json,
            txt: plainText, text: plainText, log: plainText, csv: plainText,
            ini: plainText, conf: plainText, cfg: plainText, properties: plainText,
            yml: plainText, yaml: plainText, py: python, python: python,
            java: java, go: go, golang: go,
            '': go
        };
        const fn = map[language?.toLowerCase()];
        return fn ? fn() : null;

    }

    handleContentChange(content) {
        const tab = appState.getActiveTab();
        if (tab) tab.lastContent = content;
    }

    // ✅ Unified, debounced selection handling already in updateListener

    notifySelectionChange(hasSelection, selectedText) {
        // this.selectionListeners.forEach(cb => {
        //     try { cb(hasSelection, selectedText); }
        //     catch (e) { console.error('Listener error:', e); }
        // });
        this.updateUIForSelection(hasSelection);
    }

    emitSelectionEvent(hasSelection, selectedText) {
        if (window.runtime?.EventsEmit) {
            window.runtime.EventsEmit('editorSelectionChanged', {
                hasSelection,
                text: selectedText,
                length: selectedText.length
            });
        }
    }

    updateUIForSelection(hasSelection) {
        document.querySelectorAll('[data-requires-selection]').forEach(el => {
            el.disabled = !hasSelection;
            el.classList?.toggle('disabled', !hasSelection);
        });
        document.querySelectorAll('.selection-dependent').forEach(el => {
            el.disabled = !hasSelection;
        });
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            statusBar.textContent = hasSelection
                ? `Selection: ${this.selectedText.length} chars`
                : '';
        }
    }

    getSelectionInfo() {
        // ✅ FIX: Use active view, not this.view (which is unused)
        const view = this.getActiveView();
        if (!view) return { hasSelection: false, text: '', length: 0 };

        const sel = view.state.selection.main;
        const hasSelection = !sel.empty;
        const text = hasSelection ? view.state.sliceDoc(sel.from, sel.to) : '';

        return { hasSelection, text, length: text.length, from: sel.from, to: sel.to };
    }

    hasTextSelected() { return this.hasSelection; }
    getSelectedText() { return this.selectedText; }

    createState(content = '') {
        return EditorState.create({ doc: content, extensions: this.baseExtensions });
    }

    getTabContent(tabId) {
        const state = this.tabStates.get(tabId)?.state;
        return state ? state.doc.toString() : '';
    }

    // ✅ No manual event cleanup needed — domEventHandlers are internal

    undo() { const v = this.getActiveView(); return v ? undoCmd(v) : false; }
    redo() { const v = this.getActiveView(); return v ? redoCmd(v) : false; }
    canUndo() { const v = this.getActiveView(); return v ? undoDepth(v.state) > 0 : false; }
    canRedo() { const v = this.getActiveView(); return v ? redoDepth(v.state) > 0 : false; }

    disposePane(paneId) {
        const pane = this.panes.get(paneId);
        if (pane) {
            pane.view.destroy();
            this.panes.delete(paneId);
        }
    }

    dispose() {
        this.panes.forEach((_, id) => this.disposePane(id));
        this.tabStates.clear();
        this.changeListeners = [];
        this.selectionListeners = [];
        if (this.selectionDebounceTimer) clearTimeout(this.selectionDebounceTimer);
    }

    setValue(content, paneId = null) {
        const target = this.panes.get(paneId || appState.activePane || 'left');
        if (target?.view) {
            target.view.dispatch({ changes: { from: 0, to: target.view.state.doc.length, insert: content || '' } });
        }
    }

    getValue(paneId = null) {
        const target = this.panes.get(paneId || appState.activePane || 'left');
        return target ? target.view.state.doc.toString() : '';
    }

    focus(paneId = null) {
        const target = this.panes.get(paneId || appState.activePane || 'left');
        if (target?.view) target.view.focus();
    }
}

export const editorManager = new EditorManager();

export function detectLanguage(filename) {
    if (!filename) return 'plaintext';
    const ext = filename.toLowerCase().split('.').pop();
    const map = {
        txt: 'plaintext', log: 'plaintext', csv: 'plaintext', ini: 'plaintext',
        conf: 'plaintext', cfg: 'plaintext', properties: 'plaintext',
        yml: 'plaintext', yaml: 'plaintext',
        js: 'javascript', jsx: 'javascript', ts: 'javascript', tsx: 'javascript',
        html: 'html', htm: 'html',
        css: 'css', scss: 'css', less: 'css',
        json: 'json',
        md: 'markdown', markdown: 'markdown',
        go: 'go'
    };
    return map[ext] || 'javascript';
}