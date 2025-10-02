const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');
const EncryptionService = require('../../core/encryption');
const colors = require('../utils/colors');
const readline = require('readline');

class CollectionCommands {
    // done
    static async createCollection(args, cli) {
        try {
            const user = cli.getUser();
            if (!user) {
                colors.printWarning('Please login first');
                return
            }

            const context = cli.getContext();
            if (!context.database || !context.cluster) {
                colors.printWarning('No database or cluster selected.');
                console.log('Use "use database" and "use cluster" first.');
                return
            }

            if (args.length < 1) {
                console.log('Usage: create collection <name>');
                return
            }

            const name = args[0];

            // Check permissions
            if (!AuthorizationService.canAccessCollection(user, null, 'create')) {
                throw new Error('Insufficient permissions to create collection');
            }

            const clusterStorage = new StorageEngine(`${context.cluster.id}`);
            const cluster = await clusterStorage.findById('metadata');

            // Check if collection already exists
            if (cluster.collections.some(coll => coll.name === name)) {
                colors.printWarning(`Collection '${name}' already exists in this cluster`);
                return
            }

            const collectionId = EncryptionService.generateId('coll');
            const collection = {
                id: collectionId,
                name,
                clusterId: context.cluster.id,
                databaseId: context.database.id,
                createdAt: new Date(),
                updatedAt: new Date(),
                schema: null,
                documentCount: 0,
                indexes: {},
                statistics: {
                    size: 0,
                    lastUpdated: new Date()
                }
            };

            // Add collection to cluster
            cluster.collections.push({
                id: collectionId,
                name,
                createdAt: collection.createdAt
            });
            cluster.updatedAt = new Date();
            cluster.statistics.collections = cluster.collections.length;

            await clusterStorage.save('metadata', cluster);

            // Update CLI context
            cli.setContext('database', context.database);
            cli.setContext('cluster', cluster);
            // Create collection storage
            const collectionStorage = new StorageEngine(`${collectionId}`);
            await collectionStorage.save('metadata', collection);

            colors.printSuccess(`Collection '${name}' created successfully with ID: ${collectionId}`);
        } catch (error) {
            colors.printError(error.message)
        }
    }
    // done
    static async listCollection(args, cli) {
        try {
            const user = cli.getUser();
            if (!user) {
                colors.printWarning('Please login first');
                return
            }

            const context = cli.getContext();
            if (!context.database || !context.cluster) {
                colors.printWarning('No database or cluster selected.');
                return
            }

            const clusterStorage = new StorageEngine(`${context.cluster.id}`);
            const cluster = await clusterStorage.findById('metadata');

            if (cluster.collections.length === 0) {
                colors.printWarning('No collections found in this cluster.');
                return;
            }

            // Load collection details
            const collectionDetails = [];
            for (const collRef of cluster.collections) {
                const collectionStorage = new StorageEngine(`${collRef.id}`);
                const collection = await collectionStorage.findById('metadata');
                if (collection) {
                    collectionDetails.push(collection);
                }
            }

            const tableData = collectionDetails.map(collection => [
                // collection.id.length > 20 ? collection.id.substring(0, 17) + '...' : collection.id,
                // collection.name.length > 16 ? collection.name.substring(0, 13) + '...' : collection.name,
                collection.id,
                collection.name,
                collection.schema ? 'Yes' : 'No',
                collection.documentCount.toString(),
                new Date(collection.createdAt).toISOString().split('T')[0]
            ]);

            colors.printTable(
                ['ID', 'Name', 'Schema', 'Documents', 'Created'],
                tableData
            );
        } catch (error) {
            colors.printError(error.message)
        }
    }
    // done
    static async useCollection(args, cli) {
        try {
            const user = cli.getUser();
            if (!user) {
                colors.printWarning('Please login first');
                return
            }

            const context = cli.getContext();
            if (!context.database || !context.cluster) {
                colors.printWarning('No database or cluster selected.');
                return
            }

            if (args.length < 1) {
                console.log('Usage: use collection <id|name>');
            }

            const identifier = args[0];
            const clusterStorage = new StorageEngine(`${context.cluster.id}`);
            const cluster = await clusterStorage.findById('metadata');

            const collectionRef = cluster.collections.find(coll =>
                coll.id === identifier || coll.name === identifier
            );

            if (!collectionRef) {
                colors.printWarning(`Collection '${identifier}' not found in cluster '${cluster.name}'`);
            }

            // Load collection details
            const collectionStorage = new StorageEngine(`${collectionRef.id}`);
            const collection = await collectionStorage.findById('metadata');

            if (!collection) {
                throw new Error('Collection data corrupted or not found');
            }

            if (!AuthorizationService.canAccessCollection(user, collection, 'read')) {
                throw new Error('Insufficient permissions to access collection');
            }

            cli.setContext('collection', collection);
            cli.setContext('bucket', null);
            cli.setContext('folder', null);
            cli.setContext('mode', 'json');

            colors.printSuccess(`Using collection: ${collection.name}`);
        } catch (error) {
            colors.printError(error.message)
        }
    }
    // done
    static async currentCollection(args, cli) {
        const collection = cli.getContext().collection;
        if (!collection) {
            colors.printWarning('No collection selected.');
            return;
        }

        console.log(colors.info('Current Collection:'));
        console.log(`  ID: ${collection.id}`);
        console.log(`  Name: ${collection.name}`);
        console.log(`  Cluster: ${collection.clusterId}`);
        console.log(`  Database: ${collection.databaseId}`);
        console.log(`  Created: ${new Date(collection.createdAt).toLocaleString()}`);
        console.log(`  Documents: ${collection.documentCount}`);
        console.log(`  Has Schema: ${collection.schema ? 'Yes' : 'No'}`);

        if (collection.schema) {
            console.log(`  Schema Fields: ${Object.keys(collection.schema.fields || {}).length}`);
        }
    }
    // done
    static async editCollection(args, cli) {
        try {
            const user = cli.getUser();
            if (!user) {
                colors.printWarning('Please login first');
                return
            }

            const context = cli.getContext();
            if (!context.database || !context.cluster) {
                colors.printWarning('No database or cluster selected.');
                return
            }

            if (args.length < 2) {
                if (args.length === 1) {
                    colors.printError('New name missing')
                } else if (args.length === 0) {
                    colors.printError('Collection name, new name are missing')
                }
                console.log('Usage: edit collection <id|name> [name:new_name]');
                return;
            }

            const identifier = args[0];
            const updates = {};

            for (let i = 1; i < args.length; i++) {
                const [key, value] = args[i].split(':');
                if (key && value) {
                    updates[key] = value;
                }
            }

            if (Object.keys(updates).length === 0) {
                throw new Error('No valid updates provided');
            }

            const clusterStorage = new StorageEngine(`${context.cluster.id}`);
            const cluster = await clusterStorage.findById('metadata');

            const collectionRef = cluster.collections.find(coll =>
                coll.id === identifier || coll.name === identifier
            );

            if (!collectionRef) {
                colors.printError(`Collection '${identifier}' not found`);
                return
            }

            // Update collection metadata
            const collectionStorage = new StorageEngine(`${collectionRef.id}`);
            const collection = await collectionStorage.findById('metadata');

            if (!collection) {
                colors.printError('Collection data not found');
                return
            }

            const updatedCollection = { ...collection, ...updates, updatedAt: new Date() };
            await collectionStorage.save('metadata', updatedCollection);

            // Update cluster collection reference if name changed
            if (updates.name && collectionRef.name !== updates.name) {
                collectionRef.name = updates.name;
                cluster.updatedAt = new Date();
                await clusterStorage.save('metadata', cluster);
            }

            // Update context if current collection was edited
            if (context.collection && context.collection.id === collection.id) {
                cli.setContext('collection', updatedCollection);
            }

            colors.printSuccess(`Collection '${collection.name}' updated successfully`);
        } catch (error) {
            colors.printError(error.message)
        }
    }

    static async deleteCollection(args, cli) {
        try {
            const user = cli.getUser();
            if (!user) {
                colors.printWarning('Please login first');
                return
            }

            const context = cli.getContext();
            if (!context.database || !context.cluster) {
                colors.printWarning('No database or cluster selected.');
                return
            }

            if (args.length < 1) {
                console.log('Usage: delete collection <id|name>');
                return
            }

            const identifier = args[0];
            const confirm = args.includes('-y');

            const clusterStorage = new StorageEngine(`${context.cluster.id}`);
            const cluster = await clusterStorage.findById('metadata');

            const collectionIndex = cluster.collections.findIndex(coll =>
                coll.id === identifier || coll.name === identifier
            );

            if (collectionIndex === -1) {
                throw new Error(`Collection '${identifier}' not found`);
            }

            const collectionRef = cluster.collections[collectionIndex];

            if (!confirm) {
                return new Promise((resolve) => {
                    cli.rl.question(colors.warning(`Are you sure you want to delete collection '${collectionRef.name}' and all its documents? (y/N): `), (answer) => {
                        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                            CollectionCommands.performDeleteCollection(collectionRef, cluster, clusterStorage, collectionIndex, cli);
                        }
                        resolve();
                    });
                });
            } else {
                await CollectionCommands.performDeleteCollection(collectionRef, cluster, clusterStorage, collectionIndex, cli);
            }
        } catch (error) {
            colors.printError(error.message)
        }
    }

    static async performDeleteCollection(collectionRef, cluster, clusterStorage, collectionIndex, cli) {
        // Remove collection from cluster
        cluster.collections.splice(collectionIndex, 1);
        cluster.statistics.collections = cluster.collections.length;
        cluster.updatedAt = new Date();
        await clusterStorage.save('metadata', cluster);

        // Note: In real implementation, delete all collection data files

        colors.printSuccess(`Collection '${collectionRef.name}' deleted successfully`);

        // Clear context if deleted collection was current
        const context = cli.getContext();
        if (context.collection && context.collection.id === collectionRef.id) {
            cli.setContext('collection', null);
        }
    }

    static async createSchema(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: create schema <schema_name>');
        }

        const schemaName = args[0];
        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const collection = await collectionStorage.findById('metadata');

        if (collection.schema) {
            throw new Error('Collection already has a schema. Use "edit schema" to modify it.');
        }

        console.log(colors.info(`Creating schema '${schemaName}' for collection '${collection.name}'`));
        console.log(colors.muted('Follow the prompts to define your schema fields.'));

        const schema = await this.interactiveSchemaCreation(cli);

        collection.schema = {
            name: schemaName,
            ...schema,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        collection.updatedAt = new Date();

        await collectionStorage.save('metadata', collection);

        // Update context
        cli.setContext('collection', collection);

        colors.printSuccess(`Schema '${schemaName}' created successfully`);
    }

    static async interactiveSchemaCreation(cli) {
        return new Promise((resolve) => {
            const fields = {};
            let currentField = null;
            const fieldTypes = ['string', 'number', 'boolean', 'array', 'object', 'date', 'timestamp'];

            const askFieldName = () => {
                cli.rl.question(colors.info('Field name (or "done" to finish): '), (answer) => {
                    if (answer.toLowerCase() === 'done') {
                        askFinalOptions();
                        return;
                    }

                    if (fields[answer]) {
                        colors.printWarning(`Field '${answer}' already exists.`);
                        askFieldName();
                        return;
                    }

                    currentField = answer;
                    fields[answer] = { type: '', required: false };
                    askFieldType();
                });
            };

            const askFieldType = () => {
                console.log(colors.muted('Available types: ' + fieldTypes.join(', ')));
                cli.rl.question(colors.info(`Type for field '${currentField}': `), (answer) => {
                    if (!fieldTypes.includes(answer)) {
                        colors.printWarning('Invalid type. Please choose from available types.');
                        askFieldType();
                        return;
                    }

                    fields[currentField].type = answer;
                    askFieldRequired();
                });
            };

            const askFieldRequired = () => {
                cli.rl.question(colors.info(`Is field '${currentField}' required? (y/N): `), (answer) => {
                    fields[currentField].required = answer.toLowerCase() === 'y';

                    // Ask for additional validations based on type
                    askFieldValidations();
                });
            };

            const askFieldValidations = () => {
                // Simplified validation setup - extend based on type
                if (fields[currentField].type === 'string') {
                    cli.rl.question(colors.info(`Min length for '${currentField}' (press enter to skip): `), (min) => {
                        if (min) fields[currentField].minLength = parseInt(min);
                        cli.rl.question(colors.info(`Max length for '${currentField}' (press enter to skip): `), (max) => {
                            if (max) fields[currentField].maxLength = parseInt(max);
                            askUniqueConstraint();
                        });
                    });
                } else {
                    askUniqueConstraint();
                }
            };

            const askUniqueConstraint = () => {
                cli.rl.question(colors.info(`Should '${currentField}' be unique? (y/N): `), (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        fields[currentField].unique = true;
                    }
                    askFieldName(); // Back to next field
                });
            };

            const askFinalOptions = () => {
                cli.rl.question(colors.info('Add createdAt/updatedAt timestamps? (Y/n): '), (answer) => {
                    const timestamps = answer.toLowerCase() !== 'n';

                    cli.rl.question(colors.info('Enable strict mode? (Y/n): '), (answer) => {
                        const strict = answer.toLowerCase() !== 'n';

                        resolve({
                            fields,
                            timestamps,
                            strict,
                            version: '1.0'
                        });
                    });
                });
            };

            console.log(colors.info('\nStarting interactive schema creation...'));
            askFieldName();
        });
    }

    static async insertOne(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: insertone <json_document>');
        }

        // Parse JSON document
        let document;
        try {
            document = JSON.parse(args.join(' '));
        } catch (error) {
            throw new Error('Invalid JSON format. Please provide valid JSON.');
        }

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const collection = await collectionStorage.findById('metadata');

        // Validate against schema if exists
        if (collection.schema) {
            const validationResult = this.validateDocument(document, collection.schema);
            if (!validationResult.valid) {
                throw new Error(`Schema validation failed: ${validationResult.errors.join(', ')}`);
            }
        }

        // Add system fields
        const documentId = EncryptionService.generateId('doc');
        const documentWithMeta = {
            ...document,
            _id: documentId,
            _system: {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: user.userId,
                version: 1
            }
        };

        // Save document
        await collectionStorage.save(documentId, documentWithMeta);

        // Update collection statistics
        collection.documentCount += 1;
        collection.updatedAt = new Date();
        await collectionStorage.save('metadata', collection);

        colors.printSuccess(`Document inserted successfully with ID: ${documentId}`);
        return documentId;
    }

    static validateDocument(document, schema) {
        const errors = [];

        // Check required fields
        for (const [fieldName, fieldConfig] of Object.entries(schema.fields)) {
            if (fieldConfig.required && !(fieldName in document)) {
                errors.push(`Missing required field: ${fieldName}`);
            }

            // Type validation
            if (document[fieldName] !== undefined) {
                const expectedType = fieldConfig.type;
                const actualType = typeof document[fieldName];

                if (expectedType === 'array' && !Array.isArray(document[fieldName])) {
                    errors.push(`Field ${fieldName} should be array`);
                } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(document[fieldName]))) {
                    errors.push(`Field ${fieldName} should be object`);
                } else if (!['array', 'object'].includes(expectedType) && actualType !== expectedType) {
                    errors.push(`Field ${fieldName} should be ${expectedType}`);
                }

                // Length validations
                if (fieldConfig.type === 'string') {
                    if (fieldConfig.minLength && document[fieldName].length < fieldConfig.minLength) {
                        errors.push(`Field ${fieldName} should be at least ${fieldConfig.minLength} characters`);
                    }
                    if (fieldConfig.maxLength && document[fieldName].length > fieldConfig.maxLength) {
                        errors.push(`Field ${fieldName} should be at most ${fieldConfig.maxLength} characters`);
                    }
                }
            }
        }

        // Add timestamps if configured
        if (schema.timestamps) {
            if (!document.createdAt) document.createdAt = new Date();
            if (!document.updatedAt) document.updatedAt = new Date();
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async insertMany(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: insertmany <json_array_of_documents>');
        }

        // Parse JSON array
        let documents;
        try {
            documents = JSON.parse(args.join(' '));
        } catch (error) {
            throw new Error('Invalid JSON format. Please provide valid JSON array.');
        }

        if (!Array.isArray(documents)) {
            throw new Error('Input must be a JSON array of documents');
        }

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const collection = await collectionStorage.findById('metadata');

        const insertedIds = [];

        for (const document of documents) {
            // Validate against schema if exists
            if (collection.schema) {
                const validationResult = this.validateDocument(document, collection.schema);
                if (!validationResult.valid) {
                    colors.printWarning(`Skipping document: ${validationResult.errors.join(', ')}`);
                    continue;
                }
            }

            const documentId = EncryptionService.generateId('doc');
            const documentWithMeta = {
                ...document,
                _id: documentId,
                _system: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdBy: user.userId,
                    version: 1
                }
            };

            await collectionStorage.save(documentId, documentWithMeta);
            insertedIds.push(documentId);
        }

        // Update collection statistics
        collection.documentCount += insertedIds.length;
        collection.updatedAt = new Date();
        await collectionStorage.save('metadata', collection);

        colors.printSuccess(`${insertedIds.length} documents inserted successfully`);
        return insertedIds;
    }

    static async find(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        let query = {};
        if (args.length > 0) {
            try {
                query = JSON.parse(args.join(' '));
            } catch (error) {
                throw new Error('Invalid query format. Please provide valid JSON.');
            }
        }

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const allData = await collectionStorage.loadAll();

        // Remove metadata from results
        delete allData.metadata;

        const results = Object.values(allData).filter(doc => {
            for (const [key, value] of Object.entries(query)) {
                if (doc[key] !== value) {
                    return false;
                }
            }
            return true;
        });

        console.log(colors.info(`Found ${results.length} documents:`));
        console.log(JSON.stringify(results, null, 2));

        return results;
    }

    static async findOne(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: findone <query_json>');
        }

        let query;
        try {
            query = JSON.parse(args.join(' '));
        } catch (error) {
            throw new Error('Invalid query format. Please provide valid JSON.');
        }

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const allData = await collectionStorage.loadAll();

        // Remove metadata from results
        delete allData.metadata;

        const result = Object.values(allData).find(doc => {
            for (const [key, value] of Object.entries(query)) {
                if (doc[key] !== value) {
                    return false;
                }
            }
            return true;
        });

        if (result) {
            console.log(colors.info('Found document:'));
            console.log(JSON.stringify(result, null, 2));
        } else {
            colors.printWarning('No document found matching the query.');
        }

        return result;
    }

    static async listData(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const allData = await collectionStorage.loadAll();

        // Remove metadata from results
        delete allData.metadata;

        const documents = Object.values(allData);

        if (documents.length === 0) {
            colors.printWarning('No documents found in collection.');
            return;
        }

        // Create simplified table view
        const tableData = documents.map(doc => {
            const simplified = { ID: doc._id };

            // Add first few fields for display
            const fields = Object.keys(doc).filter(key => !key.startsWith('_'));
            for (let i = 0; i < Math.min(3, fields.length); i++) {
                const field = fields[i];
                let value = doc[field];
                if (typeof value === 'object') value = JSON.stringify(value).substring(0, 20) + '...';
                if (String(value).length > 20) value = String(value).substring(0, 17) + '...';
                simplified[field] = value;
            }

            return Object.values(simplified);
        });

        const headers = ['ID', ...Object.keys(documents[0] || {}).filter(key => !key.startsWith('_')).slice(0, 3)];

        colors.printTable(headers, tableData);
        console.log(colors.muted(`Total: ${documents.length} documents`));
    }

    static async editOne(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 2) {
            throw new Error('Usage: editone <document_id> <update_json>');
        }

        const documentId = args[0];
        let updates;
        try {
            updates = JSON.parse(args.slice(1).join(' '));
        } catch (error) {
            throw new Error('Invalid update format. Please provide valid JSON.');
        }

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const document = await collectionStorage.findById(documentId);

        if (!document) {
            throw new Error(`Document with ID '${documentId}' not found`);
        }

        // Validate updates against schema if exists
        const collection = await collectionStorage.findById('metadata');
        if (collection.schema) {
            const updatedDoc = { ...document, ...updates };
            const validationResult = this.validateDocument(updatedDoc, collection.schema);
            if (!validationResult.valid) {
                throw new Error(`Schema validation failed: ${validationResult.errors.join(', ')}`);
            }
        }

        // Apply updates
        const updatedDocument = {
            ...document,
            ...updates,
            _system: {
                ...document._system,
                updatedAt: new Date(),
                version: (document._system?.version || 0) + 1,
                updatedBy: user.userId
            }
        };

        await collectionStorage.save(documentId, updatedDocument);
        colors.printSuccess(`Document '${documentId}' updated successfully`);
    }

    static async deleteMany(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: deletemany <array_of_document_ids>');
        }

        let documentIds;
        try {
            documentIds = JSON.parse(args.join(' '));
        } catch (error) {
            // If not JSON, treat as single ID or space-separated IDs
            documentIds = args;
        }

        if (!Array.isArray(documentIds)) {
            documentIds = [documentIds];
        }

        const confirm = args.includes('-y') || false;
        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const collection = await collectionStorage.findById('metadata');

        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.warning(`Are you sure you want to delete ${documentIds.length} documents? (y/N): `), (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        this.performDeleteMany(documentIds, collectionStorage, collection, cli);
                    }
                    resolve();
                });
            });
        } else {
            await this.performDeleteMany(documentIds, collectionStorage, collection, cli);
        }
    }

    static async performDeleteMany(documentIds, collectionStorage, collection, cli) {
        let deletedCount = 0;

        for (const docId of documentIds) {
            const deleted = await collectionStorage.delete(docId);
            if (deleted) {
                deletedCount++;
            }
        }

        // Update collection statistics
        collection.documentCount = Math.max(0, collection.documentCount - deletedCount);
        collection.updatedAt = new Date();
        await collectionStorage.save('metadata', collection);

        colors.printSuccess(`${deletedCount} documents deleted successfully`);
    }

    // Add these methods to the CollectionCommands class

    static async editMany(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 2) {
            throw new Error('Usage: editmany <document_ids_array> <updates_json>');
        }

        // Parse document IDs
        let documentIds;
        try {
            documentIds = JSON.parse(args[0]);
        } catch (error) {
            throw new Error('Invalid document IDs format. Please provide valid JSON array.');
        }

        if (!Array.isArray(documentIds)) {
            throw new Error('First argument must be a JSON array of document IDs');
        }

        // Parse updates
        let updates;
        try {
            updates = JSON.parse(args.slice(1).join(' '));
        } catch (error) {
            throw new Error('Invalid updates format. Please provide valid JSON.');
        }

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const collection = await collectionStorage.findById('metadata');

        let updatedCount = 0;
        const errors = [];

        for (const documentId of documentIds) {
            try {
                const document = await collectionStorage.findById(documentId);

                if (!document) {
                    errors.push(`Document not found: ${documentId}`);
                    continue;
                }

                // Validate updates against schema if exists
                if (collection.schema) {
                    const updatedDoc = { ...document, ...updates };
                    const validationResult = this.validateDocument(updatedDoc, collection.schema);
                    if (!validationResult.valid) {
                        errors.push(`Validation failed for ${documentId}: ${validationResult.errors.join(', ')}`);
                        continue;
                    }
                }

                // Apply updates
                const updatedDocument = {
                    ...document,
                    ...updates,
                    _system: {
                        ...document._system,
                        updatedAt: new Date(),
                        version: (document._system?.version || 0) + 1,
                        updatedBy: user.userId
                    }
                };

                await collectionStorage.save(documentId, updatedDocument);
                updatedCount++;
            } catch (error) {
                errors.push(`Error updating ${documentId}: ${error.message}`);
            }
        }

        if (updatedCount > 0) {
            colors.printSuccess(`${updatedCount} documents updated successfully`);
        }

        if (errors.length > 0) {
            colors.printWarning(`${errors.length} errors occurred:`);
            errors.forEach(error => colors.printWarning(`  - ${error}`));
        }

        return { updatedCount, errors };
    }

    static async deleteOne(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.collection) {
            throw new Error('No database, cluster, or collection selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: deleteone <document_id> [-y]');
        }

        const documentId = args[0];
        const confirm = args.includes('-y');

        const collectionStorage = new StorageEngine(`${context.collection.id}`);
        const document = await collectionStorage.findById(documentId);

        if (!document) {
            throw new Error(`Document with ID '${documentId}' not found`);
        }

        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.warning(`Are you sure you want to delete document '${documentId}'? (y/N): `), (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        this.performDeleteOne(documentId, collectionStorage, context.collection.id, cli);
                    }
                    resolve();
                });
            });
        } else {
            await this.performDeleteOne(documentId, collectionStorage, context.collection.id, cli);
        }
    }

    static async performDeleteOne(documentId, collectionStorage, collectionId, cli) {
        const deleted = await collectionStorage.delete(documentId);

        if (deleted) {
            // Update collection statistics
            const collection = await collectionStorage.findById('metadata');
            collection.documentCount = Math.max(0, collection.documentCount - 1);
            collection.updatedAt = new Date();
            await collectionStorage.save('metadata', collection);

            colors.printSuccess(`Document '${documentId}' deleted successfully`);
        } else {
            colors.printError(`Failed to delete document '${documentId}'`);
        }
    }

    static async editSchema(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: edit schema <name|id>');
        }

        const identifier = args[0];

        // Find the collection
        const clusterStorage = new StorageEngine(`${context.cluster.id}`);
        const cluster = await clusterStorage.findById('metadata');

        const collectionRef = cluster.collections.find(coll =>
            coll.id === identifier || coll.name === identifier
        );

        if (!collectionRef) {
            throw new Error(`Collection '${identifier}' not found`);
        }

        const collectionStorage = new StorageEngine(`${collectionRef.id}`);
        const collection = await collectionStorage.findById('metadata');

        if (!collection.schema) {
            throw new Error(`Collection '${collectionRef.name}' doesn't have a schema to edit`);
        }

        console.log(colors.info(`Editing schema for collection '${collectionRef.name}'`));
        console.log(colors.info(`Current schema: ${collection.schema.name}`));

        // Interactive schema editing
        const updatedSchema = await this.interactiveSchemaEdit(collection.schema, cli);

        collection.schema = {
            ...updatedSchema,
            updatedAt: new Date()
        };
        collection.updatedAt = new Date();

        await collectionStorage.save('metadata', collection);

        colors.printSuccess(`Schema for collection '${collectionRef.name}' updated successfully`);
    }

    static async interactiveSchemaEdit(existingSchema, cli) {
        return new Promise((resolve) => {
            console.log(colors.info('\nCurrent schema fields:'));
            Object.entries(existingSchema.fields).forEach(([fieldName, config]) => {
                console.log(`  ${fieldName}: ${config.type} ${config.required ? '(required)' : ''}`);
            });

            const askAction = () => {
                console.log(colors.info('\nSchema editing options:'));
                console.log('  1. Add new field');
                console.log('  2. Remove field');
                console.log('  3. Modify field');
                console.log('  4. Finish editing');

                cli.rl.question(colors.info('Choose an option (1-4): '), (answer) => {
                    switch (answer) {
                        case '1':
                            this.addNewField(existingSchema, cli).then(askAction);
                            break;
                        case '2':
                            this.removeField(existingSchema, cli).then(askAction);
                            break;
                        case '3':
                            this.modifyField(existingSchema, cli).then(askAction);
                            break;
                        case '4':
                            resolve(existingSchema);
                            break;
                        default:
                            colors.printWarning('Invalid option. Please choose 1-4.');
                            askAction();
                    }
                });
            };

            askAction();
        });
    }

    static async addNewField(schema, cli) {
        return new Promise((resolve) => {
            const fieldTypes = ['string', 'number', 'boolean', 'array', 'object', 'date', 'timestamp'];

            cli.rl.question(colors.info('New field name: '), (fieldName) => {
                if (schema.fields[fieldName]) {
                    colors.printWarning(`Field '${fieldName}' already exists.`);
                    resolve(schema);
                    return;
                }

                console.log(colors.muted('Available types: ' + fieldTypes.join(', ')));
                cli.rl.question(colors.info(`Type for field '${fieldName}': `), (fieldType) => {
                    if (!fieldTypes.includes(fieldType)) {
                        colors.printWarning('Invalid type.');
                        resolve(schema);
                        return;
                    }

                    cli.rl.question(colors.info(`Is field '${fieldName}' required? (y/N): `), (requiredAnswer) => {
                        schema.fields[fieldName] = {
                            type: fieldType,
                            required: requiredAnswer.toLowerCase() === 'y'
                        };

                        colors.printSuccess(`Field '${fieldName}' added to schema`);
                        resolve(schema);
                    });
                });
            });
        });
    }

    static async removeField(schema, cli) {
        return new Promise((resolve) => {
            const fieldNames = Object.keys(schema.fields);

            if (fieldNames.length === 0) {
                colors.printWarning('No fields to remove.');
                resolve(schema);
                return;
            }

            console.log(colors.info('Current fields:'));
            fieldNames.forEach((field, index) => {
                console.log(`  ${index + 1}. ${field}`);
            });

            cli.rl.question(colors.info('Enter field name to remove: '), (fieldName) => {
                if (!schema.fields[fieldName]) {
                    colors.printWarning(`Field '${fieldName}' not found.`);
                    resolve(schema);
                    return;
                }

                delete schema.fields[fieldName];
                colors.printSuccess(`Field '${fieldName}' removed from schema`);
                resolve(schema);
            });
        });
    }

    static async modifyField(schema, cli) {
        return new Promise((resolve) => {
            const fieldNames = Object.keys(schema.fields);

            if (fieldNames.length === 0) {
                colors.printWarning('No fields to modify.');
                resolve(schema);
                return;
            }

            console.log(colors.info('Current fields:'));
            fieldNames.forEach((field, index) => {
                console.log(`  ${index + 1}. ${field}`);
            });

            cli.rl.question(colors.info('Enter field name to modify: '), (fieldName) => {
                if (!schema.fields[fieldName]) {
                    colors.printWarning(`Field '${fieldName}' not found.`);
                    resolve(schema);
                    return;
                }

                const currentConfig = schema.fields[fieldName];
                console.log(colors.info(`Current configuration for '${fieldName}':`));
                console.log(`  Type: ${currentConfig.type}`);
                console.log(`  Required: ${currentConfig.required}`);

                cli.rl.question(colors.info('Toggle required? (y/N): '), (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        schema.fields[fieldName].required = !currentConfig.required;
                        colors.printSuccess(`Field '${fieldName}' required set to: ${schema.fields[fieldName].required}`);
                    }
                    resolve(schema);
                });
            });
        });
    }

    static async deleteSchema(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: delete schema <name|id>');
        }

        const identifier = args[0];
        const confirm = args.includes('-y');

        // Find the collection
        const clusterStorage = new StorageEngine(`${context.cluster.id}`);
        const cluster = await clusterStorage.findById('metadata');

        const collectionRef = cluster.collections.find(coll =>
            coll.id === identifier || coll.name === identifier
        );

        if (!collectionRef) {
            throw new Error(`Collection '${identifier}' not found`);
        }

        const collectionStorage = new StorageEngine(`${collectionRef.id}`);
        const collection = await collectionStorage.findById('metadata');

        if (!collection.schema) {
            throw new Error(`Collection '${collectionRef.name}' doesn't have a schema`);
        }

        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.warning(`Are you sure you want to delete the schema for collection '${collectionRef.name}'? This will remove all schema validation. (y/N): `), (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        this.performDeleteSchema(collection, collectionStorage, collectionRef.name);
                    }
                    resolve();
                });
            });
        } else {
            await this.performDeleteSchema(collection, collectionStorage, collectionRef.name);
        }
    }

    static async performDeleteSchema(collection, collectionStorage, collectionName) {
        collection.schema = null;
        collection.updatedAt = new Date();

        await collectionStorage.save('metadata', collection);

        colors.printSuccess(`Schema for collection '${collectionName}' deleted successfully`);
    }

    static async switchFilesystem(args, cli) {
        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        cli.setContext('mode', 'file');
        cli.setContext('collection', null);

        colors.printSuccess('Switched to file storage mode');
    }
}

// Command metadata
// Collection
CollectionCommands.createCollection.help = 'Create a new collection: create collection <name>';
CollectionCommands.listCollection.help = 'List all collections in current cluster: list collection';
CollectionCommands.useCollection.help = 'Switch to a collection: use collection <id|name>';
CollectionCommands.currentCollection.help = 'Show current collection: current collection';
CollectionCommands.editCollection.help = 'Edit collection: edit collection <id|name> [name:new_name]';
CollectionCommands.deleteCollection.help = 'Delete collection: delete collection <id|name> [-y]';

// Schema
CollectionCommands.createSchema.help = 'Create schema for current collection: create schema <name>';
CollectionCommands.deleteSchema.help = 'Delete collection schema: delete schema <name|id> [-y]';
CollectionCommands.editSchema.help = 'Edit collection schema: edit schema <name|id>';

// Data
CollectionCommands.insertOne.help = 'Insert one document: insertone <json_document>';
CollectionCommands.insertMany.help = 'Insert multiple documents: insertmany <json_array>';
CollectionCommands.find.help = 'Find documents: find [query_json]';
CollectionCommands.findOne.help = 'Find one document: findone <query_json>';
CollectionCommands.listData.help = 'List all documents: listdata';
CollectionCommands.editOne.help = 'Edit one document: editone <document_id> <update_json>';
CollectionCommands.editMany.help = 'Edit multiple documents: editmany <document_ids_array> <updates_json>';
CollectionCommands.deleteOne.help = 'Delete one document: deleteone <document_id> [-y]';
CollectionCommands.deleteMany.help = 'Delete multiple documents: deletemany <document_ids_array> [-y]';

// Switch to File Storage system
CollectionCommands.switchFilesystem.help = 'Switch to file storage mode: switch filesystem';

module.exports = CollectionCommands;