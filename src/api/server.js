const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
// const colors = require('../cli/utils/colors');
const Logger = require('../utils/logger');
const ConfigManager = require('../utils/config');

const authRouter = require('./routes/auth');
const dbRouter = require('./routes/database');
const collectionRouter = require('./routes/collection');
const fileRouter = require('./routes/file');

class ApiServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({
            server: this.server,
            path: '/ws'
        });

        this.port = ConfigManager.get('server.port') || 7701;
        this.host = ConfigManager.get('server.host') || '127.0.0.1';
        this.isRunning = false;
        this.clients = new Map();

        // Make WebSocket clients available to routes
        this.app.set('wsClients', this.clients);

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // CORS
        if (ConfigManager.get('server.cors.enabled')) {
            this.app.use(cors({
                origin: ConfigManager.get('server.cors.origions'),
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
            }));
        }

        // Body parsing
        this.app.use(express.json({
            limit: ConfigManager.get('server.bodyLimit') || '10mb'
        }));
        this.app.use(express.urlencoded({
            extended: true,
            limit: ConfigManager.get('server.bodyLimit') || '10mb'
        }));

        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                Logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
                    method: req.method,
                    url: req.originalUrl,
                    status: res.statusCode,
                    duration: duration,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
            });
            next();
        });

        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Powered-By', 'Hexabase');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                version: '1.0.022',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                connections: this.clients.size
            });
        });

        // API routes
        this.app.use('/api/v1/auth', authRouter);
        this.app.use('/api/v1/db', dbRouter);
        this.app.use('/api/v1/collections', collectionRouter);
        this.app.use('/api/v1/files', fileRouter);

        // API documentation
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Hexabase API',
                version: '1.0.0',
                endpoints: {
                    auth: '/api/v1/auth',
                    databases: '/api/v1/db',
                    collections: '/api/v1/collections',
                    files: '/api/v1/files'
                },
                documentation: 'https://docs.hexabase.io'
            });
        });

        // Serve static files for GUI (if exists)
        this.app.use('/ui', express.static(path.join(__dirname, '../../public')));

        // Default route
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Hexabase Server',
                version: '1.0.0',
                documentation: '/api',
                health: '/health'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                availableEndpoints: ['/api', '/health', '/api/v1/*']
            });
        });
    }

    // setupRoutes() {
    //     // this.app.get('/status', (req, res) => {
    //     //     try {
    //     //         res.json({
    //     //             status: 'healthy',
    //     //             version: '1.0.0',
    //     //             timestamp: new Date().toISOString(),
    //     //             uptime: process.uptime(),
    //     //             memory: process.memoryUsage(),
    //     //             connections: this.clients.size
    //     //         });
    //     //         // const wsClients = req.app.get('wsClients');
    //     //         // const uptime = process.uptime();
    //     //         // const memoryUsage = process.memoryUsage();
    //     //         // const activeConnections = wsClients?.size || 0;

    //     //         // const totalDatabases = await DatabaseManager.getDatabaseCount();
    //     //         // const totalCollections = await DatabaseManager.getCollectionCount();
    //     //         // const totalBuckets = await DatabaseManager.getBucketCount();
    //     //         // const totalUsers = await UserManager.getUserCount();

    //     //         // res.json({
    //     //         //     status: 'running',
    //     //         //     uptime,
    //     //         //     memoryUsage,
    //     //         //     activeConnections,
    //     //         //     databases: totalDatabases,
    //     //         //     stats: {
    //     //         //         totalUsers,
    //     //         //         totalDatabases,
    //     //         //         totalCollections,
    //     //         //         totalBuckets
    //     //         //     }
    //     //         // });
    //     //     } catch (error) {
    //     //         console.error(error);
    //     //         res.status(500).json({ status: 'error', message: error.message });
    //     //     }
    //     // });
    //     // Health check
    //     this.app.get('/health', (req, res) => {
    //         res.json({
    //             status: 'healthy',
    //             version: '1.0.02',
    //             timestamp: new Date().toISOString(),
    //             uptime: process.uptime(),
    //             memory: process.memoryUsage(),
    //             connections: this.clients.size
    //         });
    //     });

    //     // API routes
    //     // this.app.use('/api/v1/auth', require('./routes/auth'));
    //     // this.app.use('/api/v1/db', require('./routes/database'));
    //     // this.app.use('/api/v1/collections', require('./routes/collection'));
    //     // this.app.use('/api/v1/files', require('./routes/file'));
    //     // this.app.use('/status', require('./routes/status'));



    //     // API documentation
    //     this.app.get('/api', (req, res) => {
    //         res.json({
    //             name: 'Hexabase API',
    //             version: '1.0.0',
    //             endpoints: {
    //                 auth: '/api/v1/auth',
    //                 databases: '/api/v1/db',
    //                 collections: '/api/v1/collections',
    //                 files: '/api/v1/files',
    //                 status: '/api/status'
    //             },
    //             // documentation: 'https://docs.hexabase.io'
    //         });
    //     });

    //     // Serve static files for GUI (if exists)
    //     this.app.use('/ui', express.static(path.join(__dirname, '../../public')));

    //     // Default route
    //     this.app.get('/', (req, res) => {
    //         res.json({
    //             message: 'Hexabase Server',
    //             version: '1.0.0',
    //             documentation: '/api',
    //             health: '/health',
    //             status: '/api/status'
    //         });
    //     });

    //     // 404 handler
    //     this.app.use('*', (req, res) => {
    //         res.status(404).json({
    //             error: 'Endpoint not found',
    //             path: req.originalUrl,
    //             availableEndpoints: ['/api', '/health', '/api/status', '/api/v1/*']
    //         });
    //     });
    // }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, {
                ws,
                id: clientId,
                connectedAt: new Date(),
                lastActivity: new Date(),
                ip: req.socket.remoteAddress
            });

            Logger.info(`WebSocket client connected`, { clientId, ip: req.socket.remoteAddress });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                clientId,
                message: 'Connected to Hexabase WebSocket',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            }));

            // Broadcast client count to all clients
            this.broadcast({
                type: 'client_count',
                count: this.clients.size
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleWebSocketMessage(clientId, message);

                    // Update last activity
                    const client = this.clients.get(clientId);
                    if (client) {
                        client.lastActivity = new Date();
                    }
                } catch (error) {
                    Logger.error('WebSocket message parsing error', { clientId, error: error.message });
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                Logger.info('WebSocket client disconnected', { clientId });

                // Broadcast updated client count
                this.broadcast({
                    type: 'client_count',
                    count: this.clients.size
                });
            });

            ws.on('error', (error) => {
                Logger.error('WebSocket error', { clientId, error: error.message });
                this.clients.delete(clientId);
            });
        });

        // Heartbeat to keep connections alive and clean up dead ones
        setInterval(() => {
            this.cleanupDeadConnections();
        }, 30000); // Every 30 seconds
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            Logger.error('Unhandled error', {
                error: error.message,
                stack: error.stack,
                url: req.originalUrl,
                method: req.method
            });

            res.status(error.status || 500).json({
                error: process.env.NODE_ENV === 'production'
                    ? 'Internal server error'
                    : error.message,
                ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
            });
        });

        // Process event handlers
        process.on('unhandledRejection', (reason, promise) => {
            Logger.error('Unhandled Promise Rejection', { reason: reason.toString(), promise });
        });

        process.on('uncaughtException', (error) => {
            Logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
            process.exit(1);
        });
    }

    handleWebSocketMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { type, data, requestId } = message;

        try {
            switch (type) {
                case 'ping':
                    client.ws.send(JSON.stringify({
                        type: 'pong',
                        requestId,
                        timestamp: new Date().toISOString()
                    }));
                    break;

                case 'subscribe':
                    client.subscriptions = client.subscriptions || new Set();
                    client.subscriptions.add(data.channel);

                    client.ws.send(JSON.stringify({
                        type: 'subscribed',
                        requestId,
                        channel: data.channel,
                        timestamp: new Date().toISOString()
                    }));
                    break;

                case 'unsubscribe':
                    if (client.subscriptions) {
                        client.subscriptions.delete(data.channel);
                    }

                    client.ws.send(JSON.stringify({
                        type: 'unsubscribed',
                        requestId,
                        channel: data.channel,
                        timestamp: new Date().toISOString()
                    }));
                    break;

                case 'query':
                    // Handle real-time queries
                    this.handleRealtimeQuery(client, message);
                    break;

                default:
                    client.ws.send(JSON.stringify({
                        type: 'error',
                        requestId,
                        message: `Unknown message type: ${type}`,
                        timestamp: new Date().toISOString()
                    }));
            }
        } catch (error) {
            Logger.error('WebSocket message handling error', { clientId, type, error: error.message });
            client.ws.send(JSON.stringify({
                type: 'error',
                requestId,
                message: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    }

    handleRealtimeQuery(client, message) {
        // This would handle real-time database queries
        // For now, just acknowledge the query
        client.ws.send(JSON.stringify({
            type: 'query_ack',
            requestId: message.requestId,
            timestamp: new Date().toISOString()
        }));
    }

    broadcast(message, channel = null) {
        const messageStr = JSON.stringify(message);

        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                if (!channel || (client.subscriptions && client.subscriptions.has(channel))) {
                    client.ws.send(messageStr);
                }
            }
        });
    }

    cleanupDeadConnections() {
        const now = new Date();
        const timeout = 5 * 60 * 1000; // 5 minutes

        this.clients.forEach((client, clientId) => {
            if (now - client.lastActivity > timeout) {
                Logger.info('Closing inactive WebSocket connection', { clientId });
                client.ws.close();
                this.clients.delete(clientId);
            }
        });
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, this.host, (err) => {
                if (err) {
                    Logger.error('Failed to start API server', { error: err.message, port: this.port });
                    reject(err);
                    return;
                }

                this.isRunning = true;
                Logger.info(`API Server running on http://${this.host}:${this.port}`);
                Logger.info(`WebSocket server available on ws://${this.host}:${this.port}/ws`);

                resolve();
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            // Close all WebSocket connections
            this.clients.forEach((client) => {
                client.ws.close();
            });
            this.clients.clear();

            // Close HTTP server
            this.server.close(() => {
                this.isRunning = false;
                Logger.info('API Server stopped');
                resolve();
            });
        });
    }

    // getStatus() {
    //     return {
    //         isRunning: this.isRunning,
    //         host: this.host,
    //         port: this.port,
    //         uptime: process.uptime(),
    //         clients: this.clients.size,
    //         memory: process.memoryUsage()
    //     };
    // }
    getStatus() {
        return {
            isRunning: this.isRunning,
            host: this.host,
            port: this.port,
            uptime: process.uptime(),
            clients: this.clients.size,
            memory: process.memoryUsage()
        };
    }
}

module.exports = ApiServer;