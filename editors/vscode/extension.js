const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
    // Path to the LSP server module (try local development path first)
    let serverModule = context.asAbsolutePath(path.join('..', '..', 'server', 'server.js'));
    
    // Fallback to node_modules if not found (for production/installed)
    const installedPath = context.asAbsolutePath(path.join('node_modules', 'sommark-lsp', 'server', 'server.js'));
    
    try {
        require('fs').accessSync(serverModule);
    } catch {
        serverModule = installedPath;
    }

    console.info(`SomMark LSP: Starting server from ${serverModule}`);

    const serverOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.stdio
        },
        debug: {
            module: serverModule,
            transport: TransportKind.stdio
        }
    };

    const clientOptions = {
        // Register the server for .smark files
        documentSelector: [{ scheme: 'file', language: 'sommark' }],
        synchronize: {
            // Notify the server about file changes to 'smark.config.js' files contained in the workspace
            fileEvents: require('vscode').workspace.createFileSystemWatcher('**/smark.config.js')
        }
    };

    client = new LanguageClient(
        'sommarkLSP',
        'SomMark Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client (and the server)
    client.start();
    console.info('SomMark LSP: Client started.');
}

function deactivate() {
    if (client) {
        return client.stop();
    }
}

module.exports = { activate, deactivate };
