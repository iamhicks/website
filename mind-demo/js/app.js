// ==================== KNOWLEDGE BASE - MAIN APPLICATION ====================

class KnowledgeBase {
    constructor() {
        this.data = {
            folders: [
                { id: 'root', name: 'All Notes', parentId: null },
                { id: 'inbox', name: 'Inbox', parentId: null }
            ],
            notes: [],
            tags: [],
            customTemplates: [],
            settings: {
                theme: 'auto',
                sidebarCollapsed: {}
            }
        };
        this.currentNote = null;
        this.currentFolder = 'root';
        this.currentTagFilter = null;
        this.contextMenuTarget = null;
        this.draggedNote = null;
        this.draggedFolder = null;
        this.db = null;
        this.openTabs = [];
        this.activeTabId = null;

        this.init();
    }

    async init() {
        try {
            await IndexedDB.init();
            this.loadData();
            this.setupEventListeners();
            this.setupMobileGestures();
            this.applyTheme();
            this.render();

            if (this.data.notes.length === 0) {
                this.createWelcomeNote();
            }

            this.restoreSidebarState();
            console.log('App initialized successfully');
        } catch (err) {
            console.error('Initialization error:', err);
            alert('Error starting app: ' + err.message);
        }
    }

    // ==================== DATA MANAGEMENT ====================

    loadData() {
        const saved = Storage.loadData();
        if (saved) {
            this.data = { ...this.data, ...saved };
        }
    }

    saveData() {
        Storage.saveData(this.data);
    }

    // ==================== NOTE OPERATIONS ====================

    createNote(folderId = null) {
        const note = {
            id: Helpers.generateId(),
            title: '',
            content: '',
            folderId: folderId || this.currentFolder,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isFavorite: false
        };

        this.data.notes.push(note);
        this.saveData();
        this.openNote(note.id);
        this.render();

        return note;
    }

    openNote(noteId) {
        const note = this.data.notes.find(n => n.id === noteId);
        if (!note) return;

        // Add to tabs if not already open
        if (!this.openTabs.includes(noteId)) {
            this.openTabs.push(noteId);
        }

        this.activeTabId = noteId;
        this.currentNote = note;

        Editor.loadNote(note);
        Editor.renderTabs();

        // Update URL hash for direct linking
        window.location.hash = noteId;
    }

    closeTab(noteId) {
        const index = this.openTabs.indexOf(noteId);
        if (index > -1) {
            this.openTabs.splice(index, 1);
        }

        if (this.activeTabId === noteId) {
            // Switch to another tab or clear editor
            if (this.openTabs.length > 0) {
                this.switchToTab(this.openTabs[0]);
            } else {
                this.activeTabId = null;
                this.currentNote = null;
                Editor.clear();
            }
        }

        Editor.renderTabs();
    }

    switchToTab(noteId) {
        this.openNote(noteId);
    }

    updateCurrentNote() {
        if (!this.currentNote) return;

        this.currentNote.title = Editor.getTitle();
        this.currentNote.content = Editor.getContent();
        this.currentNote.updatedAt = new Date().toISOString();

        this.saveData();
        Editor.renderTabs();
        this.renderSidebar();
    }

    deleteNote(noteId) {
        if (!confirm('Delete this note?')) return;

        this.data.notes = this.data.notes.filter(n => n.id !== noteId);
        this.closeTab(noteId);
        this.saveData();
        this.render();
    }

    // ==================== RENDERING ====================

    render() {
        this.renderSidebar();
    }

    renderSidebar() {
        this.renderFolderTree();
        this.renderTagsList();
        this.renderFavorites();
    }

    renderFolderTree() {
        const container = document.getElementById('folderTree');
        if (!container) return;

        const rootFolders = this.data.folders.filter(f => 
            f.parentId === null || f.parentId === 'root'
        );

        container.innerHTML = rootFolders.map(folder => this.renderFolderNode(folder)).join('');
        this.attachFolderListeners();
    }

    renderFolderNode(folder, level = 0) {
        const children = this.data.folders.filter(f => f.parentId === folder.id);
        const notes = this.data.notes.filter(n => n.folderId === folder.id);

        return `
            <li class="folder-item" data-folder-id="${folder.id}">
                <div class="folder-header" style="padding-left: ${level * 12}px">
                    <span class="folder-toggle">${children.length > 0 ? '▼' : ''}</span>
                    <i class="ph ph-folder"></i>
                    <span class="folder-name">${Helpers.escapeHtml(folder.name)}</span>
                    <span class="folder-count">${notes.length}</span>
                </div>
                ${children.length > 0 ? `
                    <ul class="folder-children">
                        ${children.map(child => this.renderFolderNode(child, level + 1)).join('')}
                    </ul>
                ` : ''}
            </li>
        `;
    }

    renderTagsList() {
        const container = document.getElementById('tagsAlphabetical');
        if (!container) return;

        const tagCounts = {};
        this.data.notes.forEach(note => {
            (note.tags || []).forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        const sortedTags = Object.entries(tagCounts)
            .sort(([a], [b]) => a.localeCompare(b));

        container.innerHTML = sortedTags.map(([tag, count]) => `
            <div class="tag-item" data-tag="${Helpers.escapeHtml(tag)}">
                <span class="tag-name">${Helpers.escapeHtml(tag)}</span>
                <span class="tag-count">${count}</span>
            </div>
        `).join('');

        container.querySelectorAll('.tag-item').forEach(item => {
            item.addEventListener('click', () => {
                this.filterByTag(item.dataset.tag);
            });
        });
    }

    renderFavorites() {
        const container = document.getElementById('favoritesTree');
        const section = document.getElementById('favoritesSectionContainer');
        
        const favorites = this.data.notes.filter(n => n.isFavorite);
        
        if (section) {
            section.style.display = favorites.length > 0 ? 'block' : 'none';
        }

        if (!container) return;

        container.innerHTML = favorites.map(note => `
            <li class="note-item favorite" data-note-id="${note.id}">
                <i class="ph ph-star"></i>
                <span>${Helpers.escapeHtml(note.title || 'Untitled')}</span>
            </li>
        `).join('');

        container.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                this.openNote(item.dataset.noteId);
            });
        });
    }

    // ==================== EVENT LISTENERS ====================

    setupEventListeners() {
        // Initialize components
        Sidebar.init(this);
        Editor.init(this);
        AI.init(this);

        // Window events
        window.addEventListener('beforeunload', () => {
            this.updateCurrentNote();
        });

        // Auto-save on input
        const editor = document.getElementById('editor');
        const titleInput = document.getElementById('noteTitle');

        if (editor) {
            editor.addEventListener('input', Helpers.debounce(() => {
                this.updateCurrentNote();
            }, 500));
        }

        if (titleInput) {
            titleInput.addEventListener('input', Helpers.debounce(() => {
                this.updateCurrentNote();
            }, 500));
        }
    }

    attachFolderListeners() {
        document.querySelectorAll('.folder-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.folder-actions')) return;
                
                const folderId = header.closest('.folder-item').dataset.folderId;
                this.currentFolder = folderId;
                this.render();
            });
        });
    }

    setupMobileGestures() {
        // Touch handling for mobile
        let touchStartX = 0;
        const sidebar = document.getElementById('sidebar');

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;

            // Swipe left to close sidebar
            if (diff > 50 && sidebar?.classList.contains('mobile-open')) {
                Sidebar.closeMobile();
            }
        });
    }

    // ==================== THEME ====================

    applyTheme() {
        const theme = this.data.settings.theme || 'auto';
        const isDark = theme === 'dark' || 
            (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }

    // ==================== UTILITY ====================

    filterByTag(tag) {
        this.currentTagFilter = tag;
        // Implementation for tag filtering
        console.log('Filter by tag:', tag);
    }

    restoreSidebarState() {
        Sidebar.restoreState();
    }

    createWelcomeNote() {
        const welcome = {
            id: Helpers.generateId(),
            title: 'Welcome to Mind',
            content: `<p>Welcome to your personal knowledge base! Here are some quick tips to get started:</p>
<ul>
<li>Create notes with the + button</li>
<li>Organize with folders and tags</li>
<li>Search everything instantly</li>
<li>Use AI assistance for suggestions</li>
</ul>`,
            folderId: 'root',
            tags: ['welcome', 'getting-started'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isFavorite: true
        };

        this.data.notes.push(welcome);
        this.saveData();
        this.render();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Storage.clearOldBackups();
    window.kb = new KnowledgeBase();
});
