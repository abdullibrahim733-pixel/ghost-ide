// Editor Management
// =================

class EditorManager {
    constructor() {
        this.editors = new Map();
        this.activeEditor = null;
        this.editorCounter = 0;
        this.container = document.getElementById('editorContainer');
        this.tabsContainer = document.getElementById('editorTabs');
        
        this.init();
    }
    
    init() {
        // Create initial editor
        this.createEditor();
        
        // New tab button
        document.getElementById('newTabBtn').addEventListener('click', () => this.createEditor());
    }
    
    createEditor(filePath = null, content = '') {
        this.editorCounter++;
        const editorId = `editor-${this.editorCounter}`;
        const tabId = `tab-${this.editorCounter}`;
        
        // Create tab
        const tab = document.createElement('button');
        tab.className = 'editor-tab';
        tab.id = tabId;
        tab.dataset.editorId = editorId;
        tab.innerHTML = `
            <span class="tab-name">${filePath ? filePath.split('/').pop() : 'Untitled'}</span>
            <button class="close-tab" data-editor-id="${editorId}"><i class="fas fa-times"></i></button>
        `;
        
        tab.addEventListener('click', (e) => {
            if (!e.target.closest('.close-tab')) {
                this.switchToEditor(editorId);
            }
        });
        
        tab.querySelector('.close-tab').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeEditor(editorId);
        });
        
        this.tabsContainer.appendChild(tab);
        
        // Create editor container
        const editorWrapper = document.createElement('div');
        editorWrapper.className = 'editor-instance';
        editorWrapper.id = editorId;
        editorWrapper.style.display = 'none';
        
        const editorElement = document.createElement('div');
        editorElement.className = 'codemirror-wrapper';
        editorWrapper.appendChild(editorElement);
        
        this.container.appendChild(editorWrapper);
        
        // Initialize CodeMirror
        const editor = CodeMirror(editorElement, {
            value: content,
            mode: 'ghost',
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter', 'CodeMirror-lint-markers'],
            lint: true,
            styleActiveLine: true,
            placeholder: '// Ghost v0.1\n// Start coding...',
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Ctrl-/': 'toggleComment',
                'Shift-Alt-F': 'formatDocument',
                'Ctrl-D': 'deleteLine',
                'Alt-Up': 'moveLineUp',
                'Alt-Down': 'moveLineDown',
                'Ctrl-Enter': 'insertLineAfter',
                'Shift-Ctrl-Enter': 'insertLineBefore',
                'Ctrl-L': 'selectLine',
                'Ctrl-K Ctrl-K': 'addCursorToPrev',
                'Ctrl-K Ctrl-J': 'addCursorToNext',
                'Tab': (cm) => {
                    if (cm.somethingSelected()) {
                        cm.indentSelection('add');
                    } else {
                        cm.replaceSelection(' '.repeat(cm.getOption('indentUnit')), 'end');
                    }
                },
                'Shift-Tab': (cm) => cm.indentSelection('subtract')
            }
        });
        
        // Store editor reference
        const editorData = {
            id: editorId,
            tabId: tabId,
            editor: editor,
            filePath: filePath,
            content: content,
            dirty: false,
            language: 'ghost'
        };
        
        this.editors.set(editorId, editorData);
        
        // Event listeners
        editor.on('change', () => {
            this.onEditorChange(editorId);
        });
        
        editor.on('cursorActivity', () => {
            this.updateCursorPosition(editorId);
        });
        
        editor.on('focus', () => {
            this.switchToEditor(editorId);
        });
        
        editor.on('scroll', () => {
            this.updateScrollPosition(editorId);
        });
        
        // Context menu
        editorWrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showEditorContextMenu(e, editorId);
        });
        
        // Switch to new editor
        this.switchToEditor(editorId);
        
        // Load file if provided
        if (filePath) {
            this.loadFile(editorId, filePath);
        }
        
        return editorId;
    }
    
    switchToEditor(editorId) {
        // Hide all editors
        this.editors.forEach((data, id) => {
            document.getElementById(id).style.display = 'none';
            document.getElementById(data.tabId).classList.remove('active');
        });
        
        // Show selected editor
        const data = this.editors.get(editorId);
        if (data) {
            document.getElementById(editorId).style.display = 'block';
            document.getElementById(data.tabId).classList.add('active');
            data.editor.focus();
            data.editor.refresh();
            this.activeEditor = editorId;
            
            // Update UI
            this.updateTabName(editorId);
            this.updateStatusBar(editorId);
            this.updateLanguageMode(editorId);
        }
    }
    
    closeEditor(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        // Check for unsaved changes
        if (data.dirty) {
            const result = confirm(`Save changes to ${data.filePath ? data.filePath.split('/').pop() : 'Untitled'}?`);
            if (result === null) return; // Cancelled
            if (result) {
                this.saveFile(editorId);
            }
        }
        
        // Remove tab and editor
        document.getElementById(data.tabId).remove();
        document.getElementById(editorId).remove();
        this.editors.delete(editorId);
        
        // Switch to another editor if this was active
        if (this.activeEditor === editorId) {
            const remaining = Array.from(this.editors.keys());
            if (remaining.length > 0) {
                this.switchToEditor(remaining[remaining.length - 1]);
            } else {
                this.activeEditor = null;
                // Create new empty editor
                this.createEditor();
            }
        }
    }
    
    closeActiveEditor() {
        if (this.activeEditor) {
            this.closeEditor(this.activeEditor);
        }
    }
    
    nextTab(direction) {
        const tabs = Array.from(this.editors.keys());
        const currentIndex = tabs.indexOf(this.activeEditor);
        if (currentIndex === -1) return;
        
        let nextIndex = currentIndex + direction;
        if (nextIndex >= tabs.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = tabs.length - 1;
        
        this.switchToEditor(tabs[nextIndex]);
    }
    
    onEditorChange(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        data.dirty = true;
        data.content = data.editor.getValue();
        
        // Update tab
        this.updateTabName(editorId);
        
        // Trigger lint
        this.lintEditor(editorId);
    }
    
    updateTabName(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        const tab = document.getElementById(data.tabId);
        const nameEl = tab.querySelector('.tab-name');
        const fileName = data.filePath ? data.filePath.split('/').pop() : 'Untitled';
        nameEl.textContent = fileName + (data.dirty ? ' ●' : '');
        tab.classList.toggle('dirty', data.dirty);
    }
    
    updateCursorPosition(editorId) {
        const data = this.editors.get(editorId);
        if (!data || editorId !== this.activeEditor) return;
        
        const cursor = data.editor.getCursor();
        document.getElementById('cursorPosition').textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
    }
    
    updateStatusBar(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        // Update language mode
        this.updateLanguageMode(editorId);
        
        // Update indent style
        const indentUnit = data.editor.getOption('indentUnit');
        const indentWithTabs = data.editor.getOption('indentWithTabs');
        document.getElementById('indentStyle').textContent = 
            `${indentWithTabs ? 'Tabs' : 'Spaces'}: ${indentUnit}`;
        
        // Update line ending
        document.getElementById('lineEnding').textContent = 
            data.editor.getOption('lineEnding') || 'LF';
        
        // Update encoding
        document.getElementById('fileEncoding').textContent = 'UTF-8';
    }
    
    updateLanguageMode(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        const langMap = {
            'ghost': 'Ghost',
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'cpp': 'C++',
            'c': 'C',
            'rust': 'Rust',
            'markdown': 'Markdown',
            'json': 'JSON',
            'yaml': 'YAML',
            'toml': 'TOML'
        };
        
        document.getElementById('currentLanguage').textContent = 
            langMap[data.language] || data.language;
    }
    
    async loadFile(editorId, filePath) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        try {
            const result = await window.electronAPI.fs.readFile(filePath);
            if (result.success) {
                data.editor.setValue(result.content);
                data.filePath = filePath;
                data.dirty = false;
                data.language = this.detectLanguage(filePath);
                
                // Update mode
                data.editor.setOption('mode', data.language);
                
                this.updateTabName(editorId);
                this.updateStatusBar(editorId);
                
                // Add to recent files
                this.addToRecentFiles(filePath);
            }
        } catch (error) {
            console.error('Failed to load file:', error);
        }
    }
    
    async saveFile(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return false;
        
        if (!data.filePath) {
            return this.saveFileAs(editorId);
        }
        
        try {
            const result = await window.electronAPI.fs.writeFile(data.filePath, data.content);
            if (result.success) {
                data.dirty = false;
                this.updateTabName(editorId);
                return true;
            }
        } catch (error) {
            console.error('Failed to save file:', error);
        }
        return false;
    }
    
    async saveFileAs(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return false;
        
        try {
            const result = await window.electronAPI.dialog.saveFile({
                filters: [
                    { name: 'Ghost Files', extensions: ['ghost', 'gh'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (!result.canceled && result.filePath) {
                data.filePath = result.filePath;
                data.language = this.detectLanguage(result.filePath);
                data.editor.setOption('mode', data.language);
                
                const saveResult = await window.electronAPI.fs.writeFile(data.filePath, data.content);
                if (saveResult.success) {
                    data.dirty = false;
                    this.updateTabName(editorId);
                    this.updateStatusBar(editorId);
                    this.addToRecentFiles(data.filePath);
                    return true;
                }
            }
        } catch (error) {
            console.error('Failed to save file:', error);
        }
        return false;
    }
    
    async saveActiveFile() {
        if (this.activeEditor) {
            await this.saveFile(this.activeEditor);
        }
    }
    
    async saveActiveFileAs() {
        if (this.activeEditor) {
            await this.saveFileAs(this.activeEditor);
        }
    }
    
    detectLanguage(filePath) {
        const ext = filePath.split('.').pop().toLowerCase();
        const langMap = {
            'ghost': 'ghost',
            'gh': 'ghost',
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python',
            'cpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'c': 'c',
            'h': 'c',
            'hpp': 'cpp',
            'rs': 'rust',
            'md': 'markdown',
            'json': 'json',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            'html': 'htmlmixed',
            'css': 'css',
            'sh': 'shell',
            'bash': 'shell'
        };
        return langMap[ext] || 'text';
    }
    
    addToRecentFiles(filePath) {
        // This would be handled by the main process
        window.electronAPI.send('session:save', { openFiles: Array.from(this.editors.values()).map(e => e.filePath).filter(Boolean) });
    }
    
    lintEditor(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        // Trigger CodeMirror lint refresh
        data.editor.performLint();
    }
    
    showEditorContextMenu(e, editorId) {
        const menu = document.getElementById('editorContextMenu');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.classList.add('show');
        menu.dataset.editorId = editorId;
        
        // Close on click outside
        const closeHandler = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.classList.remove('show');
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }
    
    formatDocument(editorId) {
        const data = this.editors.get(editorId);
        if (!data) return;
        
        // Simple formatting - in reality would use a proper formatter
        const content = data.editor.getValue();
        const lines = content.split('\n');
        let indentLevel = 0;
        const formatted = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('}') || trimmed.startsWith('elif') || trimmed.startsWith('else')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            const indented = ' '.repeat(indentLevel * 4) + trimmed;
            if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
                indentLevel++;
            }
            return indented;
        }).join('\n');
        
        data.editor.setValue(formatted);
    }
    
    getActiveEditor() {
        return this.activeEditor ? this.editors.get(this.activeEditor) : null;
    }
    
    getAllEditors() {
        return Array.from(this.editors.values());
    }
    
    findEditorByPath(filePath) {
        for (const [id, data] of this.editors) {
            if (data.filePath === filePath) {
                return { id };
            }
        }
        return null;
    }
}

// Initialize editor manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.editorManager = new EditorManager();
});