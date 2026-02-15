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
