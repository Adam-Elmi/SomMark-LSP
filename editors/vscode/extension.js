const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
    // Path to the LSP server module (relative to the extension folder)
    const serverModule = context.asAbsolutePath(path.join('node_modules', 'sommark-lsp', 'server', 'server.js'));
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
        documentSelector: [{ scheme: 'file', language: 'sommark' }]
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
