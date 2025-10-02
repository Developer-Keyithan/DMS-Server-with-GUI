const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configDir = path.join(__dirname, '../../config');
        this.configFile = path.join(this.configDir, 'config.json');
        this.defaultConfig = {
            server: {
                port: 7701,
                host: '127.0.0.1',
                cors: {
                    enabled: true,
                    origins: ['*']
                }
            },
            security: {
                jwtSecret: 'hexabase-default-secret-change-in-production',
                tokenExpiry: '24h',
                passwordPolicy: {
                    minLength: 8,
                    requireNumbers: true,
                    requireSpecialChars: true
                }
            },
            storage: {
                dataPath: './data',
                encryption: {
                    algorithm: 'aes-256-gcm',
                    keyRotationDays: 90
                }
            },
            logging: {
                level: 'INFO',
                file: {
                    enabled: true,
                    maxSize: '10MB',
                    maxFiles: 10
                }
            },
            performance: {
                cache: {
                    enabled: true,
                    maxSize: '100MB',
                    ttl: 300 // 5 minutes
                },
                compression: {
                    enabled: true,
                    threshold: '1KB'
                }
            }
        };
        this.ensureConfigDirectory();
        this.loadConfig();
    }

    ensureConfigDirectory() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const fileData = fs.readFileSync(this.configFile, 'utf8');
                const userConfig = JSON.parse(fileData);
                this.config = this.deepMerge(this.defaultConfig, userConfig);
            } else {
                this.config = this.defaultConfig;
                this.saveConfig();
            }
        } catch (error) {
            console.error('Error loading config file, using defaults:', error.message);
            this.config = this.defaultConfig;
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config file:', error.message);
        }
    }

    deepMerge(target, source) {
        const output = { ...target };
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        
        return output;
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    get(key) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current)) {
                current[k] = {};
            }
            current = current[k];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveConfig();
    }

    getAll() {
        return { ...this.config };
    }

    resetToDefaults() {
        this.config = { ...this.defaultConfig };
        this.saveConfig();
    }

    validateConfig() {
        const errors = [];
        
        // Validate server port
        const port = this.get('server.port');
        if (port < 1 || port > 65535) {
            errors.push('Server port must be between 1 and 65535');
        }
        
        // Validate token expiry
        const tokenExpiry = this.get('security.tokenExpiry');
        if (!tokenExpiry || typeof tokenExpiry !== 'string') {
            errors.push('Token expiry must be a string');
        }
        
        // Validate data path
        const dataPath = this.get('storage.dataPath');
        try {
            fs.accessSync(dataPath, fs.constants.W_OK);
        } catch (error) {
            errors.push(`Data path '${dataPath}' is not writable`);
        }
        
        return errors;
    }
}

module.exports = new ConfigManager();