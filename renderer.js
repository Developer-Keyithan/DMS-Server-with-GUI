class ServerStatusGUI {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.startStatusPolling();
        this.startUptimeUpdater();
    }

    initializeElements() {
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = this.statusIndicator.querySelector('.status-text');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.terminalBtn = document.getElementById('terminalBtn');

        // Info elements
        this.uptimeElement = document.getElementById('uptime');
        this.memoryElement = document.getElementById('memory');
        this.connectionsElement = document.getElementById('connections');
        this.databasesElement = document.getElementById('databases');

        // Stat elements
        this.totalUsers = document.getElementById('totalUsers');
        this.totalDatabases = document.getElementById('totalDatabases');
        this.totalCollections = document.getElementById('totalCollections');
        this.totalBuckets = document.getElementById('totalBuckets');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startServer());
        this.stopBtn.addEventListener('click', () => this.stopServer());
        this.restartBtn.addEventListener('click', () => this.restartServer());
        this.terminalBtn.addEventListener('click', () => this.openTerminal());
    }

    async fetchServerStatus() {
        try {
            const response = await fetch('http://localhost:7701/status');
            if (!response.ok) throw new Error('Server not responding');

            const data = await response.json();
            return {
                status: data.status === 'healthy' ? 'running' : 'stopped',
                uptime: data.uptime,
                memoryUsage: data.memory,
                activeConnections: data.clients,
                databases: data.databases || 0,
                stats: data.stats || {}
            };
        } catch (error) {
            return { status: 'stopped' };
        }
    }

    async startStatusPolling() {
        await this.updateStatus();
        setInterval(async () => {
            await this.updateStatus();
        }, 2000);
    }

    async updateStatus() {
        const status = await this.fetchServerStatus();
        this.lastStatus = status;
        this.updateUI(status);
    }

    async startUptimeUpdater() {
        setInterval(() => {
            if (this.lastStatus && this.lastStatus.status === 'running') {
                this.lastStatus.uptime += 3;
                this.uptimeElement.textContent = this.formatUptime(this.lastStatus.uptime);
            }
        }, 3000);
    }
    updateUI(status) {
        // Update status indicator
        this.setStatus(status.status);

        // Update button states
        this.startBtn.disabled = status.status === 'running' || status.status === 'starting';
        this.stopBtn.disabled = status.status !== 'running';
        this.restartBtn.disabled = status.status !== 'running';

        // Update server info
        if (status.status === 'running') {
            this.uptimeElement.textContent = this.formatUptime(status.uptime);
            this.memoryElement.textContent = this.formatMemory(status.memoryUsage);
            this.connectionsElement.textContent = status.activeConnections || '0';
            this.databasesElement.textContent = status.databases || '0';

            // Update statistics
            this.totalUsers.textContent = status.stats.totalUsers || '0';
            this.totalDatabases.textContent = status.stats.totalDatabases || '0';
            this.totalCollections.textContent = status.stats.totalCollections || '0';
            this.totalBuckets.textContent = status.stats.totalBuckets || '0';

            this.uptimeElement.textContent = this.formatUptime(status.uptime);
        } else {
            this.resetInfoDisplay();
        }
    }

    resetInfoDisplay() {
        this.uptimeElement.textContent = '--';
        this.memoryElement.textContent = '--';
        this.connectionsElement.textContent = '--';
        this.databasesElement.textContent = '--';

        this.totalUsers.textContent = '--';
        this.totalDatabases.textContent = '--';
        this.totalCollections.textContent = '--';
        this.totalBuckets.textContent = '--';
    }

    async startServer() {
        try {
            this.setStatus('starting');
            const result = await window.electronAPI.startServer();
            if (result.success) {
                this.setStatus('running');
            } else {
                this.showError(result.message);
                this.setStatus('stopped');
            }
        } catch (error) {
            this.showError(error.message);
            this.setStatus('stopped');
        }
    }

    async stopServer() {
        try {
            const result = await window.electronAPI.stopServer();
            if (result.success) {
                this.setStatus('stopped');
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    async restartServer() {
        try {
            this.setStatus('starting');
            const result = await window.electronAPI.restartServer();
            if (result.success) {
                this.setStatus('running');
            } else {
                this.showError(result.message);
                this.setStatus('stopped');
            }
        } catch (error) {
            this.showError(error.message);
            this.setStatus('stopped');
        }
    }

    openTerminal() {
        if (window.electronAPI) {
            window.electronAPI.openTerminal();
        } else {
            alert('Terminal access requires the desktop application');
        }
    }

    setStatus(status) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = this.capitalizeFirstLetter(status);
    }

    showError(message) {
        console.error('Server Error:', message);
        alert(`Error: ${message}`);
    }

    formatUptime(seconds) {
        if (!seconds) return '--';
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        const secs = Math.floor(seconds % 60);

        let result = '';
        if (days > 0) result += `${days}d `;
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0) result += `${minutes}m `;
        result += `${secs}s`;

        return result.trim();
    }

    formatMemory(memory) {
        if (!memory || !memory.heapUsed) return '--';
        const mb = memory.heapUsed / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}

// Initialize GUI
document.addEventListener('DOMContentLoaded', () => {
    new ServerStatusGUI();
});
