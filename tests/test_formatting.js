import { TextDocument } from 'vscode-languageserver-textdocument';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js';
// We need to mock the connection partially to test the handler
// But actually we can just manually call the handler if we expose it or just test the logic.

// Since server.js is a script that starts a connection, testing it directly is hard without refactoring.
// For now, I'll create a standalone test that re-implements the logic from server.js to verify it works as expected.

import SomMark from 'sommark';

async function testFormatting() {
    const text = `
[Block = attr: "val with space", next: normal]
  text at top level
    (inline)->(bold)
[end]
`;
    const params = {
        textDocument: { uri: 'file:///test.smark' },
        options: { tabSize: 2, insertSpaces: true }
    };

    console.log("Original Text:\n", text);

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

        console.log("Formatted Text:\n", formatted);
        
        if (formatted.includes('  ') && !text.includes('  ')) {
             console.log("PASS: Indentation applied (2 spaces).");
        } else if (formatted !== text) {
             console.log("PASS: Text was formatted.");
        } else {
             console.error("FAIL: Text was not changed.");
             process.exit(1);
        }
    } catch (e) {
        console.error("FAIL: Error during formatting:", e.message);
        process.exit(1);
    }
}

testFormatting();
