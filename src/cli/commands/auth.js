// All done

const AuthenticationService = require('../../auth/authentication');
const colors = require('../utils/colors');

class AuthCommands {
    static async register(args, cli) {
        if (args.length < 3) {
            colors.printError('Usage: register <name> <email> <password> [role]');
            return;
        }

        const [name, email, password, roleArg] = args;
        const role = roleArg ? roleArg.toLowerCase() : 'viewer'; // default to viewer

        try {
            const token = await AuthenticationService.register(name, email, password, role);
            const decoded = AuthenticationService.verifyToken(token);

            cli.setUser({
                name: decoded.name,
                email: decoded.email,
                role: decoded.role,
                userId: decoded.userId,
                token
            });

            colors.printSuccess(`Registration successful! Welcome, ${name}! Role: ${decoded.role}`);
        } catch (error) {
            if (error.message.includes('User already exists')) {
                colors.printWarning(`Email '${email}' is already registered`);
            } else {
                colors.printError(error.message);
            }
        }
    }



    static async login(args, cli) {
        try {
            if (args.length < 2) {
                if (args.length === 0) {
                    colors.printError('Email, and password are missing');
                } else if (args.length === 1) {
                    colors.printError('Password missing');
                }
                console.log('Usage: login <email> <password>');
                return;
            }

            const [email, password] = args;
            const token = await AuthenticationService.login(email, password);

            const decoded = AuthenticationService.verifyToken(token);
            cli.setUser({
                name: decoded.name,
                email: decoded.email,
                role: decoded.role,
                userId: decoded.userId,
                token
            });

            colors.printSuccess(`Welcome back, ${decoded.name}!`);
        } catch (error) {
            error.message === "Invalid credentials" ? colors.printError('Invalid credentials') : colors.printError(error.message)
        }
    }

    static async logout(args, cli) {
        const confirm = args.includes('-y');

        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.warning('Are you sure you want to logout? (y/N): '), (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        AuthCommands.performLogout(cli);
                    }
                    resolve();
                });
            });
        } else {
            AuthCommands.performLogout(cli);
        }
    }

    static performLogout(cli) {
        cli.setUser(null);
        cli.clearContext();
        colors.printSuccess('Logged out successfully.');
    }


    static async user(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Not logged in.');
            return;
        }

        console.log(colors.info('Current User:'));
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  User ID: ${user.userId}`);
    }

    static async changeRole(args, cli) {
        if (args.length < 2) {
            colors.printError('Usage: change-role <userId> <newRole>');
            return;
        }

        const [targetUserId, newRole] = args;
        const currentUser = cli.getUser();

        try {
            // Use the instance method
            const updatedUser = await AuthenticationService.changeUserRole(currentUser, targetUserId, newRole);
            colors.printSuccess(`Role updated! ${updatedUser.name} is now ${updatedUser.role}`);
        } catch (error) {
            colors.printError(error.message);
        }
    }

    static async listUser(args, cli) {
        const currentUser = cli.getUser();
        if (!currentUser) {
            colors.printError('You must be logged in to list users');
            return;
        }

        try {
            const users = await AuthenticationService.userStorage.findAll();

            if (!users.length) {
                colors.printInfo('No users found');
                return;
            }

            // Prepare table data
            const tableData = users.map(user => [
                user.id,
                user.name,
                user.role,
                new Date(user.createdAt).toLocaleString(),
                user.collections ? user.collections.length : 0,
                user.buckets ? user.buckets.length : 0
            ]);

            // Print table
            colors.printTable(
                ['ID', 'Name', 'Role', 'Created At', 'Collections', 'Buckets'],
                tableData
            );

        } catch (error) {
            colors.printError(error.message);
        }
    }
}

// Command metadata
AuthCommands.register.help = 'Register a new user: register <name> <email> <password>';
AuthCommands.login.help = 'Login to Hexabase: login <email> <password>';
AuthCommands.logout.help = 'Logout from Hexabase: logout [-y]';
AuthCommands.user.help = 'Show current user information: user';
AuthCommands.changeRole.help = 'Change the current user role: change-role'
AuthCommands.listUser.help = 'List all users: list user';

module.exports = AuthCommands;