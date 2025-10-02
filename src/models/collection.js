const EncryptionService = require('../core/encryption');

class Collection {
    constructor(id, name, clusterId, databaseId, createdAt = new Date()) {
        this.id = id;
        this.name = name;
        this.clusterId = clusterId;
        this.databaseId = databaseId;
        this.createdAt = createdAt;
        this.updatedAt = new Date();
        this.schema = null;
        this.documentCount = 0;
        this.indexes = {};
        this.permissions = {};
        this.statistics = {
            size: 0,
            lastUpdated: new Date(),
            operations: {
                insert: 0,
                update: 0,
                delete: 0,
                read: 0
            }
        };
        this.settings = {
            validation: {
                strict: true,
                allowUnknown: false
            },
            indexing: {
                autoIndex: true,
                background: true
            },
            compression: true
        };
    }

    setSchema(schema) {
        this.schema = schema;
        this.updatedAt = new Date();
    }

    removeSchema() {
        this.schema = null;
        this.updatedAt = new Date();
    }

    validateDocument(document) {
        if (!this.schema) {
            return { valid: true }; // No schema, no validation
        }

        const errors = [];
        const { fields, strict = true } = this.schema;

        // Check required fields
        for (const [fieldName, fieldConfig] of Object.entries(fields)) {
            if (fieldConfig.required && !(fieldName in document)) {
                errors.push(`Missing required field: ${fieldName}`);
                continue;
            }

            if (document[fieldName] !== undefined) {
                const fieldErrors = this.validateField(
                    fieldName, 
                    document[fieldName], 
                    fieldConfig
                );
                errors.push(...fieldErrors);
            }
        }

        // In strict mode, reject fields not in schema
        if (strict) {
            for (const fieldName of Object.keys(document)) {
                if (!fields[fieldName] && !fieldName.startsWith('_')) {
                    errors.push(`Field '${fieldName}' is not defined in schema`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    validateField(fieldName, value, config) {
        const errors = [];
        const { type, min, max, minLength, maxLength, pattern, enum: enumValues } = config;

        // Type validation
        switch (type) {
            case 'string':
                if (typeof value !== 'string') {
                    errors.push(`Field '${fieldName}' must be a string`);
                } else {
                    if (minLength !== undefined && value.length < minLength) {
                        errors.push(`Field '${fieldName}' must be at least ${minLength} characters`);
                    }
                    if (maxLength !== undefined && value.length > maxLength) {
                        errors.push(`Field '${fieldName}' must be at most ${maxLength} characters`);
                    }
                    if (pattern && !new RegExp(pattern).test(value)) {
                        errors.push(`Field '${fieldName}' must match pattern: ${pattern}`);
                    }
                }
                break;

            case 'number':
                if (typeof value !== 'number') {
                    errors.push(`Field '${fieldName}' must be a number`);
                } else {
                    if (min !== undefined && value < min) {
                        errors.push(`Field '${fieldName}' must be at least ${min}`);
                    }
                    if (max !== undefined && value > max) {
                        errors.push(`Field '${fieldName}' must be at most ${max}`);
                    }
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    errors.push(`Field '${fieldName}' must be a boolean`);
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    errors.push(`Field '${fieldName}' must be an array`);
                }
                break;

            case 'object':
                if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                    errors.push(`Field '${fieldName}' must be an object`);
                }
                break;

            case 'date':
                if (!(value instanceof Date) && isNaN(Date.parse(value))) {
                    errors.push(`Field '${fieldName}' must be a valid date`);
                }
                break;

            case 'timestamp':
                if (typeof value !== 'number' && !(value instanceof Date)) {
                    errors.push(`Field '${fieldName}' must be a timestamp or Date object`);
                }
                break;
        }

        // Enum validation
        if (enumValues && !enumValues.includes(value)) {
            errors.push(`Field '${fieldName}' must be one of: ${enumValues.join(', ')}`);
        }

        return errors;
    }

    addIndex(fieldName, options = {}) {
        this.indexes[fieldName] = {
            field: fieldName,
            unique: options.unique || false,
            sparse: options.sparse || false,
            createdAt: new Date()
        };
        this.updatedAt = new Date();
    }

    removeIndex(fieldName) {
        delete this.indexes[fieldName];
        this.updatedAt = new Date();
    }

    updateStatistics(operation, documentSize = 0) {
        this.statistics.operations[operation] = (this.statistics.operations[operation] || 0) + 1;
        
        if (operation === 'insert') {
            this.documentCount += 1;
            this.statistics.size += documentSize;
        } else if (operation === 'delete') {
            this.documentCount = Math.max(0, this.documentCount - 1);
            this.statistics.size = Math.max(0, this.statistics.size - documentSize);
        }
        
        this.statistics.lastUpdated = new Date();
        this.updatedAt = new Date();
    }

    getIndexedFields() {
        return Object.keys(this.indexes);
    }

    hasIndex(fieldName) {
        return !!this.indexes[fieldName];
    }

    isFieldUnique(fieldName) {
        const index = this.indexes[fieldName];
        return index ? index.unique : false;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            clusterId: this.clusterId,
            databaseId: this.databaseId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            schema: this.schema,
            documentCount: this.documentCount,
            indexes: this.indexes,
            statistics: this.statistics,
            settings: this.settings,
            permissions: this.permissions
        };
    }

    static fromJSON(data) {
        const collection = new Collection(data.id, data.name, data.clusterId, data.databaseId, data.createdAt);
        collection.updatedAt = data.updatedAt;
        collection.schema = data.schema;
        collection.documentCount = data.documentCount || 0;
        collection.indexes = data.indexes || {};
        collection.statistics = data.statistics || collection.statistics;
        collection.settings = data.settings || collection.settings;
        collection.permissions = data.permissions || {};
        return collection;
    }

    static createFromTemplate(template) {
        const collectionId = EncryptionService.generateId('coll');
        return new Collection(
            collectionId,
            template.name,
            template.clusterId,
            template.databaseId
        );
    }
}

module.exports = Collection;