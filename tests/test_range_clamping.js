import { clampRange, parseSomMarkError, parseSomMarkWarning } from "../server/diagnostics.js";
import assert from "node:assert";

const testText = `Hello World!
12345
Goodbye!`;

// Test text lines:
// Line 0: "Hello World!" (length 12)
// Line 1: "12345" (length 5)
// Line 2: "Goodbye!" (length 8)

function runTests() {
    console.log("--- Testing Diagnostic Range Clamping ---");

    // Test Case 1: Standard valid range (within bounds)
    console.log("Test Case 1: Standard valid range (within bounds)");
    const r1 = clampRange(testText, 0, 0, 0, 5);
    assert.deepStrictEqual(r1.start, { line: 0, character: 0 });
    assert.deepStrictEqual(r1.end, { line: 0, character: 5 });
    console.log("Case 1 Passed!");

    // Test Case 2: Out of bounds line numbers
    console.log("Test Case 2: Out of bounds line numbers");
    const r2 = clampRange(testText, 5, 0, 10, 100);
    // Should clamp to the last line (line 2) and end character to line 2's length (8)
    assert.deepStrictEqual(r2.start, { line: 2, character: 0 });
    assert.deepStrictEqual(r2.end, { line: 2, character: 8 });
    console.log("Case 2 Passed!");

    // Test Case 3: Out of bounds characters on a valid line
    console.log("Test Case 3: Out of bounds characters on a valid line");
    const r3 = clampRange(testText, 1, 0, 1, 50);
    // Line 1 has length 5. End character 50 should clamp to 5.
    assert.deepStrictEqual(r3.start, { line: 1, character: 0 });
    assert.deepStrictEqual(r3.end, { line: 1, character: 5 });
    console.log("Case 3 Passed!");

    // Test Case 4: Reverse range (start after end)
    console.log("Test Case 4: Reverse range (start after end)");
    const r4 = clampRange(testText, 2, 5, 0, 0);
    // Should swap start and end, and clamp correctly
    assert.deepStrictEqual(r4.start, { line: 0, character: 0 });
    assert.deepStrictEqual(r4.end, { line: 2, character: 5 });
    console.log("Case 4 Passed!");

    // Test Case 5: Empty range (start === end) expands to at least 1 character
    console.log("Test Case 5: Empty range (start === end) expands to at least 1 character");
    const r5 = clampRange(testText, 1, 2, 1, 2);
    assert.deepStrictEqual(r5.start, { line: 1, character: 2 });
    assert.deepStrictEqual(r5.end, { line: 1, character: 3 });
    console.log("Case 5 Passed!");

    // Test Case 6: parseSomMarkWarning warning parsing with out of bounds line
    console.log("Test Case 6: parseSomMarkWarning warning parsing with out of bounds line");
    const warningText = "Warning: potential issue at line 15";
    const diagWarning = parseSomMarkWarning(warningText, testText);
    // Warning line is 14 (15 - 1). Max line in testText is 2.
    // Range should clamp to line 2, character 0 to 8
    assert.deepStrictEqual(diagWarning.range.start, { line: 2, character: 0 });
    assert.deepStrictEqual(diagWarning.range.end, { line: 2, character: 8 });
    console.log("Case 6 Passed!");

    // Test Case 7: parseSomMarkError parsing multi-line error with out of bounds coordinates
    console.log("Test Case 7: parseSomMarkError parsing multi-line error with out of bounds coordinates");
    const errorText = "Error from line 1, column 5 to line 8, column 200";
    const diagError = parseSomMarkError(errorText, testText);
    // Start: line 0, column 5 (within bounds of line 0 "Hello World!" length 12)
    // End: line 7 (clamped to 2), column 200 (clamped to line 2 "Goodbye!" length 8)
    assert.deepStrictEqual(diagError.range.start, { line: 0, character: 5 });
    assert.deepStrictEqual(diagError.range.end, { line: 2, character: 8 });
    console.log("Case 7 Passed!");

    console.log("ALL RANGE TESTS PASSED SUCCESSFULLY!");
}

runTests();
