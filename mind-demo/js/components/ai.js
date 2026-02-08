// ==================== AI COMPONENT ====================

const AI = {
    init(kb) {
        this.kb = kb;
        this.setupEventListeners();
    },

    setupEventListeners() {
        const aiBtn = document.getElementById('aiAssistBtn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => this.showAiPanel());
        }

        const acceptBtn = document.getElementById('acceptAiSuggestion');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptSuggestion());
        }

        const discardBtn = document.getElementById('discardAiSuggestion');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => this.hideAiPanel());
        }
    },

    async showAiPanel() {
        const panel = document.getElementById('aiSuggestionPanel');
        const content = document.getElementById('aiSuggestionText');
        const loading = document.getElementById('aiLoadingState');

        if (!panel || !content || !loading) return;

        DOM.show(panel);
        DOM.hide(content.parentElement);
        DOM.show(loading);

        try {
            const suggestion = await this.generateSuggestion();
            content.textContent = suggestion;
            DOM.hide(loading);
            DOM.show(content.parentElement);
        } catch (err) {
            content.textContent = 'AI assistance unavailable. Please try again later.';
            DOM.hide(loading);
            DOM.show(content.parentElement);
        }
    },

    hideAiPanel() {
        const panel = document.getElementById('aiSuggestionPanel');
        if (panel) DOM.hide(panel);
    },

    async generateSuggestion() {
        const currentNote = this.kb.currentNote;
        if (!currentNote) return 'No note selected.';

        const noteContent = Helpers.stripHtml(currentNote.content);
        const noteTitle = currentNote.title;

        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simple suggestion logic (placeholder for actual AI)
        if (noteContent.length < 50) {
            return `Your note "${noteTitle}" is quite brief. Consider adding more details or context to make it more useful.`;
        }

        if (noteContent.length > 500) {
            return `Your note "${noteTitle}" is quite long. Consider breaking it down into smaller, focused notes.`;
        }

        return `This note looks good! Consider adding tags like #${this.suggestTags(noteContent).join(' #')}.`;
    },

    suggestTags(content) {
        const keywords = ['idea', 'meeting', 'project', 'research', 'task', 'goal'];
        const found = keywords.filter(kw => content.toLowerCase().includes(kw));
        return found.length > 0 ? found.slice(0, 2) : ['note'];
    },

    acceptSuggestion() {
        // Implementation for accepting AI suggestions
        this.hideAiPanel();
        Toast.show('Suggestion accepted', 'success');
    },

    summarize(text) {
        // Placeholder for AI summarization
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length <= 3) return text;
        return sentences.slice(0, 3).join('. ') + '...';
    },

    findRelatedNotes(noteId) {
        const note = this.kb.data.notes.find(n => n.id === noteId);
        if (!note) return [];

        const noteText = (note.title + ' ' + Helpers.stripHtml(note.content)).toLowerCase();
        
        return this.kb.data.notes
            .filter(n => n.id !== noteId)
            .map(n => ({
                note: n,
                score: this.calculateSimilarity(noteText, 
                    (n.title + ' ' + Helpers.stripHtml(n.content)).toLowerCase())
            }))
            .filter(item => item.score > 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(item => item.note);
    },

    calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        return intersection.size / Math.max(words1.size, words2.size);
    }
};

// ==================== TOAST NOTIFICATIONS ====================

const Toast = {
    show(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

window.AI = AI;
window.Toast = Toast;
