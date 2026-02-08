// ==================== SIDEBAR COMPONENT ====================

const Sidebar = {
    init(kb) {
        this.kb = kb;
        this.setupEventListeners();
        this.restoreState();
    },

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Helpers.debounce((e) => {
                this.handleSearch(e.target.value);
            }, 300));
        }

        // Add folder button
        const addFolderBtn = document.getElementById('addFolderBtn');
        if (addFolderBtn) {
            addFolderBtn.addEventListener('click', () => this.createFolder());
        }

        // Section toggles
        document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.section-actions')) return;
                this.toggleSection(header);
            });
        });

        // Mobile menu
        const menuBtn = document.getElementById('menuBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (menuBtn) {
            menuBtn.addEventListener('click', () => this.openMobile());
        }
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => this.closeMobile());
        }

        // Sidebar resize
        const resizeHandle = document.getElementById('sidebarResizeHandle');
        if (resizeHandle) {
            this.setupResize(resizeHandle);
        }
    },

    setupResize(handle) {
        let isResizing = false;
        let startX, startWidth;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            const sidebar = document.getElementById('sidebar');
            startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
            document.body.style.cursor = 'ew-resize';
        });

        document.addEventListener('mousemove', Helpers.throttle((e) => {
            if (!isResizing) return;
            const sidebar = document.getElementById('sidebar');
            const newWidth = startWidth + e.clientX - startX;
            if (newWidth >= 200 && newWidth <= 500) {
                sidebar.style.width = newWidth + 'px';
                this.kb.data.settings.sidebarWidth = newWidth;
                this.kb.saveData();
            }
        }, 16));

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    },

    toggleSection(header) {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.section-toggle');
        
        if (content && toggle) {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? 'block' : 'none';
            toggle.textContent = isCollapsed ? '▼' : '▶';
            
            const section = header.dataset.section;
            if (section) {
                this.kb.data.settings.sidebarCollapsed[section] = !isCollapsed;
                this.kb.saveData();
            }
        }
    },

    handleSearch(query) {
        const resultsContainer = document.getElementById('searchResults');
        
        if (!query.trim()) {
            DOM.hide(resultsContainer);
            return;
        }

        const results = this.kb.data.notes.filter(note => {
            const text = (note.title + ' ' + Helpers.stripHtml(note.content)).toLowerCase();
            return text.includes(query.toLowerCase());
        });

        this.renderSearchResults(results, resultsContainer);
    },

    renderSearchResults(results, container) {
        if (!container) return;
        
        container.innerHTML = results.map(note => `
            <div class="search-result-item" data-note-id="${note.id}">
                <div class="search-result-title">${Helpers.escapeHtml(note.title || 'Untitled')}</div>
                <div class="search-result-preview">${Helpers.escapeHtml(Helpers.truncate(Helpers.stripHtml(note.content), 60))}</div>
            </div>
        `).join('');

        container.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.kb.openNote(noteId);
                this.closeMobile();
            });
        });

        DOM.show(container);
    },

    createFolder() {
        const name = prompt('Folder name:');
        if (name && name.trim()) {
            const folder = {
                id: Helpers.generateId(),
                name: name.trim(),
                parentId: this.kb.currentFolder === 'root' ? null : this.kb.currentFolder
            };
            this.kb.data.folders.push(folder);
            this.kb.saveData();
            this.kb.render();
        }
    },

    openMobile() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.add('mobile-open');
        if (overlay) overlay.classList.add('active');
    },

    closeMobile() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    },

    restoreState() {
        // Restore collapsed sections
        Object.entries(this.kb.data.settings.sidebarCollapsed || {}).forEach(([section, collapsed]) => {
            if (collapsed) {
                const header = document.querySelector(`.section-header[data-section="${section}"]`);
                if (header) {
                    const content = header.nextElementSibling;
                    const toggle = header.querySelector('.section-toggle');
                    if (content) content.style.display = 'none';
                    if (toggle) toggle.textContent = '▶';
                }
            }
        });

        // Restore width
        if (this.kb.data.settings.sidebarWidth) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.style.width = this.kb.data.settings.sidebarWidth + 'px';
            }
        }
    }
};

window.Sidebar = Sidebar;
