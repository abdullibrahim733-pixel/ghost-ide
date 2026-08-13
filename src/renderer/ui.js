// UI Management
// =============

class UIManager {
    constructor() {
        this.sidebarCollapsed = false;
        this.panelCollapsed = false;
        this.currentProject = null;
        this.openFiles = [];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadSettings().catch(err => console.error('Failed to load settings:', err));
        this.setupDragAndDrop();
        this.showWelcomeScreen().catch(err => console.error('Failed to show welcome screen:', err));
    }
    
    bindEvents() {
        // Window controls
        document.getElementById('minimizeBtn').addEventListener('click', () => window.electronAPI.window.minimize());
        document.getElementById('maximizeBtn').addEventListener('click', () => window.electronAPI.window.maximize());
        document.getElementById('closeBtn').addEventListener('click', () => window.electronAPI.window.close());
        
        // Sidebar collapse
        document.getElementById('collapseSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebarResizer').addEventListener('mousedown', (e) => this.startSidebarResize(e));
        
        // Panel collapse
        document.getElementById('closePanelBtn').addEventListener('click', () => this.togglePanel());
        document.getElementById('panelResizer').addEventListener('mousedown', (e) => this.startPanelResize(e));
        
        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchSidebarTab(tab.dataset.tab));
        });
        
        // Panel tabs
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchPanelTab(tab.dataset.panel));
        });
        
        // Target selector
        document.getElementById('targetSelect').addEventListener('change', (e) => this.setTarget(e.target.value));
        
        // Menu bar
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => this.toggleMenu(e.currentTarget.dataset.menu));
        });
        
        // Dropdown menus
        document.querySelectorAll('.menu-item-action').forEach(item => {
            item.addEventListener('click', () => this.handleMenuAction(item.dataset.action));
        });
        
        // Click outside to close menus
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-item') && !e.target.closest('.dropdown-menu')) {
                this.closeAllMenus();
            }
            if (!e.target.closest('.context-menu')) {
                this.closeAllContextMenus();
            }
        });
        
        // Context menus
        this.setupContextMenus();
        
        // Modals
        this.setupModals();
        
        // Command palette
        this.setupCommandPalette();
        
        // Settings
        this.setupSettings();
        
        // Explorer toolbar
        document.getElementById('newFileBtn').addEventListener('click', () => this.createNewFile());
        document.getElementById('newFolderBtn').addEventListener('click', () => this.createNewFolder());
        document.getElementById('refreshExplorerBtn').addEventListener('click', () => this.refreshExplorer());
        document.getElementById('collapseAllBtn').addEventListener('click', () => window.fileTree?.collapseAll());
        
        // Ghost actions
        document.getElementById('ghostBuildBtn').addEventListener('click', () => this.ghostBuild());
        document.getElementById('ghostRunBtn').addEventListener('click', () => this.ghostRun());
        document.getElementById('ghostFlashBtn').addEventListener('click', () => this.ghostFlash());
        document.getElementById('ghostCheckBtn').addEventListener('click', () => this.ghostCheck());
        
        // Output panel
        document.getElementById('clearOutputBtn').addEventListener('click', () => this.clearOutput());
        
        // Problems panel
        document.getElementById('problemsFilter').addEventListener('change', (e) => this.filterProblems(e.target.value));
        
        // Keyboard shortcuts
        this.bindKeyboardShortcuts();
        
        // Ghost output
        window.electronAPI.on('ghost:output', (data) => this.handleGhostOutput(data));
        
        // Session restore
        window.electronAPI.on('session:restore', (data) => this.restoreSession(data));
        
        // File changes
        window.electronAPI.on('project:fileChanged', (data) => this.handleFileChange(data));
    }
    
    setupContextMenus() {
        // File tree context menu
        document.addEventListener('contextmenu', (e) => {
            const fileItem = e.target.closest('.file-tree-item');
            if (fileItem) {
                e.preventDefault();
                this.showContextMenu('fileTreeContextMenu', e.clientX, e.clientY, {
                    path: fileItem.dataset.path,
                    isDirectory: fileItem.dataset.isDirectory === 'true'
                });
            }
            
            const editorTab = e.target.closest('.editor-tab');
            if (editorTab) {
                e.preventDefault();
                this.showContextMenu('tabContextMenu', e.clientX, e.clientY, {
                    editorId: editorTab.dataset.editorId
                });
            }
            
            const terminalTab = e.target.closest('.terminal-tab');
            if (terminalTab) {
                e.preventDefault();
                this.showContextMenu('tabContextMenu', e.clientX, e.clientY, {
                    terminalId: terminalTab.dataset.terminalId
                });
            }
        });
        
        // Context menu actions
        document.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => this.handleContextAction(item.dataset.action));
        });
    }
    
    showContextMenu(menuId, x, y, data) {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        
        // Store data
        Object.assign(menu.dataset, data);
        
        // Position menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.add('show');
    }
    
    closeAllContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => menu.classList.remove('show'));
    }
    
    handleContextAction(action) {
        const menu = document.querySelector('.context-menu.show');
        if (!menu) return;
        
        const path = menu.dataset.path;
        const isDirectory = menu.dataset.isDirectory === 'true';
        
        switch (action) {
            case 'new-file':
                window.fileTree?.createNewFileIn(path);
                break;
            case 'new-folder':
                window.fileTree?.createNewFolderIn(path);
                break;
            case 'rename':
                window.fileTree?.renameItem(path);
                break;
            case 'delete':
                window.fileTree?.deleteItem(path);
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
        
        this.closeAllContextMenus();
    }
    
    setupModals() {
        // Welcome modal
        document.getElementById('welcomeNewProject').addEventListener('click', () => this.showNewProjectModal());
        document.getElementById('welcomeOpenProject').addEventListener('click', () => this.openProject());
        document.getElementById('welcomeOpenFolder').addEventListener('click', () => this.openFolder());
        document.getElementById('welcomeNewFile').addEventListener('click', () => this.createNewFile());
        
        // Settings modal
        document.getElementById('settingsCloseBtn').addEventListener('click', () => this.hideModal('settingsModal'));
        document.getElementById('settingsSaveBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('settingsResetBtn').addEventListener('click', () => this.resetSettings());
        
        // Settings tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchSettingsTab(tab.dataset.tab));
        });
        
        // New project modal
        document.getElementById('newProjectCloseBtn').addEventListener('click', () => this.hideModal('newProjectModal'));
        document.getElementById('newProjectCancelBtn').addEventListener('click', () => this.hideModal('newProjectModal'));
        document.getElementById('newProjectCreateBtn').addEventListener('click', () => this.createProject());
        document.getElementById('browseLocationBtn').addEventListener('click', () => this.browseProjectLocation());
        
        // About modal
        document.getElementById('aboutCloseBtn').addEventListener('click', () => this.hideModal('aboutModal'));
        
        // Close modals on overlay click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }
    
    setupCommandPalette() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.showCommandPalette();
            }
            if (e.key === 'Escape') {
                this.hideCommandPalette();
                this.closeAllMenus();
                this.closeAllContextMenus();
                this.hideModals();
            }
        });
        
        const paletteInput = document.getElementById('paletteInput');
        paletteInput.addEventListener('input', (e) => this.filterCommandPalette(e.target.value));
        paletteInput.addEventListener('keydown', (e) => this.handlePaletteKeydown(e));
    }
    
    setupSettings() {
        // Theme
        document.getElementById('themeSelect').addEventListener('change', (e) => this.applyTheme(e.target.value));
        
        // Font size
        const fontSizeRange = document.getElementById('fontSizeRange');
        fontSizeRange.addEventListener('input', (e) => {
            document.getElementById('fontSizeValue').textContent = `${e.target.value}px`;
            this.updateEditorFontSize(e.target.value);
        });
        
        // Terminal font size
        const termFontSizeRange = document.getElementById('termFontSizeRange');
        termFontSizeRange.addEventListener('input', (e) => {
            document.getElementById('termFontSizeValue').textContent = `${e.target.value}px`;
            this.updateTerminalFontSize(e.target.value);
        });
        
        // Tab size
        document.getElementById('tabSizeSelect').addEventListener('change', (e) => this.updateTabSize(e.target.value));
        
        // Word wrap
        document.getElementById('wordWrap').addEventListener('change', (e) => this.updateWordWrap(e.target.checked));
        
        // Line numbers
        document.getElementById('lineNumbers').addEventListener('change', (e) => this.updateLineNumbers(e.target.checked));
        
        // Minimap
        document.getElementById('minimap').addEventListener('change', (e) => this.updateMinimap(e.target.checked));
        
        // Ghost compiler path
        document.getElementById('browseCompilerBtn').addEventListener('click', () => this.browseCompilerPath());
        
        // Load keybindings
        this.loadKeybindings();
    }
    
    async loadSettings() {
        const settings = await window.electronAPI.settings.getAll();
        
        // Apply theme
        this.applyTheme(settings.theme || 'dark');
        
        // Apply font size
        if (settings.fontSize) {
            document.getElementById('fontSizeRange').value = settings.fontSize;
            document.getElementById('fontSizeValue').textContent = `${settings.fontSize}px`;
            this.updateEditorFontSize(settings.fontSize);
        }
        
        // Apply tab size
        if (settings.tabSize) {
            document.getElementById('tabSizeSelect').value = settings.tabSize;
            this.updateTabSize(settings.tabSize);
        }
        
        // Word wrap
        document.getElementById('wordWrap').checked = settings.wordWrap !== false;
        this.updateWordWrap(settings.wordWrap !== false);
        
        // Line numbers
        document.getElementById('lineNumbers').checked = settings.lineNumbers !== false;
        this.updateLineNumbers(settings.lineNumbers !== false);
        
        // Minimap
        document.getElementById('minimap').checked = settings.minimap !== false;
        this.updateMinimap(settings.minimap !== false);
        
        // Terminal font size
        if (settings.terminalFontSize) {
            document.getElementById('termFontSizeRange').value = settings.terminalFontSize;
            document.getElementById('termFontSizeValue').textContent = `${settings.terminalFontSize}px`;
            this.updateTerminalFontSize(settings.terminalFontSize);
        }
        
        // Ghost settings
        document.getElementById('ghostCompilerPath').value = settings.ghostCompilerPath || 'ghc';
        document.getElementById('defaultTargetSelect').value = settings.defaultTarget || 'stm32f411';
        document.getElementById('defaultOptLevel').value = settings.defaultOptLevel || '2';
        
        // Serial settings
        document.getElementById('defaultBaudSelect').value = settings.baudRate || '115200';
        
        // Auto save
        document.getElementById('autoSave').checked = settings.autoSave !== false;
        
        // Restore session
        document.getElementById('restoreSession').checked = settings.restoreSession !== false;
    }
    
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        window.electronAPI.settings.set('theme', theme);
    }
    
    updateEditorFontSize(size) {
        document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
        window.electronAPI.settings.set('fontSize', parseInt(size));
    }
    
    updateTerminalFontSize(size) {
        if (window.terminalManager) {
            window.terminalManager.terminals.forEach(data => {
                data.xterm.options.fontSize = parseInt(size);
            });
        }
        window.electronAPI.settings.set('terminalFontSize', parseInt(size));
    }
    
    updateTabSize(size) {
        if (window.editorManager) {
            window.editorManager.editors.forEach(data => {
                data.editor.setOption('tabSize', parseInt(size));
                data.editor.setOption('indentUnit', parseInt(size));
            });
        }
        window.electronAPI.settings.set('tabSize', parseInt(size));
    }
    
    updateWordWrap(enabled) {
        if (window.editorManager) {
            window.editorManager.editors.forEach(data => {
                data.editor.setOption('lineWrapping', enabled);
            });
        }
        window.electronAPI.settings.set('wordWrap', enabled);
    }
    
    updateLineNumbers(enabled) {
        if (window.editorManager) {
            window.editorManager.editors.forEach(data => {
                data.editor.setOption('lineNumbers', enabled);
            });
        }
        window.electronAPI.settings.set('lineNumbers', enabled);
    }
    
    updateMinimap(enabled) {
        if (window.editorManager) {
            window.editorManager.editors.forEach(data => {
                // CodeMirror doesn't have built-in minimap, would need addon
            });
        }
        window.electronAPI.settings.set('minimap', enabled);
    }
    
    saveSettings() {
        const settings = {
            theme: document.getElementById('themeSelect').value,
            fontSize: parseInt(document.getElementById('fontSizeRange').value),
            tabSize: parseInt(document.getElementById('tabSizeSelect').value),
            wordWrap: document.getElementById('wordWrap').checked,
            lineNumbers: document.getElementById('lineNumbers').checked,
            minimap: document.getElementById('minimap').checked,
            terminalFontSize: parseInt(document.getElementById('termFontSizeRange').value),
            ghostCompilerPath: document.getElementById('ghostCompilerPath').value,
            defaultTarget: document.getElementById('defaultTargetSelect').value,
            defaultOptLevel: document.getElementById('defaultOptLevel').value,
            baudRate: document.getElementById('defaultBaudSelect').value,
            autoSave: document.getElementById('autoSave').checked,
            restoreSession: document.getElementById('restoreSession').checked
        };
        
        Object.entries(settings).forEach(([key, value]) => {
            window.electronAPI.settings.set(key, value);
        });
        
        this.hideModal('settingsModal');
        this.showNotification('Settings saved');
    }
    
    resetSettings() {
        if (confirm('Reset all settings to defaults?')) {
            window.electronAPI.settings.set('theme', 'dark');
            window.electronAPI.settings.set('fontSize', 14);
            window.electronAPI.settings.set('tabSize', 4);
            window.electronAPI.settings.set('wordWrap', true);
            window.electronAPI.settings.set('lineNumbers', true);
            window.electronAPI.settings.set('minimap', true);
            window.electronAPI.settings.set('terminalFontSize', 13);
            window.electronAPI.settings.set('ghostCompilerPath', 'ghc');
            window.electronAPI.settings.set('defaultTarget', 'stm32f411');
            window.electronAPI.settings.set('defaultOptLevel', '2');
            window.electronAPI.settings.set('baudRate', '115200');
            window.electronAPI.settings.set('autoSave', true);
            window.electronAPI.settings.set('restoreSession', true);
            
            this.loadSettings();
        }
    }
    
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed', this.sidebarCollapsed);
        document.getElementById('collapseSidebar').querySelector('i').className = 
            this.sidebarCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    }
    
    togglePanel() {
        this.panelCollapsed = !this.panelCollapsed;
        document.getElementById('bottomPanel').classList.toggle('collapsed', this.panelCollapsed);
        document.getElementById('closePanelBtn').querySelector('i').className = 
            this.panelCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }
    
    startSidebarResize(e) {
        e.preventDefault();
        const startX = e.clientX;
        const sidebar = document.getElementById('sidebar');
        const startWidth = sidebar.offsetWidth;
        
        const onMove = (e) => {
            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth >= 200 && newWidth <= 400) {
                sidebar.style.width = `${newWidth}px`;
            }
        };
        
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    
    startPanelResize(e) {
        e.preventDefault();
        const startY = e.clientY;
        const panel = document.getElementById('bottomPanel');
        const startHeight = panel.offsetHeight;
        
        const onMove = (e) => {
            const newHeight = startHeight - (e.clientY - startY);
            if (newHeight >= 100 && newHeight <= 500) {
                panel.style.height = `${newHeight}px`;
            }
        };
        
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    
    switchSidebarTab(tabName) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}Panel`);
        });
        
        // Update sidebar title
        const titles = {
            explorer: '<i class="fas fa-file-alt"></i> Explorer',
            search: '<i class="fas fa-search"></i> Search',
            git: '<i class="fab fa-git-alt"></i> Git',
            debug: '<i class="fas fa-bug"></i> Debug',
            extensions: '<i class="fas fa-puzzle-piece"></i> Extensions'
        };
        document.getElementById('sidebarTitle').innerHTML = titles[tabName] || titles.explorer;
    }
    
    switchPanelTab(panelName) {
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panel === panelName);
        });
        
        document.querySelectorAll('.panel-tab-content').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${panelName}Panel`);
        });
    }
    
    switchSettingsTab(tabName) {
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}Settings`);
        });
    }
    
    toggleMenu(menuName) {
        // Close all other menus
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            if (menu.id !== menuName) menu.classList.remove('show');
        });
        
        // Toggle this menu
        const menu = document.getElementById(menuName);
        if (menu) {
            menu.classList.toggle('show');
            
            // Position menu
            const trigger = document.querySelector(`[data-menu="${menuName}"]`);
            if (trigger && menu.classList.contains('show')) {
                const rect = trigger.getBoundingClientRect();
                menu.style.left = `${rect.left}px`;
                menu.style.top = `${rect.bottom}px`;
            }
        }
        
        // Update active state
        document.querySelectorAll('.menu-item').forEach(item => {
            const isActive = menu && menu.classList.contains('show') && item.dataset.menu === menuName;
            item.classList.toggle('active', isActive);
        });
    }
    
    closeAllMenus() {
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    }
    
    handleMenuAction(action) {
        this.closeAllMenus();
        
        switch (action) {
            case 'new-file': this.createNewFile(); break;
            case 'open-file': this.openFile(); break;
            case 'open-folder': this.openFolder(); break;
            case 'save': this.saveActiveFile(); break;
            case 'save-as': this.saveActiveFileAs(); break;
            case 'save-all': this.saveAllFiles(); break;
            case 'new-project': this.showNewProjectModal(); break;
            case 'open-project': this.openProject(); break;
            case 'close-folder': this.closeFolder(); break;
            case 'close-editor': this.closeActiveEditor(); break;
            case 'undo': this.undo(); break;
            case 'redo': this.redo(); break;
            case 'cut': this.cut(); break;
            case 'copy': this.copy(); break;
            case 'paste': this.paste(); break;
            case 'find': this.find(); break;
            case 'replace': this.replace(); break;
            case 'find-in-files': this.findInFiles(); break;
            case 'select-all': this.selectAll(); break;
            case 'expand-selection': this.expandSelection(); break;
            case 'shrink-selection': this.shrinkSelection(); break;
            case 'add-cursor-above': this.addCursorAbove(); break;
            case 'add-cursor-below': this.addCursorBelow(); break;
            case 'toggle-sidebar': this.toggleSidebar(); break;
            case 'toggle-panel': this.togglePanel(); break;
            case 'show-explorer': this.switchSidebarTab('explorer'); break;
            case 'show-search': this.switchSidebarTab('search'); break;
            case 'show-git': this.switchSidebarTab('git'); break;
            case 'show-debug': this.switchSidebarTab('debug'); break;
            case 'show-extensions': this.switchSidebarTab('extensions'); break;
            case 'show-terminal': this.showPanel('terminal'); break;
            case 'show-output': this.showPanel('output'); break;
            case 'show-problems': this.showPanel('problems'); break;
            case 'toggle-zen': this.toggleZenMode(); break;
            case 'toggle-fullscreen': this.toggleFullscreen(); break;
            case 'ghost-build': this.ghostBuild(); break;
            case 'ghost-run': this.ghostRun(); break;
            case 'ghost-flash': this.ghostFlash(); break;
            case 'ghost-check': this.ghostCheck(); break;
            case 'ghost-format': this.formatDocument(); break;
            case 'ghost-tokens': this.showTokens(); break;
            case 'ghost-ast': this.showAST(); break;
            case 'ghost-ir': this.showIR(); break;
            case 'ghost-llvm': this.showLLVM(); break;
            case 'ghost-c': this.showC(); break;
            case 'ghost-serial': this.showPanel('serial'); break;
            case 'ghost-target': this.selectTarget(); break;
            case 'ghost-compiler-settings': this.showSettings(); break;
            case 'terminal-new': window.terminalManager?.createTerminal(); break;
            case 'terminal-split': window.terminalManager?.splitTerminal(); break;
            case 'terminal-run-task': this.runTask(); break;
            case 'terminal-configure': this.configureTasks(); break;
            case 'help-welcome': this.showWelcomeScreen(); break;
            case 'help-docs': window.electronAPI.shell.openExternal('https://ghost-lang.dev/docs'); break;
            case 'help-api': window.electronAPI.shell.openExternal('https://ghost-lang.dev/api'); break;
            case 'help-examples': window.electronAPI.shell.openExternal('https://ghost-lang.dev/examples'); break;
            case 'help-keybindings': this.showKeybindings(); break;
            case 'check-updates': this.checkUpdates(); break;
            case 'show-about': this.showAbout(); break;
        }
    }
    
    async showWelcomeScreen() {
        await this.updateRecentProjectsList();
        this.showModal('welcomeModal');
    }
    
    async updateRecentProjectsList() {
        const list = document.getElementById('welcomeRecentList');
        const menuList = document.getElementById('recentProjectsMenu');
        
        const projects = await window.electronAPI.projects.getRecent();
        
        list.innerHTML = '';
        menuList.innerHTML = '';
        
        if (projects.length === 0) {
            list.innerHTML = '<div class="no-recent">No recent projects</div>';
            menuList.innerHTML = '<div class="menu-item-action" style="color: var(--fg-muted);">No recent projects</div>';
            return;
        }
        
        projects.forEach(project => {
            // Welcome screen
            const item = document.createElement('div');
            item.className = 'recent-list-item';
            item.innerHTML = `
                <i class="fas fa-folder"></i>
                <div>
                    <div class="name">${project.name || project.path.split('/').pop()}</div>
                    <div class="path">${project.path}</div>
                </div>
            `;
            item.addEventListener('click', () => this.openRecentProject(project.path));
            list.appendChild(item);
            
            // Menu
            const menuItem = document.createElement('div');
            menuItem.className = 'recent-item';
            menuItem.innerHTML = `
                <i class="fas fa-folder"></i>
                <span>${project.name || project.path.split('/').pop()}</span>
                <span class="shortcut">${project.path}</span>
            `;
            menuItem.addEventListener('click', () => this.openRecentProject(project.path));
            menuList.appendChild(menuItem);
        });
    }
    
    async openRecentProject(path) {
        const result = await window.electronAPI.project.open(path);
        if (result.success) {
            this.loadProject(path);
            this.hideModal('welcomeModal');
        }
    }
    
    showNewProjectModal() {
        this.hideModal('welcomeModal');
        document.getElementById('projectLocationInput').value = window.nodeAPI.os.homedir();
        this.showModal('newProjectModal');
    }
    
    async browseProjectLocation() {
        const result = await window.electronAPI.dialog.openFolder();
        if (result.success && !result.canceled && result.filePaths.length > 0) {
            document.getElementById('projectLocationInput').value = result.filePaths[0];
        }
    }
    
    async createProject() {
        const name = document.getElementById('projectNameInput').value;
        const location = document.getElementById('projectLocationInput').value;
        const template = document.getElementById('projectTemplateSelect').value;
        const target = document.getElementById('projectTargetSelect').value;
        
        if (!name || !location) {
            alert('Please fill in all fields');
            return;
        }
        
        const result = await window.electronAPI.project.create(location, name, template);
        if (result.success) {
            this.hideModal('newProjectModal');
            this.loadProject(result.path);
        } else {
            alert('Failed to create project: ' + result.error);
        }
    }
    
    async openProject() {
        const result = await window.electronAPI.dialog.openFolder();
        if (result.success && !result.canceled && result.filePaths.length > 0) {
            const openResult = await window.electronAPI.project.open(result.filePaths[0]);
            if (openResult.success) {
                this.loadProject(result.filePaths[0]);
            } else {
                // Not a Ghost project, open as folder
                this.openFolder(result.filePaths[0]);
            }
        }
    }
    
    async openFolder(folderPath = null) {
        let path = folderPath;
        if (!path) {
            const result = await window.electronAPI.dialog.openFolder();
            if (result.success && !result.canceled && result.filePaths.length > 0) {
                path = result.filePaths[0];
            } else {
                return;
            }
        }
        
        this.loadFolder(path);
    }
    
    loadProject(projectPath) {
        this.currentProject = projectPath;
        window.fileTree?.setProject(projectPath);
        this.updateWindowTitle(projectPath);
        
        // Open main.ghost if exists
        const mainFile = window.nodeAPI.path.join(projectPath, 'src', 'main.ghost');
        window.electronAPI.fs.readFile(mainFile).then(result => {
            if (result.success) {
                this.openFile(mainFile);
            }
        }).catch(() => {});
    }
    
    loadFolder(folderPath) {
        this.currentProject = folderPath;
        window.fileTree?.setProject(folderPath);
        this.updateWindowTitle(folderPath);
    }
    
    closeFolder() {
        this.currentProject = null;
        window.fileTree?.clear();
        this.updateWindowTitle();
    }
    
    updateWindowTitle(projectPath = null) {
        const title = projectPath ? `${window.nodeAPI.path.basename(projectPath)} - Ghost IDE` : 'Ghost IDE';
        document.getElementById('windowTitle').textContent = title;
        document.title = title;
    }
    
    async createNewFile() {
        const editorId = window.editorManager?.createEditor();
        if (editorId) {
            const editor = window.editorManager.editors.get(editorId);
            if (editor) {
                editor.filePath = null;
                editor.dirty = true;
                editor.tab.querySelector('.tab-name').textContent = 'Untitled';
            }
        }
    }
    
    async openFile(filePath = null) {
        if (!filePath) {
            const result = await window.electronAPI.dialog.openFile();
            if (result.success && !result.canceled && result.filePaths.length > 0) {
                filePath = result.filePaths[0];
            } else {
                return;
            }
        }
        
        // Check if already open
        const existing = window.editorManager?.findEditorByPath(filePath);
        if (existing) {
            window.editorManager?.switchToEditor(existing.id);
            return;
        }
        
        try {
            const content = await window.electronAPI.fs.readFile(filePath);
            if (content.success) {
                const editorId = window.editorManager?.createEditor(filePath, content.content);
                if (editorId) {
                    window.editorManager?.switchToEditor(editorId);
                }
            }
        } catch (error) {
            alert('Failed to open file: ' + error.message);
        }
    }
    
    async saveActiveFile() {
        const activeId = window.editorManager?.activeEditor;
        if (!activeId) return;
        
        const editor = window.editorManager.editors.get(activeId);
        if (!editor) return;
        
        if (!editor.filePath) {
            await this.saveActiveFileAs();
            return;
        }
        
        await this.saveFile(editor, editor.filePath);
    }
    
    async saveActiveFileAs() {
        const activeId = window.editorManager?.activeEditor;
        if (!activeId) return;
        
        const editor = window.editorManager.editors.get(activeId);
        if (!editor) return;
        
        const result = await window.electronAPI.dialog.saveFile({
            filters: [
                { name: 'Ghost Files', extensions: ['ghost', 'gh'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (result.success && !result.canceled) {
            await this.saveFile(editor, result.filePath);
        }
    }
    
    async saveFile(editor, filePath) {
        try {
            await window.electronAPI.fs.writeFile(filePath, editor.editor.getValue());
            editor.filePath = filePath;
            editor.dirty = false;
            editor.tab.querySelector('.tab-name').textContent = window.nodeAPI.path.basename(filePath);
            editor.tab.classList.remove('dirty');
            
            // Update file tree
            window.fileTree?.refresh();
        } catch (error) {
            alert('Failed to save file: ' + error.message);
        }
    }
    
    async saveAllFiles() {
        if (!window.editorManager) return;
        
        for (const [id, editor] of window.editorManager.editors) {
            if (editor.dirty) {
                if (!editor.filePath) {
                    await this.saveActiveFileAs();
                } else {
                    await this.saveFile(editor, editor.filePath);
                }
            }
        }
    }
    
    closeActiveEditor() {
        const activeId = window.editorManager?.activeEditor;
        if (activeId) {
            window.editorManager?.closeEditor(activeId);
        }
    }
    
    closeAllFiles() {
        if (!window.editorManager) return;
        const editorIds = Array.from(window.editorManager.editors.keys());
        for (const id of editorIds) {
            window.editorManager.closeEditor(id);
        }
    }
    
    closeActiveTab() {
        this.closeActiveEditor();
    }
    
    nextTab(direction) {
        if (!window.editorManager) return;
        
        const editors = Array.from(window.editorManager.editors.keys());
        const activeIndex = editors.indexOf(window.editorManager.activeEditor);
        
        if (activeIndex === -1) return;
        
        let newIndex = activeIndex + direction;
        if (newIndex >= editors.length) newIndex = 0;
        if (newIndex < 0) newIndex = editors.length - 1;
        
        window.editorManager.switchToEditor(editors[newIndex]);
    }
    
    showPanel(panelName) {
        this.switchPanelTab(panelName);
        document.getElementById('bottomPanel').classList.remove('collapsed');
        this.panelCollapsed = false;
        document.getElementById('closePanelBtn').querySelector('i').className = 'fas fa-chevron-down';
    }
    
    // Ghost actions
    async ghostBuild() {
        if (!this.currentProject) {
            alert('No project open');
            return;
        }
        
        this.showPanel('ghost-output');
        this.clearGhostOutput();
        this.logGhostOutput('Building project...\n', 'build-step');
        
        const target = document.getElementById('targetSelect').value;
        const result = await window.electronAPI.ghost.build(this.currentProject, { target });
        
        if (result.success) {
            this.logGhostOutput('Build successful!\n', 'build-success');
            document.getElementById('statusIndicator').className = 'status-indicator';
            document.getElementById('statusText').textContent = 'Build OK';
        } else {
            this.logGhostOutput(`Build failed:\n${result.stderr}\n`, 'build-error');
            document.getElementById('statusIndicator').className = 'status-indicator error';
            document.getElementById('statusText').textContent = 'Build Failed';
        }
    }
    
    async ghostRun() {
        if (!this.currentProject) {
            alert('No project open');
            return;
        }
        
        this.showPanel('ghost-output');
        this.clearGhostOutput();
        this.logGhostOutput('Running on host VM...\n', 'build-step');
        
        const target = document.getElementById('targetSelect').value;
        const result = await window.electronAPI.ghost.run(this.currentProject, { target });
        
        if (result.success) {
            this.logGhostOutput('Run completed\n', 'build-success');
        } else {
            this.logGhostOutput(`Run failed:\n${result.stderr}\n`, 'build-error');
        }
    }
    
    async ghostFlash() {
        if (!this.currentProject) {
            alert('No project open');
            return;
        }
        
        this.showPanel('ghost-output');
        this.clearGhostOutput();
        this.logGhostOutput('Flashing to device...\n', 'build-step');
        
        const target = document.getElementById('targetSelect').value;
        const result = await window.electronAPI.ghost.flash(this.currentProject, { target });
        
        if (result.success) {
            this.logGhostOutput('Flash successful!\n', 'build-success');
        } else {
            this.logGhostOutput(`Flash failed:\n${result.stderr}\n`, 'build-error');
        }
    }
    
    async ghostCheck() {
        if (!this.currentProject) {
            alert('No project open');
            return;
        }
        
        this.showPanel('ghost-output');
        this.clearGhostOutput();
        this.logGhostOutput('Checking syntax...\n', 'build-step');
        
        const target = document.getElementById('targetSelect').value;
        const result = await window.electronAPI.ghost.check(this.currentProject, { target });
        
        if (result.success) {
            this.logGhostOutput('Syntax check passed\n', 'build-success');
        } else {
            this.logGhostOutput(`Syntax errors:\n${result.stderr}\n`, 'build-error');
        }
    }
    
    clearGhostOutput() {
        const console = document.getElementById('ghostConsole');
        if (console) console.innerHTML = '';
    }
    
    logGhostOutput(message, type = 'info') {
        const console = document.getElementById('ghostConsole');
        if (!console) return;
        
        const line = document.createElement('div');
        line.className = `output-line ${type}`;
        line.textContent = message;
        console.appendChild(line);
        console.scrollTop = console.scrollHeight;
    }
    
    handleGhostOutput(data) {
        const console = document.getElementById('outputConsole');
        if (!console) return;
        
        const line = document.createElement('div');
        line.className = `output-line ${data.type}`;
        line.textContent = data.data;
        console.appendChild(line);
        console.scrollTop = console.scrollHeight;
        
        // Also log to ghost console if it's the active panel
        if (document.getElementById('ghostOutputPanel')?.classList.contains('active')) {
            this.logGhostOutput(data.data, data.type);
        }
    }
    
    clearOutput() {
        const console = document.getElementById('outputConsole');
        if (console) console.innerHTML = '';
    }
    
    filterProblems(filter) {
        // Filter problems list
        const items = document.querySelectorAll('#problemsList .problem-item');
        items.forEach(item => {
            if (filter === 'all' || item.dataset.severity === filter) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    setTarget(target) {
        document.getElementById('ghostTarget').textContent = `Target: ${target.toUpperCase()}`;
        window.electronAPI.settings.set('defaultTarget', target);
    }
    
    // Editor actions
    undo() { window.editorManager?.getActiveEditor()?.editor.undo(); }
    redo() { window.editorManager?.getActiveEditor()?.editor.redo(); }
    cut() { document.execCommand('cut'); }
    copy() { document.execCommand('copy'); }
    paste() { document.execCommand('paste'); }
    find() { window.editorManager?.getActiveEditor()?.editor.execCommand('find'); }
    replace() { window.editorManager?.getActiveEditor()?.editor.execCommand('replace'); }
    findInFiles() { this.showPanel('search'); }
    selectAll() { window.editorManager?.getActiveEditor()?.editor.execCommand('selectAll'); }
    expandSelection() { /* Not available in base CodeMirror */ }
    shrinkSelection() { /* Not available in base CodeMirror */ }
    addCursorAbove() { /* Not available in base CodeMirror */ }
    addCursorBelow() { /* Not available in base CodeMirror */ }
    formatDocument() { 
        const activeId = window.editorManager?.activeEditor;
        if (activeId) {
            window.editorManager.formatDocument(activeId);
        }
    }
    
    // Code generation
    async showTokens() { await this.runGhostTool('tokens'); }
    async showAST() { await this.runGhostTool('ast'); }
    async showIR() { await this.runGhostTool('ir'); }
    async showLLVM() { await this.runGhostTool('llvm'); }
    async showC() { await this.runGhostTool('c'); }
    
    async runGhostTool(tool) {
        const activeId = window.editorManager?.activeEditor;
        if (!activeId) return;
        
        const editor = window.editorManager.editors.get(activeId);
        if (!editor || !editor.filePath) return;
        
        this.showPanel('output');
        
        const result = await window.electronAPI.ghost[tool](editor.filePath);
        if (result.success) {
            this.logOutput(result.stdout);
        } else {
            this.logOutput(result.stderr, 'error');
        }
    }
    
    logOutput(message, type = 'info') {
        const console = document.getElementById('outputConsole');
        if (!console) return;
        
        const line = document.createElement('div');
        line.className = `output-line ${type}`;
        line.textContent = message;
        console.appendChild(line);
        console.scrollTop = console.scrollHeight;
    }
    
    selectTarget() {
        this.showPanel('ghost-output');
    }
    
    showSettings() {
        this.showModal('settingsModal');
    }
    
    showAbout() {
        this.showModal('aboutModal');
    }
    
    checkUpdates() {
        this.showNotification('Checking for updates...');
    }
    
    showKeybindings() {
        this.showModal('settingsModal');
        this.switchSettingsTab('keyboard');
    }
    
    toggleZenMode() {
        // Hide sidebar, panel, status bar, menu bar
        document.getElementById('sidebar').classList.toggle('zen-hidden');
        document.getElementById('bottomPanel').classList.toggle('zen-hidden');
        document.getElementById('statusBar').classList.toggle('zen-hidden');
        document.getElementById('menuBar').classList.toggle('zen-hidden');
        document.getElementById('titlebar').classList.toggle('zen-hidden');
    }
    
    toggleFullscreen() {
        window.electronAPI.window.maximize();
    }
    
    runTask() {
        // Show task runner
    }
    
    configureTasks() {
        // Open tasks.json
    }
    
    // Modal management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            // Focus first input
            const input = modal.querySelector('input, select, textarea');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('show');
    }
    
    hideModals() {
        document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    }
    
    // Command palette
    showCommandPalette() {
        const palette = document.getElementById('commandPalette');
        const input = document.getElementById('paletteInput');
        palette.classList.add('show');
        input.value = '';
        input.focus();
        this.filterCommandPalette('');
    }
    
    hideCommandPalette() {
        document.getElementById('commandPalette').classList.remove('show');
    }
    
    filterCommandPalette(query) {
        const commands = [
            { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N', action: () => this.createNewFile() },
            { id: 'open-file', label: 'Open File', shortcut: 'Ctrl+O', action: () => this.openFile() },
            { id: 'save', label: 'Save', shortcut: 'Ctrl+S', action: () => this.saveActiveFile() },
            { id: 'save-all', label: 'Save All', shortcut: 'Ctrl+K S', action: () => this.saveAllFiles() },
            { id: 'new-project', label: 'New Project', shortcut: 'Ctrl+Shift+N', action: () => this.showNewProjectModal() },
            { id: 'open-project', label: 'Open Project', shortcut: 'Ctrl+Shift+O', action: () => this.openProject() },
            { id: 'ghost-build', label: 'Ghost: Build Project', shortcut: 'Ctrl+Shift+B', action: () => this.ghostBuild() },
            { id: 'ghost-run', label: 'Ghost: Run on VM', shortcut: 'F5', action: () => this.ghostRun() },
            { id: 'ghost-flash', label: 'Ghost: Flash to Device', shortcut: 'Ctrl+F', action: () => this.ghostFlash() },
            { id: 'ghost-check', label: 'Ghost: Check Syntax', shortcut: 'Ctrl+Shift+C', action: () => this.ghostCheck() },
            { id: 'ghost-format', label: 'Ghost: Format Document', shortcut: 'Shift+Alt+F', action: () => this.formatDocument() },
            { id: 'settings', label: 'Open Settings', shortcut: 'Ctrl+,', action: () => this.showSettings() },
            { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => this.toggleSidebar() },
            { id: 'toggle-panel', label: 'Toggle Panel', shortcut: 'Ctrl+J', action: () => this.togglePanel() },
            { id: 'show-terminal', label: 'Show Terminal', shortcut: 'Ctrl+`', action: () => this.showPanel('terminal') },
            { id: 'show-output', label: 'Show Output', action: () => this.showPanel('output') },
            { id: 'show-problems', label: 'Show Problems', shortcut: 'Ctrl+Shift+M', action: () => this.showPanel('problems') },
            { id: 'show-serial', label: 'Show Serial Monitor', shortcut: 'Ctrl+Shift+M', action: () => this.showPanel('serial') },
            { id: 'zen-mode', label: 'Toggle Zen Mode', shortcut: 'Ctrl+K Z', action: () => this.toggleZenMode() },
            { id: 'command-palette', label: 'Show Command Palette', shortcut: 'Ctrl+Shift+P', action: () => this.showCommandPalette() }
        ];
        
        const results = document.getElementById('paletteResults');
        results.innerHTML = '';
        
        const filtered = commands.filter(cmd => 
            cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.id.toLowerCase().includes(query.toLowerCase())
        );
        
        filtered.forEach((cmd, index) => {
            const item = document.createElement('div');
            item.className = 'palette-item' + (index === 0 ? ' selected' : '');
            item.dataset.commandId = cmd.id;
            item.innerHTML = `
                <i class="fas fa-terminal"></i>
                <span class="label">${cmd.label}</span>
                <span class="shortcut">${cmd.shortcut || ''}</span>
            `;
            item.addEventListener('click', () => {
                cmd.action();
                this.hideCommandPalette();
            });
            results.appendChild(item);
        });
    }
    
    handlePaletteKeydown(e) {
        const items = document.querySelectorAll('.palette-item');
        const selected = document.querySelector('.palette-item.selected');
        let index = Array.from(items).indexOf(selected);
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            index = Math.min(index + 1, items.length - 1);
            this.selectPaletteItem(index);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            index = Math.max(index - 1, 0);
            this.selectPaletteItem(index);
        } else if (e.key === 'Enter' && selected) {
            e.preventDefault();
            selected.click();
        }
    }
    
    selectPaletteItem(index) {
        document.querySelectorAll('.palette-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });
        
        // Scroll into view
        const selected = document.querySelector('.palette-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest' });
    }
    
    // Keyboard shortcuts
    bindKeyboardShortcuts() {
        const shortcuts = {
            'Ctrl+N': () => this.createNewFile(),
            'Ctrl+O': () => this.openFile(),
            'Ctrl+S': () => this.saveActiveFile(),
            'Ctrl+Shift+S': () => this.saveActiveFileAs(),
            'Ctrl+K S': () => this.saveAllFiles(),
            'Ctrl+Shift+N': () => this.showNewProjectModal(),
            'Ctrl+Shift+O': () => this.openProject(),
            'Ctrl+W': () => this.closeActiveEditor(),
            'Ctrl+Shift+W': () => this.closeAllFiles(),
            'Ctrl+B': () => this.toggleSidebar(),
            'Ctrl+J': () => this.togglePanel(),
            'Ctrl+`': () => this.showPanel('terminal'),
            'Ctrl+Shift+P': () => this.showCommandPalette(),
            'Ctrl+,': () => this.showSettings(),
            'F5': () => this.ghostRun(),
            'Ctrl+F': () => this.ghostFlash(),
            'Ctrl+Shift+B': () => this.ghostBuild(),
            'Ctrl+Shift+C': () => this.ghostCheck(),
            'Shift+Alt+F': () => this.formatDocument(),
            'Ctrl+Shift+F': () => this.findInFiles(),
            'Ctrl+H': () => this.replace(),
            'Ctrl+K Z': () => this.toggleZenMode(),
            'F11': () => this.toggleFullscreen()
        };
        
        document.addEventListener('keydown', (e) => {
            // Handle Ctrl+Tab for tab switching (special case)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
                e.preventDefault();
                this.nextTab(e.shiftKey ? -1 : 1);
                return;
            }
            
            const key = (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + 
                       (e.shiftKey ? 'Shift+' : '') + 
                       (e.altKey ? 'Alt+' : '') + 
                       e.key.toUpperCase();
            
            if (shortcuts[key]) {
                e.preventDefault();
                shortcuts[key]();
            }
        });
    }
    
    // Drag and drop
    setupDragAndDrop() {
        const editorContainer = document.getElementById('editorContainer');
        
        editorContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        
        editorContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => this.openFile(file.path));
        });
    }
    
    // File watching
    handleFileChange(data) {
        // Reload file if open and changed externally
        if (window.editorManager) {
            window.editorManager.editors.forEach((editor, id) => {
                if (editor.filePath === data.path) {
                    // Check if editor has unsaved changes
                    if (!editor.dirty) {
                        this.reloadFile(id);
                    }
                }
            });
        }
    }
    
    async reloadFile(editorId) {
        const editor = window.editorManager.editors.get(editorId);
        if (!editor || !editor.filePath) return;
        
        try {
            const content = await window.electronAPI.fs.readFile(editor.filePath);
            if (content.success) {
                editor.editor.setValue(content.content);
            }
        } catch (error) {
            console.error('Failed to reload file:', error);
        }
    }
    
    // Session management
    restoreSession(data) {
        if (data.project) {
            this.loadProject(data.project);
        }
        
        if (data.files) {
            data.files.forEach(file => this.openFile(file));
        }
    }
    
    // Notifications
    showNotification(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // Load keybindings
    loadKeybindings() {
        const list = document.getElementById('keybindingsList');
        // Would load from settings
    }
    
    // Browse compiler path
    async browseCompilerPath() {
        const result = await window.electronAPI.dialog.openFile({
            filters: [{ name: 'Executable', extensions: ['exe', ''] }]
        });
        if (result.success && !result.canceled && result.filePaths.length > 0) {
            document.getElementById('ghostCompilerPath').value = result.filePaths[0];
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.uiManager = new UIManager();
});