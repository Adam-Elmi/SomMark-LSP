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
import { validateTextDocument } from "./diagnostics.js";
import { legend, computeSemanticTokens } from "./semantic_tokens.js";
import { formatDocument } from "./formatting.js";
import { getCompletions } from "./completions.js";
import path from 'path';

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
connection.onInitialize((_params) => {
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			positionEncoding: 'utf-16',
			semanticTokensProvider: {
				legend: legend,
				full: true
			},
			documentFormattingProvider: true,
			completionProvider: {
				triggerCharacters: ["[", ",", " ", ":"]
			}
		}
	};
});

connection.onDidChangeWatchedFiles((_change) => {
	documents.all().forEach(doc => validateTextDocument(connection, doc));
});

documents.onDidOpen((event) => {
	if (!event.document.uri.endsWith(".smark")) return;
	validateTextDocument(connection, event.document);
});
// ========================================================================== //
//  4. Semantic Tokens Provider                                               //
// ========================================================================== //
connection.languages.semanticTokens.on((params) => {
	if (!params.textDocument.uri.endsWith(".smark")) return { data: [] };
	const document = documents.get(params.textDocument.uri);
	if (!document) return { data: [] };
	return computeSemanticTokens(document.getText());
});
// ========================================================================== //
//  5. Document Event Listeners                                               //
// ========================================================================== //
documents.onDidChangeContent((change) => {
	if (!change.document.uri.endsWith(".smark")) return;
	validateTextDocument(connection, change.document);
});

documents.onDidSave((_event) => {
	documents.all().forEach(doc => {
		if (doc.uri.endsWith(".smark")) {
			validateTextDocument(connection, doc);
		}
	});
});

// ========================================================================== //
//  6. Completions                                                            //
// ========================================================================== //
connection.onCompletion((params) => {
    if (!params.textDocument.uri.endsWith(".smark")) return null;
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    return getCompletions(document.getText(), params.position);
});

// ========================================================================== //
//  7. Document Formatting                                                    //
// ========================================================================== //
connection.onDocumentFormatting(async (params) => {
    if (!params.textDocument.uri.endsWith(".smark")) return [];
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    return formatDocument(document.getText(), params.options);
});

// ========================================================================== //
//  7. Clear diagnostics on close                                             //
// ========================================================================== //
documents.onDidClose((event) => {
	if (!event.document.uri.endsWith(".smark")) return;
	connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ========================================================================== //
//  7. Start Connection                                                       //
// ========================================================================== //
documents.listen(connection);
connection.listen();
