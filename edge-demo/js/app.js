// Main App Module - Orchestrates the trading journal application

const App = {
    currentView: 'trades',
    editingTradeId: null,

    init() {
        Storage.init();
        this.bindEvents();
        this.populateTemplateSelector();
        this.renderTrades();
        Templates.init();
        Psychology.init();
        Statistics.init();
        Mistakes.init();
        Accounts.init();

        // Set today's date as default
        document.getElementById('trade-date').valueAsDate = new Date();
    },

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        // Add trade button
        document.getElementById('add-trade-btn')?.addEventListener('click', () => {
            this.openTradeModal();
        });

        // Close trade modal
        document.getElementById('close-trade-modal')?.addEventListener('click', () => {
            this.closeTradeModal();
        });

        document.getElementById('cancel-trade')?.addEventListener('click', () => {
            this.closeTradeModal();
        });

        // Save trade
        document.getElementById('save-trade')?.addEventListener('click', () => {
            this.saveTrade();
        });

        // Template change - update checklist
        document.getElementById('trade-template')?.addEventListener('change', (e) => {
            this.renderTemplateChecklist(e.target.value);
        });

        // Auto-calculate P&L when prices change
        ['trade-entry', 'trade-exit', 'trade-quantity', 'trade-direction'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.calculatePnL();
            });
        });
    },

    switchView(view) {
        this.currentView = view;
        
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `${view}-view`);
        });
        
        // Refresh data for the view
        if (view === 'trades') {
            this.renderTrades();
        } else if (view === 'psychology') {
            Psychology.render();
        } else if (view === 'templates') {
            Templates.renderTemplates();
        } else if (view === 'statistics') {
            Statistics.render();
        }
    },

    populateTemplateSelector() {
        const select = document.getElementById('trade-template');
        if (!select) return;
        
        const templates = Storage.getTemplates();
        select.innerHTML = templates.map(t => 
            `<option value="${t.id}" ${t.isDefault ? 'selected' : ''}>${t.name}</option>`
        ).join('');
        
        // Render checklist for default template
        this.renderTemplateChecklist(select.value);
    },

    renderTemplateChecklist(templateId, savedData = null) {
        const templates = Storage.getTemplates();
        const template = templates.find(t => t.id === templateId);

        // Render main checklist
        const container = document.getElementById('template-checklist');
        if (container) {
            if (!template || !template.checklist || template.checklist.length === 0) {
                container.innerHTML = '<p class="text-muted">No checklist items for this template</p>';
            } else {
                const savedChecklist = savedData?.checklist;
                container.innerHTML = template.checklist.map((item, index) => {
                    const savedItem = savedChecklist ? savedChecklist.find(sc => sc.text === item) : null;
                    const isChecked = savedItem ? savedItem.checked : false;
                    return `
                        <div class="checklist-item">
                            <input type="checkbox" id="check-${index}" class="checklist-checkbox" ${isChecked ? 'checked' : ''} data-text="${this.escapeHtml(item)}">
                            <label for="check-${index}">${this.escapeHtml(item)}</label>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render 4H Profile checklist
        const profileContainer = document.getElementById('profile4h-checklist');
        if (profileContainer) {
            const profileItems = template?.profile4h || [];
            if (profileItems.length === 0) {
                profileContainer.innerHTML = '<p class="text-muted">No 4H Profile items for this template</p>';
            } else {
                const savedProfile = savedData?.profile4h;
                profileContainer.innerHTML = profileItems.map((item, index) => {
                    const savedItem = savedProfile ? savedProfile.find(sc => sc.text === item) : null;
                    const isChecked = savedItem ? savedItem.checked : false;
                    return `
                        <div class="checklist-item">
                            <input type="checkbox" id="profile4h-${index}" class="profile4h-checkbox" ${isChecked ? 'checked' : ''} data-text="${this.escapeHtml(item)}">
                            <label for="profile4h-${index}">${this.escapeHtml(item)}</label>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render Drivers checklist
        const driversContainer = document.getElementById('drivers-checklist');
        if (driversContainer) {
            const driversItems = template?.drivers || [];
            if (driversItems.length === 0) {
                driversContainer.innerHTML = '<p class="text-muted">No Drivers items for this template</p>';
            } else {
                const savedDrivers = savedData?.drivers;
                driversContainer.innerHTML = driversItems.map((item, index) => {
                    const savedItem = savedDrivers ? savedDrivers.find(sc => sc.text === item) : null;
                    const isChecked = savedItem ? savedItem.checked : false;
                    return `
                        <div class="checklist-item">
                            <input type="checkbox" id="drivers-${index}" class="drivers-checkbox" ${isChecked ? 'checked' : ''} data-text="${this.escapeHtml(item)}">
                            <label for="drivers-${index}">${this.escapeHtml(item)}</label>
                        </div>
                    `;
                }).join('');
            }
        }
    },

    calculatePnL() {
        const entry = parseFloat(document.getElementById('trade-entry').value) || 0;
        const exit = parseFloat(document.getElementById('trade-exit').value) || 0;
        const quantity = parseFloat(document.getElementById('trade-quantity').value) || 0;
        const direction = document.getElementById('trade-direction').value;
        
        if (entry && exit && quantity) {
            let pnl;
            if (direction === 'long') {
                pnl = (exit - entry) * quantity;
            } else {
                pnl = (entry - exit) * quantity;
            }
            document.getElementById('trade-pnl').value = pnl.toFixed(2);
        }
    },

    calculateRMultiple(entry, exit, stop, direction) {
        if (!entry || !stop) return 0;
        
        const risk = Math.abs(entry - stop);
        const reward = Math.abs(exit - entry);
        
        if (risk === 0) return 0;
        
        const rMultiple = reward / risk;
        return direction === 'long' 
            ? (exit > entry ? rMultiple : -rMultiple)
            : (exit < entry ? rMultiple : -rMultiple);
    },

    openTradeModal(trade = null) {
        const modal = document.getElementById('trade-modal');
        const form = document.getElementById('trade-form');
        const title = document.getElementById('trade-modal-title');

        form.reset();
        this.editingTradeId = null;
        Psychology.clearEmotions();
        Mistakes.clearSelectedMistakes();
        
        // Reset range displays
        document.getElementById('confidence-value').textContent = '5';
        document.getElementById('stress-value').textContent = '3';
        
        // Set default date
        document.getElementById('trade-date').valueAsDate = new Date();
        
        if (trade) {
            title.textContent = 'Edit Trade';
            this.editingTradeId = trade.id;
            
            // Populate form
            document.getElementById('trade-symbol').value = trade.symbol;
            document.getElementById('trade-date').value = trade.date;
            document.getElementById('trade-direction').value = trade.direction;
            document.getElementById('trade-result').value = trade.result;
            document.getElementById('trade-entry').value = trade.entry;
            document.getElementById('trade-exit').value = trade.exit;
            document.getElementById('trade-stop').value = trade.stop;
            document.getElementById('trade-target').value = trade.target || '';
            document.getElementById('trade-quantity').value = trade.quantity;
            document.getElementById('trade-pnl').value = trade.pnl || '';
            document.getElementById('trade-notes').value = trade.notes || '';
            document.getElementById('trade-template').value = trade.templateId || Storage.getDefaultTemplate()?.id;

            // Populate account selector
            const accountSelect = document.getElementById('trade-account');
            if (accountSelect && trade.accountId) {
                accountSelect.value = trade.accountId;
            } else if (accountSelect) {
                // Set default account
                const defaultAccount = Storage.getDefaultAccount();
                if (defaultAccount) {
                    accountSelect.value = defaultAccount.id;
                }
            }

            // Populate psychology
            if (trade.psychology?.preTrade) {
                const pre = trade.psychology.preTrade;
                document.getElementById('pre-mood').value = pre.mood || 'neutral';
                document.getElementById('pre-confidence').value = pre.confidence || 5;
                document.getElementById('confidence-value').textContent = pre.confidence || 5;
                document.getElementById('pre-sleep').value = pre.sleep || 7;
                document.getElementById('pre-stress').value = pre.stress || 3;
                document.getElementById('stress-value').textContent = pre.stress || 3;
                
            }
            
            if (trade.psychology?.postTrade) {
                const post = trade.psychology.postTrade;
                document.getElementById('post-mood').value = post.mood || 'neutral';
                document.getElementById('post-discipline').value = post.discipline || 'yes';
                document.getElementById('post-lessons').value = post.lessons || '';
                Psychology.setSelectedEmotions(post.emotions || []);
                
                // Set selected mistakes
                if (post.mistakeIds && post.mistakeIds.length > 0) {
                    Mistakes.setSelectedMistakes(post.mistakeIds);
                }
            }
            
            // Render all checklists with saved data
            const savedData = {
                checklist: trade.psychology?.preTrade?.checklist,
                profile4h: trade.psychology?.preTrade?.profile4h,
                drivers: trade.psychology?.preTrade?.drivers
            };
            this.renderTemplateChecklist(document.getElementById('trade-template').value, savedData);
        } else {
            title.textContent = 'Add Trade';
            this.renderTemplateChecklist(Storage.getDefaultTemplate()?.id);
        }
        
        modal.classList.add('active');
    },

    closeTradeModal() {
        document.getElementById('trade-modal').classList.remove('active');
        this.editingTradeId = null;
    },

    saveTrade() {
        const symbol = document.getElementById('trade-symbol').value.trim().toUpperCase();
        const date = document.getElementById('trade-date').value;
        const direction = document.getElementById('trade-direction').value;
        const result = document.getElementById('trade-result').value;
        const entry = parseFloat(document.getElementById('trade-entry').value);
        const exit = parseFloat(document.getElementById('trade-exit').value);
        const stop = parseFloat(document.getElementById('trade-stop').value);
        const target = parseFloat(document.getElementById('trade-target').value) || null;
        const quantity = parseFloat(document.getElementById('trade-quantity').value);
        const pnl = parseFloat(document.getElementById('trade-pnl').value) || 0;
        const notes = document.getElementById('trade-notes').value.trim();
        const templateId = document.getElementById('trade-template').value;
        const accountId = document.getElementById('trade-account').value;

        if (!symbol || !date || !entry || !exit || !quantity) {
            alert('Please fill in all required fields');
            return;
        }

        if (!accountId) {
            alert('Please select an account for this trade');
            return;
        }
        
        // Gather checklist items
        const checklistItems = [];
        document.querySelectorAll('.checklist-checkbox').forEach((checkbox) => {
            checklistItems.push({
                text: checkbox.dataset.text || checkbox.nextElementSibling.textContent,
                checked: checkbox.checked
            });
        });

        // Gather 4H Profile checklist
        const profile4hChecklist = [];
        document.querySelectorAll('.profile4h-checkbox').forEach((checkbox) => {
            profile4hChecklist.push({
                text: checkbox.dataset.text || checkbox.nextElementSibling.textContent,
                checked: checkbox.checked
            });
        });

        // Gather Drivers checklist
        const driversChecklist = [];
        document.querySelectorAll('.drivers-checkbox').forEach((checkbox) => {
            driversChecklist.push({
                text: checkbox.dataset.text || checkbox.nextElementSibling.textContent,
                checked: checkbox.checked
            });
        });
        
        // Calculate R-Multiple
        const rMultiple = this.calculateRMultiple(entry, exit, stop, direction);
        
        const trade = {
            symbol,
            date,
            direction,
            result,
            entry,
            exit,
            stop,
            target,
            quantity,
            pnl,
            rMultiple,
            notes,
            templateId,
            accountId,
            psychology: {
                preTrade: {
                    mood: document.getElementById('pre-mood').value,
                    confidence: document.getElementById('pre-confidence').value,
                    sleep: document.getElementById('pre-sleep').value,
                    stress: document.getElementById('pre-stress').value,
                    checklist: checklistItems,
                    profile4h: profile4hChecklist,
                    drivers: driversChecklist
                },
                postTrade: {
                    mood: document.getElementById('post-mood').value,
                    discipline: document.getElementById('post-discipline').value,
                    lessons: document.getElementById('post-lessons').value.trim(),
                    emotions: Psychology.getSelectedEmotions(),
                    mistakeIds: Mistakes.getSelectedMistakes()
                }
            }
        };
        
        if (this.editingTradeId) {
            Storage.updateTrade(this.editingTradeId, trade);
        } else {
            Storage.addTrade(trade);
        }
        
        this.closeTradeModal();
        this.renderTrades();
        
        // Refresh other views
        Psychology.render();
        Statistics.render();
    },

    renderTrades() {
        const container = document.getElementById('trades-list');
        if (!container) return;
        
        const trades = Storage.getTrades().sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (trades.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>No Trades Yet</h3>
                    <p>Add your first trade to start tracking your journey</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = trades.map(trade => {
            const resultClass = trade.result;
            const pnlClass = trade.pnl >= 0 ? 'positive' : 'negative';
            const pnlPrefix = trade.pnl >= 0 ? '+' : '';

            // Get account info if available
            let accountLabel = '';
            if (trade.accountId) {
                const account = Accounts.getAccountById(trade.accountId);
                if (account) {
                    accountLabel = `<span class="trade-account">🏦 ${this.escapeHtml(account.name)}</span>`;
                }
            }

            // Generate mistake tags if any
            let mistakeTags = '';
            if (trade.psychology?.postTrade?.mistakeIds?.length > 0) {
                const mistakeLabels = trade.psychology.postTrade.mistakeIds.map(id => {
                    const label = Mistakes.getMistakeLabel(id);
                    const color = Mistakes.getMistakeColor(id);
                    return `<span class="trade-mistake-tag" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">${this.escapeHtml(label)}</span>`;
                }).join('');
                mistakeTags = `<div class="trade-mistakes">${mistakeLabels}</div>`;
            }

            return `
                <div class="trade-card" data-id="${trade.id}">
                    <div class="trade-result-badge ${resultClass}">
                        ${trade.result.toUpperCase()}
                    </div>
                    <div class="trade-info">
                        <h4>${trade.symbol} ${trade.direction === 'long' ? '📈' : '📉'}</h4>
                        <div class="trade-meta">
                            <span>${new Date(trade.date).toLocaleDateString()}</span>
                            <span>Entry: $${trade.entry}</span>
                            <span>Exit: $${trade.exit}</span>
                            ${trade.rMultiple ? `<span>${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple.toFixed(2)}R</span>` : ''}
                            ${accountLabel}
                        </div>
                        ${mistakeTags}
                    </div>
                    <div class="trade-pnl">
                        <div class="amount ${pnlClass}">${pnlPrefix}$${Math.abs(trade.pnl).toFixed(2)}</div>
                        ${trade.rMultiple ? `<div class="r-multiple">${trade.rMultiple.toFixed(2)}R</div>` : ''}
                    </div>
                    <div class="trade-actions">
                        <button class="btn btn-small btn-secondary edit-trade">Edit</button>
                        <button class="btn btn-small btn-danger delete-trade">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Bind actions
        container.querySelectorAll('.edit-trade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.trade-card').dataset.id;
                const trade = trades.find(t => t.id === id);
                if (trade) this.openTradeModal(trade);
            });
        });
        
        container.querySelectorAll('.delete-trade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.trade-card').dataset.id;
                if (confirm('Are you sure you want to delete this trade?')) {
                    Storage.deleteTrade(id);
                    this.renderTrades();
                    Psychology.render();
                    Statistics.render();
                }
            });
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
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
// Psychology Module - Handles psychology tracking and discipline scoring

const Psychology = {
    emotions: [],

    init() {
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        // Emotion tag selection
        document.getElementById('emotion-tags')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('emotion-tag')) {
                e.target.classList.toggle('selected');
            }
        });

        // Range inputs display
        document.getElementById('pre-confidence')?.addEventListener('input', (e) => {
            document.getElementById('confidence-value').textContent = e.target.value;
        });

        document.getElementById('pre-stress')?.addEventListener('input', (e) => {
            document.getElementById('stress-value').textContent = e.target.value;
        });
    },

    render() {
        this.renderDisciplineScore();
        this.renderMoodChart();
        this.renderInsights();
        this.renderChecklistHistory();
    },

    calculateDisciplineScore() {
        const trades = Storage.getTrades();
        if (trades.length === 0) return { score: 0, breakdown: {} };

        let totalScore = 0;
        const breakdown = {
            planFollowed: 0,
            emotionsControlled: 0,
            checklistCompleted: 0,
            confidenceAligned: 0
        };

        const tradesWithPsychology = trades.filter(t => t.psychology?.postTrade);
        
        if (tradesWithPsychology.length === 0) return { score: 0, breakdown };

        tradesWithPsychology.forEach(trade => {
            const post = trade.psychology.postTrade;
            const pre = trade.psychology.preTrade;

            // Plan followed (25 points)
            if (post.discipline === 'yes') breakdown.planFollowed += 25;
            else if (post.discipline === 'partial') breakdown.planFollowed += 12;

            // Emotions controlled (25 points)
            const negativeEmotions = ['fear', 'greed', 'fomo', 'revenge', 'overconfidence', 'impatience', 'doubt'];
            const selectedEmotions = post.emotions || [];
            const hasNegative = selectedEmotions.some(e => negativeEmotions.includes(e));
            const hasPositive = selectedEmotions.some(e => ['calm', 'focused', 'confident'].includes(e));
            
            if (!hasNegative && hasPositive) breakdown.emotionsControlled += 25;
            else if (!hasNegative) breakdown.emotionsControlled += 15;
            else if (hasPositive) breakdown.emotionsControlled += 10;

            // Checklist completed (25 points)
            if (pre.checklist) {
                const checked = pre.checklist.filter(item => item.checked).length;
                const total = pre.checklist.length;
                if (total > 0) {
                    breakdown.checklistCompleted += Math.round((checked / total) * 25);
                }
            }

            // Confidence aligned with outcome (25 points)
            const confidence = parseInt(pre.confidence) || 5;
            if (trade.result === 'win' && confidence >= 7) {
                breakdown.confidenceAligned += 25;
            } else if (trade.result === 'loss' && confidence <= 4) {
                breakdown.confidenceAligned += 25;
            } else if (trade.result === 'win' && confidence >= 5) {
                breakdown.confidenceAligned += 15;
            } else if (trade.result === 'loss' && confidence <= 6) {
                breakdown.confidenceAligned += 15;
            }
        });

        const count = tradesWithPsychology.length;
        totalScore = Math.round(
            (breakdown.planFollowed / count) +
            (breakdown.emotionsControlled / count) +
            (breakdown.checklistCompleted / count) +
            (breakdown.confidenceAligned / count)
        );

        // Average the breakdown
        Object.keys(breakdown).forEach(key => {
            breakdown[key] = Math.round(breakdown[key] / count);
        });

        return { score: Math.min(100, Math.max(0, totalScore)), breakdown };
    },

    renderDisciplineScore() {
        const { score, breakdown } = this.calculateDisciplineScore();
        const scoreElement = document.getElementById('discipline-score');
        const breakdownElement = document.getElementById('score-breakdown');

        if (!scoreElement) return;

        scoreElement.style.setProperty('--score-percent', `${score}%`);
        scoreElement.querySelector('.score-value').textContent = score;

        const breakdownLabels = {
            planFollowed: 'Following Trading Plan',
            emotionsControlled: 'Emotional Control',
            checklistCompleted: 'Checklist Completion',
            confidenceAligned: 'Confidence Calibration'
        };

        if (breakdownElement) {
            breakdownElement.innerHTML = Object.entries(breakdown)
                .map(([key, value]) => `
                    <div class="breakdown-item">
                        <span class="breakdown-label">${breakdownLabels[key]}</span>
                        <span class="breakdown-value">${value}/25</span>
                    </div>
                `).join('');
        }
    },

    renderMoodChart() {
        const canvas = document.getElementById('mood-chart');
        if (!canvas) return;

        const trades = Storage.getTrades();
        const moodOrder = ['bad', 'poor', 'neutral', 'good', 'excellent'];
        const moodColors = {
            excellent: '#10b981',
            good: '#3b82f6',
            neutral: '#f59e0b',
            poor: '#f97316',
            bad: '#ef4444'
        };

        // Get last 30 days of trades
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentTrades = trades
            .filter(t => new Date(t.date) >= thirtyDaysAgo)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Group by date, take average mood
        const moodByDate = {};
        recentTrades.forEach(trade => {
            if (trade.psychology?.preTrade?.mood) {
                const date = trade.date;
                if (!moodByDate[date]) {
                    moodByDate[date] = [];
                }
                moodByDate[date].push(trade.psychology.preTrade.mood);
            }
        });

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = 30;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        ctx.clearRect(0, 0, width, height);

        if (Object.keys(moodByDate).length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No mood data available', width / 2, height / 2);
            return;
        }

        const dates = Object.keys(moodByDate).sort();
        const barWidth = Math.max(10, (chartWidth / dates.length) - 4);

        dates.forEach((date, index) => {
            const moods = moodByDate[date];
            const avgMoodIndex = moods.reduce((sum, m) => 
                sum + moodOrder.indexOf(m), 0) / moods.length;
            
            const mostCommon = moods.sort((a, b) =>
                moods.filter(v => v === a).length - moods.filter(v => v === b).length
            ).pop();

            const barHeight = ((avgMoodIndex + 1) / moodOrder.length) * chartHeight;
            const x = padding + index * (chartWidth / dates.length);
            const y = padding + chartHeight - barHeight;

            ctx.fillStyle = moodColors[mostCommon];
            ctx.fillRect(x, y, barWidth, barHeight);

            // Date label
            if (dates.length <= 15 || index % 2 === 0) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = '10px sans-serif';
                ctx.save();
                ctx.translate(x + barWidth / 2, height - 5);
                ctx.rotate(-Math.PI / 4);
                ctx.textAlign = 'right';
                ctx.fillText(new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 0, 0);
                ctx.restore();
            }
        });

        // Y-axis labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        moodOrder.forEach((mood, index) => {
            const y = padding + chartHeight - ((index + 1) / moodOrder.length) * chartHeight;
            ctx.fillText(mood.charAt(0).toUpperCase(), padding - 8, y + 3);
        });
    },

    renderInsights() {
        const container = document.getElementById('psychology-insights');
        if (!container) return;

        const trades = Storage.getTrades();
        const insights = this.generateInsights(trades);

        if (insights.length === 0) {
            container.innerHTML = '<p class="empty-state">Not enough data for insights yet</p>';
            return;
        }

        container.innerHTML = insights.map(insight => `
            <div class="insight-item ${insight.type}">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-desc">${insight.description}</div>
            </div>
        `).join('');
    },

    generateInsights(trades) {
        const insights = [];
        const tradesWithPsychology = trades.filter(t => t.psychology?.preTrade);

        if (tradesWithPsychology.length < 5) return insights;

        // Sleep correlation
        const sleepGroups = { good: [], bad: [] };
        tradesWithPsychology.forEach(t => {
            const sleep = parseFloat(t.psychology.preTrade.sleep) || 7;
            if (sleep >= 7) sleepGroups.good.push(t);
            else sleepGroups.bad.push(t);
        });

        if (sleepGroups.good.length >= 3 && sleepGroups.bad.length >= 3) {
            const goodWinRate = this.calculateWinRate(sleepGroups.good);
            const badWinRate = this.calculateWinRate(sleepGroups.bad);
            
            if (goodWinRate > badWinRate + 10) {
                insights.push({
                    type: 'success',
                    title: '💤 Sleep Matters!',
                    description: `Your win rate is ${goodWinRate.toFixed(0)}% with 7+ hours sleep vs ${badWinRate.toFixed(0)}% when rested less.`
                });
            }
        }

        // Confidence calibration
        const highConfTrades = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.confidence) >= 8);
        const lowConfTrades = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.confidence) <= 4);

        if (highConfTrades.length >= 3) {
            const highConfWinRate = this.calculateWinRate(highConfTrades);
            if (highConfWinRate < 50) {
                insights.push({
                    type: 'warning',
                    title: '⚠️ Overconfidence Pattern',
                    description: 'Your high-confidence trades are underperforming. Consider more thorough analysis.'
                });
            }
        }

        // Stress correlation
        const lowStress = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.stress) <= 3);
        const highStress = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.stress) >= 7);

        if (lowStress.length >= 3 && highStress.length >= 3) {
            const lowStressWinRate = this.calculateWinRate(lowStress);
            const highStressWinRate = this.calculateWinRate(highStress);

            if (lowStressWinRate > highStressWinRate + 15) {
                insights.push({
                    type: 'danger',
                    title: '😰 Stress Impact',
                    description: `Trading under high stress (${highStressWinRate.toFixed(0)}% win rate) significantly hurts performance.`
                });
            }
        }

        // Discipline correlation
        const disciplinedTrades = trades.filter(t => t.psychology?.postTrade?.discipline === 'yes');
        const undisciplinedTrades = trades.filter(t => t.psychology?.postTrade?.discipline === 'no');

        if (disciplinedTrades.length >= 3 && undisciplinedTrades.length >= 3) {
            const disciplinedWinRate = this.calculateWinRate(disciplinedTrades);
            const undisciplinedWinRate = this.calculateWinRate(undisciplinedTrades);

            insights.push({
                type: disciplinedWinRate > undisciplinedWinRate ? 'success' : 'neutral',
                title: '📋 Discipline Impact',
                description: `Win rate when following plan: ${disciplinedWinRate.toFixed(0)}% vs deviating: ${undisciplinedWinRate.toFixed(0)}%`
            });
        }

        // Mood correlation
        const goodMoodTrades = tradesWithPsychology.filter(t => 
            ['excellent', 'good'].includes(t.psychology.preTrade.mood));
        const badMoodTrades = tradesWithPsychology.filter(t => 
            ['poor', 'bad'].includes(t.psychology.preTrade.mood));

        if (goodMoodTrades.length >= 3 && badMoodTrades.length >= 3) {
            const goodMoodWinRate = this.calculateWinRate(goodMoodTrades);
            const badMoodWinRate = this.calculateWinRate(badMoodTrades);

            if (goodMoodWinRate > badMoodWinRate + 10) {
                insights.push({
                    type: 'success',
                    title: '😊 Mood Advantage',
                    description: `You trade better when in good mood (${goodMoodWinRate.toFixed(0)}% vs ${badMoodWinRate.toFixed(0)}%).`
                });
            }
        }

        return insights.slice(0, 5);
    },

    calculateWinRate(trades) {
        if (trades.length === 0) return 0;
        const wins = trades.filter(t => t.result === 'win').length;
        return (wins / trades.length) * 100;
    },

    renderChecklistHistory() {
        const container = document.getElementById('pretrade-history');
        if (!container) return;

        const trades = Storage.getTrades()
            .filter(t => t.psychology?.preTrade)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (trades.length === 0) {
            container.innerHTML = '<p class="empty-state">No pre-trade checklists yet</p>';
            return;
        }

        container.innerHTML = trades.map(trade => {
            const pre = trade.psychology.preTrade;
            const moodEmoji = {
                excellent: '😄',
                good: '🙂',
                neutral: '😐',
                poor: '😕',
                bad: '😫'
            };

            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-date">${new Date(trade.date).toLocaleDateString()}</span>
                        <span class="history-symbol">${trade.symbol}</span>
                    </div>
                    <div class="history-metrics">
                        <span>${moodEmoji[pre.mood] || '😐'} ${pre.mood}</span>
                        <span>💪 ${pre.confidence}/10</span>
                        <span>😴 ${pre.sleep}h sleep</span>
                        <span>📊 ${pre.stress}/10 stress</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    getSelectedEmotions() {
        const selected = [];
        document.querySelectorAll('.emotion-tag.selected').forEach(tag => {
            selected.push(tag.dataset.emotion);
        });
        return selected;
    },

    setSelectedEmotions(emotions) {
        document.querySelectorAll('.emotion-tag').forEach(tag => {
            tag.classList.toggle('selected', emotions.includes(tag.dataset.emotion));
        });
    },

    clearEmotions() {
        document.querySelectorAll('.emotion-tag').forEach(tag => {
            tag.classList.remove('selected');
        });
    }
};
// Statistics Module - Handles enhanced statistics calculations

const Statistics = {
    init() {
        this.render();
    },

    render() {
        this.renderKeyMetrics();
        this.renderTradeTypeStats();
        this.renderPsychCorrelations();
        this.renderTargetStats();
        this.renderMistakesStats();
        this.renderProfile4hStats();
        this.renderEquityCurve();
    },

    getStats(accountId = null) {
        let trades = Storage.getTrades();
        
        // Filter by account if specified
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }
        
        if (trades.length === 0) {
            return null;
        }

        // Determine wins/losses based on P&L value (not result field)
        const winningTrades = trades.filter(t => parseFloat(t.pnl) > 0);
        const losingTrades = trades.filter(t => parseFloat(t.pnl) < 0);
        const breakevenTrades = trades.filter(t => parseFloat(t.pnl) === 0);
        
        const totalPnL = trades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
        const wins = winningTrades.length;
        const losses = losingTrades.length;
        const winRate = (wins / trades.length) * 100;
        
        const grossProfit = winningTrades.reduce((sum, t) => sum + Math.abs(parseFloat(t.pnl) || 0), 0);
        const grossLoss = losingTrades.reduce((sum, t) => sum + Math.abs(parseFloat(t.pnl) || 0), 0);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
        
        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        
        // Expectancy = (Win% * Avg Win) - (Loss% * Avg Loss)
        const expectancy = (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss);
        
        // R-Multiple calculation
        const tradesWithR = trades.filter(t => t.rMultiple !== undefined);
        const avgRMultiple = tradesWithR.length > 0 
            ? tradesWithR.reduce((sum, t) => sum + t.rMultiple, 0) / tradesWithR.length 
            : 0;
        
        // Max Drawdown
        const maxDrawdown = this.calculateMaxDrawdown(trades);
        
        return {
            totalTrades: trades.length,
            wins,
            losses,
            breakeven: breakevenTrades.length,
            winRate,
            profitFactor,
            expectancy,
            avgWin,
            avgLoss,
            avgRMultiple,
            maxDrawdown,
            grossProfit,
            grossLoss,
            totalPnL
        };
    },

    calculateMaxDrawdown(trades) {
        if (trades.length === 0) return 0;
        
        // Sort by date
        const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let peak = 0;
        let maxDrawdown = 0;
        let runningPnL = 0;
        
        sortedTrades.forEach(trade => {
            runningPnL += parseFloat(trade.pnl) || 0;
            
            if (runningPnL > peak) {
                peak = runningPnL;
            }
            
            const drawdown = peak - runningPnL;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });
        
        return maxDrawdown;
    },

    calculateTradeTypeStats() {
        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();
        
        // Filter by account if specified
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }
        
        const templates = Storage.getTemplates();
        
        const statsByType = {};
        
        // Initialize with all templates
        templates.forEach(template => {
            statsByType[template.id] = {
                name: template.name,
                trades: 0,
                wins: 0,
                losses: 0,
                totalPnL: 0,
                avgR: 0
            };
        });
        
        // Add "Unknown" category
        statsByType['unknown'] = {
            name: 'Unknown/No Template',
            trades: 0,
            wins: 0,
            losses: 0,
            totalPnL: 0,
            avgR: 0
        };
        
        // Aggregate stats
        trades.forEach(trade => {
            const templateId = trade.templateId || 'unknown';
            const stat = statsByType[templateId] || statsByType['unknown'];
            
            stat.trades++;
            const pnl = parseFloat(trade.pnl) || 0;
            if (pnl > 0) stat.wins++;
            else if (pnl < 0) stat.losses++;
            stat.totalPnL += pnl;
        });
        
        // Calculate win rates and filter out empty
        return Object.entries(statsByType)
            .map(([id, stat]) => ({
                id,
                ...stat,
                winRate: stat.trades > 0 ? (stat.wins / stat.trades) * 100 : 0
            }))
            .filter(stat => stat.trades > 0)
            .sort((a, b) => b.trades - a.trades);
    },

    calculatePsychCorrelations() {
        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();
        
        // Filter by account if specified
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }
        
        const correlations = [];
        const tradesWithPsychology = trades.filter(t => t.psychology?.preTrade);
        
        if (tradesWithPsychology.length < 5) return correlations;
        
        // Sleep correlation
        const wellRested = tradesWithPsychology.filter(t => parseFloat(t.psychology.preTrade.sleep) >= 7);
        const tired = tradesWithPsychology.filter(t => parseFloat(t.psychology.preTrade.sleep) < 6);
        
        if (wellRested.length >= 3 && tired.length >= 3) {
            correlations.push({
                title: 'Sleep Quality Impact',
                data: [
                    { label: 'Well Rested (7+ hrs)', value: this.getWinRate(wellRested), type: 'percentage' },
                    { label: 'Tired (< 6 hrs)', value: this.getWinRate(tired), type: 'percentage' }
                ]
            });
        }
        
        // Confidence correlation
        const highConfidence = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.confidence) >= 8);
        const lowConfidence = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.confidence) <= 4);
        const mediumConfidence = tradesWithPsychology.filter(t => {
            const c = parseInt(t.psychology.preTrade.confidence);
            return c >= 5 && c <= 7;
        });
        
        if (highConfidence.length >= 3 || lowConfidence.length >= 3) {
            const data = [];
            if (highConfidence.length >= 3) {
                data.push({ label: 'High Confidence (8-10)', value: this.getWinRate(highConfidence), type: 'percentage' });
            }
            if (mediumConfidence.length >= 3) {
                data.push({ label: 'Medium Confidence (5-7)', value: this.getWinRate(mediumConfidence), type: 'percentage' });
            }
            if (lowConfidence.length >= 3) {
                data.push({ label: 'Low Confidence (1-4)', value: this.getWinRate(lowConfidence), type: 'percentage' });
            }
            
            correlations.push({
                title: 'Confidence Level Impact',
                data
            });
        }
        
        // Stress correlation
        const lowStress = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.stress) <= 3);
        const highStress = tradesWithPsychology.filter(t => parseInt(t.psychology.preTrade.stress) >= 7);
        
        if (lowStress.length >= 3 && highStress.length >= 3) {
            correlations.push({
                title: 'Stress Level Impact',
                data: [
                    { label: 'Low Stress (1-3)', value: this.getWinRate(lowStress), type: 'percentage' },
                    { label: 'High Stress (7-10)', value: this.getWinRate(highStress), type: 'percentage' }
                ]
            });
        }
        
        // Mood correlation
        const goodMood = tradesWithPsychology.filter(t => ['excellent', 'good'].includes(t.psychology.preTrade.mood));
        const badMood = tradesWithPsychology.filter(t => ['poor', 'bad'].includes(t.psychology.preTrade.mood));
        
        if (goodMood.length >= 3 && badMood.length >= 3) {
            correlations.push({
                title: 'Mood Impact',
                data: [
                    { label: 'Good Mood', value: this.getWinRate(goodMood), type: 'percentage' },
                    { label: 'Bad Mood', value: this.getWinRate(badMood), type: 'percentage' }
                ]
            });
        }
        
        // Discipline correlation
        const disciplined = trades.filter(t => t.psychology?.postTrade?.discipline === 'yes');
        const undisciplined = trades.filter(t => t.psychology?.postTrade?.discipline === 'no');
        
        if (disciplined.length >= 3 && undisciplined.length >= 3) {
            correlations.push({
                title: 'Discipline Impact',
                data: [
                    { label: 'Followed Plan', value: this.getWinRate(disciplined), type: 'percentage' },
                    { label: 'Deviated from Plan', value: this.getWinRate(undisciplined), type: 'percentage' }
                ]
            });
        }
        
        return correlations;
    },

    getWinRate(trades) {
        if (trades.length === 0) return 0;
        const wins = trades.filter(t => parseFloat(t.pnl) > 0).length;
        return (wins / trades.length) * 100;
    },

    renderKeyMetrics() {
        const accountId = Accounts.getSelectedAccountId();
        const stats = this.getStats(accountId);
        
        // Get opening balance - per account if filtered, else combined
        let openingBalance;
        if (accountId) {
            const account = Accounts.getAccountById(accountId);
            openingBalance = account ? parseFloat(account.openingBalance) || 0 : 0;
        } else {
            // For all accounts, sum all account opening balances
            const accounts = Storage.getAccounts();
            openingBalance = accounts.reduce((sum, a) => sum + (parseFloat(a.openingBalance) || 0), 0);
        }
        
        if (!stats) {
            document.getElementById('stat-total-trades').textContent = '0';
            document.getElementById('stat-win-rate').textContent = '0%';
            document.getElementById('stat-profit-factor').textContent = '0.00';
            document.getElementById('stat-expectancy').textContent = '$0.00';
            document.getElementById('stat-drawdown').textContent = '$0.00';
            document.getElementById('stat-avg-win').textContent = '$0.00';
            document.getElementById('stat-avg-loss').textContent = '$0.00';
            document.getElementById('stat-r-multiple').textContent = '0.00R';
            document.getElementById('stat-opening-balance').textContent = '$' + openingBalance.toFixed(2);
            document.getElementById('stat-current-balance').textContent = '$' + openingBalance.toFixed(2);
            document.getElementById('stat-total-pnl').textContent = '$0.00';
            document.getElementById('stat-return-percent').textContent = '0.00%';
            this.bindOpeningBalanceEdit();
            return;
        }
        
        const currentBalance = openingBalance + stats.totalPnL;
        const returnPercent = openingBalance > 0 ? (stats.totalPnL / openingBalance) * 100 : 0;
        
        document.getElementById('stat-total-trades').textContent = stats.totalTrades;
        document.getElementById('stat-win-rate').textContent = stats.winRate.toFixed(1) + '%';
        document.getElementById('stat-profit-factor').textContent = stats.profitFactor.toFixed(2);
        document.getElementById('stat-expectancy').textContent = '$' + stats.expectancy.toFixed(2);
        document.getElementById('stat-drawdown').textContent = '$' + stats.maxDrawdown.toFixed(2);
        document.getElementById('stat-avg-win').textContent = '$' + stats.avgWin.toFixed(2);
        document.getElementById('stat-avg-loss').textContent = '$' + stats.avgLoss.toFixed(2);
        document.getElementById('stat-r-multiple').textContent = stats.avgRMultiple.toFixed(2) + 'R';
        document.getElementById('stat-opening-balance').textContent = '$' + openingBalance.toFixed(2);
        document.getElementById('stat-current-balance').textContent = '$' + currentBalance.toFixed(2);
        document.getElementById('stat-total-pnl').textContent = '$' + stats.totalPnL.toFixed(2);
        document.getElementById('stat-return-percent').textContent = returnPercent.toFixed(2) + '%';
        
        this.bindOpeningBalanceEdit();
    },

    bindOpeningBalanceEdit() {
        const el = document.getElementById('stat-opening-balance');
        if (!el || el.dataset.bound) return;
        
        el.dataset.bound = 'true';
        
        el.addEventListener('blur', () => {
            const value = el.textContent.replace(/[^0-9.-]/g, '');
            const balance = parseFloat(value) || 0;
            Storage.setOpeningBalance(balance);
            el.textContent = '$' + balance.toFixed(2);
            this.render(); // Re-render to update dependent values
        });
        
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    },

    renderTradeTypeStats() {
        const container = document.getElementById('trade-type-stats');
        if (!container) return;
        
        const stats = this.calculateTradeTypeStats();
        
        if (stats.length === 0) {
            container.innerHTML = '<p class="empty-state">No trade type data available</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="type-stat-row type-stat-header">
                <span>Trade Type</span>
                <span>Trades</span>
                <span>Win Rate</span>
                <span>Total P&L</span>
                <span>Performance</span>
            </div>
            ${stats.map(stat => `
                <div class="type-stat-row">
                    <span>${this.escapeHtml(stat.name)}</span>
                    <span class="type-stat-value">${stat.trades}</span>
                    <span class="type-stat-value">${stat.winRate.toFixed(1)}%</span>
                    <span class="type-stat-value ${stat.totalPnL >= 0 ? 'positive' : 'negative'}">
                        $${stat.totalPnL.toFixed(0)}
                    </span>
                    <span class="type-stat-bar">
                        <div class="type-stat-bar-fill" style="width: ${stat.winRate}%; background: ${stat.winRate >= 50 ? 'var(--success)' : 'var(--danger)'}"></div>
                    </span>
                </div>
            `).join('')}
        `;
    },

    renderPsychCorrelations() {
        const container = document.getElementById('psych-correlations');
        if (!container) return;
        
        const correlations = this.calculatePsychCorrelations();
        
        if (correlations.length === 0) {
            container.innerHTML = '<p class="empty-state">Not enough psychology data for correlations</p>';
            return;
        }
        
        container.innerHTML = correlations.map(corr => `
            <div class="correlation-card">
                <div class="correlation-title">${this.escapeHtml(corr.title)}</div>
                ${corr.data.map(d => `
                    <div class="correlation-row">
                        <span class="correlation-label">${this.escapeHtml(d.label)}</span>
                        <span class="correlation-value ${d.value >= 50 ? 'positive' : 'negative'}">
                            ${d.type === 'percentage' ? d.value.toFixed(1) + '%' : d.value}
                        </span>
                    </div>
                `).join('')}
            </div>
        `).join('');
    },

    renderEquityCurve() {
        const canvas = document.getElementById('equity-chart');
        if (!canvas) return;

        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();

        // Filter by account if specified
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }
        
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const width = rect.width;
        const height = rect.height;
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        
        ctx.clearRect(0, 0, width, height);
        
        if (trades.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No trade data available', width / 2, height / 2);
            return;
        }
        
        // Sort trades by date
        const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate cumulative P&L
        let cumulative = 0;
        const equityPoints = sortedTrades.map(trade => {
            cumulative += parseFloat(trade.pnl) || 0;
            return cumulative;
        });
        
        const minEquity = Math.min(0, ...equityPoints);
        const maxEquity = Math.max(0, ...equityPoints);
        const equityRange = maxEquity - minEquity || 1;
        
        // Draw grid lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding + (i / 5) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }
        
        ctx.setLineDash([]);
        
        // Draw equity curve
        ctx.strokeStyle = equityPoints[equityPoints.length - 1] >= 0 ? '#10b981' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        equityPoints.forEach((point, index) => {
            const x = padding + (index / (equityPoints.length - 1)) * chartWidth;
            const y = padding + chartHeight - ((point - minEquity) / equityRange) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw zero line
        const zeroY = padding + chartHeight - ((0 - minEquity) / equityRange) * chartHeight;
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, zeroY);
        ctx.lineTo(width - padding, zeroY);
        ctx.stroke();
        
        // Y-axis labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 5; i++) {
            const value = minEquity + (equityRange * (1 - i / 5));
            const y = padding + (i / 5) * chartHeight;
            ctx.fillText('$' + value.toFixed(0), padding - 8, y + 4);
        }
        
        // X-axis labels (first and last date)
        ctx.textAlign = 'center';
        ctx.fillText(
            new Date(sortedTrades[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            padding,
            height - 10
        );
        ctx.fillText(
            new Date(sortedTrades[sortedTrades.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            width - padding,
            height - 10
        );
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    calculateTargetStats() {
        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();

        // Filter by account if specified
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }

        // Filter trades that have target, stop, and entry prices set
        const tradesWithTargets = trades.filter(t => {
            const hasTarget = t.target && parseFloat(t.target) > 0;
            const hasStop = t.stop && parseFloat(t.stop) > 0;
            const hasEntry = t.entry && parseFloat(t.entry) > 0;
            const hasExit = t.exit && parseFloat(t.exit) > 0;
            return hasTarget && hasStop && hasEntry && hasExit;
        });

        if (tradesWithTargets.length === 0) {
            return null;
        }

        // Calculate Target Hit Rate
        let targetsHit = 0;
        let targetsMissed = 0;
        
        tradesWithTargets.forEach(trade => {
            const entry = parseFloat(trade.entry);
            const exit = parseFloat(trade.exit);
            const target = parseFloat(trade.target);
            const direction = trade.direction || 'long';
            
            // Determine if target was hit based on direction
            const hit = direction === 'short' 
                ? exit <= target 
                : exit >= target;
            
            if (hit) {
                targetsHit++;
            } else {
                targetsMissed++;
            }
        });

        const targetHitRate = (targetsHit / tradesWithTargets.length) * 100;

        // Calculate R-Multiple Accuracy
        const rAccuracyData = tradesWithTargets.map(trade => {
            const entry = parseFloat(trade.entry);
            const exit = parseFloat(trade.exit);
            const target = parseFloat(trade.target);
            const stop = parseFloat(trade.stop);
            const direction = trade.direction || 'long';
            const pnl = parseFloat(trade.pnl) || 0;
            
            // Calculate planned R (risk:reward based on target vs stop)
            const risk = direction === 'short' 
                ? stop - entry 
                : entry - stop;
            const reward = direction === 'short'
                ? entry - target
                : target - entry;
            const plannedR = risk !== 0 ? reward / Math.abs(risk) : 0;
            
            // Calculate actual R achieved
            const actualR = risk !== 0 ? pnl / Math.abs(risk) : 0;
            
            return {
                plannedR,
                actualR,
                pnl
            };
        }).filter(d => d.plannedR > 0);

        const avgPlannedR = rAccuracyData.length > 0
            ? rAccuracyData.reduce((sum, d) => sum + d.plannedR, 0) / rAccuracyData.length
            : 0;
        const avgActualR = rAccuracyData.length > 0
            ? rAccuracyData.reduce((sum, d) => sum + d.actualR, 0) / rAccuracyData.length
            : 0;

        // Risk:Reward Performance breakdown
        const rrGroups = {
            '1:1': { label: '1:1 or less', min: 0, max: 1, trades: 0, wins: 0, losses: 0, totalPnL: 0 },
            '1:2': { label: '1:1 to 1:2', min: 1, max: 2, trades: 0, wins: 0, losses: 0, totalPnL: 0 },
            '1:3+': { label: '1:3 or higher', min: 2, max: Infinity, trades: 0, wins: 0, losses: 0, totalPnL: 0 }
        };

        rAccuracyData.forEach(data => {
            const group = data.plannedR <= 1 ? '1:1' : data.plannedR <= 2 ? '1:2' : '1:3+';
            rrGroups[group].trades++;
            rrGroups[group].totalPnL += data.pnl;
            if (data.pnl > 0) {
                rrGroups[group].wins++;
            } else if (data.pnl < 0) {
                rrGroups[group].losses++;
            }
        });

        // Calculate win rates for each group
        Object.values(rrGroups).forEach(group => {
            group.winRate = group.trades > 0 ? (group.wins / group.trades) * 100 : 0;
            group.avgPnL = group.trades > 0 ? group.totalPnL / group.trades : 0;
        });

        return {
            tradesWithTargets: tradesWithTargets.length,
            targetsHit,
            targetsMissed,
            targetHitRate,
            avgPlannedR,
            avgActualR,
            rAccuracyData,
            rrGroups
        };
    },

    renderTargetStats() {
        const container = document.getElementById('target-stats');
        if (!container) return;

        const stats = this.calculateTargetStats();

        if (!stats) {
            container.innerHTML = '<p class="empty-state">No target data available. Set targets on your trades to see target-based statistics.</p>';
            return;
        }

        container.innerHTML = `
            <!-- Target Hit Rate -->
            <div class="target-stat-card hit-rate-card">
                <div class="target-stat-header">
                    <h4>🎯 Target Hit Rate</h4>
                    <span class="target-stat-badge">${stats.tradesWithTargets} trades with targets</span>
                </div>
                <div class="hit-rate-display">
                    <div class="hit-rate-circle">
                        <span class="hit-rate-value">${stats.targetHitRate.toFixed(1)}%</span>
                        <span class="hit-rate-label">Hit Rate</span>
                    </div>
                    <div class="hit-rate-breakdown">
                        <div class="hit-rate-item">
                            <span class="hit-rate-dot hit"></span>
                            <span class="hit-rate-text">Targets Hit</span>
                            <span class="hit-rate-count">${stats.targetsHit}</span>
                        </div>
                        <div class="hit-rate-item">
                            <span class="hit-rate-dot miss"></span>
                            <span class="hit-rate-text">Targets Missed</span>
                            <span class="hit-rate-count">${stats.targetsMissed}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- R-Multiple Accuracy -->
            <div class="target-stat-card r-accuracy-card">
                <div class="target-stat-header">
                    <h4>📊 R-Multiple Accuracy</h4>
                </div>
                <div class="r-accuracy-display">
                    <div class="r-comparison">
                        <div class="r-item">
                            <span class="r-label">Planned R (Avg)</span>
                            <span class="r-value">${stats.avgPlannedR.toFixed(2)}R</span>
                        </div>
                        <div class="r-vs">vs</div>
                        <div class="r-item">
                            <span class="r-label">Actual R (Avg)</span>
                            <span class="r-value ${stats.avgActualR >= 0 ? 'positive' : 'negative'}">${stats.avgActualR.toFixed(2)}R</span>
                        </div>
                    </div>
                    <div class="r-accuracy-bar">
                        <div class="r-accuracy-labels">
                            <span>Execution Efficiency</span>
                            <span>${stats.avgPlannedR > 0 ? ((stats.avgActualR / stats.avgPlannedR) * 100).toFixed(0) : 0}%</span>
                        </div>
                        <div class="r-accuracy-track">
                            <div class="r-accuracy-fill" style="width: ${Math.min(100, Math.max(0, stats.avgPlannedR > 0 ? (stats.avgActualR / stats.avgPlannedR) * 100 : 0))}%"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Risk:Reward Performance -->
            <div class="target-stat-card rr-performance-card">
                <div class="target-stat-header">
                    <h4>⚖️ Risk:Reward Performance</h4>
                </div>
                <div class="rr-breakdown">
                    ${Object.entries(stats.rrGroups).map(([key, group]) => `
                        <div class="rr-group ${group.trades > 0 ? 'has-data' : 'no-data'}">
                            <div class="rr-group-header">
                                <span class="rr-group-name">${group.label}</span>
                                <span class="rr-group-count">${group.trades} trades</span>
                            </div>
                            <div class="rr-group-stats">
                                <div class="rr-stat">
                                    <span class="rr-stat-label">Win Rate</span>
                                    <span class="rr-stat-value ${group.winRate >= 50 ? 'positive' : 'negative'}">${group.winRate.toFixed(1)}%</span>
                                </div>
                                <div class="rr-stat">
                                    <span class="rr-stat-label">Avg P&L</span>
                                    <span class="rr-stat-value ${group.avgPnL >= 0 ? 'positive' : 'negative'}">$${group.avgPnL.toFixed(2)}</span>
                                </div>
                                <div class="rr-stat">
                                    <span class="rr-stat-label">Total P&L</span>
                                    <span class="rr-stat-value ${group.totalPnL >= 0 ? 'positive' : 'negative'}">$${group.totalPnL.toFixed(0)}</span>
                                </div>
                            </div>
                            ${group.trades > 0 ? `
                            <div class="rr-bar-container">
                                <div class="rr-bar win-bar" style="width: ${group.winRate}%" title="Win Rate"></div>
                            </div>
                            ` : '<div class="rr-no-data">No trades in this category</div>'}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    calculateMistakesStats() {
        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();

        // Filter by account if specified
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }

        const mistakes = Storage.getMistakes();
        
        if (trades.length === 0 || mistakes.length === 0) {
            return null;
        }

        // Count occurrences of each mistake
        const mistakeStats = {};
        mistakes.forEach(mistake => {
            mistakeStats[mistake.id] = {
                id: mistake.id,
                label: mistake.label,
                color: mistake.color,
                count: 0,
                wins: 0,
                losses: 0,
                breakeven: 0,
                totalPnL: 0
            };
        });

        // Aggregate stats from trades
        trades.forEach(trade => {
            const mistakeIds = trade.psychology?.postTrade?.mistakeIds || [];
            const pnl = parseFloat(trade.pnl) || 0;
            
            mistakeIds.forEach(mistakeId => {
                if (mistakeStats[mistakeId]) {
                    mistakeStats[mistakeId].count++;
                    mistakeStats[mistakeId].totalPnL += pnl;
                    
                    if (pnl > 0) mistakeStats[mistakeId].wins++;
                    else if (pnl < 0) mistakeStats[mistakeId].losses++;
                    else mistakeStats[mistakeId].breakeven++;
                }
            });
        });

        // Convert to array and calculate win rates
        const statsArray = Object.values(mistakeStats)
            .filter(stat => stat.count > 0)
            .map(stat => ({
                ...stat,
                winRate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0,
                avgPnL: stat.count > 0 ? stat.totalPnL / stat.count : 0
            }))
            .sort((a, b) => b.count - a.count);

        return statsArray;
    },

    renderMistakesStats() {
        const container = document.getElementById('mistakes-stats');
        if (!container) return;

        const stats = this.calculateMistakesStats();

        if (!stats || stats.length === 0) {
            container.innerHTML = '<p class="empty-state">No mistake data available. Tag mistakes on your trades to see analysis.</p>';
            return;
        }

        // Calculate overall win rate for comparison (using same filter as calculateMistakesStats)
        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }
        const overallWinRate = this.getWinRate(trades);

        container.innerHTML = `
            <div class="mistakes-summary">
                <div class="mistakes-grid">
                    ${stats.map(stat => {
                        const impactClass = stat.winRate < overallWinRate - 10 ? 'high-negative' : 
                                          stat.winRate < overallWinRate - 5 ? 'negative' :
                                          stat.winRate < overallWinRate ? 'slight-negative' : 'neutral';
                        const impactText = stat.winRate < overallWinRate - 10 ? '🔴 High Impact' : 
                                         stat.winRate < overallWinRate - 5 ? '🟠 Medium Impact' :
                                         stat.winRate < overallWinRate ? '🟡 Slight Impact' : '🟢 Low Impact';
                        
                        return `
                        <div class="mistake-stat-card ${impactClass}">
                            <div class="mistake-stat-header">
                                <span class="mistake-label" style="color: ${stat.color}">${this.escapeHtml(stat.label)}</span>
                                <span class="mistake-count">${stat.count} trades</span>
                            </div>
                            <div class="mistake-stat-body">
                                <div class="mistake-stat-row">
                                    <span class="mistake-stat-label">Win Rate:</span>
                                    <span class="mistake-stat-value ${stat.winRate >= 50 ? 'positive' : 'negative'}">${stat.winRate.toFixed(1)}%</span>
                                </div>
                                <div class="mistake-stat-row">
                                    <span class="mistake-stat-label">Avg P&L:</span>
                                    <span class="mistake-stat-value ${stat.avgPnL >= 0 ? 'positive' : 'negative'}">$${stat.avgPnL.toFixed(2)}</span>
                                </div>
                                <div class="mistake-stat-row">
                                    <span class="mistake-stat-label">Total P&L:</span>
                                    <span class="mistake-stat-value ${stat.totalPnL >= 0 ? 'positive' : 'negative'}">$${stat.totalPnL.toFixed(2)}</span>
                                </div>
                            </div>
                            <div class="mistake-stat-footer">
                                <span class="impact-badge">${impactText}</span>
                                <span class="vs-overall">vs ${overallWinRate.toFixed(1)}% overall</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                <div class="mistakes-legend">
                    <p><strong>Impact Guide:</strong> Compares win rate when this mistake was made vs your overall win rate</p>
                    <div class="legend-items">
                        <span class="legend-item"><span class="dot high-negative"></span> 🔴 High Impact (-10%+ below average)</span>
                        <span class="legend-item"><span class="dot negative"></span> 🟠 Medium Impact (-5-10% below average)</span>
                        <span class="legend-item"><span class="dot slight-negative"></span> 🟡 Slight Impact (-5% below average)</span>
                        <span class="legend-item"><span class="dot neutral"></span> 🟢 Low Impact (at or above average)</span>
                    </div>
                </div>
            </div>
        `;
    },

    calculateProfile4hStats() {
        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();

        // Filter by account if specified
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }

        const templates = Storage.getTemplates();
        
        if (trades.length === 0) {
            return null;
        }

        // Collect all unique 4H Profile items from templates
        const profile4hItems = new Set();
        templates.forEach(template => {
            if (template.profile4h && Array.isArray(template.profile4h)) {
                template.profile4h.forEach(item => profile4hItems.add(item));
            }
        });

        if (profile4hItems.size === 0) {
            return null;
        }

        // Initialize stats for each profile item
        const profileStats = {};
        profile4hItems.forEach(item => {
            profileStats[item] = {
                label: item,
                count: 0,
                wins: 0,
                losses: 0,
                breakeven: 0,
                totalPnL: 0
            };
        });

        // Aggregate stats from trades
        trades.forEach(trade => {
            const profile4h = trade.psychology?.preTrade?.profile4h || [];
            const pnl = parseFloat(trade.pnl) || 0;
            
            profile4h.forEach(item => {
                if (item.checked && profileStats[item.text]) {
                    profileStats[item.text].count++;
                    profileStats[item.text].totalPnL += pnl;
                    
                    if (pnl > 0) profileStats[item.text].wins++;
                    else if (pnl < 0) profileStats[item.text].losses++;
                    else profileStats[item.text].breakeven++;
                }
            });
        });

        // Convert to array and calculate win rates
        const statsArray = Object.values(profileStats)
            .filter(stat => stat.count > 0)
            .map(stat => ({
                ...stat,
                winRate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0,
                avgPnL: stat.count > 0 ? stat.totalPnL / stat.count : 0
            }))
            .sort((a, b) => b.count - a.count);

        return statsArray;
    },

    renderProfile4hStats() {
        const container = document.getElementById('profile4h-stats');
        if (!container) return;

        const stats = this.calculateProfile4hStats();

        if (!stats || stats.length === 0) {
            container.innerHTML = '<p class="empty-state">No 4H Profile data available. Check 4H Profile items on your trades to see analysis.</p>';
            return;
        }

        // Calculate overall win rate for comparison
        const accountId = Accounts.getSelectedAccountId();
        let trades = Storage.getTrades();
        if (accountId) {
            trades = trades.filter(t => t.accountId === accountId);
        }
        const overallWinRate = this.getWinRate(trades);

        container.innerHTML = `
            <div class="mistakes-summary">
                <div class="mistakes-grid">
                    ${stats.map(stat => {
                        const impactClass = stat.winRate > overallWinRate + 10 ? 'neutral' : 
                                          stat.winRate > overallWinRate + 5 ? 'slight-negative' :
                                          stat.winRate > overallWinRate ? 'negative' : 'high-negative';
                        const impactText = stat.winRate > overallWinRate + 10 ? '🟢 Strong Correlation' : 
                                         stat.winRate > overallWinRate + 5 ? '🟡 Good Correlation' :
                                         stat.winRate > overallWinRate ? '🟠 Weak Correlation' : '🔴 Negative Correlation';
                        
                        return `
                        <div class="mistake-stat-card ${impactClass}">
                            <div class="mistake-stat-header">
                                <span class="mistake-label" style="color: var(--primary)">${this.escapeHtml(stat.label)}</span>
                                <span class="mistake-count">${stat.count} trades</span>
                            </div>
                            <div class="mistake-stat-body">
                                <div class="mistake-stat-row">
                                    <span class="mistake-stat-label">Win Rate:</span>
                                    <span class="mistake-stat-value ${stat.winRate >= 50 ? 'positive' : 'negative'}">${stat.winRate.toFixed(1)}%</span>
                                </div>
                                <div class="mistake-stat-row">
                                    <span class="mistake-stat-label">Avg P&L:</span>
                                    <span class="mistake-stat-value ${stat.avgPnL >= 0 ? 'positive' : 'negative'}">$${stat.avgPnL.toFixed(2)}</span>
                                </div>
                                <div class="mistake-stat-row">
                                    <span class="mistake-stat-label">Total P&L:</span>
                                    <span class="mistake-stat-value ${stat.totalPnL >= 0 ? 'positive' : 'negative'}">$${stat.totalPnL.toFixed(2)}</span>
                                </div>
                            </div>
                            <div class="mistake-stat-footer">
                                <span class="impact-badge">${impactText}</span>
                                <span class="vs-overall">vs ${overallWinRate.toFixed(1)}% overall</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                <div class="mistakes-legend">
                    <p><strong>Correlation Guide:</strong> Compares win rate when this 4H Profile item was checked vs your overall win rate</p>
                    <div class="legend-items">
                        <span class="legend-item"><span class="dot neutral"></span> 🟢 Strong Correlation (+10%+ above average)</span>
                        <span class="legend-item"><span class="dot slight-negative"></span> 🟡 Good Correlation (+5-10% above average)</span>
                        <span class="legend-item"><span class="dot negative"></span> 🟠 Weak Correlation (0-5% above average)</span>
                        <span class="legend-item"><span class="dot high-negative"></span> 🔴 Negative Correlation (below average)</span>
                    </div>
                </div>
            </div>
        `;
    }
};
// Storage Module - Handles localStorage operations

const Storage = {
    KEYS: {
        TRADES: 'tj_trades',
        TEMPLATES: 'tj_templates',
        PSYCHOLOGY: 'tj_psychology',
        MISTAKES: 'tj_mistakes',
        ACCOUNTS: 'tj_accounts',
        SETTINGS: 'tj_settings',
        PROFILE4H_ITEMS: 'tj_profile4h_items',
        DRIVERS_ITEMS: 'tj_drivers_items'
    },

    // Initialize with default data if empty
    init() {
        if (!localStorage.getItem(this.KEYS.TEMPLATES)) {
            this.setTemplates(this.getDefaultTemplates());
        }
        if (!localStorage.getItem(this.KEYS.TRADES)) {
            this.setTrades([]);
        }
        if (!localStorage.getItem(this.KEYS.MISTAKES)) {
            this.setMistakes(this.getDefaultMistakes());
        }
        if (!localStorage.getItem(this.KEYS.ACCOUNTS)) {
            this.setAccounts([]);
        }
    },

    // Trades
    getTrades() {
        const data = localStorage.getItem(this.KEYS.TRADES);
        return data ? JSON.parse(data) : [];
    },

    setTrades(trades) {
        localStorage.setItem(this.KEYS.TRADES, JSON.stringify(trades));
    },

    addTrade(trade) {
        const trades = this.getTrades();
        trades.push({ ...trade, id: Date.now().toString() });
        this.setTrades(trades);
        return trades[trades.length - 1];
    },

    updateTrade(id, updates) {
        const trades = this.getTrades();
        const index = trades.findIndex(t => t.id === id);
        if (index !== -1) {
            trades[index] = { ...trades[index], ...updates };
            this.setTrades(trades);
            return trades[index];
        }
        return null;
    },

    deleteTrade(id) {
        const trades = this.getTrades();
        const filtered = trades.filter(t => t.id !== id);
        this.setTrades(filtered);
    },

    // Templates
    getTemplates() {
        const data = localStorage.getItem(this.KEYS.TEMPLATES);
        return data ? JSON.parse(data) : this.getDefaultTemplates();
    },

    setTemplates(templates) {
        localStorage.setItem(this.KEYS.TEMPLATES, JSON.stringify(templates));
    },

    addTemplate(template) {
        const templates = this.getTemplates();
        
        // If setting as default, unset others
        if (template.isDefault) {
            templates.forEach(t => t.isDefault = false);
        }
        
        templates.push({ ...template, id: Date.now().toString() });
        this.setTemplates(templates);
        return templates[templates.length - 1];
    },

    updateTemplate(id, updates) {
        const templates = this.getTemplates();
        
        // If setting as default, unset others
        if (updates.isDefault) {
            templates.forEach(t => t.isDefault = false);
        }
        
        const index = templates.findIndex(t => t.id === id);
        if (index !== -1) {
            templates[index] = { ...templates[index], ...updates };
            this.setTemplates(templates);
            return templates[index];
        }
        return null;
    },

    deleteTemplate(id) {
        const templates = this.getTemplates();
        const filtered = templates.filter(t => t.id !== id);
        this.setTemplates(filtered);
    },

    getDefaultTemplate() {
        const templates = this.getTemplates();
        return templates.find(t => t.isDefault) || templates[0];
    },

    getDefaultTemplates() {
        return [
            {
                id: 'default-fractal',
                name: 'Fractal Model',
                description: 'ICT Fractal Model - C2/C3 setups with CISD and Protected Swings',
                checklist: [
                    'C2 or C3 structure identified',
                    'CISD (Change in State of Delivery) confirmed',
                    'Protected Swing highs/lows marked',
                    'Fair Value Gap (FVG) present',
                    'Order Block (OB) identified',
                    'Risk:Reward minimum 1:2',
                    'Draw on Liquidity (DOL) aligned'
                ],
                profile4h: [
                    'HTF PD Array identified',
                    '4H Structure clear',
                    'Premium/Discount assessed'
                ],
                drivers: [
                    'SMT/Divergence present',
                    'Economic driver active',
                    'Killzone aligned'
                ],
                isDefault: true
            },
            {
                id: 'template-c3-long',
                name: 'C3 Long',
                description: 'Classic C3 long setup with optimal entry',
                checklist: [
                    'C3 structure confirmed bullish',
                    'Price at discount array',
                    'FVG bullish aligned',
                    'Stop below protected low',
                    'Target at opposing PD Array'
                ],
                profile4h: [],
                drivers: [],
                isDefault: false
            },
            {
                id: 'template-c3-short',
                name: 'C3 Short',
                description: 'Classic C3 short setup with optimal entry',
                checklist: [
                    'C3 structure confirmed bearish',
                    'Price at premium array',
                    'FVG bearish aligned',
                    'Stop above protected high',
                    'Target at opposing PD Array'
                ],
                profile4h: [],
                drivers: [],
                isDefault: false
            },
            {
                id: 'template-breakout',
                name: 'Breakout',
                description: 'High-probability breakout setup',
                checklist: [
                    'Clear resistance/support level',
                    'Volume confirmation',
                    'Consolidation before breakout',
                    'Retest of breakout level',
                    'Momentum indicator aligned'
                ],
                profile4h: [],
                drivers: [],
                isDefault: false
            }
        ];
    },

    // Settings
    getSettings() {
        const data = localStorage.getItem(this.KEYS.SETTINGS);
        return data ? JSON.parse(data) : { openingBalance: 0 };
    },

    setSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },

    getOpeningBalance() {
        return this.getSettings().openingBalance || 0;
    },

    setOpeningBalance(balance) {
        const settings = this.getSettings();
        settings.openingBalance = parseFloat(balance) || 0;
        this.setSettings(settings);
    },

    // Accounts
    getAccounts() {
        const data = localStorage.getItem(this.KEYS.ACCOUNTS);
        return data ? JSON.parse(data) : [];
    },

    setAccounts(accounts) {
        localStorage.setItem(this.KEYS.ACCOUNTS, JSON.stringify(accounts));
    },

    addAccount(account) {
        const accounts = this.getAccounts();
        
        // If setting as default, unset others
        if (account.isDefault) {
            accounts.forEach(a => a.isDefault = false);
        }
        
        accounts.push({ ...account, id: Date.now().toString() });
        this.setAccounts(accounts);
        return accounts[accounts.length - 1];
    },

    updateAccount(id, updates) {
        const accounts = this.getAccounts();
        
        // If setting as default, unset others
        if (updates.isDefault) {
            accounts.forEach(a => a.isDefault = false);
        }
        
        const index = accounts.findIndex(a => a.id === id);
        if (index !== -1) {
            accounts[index] = { ...accounts[index], ...updates };
            this.setAccounts(accounts);
            return accounts[index];
        }
        return null;
    },

    deleteAccount(id) {
        const accounts = this.getAccounts();
        const filtered = accounts.filter(a => a.id !== id);
        this.setAccounts(filtered);
    },

    getDefaultAccount() {
        const accounts = this.getAccounts();
        return accounts.find(a => a.isDefault) || accounts[0] || null;
    },

    // Clear all data
    clear() {
        localStorage.removeItem(this.KEYS.TRADES);
        localStorage.removeItem(this.KEYS.TEMPLATES);
        localStorage.removeItem(this.KEYS.PSYCHOLOGY);
        localStorage.removeItem(this.KEYS.MISTAKES);
        localStorage.removeItem(this.KEYS.ACCOUNTS);
        localStorage.removeItem(this.KEYS.SETTINGS);
        localStorage.removeItem(this.KEYS.PROFILE4H_ITEMS);
        localStorage.removeItem(this.KEYS.DRIVERS_ITEMS);
    },

    // Mistakes
    getMistakes() {
        const data = localStorage.getItem(this.KEYS.MISTAKES);
        return data ? JSON.parse(data) : this.getDefaultMistakes();
    },

    setMistakes(mistakes) {
        localStorage.setItem(this.KEYS.MISTAKES, JSON.stringify(mistakes));
    },

    addMistake(mistake) {
        const mistakes = this.getMistakes();
        mistakes.push({ ...mistake, id: Date.now().toString() });
        this.setMistakes(mistakes);
        return mistakes[mistakes.length - 1];
    },

    updateMistake(id, updates) {
        const mistakes = this.getMistakes();
        const index = mistakes.findIndex(m => m.id === id);
        if (index !== -1) {
            mistakes[index] = { ...mistakes[index], ...updates };
            this.setMistakes(mistakes);
            return mistakes[index];
        }
        return null;
    },

    deleteMistake(id) {
        const mistakes = this.getMistakes();
        const filtered = mistakes.filter(m => m.id !== id);
        this.setMistakes(filtered);
    },

    getDefaultMistakes() {
        return [
            { id: 'mistake-1', label: 'Entered too early', color: '#ef4444' },
            { id: 'mistake-2', label: 'No FVG present', color: '#f97316' },
            { id: 'mistake-3', label: 'Wrong DOL', color: '#f59e0b' },
            { id: 'mistake-4', label: 'Ignored CISD', color: '#eab308' },
            { id: 'mistake-5', label: 'Poor risk management', color: '#ef4444' },
            { id: 'mistake-6', label: 'Emotional trade', color: '#ec4899' },
            { id: 'mistake-7', label: 'No HTF confluence', color: '#8b5cf6' },
            { id: 'mistake-8', label: 'Stop too tight', color: '#06b6d4' }
        ];
    },

    // Export/Import
    exportData() {
        return {
            trades: this.getTrades(),
            templates: this.getTemplates(),
            mistakes: this.getMistakes(),
            accounts: this.getAccounts(),
            settings: this.getSettings(),
            profile4hItems: this.getProfile4hItems(),
            driversItems: this.getDriversItems(),
            exportedAt: new Date().toISOString()
        };
    },

    importData(data) {
        if (data.trades) this.setTrades(data.trades);
        if (data.templates) this.setTemplates(data.templates);
        if (data.mistakes) this.setMistakes(data.mistakes);
        if (data.accounts) this.setAccounts(data.accounts);
        if (data.settings) this.setSettings(data.settings);
        if (data.profile4hItems) this.setProfile4hItems(data.profile4hItems);
        if (data.driversItems) this.setDriversItems(data.driversItems);
    },

    // 4H Profile Checklist Items
    getProfile4hItems() {
        const data = localStorage.getItem(this.KEYS.PROFILE4H_ITEMS);
        return data ? JSON.parse(data) : [];
    },

    setProfile4hItems(items) {
        localStorage.setItem(this.KEYS.PROFILE4H_ITEMS, JSON.stringify(items));
    },

    // Drivers Checklist Items
    getDriversItems() {
        const data = localStorage.getItem(this.KEYS.DRIVERS_ITEMS);
        return data ? JSON.parse(data) : [];
    },

    setDriversItems(items) {
        localStorage.setItem(this.KEYS.DRIVERS_ITEMS, JSON.stringify(items));
    }
};
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
// Accounts Module - Handles trading account management

const Accounts = {
    accounts: [],
    selectedAccountId: null,

    init() {
        this.loadAccounts();
        this.bindEvents();
        this.renderAccountSelector();
        this.renderAccountFilter();
    },

    bindEvents() {
        // Manage accounts button
        document.getElementById('manage-accounts-btn')?.addEventListener('click', () => {
            this.openModal();
        });

        // Close accounts modal
        document.getElementById('close-accounts-modal')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancel-accounts')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Save accounts changes
        document.getElementById('save-accounts')?.addEventListener('click', () => {
            this.saveAccounts();
        });

        // Add new account item
        document.getElementById('add-account-item')?.addEventListener('click', () => {
            this.addNewAccountItem();
        });

        // Set default account
        document.getElementById('accounts-list')?.addEventListener('change', (e) => {
            if (e.target.classList.contains('account-default')) {
                // Uncheck all other default checkboxes
                document.querySelectorAll('.account-default').forEach(cb => {
                    if (cb !== e.target) cb.checked = false;
                });
            }
        });

        // Delete account item (delegated in modal)
        document.getElementById('accounts-list')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-account')) {
                e.target.closest('.account-list-item').remove();
            }
        });

        // Account filter change in statistics
        document.getElementById('account-filter')?.addEventListener('change', (e) => {
            this.selectedAccountId = e.target.value || null;
            Statistics.render();
        });

        // Enter key to add account
        document.getElementById('new-account-name')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addNewAccountItem();
            }
        });
    },

    loadAccounts() {
        this.accounts = Storage.getAccounts();
    },

    getAccounts() {
        return this.accounts;
    },

    getAccountById(id) {
        return this.accounts.find(a => a.id === id);
    },

    getDefaultAccount() {
        return this.accounts.find(a => a.isDefault) || this.accounts[0] || null;
    },

    getDefaultAccountId() {
        const defaultAccount = this.getDefaultAccount();
        return defaultAccount ? defaultAccount.id : null;
    },

    openModal() {
        const modal = document.getElementById('accounts-modal');
        this.loadAccounts();
        this.renderAccountsList();
        modal.classList.add('active');
    },

    closeModal() {
        document.getElementById('accounts-modal').classList.remove('active');
    },

    renderAccountsList() {
        const container = document.getElementById('accounts-list');
        if (!container) return;

        if (this.accounts.length === 0) {
            container.innerHTML = '<p class="empty-state">No accounts defined yet</p>';
            return;
        }

        container.innerHTML = this.accounts.map((account, index) => `
            <div class="account-list-item" data-id="${account.id}" data-index="${index}">
                <input type="text" class="form-input account-name" value="${this.escapeHtml(account.name)}" placeholder="Account name (e.g., 'Prop Firm A')">
                <input type="number" class="form-input account-balance" value="${account.openingBalance}" placeholder="Opening balance" step="0.01">
                <label class="checkbox-label account-default-label">
                    <input type="checkbox" class="account-default" ${account.isDefault ? 'checked' : ''}>
                    Default
                </label>
                <button type="button" class="btn btn-small btn-danger remove-account">×</button>
            </div>
        `).join('');
    },

    renderAccountSelector() {
        const select = document.getElementById('trade-account');
        if (!select) return;

        this.loadAccounts();

        if (this.accounts.length === 0) {
            select.innerHTML = '<option value="">No accounts available</option>';
            return;
        }

        const defaultAccount = this.getDefaultAccount();
        select.innerHTML = this.accounts.map(a => 
            `<option value="${a.id}" ${a.id === defaultAccount?.id ? 'selected' : ''}>${this.escapeHtml(a.name)} ($${parseFloat(a.openingBalance).toFixed(2)})</option>`
        ).join('');
    },

    renderAccountFilter() {
        const select = document.getElementById('account-filter');
        if (!select) return;

        this.loadAccounts();

        const currentSelection = select.value;

        let html = '<option value="">All Accounts</option>';
        html += this.accounts.map(a => 
            `<option value="${a.id}">${this.escapeHtml(a.name)}</option>`
        ).join('');

        select.innerHTML = html;

        // Restore selection if still valid
        if (currentSelection && this.accounts.find(a => a.id === currentSelection)) {
            select.value = currentSelection;
        }
    },

    addNewAccountItem() {
        const nameInput = document.getElementById('new-account-name');
        const balanceInput = document.getElementById('new-account-balance');
        
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter an account name');
            return;
        }

        const balance = parseFloat(balanceInput.value) || 0;
        const isFirstAccount = this.accounts.length === 0 && document.querySelectorAll('.account-list-item').length === 0;

        const container = document.getElementById('accounts-list');
        const div = document.createElement('div');
        div.className = 'account-list-item';
        div.innerHTML = `
            <input type="text" class="form-input account-name" value="${this.escapeHtml(name)}" placeholder="Account name">
            <input type="number" class="form-input account-balance" value="${balance}" placeholder="Opening balance" step="0.01">
            <label class="checkbox-label account-default-label">
                <input type="checkbox" class="account-default" ${isFirstAccount ? 'checked' : ''}>
                Default
            </label>
            <button type="button" class="btn btn-small btn-danger remove-account">×</button>
        `;
        container.appendChild(div);

        // Clear inputs
        nameInput.value = '';
        balanceInput.value = '';
    },

    saveAccounts() {
        const newAccounts = [];
        let defaultSet = false;

        document.querySelectorAll('.account-list-item').forEach(item => {
            const name = item.querySelector('.account-name').value.trim();
            const openingBalance = parseFloat(item.querySelector('.account-balance').value) || 0;
            const isDefault = item.querySelector('.account-default').checked;
            const id = item.dataset.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            if (name) {
                // Only one account can be default
                const accountDefault = isDefault && !defaultSet;
                if (accountDefault) defaultSet = true;

                newAccounts.push({ id, name, openingBalance, isDefault: accountDefault });
            }
        });

        // If no default set but we have accounts, make the first one default
        if (!defaultSet && newAccounts.length > 0) {
            newAccounts[0].isDefault = true;
        }

        this.accounts = newAccounts;
        Storage.setAccounts(newAccounts);
        
        // Update selectors
        this.renderAccountSelector();
        this.renderAccountFilter();
        
        this.closeModal();
        
        // Refresh statistics if on stats view
        if (typeof Statistics !== 'undefined') {
            Statistics.render();
        }
    },

    getSelectedAccountId() {
        return this.selectedAccountId;
    },

    setAccountSelectorValue(accountId) {
        const select = document.getElementById('trade-account');
        if (select && accountId) {
            select.value = accountId;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};/**
 * Trading Journal - Main Application
 * Handles UI interactions and form management
 */

// Navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Refresh data if needed
    if (sectionId === 'dashboard') {
        updateDashboard();
    } else if (sectionId === 'history') {
        updateTradeHistory();
    }
}

// Set today's date as default
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0, 5);
    
    const dateInput = document.getElementById('trade-date');
    const timeInput = document.getElementById('trade-time');
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = now;
    
    // Initialize dashboard
    updateDashboard();
    
    // Setup form listeners
    setupFormListeners();
    
    // Setup filter listeners
    setupFilterListeners();
});

// Calculate P&L automatically
function calculatePnL() {
    const entryPrice = parseFloat(document.getElementById('entry-price').value);
    const exitPrice = parseFloat(document.getElementById('exit-price').value);
    const positionSize = parseFloat(document.getElementById('position-size').value);
    const direction = document.getElementById('direction').value;
    
    if (entryPrice && exitPrice && positionSize) {
        let pnl = 0;
        if (direction === 'long') {
            pnl = (exitPrice - entryPrice) * positionSize;
        } else if (direction === 'short') {
            pnl = (entryPrice - exitPrice) * positionSize;
        }
        
        const pnlInput = document.getElementById('trade-pnl');
        pnlInput.value = `£${pnl.toFixed(2)}`;
        
        // Auto-set result based on P&L
        const resultSelect = document.getElementById('result');
        if (pnl > 0) {
            resultSelect.value = 'win';
        } else if (pnl < 0) {
            resultSelect.value = 'loss';
        } else {
            resultSelect.value = 'breakeven';
        }
    }
}

// Setup form listeners
function setupFormListeners() {
    // Auto-calculate P&L when prices change
    ['entry-price', 'exit-price', 'position-size', 'direction'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', calculatePnL);
            element.addEventListener('input', calculatePnL);
        }
    });
    
    // Handle form submission
    const form = document.getElementById('trade-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // Handle screenshot previews
    setupScreenshotPreviews();
}

// Setup screenshot preview
function setupScreenshotPreviews() {
    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById(`screenshot-${i}`);
        if (input) {
            input.addEventListener('change', function(e) {
                handleFileSelect(e, i);
            });
        }
    }
}

// Handle file selection
function handleFileSelect(event, index) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Store base64 image
            const previewDiv = document.getElementById('screenshot-preview');
            
            // Remove existing preview for this index if exists
            const existing = previewDiv.querySelector(`[data-index="${index}"]`);
            if (existing) existing.remove();
            
            // Add new preview
            const img = document.createElement('img');
            img.src = e.target.result;
            img.dataset.index = index;
            img.style.maxWidth = '200px';
            img.style.cursor = 'pointer';
            img.title = 'Click to remove';
            img.onclick = () => {
                img.remove();
                document.getElementById(`screenshot-${index}`).value = '';
            };
            
            previewDiv.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    // Collect form data
    const trade = {
        date: document.getElementById('trade-date').value,
        time: document.getElementById('trade-time').value,
        symbol: document.getElementById('symbol').value,
        direction: document.getElementById('direction').value,
        entryPrice: document.getElementById('entry-price').value,
        exitPrice: document.getElementById('exit-price').value,
        stopLoss: document.getElementById('stop-loss').value,
        takeProfit: document.getElementById('take-profit').value,
        positionSize: document.getElementById('position-size').value,
        pnl: document.getElementById('trade-pnl').value.replace('£', '').trim(),
        setupType: document.getElementById('setup-type').value,
        entryTimeframe: document.getElementById('entry-timeframe').value,
        session: document.getElementById('session').value,
        cisdConfirmed: document.getElementById('cisd-confirmed').value,
        profileType: document.getElementById('profile-type').value,
        result: document.getElementById('result').value,
        preEmotion: document.getElementById('pre-emotion').value,
        mistakes: document.getElementById('mistakes').value,
        lessons: document.getElementById('lessons').value,
        notes: document.getElementById('notes').value,
        screenshots: collectScreenshots()
    };
    
    // Save trade
    Storage.saveTrade(trade);
    
    // Show success message
    alert('Trade saved successfully!');
    
    // Reset form
    e.target.reset();
    
    // Reset date/time to now
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0, 5);
    document.getElementById('trade-date').value = today;
    document.getElementById('trade-time').value = now;
    
    // Clear screenshots
    document.getElementById('screenshot-preview').innerHTML = '';
    
    // Clear P&L display
    document.getElementById('trade-pnl').value = '';
}

// Collect screenshots
function collectScreenshots() {
    const screenshots = [];
    const previewDiv = document.getElementById('screenshot-preview');
    const images = previewDiv.querySelectorAll('img');
    
    images.forEach(img => {
        screenshots.push(img.src);
    });
    
    return screenshots;
}

// Update dashboard
function updateDashboard() {
    const stats = Storage.getStatistics();
    
    // Update stat cards
    document.getElementById('total-trades').textContent = stats.totalTrades;
    document.getElementById('win-rate').textContent = stats.winRate + '%';
    document.getElementById('total-pnl').textContent = '£' + stats.totalPnL;
    document.getElementById('avg-rr').textContent = stats.avgRR;
    
    // Update recent trades
    updateRecentTrades();
    
    // Update charts
    updateCharts();
}

// Update recent trades list
function updateRecentTrades() {
    const trades = Storage.getTrades();
    const recent = trades.slice(-5).reverse(); // Last 5 trades
    
    const container = document.getElementById('recent-trades-list');
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No trades yet. Add your first trade! 🌊</p>';
        return;
    }
    
    container.innerHTML = recent.map(trade => createTradeCard(trade)).join('');
}

// Create trade card HTML
function createTradeCard(trade) {
    const pnlClass = trade.result === 'win' ? 'win' : (trade.result === 'loss' ? 'loss' : '');
    const resultClass = `trade-${trade.result}`;
    
    return `
        <div class="trade-card ${resultClass}">
            <div class="trade-symbol">${trade.symbol}</div>
            <div class="trade-details">
                ${trade.direction.toUpperCase()} | ${trade.setupType} | ${trade.date}
            </div>
            <div class="trade-pnl ${pnlClass}">
                £${parseFloat(trade.pnl).toFixed(2)}
            </div>
        </div>
    `;
}

// Setup filter listeners
function setupFilterListeners() {
    ['filter-symbol', 'filter-result', 'filter-setup'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', updateTradeHistory);
        }
    });
}

// Update trade history
function updateTradeHistory() {
    const filters = {
        symbol: document.getElementById('filter-symbol').value,
        result: document.getElementById('filter-result').value,
        setup: document.getElementById('filter-setup').value
    };
    
    const trades = Storage.getFilteredTrades(filters);
    const container = document.getElementById('trades-list');
    
    if (trades.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">No trades match your filters.</p>';
        return;
    }
    
    container.innerHTML = trades.map(trade => createTradeCard(trade)).join('');
}

// Export trades to CSV
function exportTrades() {
    const csv = Storage.exportToCSV();
    if (!csv) {
        alert('No trades to export!');
        return;
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Update charts
function updateCharts() {
    // This will be implemented in charts.js
    if (typeof ChartModule !== 'undefined') {
        ChartModule.updateEquityCurve();
        ChartModule.updateSetupChart();
    }
}
/**
 * Trading Journal - Charts Module
 * Handles data visualization using Chart.js
 */

const ChartModule = {
    equityChart: null,
    setupChart: null,

    // Initialize charts
    init() {
        this.updateEquityCurve();
        this.updateSetupChart();
    },

    // Update equity curve chart
    updateEquityCurve() {
        const data = Storage.getEquityCurve();
        const ctx = document.getElementById('equity-curve');
        
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.equityChart) {
            this.equityChart.destroy();
        }
        
        if (data.length === 0) {
            ctx.parentElement.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Add trades to see your equity curve! 📈</p>';
            return;
        }
        
        this.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Cumulative P&L (£)',
                    data: data.map(d => d.pnl),
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#c9d1d9'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#8b949e'
                        },
                        grid: {
                            color: '#30363d'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#8b949e'
                        },
                        grid: {
                            color: '#30363d'
                        }
                    }
                }
            }
        });
    },

    // Update setup type performance chart
    updateSetupChart() {
        const stats = Storage.getSetupStats();
        const ctx = document.getElementById('setup-chart');
        
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.setupChart) {
            this.setupChart.destroy();
        }
        
        const setups = Object.keys(stats);
        
        if (setups.length === 0) {
            ctx.parentElement.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Add trades to see setup performance! 🎯</p>';
            return;
        }
        
        this.setupChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: setups,
                datasets: [
                    {
                        label: 'Wins',
                        data: setups.map(s => stats[s].wins),
                        backgroundColor: '#2ea043'
                    },
                    {
                        label: 'Losses',
                        data: setups.map(s => stats[s].losses),
                        backgroundColor: '#f85149'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#c9d1d9'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#8b949e'
                        },
                        grid: {
                            color: '#30363d'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#8b949e'
                        },
                        grid: {
                            color: '#30363d'
                        }
                    }
                }
            }
        });
    },

    // Create win/loss pie chart (for future use)
    createWinLossChart(elementId) {
        const stats = Storage.getStatistics();
        const ctx = document.getElementById(elementId);
        
        if (!ctx || stats.totalTrades === 0) return;
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Wins', 'Losses', 'Breakeven'],
                datasets: [{
                    data: [stats.wins, stats.losses, stats.breakeven],
                    backgroundColor: ['#2ea043', '#f85149', '#d29922']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#c9d1d9'
                        }
                    }
                }
            }
        });
    },

    // Create R:R distribution chart (for future use)
    createRRDistributionChart(elementId) {
        const trades = Storage.getTrades();
        const ctx = document.getElementById(elementId);
        
        if (!ctx || trades.length === 0) return;
        
        // Calculate R:R for each trade
        const rrData = trades.map(t => {
            const entry = parseFloat(t.entryPrice);
            const exit = parseFloat(t.exitPrice);
            const stop = parseFloat(t.stopLoss);
            
            if (!entry || !stop) return 0;
            
            const risk = Math.abs(entry - stop);
            const reward = Math.abs(exit - entry);
            
            return risk > 0 ? reward / risk : 0;
        });
        
        // Bin the data
        const bins = {
            '0-0.5': 0,
            '0.5-1': 0,
            '1-1.5': 0,
            '1.5-2': 0,
            '2-3': 0,
            '3+': 0
        };
        
        rrData.forEach(rr => {
            if (rr < 0.5) bins['0-0.5']++;
            else if (rr < 1) bins['0.5-1']++;
            else if (rr < 1.5) bins['1-1.5']++;
            else if (rr < 2) bins['1.5-2']++;
            else if (rr < 3) bins['2-3']++;
            else bins['3+']++;
        });
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(bins),
                datasets: [{
                    label: 'Number of Trades',
                    data: Object.values(bins),
                    backgroundColor: '#58a6ff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Risk:Reward Distribution',
                        color: '#c9d1d9'
                    },
                    legend: {
                        labels: {
                            color: '#c9d1d9'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#8b949e' },
                        grid: { color: '#30363d' }
                    },
                    y: {
                        ticks: { color: '#8b949e' },
                        grid: { color: '#30363d' }
                    }
                }
            }
        });
    }
};

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Storage to initialize
    setTimeout(() => {
        ChartModule.init();
    }, 100);
});

// Demo Auto-Reset
(function() {
    const RESET_INTERVAL = 60 * 60 * 1000;
    const LAST_RESET_KEY = "edge_demo_last_reset";
    
    const now = Date.now();
    const lastReset = parseInt(localStorage.getItem(LAST_RESET_KEY) || "0");
    
    if (!lastReset || (now - lastReset > RESET_INTERVAL)) {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("tradingJournal") || key.startsWith("tj_") || key.startsWith("edge_"))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        localStorage.setItem(LAST_RESET_KEY, now.toString());
        console.log("EDGE demo: Auto-reset performed");
    }
    
    function updateTimer() {
        const timerEl = document.getElementById("demoResetTimer");
        if (!timerEl) return;
        const currentReset = parseInt(localStorage.getItem(LAST_RESET_KEY) || Date.now().toString());
        const nextReset = currentReset + RESET_INTERVAL;
        const remaining = nextReset - Date.now();
        if (remaining <= 0) { location.reload(); return; }
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = `Resets in ${mins}m ${secs.toString().padStart(2, "0")}s`;
    }
    updateTimer();
    setInterval(updateTimer, 1000);
})();
