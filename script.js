class AdvancedBookmarkManager {
    constructor() {
        this.version = '2.1.0';
        this.websiteInfo = {
            name: 'BookmarkPro',
            version: this.version,
            url: 'https://bookmarkpro.app'
        };

        this.bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
        this.collections = JSON.parse(localStorage.getItem('collections')) || [
            { 
                id: 'work', 
                name: 'Work', 
                description: 'Work-related bookmarks', 
                color: '#3b82f6', 
                icon: 'ri-briefcase-line',
                createdAt: new Date().toISOString()
            },
            { 
                id: 'personal', 
                name: 'Personal', 
                description: 'Personal bookmarks', 
                color: '#10b981', 
                icon: 'ri-heart-line',
                createdAt: new Date().toISOString()
            },
            { 
                id: 'learning', 
                name: 'Learning', 
                description: 'Educational resources', 
                color: '#f59e0b', 
                icon: 'ri-book-line',
                createdAt: new Date().toISOString()
            }
        ];
        this.tags = JSON.parse(localStorage.getItem('tags')) || [];
        this.settings = {
            darkMode: true,
            compactView: true,
            openInNewTab: true,
            autoFetchMeta: true,
            enableNotifications: false,
            autoBackup: false,
            theme: 'light',
            itemsPerPage: 50,
            enableDebug: false,
            ...JSON.parse(localStorage.getItem('settings') || '{}')
        };
        
        this.currentCollection = 'all';
        this.currentView = 'compact';
        this.currentSort = 'date-desc';
        this.searchQuery = '';
        this.selectedBookmarks = new Set();
        this.bulkMode = false;
        this.editingBookmark = null;
        this.editingCollection = null;
        this.contextMenuTarget = null;

        this.init();
    }

    init() {
        this.applyTheme();
        this.bindEvents();
        this.renderCollections();
        this.renderBookmarksContainer();
        this.updateCounts();
        this.populateCollectionSelects();
        this.renderTagsCloud();
        this.applySettings();
        this.updateStorageInfo();
        
        // Load saved view preference
        const savedView = localStorage.getItem('preferredView') || 'compact';
        this.setView(savedView);
    }

    bindEvents() {
        // Navigation events
        document.getElementById('quickAddBtn').addEventListener('click', () => this.openQuickAddModal());
        document.getElementById('globalSearch').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('addCollectionBtn').addEventListener('click', () => this.openCollectionModal());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportBookmarksJson());
        document.getElementById('bulkImportBtn').addEventListener('click', () => this.openBulkImportModal());

        // Search filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilterClick(e));
        });

        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleViewChange(e));
        });

        // Sort menu
        document.getElementById('sortBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSortMenu();
        });
        
        document.querySelectorAll('#sortMenu button').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleSortChange(e));
        });

        // Click outside to close sort menu
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.sort-dropdown')) {
                this.hideSortMenu();
            }
        });

        // Bulk selection
        document.getElementById('bulkSelectBtn').addEventListener('click', () => this.toggleBulkMode());
        document.getElementById('bulkCloseBtn').addEventListener('click', () => this.exitBulkMode());

        // Bulk actions
        document.getElementById('bulkDeleteBtn').addEventListener('click', () => this.bulkDeleteBookmarks());
        document.getElementById('bulkExportBtn').addEventListener('click', () => this.bulkExportBookmarks());
        document.getElementById('bulkMoveBtn').addEventListener('click', () => this.bulkMoveBookmarks());
        document.getElementById('bulkTagBtn').addEventListener('click', () => this.bulkTagBookmarks());

        // Modal events
        this.bindModalEvents();
        this.bindFormEvents();

        // Collection selection with proper event delegation
        document.addEventListener('click', (e) => {
            const collectionItem = e.target.closest('.collection-item');
            if (collectionItem && !e.target.closest('.collection-actions')) {
                const collection = collectionItem.dataset.collection;
                this.selectCollection(collection);
            }
        });

        // Context menu
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });

        // Context menu actions
        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleContextAction(e));
        });

        // Global shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Theme detection for system preference
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener(() => this.applyTheme());
        }
    }

    bindModalEvents() {
        // Close modal buttons
        document.querySelectorAll('.close-btn, [data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = btn.dataset.modal || btn.closest('.modal-overlay').id;
                this.closeModal(modalId);
            });
        });

        // Modal overlay clicks
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal(overlay.id);
                }
            });
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTabSwitch(e));
        });
    }

    bindFormEvents() {
        // Quick add form
        document.getElementById('quickAddForm').addEventListener('submit', (e) => this.handleQuickAddSubmit(e));
        document.getElementById('fetchMetaBtn').addEventListener('click', () => this.fetchUrlMetadata());

        // Edit form
        document.getElementById('editForm').addEventListener('submit', (e) => this.handleEditSubmit(e));
        document.getElementById('deleteBookmarkBtn').addEventListener('click', () => this.deleteCurrentBookmark());

        // Collection form
        document.getElementById('collectionForm').addEventListener('submit', (e) => this.handleCollectionSubmit(e));
        document.getElementById('deleteCollectionBtn').addEventListener('click', () => this.deleteCurrentCollection());

        // Rating stars
        document.querySelectorAll('.rating-stars').forEach(container => {
            container.addEventListener('click', (e) => this.handleRatingClick(e));
        });

        // Tags input
        document.querySelectorAll('.tags-input input').forEach(input => {
            input.addEventListener('keydown', (e) => this.handleTagInput(e));
        });

        // Settings
        document.querySelectorAll('#settingsModal input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleSettingChange(e));
        });

        document.querySelectorAll('#settingsModal select').forEach(select => {
            console.log("wkng");
            
            select.addEventListener('change', (e) => this.handleSettingChange(e));
        });

        // Import/Export buttons
        document.getElementById('importJsonBtn').addEventListener('click', () => document.getElementById('importJsonFile').click());
        document.getElementById('importHtmlBtn').addEventListener('click', () => document.getElementById('importHtmlFile').click());
        document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('importCsvFile').click());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportBookmarksJson());
        document.getElementById('exportHtmlBtn').addEventListener('click', () => this.exportBookmarksHtml());
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportBookmarksCsv());
        document.getElementById('exportBackupBtn').addEventListener('click', () => this.createBackup());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());
        document.getElementById('showDebugInfo').addEventListener('click', () => this.showDebugInfo());

        // File imports
        document.getElementById('importJsonFile').addEventListener('change', (e) => this.handleJsonImport(e));
        document.getElementById('importHtmlFile').addEventListener('change', (e) => this.handleHtmlImport(e));
        document.getElementById('importCsvFile').addEventListener('change', (e) => this.handleCsvImport(e));
    }

    // Theme Management
    applyTheme() {
        const theme = this.settings.theme;
        console.log( this.settings.theme);
        
        let shouldUseDark = false;

        if (theme === 'dark') {
            shouldUseDark = true;
        } else if (theme === 'system') {
            shouldUseDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        document.body.classList.toggle('dark-mode', shouldUseDark);
        
        // Update theme select if available
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    }

    // Collection Management
    renderCollections() {
        const container = document.getElementById('collectionsList');
        const allItem = container.querySelector('[data-collection="all"]');
        
        // Clear existing collections except 'all'
        container.querySelectorAll('.collection-item:not([data-collection="all"])').forEach(item => item.remove());

        // Add collections with edit/delete options
        this.collections.forEach(collection => {
            const item = document.createElement('div');
            item.className = `collection-item ${this.currentCollection === collection.id ? 'active' : ''}`;
            item.dataset.collection = collection.id;
            item.innerHTML = `
                <i class="${collection.icon}" style="color: ${collection.color}"></i>
                <span class="collection-name">${collection.name}</span>
                <span class="count">${this.getBookmarksByCollection(collection.id).length}</span>
                <div class="collection-actions">
                    <button class="collection-action" data-action="edit" data-collection-id="${collection.id}" title="Edit">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="collection-action" data-action="delete" data-collection-id="${collection.id}" title="Delete">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;
            
            // Bind collection action events
            item.querySelectorAll('.collection-action').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const collectionId = btn.dataset.collectionId;
                    this.handleCollectionAction(action, collectionId);
                });
            });
            
            container.appendChild(item);
        });

        // Update active state
        container.querySelectorAll('.collection-item').forEach(item => {
            item.classList.toggle('active', item.dataset.collection === this.currentCollection);
        });
    }

    handleCollectionAction(action, collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        switch (action) {
            case 'edit':
                this.openCollectionModal(collection);
                break;
            case 'delete':
                this.deleteCollection(collectionId);
                break;
        }
    }

    deleteCollection(collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        const bookmarksInCollection = this.bookmarks.filter(b => b.collection === collectionId);
        let message = `Are you sure you want to delete the collection "${collection.name}"?`;
        
        if (bookmarksInCollection.length > 0) {
            message += `\n\nThis will also move ${bookmarksInCollection.length} bookmark(s) to "Uncategorized".`;
        }

        if (confirm(message)) {
            // Move bookmarks to uncategorized
            this.bookmarks.forEach(bookmark => {
                if (bookmark.collection === collectionId) {
                    bookmark.collection = '';
                }
            });

            // Remove collection
            this.collections = this.collections.filter(c => c.id !== collectionId);
            
            // If we're currently viewing this collection, switch to all
            if (this.currentCollection === collectionId) {
                this.selectCollection('all');
            }

            this.saveData();
            this.renderCollections();
            this.renderBookmarksContainer();
            this.populateCollectionSelects();
            this.updateCounts();
        }
    }

    selectCollection(collectionId) {
        this.currentCollection = collectionId;
        this.renderCollections();
        this.renderBookmarksContainer();
        this.updateBreadcrumb();
        this.exitBulkMode();
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === collectionId);
        });
    }

    getBookmarksByCollection(collectionId) {
        if (collectionId === 'all') return this.bookmarks;
        if (collectionId === 'favorites') return this.bookmarks.filter(b => b.rating >= 4);
        if (collectionId === 'recent') return this.bookmarks.filter(b => this.isRecent(b.createdAt));
        if (collectionId === 'unread') return this.bookmarks.filter(b => !b.isRead);
        if (collectionId === 'broken') return this.bookmarks.filter(b => b.isBroken);
        return this.bookmarks.filter(b => b.collection === collectionId);
    }

    isRecent(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
    }

    // View Management
    setView(view) {
        this.currentView = view;
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Save preference
        localStorage.setItem('preferredView', view);
        
        this.renderBookmarksContainer();
    }

    handleViewChange(e) {
        const view = e.target.closest('.view-btn').dataset.view;
        this.setView(view);
    }

    // Bookmark Management
    renderBookmarksContainer() {
        const container = document.getElementById('bookmarksContainer');
        const emptyState = document.getElementById('emptyState');
        const bookmarkItems = document.getElementById('bookmarkItems');
        const filteredBookmarks = this.getFilteredBookmarks();

        if (filteredBookmarks.length === 0) {
            emptyState.style.display = 'flex';
            bookmarkItems.style.display = 'none';
            bookmarkItems.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';
        bookmarkItems.style.display = 'block';
        
        // Apply view-specific class to container
        container.className = `bookmarks-container ${this.currentView}-view`;
        
        switch (this.currentView) {
            case 'compact':
                this.renderCompactView(bookmarkItems, filteredBookmarks);
                break;
            case 'grid':
                this.renderGridView(bookmarkItems, filteredBookmarks);
                break;
            case 'table':
                this.renderTableView(bookmarkItems, filteredBookmarks);
                break;
            case 'containers':
                this.renderContainersView(bookmarkItems, filteredBookmarks);
                break;
        }

        this.updateItemCount(filteredBookmarks.length);
    }

    renderCompactView(container, bookmarks) {
        container.innerHTML = '';
        container.className = 'bookmarks-list';

        bookmarks.forEach(bookmark => {
            const item = this.createCompactBookmarkItem(bookmark);
            container.appendChild(item);
        });
    }

    renderGridView(container, bookmarks) {
        container.innerHTML = '';
        container.className = 'bookmarks-grid';

        bookmarks.forEach(bookmark => {
            const card = this.createGridBookmarkCard(bookmark);
            container.appendChild(card);
        });
    }

    renderTableView(container, bookmarks) {
        container.innerHTML = `
            <div class="table-header">
                <div></div>
                <div>Title</div>
                <div>Collection</div>
                <div>Rating</div>
                <div>Date</div>
                <div></div>
            </div>
        `;
        container.className = 'bookmarks-table';

        bookmarks.forEach(bookmark => {
            const row = this.createTableBookmarkRow(bookmark);
            container.appendChild(row);
        });
    }

    renderContainersView(container, bookmarks) {
        container.innerHTML = '';
        container.className = 'bookmarks-containers';

        // Group bookmarks by collection
        const bookmarksByCollection = {};
        bookmarks.forEach(bookmark => {
            const collectionId = bookmark.collection || 'uncategorized';
            if (!bookmarksByCollection[collectionId]) {
                bookmarksByCollection[collectionId] = [];
            }
            bookmarksByCollection[collectionId].push(bookmark);
        });

        // Create container for each collection
        Object.keys(bookmarksByCollection).forEach(collectionId => {
            const collection = this.collections.find(c => c.id === collectionId);
            const collectionName = collection ? collection.name : 'Uncategorized';
            const collectionColor = collection ? collection.color : '#6b7280';
            const collectionIcon = collection ? collection.icon : 'ri-folder-line';
            
            const containerDiv = document.createElement('div');
            containerDiv.className = 'bookmark-container';
            containerDiv.innerHTML = `
                <div class="container-header" style="border-left-color: ${collectionColor}">
                    <div class="container-title">
                        <i class="${collectionIcon}" style="color: ${collectionColor}"></i>
                        <span>${collectionName}</span>
                        <span class="container-count">${bookmarksByCollection[collectionId].length}</span>
                    </div>
                    <div class="container-actions">
                        <button class="container-action" data-action="collapse">
                            <i class="ri-subtract-line"></i>
                        </button>
                    </div>
                </div>
                <div class="container-content">
                    ${bookmarksByCollection[collectionId].map(bookmark => 
                        `<div class="container-bookmark" data-bookmark-id="${bookmark.id}">
                            <div class="bookmark-checkbox ${this.selectedBookmarks.has(bookmark.id) ? 'checked' : ''}">
                                <i class="ri-check-line"></i>
                            </div>
                            <div class="bookmark-favicon">
                                ${this.getFaviconHtml(bookmark.url)}
                            </div>
                            <div class="bookmark-info">
                                <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
                                <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
                            </div>
                            <div class="bookmark-meta">
                                <div class="bookmark-rating">
                                    ${this.generateStarsHtml(bookmark.rating)}
                                </div>
                            </div>
                            <div class="bookmark-actions">
                                <button class="bookmark-action" data-action="edit" title="Edit">
                                    <i class="ri-edit-line"></i>
                                </button>
                                <button class="bookmark-action" data-action="favorite" title="Favorite">
                                    <i class="ri-star-${bookmark.rating >= 4 ? 'fill' : 'line'}"></i>
                                </button>
                            </div>
                        </div>`
                    ).join('')}
                </div>
            `;

            // Bind events for this container
            this.bindContainerEvents(containerDiv, bookmarksByCollection[collectionId]);
            container.appendChild(containerDiv);
        });
    }

    bindContainerEvents(containerDiv, bookmarks) {
        // Container collapse/expand
        const collapseBtn = containerDiv.querySelector('.container-action[data-action="collapse"]');
        const content = containerDiv.querySelector('.container-content');
        
        collapseBtn.addEventListener('click', () => {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? 'block' : 'none';
            collapseBtn.innerHTML = isCollapsed ? '<i class="ri-subtract-line"></i>' : '<i class="ri-add-line"></i>';
        });

        // Bookmark events
        containerDiv.querySelectorAll('.container-bookmark').forEach((bookmarkEl, index) => {
            const bookmark = bookmarks[index];
            
            // Click to open
            bookmarkEl.addEventListener('click', (e) => {
                if (e.target.closest('.bookmark-action') || e.target.closest('.bookmark-checkbox')) return;
                
                if (this.bulkMode) {
                    this.toggleBookmarkSelection(bookmark.id);
                } else {
                    this.openBookmark(bookmark);
                }
            });

            // Checkbox click
            const checkbox = bookmarkEl.querySelector('.bookmark-checkbox');
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleBookmarkSelection(bookmark.id);
            });

            // Action buttons
            bookmarkEl.querySelectorAll('.bookmark-action').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    this.handleBookmarkAction(action, bookmark);
                });
            });
        });
    }

    createCompactBookmarkItem(bookmark) {
        const item = document.createElement('div');
        item.className = `bookmark-item ${this.selectedBookmarks.has(bookmark.id) ? 'selected' : ''}`;
        item.dataset.bookmarkId = bookmark.id;

        const collection = this.collections.find(c => c.id === bookmark.collection);
        const collectionName = collection ? collection.name : 'Uncategorized';

        item.innerHTML = `
            <div class="bookmark-checkbox ${this.selectedBookmarks.has(bookmark.id) ? 'checked' : ''}">
                <i class="ri-check-line"></i>
            </div>
            <div class="bookmark-favicon">
                ${this.getFaviconHtml(bookmark.url)}
            </div>
            <div class="bookmark-content">
                <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
                <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
            </div>
            <div class="bookmark-meta">
                <div class="bookmark-rating">
                    ${this.generateStarsHtml(bookmark.rating)}
                </div>
                <div class="bookmark-tags">
                    ${bookmark.tags ? bookmark.tags.slice(0, 2).map(tag => `<span class="bookmark-tag">${tag}</span>`).join('') : ''}
                </div>
                <div class="bookmark-date">${this.formatDate(bookmark.createdAt)}</div>
            </div>
            <div class="bookmark-actions">
                <button class="bookmark-action" data-action="edit" title="Edit">
                    <i class="ri-edit-line"></i>
                </button>
                <button class="bookmark-action" data-action="favorite" title="Favorite">
                    <i class="ri-star-${bookmark.rating >= 4 ? 'fill' : 'line'}"></i>
                </button>
            </div>
        `;

        this.bindBookmarkItemEvents(item, bookmark);
        return item;
    }

    createGridBookmarkCard(bookmark) {
        const card = document.createElement('div');
        card.className = 'bookmark-card';
        card.dataset.bookmarkId = bookmark.id;

        const collection = this.collections.find(c => c.id === bookmark.collection);
        const collectionName = collection ? collection.name : 'Uncategorized';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-favicon">
                    ${this.getFaviconHtml(bookmark.url)}
                </div>
                <div class="card-actions">
                    <button class="bookmark-action" data-action="edit">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="bookmark-action" data-action="favorite">
                        <i class="ri-star-${bookmark.rating >= 4 ? 'fill' : 'line'}"></i>
                    </button>
                </div>
            </div>
            <div class="card-title">${this.escapeHtml(bookmark.title)}</div>
            ${bookmark.description ? `<div class="card-description">${this.escapeHtml(bookmark.description)}</div>` : ''}
            <div class="card-footer">
                <div class="bookmark-rating">
                    ${this.generateStarsHtml(bookmark.rating)}
                </div>
                <span class="bookmark-tag" style="background-color: ${collection?.color}20; color: ${collection?.color}">
                    ${collectionName}
                </span>
            </div>
        `;

        this.bindBookmarkItemEvents(card, bookmark);
        return card;
    }

    createTableBookmarkRow(bookmark) {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.dataset.bookmarkId = bookmark.id;

        const collection = this.collections.find(c => c.id === bookmark.collection);
        const collectionName = collection ? collection.name : 'Uncategorized';

        row.innerHTML = `
            <div class="bookmark-checkbox ${this.selectedBookmarks.has(bookmark.id) ? 'checked' : ''}">
                <i class="ri-check-line"></i>
            </div>
            <div>
                <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
                <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
            </div>
            <div>${collectionName}</div>
            <div class="bookmark-rating">
                ${this.generateStarsHtml(bookmark.rating)}
            </div>
            <div>${this.formatDate(bookmark.createdAt)}</div>
            <div class="bookmark-actions">
                <button class="bookmark-action" data-action="edit">
                    <i class="ri-edit-line"></i>
                </button>
            </div>
        `;

        this.bindBookmarkItemEvents(row, bookmark);
        return row;
    }

    bindBookmarkItemEvents(element, bookmark) {
        // Click to open bookmark
        element.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-action') || e.target.closest('.bookmark-checkbox')) return;
            
            if (this.bulkMode) {
                this.toggleBookmarkSelection(bookmark.id);
            } else {
                this.openBookmark(bookmark);
            }
        });

        // Checkbox click
        const checkbox = element.querySelector('.bookmark-checkbox');
        if (checkbox) {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleBookmarkSelection(bookmark.id);
            });
        }

        // Action buttons
        element.querySelectorAll('.bookmark-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleBookmarkAction(action, bookmark);
            });
        });
    }

    getFilteredBookmarks() {
        let filtered = this.getBookmarksByCollection(this.currentCollection);

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(bookmark => 
                bookmark.title.toLowerCase().includes(query) ||
                bookmark.description?.toLowerCase().includes(query) ||
                bookmark.url.toLowerCase().includes(query) ||
                bookmark.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'date-desc':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'date-asc':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'rating':
                    return b.rating - a.rating;
                case 'visits':
                    return (b.visitCount || 0) - (a.visitCount || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }

    // Bookmark Actions
    openBookmark(bookmark) {
        // Update visit count and last visited
        bookmark.visitCount = (bookmark.visitCount || 0) + 1;
        bookmark.lastVisited = new Date().toISOString();
        this.saveData();

        // Open URL
        if (this.settings.openInNewTab) {
            window.open(bookmark.url, '_blank');
        } else {
            window.location.href = bookmark.url;
        }
    }

    handleBookmarkAction(action, bookmark) {
        switch (action) {
            case 'edit':
                this.openEditModal(bookmark);
                break;
            case 'favorite':
                this.toggleFavorite(bookmark);
                break;
            case 'delete':
                this.deleteBookmark(bookmark.id);
                break;
        }
    }

    toggleFavorite(bookmark) {
        bookmark.rating = bookmark.rating >= 4 ? 0 : 5;
        this.saveData();
        this.renderBookmarksContainer();
        this.updateCounts();
    }

    deleteBookmark(id) {
        if (confirm('Are you sure you want to delete this bookmark?')) {
            this.bookmarks = this.bookmarks.filter(b => b.id !== id);
            this.selectedBookmarks.delete(id);
            this.saveData();
            this.renderBookmarksContainer();
            this.updateCounts();
            this.updateBulkActionsBar();
        }
    }

    // Sort Management
    toggleSortMenu() {
        const menu = document.getElementById('sortMenu');
        const isVisible = menu.style.opacity === '1';
        
        if (isVisible) {
            this.hideSortMenu();
        } else {
            this.showSortMenu();
        }
    }

    showSortMenu() {
        const menu = document.getElementById('sortMenu');
        menu.style.opacity = '1';
        menu.style.visibility = 'visible';
        menu.style.transform = 'translateY(0)';
    }

    hideSortMenu() {
        const menu = document.getElementById('sortMenu');
        menu.style.opacity = '0';
        menu.style.visibility = 'hidden';
        menu.style.transform = 'translateY(-4px)';
    }

    handleSortChange(e) {
        this.currentSort = e.target.dataset.sort;
        this.renderBookmarksContainer();
        this.hideSortMenu();
    }

    // Search and Filtering
    handleSearch(query) {
        this.searchQuery = query;
        this.renderBookmarksContainer();
    }

    handleFilterClick(e) {
        const filter = e.target.dataset.filter;
        this.selectCollection(filter);
    }

    // Bulk Operations
    toggleBulkMode() {
        this.bulkMode = !this.bulkMode;
        document.body.classList.toggle('bulk-mode', this.bulkMode);
        document.getElementById('bulkSelectBtn').classList.toggle('active', this.bulkMode);
        
        if (!this.bulkMode) {
            this.exitBulkMode();
        } else {
            this.updateBulkActionsBar();
        }
    }

    exitBulkMode() {
        this.bulkMode = false;
        this.selectedBookmarks.clear();
        document.body.classList.remove('bulk-mode');
        document.getElementById('bulkSelectBtn').classList.remove('active');
        document.getElementById('bulkActions').classList.remove('active');
        this.renderBookmarksContainer();
    }

    toggleBookmarkSelection(id) {
        if (this.selectedBookmarks.has(id)) {
            this.selectedBookmarks.delete(id);
        } else {
            this.selectedBookmarks.add(id);
        }
        
        this.updateBulkActionsBar();
        this.renderBookmarksContainer();
    }

    updateBulkActionsBar() {
        const count = this.selectedBookmarks.size;
        document.getElementById('selectedCount').textContent = count;
        document.getElementById('bulkActions').classList.toggle('active', count > 0 && this.bulkMode);
    }

    bulkDeleteBookmarks() {
        if (this.selectedBookmarks.size === 0) return;
        
        if (confirm(`Delete ${this.selectedBookmarks.size} selected bookmarks?`)) {
            this.bookmarks = this.bookmarks.filter(b => !this.selectedBookmarks.has(b.id));
            this.saveData();
            this.exitBulkMode();
            this.renderBookmarksContainer();
            this.updateCounts();
        }
    }

    bulkExportBookmarks() {
        if (this.selectedBookmarks.size === 0) return;
        
        const selectedBookmarks = this.bookmarks.filter(b => this.selectedBookmarks.has(b.id));
        this.exportBookmarksJson(selectedBookmarks);
    }

    bulkMoveBookmarks() {
        if (this.selectedBookmarks.size === 0) return;
        
        const collectionId = prompt('Enter collection ID to move bookmarks to:');
        if (!collectionId) return;
        
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) {
            alert('Collection not found!');
            return;
        }
        
        this.bookmarks.forEach(bookmark => {
            if (this.selectedBookmarks.has(bookmark.id)) {
                bookmark.collection = collectionId;
            }
        });
        
        this.saveData();
        this.exitBulkMode();
        this.renderBookmarksContainer();
        this.updateCounts();
    }

    bulkTagBookmarks() {
        if (this.selectedBookmarks.size === 0) return;
        
        const tags = prompt('Enter tags (comma-separated):');
        if (!tags) return;
        
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        this.bookmarks.forEach(bookmark => {
            if (this.selectedBookmarks.has(bookmark.id)) {
                bookmark.tags = bookmark.tags || [];
                tagArray.forEach(tag => {
                    if (!bookmark.tags.includes(tag)) {
                        bookmark.tags.push(tag);
                    }
                });
            }
        });
        
        this.updateTagsList(tagArray);
        this.saveData();
        this.exitBulkMode();
        this.renderBookmarksContainer();
    }

    // Import/Export with Website Information
    exportBookmarksJson(bookmarks = null) {
        const data = {
            website: this.websiteInfo,
            bookmarks: bookmarks || this.bookmarks,
            collections: this.collections,
            tags: this.tags,
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: this.version,
            format: 'BookmarkPro JSON Export v2.1'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadFile(blob, `bookmarkpro-export-${new Date().toISOString().split('T')[0]}.json`);
    }

    exportBookmarksHtml() {
        let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!--This is an automatically generated file.
It will be read and overwritten.
Do NOT edit!-->
<!-- Export from ${this.websiteInfo.name} v${this.websiteInfo.version} on ${new Date().toISOString()} -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>`;

        // Group by collections
        const bookmarksByCollection = {};
        this.bookmarks.forEach(bookmark => {
            const collectionId = bookmark.collection || 'uncategorized';
            if (!bookmarksByCollection[collectionId]) {
                bookmarksByCollection[collectionId] = [];
            }
            bookmarksByCollection[collectionId].push(bookmark);
        });

        Object.keys(bookmarksByCollection).forEach(collectionId => {
            const collection = this.collections.find(c => c.id === collectionId);
            const collectionName = collection ? collection.name : 'Uncategorized';
            
            html += `\n    <DT><H3 FOLDED>${collectionName}</H3>\n    <DL><p>`;
            bookmarksByCollection[collectionId].forEach(bookmark => {
                const addDate = Math.floor(new Date(bookmark.createdAt).getTime() / 1000);
                html += `\n        <DT><A HREF="${bookmark.url}" ADD_DATE="${addDate}"${bookmark.tags ? ` TAGS="${bookmark.tags.join(',')}"` : ''}>${bookmark.title}</A>`;
                if (bookmark.description) {
                    html += `\n        <DD>${bookmark.description}`;
                }
            });
            html += `\n    </DL><p>`;
        });

        html += `\n</DL><p>`;

        const blob = new Blob([html], { type: 'text/html' });
        this.downloadFile(blob, `bookmarkpro-export-${new Date().toISOString().split('T')[0]}.html`);
    }

    exportBookmarksCsv() {
        const headers = ['Title', 'URL', 'Description', 'Collection', 'Tags', 'Rating', 'Created', 'Visits', 'Is Read'];
        const rows = [headers];

        this.bookmarks.forEach(bookmark => {
            const collection = this.collections.find(c => c.id === bookmark.collection);
            rows.push([
                bookmark.title,
                bookmark.url,
                bookmark.description || '',
                collection?.name || 'Uncategorized',
                bookmark.tags?.join('; ') || '',
                bookmark.rating || 0,
                bookmark.createdAt,
                bookmark.visitCount || 0,
                bookmark.isRead ? 'Yes' : 'No'
            ]);
        });

        const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const csvWithInfo = `# Exported from ${this.websiteInfo.name} v${this.websiteInfo.version}\n# Export Date: ${new Date().toISOString()}\n# Website: ${this.websiteInfo.url}\n\n${csv}`;
        
        const blob = new Blob([csvWithInfo], { type: 'text/csv' });
        this.downloadFile(blob, `bookmarkpro-export-${new Date().toISOString().split('T')[0]}.csv`);
    }

    createBackup() {
        const backupData = {
            website: this.websiteInfo,
            backup: true,
            bookmarks: this.bookmarks,
            collections: this.collections,
            tags: this.tags,
            settings: this.settings,
            version: this.version,
            backupDate: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        this.downloadFile(blob, `bookmarkpro-backup-${new Date().toISOString().split('T')[0]}.json`);
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Enhanced Import Functions
    handleJsonImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate import data
                if (!this.validateImportData(data)) {
                    alert('Invalid or incompatible bookmark file format.');
                    return;
                }

                const shouldMerge = confirm('Would you like to merge with existing data? Click "Cancel" to replace all data.');
                
                if (shouldMerge) {
                    this.mergeImportData(data);
                } else {
                    this.replaceImportData(data);
                }
                
                this.saveData();
                this.renderCollections();
                this.renderBookmarksContainer();
                this.updateCounts();
                this.populateCollectionSelects();
                this.renderTagsCloud();
                
                alert(`Import successful! Imported ${data.bookmarks?.length || 0} bookmarks.`);
            } catch (error) {
                console.error('Import error:', error);
                alert('Error reading file. Please ensure it\'s a valid JSON file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    handleHtmlImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(e.target.result, 'text/html');
                const links = doc.querySelectorAll('a[href]');
                
                const bookmarks = [];
                links.forEach(link => {
                    const bookmark = {
                        id: this.generateId(),
                        title: link.textContent.trim() || link.href,
                        url: link.href,
                        description: '',
                        tags: link.getAttribute('tags') ? link.getAttribute('tags').split(',') : [],
                        collection: '',
                        rating: 0,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                        visitCount: 0
                    };
                    bookmarks.push(bookmark);
                });

                if (bookmarks.length > 0) {
                    if (confirm(`Import ${bookmarks.length} bookmarks from HTML file?`)) {
                        this.bookmarks.push(...bookmarks);
                        this.saveData();
                        this.renderBookmarksContainer();
                        this.updateCounts();
                        alert(`Successfully imported ${bookmarks.length} bookmarks!`);
                    }
                } else {
                    alert('No bookmarks found in HTML file.');
                }
            } catch (error) {
                console.error('HTML import error:', error);
                alert('Error reading HTML file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    handleCsvImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvContent = e.target.result;
                const lines = csvContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
                
                if (lines.length < 2) {
                    alert('CSV file must have at least a header row and one data row.');
                    return;
                }

                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
                const bookmarks = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
                    
                    if (values.length >= 2) { // At least title and URL
                        const bookmark = {
                            id: this.generateId(),
                            title: values[headers.indexOf('title')] || values[0],
                            url: values[headers.indexOf('url')] || values[1],
                            description: values[headers.indexOf('description')] || '',
                            tags: values[headers.indexOf('tags')] ? values[headers.indexOf('tags')].split(';').map(t => t.trim()) : [],
                            collection: '',
                            rating: parseInt(values[headers.indexOf('rating')]) || 0,
                            isRead: (values[headers.indexOf('is read')] || '').toLowerCase() === 'yes',
                            createdAt: new Date().toISOString(),
                            visitCount: parseInt(values[headers.indexOf('visits')]) || 0
                        };
                        bookmarks.push(bookmark);
                    }
                }

                if (bookmarks.length > 0) {
                    if (confirm(`Import ${bookmarks.length} bookmarks from CSV file?`)) {
                        this.bookmarks.push(...bookmarks);
                        this.saveData();
                        this.renderBookmarksContainer();
                        this.updateCounts();
                        alert(`Successfully imported ${bookmarks.length} bookmarks!`);
                    }
                } else {
                    alert('No valid bookmarks found in CSV file.');
                }
            } catch (error) {
                console.error('CSV import error:', error);
                alert('Error reading CSV file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    validateImportData(data) {
        // Check for required fields and format
        if (!data.bookmarks || !Array.isArray(data.bookmarks)) return false;
        
        // Check version compatibility
        if (data.version && parseFloat(data.version) > parseFloat(this.version)) {
            return confirm('This file was exported from a newer version. Some features may not be compatible. Continue anyway?');
        }
        
        return true;
    }

    mergeImportData(data) {
        // Merge bookmarks
        if (data.bookmarks) {
            data.bookmarks.forEach(bookmark => {
                // Check if bookmark already exists (by URL)
                const existingIndex = this.bookmarks.findIndex(b => b.url === bookmark.url);
                if (existingIndex >= 0) {
                    // Update existing bookmark
                    this.bookmarks[existingIndex] = { ...this.bookmarks[existingIndex], ...bookmark };
                } else {
                    // Add new bookmark with new ID
                    bookmark.id = this.generateId();
                    this.bookmarks.push(bookmark);
                }
            });
        }

        // Merge collections
        if (data.collections) {
            data.collections.forEach(collection => {
                const existingIndex = this.collections.findIndex(c => c.name === collection.name);
                if (existingIndex >= 0) {
                    this.collections[existingIndex] = { ...this.collections[existingIndex], ...collection };
                } else {
                    collection.id = this.generateId();
                    this.collections.push(collection);
                }
            });
        }

        // Merge tags
        if (data.tags) {
            data.tags.forEach(tag => {
                if (!this.tags.includes(tag)) {
                    this.tags.push(tag);
                }
            });
        }
    }

    replaceImportData(data) {
        if (data.bookmarks) this.bookmarks = data.bookmarks;
        if (data.collections) this.collections = data.collections;
        if (data.tags) this.tags = data.tags;
        if (data.settings) this.settings = { ...this.settings, ...data.settings };
    }

    openBulkImportModal() {
        // For now, just trigger the JSON import
        document.getElementById('importJsonBtn').click();
    }

    // Settings Management
    applySettings() {
        // Apply all settings
        Object.keys(this.settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.settings[key];
                } else {
                    element.value = this.settings[key];
                }
            }
        });

        this.applyTheme();
    }

    // handle_setting_change(e) {
    //     const setting = e.target.id;
    //     let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        
    //     // convert string numbers to numbers for specific settings
    //     if (['items_per_page'].includes(setting)) {
    //         value = parse_int(value);
    //     }
        
    //     this.settings[setting] = value;
    //     this.save_data();
        
    //     // apply specific setting changes
    //     if (setting === 'theme') {
    //         this.apply_theme();
    //     }
    // }
    handleSettingChange(e) {
  // Normalize the DOM id into your settings key
  let setting = e.target.id === 'themeSelect' ? 'theme' : e.target.id;
  
  // Grab the raw value or checked state
  let value = e.target.type === 'checkbox'
    ? e.target.checked
    : e.target.value;

  // Convert strings to numbers where needed
  if (setting === 'itemsPerPage') {
    value = parseInt(value, 10);
  }

  // Write it back into settings
  this.settings[setting] = value;
  this.saveData();

  // If it's the theme, re-apply immediately
  if (setting === 'theme') {
    this.applyTheme();
  }
}


    populateSettingsForm() {
        this.applySettings();
    }

    // Utility Functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString();
    }

    getFaviconHtml(url) {
        try {
            const domain = new URL(url).hostname;
            return `<img src="https://www.google.com/s2/favicons?domain=${domain}" alt="" onerror="this.style.display='none'">`;
        } catch {
            return '<i class="ri-global-line"></i>';
        }
    }

    generateStarsHtml(rating) {
        return Array.from({ length: 5 }, (_, i) => 
            `<i class="ri-star-${i < rating ? 'fill' : 'line'} star ${i < rating ? 'active' : 'empty'}"></i>`
        ).join('');
    }

    getRating(containerId) {
        return document.querySelectorAll(`#${containerId} .star.active`).length;
    }

    setRating(containerId, rating) {
        const stars = document.querySelectorAll(`#${containerId} .star`);
        stars.forEach((star, index) => {
            star.classList.toggle('active', index < rating);
            const icon = star.querySelector('i');
            if (icon) {
                icon.className = index < rating ? 'ri-star-fill' : 'ri-star-line';
            }
        });
    }

    resetRating(containerId) {
        this.setRating(containerId, 0);
    }

    getTags(containerId) {
        const container = document.getElementById(containerId);
        return Array.from(container.querySelectorAll('.tag-chip')).map(chip => 
            chip.textContent.replace('×', '').trim()
        );
    }

    addTag(containerId, tag) {
        if (!tag.trim()) return;
        
        const container = document.getElementById(containerId);
        const input = container.querySelector('input');
        
        // Check if tag already exists
        const existingTags = this.getTags(containerId);
        if (existingTags.includes(tag)) return;
        
        const chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.innerHTML = `
            ${tag}
            <button type="button" class="tag-remove">
                <i class="ri-close-line"></i>
            </button>
        `;
        
        chip.querySelector('.tag-remove').addEventListener('click', () => chip.remove());
        container.insertBefore(chip, input);
        input.value = '';
    }

    updateTagsList(tags) {
        if (!tags) return;
        
        tags.forEach(tag => {
            if (!this.tags.includes(tag)) {
                this.tags.push(tag);
            }
        });
        
        this.renderTagsCloud();
    }

    renderTagsCloud() {
        const container = document.getElementById('tagsCloud');
        container.innerHTML = '';
        
        // Get tag usage counts
        const tagCounts = {};
        this.bookmarks.forEach(bookmark => {
            if (bookmark.tags) {
                bookmark.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        
        // Sort tags by usage
        const sortedTags = Object.entries(tagCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20); // Show top 20 tags
        
        sortedTags.forEach(([tag, count]) => {
            const item = document.createElement('div');
            item.className = 'tag-item';
            item.textContent = `${tag} (${count})`;
            item.addEventListener('click', () => this.filterByTag(tag));
            container.appendChild(item);
        });
    }

    filterByTag(tag) {
        document.getElementById('globalSearch').value = tag;
        this.handleSearch(tag);
    }

    // Modal Management
    openQuickAddModal() {
        this.openModal('quickAddModal');
        document.getElementById('quickUrl').focus();
    }

    openEditModal(bookmark) {
        this.editingBookmark = bookmark;
        this.populateEditForm(bookmark);
        this.openModal('editModal');
    }

    openCollectionModal(collection = null) {
        this.editingCollection = collection;
        if (collection) {
            this.populateCollectionForm(collection);
            document.getElementById('collectionModalTitle').textContent = 'Edit Collection';
            document.getElementById('saveCollectionBtn').textContent = 'Save Changes';
            document.getElementById('deleteCollectionBtn').style.display = 'block';
        } else {
            document.getElementById('collectionForm').reset();
            document.getElementById('collectionModalTitle').textContent = 'New Collection';
            document.getElementById('saveCollectionBtn').textContent = 'Create Collection';
            document.getElementById('deleteCollectionBtn').style.display = 'none';
        }
        this.openModal('collectionModal');
    }

    openSettingsModal() {
        this.populateSettingsForm();
        this.openModal('settingsModal');
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = '';
        
        // Reset forms
        if (modalId === 'quickAddModal') {
            document.getElementById('quickAddForm').reset();
            this.resetRating('quickRating');
            this.clearTagsInput('tagsInput');
        } else if (modalId === 'editModal') {
            this.editingBookmark = null;
        } else if (modalId === 'collectionModal') {
            this.editingCollection = null;
        }
    }

    clearTagsInput(containerId) {
        const container = document.getElementById(containerId);
        container.querySelectorAll('.tag-chip').forEach(chip => chip.remove());
    }

    // Form Handlers
    handleQuickAddSubmit(e) {
        e.preventDefault();
        
        const bookmark = {
            id: this.generateId(),
            title: document.getElementById('quickTitle').value.trim(),
            url: document.getElementById('quickUrl').value.trim(),
            description: '',
            collection: document.getElementById('quickCollection').value,
            rating: this.getRating('quickRating'),
            tags: this.getTags('tagsInput'),
            isRead: document.getElementById('markAsRead').checked,
            priority: 'medium',
            createdAt: new Date().toISOString(),
            visitCount: 0
        };

        if (!bookmark.title || !bookmark.url) {
            alert('Please fill in all required fields.');
            return;
        }

        this.bookmarks.push(bookmark);
        this.updateTagsList(bookmark.tags);
        this.saveData();
        this.renderBookmarksContainer();
        this.updateCounts();
        this.closeModal('quickAddModal');
        
        if (this.settings.enableNotifications) {
            this.showNotification('Bookmark added successfully!');
        }
    }

    handleEditSubmit(e) {
        e.preventDefault();
        
        if (!this.editingBookmark) return;

        const bookmark = this.editingBookmark;
        bookmark.title = document.getElementById('editTitle').value.trim();
        bookmark.url = document.getElementById('editUrl').value.trim();
        bookmark.description = document.getElementById('editDescription').value.trim();
        bookmark.collection = document.getElementById('editCollection').value;
        bookmark.priority = document.getElementById('editPriority').value;
        bookmark.rating = this.getRating('editRating');
        bookmark.tags = this.getTags('editTagsInput');
        bookmark.isRead = document.getElementById('editIsRead').checked;
        bookmark.notes = document.getElementById('editNotes').value.trim();
        bookmark.updatedAt = new Date().toISOString();

        this.updateTagsList(bookmark.tags);
        this.saveData();
        this.renderBookmarksContainer();
        this.updateCounts();
        this.closeModal('editModal');
        
        if (this.settings.enableNotifications) {
            this.showNotification('Bookmark updated successfully!');
        }
    }

    handleCollectionSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('collectionName').value.trim();
        const description = document.getElementById('collectionDescription').value.trim();
        const color = document.getElementById('collectionColor').value;
        const icon = document.getElementById('collectionIcon').value;

        if (!name) {
            alert('Please enter a collection name.');
            return;
        }

        if (this.editingCollection) {
            // Edit existing collection
            this.editingCollection.name = name;
            this.editingCollection.description = description;
            this.editingCollection.color = color;
            this.editingCollection.icon = icon;
            this.editingCollection.updatedAt = new Date().toISOString();
        } else {
            // Create new collection
            const collection = {
                id: this.generateId(),
                name,
                description,
                color,
                icon,
                createdAt: new Date().toISOString()
            };
            this.collections.push(collection);
        }

        this.saveData();
        this.renderCollections();
        this.populateCollectionSelects();
        this.closeModal('collectionModal');
        
        if (this.settings.enableNotifications) {
            this.showNotification(`Collection ${this.editingCollection ? 'updated' : 'created'} successfully!`);
        }
    }

    deleteCurrentBookmark() {
        if (this.editingBookmark) {
            this.deleteBookmark(this.editingBookmark.id);
            this.closeModal('editModal');
        }
    }

    deleteCurrentCollection() {
        if (this.editingCollection) {
            this.deleteCollection(this.editingCollection.id);
            this.closeModal('collectionModal');
        }
    }

    // Event Handlers
    handleRatingClick(e) {
        if (!e.target.closest('.star')) return;
        
        const container = e.target.closest('.rating-stars');
        const rating = parseInt(e.target.closest('.star').dataset.rating);
        this.setRating(container.id, rating);
    }

    handleTagInput(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = e.target.value.trim();
            if (tag) {
                this.addTag(e.target.closest('.tags-input').id, tag);
            }
        }
    }

    handleTabSwitch(e) {
        const tabName = e.target.dataset.tab;
        const container = e.target.closest('.modal, .settings-content');
        
        // Update tab buttons
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        container.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
    }

    async fetchUrlMetadata() {
        const url = document.getElementById('quickUrl').value.trim();
        if (!url) return;
        
        const btn = document.getElementById('fetchMetaBtn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
        btn.disabled = true;
        
        try {
            // Fallback to domain name as title
            const domain = new URL(url).hostname;
            document.getElementById('quickTitle').value = domain;
            
            // In a real implementation, you would use a metadata API
            // For demo purposes, we'll just use the domain
        } catch (error) {
            console.error('Failed to fetch metadata:', error);
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }

    // Context Menu
    handleContextMenu(e) {
        const bookmarkItem = e.target.closest('[data-bookmark-id]');
        const collectionItem = e.target.closest('.collection-item:not([data-collection="all"])');
        
        e.preventDefault();
        
        if (bookmarkItem) {
            this.contextMenuTarget = { type: 'bookmark', id: bookmarkItem.dataset.bookmarkId };
            this.showContextMenu(e.clientX, e.clientY, 'contextMenu');
        } else if (collectionItem) {
            this.contextMenuTarget = { type: 'collection', id: collectionItem.dataset.collection };
            this.showContextMenu(e.clientX, e.clientY, 'collectionContextMenu');
        }
    }

    showContextMenu(x, y, menuId) {
        const menu = document.getElementById(menuId);
        menu.classList.add('active');
        
        // Position menu
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = x;
        let top = y;
        
        if (left + rect.width > viewportWidth) {
            left = viewportWidth - rect.width - 10;
        }
        
        if (top + rect.height > viewportHeight) {
            top = viewportHeight - rect.height - 10;
        }
        
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    hideContextMenu() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.classList.remove('active');
        });
        this.contextMenuTarget = null;
    }

    handleContextAction(e) {
        if (!this.contextMenuTarget) return;
        
        const action = e.target.closest('.context-item').dataset.action;
        
        if (this.contextMenuTarget.type === 'bookmark') {
            const bookmark = this.bookmarks.find(b => b.id === this.contextMenuTarget.id);
            if (!bookmark) return;
            
            switch (action) {
                case 'open':
                    this.openBookmark(bookmark);
                    break;
                case 'open-new':
                    window.open(bookmark.url, '_blank');
                    break;
                case 'edit':
                    this.openEditModal(bookmark);
                    break;
                case 'copy-url':
                    navigator.clipboard.writeText(bookmark.url);
                    this.showNotification('URL copied to clipboard');
                    break;
                case 'copy-title':
                    navigator.clipboard.writeText(bookmark.title);
                    this.showNotification('Title copied to clipboard');
                    break;
                case 'favorite':
                    this.toggleFavorite(bookmark);
                    break;
                case 'delete':
                    this.deleteBookmark(bookmark.id);
                    break;
            }
        } else if (this.contextMenuTarget.type === 'collection') {
            const collection = this.collections.find(c => c.id === this.contextMenuTarget.id);
            if (!collection) return;
            
            switch (action) {
                case 'edit-collection':
                    this.openCollectionModal(collection);
                    break;
                case 'export-collection':
                    const collectionBookmarks = this.bookmarks.filter(b => b.collection === collection.id);
                    this.exportBookmarksJson(collectionBookmarks);
                    break;
                case 'delete-collection':
                    this.deleteCollection(collection.id);
                    break;
            }
        }
        
        this.hideContextMenu();
    }

    // Keyboard Shortcuts
    handleKeyboardShortcuts(e) {
        // e.preventDefault();   
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case 'n':
                
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.openQuickAddModal();
                }
                break;
            case 'f':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    document.getElementById('globalSearch').focus();
                }
                break;
            case 's':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.openSettingsModal();
                }
                break;
            case 'Escape':
                this.hideContextMenu();
                // Close any open modals
                document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                    this.closeModal(modal.id);
                });
                break;
        }
    }

    // Helper Functions
    updateCounts() {
        document.getElementById('allCount').textContent = this.bookmarks.length;
        document.getElementById('favCount').textContent = this.bookmarks.filter(b => b.rating >= 4).length;
        document.getElementById('recentCount').textContent = this.bookmarks.filter(b => this.isRecent(b.createdAt)).length;
        document.getElementById('unreadCount').textContent = this.bookmarks.filter(b => !b.isRead).length;
        document.getElementById('brokenCount').textContent = this.bookmarks.filter(b => b.isBroken).length;
    }

    updateBreadcrumb() {
        const pathElement = document.getElementById('currentPath');
        if (this.currentCollection === 'all') {
            pathElement.textContent = 'All Bookmarks';
        } else if (this.currentCollection === 'favorites') {
            pathElement.textContent = 'Favorites';
        } else if (this.currentCollection === 'recent') {
            pathElement.textContent = 'Recent';
        } else if (this.currentCollection === 'unread') {
            pathElement.textContent = 'Unread';
        } else if (this.currentCollection === 'broken') {
            pathElement.textContent = 'Broken Links';
        } else {
            const collection = this.collections.find(c => c.id === this.currentCollection);
            pathElement.textContent = collection ? collection.name : 'Unknown Collection';
        }
    }

    updateItemCount(count) {
        document.getElementById('itemCount').textContent = `${count} item${count !== 1 ? 's' : ''}`;
    }

    populateCollectionSelects() {
        const selects = ['quickCollection', 'editCollection'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            select.innerHTML = '<option value="">Select Collection</option>';
            this.collections.forEach(collection => {
                const option = document.createElement('option');
                option.value = collection.id;
                option.textContent = collection.name;
                select.appendChild(option);
            });
        });
    }

    populateEditForm(bookmark) {
        document.getElementById('editTitle').value = bookmark.title;
        document.getElementById('editUrl').value = bookmark.url;
        document.getElementById('editDescription').value = bookmark.description || '';
        document.getElementById('editCollection').value = bookmark.collection || '';
        document.getElementById('editPriority').value = bookmark.priority || 'medium';
        document.getElementById('editIsRead').checked = bookmark.isRead || false;
        document.getElementById('editNotes').value = bookmark.notes || '';
        
        this.setRating('editRating', bookmark.rating || 0);
        this.populateTagsInput('editTagsInput', bookmark.tags || []);
        
        // Update stats
        document.getElementById('createdDate').textContent = this.formatDate(bookmark.createdAt);
        document.getElementById('lastVisited').textContent = bookmark.lastVisited ? this.formatDate(bookmark.lastVisited) : 'Never';
        document.getElementById('visitCount').textContent = bookmark.visitCount || 0;
    }

    populateTagsInput(containerId, tags) {
        const container = document.getElementById(containerId);
        
        // Clear existing tags
        this.clearTagsInput(containerId);
        
        // Add tags
        tags.forEach(tag => this.addTag(containerId, tag));
    }

    populateCollectionForm(collection) {
        document.getElementById('collectionName').value = collection.name;
        document.getElementById('collectionDescription').value = collection.description || '';
        document.getElementById('collectionColor').value = collection.color;
        document.getElementById('collectionIcon').value = collection.icon;
    }

    updateStorageInfo() {
        const data = JSON.stringify({
            bookmarks: this.bookmarks,
            collections: this.collections,
            tags: this.tags,
            settings: this.settings
        });
        
        const sizeInBytes = new Blob([data]).size;
        const sizeInKB = Math.round(sizeInBytes / 1024);
        const maxSize = 5 * 1024; // 5MB typical localStorage limit
        const percentage = (sizeInKB / maxSize) * 100;
        
        const storageUsedEl = document.getElementById('storageUsed');
        const storageTextEl = document.getElementById('storageText');
        
        if (storageUsedEl) {
            storageUsedEl.style.width = `${Math.min(percentage, 100)}%`;
        }
        if (storageTextEl) {
            storageTextEl.textContent = `${sizeInKB} KB used`;
        }
    }

    clearAllData() {
        if (confirm('This will permanently delete all your bookmarks, collections, and settings. This action cannot be undone.')) {
            if (confirm('Are you absolutely sure? This will delete everything!')) {
                localStorage.clear();
                location.reload();
            }
        }
    }

    showDebugInfo() {
        const debugInfo = {
            version: this.version,
            bookmarksCount: this.bookmarks.length,
            collectionsCount: this.collections.length,
            tagsCount: this.tags.length,
            currentView: this.currentView,
            currentCollection: this.currentCollection,
            settings: this.settings,
            browser: navigator.userAgent,
            storageUsed: JSON.stringify(this.getAllData()).length
        };
        
        alert(`Debug Information:\n\n${JSON.stringify(debugInfo, null, 2)}`);
    }

    getAllData() {
        return {
            bookmarks: this.bookmarks,
            collections: this.collections,
            tags: this.tags,
            settings: this.settings
        };
    }

    showNotification(message, type = 'success') {
        if (!this.settings.enableNotifications) return;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    saveData() {
        try {
            localStorage.setItem('bookmarks', JSON.stringify(this.bookmarks));
            localStorage.setItem('collections', JSON.stringify(this.collections));
            localStorage.setItem('tags', JSON.stringify(this.tags));
            localStorage.setItem('settings', JSON.stringify(this.settings));
            this.updateStorageInfo();
            
            // Auto-backup if enabled
            if (this.settings.autoBackup) {
                const lastBackup = localStorage.getItem('lastBackup');
                const now = new Date();
                const daysSinceBackup = lastBackup ? 
                    Math.floor((now - new Date(lastBackup)) / (1000 * 60 * 60 * 24)) : 
                    Infinity;
                
                if (daysSinceBackup >= 7) {
                    this.createBackup();
                    localStorage.setItem('lastBackup', now.toISOString());
                }
            }
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Error saving data. Storage may be full.');
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new AdvancedBookmarkManager();
});