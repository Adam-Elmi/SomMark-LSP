import { validateTextDocument } from "../server/diagnostics.js";

const mockDocument = {
    getText: () => `
    [for-each = static \${[
        { username: "A", id: 101 }
    ]}\$, as: "user"]
        [span]
        Username: static \${user.username}\$
        ID: static \${user.id}\$
        [end]
    [end]
    static \${
        let company = "SomMark";
        return \`Built by \${company}\`;
    }\$
    `,
    uri: "file:///home/adam/Projects/Smark/SomMark/debug.smark"
};

let sentDiagnostics = null;
const mockConnection = {
    sendDiagnostics: (obj) => {
        sentDiagnostics = obj.diagnostics;
    }
};

async function test() {
    await validateTextDocument(mockConnection, mockDocument);
    console.log("Diagnostics result:", sentDiagnostics);
    if (sentDiagnostics && sentDiagnostics.length === 0) {
        console.log("SUCCESS: LSP diagnostics generated exactly 0 errors for the dynamic loop block!");
    } else {
        console.error("FAILURE: LSP generated diagnostic errors:", sentDiagnostics);
        process.exit(1);
    }
}

test().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
