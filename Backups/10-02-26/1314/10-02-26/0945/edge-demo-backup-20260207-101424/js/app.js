/**
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
