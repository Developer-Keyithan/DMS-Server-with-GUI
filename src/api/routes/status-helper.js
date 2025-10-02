const express = require('express');
// const router = express.Router();
// const DatabaseManager = require('../../core/database-manager');
// const UserManager = require('../../auth/user-manager');

class ServerStatusGUI {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.startStatusPolling();
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
            const response = await fetch('http://localhost:7701/api/status');
            if (!response.ok) throw new Error('Server not responding');
            return await response.json();
        } catch (error) {
            return { status: 'stopped' };
        }
    }

    async startStatusPolling() {
        setInterval(async () => {
            await this.updateStatus();
        }, 2000);
        
        // Initial update
        await this.updateStatus();
    }

    async updateStatus() {
        const status = await this.fetchServerStatus();
        
        this.updateUI(status);
    }

    updateUI(status) {
        // Update status indicator
        this.statusIndicator.className = `status-indicator ${status.status}`;
        this.statusText.textContent = this.capitalizeFirstLetter(status.status);
        
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
            this.totalUsers.textContent = status.stats?.totalUsers || '0';
            this.totalDatabases.textContent = status.stats?.totalDatabases || '0';
            this.totalCollections.textContent = status.stats?.totalCollections || '0';
            this.totalBuckets.textContent = status.stats?.totalBuckets || '0';
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
            const response = await fetch('http://localhost:7701/api/server/start', {
                method: 'POST'
            });
            
            if (response.ok) {
                setTimeout(() => this.openTerminal(), 1000);
            }
        } catch (error) {
            console.error('Failed to start server:', error);
        }
    }

    async stopServer() {
        try {
            const response = await fetch('http://localhost:7701/api/server/stop', {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to stop server');
            }
        } catch (error) {
            console.error('Failed to stop server:', error);
        }
    }

    async restartServer() {
        try {
            this.setStatus('starting');
            const response = await fetch('http://localhost:7701/api/server/restart', {
                method: 'POST'
            });
            
            if (response.ok) {
                setTimeout(() => this.openTerminal(), 1000);
            }
        } catch (error) {
            console.error('Failed to restart server:', error);
        }
    }

    openTerminal() {
        // This would open the system terminal with Hexabase CLI
        // Implementation depends on the operating system
        console.log('Opening terminal...');
        // For Electron app, you might use shell.openExternal or similar
    }

    setStatus(status) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = this.capitalizeFirstLetter(status);
    }

    formatUptime(seconds) {
        if (!seconds) return '--';
        
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    formatMemory(bytes) {
        if (!bytes) return '--';
        
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}

// Initialize the GUI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ServerStatusGUI();
});