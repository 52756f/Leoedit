// PANEL Resizer
export class AIPanelResizer {
    constructor() {
        this.panel = document.getElementById('ai-panel');
        this.resizeHandle = document.getElementById('ai-resize-handle');
        this.isResizing = false;
        this.startX = 0;
        this.startWidth = 0;

        this.initResize();
    }

    initResize() {
        if (!this.resizeHandle || !this.panel) return;

        // Maus-Events für Resize
        this.resizeHandle.addEventListener('mousedown', (e) => {
            this.startResizing(e);
        });

        // Touch-Events für Mobile
        this.resizeHandle.addEventListener('touchstart', (e) => {
            this.startResizing(e.touches[0]);
        });

        // Event Listener für das Dokument
        document.addEventListener('mousemove', (e) => {
            this.handleResize(e);
        });

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                this.handleResize(e.touches[0]);
                e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('mouseup', () => {
            this.stopResizing();
        });

        document.addEventListener('touchend', () => {
            this.stopResizing();
        });

        // Doppelklick zum Zurücksetzen
        this.resizeHandle.addEventListener('dblclick', () => {
            this.resetWidth();
        });
    }

    startResizing(e) {
        this.isResizing = true;
        this.startX = e.clientX;
        this.startWidth = parseInt(getComputedStyle(this.panel).width, 10);

        // CSS-Klasse für visuelles Feedback
        this.resizeHandle.classList.add('resizing');
        this.panel.classList.add('resizing');

        // Verhindere Text-Selektion während Resize
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }

    handleResize(e) {
        if (!this.isResizing) return;

        const deltaX = this.startX - e.clientX;
        const newWidth = this.startWidth + deltaX;

        // Grenzen prüfen
        const minWidth = 300;
        const maxWidth = window.innerWidth * 0.8; // 80% der Viewport-Breite

        if (newWidth >= minWidth && newWidth <= maxWidth) {
            this.panel.style.width = `${newWidth}px`;

            // Event auslösen für andere Komponenten
            this.dispatchResizeEvent(newWidth);
        }
    }

    stopResizing() {
        if (!this.isResizing) return;

        this.isResizing = false;
        this.resizeHandle.classList.remove('resizing');
        this.panel.classList.remove('resizing');

        // Cursor und Selektion zurücksetzen
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        // Breite im localStorage speichern
        this.saveWidthToStorage();
    }

    resetWidth() {
        const defaultWidth = 400;
        this.panel.style.width = `${defaultWidth}px`;
        this.saveWidthToStorage();
        this.dispatchResizeEvent(defaultWidth);
    }

    saveWidthToStorage() {
        const width = parseInt(getComputedStyle(this.panel).width, 10);
        localStorage.setItem('aiPanelWidth', width);
    }

    loadWidthFromStorage() {
        const savedWidth = localStorage.getItem('aiPanelWidth');
        if (savedWidth && this.panel) {
            const width = parseInt(savedWidth, 10);
            const minWidth = 300;
            const maxWidth = window.innerWidth * 0.8;

            if (width >= minWidth && width <= maxWidth) {
                this.panel.style.width = `${width}px`;
            }
        }
    }

    dispatchResizeEvent(width) {
        const event = new CustomEvent('aiPanelResize', {
            detail: { width }
        });
        document.dispatchEvent(event);
    }
}