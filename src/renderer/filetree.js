// File Tree Explorer
// ==================

class FileTree {
    constructor() {
        this.rootPath = null;
        this.treeContainer = document.getElementById('fileTree');
        this.currentProject = null;
        this.watchers = new Map();
        
        this.init();
    }
    
    init() {
        // Toolbar buttons
        document.getElementById('newFileBtn').addEventListener('click', () => this.createNewFile());
        document.getElementById('newFolderBtn').addEventListener('click', () => this.createNewFolder());
        document.getElementById('refreshExplorerBtn').addEventListener('click', () => this.refresh());
        document.getElementById('collapseAllBtn').addEventListener('click', () => this.collapseAll());
        
        // Context menu
        this.contextMenu = document.getElementById('fileTreeContextMenu');
        this.contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action) this.handleContextAction(action);
        });
        
        // Sidebar tab switching
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchSidebarTab(tab.dataset.tab));
        });
        
        // Explorer panel
        document.getElementById('collapseSidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        // File tree context menu
        this.treeContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const item = e.target.closest('.file-tree-item');
            if (item) {
                this.showContextMenu(e.clientX, e.clientY, item.dataset.path, item.dataset.isDirectory === 'true');
            }
        });
        
        // File tree click
        this.treeContainer.addEventListener('click', (e) => {
            const toggle = e.target.closest('.file-tree-toggle');
            if (toggle) {
                const item = toggle.closest('.file-tree-item');
                this.toggleFolder(item);
                return;
            }
            
            const item = e.target.closest('.file-tree-item');
            if (item && !e.target.closest('.file-tree-toggle')) {
                const path = item.dataset.path;
                const isDir = item.dataset.isDirectory === 'true';
                
                if (isDir) {
                    this.toggleFolder(item);
                } else {
                    this.openFile(path);
                }
            }
        });
        
        // Double click to open
        this.treeContainer.addEventListener('dblclick', (e) => {
            const item = e.target.closest('.file-tree-item');
            if (item && item.dataset.isDirectory !== 'true') {
                this.openFile(item.dataset.path);
            }
        });
    }
    
    async setProject(projectPath) {
        this.rootPath = projectPath;
        this.currentProject = projectPath;
        await this.refresh();
        
        // Update sidebar title
        const projectName = projectPath.split('/').pop();
        document.getElementById('sidebarTitle').innerHTML = `<i class="fas fa-folder"></i> ${projectName}`;
        
        // Start watching for changes
        this.startWatcher(projectPath);
    }
    
    startWatcher(projectPath) {
        // Stop existing watcher
        if (this.watchers.has(projectPath)) {
            this.watchers.get(projectPath).close();
        }
        
        // Note: In Electron, we'd use chokidar or native fs.watch
        // For now, we'll rely on manual refresh or IPC events
        window.electronAPI.on('project:fileChanged', (data) => {
            if (data.path.startsWith(projectPath)) {
                this.refresh();
            }
        });
    }
    
    async refresh() {
        if (!this.rootPath) return;
        
        try {
            const result = await window.electronAPI.fs.readDir(this.rootPath);
            if (result.success) {
                this.renderTree(this.rootPath, result.items);
            }
        } catch (error) {
            console.error('Failed to refresh file tree:', error);
        }
    }
    
    renderTree(rootPath, items, parentElement = null) {
        const container = parentElement || this.treeContainer;
        
        if (!parentElement) {
            container.innerHTML = '';
        }
        
        // Sort: directories first, then files, alphabetically
        items.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        items.forEach(item => {
            const element = this.createTreeItem(item, rootPath);
            container.appendChild(element);
            
            if (item.isDirectory) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'file-tree-children';
                childrenContainer.style.display = 'none';
                childrenContainer.dataset.path = item.path;
                container.appendChild(childrenContainer);
                
                // Load children on expand (lazy loading)
                element.querySelector('.file-tree-toggle').addEventListener('click', async () => {
                    if (!childrenContainer.dataset.loaded) {
                        await this.loadChildren(item.path, childrenContainer);
                        childrenContainer.dataset.loaded = 'true';
                    }
                    this.toggleFolder(element);
                });
            }
        });
    }
    
    createTreeItem(item, rootPath) {
        const div = document.createElement('div');
        div.className = 'file-tree-item';
        div.dataset.path = item.path;
        div.dataset.isDirectory = item.isDirectory;
        
        const relativePath = path.relative(rootPath, item.path);
        const depth = relativePath.split('/').length - 1;
        
        const indent = document.createElement('div');
        indent.className = 'file-tree-indent';
        indent.style.width = `${depth * 16}px`;
        
        const toggle = document.createElement('div');
        toggle.className = 'file-tree-toggle';
        toggle.innerHTML = item.isDirectory ? '<i class="fas fa-chevron-right"></i>' : '';
        
        const icon = document.createElement('div');
        icon.className = 'file-tree-icon';
        icon.innerHTML = this.getFileIcon(item.name, item.isDirectory);
        
        const name = document.createElement('div');
        name.className = 'file-tree-name';
        name.textContent = item.name;
        if (!item.isDirectory) {
            name.title = item.path;
        }
        
        div.appendChild(indent);
        div.appendChild(toggle);
        div.appendChild(icon);
        div.appendChild(name);
        
        return div;
    }
    
    getFileIcon(name, isDirectory) {
        if (isDirectory) return '<i class="fas fa-folder"></i>';
        
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
            'ghost': '<i class="fas fa-ghost" style="color: #c586c0;"></i>',
            'gh': '<i class="fas fa-ghost" style="color: #c586c0;"></i>',
            'js': '<i class="fab fa-js" style="color: #dcdcaa;"></i>',
            'ts': '<i class="fab fa-js" style="color: #4ec9b0;"></i>',
            'py': '<i class="fab fa-python" style="color: #4ec9b0;"></i>',
            'rs': '<i class="fas fa-cog" style="color: #ce9178;"></i>',
            'cpp': '<i class="fas fa-code" style="color: #569cd6;"></i>',
            'c': '<i class="fas fa-code" style="color: #569cd6;"></i>',
            'h': '<i class="fas fa-file-code" style="color: #569cd6;"></i>',
            'json': '<i class="fas fa-braces" style="color: #dcdcaa;"></i>',
            'md': '<i class="fas fa-file-alt" style="color: #ce9178;"></i>',
            'toml': '<i class="fas fa-cogs" style="color: #4ec9b0;"></i>',
            'yaml': '<i class="fas fa-cogs" style="color: #4ec9b0;"></i>',
            'yml': '<i class="fas fa-cogs" style="color: #4ec9b0;"></i>',
            'html': '<i class="fab fa-html5" style="color: #ce9178;"></i>',
            'css': '<i class="fab fa-css3-alt" style="color: #569cd6;"></i>',
            'txt': '<i class="fas fa-file-alt" style="color: #969696;"></i>'
        };
        
        return icons[ext] || '<i class="fas fa-file" style="color: #969696;"></i>';
    }
    
    async loadChildren(dirPath, container) {
        try {
            const result = await window.electronAPI.fs.readDir(dirPath);
            if (result.success) {
                this.renderTree(this.rootPath, result.items, container);
            }
        } catch (error) {
            console.error('Failed to load children:', error);
        }
    }
    
    toggleFolder(itemElement) {
        const path = itemElement.dataset.path;
        const childrenContainer = this.treeContainer.querySelector(`.file-tree-children[data-path="${path}"]`);
        const toggle = itemElement.querySelector('.file-tree-toggle');
        
        if (!childrenContainer) return;
        
        const isExpanded = childrenContainer.style.display !== 'none';
        
        if (isExpanded) {
            childrenContainer.style.display = 'none';
            toggle.innerHTML = '<i class="fas fa-chevron-right"></i>';
            itemElement.classList.remove('expanded');
        } else {
            childrenContainer.style.display = 'block';
            toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
            itemElement.classList.add('expanded');
        }
    }
    
    collapseAll() {
        this.treeContainer.querySelectorAll('.file-tree-item.expanded').forEach(item => {
            this.toggleFolder(item);
        });
    }
    
    clear() {
        this.rootPath = null;
        this.currentProject = null;
        this.treeContainer.innerHTML = '';
        document.getElementById('sidebarTitle').innerHTML = '<i class="fas fa-file-alt"></i> Explorer';
    }
    
    async createNewFile() {
        if (!this.rootPath) return;
        
        const name = prompt('Enter file name:', 'new-file.ghost');
        if (!name) return;
        
        const filePath = path.join(this.rootPath, name);
        
        try {
            await window.electronAPI.fs.writeFile(filePath, '');
            await this.refresh();
            
            // Open in editor
            this.openFile(filePath);
        } catch (error) {
            alert('Failed to create file: ' + error.message);
        }
    }
    
    async createNewFolder() {
        if (!this.rootPath) return;
        
        const name = prompt('Enter folder name:', 'new-folder');
        if (!name) return;
        
        const dirPath = path.join(this.rootPath, name);
        
        try {
            await window.electronAPI.fs.mkdir(dirPath);
            await this.refresh();
        } catch (error) {
            alert('Failed to create folder: ' + error.message);
        }
    }
    
    openFile(filePath) {
        // Open in editor directly
        if (window.editorManager) {
            const existing = window.editorManager.findEditorByPath(filePath);
            if (existing) {
                window.editorManager.switchToEditor(existing.id);
            } else {
                window.editorManager.createEditor(filePath);
            }
        }
    }
    
    showContextMenu(x, y, itemPath, isDirectory) {
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.add('show');
        this.contextMenu.dataset.path = itemPath;
        this.contextMenu.dataset.isDirectory = isDirectory;
        
        // Update menu items based on type
        this.contextMenu.querySelectorAll('[data-action]').forEach(item => {
            item.style.display = 'block';
        });
        
        if (!isDirectory) {
            this.contextMenu.querySelector('[data-action="new-file"]').style.display = 'none';
            this.contextMenu.querySelector('[data-action="new-folder"]').style.display = 'none';
        }
        
        // Close on click outside
        const closeHandler = (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.contextMenu.classList.remove('show');
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }
    
    handleContextAction(action) {
        const path = this.contextMenu.dataset.path;
        const isDirectory = this.contextMenu.dataset.isDirectory === 'true';
        this.contextMenu.classList.remove('show');
        
        switch (action) {
            case 'new-file':
                this.createNewFileIn(path);
                break;
            case 'new-folder':
                this.createNewFolderIn(path);
                break;
            case 'rename':
                this.renameItem(path);
                break;
            case 'delete':
                this.deleteItem(path);
                break;
            case 'copy-path':
                navigator.clipboard.writeText(path);
                break;
            case 'reveal-in-explorer':
                window.electronAPI.shell.showItemInFolder(path);
                break;
            case 'open-terminal':
                window.electronAPI.send('terminal:open', { cwd: isDirectory ? path : path.split('/').slice(0, -1).join('/') });
                break;
        }
    }
    
    async createNewFileIn(dirPath) {
        const name = prompt('Enter file name:', 'new-file.ghost');
        if (!name) return;
        
        const filePath = path.join(dirPath, name);
        try {
            await window.electronAPI.fs.writeFile(filePath, '');
            await this.refresh();
            this.openFile(filePath);
        } catch (error) {
            alert('Failed to create file: ' + error.message);
        }
    }
    
    async createNewFolderIn(dirPath) {
        const name = prompt('Enter folder name:', 'new-folder');
        if (!name) return;
        
        const newPath = path.join(dirPath, name);
        try {
            await window.electronAPI.fs.mkdir(newPath);
            await this.refresh();
        } catch (error) {
            alert('Failed to create folder: ' + error.message);
        }
    }
    
    async renameItem(itemPath) {
        const currentName = path.basename(itemPath);
        const newName = prompt('Enter new name:', currentName);
        if (!newName || newName === currentName) return;
        
        const newPath = path.join(path.dirname(itemPath), newName);
        try {
            await window.electronAPI.fs.rename(itemPath, newPath);
            await this.refresh();
        } catch (error) {
            alert('Failed to rename: ' + error.message);
        }
    }
    
    async deleteItem(itemPath) {
        const name = path.basename(itemPath);
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        
        try {
            await window.electronAPI.fs.delete(itemPath);
            await this.refresh();
        } catch (error) {
            alert('Failed to delete: ' + error.message);
        }
    }
    
    switchSidebarTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}Panel`);
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.fileTree = new FileTree();
});

// Need path module - use exposed nodeAPI
const path = window.nodeAPI.path;