// ==================== STORAGE UTILITIES ====================

const Storage = {
    KEYS: {
        DATA: 'kb_data',
        BACKUP: 'kb_data_backup',
        BACKUP_DATE: 'kb_backup_date'
    },

    clearOldBackups() {
        try {
            localStorage.removeItem(this.KEYS.BACKUP);
            localStorage.removeItem(this.KEYS.BACKUP_DATE);
            console.log('Emergency cleanup: cleared old backups');
        } catch (e) {
            console.warn('Cleanup failed:', e);
        }
    },

    saveData(data) {
        try {
            localStorage.setItem(this.KEYS.DATA, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    },

    loadData() {
        try {
            const saved = localStorage.getItem(this.KEYS.DATA);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('Load failed:', e);
            return null;
        }
    },

    createBackup(data) {
        try {
            const dataStr = JSON.stringify(data);
            if (dataStr.length > 100) {
                localStorage.removeItem(this.KEYS.BACKUP);
                localStorage.setItem(this.KEYS.BACKUP, dataStr);
                localStorage.setItem(this.KEYS.BACKUP_DATE, new Date().toISOString());
                return true;
            }
        } catch (e) {
            console.warn('Backup skipped:', e.message);
        }
        return false;
    },

    exportToFile(data, filename = 'mind-backup.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(new Error('Invalid JSON file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
};

// ==================== INDEXEDDB UTILITIES ====================

const IndexedDB = {
    db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('KnowledgeBase', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('attachments')) {
                    db.createObjectStore('attachments', { keyPath: 'id' });
                }
            };
        });
    },

    async saveAttachment(id, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attachments'], 'readwrite');
            const store = transaction.objectStore('attachments');
            const request = store.put({ id, data, timestamp: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getAttachment(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attachments'], 'readonly');
            const store = transaction.objectStore('attachments');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    }
};

window.Storage = Storage;
window.IndexedDB = IndexedDB;
