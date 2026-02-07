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
