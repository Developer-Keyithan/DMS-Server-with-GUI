const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.key = this.loadOrGenerateKey();
    }

    loadOrGenerateKey() {
        const configDir = path.join(__dirname, '../../config');
        const keyPath = path.join(configDir, 'encryption.key');
        
        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        if (fs.existsSync(keyPath)) {
            return fs.readFileSync(keyPath);
        } else {
            const key = crypto.randomBytes(32);
            fs.writeFileSync(keyPath, key);
            console.log('Encryption key generated and saved');
            return key;
        }
    }

    encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            // Use createCipheriv instead of createCipher
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                iv: iv.toString('hex'),
                data: encrypted,
                authTag: authTag.toString('hex'),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipheriv(
                this.algorithm, 
                this.key, 
                Buffer.from(encryptedData.iv, 'hex')
            );
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return { salt, hash };
    }

    verifyPassword(password, salt, storedHash) {
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return hash === storedHash;
    }

    generateId(prefix = '') {
        return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
}

module.exports = new EncryptionService();