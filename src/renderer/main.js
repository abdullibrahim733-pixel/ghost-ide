// Ghost IDE Main Entry Point
// =========================

// Initialize all components
console.log('Ghost IDE starting...');

// Global state
window.ghostIDE = {
    version: '0.1.0',
    initialized: false
};

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Ghost IDE...');
    
    try {
        // Initialize components in order
        // 1. Editor Manager (creates CodeMirror editors)
        // Already initialized in editor.js
        
        // 2. File Tree (file explorer)
        // Already initialized in filetree.js
        
        // 3. Terminal Manager
        // Already initialized in terminal.js
        
        // 4. Serial Monitor
        // Already initialized in serial.js
        
        // 5. UI Manager (handles menus, modals, shortcuts, etc.)
        // Already initialized in ui.js
        
        // Set up global keyboard shortcuts
        setupGlobalShortcuts();
        
        // Load recent projects
        await loadRecentProjects();
        
        // Check for auto-restore session
        checkSessionRestore();
        
        // Set up periodic auto-save
        await setupAutoSave();
        
        window.ghostIDE.initialized = true;
        console.log('Ghost IDE initialized successfully');
        
        // Show welcome screen if no project open
        if (!window.uiManager?.currentProject) {
            setTimeout(() => window.uiManager?.showWelcomeScreen(), 500);
        }
        
    } catch (error) {
        console.error('Failed to initialize Ghost IDE:', error);
        alert('Failed to initialize Ghost IDE: ' + error.message);
    }
});

// Global keyboard shortcuts are handled by UIManager
function setupGlobalShortcuts() {
    // Additional shortcuts not handled by UIManager can go here
}

// Load recent projects for welcome screen
async function loadRecentProjects() {
    try {
        const projects = await window.electronAPI.projects.getRecent();
        // UI will handle displaying them
    } catch (error) {
        console.error('Failed to load recent projects:', error);
    }
}

// Check if we should restore previous session
async function checkSessionRestore() {
    const restoreSession = await window.electronAPI.settings.get('restoreSession');
    if (restoreSession) {
        // Session restore is handled by IPC event
    }
}

// Auto-save functionality
async function setupAutoSave() {
    const autoSave = await window.electronAPI.settings.get('autoSave');
    if (!autoSave) return;
    
    setInterval(() => {
        if (window.editorManager) {
            window.editorManager.editors.forEach((editor, id) => {
                if (editor.dirty && editor.filePath) {
                    // Only auto-save if not currently typing
                    // This is a simple implementation
                    window.uiManager?.saveFile(editor, editor.filePath).catch(console.error);
                }
            });
        }
    }, 30000); // Every 30 seconds
}

// Handle window focus/blur
window.addEventListener('focus', () => {
    // Refresh file tree when window gains focus
    window.fileTree?.refresh();
});

window.addEventListener('blur', () => {
    // Save session on blur
    window.electronAPI.send('session:save');
});

// Handle unhandled errors
window.addEventListener('error', (e) => {
    console.error('Unhandled error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
});

// Export for debugging
window.ghostIDE.debug = {
    getEditorManager: () => window.editorManager,
    getFileTree: () => window.fileTree,
    getTerminalManager: () => window.terminalManager,
    getSerialMonitor: () => window.serialMonitor,
    getUIManager: () => window.uiManager
};

console.log('Ghost IDE main module loaded');