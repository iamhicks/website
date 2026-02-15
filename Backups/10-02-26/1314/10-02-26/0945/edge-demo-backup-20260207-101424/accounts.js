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
};