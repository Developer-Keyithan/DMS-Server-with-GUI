const chalk = require('chalk');

const colors = {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
    highlight: chalk.cyan,
    muted: chalk.gray,
    bold: chalk.bold,
    rainbow: chalk.hex('#FF6B6B'),
    
    // Context colors
    database: chalk.hex('#4ECDC4'),
    cluster: chalk.hex('#45B7D1'), 
    collection: chalk.hex('#96CEB4'),
    bucket: chalk.hex('#FECA57'),
    folder: chalk.hex('#FF9FF3'),
    user: chalk.hex('#54A0FF'),
    
    // Table colors
    header: chalk.hex('#FFD700').bold,
    row: chalk.white,
    alternateRow: chalk.gray
};

// Helper methods
colors.printSuccess = (message) => console.log(colors.success('✓ ' + message));
colors.printError = (message) => console.log(colors.error('✗ ' + message));
colors.printWarning = (message) => console.log(colors.warning('⚠ ' + message));
colors.printInfo = (message) => console.log(colors.info('ℹ ' + message));

colors.printTable = (headers, rows) => {
    // Calculate column widths
    const colWidths = headers.map((header, index) => {
        const headerLen = header.length;
        const maxDataLen = Math.max(...rows.map(row => 
            String(row[index] || '').length
        ));
        return Math.max(headerLen, maxDataLen);
    });

    // Print header
    const headerLine = headers.map((header, i) => 
        colors.header(header.padEnd(colWidths[i]))
    ).join('|');
    console.log('+' + '-'.repeat(headerLine.length - 9) + '+');
    console.log('|' + headerLine + '|');
    console.log('+' + '-'.repeat(headerLine.length - 9) + '+');

    // Print rows
    rows.forEach((row, rowIndex) => {
        const rowLine = row.map((cell, i) => 
            (rowIndex % 2 === 0 ? colors.row : colors.alternateRow)(
                String(cell || '').padEnd(colWidths[i])
            )
        ).join('|');
        console.log('|' + rowLine + '|');
    });

    console.log('+' + '-'.repeat(headerLine.length - 9) + '+');
};

module.exports = colors;