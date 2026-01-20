// FileExplorer.js (vanilla JS, Wails-aware)

import { renderIcon } from './lib/icons.js';
import {
    ListDir,
    ReadFileContent,
    HomeDir,
    AddRecentFile,
    GetRecentFiles,
    GetLastDirectory,
    ExtractFilePath,
    ExtractFilePaths,
    ClearRecentFiles,
    RemoveRecentFile,
    OpenFileDialog
} from "../wailsjs/go/main/App.js";
import * as runtime from "../wailsjs/runtime";

export class FileExplorer {
    constructor(containerId, onSelect, onOpenFolder) {
        this.container = document.getElementById(containerId);
        this.onSelect = onSelect; // called when file is double-clicked
        this.onOpenFolder = onOpenFolder; // optional: for breadcrumbs or status
        this.currentPath = ''; // current root path being displayed
        this.startDir = '';
        this.selectedFile = null; // Track selected file
        this.recentFiles = [];
        this.recentFilesContainer = null; // For recent files panel
    }

    async init() {
        this.startDir = await HomeDir();
        // Try to get last directory from config
        try {
            const lastDir = await GetLastDirectory();
            if (lastDir && lastDir.trim()) {
                this.startDir = lastDir;
            }
        } catch (err) {
            console.log('No last directory saved, using home directory');
        }

        console.log('Starting directory:', this.startDir);
        await this.loadDirectory(this.startDir);
        await this.loadRecentFiles();
        this.createRecentFilesPanel();
    }

    async loadDirectory(path) {
        try {
            this.currentPath = path;
            const entries = await ListDir(path);
            this.render(entries, path);
            if (this.onOpenFolder) this.onOpenFolder(path);
        } catch (err) {
            console.error('Failed to load directory:', err);
            // Consider showing error in UI instead of alert
            this.showError(`Cannot open folder: ${err.message || err}`);
            // Optionally revert to previous directory
        }
    }

getFileIcon(entry) {
  if (entry.isDir) return '📁';

  const ext = entry.name.split('.').pop().toLowerCase();

  const iconMap = {
    // Documents
    'txt': '📝', 'md': '📝', 'rtf': '📝', 'odt': '📝',
    'pdf': '📕', 'epub': '📖', 'mobi': '📖',
    'doc': '📘', 'docx': '📘', 'pages': '📘',
    'xls': '📗', 'xlsx': '📗', 'numbers': '📗', 'ods': '📗',
    'ppt': '📓', 'pptx': '📓', 'keynote': '📓', 'odp': '📓',

    // Code files
    'js': '📜', 'jsx': '📜', 'mjs': '📜',
    'ts': '📜', 'tsx': '📜',
    'html': '🌐', 'htm': '🌐', 'xhtml': '🌐',
    'css': '🎨', 'scss': '🎨', 'sass': '🎨', 'less': '🎨',
    'json': '📋', 'json5': '📋',
    'xml': '📋', 'xsl': '📋', 'xslt': '📋',
    'py': '🐍', 'pyc': '🐍', 'pyd': '🐍', 'pyo': '🐍',
    'java': '☕', 'class': '☕', 'jar': '☕',
    'cpp': '⚙️', 'c': '⚙️', 'h': '⚙️', 'hpp': '⚙️', 'cc': '⚙️',
    'go': '🚀', 'rb': '💎', 'php': '🐘', 'swift': '🍎',
    'rs': '🦀', 'kt': '🍃', 'kts': '🍃', 'scala': '🔥',
    'sh': '🐧', 'bash': '🐧', 'zsh': '🐧', 'fish': '🐧',

    // Images
    'jpg': '🖼️', 'jpeg': '🖼️', 'jfif': '🖼️', 'pjpeg': '🖼️', 'pjpg': '🖼️',
    'png': '🖼️', 'gif': '🎥', 'svg': '🖼️', 'webp': '🖼️',
    'bmp': '🖼️', 'tiff': '🖼️', 'tif': '🖼️', 'ico': '🖼️',
    'psd': '🎨', 'ai': '🎨', 'eps': '🎨', 'indd': '🎨',

    // Audio/Video
    'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵',
    'ogg': '🎵', 'm4a': '🎵', 'wma': '🎵', 'aiff': '🎵',
    'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬',
    'wmv': '🎬', 'flv': '🎬', 'webm': '🎬', 'm4v': '🎬',
    '3gp': '🎬', '3g2': '🎬', 'mpeg': '🎬', 'mpg': '🎬',

    // Archives
    'zip': '🗜️', 'rar': '🗜️', '7z': '🗜️', 'tar': '🗜️',
    'gz': '🗜️', 'bz2': '🗜️', 'xz': '🗜️', 'z': '🗜️',
    'iso': '💿', 'dmg': '💿', 'toast': '💿', 'vcd': '💿',

    // Executables
    'exe': '⚡', 'msi': '⚡', 'app': '⚡', 'dmg': '⚡',
    'bin': '⚡', 'deb': '⚡', 'rpm': '⚡', 'apk': '⚡',

    // Data files
    'csv': '📊', 'tsv': '📊', 'dbf': '📊',
    'sql': '🗃️', 'db': '🗃️', 'sqlite': '🗃️', 'sqlite3': '🗃️',
    'mdb': '🗃️', 'accdb': '🗃️', 'frm': '🗃️', 'myd': '🗃️',

    // Configuration
    'ini': '⚙️', 'conf': '⚙️', 'config': '⚙️',
    'yaml': '⚙️', 'yml': '⚙️',
    'toml': '⚙️',
    'env': '🔧', 'properties': '🔧',

    // Markup & Design
    'markdown': '📝', 'mdx': '📝',
    'sketch': '🎨', 'fig': '🎨', 'xd': '🎨',

    // Virtualization & Containers
    'dockerfile': '🐳', 'dockerignore': '🐳',
    'vagrantfile': '🧳',

    // Game files
    'unity': '🎮', 'blend': '🎮', 'fbx': '🎮',

    // Other common types
    'log': '📋', 'bak': '💾', 'tmp': '📄',
    'lock': '🔒', 'key': '🔑', 'pem': '🔑',
    'gitignore': '🦊', 'dockerignore': '🐳',
    'license': '📜', 'readme': '📖'
  };

  return iconMap[ext] || '📄'; // Default icon
}


    showError(message) {
        // Create a temporary error toast/notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        // Style and position as needed
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    filterFiles(searchTerm) {
        const items = this.container.querySelectorAll('.file-item');
        items.forEach(item => {
            const fileName = item.querySelector('span').textContent;
            const isMatch = fileName.toLowerCase().includes(searchTerm.toLowerCase());
            item.style.display = isMatch ? '' : 'none';
        });
    }

    render(entries, basePath) {
        this.container.innerHTML = '';
        this.selectedFile = null; // Clear selection when directory changes

        // Optional: Up button
        if (basePath !== '/') {
            const upItem = this.createItem({ name: '..', isDir: true }, basePath);
            upItem.classList.add('up-item');
            upItem.addEventListener('click', () => {
                const parent = basePath.endsWith('/')
                    ? basePath.slice(0, -1)
                    : basePath;
                const parentPath = parent.substring(0, parent.lastIndexOf('/')) || '/';
                this.loadDirectory(parentPath);
            });
            this.container.appendChild(upItem);
        }

        // Sort: directories first, then files, both alphabetically
        const sortedEntries = entries.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
        });

        sortedEntries.forEach(entry => {
            const item = this.createItem(entry, basePath);
            this.container.appendChild(item);
        });
    }

    createItem(entry, basePath) {
        const div = document.createElement('div');
        div.className = `file-item ${entry.isDir ? 'folder' : 'file'}`;
        div.title = entry.name;
        div.dataset.path = basePath === '/'
            ? `/${entry.name}`
            : `${basePath}/${entry.name}`;

        // Icon
        const icon = document.createElement('i');
        icon.className = 'item-icon';
        icon.textContent = this.getFileIcon(entry); //entry.isDir ? '📁' : '📄';
        icon.style.marginRight = '8px';

        const name = document.createElement('span');
        name.textContent = entry.name;
        name.style.userSelect = 'none';

        // Add recent file indicator (if file is in recent list)
        if (!entry.isDir && this.isRecentFile(div.dataset.path)) {
            // const recentBadge = document.createElement('span');
            // recentBadge.className = 'recent-badge';
            // recentBadge.textContent = '★';
            // recentBadge.title = 'Recently opened';
            // recentBadge.style.marginLeft = '8px';
            // recentBadge.style.color = '#ffcc00';
            // div.appendChild(recentBadge);
        }

        div.appendChild(icon);
        div.appendChild(name);

        // SINGLE CLICK: For files -> selection only, for folders -> navigate
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            const fullPath = div.dataset.path;

            if (entry.name === '..') return; // handled separately

            if (entry.isDir) {
                // Folders: navigate on single click
                this.loadDirectory(fullPath);
            } else {
                // Files: select on single click (highlight only)
                this.selectFile(div, fullPath);
            }
        });

        // DOUBLE CLICK: For files -> open file and add to recent
        div.addEventListener('dblclick', async (e) => {
            e.stopPropagation();
            const fullPath = div.dataset.path;

            if (entry.name === '..') return;

            if (!entry.isDir && this.onSelect) {
                // Add to recent files first
                await this.addToRecentFiles(fullPath);
                // Then open file
                this.selectFile(div, fullPath);
                this.onSelect(fullPath);


            }
        });

        // Right-click context menu
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!entry.isDir) {
                this.showFileContextMenu(e, div.dataset.path);
            }
        });

        return div;
    }

    // Method to handle file selection (highlight)
    selectFile(element, filePath) {
        // Remove selection from previously selected file
        const previouslySelected = this.container.querySelector('.file-item.selected');
        if (previouslySelected && previouslySelected !== element) {
            previouslySelected.classList.remove('selected');
        }

        // Select new file
        element.classList.add('selected');
        this.selectedFile = filePath;
    }

    // Check if file is in recent list
    isRecentFile(filePath) {
        return this.recentFiles.some(recentPath => recentPath === filePath);
    }

    // Add file to recent files
    async addToRecentFiles(filePath) {
        // Check if already in recent files before calling API
        if (this.isRecentFile(filePath)) {
            // Just update the timestamp via API but skip refresh if unnecessary
            const result = await AddRecentFile(filePath);
            // Optional: Only refresh if file order changed
            await this.loadRecentFiles();
            this.updateRecentFilesPanel();
        } else {
            // Add new file
            try {
                const result = await AddRecentFile(filePath);
                await this.loadRecentFiles();
                this.updateRecentFilesPanel();
            } catch (err) {
                console.error('Failed to add to recent files:', err);
            }
        }
    }

    // Load recent files from Go backend
    async loadRecentFiles() {
        try {
            this.recentFiles = await GetRecentFiles() || [];
        } catch (err) {
            console.error('Failed to load recent files:', err);
            this.recentFiles = [];
        }
    }

    // Create recent files panel
    createRecentFilesPanel() {
        const panel = document.createElement('div');
        panel.id = 'recent-files-panel';
        panel.className = 'recent-files-panel hidden';

        const header = document.createElement('div');
        header.className = 'recent-header';
        header.innerHTML = `
            <h3>Zuletzt verwendet</h3>
            <button id="recent-trash2" class="btn-clear-recent" title="Alle löschen" data-lucide="trash-2"></button>
        `;

        const list = document.createElement('div');
        list.id = 'recent-files-list';
        list.className = 'recent-files-list';

        panel.appendChild(header);
        panel.appendChild(list);

        const icon = renderIcon("Trash2");
        header.appendChild(icon);

        // Insert panel before the file explorer container
        this.container.parentNode.insertBefore(panel, this.container);

        // Initialize the trash icon
        //initIcons();

        // Add clear button event
        header.querySelector('.btn-clear-recent').addEventListener('click', async () => {
            await this.clearRecentFiles();
        });

        this.recentFilesContainer = list;
        this.updateRecentFilesPanel();
    }

    // Update recent files panel
    updateRecentFilesPanel() {
        if (!this.recentFilesContainer) return;

        this.recentFilesContainer.innerHTML = '';

        if (this.recentFiles.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'recent-empty';
            emptyMsg.textContent = 'Keine zuletzt verwendeten Dateien';
            this.recentFilesContainer.appendChild(emptyMsg);
            return;
        }

        this.recentFiles.forEach((filePath, index) => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.title = filePath;

            const fileName = this.getFilenameFromPath(filePath);
            const fileDir = this.getDirectoryFromPath(filePath);

            item.innerHTML = `
                <div class="recent-name">${fileName}</div>
                <div class="recent-path">${fileDir}</div>
                <button class="btn-remove-recent" data-index="${index}">×</button>
            `;

            item.addEventListener('click', async (e) => {
                if (!e.target.classList.contains('btn-remove-recent')) {
                    // Navigate to file's directory
                    const dirPath = this.getDirectoryFromPath(filePath);
                    await this.loadDirectory(dirPath);

                    // Find and select the file
                    setTimeout(() => {
                        const fileElement = this.container.querySelector(`[data-path="${filePath}"]`);
                        if (fileElement) {
                            this.selectFile(fileElement, filePath);
                            fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 100);
                }
            });

            item.addEventListener('dblclick', async (e) => {
                if (!e.target.classList.contains('btn-remove-recent') && this.onSelect) {
                    await this.addToRecentFiles(filePath); // Refresh timestamp
                    this.onSelect(filePath);
                }
            });

            // Remove button event
            const removeBtn = item.querySelector('.btn-remove-recent');
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.removeRecentFile(filePath);
            });

            this.recentFilesContainer.appendChild(item);
        });
    }

    // Clear all recent files
    async clearRecentFiles() {
        try {
            await ClearRecentFiles();
            await this.loadRecentFiles();
            this.updateRecentFilesPanel();
        } catch (err) {
            console.error('Failed to clear recent files:', err);
        }
    }

    // Remove specific recent file
    async removeRecentFile(filePath) {
        try {
            await RemoveRecentFile(filePath);
            await this.loadRecentFiles();
            this.updateRecentFilesPanel();
        } catch (err) {
            console.error('Failed to remove recent file:', err);
        }
    }

    // Show context menu for files
    showFileContextMenu(e, filePath) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
            // Also remove any existing event listeners
            if (existingMenu._closeHandler) {
                document.removeEventListener('click', existingMenu._closeHandler);
            }
        }

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'absolute';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.backgroundColor = 'white';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '4px';
        menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        menu.style.zIndex = '1000';

        menu.innerHTML = `
            <div class="context-item" data-action="open">Öffnen</div>
            <div class="context-item" data-action="add-recent">Zu Zuletzt hinzufügen</div>
            <div class="context-item" data-action="show-in-folder">Im Ordner anzeigen</div>
            <hr>
            <div class="context-item" data-action="copy-path">Pfad kopieren</div>
        `;

        document.body.appendChild(menu);

        // Menu item click handler
        menu.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;

            switch (action) {
                case 'open':
                    if (this.onSelect) {
                        await this.addToRecentFiles(filePath);
                        this.onSelect(filePath);
                        console.log("switch open");
                    }
                    break;

                case 'add-recent':
                    await this.addToRecentFiles(filePath);
                    break;

                case 'show-in-folder':
                    const dirPath = this.getDirectoryFromPath(filePath);
                    await this.loadDirectory(dirPath);
                    setTimeout(() => {
                        const fileElement = this.container.querySelector(`[data-path="${filePath}"]`);
                        if (fileElement) {
                            this.selectFile(fileElement, filePath);
                            fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 100);
                    break;

                case 'copy-path':
                    navigator.clipboard.writeText(filePath);
                    break;
            }

            menu.remove();
        });

        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        };

        menu._closeHandler = closeMenu; // Store reference for cleanup

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    // Utility methods
    getFilenameFromPath(fullPath) {
        if (!fullPath) return '';
        const separator = fullPath.includes('/') ? '/' : '\\';
        const lastIndex = fullPath.lastIndexOf(separator);
        return lastIndex === -1 ? fullPath : fullPath.substring(lastIndex + 1);
    }

    getDirectoryFromPath(fullPath) {
        if (!fullPath) return '';
        const separator = fullPath.includes('/') ? '/' : '\\';
        const lastIndex = fullPath.lastIndexOf(separator);
        return lastIndex === -1 ? '' : fullPath.substring(0, lastIndex);
    }

    // // Open file dialog
    async openFileDialog() {
        try {
            const selectedFile = await OpenFileDialog(this.currentPath);
            if (selectedFile && !selectedFile.startsWith('Error:')) {
                await this.addToRecentFiles(selectedFile);
                const dirPath = this.getDirectoryFromPath(selectedFile);
                await this.loadDirectory(dirPath);

                // Select the file
                setTimeout(() => {
                    const fileElement = this.container.querySelector(`[data-path="${selectedFile}"]`);
                    if (fileElement) {
                        this.selectFile(fileElement, selectedFile);
                        fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);

                return selectedFile;
            }
        } catch (err) {
            console.error('Failed to open file dialog:', err);
        }
        return null;
    }

    // Extract filepath from string (useful for drag/drop or paste)
    async extractFilePathFromString(input) {
        try {
            return await ExtractFilePath(input);
        } catch (err) {
            console.error('Failed to extract filepath:', err);
            return null;
        }
    }

    getSelectedFile() {
        return this.selectedFile;
    }

    openSelectedFile() {
        console.log("Opening selected file:", this.selectedFile);
        if (this.selectedFile && this.onSelect) {
            this.onSelect(this.selectedFile);
            this.clearSelection();
        }
    }

    clearSelection() {
        this.selectedFile = null;
        // Remove visual selection from all file items
        const fileItems = this.container.querySelectorAll('.file-item');
        fileItems.forEach(item => item.classList.remove('selected'));
        fileItems.forEach(item => item.classList.remove('active'));
    }

    refresh() {
        this.loadDirectory(this.currentPath);
    }

    // Add keyboard shortcuts
    attachKeyboardShortcuts() {
        document.addEventListener('keydown', async (e) => {
            // Ctrl/Cmd + O: Open file dialog
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                await this.openFileDialog();
            }

            // Enter: Open selected file
            if (e.key === 'Enter' && this.selectedFile) {
                this.openSelectedFile();
                this.clearSelection();
            }

            // F5: Refresh
            if (e.key === 'F5') {
                e.preventDefault();
                this.refresh();
            }
        });
    }
}