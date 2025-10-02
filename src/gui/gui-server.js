const express = require('express');
const path = require('path');
const statusMonitor = require('./status-monitor');

class GUIServer {
    constructor() {
        this.app = express();
        this.port = 3001; // Different port from main API
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, '../../gui/server-status')));
        this.app.use(express.json());
    }

    setupRoutes() {
        // Serve status API
        this.app.get('/api/status', (req, res) => {
            res.json(statusMonitor.getServerStatus());
        });

        // Server control endpoints
        this.app.post('/api/server/start', (req, res) => {
            // Implement server start logic
            res.json({ message: 'Server starting...' });
        });

        this.app.post('/api/server/stop', (req, res) => {
            // Implement server stop logic
            res.json({ message: 'Server stopping...' });
        });

        this.app.post('/api/server/restart', (req, res) => {
            // Implement server restart logic
            res.json({ message: 'Server restarting...' });
        });

        // Serve GUI
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../../gui/server-status/index.html'));
        });
    }

    start() {
        this.server = this.app.listen(this.port, () => {
            console.log(`Hexabase GUI server running on http://localhost:${this.port}`);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = GUIServer;