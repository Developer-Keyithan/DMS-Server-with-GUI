const readline = require('readline');
const colors = require('./utils/colors');
const CommandRegistry = require('./commands');

class HexabaseCLI {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            completer: this.completer.bind(this)
        });

        this.currentUser = null;
        this.currentContext = {
            database: null,
            cluster: null,
            collection: null,
            bucket: null,
            folder: null,
            mode: 'json' // 'json' or 'file'
        };

        this.commands = new CommandRegistry();
        this.history = [];
        this.historyIndex = -1;

        this.checkEnvironment();
        this.setupReadline();
    }

    checkEnvironment() {
        const { CommonIssues } = require('../../scripts/debug-helpers');
        const issues = CommonIssues.diagnoseStartupIssues();
        if (issues.length > 0) {
            console.log('\n⚠️  Environment Issues Detected:');
            issues.forEach(issue => colors.printWarning(issue));
            console.log(''); // Empty line
        }
    }

    setupReadline() {
        this.rl.on('line', async (input) => {
            await this.processCommand(input.trim());
            this.prompt();
        });

        this.rl.on('close', () => {
            console.log(colors.warning('\nGoodbye! Hexabase server is still running.'));
        });

        // Handle arrow keys for history
        process.stdin.on('keypress', (str, key) => {
            if (key.name === 'up' || key.name === 'down') {
                this.navigateHistory(key.name);
            }
        });
    }

    completer(line) {
        const completions = this.commands.getCommandNames();
        const hits = completions.filter(c => c.startsWith(line));
        return [hits.length ? hits : completions, line];
    }

    navigateHistory(direction) {
        if (direction === 'up' && this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
        } else if (direction === 'down' && this.historyIndex > 0) {
            this.historyIndex--;
        }

        if (this.historyIndex >= 0) {
            this.rl.line = this.history[this.history.length - 1 - this.historyIndex];
            this.rl.cursor = this.rl.line.length;
            this.rl.write(null, { ctrl: true, name: 'e' });
        }
    }

    // async processCommand(input) {
    //     if (!input) return;

    //     this.history.push(input);
    //     this.historyIndex = -1;

    //     const [command, ...args] = input.split(' ');

    //     try {
    //         if (command === 'help') {
    //             this.showHelp();
    //         } else if (command === 'clear') {
    //             console.clear();
    //         } else if (command === 'exit') {
    //             await this.handleExit();
    //         } else {
    //             await this.commands.execute(command, args, this);
    //         }
    //     } catch (error) {
    //         colors.printError(`Error: ${error.message}`);
    //     }
    // }

    // async processCommand(input) {
    //     if (!input) return;

    //     this.history.push(input);
    //     this.historyIndex = -1;

    //     // Parse command with support for multi-word commands
    //     const parts = input.split(' ');
    //     let commandName = '';
    //     let args = [];

    //     // Try to find the longest matching command
    //     for (let i = parts.length; i > 0; i--) {
    //         const potentialCommand = parts.slice(0, i).join(' ');
    //         if (this.commands.getCommandNames().includes(potentialCommand)) {
    //             commandName = potentialCommand;
    //             args = parts.slice(i);
    //             break;
    //         }
    //     }

    //     // If no multi-word command found, use first word as command
    //     if (!commandName && parts.length > 0) {
    //         commandName = parts[0];
    //         args = parts.slice(1);
    //     }

    //     try {
    //         if (commandName === 'help') {
    //             this.showHelp();
    //         } else if (commandName === 'clear') {
    //             console.clear();
    //         } else if (commandName === 'exit') {
    //             await this.handleExit();
    //         } else if (commandName) {
    //             await this.commands.execute(commandName, args, this);
    //         } else {
    //             colors.printError('Please enter a valid command. Type "help" for available commands.');
    //         }
    //     } catch (error) {
    //         colors.printError(`Error: ${error.message}`);
    //     }
    // }

    async processCommand(input) {
    if (!input) return;

    this.history.push(input);
    this.historyIndex = -1;

    // Simple command parsing - look for exact matches first
    const commandNames = this.commands.getCommandNames();
    
    // Check if the entire input matches a command
    if (commandNames.includes(input)) {
        await this.commands.execute(input, [], this);
        return;
    }

    // Check for commands with arguments
    for (const commandName of commandNames) {
        if (input.startsWith(commandName + ' ')) {
            const args = input.slice(commandName.length + 1).split(' ');
            await this.commands.execute(commandName, args, this);
            return;
        }
    }

    // If no command found, try single word commands
    const parts = input.split(' ');
    const singleWordCommand = parts[0];
    const args = parts.slice(1);

    if (commandNames.includes(singleWordCommand)) {
        await this.commands.execute(singleWordCommand, args, this);
    } else {
        colors.printError(`Unknown command: ${singleWordCommand}. Type 'help' for available commands.`);
    }
}

    async handleExit() {
        return new Promise((resolve) => {
            this.rl.question(colors.warning('Are you sure you want to exit? (y/N): '), (answer) => {
                if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                    console.log(colors.info('Closing Hexabase CLI...'));
                    this.rl.close();
                    process.exit(0);
                } else {
                    this.prompt();
                }
                resolve();
            });
        });
    }

    prompt() {
        let prompt = 'Hexabase';

        if (this.currentUser) {
            prompt += ` ${colors.user(`(${this.currentUser.name})`)}`;
        }

        if (this.currentContext.database) {
            prompt += ` ${colors.database(`db:${this.currentContext.database.name}`)}`;
        }

        if (this.currentContext.cluster) {
            prompt += ` ${colors.cluster(`cluster:${this.currentContext.cluster.name}`)}`;
        }

        if (this.currentContext.collection) {
            prompt += ` ${colors.collection(`collection:${this.currentContext.collection.name}`)}`;
        }

        if (this.currentContext.bucket) {
            prompt += ` ${colors.bucket(`bucket:${this.currentContext.bucket.name}`)}`;
        }

        if (this.currentContext.folder) {
            prompt += ` ${colors.folder(`folder:${this.currentContext.folder.name}`)}`;
        }

        this.rl.setPrompt(colors.highlight(prompt + ' > '));
        this.rl.prompt();
    }

    showWelcome() {
        console.log(colors.rainbow(`
╔═══════════════════════════════════════════════════╗
║                  HEXABASE CLI                     ║
║         Local Database Management System          ║
╚═══════════════════════════════════════════════════╝
        `));

        if (!this.currentUser) {
            colors.printWarning('Please login or register to continue');
           colors.printInfo('Commands: login <email> <password> | register <name> <email> <password>');
        }
    }

    showHelp() {
        console.log(colors.header('\nAvailable Commands:\n'));

        const categories = this.commands.getCommandsByCategory();

        Object.entries(categories).forEach(([category, commands]) => {
            console.log(colors.bold(category.toUpperCase() + ':'));
            commands.forEach(cmd => {
                console.log(`  ${colors.highlight(cmd.name.padEnd(20))} ${colors.muted(cmd.help)}`);
            });
            console.log('');
        });

        console.log(colors.muted('Use arrow keys for command history, Tab for auto-completion.'));
    }

    start() {
        this.showWelcome();
        this.prompt();
    }

    setContext(context, value) {
        this.currentContext[context] = value;
    }

    getContext() {
        return this.currentContext;
    }

    setUser(user) {
        this.currentUser = user;
    }

    getUser() {
        return this.currentUser;
    }

    clearContext() {
        this.currentContext = {
            database: null,
            cluster: null,
            collection: null,
            bucket: null,
            folder: null,
            mode: 'json'
        };
    }
}

module.exports = HexabaseCLI;