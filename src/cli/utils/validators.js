const colors = require('./colors');
const Helpers = require('./helpers');

class Validators {
    // Database validators
    static validateDatabaseName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Database name cannot be empty' };
        }

        if (name.length < 2 || name.length > 50) {
            return { valid: false, error: 'Database name must be between 2 and 50 characters' };
        }

        if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) {
            return { valid: false, error: 'Database name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }

        return { valid: true };
    }

    static validateDatabaseId(id) {
        if (!id || id.trim().length === 0) {
            return { valid: false, error: 'Database ID cannot be empty' };
        }

        if (!/^db_[a-zA-Z0-9_\-]+$/.test(id)) {
            return { valid: false, error: 'Invalid database ID format' };
        }

        return { valid: true };
    }

    // Cluster validators
    static validateClusterName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Cluster name cannot be empty' };
        }

        if (name.length < 2 || name.length > 50) {
            return { valid: false, error: 'Cluster name must be between 2 and 50 characters' };
        }

        if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) {
            return { valid: false, error: 'Cluster name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }

        return { valid: true };
    }

    static validateClusterType(type) {
        const validTypes = ['json_only', 'file_only', 'mixed'];
        
        if (!validTypes.includes(type)) {
            return { 
                valid: false, 
                error: `Cluster type must be one of: ${validTypes.join(', ')}` 
            };
        }

        return { valid: true };
    }

    // Collection validators
    static validateCollectionName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Collection name cannot be empty' };
        }

        if (name.length < 2 || name.length > 50) {
            return { valid: false, error: 'Collection name must be between 2 and 50 characters' };
        }

        if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) {
            return { valid: false, error: 'Collection name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }

        return { valid: true };
    }

    static validateSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return { valid: false, error: 'Schema must be a valid object' };
        }

        const { fields, strict, timestamps } = schema;
        const errors = [];

        if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
            errors.push('Schema must contain at least one field');
        } else {
            for (const [fieldName, fieldConfig] of Object.entries(fields)) {
                const fieldErrors = this.validateFieldConfig(fieldName, fieldConfig);
                errors.push(...fieldErrors);
            }
        }

        if (strict !== undefined && typeof strict !== 'boolean') {
            errors.push('Strict mode must be a boolean');
        }

        if (timestamps !== undefined && typeof timestamps !== 'boolean') {
            errors.push('Timestamps must be a boolean');
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    static validateFieldConfig(fieldName, config) {
        const errors = [];
        const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'date', 'timestamp'];

        if (!config.type || !validTypes.includes(config.type)) {
            errors.push(`Field '${fieldName}' must have a valid type: ${validTypes.join(', ')}`);
        }

        if (config.required !== undefined && typeof config.required !== 'boolean') {
            errors.push(`Field '${fieldName}' required must be a boolean`);
        }

        if (config.unique !== undefined && typeof config.unique !== 'boolean') {
            errors.push(`Field '${fieldName}' unique must be a boolean`);
        }

        if (config.min !== undefined && typeof config.min !== 'number') {
            errors.push(`Field '${fieldName}' min must be a number`);
        }

        if (config.max !== undefined && typeof config.max !== 'number') {
            errors.push(`Field '${fieldName}' max must be a number`);
        }

        if (config.minLength !== undefined && typeof config.minLength !== 'number') {
            errors.push(`Field '${fieldName}' minLength must be a number`);
        }

        if (config.maxLength !== undefined && typeof config.maxLength !== 'number') {
            errors.push(`Field '${fieldName}' maxLength must be a number`);
        }

        if (config.pattern !== undefined && typeof config.pattern !== 'string') {
            errors.push(`Field '${fieldName}' pattern must be a string`);
        }

        if (config.enum !== undefined && (!Array.isArray(config.enum) || config.enum.length === 0)) {
            errors.push(`Field '${fieldName}' enum must be a non-empty array`);
        }

        if (config.default !== undefined) {
            const type = config.type;
            const defaultValue = config.default;
            
            switch (type) {
                case 'string':
                    if (typeof defaultValue !== 'string') {
                        errors.push(`Field '${fieldName}' default value must be a string`);
                    }
                    break;
                case 'number':
                    if (typeof defaultValue !== 'number') {
                        errors.push(`Field '${fieldName}' default value must be a number`);
                    }
                    break;
                case 'boolean':
                    if (typeof defaultValue !== 'boolean') {
                        errors.push(`Field '${fieldName}' default value must be a boolean`);
                    }
                    break;
                case 'array':
                    if (!Array.isArray(defaultValue)) {
                        errors.push(`Field '${fieldName}' default value must be an array`);
                    }
                    break;
                case 'object':
                    if (typeof defaultValue !== 'object' || defaultValue === null) {
                        errors.push(`Field '${fieldName}' default value must be an object`);
                    }
                    break;
            }
        }

        return errors;
    }

    // Document validators
    static validateDocument(document, schema = null) {
        if (!document || typeof document !== 'object') {
            return { valid: false, error: 'Document must be a valid object' };
        }

        if (!schema) {
            return { valid: true }; // No schema, no validation
        }

        return this.validateAgainstSchema(document, schema);
    }

    static validateAgainstSchema(document, schema) {
        const errors = [];
        const { fields, strict = true } = schema;

        // Check required fields
        for (const [fieldName, fieldConfig] of Object.entries(fields)) {
            if (fieldConfig.required && !(fieldName in document)) {
                errors.push(`Missing required field: ${fieldName}`);
                continue;
            }

            if (document[fieldName] !== undefined) {
                const fieldErrors = this.validateFieldValue(
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
            errors: errors.length > 0 ? errors : undefined
        };
    }

    static validateFieldValue(fieldName, value, config) {
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

    // Bucket validators
    static validateBucketName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Bucket name cannot be empty' };
        }

        if (name.length < 2 || name.length > 50) {
            return { valid: false, error: 'Bucket name must be between 2 and 50 characters' };
        }

        if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) {
            return { valid: false, error: 'Bucket name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }

        return { valid: true };
    }

    static validateFolderName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Folder name cannot be empty' };
        }

        if (name.length < 1 || name.length > 100) {
            return { valid: false, error: 'Folder name must be between 1 and 100 characters' };
        }

        if (!/^[a-zA-Z0-9_\- .]+$/.test(name)) {
            return { valid: false, error: 'Folder name can only contain letters, numbers, spaces, hyphens, underscores, and dots' };
        }

        return { valid: true };
    }

    // File validators
    static validateFileName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'File name cannot be empty' };
        }

        if (name.length > 255) {
            return { valid: false, error: 'File name must be less than 255 characters' };
        }

        // Basic check for invalid characters
        if (/[<>:"/\\|?*]/.test(name)) {
            return { valid: false, error: 'File name contains invalid characters' };
        }

        return { valid: true };
    }

    static validateFileSize(size, maxSize = 100 * 1024 * 1024) { // 100MB default
        if (typeof size !== 'number' || size < 0) {
            return { valid: false, error: 'File size must be a non-negative number' };
        }

        if (size > maxSize) {
            return { 
                valid: false, 
                error: `File size must be less than ${Helpers.formatFileSize(maxSize)}` 
            };
        }

        return { valid: true };
    }

    static validateFilePath(filePath) {
        if (!filePath || filePath.trim().length === 0) {
            return { valid: false, error: 'File path cannot be empty' };
        }

        if (!Helpers.fileExists(filePath)) {
            return { valid: false, error: `File not found: ${filePath}` };
        }

        try {
            const stats = Helpers.getFileSize(filePath);
            if (stats === 0) {
                return { valid: false, error: 'File is empty' };
            }
        } catch (error) {
            return { valid: false, error: `Cannot access file: ${error.message}` };
        }

        return { valid: true };
    }

    // Query validators
    static validateQuery(query) {
        if (!query || typeof query !== 'object') {
            return { valid: false, error: 'Query must be a valid object' };
        }

        // Check for common query operators
        const allowedOperators = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$regex'];
        
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object' && value !== null) {
                for (const operator of Object.keys(value)) {
                    if (!allowedOperators.includes(operator)) {
                        return { 
                            valid: false, 
                            error: `Unsupported query operator: ${operator}. Allowed: ${allowedOperators.join(', ')}` 
                        };
                    }
                }
            }
        }

        return { valid: true };
    }

    static validatePagination(limit, skip) {
        const errors = [];

        if (limit !== undefined) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
                errors.push('Limit must be a number between 1 and 1000');
            }
        }

        if (skip !== undefined) {
            const skipNum = parseInt(skip);
            if (isNaN(skipNum) || skipNum < 0) {
                errors.push('Skip must be a non-negative number');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    // User input validators
    static validateEmail(email) {
        if (!email || email.trim().length === 0) {
            return { valid: false, error: 'Email cannot be empty' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Invalid email format' };
        }

        return { valid: true };
    }

    static validatePassword(password) {
        if (!password || password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters long' };
        }

        // Check for password strength
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
            return {
                valid: false,
                error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            };
        }

        return { valid: true };
    }

    static validateUserName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Name cannot be empty' };
        }

        if (name.length < 2 || name.length > 50) {
            return { valid: false, error: 'Name must be between 2 and 50 characters' };
        }

        if (!/^[a-zA-Z ]+$/.test(name)) {
            return { valid: false, error: 'Name can only contain letters and spaces' };
        }

        return { valid: true };
    }

    // JSON validators
    static validateJSONString(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') {
            return { valid: false, error: 'Input must be a string' };
        }

        try {
            JSON.parse(jsonString);
            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Invalid JSON: ${error.message}` };
        }
    }

    static validateJSONArray(jsonString) {
        const result = this.validateJSONString(jsonString);
        if (!result.valid) return result;

        try {
            const parsed = JSON.parse(jsonString);
            if (!Array.isArray(parsed)) {
                return { valid: false, error: 'JSON must be an array' };
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Invalid JSON array: ${error.message}` };
        }
    }

    // Utility validators
    static validateHexabaseId(id, prefix = '') {
        if (!id || id.trim().length === 0) {
            return { valid: false, error: 'ID cannot be empty' };
        }

        const pattern = prefix ? new RegExp(`^${prefix}_[a-zA-Z0-9_\\-]+$`) : /^[a-zA-Z0-9_\-]+$/;
        
        if (!pattern.test(id)) {
            return { valid: false, error: `Invalid ID format. Expected pattern: ${prefix}_timestamp_random` };
        }

        return { valid: true };
    }

    static validatePositiveNumber(value, fieldName = 'Value') {
        const num = parseFloat(value);
        
        if (isNaN(num)) {
            return { valid: false, error: `${fieldName} must be a number` };
        }

        if (num < 0) {
            return { valid: false, error: `${fieldName} must be positive` };
        }

        return { valid: true };
    }

    static validateInteger(value, fieldName = 'Value') {
        const num = parseInt(value);
        
        if (isNaN(num)) {
            return { valid: false, error: `${fieldName} must be an integer` };
        }

        return { valid: true };
    }

    // Batch validation
    static validateAll(validations) {
        const errors = [];

        for (const validation of validations) {
            const result = validation.validator(...validation.args);
            if (!result.valid) {
                errors.push({
                    field: validation.field,
                    error: result.error
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    // Format validation errors for display
    static formatValidationErrors(errors) {
        if (!errors || errors.length === 0) return '';

        return errors.map(error => 
            typeof error === 'string' 
                ? `  - ${error}`
                : `  - ${error.field}: ${error.error}`
        ).join('\n');
    }
}

module.exports = Validators;