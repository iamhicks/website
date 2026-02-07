        // ============================================
        // TaskMaster - Kanban Task Management App
        // ============================================

        // Data Store
        const store = {
            boards: [],
            currentBoard: null,
            archivedCards: [],
            customLabels: [],
            settings: {
                autoSave: true,
                backupReminder: true,
                lastBackup: null
            }
        };

        // Default labels
        const defaultLabels = [
            { id: 'label_1', name: '', color: '#ff6b6b' },
            { id: 'label_2', name: '', color: '#4ecdc4' },
            { id: 'label_3', name: '', color: '#45b7d1' },
            { id: 'label_4', name: '', color: '#96ceb4' },
            { id: 'label_5', name: '', color: '#ffeaa7' },
            { id: 'label_6', name: '', color: '#dfe6e9' }
        ];

        // Templates
        const templates = {
            blank: { columns: [] },
            todo: {
                columns: [
                    { id: 'todo', name: 'To Do', cards: [] },
                    { id: 'done', name: 'Done', cards: [] }
                ]
            },
            kanban: {
                columns: [
                    { id: 'backlog', name: 'Backlog', cards: [] },
                    { id: 'todo', name: 'To Do', cards: [] },
                    { id: 'inprogress', name: 'In Progress', cards: [] },
                    { id: 'done', name: 'Done', cards: [] }
                ]
            },
            project: {
                columns: [
                    { id: 'ideas', name: 'Ideas', cards: [] },
                    { id: 'planning', name: 'Planning', cards: [] },
                    { id: 'inprogress', name: 'In Progress', cards: [] },
                    { id: 'review', name: 'Review', cards: [] },
                    { id: 'completed', name: 'Completed', cards: [] }
                ]
            },
            routine: {
                columns: [
                    { id: 'morning', name: '🌅 Morning', cards: [] },
                    { id: 'afternoon', name: '☀️ Afternoon', cards: [] },
                    { id: 'evening', name: '🌙 Evening', cards: [] }
                ]
            },
            content: {
                columns: [
                    { id: 'ideas', name: 'Ideas', cards: [] },
                    { id: 'drafting', name: 'Drafting', cards: [] },
                    { id: 'editing', name: 'Editing', cards: [] },
                    { id: 'scheduled', name: 'Scheduled', cards: [] },
                    { id: 'published', name: 'Published', cards: [] }
                ]
            },
            sprint: {
                columns: [
                    { id: 'todo', name: 'To Do', cards: [] },
                    { id: 'inprogress', name: 'In Progress', cards: [] },
                    { id: 'testing', name: 'Testing', cards: [] },
                    { id: 'done', name: 'Done', cards: [] }
                ]
            },
            bug: {
                columns: [
                    { id: 'new', name: 'New', cards: [] },
                    { id: 'confirmed', name: 'Confirmed', cards: [] },
                    { id: 'inprogress', name: 'In Progress', cards: [] },
                    { id: 'fixed', name: 'Fixed', cards: [] },
                    { id: 'closed', name: 'Closed', cards: [] }
                ]
            },
            goals: {
                columns: [
                    { id: 'longterm', name: 'Long Term', cards: [] },
                    { id: 'thisyear', name: 'This Year', cards: [] },
                    { id: 'thisquarter', name: 'This Quarter', cards: [] },
                    { id: 'thismonth', name: 'This Month', cards: [] },
                    { id: 'thisweek', name: 'This Week', cards: [] }
                ]
            }
        };

        // Utility Functions
        const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
        
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            if (date.toDateString() === today.toDateString()) return 'Today';
            if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const isOverdue = (dateStr) => {
            if (!dateStr) return false;
            const due = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return due < today;
        };

        const isToday = (dateStr) => {
            if (!dateStr) return false;
            const due = new Date(dateStr);
            const today = new Date();
            return due.toDateString() === today.toDateString();
        };

        // Check if a column is a "Done" type column
        const isDoneColumn = (columnName) => {
            const doneNames = ['done', 'completed', 'closed', 'finished', 'resolved', 'archived'];
            const lowerName = columnName.toLowerCase();
            return doneNames.some(name => lowerName.includes(name));
        };

        // Local Storage
        const saveToStorage = () => {
            localStorage.setItem('taskmaster_data', JSON.stringify({
                boards: store.boards,
                archivedCards: store.archivedCards,
                customLabels: store.customLabels,
                settings: store.settings
            }));
        };

        const loadFromStorage = () => {
            const data = localStorage.getItem('taskmaster_data');
            if (data) {
                const parsed = JSON.parse(data);
                store.boards = parsed.boards || [];
                store.archivedCards = parsed.archivedCards || [];
                store.customLabels = parsed.customLabels || [];
                store.settings = { ...store.settings, ...parsed.settings };
            }
            
            // Initialize default labels if none exist
            if (store.customLabels.length === 0) {
                store.customLabels = [...defaultLabels];
            }
            
            // Create default board if none exists
            if (store.boards.length === 0) {
                createBoard('My First Board', 'kanban');
            }
            
            if (!store.currentBoard && store.boards.length > 0) {
                store.currentBoard = store.boards[0].id;
            }
        };

        // Toast Notifications
        const showToast = (message, type = 'info') => {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        };

        // Custom Labels Functions
        const addCustomLabel = (name, color) => {
            const label = {
                id: generateId(),
                name: name.trim(),
                color: color
            };
            store.customLabels.push(label);
            saveToStorage();
            renderCustomLabelsList();
            return label;
        };

        const updateCustomLabel = (labelId, updates) => {
            const label = store.customLabels.find(l => l.id === labelId);
            if (label) {
                Object.assign(label, updates);
                saveToStorage();
                renderCustomLabelsList();
            }
        };

        const deleteCustomLabel = (labelId) => {
            const index = store.customLabels.findIndex(l => l.id === labelId);
            if (index !== -1) {
                store.customLabels.splice(index, 1);
                saveToStorage();
                renderCustomLabelsList();
            }
        };

        const renderCustomLabelsList = () => {
            const container = document.getElementById('customLabelsList');
            if (!container) return;
            
            if (store.customLabels.length === 0) {
                container.innerHTML = '<p style="color: var(--text-secondary); padding: 12px;">No custom labels yet. Add one below!</p>';
                return;
            }
            
            container.innerHTML = store.customLabels.map(label => `
                <div class="custom-label-item" data-label-id="${label.id}">
                    <input type="color" class="custom-label-color" value="${label.color}" data-label-id="${label.id}">
                    <input type="text" class="custom-label-name" value="${escapeHtml(label.name)}" placeholder="Label name" data-label-id="${label.id}">
                    <button class="custom-label-delete" data-label-id="${label.id}">×</button>
                </div>
            `).join('');
            
            // Add event listeners
            container.querySelectorAll('.custom-label-color').forEach(input => {
                input.addEventListener('change', (e) => {
                    updateCustomLabel(e.target.dataset.labelId, { color: e.target.value });
                });
            });
            
            container.querySelectorAll('.custom-label-name').forEach(input => {
                input.addEventListener('change', (e) => {
                    updateCustomLabel(e.target.dataset.labelId, { name: e.target.value });
                });
            });
            
            container.querySelectorAll('.custom-label-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    deleteCustomLabel(e.target.dataset.labelId);
                });
            });
        };

        const renderLabelSelector = () => {
            const container = document.getElementById('labelSelector');
            if (!container) return;
            
            container.innerHTML = store.customLabels.map(label => `
                <div class="label-option ${currentCardLabels.includes(label.id) ? 'selected' : ''}" 
                     style="background: ${label.color};" 
                     data-label-id="${label.id}"
                     title="${label.name || 'Unnamed label'}">
                    ${label.name ? `<span class="label-name">${escapeHtml(label.name)}</span>` : ''}
                </div>
            `).join('');
            
            // Add click handlers
            container.querySelectorAll('.label-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    opt.classList.toggle('selected');
                    const labelId = opt.dataset.labelId;
                    if (opt.classList.contains('selected')) {
                        if (!currentCardLabels.includes(labelId)) {
                            currentCardLabels.push(labelId);
                        }
                    } else {
                        currentCardLabels = currentCardLabels.filter(id => id !== labelId);
                    }
                });
            });
        };

        // Board Functions
        const createBoard = (name, templateKey = 'blank') => {
            const template = templates[templateKey];
            const board = {
                id: generateId(),
                name,
                columns: template.columns.map(col => ({
                    ...col,
                    id: generateId(),
                    cards: []
                })),
                createdAt: new Date().toISOString()
            };
            store.boards.push(board);
            store.currentBoard = board.id;
            saveToStorage();
            renderBoardSelector();
            renderBoard();
            showToast(`Board "${name}" created`, 'success');
            return board;
        };

        const deleteBoard = (boardId) => {
            const index = store.boards.findIndex(b => b.id === boardId);
            if (index === -1) return;
            
            const board = store.boards[index];
            if (!confirm(`Delete board "${board.name}"? This cannot be undone.`)) return;
            
            store.boards.splice(index, 1);
            if (store.currentBoard === boardId) {
                store.currentBoard = store.boards.length > 0 ? store.boards[0].id : null;
            }
            saveToStorage();
            renderBoardSelector();
            renderBoard();
            showToast('Board deleted', 'info');
        };

        // Column Functions
        const addColumn = (name) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            board.columns.push({
                id: generateId(),
                name,
                cards: []
            });
            saveToStorage();
            renderBoard();
        };

        const deleteColumn = (columnId) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            const index = board.columns.findIndex(c => c.id === columnId);
            if (index === -1) return;
            
            // Archive cards before deleting
            const column = board.columns[index];
            column.cards.forEach(card => {
                store.archivedCards.push({ ...card, archivedAt: new Date().toISOString() });
            });
            
            board.columns.splice(index, 1);
            saveToStorage();
            renderBoard();
            showToast('Column deleted, cards archived', 'info');
        };

        const renameColumn = (columnId, newName) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            const column = board.columns.find(c => c.id === columnId);
            if (column) {
                column.name = newName;
                saveToStorage();
                renderBoard();
            }
        };

        // Card Functions
        const createCard = (columnId, title, options = {}) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            const column = board.columns.find(c => c.id === columnId);
            if (!column) return;
            
            const card = {
                id: generateId(),
                title,
                description: options.description || '',
                dueDate: options.dueDate || '',
                priority: options.priority || 'medium',
                labels: options.labels || [],
                checklist: options.checklist || [],
                attachments: options.attachments || [],
                recurring: options.recurring || '',
                createdAt: new Date().toISOString()
            };
            
            column.cards.push(card);
            saveToStorage();
            renderBoard();
            return card;
        };

        const updateCard = (cardId, updates) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            for (const column of board.columns) {
                const card = column.cards.find(c => c.id === cardId);
                if (card) {
                    Object.assign(card, updates);
                    saveToStorage();
                    renderBoard();
                    return;
                }
            }
        };

        const deleteCard = (cardId) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            for (const column of board.columns) {
                const index = column.cards.findIndex(c => c.id === cardId);
                if (index !== -1) {
                    column.cards.splice(index, 1);
                    saveToStorage();
                    renderBoard();
                    showToast('Card deleted', 'info');
                    return;
                }
            }
        };

        const archiveCard = (cardId) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            for (const column of board.columns) {
                const index = column.cards.findIndex(c => c.id === cardId);
                if (index !== -1) {
                    const card = column.cards[index];
                    store.archivedCards.push({ ...card, archivedAt: new Date().toISOString() });
                    column.cards.splice(index, 1);
                    saveToStorage();
                    renderBoard();
                    showToast('Card archived', 'success');
                    return;
                }
            }
        };

        const restoreCard = (cardId) => {
            const index = store.archivedCards.findIndex(c => c.id === cardId);
            if (index === -1) return;
            
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board || board.columns.length === 0) return;
            
            const card = store.archivedCards[index];
            delete card.archivedAt;
            
            // Add to first column
            board.columns[0].cards.push(card);
            store.archivedCards.splice(index, 1);
            saveToStorage();
            renderArchive();
            renderBoard();
            showToast('Card restored', 'success');
        };

        // Drag and Drop - Fixed Implementation
        let draggedCard = null;
        let draggedColumn = null;
        let draggedCardSource = null;
        let isProcessingDrop = false;  // Flag to prevent duplicate drop events

        const handleCardDragStart = (e, cardId, columnId) => {
            draggedCard = cardId;
            draggedCardSource = columnId;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', cardId);  // Required for Firefox
        };

        const handleCardDragEnd = (e) => {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.column-content').forEach(el => {
                el.classList.remove('drag-over');
            });
            // Reset drag state after a short delay to allow drop to complete
            setTimeout(() => {
                draggedCard = null;
                draggedCardSource = null;
                isProcessingDrop = false;
            }, 50);
        };

        const handleColumnDragStart = (e, columnId) => {
            draggedColumn = columnId;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', columnId);
        };

        const handleColumnDragEnd = (e) => {
            e.target.classList.remove('dragging');
            draggedColumn = null;
        };

        const moveCard = (cardId, targetColumnId, targetIndex = null) => {
            // Prevent duplicate processing
            if (isProcessingDrop) return;
            isProcessingDrop = true;
            
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) {
                isProcessingDrop = false;
                return;
            }
            
            // Validate: source and target must be different, OR different index
            if (draggedCardSource === targetColumnId && targetIndex === null) {
                isProcessingDrop = false;
                return;
            }
            
            let card = null;
            let sourceColumn = null;
            let sourceIndex = -1;
            
            // Find and remove card from source
            for (const column of board.columns) {
                const index = column.cards.findIndex(c => c.id === cardId);
                if (index !== -1) {
                    card = column.cards[index];
                    sourceColumn = column;
                    sourceIndex = index;
                    column.cards.splice(index, 1);
                    break;
                }
            }
            
            if (!card) {
                isProcessingDrop = false;
                return;
            }
            
            // Find target column
            const targetColumn = board.columns.find(c => c.id === targetColumnId);
            if (!targetColumn) {
                // Restore card to source if target not found
                sourceColumn.cards.splice(sourceIndex, 0, card);
                isProcessingDrop = false;
                return;
            }
            
            // Handle recurring tasks - only create next occurrence when moved to a "Done" column
            if (card.recurring && sourceColumn && isDoneColumn(targetColumn.name)) {
                const today = new Date();
                let nextDate = new Date(card.dueDate || today);
                
                if (card.recurring === 'daily') {
                    nextDate.setDate(nextDate.getDate() + 1);
                } else if (card.recurring === 'weekly') {
                    nextDate.setDate(nextDate.getDate() + 7);
                } else if (card.recurring === 'monthly') {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                }
                
                // Create next occurrence in the SOURCE column (not done yet)
                const newCard = {
                    ...card,
                    id: generateId(),
                    dueDate: nextDate.toISOString().split('T')[0],
                    checklist: card.checklist.map(item => ({ ...item, checked: false })),
                    createdAt: new Date().toISOString()
                };
                sourceColumn.cards.push(newCard);
                showToast(`Created next ${card.recurring} occurrence`, 'success');
            }
            
            // Add to target column at specified index
            if (targetIndex !== null && targetIndex >= 0 && targetIndex <= targetColumn.cards.length) {
                targetColumn.cards.splice(targetIndex, 0, card);
            } else {
                targetColumn.cards.push(card);
            }
            
            saveToStorage();
            renderBoard();
            
            // Reset processing flag after render
            setTimeout(() => {
                isProcessingDrop = false;
            }, 100);
        };

        const moveColumn = (columnId, targetIndex) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            const index = board.columns.findIndex(c => c.id === columnId);
            if (index === -1) return;
            
            const [column] = board.columns.splice(index, 1);
            board.columns.splice(targetIndex, 0, column);
            
            saveToStorage();
            renderBoard();
        };

        // Rendering
        const renderBoardSelector = () => {
            const select = document.getElementById('boardSelect');
            select.innerHTML = '<option value="">Select a board...</option>';
            
            store.boards.forEach(board => {
                const option = document.createElement('option');
                option.value = board.id;
                option.textContent = board.name;
                if (board.id === store.currentBoard) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            updateBoardButtons();
        };
        
        const updateBoardButtons = () => {
            const hasBoard = !!store.currentBoard;
            const editBtn = document.getElementById('editBoardBtn');
            const deleteBtn = document.getElementById('deleteBoardBtn');
            if (editBtn) editBtn.disabled = !hasBoard;
            if (deleteBtn) deleteBtn.disabled = !hasBoard;
        };

        const getCardHTML = (card) => {
            const overdue = isOverdue(card.dueDate);
            const today = isToday(card.dueDate);
            const completedChecklist = card.checklist?.filter(i => i.checked).length || 0;
            const totalChecklist = card.checklist?.length || 0;
            
            // Get label HTML with names
            const labelsHtml = card.labels?.map(labelId => {
                const label = store.customLabels.find(l => l.id === labelId);
                if (!label) return '';
                if (label.name) {
                    return `<span class="card-label-with-name" style="background: ${label.color};">${escapeHtml(label.name)}</span>`;
                } else {
                    return `<div class="card-label" style="background: ${label.color};"></div>`;
                }
            }).join('') || '';
            
            return `
                <div class="card" draggable="true" data-card-id="${card.id}" data-column-id="${card.columnId}">
                    ${card.labels?.length ? `
                        <div class="card-header">
                            ${labelsHtml}
                        </div>
                    ` : ''}
                    <div class="card-title">${escapeHtml(card.title)}</div>
                    <div class="card-meta">
                        ${card.priority ? `<span class="card-badge priority-${card.priority}">⚡ ${card.priority}</span>` : ''}
                        ${card.dueDate ? `<span class="card-badge ${overdue ? 'overdue' : ''}">📅 ${formatDate(card.dueDate)}${overdue ? ' (overdue)' : ''}</span>` : ''}
                        ${card.recurring ? `<span class="recurring-badge">🔄 ${card.recurring}</span>` : ''}
                        ${totalChecklist ? `<span class="card-badge">✓ ${completedChecklist}/${totalChecklist}</span>` : ''}
                        ${card.attachments?.length ? `<span class="card-badge">📎 ${card.attachments.length}</span>` : ''}
                    </div>
                </div>
            `;
        };

        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        const renderBoard = () => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            const boardEl = document.getElementById('board');
            const filterText = document.getElementById('searchInput').value.toLowerCase();
            const activeFilters = Array.from(document.querySelectorAll('.chip.active')).map(c => c.dataset.filter);
            
            if (!board) {
                boardEl.innerHTML = '<div style="color: var(--text-secondary); padding: 40px;">Select or create a board to get started</div>';
                return;
            }
            
            const addColumnBtn = document.getElementById('addColumnBtn');
            boardEl.innerHTML = '';
            
            board.columns.forEach((column, index) => {
                // Filter cards
                let cards = column.cards.filter(card => {
                    if (filterText && !card.title.toLowerCase().includes(filterText)) return false;
                    
                    for (const filter of activeFilters) {
                        if (filter === 'priority-high' && card.priority !== 'high') return false;
                        if (filter === 'priority-medium' && card.priority !== 'medium') return false;
                        if (filter === 'priority-low' && card.priority !== 'low') return false;
                        if (filter === 'overdue' && !isOverdue(card.dueDate)) return false;
                        if (filter === 'today' && !isToday(card.dueDate)) return false;
                    }
                    
                    return true;
                });
                
                const columnEl = document.createElement('div');
                columnEl.className = 'column';
                columnEl.draggable = true;
                columnEl.dataset.columnId = column.id;
                
                columnEl.innerHTML = `
                    <div class="column-header" draggable="true">
                        <div class="column-title">
                            ${escapeHtml(column.name)}
                            <span class="column-count">${cards.length}</span>
                        </div>
                        <div class="column-actions">
                            <button class="column-btn" data-action="rename" title="Rename">✏️</button>
                            <button class="column-btn" data-action="delete" title="Delete">🗑️</button>
                        </div>
                    </div>
                    <div class="column-content" data-column-id="${column.id}">
                        ${cards.map(card => getCardHTML({ ...card, columnId: column.id })).join('')}
                    </div>
                    <button class="add-card-btn" data-column-id="${column.id}">
                        <span>+</span> Add a card
                    </button>
                `;
                
                // Column drag events
                const columnHeader = columnEl.querySelector('.column-header');
                columnHeader.addEventListener('dragstart', (e) => {
                    handleColumnDragStart(e, column.id);
                });
                
                columnHeader.addEventListener('dragend', handleColumnDragEnd);
                
                // Column drop zone
                columnEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedColumn && draggedColumn !== column.id) {
                        e.dataTransfer.dropEffect = 'move';
                    }
                });
                
                columnEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();  // Prevent event bubbling
                    if (draggedColumn && draggedColumn !== column.id) {
                        moveColumn(draggedColumn, index);
                    }
                });
                
                // Card drag events
                const contentEl = columnEl.querySelector('.column-content');
                
                // Use a single dragover handler with throttling
                let dragOverTimeout = null;
                contentEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedCard) {
                        e.dataTransfer.dropEffect = 'move';
                        if (!dragOverTimeout) {
                            contentEl.classList.add('drag-over');
                        }
                    }
                });
                
                contentEl.addEventListener('dragleave', (e) => {
                    // Only remove if we're actually leaving the element (not entering a child)
                    if (!contentEl.contains(e.relatedTarget)) {
                        contentEl.classList.remove('drag-over');
                        if (dragOverTimeout) {
                            clearTimeout(dragOverTimeout);
                            dragOverTimeout = null;
                        }
                    }
                });
                
                contentEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();  // Critical: prevent event bubbling
                    contentEl.classList.remove('drag-over');
                    
                    if (draggedCard && !isProcessingDrop) {
                        // Calculate drop position based on mouse Y
                        const afterElement = getDragAfterElement(contentEl, e.clientY);
                        let targetIndex = null;
                        if (afterElement) {
                            targetIndex = Array.from(contentEl.children).indexOf(afterElement);
                        } else {
                            targetIndex = contentEl.children.length;
                        }
                        
                        moveCard(draggedCard, column.id, targetIndex);
                    }
                });
                
                // Card events - use event delegation for better performance
                contentEl.addEventListener('dragstart', (e) => {
                    const cardEl = e.target.closest('.card');
                    if (cardEl) {
                        handleCardDragStart(e, cardEl.dataset.cardId, column.id);
                    }
                });
                
                contentEl.addEventListener('dragend', (e) => {
                    const cardEl = e.target.closest('.card');
                    if (cardEl) {
                        handleCardDragEnd(e);
                    }
                });
                
                contentEl.addEventListener('click', (e) => {
                    const cardEl = e.target.closest('.card');
                    if (cardEl) {
                        openCardModal(cardEl.dataset.cardId);
                    }
                });
                
                // Column actions
                columnEl.querySelector('[data-action="rename"]').addEventListener('click', () => {
                    const newName = prompt('Column name:', column.name);
                    if (newName) renameColumn(column.id, newName);
                });
                
                columnEl.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    deleteColumn(column.id);
                });
                
                // Add card button
                columnEl.querySelector('.add-card-btn').addEventListener('click', () => {
                    openQuickAdd(column.id);
                });
                
                boardEl.appendChild(columnEl);
            });
            
            boardEl.appendChild(addColumnBtn);
        };

        // Helper function to determine drop position
        const getDragAfterElement = (container, y) => {
            const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        };

        // Calendar Rendering
        let currentCalendarDate = new Date();

        const renderCalendar = () => {
            const grid = document.getElementById('calendarGrid');
            const monthEl = document.getElementById('calendarMonth');
            
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            
            monthEl.textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startingDay = firstDay.getDay();
            
            // Get all cards with due dates
            const board = store.boards.find(b => b.id === store.currentBoard);
            const allCards = [];
            if (board) {
                board.columns.forEach(col => {
                    col.cards.forEach(card => {
                        if (card.dueDate) {
                            allCards.push({ ...card, columnName: col.name });
                        }
                    });
                });
            }
            
            let html = `
                <div class="calendar-day-header">Sun</div>
                <div class="calendar-day-header">Mon</div>
                <div class="calendar-day-header">Tue</div>
                <div class="calendar-day-header">Wed</div>
                <div class="calendar-day-header">Thu</div>
                <div class="calendar-day-header">Fri</div>
                <div class="calendar-day-header">Sat</div>
            `;
            
            // Previous month days
            const prevMonthLastDay = new Date(year, month, 0).getDate();
            for (let i = startingDay - 1; i >= 0; i--) {
                html += `<div class="calendar-day other-month"><div class="calendar-day-number">${prevMonthLastDay - i}</div></div>`;
            }
            
            // Current month days
            const today = new Date();
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                
                const dayCards = allCards.filter(card => card.dueDate === dateStr);
                
                html += `
                    <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                        <div class="calendar-day-number">${day}</div>
                        <div class="calendar-tasks">
                            ${dayCards.map(card => `
                                <div class="calendar-task priority-${card.priority}" data-card-id="${card.id}">
                                    ${escapeHtml(card.title)}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            // Next month days
            const remainingCells = (7 - ((startingDay + daysInMonth) % 7)) % 7;
            for (let day = 1; day <= remainingCells; day++) {
                html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
            }
            
            grid.innerHTML = html;
            
            // Add click handlers for tasks
            grid.querySelectorAll('.calendar-task').forEach(task => {
                task.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openCardModal(task.dataset.cardId);
                });
            });
        };

        // Modal Functions
        let currentEditingCard = null;
        let currentCardLabels = [];
        let currentCardAttachments = [];
        let currentCardChecklist = [];

        const openCardModal = (cardId) => {
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            let card = null;
            for (const column of board.columns) {
                card = column.cards.find(c => c.id === cardId);
                if (card) break;
            }
            
            if (!card) return;
            
            currentEditingCard = card;
            currentCardLabels = [...(card.labels || [])];
            currentCardAttachments = [...(card.attachments || [])];
            currentCardChecklist = [...(card.checklist || [])];
            
            document.getElementById('cardTitle').value = card.title;
            document.getElementById('cardDescription').value = card.description || '';
            document.getElementById('cardDueDate').value = card.dueDate || '';
            document.getElementById('cardRecurring').value = card.recurring || '';
            
            // Priority
            document.querySelectorAll('.priority-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.priority === card.priority);
            });
            
            // Labels - render dynamic label selector
            renderLabelSelector();
            
            renderChecklist();
            renderAttachments();
            
            document.getElementById('cardModal').classList.add('active');
        };

        const closeCardModal = () => {
            document.getElementById('cardModal').classList.remove('active');
            currentEditingCard = null;
            currentCardLabels = [];
            currentCardAttachments = [];
            currentCardChecklist = [];
        };

        // Drag and Drop for Checklist Items
        let draggedChecklistItem = null;
        let draggedChecklistIndex = null;

        const handleChecklistDragStart = (e, index) => {
            draggedChecklistItem = e.target;
            draggedChecklistIndex = index;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
        };

        const handleChecklistDragEnd = (e) => {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.checklist-item').forEach(item => {
                item.classList.remove('drag-over', 'drag-over-bottom');
            });
            draggedChecklistItem = null;
            draggedChecklistIndex = null;
        };

        const handleChecklistDragOver = (e, index) => {
            e.preventDefault();
            if (draggedChecklistIndex === null || draggedChecklistIndex === index) return;
            
            e.dataTransfer.dropEffect = 'move';
            
            // Visual feedback based on mouse position
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            document.querySelectorAll('.checklist-item').forEach(item => {
                item.classList.remove('drag-over', 'drag-over-bottom');
            });
            
            if (e.clientY < midpoint) {
                e.currentTarget.classList.add('drag-over');
            } else {
                e.currentTarget.classList.add('drag-over-bottom');
            }
        };

        const handleChecklistDragLeave = (e) => {
            e.currentTarget.classList.remove('drag-over', 'drag-over-bottom');
        };

        const handleChecklistDrop = (e, targetIndex) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (draggedChecklistIndex === null || draggedChecklistIndex === targetIndex) {
                document.querySelectorAll('.checklist-item').forEach(item => {
                    item.classList.remove('drag-over', 'drag-over-bottom');
                });
                return;
            }
            
            // Determine drop position (before or after target)
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const dropBefore = e.clientY < midpoint;
            
            // Reorder the array
            const [movedItem] = currentCardChecklist.splice(draggedChecklistIndex, 1);
            
            // Calculate new index
            let newIndex = targetIndex;
            if (!dropBefore && draggedChecklistIndex < targetIndex) {
                newIndex = targetIndex;
            } else if (!dropBefore && draggedChecklistIndex > targetIndex) {
                newIndex = targetIndex + 1;
            } else if (dropBefore && draggedChecklistIndex < targetIndex) {
                newIndex = targetIndex - 1;
            } else if (dropBefore && draggedChecklistIndex > targetIndex) {
                newIndex = targetIndex;
            }
            
            currentCardChecklist.splice(newIndex, 0, movedItem);
            
            // Clear visual feedback
            document.querySelectorAll('.checklist-item').forEach(item => {
                item.classList.remove('drag-over', 'drag-over-bottom');
            });
            
            renderChecklist();
            showToast('Checklist reordered', 'success');
        };

        const renderChecklist = () => {
            const container = document.getElementById('checklist');
            container.innerHTML = currentCardChecklist.map((item, index) => `
                <div class="checklist-item ${item.checked ? 'checked' : ''}" 
                     draggable="true" 
                     data-index="${index}">
                    <span class="checklist-drag-handle">☰</span>
                    <input type="checkbox" ${item.checked ? 'checked' : ''} data-index="${index}">
                    <span>${escapeHtml(item.text)}</span>
                    <button class="delete-item" data-index="${index}">×</button>
                </div>
            `).join('');
            
            // Add drag and drop event listeners
            container.querySelectorAll('.checklist-item').forEach((item, index) => {
                item.addEventListener('dragstart', (e) => handleChecklistDragStart(e, index));
                item.addEventListener('dragend', handleChecklistDragEnd);
                item.addEventListener('dragover', (e) => handleChecklistDragOver(e, index));
                item.addEventListener('dragleave', handleChecklistDragLeave);
                item.addEventListener('drop', (e) => handleChecklistDrop(e, index));
            });
            
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    const index = parseInt(cb.dataset.index);
                    currentCardChecklist[index].checked = cb.checked;
                    renderChecklist();
                });
            });
            
            container.querySelectorAll('.delete-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.index);
                    currentCardChecklist.splice(index, 1);
                    renderChecklist();
                });
            });
        };

        const renderAttachments = () => {
            const container = document.getElementById('attachmentList');
            container.innerHTML = currentCardAttachments.map((att, index) => `
                <div class="attachment-item">
                    <span class="attachment-icon">📎</span>
                    <span class="attachment-name">${escapeHtml(att.name)}</span>
                    <button class="attachment-delete" data-index="${index}">×</button>
                </div>
            `).join('');
            
            container.querySelectorAll('.attachment-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.index);
                    currentCardAttachments.splice(index, 1);
                    renderAttachments();
                });
            });
        };

        const saveCurrentCard = () => {
            if (!currentEditingCard) return;
            
            const priorityEl = document.querySelector('.priority-option.selected');
            
            updateCard(currentEditingCard.id, {
                title: document.getElementById('cardTitle').value,
                description: document.getElementById('cardDescription').value,
                dueDate: document.getElementById('cardDueDate').value,
                priority: priorityEl?.dataset.priority || 'medium',
                labels: currentCardLabels,
                checklist: currentCardChecklist,
                attachments: currentCardAttachments,
                recurring: document.getElementById('cardRecurring').value
            });
            
            closeCardModal();
            showToast('Card saved', 'success');
        };

        // Quick Add
        let quickAddColumnId = null;

        const openQuickAdd = (columnId = null) => {
            quickAddColumnId = columnId;
            document.getElementById('quickAddOverlay').classList.add('active');
            document.getElementById('quickAddInput').value = '';
            document.getElementById('quickAddInput').focus();
        };

        const closeQuickAdd = () => {
            document.getElementById('quickAddOverlay').classList.remove('active');
            quickAddColumnId = null;
        };

        const submitQuickAdd = () => {
            const input = document.getElementById('quickAddInput');
            const title = input.value.trim();
            
            if (!title) {
                closeQuickAdd();
                return;
            }
            
            const board = store.boards.find(b => b.id === store.currentBoard);
            if (!board) return;
            
            let targetColumn = quickAddColumnId;
            
            // Parse @column syntax
            const columnMatch = title.match(/@([^\s]+)/);
            if (columnMatch) {
                const colName = columnMatch[1].toLowerCase();
                const column = board.columns.find(c => c.name.toLowerCase().includes(colName));
                if (column) {
                    targetColumn = column.id;
                }
            }
            
            // Default to first column
            if (!targetColumn && board.columns.length > 0) {
                targetColumn = board.columns[0].id;
            }
            
            if (targetColumn) {
                const cleanTitle = title.replace(/@[^\s]+/, '').trim();
                createCard(targetColumn, cleanTitle);
                showToast('Card added', 'success');
            }
            
            closeQuickAdd();
        };

        // Archive View
        const renderArchive = () => {
            const list = document.getElementById('archiveList');
            
            if (store.archivedCards.length === 0) {
                list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No archived cards</p>';
                return;
            }
            
            list.innerHTML = store.archivedCards.map(card => `
                <div class="archive-item">
                    <div class="archive-item-info">
                        <div class="archive-item-title">${escapeHtml(card.title)}</div>
                        <div class="archive-item-meta">
                            Archived: ${new Date(card.archivedAt).toLocaleDateString()}
                            ${card.dueDate ? `• Due: ${formatDate(card.dueDate)}` : ''}
                        </div>
                    </div>
                    <button class="btn" data-restore="${card.id}">Restore</button>
                </div>
            `).join('');
            
            list.querySelectorAll('[data-restore]').forEach(btn => {
                btn.addEventListener('click', () => {
                    restoreCard(btn.dataset.restore);
                });
            });
        };

        // Export/Import
        const exportData = () => {
            const data = JSON.stringify({
                boards: store.boards,
                archivedCards: store.archivedCards,
                customLabels: store.customLabels,
                exportedAt: new Date().toISOString()
            }, null, 2);
            
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `taskmaster-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            store.settings.lastBackup = new Date().toISOString();
            saveToStorage();
            showToast('Data exported', 'success');
        };

        const importData = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (confirm('This will replace all current data. Continue?')) {
                        store.boards = data.boards || [];
                        store.archivedCards = data.archivedCards || [];
                        store.customLabels = data.customLabels || [...defaultLabels];
                        store.currentBoard = store.boards.length > 0 ? store.boards[0].id : null;
                        saveToStorage();
                        renderBoardSelector();
                        renderBoard();
                        showToast('Data imported', 'success');
                    }
                } catch (err) {
                    showToast('Invalid file format', 'error');
                }
            };
            reader.readAsText(file);
        };

        // Event Listeners
        document.addEventListener('DOMContentLoaded', () => {
            loadFromStorage();
            renderBoardSelector();
            renderBoard();
            renderCalendar();
            
            // Board selector
            document.getElementById('boardSelect').addEventListener('change', (e) => {
                store.currentBoard = e.target.value;
                renderBoard();
                renderCalendar();
                updateBoardButtons();
            });
            
            // Edit board name
            document.getElementById('editBoardBtn').addEventListener('click', () => {
                if (!store.currentBoard) {
                    showToast('Please select a board first', 'error');
                    return;
                }
                const board = store.boards.find(b => b.id === store.currentBoard);
                if (board) {
                    const newName = prompt('Edit board name:', board.name);
                    if (newName && newName.trim()) {
                        board.name = newName.trim();
                        saveToStorage();
                        renderBoardSelector();
                        showToast('Board renamed', 'success');
                    }
                }
            });
            
            // Delete board
            document.getElementById('deleteBoardBtn').addEventListener('click', () => {
                if (!store.currentBoard) {
                    showToast('Please select a board first', 'error');
                    return;
                }
                const board = store.boards.find(b => b.id === store.currentBoard);
                if (board) {
                    const confirmed = confirm(`Delete board "${board.name}"? This cannot be undone.`);
                    if (confirmed) {
                        deleteBoard(store.currentBoard);
                        store.currentBoard = store.boards.length > 0 ? store.boards[0].id : '';
                        renderBoardSelector();
                        renderBoard();
                        renderCalendar();
                        updateBoardButtons();
                        showToast('Board deleted', 'success');
                    }
                }
            });
            
            // View toggle
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    const view = btn.dataset.view;
                    document.getElementById('boardView').classList.toggle('active', view === 'board');
                    document.getElementById('calendarView').classList.toggle('active', view === 'calendar');
                    
                    if (view === 'board') {
                        document.getElementById('boardView').style.display = 'block';
                        document.getElementById('calendarView').classList.remove('active');
                        document.getElementById('toolbar').style.display = 'flex';
                    } else {
                        document.getElementById('boardView').style.display = 'none';
                        document.getElementById('calendarView').classList.add('active');
                        document.getElementById('toolbar').style.display = 'none';
                        renderCalendar();
                    }
                });
            });
            
            // Search
            document.getElementById('searchInput').addEventListener('input', renderBoard);
            
            // Filter chips
            document.querySelectorAll('.chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    chip.classList.toggle('active');
                    renderBoard();
                });
            });
            
            // Add column
            document.getElementById('addColumnBtn').addEventListener('click', () => {
                const name = prompt('Column name:');
                if (name) addColumn(name);
            });
            
            // New board
            document.getElementById('newBoardBtn').addEventListener('click', () => {
                document.getElementById('boardModal').classList.add('active');
                document.getElementById('boardName').value = '';
                document.getElementById('boardName').focus();
            });
            
            document.getElementById('closeBoardModal').addEventListener('click', () => {
                document.getElementById('boardModal').classList.remove('active');
            });
            
            document.getElementById('createBoardBtn').addEventListener('click', () => {
                const name = document.getElementById('boardName').value.trim();
                if (!name) {
                    showToast('Please enter a board name', 'error');
                    return;
                }
                
                const selectedTemplate = document.querySelector('#templateGrid .template-card.selected')?.dataset.template || 'blank';
                createBoard(name, selectedTemplate);
                document.getElementById('boardModal').classList.remove('active');
            });
            
            // Template selection
            document.querySelectorAll('#templateGrid .template-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('#templateGrid .template-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                });
            });
            
            // Labels Management Modal
            document.getElementById('labelsBtn').addEventListener('click', () => {
                renderCustomLabelsList();
                document.getElementById('labelsModal').classList.add('active');
            });
            
            document.getElementById('closeLabelsModal').addEventListener('click', () => {
                document.getElementById('labelsModal').classList.remove('active');
            });
            
            document.getElementById('addNewLabelBtn').addEventListener('click', () => {
                const name = document.getElementById('newLabelName').value.trim();
                const color = document.getElementById('newLabelColor').value;
                
                if (!name) {
                    showToast('Please enter a label name', 'error');
                    return;
                }
                
                addCustomLabel(name, color);
                document.getElementById('newLabelName').value = '';
                showToast('Label added', 'success');
            });
            
            document.getElementById('newLabelName').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('addNewLabelBtn').click();
                }
            });
            
            // Templates modal
            document.getElementById('templateBtn').addEventListener('click', () => {
                document.getElementById('templatesModal').classList.add('active');
            });
            
            document.getElementById('closeTemplatesModal').addEventListener('click', () => {
                document.getElementById('templatesModal').classList.remove('active');
            });
            
            document.querySelectorAll('#applyTemplateGrid .template-card').forEach(card => {
                card.addEventListener('click', () => {
                    const templateKey = card.dataset.template;
                    const template = templates[templateKey];
                    const board = store.boards.find(b => b.id === store.currentBoard);
                    
                    if (board && template) {
                        template.columns.forEach(col => {
                            board.columns.push({
                                id: generateId(),
                                name: col.name,
                                cards: []
                            });
                        });
                        saveToStorage();
                        renderBoard();
                        showToast('Template applied', 'success');
                    }
                    
                    document.getElementById('templatesModal').classList.remove('active');
                });
            });
            
            // Archive
            document.getElementById('archiveBtn').addEventListener('click', () => {
                renderArchive();
                document.getElementById('archiveModal').classList.add('active');
            });
            
            document.getElementById('closeArchiveModal').addEventListener('click', () => {
                document.getElementById('archiveModal').classList.remove('active');
            });
            
            // Settings
            document.getElementById('settingsBtn').addEventListener('click', () => {
                document.getElementById('settingsModal').classList.add('active');
            });
            
            document.getElementById('closeSettingsModal').addEventListener('click', () => {
                document.getElementById('settingsModal').classList.remove('active');
            });
            
            document.getElementById('exportBtn').addEventListener('click', exportData);
            
            document.getElementById('importBtn').addEventListener('click', () => {
                document.getElementById('importFile').click();
            });
            
            document.getElementById('importFile').addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    importData(e.target.files[0]);
                    e.target.value = '';
                }
            });
            
            document.getElementById('backupBtn').addEventListener('click', () => {
                exportData();
            });
            
            document.getElementById('clearAllBtn').addEventListener('click', () => {
                if (confirm('⚠️ This will DELETE ALL DATA. Are you sure?')) {
                    if (confirm('Really? This cannot be undone!')) {
                        localStorage.removeItem('taskmaster_data');
                        location.reload();
                    }
                }
            });
            
            // Help
            document.getElementById('helpBtn').addEventListener('click', () => {
                document.getElementById('helpModal').classList.add('active');
            });
            
            document.getElementById('closeHelpModal').addEventListener('click', () => {
                document.getElementById('helpModal').classList.remove('active');
            });
            
            // Card modal
            document.getElementById('closeCardModal').addEventListener('click', closeCardModal);
            
            document.getElementById('saveCardBtn').addEventListener('click', saveCurrentCard);
            
            document.getElementById('archiveCardBtn').addEventListener('click', () => {
                if (currentEditingCard) {
                    archiveCard(currentEditingCard.id);
                    closeCardModal();
                }
            });
            
            document.getElementById('deleteCardBtn').addEventListener('click', () => {
                if (currentEditingCard && confirm('Delete this card?')) {
                    deleteCard(currentEditingCard.id);
                    closeCardModal();
                }
            });
            
            // Priority selector
            document.querySelectorAll('.priority-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.priority-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                });
            });
            
            // Checklist
            document.getElementById('addChecklistItemBtn').addEventListener('click', () => {
                const input = document.getElementById('newChecklistItem');
                const text = input.value.trim();
                if (text) {
                    currentCardChecklist.push({ text, checked: false });
                    input.value = '';
                    renderChecklist();
                }
            });
            
            document.getElementById('newChecklistItem').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('addChecklistItemBtn').click();
                }
            });
            
            // Attachments
            document.getElementById('addAttachmentBtn').addEventListener('click', () => {
                document.getElementById('fileInput').click();
            });
            
            document.getElementById('fileInput').addEventListener('change', (e) => {
                Array.from(e.target.files).forEach(file => {
                    currentCardAttachments.push({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        path: file.path || file.name
                    });
                });
                renderAttachments();
                e.target.value = '';
            });
            
            // Quick add
            document.getElementById('quickAddOverlay').addEventListener('click', (e) => {
                if (e.target === document.getElementById('quickAddOverlay')) {
                    closeQuickAdd();
                }
            });
            
            document.getElementById('quickAddInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    submitQuickAdd();
                } else if (e.key === 'Escape') {
                    closeQuickAdd();
                }
            });
            
            // Calendar navigation
            document.getElementById('prevMonth').addEventListener('click', () => {
                currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
                renderCalendar();
            });
            
            document.getElementById('nextMonth').addEventListener('click', () => {
                currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
                renderCalendar();
            });
            
            document.getElementById('todayBtn').addEventListener('click', () => {
                currentCalendarDate = new Date();
                renderCalendar();
            });
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                // Don't trigger shortcuts when typing in inputs
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    if (e.key === 'Escape') {
                        e.target.blur();
                    }
                    return;
                }
                
                // Escape to close modals
                if (e.key === 'Escape') {
                    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                        modal.classList.remove('active');
                    });
                    closeQuickAdd();
                }
                
                // N for quick add
                if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    openQuickAdd();
                }
                
                // B for new board
                if (e.key === 'b' || e.key === 'B') {
                    e.preventDefault();
                    document.getElementById('newBoardBtn').click();
                }
                
                // C for calendar
                if (e.key === 'c' || e.key === 'C') {
                    e.preventDefault();
                    const calendarBtn = document.querySelector('[data-view="calendar"]');
                    calendarBtn.click();
                }
                
                // Ctrl+K for search
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }
                
                // ? for help
                if (e.key === '?') {
                    e.preventDefault();
                    document.getElementById('helpModal').classList.add('active');
                }
            });
            
            // Backup reminder
            if (store.settings.backupReminder && store.settings.lastBackup) {
                const lastBackup = new Date(store.settings.lastBackup);
                const daysSinceBackup = (new Date() - lastBackup) / (1000 * 60 * 60 * 24);
                
                if (daysSinceBackup > 7) {
                    setTimeout(() => {
                        showToast(`It's been ${Math.floor(daysSinceBackup)} days since your last backup`, 'info');
                    }, 2000);
                }
            }
        });
        
        // Demo Auto-Reset
        (function() {
            const RESET_INTERVAL = 60 * 60 * 1000; // 1 hour
            const LAST_RESET_KEY = 'flow_demo_last_reset';
            
            const now = Date.now();
            const lastReset = parseInt(localStorage.getItem(LAST_RESET_KEY) || '0');
            
            if (!lastReset || (now - lastReset > RESET_INTERVAL)) {
                // Clear all TaskMaster data
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('taskmaster') || key.startsWith('tm_') || key.startsWith('flow_'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                localStorage.setItem(LAST_RESET_KEY, now.toString());
                console.log('FLOW demo: Auto-reset performed');
            }
            
            // Update timer
            function updateTimer() {
                const timerEl = document.getElementById('demoResetTimer');
                if (!timerEl) return;
                const currentReset = parseInt(localStorage.getItem(LAST_RESET_KEY) || Date.now().toString());
                const nextReset = currentReset + RESET_INTERVAL;
                const remaining = nextReset - Date.now();
                if (remaining <= 0) { location.reload(); return; }
                const mins = Math.floor(remaining / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                timerEl.textContent = `Resets in ${mins}m ${secs.toString().padStart(2, '0')}s`;
            }
            updateTimer();
            setInterval(updateTimer, 1000);
        })();
