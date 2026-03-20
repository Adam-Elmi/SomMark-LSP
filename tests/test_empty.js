import { validateTextDocument } from "../server/diagnostics.js";
import { TextDocument } from "vscode-languageserver-textdocument";

const connection = {
    sendDiagnostics: (params) => {
        console.log(" Diagnostics Received:");
        console.log(JSON.stringify(params, null, 2));
    }
};

async function testDiagnostics(name, text) {
    console.log(`\nTesting: ${name}`);
    const document = TextDocument.create(`file:///test/${name}.smark`, "sommark", 1, text);
    try {
        await validateTextDocument(connection, document);
    } catch (e) {
        console.log("ERROR in testDiagnostics:", e);
    }
}

async function runTests() {
    // Test empty file
    await testDiagnostics("Empty", "");
    
    // Test only whitespace
    await testDiagnostics("Whitespace", "   \n  ");
}

runTests().catch(console.error);
