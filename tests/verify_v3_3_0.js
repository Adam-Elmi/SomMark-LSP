import { validateTextDocument } from '../server/diagnostics.js';

// connection and document
const mockConnection = {
    sendDiagnostics: ({ uri, diagnostics }) => {
        console.log(`Diagnostics for ${uri}:`, JSON.stringify(diagnostics, null, 2));
        if (diagnostics.length > 0) {
            console.error("FAIL: Expected 0 diagnostics for valid v3.3.0 content, but got:", diagnostics.length);
            process.exit(1);
        } else {
            console.log("PASS: No diagnostics reported for top-level content.");
        }
    }
};

const mockDocument = {
    uri: 'file:///test.smark',
    getText: () => `
Hello World at top level
(This is inline)->(bold)
@_Raw_@;
This is at-block at top level
@_end_@
`
};

console.log("Testing top-level content diagnostics...");
await validateTextDocument(mockConnection, mockDocument);
