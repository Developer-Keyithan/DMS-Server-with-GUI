const fs = require('fs');
const path = require('path');
const EncryptionService = require('./encryption');

class StorageEngine {
    constructor(storeName, basePath = './data') {
        this.storeName = storeName;
        this.basePath = path.resolve(basePath);
        this.filePath = path.join(this.basePath, `${storeName}.hexa`);
        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }

    async save(key, data) {
        const allData = await this.loadAll();
        allData[key] = data;

        const encrypted = EncryptionService.encrypt(allData);
        fs.writeFileSync(this.filePath, JSON.stringify(encrypted, null, 2));

        return key;
    }

    async findById(key) {
        const allData = await this.loadAll();
        return allData[key] || null;
    }

    async findAll() {
        const allData = await this.loadAll();
        return Object.values(allData);
    }

    async delete(key) {
        const allData = await this.loadAll();
        if (!allData[key]) {
            return false;
        }

        delete allData[key];
        const encrypted = EncryptionService.encrypt(allData);
        fs.writeFileSync(this.filePath, JSON.stringify(encrypted, null, 2));

        return true;
    }

    async loadAll() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return {};
            }

            const fileData = fs.readFileSync(this.filePath, 'utf8');
            const encryptedData = JSON.parse(fileData);

            return EncryptionService.decrypt(encryptedData);
        } catch (error) {
            console.error('Error loading data:', error.message);
            return {};
        }
    }

    async find(query) {
        const allData = await this.loadAll();
        const results = [];

        for (const item of Object.values(allData)) {
            let match = true;

            for (const [key, value] of Object.entries(query)) {
                if (item[key] !== value) {
                    match = false;
                    break;
                }
            }

            if (match) {
                results.push(item);
            }
        }

        return results;
    }

    async findOne(query) {
        const results = await this.find(query);
        return results.length > 0 ? results[0] : null;
    }

    async update(key, updates) {
        const existing = await this.findById(key);
        if (!existing) {
            throw new Error(`Record with key ${key} not found`);
        }

        const updated = { ...existing, ...updates, updatedAt: new Date() };
        return this.save(key, updated);
    }

    async count() {
        const allData = await this.loadAll();
        return Object.keys(allData).length;
    }

    removeFile() {
        if (fs.existsSync(this.filePath)) {
            fs.unlinkSync(this.filePath);
            return true;
        }
        return false;
    }
}

module.exports = StorageEngine;