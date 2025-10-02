// src/core/hexa-file-handler.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EncryptionService = require('./encryption');

class HexaFileHandler {
    constructor(filePath) {
        this.filePath = filePath;
        this.encryption = EncryptionService;
    }

    // Create a new .hexa file structure
    createFileStructure(fileType, initialData = {}) {
        const structure = {
            header: {
                version: "1.0.0",
                fileType: fileType,
                fileId: this.generateId(fileType),
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                encryption: {
                    algorithm: "aes-256-gcm",
                    keyVersion: "key_v1"
                }
            },
            metadata: {},
            data: initialData,
            indexes: {},
            footer: {
                checksum: "",
                dataIntegrity: "pending",
                fileSize: 0,
                recordCount: 0
            }
        };

        return this.saveStructure(structure);
    }

    // Save complete structure with encryption
    async saveStructure(structure) {
        try {
            // Update metadata
            structure.header.lastModified = new Date().toISOString();
            
            // Calculate checksum before encryption
            const dataString = JSON.stringify(structure.data);
            structure.footer.checksum = this.calculateChecksum(dataString);
            structure.footer.recordCount = this.countRecords(structure.data);
            
            // Encrypt the entire structure
            const encryptedData = this.encryption.encrypt(structure);
            
            // Add encryption metadata to header
            structure.header.encryption.iv = encryptedData.iv;
            structure.header.encryption.authTag = encryptedData.authTag;
            
            // Write to file
            const fileContent = {
                header: structure.header,
                encryptedData: encryptedData.data,
                footer: structure.footer
            };
            
            fs.writeFileSync(this.filePath, JSON.stringify(fileContent, null, 2));
            
            // Update file size
            structure.footer.fileSize = fs.statSync(this.filePath).size;
            
            return structure;
            
        } catch (error) {
            throw new Error(`Failed to save .hexa file: ${error.message}`);
        }
    }

    // Load and decrypt .hexa file
    async loadStructure() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return null;
            }
            
            const fileContent = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            const { header, encryptedData, footer } = fileContent;
            
            // Decrypt the data
            const decryptedData = this.encryption.decrypt({
                iv: header.encryption.iv,
                data: encryptedData,
                authTag: header.encryption.authTag
            });
            
            // Verify checksum
            const dataString = JSON.stringify(decryptedData.data);
            const currentChecksum = this.calculateChecksum(dataString);
            
            if (currentChecksum !== footer.checksum) {
                throw new Error('Data integrity check failed: Checksum mismatch');
            }
            
            return {
                header,
                metadata: decryptedData.metadata || {},
                data: decryptedData.data,
                indexes: decryptedData.indexes || {},
                footer: {
                    ...footer,
                    dataIntegrity: "verified"
                }
            };
            
        } catch (error) {
            throw new Error(`Failed to load .hexa file: ${error.message}`);
        }
    }

    // Update specific section of .hexa file
    async updateSection(sectionPath, newData) {
        const structure = await this.loadStructure();
        
        if (!structure) {
            throw new Error('File not found or corrupted');
        }
        
        // Navigate to section and update
        const pathParts = sectionPath.split('.');
        let current = structure.data;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) {
                current[pathParts[i]] = {};
            }
            current = current[pathParts[i]];
        }
        
        current[pathParts[pathParts.length - 1]] = {
            ...current[pathParts[pathParts.length - 1]],
            ...newData
        };
        
        return this.saveStructure(structure);
    }

    // Add document to collection
    async addDocument(collectionPath, documentId, document) {
        const structure = await this.loadStructure();
        
        if (!structure.data.clusters) {
            throw new Error('Invalid database structure');
        }
        
        // Add system metadata
        const documentWithMeta = {
            ...document,
            _system: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: this.getCurrentUserId(),
                version: 1
            }
        };
        
        // Update indexes
        this.updateIndexes(structure, collectionPath, documentId, document);
        
        return this.updateSection(`${collectionPath}.documents.${documentId}`, documentWithMeta);
    }

    // Update indexes for efficient querying
    updateIndexes(structure, collectionPath, documentId, document) {
        const collection = this.getNestedValue(structure.data, collectionPath);
        
        if (!collection.schema) {
            return;
        }
        
        const schema = collection.schema;
        
        // Create/update indexes for indexed fields
        Object.keys(schema.fields).forEach(fieldName => {
            const field = schema.fields[fieldName];
            
            if (field.unique || field.indexed) {
                if (!structure.indexes[fieldName]) {
                    structure.indexes[fieldName] = {};
                }
                
                structure.indexes[fieldName][document[fieldName]] = documentId;
            }
        });
    }

    // Helper methods
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    calculateChecksum(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    countRecords(data) {
        let count = 0;
        
        const countRecursive = (obj) => {
            if (typeof obj === 'object' && obj !== null) {
                if (obj.id && obj._system) {
                    count++; // Count as a record
                }
                Object.values(obj).forEach(value => countRecursive(value));
            }
        };
        
        countRecursive(data);
        return count;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, part) => current && current[part], obj);
    }

    getCurrentUserId() {
        // This would come from the current session
        return 'user_current'; // Placeholder
    }
}

module.exports = HexaFileHandler;