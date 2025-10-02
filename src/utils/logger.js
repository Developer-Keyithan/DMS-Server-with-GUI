const fs = require('fs');
const path = require('path');
const colors = require('../cli/utils/colors');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.ensureLogDirectory();
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        this.currentLevel = process.env.LOG_LEVEL || 'INFO';
        this.debugEnabled = process.env.DEBUG === 'true' || process.env.DEBUG?.includes('hexabase');
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFilePath() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `hexabase-${date}.log`);
    }

    getDebugLogFilePath() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `debug-${date}.log`);
    }

    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.currentLevel];
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            pid: process.pid,
            ...meta
        };
        
        // Add stack trace for errors
        if (level === 'ERROR' && meta.error && meta.error.stack) {
            logEntry.stack = meta.error.stack;
        }
        
        return JSON.stringify(logEntry);
    }

    writeToFile(message, isDebug = false) {
        try {
            const logFile = isDebug ? this.getDebugLogFilePath() : this.getLogFilePath();
            fs.appendFileSync(logFile, message + '\n', { flag: 'a' });
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    // Enhanced debug methods
    debug(message, meta = {}) {
        if (this.shouldLog('DEBUG')) {
            const logMessage = this.formatMessage('DEBUG', message, meta);
            this.writeToFile(logMessage, true);
            
            if (this.debugEnabled) {
                console.log(colors.muted(`[DEBUG] ${message}`));
                if (Object.keys(meta).length > 0) {
                    console.log(colors.muted('  Metadata:'), JSON.stringify(meta, null, 2));
                }
            }
        }
    }

    trace(message, meta = {}) {
        if (this.shouldLog('TRACE')) {
            const logMessage = this.formatMessage('TRACE', message, meta);
            this.writeToFile(logMessage, true);
            
            if (this.debugEnabled) {
                console.log(colors.gray(`[TRACE] ${message}`));
                
                // Include call stack in trace
                const stack = new Error().stack.split('\n').slice(2, 5).join('\n');
                console.log(colors.gray('  Call stack:\n' + stack));
            }
        }
    }

    info(message, meta = {}) {
        if (this.shouldLog('INFO')) {
            const logMessage = this.formatMessage('INFO', message, meta);
            this.writeToFile(logMessage);
            colors.printInfo(`[INFO] ${message}`);
        }
    }

    warn(message, meta = {}) {
        if (this.shouldLog('WARN')) {
            const logMessage = this.formatMessage('WARN', message, meta);
            this.writeToFile(logMessage);
            colors.printWarning(`[WARN] ${message}`);
        }
    }

    error(message, meta = {}) {
        if (this.shouldLog('ERROR')) {
            const logMessage = this.formatMessage('ERROR', message, meta);
            this.writeToFile(logMessage);
            colors.printError(`[ERROR] ${message}`);
            
            // Always show stack trace for errors in development
            if (process.env.NODE_ENV === 'development' && meta.error) {
                console.error(colors.red(meta.error.stack));
            }
        }
    }

    // Performance logging
    time(label) {
        if (this.shouldLog('DEBUG')) {
            console.time(`[PERF] ${label}`);
        }
        return {
            label,
            start: process.hrtime()
        };
    }

    timeEnd(timer) {
        if (this.shouldLog('DEBUG')) {
            console.timeEnd(`[PERF] ${timer.label}`);
        }
    }

    // Memory usage logging
    logMemoryUsage(context = '') {
        if (this.shouldLog('DEBUG')) {
            const usage = process.memoryUsage();
            this.debug('Memory usage' + (context ? ` (${context})` : ''), {
                rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
                external: `${Math.round(usage.external / 1024 / 1024)} MB`
            });
        }
    }

    // Database operation logging
    logDatabaseOperation(operation, collection, duration, documentCount = 1) {
        if (this.shouldLog('DEBUG')) {
            this.debug(`Database ${operation}`, {
                collection,
                duration: `${duration}ms`,
                documentCount,
                operation
            });
        }
    }

    // HTTP request logging
    logHttpRequest(req, res, duration) {
        if (this.shouldLog('DEBUG')) {
            this.debug('HTTP Request', {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
        }
    }

    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.currentLevel = level;
            this.info(`Log level set to ${level}`);
        } else {
            this.error(`Invalid log level: ${level}`);
        }
    }

    enableDebug() {
        this.debugEnabled = true;
        this.setLogLevel('DEBUG');
    }

    disableDebug() {
        this.debugEnabled = false;
        this.setLogLevel('INFO');
    }
}

module.exports = new Logger();