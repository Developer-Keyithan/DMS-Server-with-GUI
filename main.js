const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

class HexabaseDesktop {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.serverProcess = null;
        this.isServerRunning = false;
        this.appPath = app.getAppPath();
        this.userDataPath = app.getPath('userData');
        this.isDev = process.env.NODE_ENV === 'development';

        // Create necessary directories
        this.createAppDirectories();
        this.setupApp();
    }

    createAppDirectories() {
        const dirs = [
            path.join(this.userDataPath, 'data'),
            path.join(this.userDataPath, 'config'),
            path.join(this.userDataPath, 'logs')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    setupApp() {
        app.setName('HexabaseDB');
        app.setAppUserModelId('com.hexabase.database');

        // Single instance lock
        if (!app.requestSingleInstanceLock()) {
            app.quit();
            return;
        }

        app.on('second-instance', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isMinimized()) this.mainWindow.restore();
                this.mainWindow.focus();
            }
        });

        app.whenReady().then(() => {
            this.createWindow();
            this.createTray();
            this.setupMenu();
            this.setupIPC();
        });

        app.on('window-all-closed', (e) => {
            e.preventDefault();
            if (this.mainWindow) {
                this.mainWindow.hide();
            }
        });

        app.on('before-quit', () => {
            this.stopServer();
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createWindow();
            }
        });
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: this.isDev ? 1500 : 1000,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            resizable: false,
            icon: path.join(__dirname, 'icons/icon.ico'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: !this.isDev
            },
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            show: false,
            title: 'HexabaseDB - Database Management System'
        });

        // Load the GUI
        const guiPath = this.isDev
            ? 'http://localhost:3001'
            : `file://${path.join(__dirname, '/index.html')}`;

        this.mainWindow.loadURL(guiPath);

        if (this.isDev) {
            this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        }

        // if (this.isDev) {
        //     this.mainWindow.webContents.openDevTools();
        // }

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

        this.mainWindow.on('close', (e) => {
            if (!app.isQuitting) {
                e.preventDefault();
                this.mainWindow.hide();
                return false;
            }
            return true;
        });
    }

    createTray() {
        const iconPath = path.join(__dirname, 'icons/icon.png');
        this.tray = new Tray(iconPath);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Hexabase',
                click: () => {
                    this.showWindow();
                }
            },
            {
                label: 'Server Status',
                click: () => {
                    this.showWindow();
                }
            },
            { type: 'separator' },
            {
                label: 'Start Server',
                click: () => {
                    this.startServer();
                }
            },
            {
                label: 'Stop Server',
                click: () => {
                    this.stopServer();
                }
            },
            { type: 'separator' },
            {
                label: 'Quit Hexabase',
                click: () => {
                    app.isQuitting = true;
                    app.quit();
                }
            }
        ]);

        this.tray.setToolTip('HexabaseDB - Database Server');
        this.tray.setContextMenu(contextMenu);

        this.tray.on('double-click', () => {
            this.showWindow();
        });
    }

    showWindow() {
        if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            }
            this.mainWindow.show();
            this.mainWindow.focus();
        }
    }

    setupMenu() {
        const template = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Show Server Status',
                        click: () => this.showWindow()
                    },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            app.isQuitting = true;
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: 'Server',
                submenu: [
                    {
                        label: 'Start Server',
                        accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Ctrl+R',
                        click: () => this.startServer()
                    },
                    {
                        label: 'Stop Server',
                        accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Ctrl+Shift+R',
                        click: () => this.stopServer()
                    },
                    {
                        label: 'Restart Server',
                        accelerator: process.platform === 'darwin' ? 'Cmd+E' : 'Ctrl+E',
                        click: () => this.restartServer()
                    }
                ]
            },
            {
                label: 'Tools',
                submenu: [
                    {
                        label: 'Open CLI Terminal',
                        accelerator: process.platform === 'darwin' ? 'Cmd+T' : 'Ctrl+T',
                        click: () => this.openTerminal()
                    },
                    {
                        label: 'Open Data Directory',
                        click: () => this.openDataDirectory()
                    },
                    {
                        label: 'Toggle Developer Tools',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
                        click: () => this.mainWindow.webContents.toggleDevTools()
                    }
                ]
            },
            {
                label: 'Help',
                submenu: [
                    {
                        label: 'Documentation',
                        click: () => shell.openExternal('https://docs.hexabase.com')
                    },
                    {
                        label: 'About Hexabase',
                        click: () => this.showAbout()
                    }
                ]
            }
        ];

        if (process.platform === 'darwin') {
            template.unshift({
                label: 'HexabaseDB',
                submenu: [
                    { role: 'about', label: 'About HexabaseDB' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit', label: 'Quit HexabaseDB' }
                ]
            });
        }

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    setupIPC() {
        // Server control
        ipcMain.handle('server:start', () => this.startServer());
        ipcMain.handle('server:stop', () => this.stopServer());
        ipcMain.handle('server:restart', () => this.restartServer());
        ipcMain.handle('server:status', () => this.getServerStatus());

        // System info
        ipcMain.handle('app:getVersion', () => app.getVersion());
        ipcMain.handle('app:showItemInFolder', (event, filePath) => shell.showItemInFolder(filePath));
        ipcMain.handle('app:openExternal', (event, url) => shell.openExternal(url));

        // Terminal
        ipcMain.handle('terminal:open', () => this.openTerminal());
    }

    // async startServer() {
    //     return new Promise((resolve, reject) => {
    //         if (this.isServerRunning) {
    //             resolve({ success: true, message: 'Server already running' });
    //             return;
    //         }

    //         const serverScript = path.join(this.appPath, 'src', 'core', 'server.js');

    //         if (!fs.existsSync(serverScript)) {
    //             reject(new Error('Server script not found'));
    //             return;
    //         }

    //         // Set environment for production
    //         const env = {
    //             ...process.env,
    //             NODE_ENV: 'production',
    //             HEXABASE_DATA_PATH: path.join(this.userDataPath, 'data'),
    //             HEXABASE_CONFIG_PATH: path.join(this.userDataPath, 'config'),
    //             HEXABASE_LOG_PATH: path.join(this.userDataPath, 'logs')
    //         };

    //         this.serverProcess = spawn('node', [serverScript], {
    //             cwd: this.appPath,
    //             stdio: ['pipe', 'pipe', 'pipe'],
    //             env: env
    //         });

    //         this.serverProcess.stdout.on('data', (data) => {
    //             const output = data.toString();
    //             console.log(`Server: ${output}`);

    //             if (output.includes('Server started') || output.includes('Listening on')) {
    //                 this.isServerRunning = true;
    //                 this.updateTrayContext();
    //                 this.sendToRenderer('server-status-changed', { status: 'running' });
    //                 resolve({ success: true, message: 'Server started successfully' });
    //             }
    //         });

    //         this.serverProcess.stderr.on('data', (data) => {
    //             console.error(`Server Error: ${data}`);
    //             this.sendToRenderer('server-error', { error: data.toString() });
    //         });

    //         this.serverProcess.on('close', (code) => {
    //             console.log(`Server process exited with code ${code}`);
    //             this.isServerRunning = false;
    //             this.updateTrayContext();
    //             this.sendToRenderer('server-status-changed', { status: 'stopped' });
    //         });

    //         // Timeout after 30 seconds
    //         setTimeout(() => {
    //             if (!this.isServerRunning) {
    //                 this.serverProcess.kill();
    //                 reject(new Error('Server startup timeout'));
    //             }
    //         }, 30000);
    //     });
    // }

    async startServer() {
        try {
            return await new Promise((resolve, reject) => {
                if (this.isServerRunning) {
                    console.log('Server already running');
                    return resolve({ success: true, message: 'Server already running' });
                }

                const serverScript = path.join(this.appPath, 'src', 'core', 'server.js');
                if (!fs.existsSync(serverScript)) {
                    const err = new Error('Server script not found');
                    console.error(err);
                    return reject(err);
                }

                const env = { ...process.env, NODE_ENV: 'production' };

                this.serverProcess = spawn('node', [serverScript], { cwd: this.appPath, stdio: ['pipe', 'pipe', 'pipe'], env });

                const timeout = setTimeout(() => {
                    if (!this.isServerRunning) {
                        this.serverProcess.kill();
                        const err = new Error('Server startup timeout');
                        console.error(err);
                        reject(err);
                    }
                }, 30000);

                this.serverProcess.stdout.on('data', data => {
                    const output = data.toString();
                    console.log(`Server: ${output}`);
                    if (output.includes('Server started') || output.includes('Listening on')) {
                        clearTimeout(timeout);
                        this.isServerRunning = true;
                        resolve({ success: true, message: 'Server started successfully' });
                    }
                });

                this.serverProcess.stderr.on('data', data => {
                    console.error(`Server Error: ${data.toString()}`);
                });

                this.serverProcess.on('exit', (code) => {
                    console.log(`Server exited with code ${code}`);
                    clearTimeout(timeout);
                    if (!this.isServerRunning) {
                        const err = new Error(`Server exited before startup (code ${code})`);
                        console.error(err);
                        reject(err);
                    }
                    this.isServerRunning = false;
                });
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            return { success: false, message: error.message };
        }
    }



    async stopServer() {
        return new Promise((resolve, reject) => {
            if (!this.isServerRunning || !this.serverProcess) {
                resolve({ success: true, message: 'Server not running' });
                return;
            }

            this.serverProcess.kill('SIGTERM');

            setTimeout(() => {
                if (this.serverProcess && !this.serverProcess.killed) {
                    this.serverProcess.kill('SIGKILL');
                }
                this.isServerRunning = false;
                this.updateTrayContext();
                this.sendToRenderer('server-status-changed', { status: 'stopped' });
                resolve({ success: true, message: 'Server stopped' });
            }, 5000);
        });
    }

    async restartServer() {
        try {
            await this.stopServer();
            await new Promise(resolve => setTimeout(resolve, 2000));
            const result = await this.startServer();
            return result;
        } catch (error) {
            return { success: false, message: error.message };
        }
    }


    getServerStatus() {
        return {
            status: this.isServerRunning ? 'running' : 'stopped',
            pid: this.serverProcess ? this.serverProcess.pid : null,
            version: app.getVersion(),
            dataPath: this.userDataPath
        };
    }

    openTerminal() {
        const cliScript = path.join(this.appPath, 'bin', 'hexabase.js');
        const terminalCommands = {
            win32: `start cmd /k "cd /d "${this.appPath}" && node ${cliScript} cli"`,
            darwin: `osascript -e 'tell application "Terminal" to do script "cd \\"${this.appPath}\\" && node ${cliScript} cli"'`,
            linux: `gnome-terminal --working-directory="${this.appPath}" -- node ${cliScript} cli`
        };

        const command = terminalCommands[process.platform] || terminalCommands.linux;

        exec(command, (error) => {
            if (error) {
                console.error('Failed to open terminal:', error);
                dialog.showErrorBox('Terminal Error', 'Failed to open terminal. Please open manually.');
            }
        });
    }

    openDataDirectory() {
        shell.showItemInFolder(this.userDataPath);
    }

    showAbout() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'About HexabaseDB',
            message: 'HexabaseDB',
            detail: `Version: ${app.getVersion()}\n\nLocal Database Management System with JSON and File Storage\n\n© ${new Date().getFullYear()} Hexabase Team`,
            buttons: ['OK']
        });
    }

    updateTrayContext() {
        const status = this.isServerRunning ? 'Running' : 'Stopped';
        this.tray.setToolTip(`HexabaseDB - Server is ${status}`);
    }

    sendToRenderer(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }
}

// Initialize the application
new HexabaseDesktop();