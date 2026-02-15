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
