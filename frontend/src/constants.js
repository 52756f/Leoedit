
export const APP_CONFIG = {
    get NAME() { return "Leoedit"; },
    get VERSION() { return "2.3.0.78"; },
    get HISTORY_LIMIT() { return 200; },
    get DESCRIPTION() { return "Ein einfacher Texteditor<br>\n mit CodeMirror 6"; },
    get AUTHOR() { return "Leo Träxler"; },
    get COPYRIGHT() { return "© 2025 Leoedit. Alle Rechte vorbehalten"; },
    get DEFAULT_TAB_NAME() { return "Unbenannt.txt"; }
};

// Backward compatibility
export const _APPNAME = APP_CONFIG.NAME;
export const HISTORY_LIMIT = APP_CONFIG.HISTORY_LIMIT;

export const STATUS_MESSAGES = {
    READY: "Bereit",
    CHANGED: "Geändert (Speichern erforderlich)",
    // ...
};