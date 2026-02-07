// Mistakes Module - Handles common mistakes management

const Mistakes = {
    mistakes: [],
    selectedMistakes: [],

    init() {
        this.loadMistakes();
        this.bindEvents();
        this.renderMistakeTags();
    },

    bindEvents() {
        // Manage mistakes button
        document.getElementById('manage-mistakes-btn')?.addEventListener('click', () => {
            this.openModal();
        });

        // Close mistakes modal
        document.getElementById('close-mistakes-modal')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancel-mistakes')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Save mistakes changes
        document.getElementById('save-mistakes')?.addEventListener('click', () => {
            this.saveMistakes();
        });

        // Add new mistake item
        document.getElementById('add-mistake-item')?.addEventListener('click', () => {
            this.addNewMistakeItem();
        });

        // Mistake tag selection (delegated)
        document.getElementById('mistake-tags')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('mistake-tag')) {
                e.target.classList.toggle('selected');
            }
        });

        // Enter key to add mistake
        document.getElementById('new-mistake-label')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addNewMistakeItem();
            }
        });

        // Delete mistake item (delegated in modal)
        document.getElementById('mistakes-list')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-mistake')) {
                e.target.closest('.mistake-list-item').remove();
                // Re-bind drag events after removal
                this.bindMistakesDragEvents();
            }
        });
    },

    loadMistakes() {
        this.mistakes = Storage.getMistakes();
    },

    getMistakes() {
        return this.mistakes;
    },

    openModal() {
        const modal = document.getElementById('mistakes-modal');
        this.loadMistakes();
        this.renderMistakesList();
        modal.classList.add('active');
    },

    closeModal() {
        document.getElementById('mistakes-modal').classList.remove('active');
    },

    renderMistakesList() {
        const container = document.getElementById('mistakes-list');
        if (!container) return;

        if (this.mistakes.length === 0) {
            container.innerHTML = '<p class="empty-state">No mistakes defined yet</p>';
            return;
        }

        container.innerHTML = this.mistakes.map((mistake, index) => `
            <div class="mistake-list-item" data-id="${mistake.id}" draggable="true" data-index="${index}">
                <span class="drag-handle">☰</span>
                <input type="color" class="mistake-color" value="${mistake.color || '#ef4444'}">
                <input type="text" class="form-input mistake-label" value="${this.escapeHtml(mistake.label)}" placeholder="Mistake description">
                <button type="button" class="btn btn-small btn-danger remove-mistake">×</button>
            </div>
        `).join('');

        // Bind drag and drop events
        this.bindMistakesDragEvents();
    },

    bindMistakesDragEvents() {
        const container = document.getElementById('mistakes-list');
        if (!container) return;

        let draggedItem = null;

        container.querySelectorAll('.mistake-list-item').forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                container.querySelectorAll('.mistake-list-item').forEach(i => {
                    i.classList.remove('drag-over', 'drag-over-bottom');
                });
                draggedItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (item === draggedItem) return;

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                if (e.clientY < midpoint) {
                    item.classList.add('drag-over');
                    item.classList.remove('drag-over-bottom');
                } else {
                    item.classList.add('drag-over-bottom');
                    item.classList.remove('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over', 'drag-over-bottom');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (item === draggedItem) return;

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const dropAfter = e.clientY >= midpoint;

                if (draggedItem) {
                    if (dropAfter) {
                        item.after(draggedItem);
                    } else {
                        item.before(draggedItem);
                    }
                }

                // Re-index all items
                container.querySelectorAll('.mistake-list-item').forEach((i, idx) => {
                    i.dataset.index = idx;
                });
            });
        });
    },

    renderMistakeTags() {
        const container = document.getElementById('mistake-tags');
        if (!container) return;

        this.loadMistakes();

        if (this.mistakes.length === 0) {
            container.innerHTML = '<p class="text-muted">No mistakes defined. Go to Templates → Manage Mistakes to add some.</p>';
            return;
        }

        container.innerHTML = this.mistakes.map(mistake => `
            <span class="mistake-tag" data-id="${mistake.id}" style="--mistake-color: ${mistake.color || '#ef4444'}">
                ${this.escapeHtml(mistake.label)}
            </span>
        `).join('');
    },

    addNewMistakeItem() {
        const labelInput = document.getElementById('new-mistake-label');
        const colorInput = document.getElementById('new-mistake-color');
        
        const label = labelInput.value.trim();
        if (!label) {
            alert('Please enter a mistake description');
            return;
        }

        const container = document.getElementById('mistakes-list');
        const div = document.createElement('div');
        div.className = 'mistake-list-item';
        div.draggable = true;
        div.innerHTML = `
            <span class="drag-handle">☰</span>
            <input type="color" class="mistake-color" value="${colorInput.value}">
            <input type="text" class="form-input mistake-label" value="${this.escapeHtml(label)}" placeholder="Mistake description">
            <button type="button" class="btn btn-small btn-danger remove-mistake">×</button>
        `;
        container.appendChild(div);

        // Re-bind drag events for all items
        this.bindMistakesDragEvents();

        // Clear inputs
        labelInput.value = '';
        colorInput.value = '#ef4444';
    },

    saveMistakes() {
        const newMistakes = [];
        document.querySelectorAll('.mistake-list-item').forEach(item => {
            const label = item.querySelector('.mistake-label').value.trim();
            const color = item.querySelector('.mistake-color').value;
            const id = item.dataset.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            if (label) {
                newMistakes.push({ id, label, color });
            }
        });

        this.mistakes = newMistakes;
        Storage.setMistakes(newMistakes);
        this.renderMistakeTags();
        this.closeModal();
        
        // Refresh statistics if on stats view
        if (typeof Statistics !== 'undefined') {
            Statistics.render();
        }
    },

    getSelectedMistakes() {
        const selected = [];
        document.querySelectorAll('.mistake-tag.selected').forEach(tag => {
            selected.push(tag.dataset.id);
        });
        return selected;
    },

    setSelectedMistakes(mistakeIds) {
        document.querySelectorAll('.mistake-tag').forEach(tag => {
            tag.classList.toggle('selected', mistakeIds.includes(tag.dataset.id));
        });
    },

    clearSelectedMistakes() {
        document.querySelectorAll('.mistake-tag').forEach(tag => {
            tag.classList.remove('selected');
        });
    },

    getMistakeLabel(id) {
        const mistake = this.mistakes.find(m => m.id === id);
        return mistake ? mistake.label : id;
    },

    getMistakeColor(id) {
        const mistake = this.mistakes.find(m => m.id === id);
        return mistake ? mistake.color : '#ef4444';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
