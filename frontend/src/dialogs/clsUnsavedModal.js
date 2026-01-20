// Modal-Instanz erstellen
//const modal = new UnsavedChangesModal();

// Modal anzeigen
//modal.show();

// Modal verstecken
//modal.hide();

// Status abfragen
//const isClosing = modal.getIsClosing();

export class UnsavedChangesModal {
    constructor() {
        this.isClosing = false;
        this.modalElement = document.getElementById('unsavedModal');

        // Event-Listener für Buttons einrichten
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.handleSave();
        });

        document.getElementById('dontSaveBtn').addEventListener('click', () => {
            this.handleDontSave();
        });

        document.getElementById('cancelCloseBtn').addEventListener('click', () => {
            this.handleCancel();
        });
    }

    // Zeige das benutzerdefinierte Modal
    show() {
        this.modalElement.style.display = 'flex';
        this.isClosing = true; // Markiere, dass wir im Schließ-Modus sind
    }

    // Verstecke das Modal
    hide() {
        this.modalElement.style.display = 'none';
        this.isClosing = false;
    }

    // Getter für den Schließ-Status
    getIsClosing() {
        return this.isClosing;
    }

    // Setter für den Schließ-Status
    setIsClosing(value) {
        this.isClosing = value;
    }

    // Event-Handler
    handleSave() {
        window.runtime.EventsEmit('close-action', 'save');
        this.hide();
    }

    handleDontSave() {
        window.runtime.EventsEmit('close-action', 'dont-save');
        this.hide();
    }

    handleCancel() {
        window.runtime.EventsEmit('close-action', 'cancel');
        this.hide();
    }

    // Alternative: Zentralisierte Event-Verarbeitung
    handleAction(action) {
        window.runtime.EventsEmit('close-action', action);
        this.hide();
    }
}