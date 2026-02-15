// Templates Module - Handles trade template functionality

const Templates = {
    init() {
        this.bindEvents();
        this.renderTemplates();
    },

    bindEvents() {
        // Add template button
        document.getElementById('add-template-btn')?.addEventListener('click', () => {
            this.openModal();
        });

        // Close modal
        document.getElementById('close-template-modal')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancel-template')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Save template
        document.getElementById('save-template')?.addEventListener('click', () => {
            this.saveTemplate();
        });

        // Add checklist item
        const addChecklistBtn = document.getElementById('add-checklist-item');
        if (addChecklistBtn) {
            addChecklistBtn.addEventListener('click', () => {
                this.addChecklistInput('checklist-builder', 'checklist-text', 'remove-checklist');
            });
        }

        const addProfile4hBtn = document.getElementById('add-profile4h-item');
        if (addProfile4hBtn) {
            addProfile4hBtn.addEventListener('click', () => {
                console.log('Add 4H Profile item clicked');
                this.addChecklistInput('profile4h-builder', 'profile4h-text', 'remove-profile4h');
            });
        } else {
            console.warn('add-profile4h-item button not found');
        }

        const addDriversBtn = document.getElementById('add-drivers-item');
        if (addDriversBtn) {
            addDriversBtn.addEventListener('click', () => {
                console.log('Add Drivers item clicked');
                this.addChecklistInput('drivers-builder', 'drivers-text', 'remove-drivers');
            });
        } else {
            console.warn('add-drivers-item button not found');
        }

        // Remove checklist items (delegated)
        document.getElementById('checklist-builder')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-checklist')) {
                e.target.closest('.checklist-item-input').remove();
                this.bindChecklistDragEvents();
            }
        });

        document.getElementById('profile4h-builder')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-profile4h')) {
                e.target.closest('.checklist-item-input').remove();
                this.bindProfile4hDragEvents();
            }
        });

        document.getElementById('drivers-builder')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-drivers')) {
                e.target.closest('.checklist-item-input').remove();
                this.bindDriversDragEvents();
            }
        });
    },

    renderTemplates() {
        const container = document.getElementById('templates-container');
        if (!container) return;

        const templates = Storage.getTemplates();
        
        if (templates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No Templates Yet</h3>
                    <p>Create your first trade template to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = templates.map(template => {
            const profile4hCount = template.profile4h?.length || 0;
            const driversCount = template.drivers?.length || 0;
            const extraChecklists = [];
            if (profile4hCount > 0) extraChecklists.push(`📊 ${profile4hCount} 4H Profile`);
            if (driversCount > 0) extraChecklists.push(`🎯 ${driversCount} Drivers`);
            
            return `
            <div class="template-card ${template.isDefault ? 'default' : ''}" data-id="${template.id}">
                ${template.isDefault ? '<span class="template-badge">DEFAULT</span>' : ''}
                <h4>${this.escapeHtml(template.name)}</h4>
                <p>${this.escapeHtml(template.description || 'No description')}</p>
                <ul class="template-checklist">
                    ${template.checklist.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
                </ul>
                ${extraChecklists.length > 0 ? `<div class="template-extra-checklists">${extraChecklists.join(' • ')}</div>` : ''}
                <div class="template-actions">
                    <button class="btn btn-small btn-secondary edit-template">Edit</button>
                    <button class="btn btn-small btn-secondary duplicate-template">Duplicate</button>
                    <button class="btn btn-small btn-danger delete-template">Delete</button>
                    ${!template.isDefault ? `<button class="btn btn-small btn-secondary set-default">Set Default</button>` : ''}
                </div>
            </div>
        `}).join('');

        // Bind card actions
        container.querySelectorAll('.edit-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.template-card').dataset.id;
                this.editTemplate(id);
            });
        });

        container.querySelectorAll('.duplicate-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.template-card').dataset.id;
                this.duplicateTemplate(id);
            });
        });

        container.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.template-card').dataset.id;
                this.deleteTemplate(id);
            });
        });

        container.querySelectorAll('.set-default').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.template-card').dataset.id;
                this.setDefault(id);
            });
        });
    },

    openModal(template = null) {
        const modal = document.getElementById('template-modal');
        const form = document.getElementById('template-form');
        const title = document.getElementById('template-modal-title');
        
        form.reset();
        document.getElementById('template-id').value = '';
        
        // Reset all builders
        document.getElementById('checklist-builder').innerHTML = `
            <div class="checklist-item-input" draggable="true">
                <span class="drag-handle">☰</span>
                <input type="text" class="form-input checklist-text" placeholder="Checklist item">
                <button type="button" class="btn btn-small btn-danger remove-checklist">&times;</button>
            </div>
        `;
        document.getElementById('profile4h-builder').innerHTML = `
            <div class="checklist-item-input" draggable="true">
                <span class="drag-handle">☰</span>
                <input type="text" class="form-input profile4h-text" placeholder="4H Profile item">
                <button type="button" class="btn btn-small btn-danger remove-profile4h">&times;</button>
            </div>
        `;
        document.getElementById('drivers-builder').innerHTML = `
            <div class="checklist-item-input" draggable="true">
                <span class="drag-handle">☰</span>
                <input type="text" class="form-input drivers-text" placeholder="Driver item">
                <button type="button" class="btn btn-small btn-danger remove-drivers">&times;</button>
            </div>
        `;

        if (template) {
            title.textContent = 'Edit Template';
            document.getElementById('template-id').value = template.id;
            document.getElementById('template-name').value = template.name;
            document.getElementById('template-description').value = template.description || '';
            document.getElementById('template-default').checked = template.isDefault || false;
            
            // Populate main checklist
            const builder = document.getElementById('checklist-builder');
            builder.innerHTML = template.checklist.map((item, index) => `
                <div class="checklist-item-input" draggable="true" data-index="${index}">
                    <span class="drag-handle">☰</span>
                    <input type="text" class="form-input checklist-text" value="${this.escapeHtml(item)}">
                    <button type="button" class="btn btn-small btn-danger remove-checklist">&times;</button>
                </div>
            `).join('');
            
            // Populate 4H Profile checklist
            const profileBuilder = document.getElementById('profile4h-builder');
            if (template.profile4h && template.profile4h.length > 0) {
                profileBuilder.innerHTML = template.profile4h.map((item, index) => `
                    <div class="checklist-item-input" draggable="true" data-index="${index}">
                        <span class="drag-handle">☰</span>
                        <input type="text" class="form-input profile4h-text" value="${this.escapeHtml(item)}">
                        <button type="button" class="btn btn-small btn-danger remove-profile4h">&times;</button>
                    </div>
                `).join('');
            }
            
            // Populate Drivers checklist
            const driversBuilder = document.getElementById('drivers-builder');
            if (template.drivers && template.drivers.length > 0) {
                driversBuilder.innerHTML = template.drivers.map((item, index) => `
                    <div class="checklist-item-input" draggable="true" data-index="${index}">
                        <span class="drag-handle">☰</span>
                        <input type="text" class="form-input drivers-text" value="${this.escapeHtml(item)}">
                        <button type="button" class="btn btn-small btn-danger remove-drivers">&times;</button>
                    </div>
                `).join('');
            }
        } else {
            title.textContent = 'Create Template';
        }

        // Bind drag and drop events for all builders
        this.bindChecklistDragEvents();
        this.bindProfile4hDragEvents();
        this.bindDriversDragEvents();
        
        modal.classList.add('active');
    },

    bindDragEvents(builderId) {
        const builder = document.getElementById(builderId);
        if (!builder) return;
        
        let draggedItem = null;
        
        builder.querySelectorAll('.checklist-item-input').forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                builder.querySelectorAll('.checklist-item-input').forEach(i => {
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
                builder.querySelectorAll('.checklist-item-input').forEach((i, idx) => {
                    i.dataset.index = idx;
                });
            });
        });
    },

    bindChecklistDragEvents() {
        this.bindDragEvents('checklist-builder');
    },

    bindProfile4hDragEvents() {
        this.bindDragEvents('profile4h-builder');
    },

    bindDriversDragEvents() {
        this.bindDragEvents('drivers-builder');
    },

    closeModal() {
        document.getElementById('template-modal').classList.remove('active');
    },

    addChecklistInput(builderId, inputClass, removeClass) {
        console.log(`Adding checklist item to ${builderId}`);
        const builder = document.getElementById(builderId);
        if (!builder) {
            console.error(`Builder ${builderId} not found`);
            return;
        }
        const div = document.createElement('div');
        div.className = 'checklist-item-input';
        div.draggable = true;
        div.innerHTML = `
            <span class="drag-handle">☰</span>
            <input type="text" class="form-input ${inputClass}" placeholder="Checklist item">
            <button type="button" class="btn btn-small btn-danger ${removeClass}">&times;</button>
        `;
        builder.appendChild(div);
        
        // Re-bind drag events for all items based on builder
        if (builderId === 'checklist-builder') this.bindChecklistDragEvents();
        if (builderId === 'profile4h-builder') this.bindProfile4hDragEvents();
        if (builderId === 'drivers-builder') this.bindDriversDragEvents();
        
        // Focus the new input
        const newInput = div.querySelector('input');
        if (newInput) newInput.focus();
    },

    saveTemplate() {
        const id = document.getElementById('template-id').value;
        const name = document.getElementById('template-name').value.trim();
        const description = document.getElementById('template-description').value.trim();
        const isDefault = document.getElementById('template-default').checked;
        
        // Get main checklist items
        const checklistItems = [];
        document.querySelectorAll('#checklist-builder .checklist-text').forEach(input => {
            if (input.value.trim()) {
                checklistItems.push(input.value.trim());
            }
        });
        
        // Get 4H Profile checklist items
        const profile4hItems = [];
        document.querySelectorAll('#profile4h-builder .profile4h-text').forEach(input => {
            if (input.value.trim()) {
                profile4hItems.push(input.value.trim());
            }
        });
        
        // Get Drivers checklist items
        const driversItems = [];
        document.querySelectorAll('#drivers-builder .drivers-text').forEach(input => {
            if (input.value.trim()) {
                driversItems.push(input.value.trim());
            }
        });

        if (!name) {
            alert('Please enter a template name');
            return;
        }

        const template = {
            name,
            description,
            checklist: checklistItems,
            profile4h: profile4hItems,
            drivers: driversItems,
            isDefault
        };

        if (id) {
            Storage.updateTemplate(id, template);
        } else {
            Storage.addTemplate(template);
        }

        this.closeModal();
        this.renderTemplates();
        
        // Refresh template selector in trade form
        if (typeof App !== 'undefined') {
            App.populateTemplateSelector();
        }
    },

    editTemplate(id) {
        const templates = Storage.getTemplates();
        const template = templates.find(t => t.id === id);
        if (template) {
            this.openModal(template);
        }
    },

    deleteTemplate(id) {
        if (confirm('Are you sure you want to delete this template?')) {
            Storage.deleteTemplate(id);
            this.renderTemplates();
            
            // Refresh template selector in trade form
            if (typeof App !== 'undefined') {
                App.populateTemplateSelector();
            }
        }
    },

    duplicateTemplate(id) {
        const templates = Storage.getTemplates();
        const template = templates.find(t => t.id === id);
        if (template) {
            const duplicatedTemplate = {
                name: `${template.name} (Copy)`,
                description: template.description,
                checklist: [...template.checklist],
                profile4h: template.profile4h ? [...template.profile4h] : [],
                drivers: template.drivers ? [...template.drivers] : [],
                isDefault: false
            };
            Storage.addTemplate(duplicatedTemplate);
            this.renderTemplates();

            // Refresh template selector in trade form
            if (typeof App !== 'undefined') {
                App.populateTemplateSelector();
            }

            showToast('Template duplicated', 'success');
        }
    },

    setDefault(id) {
        Storage.updateTemplate(id, { isDefault: true });
        this.renderTemplates();
        
        // Refresh template selector in trade form
        if (typeof App !== 'undefined') {
            App.populateTemplateSelector();
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
