// icons.js

import {
    FileText,
    FolderOpen,
    Save,
    Copy,
    Scissors,
    FolderTree,
    Clock,
    Clipboard,
    Undo2,
    Redo2,
    Wrench,
    Sparkles,
    Sparkle,
    ArrowUp,
    X,
    LogOut,
    HelpCircle,
    RotateCcw,
    RotateCw,
    SquareSplitVertical,
    SquareSplitHorizontal,
    Trash2,
    SquareX,
    List,
    RefreshCw,
    ChevronsUpDown,
    ChevronRight,
    ChevronDown,
    Circle,
    Hash,
    SquareFunction,
    Pyramid,
    Minimize2,
    createElement
} from '../../node_modules/lucide/dist/esm/lucide.js';


export function renderIcon(iconName, options = {}) {
    const iconMap = {
        FileText,
        FolderOpen,
        Save,
        Copy,
        Scissors,
        FolderTree,
        Clock,
        Clipboard,
        Undo2,
        Redo2,
        Wrench,
        Sparkles,
        Sparkle,
        ArrowUp,
        X,
        LogOut,
        HelpCircle,
        RotateCcw,
        RotateCw,
        SquareSplitVertical,
        SquareSplitHorizontal,
        Trash2,
        SquareX,
        List,
        RefreshCw,
        ChevronsUpDown,
        ChevronRight,
        ChevronDown,
        Circle,
        Hash,
        SquareFunction,
        Pyramid,
        Minimize2
    };

    const iconDef = iconMap[iconName];

    if (!iconDef) {
        console.warn(`Icon "${iconName}" not found`);
        return null;
    }

    // lucide rendering API
    return createElement(iconDef, options);
}


// Beispiel-Nutzung:
// const el = renderIcon('Save', { size: 20 });
// container.appendChild(el);