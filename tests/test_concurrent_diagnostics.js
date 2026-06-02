import { validateTextDocument } from "../server/diagnostics.js";

const mockDocumentInvalid = {
    getText: () => `
    Current count: runtime \${
        const usersData = SomMark.static(\`
            const a = ;
        \`)
    }\$
    `,
    uri: "file:///home/adam/Projects/Smark/SomMark/debug.smark"
};

const mockDocumentValid = {
    getText: () => `
    Current count: runtime \${
        const usersData = SomMark.static(\`
            const a = 1;
            return a;
        \`)
    }\$
    `,
    uri: "file:///home/adam/Projects/Smark/SomMark/debug.smark"
};

let sentDiagnostics = null;
const mockConnection = {
    sendDiagnostics: (obj) => {
        sentDiagnostics = obj.diagnostics;
        console.log(`[LSP Client] Received diagnostics count: ${sentDiagnostics.length}`);
        if (sentDiagnostics.length > 0) {
            console.log(`[LSP Client] Diagnostic message: ${sentDiagnostics[0].message.replace(/\n/g, " ").slice(0, 80)}...`);
        }
    }
};

async function runTest() {
    console.log("Starting Concurrent Diagnostics Race Test...");
    
    // Simulate rapid typing:
    // First, user has an invalid state
    const p1 = validateTextDocument(mockConnection, mockDocumentInvalid);
    // Almost immediately (e.g. 5ms), user keeps typing and fixes it to valid state
    await new Promise(resolve => setTimeout(resolve, 5));
    const p2 = validateTextDocument(mockConnection, mockDocumentValid);
    
    try {
        await Promise.all([p1, p2]);
        console.log("Completed initial validation tasks.");
        
        // Wait for deferred setImmediate validation queue to settle completely
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log(`[LSP Client] Final diagnostics count: ${sentDiagnostics.length}`);
        if (sentDiagnostics.length === 0) {
            console.log("SUCCESS: Corrected preprocessor syntax successfully cleared the diagnostic errors!");
        } else {
            console.error("FAILURE: Diagnostics still remain after correction!");
            process.exit(1);
        }
    } catch (err) {
        console.error("CRITICAL: Uncaught exception in concurrent validation!", err);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
