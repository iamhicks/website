// ==================== EDITOR COMPONENT ====================

const Editor = {
    init(kb) {
        this.kb = kb;
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Editor toolbar buttons
        document.querySelectorAll('.editor-toolbar button[data-command]').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                document.execCommand(command, false, null);
                this.focusEditor();
            });
        });

        // Note actions
        const newNoteBtn = document.getElementById('newNoteBtn');
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', () => this.kb.createNote());
        }

        // Tab management
        document.addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            if (tab) {
                const noteId = tab.dataset.noteId;
                if (e.target.closest('.tab-close')) {
                    this.kb.closeTab(noteId);
                } else {
                    this.kb.switchToTab(noteId);
                }
            }
        });
    },

    focusEditor() {
        const editor = document.getElementById('editor');
        if (editor) editor.focus();
    },

    loadNote(note) {
        const titleInput = document.getElementById('noteTitle');
        const editor = document.getElementById('editor');
        const breadcrumb = document.getElementById('breadcrumb');

        if (titleInput) titleInput.value = note.title || '';
        if (editor) editor.innerHTML = note.content || '';
        
        this.updateBreadcrumb(note.folderId || 'root');
        this.renderTags(note.tags || []);
        this.updateActiveTab(note.id);
    },

    updateBreadcrumb(folderId) {
        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        const folder = this.kb.data.folders.find(f => f.id === folderId);
        const folderName = folder ? folder.name : 'All Notes';

        breadcrumb.innerHTML = `
            <span class="breadcrumb-item" data-folder="root">All Notes</span>
            ${folderId !== 'root' ? ` > <span class="breadcrumb-item" data-folder="${folderId}">${Helpers.escapeHtml(folderName)}</span>` : ''}
        `;
    },

    renderTags(tags) {
        const container = document.getElementById('noteTags');
        if (!container) return;

        container.innerHTML = tags.map(tag => `
            <span class="tag" data-tag="${Helpers.escapeHtml(tag)}">
                ${Helpers.escapeHtml(tag)}
                <button class="tag-remove" data-tag="${Helpers.escapeHtml(tag)}"><i class="ph ph-x"></i></button>
            </span>
        `).join('');
    },

    updateActiveTab(noteId) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.noteId === noteId);
        });
    },

    renderTabs() {
        const container = document.getElementById('tabsContainer');
        if (!container) return;

        container.innerHTML = this.kb.openTabs.map(noteId => {
            const note = this.kb.data.notes.find(n => n.id === noteId);
            if (!note) return '';
            
            return `
                <div class="tab ${noteId === this.kb.activeTabId ? 'active' : ''}" data-note-id="${noteId}">
                    <span class="tab-title">${Helpers.escapeHtml(note.title || 'Untitled')}</span>
                    <button class="tab-close"><i class="ph ph-x"></i></button>
                </div>
            `;
        }).join('');
    },

    getContent() {
        const editor = document.getElementById('editor');
        return editor ? editor.innerHTML : '';
    },

    getTitle() {
        const titleInput = document.getElementById('noteTitle');
        return titleInput ? titleInput.value : '';
    },

    clear() {
        const titleInput = document.getElementById('noteTitle');
        const editor = document.getElementById('editor');
        if (titleInput) titleInput.value = '';
        if (editor) editor.innerHTML = '';
    }
};

window.Editor = Editor;
