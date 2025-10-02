const Logger = require('../../utils/logger');

class ValidationMiddleware {
    // Common validation patterns
    patterns = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        name: /^[a-zA-Z0-9_\- ]{2,50}$/,
        id: /^[a-zA-Z0-9_\-]{1,100}$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    };

    // Validate user registration
    validateRegistration(req, res, next) {
        const { name, email, password } = req.body;
        const errors = [];

        if (!name || name.length < 2 || name.length > 50) {
            errors.push('Name must be between 2 and 50 characters');
        }

        if (!email || !this.patterns.email.test(email)) {
            errors.push('Valid email is required');
        }

        if (!password || password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (errors.length > 0) {
            Logger.warn('Registration validation failed', { errors, email });
            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        next();
    }

    // Validate database creation
    validateDatabase(req, res, next) {
        const { name } = req.body;
        const errors = [];

        if (!name || name.length < 2 || name.length > 50) {
            errors.push('Database name must be between 2 and 50 characters');
        }

        if (!this.patterns.name.test(name)) {
            errors.push('Database name can only contain letters, numbers, spaces, hyphens, and underscores');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        next();
    }

    // Validate collection creation
    validateCollection(req, res, next) {
        const { name, schema } = req.body;
        const errors = [];

        if (!name || name.length < 2 || name.length > 50) {
            errors.push('Collection name must be between 2 and 50 characters');
        }

        if (!this.patterns.name.test(name)) {
            errors.push('Collection name can only contain letters, numbers, spaces, hyphens, and underscores');
        }

        if (schema && typeof schema !== 'object') {
            errors.push('Schema must be a valid object');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        next();
    }

    // Validate document against schema
    validateDocument(schema) {
        return (req, res, next) => {
            if (!schema) {
                return next(); // No schema, no validation needed
            }

            const document = req.body;
            const validationResult = this.validateAgainstSchema(document, schema);

            if (!validationResult.valid) {
                return res.status(400).json({
                    error: 'Document validation failed',
                    details: validationResult.errors
                });
            }

            next();
        };
    }

    // Core schema validation logic
    validateAgainstSchema(document, schema) {
        const errors = [];
        const { fields, strict = true } = schema;

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

    // Validate individual field
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
        }

        // Enum validation
        if (enumValues && !enumValues.includes(value)) {
            errors.push(`Field '${fieldName}' must be one of: ${enumValues.join(', ')}`);
        }

        return errors;
    }

    // Validate file upload
    validateFileUpload(req, res, next) {
        const { originalname, size, mimetype } = req.file || {};
        const errors = [];

        if (!originalname) {
            errors.push('File name is required');
        }

        if (!size || size === 0) {
            errors.push('File cannot be empty');
        }

        if (size > 100 * 1024 * 1024) { // 100MB limit
            errors.push('File size must be less than 100MB');
        }

        // Basic MIME type validation
        const allowedTypes = [
            'image/', 'text/', 'application/json', 'application/pdf', 
            'application/zip', 'video/mp4', 'audio/mpeg'
        ];

        const isAllowed = allowedTypes.some(allowed => mimetype.startsWith(allowed));
        if (!isAllowed) {
            errors.push(`File type '${mimetype}' is not allowed`);
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'File validation failed',
                details: errors
            });
        }

        next();
    }

    // Validate query parameters
    validateQueryParams(req, res, next) {
        const { limit, skip, sort } = req.query;
        const errors = [];

        if (limit && (isNaN(limit) || limit < 1 || limit > 1000)) {
            errors.push('Limit must be a number between 1 and 1000');
        }

        if (skip && (isNaN(skip) || skip < 0)) {
            errors.push('Skip must be a non-negative number');
        }

        if (sort && typeof sort !== 'string') {
            errors.push('Sort must be a string');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Query parameter validation failed',
                details: errors
            });
        }

        next();
    }

    // Sanitize input data
    sanitizeInput(req, res, next) {
        // Sanitize string fields to prevent XSS
        if (req.body && typeof req.body === 'object') {
            this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            this.sanitizeObject(req.query);
        }

        next();
    }

    sanitizeObject(obj) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                // Basic XSS prevention - escape HTML characters
                obj[key] = obj[key]
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\//g, '&#x2F;');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.sanitizeObject(obj[key]);
            }
        }
    }

    // Rate limiting helper (would integrate with a proper rate limiter)
    checkRateLimit(req, res, next) {
        // This would integrate with a proper rate limiting solution
        // For now, just log the request for monitoring
        Logger.debug('Rate limit check', {
            ip: req.ip,
            path: req.path,
            method: req.method
        });

        next();
    }
}

module.exports = new ValidationMiddleware();