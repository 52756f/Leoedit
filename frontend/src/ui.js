// UI helper functions
import { EventsEmit } from "../wailsjs/runtime/runtime.js";
import * as LucideIcons from "lucide-static";

const statusEl = document.getElementById('status');

export function updateStatus(message, type = "success") {
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    // Clear after 3 seconds for non-error messages
    if (type !== "error") {
        setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.textContent = '';
            }
        }, 3000);
    }
}

export function setAppTitle(title) {
    document.title = title;
    EventsEmit('title-changed', title);
}

export function getIconSvg(iconName, size = 16) {
    const icon = LucideIcons[iconName];
    if (!icon) return '';

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(icon, 'image/svg+xml');
    const svgEl = svgDoc.documentElement;
    svgEl.setAttribute('width', size);
    svgEl.setAttribute('height', size);
    return svgEl.outerHTML;
}

export function SidepanelCloser(excludeMe = '') {

    const explorer = document.getElementById('folderlist');
    const outliner = document.getElementById('outliner');
    const recentFilesPanel = document.getElementById('recent-files-panel');

    if (explorer && excludeMe !== 'Explorer') {
        explorer.classList.add('hidden');
    }
    if (outliner && excludeMe !== 'Outliner') {
        outliner.classList.add('hidden');
    }
    if (recentFilesPanel && excludeMe !== 'Recent Files') {
        recentFilesPanel.classList.add('hidden');
    }
}


