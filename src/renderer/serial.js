// Serial Monitor
// ==============

class SerialMonitor {
    constructor() {
        this.connected = false;
        this.port = null;
        this.baudRate = 115200;
        this.showTimestamps = false;
        this.autoScroll = true;
        this.logToFile = false;
        this.logPath = '';
        
        this.init();
    }
    
    init() {
        // Port selection
        this.portSelect = document.getElementById('serialPortSelect');
        this.baudSelect = document.getElementById('serialBaudSelect');
        
        // Buttons
        document.getElementById('serialRefreshBtn').addEventListener('click', () => this.refreshPorts());
        document.getElementById('serialConnectBtn').addEventListener('click', () => this.connect());
        document.getElementById('serialDisconnectBtn').addEventListener('click', () => this.disconnect());
        document.getElementById('serialClearBtn').addEventListener('click', () => this.clear());
        
        // Options
        document.getElementById('serialTimestamp').addEventListener('change', (e) => {
            this.showTimestamps = e.target.checked;
        });
        document.getElementById('serialAutoScroll').addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        
        // Input
        this.input = document.getElementById('serialInput');
        this.sendBtn = document.getElementById('serialSendBtn');
        
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.send();
            }
        });
        
        this.sendBtn.addEventListener('click', () => this.send());
        
        // Load ports on init
        this.refreshPorts();
        
        // Listen for serial data
        window.electronAPI.on('serial:data', (data) => this.onData(data));
        window.electronAPI.on('serial:error', (error) => this.onError(error));
        window.electronAPI.on('serial:disconnected', () => this.onDisconnect());
    }
    
    async refreshPorts() {
        try {
            const result = await window.electronAPI.serial.listPorts();
            if (result.success) {
                const currentPort = this.portSelect.value;
                this.portSelect.innerHTML = '<option value="">Select Port...</option>';
                
                result.ports.forEach(port => {
                    const option = document.createElement('option');
                    option.value = port.path;
                    option.textContent = `${port.path} ${port.manufacturer ? `(${port.manufacturer})` : ''}`;
                    if (port.path === currentPort) option.selected = true;
                    this.portSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to list ports:', error);
        }
    }
    
    async connect() {
        const port = this.portSelect.value;
        const baudRate = parseInt(this.baudSelect.value);
        
        if (!port) {
            alert('Please select a port');
            return;
        }
        
        try {
            this.setConnecting(true);
            const result = await window.electronAPI.serial.connect(port, baudRate);
            
            if (result.success) {
                this.connected = true;
                this.port = port;
                this.baudRate = baudRate;
                this.updateUI();
                this.log(`Connected to ${port} at ${baudRate} baud`);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.connected = false;
            this.updateUI();
            alert('Failed to connect: ' + error.message);
        } finally {
            this.setConnecting(false);
        }
    }
    
    async disconnect() {
        if (!this.connected) return;
        
        try {
            await window.electronAPI.serial.disconnect();
            this.connected = false;
            this.port = null;
            this.updateUI();
            this.log('Disconnected');
        } catch (error) {
            alert('Failed to disconnect: ' + error.message);
        }
    }
    
    send() {
        if (!this.connected) return;
        
        const data = this.input.value;
        if (!data) return;
        
        window.electronAPI.serial.write(data + '\n');
        this.log(`TX: ${data}`, 'tx');
        this.input.value = '';
    }
    
    onData(data) {
        this.log(`RX: ${data}`, 'rx');
    }
    
    onError(error) {
        this.log(`ERROR: ${error}`, 'error');
    }
    
    onDisconnect() {
        this.connected = false;
        this.updateUI();
        this.log('Disconnected unexpectedly');
    }
    
    log(message, type = 'rx') {
        const console = document.getElementById('serialConsole');
        if (!console) return;
        
        const line = document.createElement('div');
        line.className = `serial-line ${type}`;
        
        let content = '';
        if (this.showTimestamps) {
            const now = new Date();
            content += `<span class="timestamp">[${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}] </span>`;
        }
        content += message;
        
        line.innerHTML = content;
        console.appendChild(line);
        
        if (this.autoScroll) {
            console.scrollTop = console.scrollHeight;
        }
        
        // Log to file if enabled
        if (this.logToFile && this.logPath) {
            // Would use electronAPI.fs.appendFile
        }
    }
    
    clear() {
        const console = document.getElementById('serialConsole');
        if (console) {
            console.innerHTML = '';
        }
    }
    
    updateUI() {
        const connectBtn = document.getElementById('serialConnectBtn');
        const disconnectBtn = document.getElementById('serialDisconnectBtn');
        const input = this.input;
        const sendBtn = this.sendBtn;
        const portSelect = this.portSelect;
        const baudSelect = this.baudSelect;
        
        if (this.connected) {
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            input.disabled = false;
            sendBtn.disabled = false;
            portSelect.disabled = true;
            baudSelect.disabled = true;
        } else {
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            input.disabled = true;
            sendBtn.disabled = true;
            portSelect.disabled = false;
            baudSelect.disabled = false;
        }
    }
    
    setConnecting(connecting) {
        const connectBtn = document.getElementById('serialConnectBtn');
        if (connecting) {
            connectBtn.innerHTML = '<i class="fas fa-spinner spinning"></i>';
            connectBtn.disabled = true;
        } else {
            connectBtn.innerHTML = '<i class="fas fa-plug"></i>';
            this.updateUI();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.serialMonitor = new SerialMonitor();
});