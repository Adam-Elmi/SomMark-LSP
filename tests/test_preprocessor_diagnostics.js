import { validateTextDocument } from "../server/diagnostics.js";

const mockDocumentInvalidStatic = {
    getText: () => `
    Current count: runtime \${
        const usersData = SomMark.static(\`
            const a = ;
        \`)
    }\$
    `,
    uri: "file:///home/adam/Projects/Smark/SomMark/debug.smark"
};

const mockDocumentInvalidImport = {
    getText: () => `
    Current count: runtime \${
        const usersData = SomMark.import("./non_existent_file.json")
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
    }
};

async function runTests() {
    console.log("Starting Preprocessor Diagnostics Tests...");

    // Test 1: Invalid Static Syntax
    sentDiagnostics = null;
    const text = mockDocumentInvalidStatic.getText();
    console.log("Document length:", text.length);
    console.log("Document lines:");
    text.split("\n").forEach((line, idx) => {
        console.log(`Line ${idx}: "${line}" (length: ${line.length})`);
    });

    await validateTextDocument(mockConnection, mockDocumentInvalidStatic);
    console.log("1. Invalid static syntax diagnostics:", sentDiagnostics);
    if (!sentDiagnostics || sentDiagnostics.length === 0) {
        console.error("Test 1 Failed: Expected diagnostic error for invalid static syntax!");
        process.exit(1);
    }
    const diag1 = sentDiagnostics[0];
    if (!diag1.message.includes("SomMark.static Execution Error")) {
        console.error(`Test 1 Failed: Unexpected diagnostic error message: "${diag1.message}"`);
        process.exit(1);
    }
    // Verify it points to the SomMark.static line (line 2, start character 26)
    console.log("Test 1 range:", diag1.range);
    if (diag1.range.start.line !== 2 || diag1.range.start.character !== 26) {
        console.error("Test 1 Failed: Diagnostic did not point to the correct SomMark.static expression!");
        process.exit(1);
    }
    console.log("Test 1 Passed: Diagnostic for invalid static syntax matches perfectly!");

    // Test 2: Invalid Import (File not found)
    sentDiagnostics = null;
    await validateTextDocument(mockConnection, mockDocumentInvalidImport);
    console.log("2. Invalid import diagnostics:", sentDiagnostics);
    if (!sentDiagnostics || sentDiagnostics.length === 0) {
        console.error("Test 2 Failed: Expected diagnostic error for non-existent import file!");
        process.exit(1);
    }
    const diag2 = sentDiagnostics[0];
    if (!diag2.message.includes("File not found")) {
        console.error(`Test 2 Failed: Unexpected diagnostic error message: "${diag2.message}"`);
        process.exit(1);
    }
    // Verify it points to the SomMark.import line (line 2, character 26)
    console.log("Test 2 range:", diag2.range);
    if (diag2.range.start.line !== 2 || diag2.range.start.character !== 26) {
        console.error("Test 2 Failed: Diagnostic did not point to the correct SomMark.import expression!");
        process.exit(1);
    }
    console.log("Test 2 Passed: Diagnostic for non-existent file import matches perfectly!");

    // Test 3: Valid Runtime block
    sentDiagnostics = null;
    await validateTextDocument(mockConnection, mockDocumentValid);
    console.log("3. Valid preprocessor diagnostics:", sentDiagnostics);
    if (!sentDiagnostics || sentDiagnostics.length !== 0) {
        console.error("Test 3 Failed: Expected zero diagnostics for valid preprocessor block!", sentDiagnostics);
        process.exit(1);
    }
    console.log("Test 3 Passed: Valid preprocessor block generated zero errors!");

    console.log("ALL PREPROCESSOR DIAGNOSTICS TESTS PASSED SUCCESSFULY!");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
