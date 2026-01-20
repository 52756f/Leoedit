import { renderIcon } from './lib/icons.js';
import { Logger } from './logger.js';
export class LeftToolbar {
    constructor(toolbarId = 'asideToolbar') {
        this.toolbar = document.getElementById(toolbarId);
        if (!this.toolbar) {
            throw new Error(`Toolbar element with id "${toolbarId}" not found.`);
        }

        this.actions = new Map(); // Maps title attribute → handler function
        this.logger = new Logger("LeftToolbar");

        this.initIcons();
        this.bindEvents();
    }

    /**
     * Renders Lucide icons inside the toolbar
     */
    initIcons() {
        const toolbarButtons = document.querySelectorAll(".tool-btn");
        if (toolbarButtons) {
            toolbarButtons.forEach(ele => {
                const title = ele.getAttribute('title');
                if (title === "Explorer") {
                    const icon = renderIcon("FolderTree");
                    ele.appendChild(icon);
                }
                if (title === "Outliner") {
                    const icon = renderIcon("List");
                    ele.appendChild(icon);
                }
                if (title === "Recent Files") {
                    const icon = renderIcon("Clock");
                    ele.appendChild(icon);
                }
                if (title === "AI Fenster") {
                    const icon = renderIcon("Sparkles");
                    ele.appendChild(icon);
                }
            });
        } else {
            this.logger.error("No toolbar buttons found.");
        }
    }

    /**
     * Sets up event delegation on the toolbar
     */
    bindEvents() {
        this.toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.tool-btn');
            if (!btn) return;

            const title = btn.getAttribute('title');
            if (title && this.actions.has(title)) {
                const handler = this.actions.get(title);
                handler.call(this, e);
            }
        });
    }

    /**
     * Register a click handler for a toolbar button by its title
     * @param {string} title - The `title` attribute of the .tool-btn (e.g., "Neu")
     * @param {Function} handler - Callback function to execute
     */
    registerAction(title, handler) {
        this.actions.set(title, handler);
    }

    /**
     * Enable or disable a toolbar button by title
     * @param {string} title
     * @param {boolean} enabled
     */
    setButtonEnabled(title, enabled) {
        const btn = Array.from(this.toolbar.querySelectorAll('.tool-btn'))
            .find(b => b.getAttribute('title') === title);
        if (btn) {
            btn.style.opacity = enabled ? '1' : '0.4';
            btn.style.pointerEvents = enabled ? 'auto' : 'none';
        }
    }

    /**
     * Optional: Add tooltip (if you later use a tooltip lib or title fallback)
     */
    updateTooltip(title, newTooltip) {
        const btn = Array.from(this.toolbar.querySelectorAll('.tool-btn'))
            .find(b => b.getAttribute('title') === title);
        if (btn) {
            btn.setAttribute('title', newTooltip);
        }
    }
}