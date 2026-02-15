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
