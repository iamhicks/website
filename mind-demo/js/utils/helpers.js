// ==================== HELPER UTILITIES ====================

const Helpers = {
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatDate(date, options = {}) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        if (options.relative) {
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        }
        
        return d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    },

    slugify(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    },

    truncate(text, length = 100) {
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + '...';
    }
};

// ==================== DOM UTILITIES ====================

const DOM = {
    $(selector, context = document) {
        return context.querySelector(selector);
    },

    $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    },

    create(tag, classes = '', attrs = {}) {
        const el = document.createElement(tag);
        if (classes) el.className = classes;
        Object.entries(attrs).forEach(([key, val]) => el.setAttribute(key, val));
        return el;
    },

    show(el) {
        if (typeof el === 'string') el = document.querySelector(el);
        if (el) el.style.display = '';
    },

    hide(el) {
        if (typeof el === 'string') el = document.querySelector(el);
        if (el) el.style.display = 'none';
    },

    toggle(el, show) {
        if (typeof el === 'string') el = document.querySelector(el);
        if (el) el.style.display = show ? '' : 'none';
    }
};

// ==================== VALIDATION ====================

const Validate = {
    isValidNote(note) {
        return note && 
               typeof note.id === 'string' && 
               typeof note.title === 'string' &&
               typeof note.content === 'string';
    },

    isValidFolder(folder) {
        return folder && 
               typeof folder.id === 'string' && 
               typeof folder.name === 'string';
    },

    sanitizeNoteData(data) {
        return {
            folders: Array.isArray(data.folders) ? data.folders : [],
            notes: Array.isArray(data.notes) ? data.notes : [],
            tags: Array.isArray(data.tags) ? data.tags : [],
            settings: typeof data.settings === 'object' ? data.settings : {}
        };
    }
};

window.Helpers = Helpers;
window.DOM = DOM;
window.Validate = Validate;
