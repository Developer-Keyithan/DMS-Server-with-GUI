const express = require('express');
const http = require('http');
const WebSocket = require('ws');
// const path = require('path');
const colors = require('../cli/utils/colors');
const ApiRoutes = require('../api/server');

class HexabaseServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        // this.wss = new WebSocket.Server({ server: this.server });
        this.port = process.env.PORT || 7701;
        this.isRunning = false;
        this.apiServer = new ApiRoutes();

        // Mount ApiServer
        this.app.use('/api', this.apiServer.app);

        // Status endpoint
        this.app.get('/status', (req, res) => {
            res.json({
                status: 'healthy',
                version: '1.0.0',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                clients: this.apiServer.clients.size
            });
        });

        // WebSocket
        this.wss = new WebSocket.Server({ server: this.server, path: '/ws' });
        this.apiServer.wss = this.wss;
        this.apiServer.setupWebSocket();
    }

    async start() {
        return new Promise((resolve, reject) => {
            // Add startup check here
            if (process.env.NODE_ENV === 'development') {
                const { CommonIssues } = require('./scripts/debug-helpers');
                const issues = CommonIssues.diagnoseStartupIssues();
                if (issues.length > 0) {
                    console.log('\n⚠️  Development Environment Issues:');
                    issues.forEach(issue => colors.printWarning(issue));
                }
            }
            this.server.listen(this.port, (err) => {
                if (err) {
                    colors.printError(`Failed to start server: ${err.message}`);
                    const { CommonIssues } = require('./scripts/debug-helpers');
                    CommonIssues.fixCommonProblems(err);
                    reject(err);
                    return;
                }

                this.isRunning = true;
                colors.printSuccess(`Hexabase Server running on http://localhost:${this.port}`);
                colors.printInfo(`WebSocket server available on ws://localhost:${this.port}`);

                // Show debug endpoints info in development
                if (process.env.NODE_ENV === 'development') {
                    colors.printInfo(`Debug endpoints available on http://localhost:${this.port}/debug`);
                }

                colors.printInfo('Press Ctrl+C to stop the server');

                resolve();
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                colors.printSuccess('Hexabase Server stopped');
                resolve();
            });
        });
    }
}

module.exports = HexabaseServer;

if (require.main === module) {
    const server = new HexabaseServer();

    server.start().then(() => {
        console.log(`Server started and running on port ${server.port}`);
    }).catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
