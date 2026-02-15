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
