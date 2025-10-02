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
        this.wss = new WebSocket.Server({ server: this.server });
        this.port = process.env.PORT || 7701;
        this.isRunning = false;
        this.apiServer = new ApiRoutes();

        // this.setupMiddleware();
        // this.setupRoutes();
        // this.setupWebSocket();
        this.setupApi();

        // this.setupDebugEndpoints(); // Add debug endpoints in development
    }
    setupApi() {
        // ApiServer routes ကို HexabaseServer app உடன் இணைக்க
        this.app.use('/api/v1/auth', this.apiServer.app._router.stack.find(layer => layer.regexp?.test('/auth')).handle);
        this.app.use('/api/v1/db', this.apiServer.app._router.stack.find(layer => layer.regexp?.test('/db')).handle);
        this.app.use('/api/v1/collections', this.apiServer.app._router.stack.find(layer => layer.regexp?.test('/collections')).handle);
        this.app.use('/api/v1/files', this.apiServer.app._router.stack.find(layer => layer.regexp?.test('/files')).handle);

        // Health & default routes
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                version: '1.0.0',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                clients: this.apiServer.clients.size
            });
        });

        this.app.get('/status', (req, res) => {
            res.json({
                status: 'healthy',
                version: '1.0.0',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                clients: this.apiServer.clients.size
            });
        });

        this.app.get('/', (req, res) => {
            res.json({
                message: 'Hexabase Server',
                version: '1.0.0',
                documentation: '/api',
                health: '/health'
            });
        });

    }


    // setupMiddleware() {
    //     this.app.use(express.json({ limit: '50mb' }));
    //     this.app.use(express.urlencoded({ extended: true }));

    //     // CORS middleware
    //     this.app.use((req, res, next) => {
    //         res.header('Access-Control-Allow-Origin', '*');
    //         res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    //         res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    //         next();
    //     });
    // }

    // setupRoutes() {
    //     // Health check endpoint
    //     this.app.get('/health', (req, res) => {
    //         res.json({
    //             status: 'healthy',
    //             version: '1.0.0',
    //             timestamp: new Date().toISOString(),
    //             uptime: process.uptime()
    //         });
    //     });
    //     this.app.get('/status', (req, res) => {
    //         res.json({
    //             status: 'healthy',
    //             version: '1.0.0',
    //             timestamp: new Date().toISOString(),
    //             uptime: process.uptime()
    //         });
    //     });

    //     // API routes would be added here
    //     this.app.use('/api/v1/auth', require('../api/routes/auth'));
    //     this.app.use('/api/v1/db', require('../api/routes/database'));

    //     // Default route
    //     this.app.get('/', (req, res) => {
    //         res.json({
    //             message: 'Hexabase Server',
    //             version: '1.0.0',
    //             endpoints: {
    //                 auth: '/api/v1/auth',
    //                 database: '/api/v1/db',
    //                 debug: process.env.NODE_ENV === 'development' ? {
    //                     status: '/debug/status',
    //                     database: '/debug/database/:dbId',
    //                     storage: '/debug/storage'
    //                 } : 'Disabled in production'
    //             }
    //         });
    //     });
    // }

    // setupDebugEndpoints() {
    //     // Add debugging endpoints in development
    //     if (process.env.NODE_ENV === 'development') {
    //         const DebugHelpers = require('./scripts/debug-helpers');

    //         // Debug endpoint
    //         this.app.get('/debug/status', (req, res) => {
    //             res.json({
    //                 status: 'debug',
    //                 memory: process.memoryUsage(),
    //                 uptime: process.uptime(),
    //                 versions: process.versions,
    //                 env: process.env.NODE_ENV
    //             });
    //         });

    //         // Database inspection endpoint
    //         this.app.get('/debug/database/:dbId', async (req, res) => {
    //             try {
    //                 const database = await DebugHelpers.inspectDatabase(req.params.dbId);
    //                 res.json(database || { error: 'Database not found' });
    //             } catch (error) {
    //                 res.status(500).json({ error: error.message });
    //             }
    //         });

    //         // Storage analysis endpoint
    //         this.app.get('/debug/storage', async (req, res) => {
    //             try {
    //                 const analysis = await DebugHelpers.analyzeStorage();
    //                 res.json(analysis);
    //             } catch (error) {
    //                 res.status(500).json({ error: error.message });
    //             }
    //         });

    //         // User sessions inspection endpoint
    //         this.app.get('/debug/user/:userId/sessions', async (req, res) => {
    //             try {
    //                 const sessions = await DebugHelpers.inspectUserSessions(req.params.userId);
    //                 res.json(sessions || { error: 'User not found' });
    //             } catch (error) {
    //                 res.status(500).json({ error: error.message });
    //             }
    //         });

    //         colors.printInfo('Development debug endpoints enabled');
    //         colors.printInfo('  GET /debug/status - Server status');
    //         colors.printInfo('  GET /debug/database/:dbId - Database inspection');
    //         colors.printInfo('  GET /debug/storage - Storage analysis');
    //         colors.printInfo('  GET /debug/user/:userId/sessions - User sessions');
    //     }
    // }

    // setupWebSocket() {
    //     this.wss.on('connection', (ws) => {
    //         colors.printInfo('WebSocket client connected');

    //         ws.send(JSON.stringify({
    //             type: 'welcome',
    //             message: 'Connected to Hexabase Server',
    //             version: '1.0.0'
    //         }));

    //         ws.on('message', (message) => {
    //             try {
    //                 const data = JSON.parse(message);
    //                 this.handleWebSocketMessage(ws, data);
    //             } catch (error) {
    //                 ws.send(JSON.stringify({
    //                     type: 'error',
    //                     message: 'Invalid message format'
    //                 }));
    //             }
    //         });

    //         ws.on('close', () => {
    //             colors.printInfo('WebSocket client disconnected');
    //         });
    //     });
    // }

    // handleWebSocketMessage(ws, data) {
    //     switch (data.type) {
    //         case 'ping':
    //             ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
    //             break;
    //         case 'subscribe':
    //             // Handle real-time subscriptions
    //             ws.send(JSON.stringify({
    //                 type: 'subscribed',
    //                 channel: data.channel
    //             }));
    //             break;
    //         default:
    //             ws.send(JSON.stringify({
    //                 type: 'error',
    //                 message: 'Unknown message type'
    //             }));
    //     }
    // }

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

    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            uptime: process.uptime(),
            connections: this.wss.clients.size,
            debugEnabled: process.env.NODE_ENV === 'development'
        };
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
