#!/usr/bin/env node
console.error("DEBUG: LSP Process Spawned at " + new Date().toISOString());

// Globally redirect stdout-facing console methods to stderr to prevent LSP protocol stream corruption.
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);
console.debug = (...args) => console.error(...args);
console.warn = (...args) => console.error(...args);
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	TextDocumentSyncKind
} from "vscode-languageserver/node.js";

import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "node:url";
import SomMark from "sommark";
import { validateTextDocument } from "./diagnostics.js";
import { legend, computeSemanticTokens } from "./semantic_tokens.js";
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

// ========================================================================== //
//  1. Server Initialization & Connection Setup                               //
// ========================================================================== //
const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);

// ========================================================================== //
//  2. Document Management                                                    //
// ========================================================================== //
const documents = new TextDocuments(TextDocument);

// ========================================================================== //
//  3. Lifecycle Handlers                                                     //
// ========================================================================== //
connection.onInitialize((params) => {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	const result = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			positionEncoding: 'utf-16',
			semanticTokensProvider: {
				legend: legend,
				full: true
			}
		}
	};
	return result;
});

connection.onDidChangeWatchedFiles((_change) => {
	// Re-validate all open documents when configuration changes
	documents.all().forEach(doc => validateTextDocument(connection, doc));
});

// Trigger validation as soon as a document is opened
documents.onDidOpen((event) => {
	if (!event.document.uri.endsWith(".smark")) return;
	validateTextDocument(connection, event.document);
});
// ========================================================================== //
//  4. Semantic Tokens Provider                                               //
// ========================================================================== //
connection.languages.semanticTokens.on(async (params) => {
	console.error(`DEBUG: semanticTokens.on requested for ${params.textDocument.uri}`);
	if (!params.textDocument.uri.endsWith(".smark")) {
		console.error(`DEBUG: semanticTokens.on ignored: URI does not end with .smark`);
		return { data: [] };
	}
	// Wait up to 500ms for the document to appear in memory (fixes startup race condition)
	let document = documents.get(params.textDocument.uri);
	if (!document) {
		for (let i = 0; i < 10; i++) {
			await new Promise(resolve => setTimeout(resolve, 50));
			document = documents.get(params.textDocument.uri);
			if (document) break;
		}
	}

	if (!document) {
		console.error(`DEBUG: semanticTokens.on document not found in manager: ${params.textDocument.uri}`);
		return { data: [] };
	}
	const tokens = await computeSemanticTokens(document.getText());
	console.error(`DEBUG: semanticTokens.on returning ${tokens.data ? tokens.data.length : 0} token data values`);
	return tokens;
});
// ========================================================================== //
//  5. Document Formatting Provider                                           //
// ========================================================================== //
// Document formatting handler disabled because core formatter was removed in v4.1/v4.2
// connection.onDocumentFormatting(async (params) => { ... });
// ========================================================================== //
//  5. Document Event Listeners                                               //
// ========================================================================== //
documents.onDidChangeContent((change) => {
	if (!change.document.uri.endsWith(".smark")) return;
	// connection.console.log(`Validating: ${change.document.uri}`);
	validateTextDocument(connection, change.document);
});

documents.onDidSave((event) => {
	// When any document is saved, its changes hit the disk.
	// Since other files might import it (which reads from disk),
	// we must re-validate ALL open documents to update cross-file errors automatically.
	documents.all().forEach(doc => {
		if (doc.uri.endsWith(".smark")) {
			validateTextDocument(connection, doc);
		}
	});
});

// ========================================================================== //
//  6. Clear diagnostics on close                                             //
// ========================================================================== //
documents.onDidClose((event) => {
	if (!event.document.uri.endsWith(".smark")) return;
	// connection.console.log(`Closing: ${event.document.uri}`);
	connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ========================================================================== //
//  7. Start Connection                                                       //
// ========================================================================== //
documents.listen(connection);
connection.listen();
