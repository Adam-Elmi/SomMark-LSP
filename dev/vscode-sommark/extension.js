const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
    const serverModule = '/home/adam/Projects/SomMark-LSP/server/server.js';

    const serverOptions = {
        run:   { module: serverModule, transport: TransportKind.stdio },
        debug: { module: serverModule, transport: TransportKind.stdio }
    };

    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'sommark' }],
        synchronize: {
            fileEvents: require('vscode').workspace.createFileSystemWatcher('**/smark.config.js')
        }
    };

    client = new LanguageClient(
        'sommarkLSP',
        'SomMark Language Server (dev)',
        serverOptions,
        clientOptions
    );

    client.start();
}

function deactivate() {
    if (client) {
        return client.stop();
    }
}

module.exports = { activate, deactivate };
