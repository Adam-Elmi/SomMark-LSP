#!/usr/bin/env node
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	TextDocumentSyncKind
} from "vscode-languageserver/node.js";

import { TextDocument } from "vscode-languageserver-textdocument";
import SomMark from "sommark";
import { validateTextDocument } from "./diagnostics.js";
import { legend, computeSemanticTokens } from "./semantic_tokens.js";
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
	const result = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			positionEncoding: 'utf-16',
			semanticTokensProvider: {
				legend: legend,
				full: true
			},
			documentFormattingProvider: true
		}
	};
	return result;
});
// ========================================================================== //
//  4. Semantic Tokens Provider                                               //
// ========================================================================== //
connection.languages.semanticTokens.on(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return { data: [] };
	}
	const tokens = await computeSemanticTokens(document.getText());
	return tokens;
});
// ========================================================================== //
//  5. Document Formatting Provider                                           //
// ========================================================================== //
connection.onDocumentFormatting(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}

	const text = document.getText();
	const indentString = params.options.insertSpaces ? ' '.repeat(params.options.tabSize) : '\t';

	const smark = new SomMark({
		src: text,
		format: 'html',
		plugins: [
			{ name: 'sommark-format', options: { indentString } }
		]
	});

	try {
		await smark.parse();
		const formatPlugin = smark.plugins.find(p => p.name === 'sommark-format');
		const formatted = formatPlugin ? formatPlugin.formattedSource : text;

		return [{
			range: {
				start: { line: 0, character: 0 },
				end: document.positionAt(text.length)
			},
			newText: formatted
		}];
	} catch (e) {
		console.error("[Formatting Error]:", e.message);
		return [];
	}
});
// ========================================================================== //
//  5. Document Event Listeners                                               //
// ========================================================================== //
documents.onDidChangeContent((change) => {
	// connection.console.log(`Validating: ${change.document.uri}`);
	validateTextDocument(connection, change.document);
});

// ========================================================================== //
//  6. Clear diagnostics on close                                             //
// ========================================================================== //
documents.onDidClose((event) => {
	// connection.console.log(`Closing: ${event.document.uri}`);
	connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ========================================================================== //
//  7. Start Connection                                                       //
// ========================================================================== //
documents.listen(connection);
connection.listen();
