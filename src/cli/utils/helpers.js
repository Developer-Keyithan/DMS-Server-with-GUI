const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const colors = require('./colors');

class Helpers {
    // File system utilities
    static ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    static readJSONFile(filePath, defaultValue = {}) {
        try {
            if (!fs.existsSync(filePath)) {
                return defaultValue;
            }
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            colors.printWarning(`Error reading JSON file ${filePath}: ${error.message}`);
            return defaultValue;
        }
    }

    static writeJSONFile(filePath, data) {
        try {
            this.ensureDirectoryExists(path.dirname(filePath));
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            colors.printError(`Error writing JSON file ${filePath}: ${error.message}`);
            return false;
        }
    }

    static fileExists(filePath) {
        return fs.existsSync(filePath);
    }

    static getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    // String utilities
    static truncateString(str, maxLength = 50) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }

    static capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static camelToTitleCase(str) {
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, char => char.toUpperCase())
            .trim();
    }

    // Validation utilities
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isValidName(name) {
        const nameRegex = /^[a-zA-Z0-9_\- ]{2,50}$/;
        return nameRegex.test(name);
    }

    static isValidId(id) {
        const idRegex = /^[a-zA-Z0-9_\-]{1,100}$/;
        return idRegex.test(id);
    }

    static isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Date utilities
    static formatDate(date, includeTime = true) {
        const d = new Date(date);
        const dateStr = d.toISOString().split('T')[0];
        
        if (!includeTime) return dateStr;
        
        const timeStr = d.toTimeString().split(' ')[0];
        return `${dateStr} ${timeStr}`;
    }

    static formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return this.formatDate(date, false);
    }

    // Number utilities
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static parseSize(sizeStr) {
        const units = {
            'b': 1,
            'kb': 1024,
            'mb': 1024 * 1024,
            'gb': 1024 * 1024 * 1024,
            'tb': 1024 * 1024 * 1024 * 1024
        };

        const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?b?)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2] || 'b';
        
        return value * (units[unit] || 1);
    }

    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Crypto utilities
    static generateRandomString(length = 16) {
        return crypto.randomBytes(length).toString('hex');
    }

    static generateId(prefix = '') {
        const timestamp = Date.now();
        const random = this.generateRandomString(8);
        return `${prefix}_${timestamp}_${random}`;
    }

    static calculateChecksum(data) {
        return crypto.createHash('md5').update(data).digest('hex');
    }

    // CLI-specific utilities
    static parseCommandArgs(args) {
        const parsed = {
            flags: {},
            options: {},
            positional: []
        };

        for (const arg of args) {
            if (arg.startsWith('--')) {
                // Long flag: --flag or --flag=value
                const [key, value] = arg.slice(2).split('=');
                parsed.flags[key] = value !== undefined ? value : true;
            } else if (arg.startsWith('-')) {
                // Short flag: -f or -f value
                const key = arg.slice(1);
                parsed.flags[key] = true;
            } else {
                // Positional argument
                parsed.positional.push(arg);
            }
        }

        return parsed;
    }

    static confirmAction(message, defaultValue = false) {
        return new Promise((resolve) => {
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const prompt = defaultValue ? 'Y/n' : 'y/N';
            rl.question(`${colors.warning(message)} (${prompt}): `, (answer) => {
                rl.close();
                const normalized = answer.trim().toLowerCase();
                
                if (normalized === '') {
                    resolve(defaultValue);
                } else {
                    resolve(normalized === 'y' || normalized === 'yes');
                }
            });
        });
    }

    static progressBar(current, total, width = 30) {
        const percentage = total > 0 ? (current / total) : 0;
        const filledWidth = Math.floor(width * percentage);
        const emptyWidth = width - filledWidth;
        
        const filledBar = '█'.repeat(filledWidth);
        const emptyBar = '░'.repeat(emptyWidth);
        
        return `[${filledBar}${emptyBar}] ${(percentage * 100).toFixed(1)}%`;
    }

    static spinner(frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']) {
        let i = 0;
        
        return {
            start: (text = '') => {
                process.stdout.write(`\r${frames[i]} ${text}`);
                i = (i + 1) % frames.length;
            },
            stop: (text = '') => {
                process.stdout.write(`\r${text}\n`);
            }
        };
    }

    // Table formatting
    static createTable(headers, rows, options = {}) {
        const {
            border = true,
            padding = 1,
            maxWidth = process.stdout.columns || 80
        } = options;

        // Calculate column widths
        const colWidths = headers.map((header, index) => {
            const headerLen = header.length;
            const maxDataLen = Math.max(...rows.map(row => 
                String(row[index] || '').length
            ));
            return Math.min(
                Math.max(headerLen, maxDataLen) + padding * 2,
                Math.floor(maxWidth / headers.length)
            );
        });

        // Create border
        const totalWidth = colWidths.reduce((sum, width) => sum + width, 0) + headers.length + 1;
        const borderLine = border ? '+'.padEnd(totalWidth, '-') + '+' : '';

        // Build table
        const lines = [];

        if (border) lines.push(borderLine);

        // Header
        const headerCells = headers.map((header, i) => 
            colors.header(header.padEnd(colWidths[i] - padding).padStart(colWidths[i]))
        );
        lines.push('|' + headerCells.join('|') + '|');

        if (border) lines.push(borderLine);

        // Rows
        rows.forEach((row, rowIndex) => {
            const rowCells = row.map((cell, i) => {
                const cellStr = String(cell || '');
                const truncated = this.truncateString(cellStr, colWidths[i] - padding);
                const padded = truncated.padEnd(colWidths[i] - padding).padStart(colWidths[i]);
                
                return rowIndex % 2 === 0 ? colors.row(padded) : colors.alternateRow(padded);
            });
            lines.push('|' + rowCells.join('|') + '|');
        });

        if (border) lines.push(borderLine);

        return lines.join('\n');
    }

    // Error handling
    static handleError(error, context = '') {
        const errorMessage = context ? `${context}: ${error.message}` : error.message;
        colors.printError(errorMessage);
        
        if (process.env.DEBUG) {
            console.error(colors.muted(error.stack));
        }
        
        return {
            success: false,
            error: error.message,
            context
        };
    }

    static async retryOperation(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries) {
                    colors.printWarning(`Attempt ${attempt} failed: ${error.message}. Retrying...`);
                    await this.sleep(delay * attempt);
                }
            }
        }
        
        throw lastError;
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Configuration helpers
    static getConfigPath() {
        const configDir = path.join(process.cwd(), 'config');
        this.ensureDirectoryExists(configDir);
        return configDir;
    }

    static getDataPath() {
        const dataDir = path.join(process.cwd(), 'data');
        this.ensureDirectoryExists(dataDir);
        return dataDir;
    }

    static getLogPath() {
        const logDir = path.join(process.cwd(), 'logs');
        this.ensureDirectoryExists(logDir);
        return logDir;
    }
}

module.exports = Helpers;