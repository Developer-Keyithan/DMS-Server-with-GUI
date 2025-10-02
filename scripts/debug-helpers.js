const Logger = require('../src/utils/logger');
const StorageEngine = require('../src/core/storage-engine');

class DebugHelpers {
    // Database inspection
    static async inspectDatabase(dbId) {
        try {
            const dbStorage = new StorageEngine('databases');
            const database = await dbStorage.findById(dbId);

            if (!database) {
                Logger.error(`Database ${dbId} not found`);
                return null;
            }

            Logger.info(`Database: ${database.name} (${dbId})`);
            Logger.info(`Owner: ${database.ownerId}`);
            Logger.info(`Clusters: ${database.clusters.length}`);
            Logger.info(`Permissions: ${Object.keys(database.permissions).length} users`);

            return database;
        } catch (error) {
            Logger.error('Failed to inspect database', { error: error.message });
            return null;
        }
    }

    // User session inspection
    static async inspectUserSessions(userId) {
        try {
            const userStorage = new StorageEngine('users');
            const user = await userStorage.findById(userId);

            if (!user) {
                Logger.error(`User ${userId} not found`);
                return null;
            }

            const activeSessions = Object.values(user.sessions || {}).filter(
                session => session.isActive
            );

            Logger.info(`User: ${user.name} (${user.email})`);
            Logger.info(`Active sessions: ${activeSessions.length}`);
            Logger.info(`Last login: ${user.lastLogin}`);

            activeSessions.forEach(session => {
                Logger.debug('Active session', {
                    id: session.id,
                    createdAt: session.createdAt,
                    ip: session.ipAddress
                });
            });

            return activeSessions;
        } catch (error) {
            Logger.error('Failed to inspect user sessions', { error: error.message });
            return null;
        }
    }

    // Storage analysis
    static async analyzeStorage() {
        try {
            const fs = require('fs');
            const path = require('path');
            const dataPath = './data';

            if (!fs.existsSync(dataPath)) {
                Logger.warn('Data directory does not exist');
                return;
            }

            const files = fs.readdirSync(dataPath);
            let totalSize = 0;
            const fileStats = [];

            files.forEach(file => {
                if (file.endsWith('.hexa')) {
                    const filePath = path.join(dataPath, file);
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                    fileStats.push({
                        name: file,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            });

            Logger.info('Storage Analysis:');
            Logger.info(`Total files: ${fileStats.length}`);
            Logger.info(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

            fileStats.sort((a, b) => b.size - a.size);
            fileStats.slice(0, 5).forEach(file => {
                Logger.debug('Large file', {
                    name: file.name,
                    size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                    modified: file.modified
                });
            });

            return fileStats;
        } catch (error) {
            Logger.error('Failed to analyze storage', { error: error.message });
            return null;
        }
    }

    // Performance profiling
    static startProfiling() {
        const profile = {
            startTime: process.hrtime(),
            memoryStart: process.memoryUsage(),
            intervals: []
        };

        return {
            mark: (label) => {
                const time = process.hrtime(profile.startTime);
                const memory = process.memoryUsage();
                profile.intervals.push({
                    label,
                    time: (time[0] * 1000 + time[1] / 1000000).toFixed(2) + 'ms',
                    memory: {
                        rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
                        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`
                    }
                });
            },

            report: () => {
                Logger.info('Performance Profile:');
                profile.intervals.forEach(interval => {
                    Logger.info(`  ${interval.label}: ${interval.time}`, interval.memory);
                });
            }
        };
    }

    // Memory leak detection
    static setupMemoryLeakDetection() {
        const leakDetector = {
            snapshots: [],
            interval: null
        };

        leakDetector.interval = setInterval(() => {
            const snapshot = {
                timestamp: new Date(),
                memory: process.memoryUsage(),
                heapSnapshot: null
            };

            leakDetector.snapshots.push(snapshot);

            // Keep only last 10 snapshots
            if (leakDetector.snapshots.length > 10) {
                leakDetector.snapshots.shift();
            }

            // Check for memory growth
            if (leakDetector.snapshots.length >= 2) {
                const first = leakDetector.snapshots[0];
                const last = leakDetector.snapshots[leakDetector.snapshots.length - 1];
                const growth = last.memory.heapUsed - first.memory.heapUsed;

                if (growth > 50 * 1024 * 1024) { // 50MB growth
                    Logger.warn('Possible memory leak detected', {
                        growth: `${(growth / 1024 / 1024).toFixed(2)} MB`,
                        duration: `${(last.timestamp - first.timestamp) / 1000}s`
                    });
                }
            }
        }, 5000); // Check every 5 seconds

        return leakDetector;
    }
}

// Add to a debug utility file
class CommonIssues {
    static fixCommonProblems(error) {
        console.log('\n🔧 Common Issue Detected:');

        // Issue: Port already in use
        if (error.code === 'EADDRINUSE') {
            console.log('Port 7701 is already in use. Try:');
            console.log('  - Kill existing process: pkill -f "node.*hexabase"');
            console.log('  - Use different port: PORT=7702 npm run dev');
            console.log('  - Find and kill process: lsof -ti:7701 | xargs kill -9');
        }

        // Issue: Permission denied
        if (error.code === 'EACCES') {
            console.log('Permission denied. Try:');
            console.log('  - Run with sudo (not recommended)');
            console.log('  - Change data directory permissions: chmod 755 data/');
            console.log('  - Use different data directory: DATA_PATH=./my-data npm run dev');
        }

        // Issue: Encryption key problems
        if (error.message.includes('decryption failed')) {
            console.log('Encryption key issue. Try:');
            console.log('  - Regenerate key: rm config/encryption.key && npm run setup');
            console.log('  - Check key permissions: ls -la config/encryption.key');
        }

        // Issue: Module not found
        if (error.code === 'MODULE_NOT_FOUND') {
            console.log('Missing dependencies. Try:');
            console.log('  - Install dependencies: npm install');
            console.log('  - Clear node_modules: rm -rf node_modules && npm install');
            console.log('  - Check package.json: npm list');
        }

        // Issue: Data directory problems
        if (error.message.includes('data directory') || error.message.includes('ENOENT')) {
            console.log('Data directory issue. Try:');
            console.log('  - Create data directory: mkdir -p data');
            console.log('  - Run setup script: npm run setup');
            console.log('  - Check permissions: ls -la data/');
        }

        // Issue: Storage engine problems
        if (error.message.includes('storage') || error.message.includes('StorageEngine')) {
            console.log('Storage engine issue. Try:');
            console.log('  - Reset data: npm run reset');
            console.log('  - Check disk space: df -h');
            console.log('  - Verify file permissions');
        }
    }

    static diagnoseStartupIssues() {
        const issues = [];

        // Check data directory
        const fs = require('fs');
        const dataPath = './data';
        if (!fs.existsSync(dataPath)) {
            issues.push('Data directory does not exist. Run: mkdir -p data');
        }

        // Check config directory
        const configPath = './config';
        if (!fs.existsSync(configPath)) {
            issues.push('Config directory does not exist. Run setup script.');
        }

        // Check encryption key
        const keyPath = './config/encryption.key';
        if (!fs.existsSync(keyPath)) {
            issues.push('Encryption key missing. Run setup script.');
        }

        // Check node_modules
        const nodeModulesPath = './node_modules';
        if (!fs.existsSync(nodeModulesPath)) {
            issues.push('Dependencies not installed. Run: npm install');
        }

        return issues;
    }
}

module.exports = { DebugHelpers, CommonIssues };