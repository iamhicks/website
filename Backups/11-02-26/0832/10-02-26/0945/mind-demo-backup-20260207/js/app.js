        // ==================== EMERGENCY CLEANUP ====================
        // Clear old backups first to prevent quota errors on startup
        (function() {
            try {
                localStorage.removeItem('kb_data_backup');
                localStorage.removeItem('kb_backup_date');
                console.log('Emergency cleanup: cleared old backups');
            } catch (e) {
                console.warn('Cleanup failed:', e);
            }
        })();

        // ==================== KNOWLEDGE BASE APP ====================

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
                this.openTabs = []; // Array of note IDs
                this.activeTabId = null;

                this.init();
            }

            async init() {
                try {
                    await this.initIndexedDB();
                    this.loadData();
                    // this.autoBackup(); // DISABLED: Temporarily disabled to fix quota error
                    this.setupEventListeners();
                    this.setupMobileGestures();
                    this.applyTheme();
                    this.render();

                    // Create welcome note if empty
                    if (this.data.notes.length === 0) {
                        this.createWelcomeNote();
                    }

                    // Restore sidebar width and collapsed state
                    this.restoreSidebarState();

                    console.log('App initialized successfully');
                } catch (err) {
                    console.error('Initialization error:', err);
                    alert('Error starting app: ' + err.message);
                }
            }

            autoBackup() {
                // Silently create a backup if we have data
                try {
                    const data = localStorage.getItem('kb_data');
                    if (data && data.length > 100) { // Only backup if substantial data exists
                        // Clear old backup first to free up space
                        localStorage.removeItem('kb_data_backup');
                        localStorage.removeItem('kb_backup_date');
                        // Then save new backup
                        localStorage.setItem('kb_data_backup', data);
                        localStorage.setItem('kb_backup_date', new Date().toISOString());
                        console.log('Auto-backup created');
                    }
                } catch (e) {
                    // Quota exceeded or other error - silently skip backup
                    console.warn('Auto-backup skipped:', e.message);
                }
            }

            restoreSidebarState() {
                const sidebar = document.getElementById('sidebar');
                if (!sidebar) return;

                // Restore width
                if (this.data.settings.sidebarWidth) {
                    sidebar.style.width = this.data.settings.sidebarWidth + 'px';
                }

                // Restore collapsed state
                if (this.data.settings.sidebarCollapsed === true) {
                    sidebar.classList.add('collapsed');
                }
            }

            // ==================== INDEXEDDB ====================

            initIndexedDB() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('KnowledgeBase', 1);

                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => {
                        this.db = request.result;
                        resolve();
                    };

                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains('attachments')) {
                            db.createObjectStore('attachments', { keyPath: 'id' });
                        }
                    };
                });
            }

            async saveAttachment(id, data) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['attachments'], 'readwrite');
                    const store = transaction.objectStore('attachments');
                    const request = store.put({ id, data, timestamp: Date.now() });
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            async getAttachment(id) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['attachments'], 'readonly');
                    const store = transaction.objectStore('attachments');
                    const request = store.get(id);
                    request.onsuccess = () => resolve(request.result?.data);
                    request.onerror = () => reject(request.error);
                });
            }

            // ==================== DATA PERSISTENCE ====================

            loadData() {
                const saved = localStorage.getItem('kb_data');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        // Validate data structure before merging
                        if (parsed && typeof parsed === 'object') {
                            this.data = { ...this.data, ...parsed };
                            // Ensure critical arrays exist
                            if (!Array.isArray(this.data.folders)) this.data.folders = [];
                            if (!Array.isArray(this.data.notes)) this.data.notes = [];
                            if (!Array.isArray(this.data.tags)) this.data.tags = [];
                            if (!this.data.settings) this.data.settings = {};
                            this.repairData();
                        } else {
                            console.error('Invalid data structure, using defaults');
                        }
                    } catch (e) {
                        console.error('Failed to load data:', e);
                        // Try to restore from backup
                        const backup = localStorage.getItem('kb_data_backup');
                        if (backup) {
                            try {
                                const parsed = JSON.parse(backup);
                                this.data = { ...this.data, ...parsed };
                                console.log('Restored from backup');
                                this.showToast('Restored from backup', 'success');
                            } catch (backupErr) {
                                console.error('Backup also corrupted:', backupErr);
                            }
                        }
                    }
                }
            }

            repairData() {
                // Fix corrupted parent references
                this.data.folders.forEach(folder => {
                    // Fix self-referencing folders (inbox parent = inbox, etc.)
                    if (folder.parentId === folder.id) {
                        console.log(`Repairing self-referencing folder: ${folder.name}`);
                        folder.parentId = null;
                    }
                    // Fix folders pointing to 'root' - should be null
                    if (folder.parentId === 'root') {
                        folder.parentId = null;
                    }
                    // Fix folders pointing to non-existent parents
                    if (folder.parentId && !this.data.folders.find(f => f.id === folder.parentId)) {
                        console.log(`Repairing orphaned folder: ${folder.name}`);
                        folder.parentId = null;
                    }
                });
                this.saveData();
            }

            saveData() {
                try {
                    localStorage.setItem('kb_data', JSON.stringify(this.data));
                } catch (e) {
                    if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                        console.error('Storage quota exceeded. Try deleting some notes or images.');
                        alert('Storage is full. Please delete some notes or images to save new data.');
                    } else {
                        console.error('Failed to save data:', e);
                    }
                    throw e;
                }
            }

            // ==================== THEME ====================

            applyTheme() {
                const theme = this.data.settings.theme || 'dark';
                const isDark = theme === 'dark';
                
                if (isDark) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
                
                // Update theme button icon
                const themeBtn = document.getElementById('themeBtn');
                if (themeBtn) {
                    themeBtn.innerHTML = isDark ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
                    themeBtn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
                }
            }

            toggleTheme() {
                const current = this.data.settings.theme;
                // Toggle between light and dark only (no auto)
                const next = current === 'dark' ? 'light' : 'dark';
                this.data.settings.theme = next;
                this.applyTheme();
                this.saveData();
            }

            setTheme(theme) {
                this.data.settings.theme = theme;
                this.applyTheme();
                this.saveData();
            }

            // ==================== FOLDER OPERATIONS ====================

            createFolder(name, parentId = null) {
                const folder = {
                    id: 'folder_' + Date.now(),
                    name: name.trim(),
                    parentId: parentId
                };
                this.data.folders.push(folder);
                this.saveData();
                this.render();
                this.showToast('Folder created', 'success');
                return folder;
            }

            renameFolder(id, newName) {
                const folder = this.data.folders.find(f => f.id === id);
                if (folder && !this.isSystemFolder(id)) {
                    folder.name = newName.trim();
                    this.saveData();
                    this.render();
                    this.showToast('Folder renamed', 'success');
                }
            }

            moveFolder(folderId, newParentId) {
                const folder = this.data.folders.find(f => f.id === folderId);
                if (folder && !this.isSystemFolder(folderId)) {
                    // Prevent moving into itself or its descendants
                    if (newParentId === folderId || this.getChildFolderIds(folderId).includes(newParentId)) {
                        this.showToast('Cannot move folder into itself', 'error');
                        return;
                    }
                    folder.parentId = newParentId;
                    this.saveData();
                    this.render();
                    this.showToast('Folder moved', 'success');
                }
            }

            isDescendant(ancestorId, descendantId) {
                // Check if descendantId is a descendant of ancestorId (to prevent cycles)
                let current = this.data.folders.find(f => f.id === descendantId);
                while (current) {
                    if (current.parentId === ancestorId) return true;
                    current = this.data.folders.find(f => f.id === current.parentId);
                }
                return false;
            }

            reorderFolder(draggedFolderId, targetFolderId, insertBefore) {
                const draggedFolder = this.data.folders.find(f => f.id === draggedFolderId);
                const targetFolder = this.data.folders.find(f => f.id === targetFolderId);

                if (!draggedFolder || !targetFolder) return;

                // Only reorder if same parent
                if (draggedFolder.parentId !== targetFolder.parentId) {
                    // Move to same parent as target
                    draggedFolder.parentId = targetFolder.parentId;
                }

                // Get folders with same parent
                const siblings = this.data.folders.filter(f => f.parentId === targetFolder.parentId);
                const draggedIndex = siblings.findIndex(f => f.id === draggedFolderId);
                const targetIndex = siblings.findIndex(f => f.id === targetFolderId);

                if (draggedIndex === -1 || targetIndex === -1) return;

                // Remove dragged folder from current position
                siblings.splice(draggedIndex, 1);

                // Calculate new index
                let newIndex = targetIndex;
                if (draggedIndex < targetIndex && !insertBefore) {
                    newIndex = targetIndex;
                } else if (draggedIndex > targetIndex && insertBefore) {
                    newIndex = targetIndex;
                } else if (draggedIndex < targetIndex && insertBefore) {
                    newIndex = targetIndex - 1;
                } else if (draggedIndex > targetIndex && !insertBefore) {
                    newIndex = targetIndex + 1;
                }

                // Insert at new position
                siblings.splice(newIndex, 0, draggedFolder);

                // Update main array to match new order
                const otherFolders = this.data.folders.filter(f => f.parentId !== targetFolder.parentId);
                this.data.folders = [...otherFolders, ...siblings];

                this.saveData();
                this.render();
                this.showToast('Folder reordered', 'success');
            }

            addFolderToFavorites(id) {
                const folder = this.data.folders.find(f => f.id === id);
                if (folder) {
                    if (!this.data.settings.favoriteFolders) {
                        this.data.settings.favoriteFolders = [];
                    }
                    if (!this.data.settings.favoriteFolders.includes(id)) {
                        this.data.settings.favoriteFolders.push(id);
                        this.saveData();
                        this.renderFavorites();
                        this.showToast('Added to favorites', 'success');
                    } else {
                        this.showToast('Already in favorites', 'info');
                    }
                }
            }

            renderFavorites() {
                const favoritesContainer = document.getElementById('favoritesSectionContainer');
                const favoritesTree = document.getElementById('favoritesTree');
                const favoriteIds = this.data.settings.favoriteFolders || [];

                if (favoriteIds.length === 0) {
                    favoritesContainer.style.display = 'none';
                    return;
                }

                favoritesContainer.style.display = 'block';
                favoritesTree.innerHTML = '';

                // Track expanded state in favorites separately
                if (!this.data.settings.favoritesExpanded) {
                    this.data.settings.favoritesExpanded = {};
                }

                favoriteIds.forEach(folderId => {
                    const folder = this.data.folders.find(f => f.id === folderId);
                    if (folder) {
                        const li = document.createElement('li');
                        li.className = 'folder-item';

                        const noteCount = this.data.notes.filter(n => n.folderId === folderId).length;
                        const hasChildren = this.data.folders.some(f => f.parentId === folder.id);
                        const isExpanded = this.data.settings.favoritesExpanded[folder.id];

                        li.innerHTML = `
                            <div class="folder-header ${this.currentFolder === folder.id ? 'active' : ''}"
                                 data-folder="${folder.id}"
                                 style="padding-left: 8px;">
                                ${hasChildren ? `<span class="folder-toggle ${isExpanded ? '' : 'collapsed'}">${isExpanded ? '▼' : '▶'}</span>` : '<span class="folder-toggle" style="visibility: hidden;">▼</span>'}
                                <span class="folder-icon"><i class="ph ph-star"></i></span>
                                <span class="folder-name">${this.escapeHtml(folder.name)}</span>
                                <span class="folder-count">${noteCount}</span>
                                <div class="folder-actions">
                                    <button class="folder-action-btn more-menu" title="More options"><i class="ph ph-dots-three"></i></button>
                                    <div class="folder-dropdown" id="dropdown-fav-${folder.id}">
                                        <div class="folder-dropdown-item" data-action="remove-favorite">
                                            <span class="folder-dropdown-icon"><i class="ph ph-star"></i></span>
                                            <span>Remove from Favorites</span>
                                        </div>
                                        <div class="folder-dropdown-item" data-action="rename">
                                            <span class="folder-dropdown-icon"><i class="ph ph-pencil-simple"></i></span>
                                            <span>Rename</span>
                                        </div>
                                        <div class="folder-dropdown-divider"></div>
                                        <div class="folder-dropdown-item delete" data-action="delete">
                                            <span class="folder-dropdown-icon"><i class="ph ph-trash"></i></span>
                                            <span>Move to Trash</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;

                        const header = li.querySelector('.folder-header');
                        header.addEventListener('click', (e) => {
                            if (e.target.classList.contains('folder-action-btn') || e.target.closest('.folder-dropdown')) return;
                            this.selectFolder(folder.id);
                        });

                        // Toggle expand/collapse
                        const toggle = li.querySelector('.folder-toggle');
                        if (toggle && hasChildren) {
                            toggle.addEventListener('click', (e) => {
                                e.stopPropagation();
                                // Get current state at click time, not render time
                                const currentExpanded = !!this.data.settings.favoritesExpanded?.[folder.id];
                                this.data.settings.favoritesExpanded[folder.id] = !currentExpanded;
                                this.saveData();
                                this.renderFavorites();
                            });
                        }

                        // More menu button
                        const moreMenuBtn = li.querySelector('.folder-action-btn.more-menu');
                        const dropdown = li.querySelector(`#dropdown-fav-${folder.id}`);

                        if (moreMenuBtn && dropdown) {
                            moreMenuBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                document.querySelectorAll('.folder-dropdown.show').forEach(d => {
                                    if (d !== dropdown) d.classList.remove('show');
                                });
                                dropdown.classList.toggle('show');
                            });

                            dropdown.querySelectorAll('.folder-dropdown-item').forEach(item => {
                                item.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    const action = item.dataset.action;
                                    dropdown.classList.remove('show');

                                    switch(action) {
                                        case 'remove-favorite':
                                            this.removeFolderFromFavorites(folder.id);
                                            break;
                                        case 'rename':
                                            this.renameFolder(folder.id);
                                            break;
                                        case 'delete':
                                            this.deleteFolder(folder.id);
                                            break;
                                    }
                                });
                            });
                        }

                        // Render children if expanded
                        if (isExpanded && hasChildren) {
                            const childrenUl = this.renderFolderChildren(folder.id, 1, true);
                            if (childrenUl) {
                                li.appendChild(childrenUl);
                            }
                        }

                        // Drag to reorder favorites
                        li.draggable = true;
                        li.addEventListener('dragstart', (e) => {
                            this.draggedFavoriteIndex = favoriteIds.indexOf(folder.id);
                            li.style.opacity = '0.5';
                            e.dataTransfer.effectAllowed = 'move';
                        });

                        li.addEventListener('dragend', () => {
                            li.style.opacity = '';
                            this.draggedFavoriteIndex = null;
                            document.querySelectorAll('.folder-item').forEach(item => {
                                item.style.borderTop = '';
                                item.style.borderBottom = '';
                            });
                        });

                        li.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            if (this.draggedFavoriteIndex === null) return;
                            
                            const currentIndex = favoriteIds.indexOf(folder.id);
                            if (currentIndex === this.draggedFavoriteIndex) return;
                            
                            const rect = li.getBoundingClientRect();
                            const midpoint = rect.top + rect.height / 2;
                            
                            if (e.clientY < midpoint) {
                                li.style.borderTop = '2px solid var(--accent)';
                                li.style.borderBottom = '';
                            } else {
                                li.style.borderTop = '';
                                li.style.borderBottom = '2px solid var(--accent)';
                            }
                        });

                        li.addEventListener('dragleave', () => {
                            li.style.borderTop = '';
                            li.style.borderBottom = '';
                        });

                        li.addEventListener('drop', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            li.style.borderTop = '';
                            li.style.borderBottom = '';
                            
                            if (this.draggedFavoriteIndex === null) return;
                            
                            const currentIndex = favoriteIds.indexOf(folder.id);
                            if (currentIndex === this.draggedFavoriteIndex) return;
                            
                            const rect = li.getBoundingClientRect();
                            const midpoint = rect.top + rect.height / 2;
                            let newIndex = currentIndex;
                            
                            if (e.clientY > midpoint) {
                                newIndex = currentIndex + 1;
                            }
                            
                            // Reorder
                            const [moved] = this.data.settings.favoriteFolders.splice(this.draggedFavoriteIndex, 1);
                            if (newIndex > this.draggedFavoriteIndex) {
                                newIndex--;
                            }
                            this.data.settings.favoriteFolders.splice(newIndex, 0, moved);
                            
                            this.saveData();
                            this.renderFavorites();
                            this.showToast('Favorites reordered', 'success');
                        });

                        favoritesTree.appendChild(li);
                    }
                });
            }

            renderFolderChildren(parentId, level = 0, useFavoritesState = false) {
                const folders = this.data.folders.filter(f => f.parentId === parentId);
                if (folders.length === 0) return null;

                const ul = document.createElement('ul');
                ul.className = 'folder-children';
                ul.style.paddingLeft = '12px';

                folders.forEach(folder => {
                    const li = document.createElement('li');
                    li.className = 'folder-item';

                    const noteCount = this.data.notes.filter(n => n.folderId === folder.id).length;
                    const hasChildren = this.data.folders.some(f => f.parentId === folder.id);
                    const isCollapsed = useFavoritesState 
                        ? !this.data.settings.favoritesExpanded?.[folder.id]
                        : this.data.settings.sidebarCollapsed?.[folder.id];

                    li.innerHTML = `
                        <div class="folder-header ${this.currentFolder === folder.id ? 'active' : ''}"
                             data-folder="${folder.id}"
                             style="padding-left: ${8 + level * 4}px;">
                            ${hasChildren ? `<span class="folder-toggle ${isCollapsed ? 'collapsed' : ''}">${isCollapsed ? '▶' : '▼'}</span>` : '<span class="folder-toggle" style="visibility: hidden;">▼</span>'}
                            <span class="folder-icon"><i class="ph ph-folder"></i></span>
                            <span class="folder-name">${this.escapeHtml(folder.name)}</span>
                            <span class="folder-count">${noteCount}</span>
                        </div>
                    `;

                    const header = li.querySelector('.folder-header');
                    header.addEventListener('click', (e) => {
                        // Use closest to handle clicks on the arrow text inside the toggle
                        if (e.target.closest('.folder-toggle') && hasChildren) {
                            // Toggle collapse - use appropriate state
                            if (useFavoritesState) {
                                const currentExpanded = !!this.data.settings.favoritesExpanded?.[folder.id];
                                this.data.settings.favoritesExpanded[folder.id] = !currentExpanded;
                            } else {
                                const currentCollapsed = !!this.data.settings.sidebarCollapsed?.[folder.id];
                                this.data.settings.sidebarCollapsed[folder.id] = !currentCollapsed;
                            }
                            this.saveData();
                            if (useFavoritesState) {
                                this.renderFavorites();
                            } else {
                                this.render();
                            }
                        } else {
                            this.selectFolder(folder.id);
                        }
                    });

                    // Recursively render children
                    if (hasChildren && !isCollapsed) {
                        const childrenUl = this.renderFolderChildren(folder.id, level + 1, useFavoritesState);
                        if (childrenUl) {
                            li.appendChild(childrenUl);
                        }
                    }

                    ul.appendChild(li);
                });

                return ul;
            }

            removeFolderFromFavorites(id) {
                if (this.data.settings.favoriteFolders) {
                    this.data.settings.favoriteFolders = this.data.settings.favoriteFolders.filter(fId => fId !== id);
                    this.saveData();
                    this.renderFavorites();
                    this.showToast('Removed from favorites', 'success');
                }
            }

            renderClippedPages() {
                const clippedContainer = document.getElementById('clippedSectionContainer');
                const clippedList = document.getElementById('clippedList');
                const clippedNotes = this.data.notes.filter(n => n.clippedFrom);

                if (clippedNotes.length === 0) {
                    clippedContainer.style.display = 'none';
                    return;
                }

                clippedContainer.style.display = 'block';
                clippedList.innerHTML = '';

                clippedNotes.forEach(note => {
                    const li = document.createElement('li');
                    li.className = 'bookmark-item';
                    li.innerHTML = `
                        <i class="ph ph-globe"></i>
                        <span class="bookmark-title">${this.escapeHtml(note.title || 'Clipped Page')}</span>
                    `;
                    li.addEventListener('click', () => this.selectNote(note.id));
                    clippedList.appendChild(li);
                });
            }
            restoreFromTrash(id) {
                const item = this.data.trash?.find(t => t.id === id);
                if (!item) return;

                if (item.type === 'folder') {
                    // Check if parent still exists, default to root if not
                    const parentExists = this.data.folders.some(f => f.id === item.parentId);
                    this.data.folders.push({
                        id: item.id,
                        name: item.name,
                        parentId: parentExists ? item.parentId : 'root',
                        created: new Date().toISOString()
                    });
                } else {
                    // Check if folder still exists, default to inbox if not
                    const folderExists = this.data.folders.some(f => f.id === item.folderId);
                    this.data.notes.push({
                        id: item.id,
                        title: item.title,
                        content: item.content,
                        folderId: folderExists ? item.folderId : 'inbox',
                        tags: item.tags || [],
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }

                // Remove from trash
                this.data.trash = this.data.trash.filter(t => t.id !== id);
                this.saveData();
                this.render();
                this.showToast('Item restored', 'success');
            }

            permanentDelete(id) {
                if (!confirm('Delete permanently? This cannot be undone.')) return;

                this.data.trash = this.data.trash.filter(t => t.id !== id);
                this.saveData();
                this.render();
                this.showToast('Item permanently deleted', 'success');
            }

            duplicateFolder(id) {
                const folder = this.data.folders.find(f => f.id === id);
                if (folder && !this.isSystemFolder(id)) {
                    // Create duplicate folder
                    const newFolder = {
                        id: 'folder_' + Date.now(),
                        name: folder.name + ' (Copy)',
                        parentId: folder.parentId,
                        created: new Date().toISOString()
                    };
                    this.data.folders.push(newFolder);

                    // Duplicate notes in this folder
                    const notesToDuplicate = this.data.notes.filter(n => n.folderId === id);
                    notesToDuplicate.forEach(note => {
                        const newNote = {
                            id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            title: note.title,
                            content: note.content,
                            folderId: newFolder.id,
                            tags: [...note.tags],
                            created: new Date().toISOString(),
                            updated: new Date().toISOString()
                        };
                        this.data.notes.push(newNote);
                    });

                    // Recursively duplicate child folders
                    const childFolders = this.data.folders.filter(f => f.parentId === id);
                    this.duplicateChildFolders(id, newFolder.id);

                    this.saveData();
                    this.render();
                    this.showToast('Folder duplicated', 'success');
                }
            }

            duplicateChildFolders(parentId, newParentId) {
                const childFolders = this.data.folders.filter(f => f.parentId === parentId);
                childFolders.forEach(child => {
                    const newChild = {
                        id: 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        name: child.name,
                        parentId: newParentId,
                        created: new Date().toISOString()
                    };
                    this.data.folders.push(newChild);

                    // Duplicate notes
                    const notesToDuplicate = this.data.notes.filter(n => n.folderId === child.id);
                    notesToDuplicate.forEach(note => {
                        const newNote = {
                            id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            title: note.title,
                            content: note.content,
                            folderId: newChild.id,
                            tags: [...note.tags],
                            created: new Date().toISOString(),
                            updated: new Date().toISOString()
                        };
                        this.data.notes.push(newNote);
                    });

                    // Recurse
                    this.duplicateChildFolders(child.id, newChild.id);
                });
            }

            renameFolder(id) {
                const folder = this.data.folders.find(f => f.id === id);
                if (folder) {
                    const newName = prompt('Enter new folder name:', folder.name);
                    if (newName && newName.trim()) {
                        folder.name = newName.trim();
                        this.saveData();
                        this.render();
                        this.showToast('Folder renamed', 'success');
                    }
                }
            }

            deleteFolder(id) {
                if (this.isSystemFolder(id)) {
                    this.showToast('Cannot delete system folders', 'error');
                    return;
                }

                const folder = this.data.folders.find(f => f.id === id);
                if (!folder) return;

                // Move folder to trash
                if (!this.data.trash) this.data.trash = [];
                this.data.trash.push({
                    type: 'folder',
                    id: folder.id,
                    name: folder.name,
                    parentId: folder.parentId,
                    deletedAt: Date.now()
                });

                // Also move all notes in this folder to trash
                const notesInFolder = this.data.notes.filter(n => n.folderId === id);
                notesInFolder.forEach(note => {
                    this.data.trash.push({
                        type: 'note',
                        id: note.id,
                        title: note.title,
                        content: note.content,
                        folderId: note.folderId,
                        tags: note.tags,
                        deletedAt: Date.now()
                    });
                });
                this.data.notes = this.data.notes.filter(n => n.folderId !== id);

                // Handle child folders - recursively delete them
                const childFolders = this.data.folders.filter(f => f.parentId === id);
                childFolders.forEach(child => {
                    this.deleteFolder(child.id);
                });

                // Remove from favorites if present
                if (this.data.settings.favoriteFolders) {
                    this.data.settings.favoriteFolders = this.data.settings.favoriteFolders.filter(fId => fId !== id);
                }

                // Actually delete the folder
                this.data.folders = this.data.folders.filter(f => f.id !== id);

                this.saveData();
                this.render();
                this.showToast('Folder moved to Trash', 'success');
            }

            isSystemFolder(id) {
                return ['root'].includes(id);
            }

            getFolderPath(folderId) {
                const path = [];
                let current = this.data.folders.find(f => f.id === folderId);
                while (current) {
                    path.unshift(current);
                    current = this.data.folders.find(f => f.id === current.parentId);
                }
                return path;
            }

            // ==================== NOTE OPERATIONS ====================

            createNote(title, folderId = 'root') {
                const note = {
                    id: 'note_' + Date.now(),
                    title: title?.trim() || 'Untitled Note',
                    content: '',
                    folderId: folderId,
                    tags: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                this.data.notes.push(note);
                this.saveData();
                this.selectNote(note.id);
                this.render();
                this.showToast('Note created', 'success');
                return note;
            }

            createWelcomeNote() {
                const welcomeContent = `
                    <h1>Welcome to Knowledge Base!</h1>
                    <p>This is your personal, offline knowledge management system. Here's how to get started:</p>
                    <h2><i class="ph ph-notebook"></i> Creating Notes</h2>
                    <ul>
                        <li>Click "New Note" to create a note</li>
                        <li>Use the toolbar to format your text</li>
                        <li>Add tags to organize your notes</li>
                    </ul>
                    <h2><i class="ph ph-folders"></i> Organizing with Folders</h2>
                    <ul>
                        <li>Right-click in the sidebar to create folders</li>
                        <li>Drag and drop notes between folders</li>
                        <li>Create nested folders for better organization</li>
                    </ul>
                    <h2><i class="ph ph-link"></i> Linking Notes</h2>
                    <p>Type <code>[[Note Title]]</code> or use the link button to create connections between notes. Backlinks are automatically tracked!</p>
                    <h2><i class="ph ph-tag"></i> Tags</h2>
                    <p>Add tags to your notes for cross-cutting organization. Click any tag in the sidebar to filter.</p>
                    <h2><i class="ph ph-lightbulb"></i> Pro Tips</h2>
                    <ul>
                        <li>Use <strong>Cmd/Ctrl + K</strong> to quickly search</li>
                        <li>Try Focus Mode for distraction-free writing</li>
                        <li>Your data stays on your device - completely private</li>
                    </ul>
                    <p>Happy writing! <i class="ph ph-sparkle"></i></p>
                `;

                const note = {
                    id: 'note_welcome',
                    title: '\u003ci class="ph ph-waving-hand"\u003e\u003c/i\u003e Welcome to Knowledge Base',
                    content: welcomeContent,
                    folderId: 'root',
                    tags: ['getting-started', 'tutorial'],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                this.data.notes.push(note);
                this.saveData();
                this.selectNote(note.id);
            }

            updateNote(id, updates) {
                const note = this.data.notes.find(n => n.id === id);
                if (note) {
                    const titleChanged = updates.title && updates.title !== note.title;
                    Object.assign(note, updates, { updatedAt: Date.now() });
                    this.saveData();
                    this.renderBacklinks();
                    // Re-render sidebar if title changed to update folder tree
                    if (titleChanged) {
                        this.render();
                    }
                }
            }

            deleteNote(id) {
                const note = this.data.notes.find(n => n.id === id);
                if (!note) return;

                // Move to trash instead of permanent delete
                if (!this.data.trash) this.data.trash = [];
                this.data.trash.push({
                    type: 'note',
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    folderId: note.folderId,
                    tags: note.tags,
                    deletedAt: Date.now()
                });

                // Remove from open tabs if present
                this.openTabs = this.openTabs.filter(tabId => tabId !== id);

                this.data.notes = this.data.notes.filter(n => n.id !== id);
                if (this.currentNote?.id === id) {
                    this.currentNote = null;
                    this.showEmptyState();
                }
                this.saveData();
                this.render();
                this.showToast('Note moved to Trash', 'success');
            }

            duplicateNote(id) {
                const note = this.data.notes.find(n => n.id === id);
                if (note) {
                    const newNote = {
                        ...note,
                        id: 'note_' + Date.now(),
                        title: note.title + ' (Copy)',
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    };
                    this.data.notes.push(newNote);
                    this.saveData();
                    this.render();
                    this.selectNote(newNote.id);
                    this.showToast('Note duplicated', 'success');
                }
            }

            renameNote(id) {
                const note = this.data.notes.find(n => n.id === id);
                if (note) {
                    const newTitle = prompt('Enter new note title:', note.title);
                    if (newTitle && newTitle.trim()) {
                        note.title = newTitle.trim();
                        note.updatedAt = Date.now();
                        this.saveData();
                        this.render();
                        this.showToast('Note renamed', 'success');
                    }
                }
            }

            moveNote(noteId, folderId) {
                const note = this.data.notes.find(n => n.id === noteId);
                if (note) {
                    note.folderId = folderId;
                    this.saveData();
                    this.render();
                    this.showToast('Note moved', 'success');
                }
            }

            reorderNote(draggedId, targetId, insertBefore) {
                const draggedIndex = this.data.notes.findIndex(n => n.id === draggedId);
                const targetIndex = this.data.notes.findIndex(n => n.id === targetId);

                if (draggedIndex === -1 || targetIndex === -1) return;

                // Remove dragged note from array
                const [draggedNote] = this.data.notes.splice(draggedIndex, 1);

                // Calculate new index after removal
                let newIndex = this.data.notes.findIndex(n => n.id === targetId);
                if (!insertBefore) newIndex++;

                // Insert at new position
                this.data.notes.splice(newIndex, 0, draggedNote);

                this.saveData();
                this.render();
                this.showToast('Note reordered', 'success');
            }

            selectNote(id) {
                const note = this.data.notes.find(n => n.id === id);
                if (!note) return;

                // Check if already open in a tab
                if (!this.openTabs.includes(id)) {
                    this.openTabs.push(id);
                }

                this.activeTabId = id;
                this.renderTabs();
                this.loadNoteIntoEditor(note);
            }

            loadNoteIntoEditor(note) {
                this.currentNote = note;
                this.currentFolder = note.folderId;

                // Show editor
                document.getElementById('emptyState').classList.add('hidden');
                document.getElementById('editorToolbar').classList.remove('hidden');
                document.getElementById('tabsBar').classList.remove('hidden');
                document.getElementById('editorContentWrapper').classList.remove('hidden');
                document.getElementById('backlinksPanel').classList.remove('hidden');

                // Hide tag results if showing
                const tagResults = document.getElementById('tagResultsContainer');
                if (tagResults) tagResults.style.display = 'none';

                // Populate fields
                document.getElementById('noteTitle').value = note.title;
                document.getElementById('wysiwygEditor').innerHTML = note.content;
                document.getElementById('headerTitle').textContent = '';

                // Update date
                const date = new Date(note.updatedAt);
                let dateText = 'Updated ' + date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Add clipped indicator if applicable
                if (note.clippedFrom) {
                    dateText += ' • Clipped from web';
                }
                
                document.getElementById('noteDate').textContent = dateText;

                // Update tags
                this.renderNoteTags();

                // Reset and update tasks for new note
                this.renderTasks();

                // Apply font preference
                const editor = document.getElementById('wysiwygEditor');
                editor.classList.remove('font-serif', 'font-mono');
                if (note.fontFamily === 'serif') {
                    editor.classList.add('font-serif');
                } else if (note.fontFamily === 'mono') {
                    editor.classList.add('font-mono');
                }

                // Apply toggle preferences - ensure defaults are respected
                const editorContent = document.querySelector('.editor-content');
                editor.classList.toggle('small-text', !!note.smallText);
                editorContent.classList.toggle('full-width', !!note.fullWidth);

                // Update menu toggle indicators
                const noteMenuDropdown = document.getElementById('noteMenuDropdown');
                if (noteMenuDropdown) {
                    noteMenuDropdown.querySelectorAll('.note-menu-font-option').forEach(opt => {
                        opt.classList.toggle('active', opt.dataset.font === (note.fontFamily || 'default'));
                    });
                    const smallTextToggle = document.getElementById('smallTextToggle');
                    const fullWidthToggle = document.getElementById('fullWidthToggle');
                    if (smallTextToggle) {
                        smallTextToggle.textContent = note.smallText ? '●' : '○';
                        smallTextToggle.classList.toggle('on', !!note.smallText);
                    }
                    if (fullWidthToggle) {
                        fullWidthToggle.textContent = note.fullWidth ? '●' : '○';
                        fullWidthToggle.classList.toggle('on', !!note.fullWidth);
                    }
                }

                // Update breadcrumb
                this.renderBreadcrumb();

                // Update backlinks
                this.renderBacklinks();

                // Update active states
                this.updateActiveStates();

                // Auto-save on content change
                this.setupAutoSave();
            }

            renderTabs() {
                const container = document.getElementById('tabsContainer');
                if (!container) return;

                container.innerHTML = this.openTabs.map(noteId => {
                    const note = this.data.notes.find(n => n.id === noteId);
                    if (!note) return '';
                    const isActive = noteId === this.activeTabId;
                    return `
                        <div class="tab ${isActive ? 'active' : ''}" data-note-id="${noteId}">
                            <span class="tab-title">${this.escapeHtml(note.title || 'Untitled')}</span>
                            <span class="tab-close" data-note-id="${noteId}">×</span>
                        </div>
                    `;
                }).join('');

                // Add click handlers
                container.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        if (e.target.classList.contains('tab-close')) {
                            e.stopPropagation();
                            this.closeTab(tab.dataset.noteId);
                        } else {
                            this.switchTab(tab.dataset.noteId);
                        }
                    });
                });
            }

            switchTab(noteId) {
                if (!this.openTabs.includes(noteId)) return;
                const note = this.data.notes.find(n => n.id === noteId);
                if (!note) {
                    this.closeTab(noteId);
                    return;
                }
                this.activeTabId = noteId;
                this.renderTabs();
                this.loadNoteIntoEditor(note);
            }

            closeTab(noteId) {
                const index = this.openTabs.indexOf(noteId);
                if (index === -1) return;

                this.openTabs.splice(index, 1);

                if (this.activeTabId === noteId) {
                    // Switch to another tab
                    if (this.openTabs.length > 0) {
                        const newIndex = index < this.openTabs.length ? index : this.openTabs.length - 1;
                        this.switchTab(this.openTabs[newIndex]);
                    } else {
                        // No tabs left
                        this.activeTabId = null;
                        this.currentNote = null;
                        this.showEmptyState();
                    }
                }

                this.renderTabs();
            }

            showEmptyState() {
                document.getElementById('emptyState').classList.remove('hidden');
                document.getElementById('editorToolbar').classList.add('hidden');
                document.getElementById('tabsBar').classList.add('hidden');
                document.getElementById('editorContentWrapper').classList.add('hidden');
                document.getElementById('backlinksPanel').classList.add('hidden');
                document.getElementById('headerTitle').textContent = '';
            }

            // ==================== TAG OPERATIONS ====================

            addTagToNote(noteId, tagName) {
                const note = this.data.notes.find(n => n.id === noteId);
                if (note && !note.tags.includes(tagName)) {
                    note.tags.push(tagName);
                    if (!this.data.tags.includes(tagName)) {
                        this.data.tags.push(tagName);
                    }
                    this.saveData();
                    this.renderNoteTags();
                    this.renderTagsCloud();
                }
            }

            removeTagFromNote(noteId, tagName) {
                const note = this.data.notes.find(n => n.id === noteId);
                if (note) {
                    note.tags = note.tags.filter(t => t !== tagName);
                    this.saveData();
                    this.renderNoteTags();
                    this.renderTagsCloud();
                }
            }

            getAllTags() {
                const tags = new Set();
                this.data.notes.forEach(note => {
                    note.tags.forEach(tag => tags.add(tag));
                });
                return Array.from(tags).sort();
            }

            // ==================== RENDERING ====================

            render() {
                this.renderClippedPages();
                this.renderFavorites();
                this.renderFolderTree();
                this.renderTagsCloud();
                this.updateActiveStates();
                this.updateTrashCount();

                // Debug: Log folder state
                console.log('Folders:', this.data.folders.map(f => ({id: f.id, name: f.name, parentId: f.parentId})));
            }

            updateTrashCount() {
                const count = this.data.trash?.length || 0;
                const trashCountEl = document.getElementById('trashCount');
                if (trashCountEl) {
                    trashCountEl.textContent = count === 1 ? '1 item in trash' : `${count} items in trash`;
                }
            }

            openTrashModal() {
                const modal = document.getElementById('trashModal');
                const emptyState = document.getElementById('trashEmptyState');
                const itemsList = document.getElementById('trashItemsList');
                const container = document.getElementById('trashItemsContainer');
                
                const trashItems = this.data.trash || [];
                
                if (trashItems.length === 0) {
                    emptyState.style.display = 'block';
                    itemsList.style.display = 'none';
                } else {
                    emptyState.style.display = 'none';
                    itemsList.style.display = 'block';
                    
                    // Sort by deleted date (newest first)
                    const sorted = [...trashItems].sort((a, b) => b.deletedAt - a.deletedAt);
                    
                    container.innerHTML = sorted.map(item => `
                        <div class="trash-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border);" data-id="${item.id}">
                            <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                                <i class="ph ${item.type === 'folder' ? 'ph-folder' : 'ph-file-text'}" style="color: var(--text-tertiary); font-size: 20px;"></i>
                                <div style="min-width: 0;">
                                    <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(item.name || item.title || 'Untitled')}</div>
                                    <div style="font-size: 12px; color: var(--text-tertiary);">${item.type === 'folder' ? 'Folder' : 'Note'} • Deleted ${new Date(item.deletedAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <button class="btn btn-secondary restore-trash-item" data-id="${item.id}" style="padding: 6px 12px; font-size: 13px; white-space: nowrap;">
                                <i class="ph ph-arrow-counter-clockwise"></i> Restore
                            </button>
                        </div>
                    `).join('');
                    
                    // Add restore listeners
                    container.querySelectorAll('.restore-trash-item').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.restoreFromTrash(btn.dataset.id);
                            this.openTrashModal(); // Refresh the modal
                        });
                    });
                }
                
                modal.classList.add('active');
                
                // Setup close buttons
                document.getElementById('closeTrashModal').onclick = () => modal.classList.remove('active');
                document.getElementById('closeTrashBtn').onclick = () => modal.classList.remove('active');
                
                // Setup empty trash button
                document.getElementById('emptyTrashNowBtn').onclick = () => {
                    if (trashItems.length === 0) {
                        this.showToast('Trash is already empty', 'info');
                        return;
                    }
                    if (confirm(`Delete ${trashItems.length} item(s) permanently? This cannot be undone.`)) {
                        this.data.trash = [];
                        this.saveData();
                        this.render();
                        this.openTrashModal(); // Refresh
                        this.showToast('Trash emptied', 'success');
                    }
                };
            }

            renderFolderTree() {
                const tree = document.getElementById('folderTree');
                if (!tree) {
                    console.error('folderTree element not found!');
                    return;
                }
                tree.innerHTML = '';

                console.log('Rendering folders:', this.data.folders.length);

                const renderFolder = (parentId, level = 0) => {
                    const folders = this.data.folders.filter(f => f.parentId === parentId && f.id !== 'root');
                    console.log(`Found ${folders.length} folders with parent ${parentId}`);

                    if (folders.length === 0) return null;

                    const ul = document.createElement('ul');
                    ul.className = level === 0 ? 'folder-tree' : 'folder-children';
                    if (level > 0) ul.style.paddingLeft = '16px';

                    folders.forEach(folder => {
                        const li = document.createElement('li');
                        li.className = 'folder-item';

                        const noteCount = this.data.notes.filter(n => {
                            if (n.folderId === folder.id) return true;
                            const childIds = this.getChildFolderIds(folder.id);
                            return childIds.includes(n.folderId);
                        }).length;

                        const hasChildren = this.data.folders.some(f => f.parentId === folder.id);
                        const isCollapsed = this.data.settings.sidebarCollapsed?.[folder.id];

                        li.innerHTML = `
                            <div class="folder-header ${this.currentFolder === folder.id ? 'active' : ''}"
                                 data-folder="${folder.id}"
                                 style="padding-left: ${8 + level * 4}px">
                                ${hasChildren ? `<span class="folder-toggle ${isCollapsed ? 'collapsed' : ''}">▼</span>` : '<span class="folder-toggle" style="visibility: hidden;">▼</span>'}
                                <span class="folder-icon"><i class="ph ph-folder"></i></span>
                                <span class="folder-name">${this.escapeHtml(folder.name)}</span>
                                <span class="folder-count">${noteCount}</span>
                                <div class="folder-actions">
                                    <button class="folder-action-btn add-page" title="Add a new note"><i class="ph ph-plus"></i></button>
                                    <button class="folder-action-btn more-menu" title="More options"><i class="ph ph-dots-three"></i></button>
                                    <div class="folder-dropdown" id="dropdown-${folder.id}">
                                        <div class="folder-dropdown-item" data-action="favorite">
                                            <span class="folder-dropdown-icon"><i class="ph ph-star"></i></span>
                                            <span>Add to Favorites</span>
                                        </div>
                                        <div class="folder-dropdown-item" data-action="duplicate">
                                            <span class="folder-dropdown-icon"><i class="ph ph-copy"></i></span>
                                            <span>Duplicate</span>
                                        </div>
                                        <div class="folder-dropdown-item" data-action="rename">
                                            <span class="folder-dropdown-icon"><i class="ph ph-pencil-simple"></i></span>
                                            <span>Rename</span>
                                        </div>
                                        <div class="folder-dropdown-divider"></div>
                                        <div class="folder-dropdown-item delete" data-action="delete">
                                            <span class="folder-dropdown-icon"><i class="ph ph-trash"></i></span>
                                            <span>Move to Trash</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;

                        const header = li.querySelector('.folder-header');

                        // Click to toggle expand/collapse (if has children) or select
                        header.addEventListener('click', (e) => {
                            // Ignore clicks on buttons
                            if (e.target.classList.contains('folder-action-btn') ||
                                e.target.closest('.folder-dropdown')) return;

                            // Always toggle collapse state on click
                            if (!this.data.settings.sidebarCollapsed) {
                                this.data.settings.sidebarCollapsed = {};
                            }
                            this.data.settings.sidebarCollapsed[folder.id] = !isCollapsed;
                            this.saveData();
                            this.renderFolderTree();
                        });

                        // Context menu
                        header.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            this.showContextMenu(e, 'folder', folder.id);
                        });

                        // DROP ZONE: Allow notes to be dropped onto this folder
                        header.addEventListener('dragover', (e) => {
                            if (!this.draggedNote) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            header.classList.add('drag-over');
                        });

                        header.addEventListener('dragleave', () => {
                            header.classList.remove('drag-over');
                        });

                        header.addEventListener('drop', (e) => {
                            if (!this.draggedNote) return;
                            e.preventDefault();
                            e.stopPropagation();
                            header.classList.remove('drag-over');

                            const note = this.data.notes.find(n => n.id === this.draggedNote);
                            if (note && note.folderId !== folder.id) {
                                note.folderId = folder.id;
                                this.saveData();
                                this.render();
                                this.showToast(`Moved to ${folder.name}`, 'success');
                            }
                            this.draggedNote = null;
                        });

                        // FOLDER DRAG/DROP - all folders can receive drops
                        // DROP: Move folder to be a child of this folder
                        header.addEventListener('dragover', (e) => {
                            if (!this.draggedFolder || this.draggedFolder === folder.id) return;
                            const dragged = this.data.folders.find(f => f.id === this.draggedFolder);
                            if (!dragged) return;

                            // Prevent dropping a parent into its own child (would create cycle)
                            if (this.isDescendant(folder.id, dragged.id)) return;

                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';

                            const rect = header.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const h = rect.height;

                            // Clear previous indicators
                            header.style.borderTop = '';
                            header.style.borderBottom = '';
                            header.classList.remove('drag-over');

                            if (y < h * 0.25) {
                                // Top 25% - reorder before
                                header.style.borderTop = '3px solid var(--accent)';
                                header.title = 'Drop to move before';
                            } else if (y > h * 0.75) {
                                // Bottom 25% - reorder after
                                header.style.borderBottom = '3px solid var(--accent)';
                                header.title = 'Drop to move after';
                            } else {
                                // Middle 50% - nest as child
                                header.classList.add('drag-over');
                                header.title = 'Drop to nest inside';
                            }
                        });

                        header.addEventListener('dragleave', () => {
                            header.style.borderTop = '';
                            header.style.borderBottom = '';
                            header.classList.remove('drag-over');
                            header.title = '';
                        });

                        header.addEventListener('drop', (e) => {
                            if (!this.draggedFolder || this.draggedFolder === folder.id) return;
                            const dragged = this.data.folders.find(f => f.id === this.draggedFolder);
                            if (!dragged) return;

                            // Prevent dropping a parent into its own child
                            if (this.isDescendant(folder.id, dragged.id)) return;

                            e.preventDefault();
                            e.stopPropagation();
                            header.style.borderTop = '';
                            header.style.borderBottom = '';
                            header.classList.remove('drag-over');
                            header.title = '';

                            const rect = header.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const h = rect.height;

                            if (y < h * 0.25) {
                                // Top - reorder before
                                this.reorderFolder(this.draggedFolder, folder.id, true);
                            } else if (y > h * 0.75) {
                                // Bottom - reorder after
                                this.reorderFolder(this.draggedFolder, folder.id, false);
                            } else {
                                // Middle - nest as child
                                dragged.parentId = folder.id;
                                this.saveData();
                                this.render();
                                this.showToast(`Moved into ${folder.name}`, 'success');
                            }
                            this.draggedFolder = null;
                        });

                        // DRAG: Only non-system folders can be dragged
                        if (!this.isSystemFolder(folder.id)) {
                            header.draggable = true;

                            header.addEventListener('dragstart', (e) => {
                                this.draggedFolder = folder.id;
                                header.style.opacity = '0.5';
                                e.dataTransfer.effectAllowed = 'move';
                            });

                            header.addEventListener('dragend', () => {
                                header.style.opacity = '';
                                this.draggedFolder = null;
                                document.querySelectorAll('.folder-header').forEach(h => {
                                    h.style.borderTop = '';
                                    h.style.borderBottom = '';
                                    h.classList.remove('drag-over');
                                });
                            });
                        }

                        // Add page button (plus icon)
                        const addPageBtn = li.querySelector('.folder-action-btn.add-page');
                        if (addPageBtn) {
                            addPageBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.createNote('', folder.id);
                            });
                        }

                        // More menu button (three dots)
                        const moreMenuBtn = li.querySelector('.folder-action-btn.more-menu');
                        const dropdown = li.querySelector(`#dropdown-${folder.id}`);

                        if (moreMenuBtn && dropdown) {
                            moreMenuBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                // Close other dropdowns
                                document.querySelectorAll('.folder-dropdown.show').forEach(d => {
                                    if (d !== dropdown) d.classList.remove('show');
                                });
                                dropdown.classList.toggle('show');
                            });

                            // Handle dropdown item clicks
                            dropdown.querySelectorAll('.folder-dropdown-item').forEach(item => {
                                item.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    const action = item.dataset.action;
                                    dropdown.classList.remove('show');

                                    switch(action) {
                                        case 'favorite':
                                            this.addFolderToFavorites(folder.id);
                                            break;
                                        case 'duplicate':
                                            this.duplicateFolder(folder.id);
                                            break;
                                        case 'rename':
                                            this.renameFolder(folder.id);
                                            break;
                                        case 'delete':
                                            this.deleteFolder(folder.id);
                                            break;
                                    }
                                });
                            });
                        }

                        // Close dropdown when clicking outside
                        document.addEventListener('click', () => {
                            if (dropdown) dropdown.classList.remove('show');
                        });

                        // Drag and drop: Header = move as child, List item = reorder

                        // DRAG AND DROP DISABLED - TOO BUGGY
                        // Simple drag indicators only - no actual drag functionality
                        /*
                        li.draggable = true;

                        li.addEventListener('dragstart', (e) => {
                            this.draggedFolder = folder.id;
                            li.style.opacity = '0.5';
                            e.dataTransfer.effectAllowed = 'move';
                        });

                        li.addEventListener('dragend', () => {
                            li.style.opacity = '1';
                            document.querySelectorAll('.folder-item').forEach(item => {
                                item.style.borderTop = '';
                                item.style.borderBottom = '';
                            });
                            this.draggedFolder = null;
                        });

                        li.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            if (!this.draggedFolder || this.draggedFolder === folder.id) return;

                            const rect = li.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;

                            if (e.clientY < midY) {
                                li.style.borderTop = '2px solid var(--accent)';
                                li.style.borderBottom = '';
                            } else {
                                li.style.borderTop = '';
                                li.style.borderBottom = '2px solid var(--accent)';
                            }
                        });

                        li.addEventListener('dragleave', () => {
                            li.style.borderTop = '';
                            li.style.borderBottom = '';
                        });

                        li.addEventListener('drop', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            li.style.borderTop = '';
                            li.style.borderBottom = '';

                            if (!this.draggedFolder || this.draggedFolder === folder.id) return;

                            const draggedFolder = this.data.folders.find(f => f.id === this.draggedFolder);
                            if (!draggedFolder) return;

                            // Move to same parent as target
                            if (draggedFolder.parentId !== folder.parentId) {
                                draggedFolder.parentId = folder.parentId;
                            }

                            const rect = li.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;
                            const insertBefore = e.clientY < midY;

                            this.reorderFolder(this.draggedFolder, folder.id, insertBefore);
                            this.draggedFolder = null;
                        });
                        */

                        // Render children
                        if (hasChildren && !isCollapsed) {
                            const children = renderFolder(folder.id, level + 1);
                            li.appendChild(children);
                        }

                        // Render notes in this folder (only if expanded)
                        if (!isCollapsed) {
                            const notes = this.data.notes.filter(n => n.folderId === folder.id);
                            if (notes.length > 0) {
                                const notesUl = document.createElement('ul');
                                notesUl.className = 'folder-children';
                                notes.forEach(note => {
                                    const noteLi = document.createElement('li');
                                    noteLi.className = `note-item ${this.currentNote?.id === note.id ? 'active' : ''}`;
                                    noteLi.draggable = true;
                                    noteLi.dataset.noteId = note.id;
                                    noteLi.innerHTML = `
                                        <span class="note-icon"><i class="ph ph-file-text"></i></span>
                                        <span class="note-title">${this.escapeHtml(note.title)}</span>
                                        <div class="note-actions">
                                            <button class="note-action-btn more-menu" title="More options"><i class="ph ph-dots-three"></i></button>
                                            <div class="note-dropdown" id="note-dropdown-${note.id}">
                                                <div class="note-dropdown-item" data-action="rename">Rename</div>
                                                <div class="note-dropdown-item" data-action="duplicate">Duplicate</div>
                                                <div class="note-dropdown-item delete" data-action="delete">Delete</div>
                                            </div>
                                        </div>
                                    `;

                                    noteLi.addEventListener('click', () => this.selectNote(note.id));
                                    noteLi.addEventListener('contextmenu', (e) => {
                                        e.preventDefault();
                                        this.showContextMenu(e, 'note', note.id);
                                    });

                                    // Note dropdown menu
                                    const moreMenuBtn = noteLi.querySelector('.note-action-btn.more-menu');
                                    const dropdown = noteLi.querySelector(`#note-dropdown-${note.id}`);

                                    if (moreMenuBtn && dropdown) {
                                        moreMenuBtn.addEventListener('click', (e) => {
                                            e.stopPropagation();
                                            // Close other dropdowns
                                            document.querySelectorAll('.note-dropdown.show').forEach(d => {
                                                if (d !== dropdown) d.classList.remove('show');
                                            });
                                            dropdown.classList.toggle('show');
                                        });

                                        // Handle dropdown item clicks
                                        dropdown.querySelectorAll('.note-dropdown-item').forEach(item => {
                                            item.addEventListener('click', (e) => {
                                                e.stopPropagation();
                                                const action = item.dataset.action;
                                                dropdown.classList.remove('show');

                                                switch(action) {
                                                    case 'rename':
                                                        this.renameNote(note.id);
                                                        break;
                                                    case 'duplicate':
                                                        this.duplicateNote(note.id);
                                                        break;
                                                    case 'delete':
                                                        this.deleteNote(note.id);
                                                        break;
                                                }
                                            });
                                        });
                                    }

                                    // Close dropdown when clicking outside
                                    document.addEventListener('click', () => {
                                        if (dropdown) dropdown.classList.remove('show');
                                    });

                                    // Drag start
                                    noteLi.addEventListener('dragstart', (e) => {
                                        this.draggedNote = note.id;
                                        this.draggedNoteSourceFolder = folder.id;
                                        noteLi.classList.add('dragging');
                                        e.dataTransfer.effectAllowed = 'move';
                                    });

                                    noteLi.addEventListener('dragend', () => {
                                        noteLi.classList.remove('dragging');
                                        this.draggedNote = null;
                                        this.draggedNoteSourceFolder = null;
                                        // Clear all drop indicators
                                        document.querySelectorAll('.note-item').forEach(el => {
                                            el.style.borderTop = '';
                                            el.style.borderBottom = '';
                                        });
                                    });

                                    // Drag over for reordering within same folder
                                    noteLi.addEventListener('dragover', (e) => {
                                        if (!this.draggedNote || this.draggedNote === note.id) return;
                                        // Only allow reordering if from same folder
                                        if (this.draggedNoteSourceFolder !== folder.id) return;

                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';

                                        const rect = noteLi.getBoundingClientRect();
                                        const midY = rect.top + rect.height / 2;

                                        if (e.clientY < midY) {
                                            noteLi.style.borderTop = '2px solid var(--accent)';
                                            noteLi.style.borderBottom = '';
                                        } else {
                                            noteLi.style.borderTop = '';
                                            noteLi.style.borderBottom = '2px solid var(--accent)';
                                        }
                                    });

                                    noteLi.addEventListener('dragleave', () => {
                                        noteLi.style.borderTop = '';
                                        noteLi.style.borderBottom = '';
                                    });

                                    noteLi.addEventListener('drop', (e) => {
                                        if (!this.draggedNote || this.draggedNote === note.id) return;
                                        // Only allow reordering if from same folder
                                        if (this.draggedNoteSourceFolder !== folder.id) return;

                                        e.preventDefault();
                                        e.stopPropagation();
                                        noteLi.style.borderTop = '';
                                        noteLi.style.borderBottom = '';

                                        const rect = noteLi.getBoundingClientRect();
                                        const midY = rect.top + rect.height / 2;
                                        const insertBefore = e.clientY < midY;

                                        this.reorderNote(this.draggedNote, note.id, insertBefore);
                                    });

                                    notesUl.appendChild(noteLi);
                                });
                                li.appendChild(notesUl);
                            }
                        }

                        ul.appendChild(li);
                    });

                    return ul;
                };

                const rootUl = renderFolder(null);

                // TOP DROP ZONE for reordering main folders at the top
                const topDropZone = document.createElement('div');
                topDropZone.className = 'folder-reorder-zone';
                topDropZone.style.cssText = 'height: 8px; margin-bottom: 4px; border-radius: 4px; transition: all 0.2s;';
                topDropZone.title = 'Drop here to move folder to top';

                topDropZone.addEventListener('dragover', (e) => {
                    if (!this.draggedFolder) return;
                    const dragged = this.data.folders.find(f => f.id === this.draggedFolder);
                    if (!dragged || dragged.parentId !== null) return; // Only for main folders

                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    topDropZone.style.background = 'var(--accent)';
                    topDropZone.style.height = '20px';
                });

                topDropZone.addEventListener('dragleave', () => {
                    topDropZone.style.background = '';
                    topDropZone.style.height = '8px';
                });

                topDropZone.addEventListener('drop', (e) => {
                    if (!this.draggedFolder) return;
                    const dragged = this.data.folders.find(f => f.id === this.draggedFolder);
                    if (!dragged || dragged.parentId !== null) return;

                    e.preventDefault();
                    topDropZone.style.background = '';
                    topDropZone.style.height = '8px';

                    // Get main folders
                    const mainFolders = this.data.folders.filter(f => f.parentId === null && f.id !== 'root');
                    if (mainFolders.length < 2) return;

                    // Move dragged to first position
                    const draggedIndex = this.data.folders.findIndex(f => f.id === this.draggedFolder);
                    const [movedFolder] = this.data.folders.splice(draggedIndex, 1);

                    // Find insert position (after root, before first non-root main folder)
                    const rootIndex = this.data.folders.findIndex(f => f.id === 'root');
                    let insertIndex = rootIndex + 1;
                    this.data.folders.splice(insertIndex, 0, movedFolder);

                    this.saveData();
                    this.render();
                    this.showToast('Folder moved to top', 'success');
                    this.draggedFolder = null;
                });

                tree.appendChild(topDropZone);

                if (rootUl) {
                    tree.appendChild(rootUl);
                    console.log('Folder tree rendered successfully');
                } else {
                    console.log('No root folders found');
                    tree.innerHTML = '<div style="padding: 20px; color: var(--text-tertiary); text-align: center;">No folders found</div>';
                }

                // ROOT DROP ZONE: Move folders to become main folders (parentId: null)
                const rootDropZone = document.createElement('div');
                rootDropZone.className = 'root-drop-zone';
                rootDropZone.style.cssText = 'height: 20px; margin-top: 10px; border-radius: 4px; transition: all 0.2s;';
                rootDropZone.title = 'Drop folder here to make it a main folder';

                rootDropZone.addEventListener('dragover', (e) => {
                    if (!this.draggedFolder) return;
                    const dragged = this.data.folders.find(f => f.id === this.draggedFolder);
                    if (!dragged || dragged.parentId === null) return; // Already a main folder

                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    rootDropZone.style.background = 'var(--accent)';
                    rootDropZone.style.height = '40px';
                });

                rootDropZone.addEventListener('dragleave', () => {
                    rootDropZone.style.background = '';
                    rootDropZone.style.height = '20px';
                });

                rootDropZone.addEventListener('drop', (e) => {
                    if (!this.draggedFolder) return;
                    const dragged = this.data.folders.find(f => f.id === this.draggedFolder);
                    if (!dragged || dragged.parentId === null) return;

                    e.preventDefault();
                    rootDropZone.style.background = '';
                    rootDropZone.style.height = '20px';

                    // Move to root level
                    dragged.parentId = null;
                    this.saveData();
                    this.render();
                    this.showToast('Moved to main folders', 'success');
                    this.draggedFolder = null;
                });

                tree.appendChild(rootDropZone);
            }

            getChildFolderIds(parentId) {
                const ids = [];
                const children = this.data.folders.filter(f => f.parentId === parentId);
                children.forEach(child => {
                    ids.push(child.id);
                    ids.push(...this.getChildFolderIds(child.id));
                });
                return ids;
            }

            renderTagsCloud() {
                const container = document.getElementById('tagsAlphabetical');
                const searchInput = document.getElementById('tagsSearch');
                const tags = this.getAllTags().sort();

                if (tags.length === 0) {
                    container.innerHTML = '<div style="padding: 12px; color: var(--text-tertiary); font-size: 12px; text-align: center;">No tags yet</div>';
                    return;
                }

                // Group tags by first letter
                const groups = {};
                tags.forEach(tag => {
                    const letter = tag.charAt(0).toUpperCase();
                    if (!groups[letter]) groups[letter] = [];
                    groups[letter].push(tag);
                });

                const render = (filter = '') => {
                    const filteredTags = filter
                        ? tags.filter(t => t.toLowerCase().includes(filter.toLowerCase()))
                        : tags;

                    if (filteredTags.length === 0) {
                        container.innerHTML = '<div style="padding: 12px; color: var(--text-tertiary); font-size: 12px; text-align: center;">No matching tags</div>';
                        return;
                    }

                    // Re-group filtered tags
                    const filteredGroups = {};
                    filteredTags.forEach(tag => {
                        const letter = tag.charAt(0).toUpperCase();
                        if (!filteredGroups[letter]) filteredGroups[letter] = [];
                        filteredGroups[letter].push(tag);
                    });

                    container.innerHTML = Object.keys(filteredGroups).sort().map(letter => {
                        const letterTags = filteredGroups[letter];
                        const isCollapsed = this.data.settings?.tagsCollapsed?.[letter];

                        return `
                            <div class="tags-letter-group">
                                <div class="tags-letter-header" data-letter="${letter}">
                                    <span>${letter} (${letterTags.length})</span>
                                    <span class="tags-letter-toggle ${isCollapsed ? 'collapsed' : ''}">▼</span>
                                </div>
                                <div class="tags-letter-content ${isCollapsed ? 'collapsed' : ''}">
                                    ${letterTags.map(tag => {
                                        const count = this.data.notes.filter(n => n.tags.includes(tag)).length;
                                        return `<span class="tag-item-small ${this.currentTagFilter === tag ? 'active' : ''}" data-tag="${this.escapeHtml(tag)}">${this.escapeHtml(tag)} <span class="tag-count">${count}</span></span>`;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Add click handlers
                    container.querySelectorAll('.tags-letter-header').forEach(header => {
                        header.addEventListener('click', () => {
                            const letter = header.dataset.letter;
                            const content = header.nextElementSibling;
                            const toggle = header.querySelector('.tags-letter-toggle');

                            content.classList.toggle('collapsed');
                            toggle.classList.toggle('collapsed');

                            // Save preference
                            if (!this.data.settings.tagsCollapsed) this.data.settings.tagsCollapsed = {};
                            this.data.settings.tagsCollapsed[letter] = content.classList.contains('collapsed');
                            this.saveData();
                        });
                    });

                    container.querySelectorAll('.tag-item-small').forEach(el => {
                        el.addEventListener('click', () => {
                            const tag = el.dataset.tag;
                            this.filterByTag(tag);
                        });
                    });
                };

                // Initial render
                render();

                // Search handler
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        render(e.target.value);
                    });
                }
            }

            renderNoteTags() {
                const container = document.getElementById('noteTagsInput');
                const input = document.getElementById('tagInput');

                // Clear existing tags (keep input)
                Array.from(container.children).forEach(child => {
                    if (!child.classList.contains('tag-input')) {
                        child.remove();
                    }
                });

                // Add tags before input
                if (this.currentNote) {
                    this.currentNote.tags.forEach(tag => {
                        const tagEl = document.createElement('span');
                        tagEl.className = 'note-tag';
                        tagEl.innerHTML = `
                            ${this.escapeHtml(tag)}
                            <span class="note-tag-remove" data-tag="${this.escapeHtml(tag)}">×</span>
                        `;
                        container.insertBefore(tagEl, input);

                        tagEl.querySelector('.note-tag-remove').addEventListener('click', () => {
                            this.removeTagFromNote(this.currentNote.id, tag);
                        });
                    });
                }
            }

            renderBreadcrumb() {
                const breadcrumb = document.getElementById('breadcrumb');
                if (!this.currentNote) {
                    breadcrumb.innerHTML = '<span class="breadcrumb-item" data-folder="root">All Notes</span>';
                    return;
                }

                const path = this.getFolderPath(this.currentNote.folderId);
                breadcrumb.innerHTML = path.map((folder, i) => `
                    <span class="breadcrumb-item" data-folder="${folder.id}">${this.escapeHtml(folder.name)}</span>
                    ${i < path.length - 1 ? '<span class="breadcrumb-separator">/</span>' : ''}
                `).join('');

                breadcrumb.querySelectorAll('.breadcrumb-item').forEach(el => {
                    el.addEventListener('click', () => {
                        this.selectFolder(el.dataset.folder);
                    });
                });
            }

            renderBacklinks() {
                const panel = document.getElementById('backlinksPanel');
                const list = document.getElementById('backlinksList');

                if (!this.currentNote) {
                    panel.classList.add('hidden');
                    return;
                }

                // Find notes that link to this note
                const noteTitle = this.currentNote.title;
                const backlinks = this.data.notes.filter(n => {
                    if (n.id === this.currentNote.id) return false;
                    const linkPattern = new RegExp(`\\[\\[${this.escapeRegex(noteTitle)}\\]\\]|href=["']note:${this.escapeRegex(this.currentNote.id)}["']`, 'i');
                    return linkPattern.test(n.content);
                });

                if (backlinks.length === 0) {
                    panel.classList.add('hidden');
                    return;
                }

                panel.classList.remove('hidden');
                list.innerHTML = backlinks.map(note => `
                    <div class="backlink-item" data-note="${note.id}">
                        <span class="backlink-icon"><i class="ph ph-file-text"></i></span>
                        <span>${this.escapeHtml(note.title)}</span>
                    </div>
                `).join('');

                list.querySelectorAll('.backlink-item').forEach(el => {
                    el.addEventListener('click', () => this.selectNote(el.dataset.note));
                });
            }

            updateActiveStates() {
                // Update folder active states
                document.querySelectorAll('.folder-header').forEach(el => {
                    el.classList.toggle('active', el.dataset.folder === this.currentFolder);
                });

                // Update note active states
                document.querySelectorAll('.note-item').forEach(el => {
                    el.classList.toggle('active', el.dataset.noteId === this.currentNote?.id);
                });
            }

            // ==================== SELECTION & FILTERING ====================

            selectFolder(folderId) {
                this.currentFolder = folderId;
                this.currentNote = null;
                this.showEmptyState();
                this.renderFolderTree();
                this.updateActiveStates();

                // Update header title
                const folder = this.data.folders.find(f => f.id === folderId);
                document.getElementById('headerTitle').textContent = folder?.name || '';
            }

            filterByTag(tag) {
                // If already filtering by this tag and viewing a note, show results again
                if (this.currentTagFilter === tag) {
                    if (this.currentNote) {
                        // We're viewing a note, go back to tag results
                        this.currentNote = null;
                        this.showEmptyState();
                        this.renderTagResults(tag);
                    } else {
                        // Already viewing results, toggle off
                        this.currentTagFilter = null;
                        this.currentFolder = 'root';
                        const tagResults = document.getElementById('tagResultsContainer');
                        if (tagResults) tagResults.style.display = 'none';
                        this.render();
                    }
                    return;
                }

                // Show notes with this tag
                this.currentTagFilter = tag;
                this.currentFolder = 'tag:' + tag;
                this.currentNote = null;

                // Update UI
                document.querySelectorAll('.tag-item-small').forEach(el => {
                    el.classList.toggle('active', el.dataset.tag === tag);
                });

                document.getElementById('headerTitle').textContent = `#${tag}`;

                // Re-render tags to show active state
                this.renderTagsCloud();

                // Show tag results in main content
                this.renderTagResults(tag);
            }

            renderTagResults(tag) {
                const notes = this.data.notes.filter(n => n.tags.includes(tag));
                
                // Hide normal editor content and empty state
                document.getElementById('emptyState').classList.add('hidden');
                document.getElementById('editorToolbar').classList.add('hidden');
                document.getElementById('tabsBar').classList.add('hidden');
                document.getElementById('editorContentWrapper').classList.add('hidden');
                
                // Create or get tag results container
                let resultsContainer = document.getElementById('tagResultsContainer');
                if (!resultsContainer) {
                    resultsContainer = document.createElement('div');
                    resultsContainer.id = 'tagResultsContainer';
                    resultsContainer.className = 'tag-results-view';
                    resultsContainer.style.cssText = `
                        position: absolute;
                        top: var(--header-height, 50px);
                        left: 0;
                        right: 0;
                        bottom: 0;
                        overflow-y: auto;
                        z-index: 10;
                        background: var(--bg-primary);
                        padding: 24px;
                    `;
                    document.querySelector('.main').appendChild(resultsContainer);
                }
                
                // Clear previous and show
                resultsContainer.style.display = 'block';
                resultsContainer.innerHTML = `
                    <div style="max-width: 900px; margin: 0 auto; width: 100%; padding: 0 16px; box-sizing: border-box;">
                        <div style="margin-bottom: 24px;">
                            <h2 style="font-size: clamp(18px, 5vw, 24px); font-weight: 600; color: var(--text-primary); margin: 0 0 8px 0; display: flex; align-items: center; gap: 12px;">
                                <i class="ph ph-tag" style="color: #fbbf24;"></i>
                                ${this.escapeHtml(tag)}
                            </h2>
                            <p style="color: var(--text-secondary); margin: 0;">${notes.length} note${notes.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${notes.map(note => `
                                <div class="tag-result-card" data-note-id="${note.id}" style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.2s;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                        <i class="ph ph-file-text" style="color: var(--text-secondary);"></i>
                                        <span style="font-weight: 500; color: var(--text-primary);">${this.stripHtml(note.title) || 'Untitled'}</span>
                                    </div>
                                    <div style="color: var(--text-secondary); font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
                                        ${this.escapeHtml(this.stripHtml(note.content).substring(0, 200))}${this.stripHtml(note.content).length > 200 ? '...' : ''}
                                    </div>
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                            ${note.tags.map(t => `<span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 2px 8px; border-radius: 12px; font-size: 12px;">#${this.escapeHtml(t)}</span>`).join('')}
                                        </div>
                                        <span style="color: var(--text-tertiary); font-size: 12px; display: flex; align-items: center; gap: 4px;">
                                            <i class="ph ph-folder"></i>
                                            ${this.getFolderName(note.folderId)}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;

                // Add hover effect and click handlers
                resultsContainer.querySelectorAll('.tag-result-card').forEach(card => {
                    card.addEventListener('mouseenter', () => {
                        card.style.borderColor = 'var(--accent)';
                    });
                    card.addEventListener('mouseleave', () => {
                        card.style.borderColor = 'var(--border)';
                    });
                    card.addEventListener('click', () => {
                        resultsContainer.style.display = 'none';
                        this.selectNote(card.dataset.noteId);
                    });
                });
            }

            getFolderName(folderId) {
                const folder = this.data.folders.find(f => f.id === folderId);
                return folder ? folder.name : 'Unknown';
            }

            // ==================== SEARCH ====================

            search(query) {
                if (!query.trim()) {
                    document.getElementById('searchResults').classList.remove('active');
                    return;
                }

                const q = query.toLowerCase();
                const results = this.data.notes.filter(note => {
                    return note.title.toLowerCase().includes(q) ||
                           note.content.toLowerCase().includes(q) ||
                           note.tags.some(t => t.toLowerCase().includes(q));
                }).slice(0, 10);

                const resultsEl = document.getElementById('searchResults');

                if (results.length === 0) {
                    resultsEl.innerHTML = '<div class="search-result-item"><div class="search-result-preview">No results found</div></div>';
                } else {
                    resultsEl.innerHTML = results.map(note => {
                        const preview = this.stripHtml(note.content).substring(0, 100);
                        return `
                            <div class="search-result-item" data-note="${note.id}">
                                <div class="search-result-title">${this.escapeHtml(note.title)}</div>
                                <div class="search-result-preview">${this.escapeHtml(preview)}${preview.length >= 100 ? '...' : ''}</div>
                                <div class="search-result-meta">${note.tags.map(t => '#' + t).join(' ')}</div>
                            </div>
                        `;
                    }).join('');
                }

                resultsEl.classList.add('active');

                resultsEl.querySelectorAll('.search-result-item[data-note]').forEach(el => {
                    el.addEventListener('click', () => {
                        this.selectNote(el.dataset.note);
                        resultsEl.classList.remove('active');
                        document.getElementById('searchInput').value = '';
                    });
                });
            }

            // ==================== EDITOR OPERATIONS ====================

            execCommand(command, value = null) {
                document.execCommand(command, false, value);
                document.getElementById('wysiwygEditor').focus();
                this.updateToolbarState();
            }

            updateToolbarState() {
                const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
                commands.forEach(cmd => {
                    const btn = document.querySelector(`[data-command="${cmd}"]`);
                    if (btn) {
                        btn.classList.toggle('active', document.queryCommandState(cmd));
                    }
                });
            }

            insertLink() {
                const selection = window.getSelection().toString();
                document.getElementById('linkText').value = selection;
                document.getElementById('linkUrl').value = '';
                document.getElementById('linkModal').classList.add('active');
            }

            confirmLink() {
                const text = document.getElementById('linkText').value;
                const url = document.getElementById('linkUrl').value;

                if (!url) return;

                // Check if it's an internal link (note title)
                const linkedNote = this.data.notes.find(n =>
                    n.title.toLowerCase() === url.toLowerCase()
                );

                if (linkedNote) {
                    // Internal link
                    const html = `<a href="note:${linkedNote.id}" class="internal-link">${text || linkedNote.title}</a>`;
                    this.execCommand('insertHTML', html);
                } else {
                    // External link
                    this.execCommand('createLink', url);
                }

                document.getElementById('linkModal').classList.remove('active');
            }

            async insertImage() {
                const input = document.getElementById('fileInput');
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const base64 = event.target.result;
                        const id = 'img_' + Date.now();

                        // Save to IndexedDB if large
                        if (base64.length > 50000) {
                            await this.saveAttachment(id, base64);
                            this.execCommand('insertImage', base64);
                        } else {
                            this.execCommand('insertImage', base64);
                        }
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            }

            setupAutoSave() {
                const editor = document.getElementById('wysiwygEditor');
                const titleInput = document.getElementById('noteTitle');

                let timeout;
                let versionTimeout;

                const save = () => {
                    if (this.currentNote) {
                        this.updateNote(this.currentNote.id, {
                            title: titleInput.value || 'Untitled Note',
                            content: editor.innerHTML
                        });
                    }
                };

                const saveVersion = () => {
                    if (this.currentNote) {
                        this.saveVersion(this.currentNote.id);
                    }
                };

                editor.oninput = () => {
                    clearTimeout(timeout);
                    clearTimeout(versionTimeout);
                    timeout = setTimeout(save, 1000);
                    // Save version after 5 seconds of inactivity
                    versionTimeout = setTimeout(saveVersion, 5000);
                };

                titleInput.oninput = () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(save, 500);
                };
            }

            // ==================== EXPORT/IMPORT ====================

            exportJSON() {
                const data = JSON.stringify(this.data, null, 2);
                this.downloadFile(data, 'knowledge-base-backup.json', 'application/json');
                this.showToast('Exported as JSON', 'success');
            }

            exportMarkdown() {
                let md = '# Knowledge Base Export\n\n';

                this.data.notes.forEach(note => {
                    md += `## ${note.title}\n\n`;
                    md += `*Folder: ${this.getFolderPath(note.folderId).map(f => f.name).join(' / ')}*\n\n`;
                    if (note.tags.length) {
                        md += `Tags: ${note.tags.join(', ')}\n\n`;
                    }
                    md += this.htmlToMarkdown(note.content);
                    md += '\n\n---\n\n';
                });

                this.downloadFile(md, 'knowledge-base-export.md', 'text/markdown');
                this.showToast('Exported as Markdown', 'success');
            }

            exportNoteToPDF(noteId) {
                const note = this.data.notes.find(n => n.id === noteId);
                if (!note) {
                    this.showToast('Note not found', 'error');
                    return;
                }

                // Simple HTML-to-PDF using print dialog
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                    this.showToast('Please allow popups to export PDF', 'error');
                    return;
                }

                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${this.escapeHtml(note.title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="content">${note.content}</div>
</body>
</html>
                `;

                printWindow.document.write(htmlContent);
                printWindow.document.close();

                // Auto-trigger print dialog
                setTimeout(() => {
                    printWindow.print();
                }, 500);

                this.showToast('PDF export ready - use Save as PDF in print dialog', 'success');
            }

            importData() {
                // Legacy function - kept for compatibility
                this.openImportWizard();
            }

            openImportWizard() {
                // Reset wizard state
                document.getElementById('importStep1').style.display = 'block';
                document.getElementById('importStep2').style.display = 'none';
                document.getElementById('importStep3').style.display = 'none';
                document.getElementById('importStep4').style.display = 'none';
                document.getElementById('backImportStep').style.display = 'none';
                
                // Clear any previous selection
                document.querySelectorAll('.import-source-option').forEach(opt => {
                    opt.style.borderColor = 'var(--border)';
                    opt.style.background = '';
                });
                
                // Show modal
                document.getElementById('importWizardModal').classList.add('active');
                
                // Setup close buttons
                document.getElementById('closeImportWizard').onclick = () => {
                    document.getElementById('importWizardModal').classList.remove('active');
                };
                document.getElementById('cancelImportWizard').onclick = () => {
                    document.getElementById('importWizardModal').classList.remove('active');
                };
                
                // Setup step 1 listeners
                document.querySelectorAll('.import-source-option').forEach(option => {
                    option.onclick = () => {
                        // Visual selection
                        document.querySelectorAll('.import-source-option').forEach(opt => {
                            opt.style.borderColor = 'var(--border)';
                            opt.style.background = '';
                        });
                        option.style.borderColor = 'var(--accent)';
                        option.style.background = 'var(--bg-hover)';
                        
                        const source = option.dataset.source;
                        this.showImportStep2(source);
                    };
                });
            }

            showImportStep2(source) {
                const instructions = document.getElementById('exportInstructions');
                
                if (source === 'notion') {
                    instructions.innerHTML = `
                        <div style="font-size: 16px; line-height: 1.7;">
                            <strong style="font-size: 18px; color: var(--text-primary);">How to export from Notion:</strong>
                            <ol style="margin: 16px 0; padding-left: 24px; color: var(--text-secondary);">
                                <li style="margin-bottom: 10px;">Open your Notion workspace</li>
                                <li style="margin-bottom: 10px;">Click <strong style="color: var(--text-primary);">Settings & Members</strong> → <strong style="color: var(--text-primary);">Settings</strong></li>
                                <li style="margin-bottom: 10px;">Scroll to <strong style="color: var(--text-primary);">Export</strong> section</li>
                                <li style="margin-bottom: 10px;">Click <strong style="color: var(--text-primary);">Export all workspace content</strong></li>
                                <li style="margin-bottom: 10px;">Choose <strong style="color: var(--text-primary);">Markdown & CSV</strong> format</li>
                                <li style="margin-bottom: 10px;">Wait for the email with download link</li>
                                <li>Download and extract the ZIP file</li>
                            </ol>
                            <p style="color: var(--text-tertiary); margin-top: 16px; font-size: 14px; font-style: italic;">
                                💡 Only Markdown files will be imported. CSV databases will be skipped.
                            </p>
                        </div>
                    `;
                } else if (source === 'obsidian') {
                    instructions.innerHTML = `
                        <div style="font-size: 16px; line-height: 1.7;">
                            <strong style="font-size: 18px; color: var(--text-primary);">How to export from Obsidian:</strong>
                            <ol style="margin: 16px 0; padding-left: 24px; color: var(--text-secondary);">
                                <li style="margin-bottom: 10px;">Open Obsidian on your computer</li>
                                <li style="margin-bottom: 10px;">Open the vault you want to export</li>
                                <li style="margin-bottom: 10px;">Go to <strong style="color: var(--text-primary);">Settings</strong> → <strong style="color: var(--text-primary);">Files and Links</strong></li>
                                <li style="margin-bottom: 10px;">Note your vault location, or:</li>
                                <li style="margin-bottom: 10px;">Use your file manager to locate the vault folder</li>
                                <li style="margin-bottom: 10px;">Create a ZIP file of the entire vault folder</li>
                                <li>Make sure Markdown (.md) files are included</li>
                            </ol>
                            <p style="color: var(--text-tertiary); margin-top: 16px; font-size: 14px; font-style: italic;">
                                💡 Your vault is just a folder of Markdown files. No special export needed!
                            </p>
                        </div>
                    `;
                }
                
                // Show step 2
                document.getElementById('importStep1').style.display = 'none';
                document.getElementById('importStep2').style.display = 'block';
                document.getElementById('backImportStep').style.display = 'inline-block';
                
                // Setup next button
                document.getElementById('goToImportStep3').onclick = () => {
                    this.showImportStep3();
                };
                
                // Setup back button
                document.getElementById('backImportStep').onclick = () => {
                    document.getElementById('importStep2').style.display = 'none';
                    document.getElementById('importStep1').style.display = 'block';
                    document.getElementById('backImportStep').style.display = 'none';
                };
            }

            showImportStep3() {
                document.getElementById('importStep2').style.display = 'none';
                document.getElementById('importStep3').style.display = 'block';
                
                // Setup file upload
                const dropZone = document.getElementById('importDropZone');
                const fileInput = document.getElementById('importFileInput');
                
                dropZone.onclick = () => fileInput.click();
                
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.processImportFile(file);
                    }
                };
                
                // Update back button
                document.getElementById('backImportStep').onclick = () => {
                    document.getElementById('importStep3').style.display = 'none';
                    document.getElementById('importStep2').style.display = 'block';
                };
            }

            processImportFile(file) {
                // Show progress
                document.getElementById('importStep3').style.display = 'none';
                document.getElementById('importStep4').style.display = 'block';
                document.getElementById('backImportStep').style.display = 'none';
                
                const progressText = document.getElementById('importProgressText');
                const progressBar = document.getElementById('importProgressBar');
                
                progressText.textContent = 'Reading file...';
                progressBar.style.width = '20%';
                
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    progressText.textContent = 'Processing content...';
                    progressBar.style.width = '50%';
                    
                    setTimeout(() => {
                        try {
                            if (file.name.endsWith('.json')) {
                                const data = JSON.parse(event.target.result);
                                if (data.notes && data.folders) {
                                    this.data = { ...this.data, ...data };
                                    this.saveData();
                                }
                            } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                                this.importMarkdown(event.target.result);
                            } else if (file.name.endsWith('.zip')) {
                                progressText.textContent = 'Extracting ZIP (simulated)...';
                                progressBar.style.width = '75%';
                                // Simulate ZIP processing
                                this.simulateZipImport();
                                return;
                            }
                            
                            progressText.textContent = 'Complete!';
                            progressBar.style.width = '100%';
                            
                            setTimeout(() => {
                                document.getElementById('importWizardModal').classList.remove('active');
                                this.render();
                                this.showToast('Import completed successfully', 'success');
                            }, 500);
                            
                        } catch (err) {
                            progressText.textContent = 'Error: ' + err.message;
                            progressBar.style.background = 'var(--danger)';
                            setTimeout(() => {
                                document.getElementById('importWizardModal').classList.remove('active');
                                this.showToast('Import failed: ' + err.message, 'error');
                            }, 1500);
                        }
                    }, 500);
                };
                
                reader.onerror = () => {
                    progressText.textContent = 'Error reading file';
                    progressBar.style.background = 'var(--danger)';
                };
                
                if (file.name.endsWith('.zip')) {
                    // For ZIP, we'd need JSZip library in a real implementation
                    // For now, simulate the import
                    reader.readAsText(file);
                } else {
                    reader.readAsText(file);
                }
            }

            simulateZipImport() {
                // Simulate creating sample data from ZIP
                const folders = [
                    { id: 'import_' + Date.now(), name: 'Imported Notes', parentId: null }
                ];
                
                const notes = [
                    {
                        id: 'note_import_1',
                        title: 'Welcome to Mind',
                        content: '<p>This is a sample imported note.</p>',
                        folderId: folders[0].id,
                        tags: ['imported'],
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                ];
                
                folders.forEach(f => this.data.folders.push(f));
                notes.forEach(n => this.data.notes.push(n));
                this.saveData();
                
                setTimeout(() => {
                    document.getElementById('importWizardModal').classList.remove('active');
                    this.render();
                    this.showToast('Import completed! Sample data added.', 'success');
                }, 500);
            }

            checkForBackups() {
                const statusEl = document.getElementById('backupStatus');
                const saved = localStorage.getItem('kb_data');
                const backup = localStorage.getItem('kb_data_backup');

                let message = '';
                if (saved) {
                    try {
                        const data = JSON.parse(saved);
                        const folderCount = data.folders ? data.folders.length : 0;
                        const noteCount = data.notes ? data.notes.length : 0;
                        message += `Current data: ${folderCount} folders, ${noteCount} notes. `;
                    } catch (e) {
                        message += 'Current data: corrupted. ';
                    }
                } else {
                    message += 'No current data found. ';
                }

                if (backup) {
                    try {
                        const data = JSON.parse(backup);
                        const folderCount = data.folders ? data.folders.length : 0;
                        const noteCount = data.notes ? data.notes.length : 0;
                        message += `Backup found: ${folderCount} folders, ${noteCount} notes.`;

                        if (confirm('Backup found! Would you like to restore it?')) {
                            localStorage.setItem('kb_data', backup);
                            this.loadData();
                            this.render();
                            this.showToast('Backup restored!', 'success');
                        }
                    } catch (e) {
                        message += 'Backup: corrupted.';
                    }
                } else {
                    message += 'No backup found.';
                }

                statusEl.textContent = message;
            }

            createBackup() {
                try {
                    const data = localStorage.getItem('kb_data');
                    if (data) {
                        // Clear old backup first to free space
                        localStorage.removeItem('kb_data_backup');
                        localStorage.removeItem('kb_backup_date');
                        // Save new backup
                        localStorage.setItem('kb_data_backup', data);
                        localStorage.setItem('kb_backup_date', new Date().toISOString());
                        document.getElementById('backupStatus').textContent = 'Backup created at ' + new Date().toLocaleString();
                        this.showToast('Backup created successfully', 'success');
                    } else {
                        document.getElementById('backupStatus').textContent = 'No data to backup';
                    }
                } catch (e) {
                    console.error('Backup failed:', e);
                    document.getElementById('backupStatus').textContent = 'Backup failed: ' + e.message;
                    this.showToast('Backup failed: ' + e.message, 'error');
                }
            }

            importMarkdown(content) {
                // Simple markdown import - create one note per file
                const title = content.match(/^#\s+(.+)$/m)?.[1] || 'Imported Note';
                const note = this.createNote(title, 'inbox');
                note.content = this.markdownToHtml(content);
                this.saveData();
                this.selectNote(note.id);
                this.showToast('Markdown imported', 'success');
            }

            downloadFile(content, filename, type) {
                const blob = new Blob([content], { type });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }

            clearAllData() {
                if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
                    localStorage.removeItem('kb_data');
                    this.data = {
                        folders: [
                            { id: 'root', name: 'All Notes', parentId: null },
                            { id: 'inbox', name: 'Inbox', parentId: null }
                        ],
                        notes: [],
                        tags: [],
                        settings: { theme: 'auto', sidebarCollapsed: {} }
                    };
                    this.currentNote = null;
                    this.currentFolder = 'root';
                    this.showEmptyState();
                    this.render();
                    this.showToast('All data cleared', 'success');
                }
            }

            // ==================== UI HELPERS ====================

            showContextMenu(e, type, id) {
                this.contextMenuTarget = { type, id };
                const menu = document.getElementById('contextMenu');

                // Position menu
                const x = Math.min(e.clientX, window.innerWidth - 180);
                const y = Math.min(e.clientY, window.innerHeight - 150);
                menu.style.left = x + 'px';
                menu.style.top = y + 'px';
                menu.classList.add('active');
            }

            hideContextMenu() {
                document.getElementById('contextMenu').classList.remove('active');
                this.contextMenuTarget = null;
            }

            showToast(message, type = 'success') {
                const container = document.getElementById('toastContainer');
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.innerHTML = `
                    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
                    <span class="toast-message">${this.escapeHtml(message)}</span>
                    <button class="toast-close">×</button>
                `;

                container.appendChild(toast);

                toast.querySelector('.toast-close').addEventListener('click', () => {
                    toast.remove();
                });

                setTimeout(() => toast.remove(), 4000);
            }

            updateTemplateDropdown() {
                const select = document.getElementById('templateSelect');
                const customTemplates = this.data.customTemplates || [];
                
                // Build options - only custom templates + save option
                let html = `
                    <option value="">Template</option>
                `;
                
                // Add custom templates
                customTemplates.forEach(t => {
                    html += `<option value="${t.id}">${this.escapeHtml(t.name)} 🗑</option>`;
                });
                
                html += `<option value="save-current">+ Save as Template</option>`;
                
                select.innerHTML = html;
            }

            toggleFocusMode() {
                document.body.classList.toggle('distraction-free');
            }

            toggleSidebar() {
                document.getElementById('sidebar').classList.toggle('open');
                document.getElementById('sidebarOverlay').classList.toggle('active');
            }

            // ==================== EVENT LISTENERS ====================

            setupEventListeners() {
                console.log('Setting up event listeners...');

                // Settings - set up first for debugging
                const settingsBtn = document.getElementById('settingsBtn');
                const settingsModal = document.getElementById('settingsModal');
                if (settingsBtn && settingsModal) {
                    settingsBtn.addEventListener('click', () => {
                        console.log('Settings button clicked');
                        settingsModal.classList.add('active');
                    });
                } else {
                    console.error('Settings elements not found:', {settingsBtn, settingsModal});
                }

                const closeSettings = document.getElementById('closeSettings');
                if (closeSettings && settingsModal) {
                    closeSettings.addEventListener('click', () => {
                        settingsModal.classList.remove('active');
                    });
                }

                // New note
                const newNoteBtn = document.getElementById('newNoteBtn');
                if (newNoteBtn) {
                    newNoteBtn.addEventListener('click', () => {
                        this.populateFolderSelect();
                        document.getElementById('newNoteModal').classList.add('active');
                        document.getElementById('newNoteTitle').focus();
                    });
                }

                // Add new folder
                document.getElementById('addFolderBtn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const name = prompt('Enter folder name:');
                    if (name && name.trim()) {
                        this.createFolder(name.trim(), null);
                    }
                });

                document.getElementById('emptyNewNoteBtn').addEventListener('click', () => {
                    this.populateFolderSelect();
                    document.getElementById('newNoteModal').classList.add('active');
                    document.getElementById('newNoteTitle').focus();
                });

                document.getElementById('confirmNewNote').addEventListener('click', () => {
                    const title = document.getElementById('newNoteTitle').value;
                    const folderId = document.getElementById('newNoteFolder').value;
                    if (title.trim()) {
                        this.createNote(title, folderId);
                        document.getElementById('newNoteModal').classList.remove('active');
                        document.getElementById('newNoteTitle').value = '';
                    }
                });

                document.getElementById('cancelNewNote').addEventListener('click', () => {
                    document.getElementById('newNoteModal').classList.remove('active');
                });

                // Theme select
                document.getElementById('themeSelect').addEventListener('change', (e) => {
                    this.setTheme(e.target.value);
                });

                document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());

                // Export/Import
                document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJSON());
                document.getElementById('exportMarkdownBtn').addEventListener('click', () => this.exportMarkdown());
                document.getElementById('importBtn').addEventListener('click', () => {
                    // Close settings and open import wizard
                    document.getElementById('settingsModal').classList.remove('active');
                    this.openImportWizard();
                });
                document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());
                // Debug button
                const debugBtn = document.getElementById('debugBtn');
                if (debugBtn) {
                    debugBtn.addEventListener('click', () => {
                        const folderInfo = this.data.folders.map(f => `  - ${f.name} (id: ${f.id}, parent: ${f.parentId})`).join('\n');
                        const noteInfo = this.data.notes.map(n => `  - ${n.title} (folder: ${n.folderId})`).join('\n');
                        const debugOutput = `FOLDERS (${this.data.folders.length}):\n${folderInfo}\n\nNOTES (${this.data.notes.length}):\n${noteInfo || '  (none)'}`;
                        console.log('=== DEBUG INFO ===');
                        console.log(debugOutput);
                        console.log('==================');
                        // Also copy to clipboard
                        navigator.clipboard.writeText(debugOutput).then(() => {
                            this.showToast('Debug info copied to clipboard!', 'success');
                        }).catch(() => {
                            this.showToast('Debug info logged to console (F12)', 'success');
                        });
                    });
                }

                // Backup buttons
                document.getElementById('checkBackupBtn').addEventListener('click', () => this.checkForBackups());
                document.getElementById('createBackupBtn').addEventListener('click', () => this.createBackup());

                // Focus mode - exit button only (toggle is now in sidebar tab)
                const exitFocusBtn = document.getElementById('exitFocusBtn');
                if (exitFocusBtn) {
                    exitFocusBtn.addEventListener('click', () => this.toggleFocusMode());
                }

                // Mobile menu
                document.getElementById('menuBtn').addEventListener('click', () => this.toggleSidebar());
                document.getElementById('sidebarOverlay').addEventListener('click', () => this.toggleSidebar());

                // Toolbar
                document.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const command = btn.dataset.command;
                        const value = btn.dataset.value || null;
                        this.execCommand(command, value);
                    });
                });

                document.getElementById('linkBtn').addEventListener('click', () => this.insertLink());
                document.getElementById('imageBtn').addEventListener('click', () => this.insertImage());
                document.getElementById('confirmLink').addEventListener('click', () => this.confirmLink());
                document.getElementById('cancelLink').addEventListener('click', () => {
                    document.getElementById('linkModal').classList.remove('active');
                });

                // Search
                document.getElementById('searchInput').addEventListener('input', (e) => {
                    this.search(e.target.value);
                });

                document.getElementById('searchInput').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.search(e.target.value);
                    }
                });

                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.sidebar-search')) {
                        document.getElementById('searchResults').classList.remove('active');
                    }
                });

                // Tags input with autocomplete
                const tagInput = document.getElementById('tagInput');
                let tagAutocomplete = document.getElementById('tagAutocomplete');
                let activeAutocompleteIndex = -1;

                // Move autocomplete to body for proper positioning
                if (tagAutocomplete) {
                    document.body.appendChild(tagAutocomplete);
                }

                function positionAutocomplete() {
                    if (!tagAutocomplete || tagAutocomplete.style.display === 'none') return;
                    const rect = tagInput.getBoundingClientRect();
                    tagAutocomplete.style.left = rect.left + 'px';
                    tagAutocomplete.style.top = (rect.bottom + 4) + 'px';
                }

                tagInput.addEventListener('input', (e) => {
                    const value = e.target.value.trim().toLowerCase();
                    
                    if (value.length === 0) {
                        tagAutocomplete.style.display = 'none';
                        return;
                    }
                    
                    const existingTags = this.getAllTags();
                    const currentNoteTags = this.currentNote?.tags || [];
                    const matches = existingTags.filter(tag => 
                        tag.toLowerCase().includes(value) && 
                        !currentNoteTags.includes(tag)
                    ).slice(0, 5);
                    
                    if (matches.length > 0) {
                        const rect = tagInput.getBoundingClientRect();
                        tagAutocomplete.innerHTML = matches.map((tag, index) => `
                            <div class="tag-autocomplete-item ${index === 0 ? 'active' : ''}" data-tag="${this.escapeHtml(tag)}" data-index="${index}">
                                <i class="ph ph-tag"></i>
                                ${this.escapeHtml(tag)}
                            </div>
                        `).join('');
                        
                        tagAutocomplete.style.cssText = `
                            display: block !important;
                            position: fixed;
                            z-index: 99999;
                            background: var(--bg-primary);
                            border: 1px solid var(--accent);
                            border-radius: 4px;
                            max-height: 200px;
                            overflow-y: auto;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            min-width: ${rect.width}px;
                            width: auto;
                        `;
                        positionAutocomplete();
                        activeAutocompleteIndex = 0;
                        
                        tagAutocomplete.querySelectorAll('.tag-autocomplete-item').forEach(item => {
                            item.addEventListener('click', () => {
                                if (this.currentNote) {
                                    this.addTagToNote(this.currentNote.id, item.dataset.tag);
                                    tagInput.value = '';
                                    tagAutocomplete.style.display = 'none';
                                }
                            });
                        });
                    } else {
                        tagAutocomplete.style.display = 'none';
                    }
                });

                // Reposition on scroll/resize
                window.addEventListener('scroll', positionAutocomplete);
                window.addEventListener('resize', positionAutocomplete);

                tagInput.addEventListener('keydown', (e) => {
                    const items = tagAutocomplete.querySelectorAll('.tag-autocomplete-item');
                    
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (items.length > 0) {
                            items[activeAutocompleteIndex]?.classList.remove('active');
                            activeAutocompleteIndex = (activeAutocompleteIndex + 1) % items.length;
                            items[activeAutocompleteIndex]?.classList.add('active');
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (items.length > 0) {
                            items[activeAutocompleteIndex]?.classList.remove('active');
                            activeAutocompleteIndex = activeAutocompleteIndex <= 0 ? items.length - 1 : activeAutocompleteIndex - 1;
                            items[activeAutocompleteIndex]?.classList.add('active');
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const activeItem = items[activeAutocompleteIndex];
                        if (activeItem && tagAutocomplete.style.display !== 'none') {
                            // Use the suggested tag
                            if (this.currentNote) {
                                this.addTagToNote(this.currentNote.id, activeItem.dataset.tag);
                                tagInput.value = '';
                                tagAutocomplete.style.display = 'none';
                            }
                        } else {
                            // Add new tag from input
                            const tag = tagInput.value.trim();
                            if (tag && this.currentNote) {
                                this.addTagToNote(this.currentNote.id, tag);
                                tagInput.value = '';
                            }
                        }
                    } else if (e.key === ',' || e.key === ' ') {
                        // Allow comma to add tag
                        if (e.key === ',') {
                            e.preventDefault();
                            const tag = tagInput.value.trim();
                            if (tag && this.currentNote) {
                                this.addTagToNote(this.currentNote.id, tag);
                                tagInput.value = '';
                                tagAutocomplete.style.display = 'none';
                            }
                        }
                    } else if (e.key === 'Escape') {
                        tagAutocomplete.style.display = 'none';
                    }
                });

                // Hide autocomplete when clicking outside
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.note-tags-input')) {
                        tagAutocomplete.style.display = 'none';
                    }
                });

                // Context menu
                document.getElementById('ctxRename').addEventListener('click', () => {
                    if (this.contextMenuTarget?.type === 'folder') {
                        const folder = this.data.folders.find(f => f.id === this.contextMenuTarget.id);
                        const newName = prompt('Rename folder:', folder?.name);
                        if (newName) this.renameFolder(this.contextMenuTarget.id, newName);
                    } else if (this.contextMenuTarget?.type === 'note') {
                        this.renameNote(this.contextMenuTarget.id);
                    }
                    this.hideContextMenu();
                });

                document.getElementById('ctxDuplicate').addEventListener('click', () => {
                    if (this.contextMenuTarget?.type === 'note') {
                        this.duplicateNote(this.contextMenuTarget.id);
                    }
                    this.hideContextMenu();
                });

                document.getElementById('ctxMove').addEventListener('click', () => {
                    if (this.contextMenuTarget?.type === 'note') {
                        const folderId = prompt('Enter folder ID (root, inbox, archive, or custom):', 'root');
                        if (folderId) this.moveNote(this.contextMenuTarget.id, folderId);
                    }
                    this.hideContextMenu();
                });

                document.getElementById('ctxDelete').addEventListener('click', () => {
                    if (this.contextMenuTarget?.type === 'note') {
                        this.deleteNote(this.contextMenuTarget.id);
                    } else if (this.contextMenuTarget?.type === 'folder') {
                        this.deleteFolder(this.contextMenuTarget.id);
                    }
                    this.hideContextMenu();
                });

                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.context-menu')) {
                        this.hideContextMenu();
                    }
                });

                // Collapsible sections
                document.querySelectorAll('.section-header').forEach(header => {
                    header.addEventListener('click', () => {
                        const section = header.dataset.section;
                        const content = document.getElementById(section + 'Section');
                        const toggle = header.querySelector('.section-toggle');
                        content.classList.toggle('collapsed');
                        toggle.classList.toggle('collapsed');
                    });
                });

                // Section toggles
                document.querySelectorAll('.section-toggle').forEach(toggle => {
                    toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const section = toggle.closest('.section-header').dataset.section;
                        const content = document.getElementById(section + 'Section');
                        content.classList.toggle('collapsed');
                        toggle.classList.toggle('collapsed');
                    });
                });

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    // Cmd/Ctrl + K for search
                    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                        e.preventDefault();
                        document.getElementById('searchInput').focus();
                    }

                    // Cmd/Ctrl + N for new note
                    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                        e.preventDefault();
                        const newNoteBtn = document.getElementById('newNoteBtn');
                        if (newNoteBtn) {
                            newNoteBtn.click();
                        } else {
                            // Fallback if button removed - open modal directly
                            this.populateFolderSelect();
                            document.getElementById('newNoteModal').classList.add('active');
                            document.getElementById('newNoteTitle').focus();
                        }
                    }

                    // Escape to close modals
                    if (e.key === 'Escape') {
                        document.querySelectorAll('.modal-overlay.active').forEach(m => {
                            m.classList.remove('active');
                        });
                    }
                });

                // More button - note menu
                const moreBtn = document.getElementById('moreBtn');
                const noteMenuDropdown = document.getElementById('noteMenuDropdown');

                if (moreBtn && noteMenuDropdown) {
                    moreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        noteMenuDropdown.classList.toggle('show');
                    });

                    // Close menu when clicking outside
                    document.addEventListener('click', () => {
                        noteMenuDropdown.classList.remove('show');
                    });

                    // New tab button
                    const newTabBtn = document.getElementById('newTabBtn');
                    if (newTabBtn) {
                        newTabBtn.addEventListener('click', () => {
                            this.createNote('', this.currentFolder || 'root');
                        });
                    }

                    // Font options
                    noteMenuDropdown.querySelectorAll('.note-menu-font-option').forEach(option => {
                        option.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const font = option.dataset.font;
                            const editor = document.getElementById('wysiwygEditor');

                            // Remove all font classes
                            editor.classList.remove('font-serif', 'font-mono');

                            // Add selected font class
                            if (font === 'serif') {
                                editor.classList.add('font-serif');
                            } else if (font === 'mono') {
                                editor.classList.add('font-mono');
                            }

                            // Update active state
                            noteMenuDropdown.querySelectorAll('.note-menu-font-option').forEach(opt => {
                                opt.classList.remove('active');
                            });
                            option.classList.add('active');

                            // Save preference
                            if (this.currentNote) {
                                this.currentNote.fontFamily = font;
                                this.saveData();
                            }
                        });
                    });

                    // Menu actions
                    noteMenuDropdown.querySelectorAll('.note-menu-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const action = item.dataset.action;
                            noteMenuDropdown.classList.remove('show');

                            if (!this.currentNote) return;

                            switch(action) {
                                case 'copy':
                                    const content = document.getElementById('wysiwygEditor').innerText;
                                    navigator.clipboard.writeText(content).then(() => {
                                        this.showToast('Page contents copied!', 'success');
                                    });
                                    break;
                                case 'duplicate':
                                    this.duplicateNote(this.currentNote.id);
                                    break;
                                case 'pdf':
                                    this.exportNoteToPDF(this.currentNote.id);
                                    break;
                                case 'delete':
                                    this.deleteNote(this.currentNote.id);
                                    break;
                            }
                        });
                    });

                    // Toggle items
                    noteMenuDropdown.querySelectorAll('.note-menu-toggle').forEach(toggle => {
                        toggle.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const toggleType = toggle.dataset.toggle;
                            const indicator = toggle.querySelector('.note-menu-toggle-indicator');

                            if (toggleType === 'smallText') {
                                const editor = document.getElementById('wysiwygEditor');
                                editor.classList.toggle('small-text');
                                const isOn = editor.classList.contains('small-text');
                                indicator.textContent = isOn ? '●' : '○';
                                indicator.classList.toggle('on', isOn);
                                if (this.currentNote) {
                                    this.currentNote.smallText = isOn;
                                    this.saveData();
                                }
                            } else if (toggleType === 'fullWidth') {
                                const editorContent = document.querySelector('.editor-content');
                                editorContent.classList.toggle('full-width');
                                const isOn = editorContent.classList.contains('full-width');
                                indicator.textContent = isOn ? '●' : '○';
                                indicator.classList.toggle('on', isOn);
                                if (this.currentNote) {
                                    this.currentNote.fullWidth = isOn;
                                    this.saveData();
                                }
                            }
                        });
                    });
                    // Clip Webpage button
                    const clipWebpageBtn = document.getElementById('clipWebpageBtn');
                    const clipWebpageModal = document.getElementById('clipWebpageModal');
                    if (clipWebpageBtn && clipWebpageModal) {
                        clipWebpageBtn.addEventListener('click', () => {
                            noteMenuDropdown.classList.remove('show');
                            document.getElementById('clipUrlInput').value = '';
                            document.getElementById('clipStatus').style.display = 'none';
                            clipWebpageModal.classList.add('active');
                        });
                    }

                    // Close clip modal
                    const closeClipModal = document.getElementById('closeClipModal');
                    if (closeClipModal && clipWebpageModal) {
                        closeClipModal.addEventListener('click', () => {
                            clipWebpageModal.classList.remove('active');
                        });
                    }

                    // Clip webpage action
                    const clipWebpageAction = document.getElementById('clipWebpageAction');
                    if (clipWebpageAction) {
                        clipWebpageAction.addEventListener('click', async () => {
                            const url = document.getElementById('clipUrlInput').value.trim();
                            if (!url) {
                                this.showToast('Please enter a URL', 'error');
                                return;
                            }

                            const statusDiv = document.getElementById('clipStatus');
                            const statusText = document.getElementById('clipStatusText');
                            statusDiv.style.display = 'block';
                            statusText.textContent = 'Clipping page...';
                            clipWebpageAction.disabled = true;

                            try {
                                // Try to fetch the page content
                                const response = await fetch(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`);
                                if (!response.ok) throw new Error('Failed to fetch');
                                
                                const text = await response.text();
                                
                                // Create a new note with the clipped content
                                const note = this.createNote('Clipped: ' + url, this.currentFolder || 'root');
                                note.content = `<h1>${url}</h1><p><em>Clipped from: <a href="${url}" target="_blank">${url}</a></em></p><hr>${text.replace(/\n/g, '<br>')}`;
                                note.clippedFrom = url;
                                this.saveData();
                                
                                clipWebpageModal.classList.remove('active');
                                this.showToast('Web page clipped successfully!', 'success');
                                
                                // Refresh the note content
                                this.loadNoteIntoEditor(note);
                            } catch (err) {
                                statusText.textContent = 'Error: ' + err.message + '. Try copying content manually.';
                                this.showToast('Failed to clip page. Copy content manually.', 'error');
                            } finally {
                                clipWebpageAction.disabled = false;
                            }
                        });
                    }
                }

                // Sidebar resize functionality
                const sidebar = document.getElementById('sidebar');
                const resizeHandle = document.getElementById('sidebarResizeHandle');
                const sidebarToggleTab = document.getElementById('sidebarToggleTab');

                if (resizeHandle && sidebar) {
                    let isResizing = false;
                    let startX, startWidth;

                    resizeHandle.addEventListener('mousedown', (e) => {
                        if (sidebar.classList.contains('collapsed')) return;
                        isResizing = true;
                        startX = e.clientX;
                        startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
                        resizeHandle.classList.add('resizing');
                        document.body.style.cursor = 'col-resize';
                        e.preventDefault();
                    });

                    document.addEventListener('mousemove', (e) => {
                        if (!isResizing) return;
                        const width = startWidth + e.clientX - startX;
                        if (width >= 200 && width <= 500) {
                            sidebar.style.width = width + 'px';
                        }
                    });

                    document.addEventListener('mouseup', () => {
                        if (isResizing) {
                            isResizing = false;
                            resizeHandle.classList.remove('resizing');
                            document.body.style.cursor = '';
                            // Save width preference
                            if (this.data.settings) {
                                this.data.settings.sidebarWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
                                this.saveData();
                            }
                        }
                    });
                }

                // Sidebar toggle in tabs bar
                if (sidebarToggleTab && sidebar) {
                    sidebarToggleTab.addEventListener('click', () => {
                        sidebar.classList.toggle('collapsed');
                        sidebarToggleTab.title = sidebar.classList.contains('collapsed') ? 'Show Sidebar' : 'Hide Sidebar';
                        
                        // Save preference
                        if (this.data.settings) {
                            this.data.settings.sidebarCollapsed = sidebar.classList.contains('collapsed');
                            this.saveData();
                        }
                    });
                }

                // AI Suggest button
                const aiSuggestBtn = document.getElementById('aiSuggestBtn');
                const aiSuggestModal = document.getElementById('aiSuggestModal');
                const aiSuggestType = document.getElementById('aiSuggestType');
                const aiCustomRequestGroup = document.getElementById('aiCustomRequestGroup');
                const aiCustomRequest = document.getElementById('aiCustomRequest');
                const aiContentPreview = document.getElementById('aiContentPreview');
                const aiResultGroup = document.getElementById('aiResultGroup');
                const aiResult = document.getElementById('aiResult');
                const generateAiSuggest = document.getElementById('generateAiSuggest');
                const applyAiSuggest = document.getElementById('applyAiSuggest');
                const closeAiSuggest = document.getElementById('closeAiSuggest');

                if (aiSuggestBtn && aiSuggestModal) {
                    aiSuggestBtn.addEventListener('click', () => {
                        if (!this.currentNote) {
                            this.showToast('Open a note first', 'error');
                            return;
                        }

                        // Reset modal state
                        aiSuggestType.value = 'improve';
                        aiCustomRequestGroup.style.display = 'none';
                        aiCustomRequest.value = '';
                        aiResultGroup.style.display = 'none';
                        aiResult.textContent = '';
                        generateAiSuggest.style.display = 'inline-block';
                        applyAiSuggest.style.display = 'none';

                        // Show content preview
                        const content = document.getElementById('wysiwygEditor').innerText;
                        aiContentPreview.textContent = content.substring(0, 500) + (content.length > 500 ? '...' : '');

                        aiSuggestModal.classList.add('active');
                    });

                    // Show/hide custom request field
                    aiSuggestType.addEventListener('change', () => {
                        aiCustomRequestGroup.style.display =
                            aiSuggestType.value === 'custom' ? 'block' : 'none';
                    });

                    // Close modal
                    closeAiSuggest.addEventListener('click', () => {
                        aiSuggestModal.classList.remove('active');
                    });

                    // Generate suggestions (placeholder - integrate with AI later)
                    generateAiSuggest.addEventListener('click', () => {
                        const type = aiSuggestType.value;
                        const custom = aiCustomRequest.value;
                        const content = document.getElementById('wysiwygEditor').innerText;

                        generateAiSuggest.textContent = 'Thinking...';
                        generateAiSuggest.disabled = true;

                        // Simulate AI processing
                        setTimeout(() => {
                            let suggestion = '';

                            switch(type) {
                                case 'improve':
                                    suggestion = `[Improved version]\n\n${content}\n\n[Suggestions:\n- Consider using more active voice\n- Break long sentences into shorter ones\n- Add specific examples where possible]`;
                                    break;
                                case 'summarize':
                                    suggestion = `[Summary]\n\nKey points:\n- Main idea extracted from your note\n- Supporting detail 1\n- Supporting detail 2\n\n[Original text: ${content.substring(0, 200)}...]`;
                                    break;
                                case 'expand':
                                    suggestion = `[Expanded version]\n\n${content}\n\n[Additional context and details would be added here to elaborate on your key points. Each major idea would be developed with examples and supporting information.]`;
                                    break;
                                case 'fix':
                                    suggestion = `[Grammar \u0026 spelling checked]\n\n${content}\n\n[Corrections made:\n- Fixed punctuation\n- Corrected spelling\n- Improved sentence structure]`;
                                    break;
                                case 'simplify':
                                    suggestion = `[Simplified version]\n\n${content}\n\n[Changes made:\n- Replaced complex words with simpler alternatives\n- Shortened long sentences\n- Removed jargon]`;
                                    break;
                                case 'custom':
                                    suggestion = `[Custom: ${custom}]\n\n${content}\n\n[AI would process your specific request: "${custom}" and provide tailored suggestions here.]`;
                                    break;
                            }

                            aiResult.textContent = suggestion;
                            aiResultGroup.style.display = 'block';
                            generateAiSuggest.style.display = 'none';
                            applyAiSuggest.style.display = 'inline-block';
                            generateAiSuggest.textContent = 'Generate Suggestions';
                            generateAiSuggest.disabled = false;
                        }, 1500);
                    });

                    // Apply suggestions
                    applyAiSuggest.addEventListener('click', () => {
                        const suggestion = aiResult.textContent;
                        // For now, just show what would be applied
                        this.showToast('Feature ready for AI integration!', 'success');
                        aiSuggestModal.classList.remove('active');
                    });
                }

                // Version History
                const versionHistoryBtn = document.getElementById('versionHistoryBtn');
                if (versionHistoryBtn) {
                    versionHistoryBtn.addEventListener('click', () => this.openVersionHistory());
                }

                document.getElementById('closeVersionHistory').addEventListener('click', () => this.closeVersionHistory());
                document.getElementById('cancelVersionRestore').addEventListener('click', () => this.closeVersionHistory());
                document.getElementById('confirmVersionRestore').addEventListener('click', () => this.restoreVersion());

                // AI Panel - opened from Settings
                document.getElementById('aiSettingsBtn')?.addEventListener('click', () => {
                    document.getElementById('settingsModal').classList.remove('active');
                    document.getElementById('aiPanelModal').classList.add('active');
                });

                // Trash - opened from Settings
                document.getElementById('trashBtn')?.addEventListener('click', () => {
                    document.getElementById('settingsModal').classList.remove('active');
                    this.openTrashModal();
                });

                // AI Panel setup (for the panel itself, not the button)
                this.setupAiPanelListeners();

                // Handle link clicks
                document.getElementById('wysiwygEditor').addEventListener('click', (e) => {
                    if (e.target.tagName === 'A') {
                        e.preventDefault();
                        const href = e.target.getAttribute('href');
                        if (e.target.classList.contains('internal-link')) {
                            const noteId = href.replace('note:', '');
                            const note = this.data.notes.find(n => n.id === noteId);
                            if (note) {
                                this.selectNote(note.id);
                            }
                        } else if (href) {
                            window.open(href, '_blank');
                        }
                    }
                });

                // Auto-create internal links on [[text]]
                document.getElementById('wysiwygEditor').addEventListener('input', (e) => {
                    const editor = e.target;
                    const text = editor.innerText;

                    // Check for [[text]] pattern
                    const match = text.match(/\[\[([^\]]+)\]\](?![^(]*\))/);
                    if (match && !e.isComposing) {
                        const linkText = match[1];
                        const linkedNote = this.data.notes.find(n =>
                            n.title.toLowerCase() === linkText.toLowerCase()
                        );

                        if (linkedNote) {
                            // Replace the pattern with a link
                            const html = editor.innerHTML;
                            const newHtml = html.replace(
                                new RegExp(`\\[\\[${this.escapeRegex(linkText)}\\]\\]`),
                                `<a href="note:${linkedNote.id}" class="internal-link">${linkedNote.title}</a>`
                            );
                            editor.innerHTML = newHtml;

                            // Move cursor to end
                            const range = document.createRange();
                            range.selectNodeContents(editor);
                            range.collapse(false);
                            const sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                });

                // Selection Toolbar
                this.setupSelectionToolbar();

                // Note Tabs
                document.querySelectorAll('.note-tab').forEach(tab => {
                    tab.addEventListener('click', () => this.switchNoteTab(tab.dataset.tab));
                });

                // Add First Task button
                document.getElementById('addFirstTaskBtn')?.addEventListener('click', () => this.addTask());

                // Template selector
                document.getElementById('templateSelect')?.addEventListener('change', (e) => this.applyTemplate(e.target.value));

                // AI Suggest Tags button
                document.getElementById('suggestTagsBtn')?.addEventListener('click', () => this.suggestTagsWithAi());

                // AI Summarize button
                document.getElementById('summarizeBtn')?.addEventListener('click', () => this.summarizeNote());
            }

            suggestTagsWithAi() {
                // Check if AI is configured
                if (!this.data.settings?.aiProvider) {
                    document.getElementById('aiPanelModal').classList.add('active');
                    return;
                }

                if (!this.currentNote) {
                    this.showToast('Open a note first', 'error');
                    return;
                }

                const content = document.getElementById('wysiwygEditor').innerText.trim();
                if (content.length < 10) {
                    this.showToast('Note needs more content', 'error');
                    return;
                }

                // Demo mode - generate suggestions based on keywords
                const suggestions = this.generateDemoTagSuggestions(content, this.currentNote.tags || []);
                
                if (suggestions.length === 0) {
                    this.showToast('No tag suggestions found', 'info');
                    return;
                }

                this.showTagSuggestionsModal(suggestions);
            }

            generateDemoTagSuggestions(content, existingTags) {
                const text = content.toLowerCase();
                const suggestions = [];
                
                const keywords = {
                    'trading': ['trading', 'trade', 'market', 'buy', 'sell', 'position'],
                    'psychology': ['psychology', 'mental', 'mindset', 'emotion', 'fear', 'greed'],
                    'analysis': ['analysis', 'chart', 'pattern', 'trend', 'support', 'resistance'],
                    'strategy': ['strategy', 'plan', 'system', 'method', 'approach'],
                    'risk-management': ['risk', 'stop loss', 'stop-loss', 'position size'],
                    'journal': ['journal', 'log', 'record', 'track', 'review'],
                    'learning': ['learn', 'study', 'education', 'course', 'book'],
                    'crypto': ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth'],
                    'forex': ['forex', 'currency', 'eurusd', 'gbpusd'],
                    'stocks': ['stock', 'equity', 'shares', 'nasdaq', 'nyse'],
                    'gold': ['gold', 'xauusd', 'xau'],
                    'tutorial': ['tutorial', 'guide', 'how to', 'lesson'],
                    'research': ['research', 'study', 'data', 'backtest'],
                    'ideas': ['idea', 'concept', 'thought', 'insight'],
                    'workflow': ['workflow', 'process', 'routine', 'habit'],
                    'review': ['review', 'retrospective', 'summary'],
                    'goals': ['goal', 'target', 'objective', 'aim']
                };

                for (const [tag, words] of Object.entries(keywords)) {
                    if (words.some(w => text.includes(w)) && !existingTags.includes(tag)) {
                        suggestions.push(tag);
                    }
                }

                return [...new Set(suggestions)].slice(0, 5);
            }

            showTagSuggestionsModal(suggestions) {
                // Create modal if not exists
                let modal = document.getElementById('tagSuggestionsModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'tagSuggestionsModal';
                    modal.className = 'modal-overlay';
                    modal.innerHTML = `
                        <div class="modal" style="max-width: 400px;">
                            <div class="modal-header">
                                <div class="modal-title"><i class="ph ph-sparkle"></i> Suggested Tags</div>
                                <button class="modal-close" onclick="document.getElementById('tagSuggestionsModal').classList.remove('active')">&times;</button>
                            </div>
                            <div class="modal-body">
                                <div style="background: var(--bg-tertiary); padding: 10px 12px; border-radius: var(--radius); margin-bottom: 16px; font-size: 12px; color: var(--text-secondary);">
                                    <i class="ph ph-info"></i> <strong>Demo mode:</strong> Tags suggested based on keywords in your note.
                                </div>
                                <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 13px;">Click tags to add them:</p>
                                <div id="tagSuggestionsList" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" onclick="document.getElementById('tagSuggestionsModal').classList.remove('active')">Close</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                }

                // Populate suggestions
                const list = document.getElementById('tagSuggestionsList');
                list.innerHTML = suggestions.map(tag => `
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" data-tag="${tag}">
                        <i class="ph ph-plus"></i> ${tag}
                    </button>
                `).join('');

                // Add click handlers
                list.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const tag = btn.dataset.tag;
                        if (this.currentNote) {
                            this.addTagToNote(this.currentNote.id, tag);
                            btn.style.opacity = '0.5';
                            btn.disabled = true;
                            btn.innerHTML = `<i class="ph ph-check"></i> ${tag}`;
                        }
                    });
                });

                // Show modal
                modal.classList.add('active');
            }

            summarizeNote() {
                // Check if AI is configured
                if (!this.data.settings?.aiProvider) {
                    document.getElementById('aiPanelModal').classList.add('active');
                    return;
                }

                if (!this.currentNote) {
                    this.showToast('Open a note first', 'error');
                    return;
                }

                const content = document.getElementById('wysiwygEditor').innerText.trim();
                if (content.length < 50) {
                    this.showToast('Note needs more content to summarize', 'error');
                    return;
                }

                // Show loading
                const btn = document.getElementById('summarizeBtn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Summarizing...';
                btn.disabled = true;

                // Simulate AI processing
                setTimeout(() => {
                    const summary = this.generateDemoSummary(content);
                    this.displaySummary(summary);
                    
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    this.showToast('Summary generated!', 'success');
                }, 1000);
            }

            generateDemoSummary(content) {
                const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
                const keywords = ['analysis', 'strategy', 'trading', 'market', 'psychology', 'risk', 'entry', 'exit', 'target', 'stop'];
                
                // Score sentences by keyword density
                const scored = sentences.map(sentence => {
                    const score = keywords.reduce((acc, kw) => {
                        return acc + (sentence.toLowerCase().includes(kw) ? 1 : 0);
                    }, 0);
                    return { sentence: sentence.trim(), score };
                });
                
                // Sort by score and pick top sentences
                scored.sort((a, b) => b.score - a.score);
                const topSentences = scored.slice(0, 3).map(s => s.sentence);
                
                // If no keywords matched, use first and last sentences
                if (topSentences.length === 0) {
                    topSentences.push(sentences[0]);
                    if (sentences.length > 1) topSentences.push(sentences[sentences.length - 1]);
                }
                
                return topSentences.join(' ');
            }

            displaySummary(summary) {
                document.getElementById('summaryEmptyState').style.display = 'none';
                document.getElementById('summaryResult').style.display = 'block';
                document.getElementById('summaryText').innerHTML = `<p>${summary}</p>`;
                
                // Store in note metadata
                if (!this.currentNote.metadata) this.currentNote.metadata = {};
                this.currentNote.metadata.summary = summary;
                this.saveData();
            }

            applyTemplate(templateId) {
                if (!templateId || !this.currentNote) {
                    document.getElementById('templateSelect').value = '';
                    return;
                }
                
                // Handle save current note as template
                if (templateId === 'save-current') {
                    const name = prompt('Template name:', this.currentNote.title || 'New Template');
                    if (name && name.trim()) {
                        const content = document.getElementById('wysiwygEditor').innerHTML;
                        if (!this.data.customTemplates) this.data.customTemplates = [];
                        this.data.customTemplates.push({
                            id: 'custom_' + Date.now(),
                            name: name.trim(),
                            content: content
                        });
                        this.saveData();
                        this.updateTemplateDropdown();
                        this.showToast('Template saved!', 'success');
                    }
                    document.getElementById('templateSelect').value = '';
                    return;
                }
                
                // Check for custom template - ask apply or delete
                const customTemplate = this.data.customTemplates?.find(t => t.id === templateId);
                if (customTemplate) {
                    const action = confirm(`Template: ${customTemplate.name}\n\nClick OK to APPLY this template\nClick Cancel to DELETE this template`);
                    if (!action) {
                        // Delete with confirmation
                        if (!confirm(`Delete template "${customTemplate.name}"?\n\nThis action cannot be undone.`)) {
                            document.getElementById('templateSelect').value = '';
                            return;
                        }
                        this.data.customTemplates = this.data.customTemplates.filter(t => t.id !== templateId);
                        this.saveData();
                        this.updateTemplateDropdown();
                        this.showToast('Template deleted', 'success');
                        document.getElementById('templateSelect').value = '';
                        return;
                    }
                    // Apply
                    const currentContent = document.getElementById('wysiwygEditor').innerText.trim();
                    if (currentContent.length > 50) {
                        if (!confirm('This will replace your current note content. Continue?')) {
                            document.getElementById('templateSelect').value = '';
                            return;
                        }
                    }
                    document.getElementById('wysiwygEditor').innerHTML = customTemplate.content;
                    this.currentNote.content = customTemplate.content;
                    this.saveData();
                    document.getElementById('templateSelect').value = '';
                    this.showToast(`Applied ${customTemplate.name} template`, 'success');
                    return;
                }
                
                // Unknown template - reset
                document.getElementById('templateSelect').value = '';
            }

            switchNoteTab(tabName) {
                // Update tab buttons
                document.querySelectorAll('.note-tab').forEach(tab => {
                    if (tab.dataset.tab === tabName) {
                        tab.classList.add('active');
                        tab.style.borderBottomColor = 'var(--accent)';
                        tab.style.color = 'var(--text-primary)';
                    } else {
                        tab.classList.remove('active');
                        tab.style.borderBottomColor = 'transparent';
                        tab.style.color = 'var(--text-secondary)';
                    }
                });

                // Hide all content
                document.getElementById('noteTabContent').style.display = 'none';
                document.getElementById('summaryTabContent').style.display = 'none';
                document.getElementById('tasksTabContent').style.display = 'none';

                // Show selected content
                if (tabName === 'note') {
                    document.getElementById('noteTabContent').style.display = 'block';
                } else if (tabName === 'summary') {
                    document.getElementById('summaryTabContent').style.display = 'block';
                } else if (tabName === 'tasks') {
                    document.getElementById('tasksTabContent').style.display = 'block';
                    this.renderTasks();
                }
            }

            addTask(text = '') {
                if (!this.currentNote) return;
                if (!this.currentNote.tasks) this.currentNote.tasks = [];
                
                const task = {
                    id: 'task_' + Date.now(),
                    text: text || '',
                    completed: false,
                    createdAt: Date.now()
                };
                
                this.currentNote.tasks.push(task);
                this.saveData();
                this.renderTasks();
                
                // Focus the new task input
                setTimeout(() => {
                    const input = document.querySelector(`[data-task-id="${task.id}"] .task-title-input`);
                    if (input) input.focus();
                }, 0);
            }

            toggleTask(taskId) {
                if (!this.currentNote?.tasks) return;
                const task = this.currentNote.tasks.find(t => t.id === taskId);
                if (task) {
                    task.completed = !task.completed;
                    this.saveData();
                    this.renderTasks();
                }
            }

            updateTaskTitle(taskId, text) {
                if (!this.currentNote?.tasks) return;
                const task = this.currentNote.tasks.find(t => t.id === taskId);
                if (task) {
                    task.text = text;
                    this.saveData();
                }
            }

            deleteTask(taskId) {
                if (!this.currentNote?.tasks) return;
                this.currentNote.tasks = this.currentNote.tasks.filter(t => t.id !== taskId);
                this.saveData();
                this.renderTasks();
            }

            renderTasks() {
                const container = document.getElementById('tasksList');
                if (!this.currentNote) {
                    container.innerHTML = '';
                    return;
                }

                const tasks = this.currentNote.tasks || [];
                
                if (tasks.length === 0) {
                    container.innerHTML = '';
                    return;
                }

                container.innerHTML = tasks.map(task => `
                    <div class="task-item" data-task-id="${task.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px;">
                        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}
                            >
                        <input type="text" class="task-title-input" value="${this.escapeHtml(task.text)}"
                            placeholder="Task..."
                            style="flex: 1; background: transparent; border: none; color: var(--text-primary); font-size: 14px; outline: none; text-decoration: ${task.completed ? 'line-through' : 'none'}; opacity: ${task.completed ? '0.6' : '1'}; padding: 0;">
                        <button class="task-delete" style="background: none; border: none; color: var(--text-tertiary); cursor: pointer; padding: 4px; opacity: 0; transition: opacity 0.2s;">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                `).join('');

                // Add event listeners
                container.querySelectorAll('.task-item').forEach(item => {
                    const taskId = item.dataset.taskId;
                    const checkbox = item.querySelector('.task-checkbox');
                    const titleInput = item.querySelector('.task-title-input');
                    const deleteBtn = item.querySelector('.task-delete');

                    checkbox.addEventListener('change', () => this.toggleTask(taskId));
                    titleInput.addEventListener('input', (e) => this.updateTaskTitle(taskId, e.target.value));
                    deleteBtn.addEventListener('click', () => this.deleteTask(taskId));

                    // Return key creates new task
                    titleInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.addTask();
                        }
                    });

                    // Show delete button on hover
                    item.addEventListener('mouseenter', () => deleteBtn.style.opacity = '1');
                    item.addEventListener('mouseleave', () => deleteBtn.style.opacity = '0');
                });
            }

            setupSelectionToolbar() {
                const toolbar = document.getElementById('selectionToolbar');
                const editor = document.getElementById('wysiwygEditor');
                let currentSelection = null;
                let currentRange = null;

                // Show toolbar on selection
                document.addEventListener('mouseup', (e) => {
                    setTimeout(() => {
                        const selection = window.getSelection();
                        const text = selection.toString().trim();

                        if (text.length > 0 && editor.contains(selection.anchorNode)) {
                            currentSelection = text;
                            currentRange = selection.getRangeAt(0).cloneRange();

                            // Get selection coordinates using getBoundingClientRect for viewport positioning
                            const rect = currentRange.getBoundingClientRect();
                            
                            // Make toolbar visible to get dimensions
                            toolbar.style.display = 'flex';
                            toolbar.style.visibility = 'hidden';
                            const toolbarRect = toolbar.getBoundingClientRect();
                            
                            // Calculate position - above the selection using viewport coordinates
                            let top = rect.top - toolbarRect.height - 8;
                            let left = rect.left;
                            
                            // If too close to top, show below selection
                            if (top < 0) {
                                top = rect.bottom + 8;
                            }
                            
                            // Keep within viewport horizontally
                            if (left + toolbarRect.width > window.innerWidth) {
                                left = window.innerWidth - toolbarRect.width - 16;
                            }
                            
                            // Apply fixed positioning
                            toolbar.style.position = 'fixed';
                            toolbar.style.top = top + 'px';
                            toolbar.style.left = left + 'px';
                            toolbar.style.visibility = 'visible';
                            toolbar.classList.add('visible');
                        } else {
                            toolbar.classList.remove('visible');
                            toolbar.style.display = 'none';
                        }
                    }, 0);
                });

                // Hide toolbar when clicking elsewhere
                document.addEventListener('mousedown', (e) => {
                    if (!toolbar.contains(e.target)) {
                        toolbar.classList.remove('visible');
                        toolbar.style.display = 'none';
                    }
                });

                // Formatting buttons
                toolbar.querySelectorAll('[data-command]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const command = btn.dataset.command;
                        const value = btn.dataset.value || null;
                        document.execCommand(command, false, value);
                        toolbar.classList.remove('visible');
                    });
                });

                // Link button
                document.getElementById('toolbarLinkBtn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = prompt('Enter URL:');
                    if (url) {
                        document.execCommand('createLink', false, url);
                    }
                    toolbar.classList.remove('visible');
                });

                // Image button
                document.getElementById('toolbarImageBtn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = prompt('Enter image URL:');
                    if (url) {
                        document.execCommand('insertImage', false, url);
                    }
                    toolbar.classList.remove('visible');
                });

                // Ask AI button
                document.getElementById('askAiSelectionBtn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toolbar.classList.remove('visible');
                    this.openAiSelectionModal(currentSelection, currentRange);
                });
            }

            openAiSelectionModal(selectedText, range) {
                const modal = document.getElementById('aiSelectionModal');
                document.getElementById('aiSelectedText').textContent = selectedText;
                document.getElementById('aiSuggestionResult').style.display = 'none';
                document.getElementById('aiLoadingState').style.display = 'none';

                // Store for later use
                this.currentAiRange = range;
                this.currentAiText = selectedText;

                modal.classList.add('active');

                // Close button
                document.getElementById('closeAiSelection').onclick = () => {
                    modal.classList.remove('active');
                };

                // AI action buttons
                document.querySelectorAll('.ai-action-btn').forEach(btn => {
                    btn.onclick = () => {
                        const action = btn.dataset.action;
                        this.processAiSelection(action);
                    };
                });

                // Accept/Discard buttons
                document.getElementById('acceptAiSuggestion').onclick = () => {
                    this.applyAiSuggestion();
                    modal.classList.remove('active');
                };

                document.getElementById('discardAiSuggestion').onclick = () => {
                    document.getElementById('aiSuggestionResult').style.display = 'none';
                };
            }

            processAiSelection(action) {
                const loading = document.getElementById('aiLoadingState');
                const result = document.getElementById('aiSuggestionResult');
                const resultText = document.getElementById('aiSuggestionText');

                loading.style.display = 'block';
                result.style.display = 'none';

                // Simulate AI processing
                setTimeout(() => {
                    loading.style.display = 'none';
                    result.style.display = 'block';

                    const original = this.currentAiText;
                    let suggestion = original;

                    switch(action) {
                        case 'improve':
                            suggestion = this.simulateAiImprove(original);
                            break;
                        case 'grammar':
                            suggestion = this.simulateAiGrammar(original);
                            break;
                        case 'shorter':
                            suggestion = this.simulateAiShorter(original);
                            break;
                        case 'longer':
                            suggestion = this.simulateAiLonger(original);
                            break;
                        case 'simplify':
                            suggestion = this.simulateAiSimplify(original);
                            break;
                        case 'professional':
                            suggestion = this.simulateAiProfessional(original);
                            break;
                    }

                    this.currentAiSuggestion = suggestion;
                    resultText.textContent = suggestion;
                }, 1500);
            }

            simulateAiImprove(text) {
                // Simple simulation - in real app this would call an AI API
                return text.replace(/\b(good|nice|big)\b/g, (match) => {
                    const improvements = {
                        'good': 'excellent',
                        'nice': 'elegant',
                        'big': 'substantial'
                    };
                    return improvements[match] || match;
                }) + ' (improved with better vocabulary and flow)';
            }

            simulateAiGrammar(text) {
                return text.replace(/\s+/g, ' ').trim() + '.';
            }

            simulateAiShorter(text) {
                const sentences = text.split(/[.!?]+/).filter(s => s.trim());
                return sentences.slice(0, Math.max(1, Math.floor(sentences.length / 2))).join('. ') + '.';
            }

            simulateAiLonger(text) {
                return text + ' This expanded version provides additional context and detail to make the point more comprehensive and easier to understand for the reader.';
            }

            simulateAiSimplify(text) {
                return text.replace(/\b(utilize|implement|facilitate|subsequently)\b/gi, (match) => {
                    const simple = {
                        'utilize': 'use',
                        'implement': 'do',
                        'facilitate': 'help',
                        'subsequently': 'then'
                    };
                    return simple[match.toLowerCase()] || match;
                }) + ' (simplified)';
            }

            simulateAiProfessional(text) {
                return 'In accordance with established protocols, ' + text.toLowerCase() + ' This approach ensures compliance with industry standards and best practices.';
            }

            applyAiSuggestion() {
                if (!this.currentAiRange || !this.currentAiSuggestion) return;

                const editor = document.getElementById('wysiwygEditor');
                editor.focus();

                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(this.currentAiRange);

                document.execCommand('insertText', false, this.currentAiSuggestion);
                this.showToast('AI suggestion applied', 'success');
            }

            setupMobileGestures() {
                let touchStartX = 0;
                let touchEndX = 0;

                document.addEventListener('touchstart', (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                }, { passive: true });

                document.addEventListener('touchend', (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    this.handleSwipe(touchStartX, touchEndX);
                }, { passive: true });
            }

            handleSwipe(startX, endX) {
                const threshold = 100;
                const diff = endX - startX;

                // Swipe right to open sidebar
                if (diff > threshold && startX < 50) {
                    document.getElementById('sidebar').classList.add('open');
                    document.getElementById('sidebarOverlay').classList.add('active');
                }

                // Swipe left to close sidebar
                if (diff < -threshold) {
                    document.getElementById('sidebar').classList.remove('open');
                    document.getElementById('sidebarOverlay').classList.remove('active');
                }
            }

            populateFolderSelect() {
                const select = document.getElementById('newNoteFolder');
                select.innerHTML = this.data.folders.map(f =>
                    `<option value="${f.id}">${this.escapeHtml(f.name)}</option>`
                ).join('');
                select.value = this.currentFolder;
            }

            // ==================== UTILITY FUNCTIONS ====================

            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            escapeRegex(string) {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            stripHtml(html) {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                return tmp.textContent || tmp.innerText || '';
            }

            htmlToMarkdown(html) {
                let md = html
                    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
                    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
                    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
                    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
                    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
                    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
                    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
                    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
                    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n')
                    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
                    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, '![]($1)')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '');
                return md;
            }

            markdownToHtml(md) {
                let html = md
                    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/`(.+?)`/g, '<code>$1</code>')
                    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
                    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br>');
                return '<p>' + html + '</p>';
            }

            // ==================== VERSION HISTORY ====================

            saveVersion(noteId) {
                const note = this.data.notes.find(n => n.id === noteId);
                if (!note) return;

                // Initialize versions array if not exists
                if (!note.versions) {
                    note.versions = [];
                }

                // Only save if content changed from last version
                const lastVersion = note.versions[note.versions.length - 1];
                if (lastVersion && lastVersion.content === note.content) {
                    return;
                }

                // Add new version
                note.versions.push({
                    id: 'version_' + Date.now(),
                    content: note.content,
                    title: note.title,
                    timestamp: Date.now()
                });

                // Keep only last 50 versions to prevent storage bloat
                if (note.versions.length > 50) {
                    note.versions = note.versions.slice(-50);
                }

                this.saveData();
            }

            openVersionHistory() {
                if (!this.currentNote) {
                    this.showToast('Open a note first', 'error');
                    return;
                }

                const panel = document.getElementById('versionHistoryPanel');
                const list = document.getElementById('versionHistoryList');
                const preview = document.getElementById('versionPreview');

                // Get versions
                const versions = this.currentNote.versions || [];

                if (versions.length === 0) {
                    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No version history yet.<br>Versions are saved automatically when you edit.</div>';
                } else {
                    // Render versions (newest first)
                    list.innerHTML = [...versions].reverse().map((v, index) => {
                        const date = new Date(v.timestamp);
                        const isActive = false;
                        return `
                            <div class="version-item ${isActive ? 'active' : ''}" data-version-id="${v.id}" data-index="${versions.length - 1 - index}">
                                <div class="version-time">${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                <div class="version-author">${v.title || 'Untitled'}</div>
                            </div>
                        `;
                    }).join('');

                    // Add click handlers
                    list.querySelectorAll('.version-item').forEach(item => {
                        item.addEventListener('click', () => {
                            // Remove active from all
                            list.querySelectorAll('.version-item').forEach(i => i.classList.remove('active'));
                            // Add active to clicked
                            item.classList.add('active');
                            // Show preview
                            const index = parseInt(item.dataset.index);
                            this.showVersionPreview(index);
                        });
                    });
                }

                preview.style.display = 'none';
                panel.classList.add('open');
            }

            showVersionPreview(index) {
                if (!this.currentNote || !this.currentNote.versions) return;

                const version = this.currentNote.versions[index];
                if (!version) return;

                const preview = document.getElementById('versionPreview');
                const content = document.getElementById('versionPreviewContent');

                // Render HTML content properly, or strip if plain text
                const previewContent = version.content.substring(0, 1000) + (version.content.length > 1000 ? '...' : '');
                content.innerHTML = previewContent;
                preview.style.display = 'block';

                // Store selected version index
                this.selectedVersionIndex = index;
            }

            restoreVersion() {
                if (!this.currentNote || !this.currentNote.versions || this.selectedVersionIndex === undefined) {
                    this.showToast('Select a version to restore', 'error');
                    return;
                }

                const version = this.currentNote.versions[this.selectedVersionIndex];
                if (!version) return;

                // Save current as version first (so we don't lose it)
                this.saveVersion(this.currentNote.id);

                // Restore the selected version
                this.currentNote.content = version.content;
                this.currentNote.title = version.title;
                this.currentNote.updatedAt = Date.now();

                this.saveData();

                // Reload the note
                this.loadNoteIntoEditor(this.currentNote);

                // Close panel
                document.getElementById('versionHistoryPanel').classList.remove('open');
                this.showToast('Version restored', 'success');
            }

            closeVersionHistory() {
                document.getElementById('versionHistoryPanel').classList.remove('open');
                this.selectedVersionIndex = undefined;
            }

            // ==================== IMPORT WIZARD ====================

            setupAiPanelListeners() {
                // Close panel
                document.getElementById('closeAiPanel')?.addEventListener('click', () => {
                    document.getElementById('aiPanelModal').classList.remove('active');
                });

                document.getElementById('closeAiPanelBtn')?.addEventListener('click', () => {
                    document.getElementById('aiPanelModal').classList.remove('active');
                });

                // Provider selection
                document.querySelectorAll('input[name="aiProvider"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        document.getElementById('webllmSection').style.display = e.target.value === 'webllm' ? 'block' : 'none';
                        document.getElementById('ollamaSection').style.display = e.target.value === 'ollama' ? 'block' : 'none';
                        document.getElementById('cloudSection').style.display = e.target.value === 'cloud' ? 'block' : 'none';
                    });
                });

                // Download WebLLM model
                document.getElementById('downloadWebllmModel')?.addEventListener('click', () => {
                    alert('In demo mode, AI features work with simulated responses. In production, this would download the 1.9GB model to your browser.');
                });

                // Test Ollama connection
                document.getElementById('testOllamaConnection')?.addEventListener('click', async () => {
                    try {
                        const response = await fetch('http://localhost:11434/api/tags');
                        if (response.ok) {
                            document.getElementById('ollamaStatus').textContent = '✅ Connected! Ollama is running.';
                            document.getElementById('ollamaStatus').style.color = 'var(--success)';
                        }
                    } catch (e) {
                        document.getElementById('ollamaStatus').textContent = '❌ Not connected. Please install and start Ollama.';
                        document.getElementById('ollamaStatus').style.color = 'var(--danger)';
                    }
                });

                // Save settings
                document.getElementById('saveAiSettings')?.addEventListener('click', () => {
                    const provider = document.querySelector('input[name="aiProvider"]:checked')?.value || 'webllm';
                    this.data.settings.aiProvider = provider;
                    this.saveData();
                    document.getElementById('aiPanelModal').classList.remove('active');
                    alert('AI settings saved! AI features are ready to use in demo mode.');
                });
            }
        }

        // ==================== INITIALIZE ====================

        const app = new KnowledgeBase();
