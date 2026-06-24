const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
    let serverModule = context.asAbsolutePath(path.join('..', '..', 'server', 'server.js'));

    try {
        require('fs').accessSync(serverModule);
    } catch {
        serverModule = context.asAbsolutePath(path.join('node_modules', 'sommark-lsp', 'server', 'server.js'));
    }

    console.info(`SomMark LSP: Starting server from ${serverModule}`);

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
        'SomMark Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
    console.info('SomMark LSP: Client started.');
}

function deactivate() {
    if (client) {
        return client.stop();
    }
}

module.exports = { activate, deactivate };
