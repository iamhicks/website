/**
 * Trading Journal - Storage Module
 * Handles local data persistence and management
 */

const Storage = {
    // Initialize storage
    init() {
        if (!localStorage.getItem('trades')) {
            localStorage.setItem('trades', JSON.stringify([]));
        }
        if (!localStorage.getItem('journal-config')) {
            localStorage.setItem('journal-config', JSON.stringify({
                currency: 'GBP',
                riskPerTrade: 1.0,
                targetRR: 2.0
            }));
        }
    },

    // Get all trades
    getTrades() {
        const trades = localStorage.getItem('trades');
        return trades ? JSON.parse(trades) : [];
    },

    // Save a trade
    saveTrade(trade) {
        const trades = this.getTrades();
        trade.id = Date.now().toString();
        trade.createdAt = new Date().toISOString();
        trades.push(trade);
        localStorage.setItem('trades', JSON.stringify(trades));
        return trade;
    },

    // Delete a trade
    deleteTrade(id) {
        let trades = this.getTrades();
        trades = trades.filter(t => t.id !== id);
        localStorage.setItem('trades', JSON.stringify(trades));
    },

    // Get trade by ID
    getTrade(id) {
        const trades = this.getTrades();
        return trades.find(t => t.id === id);
    },

    // Update trade
    updateTrade(id, updates) {
        const trades = this.getTrades();
        const index = trades.findIndex(t => t.id === id);
        if (index !== -1) {
            trades[index] = { ...trades[index], ...updates };
            localStorage.setItem('trades', JSON.stringify(trades));
            return trades[index];
        }
        return null;
    },

    // Get filtered trades
    getFilteredTrades(filters = {}) {
        let trades = this.getTrades();
        
        if (filters.symbol) {
            trades = trades.filter(t => t.symbol === filters.symbol);
        }
        if (filters.result) {
            trades = trades.filter(t => t.result === filters.result);
        }
        if (filters.setup) {
            trades = trades.filter(t => t.setupType === filters.setup);
        }
        if (filters.direction) {
            trades = trades.filter(t => t.direction === filters.direction);
        }
        
        // Sort by date (newest first)
        return trades.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    // Calculate statistics
    getStatistics() {
        const trades = this.getTrades();
        
        if (trades.length === 0) {
            return {
                totalTrades: 0,
                wins: 0,
                losses: 0,
                breakeven: 0,
                winRate: 0,
                totalPnL: 0,
                avgRR: 0,
                bestTrade: null,
                worstTrade: null
            };
        }

        const wins = trades.filter(t => t.result === 'win');
        const losses = trades.filter(t => t.result === 'loss');
        const breakeven = trades.filter(t => t.result === 'breakeven');
        
        const totalPnL = trades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
        
        // Calculate R:R for each trade
        const tradesWithRR = trades.map(t => {
            const entry = parseFloat(t.entryPrice);
            const exit = parseFloat(t.exitPrice);
            const stop = parseFloat(t.stopLoss);
            const target = parseFloat(t.takeProfit);
            
            if (!entry || !stop) return { ...t, rr: 0 };
            
            const risk = Math.abs(entry - stop);
            const reward = Math.abs(exit - entry);
            
            return { ...t, rr: risk > 0 ? reward / risk : 0 };
        });
        
        const avgRR = tradesWithRR.reduce((sum, t) => sum + t.rr, 0) / trades.length;
        
        // Sort by P&L for best/worst
        const sortedByPnL = [...trades].sort((a, b) => parseFloat(b.pnl) - parseFloat(a.pnl));
        
        return {
            totalTrades: trades.length,
            wins: wins.length,
            losses: losses.length,
            breakeven: breakeven.length,
            winRate: ((wins.length / trades.length) * 100).toFixed(1),
            totalPnL: totalPnL.toFixed(2),
            avgRR: avgRR.toFixed(2),
            bestTrade: sortedByPnL[0],
            worstTrade: sortedByPnL[sortedByPnL.length - 1]
        };
    },

    // Get setup type statistics
    getSetupStats() {
        const trades = this.getTrades();
        const stats = {};
        
        trades.forEach(trade => {
            const setup = trade.setupType || 'Unknown';
            if (!stats[setup]) {
                stats[setup] = { total: 0, wins: 0, losses: 0 };
            }
            stats[setup].total++;
            if (trade.result === 'win') stats[setup].wins++;
            if (trade.result === 'loss') stats[setup].losses++;
        });
        
        // Calculate win rates
        Object.keys(stats).forEach(setup => {
            stats[setup].winRate = ((stats[setup].wins / stats[setup].total) * 100).toFixed(1);
        });
        
        return stats;
    },

    // Get equity curve data
    getEquityCurve() {
        const trades = this.getTrades();
        if (trades.length === 0) return [];
        
        // Sort by date
        const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let runningPnL = 0;
        return sorted.map(trade => {
            runningPnL += parseFloat(trade.pnl) || 0;
            return {
                date: trade.date,
                pnl: runningPnL.toFixed(2)
            };
        });
    },

    // Export to CSV
    exportToCSV() {
        const trades = this.getTrades();
        if (trades.length === 0) return null;
        
        const headers = [
            'Date', 'Time', 'Symbol', 'Direction', 'Entry Price', 'Exit Price',
            'Stop Loss', 'Take Profit', 'Position Size', 'P&L', 'Setup Type',
            'Entry Timeframe', 'Session', 'CISD Confirmed', '4H Profile',
            'Result', 'Pre-Trade Emotion', 'Mistakes', 'Lessons', 'Notes'
        ];
        
        const rows = trades.map(t => [
            t.date, t.time, t.symbol, t.direction, t.entryPrice, t.exitPrice,
            t.stopLoss, t.takeProfit, t.positionSize, t.pnl, t.setupType,
            t.entryTimeframe, t.session, t.cisdConfirmed, t.profileType,
            t.result, t.preEmotion, t.mistakes, t.lessons, t.notes
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
        ].join('\n');
        
        return csvContent;
    },

    // Import from CSV (basic implementation)
    importFromCSV(csvContent) {
        // This would parse CSV and add trades
        // Implementation depends on CSV format
        console.log('Import not yet implemented');
    },

    // Get config
    getConfig() {
        const config = localStorage.getItem('journal-config');
        return config ? JSON.parse(config) : { currency: 'GBP', riskPerTrade: 1.0 };
    },

    // Save config
    saveConfig(config) {
        localStorage.setItem('journal-config', JSON.stringify(config));
    },

    // Clear all data (use with caution!)
    clearAll() {
        if (confirm('Are you sure? This will delete ALL trades!')) {
            localStorage.removeItem('trades');
            this.init();
        }
    }
};

// Initialize on load
Storage.init();
