// ==================== KNOWLEDGE BASE - CORE APP ====================

class KnowledgeBase {
    constructor() {
        this.data = {
            folders: [
                { id: 'root', name: 'All Notes', parentId: null },
                { id: 'inbox', name: 'Inbox', parentId: null }
            ],
            notes: [],
            tags: [],
            customTemplates: [],
            settings: {
                theme: 'auto',
                sidebarCollapsed: {}
            }
        };
        this.currentNote = null;
        this.currentFolder = 'root';
        this.currentTagFilter = null;
        this.contextMenuTarget = null;
        this.draggedNote = null;
        this.draggedFolder = null;
        this.db = null;
        this.openTabs = [];
        this.activeTabId = null;

        this.init();
    }

    async init() {
        try {
            await this.initIndexedDB();
            this.loadData();
            this.setupEventListeners();
            this.setupMobileGestures();
            this.applyTheme();
            this.render();

            if (this.data.notes.length === 0) {
                this.createWelcomeNote();
            }

            this.restoreSidebarState();
            console.log('App initialized successfully');
        } catch (err) {
            console.error('Initialization error:', err);
            alert('Error starting app: ' + err.message);
        }
    }
}

// Make available globally
window.KnowledgeBase = KnowledgeBase;
