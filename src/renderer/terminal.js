// Terminal Management
// ===================

class TerminalManager {
    constructor() {
        this.terminals = new Map();
        this.activeTerminalId = null;
        this.terminalCounter = 0;
        this.container = document.getElementById('terminalContainer');
        this.tabsContainer = document.getElementById('terminalTabs');
        
        this.init();
    }
    
    init() {
        // New terminal button
        document.getElementById('newTerminalBtn').addEventListener('click', () => this.createTerminal());
        
        // Terminal actions
        document.getElementById('terminalKillBtn').addEventListener('click', () => this.killActiveTerminal());
        document.getElementById('terminalClearBtn').addEventListener('click', () => this.clearActiveTerminal());
        
        // Terminal tab clicks
        this.tabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.terminal-tab');
            if (tab && !tab.classList.contains('new-terminal')) {
                this.switchTerminal(tab.dataset.terminalId);
            }
            
            const closeBtn = e.target.closest('.close-tab');
            if (closeBtn) {
                e.stopPropagation();
                this.closeTerminal(closeBtn.dataset.terminalId);
            }
        });
        
        // Create initial terminal
        this.createTerminal().catch(err => console.error('Failed to create terminal:', err));
    }
    
    async createTerminal(options = {}) {
        this.terminalCounter++;
        const terminalId = `terminal-${this.terminalCounter}`;
        const tabId = `tab-${terminalId}`;
        
        // Create tab
        const tab = document.createElement('button');
        tab.className = 'terminal-tab';
        tab.id = tabId;
        tab.dataset.terminalId = terminalId;
        tab.innerHTML = `
            <i class="fas fa-terminal"></i> Terminal ${this.terminalCounter}
            <button class="close-tab" data-terminal-id="${terminalId}"><i class="fas fa-times"></i></button>
        `;
        
        // Insert before new terminal button
        const newTabBtn = document.getElementById('newTerminalBtn');
        this.tabsContainer.insertBefore(tab, newTabBtn);
        
        // Create terminal element
        const terminalElement = document.createElement('div');
        terminalElement.className = 'terminal-instance';
        terminalElement.id = terminalId;
        terminalElement.style.display = 'none';
        this.container.appendChild(terminalElement);
        
        // Initialize xterm.js
        const xterm = new Terminal({
            cursorBlink: true,
            cursorStyle: 'block',
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.3,
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
                selection: 'rgba(255, 255, 255, 0.3)',
                black: '#1e1e1e',
                red: '#f44747',
                green: '#4ec9b0',
                yellow: '#dcdcaa',
                blue: '#569cd6',
                magenta: '#c586c0',
                cyan: '#9cdcfe',
                white: '#d4d4d4',
                brightBlack: '#585858',
                brightRed: '#f44747',
                brightGreen: '#4ec9b0',
                brightYellow: '#dcdcaa',
                brightBlue: '#569cd6',
                brightMagenta: '#c586c0',
                brightCyan: '#9cdcfe',
                brightWhite: '#ffffff'
            },
            convertEol: true,
            scrollback: 10000,
            allowTransparency: true,
            rightClickSelectsWord: true
        });
        
        // Add fit addon
        const fitAddon = new FitAddon.FitAddon();
        xterm.loadAddon(fitAddon);
        
        // Add web links addon
        const webLinksAddon = new WebLinksAddon.WebLinksAddon();
        xterm.loadAddon(webLinksAddon);
        
        // Open terminal
        xterm.open(terminalElement);
        fitAddon.fit();
        
        // Handle resize
        window.addEventListener('resize', () => fitAddon.fit());
        
        // Create shell process via IPC
        const shell = options.shell || (window.nodeAPI.os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash');
        const cwd = options.cwd || (window.fileTree?.rootPath || window.nodeAPI.os.homedir());
        
        const ptyResult = await window.electronAPI.terminal.spawn({
            shell,
            cols: xterm.cols,
            rows: xterm.rows,
            cwd
        });
        
        const ptyId = ptyResult.ptyId;
        
        // Handle data from shell via IPC events
        window.electronAPI.on('terminal:data', (data) => {
            if (data.ptyId === ptyId) {
                xterm.write(data.data);
            }
        });
        
        window.electronAPI.on('terminal:exit', (data) => {
            if (data.ptyId === ptyId) {
                xterm.write(`\r\n[Process exited with code ${data.code}]\r\n`);
                xterm.options.disableStdin = true;
            }
        });
        
        // Handle input from terminal
        xterm.onData((data) => {
            window.electronAPI.terminal.write(ptyId, data);
        });
        
        // Handle resize
        xterm.onResize(({ cols, rows }) => {
            window.electronAPI.terminal.resize(ptyId, cols, rows);
        });
        
        // Store terminal data
        this.terminals.set(terminalId, {
            id: terminalId,
            tabId: tabId,
            xterm: xterm,
            ptyId: ptyId,
            fitAddon: fitAddon,
            shell: shell,
            cwd: cwd
        });
        
        // Switch to new terminal
        this.switchTerminal(terminalId);
        
        return terminalId;
    }
    
    switchTerminal(terminalId) {
        // Hide all terminals
        this.terminals.forEach((data, id) => {
            document.getElementById(id).style.display = 'none';
            document.getElementById(data.tabId).classList.remove('active');
        });
        
        // Show selected terminal
        const data = this.terminals.get(terminalId);
        if (data) {
            document.getElementById(terminalId).style.display = 'block';
            document.getElementById(data.tabId).classList.add('active');
            data.fitAddon.fit();
            data.xterm.focus();
            this.activeTerminalId = terminalId;
        }
    }
    
    closeTerminal(terminalId) {
        const data = this.terminals.get(terminalId);
        if (!data) return;
        
        // Kill process via IPC
        window.electronAPI.terminal.kill(data.ptyId);
        
        // Dispose terminal
        data.xterm.dispose();
        
        // Remove UI elements
        document.getElementById(terminalId).remove();
        document.getElementById(data.tabId).remove();
        
        // Remove from map
        this.terminals.delete(terminalId);
        
        // Switch to another terminal if this was active
        if (this.activeTerminalId === terminalId) {
            const remaining = Array.from(this.terminals.keys());
            if (remaining.length > 0) {
                this.switchTerminal(remaining[remaining.length - 1]);
            } else {
                this.createTerminal();
            }
        }
    }
    
    killActiveTerminal() {
        if (this.activeTerminalId) {
            this.closeTerminal(this.activeTerminalId);
        }
    }
    
    clearActiveTerminal() {
        const data = this.terminals.get(this.activeTerminalId);
        if (data) {
            data.xterm.clear();
        }
    }
    
    getActiveTerminal() {
        return this.activeTerminalId ? this.terminals.get(this.activeTerminalId) : null;
    }
    
    // Send command to active terminal
    sendCommand(command) {
        const data = this.getActiveTerminal();
        if (data) {
            window.electronAPI.terminal.write(data.ptyId, command + '\r');
        }
    }
    
    // Split terminal (create new terminal in same panel)
    splitTerminal(direction = 'right') {
        // For now, just create a new tab
        // Full split pane implementation would require more complex layout
        this.createTerminal();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.terminalManager = new TerminalManager();
});